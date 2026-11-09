"use client";

// GS-LOP-GON (09/11/2026): các khối dùng chung (cài đặt lớp, cây Phần/Chương/Bài, ngăn bài học, tài liệu, bài tập tự nộp) đã CẮT NGUYÊN VĂN sang
// src/components/tutor/quan-lop/* để trang lớp của gia sư dùng lại mà không kéo theo khung quản trị này. Trang này giữ khung, breadcrumb, dải tab trong
// và hai tab chỉ của quản trị (Lịch học, Học viên đăng ký). Hành vi + URL của /admin/khoa-hoc/[id] không đổi.
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useContentHref } from "@/components/tutor/useContentHref";
import LichKhung from "@/components/tutor/LichKhung";
import { KinLoader } from "@/components/kin/KinLoader";
import { useAuth } from "@/contexts/AuthContext";
import { AdminToast, useAdminToast } from "@/components/AdminToast";
import type { CourseDB } from "@/components/tutor/quan-lop/lessonForm";
import { TabCaiDat } from "@/components/tutor/quan-lop/TabCaiDat";
import { TabChuongBai } from "@/components/tutor/quan-lop/TabChuongBai";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type TabId = "cai-dat" | "chuong-bai" | "lich-hoc" | "hoc-vien";

// ─── TAB HỌC VIÊN KHOÁ HỌC ───────────────────────────────────────────────────
interface CourseStudent {
  userId: string; name: string; email: string; status?: string;
  phone?: string | null; school?: string | null;
  enrolledAt: string; completed: number; totalLessons: number; progress: number;
}

// FE-149: trạng thái luôn kèm chữ, không chỉ dựa vào màu.
const ENROLLMENT_STATUS_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  active:          { text: "Đang học",                  color: "var(--kin-tt-chu-xong)", bg: "var(--kin-chu-tren-nut-chinh)" },
  pending_consent: { text: "Chờ phụ huynh xác nhận",    color: "var(--kin-tt-chu-cho)", bg: "var(--kin-chu-tren-nut-chinh)" },
  suspended:       { text: "Tạm dừng",                  color: "var(--kin-tt-chu-loi)", bg: "var(--kin-chu-tren-nut-chinh)" },
};
function EnrollmentStatusBadge({ status }: { status?: string }) {
  const m = (status && ENROLLMENT_STATUS_LABEL[status]) || { text: status || "—", color: "var(--kin-chu-phu)", bg: "var(--kin-chu-tren-nut-chinh)" };
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: m.color, background: m.bg }}>
      {m.text}
    </span>
  );
}

function TabHocVienKhoaHoc({ courseSlug }: { courseSlug: string }) {
  const [students, setStudents] = useState<CourseStudent[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/courses/${courseSlug}/students`)
      .then(r => r.json())
      .then(d => { setStudents(d.students ?? []); setTotal(d.total ?? 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseSlug]);

  const filtered = students.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.includes(search)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <p className="text-sm font-bold text-gray-800">Học viên đã đăng ký</p>
          <p className="text-xs text-gray-400 mt-0.5">{total} học viên tổng cộng</p>
        </div>
        <input type="text" placeholder="Tìm theo tên, email..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 w-64" />
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <KinLoader size={36} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">
          {total === 0 ? "Chưa có học viên nào đăng ký khoá học này." : "Không tìm thấy học viên."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["Học viên","Trạng thái","Email","SĐT","Trường","Tiến độ","Ngày đăng ký"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(s => (
                <tr key={s.userId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: "var(--kin-nhan-nen)" }}>
                        {s.name[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <EnrollmentStatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.email}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.phone || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{s.school || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-200 min-w-[60px]">
                        <div className="h-1.5 rounded-full" style={{ width: `${s.progress}%`, background: s.progress >= 80 ? "var(--kin-tt-chu-xong)" : s.progress >= 40 ? "var(--kin-tt-cham-cho)" : "var(--kin-nhan-nen)" }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                        {s.completed}/{s.totalLessons} ({s.progress}%)
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(s.enrolledAt).toLocaleDateString("vi-VN")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── TAB: LỊCH HỌC ─────────────────────────────────────────────────────────────

// LI-02 / LI-17: màu lớp trên Lịch (bảng 25 màu token) và link học online chung của lớp (ưu tiên thấp nhất: riêng buổi > khung giờ > chung lớp).
function LopLichCaiDat({ courseSlug }: { courseSlug: string }) {
  const [color, setColor] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/courses/${courseSlug}/calendar`, { credentials: "same-origin" }).then(r => r.ok ? r.json() : null).then(d => {
      if (!alive) return;
      if (d) { setColor(d.calendarColor ?? null); setUrl(d.classJoinUrl ?? ""); }
      setLoaded(true);
    }).catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [courseSlug]);
  async function save() {
    setSaving(true); setMsg(null);
    const r = await fetch(`/api/courses/${courseSlug}/calendar`, { method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ calendarColor: color, classJoinUrl: url.trim() || null }) });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    setMsg(r.ok ? { ok: true, text: "Đã lưu màu và link chung của lớp." } : { ok: false, text: d.error ?? "Chưa lưu được." });
  }
  return (
    <div className="mb-6 p-4 rounded-xl border border-gray-200 space-y-3" data-lop-lich-cai-dat>
      <p className="text-sm font-bold text-gray-800">Màu lớp và link học online chung</p>
      <div role="radiogroup" aria-label="Màu lớp trên Lịch" className="flex flex-wrap gap-2">
        {Array.from({ length: 25 }, (_, i) => `lop-${String(i + 1).padStart(2, "0")}`).map((k, i) => (
          <button key={k} type="button" role="radio" aria-checked={color === k} aria-label={`Màu ${i + 1}`} onClick={() => setColor(color === k ? null : k)}
            className="w-11 h-11 rounded-full" style={{ background: `var(--kin-${k})`, outline: color === k ? "3px solid var(--kin-chu-chinh)" : "none", outlineOffset: 2 }} />
        ))}
      </div>
      <p className="text-xs text-gray-400">{color ? `Đã chọn màu ${Number(color.slice(4))}. Bấm lại để bỏ chọn (về màu tự động).` : "Chưa chọn: Lịch dùng màu tự động theo lớp."}</p>
      <div>
        <label htmlFor="lop-link-chung" className="block text-xs font-medium text-gray-500 mb-1">Link học online chung của lớp (tuỳ chọn)</label>
        <input id="lop-link-chung" type="url" placeholder="https://meet.google.com/..." value={url} onChange={e => setUrl(e.target.value)} disabled={!loaded}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none" />
        <p className="text-xs text-gray-400 mt-1">Dùng khi buổi không có link riêng và khung giờ không có link. Thứ tự: riêng buổi, rồi khung giờ, rồi chung của lớp.</p>
      </div>
      {msg && <p role="status" className={`text-xs ${msg.ok ? "text-gray-600" : "text-red-500"}`}>{msg.text}</p>}
      <button onClick={() => void save()} disabled={saving || !loaded} className="px-3 py-2 text-xs font-semibold rounded-lg text-white disabled:opacity-50" style={{ background: "var(--kin-nhan-nen)" }}>
        {saving ? "Đang lưu..." : "Lưu màu và link"}
      </button>
    </div>
  );
}

function TabLichHoc({ courseId }: { courseId: string }) {
  return (
    <div>
      <LopLichCaiDat courseSlug={courseId} />
      <LichKhung courseId={courseId} />
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
const TABS: { id: TabId; label: string }[] = [
  { id: "cai-dat",    label: "Cài đặt" },
  { id: "chuong-bai", label: "Chương bài" },
  { id: "lich-hoc",   label: "Lịch học" },
  { id: "hoc-vien",   label: "Học viên đăng ký" },
];

export default function KhoaHocDetailPage() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const href         = useContentHref(); // BU-00 bước 3: gia sư ở bí danh /lop-cua-toi/quan-lop/…, quản trị ở /admin/khoa-hoc/…
  const courseSlug   = params.id as string;
  const rawTab       = searchParams.get("tab");
  const activeTab: TabId = (rawTab && TABS.some(t => t.id === rawTab) ? rawTab : "cai-dat") as TabId;
  function setTab(tab: TabId) { router.push(href(`/admin/khoa-hoc/${courseSlug}?tab=${tab}`)); }

  const { user } = useAuth();
  // NC2-029: vừa tạo lớp xong (gia sư được chuyển thẳng tới đây với ?moi=1) → báo thành công như danh sách khoá vẫn báo.
  const { toast, showToast } = useAdminToast();
  const justCreated = searchParams.get("moi") === "1";
  // NC2-035: hiện đúng một lần rồi xoá ?moi=1 khỏi URL (router.replace, không thêm mục lịch sử) để F5 không báo lại.
  useEffect(() => {
    if (!justCreated) return;
    showToast("Đã tạo khoá học mới");
    const rest = new URLSearchParams(searchParams.toString());
    rest.delete("moi");
    const qs = rest.toString();
    router.replace(href(`/admin/khoa-hoc/${courseSlug}${qs ? `?${qs}` : ""}`));
  }, [justCreated]); // eslint-disable-line react-hooks/exhaustive-deps
  const [course, setCourse] = useState<CourseDB | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]    = useState("");

  const loadCourse = useCallback(() => {
    setLoading(true);
    fetch(`/api/courses/${courseSlug}`)
      .then(r => r.ok ? r.json() : Promise.reject("Not found"))
      .then(data => { setCourse(data); setError(""); })
      .catch(() => setError("Không tìm thấy khoá học"))
      .finally(() => setLoading(false));
  }, [courseSlug]);

  useEffect(() => { loadCourse(); }, [loadCourse]);

  if (loading) {
    return (
      <div className="bg-[var(--kin-nen-trang)] rounded-xl shadow-sm border border-gray-200 p-10 text-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Đang tải khoá học...</p>
      </div>
    );
  }

  // Gia sư (adminRole "teacher") chỉ sửa được khoá của mình — cùng luật `ownsResource` ở các API ghi. API đọc khoá là công khai nên trang vẫn tải được khoá của người khác;
  // không có dòng này, gia sư gõ nhầm / mở link cũ của khoá khác sẽ thấy đủ giao diện sửa (Lưu, Học viên đăng ký…) rồi mới bị 403 từng thao tác.
  const notMine = !!course && user?.adminRole === "teacher" && course.ownerId !== user.id;
  if (error || !course || notMine) {
    return (
      <div className="bg-[var(--kin-nen-trang)] rounded-xl shadow-sm border border-gray-200 p-10 text-center">
        <p className="text-red-500 font-semibold mb-2">{notMine ? "Bạn không có quyền với khoá học này" : "Không tìm thấy khoá học"}</p>
        <Link href={href("/admin/khoa-hoc")} className="text-sm text-blue-600 hover:underline">← Quay lại danh sách</Link>
      </div>
    );
  }

  return (
    <div className="bg-[var(--kin-nen-trang)] rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-w-0" style={{ height: "calc(100vh - 104px)" }}>
      {toast && <AdminToast msg={toast.msg} ok={toast.ok} />}
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-sm text-gray-500">
          Bảng điều khiển /{" "}
          <Link href={href("/admin/khoa-hoc")} className="hover:text-blue-600 transition-colors">Danh sách khoá học</Link>
          {" "}/ <span className="font-medium text-gray-800">{course.name}</span>
        </p>
      </div>

      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-start gap-4">
          <div className="w-16 h-11 rounded-lg flex items-center justify-center text-sm font-black text-white flex-shrink-0"
            style={{ background: course.bg ?? "var(--kin-nhan-nen)" }}>KiN</div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-800 leading-tight">{course.name}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              ID: {course.adminId} · Slug: {course.id} · {course.category}
            </p>
          </div>
          {/* NC2-029: gia sư (đã qua kiểm "notMine" ở trên nên chắc chắn là chủ lớp) mở thẳng trang lớp — tab Mã mời, học viên… */}
          {user?.adminRole === "teacher" && (
            <Link href={`/lop-cua-toi/${course.id}`}
              className="ml-auto flex-shrink-0 inline-flex items-center min-h-[44px] px-4 rounded-lg text-sm font-semibold"
              style={{ background: "var(--kin-nhan-nen)", color: "var(--kin-chu-tren-nut-chinh)", boxShadow: "var(--kin-bong-the)" }}>
              Mở lớp
            </Link>
          )}
        </div>
      </div>

      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setTab(tab.id)}
              className="px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2"
              style={activeTab === tab.id
                ? { color: "var(--kin-tt-chu-xong)", borderColor: "var(--kin-tt-chu-xong)" }
                : { color: "var(--kin-chu-mo)", borderColor: "transparent" }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 flex-1 min-h-0 overflow-y-auto">
        {activeTab === "cai-dat"    && <TabCaiDat courseSlug={courseSlug} course={course} />}
        {activeTab === "chuong-bai" && <TabChuongBai courseSlug={courseSlug} initialSections={course.sections} canUpload={!!user && course.ownerId === user.id} />}
        {activeTab === "lich-hoc"   && <TabLichHoc courseId={course.id} />}
        {activeTab === "hoc-vien"   && <TabHocVienKhoaHoc courseSlug={courseSlug} />}
      </div>
    </div>
  );
}
