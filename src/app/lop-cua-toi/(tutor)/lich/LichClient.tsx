// Lịch tuần của gia sư — danh sách theo ngày; mở một buổi để:
//  • xử lý "Báo nghỉ sát giờ" bằng MỘT nút (TT-202);
//  • mở Zalo với tin nhắc lịch soạn sẵn, sửa được trước khi gửi (TT-201/TT-199 giai đoạn 1);
//  • DỜI hoặc HUỶ một buổi chưa bắt đầu (hoàn thiện NV-189): học viên được báo trong ứng dụng, gia sư tự mở Zalo báo lớp.
// Khi Hộp việc đang tắt, việc cần xử lý hiện thành chấm kèm chữ ngay trên đúng buổi (TT-203).
"use client";
import { Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KinButton } from "@/components/kin";
import { kinButtonClass } from "@/components/kin/Button";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinPage, KinPageHeader, KIN_TWO_COL } from "@/components/kin/PageLayout";
import { KinStatus } from "@/components/kin/Status";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import LichGrid from "./LichGrid";
import { Badge, CARD_STYLE, FIELD_STYLE, Modal, callApi, copyText, useNotify } from "@/components/tutor/shared";
import { addDaysKey, buildGroupReminderMessage, dayOfWeekOfKey, describeLead, hmOf, vnDateKeyOf, vnMinutesOfDay, weekRangeOf } from "@/lib/classSessions";
import { openZalo } from "@/lib/zaloShare";
import { classAccentFor } from "@/lib/classColor";
import DiemDanhPanel from "@/components/tutor/DiemDanh";
import ThemBuoiNhanh, { type QuickAddCourse, type QuickAddDefaults } from "@/components/tutor/ThemBuoiNhanh";
import { KIND_LABEL, MODE_LABEL, JOIN_SOURCE_LABEL } from "@/lib/sessionBook";
import { buildWeeklyScheduleMessage, coursesInWeek, occurrencesOfCourse } from "@/lib/weeklyScheduleMessage";
import { sessionChangeMessage, CHANGE_REASON_MAX } from "@/lib/sessionChange";
import type { ReminderItem, ScheduleOccurrence, ScheduleStudent } from "@/lib/reminderServer";

interface Payload {
  from: string; to: string; now: string;
  occurrences: ScheduleOccurrence[];
  counters: { pendingAbsences: number; remindersDue: number; makeupExpiring: number };
}
interface Resolved { status: string; message: string; phone: string | null }

const WEEKDAY = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const vnHm = (iso: string) => hmOf(vnMinutesOfDay(new Date(iso)));
const vnDayHm = (iso: string) => `${vnHm(iso)} ngày ${ddmm(vnDateKeyOf(new Date(iso)))}`;

const ABSENCE_LABEL: Record<string, { tone: "ok" | "wait" | "neutral"; text: string }> = {
  pending:      { tone: "wait",    text: "Báo nghỉ sát giờ — chờ bạn xử lý" },
  excused_auto: { tone: "ok",      text: "Nghỉ có báo — đã giữ 1 buổi bù" },
  excused_free: { tone: "ok",      text: "Không tính phí — đã giữ 1 buổi bù" },
  charged:      { tone: "neutral", text: "Tính phí buổi này" },
  voided:       { tone: "neutral", text: "Buổi đã huỷ — không tính phí, không buổi bù" },
};

interface ChangeDraft { occ: ScheduleOccurrence; kind: "cancel" | "move"; newDate: string; start: string; end: string; reason: string; error: string; busy: boolean; conflicts: string[] | null }
interface ChangeNotice { title: string; changeId: string | null; text: string; groupUrl: string | null; lines: string[] }

// Màn rộng (≥ 1024px) dùng lưới tuần + cột chi tiết; hẹp hơn dùng danh sách theo ngày. Chỉ dựng MỘT trong hai (tránh nút/chữ trùng).
const WIDE_QUERY = "(min-width: 1024px)";
function useWide() {
  return useSyncExternalStore(
    cb => { const m = window.matchMedia(WIDE_QUERY); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

export default function LichClient() {
  const wide = useWide();
  const [cls, setCls] = useState("");   // lọc theo lớp ("" = tất cả lớp)
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
  const [changing, setChanging] = useState<ChangeDraft | null>(null); // hộp thoại Dời / Huỷ
  const [notice, setNotice] = useState<ChangeNotice | null>(null);    // hộp "Báo lớp qua Zalo" sau khi đổi lịch
  const [weekPick, setWeekPick] = useState("");                     // NC2-024: lớp được chọn để gửi lịch tuần
  const [weekCompose, setWeekCompose] = useState<{ courseId: string; courseName: string; from: string; text: string; groupUrl: string | null } | null>(null);
  const [weekOpened, setWeekOpened] = useState<Record<string, string>>({}); // "lớp|đầu tuần" → "HH:mm" đã mở Zalo (chỉ trong phiên)
  const seq = useRef(0);
  const [hideCancelled, setHideCancelled] = useState(false);          // LI-03: lưu ở tài khoản
  const [quickAdd, setQuickAdd] = useState<{ courses: QuickAddCourse[]; defaults?: QuickAddDefaults } | null>(null); // LI-11: ngăn kéo thêm buổi nhanh
  const [attend, setAttend] = useState<ScheduleOccurrence | null>(null); // LI-05: điểm danh ngay từ Lịch
  const [refreshing, setRefreshing] = useState(false);

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

  // LI-03: đọc bộ lọc đã lưu (ẩn buổi huỷ, lớp đang lọc). Lỗi mạng thì dùng mặc định, không chặn lịch.
  useEffect(() => {
    let alive = true;
    void callApi<{ preferences: { calendar?: { hideCancelled?: boolean; courseId?: string | null } } }>("/api/users/me/preferences").then(r => {
      if (!alive || !r.ok) return;
      const c = r.data.preferences?.calendar;
      if (c?.hideCancelled) setHideCancelled(true);
      if (c?.courseId) setCls(c.courseId);
    });
    return () => { alive = false; };
  }, []);
  function savePrefs(patch: { hideCancelled?: boolean; courseId?: string | null }) {
    void callApi("/api/users/me/preferences", { method: "PUT", body: JSON.stringify({ calendar: patch }) }).then(r => { if (!r.ok) notify.err("Chưa lưu được cách hiển thị lịch."); });
  }
  async function refresh() { setRefreshing(true); await load(from, true); setRefreshing(false); }

  // LI-11: mở ngăn kéo thêm buổi; lấy danh sách lớp của gia sư lần đầu cần dùng.
  async function openQuickAdd(defaults?: QuickAddDefaults) {
    const r = await callApi<{ rows: { id: string; name: string }[] }>("/api/tutor/lop");
    if (!r.ok) { notify.err("Chưa tải được danh sách lớp."); return; }
    setQuickAdd({ courses: r.data.rows.map(x => ({ id: x.id, name: x.name })), defaults });
  }
  // LI-06: nhân bản = mở ngăn kéo với cùng lớp, cùng giờ, ngày +7 (gia sư đổi được).
  function duplicate(o: ScheduleOccurrence) {
    void openQuickAdd({ courseId: o.courseId, dateKey: addDaysKey(o.dateKey, 7), startTime: vnHm(o.startAt), endTime: vnHm(o.endAt), kind: "extra" });
  }

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
      body: JSON.stringify({ scheduleId: occ.scheduleId, dateKey: occ.originalDateKey, studentId: student.id, recipient: item.recipient, kind: item.kind }),
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

  const weekCourses = coursesInWeek(data?.occurrences ?? []);
  const weekCourseId = weekCourses.some(c => c.id === weekPick) ? weekPick : (weekCourses[0]?.id ?? "");

  function startWeekCompose() {
    const c = weekCourses.find(x => x.id === weekCourseId);
    if (!c || !data) return;
    const occs = occurrencesOfCourse(data.occurrences, c.id);
    setWeekCompose({
      courseId: c.id, courseName: c.name, from,
      text: buildWeeklyScheduleMessage({ subject: c.name, from, occurrences: occs }),
      groupUrl: occs.find(o => o.zaloGroupUrl)?.zaloGroupUrl ?? null,
    });
  }

  async function openWeekZalo() {
    if (!weekCompose) return;
    const res = await openZalo({ text: weekCompose.text, groupUrl: weekCompose.groupUrl });
    if (!res.opened) { if (res.reason === "failed") notify.err("Không mở được Zalo. Hãy chép tin và gửi tay."); return; }
    // KiN chỉ ghi "đã mở Zalo" trong phiên này (chưa có chỗ lưu riêng cho lịch tuần), không biết tin có đi thật hay không.
    const t = new Date();
    setWeekOpened(m => ({ ...m, [`${weekCompose.courseId}|${weekCompose.from}`]: hmOf(vnMinutesOfDay(t)) }));
    notify.info(res.method === "share" ? "Chọn nhóm Zalo trong bảng chia sẻ rồi bấm gửi." : "Đã chép tin và mở Zalo — dán vào nhóm rồi bấm gửi.");
    setWeekCompose(null);
  }

  function startChange(occ: ScheduleOccurrence, kind: "cancel" | "move") {
    setChanging({
      occ, kind, newDate: occ.dateKey, start: vnHm(occ.startAt), end: vnHm(occ.endAt),
      reason: occ.change?.reason ?? "", error: "", busy: false, conflicts: null,
    });
  }

  async function submitChange() {
    if (!changing || changing.busy) return;
    const c = changing;
    setChanging({ ...c, busy: true, error: "" });
    const r = await callApi<{
      change: { id: string; kind: "cancel" | "move" }; message: string; zaloGroupUrl: string | null;
      absencesVoided: number; absencesKept: number; notified: number;
    }>("/api/tutor/session-changes", {
      method: "POST",
      body: JSON.stringify({
        scheduleId: c.occ.scheduleId, dateKey: c.occ.originalDateKey, kind: c.kind, reason: c.reason.trim() || undefined,
        ...(c.kind === "move" ? { newDateKey: c.newDate, newStartTime: c.start, newEndTime: c.end || undefined, checkConflicts: true, force: c.conflicts !== null } : {}),
      }),
    });
    if (!r.ok) {
      // LI-10: giờ mới trùng lịch → hiện danh sách, nút đổi thành "Vẫn dời buổi" (gửi lại với force).
      const cf = (r.data as { conflicts?: { text: string }[] }).conflicts;
      if (r.status === 409 && (r.data as { needsConfirm?: boolean }).needsConfirm && cf) { setChanging({ ...c, busy: false, error: "", conflicts: cf.map(x => x.text) }); return; }
      setChanging({ ...c, busy: false, error: r.data.error ?? "Không lưu được, thử lại sau" }); return;
    }
    setChanging(null);
    const d = r.data;
    const lines = [
      d.notified > 0 ? `Đã báo ${d.notified} học viên trong ứng dụng.` : "Lớp chưa có học viên nào đang học để báo trong ứng dụng.",
      ...(d.absencesVoided > 0 ? [`${d.absencesVoided} báo nghỉ sát giờ đang chờ đã tự đóng vì buổi huỷ (không tính phí, không buổi bù).`] : []),
      ...(d.absencesKept > 0 ? [`${d.absencesKept} em đã báo nghỉ buổi này trước đó${c.kind === "cancel" ? " và đã được xử lý (giữ buổi bù hoặc tính phí) — KiN không tự thu hồi, bạn xem lại nếu cần" : " — báo nghỉ giữ nguyên"}.`] : []),
      "KiN không gửi giúp: bạn tự mở Zalo và bấm gửi để báo phụ huynh.",
    ];
    setNotice({ title: c.kind === "cancel" ? "Đã huỷ buổi" : "Đã dời buổi", changeId: d.change.id, text: d.message, groupUrl: d.zaloGroupUrl, lines });
    void load(from, true);
  }

  async function restore(occ: ScheduleOccurrence) {
    if (busy) return;
    setBusy(occ.key);
    const r = await callApi<{ message: string; zaloGroupUrl: string | null; reopened: number; notified: number }>(
      `/api/tutor/session-changes?scheduleId=${encodeURIComponent(occ.scheduleId)}&dateKey=${occ.originalDateKey}`, { method: "DELETE" });
    setBusy(null);
    if (!r.ok) { notify.err(r.data.error ?? "Không khôi phục được"); void load(from, true); return; }
    setNotice({
      title: "Đã khôi phục buổi về lịch tuần", changeId: null, text: r.data.message, groupUrl: r.data.zaloGroupUrl,
      lines: [
        r.data.notified > 0 ? `Đã báo ${r.data.notified} học viên trong ứng dụng.` : "Lớp chưa có học viên nào đang học để báo trong ứng dụng.",
        ...(r.data.reopened > 0 ? [`${r.data.reopened} báo nghỉ sát giờ đã mở lại để bạn xử lý.`] : []),
        "Nếu bạn đã báo lớp là buổi này đổi lịch, hãy báo lại bằng tin bên dưới.",
      ],
    });
    void load(from, true);
  }

  // Mở lại hộp báo lớp cho một buổi ĐÃ đổi (sau khi tải lại trang). Tin dựng lại ở máy (không có chữ ký gia sư).
  function reopenNotice(occ: ScheduleOccurrence) {
    if (!occ.change) return;
    const original = new Date(occ.movedFrom ? occ.movedFrom.startAt : occ.startAt);
    const text = sessionChangeMessage({
      kind: occ.change.kind, subject: occ.courseName, originalStartAt: original,
      newStartAt: occ.status === "moved" ? new Date(occ.startAt) : null, reason: occ.change.reason,
    });
    setNotice({ title: occ.status === "cancelled" ? "Báo lớp: buổi đã huỷ" : "Báo lớp: buổi đã dời", changeId: occ.change.id, text, groupUrl: occ.zaloGroupUrl, lines: ["KiN không gửi giúp: bạn tự mở Zalo và bấm gửi để báo phụ huynh."] });
  }

  async function openChangeZalo() {
    if (!notice) return;
    const res = await openZalo({ text: notice.text, groupUrl: notice.groupUrl });
    if (!res.opened) { if (res.reason === "failed") notify.err("Không mở được Zalo. Hãy chép tin và gửi tay."); return; }
    if (notice.changeId) {
      const log = await callApi(`/api/tutor/session-changes/${notice.changeId}/zalo`, { method: "POST" });
      if (!log.ok) notify.err(log.data.error ?? "Đã mở Zalo nhưng chưa ghi lại được.");
    }
    notify.info(res.method === "share" ? "Chọn Zalo trong bảng chia sẻ rồi bấm gửi." : "Đã chép tin và mở Zalo — dán vào cuộc trò chuyện rồi bấm gửi.");
    setNotice(null);
    void load(from, true);
  }

  const allOccs = data?.occurrences ?? [];
  const occs = allOccs.filter(o => (!cls || o.courseId === cls) && !(hideCancelled && o.status === "cancelled"));
  const occByDay = (k: string) => occs.filter(o => o.dateKey === k);
  const openOcc = occs.find(o => o.key === open) ?? null;
  const weekMsg = data && weekCourseId ? buildWeeklyScheduleMessage({ subject: weekCourses.find(c => c.id === weekCourseId)?.name ?? "", from, occurrences: occurrencesOfCourse(data.occurrences, weekCourseId) }) : "";
  const nowMs = Date.parse(data?.now ?? "") || 0;
  // Chỉ GÁN hàm xử lý (chạy khi bấm), không đọc ref lúc dựng — cảnh báo react-hooks/refs ở hai dòng dưới là dương tính giả.
  /* eslint-disable react-hooks/refs */
  const cardProps = (o: ScheduleOccurrence) => ({
    occ: o, nowMs, busy, resolved, onResolve: resolve, onSendResolved: sendResolved,
    onCompose: (student: ScheduleStudent, item: ReminderItem) => setCompose({ occ: o, student, item, text: item.message }),
    onChange: (kind: "cancel" | "move") => startChange(o, kind), onRestore: () => void restore(o), onNotice: () => reopenNotice(o),
    onAttend: () => setAttend(o), onDuplicate: () => duplicate(o),
    onGroup: () => setGroupCompose({ occ: o, text: buildGroupReminderMessage({ subject: o.courseName, startAt: new Date(o.startAt), joinUrl: o.joinUrl, now: new Date(data?.now ?? Date.now()) }) }),
  });
  /* eslint-enable react-hooks/refs */

  const zaloSection = !failed && (data || !loading) && (
    <section aria-labelledby="lich-zalo" className="mt-8">
      <KinSectionHead id="lich-zalo" title="Gửi lịch tuần qua Zalo" />
      <div role="group" aria-label="Gửi lịch tuần qua Zalo" className="pt-5">
        {weekCourses.length > 1 && (
          <label className="mb-4 flex items-center gap-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Lớp
            <select value={weekCourseId} onChange={e => setWeekPick(e.target.value)} className="px-3 py-2 rounded-lg text-sm min-h-[44px] min-w-0 max-w-full" style={FIELD_STYLE}>
              {weekCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        )}
        {weekCourseId && weekMsg && <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)] whitespace-pre-line break-words">{weekMsg}</p>}
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <KinButton variant="secondary" disabled={!weekCourseId || loading} onClick={startWeekCompose}>Mở Zalo</KinButton>
          <KinButton variant="ghost" disabled={!weekCourseId || !weekMsg} onClick={async () => { if (await copyText(weekMsg)) notify.ok("Đã sao chép tin."); else notify.err("Không sao chép được."); }}>Sao chép lịch</KinButton>
        </div>
        <p className="mt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]" aria-live="polite">
          {!weekCourseId
            ? "Tuần này chưa có buổi nào để gửi lịch. Chuyển sang tuần có buổi học để gửi."
            : weekOpened[`${weekCourseId}|${from}`]
              ? `Đã mở Zalo lúc ${weekOpened[`${weekCourseId}|${from}`]}`
              : "Tin lịch tuần của một lớp, không tên em. Chỉ ghi nhận thời điểm mở Zalo, KiN không gửi giúp."}
        </p>
      </div>
    </section>
  );

  return (
    <KinPage>
      <KinPageHeader title="Lịch dạy" live
        sub={<>Tuần {ddmm(from)} – {ddmm(addDaysKey(from, 6))}/{addDaysKey(from, 6).slice(0, 4)} · Giờ Việt Nam (GMT+7)</>}
        actions={<>
          <KinButton variant="secondary" onClick={() => setFrom(thisWeek)}>Hôm nay</KinButton>
          <KinButton onClick={() => void openQuickAdd({ dateKey: todayKey })}>+ Thêm buổi</KinButton>
        </>} />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 sm:gap-2" role="group" aria-label="Chuyển tuần">
          <KinButton variant="ghost" className="px-2 sm:px-4" onClick={() => setFrom(addDaysKey(from, -7))}>‹ Tuần trước</KinButton>
          <span className="inline-flex items-center justify-center min-h-[44px] px-3 sm:px-5 whitespace-nowrap rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] text-[length:var(--kin-co-goc)] font-medium tabular-nums text-[var(--kin-chu-chinh)]">
            {Number(from.slice(8, 10))} – {Number(addDaysKey(from, 6).slice(8, 10))} tháng {Number(addDaysKey(from, 6).slice(5, 7))}
          </span>
          <KinButton variant="ghost" className="px-2 sm:px-4" onClick={() => setFrom(addDaysKey(from, 7))}>Tuần sau ›</KinButton>
        </div>
        <div className="flex items-center gap-3 flex-wrap" role="group" aria-label="Bộ lọc lịch">
          {weekCourses.length > 1 && (
            <label className="flex items-center gap-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
              <span className="sr-only">Lọc theo lớp</span>
              <select value={cls} onChange={e => { setCls(e.target.value); setOpen(null); savePrefs({ courseId: e.target.value || null }); }} aria-label="Lọc theo lớp" className="w-auto max-w-[240px] px-3 py-2 rounded-lg text-sm min-h-[44px] min-w-0 max-w-full" style={FIELD_STYLE}>
                <option value="">Tất cả lớp</option>
                {weekCourses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 min-h-[44px] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
            <input type="checkbox" checked={hideCancelled} onChange={e => { setHideCancelled(e.target.checked); setOpen(null); savePrefs({ hideCancelled: e.target.checked }); }} />
            Ẩn buổi đã huỷ
          </label>
          <KinButton variant="ghost" onClick={() => void refresh()} loading={refreshing} loadingLabel="Đang làm mới...">Làm mới</KinButton>
        </div>
      </div>

      {/* Điện thoại: dải 7 ngày, bấm để nhảy tới ngày đó (lưới 7 cột không đọc được ở 390px) */}
      {!wide && (
      <nav aria-label="Các ngày trong tuần" className="grid grid-cols-7 gap-1 mt-5">
        {days.map(k => {
          const n = occByDay(k).filter(o => o.status !== "cancelled").length;
          const isToday = k === todayKey;
          const style = isToday
            ? { background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)", border: "1px solid var(--kin-nhan-nen)" }
            : { background: "var(--kin-nen-bang)", color: "var(--kin-chu-chinh)", border: "1px solid var(--kin-vien-thuong)" };
          const inner = (<>
            <span className="text-[length:var(--kin-co-goc)]">{WEEKDAY_SHORT[dayOfWeekOfKey(k)]}</span>
            <span className="text-sm font-medium tabular-nums">{k.slice(8, 10)}</span>
            <span aria-hidden className="w-1.5 h-1.5 rounded-full" style={{ background: n > 0 ? (isToday ? "var(--kin-nhan-chu-tren-nen)" : "var(--kin-tt-cham-xong)") : "transparent" }} />
          </>);
          const c = "rounded-lg py-1 flex flex-col items-center min-h-[48px]";
          return n > 0
            ? <a key={k} href={`#d-${k}`} className={c} style={style} aria-label={`${WEEKDAY[dayOfWeekOfKey(k)]} ${ddmm(k)}, ${n} buổi${isToday ? ", hôm nay" : ""}`}>{inner}</a>
            : <span key={k} className={c} style={{ ...style, opacity: isToday ? 1 : 0.55 }} aria-label={`${WEEKDAY[dayOfWeekOfKey(k)]} ${ddmm(k)}, không có buổi${isToday ? ", hôm nay" : ""}`}>{inner}</span>;
        })}
      </nav>
      )}

      {failed && (
        <div className="mt-5"><ErrorStrip message="Không tải được lịch. Kiểm tra mạng rồi thử lại." onRetry={() => void load(from)} /></div>
      )}

      <div className="mt-6">
      {loading && !data ? (
        <div aria-busy="true" aria-label="Đang tải lịch" className="space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="rounded h-[68px] kin-skel kin-skel--soft" />)}
        </div>
      ) : data && allOccs.length === 0 ? (
        <KinEmptyState title="Tuần này chưa có buổi học nào" action={<Link href="/lop-cua-toi/lop" className={kinButtonClass("secondary")}>Xem các lớp của tôi</Link>}>
          Buổi học lấy từ khung giờ hằng tuần của lớp. Thêm giờ học ở tab <b>Lịch học</b> của trang quản khoá (mở lớp → Quản khoá).
        </KinEmptyState>
      ) : wide ? (
        <div className={KIN_TWO_COL}>
          <div className="min-w-0">
            <LichGrid days={days} occurrences={occs} todayKey={todayKey} openKey={open} onPick={k => setOpen(open === k ? null : k)} dimmed={loading} />
            <p className="mt-4 flex items-center gap-8 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
              <span className="pl-4">Buổi đã lên lịch</span>
              {days.includes(todayKey) && <span>{todayKey.slice(8, 10)} · Hôm nay</span>}
            </p>
          </div>
          <aside aria-label="Chi tiết buổi" className="bg-[var(--kin-nen-bang)] p-5 min-w-0">
            {openOcc ? <OccurrenceDetail {...cardProps(openOcc)} panel /> : (
              <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Bấm vào một buổi trong lịch để xem chi tiết, xử lý báo nghỉ, dời hoặc huỷ buổi và soạn tin nhắc.</p>
            )}
          </aside>
        </div>
      ) : (
        <div className={loading ? "opacity-70" : ""}>
          {days.map(k => {
            const dayOccs = occByDay(k);
            if (dayOccs.length === 0) return null;
            return (
              <section key={k} aria-labelledby={`d-${k}`} className="mb-5">
                <h2 id={`d-${k}`} className="text-[length:var(--kin-co-goc)] font-medium mb-2 flex items-center gap-2" style={{ color: "var(--kin-chu-chinh)" }}>
                  {WEEKDAY[dayOfWeekOfKey(k)]} {ddmm(k)}
                  {k === todayKey && <span className="text-[length:var(--kin-co-goc)] font-medium px-2 py-0.5 rounded-full" style={{ background: "var(--kin-nen-nhan)", color: "var(--kin-nhan-chu-tren-nhat)" }}>Hôm nay</span>}
                </h2>
                <ul className="space-y-2">
                  {dayOccs.map(o => (
                    <li key={o.key}>
                      <OccurrenceCard {...cardProps(o)} expanded={open === o.key} onToggle={() => setOpen(open === o.key ? null : o.key)} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
      </div>

      {zaloSection}

      {weekCompose && (
        <Modal title={`Lịch tuần ${ddmm(weekCompose.from)} – ${ddmm(addDaysKey(weekCompose.from, 6))} — ${weekCompose.courseName}`} onClose={() => setWeekCompose(null)}>
          <label className="block text-sm" htmlFor="tin-lich-tuan">Tin lịch tuần (sửa được trước khi gửi)</label>
          <textarea id="tin-lich-tuan" rows={8} value={weekCompose.text} onChange={e => setWeekCompose(c => (c ? { ...c, text: e.target.value } : c))}
            className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={FIELD_STYLE} />
          <p className="text-xs mt-2" style={{ color: "var(--kin-chu-phu)" }}>
            Tin chung cho cả lớp: không tên em, không tiền, không link phiếu. {weekCompose.groupUrl ? "Sẽ mở nhóm Zalo của lớp." : <>Chưa gắn nhóm Zalo — KiN sẽ chép tin và mở Zalo, bạn chọn đúng nhóm. Gắn nhóm ở <Link href="/lop-cua-toi/cai-dat#ket-noi" className="underline" style={{ color: "var(--kin-nhan-link)" }}>Cài đặt → Kết nối</Link>.</>} KiN không gửi giúp: bạn tự bấm gửi trong Zalo.
          </p>
          <div className="flex gap-2 flex-wrap mt-4 justify-end">
            <KinButton variant="secondary" onClick={async () => { if (await copyText(weekCompose.text)) notify.ok("Đã sao chép tin."); else notify.err("Không sao chép được."); }}>Chép tin</KinButton>
            <KinButton onClick={() => void openWeekZalo()} disabled={!weekCompose.text.trim()}>{weekCompose.groupUrl ? "Mở nhóm Zalo lớp" : "Mở Zalo"}</KinButton>
          </div>
        </Modal>
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

      {changing && (
        <Modal title={`${changing.kind === "cancel" ? "Huỷ buổi" : "Dời buổi"} — ${changing.occ.courseName}`} onClose={() => { if (!changing.busy) setChanging(null); }}>
          <p className="text-sm mb-3" style={{ color: "var(--kin-chu-phu)" }}>
            Buổi gốc: {WEEKDAY[dayOfWeekOfKey(changing.occ.originalDateKey)]} {ddmm(changing.occ.originalDateKey)}
            {changing.occ.movedFrom ? ` lúc ${vnHm(changing.occ.movedFrom.startAt)}` : ` lúc ${vnHm(changing.occ.startAt)}`}.
          </p>
          <div role="radiogroup" aria-label="Cách đổi lịch" className="flex gap-2 mb-3">
            {(["move", "cancel"] as const).map(k => (
              <button key={k} type="button" role="radio" aria-checked={changing.kind === k} onClick={() => setChanging(c => (c ? { ...c, kind: k, error: "" } : c))}
                className="px-4 py-2 rounded-lg text-sm font-medium min-h-[44px]"
                style={changing.kind === k
                  ? { background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" }
                  : { background: "var(--kin-nen-trang)", color: "var(--kin-chu-chinh)", border: "1px solid var(--kin-vien-thuong)" }}>
                {k === "move" ? "Dời sang lúc khác" : "Huỷ buổi"}
              </button>
            ))}
          </div>
          {changing.kind === "move" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Ngày mới
                <input type="date" value={changing.newDate} min={todayKey} onChange={e => setChanging(c => (c ? { ...c, newDate: e.target.value, conflicts: null } : c))}
                  className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} />
              </label>
              <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Giờ bắt đầu mới
                <input type="time" value={changing.start} onChange={e => setChanging(c => (c ? { ...c, start: e.target.value, conflicts: null } : c))}
                  className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} />
              </label>
              <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Giờ kết thúc mới
                <input type="time" value={changing.end} onChange={e => setChanging(c => (c ? { ...c, end: e.target.value, conflicts: null } : c))}
                  className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} />
              </label>
            </div>
          )}
          <label className="block text-xs" htmlFor="ly-do-doi-lich" style={{ color: "var(--kin-chu-phu)" }}>Lý do (không bắt buộc, sẽ có trong tin báo lớp)</label>
          <textarea id="ly-do-doi-lich" rows={2} maxLength={CHANGE_REASON_MAX} value={changing.reason} onChange={e => setChanging(c => (c ? { ...c, reason: e.target.value } : c))}
            className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={FIELD_STYLE} />
          {changing.kind === "cancel" && (
            <p className="text-xs mt-2" style={{ color: "var(--kin-chu-phu)" }}>
              Báo nghỉ sát giờ đang chờ của buổi này sẽ tự đóng (không tính phí, không buổi bù). Báo nghỉ đã xử lý giữ nguyên.
            </p>
          )}
          {changing.conflicts && changing.conflicts.length > 0 && changing.kind === "move" && (
            <div role="alert" data-conflicts className="mt-3 border-l-2 border-[var(--kin-tt-chu-loi)] bg-[var(--kin-nen-bang)] px-4 py-3 space-y-1">
              <p className="font-medium text-[var(--kin-tt-chu-loi)]">Giờ mới trùng lịch</p>
              <ul className="list-disc pl-5 text-sm" style={{ color: "var(--kin-chu-chinh)" }}>{changing.conflicts.map((t, i) => <li key={i}>{t}</li>)}</ul>
              <p className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>Đổi ngày/giờ khác cho khỏi trùng, hoặc vẫn dời nếu bạn chắc chắn.</p>
            </div>
          )}
          {changing.error && <p role="alert" className="text-sm font-medium mt-3" style={{ color: "var(--kin-tt-chu-loi)" }}>{changing.error}</p>}
          <div className="flex gap-2 flex-wrap mt-4 justify-end">
            <KinButton variant="secondary" disabled={changing.busy} onClick={() => setChanging(null)}>Không đổi nữa</KinButton>
            <KinButton variant={changing.conflicts && changing.kind === "move" ? "danger" : "primary"} loading={changing.busy} onClick={() => void submitChange()}>{changing.kind === "cancel" ? "Huỷ buổi này" : changing.conflicts ? "Vẫn dời buổi" : "Dời buổi"}</KinButton>
          </div>
        </Modal>
      )}

      {notice && (
        <Modal title={notice.title} onClose={() => setNotice(null)}>
          <ul className="text-sm space-y-1 mb-3 list-disc pl-5" style={{ color: "var(--kin-chu-phu)" }}>
            {notice.lines.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
          <label className="block text-sm" htmlFor="tin-doi-lich">Tin báo lớp (sửa được trước khi gửi)</label>
          <textarea id="tin-doi-lich" rows={5} value={notice.text} onChange={e => setNotice(n => (n ? { ...n, text: e.target.value } : n))}
            className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={FIELD_STYLE} />
          <p className="text-xs mt-2" style={{ color: "var(--kin-chu-phu)" }}>
            Tin chung cho cả lớp: không tên em, không điểm, không tiền. {notice.groupUrl ? "Sẽ mở nhóm Zalo của lớp." : "Chưa gắn nhóm Zalo — KiN sẽ chép tin và mở Zalo, bạn chọn đúng người nhận."}
          </p>
          <div className="flex gap-2 flex-wrap mt-4 justify-end">
            <KinButton variant="secondary" onClick={() => setNotice(null)}>Để sau</KinButton>
            <KinButton variant="secondary" onClick={async () => { if (await copyText(notice.text)) notify.ok("Đã sao chép tin."); else notify.err("Không sao chép được."); }}>Sao chép</KinButton>
            <KinButton onClick={() => void openChangeZalo()} disabled={!notice.text.trim()}>Mở Zalo</KinButton>
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
      {attend && (
        <Modal title={`Điểm danh — ${attend.courseName} · ${ddmm(attend.dateKey)}`} onClose={() => setAttend(null)} labelledBy="lich-diem-danh">
          <Suspense fallback={<p aria-busy="true">Đang tải điểm danh…</p>}>
            <DiemDanhPanel courseId={attend.courseId} embedded fixedDate={attend.dateKey} onChanged={() => void load(from, true)} />
          </Suspense>
          <div className="flex gap-2 flex-wrap mt-4 justify-end">
            <Link href={`/lop-cua-toi/buoi/${encodeURIComponent(attend.courseId)}/${attend.dateKey}`} className={kinButtonClass("secondary")}>Mở trang buổi học</Link>
            <KinButton variant="secondary" onClick={() => setAttend(null)}>Đóng</KinButton>
          </div>
        </Modal>
      )}

      {quickAdd && (
        <ThemBuoiNhanh courses={quickAdd.courses} defaults={quickAdd.defaults} onClose={() => setQuickAdd(null)}
          onCreated={({ dateKey }) => { setQuickAdd(null); notify.ok("Đã thêm buổi vào Lịch. Thêm buổi không tạo học phí."); setFrom(weekRangeOf(dateKey).from); void load(weekRangeOf(dateKey).from, true); }} />
      )}
    </KinPage>
  );
}

interface CardProps {
  occ: ScheduleOccurrence; nowMs: number; busy: string | null;
  resolved: Record<string, Resolved>;
  onResolve: (absenceId: string, action: "free_makeup" | "charge") => void;
  onSendResolved: (absenceId: string) => void;
  onCompose: (s: ScheduleStudent, item: ReminderItem) => void;
  onGroup: () => void;
  onChange: (kind: "cancel" | "move") => void;
  onRestore: () => void;
  onNotice: () => void;
  onAttend: () => void;
  onDuplicate: () => void;
}

function OccurrenceCard(p: CardProps & { expanded: boolean; onToggle: () => void }) {
  const { occ } = p;
  const done = p.nowMs > 0 && new Date(occ.endAt).getTime() < p.nowMs; // giờ máy chủ lúc tải, không đọc đồng hồ khi render
  const cancelled = occ.status === "cancelled";
  const detailId = `chi-tiet-${occ.key}`;
  return (
    <div className="rounded-lg overflow-hidden" style={{ ...CARD_STYLE, borderLeft: `3px solid ${cancelled ? "var(--kin-tt-cham-trung-tinh)" : classAccentFor(occ.courseId, occ.color)}` }}>
      <button type="button" onClick={p.onToggle} aria-expanded={p.expanded} aria-controls={detailId}
        className="w-full text-left px-3 py-2 flex items-center gap-3 min-h-[44px]">
        <span className="font-medium tabular-nums flex-shrink-0 text-sm" style={{ color: "var(--kin-chu-chinh)", textDecoration: cancelled ? "line-through" : undefined }}>{vnHm(occ.startAt)}–{vnHm(occ.endAt)}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-medium break-words" style={{ color: "var(--kin-chu-chinh)", textDecoration: cancelled ? "line-through" : undefined }}>{occ.courseName}</span>
          <span className="block text-xs flex items-center gap-1.5" style={{ color: "var(--kin-chu-phu)" }}>
            <span aria-hidden className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: cancelled ? "var(--kin-tt-cham-trung-tinh)" : done ? "var(--kin-tt-cham-xong)" : occ.started ? "var(--kin-tt-cham-cho)" : "var(--kin-th-xanh-link)" }} />
            <span>{occ.students.length} học viên · {cancelled ? "buổi đã huỷ" : done ? "đã kết thúc" : occ.started ? "đang diễn ra" : "sắp tới"}
            {occ.status === "moved" && occ.movedFrom && <> · dời từ {WEEKDAY[dayOfWeekOfKey(occ.movedFrom.dateKey)]} {ddmm(occ.movedFrom.dateKey)} {vnHm(occ.movedFrom.startAt)}</>}</span>
          </span>
        </span>
        <span className="flex flex-col items-end gap-1 flex-shrink-0">
          {cancelled && <Badge tone="neutral">Đã huỷ</Badge>}
          {occ.status === "moved" && <Badge tone="neutral">Đã dời</Badge>}
          {occ.mode && <Badge tone="neutral">{MODE_LABEL[occ.mode]}</Badge>}
          {occ.kind !== "regular" && <Badge tone="neutral">{KIND_LABEL[occ.kind]}</Badge>}
          {occ.sessionState === "closed" && <Badge tone="ok">Đã dạy xong</Badge>}
          {occ.pendingAbsences > 0 && <Badge tone="bad">{occ.pendingAbsences} báo nghỉ sát giờ</Badge>}
          {occ.remindersDue > 0 && <Badge tone="wait">{occ.remindersDue} tin nhắc chờ gửi</Badge>}
        </span>
        <span aria-hidden style={{ color: "var(--kin-chu-phu)" }}>{p.expanded ? "▾" : "▸"}</span>
      </button>

      {p.expanded && <OccurrenceDetail {...p} />}
    </div>
  );
}

/** Phần chi tiết một buổi: link lớp, báo nghỉ, đổi lịch, nhắc lịch. Hiện dưới thẻ (điện thoại) hoặc ở cột phải (máy tính). */
function OccurrenceDetail(p: CardProps & { panel?: boolean }) {
  const { occ } = p;
  const cancelled = occ.status === "cancelled";
  const detailId = `chi-tiet-${occ.key}`;
  const dk = occ.dateKey;
  const stateText = cancelled ? "Buổi đã huỷ" : occ.status === "moved" ? "Buổi đã dời" : p.nowMs > 0 && new Date(occ.endAt).getTime() < p.nowMs ? "Đã kết thúc" : occ.started ? "Đang diễn ra" : "Sắp tới";
  return (
    <div id={detailId} className={p.panel ? "space-y-6" : "px-4 pb-4 space-y-4"} style={p.panel ? undefined : { borderTop: "1px solid var(--kin-vien-thuong)" }}>
      {p.panel && (
        <div>
          <p className="text-[length:var(--kin-co-goc)]">
            {occ.pendingAbsences > 0 ? <KinStatus tone="cho">Xin nghỉ sát giờ · cần quyết định</KinStatus> : <KinStatus tone={cancelled ? "mo" : "xong"}>{stateText}</KinStatus>}
          </p>
          <h2 className="mt-3 text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)]">{occ.courseName} · {ddmm(dk)}</h2>
          <p className="mt-3 text-[length:var(--kin-co-tieu-de)] leading-6 tabular-nums text-[var(--kin-chu-chinh)]">{vnHm(occ.startAt)}–{vnHm(occ.endAt)} · {occ.students.length} học viên</p>
          {occ.status === "moved" && occ.movedFrom && <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đã dời từ {WEEKDAY[dayOfWeekOfKey(occ.movedFrom.dateKey)]} {ddmm(occ.movedFrom.dateKey)} {vnHm(occ.movedFrom.startAt)}</p>}
        </div>
      )}

          {/* LI-06: 5 thao tác nhanh. LI-05: bấm buổi → mở chi tiết, điểm danh ngay từ Lịch. */}
          <div role="group" aria-label="Thao tác nhanh" data-quick-actions className="flex flex-wrap gap-2 pt-3">
            <Link href={`/lop-cua-toi/buoi/${encodeURIComponent(occ.courseId)}/${dk}`} className={kinButtonClass("primary")}>Mở buổi</Link>
            <KinButton variant="secondary" onClick={p.onAttend}>Điểm danh</KinButton>
            {occ.kind === "regular" && !occ.started && occ.status === "scheduled" && <KinButton variant="secondary" onClick={() => p.onChange("move")}>Dời</KinButton>}
            {occ.kind === "regular" && !occ.started && occ.status === "scheduled" && <KinButton variant="secondary" onClick={() => p.onChange("cancel")}>Báo nghỉ</KinButton>}
            <KinButton variant="secondary" onClick={p.onDuplicate}>Nhân bản</KinButton>
            {occ.kind === "regular" && <Link href={`/lop-cua-toi/lich/doi-buoi?scheduleId=${encodeURIComponent(occ.scheduleId)}&dateKey=${occ.originalDateKey}`} className={kinButtonClass("ghost")}>Dời và học bù</Link>}
          </div>

          <p className="text-sm pt-1" style={{ color: "var(--kin-chu-phu)" }}>
            {occ.mode ? <>{MODE_LABEL[occ.mode]}{occ.mode === "offline" && occ.location ? ` · ${occ.location}` : ""}{" · "}</> : null}
            {occ.joinUrl
              ? <>Link vào lớp ({occ.joinSource ? JOIN_SOURCE_LABEL[occ.joinSource] : "đã đặt"}): <a href={occ.joinUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--kin-nhan-link)" }}>{occ.joinUrl}</a></>
              : occ.mode === "offline"
                ? <>Học trực tiếp.</>
                : <>Chưa có link vào lớp. Thêm ở tab <Link href={`/lop-cua-toi/quan-lop/${occ.courseId}?tab=lich-hoc`} className="underline" style={{ color: "var(--kin-nhan-link)" }}>Lịch học</Link> hoặc mở buổi để đặt link riêng.</>}
          </p>

          <p className="text-sm">
            <Link href={`/lop-cua-toi/ke-hoach-buoi?courseId=${encodeURIComponent(occ.courseId)}&date=${occ.dateKey}`} className="underline font-medium" style={{ color: "var(--kin-nhan-link)" }}>Soạn kế hoạch buổi này</Link>
            <span className="text-xs ml-2" style={{ color: "var(--kin-chu-phu)" }}>4 hoạt động, ra bản gia sư và phiếu học sinh.</span>
          </p>

          {occ.students.some(s => s.absence) && (
            <div>
              <h3 className="text-sm font-medium mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Báo nghỉ</h3>
              <ul className="space-y-2">
                {occ.students.filter(s => s.absence).map(s => {
                  const a = s.absence!;
                  const rs = p.resolved[a.id];
                  const label = ABSENCE_LABEL[rs?.status ?? a.status] ?? { tone: "neutral" as const, text: a.status };
                  return (
                    <li key={s.id} className="rounded-lg p-3" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-sm font-medium" style={{ color: "var(--kin-chu-chinh)" }}>{s.name}</span>
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

          {!occ.started && occ.kind === "regular" && (
            <div aria-label="Đổi lịch buổi này">
              <h3 className="text-sm font-medium mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Đổi lịch buổi này</h3>
              {occ.status === "scheduled" ? (
                <>
                  <p className="text-xs mb-2" style={{ color: "var(--kin-chu-phu)" }}>
                    Dời sang ngày/giờ khác hoặc huỷ hẳn. Học viên được báo trong ứng dụng; bạn tự mở Zalo báo phụ huynh. Không đụng tới học phí.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <KinButton variant="secondary" onClick={() => p.onChange("move")}>Dời buổi</KinButton>
                    <KinButton variant="secondary" onClick={() => p.onChange("cancel")}>Huỷ buổi</KinButton>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm" style={{ color: "var(--kin-chu-chinh)" }}>
                    {cancelled ? "Buổi này đã huỷ" : "Buổi này đã dời"}{occ.change?.reason ? ` — lý do: ${occ.change.reason}` : ""}.
                    {occ.change?.zaloOpenedAt
                      ? <span className="ml-2 text-xs" style={{ color: "var(--kin-tt-chu-xong)" }}>Đã mở Zalo báo lớp lúc {vnHm(occ.change.zaloOpenedAt)}</span>
                      : <span className="ml-2 text-xs" style={{ color: "var(--kin-chu-phu)" }}>Chưa mở Zalo để báo lớp.</span>}
                  </p>
                  <div className="flex gap-2 flex-wrap mt-2">
                    <KinButton onClick={p.onNotice}>{occ.change?.zaloOpenedAt ? "Mở lại tin báo lớp" : "Báo lớp qua Zalo"}</KinButton>
                    <KinButton variant="secondary" onClick={() => p.onChange(cancelled ? "cancel" : "move")}>{cancelled ? "Sửa lý do huỷ" : "Đổi lịch dời"}</KinButton>
                    {cancelled && <KinButton variant="secondary" onClick={() => p.onChange("move")}>Đổi thành dời buổi</KinButton>}
                    {!cancelled && <KinButton variant="secondary" onClick={() => p.onChange("cancel")}>Huỷ buổi</KinButton>}
                    <KinButton variant="secondary" loading={p.busy === occ.key} onClick={p.onRestore}>Khôi phục lịch cũ</KinButton>
                  </div>
                </>
              )}
            </div>
          )}

          {!cancelled && occ.kind === "regular" && (
          <div>
            <h3 className="text-sm font-medium mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Nhắc lịch</h3>
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
                    <p className="text-sm font-medium mb-2" style={{ color: "var(--kin-chu-chinh)" }}>{s.name}</p>
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
          )}
        </div>
  );
}
