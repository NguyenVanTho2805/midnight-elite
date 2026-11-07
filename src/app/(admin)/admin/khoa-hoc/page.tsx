// CAT-02 — danh sách khoá học phía quản trị (dùng chung cho gia sư trong TutorAdminFrame).
// Bảng 6 cột + ô chọn, cột đầu là tên khoá; bộ lọc đồng bộ URL + chip; sửa nhanh trong panel bên; chọn nhiều + Hoàn tác.
// Giá CHỈ hiển thị (không ô sửa giá ở đây). Form tạo khoá nằm ở components/admin/courses/CreateCourseDrawer.tsx (chuyển nguyên văn).
"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useContentHref } from "@/components/tutor/useContentHref";
import {
  KinPage, KinPageHeader, KinButton, KinStateCard, KinEmptyState, KinTableSkeleton, KinToast, KinStatus, kinButtonClass,
} from "@/components/kin";
import { CreateCourseDrawer } from "@/components/admin/courses/CreateCourseDrawer";
import { CourseTable } from "@/components/admin/courses/CourseTable";
import { CourseFilters, EMPTY_FILTER, applyFilter, buildFacets, filterToQuery, readFilter, type CatalogRow, type CatalogFilter } from "@/components/admin/courses/CourseFilters";
import { CoursePanel, type CoursePatch } from "@/components/admin/courses/CoursePanel";
import { BulkBar } from "@/components/admin/courses/BulkBar";
import { PANEL_GUTTER } from "@/components/admin/panel/SidePanel";

interface ListResponse { rows: CatalogRow[]; truncated: boolean; canManageCategories: boolean }
interface BulkResult { updated: { id: string; prev: { status: boolean; category: string } }[]; skipped: { id: string; reason: string }[] }
interface UndoToast { title: string; detail?: string; undo?: () => Promise<void> }

async function postBulk(body: object): Promise<BulkResult> {
  const res = await fetch("/api/admin/khoa-hoc/bulk", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "Không lưu được. Thử lại nhé.");
  return data as BulkResult;
}

function KhoaHocListInner() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const isTeacher = user?.adminRole === "teacher";
  const href = useContentHref(); // gia sư sang bí danh /lop-cua-toi/quan-lop/…

  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [canCategory, setCanCategory] = useState(false);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [reloading, setReloading] = useState(false);
  const [categoryNames, setCategoryNames] = useState<string[]>([]);

  const [filter, setFilter] = useState<CatalogFilter>(() => readFilter(sp));
  // ?tao=1: nút "Tạo lớp đầu tiên" của gia sư mới (và đường cũ /admin/khoa-hoc/tao-moi) mở thẳng form tạo.
  const [createOpen, setCreateOpen] = useState(sp.get("tao") === "1");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busyIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toast, setToast] = useState<UndoToast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((title: string, ok = true, undo?: () => Promise<void>, detail?: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ title: ok ? title : `Lỗi: ${title}`, detail, undo });
    toastTimer.current = setTimeout(() => setToast(null), undo ? 8000 : 4000);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const load = useCallback(async (initial: boolean) => {
    if (initial) setState("loading"); else setReloading(true);
    try {
      const res = await fetch("/api/admin/khoa-hoc", { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as ListResponse;
      setRows(d.rows ?? []); setTruncated(!!d.truncated); setCanCategory(!!d.canManageCategories);
      setState("ok");
    } catch {
      setState("error");
    } finally { setReloading(false); }
  }, []);

  // Trạng thái đầu đã là "loading"; gọi sau một nhịp để không setState đồng bộ trong effect.
  useEffect(() => { queueMicrotask(() => { void load(true); }); }, [load]);
  useEffect(() => {
    fetch("/api/categories", { credentials: "same-origin" })
      .then(r => (r.ok ? r.json() : { categories: [] }))
      .then(d => setCategoryNames(((d.categories ?? []) as { name: string }[]).map(c => c.name)))
      .catch(() => {});
  }, []);

  // Bộ lọc → URL (giữ ?tao nếu còn). replace để không đầy lịch sử.
  const changeFilter = useCallback((next: CatalogFilter) => {
    setFilter(next);
    const qs = filterToQuery(next);
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname]);

  const facets = useMemo(() => buildFacets(rows), [rows]);
  const filtered = useMemo(() => applyFilter(rows, filter), [rows, filter]);
  const categories = useMemo(() => [...new Set([...categoryNames, ...facets.categories.map(c => c.name)])], [categoryNames, facets]);
  const activeRow = activeId ? rows.find(r => r.id === activeId) ?? null : null;
  const hasFilter = JSON.stringify({ ...filter, sx: "" }) !== JSON.stringify(EMPTY_FILTER);

  function patchRows(ids: string[], fn: (r: CatalogRow) => CatalogRow) {
    const set = new Set(ids);
    setRows(prev => prev.map(r => (set.has(r.id) ? fn(r) : r)));
  }

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAll(on: boolean) { setSelected(on ? new Set(filtered.map(r => r.id)) : new Set()); }

  async function runBulk(body: { action: "set_status"; status: boolean } | { action: "set_category"; category: string }) {
    const ids = [...selected];
    if (ids.length > 100) { showToast("Chỉ đổi được tối đa 100 khoá mỗi lần — bỏ bớt khoá đã chọn", false); return; }
    setBulkBusy(true);
    const updated: BulkResult["updated"] = [];
    let skipped = 0;
    try {
      for (let i = 0; i < ids.length; i += 100) {
        const r = await postBulk({ ids: ids.slice(i, i + 100), ...body });
        updated.push(...r.updated); skipped += r.skipped.length;
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Không lưu được", false);
      if (updated.length) patchRows(updated.map(u => u.id), r => (body.action === "set_status" ? { ...r, status: body.status } : { ...r, category: body.category }));
      setBulkBusy(false);
      return;
    }
    patchRows(updated.map(u => u.id), r => (body.action === "set_status" ? { ...r, status: body.status } : { ...r, category: body.category }));
    setSelected(new Set());
    setBulkBusy(false);
    const n = updated.length;
    const what = body.action === "set_status" ? (body.status ? `Đã hiện ${n} khoá` : `Đã ẩn ${n} khoá`) : `Đã chuyển ${n} khoá sang “${body.category}”`;
    const detail = skipped > 0 ? `${skipped} khoá được bỏ qua (không đổi hoặc không thuộc bạn).` : undefined;
    if (n === 0) { showToast("Không có khoá nào cần đổi", true, undefined, detail); return; }
    showToast(what, true, async () => {
      // Hoàn tác = gọi lại cùng API với giá trị trước, gom theo giá trị.
      const groups = new Map<string, string[]>();
      for (const u of updated) {
        const k = body.action === "set_status" ? String(u.prev.status) : u.prev.category;
        groups.set(k, [...(groups.get(k) ?? []), u.id]);
      }
      try {
        for (const [k, gids] of groups) {
          for (let i = 0; i < gids.length; i += 100) {
            const chunk = gids.slice(i, i + 100);
            if (body.action === "set_status") {
              await postBulk({ ids: chunk, action: "set_status", status: k === "true", undo: true });
              patchRows(chunk, r => ({ ...r, status: k === "true" }));
            } else {
              await postBulk({ ids: chunk, action: "set_category", category: k, undo: true });
              patchRows(chunk, r => ({ ...r, category: k }));
            }
          }
        }
        showToast(`Đã hoàn tác cho ${n} khoá`);
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Hoàn tác không được", false);
      }
    }, detail);
  }

  function onPanelSaved(id: string, patch: CoursePatch) {
    patchRows([id], r => ({
      ...r,
      ...(patch.name !== undefined ? { name: patch.name } : null),
      ...(patch.adminName !== undefined ? { adminName: patch.adminName } : null),
      ...(patch.category !== undefined ? { category: patch.category } : null),
      ...(patch.status !== undefined ? { status: patch.status } : null),
      ...(patch.classStatus !== undefined ? { classStatus: patch.classStatus } : null),
      ...(patch.capacity !== undefined ? { capacity: patch.capacity } : null),
      ...(patch.instructor !== undefined && r.tutor.id == null ? { tutor: { ...r.tutor, name: patch.instructor } } : null),
    }));
    setActiveId(null);
    showToast("Đã lưu thay đổi");
  }

  const total = rows.length;
  const sub = state === "ok" ? `${total} khoá · ${facets.shown} đang hiển thị · ${facets.hidden} đang ẩn` : undefined;

  return (
    <KinPage className={activeRow ? PANEL_GUTTER : ""}>
      <KinPageHeader
        title="Khoá học"
        sub={sub}
        live
        actions={<KinButton className="max-md:hidden" onClick={() => setCreateOpen(true)}>Tạo khoá học</KinButton>}
      />

      {state === "loading" && <KinTableSkeleton label="Đang tải danh sách khoá học" rows={8} />}

      {state === "error" && (
        <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Không tải được danh sách khoá học"
          status={<KinStatus tone="loi">Chưa lấy được dữ liệu</KinStatus>}
          actions={<KinButton onClick={() => load(true)}>Thử lại</KinButton>}>
          Có thể mạng đang chập chờn hoặc máy chủ bận. Danh sách của bạn không bị mất — bấm Thử lại là xem được ngay.
        </KinStateCard>
      )}

      {state === "ok" && (
        <div className="flex flex-col gap-4">
          {selected.size > 0 ? (
            <BulkBar
              count={selected.size} total={filtered.length}
              canCategory={canCategory && !isTeacher} categories={categories} busy={bulkBusy}
              onShow={() => runBulk({ action: "set_status", status: true })}
              onHide={() => runBulk({ action: "set_status", status: false })}
              onCategory={c => runBulk({ action: "set_category", category: c })}
              onClear={() => setSelected(new Set())}
              onSelectAll={() => toggleAll(true)}
            />
          ) : null}
          <CourseFilters
            value={filter} onChange={changeFilter} facets={facets}
            showTutor={!isTeacher} onReload={() => load(false)} reloading={reloading}
            hidden={selected.size > 0}
          />
          {truncated && (
            <p role="status" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-cho)]">Chỉ hiện 1000 khoá đầu — thu hẹp bằng bộ lọc để thấy đủ.</p>
          )}
          {total === 0 ? (
            <KinEmptyState title="Chưa có khoá học" action={<KinButton onClick={() => setCreateOpen(true)}>Tạo khoá học đầu tiên</KinButton>}>
              Khi bạn tạo khoá, nó sẽ hiện ở đây để sửa nhanh, ẩn/hiện và xem sĩ số.
            </KinEmptyState>
          ) : filtered.length === 0 ? (
            <KinEmptyState title="Không có khoá khớp bộ lọc"
              action={hasFilter ? <KinButton variant="secondary" onClick={() => changeFilter({ ...EMPTY_FILTER, sx: filter.sx })}>Xoá bộ lọc</KinButton> : undefined}>
              Thử bỏ bớt điều kiện hoặc tìm bằng từ ngắn hơn.
            </KinEmptyState>
          ) : (
            <CourseTable
              rows={filtered} selected={selected} onToggle={toggle} onToggleAll={toggleAll}
              onOpen={setActiveId} activeId={activeId} busyIds={busyIds} refreshing={reloading} hrefFor={href}
            />
          )}
          <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">Hiển thị {filtered.length}/{total} khoá học</p>
        </div>
      )}

      {/* Nút Tạo khoá nổi ở điện thoại */}
      {state !== "loading" && (
        <button type="button" onClick={() => setCreateOpen(true)}
          className={`md:hidden fixed bottom-4 right-4 z-30 shadow-[var(--kin-bong-noi)] ${kinButtonClass("primary", "lg")}`}>
          Tạo khoá học
        </button>
      )}

      {activeRow && (
        <CoursePanel
          key={activeRow.id}
          row={activeRow} categories={categories} isTeacher={isTeacher} hrefFor={href}
          onClose={() => setActiveId(null)}
          onSaved={onPanelSaved}
          onRemoved={id => { setRows(p => p.filter(r => r.id !== id)); setSelected(p => { const n = new Set(p); n.delete(id); return n; }); setActiveId(null); showToast("Đã xoá khoá học"); }}
          onDuplicated={n => {
            showToast(n === undefined ? "Đã sao chép khoá học"
              : n > 0 ? `Đã sao chép khoá học, chép ${n} khung giờ`
              : "Đã sao chép khoá học. Lớp mới chưa có khung giờ, vào tab Lịch học để đặt");
            load(false);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-2rem)] max-w-[400px]">
          <KinToast
            tone={toast.title.startsWith("Lỗi") ? "loi" : "xong"}
            title={toast.title}
            detail={toast.detail || toast.undo ? (
              <span className="flex flex-wrap items-center gap-x-3">
                {toast.detail}
                {toast.undo && (
                  <button type="button" onClick={() => { const u = toast.undo!; setToast(null); u(); }} className="min-h-11 font-semibold text-[var(--kin-nhan-link)] underline">Hoàn tác</button>
                )}
              </span>
            ) : undefined}
            onClose={() => setToast(null)}
          />
        </div>
      )}

      <CreateCourseDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={slug => {
          // Gia sư: sang thẳng trang quản khoá của lớp vừa tạo, mở sẵn tab Lịch học. Quản trị trung tâm: ở lại danh sách.
          if (isTeacher) { router.push(href(`/admin/khoa-hoc/${slug}?tab=lich-hoc&moi=1`)); return; }
          showToast("Đã tạo khoá học mới. Vào tab Lịch học của khoá để đặt khung giờ hằng tuần"); load(false);
        }}
        showToast={(msg, ok) => showToast(msg, ok ?? true)}
      />
    </KinPage>
  );
}

export default function KhoaHocListPage() {
  return (
    <Suspense>
      <KhoaHocListInner />
    </Suspense>
  );
}
