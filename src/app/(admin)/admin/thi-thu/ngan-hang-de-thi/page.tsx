"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { AdminToast, useAdminToast } from "@/components/AdminToast";
import { api, type ExamFileFull, type ExamFileFolderFull } from "@/lib/api";
import { ExtractReviewModal } from "@/components/ExtractReviewModal";
import { DropZone } from "@/components/DropZone";

// ─── DUYỆT THƯ MỤC KIỂU FILE MANAGER (1 cấp phẳng, giống trang "Đề thi" của
// Azota — thư mục VÀ file gộp chung 1 bảng, không tách view riêng). Root =
// mọi thư mục + file chưa phân loại; bấm vào 1 thư mục để xem file bên
// trong (không có thư mục con vì thư mục ở đây là 1 cấp phẳng).
type View = { type: "root" } | { type: "folder"; id: string; name: string };

function Breadcrumb({ view, onRoot }: { view: View; onRoot: () => void }) {
  return (
    <div className="flex items-center gap-1.5 text-sm mb-4">
      <button onClick={onRoot} className={view.type === "root" ? "font-bold" : "font-semibold text-blue-600 hover:underline"}
        style={view.type === "root" ? { color: "#1a1a1a" } : undefined}>
        Tất cả
      </button>
      {view.type === "folder" && (
        <>
          <span className="text-gray-400">›</span>
          <span className="font-bold" style={{ color: "#1a1a1a" }}>{view.name}</span>
        </>
      )}
    </div>
  );
}

// Bảng gộp thư mục + file trong CÙNG 1 danh sách (giống trang "Đề thi" gốc
// của Azota — họ cũng gộp icon thư mục lẫn file trong 1 bảng, không tách
// view riêng). `folders` chỉ khác rỗng khi đang ở root (thư mục phẳng,
// không có thư mục con để liệt kê khi đã ở trong 1 thư mục).
function FileFolderTable({ folders, files, allFolders, onOpenFolder, onRenamed, onDeleted, onExtract, onMove, onRequestDeleteFile, onDeleteFileNow, showToast, loading }: {
  folders: ExamFileFolderFull[];
  files: ExamFileFull[];
  allFolders: ExamFileFolderFull[];
  onOpenFolder: (f: ExamFileFolderFull) => void;
  onRenamed: () => void;
  onDeleted: () => void;
  onExtract: (f: ExamFileFull) => void;
  onMove: (f: ExamFileFull, folderId: string) => void;
  // Xoá từng file: mở modal xác nhận (nút Xoá ở từng dòng). Xoá hàng loạt:
  // xoá thẳng luôn (đã có 1 lần confirm() gộp cho cả nhóm ở handleDeleteSelected).
  onRequestDeleteFile: (f: ExamFileFull) => void;
  onDeleteFileNow: (f: ExamFileFull) => Promise<void>;
  showToast: (msg: string, ok?: boolean) => void;
  loading: boolean;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function handleRenameFolder(id: string) {
    if (!renameValue.trim()) return;
    try {
      await api.examFileFolders.update(id, renameValue.trim());
      setRenaming(null);
      onRenamed();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Đổi tên thất bại", false);
    }
  }

  async function handleDeleteFolder(id: string) {
    if (!confirm("Xoá thư mục này? (chỉ xoá được nếu không còn file bên trong)")) return;
    try {
      await api.examFileFolders.remove(id);
      onDeleted();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xoá thất bại", false);
    }
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`Xoá ${selected.size} file đã chọn?`)) return;
    for (const f of files) {
      if (selected.has(f.id)) await onDeleteFileNow(f);
    }
    setSelected(new Set());
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const sortedFolders = [...folders].sort((a, b) => sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
  const sortedFiles = [...files].sort((a, b) => sortAsc ? a.fileName.localeCompare(b.fileName) : b.fileName.localeCompare(a.fileName));
  const allFileIdsSelected = files.length > 0 && files.every(f => selected.has(f.id));

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#e5e3df" }}>
      <div className="flex items-center gap-3 px-4 py-3 text-xs text-gray-500 uppercase tracking-wide" style={{ background: "#f6f5f4" }}>
        <input type="checkbox" checked={allFileIdsSelected} disabled={files.length === 0}
          onChange={e => setSelected(e.target.checked ? new Set(files.map(f => f.id)) : new Set())} />
        <button onClick={() => setSortAsc(v => !v)} className="flex items-center gap-1 hover:text-gray-700">
          Tên <span>{sortAsc ? "▲" : "▼"}</span>
        </button>
        <span className="flex-1" />
        {selected.size > 0 && (
          <button onClick={handleDeleteSelected} className="text-xs font-semibold text-red-500 normal-case">Xoá {selected.size} đã chọn</button>
        )}
        <span className="w-28 text-right">Người tải lên</span>
        <span className="w-24 text-right">Ngày tải</span>
        <span className="w-56 text-right">Hành động</span>
      </div>

      {sortedFolders.map(f => (
        <div key={f.id} className="flex items-center gap-3 px-4 py-3 border-t group" style={{ borderColor: "#e5e3df" }}>
          <span className="w-4 flex-shrink-0" />
          {renaming === f.id ? (
            <div className="flex items-center gap-2 flex-1">
              <input autoFocus className="flex-1 px-2 py-1.5 text-sm border rounded-lg outline-none focus:border-blue-400" style={{ borderColor: "#e5e3df" }}
                value={renameValue} onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleRenameFolder(f.id); if (e.key === "Escape") setRenaming(null); }} />
              <button onClick={() => handleRenameFolder(f.id)} className="text-xs font-semibold text-blue-600 flex-shrink-0">Lưu</button>
              <button onClick={() => setRenaming(null)} className="text-xs text-gray-400 flex-shrink-0">Huỷ</button>
            </div>
          ) : (
            <>
              <button onClick={() => onOpenFolder(f)} className="flex items-center gap-2.5 flex-1 text-left py-0.5 min-w-0">
                <span className="text-lg flex-shrink-0">📁</span>
                <span className="text-sm font-medium truncate" style={{ color: "#1a1a1a" }}>{f.name}</span>
              </button>
              <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" style={{ width: "17.5rem" }}>
                <button onClick={() => { setRenaming(f.id); setRenameValue(f.name); }} className="text-xs font-semibold text-blue-600">Đổi tên</button>
                <button onClick={() => handleDeleteFolder(f.id)} className="text-xs font-semibold text-red-500">Xoá</button>
              </div>
            </>
          )}
        </div>
      ))}

      {sortedFiles.map(item => (
        <div key={item.id} className="flex items-center gap-3 px-4 py-3 border-t" style={{ borderColor: "#e5e3df" }}>
          <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} className="flex-shrink-0" />
          <span className="text-lg flex-shrink-0">📄</span>
          <span className="text-sm flex-1 truncate" title={item.fileName}>{item.fileName}</span>
          <span className="w-28 text-right text-xs text-gray-500 truncate">{item.owner?.name ?? "—"}</span>
          <span className="w-24 text-right text-xs text-gray-400">{new Date(item.createdAt).toLocaleDateString("vi-VN")}</span>
          <div className="flex items-center justify-end gap-2 flex-wrap" style={{ width: "17.5rem" }}>
            <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold" style={{ color: "#0068FF" }}>Xem</a>
            <button onClick={() => onExtract(item)} className="text-xs font-semibold" style={{ color: "#16a34a" }}>Tách câu</button>
            <select className="px-1 py-1 text-xs border rounded outline-none bg-white max-w-[6rem]" style={{ borderColor: "#e5e3df" }}
              value={item.folderId ?? ""} onChange={e => onMove(item, e.target.value)}>
              <option value="">Chưa phân loại</option>
              {allFolders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <button onClick={() => onRequestDeleteFile(item)} className="text-xs font-semibold text-red-500">Xoá</button>
          </div>
        </div>
      ))}

      {loading && <p className="px-4 py-8 text-center text-sm text-gray-400">Đang tải...</p>}
      {!loading && sortedFolders.length === 0 && sortedFiles.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-gray-400">Chưa có thư mục hay file nào ở đây</p>
      )}
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────
function PageInner() {
  const [items, setItems] = useState<ExamFileFull[]>([]);
  const [folders, setFolders] = useState<ExamFileFolderFull[]>([]);
  const [view, setView] = useState<View>({ type: "root" });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extractTarget, setExtractTarget] = useState<ExamFileFull | null>(null);
  const [delTarget, setDelTarget] = useState<ExamFileFull | null>(null);
  const [search, setSearch] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast, showToast } = useAdminToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await api.examFiles.list());
    } catch {
      showToast("Lỗi tải danh sách file", false);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const loadFolders = useCallback(() => {
    api.examFileFolders.list().then(setFolders).catch(() => {});
  }, []);

  useEffect(() => { load(); loadFolders(); }, [load, loadFolders]);

  const q = search.trim().toLowerCase();
  const foldersToShow = (view.type === "root" ? folders : []) // thư mục phẳng — không có thư mục con
    .filter(f => !q || f.name.toLowerCase().includes(q));
  const filesToShow = items
    .filter(item => view.type === "root" ? !item.folderId : item.folderId === view.id)
    .filter(item => !q || item.fileName.toLowerCase().includes(q));
  const recentFiles = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4);

  async function processUpload(file: File) {
    setUploading(true);
    try {
      const folderId = view.type === "folder" ? view.id : null;
      await api.examFiles.upload(file, folderId);
      showToast("Đã tải lên file đề thi");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload thất bại", false);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }
  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processUpload(file);
  }

  async function handleMove(item: ExamFileFull, folderId: string) {
    try {
      const updated = await api.examFiles.move(item.id, folderId || null);
      setItems(prev => prev.map(x => x.id === item.id ? updated : x));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Chuyển thư mục thất bại", false);
    }
  }

  async function handleDeleteFileNow(file: ExamFileFull) {
    try {
      await api.examFiles.remove(file.id);
      setItems(prev => prev.filter(x => x.id !== file.id));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Xoá thất bại", false);
    }
  }

  async function handleDeleteConfirmed() {
    if (!delTarget) return;
    await handleDeleteFileNow(delTarget);
    showToast("Đã xoá file");
    setDelTarget(null);
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    try {
      await api.examFileFolders.create(newFolderName.trim());
      setAddingFolder(false); setNewFolderName("");
      loadFolders();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Tạo thư mục thất bại", false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && <AdminToast msg={toast.msg} ok={toast.ok} />}

      <div className="mb-5">
        <h1 className="text-xl font-extrabold" style={{ color: "#1a1a1a" }}>Ngân hàng đề thi</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Lưu trữ file đề gốc (PDF/Word) để xem lại sau — bấm &quot;Tách câu hỏi&quot; khi cần đưa câu vào{" "}
          <Link href="/admin/thi-thu/ngan-hang-cau-hoi" className="text-blue-600 hover:underline">Ngân hàng câu hỏi</Link>
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm kiếm..."
          className="flex-1 min-w-[200px] max-w-xs px-3 py-2.5 text-sm border rounded-lg outline-none focus:border-blue-400"
          style={{ borderColor: "#e5e3df" }} />
        <div className="flex items-center gap-2 flex-shrink-0">
          {addingFolder ? (
            <div className="flex items-center gap-2">
              <input autoFocus className="px-3 py-2 text-sm border rounded-lg outline-none focus:border-blue-400" style={{ borderColor: "#e5e3df" }}
                placeholder="Tên thư mục..." value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") { setAddingFolder(false); setNewFolderName(""); } }} />
              <button onClick={handleCreateFolder} className="px-3 py-2 text-sm font-semibold text-white rounded-lg" style={{ background: "#0068FF" }}>Thêm</button>
              <button onClick={() => { setAddingFolder(false); setNewFolderName(""); }} className="text-sm text-gray-400">Huỷ</button>
            </div>
          ) : (
            <button onClick={() => setAddingFolder(true)}
              className="px-4 py-2.5 text-sm font-semibold text-white rounded-lg" style={{ background: "#0052DD" }}>
              📁+ Tạo thư mục
            </button>
          )}
          <DropZone onFiles={files => files[0] && processUpload(files[0])} disabled={uploading} className="inline-block rounded-lg">
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="px-4 py-2.5 text-sm font-semibold text-white rounded-lg disabled:opacity-50" style={{ background: "#16a34a" }}>
              {uploading ? "Đang tải lên..." : "+ Tải hoặc kéo-thả file lên"}
            </button>
          </DropZone>
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {view.type === "root" && recentFiles.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold mb-3" style={{ color: "#1a1a1a" }}>Tải lên gần đây</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {recentFiles.map(f => (
              <a key={f.id} href={f.fileUrl} target="_blank" rel="noopener noreferrer"
                className="rounded-xl border p-3 hover:shadow-sm transition-shadow" style={{ borderColor: "#e5e3df" }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ background: "#fff7ed" }}>
                  <span className="text-lg">📄</span>
                </div>
                <p className="text-xs font-semibold truncate" style={{ color: "#1a1a1a" }} title={f.fileName}>{f.fileName}</p>
                <p className="text-xs text-gray-400 mt-1">Ngày tải: {new Date(f.createdAt).toLocaleDateString("vi-VN")}</p>
                {f.folder && <p className="text-xs text-gray-400 truncate">📁 {f.folder.name}</p>}
              </a>
            ))}
          </div>
        </div>
      )}

      <Breadcrumb view={view} onRoot={() => setView({ type: "root" })} />

      <FileFolderTable
        folders={foldersToShow}
        files={filesToShow}
        allFolders={folders}
        onOpenFolder={f => setView({ type: "folder", id: f.id, name: f.name })}
        onRenamed={loadFolders}
        onDeleted={loadFolders}
        onExtract={setExtractTarget}
        onMove={handleMove}
        onRequestDeleteFile={setDelTarget}
        onDeleteFileNow={handleDeleteFileNow}
        showToast={showToast}
        loading={loading}
      />

      <ExtractReviewModal
        examFile={extractTarget}
        onClose={() => setExtractTarget(null)}
        onSaved={() => {}}
        showToast={showToast}
      />

      {delTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)" }}>
          <div className="bg-white rounded-xl p-5 max-w-sm w-full mx-4">
            <p className="text-sm font-semibold mb-1">Xoá file &quot;{delTarget.fileName}&quot;?</p>
            <p className="text-xs text-gray-500 mb-4">Chỉ xoá file lưu trữ — không ảnh hưởng câu hỏi đã tách và lưu vào ngân hàng trước đó.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDelTarget(null)} className="px-3 py-1.5 text-sm border rounded-lg text-gray-600" style={{ borderColor: "#e5e3df" }}>Huỷ</button>
              <button onClick={handleDeleteConfirmed} className="px-3 py-1.5 text-sm font-semibold text-white rounded-lg" style={{ background: "#dc2626" }}>Xoá</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExamFilesAdminPage() {
  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_CURRICULUM}>
      <PageInner />
    </PermissionGuard>
  );
}
