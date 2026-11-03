// CAT-02: chuyển NGUYÊN VĂN từ src/app/(admin)/admin/khoa-hoc/page.tsx (dòng 19-429) — không đổi logic, giữ ô giá bán / giá gốc (TIỀN).
// Chỉ đổi: tách thành tệp riêng và thêm `export` cho hàm.
"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { Toggle } from "@/components/Toggle";
import { ADMIN_CATEGORIES, CATEGORY_GRADIENT } from "@/lib/courseData";
import { toSlug } from "@/lib/slug";
import { uploadToCloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
import { DropZone } from "@/components/DropZone";
import { useAuth } from "@/contexts/AuthContext";
import { vnDateKeyOf } from "@/lib/classSessions";


// ─── CREATE COURSE DRAWER ─────────────────────────────────────────────────────
interface CreateForm {
  name: string; slug: string; category: string; instructor: string;
  openDate: string; price: string; originalPrice: string;
  lessons: string; hours: string; tag: string; tagColor: string;
  bgImage: string; status: boolean;
}

const CREATE_INIT: CreateForm = {
  name: "", slug: "", category: "ĐGNL HSA",
  instructor: "KiN", openDate: "",
  price: "", originalPrice: "",
  lessons: "", hours: "", tag: "", tagColor: "#FF2157",
  bgImage: "", status: true,
};

const TAG_COLORS = ["#FF2157", "#FE9900", "#0068FF", "#00A63D"];
const TAG_LABELS: Record<string, string> = {
  "#FF2157": "HOT", "#FE9900": "SALE", "#0068FF": "MỚI", "#00A63D": "FREE",
};

export function CreateCourseDrawer({ open, onClose, onCreated, showToast }: {
  open: boolean; onClose: () => void; onCreated: (slug: string) => void; showToast: (msg: string, ok?: boolean) => void;
}) {
  // NC2-029: gia sư (adminRole teacher) chỉ bắt buộc TÊN; ngày khai giảng / giá / số bài học để trống thì dùng mặc định (hôm nay giờ VN / 0 / 0).
  // Quản trị trung tâm giữ nguyên: bắt buộc đủ 4 ô. Máy chủ (POST /api/courses) không đổi — nó vốn không kiểm các trường này.
  const { user } = useAuth();
  const isTeacher = user?.adminRole === "teacher";
  const [form, setForm]     = useState<CreateForm>(CREATE_INIT);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateForm, string>>>({});
  const [saving, setSaving] = useState(false);
  // File gốc CHƯA upload — chỉ thật sự lên Cloudinary lúc bấm "Tạo khoá học"
  // (xem handleSave), tránh file mồ côi nếu đóng drawer mà không lưu.
  const [bgImageFile, setBgImageFile] = useState<File | null>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([...ADMIN_CATEGORIES]);

  const inp = "w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200";

  // Load categories từ DB — hợp nhất với danh mục tĩnh (không thay thế hẳn),
  // nếu không category mặc định của form ("ĐGNL HSA") có thể biến mất khỏi
  // danh sách option khi DB chưa có khoá nào thuộc category đó. <select> HTML
  // khi đó âm thầm hiển thị fallback sang option khác trong khi state form
  // vẫn giữ giá trị cũ không còn hợp lệ — admin tưởng đã chọn đúng nhưng thực
  // ra lưu sai category.
  useEffect(() => {
    fetch("/api/categories")
      .then(r => r.ok ? r.json() : { categories: [] })
      .then(d => {
        const cats = (d.categories as { name: string }[]).map(c => c.name);
        if (cats.length > 0) setCategoryOptions([...new Set([...ADMIN_CATEGORIES, ...cats])]);
      })
      .catch(() => {});
  }, []);

  // Reset form khi đóng
  useEffect(() => {
    if (!open) { setForm(CREATE_INIT); setErrors({}); setSaving(false); setBgImageFile(null); }
  }, [open]);

  // Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set<K extends keyof CreateForm>(k: K, v: CreateForm[K]) {
    setForm(p => {
      const next = { ...p, [k]: v };
      if (k === "name") next.slug = toSlug(v as string);
      return next;
    });
    setErrors(p => ({ ...p, [k]: undefined }));
  }

  // Chỉ giữ File + preview tạm — KHÔNG upload ngay (xem ghi chú ở bgImageFile).
  function setBgFile(file: File) {
    if (form.bgImage.startsWith("blob:")) URL.revokeObjectURL(form.bgImage);
    setBgImageFile(file);
    setForm(p => ({ ...p, bgImage: URL.createObjectURL(file) }));
  }
  function handleBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setBgFile(file);
  }

  function validate(): typeof errors {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name     = "Tên khoá học không được để trống";
    if (isTeacher) {
      // Tuỳ chọn: trống thì thôi; có gõ thì phải là số hợp lệ (không âm).
      if (form.price   && (isNaN(+form.price)   || +form.price   < 0)) e.price   = "Giá bán phải là số không âm";
      if (form.lessons && (isNaN(+form.lessons) || +form.lessons < 0)) e.lessons = "Số bài học phải là số không âm";
    } else {
      if (!form.openDate)    e.openDate = "Chọn ngày khai giảng";
      if (!form.price || isNaN(+form.price) || +form.price <= 0)
        e.price   = "Giá bán phải là số dương";
      if (!form.lessons || isNaN(+form.lessons))
        e.lessons = "Số bài học phải là số";
    }
    setErrors(e);
    return e;
  }

  async function handleSave() {
    const e = validate();
    const firstErrorField = Object.keys(e)[0];
    if (firstErrorField) {
      drawerRef.current
        ?.querySelector(`[data-field="${firstErrorField}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true);
    try {
      // Chỉ thật sự upload lên Cloudinary ở đây — ngay trước khi tạo khoá học,
      // không còn khoảng hở nào giữa lúc có file trên Cloudinary và lúc DB
      // biết tới nó (tránh file mồ côi nếu đóng drawer giữa chừng).
      let bgImage = form.bgImage;
      if (bgImageFile) {
        const result = await uploadToCloudinary(bgImageFile, "courses/backgrounds");
        bgImage = result.url;
      }

      const slug = form.slug.trim() || toSlug(form.name);
      // Gia sư bỏ trống: ngày khai giảng = hôm nay (giờ VN), giá 0, số bài học 0.
      const openDateKey = form.openDate || (isTeacher ? vnDateKeyOf(new Date()) : "");
      await api.courses.create({
        id:            slug,
        name:          form.name.trim(),
        adminName:     form.name.trim(),
        shortTitle:    form.name.trim().toUpperCase().split(" ").slice(0, 2).join("\n"),
        category:      form.category,
        instructor:    form.instructor,
        teacherAvatar: form.instructor[0] ?? "?",
        openDate:      openDateKey.split("-").reverse().join("/"),
        types:         ["Video"],
        tag:           form.tag || null,
        tagColor:      form.tag ? form.tagColor : null,
        bg:            bgImage
                         ? `url(${bgImage}) center/cover no-repeat`
                         : CATEGORY_GRADIENT[form.category] ?? "var(--kin-chu-phu)",
        strip:         "var(--kin-tt-chu-cho)",
        price:         form.price ? +form.price : 0,
        originalPrice: form.originalPrice ? +form.originalPrice : null,
        lessons:       form.lessons ? +form.lessons : 0,
        hours:         form.hours ? +form.hours : 0,
        status:        form.status,
      });
      onCreated(slug);
      onClose();
    } catch (e) {
      showToast(e instanceof Error && bgImageFile ? "Upload ảnh hoặc tạo khoá học thất bại: " + e.message : "Lỗi tạo khoá học: " + (e instanceof Error ? e.message : "Unknown"), false);
    } finally {
      setSaving(false);
    }
  }

  const discount = form.originalPrice && form.price
    ? Math.round((1 - +form.price / +form.originalPrice) * 100) : 0;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.3)" }} onClick={onClose} />
      )}
      <div
        ref={drawerRef}
        className="fixed top-0 right-0 bottom-0 z-50 bg-[var(--kin-nen-trang)] overflow-y-auto shadow-2xl"
        style={{
          width: "min(540px, 100vw)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
          pointerEvents: open ? "auto" : "none",
          visibility: open ? "visible" : "hidden",
        }}>

        {/* Header */}
        <div className="sticky top-0 bg-[var(--kin-nen-trang)] z-10 flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-xl font-light">
              ×
            </button>
            <div>
              <h2 className="text-base font-bold text-gray-800">Tạo khoá học mới</h2>
              {form.name && (
                <p className="text-xs text-blue-600 font-mono mt-0.5">{toSlug(form.name)}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
              Huỷ
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
              style={{ background: "var(--kin-nhan-nen)", boxShadow: "var(--kin-bong-the)" }}>
              {saving ? "Đang lưu..." : "Tạo khoá học"}
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-5 space-y-6">

          {/* Tên + Slug */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Tên khoá học</h3>
            <div className="space-y-3">
              <div data-field="name">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Tên khoá học <span className="text-red-500">*</span>
                </label>
                <input className={inp} placeholder="VD: ĐGNL HSA — Trọn gói lộ trình"
                  value={form.name} onChange={e => set("name", e.target.value)} />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Slug (URL)</label>
                <div className="flex items-center gap-0">
                  <span className="inline-flex items-center px-3 py-2.5 border border-r-0 border-gray-300 rounded-l-lg bg-gray-50 text-xs text-gray-400 whitespace-nowrap">/khoa-hoc/</span>
                  <input className="flex-1 px-3 py-2.5 text-sm border border-gray-300 rounded-r-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 font-mono"
                    placeholder="tu-dong-tao-tu-ten"
                    value={form.slug}
                    onChange={e => setForm(p => ({ ...p, slug: toSlug(e.target.value) }))} />
                </div>
                <p className="text-xs text-gray-400 mt-1">Tự tạo từ tên. Chỉnh nếu cần URL riêng.</p>
              </div>
            </div>
          </section>

          {/* Ảnh nền */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Ảnh nền thẻ khoá học</h3>
            <div className="space-y-3">
              {/* Preview */}
              <div className="w-full h-24 rounded-xl overflow-hidden flex items-center justify-center relative"
                style={{ background: form.bgImage ? `url(${form.bgImage}) center/cover no-repeat` : (CATEGORY_GRADIENT[form.category] ?? "var(--kin-chu-phu)") }}>
                <span className="text-white text-xs font-bold opacity-60 select-none">
                  {form.bgImage ? "Ảnh nền" : "Gradient mặc định theo danh mục"}
                </span>
                {form.bgImage && (
                  <button onClick={() => {
                      if (form.bgImage.startsWith("blob:")) URL.revokeObjectURL(form.bgImage);
                      setBgImageFile(null);
                      setForm(p => ({ ...p, bgImage: "" }));
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
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Hoặc paste URL ảnh</label>
                <input className={inp} placeholder="https://..."
                  value={bgImageFile ? "" : form.bgImage}
                  onChange={e => { setBgImageFile(null); setForm(p => ({ ...p, bgImage: e.target.value.trim() })); }} />
              </div>
            </div>
          </section>

          {/* Phân loại */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Phân loại</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Danh mục</label>
                <select className={inp + " bg-[var(--kin-nen-trang)]"} value={form.category} onChange={e => set("category", e.target.value)}>
                  {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Gia sư</label>
                <input className={inp} placeholder="Thầy Nguyễn Minh"
                  value={form.instructor} onChange={e => set("instructor", e.target.value)} />
              </div>
              <div data-field="openDate">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Ngày khai giảng {isTeacher ? <span className="text-gray-400 font-normal">(tuỳ chọn · mặc định hôm nay)</span> : <span className="text-red-500">*</span>}
                </label>
                <input type="date" className={inp} value={form.openDate} onChange={e => set("openDate", e.target.value)} />
                {errors.openDate && <p className="text-xs text-red-500 mt-1">{errors.openDate}</p>}
              </div>
            </div>
          </section>

          {/* Giá */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Giá bán</h3>
            <div className="grid grid-cols-2 gap-4">
              <div data-field="price">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Giá bán (đ) {isTeacher ? <span className="text-gray-400 font-normal">(tuỳ chọn · mặc định 0)</span> : <span className="text-red-500">*</span>}
                </label>
                <input type="number" min="0" className={inp} placeholder="2990000"
                  value={form.price} onChange={e => set("price", e.target.value)} />
                {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Giá gốc (đ)</label>
                <input type="number" min="0" className={inp} placeholder="4990000"
                  value={form.originalPrice} onChange={e => set("originalPrice", e.target.value)} />
                {discount > 0 && <p className="text-xs text-green-600 mt-1">Giảm {discount}%</p>}
              </div>
            </div>
          </section>

          {/* Nội dung */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Nội dung</h3>
            <div className="grid grid-cols-2 gap-4">
              <div data-field="lessons">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Số bài học {isTeacher ? <span className="text-gray-400 font-normal">(tuỳ chọn · mặc định 0)</span> : <span className="text-red-500">*</span>}
                </label>
                <input type="number" min={isTeacher ? "0" : "1"} className={inp} placeholder="96"
                  value={form.lessons} onChange={e => set("lessons", e.target.value)} />
                {errors.lessons && <p className="text-xs text-red-500 mt-1">{errors.lessons}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Số giờ học</label>
                <input type="number" min="1" className={inp} placeholder="120"
                  value={form.hours} onChange={e => set("hours", e.target.value)} />
              </div>
            </div>
          </section>

          {/* Nhãn */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Nhãn (tuỳ chọn)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nội dung nhãn</label>
                <input className={inp} placeholder="VD: HOT, SALE, MỚI"
                  value={form.tag} onChange={e => set("tag", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Màu nhãn</label>
                <div className="flex gap-2 mt-1">
                  {TAG_COLORS.map(c => (
                    <button key={c} type="button" data-mau-du-lieu onClick={() => set("tagColor", c)}
                      className="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: c, borderColor: form.tagColor === c ? "var(--kin-chu-chinh)" : "transparent" }}
                      title={TAG_LABELS[c]}>
                      {form.tagColor === c && "✓"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Trạng thái */}
          <div className="flex items-center justify-between py-3 px-4 rounded-lg" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
            <div>
              <p className="text-sm font-medium text-gray-700">Hiển thị trên website</p>
              <p className="text-xs text-gray-400">Tắt để lưu nháp, không hiện với học viên</p>
            </div>
            <Toggle checked={form.status} onChange={() => set("status", !form.status)} />
          </div>

          {/* Preview */}
          {form.name && (
            <div className="p-4 rounded-xl border border-dashed border-green-300 bg-green-50">
              <p className="text-xs font-bold text-green-700 mb-2">Preview — học viên sẽ thấy:</p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-8 rounded flex items-center justify-center text-xs font-black text-[var(--kin-chu-tren-nut-chinh)] flex-shrink-0"
                  style={{ background: CATEGORY_GRADIENT[form.category] ?? "var(--kin-chu-phu)" }}>KiN</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{form.name}</p>
                  <p className="text-xs text-gray-500">{form.category} · {form.instructor}</p>
                </div>
                {form.tag && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded text-white flex-shrink-0"
                    style={{ background: form.tagColor }}>{form.tag}</span>
                )}
                {form.price && (
                  <span className="text-sm font-bold flex-shrink-0" style={{ color: "var(--kin-tt-chu-loi)" }}>
                    {(+form.price).toLocaleString("vi-VN")}đ
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
