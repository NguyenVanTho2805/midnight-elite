"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Toggle } from "@/components/Toggle";
import { toSlug } from "@/lib/slug";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface Category {
  id: number;
  name: string;
  courseCount: number;
}

type DrawerMode =
  | { type: "none" }
  | { type: "add" }
  | { type: "edit"; cat: Category };

async function safeFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try { data = text ? JSON.parse(text) : {}; } catch { /* empty */ }
  return { ok: res.ok, status: res.status, data };
}

// ─── DELETE CONFIRM MODAL ────────────────────────────────────────────────────
function DelModal({ name, onClose, onConfirm }: {
  name: string; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="text-center mb-4">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#FEF2F2" }}>
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#DC2626" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h2 className="text-base font-bold text-gray-800 mb-1">Xoá danh mục?</h2>
          <p className="text-sm text-gray-500">
            Bạn sắp xoá <strong className="text-gray-700">"{name}"</strong>. Hành động này không thể hoàn tác.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
            Huỷ
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ background: "#dc2626" }}>
            Xoá
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DRAWER ───────────────────────────────────────────────────────────────────
function CategoryDrawer({ mode, onClose, onSave, saving }: {
  mode: DrawerMode;
  onClose: () => void;
  onSave: (name: string) => void;
  saving: boolean;
}) {
  const open = mode.type !== "none";
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    if (mode.type === "edit") setName(mode.cat.name);
    else setName("");
    // Focus input after open animation (no autoFocus to avoid scroll hijack)
    if (mode.type !== "none") {
      const t = setTimeout(() => inputRef.current?.focus(), 320);
      return () => clearTimeout(t);
    }
  }, [mode]);

  // Escape key closes drawer
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && mode.type !== "none") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mode, onClose]);

  const title = mode.type === "add" ? "Thêm danh mục mới" :
                mode.type === "edit" ? "Chỉnh sửa danh mục" : "";

  const inp = "w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200";

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: "rgba(0,0,0,0.3)" }}
          onClick={onClose}
        />
      )}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 bg-white overflow-y-auto shadow-2xl"
        style={{
          width: "min(440px, 100vw)",
          transform: open ? "translateX(0)" : "translateX(110%)",
          transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
          pointerEvents: open ? "auto" : "none",
          visibility: open ? "visible" : "hidden",
        }}>
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-xl font-light">
              ×
            </button>
            <h2 className="text-base font-bold text-gray-800">{title}</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
              Huỷ
            </button>
            <button
              disabled={!name.trim() || saving}
              onClick={() => name.trim() && onSave(name.trim())}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
              style={{ background: "#16a34a" }}>
              {saving ? "Đang lưu…" : "Lưu"}
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Tên danh mục <span className="text-red-500">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="VD: ĐGNL HSA"
              className={inp}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Slug (tự động)</label>
            <div className="px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-500 font-mono">
              {toSlug(name) || "—"}
            </div>
          </div>
          {mode.type === "add" && (
            <div className="p-3 rounded-lg border border-blue-200 bg-blue-50">
              <p className="text-xs text-blue-700">
                Danh mục được tạo tự động từ khoá học. Để kích hoạt chính thức: tạo khoá học mới và nhập tên danh mục này trong form.
              </p>
            </div>
          )}
          {mode.type === "edit" && (
            <div className="p-3 rounded-lg border border-yellow-200 bg-yellow-50">
              <p className="text-xs text-yellow-700">
                Đổi tên danh mục sẽ cập nhật tất cả khoá học đang dùng danh mục này.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── ACTION MENU ─────────────────────────────────────────────────────────────
function ActionMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-blue-400 border border-blue-200 hover:bg-blue-50 transition-colors text-lg font-bold cursor-pointer"
        style={{ lineHeight: 1 }}>
        ···
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-44 rounded-lg shadow-xl border border-gray-200 bg-white py-1">
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors text-left cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Chỉnh sửa
          </button>
          <div className="my-1 border-t border-gray-100" />
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Xoá
          </button>
        </div>
      )}
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
export default function DanhMucPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading]       = useState(true);
  const [apiError, setApiError]     = useState("");
  const [search, setSearch]         = useState("");
  const [drawer, setDrawer]         = useState<DrawerMode>({ type: "none" });
  const [delTarget, setDelTarget]   = useState<Category | null>(null);
  const [toast, setToast]           = useState<{ msg: string; error?: boolean } | null>(null);
  const [saving, setSaving]         = useState(false);

  function showToast(msg: string, error = false) {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 2500);
  }

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setApiError("");
    let cats: Category[] = [];
    try {
      const { ok, data } = await safeFetch("/api/categories");
      if (ok) {
        cats = (data.categories as Category[] | undefined) ?? [];
      } else {
        setApiError("Không thể tải danh mục. Vui lòng thử lại.");
      }
    } catch {
      setApiError("Lỗi kết nối. Kiểm tra server đang chạy.");
    }
    setCategories(cats);
    setLoading(false);
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const filtered = categories.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || toSlug(c.name).includes(q);
  });

  // ── Save (add or edit) ─────────────────────────────────────────────────────
  const handleSave = useCallback(async (newName: string) => {
    setSaving(true);
    if (drawer.type === "add") {
      // Category không có model riêng trong DB — chỉ tồn tại khi có khoá học dùng nó
      showToast(`Tên "${newName}" đã ghi nhớ. Gán vào khoá học để kích hoạt chính thức.`);
    } else if (drawer.type === "edit") {
      const oldName = drawer.cat.name;
      const { ok } = await safeFetch("/api/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldName, newName }),
      });
      if (ok) {
        setCategories(prev =>
          prev.map(c => c.name === oldName ? { ...c, name: newName } : c)
        );
        showToast("Đã cập nhật danh mục và đổi tên trên tất cả khoá học");
      } else {
        showToast("Lỗi khi cập nhật danh mục", true);
      }
    }
    setSaving(false);
    setDrawer({ type: "none" });
  }, [drawer]);

  // ── Delete ─────────────────────────────────────────────────────────────────
  function confirmDelete() {
    if (!delTarget) return;
    if (delTarget.courseCount > 0) {
      showToast(`Không thể xoá: còn ${delTarget.courseCount} khoá học đang dùng danh mục này`, true);
      setDelTarget(null);
      return;
    }
    setCategories(prev => prev.filter(c => c.name !== delTarget.name));
    showToast("Đã xoá danh mục");
    setDelTarget(null);
  }

  const totalCourses = categories.reduce((a, c) => a + c.courseCount, 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col min-w-0" style={{ minHeight: "calc(100vh - 130px)" }}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg"
          style={{ background: toast.error ? "#dc2626" : "#16a34a" }}>
          {toast.error ? "✗" : "✓"} {toast.msg}
        </div>
      )}

      {/* Delete confirm */}
      {delTarget && (
        <DelModal
          name={delTarget.name}
          onClose={() => setDelTarget(null)}
          onConfirm={confirmDelete}
        />
      )}

      {/* Drawer */}
      <CategoryDrawer
        mode={drawer}
        onClose={() => setDrawer({ type: "none" })}
        onSave={handleSave}
        saving={saving}
      />

      {/* Breadcrumb */}
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <p className="text-sm text-gray-500">
          Bảng điều khiển /{" "}
          <Link href="/admin/khoa-hoc" className="hover:text-blue-600 transition-colors">Danh sách khoá học</Link>
          {" "}/ <span className="font-medium text-gray-800">Danh mục khoá học</span>
        </p>
      </div>

      {/* Filters + Actions */}
      <div className="px-5 pt-4 pb-3 flex flex-wrap items-end gap-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Tìm danh mục</label>
          <input
            type="text"
            placeholder="Nhập tên hoặc slug…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={() => setSearch("")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
            ↺ Làm mới
          </button>
          <button
            onClick={loadCategories}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Tải lại
          </button>
          <button
            onClick={() => setDrawer({ type: "add" })}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer"
            style={{ background: "#16a34a" }}>
            + Thêm danh mục
          </button>
        </div>
      </div>

      {/* Error banner */}
      {apiError && (
        <div className="px-5 py-3 border-b border-red-200 bg-red-50 flex-shrink-0 flex items-center justify-between">
          <p className="text-sm text-red-600">{apiError}</p>
          <button onClick={loadCategories}
            className="text-xs font-semibold text-red-700 underline cursor-pointer">
            Thử lại
          </button>
        </div>
      )}

      {/* Info banner */}
      {!apiError && (
        <div className="px-5 py-2.5 border-b border-blue-100 bg-blue-50 flex-shrink-0">
          <p className="text-xs text-blue-600">
            Danh mục được đồng bộ từ trường <strong>category</strong> của khoá học trong cơ sở dữ liệu.
            Đổi tên danh mục sẽ cập nhật tất cả khoá học thuộc danh mục đó.
          </p>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {["#", "Tên danh mục", "Slug", "Số khoá học", "Hành động"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 w-6 bg-gray-200 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-40 bg-gray-200 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-28 bg-gray-200 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-6 w-10 bg-gray-200 rounded" /></td>
                  <td className="px-4 py-3"><div className="h-8 w-8 bg-gray-200 rounded-full" /></td>
                </tr>
              ))
            )}

            {!loading && filtered.map((cat, idx) => (
                <tr key={cat.name} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-gray-800">{cat.name}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-blue-600">{toSlug(cat.name)}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/khoa-hoc?category=${encodeURIComponent(cat.name)}`}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-bold hover:opacity-80 transition-opacity cursor-pointer"
                      style={{ background: "#F0FDF4", color: "#16a34a" }}
                      title="Xem khoá học trong danh mục">
                      {cat.courseCount}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ActionMenu
                      onEdit={() => setDrawer({ type: "edit", cat })}
                      onDelete={() => setDelTarget(cat)}
                    />
                  </td>
                </tr>
            ))}

            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="py-16 text-center text-gray-400 text-sm">
                  {search ? `Không tìm thấy danh mục nào khớp "${search}"` : "Chưa có danh mục nào"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0">
        <p className="text-xs text-gray-500">
          {categories.length} danh mục · {totalCourses} khoá học
        </p>
      </div>
    </div>
  );
}
