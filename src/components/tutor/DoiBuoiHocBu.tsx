// LI-09 / LI-10 — một màn cho: dời buổi, huỷ buổi, thêm buổi dạy bù, kèm kiểm xung đột lịch ngay khi chọn giờ (Figma 464:6223).
// Mở bằng /lop-cua-toi/lich/doi-buoi?scheduleId=…&dateKey=… (ngày GỐC của buổi theo lịch tuần).
//
// Dùng lại đúng các đường đã có, không thêm đường mới ghi tiền:
//   dời / huỷ  → POST /api/tutor/session-changes (có kiểm xung đột, chọn "vẫn dời" để bỏ qua)
//   học bù     → POST /api/courses/[id]/sessions  (kind "makeup"; buổi bù được dùng khi điểm danh, ô "Dùng 1 buổi bù")
//   xung đột   → POST /api/courses/[id]/schedule-conflicts (chỉ đọc)
// KHÔNG có ô "Miễn phí / Thu theo chính sách" như Figma: chọn phí buổi gốc và phí buổi bù là quyết định TIỀN, chưa làm ở đây (xem báo cáo).
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KinButton } from "@/components/kin";
import { kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinPage, KinPageHeader, KinTwoCol, KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { KinPanel } from "@/components/kin/Panel";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinStateCard } from "@/components/kin/StateCard";
import { KinStatus } from "@/components/kin/Status";
import { callApi, copyText, useNotify } from "@/components/tutor/shared";
import { addDaysKey, dayOfWeekOfKey, hmOf, isValidDateKey, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";
import { openZalo } from "@/lib/zaloShare";
import type { ScheduleOccurrence } from "@/lib/reminderServer";

const WEEKDAY = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const vnHm = (iso: string) => hmOf(vnMinutesOfDay(new Date(iso)));
type Choice = "move" | "makeup" | "cancel";
interface Conflict { kind: string; text: string }

export default function DoiBuoiHocBu() {
  const sp = useSearchParams();
  const scheduleId = sp.get("scheduleId") ?? "", dateKey = sp.get("dateKey") ?? "";
  const notify = useNotify();
  const [occ, setOcc] = useState<ScheduleOccurrence | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error" | "missing">("loading");
  const [choice, setChoice] = useState<Choice>("move");
  const [date, setDate] = useState(""), [start, setStart] = useState(""), [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [conf, setConf] = useState<{ list: Conflict[]; checked: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ title: string; text: string; groupUrl: string | null } | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    await Promise.resolve();
    if (!scheduleId || !isValidDateKey(dateKey)) { setState("missing"); return; }
    setState("loading");
    const r = await callApi<{ occurrences: ScheduleOccurrence[] }>(`/api/tutor/schedule?from=${addDaysKey(dateKey, -30)}&to=${addDaysKey(dateKey, 30)}`);
    if (!r.ok) { setState("error"); return; }
    const o = r.data.occurrences.find(x => x.scheduleId === scheduleId && x.originalDateKey === dateKey) ?? null;
    if (!o) { setState("missing"); return; }
    setOcc(o); setDate(addDaysKey(o.originalDateKey, o.status === "moved" ? 0 : 1)); setStart(vnHm(o.startAt)); setEnd(vnHm(o.endAt)); setState("ok");
  }, [scheduleId, dateKey]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  // LI-10: kiểm xung đột mỗi khi đổi ngày/giờ (chỉ đọc, bỏ kết quả cũ khi gõ nhanh).
  useEffect(() => {
    if (!occ || choice === "cancel" || !isValidDateKey(date) || !start || !end || end <= start) return;
    const my = ++seq.current;
    const t = setTimeout(async () => {
      const r = await callApi<{ conflicts: Conflict[] }>(`/api/courses/${occ.courseId}/schedule-conflicts`, {
        method: "POST", body: JSON.stringify({ dateKey: date, startTime: start, endTime: end, ignoreKey: choice === "move" ? occ.key : undefined }),
      });
      if (my === seq.current && r.ok) setConf({ list: r.data.conflicts, checked: true });
    }, 350);
    return () => clearTimeout(t);
  }, [occ, choice, date, start, end]);

  if (state === "loading") return <KinPage><div aria-busy="true" aria-label="Đang tải buổi học" className="space-y-3 max-w-3xl">{[0, 1, 2].map(i => <div key={i} className="h-16 rounded kin-skel kin-skel--soft" />)}</div></KinPage>;
  if (state === "error") return <KinPage><KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Không tải được buổi học" actions={<KinButton onClick={() => void load()}>Thử lại</KinButton>}>Kiểm tra mạng rồi thử lại.</KinStateCard></KinPage>;
  if (state === "missing" || !occ) return <KinPage><KinStateCard kicker="Không tìm thấy" title="Không tìm thấy buổi này" actions={<Link href="/lop-cua-toi/lich" className={kinButtonClass("secondary")}>Về Lịch dạy</Link>}>Buổi có thể đã bị xoá khung giờ, hoặc liên kết bị sai.</KinStateCard></KinPage>;

  const o = occ;
  const holding = o.students.filter(s => s.absence && (s.absence.status === "excused_auto" || s.absence.status === "excused_free"));
  const conflicts = conf?.list ?? [];
  const wd = (k: string) => `${WEEKDAY[dayOfWeekOfKey(k)]}, ${ddmm(k)}`;
  const locked = o.started || o.kind !== "regular";

  async function submit(force: boolean) {
    if (busy) return;
    setBusy(true); setError("");
    if (choice === "makeup") {
      const r = await callApi<{ conflicts?: Conflict[]; needsConfirm?: boolean }>(`/api/courses/${o.courseId}/sessions`, {
        method: "POST", body: JSON.stringify({ dateKey: date, startTime: start, endTime: end, kind: "makeup", force }),
      });
      setBusy(false);
      if (!r.ok) { if (r.status === 409 && r.data.needsConfirm) { setConf({ list: r.data.conflicts ?? [], checked: true }); return; } setError(r.data.error ?? "Chưa thêm được buổi bù."); return; }
      notify.ok("Đã thêm buổi dạy bù vào Lịch. Khi điểm danh buổi bù, tick “Dùng 1 buổi bù” cho em được bù.");
      setDone({ title: "Đã thêm buổi dạy bù", text: `KiN báo lịch: lớp ${o.courseName} có buổi dạy bù ${wd(date)} lúc ${start}. Anh/chị và các em lưu ý giúp.`, groupUrl: o.zaloGroupUrl });
      return;
    }
    const r = await callApi<{ message: string; zaloGroupUrl: string | null; conflicts?: Conflict[]; needsConfirm?: boolean }>("/api/tutor/session-changes", {
      method: "POST", body: JSON.stringify({ scheduleId: o.scheduleId, dateKey: o.originalDateKey, kind: choice, reason: reason.trim() || undefined, ...(choice === "move" ? { newDateKey: date, newStartTime: start, newEndTime: end, checkConflicts: true, force } : {}) }),
    });
    setBusy(false);
    if (!r.ok) { if (r.status === 409 && r.data.needsConfirm) { setConf({ list: r.data.conflicts ?? [], checked: true }); return; } setError(r.data.error ?? "Chưa lưu được, thử lại sau."); return; }
    notify.ok(choice === "cancel" ? "Đã huỷ buổi." : "Đã dời buổi.");
    setDone({ title: choice === "cancel" ? "Đã huỷ buổi" : "Đã dời buổi", text: r.data.message, groupUrl: r.data.zaloGroupUrl });
  }
  async function openGroup() {
    if (!done) return;
    const res = await openZalo({ text: done.text, groupUrl: done.groupUrl });
    if (!res.opened) { if (res.reason === "failed") notify.err("Không mở được Zalo. Hãy chép tin và gửi tay."); return; }
    notify.info(res.method === "share" ? "Chọn Zalo trong bảng chia sẻ rồi bấm gửi." : "Đã chép tin và mở Zalo — dán vào cuộc trò chuyện rồi bấm gửi.");
  }

  const choiceBtn = (k: Choice, label: string) => (
    <button key={k} type="button" role="radio" aria-checked={choice === k} onClick={() => { setChoice(k); setConf(null); setError(""); }}
      className="min-h-11 px-4 rounded-[var(--kin-bo-md)] border text-[length:var(--kin-co-goc)] font-medium"
      style={choice === k ? { background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)", borderColor: "transparent" } : { background: "var(--kin-nen-trang)", color: "var(--kin-chu-chinh)", borderColor: "var(--kin-vien-o-nhap)" }}>{label}</button>
  );

  return (
    <KinPage>
      <KinPageHeader title="Dời buổi và học bù" back={{ href: "/lop-cua-toi/lich", label: "‹ Về Lịch dạy" }}
        sub={<>{o.courseName} · {wd(o.originalDateKey)} · {vnHm(o.startAt)}–{vnHm(o.endAt)}</>}
        actions={<Link href={`/lop-cua-toi/buoi/${encodeURIComponent(o.courseId)}/${o.dateKey}`} className={kinButtonClass("secondary")}>Xem buổi gốc</Link>} />

      {done ? (
        <KinPanel className="p-5 space-y-3 max-w-2xl" data-doi-buoi-done>
          <h2 className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">{done.title}</h2>
          <label htmlFor="tin-doi-buoi" className={KIN_LABEL}>Tin báo lớp (sửa được trước khi gửi)</label>
          <textarea id="tin-doi-buoi" rows={4} value={done.text} onChange={e => setDone(d => (d ? { ...d, text: e.target.value } : d))} className={`${KIN_FIELD} py-2`} />
          <p className="text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]">Tin chung cho cả lớp: không tên em, không tiền. KiN không gửi giúp: bạn tự bấm gửi trong Zalo.</p>
          <div className="flex gap-2 flex-wrap">
            <KinButton variant="secondary" onClick={async () => { if (await copyText(done.text)) notify.ok("Đã sao chép tin."); else notify.err("Không sao chép được."); }}>Sao chép</KinButton>
            <KinButton onClick={() => void openGroup()}>Mở Zalo</KinButton>
            <Link href="/lop-cua-toi/lich" className={kinButtonClass("secondary")}>Về Lịch dạy</Link>
          </div>
        </KinPanel>
      ) : locked ? (
        <KinCallout title={o.kind !== "regular" ? "Buổi thêm nhanh không dời bằng màn này" : "Buổi này đã bắt đầu hoặc đã qua"}>
          {o.kind !== "regular" ? "Mở buổi để sửa ghi chép, hoặc thêm một buổi mới ở Lịch." : "Chỉ dời hoặc huỷ được buổi chưa bắt đầu. Bạn vẫn thêm được buổi dạy bù ở Lịch bằng nút Thêm buổi."}
        </KinCallout>
      ) : (
        <KinTwoCol>
          <div className="min-w-0 space-y-8">
            <section aria-labelledby="db-chon">
              <KinSectionHead id="db-chon" title="Bạn muốn làm gì với buổi này?" />
              <div role="radiogroup" aria-label="Cách xử lý" className="pt-4 flex gap-2 flex-wrap">{choiceBtn("move", "Dời sang lúc khác")}{choiceBtn("makeup", "Thêm buổi dạy bù")}{choiceBtn("cancel", "Huỷ buổi")}</div>
              {choice === "makeup" && <p className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Thêm một buổi dạy bù vào Lịch. Buổi gốc giữ nguyên. Khi điểm danh buổi bù, tick “Dùng 1 buổi bù” cho em được bù.</p>}
              {choice === "cancel" && <p className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Báo nghỉ sát giờ đang chờ của buổi này sẽ tự đóng (không tính phí, không buổi bù). Báo nghỉ đã xử lý giữ nguyên.</p>}
            </section>

            {choice !== "cancel" && (
              <section aria-labelledby="db-gio">
                <KinSectionHead id="db-gio" title={choice === "move" ? "Chọn ngày giờ mới" : "Chọn ngày giờ dạy bù"} />
                <div className="pt-4 grid sm:grid-cols-3 gap-4">
                  <div><label htmlFor="db-ngay" className={KIN_LABEL}>Ngày</label><input id="db-ngay" type="date" min={vnDateKeyOf(new Date())} value={date} onChange={e => { setDate(e.target.value); setConf(null); }} className={`${KIN_FIELD} mt-2`} /></div>
                  <div><label htmlFor="db-bd" className={KIN_LABEL}>Bắt đầu</label><input id="db-bd" type="time" value={start} onChange={e => { setStart(e.target.value); setConf(null); }} className={`${KIN_FIELD} mt-2`} /></div>
                  <div><label htmlFor="db-kt" className={KIN_LABEL}>Kết thúc</label><input id="db-kt" type="time" value={end} onChange={e => { setEnd(e.target.value); setConf(null); }} className={`${KIN_FIELD} mt-2`} /></div>
                </div>
                <div className="mt-4" aria-live="polite" data-conflict-status>
                  {conf === null ? <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đang kiểm tra xung đột lịch…</p>
                    : conflicts.length === 0 ? <KinStatus tone="xong">Giờ này còn trống, không trùng lịch nào</KinStatus>
                    : (
                      <div role="alert" data-conflicts className="border-l-2 border-[var(--kin-tt-chu-loi)] bg-[var(--kin-nen-bang)] px-4 py-3 space-y-1">
                        <p className="font-medium text-[var(--kin-tt-chu-loi)]">Xung đột lịch</p>
                        <ul className="list-disc pl-5 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">{conflicts.map((c, i) => <li key={i}>{c.text}</li>)}</ul>
                        <p className="text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]">Đổi giờ cho khỏi trùng, hoặc vẫn tiếp tục nếu bạn chắc chắn.</p>
                      </div>
                    )}
                </div>
              </section>
            )}

            {choice !== "makeup" && (
              <div><label htmlFor="db-lydo" className={KIN_LABEL}>Lý do (không bắt buộc, sẽ có trong tin báo lớp)</label>
                <textarea id="db-lydo" rows={2} maxLength={300} value={reason} onChange={e => setReason(e.target.value)} className={`${KIN_FIELD} mt-2 py-2`} /></div>
            )}

            <section aria-labelledby="db-lienket" data-db-lienket>
              <KinSectionHead id="db-lienket" title="Liên kết và người bị ảnh hưởng" />
              <p className="pt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
                {choice === "makeup" ? `Buổi bù → ${o.courseName} / buổi gốc ${wd(o.originalDateKey)}.` : choice === "move" ? `Buổi dời → ${o.courseName} / buổi gốc ${wd(o.originalDateKey)}.` : `Huỷ → ${o.courseName} / buổi gốc ${wd(o.originalDateKey)}.`}
              </p>
              <p className="pt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
                {o.students.length} học sinh của lớp thuộc buổi này. Chưa bấm nút xác nhận thì lịch hiện có và số buổi của lớp chưa đổi.
              </p>
            </section>

            {error && <p role="alert" className="text-sm font-medium" style={{ color: "var(--kin-tt-chu-loi)" }}>{error}</p>}
            <div className="flex gap-2 flex-wrap">
              <Link href="/lop-cua-toi/lich" className={kinButtonClass("secondary")}>Không đổi nữa</Link>
              <KinButton variant={choice !== "cancel" && conflicts.length ? "danger" : "primary"} loading={busy} loadingLabel="Đang lưu..." onClick={() => void submit(choice !== "cancel" && conflicts.length > 0)}>
                {choice === "cancel" ? "Huỷ buổi này" : choice === "move" ? (conflicts.length ? "Vẫn dời buổi" : "Dời buổi") : (conflicts.length ? "Vẫn thêm buổi bù" : "Thêm buổi bù")}
              </KinButton>
            </div>
          </div>

          <aside aria-label="Người bị ảnh hưởng" className="min-w-0 space-y-4">
            <KinPanel className="p-5 space-y-3">
              <h2 className="text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)]">Rà soát thay đổi</h2>
              <dl className="text-[length:var(--kin-co-goc)] space-y-2">
                <div><dt className="text-[var(--kin-chu-mo)]">Buổi gốc</dt><dd className="text-[var(--kin-chu-chinh)]">{wd(o.originalDateKey)} · {vnHm(o.startAt)}–{vnHm(o.endAt)}</dd></div>
                <div><dt className="text-[var(--kin-chu-mo)]">Sau khi xác nhận</dt><dd className="text-[var(--kin-chu-chinh)]">{choice === "cancel" ? "Buổi bị huỷ, không ai phải đến lớp" : choice === "move" ? `Dời tới ${isValidDateKey(date) ? wd(date) : "…"} · ${start}–${end}` : `Giữ buổi gốc, thêm buổi bù ${isValidDateKey(date) ? wd(date) : "…"} · ${start}–${end}`}</dd></div>
                <div><dt className="text-[var(--kin-chu-mo)]">Lớp</dt><dd className="text-[var(--kin-chu-chinh)]">{choice === "makeup" ? `${o.students.length} học sinh của lớp; bạn tự báo qua Zalo` : `${o.students.length} học sinh sẽ được báo trong ứng dụng`}</dd></div>
                <div><dt className="text-[var(--kin-chu-mo)]">Đang giữ buổi bù</dt><dd className="text-[var(--kin-chu-chinh)]">{holding.length === 0 ? "Chưa em nào" : `${holding.length} em: ${holding.map(s => s.name).join(", ")}`}</dd></div>
              </dl>
              <KinCallout title="Không đổi tiền ở màn này">Dời, huỷ hay thêm buổi bù chỉ đổi lịch. Học phí vẫn theo cách tính của lớp và điểm danh từng em; muốn chỉnh phiếu, bạn sửa ở trang Học phí.</KinCallout>
            </KinPanel>
          </aside>
        </KinTwoCol>
      )}
    </KinPage>
  );
}
