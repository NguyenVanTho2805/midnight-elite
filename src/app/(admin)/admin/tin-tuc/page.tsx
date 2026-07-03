"use client";

import { useState, useMemo, useEffect, useCallback, useRef, Suspense } from "react";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { Toggle } from "@/components/Toggle";
import { toSlug } from "@/lib/slug";

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface ApiArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  author: string;
  tag: string | null;
  isPinned: boolean;
  published: boolean;
  readTime: number;
  views: number;
  publishedAt: string | null;
  createdAt: string;
}

interface DrawerForm {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  tag: string;
  isPinned: boolean;
  published: boolean;
  readTime: number;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "hoc-thuat",    label: "Học thuật"          },
  { value: "tuyen-sinh",   label: "Tuyển sinh"         },
  { value: "tin-midnight", label: "Tin Midnight Elite" },
  { value: "kinh-nghiem",  label: "Kinh nghiệm thi"   },
];

const CAT_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.label])
);

const CAT_COLOR: Record<string, { bg: string; color: string }> = {
  "hoc-thuat":   { bg: "#dbeafe", color: "#0068FF" },
  "tuyen-sinh":  { bg: "#fee2e2", color: "#dc2626" },
  "tin-midnight":{ bg: "#dcfce7", color: "#16a34a" },
  "kinh-nghiem": { bg: "#fef3c7", color: "#b45309" },
};

const DRAWER_INIT: DrawerForm = {
  title: "", slug: "", excerpt: "", content: "",
  category: "tin-midnight", author: "", tag: "",
  isPinned: false, published: false, readTime: 5,
};

const INP = "w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200";

// ─── TOAST ────────────────────────────────────────────────────────────────────

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className="fixed top-4 right-4 z-[200] px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
      style={{ background: ok ? "#16a34a" : "#dc2626" }}>
      {ok ? "✓" : "✗"} {msg}
    </div>
  );
}

// ─── ACTION MENU ──────────────────────────────────────────────────────────────

function ActionMenu({ article, onEdit, onDelete }: {
  article: ApiArticle;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen]         = useState(false);
  const [confirmDel, setConfirm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setConfirm(false);
      }
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen(p => !p)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-blue-400 border border-blue-200 hover:bg-blue-50 transition-colors text-lg font-bold cursor-pointer"
        style={{ lineHeight: 1 }}>
        ···
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-48 rounded-lg shadow-xl border border-gray-200 bg-white py-1">
          <button onClick={() => { onEdit(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer">
            <span className="w-5 text-center">✏️</span> Chỉnh sửa
          </button>
          <a href={`/tin-tuc/${article.slug}`} target="_blank"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            <span className="w-5 text-center">🔗</span> Xem trước
          </a>
          <div className="border-t border-gray-100 my-1" />
          {confirmDel ? (
            <div className="px-4 py-2.5">
              <p className="text-xs text-red-600 font-semibold mb-2">Xác nhận xoá?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirm(false)}
                  className="flex-1 py-1.5 rounded text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer">
                  Huỷ
                </button>
                <button onClick={() => { onDelete(); setOpen(false); setConfirm(false); }}
                  className="flex-1 py-1.5 rounded text-xs font-semibold text-white cursor-pointer"
                  style={{ background: "#dc2626" }}>
                  Xoá
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirm(true)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors cursor-pointer">
              <span className="w-5 text-center">🗑</span> Xoá
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ARTICLE DRAWER ───────────────────────────────────────────────────────────

function ArticleDrawer({ open, editId, initialForm, onClose, onSaved }: {
  open: boolean;
  editId: string | null;
  initialForm: DrawerForm;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm]     = useState<DrawerForm>(DRAWER_INIT);
  const [errors, setErrors] = useState<Partial<Record<keyof DrawerForm, string>>>({});
  const [saving, setSaving] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initialForm);
      setErrors({});
      setSaving(false);
      setSlugEdited(!!editId);
    }
  }, [open, initialForm, editId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set<K extends keyof DrawerForm>(k: K, v: DrawerForm[K]) {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: undefined }));
  }

  function handleTitleChange(v: string) {
    set("title", v);
    if (!slugEdited) set("slug", toSlug(v));
  }

  function validate(): boolean {
    const e: Partial<Record<keyof DrawerForm, string>> = {};
    if (!form.title.trim())    e.title    = "Tiêu đề không được để trống";
    if (!form.slug.trim())     e.slug     = "Slug không được để trống";
    if (!form.excerpt.trim())  e.excerpt  = "Tóm tắt không được để trống";
    if (!form.content.trim())  e.content  = "Nội dung không được để trống";
    if (!form.category.trim()) e.category = "Chọn danh mục";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const url    = editId ? `/api/admin/articles/${editId}` : "/api/admin/articles";
      const method = editId ? "PATCH" : "POST";
      const res    = await fetch(url, {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Lỗi server");
      onSaved();
      onClose();
    } catch (err) {
      setErrors(p => ({ ...p, title: (err as Error).message }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.3)" }} onClick={onClose} />}
      <div className="fixed top-0 right-0 bottom-0 z-50 bg-white overflow-y-auto shadow-2xl"
        style={{
          width: "min(600px, 100vw)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
          pointerEvents: open ? "auto" : "none",
          visibility: open ? "visible" : "hidden",
        }}>

        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-xl font-light cursor-pointer">
              ×
            </button>
            <h2 className="text-base font-bold text-gray-800">
              {editId ? "Chỉnh sửa bài viết" : "Thêm bài viết mới"}
            </h2>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
              Huỷ
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 cursor-pointer"
              style={{ background: "#0068FF" }}>
              {saving ? "Đang lưu..." : editId ? "Cập nhật" : "Tạo bài viết"}
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">

          {/* Tiêu đề */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Tiêu đề <span className="text-red-500">*</span>
            </label>
            <input className={INP} placeholder="VD: ĐGNL HSA 2026 có gì mới?"
              value={form.title} onChange={e => handleTitleChange(e.target.value)} />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
          </div>

          {/* Slug */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Slug (URL) <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 whitespace-nowrap">/tin-tuc/</span>
              <input className={INP} placeholder="vd-dgnl-hsa-2026"
                value={form.slug}
                onChange={e => { setSlugEdited(true); set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }} />
            </div>
            {errors.slug && <p className="text-xs text-red-500 mt-1">{errors.slug}</p>}
          </div>

          {/* Category + Tag + ReadTime row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Danh mục <span className="text-red-500">*</span>
              </label>
              <select className={INP + " bg-white"} value={form.category}
                onChange={e => set("category", e.target.value)}>
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Thẻ (tag)</label>
              <input className={INP} placeholder="VD: Nổi bật, Hot, Mới"
                value={form.tag} onChange={e => set("tag", e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Thời gian đọc (phút)</label>
              <input className={INP} type="number" min={1} max={60}
                value={form.readTime} onChange={e => set("readTime", Number(e.target.value))} />
            </div>
          </div>

          {/* Author */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Tác giả</label>
            <input className={INP} placeholder="VD: Thầy Minh, Ban biên tập"
              value={form.author} onChange={e => set("author", e.target.value)} />
          </div>

          {/* Excerpt */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Tóm tắt <span className="text-red-500">*</span>
              <span className="ml-2 font-normal text-gray-400">(tối đa 250 ký tự)</span>
            </label>
            <textarea rows={3} maxLength={250}
              className={INP + " resize-none"}
              placeholder="Mô tả ngắn về bài viết, hiển thị trên trang danh sách"
              value={form.excerpt} onChange={e => set("excerpt", e.target.value)} />
            <p className="text-right text-xs text-gray-400 mt-0.5">{form.excerpt.length}/250</p>
            {errors.excerpt && <p className="text-xs text-red-500 mt-1">{errors.excerpt}</p>}
          </div>

          {/* Content */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Nội dung <span className="text-red-500">*</span>
              <span className="ml-2 font-normal text-gray-400">(xuống dòng 2 lần = đoạn mới)</span>
            </label>
            <textarea rows={16}
              className={INP + " resize-y font-mono text-xs leading-relaxed"}
              placeholder={"Viết nội dung bài viết ở đây...\n\nXuống dòng hai lần để tạo đoạn văn mới.\nXuống dòng một lần để xuống dòng trong đoạn."}
              value={form.content} onChange={e => set("content", e.target.value)} />
            {errors.content && <p className="text-xs text-red-500 mt-1">{errors.content}</p>}
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 px-4 rounded-lg"
              style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
              <div>
                <p className="text-sm font-medium text-gray-700">Ghim bài viết</p>
                <p className="text-xs text-gray-400">Hiển thị nổi bật đầu trang</p>
              </div>
              <Toggle checked={form.isPinned} onChange={() => set("isPinned", !form.isPinned)} />
            </div>
            <div className="flex items-center justify-between py-3 px-4 rounded-lg"
              style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
              <div>
                <p className="text-sm font-medium text-gray-700">Xuất bản</p>
                <p className="text-xs text-gray-400">Tắt để lưu nháp, không hiển thị công khai</p>
              </div>
              <Toggle checked={form.published} onChange={() => set("published", !form.published)} />
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

// ─── PAGE INNER ───────────────────────────────────────────────────────────────

function PageInner() {
  const { user } = useAuth();

  const [articles, setArticles]   = useState<ApiArticle[]>([]);
  const [loading, setLoading]     = useState(true);
  const [drawerOpen, setDrawer]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [drawerForm, setDrawerForm] = useState<DrawerForm>(DRAWER_INIT);
  const [search, setSearch]       = useState("");
  const [catFilter, setCat]       = useState("");
  const [statusFilter, setStatus] = useState("");
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch("/api/admin/articles", { credentials: "same-origin" })
        .then(r => r.ok ? r.json() : []) as ApiArticle[];
      setArticles(Array.isArray(data) ? data : []);
    } catch {
      showToast("Lỗi tải dữ liệu", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  function openCreate() {
    setEditId(null);
    setDrawerForm({ ...DRAWER_INIT, author: user?.name ?? "Admin" });
    setDrawer(true);
  }

  function openEdit(a: ApiArticle) {
    setEditId(a.id);
    fetch(`/api/admin/articles/${a.id}`, { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setDrawerForm({
            title:    data.title    ?? "",
            slug:     data.slug     ?? "",
            excerpt:  data.excerpt  ?? "",
            content:  data.content  ?? "",
            category: data.category ?? "tin-midnight",
            author:   data.author   ?? "",
            tag:      data.tag      ?? "",
            isPinned: data.isPinned ?? false,
            published:data.published ?? false,
            readTime: data.readTime ?? 5,
          });
          setDrawer(true);
        }
      });
  }

  async function handleTogglePublish(a: ApiArticle) {
    try {
      await fetch(`/api/admin/articles/${a.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !a.published }),
      });
      await loadData();
      showToast(a.published ? "Đã chuyển về nháp" : "Đã xuất bản");
    } catch {
      showToast("Lỗi cập nhật", false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/admin/articles/${id}`, { method: "DELETE", credentials: "same-origin" });
      await loadData();
      showToast("Đã xoá bài viết");
    } catch {
      showToast("Lỗi xoá", false);
    }
  }

  const filtered = useMemo(() => articles.filter(a => {
    if (search && !a.title.toLowerCase().includes(search.toLowerCase()) &&
        !a.author.toLowerCase().includes(search.toLowerCase())) return false;
    if (catFilter && a.category !== catFilter) return false;
    if (statusFilter === "published" && !a.published) return false;
    if (statusFilter === "draft"     &&  a.published) return false;
    return true;
  }), [articles, search, catFilter, statusFilter]);

  return (
    <>
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      <ArticleDrawer
        open={drawerOpen}
        editId={editId}
        initialForm={drawerForm}
        onClose={() => setDrawer(false)}
        onSaved={() => { loadData(); showToast(editId ? "Đã cập nhật bài viết" : "Đã tạo bài viết"); }}
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-w-0"
        style={{ height: "calc(100vh - 104px)" }}>

        {/* Breadcrumb */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <p className="text-sm text-gray-500">
            Bảng điều khiển / <span className="font-medium text-gray-800">Tin tức & Blog</span>
          </p>
        </div>

        {/* Filters */}
        <div className="px-5 pt-4 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-b border-gray-100 flex-shrink-0">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tìm kiếm</label>
            <input type="text" placeholder="Tiêu đề, tác giả..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Danh mục</label>
            <select value={catFilter} onChange={e => setCat(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none bg-white focus:border-blue-400">
              <option value="">Tất cả danh mục</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Trạng thái</label>
            <select value={statusFilter} onChange={e => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none bg-white focus:border-blue-400">
              <option value="">Tất cả</option>
              <option value="published">Đã xuất bản</option>
              <option value="draft">Nháp</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button onClick={() => { setSearch(""); setCat(""); setStatus(""); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
              ↺ Làm mới
            </button>
            <button onClick={openCreate}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer"
              style={{ background: "#0068FF" }}>
              + Thêm bài viết
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["Bài viết", "Danh mục", "Tác giả", "Xuất bản", "Lượt xem", "Ngày tạo", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {[280, 120, 100, 80, 60, 90, 50].map((w, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 rounded bg-gray-200" style={{ width: w }} />
                    </td>
                  ))}
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <p className="text-gray-400 text-sm font-medium">
                      {articles.length === 0 ? "Chưa có bài viết nào" : "Không tìm thấy bài viết"}
                    </p>
                    {articles.length === 0 && (
                      <button onClick={openCreate}
                        className="mt-3 text-sm font-semibold cursor-pointer"
                        style={{ color: "#0068FF" }}>
                        + Thêm bài viết đầu tiên
                      </button>
                    )}
                  </td>
                </tr>
              )}
              {!loading && filtered.map(a => {
                const cat = CAT_COLOR[a.category] ?? { bg: "#f6f5f4", color: "#787671" };
                return (
                  <tr key={a.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 max-w-[300px]">
                      <div className="flex items-start gap-2">
                        {a.isPinned && (
                          <span className="text-xs mt-0.5 flex-shrink-0" title="Ghim">📌</span>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-800 leading-snug line-clamp-2">{a.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5 font-mono truncate">/tin-tuc/{a.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-semibold px-2 py-1 rounded-full"
                        style={{ background: cat.bg, color: cat.color }}>
                        {CAT_LABEL[a.category] ?? a.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm whitespace-nowrap">{a.author}</td>
                    <td className="px-4 py-3">
                      <Toggle checked={a.published} onChange={() => handleTogglePublish(a)} />
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-sm text-right whitespace-nowrap">
                      {a.views.toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {a.createdAt.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ActionMenu
                        article={a}
                        onEdit={() => openEdit(a)}
                        onDelete={() => handleDelete(a.id)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Hiển thị {filtered.length}/{articles.length} bài viết
          </p>
          <p className="text-xs text-gray-400">
            {articles.filter(a => a.published).length} đã xuất bản ·{" "}
            {articles.filter(a => !a.published).length} nháp
          </p>
        </div>
      </div>
    </>
  );
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────

export default function TinTucAdminPage() {
  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_NEWS}>
      <Suspense>
        <PageInner />
      </Suspense>
    </PermissionGuard>
  );
}
