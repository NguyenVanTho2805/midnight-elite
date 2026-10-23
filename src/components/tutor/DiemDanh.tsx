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
//
// 23/10/2026: tách khỏi trang /admin/khoa-hoc/[id]/diem-danh thành thành phần dùng chung để tab "Buổi học & điểm danh" của trang lớp
// (Figma "Chi tiết lớp" 299:112581) nhúng cùng một bản: `embedded` bỏ tiêu đề trang, chỉ còn "Điểm danh" làm đầu mục.
"use client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Modal, callApi, copyText, useNotify } from "@/components/tutor/shared";
import Link from "next/link";
import { KinButton, kinButtonClass } from "@/components/kin";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinStatus } from "@/components/kin/Status";
import { KinPageHeader, KIN_PAGE } from "@/components/kin/PageLayout";
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
// useSearchParams cần Suspense khi dựng sẵn trang: nơi dùng phải bọc <Suspense>.
export default function DiemDanhPanel({ courseId, embedded = false }: { courseId: string; embedded?: boolean }) {
  const queryDate = useSearchParams().get("date");
  // useNotify (danh tính ổn định) chứ không phải useToast(): useToast() trả object mới mỗi lần render, đưa vào
  // deps của load() làm trang tự tải lại mỗi khi thông báo hiện/tắt — và xoá các ô điểm danh chưa lưu.
  const toast = useNotify();
  const [date, setDate]           = useState<string>(() => (queryDate && isValidDateKey(queryDate) ? queryDate : todayISO()));
  const [session, setSession]     = useState<Session | null>(null);
  const [roster, setRoster]       = useState<RosterRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [dirty, setDirty]         = useState<Set<string>>(new Set()); // userIds đã sửa
  const [courseName, setCourseName] = useState("");
  const [zaloGroupUrl, setZaloGroupUrl] = useState<string | null>(null);
  const [groupText, setGroupText] = useState<string | null>(null); // PH-216: tin chung vào nhóm Zalo lớp
  const [compose, setCompose]     = useState<{ row: RosterRow; text: string } | null>(null);

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true);
    setLoadError(false);
    setDirty(new Set());
    try {
      // Lấy danh sách buổi theo lớp → tìm buổi của ngày
      const r = await fetch(`/api/courses/${courseId}/attendance-sessions`, { credentials: "same-origin" });
      if (!r.ok) { toast.err("Không tải được danh sách buổi"); setLoadError(true); setLoading(false); return; }
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
    } catch { setLoadError(true); }
    finally { setLoading(false); }
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

  // Figma "Tất cả có mặt": đánh dấu cả lớp có mặt (chưa lưu cho tới khi bấm "Lưu điểm danh"); không đụng em đã chọn "Có mặt" từ trước.
  function markAllPresent() {
    setRoster(prev => prev.map(r => (r.status === "present" ? r : { ...r, status: "present" })));
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

  const exportBlock = (
      <div className={`flex items-center gap-2 flex-wrap ${embedded ? "" : "pt-4 border-t border-[var(--kin-vien-nhat)]"}`} role="group" aria-label={`Xuất bảng điểm danh tháng ${exportLabel}`}>
        <span className="text-body-sm" style={{ color: "var(--kin-chu-mo)" }}>Bảng tháng {exportLabel}:</span>
        <a href={`/api/courses/${courseId}/attendance-export?month=${exportMonth}&format=csv`} download className={kinButtonClass("secondary")}>Tải CSV</a>
        <a href={`/api/courses/${courseId}/attendance-export?month=${exportMonth}&format=xlsx`} download className={kinButtonClass("secondary")}>Tải Excel</a>
        <Link href={`/admin/khoa-hoc/${courseId}/diem-danh/in?month=${exportMonth}`} className={kinButtonClass("secondary")}>In / Lưu PDF</Link>
      </div>
  );

  // Trang riêng: lề và H1 theo KinPage/KinPageHeader như mọi trang gia sư; -m-* huỷ lề của khung <main> (p-4 sm:p-6) để lề trái thẳng hàng với các trang khác.
  return (
    <div className={embedded ? "space-y-5" : `${KIN_PAGE} -m-4 sm:-m-6 space-y-5`}>
      {/* Đầu trang: nhúng trong trang lớp thì chỉ còn "Buổi đang xem" + "Điểm danh" (Figma 299:112581). */}
      {embedded ? (
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="dd-date" className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Buổi đang xem</label>
            <input id="dd-date" type="date" value={date} onChange={e => setDate(e.target.value)}
              className="mt-2 w-full min-h-11 px-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] tabular-nums" />
          </div>
          <KinButton variant="secondary" onClick={markAllPresent} disabled={!session || roster.length === 0}>Tất cả có mặt</KinButton>
        </div>
      ) : (
        <>
          {/* Điện thoại (Figma 299:116181): tiêu đề "<Lớp> · Điểm danh", nhãn "Chọn buổi học", ô ngày đầy bề ngang. */}
          <KinPageHeader title={`${courseName ? `${courseName} · ` : ""}Điểm danh`} sub="Vắng không trừ tiền. Hệ số dùng cho chuyên cần." />
          <div>
            <label htmlFor="dd-date" className="block text-body-sm mb-2" style={{ color: "var(--kin-chu-mo)" }}>Chọn buổi học</label>
            <input id="dd-date" type="date" value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full sm:w-auto px-3 min-h-11 text-body-sm rounded-lg"
              style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }} />
          </div>
        </>
      )}
      {!embedded && (
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--kin-vien-nhat)]">
          <h2 className="text-[length:var(--kin-co-tieu-de)] leading-6 font-medium" style={{ color: "var(--kin-chu-chinh)" }}>Điểm danh</h2>
          <KinButton variant="secondary" onClick={markAllPresent} disabled={!session || roster.length === 0}>Tất cả có mặt</KinButton>
        </div>
      )}
      {embedded && (
        <KinSectionHead title="Điểm danh" aside={session && roster.length > 0 ? `${roster.length - (counts.none ?? 0)}/${roster.length} em đã chọn` : undefined} />
      )}

      {embedded && exportBlock}

      {/* State: loading / no-session / session */}
      {loading ? (
        <div aria-busy="true" aria-label="Đang tải điểm danh" className="space-y-3">
          {[0, 1, 2].map(i => <div key={i} className="h-[76px] rounded kin-skel kin-skel--soft" />)}
        </div>
      ) : loadError ? (
        <div role="alert" className="flex items-center gap-2 px-[14px] py-2 text-[length:var(--kin-co-goc)] border-b border-[var(--kin-tt-chu-loi)] bg-[var(--kin-nhan-nen-nhat)]">
          <span className="flex-1 text-[var(--kin-tt-chu-loi)] font-medium">Không tải được điểm danh.</span>
          <button type="button" onClick={() => void load()} className="min-h-11 px-3 font-medium text-[var(--kin-nhan-link)] hover:underline">Thử lại</button>
        </div>
      ) : !session ? (
        <div className="rounded-xl p-10 text-center space-y-3"
          style={{ background: "var(--kin-nen-bang)", border: "1px dashed var(--kin-vien-thuong)" }}>
          <p className="text-[length:var(--kin-co-goc)]" style={{ color: "var(--kin-chu-phu)" }}>Chưa có buổi điểm danh cho ngày này.</p>
          <button type="button" onClick={createSession} disabled={saving}
            className={`${kinButtonClass("primary")} disabled:opacity-50`}>
            {saving ? "Đang tạo..." : "Tạo buổi điểm danh"}
          </button>
        </div>
      ) : roster.length === 0 ? (
        <div className="rounded-xl p-10 text-center text-body-sm" style={{ background: "var(--kin-nen-bang)" }}>
          <p>Lớp chưa có học sinh đang học.</p>
          <p className="mt-2" style={{ color: "var(--kin-chu-mo)" }}>Gửi mã mời để học sinh tự vào lớp, rồi quay lại điểm danh.</p>
          <Link href={`/lop-cua-toi/${courseId}?tab=ma-moi`} className={`${kinButtonClass("secondary")} mt-4`}>Mở mã mời của lớp</Link>
        </div>
      ) : (
        <>
          {/* Tóm tắt số em theo trạng thái: chữ, không khung */}
          <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] tabular-nums" aria-label="Tóm tắt điểm danh">
            Có mặt {counts.present ?? 0} · Muộn {counts.late ?? 0} · Có phép {counts.excused ?? 0} · Vắng {counts.absent ?? 0} · Chưa điểm danh {counts.none ?? 0}
          </p>

          {/* PH-216: tin điểm danh CHUNG vào nhóm Zalo lớp — không nêu em nào vắng */}
          <div className="flex items-center justify-between gap-3 flex-wrap px-[var(--kin-kc-7)] py-[var(--kin-kc-6)] bg-[var(--kin-nen-bang)] border-l-2 border-[var(--kin-vien-thuong)]">
            <p className="text-[length:var(--kin-co-goc)]" style={{ color: "var(--kin-chu-phu)" }}>
              {allMarked ? "Tin chung cho nhóm Zalo lớp (không nêu tên em nào)." : "Điểm danh và lưu đủ các em rồi mới nhắn nhóm."}
              {" "}{zaloGroupUrl ? "Đã gắn nhóm Zalo của lớp." : "Chưa gắn nhóm Zalo (Cài đặt → Kết nối)."}
            </p>
            <button type="button" onClick={startGroupCompose} disabled={!allMarked}
              className="px-3 py-2 rounded-lg text-body-sm font-medium min-h-[44px] disabled:opacity-50"
              style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }}>Nhắn nhóm Zalo lớp</button>
          </div>

          {/* Roster rows */}
          <div>
            {roster.map(r => (
              <RosterRowView key={r.userId} r={r} onPick={setStatus} onToggleMakeup={setUseMakeup}
                unsaved={dirty.has(r.userId)} onZalo={startCompose} />
            ))}
          </div>

          {/* Lưu: nút thường (Figma), dính đáy để bấm được khi danh sách dài; lưu KHÔNG tạo học phí */}
          <div className={`${embedded ? "sticky bottom-4" : ""} flex items-center gap-x-4 gap-y-2 flex-wrap bg-[var(--kin-nen-trang)] py-3`}>
            <KinButton variant="secondary" onClick={saveAll} disabled={dirty.size === 0} loading={saving} loadingLabel="Đang lưu...">Lưu điểm danh</KinButton>
            <span className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
              {dirty.size > 0 ? `${dirty.size} thay đổi chưa lưu. ` : "Đã lưu tất cả. "}Không tạo học phí khi lưu.
            </span>
          </div>
        </>
      )}

      {!embedded && exportBlock}

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

function RosterRowView({ r, onPick, onToggleMakeup, unsaved, onZalo }: {
  r: RosterRow;
  onPick: (userId: string, status: AttendanceStatus) => void;
  onToggleMakeup: (userId: string, on: boolean) => void;
  unsaved: boolean; onZalo: (r: RosterRow) => void;
}) {
  const present = r.status === "present" || r.status === "late";
  const hasMakeup = r.makeupAvailable.length > 0 || r.makeupUsedId !== null;
  const nextExpire = r.makeupAvailable[0]?.expiresAt;
  const SHOWN = [ATTENDANCE_STATUS.PRESENT, ATTENDANCE_STATUS.LATE, ATTENDANCE_STATUS.EXCUSED, ATTENDANCE_STATUS.ABSENT] as const;
  // Hàng: tên + trạng thái bằng chữ (không chỉ màu) ở trên, 4 nút bằng nhau ở dưới (Figma 299:112581). Giữ lớp "flex items-center gap-3" cho bài ui-*.
  return (
    <div className="flex flex-wrap items-center gap-3 py-[var(--kin-kc-6)] border-b border-[var(--kin-vien-nhat)]">
      <div className="basis-full flex items-baseline justify-between gap-2 min-w-0">
        <p className="text-[length:var(--kin-co-tieu-de)] leading-6 text-[var(--kin-chu-chinh)] truncate">{r.name}</p>
        <KinStatus tone={r.status === "present" ? "xong" : r.status === "late" ? "cho" : r.status === "absent" ? "loi" : "mo"} className="flex-shrink-0">
          {r.status ? ATTENDANCE_LABEL[r.status] : "Chưa điểm danh"}{unsaved ? " · chưa lưu" : ""}
        </KinStatus>
      </div>
      <div className="basis-full grid grid-cols-4 gap-2">
        {SHOWN.map(s => {
          const picked = r.status === s;
          return (
            // Mobile <sm giấu hệ số để nhãn gọn; vẫn giữ aria-label (có hệ số) cho trình đọc màn hình + title khi rê chuột.
            <button key={s} type="button" onClick={() => onPick(r.userId, s)} aria-pressed={picked}
              title={`${ATTENDANCE_LABEL[s]} (hệ số ×${ATTENDANCE_COEFFICIENT[s]})`}
              aria-label={`${ATTENDANCE_LABEL[s]} hệ số ${ATTENDANCE_COEFFICIENT[s]}`}
              className={`min-h-11 px-1 rounded-[var(--kin-bo-md)] border text-[length:var(--kin-co-goc)] whitespace-nowrap transition-colors ${picked
                ? "bg-[var(--kin-nen-nhan)] border-[var(--kin-nhan-diem)] font-medium text-[var(--kin-chu-chinh)]"
                : "bg-[var(--kin-nen-trang)] border-[var(--kin-vien-o-nhap)] text-[var(--kin-chu-chinh)] hover:bg-[var(--kin-nen-re-chuot)]"}`}>
              {ATTENDANCE_LABEL[s]}
            </button>
          );
        })}
      </div>
      {r.studentId !== null && <p className="basis-full text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]">Mã HS {r.studentId}</p>}
      {hasMakeup && (
        <label className="basis-full flex items-center gap-2 text-[length:var(--kin-co-goc)] min-h-11" style={{ color: present ? "var(--kin-chu-chinh)" : "var(--kin-chu-mo)" }}>
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
        <div className="basis-full flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => onZalo(r)} aria-label={`Nhắn phụ huynh của ${r.name} qua Zalo`}
            className="min-h-11 font-medium text-[length:var(--kin-co-goc)] text-[var(--kin-nhan-link)] underline">
            Nhắn phụ huynh
          </button>
          {r.zaloOpenedAt && <span className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đã mở Zalo lúc {vnWhen(r.zaloOpenedAt)}</span>}
        </div>
      )}
    </div>
  );
}
