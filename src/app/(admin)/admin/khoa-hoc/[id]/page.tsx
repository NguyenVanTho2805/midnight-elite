"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Toggle } from "@/components/Toggle";
import { uploadToCloudinary, cloudinaryConfigured } from "@/lib/cloudinary";
import { CATEGORY_GRADIENT } from "@/lib/courseData";

// ─── TYPES ────────────────────────────────────────────────────────────────────
type TabId = "cai-dat" | "chuong-bai" | "hoc-vien";

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
}
interface ChapterDB { id: string; title: string; order: number; lessons: LessonDB[] }
interface SectionDB { id: string; title: string; order: number; chapters: ChapterDB[] }
interface CourseDB {
  id: string; adminId: number; name: string;
  category: string; instructor: string; status: boolean;
  openDate: string; price: number; originalPrice?: number | null;
  lessons: number; hours: number; tag?: string | null; tagColor?: string | null;
  introVideo?: string | null; zaloGroupLink?: string | null; bg: string; createdAt: string;
  types: string[];
  sections: SectionDB[];
}

type PanelMode =
  | { type: "none" }
  | { type: "add-section" }
  | { type: "edit-section"; sectionId: string }
  | { type: "add-chapter"; sectionId: string }
  | { type: "edit-chapter"; sectionId: string; chapterId: string }
  | { type: "add-lesson"; sectionId: string; chapterId: string }
  | { type: "edit-lesson"; sectionId: string; chapterId: string; lessonId: string };

type DelTarget =
  | { kind: "section"; sectionId: string; label: string }
  | { kind: "chapter"; sectionId: string; chapterId: string; label: string }
  | { kind: "lesson"; sectionId: string; chapterId: string; lessonId: string; label: string }
  | null;

interface TitleForm { title: string }
interface LsForm {
  title: string;
  videoUrls: string[]; zoomUrls: string[]; azotaUrls: string[];
  azotaDeadline: string; duration: string;
  isLocked: boolean; isFree: boolean;
  documentsRaw: string;
  adminNote: string;
}

const INIT_LS: LsForm = {
  title: "",
  videoUrls: [""], zoomUrls: [""], azotaUrls: [""],
  azotaDeadline: "", duration: "", isLocked: true, isFree: false,
  documentsRaw: "[]", adminNote: "",
};

function parseUrls(raw: string | null | undefined): string[] {
  if (!raw) return [""];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed as string[];
  } catch { /* plain string */ }
  return [raw];
}

function serializeUrls(urls: string[]): string | null {
  const filtered = urls.map(u => u.trim()).filter(Boolean);
  if (!filtered.length) return null;
  if (filtered.length === 1) return filtered[0];
  return JSON.stringify(filtered);
}

function parseTypes(raw: string | null | undefined): LessonDB["type"][] {
  if (!raw) return ["document"];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed as LessonDB["type"][];
  } catch { /* plain string */ }
  return [raw as LessonDB["type"]];
}

function deriveTypes(vUrls: string[], zUrls: string[], aUrls: string[]): LessonDB["type"][] {
  const types: LessonDB["type"][] = [];
  if (vUrls.some(u => u.trim())) types.push("record");
  if (zUrls.some(u => u.trim())) types.push("live");
  if (aUrls.some(u => u.trim())) types.push("quiz");
  return types.length ? types : ["document"];
}

function serializeTypes(types: LessonDB["type"][]): string {
  if (types.length === 1) return types[0];
  return JSON.stringify(types);
}

function UrlListEditor({ label, placeholder, urls, onChange }: {
  label: string; placeholder: string; urls: string[]; onChange: (urls: string[]) => void;
}) {
  function update(idx: number, val: string) { const n = [...urls]; n[idx] = val; onChange(n); }
  function add() { onChange([...urls, ""]); }
  function remove(idx: number) { const n = urls.filter((_, i) => i !== idx); onChange(n.length ? n : [""]); }
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <div className="space-y-2">
        {urls.map((url, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              className="flex-1 px-3 py-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              value={url}
              onChange={e => update(idx, e.target.value)}
              placeholder={placeholder}
            />
            {urls.length > 1 && (
              <button type="button" onClick={() => remove(idx)}
                className="px-2.5 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 text-sm flex-shrink-0">✕</button>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="mt-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700">+ Thêm link</button>
    </div>
  );
}

const TYPE_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  record:   { label: "Video",    color: "#0055D4", bg: "#EFF6FF" },
  document: { label: "Tài liệu", color: "#6B7280", bg: "#F9FAFB" },
  quiz:     { label: "Bài Tập",     color: "#7C3AED", bg: "#F5F3FF" },
  live:     { label: "Live",     color: "#DC2626", bg: "#FEF2F2" },
};

// ─── SHARED SMALL COMPONENTS ──────────────────────────────────────────────────
function DrawerToggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function Drawer({ open, title, onClose, onSave, saving, children }: {
  open: boolean; title: string; onClose: () => void; onSave: () => void;
  saving?: boolean; children: React.ReactNode;
}) {
  return (
    <>
      {open && <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.3)" }} onClick={onClose} />}
      <div className="fixed top-0 right-0 bottom-0 z-50 bg-white overflow-y-auto shadow-2xl"
        style={{
          width: "min(480px, 100vw)",
          transform: open ? "translateX(0)" : "translateX(110%)",
          transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
          pointerEvents: open ? "auto" : "none",
          visibility: open ? "visible" : "hidden",
        }}>
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 text-xl font-light transition-colors">×</button>
            <h2 className="text-base font-bold text-gray-800">{title}</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">Huỷ</button>
            <button onClick={onSave} disabled={saving}
              className="px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-60"
              style={{ background: "#16a34a" }}>
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </div>
        <div className="p-5 space-y-5">{children}</div>
      </div>
    </>
  );
}

function DelModal({ target, onClose, onConfirm }: { target: DelTarget; onClose: () => void; onConfirm: () => void }) {
  if (!target) return null;
  const kind = target.kind === "section" ? "phần" : target.kind === "chapter" ? "chương" : "bài học";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#FEE2E2" }}>
            <svg viewBox="0 0 20 20" className="w-7 h-7" fill="#DC2626"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
          </div>
          <h2 className="text-base font-bold text-gray-800 mb-1">Xoá {kind}?</h2>
          <p className="text-sm text-gray-500">
            Xoá <strong className="text-gray-800">"{target.kind === "section" ? target.label : target.kind === "chapter" ? target.label : target.label}"</strong>
            {target.kind !== "lesson" ? " sẽ xoá toàn bộ nội dung bên trong." : "."} Không thể hoàn tác.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm border border-gray-300 text-gray-600 hover:bg-gray-50">Huỷ</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "#dc2626" }}>Xoá</button>
        </div>
      </div>
    </div>
  );
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
    bgImage:       extractBgImage(course.bg),
  });
  const [saving, setSaving]           = useState(false);
  const [saved,  setSaved]            = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/categories")
      .then(r => r.ok ? r.json() : { categories: [] })
      .then(d => setCategoryOptions((d.categories as { name: string }[]).map(c => c.name)))
      .catch(() => {});
  }, []);

  const inp = "w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200";

  async function handleBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setBgUploading(true);
    try {
      const result = await uploadToCloudinary(file, "courses/backgrounds");
      setForm(f => ({ ...f, bgImage: result.url }));
    } catch (err) {
      alert("Upload thất bại: " + (err instanceof Error ? err.message : "Lỗi"));
    } finally {
      setBgUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
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
        bg:            form.bgImage
                         ? `url(${form.bgImage}) center/cover no-repeat`
                         : CATEGORY_GRADIENT[form.category] ?? course.bg,
      });
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
        <div className="mb-4 px-4 py-3 rounded-lg text-sm font-semibold text-white" style={{ background: "#16a34a" }}>
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
            <label className="block text-xs font-medium text-gray-600 mb-1">Giảng viên</label>
            <input className={inp} value={form.instructor} onChange={e => setForm(f => ({ ...f, instructor: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Danh mục</label>
            <select className={inp + " bg-white"} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
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
              <button onClick={() => setForm(f => ({ ...f, bgImage: "" }))}
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
            <label className="block text-xs font-medium text-gray-600 mb-1">Hoặc paste URL ảnh</label>
            <input className={inp} placeholder="https://..."
              value={form.bgImage}
              onChange={e => setForm(f => ({ ...f, bgImage: e.target.value.trim() }))} />
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
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, tagColor: c }))}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{ background: c, borderColor: form.tagColor === c ? "#1E2938" : "transparent" }} />
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

      <div className="flex items-center justify-end gap-3 pt-5 mt-5 border-t border-gray-200">
        <button onClick={() => setForm({
          publicName: course.name, slug: course.id,
          instructor: course.instructor, category: course.category,
          price: String(course.price), originalPrice: course.originalPrice ? String(course.originalPrice) : "",
          openDate: course.openDate, active: course.status,
          tag: course.tag ?? "", tagColor: course.tagColor ?? "#FF2157",
          introVideo: course.introVideo ?? "",
          zaloGroupLink: course.zaloGroupLink ?? "",
          bgImage: extractBgImage(course.bg),
        })} className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50">
          Huỷ thay đổi
        </button>
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "#16a34a" }}>
          {saving ? "Đang lưu..." : "💾 Lưu thay đổi"}
        </button>
      </div>
    </div>
  );
}

// ─── DOCUMENTS EDITOR ─────────────────────────────────────────────────────────
interface DocItem { name: string; url: string; type?: string }

function detectType(url: string, name: string): string {
  if (/docs\.google\.com\/document/i.test(url))      return "doc";
  if (/docs\.google\.com\/spreadsheets/i.test(url))  return "xls";
  if (/docs\.google\.com\/presentation/i.test(url))  return "ppt";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf"].includes(ext))                          return "pdf";
  if (["doc","docx"].includes(ext))                   return "doc";
  if (["xls","xlsx"].includes(ext))                   return "xls";
  if (["ppt","pptx"].includes(ext))                   return "ppt";
  return "file";
}

const TYPE_COLOR: Record<string, string> = {
  pdf: "#FF2157", doc: "#0068FF", xls: "#00A63D", ppt: "#F97316", file: "#6B7280",
};

function DocBadge({ type }: { type: string }) {
  const t = type ?? "file";
  return (
    <span className="w-8 h-8 rounded flex items-center justify-center text-white text-[10px] font-black flex-shrink-0 uppercase"
      style={{ background: TYPE_COLOR[t] ?? "#6B7280" }}>
      {t}
    </span>
  );
}

function DocumentsEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const docs: DocItem[] = (() => { try { return JSON.parse(value || "[]"); } catch { return []; } })();
  const [newName,    setNewName]    = useState("");
  const [newUrl,     setNewUrl]     = useState("");
  const [uploading,  setUploading]  = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function save(list: DocItem[]) { onChange(JSON.stringify(list)); }

  function add() {
    if (!newName.trim() || !newUrl.trim()) return;
    const type = detectType(newUrl.trim(), newName.trim());
    save([...docs, { name: newName.trim(), url: newUrl.trim(), type }]);
    setNewName(""); setNewUrl("");
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);
    try {
      const result = await uploadToCloudinary(file, "lessons/documents");
      const name = newName.trim() || file.name.replace(/\.[^.]+$/, "");
      const type = detectType(result.url, file.name);
      save([...docs, { name, url: result.url, type }]);
      setNewName("");
    } catch (err) {
      alert("Upload thất bại: " + (err instanceof Error ? err.message : "Lỗi không xác định"));
    } finally {
      setUploading(false);
    }
  }

  function remove(i: number) { save(docs.filter((_, idx) => idx !== i)); }

  const inp = "px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-blue-400 bg-white";

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">Tài liệu đính kèm</p>

      {docs.length > 0 && (
        <div className="space-y-2 mb-3">
          {docs.map((d, i) => (
            <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-100 bg-gray-50">
              <DocBadge type={detectType(d.url, d.name)} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{d.name}</p>
                <p className="text-xs text-gray-400 truncate">{d.url}</p>
              </div>
              <a href={d.url} target="_blank" rel="noopener noreferrer"
                className="text-xs px-2 py-1 rounded text-blue-600 hover:bg-blue-50 flex-shrink-0">↗</a>
              <button onClick={() => remove(i)}
                className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-50 flex-shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="border border-dashed border-gray-300 rounded-xl p-3 space-y-2">
        <input className={inp + " w-full"} placeholder="Tên tài liệu (VD: File Lý thuyết, File BTVN...)"
          value={newName} onChange={e => setNewName(e.target.value)} />

        <div className="flex gap-2">
          <input className={inp + " flex-1"} placeholder="Hoặc paste link Google Drive..."
            value={newUrl} onChange={e => setNewUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()} />
          <button onClick={add} disabled={!newName.trim() || !newUrl.trim()}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-40 flex-shrink-0"
            style={{ background: "#0068FF" }}>
            + Thêm link
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">hoặc</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <input ref={fileRef} type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
          className="hidden" onChange={handleFileUpload} />

        {cloudinaryConfigured ? (
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="w-full py-2.5 rounded-lg text-xs font-semibold border-2 border-dashed transition-colors disabled:opacity-50"
            style={{ borderColor: "#d1d5db", color: "#6B7280" }}>
            {uploading ? "⏳ Đang upload..." : "📎 Chọn file từ máy tính (PDF, Word, Excel...)"}
          </button>
        ) : (
          <p className="text-xs text-center py-2" style={{ color: "#b45309" }}>
            ⚠ Chưa cấu hình Cloudinary — chỉ dùng được link Drive
          </p>
        )}
      </div>

      {docs.length === 0 && (
        <p className="text-xs text-gray-400 mt-2 text-center">Chưa có tài liệu đính kèm.</p>
      )}
    </div>
  );
}

// ─── TAB CHƯƠNG BÀI ───────────────────────────────────────────────────────────
type DragState =
  | { type: "section"; sectionIdx: number }
  | { type: "chapter"; sectionIdx: number; chapterIdx: number }
  | { type: "lesson"; sectionIdx: number; chapterIdx: number; lessonIdx: number };

function DragHandle() {
  return (
    <svg viewBox="0 0 10 16" className="w-2.5 h-4 flex-shrink-0 cursor-grab active:cursor-grabbing" fill="#CBD5E1">
      <circle cx="3" cy="3" r="1.4"/><circle cx="7" cy="3" r="1.4"/>
      <circle cx="3" cy="8" r="1.4"/><circle cx="7" cy="8" r="1.4"/>
      <circle cx="3" cy="13" r="1.4"/><circle cx="7" cy="13" r="1.4"/>
    </svg>
  );
}

function TabChuongBai({ courseSlug, initialSections }: { courseSlug: string; initialSections: SectionDB[] }) {
  const [sections, setSections] = useState<SectionDB[]>(initialSections);
  const [expanded, setExpanded] = useState<{ sections: Set<string>; chapters: Set<string> }>({
    sections: new Set(initialSections.map(s => s.id)),
    chapters: new Set(initialSections.flatMap(s => s.chapters.map(c => c.id))),
  });
  const [panel,       setPanel]      = useState<PanelMode>({ type: "none" });
  const [del,         setDel]        = useState<DelTarget>(null);
  const [toast,       setToast]      = useState("");
  const [saving,      setSaving]     = useState(false);
  const [title,       setTitle]      = useState("");
  const [ls,          setLs]         = useState<LsForm>(INIT_LS);
  const [dragItem,    setDragItem]   = useState<DragState | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const prevSections = useRef<SectionDB[]>([]);

  function flash(msg: string) { setToast(msg); setTimeout(() => setToast(""), 2500); }

  function reorderSections(fromIdx: number, toIdx: number) {
    prevSections.current = sections;
    const arr = [...sections];
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    setSections(arr);
    const items = arr.map((s, i) => ({ id: s.id, order: i + 1 }));
    fetch(`/api/courses/${courseSlug}/reorder`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "section", items }),
    }).then(r => { if (!r.ok) { setSections(prevSections.current); flash("Lỗi sắp xếp, đã hoàn tác"); } });
  }

  function reorderChapters(sectionIdx: number, fromIdx: number, toIdx: number) {
    prevSections.current = sections;
    const arr = sections.map((s, si) => {
      if (si !== sectionIdx) return s;
      const chs = [...s.chapters];
      const [moved] = chs.splice(fromIdx, 1);
      chs.splice(toIdx, 0, moved);
      return { ...s, chapters: chs };
    });
    setSections(arr);
    const items = arr[sectionIdx].chapters.map((c, i) => ({ id: c.id, order: i + 1 }));
    fetch(`/api/courses/${courseSlug}/reorder`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "chapter", items }),
    }).then(r => { if (!r.ok) { setSections(prevSections.current); flash("Lỗi sắp xếp, đã hoàn tác"); } });
  }

  function reorderLessons(sectionIdx: number, chapterIdx: number, fromIdx: number, toIdx: number) {
    prevSections.current = sections;
    const arr = sections.map((s, si) => {
      if (si !== sectionIdx) return s;
      return {
        ...s,
        chapters: s.chapters.map((c, ci) => {
          if (ci !== chapterIdx) return c;
          const lss = [...c.lessons];
          const [moved] = lss.splice(fromIdx, 1);
          lss.splice(toIdx, 0, moved);
          return { ...c, lessons: lss };
        }),
      };
    });
    setSections(arr);
    const items = arr[sectionIdx].chapters[chapterIdx].lessons.map((l, i) => ({ id: l.id, order: i + 1 }));
    fetch(`/api/courses/${courseSlug}/reorder`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "lesson", items }),
    }).then(r => { if (!r.ok) { setSections(prevSections.current); flash("Lỗi sắp xếp, đã hoàn tác"); } });
  }

  const inp = "w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200";

  function toggleSec(id: string) {
    setExpanded(p => { const s = new Set(p.sections); s.has(id) ? s.delete(id) : s.add(id); return { ...p, sections: s }; });
  }
  function toggleCh(id: string) {
    setExpanded(p => { const c = new Set(p.chapters); c.has(id) ? c.delete(id) : c.add(id); return { ...p, chapters: c }; });
  }

  // ── Open helpers ──
  function openAddSection() { setTitle(""); setPanel({ type: "add-section" }); }
  function openEditSection(sectionId: string) {
    const s = sections.find(x => x.id === sectionId)!;
    setTitle(s.title);
    setPanel({ type: "edit-section", sectionId });
  }
  function openAddChapter(sectionId: string) { setTitle(""); setPanel({ type: "add-chapter", sectionId }); }
  function openEditChapter(sectionId: string, chapterId: string) {
    const s = sections.find(x => x.id === sectionId)!;
    const c = s.chapters.find(x => x.id === chapterId)!;
    setTitle(c.title);
    setPanel({ type: "edit-chapter", sectionId, chapterId });
  }
  function openAddLesson(sectionId: string, chapterId: string) { setLs(INIT_LS); setPanel({ type: "add-lesson", sectionId, chapterId }); }
  function openEditLesson(sectionId: string, chapterId: string, lessonId: string) {
    const s = sections.find(x => x.id === sectionId)!;
    const c = s.chapters.find(x => x.id === chapterId)!;
    const l = c.lessons.find(x => x.id === lessonId)!;
    setLs({
      title: l.title,
      videoUrls: parseUrls(l.videoUrl), zoomUrls: parseUrls(l.zoomUrl),
      azotaUrls: parseUrls(l.azotaUrl), azotaDeadline: l.azotaDeadline ?? "",
      duration: l.duration ?? "", isLocked: l.isLocked, isFree: l.isFree,
      documentsRaw: l.documents ?? "[]",
      adminNote: l.adminNote ?? "",
    });
    setPanel({ type: "edit-lesson", sectionId, chapterId, lessonId });
  }

  // Helper: throw nếu response không OK (tránh dùng error response như data thật)
  async function safeFetch(url: string, init: RequestInit) {
    const res = await fetch(url, init);
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try { data = text ? JSON.parse(text) : {}; } catch { /* non-JSON response */ }
    return { res, data };
  }

  async function apiPost<T>(url: string, body: unknown): Promise<T> {
    const { res, data } = await safeFetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      if (res.status === 401) throw new Error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
      throw new Error((data.error as string) ?? (data.detail as string) ?? `Lỗi ${res.status}`);
    }
    return data as T;
  }
  async function apiPut(url: string, body: unknown): Promise<void> {
    const { res, data } = await safeFetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      if (res.status === 401) throw new Error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
      throw new Error((data.error as string) ?? `Lỗi ${res.status}`);
    }
  }

  // ── Save panel (calls API) ──
  async function savePanel() {
    if (panel.type === "none") return;
    setSaving(true);
    try {
      if (panel.type === "add-section") {
        if (!title.trim()) return;
        const section = await apiPost<SectionDB>(`/api/courses/${courseSlug}/sections`, { title: title.trim() });
        setSections(p => [...p, { ...section, chapters: [] }]);
        setExpanded(p => ({ ...p, sections: new Set([...p.sections, section.id]) }));
        flash(`Đã thêm phần "${section.title}"`);

      } else if (panel.type === "edit-section") {
        if (!title.trim()) return;
        await apiPut(`/api/sections/${panel.sectionId}`, { title: title.trim() });
        setSections(p => p.map(s => s.id === panel.sectionId ? { ...s, title: title.trim() } : s));
        flash("Đã cập nhật tên phần");

      } else if (panel.type === "add-chapter") {
        if (!title.trim()) return;
        const chapter = await apiPost<ChapterDB>(`/api/sections/${panel.sectionId}/chapters`, { title: title.trim() });
        setSections(p => p.map(s => s.id === panel.sectionId
          ? { ...s, chapters: [...s.chapters, { ...chapter, lessons: [] }] } : s));
        setExpanded(prev => ({ ...prev, chapters: new Set([...prev.chapters, chapter.id]) }));
        flash(`Đã thêm chương "${chapter.title}"`);

      } else if (panel.type === "edit-chapter") {
        if (!title.trim()) return;
        await apiPut(`/api/chapters/${panel.chapterId}`, { title: title.trim() });
        setSections(p => p.map(s => s.id === panel.sectionId
          ? { ...s, chapters: s.chapters.map(c => c.id === panel.chapterId ? { ...c, title: title.trim() } : c) } : s));
        flash("Đã cập nhật chương");

      } else if (panel.type === "add-lesson") {
        if (!ls.title.trim()) return;
        const lesson = await apiPost<LessonDB>(`/api/chapters/${panel.chapterId}/lessons`, {
          title: ls.title.trim(), type: serializeTypes(deriveTypes(ls.videoUrls, ls.zoomUrls, ls.azotaUrls)),
          videoUrl: serializeUrls(ls.videoUrls), zoomUrl: serializeUrls(ls.zoomUrls),
          azotaUrl: serializeUrls(ls.azotaUrls), azotaDeadline: ls.azotaDeadline || null,
          duration: ls.duration || null, isLocked: ls.isLocked, isFree: ls.isFree,
        });
        setSections(p => p.map(s => s.id === panel.sectionId
          ? { ...s, chapters: s.chapters.map(c => c.id === panel.chapterId
            ? { ...c, lessons: [...c.lessons, lesson] } : c) } : s));
        flash(`Đã thêm bài "${lesson.title}"`);

      } else if (panel.type === "edit-lesson") {
        const vUrl = serializeUrls(ls.videoUrls);
        const zUrl = serializeUrls(ls.zoomUrls);
        const aUrl = serializeUrls(ls.azotaUrls);
        await apiPut(`/api/lessons/${panel.lessonId}`, {
          title: ls.title.trim(), type: serializeTypes(deriveTypes(ls.videoUrls, ls.zoomUrls, ls.azotaUrls)), videoUrl: vUrl, zoomUrl: zUrl, azotaUrl: aUrl,
          azotaDeadline: ls.azotaDeadline || null,
          duration: ls.duration || null, isLocked: ls.isLocked, isFree: ls.isFree,
          documents: ls.documentsRaw || "[]", adminNote: ls.adminNote || null,
        });
        setSections(p => p.map(s => s.id === panel.sectionId
          ? { ...s, chapters: s.chapters.map(c => c.id === panel.chapterId
            ? { ...c, lessons: c.lessons.map(l => l.id === panel.lessonId
              ? { ...l, title: ls.title.trim(), type: serializeTypes(deriveTypes(ls.videoUrls, ls.zoomUrls, ls.azotaUrls)) as LessonDB["type"], videoUrl: vUrl,
                  zoomUrl: zUrl, azotaUrl: aUrl, azotaDeadline: ls.azotaDeadline || null,
                  duration: ls.duration || null, isLocked: ls.isLocked, isFree: ls.isFree,
                  documents: ls.documentsRaw || "[]", adminNote: ls.adminNote || null }
              : l) }
            : c) }
          : s));
        flash("Đã cập nhật bài học");
      }

      setPanel({ type: "none" });
    } catch (e) {
      alert("Lỗi: " + (e instanceof Error ? e.message : "Unknown"));
    } finally {
      setSaving(false);
    }
  }

  // ── Delete (calls API) ──
  async function delConfirm() {
    if (!del) return;
    try {
      if (del.kind === "section") {
        const res = await fetch(`/api/sections/${del.sectionId}`, { method: "DELETE" });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? `Lỗi ${res.status}`); }
        setSections(p => p.filter(s => s.id !== del.sectionId));
      } else if (del.kind === "chapter") {
        const res = await fetch(`/api/chapters/${del.chapterId}`, { method: "DELETE" });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? `Lỗi ${res.status}`); }
        setSections(p => p.map(s => s.id === del.sectionId
          ? { ...s, chapters: s.chapters.filter(c => c.id !== del.chapterId) } : s));
      } else if (del.kind === "lesson") {
        const res = await fetch(`/api/lessons/${del.lessonId}`, { method: "DELETE" });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? `Lỗi ${res.status}`); }
        setSections(p => p.map(s => s.id === del.sectionId
          ? { ...s, chapters: s.chapters.map(c => c.id === del.chapterId
            ? { ...c, lessons: c.lessons.filter(l => l.id !== del.lessonId) } : c) }
          : s));
      }
      flash("Đã xoá thành công");
    } catch (e) {
      alert("Lỗi: " + (e instanceof Error ? e.message : "Unknown"));
    } finally {
      setDel(null);
    }
  }

  async function toggleLessonLock(sectionId: string, chapterId: string, lessonId: string, current: boolean) {
    const s = sections.find(x => x.id === sectionId)!;
    const c = s.chapters.find(x => x.id === chapterId)!;
    const l = c.lessons.find(x => x.id === lessonId)!;
    await fetch(`/api/lessons/${lessonId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isLocked: !current }),
    }).catch(() => {});
    setSections(p => p.map(sec => sec.id !== sectionId ? sec : {
      ...sec, chapters: sec.chapters.map(ch => ch.id !== chapterId ? ch : {
        ...ch, lessons: ch.lessons.map(le => le.id !== lessonId ? le : { ...le, isLocked: !current }),
      }),
    }));
    void l;
  }

  const panelIsOpen = panel.type !== "none";
  const isTitlePanel = panel.type.includes("section") || panel.type.includes("chapter");
  const isLsPanel    = panel.type.includes("lesson");
  const panelTitle   = {
    "add-section":    "Thêm phần mới",
    "edit-section":   "Sửa phần",
    "add-chapter":    "Thêm chương mới",
    "edit-chapter":   "Sửa chương",
    "add-lesson":     "Thêm bài học",
    "edit-lesson":    "Sửa bài học",
    none: "",
  }[panel.type];

  const totals = { ch: sections.reduce((a, s) => a + s.chapters.length, 0), ls: sections.reduce((a, s) => a + s.chapters.reduce((b, c) => b + c.lessons.length, 0), 0) };

  return (
    <div>
      <Drawer open={panelIsOpen} title={panelTitle} onClose={() => setPanel({ type: "none" })} onSave={savePanel} saving={saving}>
        {isTitlePanel && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <span className="text-red-500 mr-0.5">*</span>
              {panel.type.includes("section") ? "Tên phần" : "Tên chương"}
            </label>
            <input className={inp} value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && savePanel()}
              placeholder={panel.type.includes("section") ? "VD: PHẦN 1: TƯ DUY ĐỊNH LƯỢNG" : "VD: Chương 1: Đại số cơ bản"} />
          </div>
        )}
        {isLsPanel && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5"><span className="text-red-500 mr-0.5">*</span>Tên bài học</label>
              <input className={inp} value={ls.title}
                onChange={e => setLs(f => ({ ...f, title: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && savePanel()}
                placeholder="VD: Buổi 1: Hệ phương trình" />
            </div>
            <DrawerToggle checked={ls.isLocked} onChange={() => setLs(f => ({ ...f, isLocked: !f.isLocked }))} label="Khoá bài (yêu cầu đăng ký)" />
            <DrawerToggle checked={ls.isFree} onChange={() => setLs(f => ({ ...f, isFree: !f.isFree }))} label="Học thử miễn phí" />
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3 pb-1 border-b border-gray-100">Video & Links</p>
              <div className="space-y-4">
                <UrlListEditor
                  label="YouTube URL (cho bài Video)"
                  placeholder="https://youtube.com/watch?v=..."
                  urls={ls.videoUrls}
                  onChange={urls => setLs(f => ({ ...f, videoUrls: urls }))}
                />
                <UrlListEditor
                  label="Zoom URL (cho bài Live)"
                  placeholder="https://zoom.us/j/..."
                  urls={ls.zoomUrls}
                  onChange={urls => setLs(f => ({ ...f, zoomUrls: urls }))}
                />
                <UrlListEditor
                  label="Azota URL (cho bài Tập)"
                  placeholder="https://azota.vn/..."
                  urls={ls.azotaUrls}
                  onChange={urls => setLs(f => ({ ...f, azotaUrls: urls }))}
                />
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="text-xs text-gray-400">Loại bài:</span>
                  {deriveTypes(ls.videoUrls, ls.zoomUrls, ls.azotaUrls).map(t => {
                    const tb = TYPE_BADGE[t];
                    return <span key={t} className="px-2 py-0.5 text-xs rounded-full font-semibold" style={{ background: tb.bg, color: tb.color }}>{tb.label}</span>;
                  })}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Deadline Azota</label>
                  <input type="datetime-local" className={inp} value={ls.azotaDeadline} onChange={e => setLs(f => ({ ...f, azotaDeadline: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Thời lượng (VD: 45:00)</label>
                  <input className={inp} value={ls.duration} onChange={e => setLs(f => ({ ...f, duration: e.target.value }))} placeholder="45:00" />
                </div>
              </div>
            </div>
            <DocumentsEditor
              value={ls.documentsRaw}
              onChange={v => setLs(f => ({ ...f, documentsRaw: v }))}
            />
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2 pb-1 border-b border-gray-100">
                Ghi chú cho học viên
              </p>
              <p className="text-xs text-gray-400 mb-2">Lưu ý, hướng dẫn, hoặc thông báo hiển thị với học viên khi xem bài này.</p>
              <textarea
                className={inp + " resize-none"}
                rows={4}
                placeholder="VD: Học viên cần đọc lý thuyết chương 3 trước khi làm bài này. Nộp bài trước 23:59 ngày 31/05."
                value={ls.adminNote}
                onChange={e => setLs(f => ({ ...f, adminNote: e.target.value }))}
              />
            </div>
          </>
        )}
      </Drawer>

      <DelModal target={del} onClose={() => setDel(null)} onConfirm={delConfirm} />

      {toast && (
        <div className="mb-4 px-4 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center gap-2" style={{ background: "#16a34a" }}>
          <svg viewBox="0 0 10 8" className="w-4 h-4 flex-shrink-0"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">{sections.length} phần · {totals.ch} chương · {totals.ls} bài</p>
        <button onClick={openAddSection}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
          + Thêm phần
        </button>
      </div>

      <div className="space-y-3">
        {sections.map((section, si) => (
          <div key={section.id || `s-${si}`}
            className="border rounded-xl overflow-hidden transition-colors"
            style={{
              borderColor: dragOverKey === `s-${section.id}` ? "#16a34a" : "#e5e7eb",
              boxShadow: dragItem?.type === "section" && dragItem.sectionIdx === si ? "0 4px 16px rgba(0,0,0,0.12)" : undefined,
            }}
            draggable
            onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; setDragItem({ type: "section", sectionIdx: si }); }}
            onDragOver={e => { e.preventDefault(); e.stopPropagation(); if (dragItem?.type === "section") setDragOverKey(`s-${section.id}`); }}
            onDrop={e => {
              e.preventDefault(); e.stopPropagation();
              if (dragItem?.type === "section" && dragItem.sectionIdx !== si) reorderSections(dragItem.sectionIdx, si);
              setDragItem(null); setDragOverKey(null);
            }}
            onDragEnd={() => { setDragItem(null); setDragOverKey(null); }}
          >
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: "#f0fdf4" }}>
              <DragHandle />
              <button onClick={() => toggleSec(section.id)} className="text-green-700 text-xs flex-shrink-0">
                {expanded.sections.has(section.id) ? "▼" : "▶"}
              </button>
              <span className="text-sm font-bold flex-1 min-w-0 truncate" style={{ color: "#166534" }}>{section.title}</span>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => openAddChapter(section.id)} className="px-2.5 py-1 text-xs rounded-lg font-medium" style={{ background: "#16a34a", color: "white" }}>+ Chương</button>
                <button onClick={() => openEditSection(section.id)} className="px-2.5 py-1 text-xs rounded-lg font-medium border border-gray-300 text-gray-600 hover:bg-gray-50">Sửa</button>
                <button onClick={() => setDel({ kind: "section", sectionId: section.id, label: section.title })}
                  className="px-2.5 py-1 text-xs rounded-lg font-medium border border-red-200 text-red-500 hover:bg-red-50">Xóa</button>
              </div>
            </div>

            {expanded.sections.has(section.id) && (
              <div>
                {section.chapters.length === 0 && (
                  <div className="px-6 py-5 text-center">
                    <p className="text-sm text-gray-400 mb-1">Chưa có chương nào.</p>
                    <button onClick={() => openAddChapter(section.id)} className="text-sm text-green-600 hover:underline font-medium">+ Thêm chương đầu tiên</button>
                  </div>
                )}
                {section.chapters.map((chapter, ci) => (
                  <div key={chapter.id || `${section.id}-c-${ci}`}
                    className="border-t border-gray-100 transition-colors"
                    style={{ background: dragOverKey === `c-${chapter.id}` ? "#EFF6FF" : undefined }}
                    draggable
                    onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; setDragItem({ type: "chapter", sectionIdx: si, chapterIdx: ci }); }}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); if (dragItem?.type === "chapter") setDragOverKey(`c-${chapter.id}`); }}
                    onDrop={e => {
                      e.preventDefault(); e.stopPropagation();
                      if (dragItem?.type === "chapter" && dragItem.sectionIdx === si && dragItem.chapterIdx !== ci) reorderChapters(si, dragItem.chapterIdx, ci);
                      setDragItem(null); setDragOverKey(null);
                    }}
                    onDragEnd={() => { setDragItem(null); setDragOverKey(null); }}
                  >
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 transition-colors">
                      <DragHandle />
                      <button onClick={() => toggleCh(chapter.id)} className="text-gray-400 text-xs flex-shrink-0">
                        {expanded.chapters.has(chapter.id) ? "▼" : "▶"}
                      </button>
                      <span className="text-sm font-semibold text-gray-800 flex-1 min-w-0 truncate">{chapter.title}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{chapter.lessons.length} bài</span>
                      <button onClick={() => openEditChapter(section.id, chapter.id)} className="p-1 text-gray-400 hover:text-blue-600 text-xs transition-colors">Sửa</button>
                      <button onClick={() => setDel({ kind: "chapter", sectionId: section.id, chapterId: chapter.id, label: chapter.title })}
                        className="p-1 text-red-300 hover:text-red-500 text-xs transition-colors">Xóa</button>
                    </div>
                    {expanded.chapters.has(chapter.id) && (
                      <div>
                        {chapter.lessons.length === 0 && (
                          <div className="px-10 py-3 text-center">
                            <span className="text-xs text-gray-400">Chưa có bài học. </span>
                            <button onClick={() => openAddLesson(section.id, chapter.id)} className="text-xs text-blue-500 hover:underline font-medium">Thêm bài đầu tiên</button>
                          </div>
                        )}
                        {chapter.lessons.map((lesson, li) => {
                          const lessonTypes = parseTypes(lesson.type);
                          return (
                            <div key={lesson.id || `${chapter.id}-l-${li}`}
                              className="flex items-center gap-3 px-4 py-2.5 transition-colors"
                              style={{
                                borderTop: "1px dashed #e5e7eb",
                                background: dragOverKey === `l-${lesson.id}` ? "#F0FDF4" : undefined,
                              }}
                              draggable
                              onDragStart={e => { e.stopPropagation(); e.dataTransfer.effectAllowed = "move"; setDragItem({ type: "lesson", sectionIdx: si, chapterIdx: ci, lessonIdx: li }); }}
                              onDragOver={e => { e.preventDefault(); e.stopPropagation(); if (dragItem?.type === "lesson") setDragOverKey(`l-${lesson.id}`); }}
                              onDrop={e => {
                                e.preventDefault(); e.stopPropagation();
                                if (dragItem?.type === "lesson" && dragItem.sectionIdx === si && dragItem.chapterIdx === ci && dragItem.lessonIdx !== li) reorderLessons(si, ci, dragItem.lessonIdx, li);
                                setDragItem(null); setDragOverKey(null);
                              }}
                              onDragEnd={() => { setDragItem(null); setDragOverKey(null); }}
                            >
                              <DragHandle />
                              <span className="flex-1 text-sm font-medium text-gray-800 min-w-0 truncate">{lesson.title}</span>
                              {lesson.isFree && <span className="px-1.5 py-0.5 text-xs rounded font-medium flex-shrink-0" style={{ background: "#DCFCE7", color: "#166534" }}>FREE</span>}
                              {lesson.videoUrl && <span className="px-1.5 py-0.5 text-xs rounded font-medium flex-shrink-0" style={{ background: "#DBEAFE", color: "#1D4ED8" }}>YT</span>}
                              {lesson.duration && <span className="text-xs text-gray-400 flex-shrink-0">{lesson.duration}</span>}
                              {lessonTypes.map(t => { const tb = TYPE_BADGE[t] ?? TYPE_BADGE.record; return <span key={t} className="px-2 py-0.5 text-xs rounded-full font-medium flex-shrink-0" style={{ background: tb.bg, color: tb.color }}>{tb.label}</span>; })}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => toggleLessonLock(section.id, chapter.id, lesson.id, lesson.isLocked)}
                                  className="p-1.5 rounded hover:bg-blue-50 transition-colors"
                                  title={lesson.isLocked ? "Mở khoá" : "Khoá bài"}
                                  style={{ color: lesson.isLocked ? "#9CA3AF" : "#0055D4" }}>
                                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                                    <rect x="3" y="7.5" width="10" height="6.5" rx="1.2"/>
                                    <path d={lesson.isLocked ? "M5.5 7.5V5.5a2.5 2.5 0 015 0v2" : "M5.5 7.5V5.5a2.5 2.5 0 015 0"}/>
                                  </svg>
                                </button>
                                <button onClick={() => openEditLesson(section.id, chapter.id, lesson.id)}
                                  className="p-1.5 rounded hover:bg-blue-50 transition-colors" title="Sửa" style={{ color: "#0055D4" }}>
                                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 2l3 3-8 8H3v-3z"/>
                                  </svg>
                                </button>
                                <button onClick={() => setDel({ kind: "lesson", sectionId: section.id, chapterId: chapter.id, lessonId: lesson.id, label: lesson.title })}
                                  className="p-1.5 rounded hover:bg-red-50 transition-colors" title="Xoá" style={{ color: "#EF4444" }}>
                                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M3 4.5h10M6 4.5V3h4v1.5M5.5 4.5v7.5a1 1 0 001 1h3a1 1 0 001-1V4.5"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        <div className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ borderTop: "1px dashed #e5e7eb", background: "#fafafa" }}>
                          <button onClick={() => openAddLesson(section.id, chapter.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white" style={{ background: "#16a34a" }}>
                            + Thêm bài học
                          </button>
                          <button onClick={() => openAddChapter(section.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white" style={{ background: "#16a34a" }}>
                            + Thêm chương
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4">
        <button onClick={openAddSection}
          className="w-full py-2.5 rounded-xl text-sm font-semibold border-2 border-dashed border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-600 transition-colors">
          + Thêm phần mới
        </button>
      </div>
    </div>
  );
}

// ─── TAB HỌC VIÊN KHOÁ HỌC ───────────────────────────────────────────────────
interface CourseStudent {
  userId: string; name: string; email: string;
  phone?: string | null; school?: string | null;
  enrolledAt: string; completed: number; totalLessons: number; progress: number;
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
          <div className="flex gap-1.5">
            {[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full animate-bounce bg-blue-400" style={{ animationDelay: `${i*0.15}s` }} />)}
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-gray-400 text-sm">
          {total === 0 ? "Chưa có học viên nào đăng ký khoá học này." : "Không tìm thấy học viên."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["Học viên","Email","SĐT","Trường","Tiến độ","Ngày đăng ký"].map(h => (
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
                        style={{ background: "linear-gradient(145deg,#0055D4,#0042AA)" }}>
                        {s.name[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-800">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.email}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.phone || "—"}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{s.school || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-200 min-w-[60px]">
                        <div className="h-1.5 rounded-full" style={{ width: `${s.progress}%`, background: s.progress >= 80 ? "#16a34a" : s.progress >= 40 ? "#f59e0b" : "#0068FF" }} />
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

// ─── PAGE ─────────────────────────────────────────────────────────────────────
const TABS: { id: TabId; label: string }[] = [
  { id: "cai-dat",    label: "Cài đặt" },
  { id: "chuong-bai", label: "Danh sách chương bài" },
  { id: "hoc-vien",   label: "Học viên đăng ký" },
];

export default function KhoaHocDetailPage() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const router       = useRouter();
  const courseSlug   = params.id as string;
  const rawTab       = searchParams.get("tab");
  const activeTab: TabId = (rawTab && TABS.some(t => t.id === rawTab) ? rawTab : "cai-dat") as TabId;
  function setTab(tab: TabId) { router.push(`/admin/khoa-hoc/${courseSlug}?tab=${tab}`); }

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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-gray-500">Đang tải khoá học...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
        <p className="text-red-500 font-semibold mb-2">Không tìm thấy khoá học</p>
        <Link href="/admin/khoa-hoc" className="text-sm text-blue-600 hover:underline">← Quay lại danh sách</Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col" style={{ minHeight: "calc(100vh - 130px)" }}>
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <p className="text-sm text-gray-500">
          Bảng điều khiển /{" "}
          <Link href="/admin/khoa-hoc" className="hover:text-blue-600 transition-colors">Danh sách khoá học</Link>
          {" "}/ <span className="font-medium text-gray-800">{course.name}</span>
        </p>
      </div>

      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-start gap-4">
          <div className="w-16 h-11 rounded-lg flex items-center justify-center text-sm font-black text-white flex-shrink-0"
            style={{ background: course.bg ?? "linear-gradient(135deg,#0055D4,#0042AA)" }}>ME</div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-gray-800 leading-tight">{course.name}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              ID: {course.adminId} · Slug: {course.id} · {course.category}
            </p>
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200">
        <div className="flex overflow-x-auto">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setTab(tab.id)}
              className="px-5 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2"
              style={activeTab === tab.id
                ? { color: "#16a34a", borderColor: "#16a34a" }
                : { color: "#6b7280", borderColor: "transparent" }}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 flex-1">
        {activeTab === "cai-dat"    && <TabCaiDat courseSlug={courseSlug} course={course} />}
        {activeTab === "chuong-bai" && <TabChuongBai courseSlug={courseSlug} initialSections={course.sections} />}
        {activeTab === "hoc-vien"   && <TabHocVienKhoaHoc courseSlug={courseSlug} />}
      </div>
    </div>
  );
}
