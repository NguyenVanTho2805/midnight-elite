// GS-LOP-GON — tab "Cài đặt" (thông tin lớp), CẮT từ admin/khoa-hoc/[id]/page.tsx. Dùng chung cho trang quản trị và trang lớp của gia sư.
"use client";
import { useState, useEffect, useRef } from "react";
import { api } from "@/lib/api";
import { Toggle } from "@/components/Toggle";
import { uploadToCloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
import { DropZone } from "@/components/DropZone";
import { CATEGORY_GRADIENT } from "@/lib/courseData";
import type { CourseDB } from "./lessonForm";

// Màu nhãn LƯU vào Course.tagColor: dùng token --kin-* (safeTagColor nhận var(--kin-…)), không mã hex. Nhãn cũ lưu hex vẫn hiện đúng, chỉ không có ô nào sáng.
const TAG_COLORS = [
  { name: "đỏ", value: "var(--kin-tt-chu-loi)" },
  { name: "cam", value: "var(--kin-tt-chu-cho)" },
  { name: "xanh dương", value: "var(--kin-nhan-link)" },
  { name: "xanh lá", value: "var(--kin-tt-chu-xong)" },
];

export function extractBgImage(bg: string): string {
  const m = bg?.match(/url\(["']?(.+?)["']?\)/);
  return m?.[1] ?? "";
}

export function TabCaiDat({ courseSlug, course }: { courseSlug: string; course: CourseDB }) {
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
    tagColor:      course.tagColor ?? TAG_COLORS[0].value,
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
              {TAG_COLORS.map(c => (
                <button key={c.value} type="button" data-mau-du-lieu aria-label={`Màu nhãn ${c.name}`} aria-pressed={form.tagColor === c.value} onClick={() => setForm(f => ({ ...f, tagColor: c.value }))}
                  className="w-11 h-11 rounded-full border-2 transition-all"
                  style={{ background: c.value, borderColor: form.tagColor === c.value ? "var(--kin-chu-chinh)" : "transparent" }} />
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
          tag: course.tag ?? "", tagColor: course.tagColor ?? TAG_COLORS[0].value,
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
