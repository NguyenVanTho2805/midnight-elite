// CAT-02 — danh mục khoá học phía quản trị: có thứ tự (kéo thả · Alt+↑/↓ · Lên/Xuống), thêm/đổi tên/xoá THẬT (bảng course_categories).
// Vai gia sư: chỉ đọc danh mục (đếm khoá của mình từ /api/categories). Số khoá chỉ đếm, không tính tiền.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useContentHref } from "@/components/tutor/useContentHref";
import { KinPage, KinPageHeader, KinButton, KinStateCard, KinEmptyState, KinTableSkeleton, KinToast, KinStatus } from "@/components/kin";
import { CategoryList, type CategoryRow } from "@/components/admin/categories/CategoryList";
import { CategoryPanel, type PanelMode } from "@/components/admin/categories/CategoryPanel";
import { PANEL_GUTTER } from "@/components/admin/panel/SidePanel";

interface Toast { title: string; ok: boolean; undo?: () => void }

function move<T>(arr: T[], from: number, to: number): T[] {
  const a = [...arr];
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return a;
}

export default function DanhMucPage() {
  const href = useContentHref();
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [readOnly, setReadOnly] = useState(false);
  const [panel, setPanel] = useState<PanelMode | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());

  const showToast = useCallback((title: string, ok = true, undo?: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ title, ok, undo });
    timer.current = setTimeout(() => setToast(null), undo ? 8000 : 4000);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const load = useCallback(async (initial = true) => {
    if (initial) setState("loading");
    try {
      const res = await fetch("/api/admin/danh-muc", { credentials: "same-origin", cache: "no-store" });
      if (res.ok) {
        const d = (await res.json()) as { categories: { id: string; name: string; slug: string; courses: { total: number; shown: number; hidden: number } }[] };
        setRows(d.categories.map(c => ({ id: c.id, name: c.name, slug: c.slug, total: c.courses.total, shown: c.courses.shown, hidden: c.courses.hidden })));
        setReadOnly(false); setState("ok"); return;
      }
      if (res.status === 403) {
        // Vai gia sư: xem danh sách dùng chung, đếm khoá của mình.
        const r2 = await fetch("/api/categories", { credentials: "same-origin", cache: "no-store" });
        if (!r2.ok) throw new Error(String(r2.status));
        const d = (await r2.json()) as { categories: { id: number | string; name: string; courseCount?: number }[] };
        setRows(d.categories.map(c => ({ id: String(c.id), name: c.name, slug: "", total: c.courseCount ?? 0, shown: c.courseCount ?? 0, hidden: 0 })));
        setReadOnly(true); setState("ok"); return;
      }
      throw new Error(String(res.status));
    } catch { setState("error"); }
  }, []);
  // Trạng thái đầu đã là "loading"; gọi sau một nhịp để không setState đồng bộ trong effect.
  useEffect(() => { queueMicrotask(() => { void load(true); }); }, [load]);

  /** Lưu thứ tự (nối tiếp, để bấm Alt+↓ liên tục không đè nhau). Trả true nếu lưu được. */
  const persistOrder = useCallback((ids: string[]): Promise<boolean> => {
    const run = async (): Promise<boolean> => {
      setSaving(true);
      try {
        const res = await fetch("/api/admin/danh-muc/thu-tu", { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
        if (res.status === 409) { showToast("Danh sách vừa đổi, đã tải lại", false); await load(false); return false; }
        if (!res.ok) { const d = await res.json().catch(() => ({})); showToast((d as { error?: string }).error || "Không lưu được thứ tự", false); await load(false); return false; }
        return true;
      } catch { showToast("Mất kết nối, chưa lưu được thứ tự", false); await load(false); return false; }
      finally { setSaving(false); }
    };
    const p = chain.current.then(run, run);
    chain.current = p;
    return p;
  }, [load, showToast]);

  const reorder = useCallback((from: number, to: number) => {
    if (readOnly || from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return;
    const before = rows.map(r => r.id);
    const next = move(rows, from, to);
    setRows(next);
    persistOrder(next.map(r => r.id)).then(ok => {
      if (!ok) return;
      showToast(`Đã đổi vị trí “${rows[from].name}”`, true, () => {
        setRows(prev => before.map(id => prev.find(r => r.id === id)!).filter(Boolean));
        persistOrder(before).then(k => k && showToast("Đã hoàn tác thứ tự"));
      });
    });
  }, [rows, readOnly, persistOrder, showToast]);

  const moveBy = useCallback((id: string, dir: -1 | 1) => {
    const i = rows.findIndex(r => r.id === id);
    reorder(i, i + dir);
  }, [rows, reorder]);

  const total = rows.reduce((a, c) => a + c.total, 0);
  const panelRow = panel?.type === "edit" ? rows.find(r => r.id === panel.id) ?? null : null;
  const panelIndex = panelRow ? rows.findIndex(r => r.id === panelRow.id) : -1;

  return (
    <KinPage className={panel ? PANEL_GUTTER : ""}>
      <KinPageHeader
        title="Danh mục khoá học"
        sub={state === "ok" ? `${rows.length} danh mục · ${total} khoá. Danh mục dùng chung cho mọi gia sư; đổi tên sẽ cập nhật khoá của tất cả gia sư.` : "Danh mục dùng chung cho mọi gia sư."}
        actions={state === "ok" && !readOnly ? <KinButton onClick={() => setPanel({ type: "add" })}>Thêm danh mục</KinButton> : undefined}
      />

      {state === "loading" && <KinTableSkeleton label="Đang tải danh mục" rows={5} />}

      {state === "error" && (
        <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Không tải được danh mục"
          status={<KinStatus tone="loi">Chưa lấy được dữ liệu</KinStatus>}
          actions={<KinButton onClick={() => load(true)}>Thử lại</KinButton>}>
          Có thể mạng đang chập chờn hoặc máy chủ bận. Bấm Thử lại là xem được ngay.
        </KinStateCard>
      )}

      {state === "ok" && (
        <div className="flex flex-col gap-4">
          {readOnly && <p role="note" className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Chỉ quản trị viên đổi được danh mục. Số khoá bên dưới là khoá của riêng bạn.</p>}
          {!readOnly && rows.length > 1 && <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">Kéo hàng để đổi thứ tự, hoặc chọn tên rồi bấm Alt + mũi tên lên/xuống. Thứ tự này là thứ tự học viên thấy ở trang công khai.{saving ? " Đang lưu thứ tự…" : ""}</p>}
          {rows.length === 0 ? (
            <KinEmptyState title="Chưa có danh mục"
              action={!readOnly ? <KinButton onClick={() => setPanel({ type: "add" })}>Thêm danh mục</KinButton> : undefined}>
              Tạo khoá học hoặc bấm Thêm danh mục để bắt đầu.
            </KinEmptyState>
          ) : (
            <CategoryList rows={rows} readOnly={readOnly} activeId={panelRow?.id ?? null} saving={saving} hrefFor={href}
              onOpen={id => setPanel({ type: "edit", id })} onMove={moveBy} onReorder={reorder} />
          )}
        </div>
      )}

      {panel && !readOnly && (
        <CategoryPanel
          key={panel.type === "add" ? "add" : panel.id}
          mode={panel} row={panelRow} index={panelIndex} count={rows.length} hrefFor={href}
          onClose={() => setPanel(null)}
          onCreated={c => { setRows(p => [...p, c]); setPanel(null); showToast(`Đã thêm danh mục “${c.name}”`); }}
          onRenamed={(id, name, slug) => { setRows(p => p.map(r => (r.id === id ? { ...r, name, slug } : r))); setPanel(null); showToast("Đã đổi tên danh mục và cập nhật các khoá học"); }}
          onDeleted={id => { setRows(p => p.filter(r => r.id !== id)); setPanel(null); showToast("Đã xoá danh mục"); }}
          onMove={moveBy}
        />
      )}

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-[400px]">
          <KinToast tone={toast.ok ? "xong" : "loi"} title={toast.title}
            detail={toast.undo ? <button type="button" onClick={() => { const u = toast.undo!; setToast(null); u(); }} className="min-h-11 font-semibold text-[var(--kin-nhan-link)] underline">Hoàn tác</button> : undefined}
            onClose={() => setToast(null)} />
        </div>
      )}
    </KinPage>
  );
}
