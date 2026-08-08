"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { AdminToast, useAdminToast } from "@/components/AdminToast";
import { api, type QuestionCategoryFull } from "@/lib/api";
import { UploadAndExtractButton } from "@/components/UploadAndExtractButton";

interface BankCard {
  id: string;
  name: string;
  total: number; // cộng dồn count của cả cây con
}

function computeTotals(categories: QuestionCategoryFull[]): Map<string, number> {
  const byId = new Map(categories.map(c => [c.id, c]));
  const childrenOf = new Map<string, QuestionCategoryFull[]>();
  for (const c of categories) {
    const key = c.parentId ?? "";
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(c);
  }
  const memo = new Map<string, number>();
  function totalOf(id: string): number {
    if (memo.has(id)) return memo.get(id)!;
    const node = byId.get(id);
    if (!node) return 0;
    let sum = node.count;
    for (const child of childrenOf.get(id) ?? []) sum += totalOf(child.id);
    memo.set(id, sum);
    return sum;
  }
  for (const c of categories) totalOf(c.id);
  return memo;
}

function BankCardTile({ card, onRename, onDelete, onDuplicate }: {
  card: BankCard;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(card.name);
  const [confirmDel, setConfirmDel] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyName, setCopyName] = useState(`${card.name} (bản sao)`);

  return (
    <div className="group relative rounded-xl border p-4 hover:shadow-sm transition-shadow bg-white" style={{ borderColor: "#e5e3df" }}>
      {editing ? (
        <div className="flex items-center gap-2 mb-2">
          <input autoFocus className="flex-1 px-2 py-1 text-sm border rounded-lg outline-none focus:border-blue-400" style={{ borderColor: "#e5e3df" }}
            value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") { onRename(card.id, name); setEditing(false); }
              if (e.key === "Escape") { setName(card.name); setEditing(false); }
            }} />
          <button onClick={() => { onRename(card.id, name); setEditing(false); }} className="text-xs font-semibold text-blue-600">Lưu</button>
        </div>
      ) : (
        <Link href={`/admin/thi-thu/ngan-hang-cau-hoi/${card.id}`} className="block mb-2">
          <h3 className="text-base font-bold truncate" style={{ color: "#1a1a1a" }} title={card.name}>{card.name}</h3>
        </Link>
      )}

      <p className="text-sm text-gray-500">{card.total} câu hỏi</p>

      <div className="flex items-center gap-3 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={() => { setName(card.name); setEditing(true); }} className="text-xs font-semibold text-gray-500">Sửa tên</button>
        <button onClick={() => { setCopyName(`${card.name} (bản sao)`); setCopying(true); }} className="text-xs font-semibold text-gray-500">Copy</button>
        <button onClick={() => setConfirmDel(true)} className="text-xs font-semibold text-red-500">Xoá</button>
      </div>

      {copying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)" }}>
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4">
            <p className="text-sm font-semibold mb-1">Copy ngân hàng &quot;{card.name}&quot;</p>
            <p className="text-xs text-gray-500 mb-3">Nhân bản toàn bộ cây đầu mục + câu hỏi bên trong sang 1 ngân hàng mới.</p>
            <input autoFocus className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400" style={{ borderColor: "#e5e3df" }}
              value={copyName} onChange={e => setCopyName(e.target.value)} />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setCopying(false)} className="px-3 py-1.5 text-sm border rounded-lg text-gray-600" style={{ borderColor: "#e5e3df" }}>Huỷ</button>
              <button onClick={() => { onDuplicate(card.id, copyName); setCopying(false); }}
                className="px-3 py-1.5 text-sm font-semibold text-white rounded-lg" style={{ background: "#0068FF" }}>
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)" }}>
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4">
            <p className="text-sm font-semibold mb-1">Xoá ngân hàng &quot;{card.name}&quot;?</p>
            <p className="text-xs text-gray-500 mb-4">Chỉ xoá được nếu không còn đầu mục con hoặc câu hỏi nào bên trong.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDel(false)} className="px-3 py-1.5 text-sm border rounded-lg text-gray-600" style={{ borderColor: "#e5e3df" }}>Huỷ</button>
              <button onClick={() => { onDelete(card.id); setConfirmDel(false); }} className="px-3 py-1.5 text-sm font-semibold text-white rounded-lg" style={{ background: "#dc2626" }}>Xoá</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PageInner() {
  const [categories, setCategories] = useState<QuestionCategoryFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 12;
  const { toast, showToast } = useAdminToast();

  const load = useCallback(async () => {
    try {
      const data = await api.questionCategories.list();
      setCategories(data);
    } catch {
      showToast("Lỗi tải danh sách ngân hàng", false);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => computeTotals(categories), [categories]);
  const roots = useMemo(() => categories.filter(c => !c.parentId), [categories]);

  const cards: BankCard[] = useMemo(() => {
    const filtered = roots.filter(r => r.name.toLowerCase().includes(search.trim().toLowerCase()));
    return filtered
      .map(r => ({ id: r.id, name: r.name, total: totals.get(r.id) ?? 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [roots, search, totals]);

  const totalPages = Math.max(1, Math.ceil(cards.length / pageSize));
  const pagedCards = cards.slice((page - 1) * pageSize, page * pageSize);

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      await api.questionCategories.create({ name: newName.trim(), parentId: null });
      await load();
      showToast("Đã tạo ngân hàng mới");
      setNewName("");
      setCreating(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Tạo thất bại", false);
    }
  }

  async function handleRename(id: string, name: string) {
    if (!name.trim()) return;
    try {
      await api.questionCategories.update(id, { name: name.trim() });
      await load();
      showToast("Đã đổi tên ngân hàng");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Đổi tên thất bại", false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.questionCategories.remove(id);
      await load();
      showToast("Đã xoá ngân hàng");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xoá thất bại", false);
    }
  }

  async function handleDuplicate(id: string, name: string) {
    try {
      await api.questionCategories.duplicate(id, name.trim() || undefined);
      await load();
      showToast("Đã copy ngân hàng");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Copy thất bại", false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {toast && <AdminToast msg={toast.msg} ok={toast.ok} />}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#1a1a1a" }}>Ngân hàng câu hỏi</h1>
          <p className="text-sm text-gray-500 mt-0.5">Mỗi ngân hàng là 1 đầu mục gốc, bên trong tổ chức theo cây không giới hạn cấp</p>
        </div>
        <div className="flex items-center gap-2">
          <UploadAndExtractButton onSaved={load} showToast={showToast} />
          <button onClick={() => setCreating(true)} className="px-4 py-2.5 text-sm font-semibold text-white rounded-lg" style={{ background: "#0068FF" }}>
            + Tạo ngân hàng mới
          </button>
        </div>
      </div>

      <input
        className="w-full max-w-sm px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400 mb-5"
        style={{ borderColor: "#e5e3df" }}
        placeholder="Tìm ngân hàng theo tên..."
        value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />

      {creating && (
        <div className="flex items-center gap-2 mb-5 p-3 rounded-lg border border-dashed" style={{ borderColor: "#93c5fd", background: "#eff6ff" }}>
          <input autoFocus className="flex-1 px-2 py-1.5 text-sm border rounded-lg outline-none focus:border-blue-400" style={{ borderColor: "#e5e3df" }}
            placeholder="Tên ngân hàng (vd: Toán, Ngữ Văn...)" value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setCreating(false); setNewName(""); } }} />
          <button onClick={handleCreate} className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white" style={{ background: "#0068FF" }}>Tạo</button>
          <button onClick={() => { setCreating(false); setNewName(""); }} className="px-2 text-xs text-gray-400">Huỷ</button>
        </div>
      )}

      {loading ? (
        <p className="text-center text-gray-400 text-sm py-12">Đang tải...</p>
      ) : cards.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-12">
          {search ? "Không tìm thấy ngân hàng nào" : "Chưa có ngân hàng nào — bấm \"+ Tạo ngân hàng mới\" để bắt đầu"}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pagedCards.map(card => (
              <BankCardTile key={card.id} card={card} onRename={handleRename} onDelete={handleDelete} onDuplicate={handleDuplicate} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6 text-sm">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 rounded-lg border disabled:opacity-40" style={{ borderColor: "#e5e3df" }}>‹</button>
              <span className="text-gray-500">Trang {page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 rounded-lg border disabled:opacity-40" style={{ borderColor: "#e5e3df" }}>›</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function QuestionBankGalleryPage() {
  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_CURRICULUM}>
      <PageInner />
    </PermissionGuard>
  );
}
