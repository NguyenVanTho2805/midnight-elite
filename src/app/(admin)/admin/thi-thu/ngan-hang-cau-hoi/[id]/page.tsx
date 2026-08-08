"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { AdminToast, useAdminToast } from "@/components/AdminToast";
import { api, type QuestionCategoryFull, type Difficulty } from "@/lib/api";
import { UploadAndExtractButton } from "@/components/UploadAndExtractButton";

const DIFFICULTY_KEYS: Difficulty[] = ["NB", "TH", "VD", "VDC"];
const DIFFICULTY_COLOR: Record<Difficulty, { bg: string; color: string }> = {
  NB:  { bg: "#dbeafe", color: "#0068FF" },
  TH:  { bg: "#dcfce7", color: "#16a34a" },
  VD:  { bg: "#fef3c7", color: "#b45309" },
  VDC: { bg: "#fee2e2", color: "#dc2626" },
};

// Cây không giới hạn tầng vẫn giữ nguyên (không thêm field "loại tầng") —
// chỉ đổi CHỮ hiển thị theo depth cho dễ hiểu: tầng 0 (con trực tiếp của
// ngân hàng) = Chương, tầng 1 = Bài, sâu hơn giữ nhãn chung (không chặn tổ
// chức sâu hơn 2 cấp, chỉ không có tên riêng).
function depthLabel(depth: number): string {
  if (depth === 0) return "Chương";
  if (depth === 1) return "Bài";
  return "Mục con";
}

interface TreeNode extends QuestionCategoryFull {
  children: TreeNode[];
  total: number; // count của node + cộng dồn toàn bộ con cháu
  difficultyTotals: Record<Difficulty, number>; // difficultyCounts của node + cộng dồn con cháu
}

function buildTree(items: QuestionCategoryFull[], rootId: string): TreeNode | null {
  const byId = new Map<string, TreeNode>(items.map(c => [c.id, { ...c, children: [], total: c.count, difficultyTotals: { ...c.difficultyCounts } }]));
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    }
  }
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    nodes.forEach(n => sortRec(n.children));
  };
  function computeTotal(node: TreeNode): number {
    const diff = { ...node.difficultyCounts };
    let total = node.count;
    for (const child of node.children) {
      total += computeTotal(child);
      for (const k of DIFFICULTY_KEYS) diff[k] += child.difficultyTotals[k];
    }
    node.total = total;
    node.difficultyTotals = diff;
    return total;
  }
  const root = byId.get(rootId) ?? null;
  if (root) {
    sortRec(root.children);
    computeTotal(root);
  }
  return root;
}

// Tìm kiếm trong cây theo tên — nếu chính node khớp thì giữ nguyên toàn bộ
// cây con của nó (không lọc tiếp, vì user đã tìm đúng node này); nếu không
// khớp thì chỉ giữ những nhánh con có ít nhất 1 kết quả khớp bên trong.
function filterTree(node: TreeNode, query: string): TreeNode | null {
  const matchesSelf = node.name.toLowerCase().includes(query);
  if (matchesSelf) return node;
  const filteredChildren = node.children
    .map(c => filterTree(c, query))
    .filter((c): c is TreeNode => c !== null);
  if (filteredChildren.length === 0) return null;
  return { ...node, children: filteredChildren };
}

function CategoryRow({ node, depth, forceOpen, onRefetch, showToast }: {
  node: TreeNode; depth: number; forceOpen?: boolean;
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

  // Đang tìm kiếm — mở hết những mục bị thu gọn tay trước đó, để hiện đủ
  // đường dẫn tới kết quả khớp (mục mới hiện lần đầu đã mặc định mở sẵn).
  useEffect(() => { if (forceOpen) setExpanded(true); }, [forceOpen]);

  const selfLabel = depthLabel(depth);
  const childLabel = depthLabel(depth + 1);
  const nonZeroDifficulties = DIFFICULTY_KEYS.filter(k => node.difficultyTotals[k] > 0);

  async function handleRename() {
    if (!editName.trim() || editName.trim() === node.name) { setEditing(false); return; }
    setBusy(true);
    try {
      await api.questionCategories.update(node.id, { name: editName.trim() });
      await onRefetch();
      showToast(`Đã đổi tên ${selfLabel.toLowerCase()}`);
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
      showToast(`Đã thêm ${childLabel.toLowerCase()}`);
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
      showToast(`Đã xoá ${selfLabel.toLowerCase()}`);
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
            <Link href={`/admin/thi-thu/ngan-hang-cau-hoi/cau-hoi?categoryId=${node.id}`} className="text-sm text-gray-800 hover:text-blue-600 hover:underline">
              {node.name}
            </Link>
            <span className="text-xs text-gray-400">({node.total} câu hỏi)</span>
            {nonZeroDifficulties.length > 0 && (
              <div className="flex items-center gap-1">
                {nonZeroDifficulties.map(k => (
                  <span key={k} className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold" style={DIFFICULTY_COLOR[k]}>
                    {k} {node.difficultyTotals[k]}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => setAdding(true)} className="text-xs font-semibold text-blue-600">+ Thêm {childLabel.toLowerCase()}</button>
              <button onClick={() => { setEditing(true); setEditName(node.name); }} className="text-xs font-semibold text-gray-500">Sửa</button>
              <button onClick={() => setConfirmDel(true)} className="text-xs font-semibold text-red-500">Xoá</button>
            </div>
          </>
        )}
      </div>

      {adding && (
        <div className="flex items-center gap-2 py-1" style={{ paddingLeft: (depth + 1) * 20 + 20 }}>
          <input autoFocus className="px-2 py-1 text-sm border rounded-lg outline-none focus:border-blue-400" style={{ borderColor: "#e5e3df" }}
            placeholder={`Tên ${childLabel.toLowerCase()}...`} value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAddChild(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }} />
          <button onClick={handleAddChild} disabled={busy} className="text-xs font-semibold text-blue-600">Thêm</button>
          <button onClick={() => { setAdding(false); setNewName(""); }} className="text-xs text-gray-400">Huỷ</button>
        </div>
      )}

      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)" }}>
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4">
            <p className="text-sm font-semibold mb-1">Xoá {selfLabel.toLowerCase()} &quot;{node.name}&quot;?</p>
            <p className="text-xs text-gray-500 mb-4">Chỉ xoá được nếu không còn {childLabel.toLowerCase()} nào bên trong hoặc câu hỏi nào gắn vào.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDel(false)} className="px-3 py-1.5 text-sm border rounded-lg text-gray-600" style={{ borderColor: "#e5e3df" }}>Huỷ</button>
              <button onClick={handleDelete} disabled={busy} className="px-3 py-1.5 text-sm font-semibold text-white rounded-lg" style={{ background: "#dc2626" }}>Xoá</button>
            </div>
          </div>
        </div>
      )}

      {expanded && node.children.map(child => (
        <CategoryRow key={child.id} node={child} depth={depth + 1} forceOpen={forceOpen} onRefetch={onRefetch} showToast={showToast} />
      ))}
    </div>
  );
}

function PageInner() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const bankId = params.id;

  const [items, setItems] = useState<QuestionCategoryFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [search, setSearch] = useState("");
  const [copying, setCopying] = useState(false);
  const [copyName, setCopyName] = useState("");
  const [view, setView] = useState<"tree" | "stats">("tree");
  const { toast, showToast } = useAdminToast();

  const load = useCallback(async () => {
    try {
      const data = await api.questionCategories.list();
      setItems(data);
    } catch {
      showToast("Lỗi tải dữ liệu ngân hàng", false);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const root = useMemo(() => buildTree(items, bankId), [items, bankId]);
  const trimmedSearch = search.trim().toLowerCase();
  const displayedChildren = useMemo(() => {
    if (!root) return [];
    if (!trimmedSearch) return root.children;
    return root.children.map(c => filterTree(c, trimmedSearch)).filter((c): c is TreeNode => c !== null);
  }, [root, trimmedSearch]);

  async function handleAddChild() {
    if (!newName.trim()) return;
    try {
      await api.questionCategories.create({ name: newName.trim(), parentId: bankId });
      await load();
      showToast("Đã thêm chương");
      setNewName("");
      setAdding(false);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Tạo thất bại", false);
    }
  }

  async function handleDuplicate() {
    if (!root) return;
    try {
      const result = await api.questionCategories.duplicate(root.id, copyName.trim() || undefined);
      setCopying(false);
      router.push(`/admin/thi-thu/ngan-hang-cau-hoi/${result.id}`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Copy thất bại", false);
    }
  }

  if (!loading && !root) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/admin/thi-thu/ngan-hang-cau-hoi" className="hover:text-blue-600">Ngân hàng câu hỏi</Link>
        </p>
        <p className="text-center text-gray-400 text-sm py-12">Không tìm thấy ngân hàng này</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {toast && <AdminToast msg={toast.msg} ok={toast.ok} />}

      <p className="text-sm text-gray-500 mb-1">
        <Link href="/admin/thi-thu/ngan-hang-cau-hoi" className="hover:text-blue-600">Ngân hàng câu hỏi</Link>
        {" "}/ <span className="font-medium text-gray-800">{root?.name ?? "..."}</span>
      </p>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#1a1a1a" }}>{root?.name ?? "Đang tải..."}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{root ? `${root.total} câu hỏi` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          {root && (
            <>
              <UploadAndExtractButton fixedBankId={root.id} onSaved={load} showToast={showToast} label="+ Tải file lên & tách câu hỏi" />
              <button onClick={() => { setCopyName(`${root.name} (bản sao)`); setCopying(true); }}
                className="px-4 py-2.5 text-sm font-semibold rounded-lg border" style={{ borderColor: "#e5e3df", color: "#787671" }}>
                Copy ngân hàng
              </button>
              <Link href={`/admin/thi-thu/ngan-hang-cau-hoi/cau-hoi?categoryId=${root.id}&select=1`}
                className="px-4 py-2.5 text-sm font-semibold rounded-lg border" style={{ borderColor: "#e5e3df", color: "#787671" }}>
                Tự chọn câu hỏi
              </Link>
              <Link href={`/admin/thi-thu/ngan-hang-cau-hoi/cau-hoi?categoryId=${root.id}`}
                className="px-4 py-2.5 text-sm font-semibold text-white rounded-lg" style={{ background: "#0068FF" }}>
                + Thêm câu hỏi
              </Link>
            </>
          )}
          <button onClick={() => setAdding(true)} className="px-4 py-2.5 text-sm font-semibold rounded-lg border" style={{ borderColor: "#e5e3df", color: "#787671" }}>
            + Thêm chương
          </button>
        </div>
      </div>

      {root && root.children.length > 0 && (
        <div className="flex gap-2 mb-4">
          {([
            { v: "tree" as const, label: "Cây cấu trúc" },
            { v: "stats" as const, label: "Thống kê" },
          ]).map(t => (
            <button key={t.v} onClick={() => setView(t.v)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
              style={view === t.v
                ? { background: "#0068FF", borderColor: "#0068FF", color: "#fff" }
                : { borderColor: "#e5e3df", color: "#787671" }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {copying && root && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)" }}>
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4">
            <p className="text-sm font-semibold mb-1">Copy ngân hàng &quot;{root.name}&quot;</p>
            <p className="text-xs text-gray-500 mb-3">Nhân bản toàn bộ cây đầu mục + câu hỏi bên trong sang 1 ngân hàng mới.</p>
            <input autoFocus className="w-full px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400" style={{ borderColor: "#e5e3df" }}
              value={copyName} onChange={e => setCopyName(e.target.value)} />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => setCopying(false)} className="px-3 py-1.5 text-sm border rounded-lg text-gray-600" style={{ borderColor: "#e5e3df" }}>Huỷ</button>
              <button onClick={handleDuplicate} className="px-3 py-1.5 text-sm font-semibold text-white rounded-lg" style={{ background: "#0068FF" }}>
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {adding && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg border border-dashed" style={{ borderColor: "#93c5fd", background: "#eff6ff" }}>
          <input autoFocus className="flex-1 px-2 py-1.5 text-sm border rounded-lg outline-none focus:border-blue-400" style={{ borderColor: "#e5e3df" }}
            placeholder="Tên chương (vd: Chương 1...)" value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAddChild(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }} />
          <button onClick={handleAddChild} className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white" style={{ background: "#0068FF" }}>Thêm</button>
          <button onClick={() => { setAdding(false); setNewName(""); }} className="px-2 text-xs text-gray-400">Huỷ</button>
        </div>
      )}

      {view === "tree" ? (
        <>
          {root && root.children.length > 0 && (
            <input
              className="w-full max-w-sm px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400 mb-3"
              style={{ borderColor: "#e5e3df" }}
              placeholder="Tìm theo tên mục..."
              value={search} onChange={e => setSearch(e.target.value)} />
          )}

          <div className="rounded-xl border p-3" style={{ borderColor: "#e5e3df" }}>
            {loading ? (
              <p className="text-center text-gray-400 text-sm py-8">Đang tải...</p>
            ) : !root || root.children.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Chưa có chương nào</p>
            ) : displayedChildren.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Không tìm thấy mục nào khớp</p>
            ) : (
              displayedChildren.map(node => (
                <CategoryRow key={node.id} node={node} depth={0} forceOpen={!!trimmedSearch} onRefetch={load} showToast={showToast} />
              ))
            )}
          </div>
        </>
      ) : (
        root && root.children.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#e5e3df" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide" style={{ background: "#f6f5f4" }}>
                  <th className="px-4 py-3">Chương</th>
                  {DIFFICULTY_KEYS.map(k => <th key={k} className="px-4 py-3 text-right">{k}</th>)}
                  <th className="px-4 py-3 text-right">Tổng</th>
                </tr>
              </thead>
              <tbody>
                {root.children.map(chapter => (
                  <tr key={chapter.id} className="border-t" style={{ borderColor: "#e5e3df" }}>
                    <td className="px-4 py-3">{chapter.name}</td>
                    {DIFFICULTY_KEYS.map(k => (
                      <td key={k} className="px-4 py-3 text-right" style={chapter.difficultyTotals[k] === 0 ? { color: "#c9c6c0" } : undefined}>
                        {chapter.difficultyTotals[k]}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-semibold">{chapter.total}</td>
                  </tr>
                ))}
                <tr className="border-t font-semibold" style={{ borderColor: "#e5e3df", background: "#f6f5f4" }}>
                  <td className="px-4 py-3">Tổng cộng</td>
                  {DIFFICULTY_KEYS.map(k => (
                    <td key={k} className="px-4 py-3 text-right">{root.difficultyTotals[k]}</td>
                  ))}
                  <td className="px-4 py-3 text-right">{root.total}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

export default function QuestionBankDetailPage() {
  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_CURRICULUM}>
      <PageInner />
    </PermissionGuard>
  );
}
