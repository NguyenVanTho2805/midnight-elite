"use client";

/**
 * ╔═══════════════════════════════════════════════════════════╗
 * ║         ADMIN PAGE TEMPLATE — Midnight Elite             ║
 * ║  Chuẩn từ /admin/khoa-hoc (gold standard)                ║
 * ║  Copy file này khi tạo trang admin mới.                   ║
 * ╚═══════════════════════════════════════════════════════════╝
 *
 * CHECKLIST khi dùng template:
 *  [ ] Đổi tên interface Item → tên thật (Course, Exam, Student...)
 *  [ ] Đổi API endpoint trong loadData
 *  [ ] Đổi PERMISSION phù hợp
 *  [ ] Đổi cột table header + row cells
 *  [ ] Đổi filter options từ data thật
 *  [ ] Đổi drawer form fields
 *  [ ] Đổi ActionMenu links đúng route
 */

import { useState, useMemo, useRef, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { Toggle } from "@/components/Toggle";

// ─── CONSTANTS (ngoài component — không recreate mỗi render) ─────────────────

// Số dòng mỗi trang — đặt đủ để vừa màn hình không scroll
// Tính: (height màn hình - 104px - breadcrumb - filter - actions - header - footer) / row_height
// ≈ (900 - 104 - 40 - 82 - 50 - 40 - 40) / 56 ≈ 8 dòng (desktop 1080p)
// Nếu row cao hơn (2 dòng text) thì giảm xuống 6-7
const PAGE_SIZE = 8;

// ─── TYPES ────────────────────────────────────────────────────────────────────

// Kiểu dùng trong component (UI state)
interface Item {
  id: string;          // unique key cho React
  displayId: string;   // hiển thị: slug, mã, số thứ tự
  name: string;        // tên chính (dòng 1)
  subName?: string;    // tên phụ (dòng 2, xám nhỏ)
  category: string;
  status: boolean;
  createdAt: string;
}

// Kiểu API trả về
interface ApiItem {
  id: string;
  name: string;
  adminName?: string;
  category: string;
  status: boolean;
  createdAt: string;
}

// Map API → UI
function toItem(u: ApiItem): Item {
  return {
    id:        u.id,
    displayId: u.id.slice(-6).toUpperCase(),
    name:      u.name,
    subName:   u.adminName,
    category:  u.category,
    status:    u.status,
    createdAt: u.createdAt,
  };
}

// ─── TOAST ────────────────────────────────────────────────────────────────────

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className="fixed top-4 right-4 z-[200] px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
      style={{ background: ok ? "#16a34a" : "#dc2626" }}>
      {ok ? "✓" : "✗"} {msg}
    </div>
  );
}

// ─── ACTION MENU (···) ────────────────────────────────────────────────────────
// Pattern: click-outside via mousedown, confirm xoá inline, z-50

function ActionMenu({ itemId, onDelete }: { itemId: string; onDelete: () => void }) {
  const [open, setOpen]           = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDel(false);
      }
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Nav items — đổi href và label theo trang
  const navItems = [
    { label: "Chỉnh sửa", icon: "✏️", href: `/admin/template/${itemId}` },
    // thêm nav items nếu cần
  ];

  return (
    <div ref={ref} className="relative inline-block">
      <button onClick={() => setOpen(p => !p)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-blue-400 border border-blue-200 hover:bg-blue-50 transition-colors text-lg font-bold cursor-pointer"
        style={{ lineHeight: 1 }}>
        ···
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1 w-48 rounded-lg shadow-xl border border-gray-200 bg-white py-1">
          {/* Nav links */}
          {navItems.map(item => (
            <Link key={item.label} href={item.href} onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <span className="w-5 text-center text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}

          <div className="border-t border-gray-100 my-1" />

          {/* Delete với inline confirm — không dùng window.confirm */}
          {confirmDel ? (
            <div className="px-4 py-2.5">
              <p className="text-xs text-red-600 font-semibold mb-2">Xác nhận xoá?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDel(false)}
                  className="flex-1 py-1.5 rounded text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer">
                  Huỷ
                </button>
                <button onClick={() => { onDelete(); setOpen(false); setConfirmDel(false); }}
                  className="flex-1 py-1.5 rounded text-xs font-semibold text-white cursor-pointer"
                  style={{ background: "#dc2626" }}>
                  Xoá
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDel(true)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors cursor-pointer">
              <span className="w-5 text-center">🗑</span>
              Xoá
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── DRAWER (Create / Edit) ───────────────────────────────────────────────────
// Pattern: fixed + overflow-y-auto + sticky header + visibility/pointerEvents guard
// → Cuộn độc lập, không ảnh hưởng main scroll, Escape để đóng

interface DrawerForm {
  name: string;
  category: string;
  status: boolean;
  // thêm fields
}

const DRAWER_INIT: DrawerForm = {
  name: "",
  category: "",
  status: true,
};

// Input class tái dùng trong drawer
const INP = "w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200";

function ItemDrawer({ open, onClose, onSaved }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm]     = useState<DrawerForm>(DRAWER_INIT);
  const [errors, setErrors] = useState<Partial<Record<keyof DrawerForm, string>>>({});
  const [saving, setSaving] = useState(false);

  // Reset khi đóng
  useEffect(() => {
    if (!open) { setForm(DRAWER_INIT); setErrors({}); setSaving(false); }
  }, [open]);

  // Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function set<K extends keyof DrawerForm>(k: K, v: DrawerForm[K]) {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(p => ({ ...p, [k]: undefined }));
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.name.trim()) e.name = "Tên không được để trống";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      // await api.items.create(form);
      onSaved();
      onClose();
    } catch (err) {
      alert("Lỗi: " + (err instanceof Error ? err.message : "Unknown"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Backdrop — click để đóng */}
      {open && (
        <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.3)" }} onClick={onClose} />
      )}

      {/* Drawer panel */}
      <div className="fixed top-0 right-0 bottom-0 z-50 bg-white overflow-y-auto shadow-2xl"
        style={{
          width: "min(480px, 100vw)",
          transform: open ? "translateX(0)" : "translateX(110%)",  // 110% = hoàn toàn ra ngoài
          transition: "transform 0.28s cubic-bezier(.4,0,.2,1)",
          pointerEvents: open ? "auto" : "none",   // ← quan trọng: ẩn drawer không nhận click
          visibility:    open ? "visible" : "hidden",
        }}>

        {/* ── Sticky header — không scroll mất khi form dài ─────────────── */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-xl font-light">
              ×
            </button>
            <h2 className="text-base font-bold text-gray-800">Thêm mới</h2>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors">
              Huỷ
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity cursor-pointer"
              style={{ background: "#16a34a" }}>
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </div>

        {/* ── Form body — cuộn độc lập ──────────────────────────────────── */}
        <div className="p-5 space-y-6">

          {/* Section grouping với heading */}
          <section>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Thông tin cơ bản</h3>
            <div className="space-y-4">

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Tên <span className="text-red-500">*</span>
                </label>
                <input className={INP} placeholder="VD: Tên item"
                  value={form.name} onChange={e => set("name", e.target.value)} />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Danh mục</label>
                <select className={INP + " bg-white"} value={form.category} onChange={e => set("category", e.target.value)}>
                  <option value="">— Chọn —</option>
                  <option value="a">Danh mục A</option>
                </select>
              </div>

            </div>
          </section>

          {/* Toggle trạng thái — luôn ở cuối form */}
          <div className="flex items-center justify-between py-3 px-4 rounded-lg"
            style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
            <div>
              <p className="text-sm font-medium text-gray-700">Hiển thị trên website</p>
              <p className="text-xs text-gray-400">Tắt để lưu nháp</p>
            </div>
            <Toggle checked={form.status} onChange={() => set("status", !form.status)} />
          </div>

        </div>
      </div>
    </>
  );
}

// ─── INNER PAGE ───────────────────────────────────────────────────────────────
// Tách ra để bọc Suspense cho useSearchParams (Next.js 16 requirement)

function PageInner() {
  // URL params — sync filter với URL (ví dụ: từ trang khác navigate vào với ?category=)
  const searchParams = useSearchParams();

  // ── State ──────────────────────────────────────────────────────────────────
  const [items, setItems]       = useState<Item[]>([]);
  const [loading, setLoading]   = useState(true);
  const [createOpen, setCreate] = useState(false);
  const [search, setSearch]     = useState("");
  const [catFilter, setCat]     = useState(searchParams.get("category") ?? "");
  const [statusFilter, setStatus] = useState("");
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetch("/api/template?all=1", { credentials: "same-origin" })
        .then(r => r.ok ? r.json() : []) as ApiItem[];
      setItems(data.map(toItem));
    } catch {
      showToast("Lỗi tải dữ liệu", false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Sync catFilter khi URL thay đổi (navigate từ trang khác)
  useEffect(() => { setCat(searchParams.get("category") ?? ""); }, [searchParams]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Filter — derive categories từ data thật (không hardcode) ──────────────
  const categories = useMemo(
    () => [...new Set(items.map(c => c.category))].filter(Boolean).sort(),
    [items]
  );

  const filtered = useMemo(() => items.filter(item => {
    if (search) {
      const q = search.toLowerCase();
      if (!item.name.toLowerCase().includes(q) &&
          !item.displayId.toLowerCase().includes(q) &&
          !(item.subName?.toLowerCase().includes(q)))
        return false;
    }
    if (catFilter && item.category !== catFilter) return false;
    if (statusFilter === "active"   && !item.status) return false;
    if (statusFilter === "inactive" &&  item.status) return false;
    return true;
  }), [items, search, catFilter, statusFilter]);

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      <ItemDrawer
        open={createOpen}
        onClose={() => setCreate(false)}
        onSaved={() => { loadData(); showToast("Đã tạo thành công"); }}
      />

      {/*
        ┌─────────────────────────────────────────────────────────┐
        │  CARD CHÍNH                                              │
        │  height = 100vh - 104px (topbar 56 + main padding 48)  │
        │  → không bao giờ scroll trang, luôn vừa màn hình       │
        └─────────────────────────────────────────────────────────┘
      */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col"
        style={{ height: "calc(100vh - 104px)" }}>

        {/* ── Breadcrumb ── py-3 + bg-gray-50 ─────────────────────────────── */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <p className="text-sm text-gray-500">
            Bảng điều khiển /{" "}
            <Link href="/admin" className="hover:text-blue-600 transition-colors">Admin</Link>
            {" "}/ <span className="font-medium text-gray-800">Tên trang</span>
          </p>
        </div>

        {/* ── Filters + Action ── pt-4 pb-3, grid responsive ──────────────── */}
        <div className="px-5 pt-4 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 border-b border-gray-100 flex-shrink-0">
          {/* Search */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tìm kiếm</label>
            <input type="text" placeholder="Nhập từ khoá..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200" />
          </div>

          {/* Filter danh mục — từ data thật */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Danh mục</label>
            <select value={catFilter} onChange={e => setCat(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none bg-white focus:border-blue-400">
              <option value="">Tất cả danh mục</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Filter trạng thái */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Trạng thái</label>
            <select value={statusFilter} onChange={e => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none bg-white focus:border-blue-400">
              <option value="">Tất cả</option>
              <option value="active">Đang hiển thị</option>
              <option value="inactive">Ẩn</option>
            </select>
          </div>

          {/* Nút action — flex items-end để align với inputs */}
          <div className="flex items-end gap-2">
            <button onClick={() => { setSearch(""); setCat(""); setStatus(""); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
              ↺ Làm mới
            </button>
            <button onClick={() => setCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer"
              style={{ background: "#16a34a" }}>
              + Tạo mới
            </button>
          </div>
        </div>

        {/*
          ── Table ──
          flex-1    = chiếm hết chiều cao còn lại
          overflow-auto = cuộn ngang (nếu min-w vượt viewport) + dọc (nếu rows tràn)
          Không dùng overflow-x-auto đơn lẻ → có thể bị clip dọc
        */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm min-w-[800px]">

            {/* Header — bg-gray-50 nổi bật, sticky nếu muốn */}
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["ID", "Tên", "Danh mục", "Trạng thái", "Ngày tạo", "Hành động"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">

              {/* Loading skeleton — không dùng "Đang tải..." đơn giản */}
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {[60, 200, 100, 80, 100, 60].map((w, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-4 rounded bg-gray-200" style={{ width: w }} />
                    </td>
                  ))}
                </tr>
              ))}

              {/* Empty state */}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <p className="text-gray-400 text-sm font-medium">Không tìm thấy dữ liệu nào</p>
                    {(search || catFilter || statusFilter) && (
                      <button onClick={() => { setSearch(""); setCat(""); setStatus(""); }}
                        className="text-blue-500 text-xs mt-2 hover:underline cursor-pointer">
                        Xoá bộ lọc
                      </button>
                    )}
                  </td>
                </tr>
              )}

              {/* Data rows — hover:bg-gray-50, py-3 */}
              {!loading && filtered.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">

                  {/* ID / code — font-mono, xám nhạt */}
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">
                    {item.displayId}
                  </td>

                  {/* Tên chính + tên phụ */}
                  <td className="px-4 py-3 max-w-[260px]">
                    <p className="font-medium text-gray-800 truncate">{item.name}</p>
                    {item.subName && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{item.subName}</p>
                    )}
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3 max-w-[140px]">
                    <span className="text-gray-600 text-xs truncate block">{item.category || "—"}</span>
                  </td>

                  {/* Toggle status — gọi API trực tiếp, .then(refetch) */}
                  <td className="px-4 py-3">
                    <Toggle
                      checked={item.status}
                      onChange={() => {
                        // api.items.update(item.id, { status: !item.status })
                        //   .then(loadData)
                        //   .catch(e => showToast("Lỗi: " + e.message, false));
                      }}
                    />
                  </td>

                  {/* Ngày tạo — xám, whitespace-nowrap */}
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {item.createdAt}
                  </td>

                  {/* Action menu */}
                  <td className="px-4 py-3 text-center">
                    <ActionMenu
                      itemId={item.id}
                      onDelete={() => {
                        // api.items.remove(item.id)
                        //   .then(() => { loadData(); showToast("Đã xoá"); })
                        //   .catch(e => showToast("Lỗi xoá: " + e.message, false));
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Footer ── py-3 + flex-shrink-0 — luôn dính đáy ─────────────── */}
        <div className="px-5 py-3 border-t border-gray-100 flex-shrink-0">
          <p className="text-xs text-gray-500">
            Hiển thị {filtered.length}/{items.length} mục
          </p>
        </div>

      </div>
    </>
  );
}

// ─── PAGE EXPORT ─────────────────────────────────────────────────────────────
// Bắt buộc bọc Suspense nếu dùng useSearchParams (Next.js 16)

export default function TemplatePage() {
  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_COURSES /* ← đổi */}>
      <Suspense>
        <PageInner />
      </Suspense>
    </PermissionGuard>
  );
}
