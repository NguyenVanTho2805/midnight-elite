// Lịch tuần của gia sư — danh sách theo ngày; mở một buổi để:
//  • xử lý "Báo nghỉ sát giờ" bằng MỘT nút (TT-202);
//  • mở Zalo với tin nhắc lịch soạn sẵn, sửa được trước khi gửi (TT-201/TT-199 giai đoạn 1).
// Khi Hộp việc đang tắt, việc cần xử lý hiện thành chấm kèm chữ ngay trên đúng buổi (TT-203).
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KinButton } from "@/components/kin";
import { Badge, CARD_STYLE, FIELD_STYLE, Modal, callApi, copyText, useNotify } from "@/components/tutor/shared";
import { addDaysKey, buildGroupReminderMessage, dayOfWeekOfKey, describeLead, hmOf, vnDateKeyOf, vnMinutesOfDay, weekRangeOf } from "@/lib/classSessions";
import { openZalo } from "@/lib/zaloShare";
import type { ReminderItem, ScheduleOccurrence, ScheduleStudent } from "@/lib/reminderServer";

interface Payload {
  from: string; to: string; now: string;
  occurrences: ScheduleOccurrence[];
  counters: { pendingAbsences: number; remindersDue: number; makeupExpiring: number };
}
interface Resolved { status: string; message: string; phone: string | null }

const WEEKDAY = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const vnHm = (iso: string) => hmOf(vnMinutesOfDay(new Date(iso)));
const vnDayHm = (iso: string) => `${vnHm(iso)} ngày ${ddmm(vnDateKeyOf(new Date(iso)))}`;

const ABSENCE_LABEL: Record<string, { tone: "ok" | "wait" | "neutral"; text: string }> = {
  pending:      { tone: "wait",    text: "Báo nghỉ sát giờ — chờ bạn xử lý" },
  excused_auto: { tone: "ok",      text: "Nghỉ có báo — đã giữ 1 buổi bù" },
  excused_free: { tone: "ok",      text: "Không tính phí — đã giữ 1 buổi bù" },
  charged:      { tone: "neutral", text: "Tính phí buổi này" },
};

export default function LichClient() {
  const notify = useNotify();
  const router = useRouter();
  const [from, setFrom] = useState(() => weekRangeOf(vnDateKeyOf(new Date())).from);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Record<string, Resolved>>({});
  const [compose, setCompose] = useState<{ occ: ScheduleOccurrence; student: ScheduleStudent; item: ReminderItem; text: string } | null>(null);
  const [groupCompose, setGroupCompose] = useState<{ occ: ScheduleOccurrence; text: string } | null>(null); // PH-216: nhắc cả lớp vào nhóm Zalo
  const seq = useRef(0);

  const load = useCallback(async (f: string, quiet = false) => {
    await Promise.resolve();
    const my = ++seq.current;
    if (!quiet) { setLoading(true); setFailed(false); }
    const r = await callApi<Payload>(`/api/tutor/schedule?from=${f}&to=${addDaysKey(f, 6)}`);
    if (my !== seq.current) return; // bỏ kết quả cũ khi đổi tuần nhanh
    if (!r.ok) { if (!quiet) setFailed(true); else notify.err(r.data.error ?? "Không làm mới được lịch"); }
    else setData(r.data);
    setLoading(false);
    if (quiet && r.ok) router.refresh(); // số đỏ trên thanh module (vỏ gia sư) đọc lại từ máy chủ
  }, [notify, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(from);
  }, [load, from]);

  const todayKey = vnDateKeyOf(new Date());
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(from, i));
  const thisWeek = weekRangeOf(todayKey).from;

  async function resolve(absenceId: string, action: "free_makeup" | "charge") {
    if (busy) return;
    setBusy(absenceId);
    const r = await callApi<{ status: string; message: string; parentPhone: string | null }>(`/api/tutor/absences/${absenceId}`, { method: "PATCH", body: JSON.stringify({ action }) });
    setBusy(null);
    if (!r.ok) { notify.err(r.data.error ?? "Không xử lý được"); if (r.status === 409) void load(from, true); return; }
    setResolved(m => ({ ...m, [absenceId]: { status: r.data.status, message: r.data.message, phone: r.data.parentPhone } }));
    notify.ok(action === "free_makeup" ? "Đã ghi nhận nghỉ có báo và giữ 1 buổi bù." : "Đã ghi nhận tính phí buổi này.");
    void load(from, true);
  }

  async function sendResolved(absenceId: string) {
    const rs = resolved[absenceId];
    if (!rs) return;
    const res = await openZalo({ text: rs.message, phone: rs.phone });
    if (res.opened) notify.info(res.method === "share" ? "Chọn Zalo trong bảng chia sẻ rồi bấm gửi." : "Đã chép tin và mở Zalo — dán vào cuộc trò chuyện rồi bấm gửi.");
    else if (res.reason === "failed") notify.err("Không mở được Zalo. Hãy chép tin và gửi tay.");
  }

  async function openComposed() {
    if (!compose) return;
    const { occ, student, item, text } = compose;
    const res = await openZalo({ text, phone: item.phone });
    if (!res.opened) { if (res.reason === "failed") notify.err("Không mở được Zalo. Hãy chép tin và gửi tay."); return; }
    // KiN chỉ ghi "đã mở Zalo", không biết tin có đi thật hay không.
    const log = await callApi("/api/tutor/reminders", {
      method: "POST",
      body: JSON.stringify({ scheduleId: occ.scheduleId, dateKey: occ.dateKey, studentId: student.id, recipient: item.recipient, kind: item.kind }),
    });
    if (!log.ok) notify.err(log.data.error ?? "Đã mở Zalo nhưng chưa ghi lại được.");
    else notify.info(res.method === "share" ? "Chọn Zalo trong bảng chia sẻ rồi bấm gửi." : "Đã chép tin và mở Zalo — dán vào cuộc trò chuyện rồi bấm gửi.");
    setCompose(null);
    void load(from, true);
  }

  async function openGroupReminder() {
    if (!groupCompose) return;
    const res = await openZalo({ text: groupCompose.text, groupUrl: groupCompose.occ.zaloGroupUrl });
    if (!res.opened) { if (res.reason === "failed") notify.err("Không mở được Zalo. Hãy chép tin và gửi tay."); return; }
    notify.info(res.method === "share" ? "Chọn nhóm Zalo trong bảng chia sẻ rồi bấm gửi." : "Đã chép tin và mở Zalo — dán vào nhóm rồi bấm gửi.");
    setGroupCompose(null);
  }

  const occByDay = (k: string) => (data?.occurrences ?? []).filter(o => o.dateKey === k);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <header className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Lịch</h1>
          <p className="text-caption mt-1" style={{ color: "var(--kin-chu-phu)" }} aria-live="polite">Tuần {ddmm(from)} – {ddmm(addDaysKey(from, 6))}</p>
        </div>
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Chuyển tuần">
          <KinButton variant="secondary" onClick={() => setFrom(addDaysKey(from, -7))}>← Tuần trước</KinButton>
          <KinButton variant="secondary" onClick={() => setFrom(thisWeek)} disabled={from === thisWeek}>Tuần này</KinButton>
          <KinButton variant="secondary" onClick={() => setFrom(addDaysKey(from, 7))}>Tuần sau →</KinButton>
        </div>
      </header>

      {failed && (
        <div role="alert" className="rounded-xl p-3 mb-4 flex items-center justify-between gap-3" style={{ ...CARD_STYLE, borderColor: "var(--kin-tt-chu-loi)" }}>
          <span className="text-sm" style={{ color: "var(--kin-tt-chu-loi)" }}>Không tải được lịch. Kiểm tra mạng rồi thử lại.</span>
          <KinButton variant="secondary" onClick={() => void load(from)}>Thử lại</KinButton>
        </div>
      )}

      {loading && !data ? (
        <div aria-busy="true" aria-label="Đang tải lịch" className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="rounded-xl h-[68px]" style={{ ...CARD_STYLE, opacity: 0.6 }} />)}
        </div>
      ) : data && data.occurrences.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ ...CARD_STYLE, borderStyle: "dashed" }}>
          <p className="font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Tuần này chưa có buổi học nào</p>
          <p className="text-sm mt-1" style={{ color: "var(--kin-chu-phu)" }}>
            Buổi học lấy từ khung giờ hằng tuần của lớp. Thêm giờ học ở tab <b>Lịch học</b> trong trang lớp.
          </p>
          <Link href="/lop-cua-toi/lop" className="inline-flex items-center mt-4 px-4 py-2 rounded-lg text-sm min-h-[44px]"
            style={{ background: "var(--kin-nen-nhan)", color: "var(--kin-th-navy)", border: "1px solid var(--kin-vien-thuong)" }}>Xem các lớp của tôi</Link>
        </div>
      ) : (
        <div className={loading ? "opacity-70" : ""}>
          {days.map(k => {
            const occs = occByDay(k);
            if (occs.length === 0) return null;
            return (
              <section key={k} aria-labelledby={`d-${k}`} className="mb-5">
                <h2 id={`d-${k}`} className="text-sm font-bold mb-2 flex items-center gap-2" style={{ color: "var(--kin-chu-chinh)" }}>
                  {WEEKDAY[dayOfWeekOfKey(k)]} {ddmm(k)}
                  {k === todayKey && <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "var(--kin-nen-nhan)", color: "var(--kin-th-navy)" }}>Hôm nay</span>}
                </h2>
                <ul className="space-y-2">
                  {occs.map(o => (
                    <li key={o.key}>
                      <OccurrenceCard occ={o} nowMs={Date.parse(data?.now ?? "") || 0} expanded={open === o.key} onToggle={() => setOpen(open === o.key ? null : o.key)}
                        busy={busy} resolved={resolved} onResolve={resolve} onSendResolved={sendResolved}
                        onCompose={(student, item) => setCompose({ occ: o, student, item, text: item.message })}
                        onGroup={() => setGroupCompose({ occ: o, text: buildGroupReminderMessage({ subject: o.courseName, startAt: new Date(o.startAt), joinUrl: o.joinUrl, now: new Date(data?.now ?? Date.now()) }) })} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {groupCompose && (
        <Modal title={`Nhắc cả lớp — ${groupCompose.occ.courseName}`} onClose={() => setGroupCompose(null)}>
          <label className="block text-sm" htmlFor="tin-nhac-nhom">Tin nhắn (sửa được trước khi gửi)</label>
          <textarea id="tin-nhac-nhom" rows={5} value={groupCompose.text} onChange={e => setGroupCompose(c => (c ? { ...c, text: e.target.value } : c))}
            className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={FIELD_STYLE} />
          <p className="text-xs mt-2" style={{ color: "var(--kin-chu-phu)" }}>
            Tin chung cho cả nhóm: không tên em, không điểm. {groupCompose.occ.zaloGroupUrl ? "Sẽ mở nhóm Zalo của lớp." : "Chưa gắn nhóm Zalo — KiN sẽ chép tin và mở Zalo, bạn chọn đúng nhóm."} KiN không gửi giúp: bạn tự bấm gửi trong Zalo.
          </p>
          <div className="flex gap-2 flex-wrap mt-4 justify-end">
            <KinButton variant="secondary" onClick={async () => { if (await copyText(groupCompose.text)) notify.ok("Đã sao chép tin."); else notify.err("Không sao chép được."); }}>Sao chép</KinButton>
            <KinButton onClick={() => void openGroupReminder()} disabled={!groupCompose.text.trim()}>Mở Zalo</KinButton>
          </div>
        </Modal>
      )}

      {compose && (
        <Modal title={`${compose.item.kind === "h24" ? "Nhắc 24 giờ" : "Nhắc 1 giờ"} — ${compose.item.recipient === "parent" ? "phụ huynh của " : ""}${compose.student.name}`} onClose={() => setCompose(null)}>
          <label className="block text-sm" htmlFor="tin-nhac">Tin nhắn (sửa được trước khi gửi)</label>
          <textarea id="tin-nhac" rows={7} value={compose.text} onChange={e => setCompose(c => (c ? { ...c, text: e.target.value } : c))}
            className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={FIELD_STYLE} />
          <p className="text-xs mt-2" style={{ color: "var(--kin-chu-phu)" }}>
            {compose.item.phone ? `Sẽ mở Zalo của ${compose.item.phone}.` : "Chưa có số điện thoại — KiN sẽ chép tin và mở Zalo, bạn chọn đúng người nhận."}
            {" "}KiN không gửi giúp: bạn tự bấm gửi trong Zalo.
          </p>
          <div className="flex gap-2 flex-wrap mt-4 justify-end">
            <KinButton variant="secondary" onClick={async () => { if (await copyText(compose.text)) notify.ok("Đã sao chép tin."); else notify.err("Không sao chép được."); }}>Sao chép</KinButton>
            <KinButton onClick={() => void openComposed()} disabled={!compose.text.trim()}>Mở Zalo</KinButton>
          </div>
        </Modal>
      )}
    </div>
  );
}

function OccurrenceCard(p: {
  occ: ScheduleOccurrence; nowMs: number; expanded: boolean; onToggle: () => void; busy: string | null;
  resolved: Record<string, Resolved>;
  onResolve: (absenceId: string, action: "free_makeup" | "charge") => void;
  onSendResolved: (absenceId: string) => void;
  onCompose: (s: ScheduleStudent, item: ReminderItem) => void;
  onGroup: () => void;
}) {
  const { occ } = p;
  const done = p.nowMs > 0 && new Date(occ.endAt).getTime() < p.nowMs; // giờ máy chủ lúc tải, không đọc đồng hồ khi render
  const detailId = `chi-tiet-${occ.key}`;
  return (
    <div className="rounded-xl" style={CARD_STYLE}>
      <button type="button" onClick={p.onToggle} aria-expanded={p.expanded} aria-controls={detailId}
        className="w-full text-left px-4 py-3 flex items-center gap-3 min-h-[44px]">
        <span className="font-bold tabular-nums flex-shrink-0 text-sm" style={{ color: "var(--kin-chu-chinh)" }}>{vnHm(occ.startAt)}–{vnHm(occ.endAt)}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold truncate" style={{ color: "var(--kin-chu-chinh)" }}>{occ.courseName}</span>
          <span className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>
            {occ.students.length} học viên · {done ? "đã kết thúc" : occ.started ? "đang diễn ra" : "sắp tới"}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1 flex-shrink-0">
          {occ.pendingAbsences > 0 && <Badge tone="bad">{occ.pendingAbsences} báo nghỉ sát giờ</Badge>}
          {occ.remindersDue > 0 && <Badge tone="wait">{occ.remindersDue} tin nhắc chờ gửi</Badge>}
        </span>
        <span aria-hidden style={{ color: "var(--kin-chu-phu)" }}>{p.expanded ? "▾" : "▸"}</span>
      </button>

      {p.expanded && (
        <div id={detailId} className="px-4 pb-4 space-y-4" style={{ borderTop: "1px solid var(--kin-vien-thuong)" }}>
          <p className="text-sm pt-3" style={{ color: "var(--kin-chu-phu)" }}>
            {occ.joinUrl
              ? <>Link vào lớp: <a href={occ.joinUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--kin-nhan-link)" }}>{occ.joinUrl}</a></>
              : <>Chưa có link vào lớp. Thêm ở tab <Link href={`/admin/khoa-hoc/${occ.courseId}?tab=lich-hoc`} className="underline" style={{ color: "var(--kin-nhan-link)" }}>Lịch học</Link> để tin nhắc có link.</>}
          </p>

          {occ.students.some(s => s.absence) && (
            <div>
              <h3 className="text-sm font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Báo nghỉ</h3>
              <ul className="space-y-2">
                {occ.students.filter(s => s.absence).map(s => {
                  const a = s.absence!;
                  const rs = p.resolved[a.id];
                  const label = ABSENCE_LABEL[rs?.status ?? a.status] ?? { tone: "neutral" as const, text: a.status };
                  return (
                    <li key={s.id} className="rounded-lg p-3" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>{s.name}</span>
                        <Badge tone={label.tone}>{label.text}</Badge>
                      </div>
                      <p className="text-xs mt-1" style={{ color: "var(--kin-chu-phu)" }}>
                        {describeLead(a.leadMinutes)}{a.reason ? ` · Lý do: ${a.reason}` : ""}
                      </p>
                      {a.status === "pending" && !rs && (
                        <div className="flex gap-2 flex-wrap mt-3">
                          <KinButton loading={p.busy === a.id} onClick={() => p.onResolve(a.id, "free_makeup")}>Không tính phí, giữ 1 buổi bù</KinButton>
                          <KinButton variant="secondary" disabled={p.busy === a.id} onClick={() => p.onResolve(a.id, "charge")}>Tính phí buổi này</KinButton>
                        </div>
                      )}
                      {rs && (
                        <div className="mt-3">
                          <p className="text-xs whitespace-pre-line rounded-lg p-2" style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-chinh)" }}>{rs.message}</p>
                          <div className="mt-2"><KinButton variant="secondary" onClick={() => p.onSendResolved(a.id)}>Nhắn phụ huynh qua Zalo</KinButton></div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div>
            <h3 className="text-sm font-bold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Nhắc lịch</h3>
            <p className="text-xs mb-2" style={{ color: "var(--kin-chu-phu)" }}>
              Nhắc 24 giờ: {vnDayHm(occ.plan.h24DueAt)}{occ.plan.h24Shifted ? " (dời về tối trước giờ yên lặng)" : ""} ·{" "}
              {occ.plan.h1DueAt ? `Nhắc 1 giờ: ${vnDayHm(occ.plan.h1DueAt)}` : `Nhắc 1 giờ: bỏ (${occ.plan.h1SkipReason === "sang-som" ? "buổi trước 08:00" : "rơi vào giờ yên lặng"})`} ·{" "}
              Hạn báo nghỉ giữ buổi bù: {vnDayHm(occ.plan.absenceDeadlineAt)}
            </p>
            {!occ.started && (
              <div className="mb-2 flex items-center gap-2 flex-wrap">
                <KinButton variant="secondary" onClick={p.onGroup}>Nhắc cả lớp trong nhóm Zalo</KinButton>
                <span className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>
                  {occ.zaloGroupUrl ? "Đã gắn nhóm Zalo của lớp." : <>Chưa gắn nhóm Zalo — thêm ở <Link href="/lop-cua-toi/cai-dat#ket-noi" className="underline" style={{ color: "var(--kin-nhan-link)" }}>Cài đặt → Kết nối</Link>.</>} Tin chung, không tên em.
                </span>
              </div>
            )}
            {occ.students.every(s => s.reminders.length === 0) ? (
              <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>{occ.started ? "Buổi đã bắt đầu — không nhắc nữa." : "Chưa có tin nào tới hạn gửi."}</p>
            ) : (
              <ul className="space-y-2">
                {occ.students.filter(s => s.reminders.length > 0).map(s => (
                  <li key={s.id} className="rounded-lg p-3" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
                    <p className="text-sm font-semibold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>{s.name}</p>
                    <ul className="space-y-2">
                      {s.reminders.map(r => (
                        <li key={`${r.recipient}-${r.kind}`} className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm" style={{ color: "var(--kin-chu-chinh)" }}>
                            {r.kind === "h24" ? "Nhắc 24 giờ" : "Nhắc 1 giờ"} · {r.recipient === "parent" ? "phụ huynh" : "học sinh"}
                            {r.openedAt && <span className="ml-2 text-xs" style={{ color: "var(--kin-tt-chu-xong)" }}>Đã mở Zalo lúc {vnHm(r.openedAt)}</span>}
                          </span>
                          <KinButton variant={r.openedAt ? "secondary" : "primary"} onClick={() => p.onCompose(s, r)}>
                            {r.openedAt ? "Mở lại Zalo" : "Soạn & mở Zalo"}
                          </KinButton>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
