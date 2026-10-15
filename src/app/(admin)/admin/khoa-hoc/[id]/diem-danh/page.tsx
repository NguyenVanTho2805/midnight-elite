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
import { useEffect, useState, useCallback, use as usePromise } from "react";
import { Modal, callApi, copyText, useNotify } from "@/components/tutor/shared";
import { KinButton } from "@/components/kin";
import { ATTENDANCE_STATUS, ATTENDANCE_LABEL, ATTENDANCE_COEFFICIENT, type AttendanceStatus } from "@/lib/attendance";
import { attendanceGroupMessage, attendanceMessage } from "@/lib/invoiceZalo";
import { openZalo } from "@/lib/zaloShare";
import { hmOf, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";

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

// Màu nền chip theo status — dùng semantic token của KiN, giữ 3 màu cố định
// (xong/chờ/lỗi) không đổi theo chủ đề.
const CHIP_COLORS: Record<AttendanceStatus, { bg: string; fg: string }> = {
  present: { bg: "var(--kin-tt-cham-xong)",       fg: "var(--kin-nen-trang)" },        // xanh lá
  late:    { bg: "var(--kin-tt-cham-cho)",        fg: "var(--kin-nen-trang)" },        // vàng
  excused: { bg: "var(--kin-tt-cham-trung-tinh)", fg: "var(--kin-nen-trang)" },        // xám
  absent:  { bg: "var(--kin-tt-chu-loi)",         fg: "var(--kin-nen-trang)" },        // đỏ
};

export default function DiemDanhPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = usePromise(params);
  // useNotify (danh tính ổn định) chứ không phải useToast(): useToast() trả object mới mỗi lần render, đưa vào
  // deps của load() làm trang tự tải lại mỗi khi thông báo hiện/tắt — và xoá các ô điểm danh chưa lưu.
  const toast = useNotify();
  const [date, setDate]           = useState<string>(todayISO());
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

  // Thống kê nhanh
  const counts = roster.reduce((acc, r) => {
    if (r.status) acc[r.status] = (acc[r.status] ?? 0) + 1;
    else acc.none = (acc.none ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-h4" style={{ color: "var(--kin-chu-chinh)" }}>Điểm danh</h1>
          <p className="text-body-sm mt-1" style={{ color: "var(--kin-chu-mo)" }}>
            Vắng không trừ tiền. Hệ số dùng cho chuyên cần.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="dd-date" className="text-body-sm font-semibold" style={{ color: "var(--kin-chu-phu)" }}>Ngày</label>
          <input id="dd-date" type="date" value={date}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-1.5 text-body-sm font-semibold rounded-lg"
            style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }} />
        </div>
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
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
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
          <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg px-3 py-2" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
            <p className="text-caption" style={{ color: "var(--kin-chu-phu)" }}>
              {allMarked ? "Tin chung cho nhóm Zalo lớp (không nêu tên em nào)." : "Điểm danh và lưu đủ các em rồi mới nhắn nhóm."}
              {" "}{zaloGroupUrl ? "Đã gắn nhóm Zalo của lớp." : "Chưa gắn nhóm Zalo (Cài đặt → Kết nối)."}
            </p>
            <button type="button" onClick={startGroupCompose} disabled={!allMarked}
              className="px-3 py-2 rounded-lg text-body-sm font-semibold min-h-[44px] disabled:opacity-50"
              style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }}>Nhắn nhóm Zalo lớp</button>
          </div>

          {/* Roster rows */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
            {roster.map((r, i) => (
              <RosterRowView key={r.userId} r={r} index={i} onPick={setStatus} onToggleMakeup={setUseMakeup}
                unsaved={dirty.has(r.userId)} onZalo={startCompose} />
            ))}
          </div>

          {/* Sticky action — mobile-first */}
          <div className="sticky bottom-4 flex items-center justify-between gap-3 rounded-xl px-4 py-3"
            style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
            <div className="text-body-sm" style={{ color: "var(--kin-chu-mo)" }}>
              {dirty.size > 0 ? `${dirty.size} thay đổi chưa lưu` : "Đã lưu tất cả"}
            </div>
            <button type="button" onClick={saveAll} disabled={saving || dirty.size === 0}
              className="px-5 py-2 rounded-lg text-body-sm font-semibold disabled:opacity-50"
              style={{ background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" }}>
              {saving ? "Đang lưu..." : "Lưu điểm danh"}
            </button>
          </div>
        </>
      )}

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
  return (
    <div className="flex items-center gap-3 px-4 py-3"
      style={{ borderTop: index === 0 ? undefined : "1px solid var(--kin-vien-nhat)" }}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-caption font-bold flex-shrink-0 overflow-hidden"
        style={{ background: "var(--kin-nen-nhan)", color: "var(--kin-chu-mo-tren-nen-nhan)" }}>
        {r.avatar
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={r.avatar} alt={r.name} className="w-full h-full object-cover" />
          : initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-body-sm font-semibold truncate" style={{ color: "var(--kin-chu-chinh)" }}>{r.name}</p>
        {r.studentId !== null && (
          <p className="text-caption" style={{ color: "var(--kin-chu-mo)" }}>Mã HS {r.studentId}</p>
        )}
        {hasMakeup && (
          <label className="flex items-center gap-2 text-caption mt-1 min-h-[44px] sm:min-h-0" style={{ color: present ? "var(--kin-chu-chinh)" : "var(--kin-chu-mo)" }}>
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
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <button type="button" onClick={() => onZalo(r)} aria-label={`Nhắn phụ huynh của ${r.name} qua Zalo`}
              className="text-caption font-semibold underline min-h-[44px] sm:min-h-0" style={{ color: "var(--kin-nhan-diem)" }}>
              Nhắn phụ huynh
            </button>
            {r.zaloOpenedAt && <span className="text-caption" style={{ color: "var(--kin-chu-mo)" }}>Đã mở Zalo lúc {vnWhen(r.zaloOpenedAt)}</span>}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-wrap justify-end">
        {([
          ATTENDANCE_STATUS.PRESENT,
          ATTENDANCE_STATUS.LATE,
          ATTENDANCE_STATUS.EXCUSED,
          ATTENDANCE_STATUS.ABSENT,
        ] as const).map(s => {
          const picked = r.status === s;
          const c = CHIP_COLORS[s];
          return (
            // TK-182 (09/10/2026): mobile <sm giấu hệ số (×1.0) để 4 nút
            // vào vừa 1 hàng. Vẫn giữ aria-label cho screen reader +
            // tooltip title cho desktop hover.
            <button key={s} type="button" onClick={() => onPick(r.userId, s)}
              title={`${ATTENDANCE_LABEL[s]} (hệ số ×${ATTENDANCE_COEFFICIENT[s]})`}
              aria-label={`${ATTENDANCE_LABEL[s]} hệ số ${ATTENDANCE_COEFFICIENT[s]}`}
              className="px-2.5 py-1.5 rounded-lg text-caption font-semibold whitespace-nowrap min-h-[44px] sm:min-h-0"
              style={picked
                ? { background: c.bg, color: c.fg }
                : { background: "var(--kin-nen-bang)", color: "var(--kin-chu-phu)", border: "1px solid var(--kin-vien-thuong)" }}>
              {ATTENDANCE_LABEL[s]}
              <span className="hidden sm:inline"> · ×{ATTENDANCE_COEFFICIENT[s]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
