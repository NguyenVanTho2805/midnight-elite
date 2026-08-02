"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { AdminToast, useAdminToast } from "@/components/AdminToast";
import { api, type QuestionCategoryFull } from "@/lib/api";

interface TreeNode extends QuestionCategoryFull {
  children: TreeNode[];
}

function buildTree(items: QuestionCategoryFull[]): TreeNode[] {
  const byId = new Map<string, TreeNode>(items.map(c => [c.id, { ...c, children: [] }]));
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    nodes.forEach(n => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function CategoryRow({ node, depth, onRefetch, showToast }: {
  node: TreeNode; depth: number;
  onRefetch: () => Promise<void>;
  showToast: (msg: string, ok?: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleRename() {
    if (!editName.trim() || editName.trim() === node.name) { setEditing(false); return; }
    setBusy(true);
    try {
      await api.questionCategories.update(node.id, { name: editName.trim() });
      await onRefetch();
      showToast("Đã đổi tên đầu mục");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Đổi tên thất bại", false);
    } finally {
      setBusy(false);
      setEditing(false);
    }
  }

  async function handleAddChild() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await api.questionCategories.create({ name: newName.trim(), parentId: node.id });
      await onRefetch();
      showToast("Đã thêm đầu mục con");
      setNewName("");
      setAdding(false);
      setExpanded(true);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Tạo thất bại", false);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    setBusy(true);
    try {
      await api.questionCategories.remove(node.id);
      await onRefetch();
      showToast("Đã xoá đầu mục");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xoá thất bại", false);
    } finally {
      setBusy(false);
      setConfirmDel(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 py-1.5 group" style={{ paddingLeft: depth * 20 }}>
        {node.children.length > 0 ? (
          <button onClick={() => setExpanded(v => !v)} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xs flex-shrink-0">
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-5 flex-shrink-0" />
        )}

        {editing ? (
          <>
            <input autoFocus className="px-2 py-1 text-sm border rounded-lg outline-none focus:border-blue-400" style={{ borderColor: "#e5e3df" }}
              value={editName} onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setEditing(false); }} />
            <button onClick={handleRename} disabled={busy} className="text-xs font-semibold text-blue-600">Lưu</button>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-400">Huỷ</button>
          </>
        ) : (
          <>
            <span className="text-sm text-gray-800">{node.name}</span>
            <div className="flex items-center gap-2.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setAdding(true)} className="text-xs font-semibold text-blue-600">+ Thêm con</button>
              <button onClick={() => { setEditing(true); setEditName(node.name); }} className="text-xs font-semibold text-gray-500">Sửa</button>
              <button onClick={() => setConfirmDel(true)} className="text-xs font-semibold text-red-500">Xoá</button>
            </div>
          </>
        )}
      </div>

      {adding && (
        <div className="flex items-center gap-2 py-1" style={{ paddingLeft: (depth + 1) * 20 + 20 }}>
          <input autoFocus className="px-2 py-1 text-sm border rounded-lg outline-none focus:border-blue-400" style={{ borderColor: "#e5e3df" }}
            placeholder="Tên đầu mục con..." value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAddChild(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }} />
          <button onClick={handleAddChild} disabled={busy} className="text-xs font-semibold text-blue-600">Thêm</button>
          <button onClick={() => { setAdding(false); setNewName(""); }} className="text-xs text-gray-400">Huỷ</button>
        </div>
      )}

      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)" }}>
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4">
            <p className="text-sm font-semibold mb-1">Xoá đầu mục &quot;{node.name}&quot;?</p>
            <p className="text-xs text-gray-500 mb-4">Chỉ xoá được nếu không còn đầu mục con hoặc câu hỏi nào gắn vào.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDel(false)} className="px-3 py-1.5 text-sm border rounded-lg text-gray-600" style={{ borderColor: "#e5e3df" }}>Huỷ</button>
              <button onClick={handleDelete} disabled={busy} className="px-3 py-1.5 text-sm font-semibold text-white rounded-lg" style={{ background: "#dc2626" }}>Xoá</button>
            </div>
          </div>
        </div>
      )}

      {expanded && node.children.map(child => (
        <CategoryRow key={child.id} node={child} depth={depth + 1} onRefetch={onRefetch} showToast={showToast} />
      ))}
    </div>
  );
}

function PageInner() {
  const [items, setItems] = useState<QuestionCategoryFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const { toast, showToast } = useAdminToast();

  const load = useCallback(async () => {
    try {
      const data = await api.questionCategories.list();
      setItems(data);
    } catch {
      showToast("Lỗi tải danh sách đầu mục", false);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAddRoot() {
    if (!newName.trim()) return;
    try {
      await api.questionCategories.create({ name: newName.trim(), parentId: null });
      await load();
      showToast("Đã thêm đầu mục gốc");
      setNewName("");
      setAdding(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Tạo thất bại", false);
    }
  }

  const tree = buildTree(items);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {toast && <AdminToast msg={toast.msg} ok={toast.ok} />}

      <p className="text-sm text-gray-500 mb-1">
        <Link href="/admin/thi-thu/ngan-hang-cau-hoi" className="hover:text-blue-600">Ngân hàng câu hỏi</Link>
        {" "}/ <span className="font-medium text-gray-800">Quản lý đầu mục</span>
      </p>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#1a1a1a" }}>Cây đầu mục</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tổ chức câu hỏi theo đầu mục từ to đến bé — không giới hạn số tầng</p>
        </div>
        <button onClick={() => setAdding(true)} className="px-4 py-2.5 text-sm font-semibold text-white rounded-lg" style={{ background: "#0068FF" }}>
          + Thêm đầu mục gốc
        </button>
      </div>

      {adding && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg border border-dashed" style={{ borderColor: "#93c5fd", background: "#eff6ff" }}>
          <input autoFocus className="flex-1 px-2 py-1.5 text-sm border rounded-lg outline-none focus:border-blue-400" style={{ borderColor: "#e5e3df" }}
            placeholder="Tên đầu mục gốc (vd: Toán, Ngữ Văn...)" value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAddRoot(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }} />
          <button onClick={handleAddRoot} className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white" style={{ background: "#0068FF" }}>Thêm</button>
          <button onClick={() => { setAdding(false); setNewName(""); }} className="px-2 text-xs text-gray-400">Huỷ</button>
        </div>
      )}

      <div className="rounded-xl border p-3" style={{ borderColor: "#e5e3df" }}>
        {loading ? (
          <p className="text-center text-gray-400 text-sm py-8">Đang tải...</p>
        ) : tree.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">Chưa có đầu mục nào</p>
        ) : (
          tree.map(node => <CategoryRow key={node.id} node={node} depth={0} onRefetch={load} showToast={showToast} />)
        )}
      </div>
    </div>
  );
}

export default function CategoryTreeAdminPage() {
  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_CURRICULUM}>
      <PageInner />
    </PermissionGuard>
  );
}
