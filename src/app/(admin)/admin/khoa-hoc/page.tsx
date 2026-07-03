"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCourses } from "@/hooks/useCourses";
import { api } from "@/lib/api";
import { SkeletonTable } from "@/components/Skeleton";
import { Toggle } from "@/components/Toggle";
import { ADMIN_CATEGORIES, CATEGORY_GRADIENT } from "@/lib/courseData";
import { toSlug } from "@/lib/slug";
import { uploadToCloudinary, cloudinaryConfigured } from "@/lib/cloudinary";

// ─── CREATE COURSE DRAWER ─────────────────────────────────────────────────────
interface CreateForm {
  name: string; slug: string; category: string; instructor: string;
  openDate: string; price: string; originalPrice: string;
  lessons: string; hours: string; tag: string; tagColor: string;
  bgImage: string; status: boolean;
}

const CREATE_INIT: CreateForm = {
  name: "", slug: "", category: "ĐGNL HSA",
  instructor: "Midnight Elite", openDate: "",
  price: "", originalPrice: "",
  lessons: "", hours: "", tag: "", tagColor: "#FF2157",
  bgImage: "", status: true,
};

const TAG_COLORS = ["#FF2157", "#FE9900", "#0068FF", "#00A63D"];
const TAG_LABELS: Record<string, string> = {
  "#FF2157": "HOT", "#FE9900": "SALE", "#0068FF": "MỚI", "#00A63D": "FREE",
};

function CreateCourseDrawer({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const [form, setForm]     = useState<CreateForm>(CREATE_INIT);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([...ADMIN_CATEGORIES]);

  const inp = "w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200";

  // Load categories từ DB
  useEffect(() => {
    fetch("/api/categories")
      .then(r => r.ok ? r.json() : { categories: [] })
      .then(d => {
        const cats = (d.categories as { name: string }[]).map(c => c.name);
        if (cats.length > 0) setCategoryOptions(cats);
      })
      .catch(() => {});
  }, []);

  // Reset form khi đóng
  useEffect(() => {
    if (!open) { setForm(CREATE_INIT); setErrors({}); setSaving(false); }
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

  async function handleBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setBgUploading(true);
    try {
      const result = await uploadToCloudinary(file, "courses/backgrounds");
      setForm(p => ({ ...p, bgImage: result.url }));
    } catch (err) {
      alert("Upload thất bại: " + (err instanceof Error ? err.message : "Lỗi"));
    } finally {
      setBgUploading(false);
    }
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name     = "Tên khoá học không được để trống";
    if (!form.openDate)    e.openDate = "Chọn ngày khai giảng";
    if (!form.price || isNaN(+form.price) || +form.price <= 0)
      e.price   = "Giá bán phải là số dương";
    if (!form.lessons || isNaN(+form.lessons))
      e.lessons = "Số bài học phải là số";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const slug = form.slug.trim() || toSlug(form.name);
      await api.courses.create({
        id:            slug,
        name:          form.name.trim(),
        adminName:     form.name.trim(),
        shortTitle:    form.name.trim().toUpperCase().split(" ").slice(0, 2).join("\n"),
        category:      form.category,
        instructor:    form.instructor,
        teacherAvatar: form.instructor[0] ?? "?",
        openDate:      form.openDate.split("-").reverse().join("/"),
        types:         ["Video"],
        tag:           form.tag || null,
        tagColor:      form.tag ? form.tagColor : null,
        bg:            form.bgImage
                         ? `url(${form.bgImage}) center/cover no-repeat`
                         : CATEGORY_GRADIENT[form.category] ?? "linear-gradient(135deg,#374151,#1E2938)",
        strip:         "#FDE047",
        price:         +form.price,
        originalPrice: form.originalPrice ? +form.originalPrice : null,
        lessons:       +form.lessons,
        hours:         form.hours ? +form.hours : 0,
        status:        form.status,
      });
      onCreated();
      onClose();
    } catch (e) {
      alert("Lỗi tạo khoá học: " + (e instanceof Error ? e.message : "Unknown error"));
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
        className="fixed top-0 right-0 bottom-0 z-50 bg-white overflow-y-auto shadow-2xl"
        style={{
          width: "min(540px, 100vw)",
          transform: open ? "translateX(0)" : "translateX(110%)",
          transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
          pointerEvents: open ? "auto" : "none",
          visibility: open ? "visible" : "hidden",
        }}>

        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-gray-200">
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
              style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 4px 15px rgba(22,163,74,0.4), 0 2px 6px rgba(22,163,74,0.2)" }}>
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
              <div>
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
                style={{ background: form.bgImage ? `url(${form.bgImage}) center/cover no-repeat` : (CATEGORY_GRADIENT[form.category] ?? "#374151") }}>
                <span className="text-white text-xs font-bold opacity-60 select-none">
                  {form.bgImage ? "Ảnh nền" : "Gradient mặc định theo danh mục"}
                </span>
                {form.bgImage && (
                  <button onClick={() => setForm(p => ({ ...p, bgImage: "" }))}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center hover:bg-black/70">
                    ✕
                  </button>
                )}
              </div>

              <input ref={bgFileRef} type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />

              {cloudinaryConfigured ? (
                <button onClick={() => bgFileRef.current?.click()} disabled={bgUploading}
                  className="w-full py-2.5 rounded-lg text-xs font-semibold border-2 border-dashed transition-colors disabled:opacity-50"
                  style={{ borderColor: "#d1d5db", color: "#6B7280" }}>
                  {bgUploading ? "⏳ Đang upload..." : "🖼 Tải ảnh lên (JPG, PNG, WebP)"}
                </button>
              ) : (
                <p className="text-xs text-center py-2" style={{ color: "#b45309" }}>⚠ Chưa cấu hình Cloudinary</p>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Hoặc paste URL ảnh</label>
                <input className={inp} placeholder="https://..."
                  value={form.bgImage}
                  onChange={e => setForm(p => ({ ...p, bgImage: e.target.value.trim() }))} />
              </div>
            </div>
          </section>

          {/* Phân loại */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Phân loại</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Danh mục</label>
                <select className={inp + " bg-white"} value={form.category} onChange={e => set("category", e.target.value)}>
                  {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Giáo viên</label>
                <input className={inp} placeholder="Thầy Nguyễn Minh"
                  value={form.instructor} onChange={e => set("instructor", e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Ngày khai giảng <span className="text-red-500">*</span>
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
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Giá bán (đ) <span className="text-red-500">*</span>
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
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Số bài học <span className="text-red-500">*</span>
                </label>
                <input type="number" min="1" className={inp} placeholder="96"
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
                    <button key={c} type="button" onClick={() => set("tagColor", c)}
                      className="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center text-white text-xs font-bold"
                      style={{ background: c, borderColor: form.tagColor === c ? "#1E2938" : "transparent" }}
                      title={TAG_LABELS[c]}>
                      {form.tagColor === c && "✓"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Trạng thái */}
          <div className="flex items-center justify-between py-3 px-4 rounded-lg" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
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
                <div className="w-12 h-8 rounded flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                  style={{ background: CATEGORY_GRADIENT[form.category] ?? "#374151" }}>ME</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{form.name}</p>
                  <p className="text-xs text-gray-500">{form.category} · {form.instructor}</p>
                </div>
                {form.tag && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded text-white flex-shrink-0"
                    style={{ background: form.tagColor }}>{form.tag}</span>
                )}
                {form.price && (
                  <span className="text-sm font-bold flex-shrink-0" style={{ color: "#FF2157" }}>
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

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Course {
  id: number;
  name: string;
  publicName: string;
  slug: string;
  category: string;
  instructor: string;
  status: boolean;
  createdAt: string;
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
function ActionMenu({ courseId, lessonCount, onDelete, onDuplicate }: { courseId: string; lessonCount: number; onDelete: () => void; onDuplicate: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setConfirmDel(false); }
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const items = [
    { label: "Cài đặt",               tab: "cai-dat"    },
    { label: "Danh sách chương bài",  tab: "chuong-bai" },
    { label: "Học viên đăng ký",      tab: "hoc-vien"   },
  ];

  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen(p => !p)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-blue-400 border border-blue-200 hover:bg-blue-50 transition-colors text-lg font-bold cursor-pointer"
        style={{ lineHeight: 1 }}>
        ···
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-52 rounded-lg shadow-xl border border-gray-200 bg-white py-1">
          {items.map(item => (
            <Link key={item.label} href={`/admin/khoa-hoc/${courseId}?tab=${item.tab}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              {item.label}
            </Link>
          ))}
          <div className="border-t border-gray-100 my-1" />
          <Link href="/student/hoc-tap" target="_blank" onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors"
            style={{ color: "#0068FF" }}>
            Xem portal học viên
          </Link>
          <button
            disabled={duplicating}
            onClick={async () => {
              setDuplicating(true);
              try { await onDuplicate(); } finally { setDuplicating(false); setOpen(false); }
            }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors disabled:opacity-50"
            style={{ color: "#16a34a" }}>
            {duplicating ? "Đang sao chép…" : "Sao chép khóa học"}
          </button>
          <div className="border-t border-gray-100 my-1" />
          {confirmDel ? (
            <div className="px-4 py-2.5">
              <p className="text-xs text-red-600 font-semibold mb-1">Xác nhận xoá khoá học?</p>
              {lessonCount > 0 && (
                <p className="text-xs text-red-500 mb-2">
                  Toàn bộ {lessonCount} bài học, chương và tài liệu sẽ bị xoá vĩnh viễn.
                </p>
              )}
              <div className="flex gap-2">
                <button onClick={() => setConfirmDel(false)}
                  className="flex-1 py-1.5 rounded text-xs border border-gray-300 text-gray-600 hover:bg-gray-50">Huỷ</button>
                <button onClick={() => { onDelete(); setOpen(false); setConfirmDel(false); }}
                  className="flex-1 py-1.5 rounded text-xs font-semibold text-white" style={{ background: "#dc2626" }}>Xoá</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDel(true)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors">
              Xoá khoá học
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── INNER PAGE (needs useSearchParams) ──────────────────────────────────────
function KhoaHocListInner() {
  const searchParams = useSearchParams();
  const { data: apiCourses, loading, refetch } = useCourses({ all: "1" });
  const courses: Course[] = apiCourses.map(c => ({
    id:         c.adminId,
    name:       c.adminName,
    publicName: c.name,
    slug:       c.id,
    category:   c.category,
    instructor: c.instructor,
    status:     c.status,
    createdAt:  c.createdAt,
  }));

  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch]         = useState("");
  const [catFilter, setCat]         = useState(searchParams.get("category") ?? "");
  const [statusFilter, setStatus]   = useState("");
  const [togglingSlug, setTogglingSlug] = useState<string | null>(null);

  // Derive categories directly from loaded courses (no extra API call)
  const apiCategories = [...new Set(apiCourses.map(c => c.category))].filter(Boolean).sort() as string[];

  // Sync catFilter with URL param changes (e.g. navigating from danh-muc page)
  useEffect(() => {
    setCat(searchParams.get("category") ?? "");
  }, [searchParams]);

  const filtered = courses.filter(c => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) &&
        !c.publicName.toLowerCase().includes(search.toLowerCase()) &&
        !c.slug.includes(search.toLowerCase())) return false;
    if (catFilter && c.category !== catFilter) return false;
    if (statusFilter === "active"   && !c.status) return false;
    if (statusFilter === "inactive" &&  c.status) return false;
    return true;
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col" style={{ height: "calc(100vh - 104px)" }}>

      {/* Breadcrumb */}
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <p className="text-sm text-gray-500">
          Bảng điều khiển / <span className="font-medium text-gray-800">Danh sách khoá học</span>
        </p>
      </div>

      {/* Filters */}
      <div className="px-5 pt-4 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-b border-gray-100 flex-shrink-0">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Tên hoặc Slug</label>
          <input type="text" placeholder="Nhập từ khoá" value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Danh mục</label>
          <select value={catFilter} onChange={e => setCat(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none bg-white focus:border-blue-400">
            <option value="">Chọn danh mục</option>
            {apiCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Trạng thái</label>
          <select value={statusFilter} onChange={e => setStatus(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none bg-white focus:border-blue-400">
            <option value="">Tất cả</option>
            <option value="active">Đang hiển thị</option>
            <option value="inactive">Ẩn</option>
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={() => { setSearch(""); setCat(""); setStatus(""); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors mr-2">
            ↺ Làm mới
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 4px 15px rgba(22,163,74,0.4), 0 2px 6px rgba(22,163,74,0.2)" }}>
            + Tạo mới
          </button>
        </div>
      </div>

      {/* Table — flex-1, overflow-auto để tự scroll dọc nếu cần */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {["ID","Tên khoá học","Slug","Danh mục","Giảng viên","Trạng thái","Ngày tạo","Hành động"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={8}><SkeletonTable rows={5} /></td></tr>
            )}
            {!loading && filtered.map(course => (
              <tr key={course.slug} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{course.id}</td>
                <td className="px-4 py-3 max-w-[260px]">
                  <p className="font-medium text-gray-800 truncate">{course.publicName}</p>
                </td>
                <td className="px-4 py-3 max-w-[160px]">
                  <span className="text-blue-600 text-xs font-mono truncate block">{course.slug}</span>
                </td>
                <td className="px-4 py-3 max-w-[140px]">
                  <span className="text-gray-600 text-xs truncate block">{course.category || "—"}</span>
                </td>
                <td className="px-4 py-3 text-gray-700 text-xs whitespace-nowrap">{course.instructor || "—"}</td>
                <td className="px-4 py-3">
                  <Toggle
                    checked={course.status}
                    disabled={togglingSlug === course.slug}
                    onChange={async () => {
                      if (togglingSlug) return;
                      setTogglingSlug(course.slug);
                      try {
                        await api.courses.update(course.slug, { status: !course.status });
                        await refetch();
                      } catch (e) {
                        alert("Lỗi: " + (e instanceof Error ? e.message : "Unknown"));
                      } finally {
                        setTogglingSlug(null);
                      }
                    }}
                  />
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{course.createdAt}</td>
                <td className="px-4 py-3 text-center">
                  <ActionMenu
                    courseId={course.slug}
                    lessonCount={apiCourses.find(c => c.id === course.slug)?.lessons ?? 0}
                    onDelete={async () => {
                      try {
                        await api.courses.remove(course.slug);
                        await refetch();
                      } catch (e) {
                        alert("Lỗi xoá: " + (e instanceof Error ? e.message : "Unknown"));
                      }
                    }}
                    onDuplicate={async () => {
                      const res = await fetch(`/api/courses/${course.slug}/duplicate`, { method: "POST" });
                      if (!res.ok) { alert("Sao chép thất bại"); return; }
                      await refetch();
                    }}
                  />
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="py-16 text-center text-gray-400 text-sm">
                  Không tìm thấy khoá học nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer — luôn ở dưới cùng nhờ flex-col + flex-1 ở table */}
      <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0">
        <p className="text-xs text-gray-500">Hiển thị {filtered.length}/{courses.length} khoá học</p>
      </div>

      <CreateCourseDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refetch}
      />
    </div>
  );
}

// ─── PAGE (Suspense boundary for useSearchParams) ─────────────────────────────
export default function KhoaHocListPage() {
  return (
    <Suspense>
      <KhoaHocListInner />
    </Suspense>
  );
}
