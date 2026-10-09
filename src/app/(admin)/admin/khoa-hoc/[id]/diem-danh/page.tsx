// TK-172 (nối AS-191, chốt 06/10/2026) — UI gia sư điểm danh.
// Figma 199:74 (desktop quy tắc lớp), 22:2 (desktop điểm danh), 107:3 (mobile).
//
// Luồng:
//   1. Gia sư chọn ngày — nếu buổi của ngày đó chưa có thì tạo (POST
//      /api/courses/[id]/attendance-sessions), nếu có rồi thì load.
//   2. Trang hiện bảng điểm danh: cột tên + 4 nút (Có mặt/Muộn/Có phép/Vắng).
//      Em chưa chọn trạng thái = "Chưa điểm danh" (GD-06, không tính).
//   3. Bấm "Lưu" → batch PUT /api/attendance-sessions/[id].
//
// Dùng token --kin-* để màu nhất quán với 5 chủ đề của KiN.
"use client";
import { useEffect, useState, useCallback, use as usePromise } from "react";
import { useToast } from "@/components/ui";
import { ATTENDANCE_STATUS, ATTENDANCE_LABEL, ATTENDANCE_COEFFICIENT, type AttendanceStatus } from "@/lib/attendance";

type RosterRow = {
  userId:    string;
  name:      string;
  studentId: number | null;
  avatar:    string | null;
  status:    AttendanceStatus | null;
  note:      string | null;
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
  present: { bg: "var(--kin-tt-cham-xong)",       fg: "#fff" },        // xanh lá
  late:    { bg: "var(--kin-tt-cham-cho)",        fg: "#fff" },        // vàng
  excused: { bg: "var(--kin-tt-cham-trung-tinh)", fg: "#fff" },        // xám
  absent:  { bg: "var(--kin-tt-chu-loi)",         fg: "#fff" },        // đỏ
};

export default function DiemDanhPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = usePromise(params);
  const toast = useToast();
  const [date, setDate]           = useState<string>(todayISO());
  const [session, setSession]     = useState<Session | null>(null);
  const [roster, setRoster]       = useState<RosterRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [dirty, setDirty]         = useState<Set<string>>(new Set()); // userIds đã sửa

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
          setRoster(d2.roster);
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

  async function saveAll() {
    if (!session) return;
    const records = roster
      .filter(r => r.status !== null && dirty.has(r.userId))
      .map(r => ({ userId: r.userId, status: r.status, note: r.note }));
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
      setDirty(new Set());
    } finally { setSaving(false); }
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
            style={{ background: "var(--kin-th-navy)", color: "var(--kin-chu-tren-nut-chinh)" }}>
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

          {/* Roster rows */}
          <div className="rounded-xl overflow-hidden" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
            {roster.map((r, i) => (
              <RosterRowView key={r.userId} r={r} index={i} onPick={setStatus} />
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
              style={{ background: "var(--kin-th-navy)", color: "var(--kin-chu-tren-nut-chinh)" }}>
              {saving ? "Đang lưu..." : "Lưu điểm danh"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function RosterRowView({ r, index, onPick }: {
  r: RosterRow; index: number;
  onPick: (userId: string, status: AttendanceStatus) => void;
}) {
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
            <button key={s} type="button" onClick={() => onPick(r.userId, s)}
              className="px-2.5 py-1.5 rounded-lg text-caption font-semibold whitespace-nowrap"
              style={picked
                ? { background: c.bg, color: c.fg }
                : { background: "var(--kin-nen-bang)", color: "var(--kin-chu-phu)", border: "1px solid var(--kin-vien-thuong)" }}>
              {ATTENDANCE_LABEL[s]} · ×{ATTENDANCE_COEFFICIENT[s]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
