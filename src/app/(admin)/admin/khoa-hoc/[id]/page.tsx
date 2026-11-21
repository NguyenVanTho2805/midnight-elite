"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Toggle } from "@/components/Toggle";
import { uploadToCloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
import { DropZone } from "@/components/DropZone";
import { CATEGORY_GRADIENT } from "@/lib/courseData";
import { KinLoader } from "@/components/kin/KinLoader";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { useAuth } from "@/contexts/AuthContext";
import { MAIN_HOST } from "@/lib/hostRouting";
import GiaoChuLop from "@/components/admin/courses/GiaoChuLop";
import { classBase } from "@/lib/tutorClassRoutes";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type TabId = "cai-dat" | "lich-hoc" | "hoc-vien";

interface LessonDB {
  id: string;
  code: string;
  title: string;
  type: "record" | "live" | "quiz" | "document";
  videoUrl?: string | null;
  zoomUrl?: string | null;
  azotaUrl?: string | null;
  azotaDeadline?: string | null;
  duration?: string | null;
  documents?: string | null;
  adminNote?: string | null;
  isLocked: boolean;
  isFree: boolean;
  statsVideos: number;
  statsMaterials: number;
  statsViews: number;
  order: number;
  _count?: { assignments: number };
}
interface ChapterDB { id: string; title: string; order: number; lessons: LessonDB[] }
interface SectionDB { id: string; title: string; order: number; chapters: ChapterDB[] }
interface CourseDB {
  id: string; adminId: number; name: string;
  category: string; instructor: string; status: boolean;
  openDate: string; price: number; originalPrice?: number | null;
  lessons: number; hours: number; tag?: string | null; tagColor?: string | null;
  introVideo?: string | null; zaloGroupLink?: string | null; bg: string; createdAt: string;
  ownerId?: string | null;
  capacity?: number | null; classStatus?: string;
  types: string[];
  sections: SectionDB[];
}

// ─── TAB CÀI ĐẶT ─────────────────────────────────────────────────────────────
function extractBgImage(bg: string): string {
  const m = bg?.match(/url\(["']?(.+?)["']?\)/);
  return m?.[1] ?? "";
}

function TabCaiDat({ courseSlug, course }: { courseSlug: string; course: CourseDB }) {
  const [form, setForm] = useState({
    publicName:    course.name,
    slug:          course.id,
    instructor:    course.instructor,
    category:      course.category,
    price:         String(course.price),
    originalPrice: course.originalPrice ? String(course.originalPrice) : "",
    openDate:      course.openDate,
    active:        course.status,
    tag:           course.tag ?? "",
    tagColor:      course.tagColor ?? "#FF2157",
    introVideo:    course.introVideo ?? "",
    zaloGroupLink: course.zaloGroupLink ?? "",
    capacity:      course.capacity == null ? "" : String(course.capacity),
    classStatus:   course.classStatus ?? "open",
    bgImage:       extractBgImage(course.bg),
  });
  const [saving, setSaving]           = useState(false);
  const [saved,  setSaved]            = useState(false);
  // File gốc CHƯA upload — chỉ thật sự lên Cloudinary lúc bấm "Lưu thay đổi"
  // (xem handleSave), tránh file mồ côi nếu rời trang mà không lưu.
  const [bgImageFile, setBgImageFile] = useState<File | null>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/categories")
      .then(r => r.ok ? r.json() : { categories: [] })
      .then(d => setCategoryOptions((d.categories as { name: string }[]).map(c => c.name)))
      .catch(() => {});
  }, []);

  const inp = "w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200";

  // Chỉ giữ File + preview tạm — KHÔNG upload ngay (xem ghi chú ở bgImageFile).
  function setBgFile(file: File) {
    if (form.bgImage.startsWith("blob:")) URL.revokeObjectURL(form.bgImage);
    setBgImageFile(file);
    setForm(f => ({ ...f, bgImage: URL.createObjectURL(file) }));
  }
  function handleBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setBgFile(file);
  }

  async function handleSave() {
    // FE-147: để trống = không giới hạn; có giá trị thì phải là số nguyên ≥ 0
    // (server cũng kiểm tra và chặn hạ dưới số học viên đang học).
    const capText = form.capacity.trim();
    if (capText !== "" && !/^\d+$/.test(capText)) {
      alert("Sức chứa phải là số nguyên không âm, hoặc để trống nếu không giới hạn.");
      return;
    }
    setSaving(true);
    try {
      // Chỉ thật sự upload lên Cloudinary ở đây — ngay trước khi lưu khoá
      // học, không còn khoảng hở nào giữa lúc file lên Cloudinary và lúc DB
      // biết tới nó (tránh file mồ côi nếu rời trang giữa chừng).
      let bgImage = form.bgImage;
      if (bgImageFile) {
        const result = await uploadToCloudinary(bgImageFile, "courses/backgrounds");
        bgImage = result.url;
        setBgImageFile(null);
      }

      await api.courses.update(courseSlug, {
        name:          form.publicName,
        instructor:    form.instructor,
        category:      form.category,
        price:         +form.price || course.price,
        originalPrice: form.originalPrice ? +form.originalPrice : null,
        openDate:      form.openDate,
        status:        form.active,
        tag:           form.tag || null,
        tagColor:      form.tag ? form.tagColor : null,
        introVideo:    form.introVideo || null,
        zaloGroupLink: form.zaloGroupLink || null,
        capacity:      capText === "" ? null : Number(capText),
        classStatus:   form.classStatus,
        bg:            bgImage
                         ? `url(${bgImage}) center/cover no-repeat`
                         : CATEGORY_GRADIENT[form.category] ?? course.bg,
      });
      setForm(f => ({ ...f, bgImage }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      alert("Lỗi lưu khoá học: " + (e instanceof Error ? e.message : "Unknown"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {saved && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm font-semibold text-[var(--kin-chu-tren-nut-chinh)]" style={{ background: "var(--kin-tt-chu-xong)" }}>
          ✓ Đã lưu thay đổi thành công
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">Thông tin cơ bản</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Tên khoá học</label>
            <input className={inp} value={form.publicName} onChange={e => setForm(f => ({ ...f, publicName: e.target.value }))} />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Slug (URL, không đổi)</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 py-2 border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 text-xs text-gray-500">/khoa-hoc/</span>
              <input className="flex-1 px-3 py-2.5 text-sm border border-gray-300 rounded-r-lg bg-gray-50 text-gray-500 cursor-not-allowed" value={form.slug} readOnly />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Gia sư</label>
            <input className={inp} value={form.instructor} onChange={e => setForm(f => ({ ...f, instructor: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Danh mục</label>
            <select className={inp + " bg-[var(--kin-nen-trang)]"} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              <option value="">— Chọn danh mục —</option>
              {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              {/* Luôn giữ giá trị hiện tại nếu chưa load xong */}
              {form.category && !categoryOptions.includes(form.category) && (
                <option value={form.category}>{form.category}</option>
              )}
            </select>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">Ảnh nền thẻ khoá học</h3>
        <div className="space-y-3">
          <div className="w-full h-24 rounded-xl overflow-hidden flex items-center justify-center relative"
            style={{ background: form.bgImage ? `url(${form.bgImage}) center/cover no-repeat` : (CATEGORY_GRADIENT[form.category] ?? course.bg) }}>
            <span className="text-white text-xs font-bold opacity-60 select-none">
              {form.bgImage ? "Ảnh nền" : "Gradient mặc định"}
            </span>
            {form.bgImage && (
              <button onClick={() => {
                  if (form.bgImage.startsWith("blob:")) URL.revokeObjectURL(form.bgImage);
                  setBgImageFile(null);
                  setForm(f => ({ ...f, bgImage: "" }));
                }}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center hover:bg-black/70">
                ✕
              </button>
            )}
          </div>

          <input ref={bgFileRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />

          {cloudinaryConfigured ? (
            <DropZone onFiles={files => files[0] && setBgFile(files[0])} disabled={saving} className="rounded-lg">
              <button onClick={() => bgFileRef.current?.click()} disabled={saving}
                className="w-full py-2.5 rounded-lg text-xs font-semibold border-2 border-dashed transition-colors disabled:opacity-50"
                style={{ borderColor: "var(--kin-vien-o-nhap)", color: "var(--kin-chu-mo)" }}>
                {bgImageFile ? `📎 ${bgImageFile.name} (đã chọn, tải lên lúc lưu)` : "🖼 Chọn hoặc kéo-thả ảnh (JPG, PNG, WebP)"}
              </button>
            </DropZone>
          ) : (
            <p className="text-xs text-center py-2" style={{ color: "var(--kin-tt-chu-cho)" }}>⚠ Chưa cấu hình Cloudinary</p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hoặc paste URL ảnh</label>
            <input className={inp} placeholder="https://..."
              value={bgImageFile ? "" : form.bgImage}
              onChange={e => { setBgImageFile(null); setForm(f => ({ ...f, bgImage: e.target.value.trim() })); }} />
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">Giá & hiệu lực</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Giá bán (VNĐ) <span className="text-red-500">*</span></label>
            <input type="number" className={inp} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Giá gốc (VNĐ)</label>
            <input type="number" className={inp} value={form.originalPrice} onChange={e => setForm(f => ({ ...f, originalPrice: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ngày khai giảng</label>
            <input className={inp} value={form.openDate} onChange={e => setForm(f => ({ ...f, openDate: e.target.value }))} />
          </div>
          <div className="flex items-center gap-3 py-2">
            <Toggle checked={form.active} onChange={() => setForm(f => ({ ...f, active: !f.active }))} />
            <span className="text-sm text-gray-600">{form.active ? "Đang hiển thị" : "Ẩn"}</span>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">Nhãn (tuỳ chọn)</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nhãn hiển thị</label>
            <input className={inp} placeholder="VD: HOT, SALE, MỚI" value={form.tag} onChange={e => setForm(f => ({ ...f, tag: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Màu nhãn</label>
            <div className="flex gap-2">
              {["#FF2157","#FE9900","#0068FF","#00A63D"].map(c => (
                <button key={c} type="button" data-mau-du-lieu onClick={() => setForm(f => ({ ...f, tagColor: c }))}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{ background: c, borderColor: form.tagColor === c ? "var(--kin-chu-chinh)" : "transparent" }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">Video giới thiệu</h3>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">YouTube URL (video xem thử miễn phí)</label>
          <input className={inp} placeholder="https://youtube.com/watch?v=... hoặc https://youtu.be/..."
            value={form.introVideo} onChange={e => setForm(f => ({ ...f, introVideo: e.target.value }))} />
          <p className="text-xs text-gray-400 mt-1">Hiện ở đầu trang khoá học. Để trống nếu không có video giới thiệu.</p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">Nhóm Zalo lớp học</h3>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Link nhóm Zalo</label>
          <input className={inp} placeholder="https://zalo.me/g/..."
            value={form.zaloGroupLink} onChange={e => setForm(f => ({ ...f, zaloGroupLink: e.target.value }))} />
          <p className="text-xs text-gray-400 mt-1">Đính kèm trong email kích hoạt gửi học viên. Để trống nếu chưa có nhóm.</p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">Vận hành lớp</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="class-capacity" className="block text-xs font-medium text-gray-600 mb-1">Sức chứa (số học viên tối đa)</label>
            <input id="class-capacity" className={inp} inputMode="numeric" placeholder="Để trống = không giới hạn"
              value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} />
            <p className="text-xs text-gray-400 mt-1">Không thể đặt thấp hơn số học viên đang theo học.</p>
          </div>
          <div>
            <label htmlFor="class-status" className="block text-xs font-medium text-gray-600 mb-1">Trạng thái nhận học viên</label>
            <select id="class-status" className={inp}
              value={form.classStatus} onChange={e => setForm(f => ({ ...f, classStatus: e.target.value }))}>
              <option value="open">Đang nhận học viên</option>
              <option value="paused">Tạm dừng nhận (có thể mở lại)</option>
              <option value="closed">Đã đóng lớp</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Học viên đã vào lớp vẫn học bình thường; chỉ chặn người mới vào.</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-5 mt-5 border-t border-gray-200">
        <button onClick={() => setForm({
          publicName: course.name, slug: course.id,
          instructor: course.instructor, category: course.category,
          price: String(course.price), originalPrice: course.originalPrice ? String(course.originalPrice) : "",
          openDate: course.openDate, active: course.status,
          tag: course.tag ?? "", tagColor: course.tagColor ?? "#FF2157",
          introVideo: course.introVideo ?? "",
          zaloGroupLink: course.zaloGroupLink ?? "",
          capacity: course.capacity == null ? "" : String(course.capacity),
          classStatus: course.classStatus ?? "open",
          bgImage: extractBgImage(course.bg),
        })} className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50">
          Huỷ thay đổi
        </button>
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--kin-nhan-nen)" }}>
          {saving ? "Đang lưu..." : "💾 Lưu thay đổi"}
        </button>
      </div>
    </div>
  );
}

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

// ─── PAGE ─────────────────────────────────────────────────────────────────────
// SCL-F2 (P2-27): trang quản trị của lớp KHÔNG còn soạn nội dung (tab "Chương bài" — bản chép lệch trình soạn gia sư, chỉ nhận link Drive — đã bỏ)
// và không còn lưới lịch tuần. Còn: thông tin lớp, giao chủ lớp, màu + link học chung, học viên ghi danh. Soạn bài / lịch: nút "Mở lớp trong vỏ gia sư".
const TABS: { id: TabId; label: string }[] = [
  { id: "cai-dat",    label: "Thông tin" },
  { id: "lich-hoc",   label: "Màu và link học" },
  { id: "hoc-vien",   label: "Học viên đăng ký" },
];
/** Tab cũ đã chuyển sang vỏ gia sư → trang tương ứng ở đó (liên kết cũ ?tab=chuong-bai vẫn tới đúng việc). */
const MOVED_TABS = new Set(["chuong-bai", "giao-trinh"]);

export default function KhoaHocDetailPage() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const courseSlug   = params.id as string;
  const rawTab       = searchParams.get("tab");
  const activeTab: TabId = (rawTab && TABS.some(t => t.id === rawTab) ? rawTab : "cai-dat") as TabId;
  function setTab(tab: TabId) { router.push(`/admin/khoa-hoc/${courseSlug}?tab=${tab}`); }
  const { user } = useAuth();
  // Quản trị ở tên miền admin: cookie không dùng chung hai tên miền ⇒ địa chỉ TUYỆT ĐỐI ở tên miền chính (như nhóm "Quản lý" của SCL-B); gia sư ở sẵn tên miền chính.
  const tutorHref = user?.adminRole === "teacher" ? classBase(courseSlug) : `https://${MAIN_HOST}${classBase(courseSlug)}`;
  const moved = !!rawTab && MOVED_TABS.has(rawTab);
  // Tải cứng (không router): sang tên miền chính.
  useEffect(() => { if (moved && user) window.location.replace(tutorHref); }, [moved, tutorHref, user]); // chờ biết vai mới chọn tên miền

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
        <KinLoader size={32} />
        <p className="text-sm text-gray-500 mt-3">Đang tải khoá học...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="bg-[var(--kin-nen-trang)] rounded-xl shadow-sm border border-gray-200 p-10 text-center">
        <p className="text-red-500 font-semibold mb-2">Không tìm thấy khoá học</p>
        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={loadCourse} className={kinButtonClass("secondary")}>Thử lại</button>
          <Link href="/admin/khoa-hoc" className={kinButtonClass("ghost")}>← Quay lại danh sách</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--kin-nen-trang)] rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-w-0" style={{ height: "calc(100vh - 104px)" }}>
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-sm text-gray-500">
          Bảng điều khiển /{" "}
          <Link href="/admin/khoa-hoc" className="hover:text-blue-600 transition-colors">Danh sách khoá học</Link>
          {" "}/ <span className="font-medium text-gray-800">{course.name}</span>
        </p>
      </div>

      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex flex-wrap items-start gap-4">
          <div className="w-16 h-11 rounded-lg flex items-center justify-center text-sm font-black text-white flex-shrink-0"
            style={{ background: course.bg ?? "var(--kin-nhan-nen)" }}>KiN</div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-800 leading-tight">{course.name}</h1>
            <p className="text-xs text-gray-400 mt-0.5">ID: {course.adminId} · {course.category}</p>
          </div>
          {/* Soạn bài, tài liệu, video, lịch tuần: một chỗ duy nhất là trang lớp trong vỏ gia sư (Chủ nhiệm mở được mọi lớp). */}
          <a href={tutorHref} data-mo-vo-gia-su className={`ml-auto flex-shrink-0 ${kinButtonClass("primary")}`}>Mở lớp trong vỏ gia sư</a>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setTab(tab.id)}
              className="px-5 min-h-11 text-sm font-medium whitespace-nowrap transition-colors border-b-2"
              style={activeTab === tab.id
                ? { color: "var(--kin-tt-chu-xong)", borderColor: "var(--kin-tt-chu-xong)" }
                : { color: "var(--kin-chu-mo)", borderColor: "transparent" }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 flex-1 min-h-0 overflow-y-auto">
        {/* DG-GIAO-LOP: quản trị trung tâm giao lớp cho gia sư khác làm chủ lớp (API cũng chặn 403 với người khác). */}
        {activeTab === "cai-dat" && (user?.adminRole === "admin_super" || user?.adminRole === "admin_content") && <GiaoChuLop courseId={course.id} courseName={course.name} />}
        {activeTab === "cai-dat"    && <TabCaiDat courseSlug={courseSlug} course={course} />}
        {activeTab === "lich-hoc"   && (
          <div>
            <LopLichCaiDat courseSlug={course.id} />
            <p className="text-sm text-gray-500">Khung giờ hằng tuần đặt ở <a href={`${tutorHref}/lich-hoc`} className="text-[var(--kin-nhan-link)] underline">Lịch học của lớp trong vỏ gia sư</a>.</p>
          </div>
        )}
        {activeTab === "hoc-vien"   && <TabHocVienKhoaHoc courseSlug={courseSlug} />}
      </div>
    </div>
  );
}
