// TK-172 (nối AS-191, chốt 06/10/2026) — UI gia sư điểm danh.
// Figma 199:74 (desktop quy tắc lớp), 22:2 (desktop điểm danh), 107:3 (mobile).
//
// Luồng:
//   1. Gia sư chọn ngày — nếu buổi của ngày đó chưa có thì tạo (POST
//      /api/courses/[id]/attendance-sessions), nếu có rồi thì load.
//   2. Trang hiện bảng điểm danh: cột tên + 4 nút (Có mặt/Muộn/Có phép/Vắng).
//      Em chưa chọn trạng thái = "Chưa điểm danh" (GD-06, không tính).
//   3. Bấm "Lưu" → batch PUT /api/attendance-sessions/[id].
//   4. (TT-202) Em có mặt/muộn mà đang giữ buổi bù thì tick "Dùng 1 buổi bù" — buổi bù sắp hết hạn
//      được dùng trước; đổi sang vắng/có phép thì buổi bù tự được trả lại.
//   5. (TT-199) Em đã lưu điểm danh có nút "Nhắn phụ huynh": soạn sẵn tin, gia sư sửa được, KiN mở Zalo và ghi
//      "Đã mở Zalo lúc …" (không bao giờ "đã gửi" — KiN không biết tin có đi thật hay không).
//
// Dùng token --kin-* để màu nhất quán với 5 chủ đề của KiN.
"use client";
import { Suspense, useEffect, useState, useCallback, use as usePromise } from "react";
import { useSearchParams } from "next/navigation";
import { Modal, callApi, copyText, useNotify } from "@/components/tutor/shared";
import Link from "next/link";
import { KinButton, kinButtonClass } from "@/components/kin";
import { KinStatus } from "@/components/kin/Status";
import { ATTENDANCE_STATUS, ATTENDANCE_LABEL, ATTENDANCE_COEFFICIENT, type AttendanceStatus } from "@/lib/attendance";
import { attendanceGroupMessage, attendanceMessage } from "@/lib/invoiceZalo";
import { openZalo } from "@/lib/zaloShare";
import { hmOf, isValidDateKey, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";

const vnWhen = (iso: string) => `${hmOf(vnMinutesOfDay(new Date(iso)))} ngày ${vnDateKeyOf(new Date(iso)).slice(8, 10)}/${vnDateKeyOf(new Date(iso)).slice(5, 7)}`;

type RosterRow = {
  userId:    string;
  name:      string;
  studentId: number | null;
  avatar:    string | null;
  status:    AttendanceStatus | null;
  note:      string | null;
  makeupAvailable: { id: string; expiresAt: string }[]; // buổi bù còn dùng được (sắp hết hạn trước)
  makeupUsedId:    string | null;                       // buổi bù đã gắn cho CHÍNH buổi này
  useMakeup?:      boolean;                             // trạng thái tick trên màn hình
  parentName:      string | null;
  parentPhone:     string | null;
  zaloOpenedAt:    string | null;                       // TT-199: gia sư đã mở Zalo nhắn phụ huynh (trạng thái hiện tại)
};
type Session = { id: string; courseId: string; date: string; note: string | null };

// yyyy-mm-dd theo local — HTML <input type=date>.
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ĐX-01: Hộp việc dẫn tới `?date=YYYY-MM-DD` (buổi chưa điểm danh xong) — mở sẵn đúng ngày đó; thiếu / sai định dạng thì như cũ (hôm nay).
// useSearchParams cần Suspense khi dựng sẵn trang.
export default function DiemDanhPage(props: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={null}><DiemDanhView {...props} /></Suspense>;
}

function DiemDanhView({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = usePromise(params);
  const queryDate = useSearchParams().get("date");
  // useNotify (danh tính ổn định) chứ không phải useToast(): useToast() trả object mới mỗi lần render, đưa vào
  // deps của load() làm trang tự tải lại mỗi khi thông báo hiện/tắt — và xoá các ô điểm danh chưa lưu.
  const toast = useNotify();
  const [date, setDate]           = useState<string>(() => (queryDate && isValidDateKey(queryDate) ? queryDate : todayISO()));
  const [session, setSession]     = useState<Session | null>(null);
  const [roster, setRoster]       = useState<RosterRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [dirty, setDirty]         = useState<Set<string>>(new Set()); // userIds đã sửa
  const [courseName, setCourseName] = useState("");
  const [zaloGroupUrl, setZaloGroupUrl] = useState<string | null>(null);
  const [groupText, setGroupText] = useState<string | null>(null); // PH-216: tin chung vào nhóm Zalo lớp
  const [compose, setCompose]     = useState<{ row: RosterRow; text: string } | null>(null);

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setDirty(new Set());
    try {
      // Lấy danh sách buổi theo lớp → tìm buổi của ngày
      const r = await fetch(`/api/courses/${courseId}/attendance-sessions`, { credentials: "same-origin" });
      if (!r.ok) { toast.err("Không tải được danh sách buổi"); setLoading(false); return; }
      const d = await r.json();
      const items = d.items as Session[];
      const existing = items.find(it => it.date.slice(0, 10) === date);
      if (!existing) {
        // Chưa có buổi — tạo rỗng (chưa load roster vì cần session.id)
        setSession(null);
        setRoster([]);
      } else {
        setSession(existing);
        const r2 = await fetch(`/api/attendance-sessions/${existing.id}`, { credentials: "same-origin" });
        if (r2.ok) {
          const d2 = await r2.json();
          setCourseName(d2.course?.name ?? "");
          setZaloGroupUrl(d2.course?.zaloGroupUrl ?? null);
          setRoster((d2.roster as RosterRow[]).map(r => ({ ...r, useMakeup: r.makeupUsedId !== null })));
        }
      }
    } finally { setLoading(false); }
  }, [courseId, date, toast]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function createSession() {
    setSaving(true);
    try {
      const r = await fetch(`/api/courses/${courseId}/attendance-sessions`, {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ date }),
      });
      const d = await r.json();
      if (!r.ok) { toast.err(d.error ?? "Không tạo được buổi"); return; }
      toast.ok("Đã tạo buổi điểm danh");
      await load();
    } finally { setSaving(false); }
  }

  function setStatus(userId: string, status: AttendanceStatus) {
    setRoster(prev => prev.map(r =>
      r.userId === userId ? { ...r, status } : r
    ));
    setDirty(prev => new Set(prev).add(userId));
  }

  function markAllPresent() {
    setRoster(prev => prev.map(r => (r.status === "present" ? r : { ...r, status: "present" as AttendanceStatus })));
    setDirty(prev => { const n = new Set(prev); roster.forEach(r => { if (r.status !== "present") n.add(r.userId); }); return n; });
  }

  function setUseMakeup(userId: string, on: boolean) {
    setRoster(prev => prev.map(r => r.userId === userId ? { ...r, useMakeup: on } : r));
    setDirty(prev => new Set(prev).add(userId));
  }

  async function saveAll() {
    if (!session) return;
    const records = roster
      .filter(r => r.status !== null && dirty.has(r.userId))
      .map(r => {
        const present = r.status === "present" || r.status === "late";
        const makeupCreditId = present && r.useMakeup ? (r.makeupUsedId ?? r.makeupAvailable[0]?.id ?? null) : null;
        return { userId: r.userId, status: r.status, note: r.note, ...(makeupCreditId ? { makeupCreditId } : {}) };
      });
    if (records.length === 0) { toast.info("Chưa có thay đổi để lưu"); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/attendance-sessions/${session.id}`, {
        method: "PUT", credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ records }),
      });
      const d = await r.json();
      if (!r.ok) { toast.err(d.error ?? "Lưu thất bại"); return; }
      toast.ok(`Đã lưu ${d.count} học viên`);
      await load(); // làm mới danh sách buổi bù (đã dùng / được trả lại)
    } finally { setSaving(false); }
  }

  function startCompose(row: RosterRow) {
    if (!session || !row.status) return;
    const dd = session.date.slice(8, 10), mm = session.date.slice(5, 7);
    setCompose({ row, text: attendanceMessage({ subject: courseName || "học", dateLabel: `${dd}/${mm}`, studentName: row.name, status: row.status }) });
  }

  async function openComposed() {
    if (!compose || !session) return;
    const { row, text } = compose;
    const res = await openZalo({ text, phone: row.parentPhone });
    if (!res.opened) { if (res.reason === "failed") toast.err("Không mở được Zalo. Hãy chép tin và gửi tay."); return; }
    const log = await callApi<{ openedAt: string }>(`/api/attendance-sessions/${session.id}/zalo`, { method: "POST", body: JSON.stringify({ userId: row.userId }) });
    if (!log.ok) toast.err(log.data.error ?? "Đã mở Zalo nhưng chưa ghi lại được.");
    // Cập nhật tại chỗ — KHÔNG tải lại cả trang, vì tải lại sẽ xoá các ô điểm danh của em khác chưa lưu.
    else setRoster(prev => prev.map(r => (r.userId === row.userId ? { ...r, zaloOpenedAt: log.data.openedAt } : r)));
    toast.info(res.method === "share" ? "Chọn Zalo trong bảng chia sẻ rồi bấm gửi." : "Đã chép tin và mở Zalo — dán vào cuộc trò chuyện rồi bấm gửi.");
    setCompose(null);
  }

  const allMarked = roster.length > 0 && roster.every(r => r.status !== null) && dirty.size === 0;
  function startGroupCompose() {
    if (!session || !allMarked) return;
    const present = roster.filter(r => r.status === "present" || r.status === "late").length;
    setGroupText(attendanceGroupMessage({ subject: courseName || "học", dateLabel: `${session.date.slice(8, 10)}/${session.date.slice(5, 7)}`, present, total: roster.length }));
  }
  async function openGroup() {
    if (groupText === null) return;
    const res = await openZalo({ text: groupText, groupUrl: zaloGroupUrl });
    if (!res.opened) { if (res.reason === "failed") toast.err("Không mở được Zalo. Hãy chép tin và gửi tay."); return; }
    toast.info(res.method === "share" ? "Chọn nhóm Zalo trong bảng chia sẻ rồi bấm gửi." : "Đã chép tin và mở Zalo — dán vào nhóm rồi bấm gửi.");
    setGroupText(null);
  }

  // ĐX-03: bảng cả THÁNG của ngày đang chọn (ô ngày đang gõ dở / rỗng thì lấy tháng hiện tại).
  const exportMonth = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : todayISO().slice(0, 7);
  const exportLabel = `${exportMonth.slice(5, 7)}/${exportMonth.slice(0, 4)}`;

  // Thống kê nhanh
  const counts = roster.reduce((acc, r) => {
    if (r.status) acc[r.status] = (acc[r.status] ?? 0) + 1;
    else acc.none = (acc.none ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      {/* Header: tiêu đề lớp + dòng phụ; ô chọn buổi học đầy bề ngang trên điện thoại (Figma 299:116181) */}
      <div>
        <h1 className="text-h4" style={{ color: "var(--kin-chu-chinh)" }}>{courseName ? `${courseName} · ` : ""}Điểm danh</h1>
        <p className="text-body-sm mt-1" style={{ color: "var(--kin-chu-mo)" }}>
          Vắng không trừ tiền. Hệ số dùng cho chuyên cần.
        </p>
      </div>
      <div>
        <label htmlFor="dd-date" className="block text-body-sm mb-2" style={{ color: "var(--kin-chu-mo)" }}>Chọn buổi học</label>
        <input id="dd-date" type="date" value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full sm:w-auto px-3 min-h-11 text-body-sm rounded-lg"
          style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }} />
      </div>

      {/* State: loading / no-session / session */}
      {loading ? (
        <div className="rounded-xl p-10 text-center text-body-sm" style={{ background: "var(--kin-nen-bang)" }}>
          Đang tải...
        </div>
      ) : !session ? (
        <div className="rounded-xl p-10 text-center space-y-3"
          style={{ background: "var(--kin-nen-bang)", border: "1px dashed var(--kin-vien-thuong)" }}>
          <p className="text-body" style={{ color: "var(--kin-chu-phu)" }}>Chưa có buổi điểm danh cho ngày này.</p>
          <button type="button" onClick={createSession} disabled={saving}
            className="px-5 py-2.5 rounded-lg text-body-sm font-semibold disabled:opacity-50"
            style={{ background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" }}>
            {saving ? "Đang tạo..." : "Tạo buổi điểm danh"}
          </button>
        </div>
      ) : roster.length === 0 ? (
        <div className="rounded-xl p-10 text-center text-body-sm" style={{ background: "var(--kin-nen-bang)" }}>
          Lớp chưa có học viên active.
        </div>
      ) : (
        <>
          {/* Stat strip */}
          <div className="hidden sm:grid sm:grid-cols-5 gap-2">
            {([
              { k: "present", label: "Có mặt" },
              { k: "late",    label: "Muộn" },
              { k: "excused", label: "Có phép" },
              { k: "absent",  label: "Vắng" },
              { k: "none",    label: "Chưa điểm danh" },
            ] as const).map(s => (
              <div key={s.k} className="rounded-lg px-3 py-2 text-center"
                style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
                <div className="text-body font-bold" style={{ color: "var(--kin-chu-chinh)" }}>{counts[s.k] ?? 0}</div>
                <div className="text-caption">{s.label}</div>
              </div>
            ))}
          </div>

          {/* PH-216: tin điểm danh CHUNG vào nhóm Zalo lớp — không nêu em nào vắng */}
          <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
            <p className="text-caption" style={{ color: "var(--kin-chu-phu)" }}>
              {allMarked ? "Tin chung cho nhóm Zalo lớp (không nêu tên em nào)." : "Điểm danh và lưu đủ các em rồi mới nhắn nhóm."}
              {" "}{zaloGroupUrl ? "Đã gắn nhóm Zalo của lớp." : "Chưa gắn nhóm Zalo (Cài đặt → Kết nối)."}
            </p>
            <button type="button" onClick={startGroupCompose} disabled={!allMarked}
              className="px-3 py-2 rounded-lg text-body-sm font-semibold min-h-[44px] disabled:opacity-50"
              style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }}>Nhắn nhóm Zalo lớp</button>
          </div>

          {/* Roster rows */}
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--kin-vien-nhat)]">
            <h2 className="text-[length:var(--kin-co-tieu-de)] leading-6 font-medium" style={{ color: "var(--kin-chu-chinh)" }}>Điểm danh</h2>
            <button type="button" onClick={markAllPresent} className={kinButtonClass("secondary")}>Tất cả có mặt</button>
          </div>
          <div className="overflow-hidden" style={{ background: "var(--kin-nen-trang)" }}>
            {roster.map((r, i) => (
              <RosterRowView key={r.userId} r={r} index={i} onPick={setStatus} onToggleMakeup={setUseMakeup}
                unsaved={dirty.has(r.userId)} onZalo={startCompose} />
            ))}
          </div>

          {/* Lưu: nút nằm thẳng dưới danh sách (Figma 299:116181), không nổi đè thanh dưới của vỏ */}
          <div>
            <button type="button" onClick={saveAll} disabled={saving || dirty.size === 0}
              className={`${kinButtonClass("primary")} disabled:opacity-50`}>
              {saving ? "Đang lưu..." : "Lưu điểm danh"}
            </button>
            <p className="mt-3 text-body-sm" style={{ color: "var(--kin-chu-mo)" }}>
              {dirty.size > 0 ? `${dirty.size} thay đổi chưa lưu` : "Đã lưu tất cả"}. Lưu không tạo học phí.
            </p>
          </div>
        </>
      )}

      <div className="pt-2">
      {/* ĐX-03: xuất bảng điểm danh cả tháng — tải CSV / Excel, hoặc mở trang in để Lưu thành PDF */}
      <div className="flex items-center gap-2 flex-wrap pt-4 border-t border-[var(--kin-vien-nhat)]" role="group" aria-label={`Xuất bảng điểm danh tháng ${exportLabel}`}>
        <span className="text-body-sm" style={{ color: "var(--kin-chu-mo)" }}>Bảng tháng {exportLabel}:</span>
        <a href={`/api/courses/${courseId}/attendance-export?month=${exportMonth}&format=csv`} download className={kinButtonClass("secondary")}>Tải CSV</a>
        <a href={`/api/courses/${courseId}/attendance-export?month=${exportMonth}&format=xlsx`} download className={kinButtonClass("secondary")}>Tải Excel</a>
        <Link href={`/admin/khoa-hoc/${courseId}/diem-danh/in?month=${exportMonth}`} className={kinButtonClass("secondary")}>In / Lưu PDF</Link>
      </div>

      </div>

      {groupText !== null && (
        <Modal title="Nhắn nhóm Zalo lớp" onClose={() => setGroupText(null)}>
          <label className="block text-sm" htmlFor="tin-nhom-dd">Tin nhắn (sửa được trước khi gửi)</label>
          <textarea id="tin-nhom-dd" rows={3} value={groupText} onChange={e => setGroupText(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }} />
          <p className="text-xs mt-2" style={{ color: "var(--kin-chu-phu)" }}>
            Tin chung: chỉ có số bạn có mặt, không nêu em nào vắng hay muộn. {zaloGroupUrl ? "Sẽ mở nhóm Zalo của lớp." : "Chưa gắn nhóm Zalo — KiN sẽ chép tin và mở Zalo, bạn chọn đúng nhóm."} KiN không gửi giúp: bạn tự bấm gửi trong Zalo.
          </p>
          <div className="flex gap-2 flex-wrap mt-4 justify-end">
            <KinButton variant="secondary" onClick={async () => { if (await copyText(groupText)) toast.ok("Đã sao chép tin."); else toast.err("Không sao chép được."); }}>Sao chép</KinButton>
            <KinButton onClick={() => void openGroup()} disabled={!groupText.trim()}>Mở Zalo</KinButton>
          </div>
        </Modal>
      )}

      {compose && (
        <Modal title={`Nhắn phụ huynh — ${compose.row.name}`} onClose={() => setCompose(null)}>
          <label className="block text-sm" htmlFor="tin-diem-danh">Tin nhắn (sửa được trước khi gửi)</label>
          <textarea id="tin-diem-danh" rows={4} value={compose.text} onChange={e => setCompose(c => (c ? { ...c, text: e.target.value } : c))}
            className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
            style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }} />
          <p className="text-xs mt-2" style={{ color: "var(--kin-chu-phu)" }}>
            {compose.row.parentPhone ? `Sẽ mở Zalo của ${compose.row.parentPhone}${compose.row.parentName ? ` (${compose.row.parentName})` : ""}.` : "Chưa có số điện thoại phụ huynh — KiN sẽ chép tin và mở Zalo, bạn chọn đúng người nhận."}
            {" "}KiN không gửi giúp: bạn tự bấm gửi trong Zalo.
          </p>
          <div className="flex gap-2 flex-wrap mt-4 justify-end">
            <KinButton variant="secondary" onClick={async () => { if (await copyText(compose.text)) toast.ok("Đã sao chép tin."); else toast.err("Không sao chép được."); }}>Sao chép</KinButton>
            <KinButton onClick={() => void openComposed()} disabled={!compose.text.trim()}>Mở Zalo</KinButton>
          </div>
        </Modal>
      )}
    </div>
  );
}

function RosterRowView({ r, index, onPick, onToggleMakeup, unsaved, onZalo }: {
  r: RosterRow; index: number;
  onPick: (userId: string, status: AttendanceStatus) => void;
  onToggleMakeup: (userId: string, on: boolean) => void;
  unsaved: boolean; onZalo: (r: RosterRow) => void;
}) {
  const present = r.status === "present" || r.status === "late";
  const hasMakeup = r.makeupAvailable.length > 0 || r.makeupUsedId !== null;
  const nextExpire = r.makeupAvailable[0]?.expiresAt;
  const initials = r.name.trim().split(/\s+/).map(p => p[0]).slice(-2).join("").toUpperCase();
  const tone = r.status === "present" ? "xong" : r.status === "late" ? "cho" : r.status === "absent" ? "loi" : "mo";
  return (
    <div className="flex flex-wrap items-center gap-3 px-1 sm:px-2 py-4"
      style={{ borderTop: index === 0 ? undefined : "1px solid var(--kin-vien-nhat)" }}>
      <div className="hidden sm:flex w-9 h-9 rounded-full items-center justify-center text-caption font-bold flex-shrink-0 overflow-hidden"
        style={{ background: "var(--kin-nen-nhan)", color: "var(--kin-chu-mo-tren-nen-nhan)" }}>
        {r.avatar
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={r.avatar} alt={r.name} className="w-full h-full object-cover" />
          : initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[length:var(--kin-co-tieu-de)] leading-6 truncate" style={{ color: "var(--kin-chu-chinh)" }}>{r.name}</p>
        {r.studentId !== null && (
          <p className="text-caption" style={{ color: "var(--kin-chu-mo)" }}>Mã HS {r.studentId}</p>
        )}
      </div>
      <KinStatus tone={tone} className="flex-shrink-0">{r.status ? ATTENDANCE_LABEL[r.status] : "Chưa điểm danh"}</KinStatus>
      <div className="basis-full grid grid-cols-4 gap-2">
        {([
          ATTENDANCE_STATUS.PRESENT,
          ATTENDANCE_STATUS.LATE,
          ATTENDANCE_STATUS.EXCUSED,
          ATTENDANCE_STATUS.ABSENT,
        ] as const).map(s => {
          const picked = r.status === s;
          // TK-182: điện thoại giấu hệ số (×1.0) cho 4 nút vào vừa một hàng; vẫn có aria-label + title.
          return (
            <button key={s} type="button" onClick={() => onPick(r.userId, s)}
              title={`${ATTENDANCE_LABEL[s]} (hệ số ×${ATTENDANCE_COEFFICIENT[s]})`}
              aria-label={`${ATTENDANCE_LABEL[s]} hệ số ${ATTENDANCE_COEFFICIENT[s]}`}
              aria-pressed={picked}
              className="px-1 py-2 rounded-lg text-[length:var(--kin-co-goc)] whitespace-nowrap min-h-11"
              style={picked
                ? { background: "var(--kin-nen-nhan)", color: "var(--kin-nhan-diem)", border: "1px solid var(--kin-nen-nhan)", fontWeight: 600 }
                : { background: "var(--kin-nen-trang)", color: "var(--kin-chu-chinh)", border: "1px solid var(--kin-vien-thuong)" }}>
              {ATTENDANCE_LABEL[s]}
              <span className="hidden sm:inline"> · ×{ATTENDANCE_COEFFICIENT[s]}</span>
            </button>
          );
        })}
      </div>
      {(hasMakeup || (r.status && !unsaved)) && (
        <div className="basis-full min-w-0">
          {hasMakeup && (
            <label className="flex items-center gap-2 text-caption min-h-[44px] sm:min-h-0" style={{ color: present ? "var(--kin-chu-chinh)" : "var(--kin-chu-mo)" }}>
              <input type="checkbox" checked={!!r.useMakeup && present} disabled={!present}
                onChange={e => onToggleMakeup(r.userId, e.target.checked)} />
              <span>
                Dùng 1 buổi bù cho buổi này
                {nextExpire && !r.makeupUsedId ? ` (đang giữ ${r.makeupAvailable.length}, gần nhất hết hạn ${new Date(nextExpire).toLocaleDateString("vi-VN")})` : r.makeupUsedId ? " (đã dùng ở buổi này)" : ""}
                {!present && " — chỉ dùng khi học viên có mặt/muộn"}
              </span>
            </label>
          )}
          {r.status && !unsaved && (
            <div className="flex-wrap flex items-center gap-2">
              <button type="button" onClick={() => onZalo(r)} aria-label={`Nhắn phụ huynh của ${r.name} qua Zalo`}
                className="text-caption font-semibold underline min-h-[44px] sm:min-h-0" style={{ color: "var(--kin-nhan-diem)" }}>
                Nhắn phụ huynh
              </button>
              {r.zaloOpenedAt && <span className="text-caption" style={{ color: "var(--kin-chu-mo)" }}>Đã mở Zalo lúc {vnWhen(r.zaloOpenedAt)}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
