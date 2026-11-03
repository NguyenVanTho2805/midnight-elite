// BU-03 P2 · S5 — Dựng ma trận đề (/lop-cua-toi/de-thi/ma-tran/[id]; id "moi" = ma trận mới).
// Cột trái: chọn đơn vị kiến thức (Chương › Yêu cầu cần đạt) từ GET /api/tutor/ngan-hang/thong-ke. Cột phải: bảng số câu × mức NB/TH/VD/VDC, mỗi ô hiện "có X câu" sẵn trong kho;
// ô đòi nhiều hơn số có sẵn báo rõ "Thiếu N câu" bằng chữ (không chỉ màu). Bốc câu (xem trước, KHÔNG ghi) → giữ câu / đổi từng câu / bốc lại bằng hạt mới → Tạo đề (sao chép câu vào đề nháp).
// Lưu ma trận để dùng lại; có thể tạo luôn N mã đề (101, 102…) với đảo câu / đảo phương án. 1600px: hai cột (320px · nội dung); 390px: một cột, cây trong ngăn "Chọn yêu cầu cần đạt".
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { KinPage, KinPageHeader, KinPageSkeleton, KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinStateCard } from "@/components/kin/StateCard";
import { KinStatus } from "@/components/kin/Status";
import { KinTabs } from "@/components/kin/Tabs";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { MathText } from "@/components/MathText";
import {
  blueprintProblem, blueprintTotal, BP_MAX_PER_ROW, createBlueprint, deleteBlueprint, deThiDetailHref, deThiSubHref, doiCau, fetchBlueprint, fetchCategories, fetchCourseNames, fetchStats, LEVEL_LABEL, LEVELS,
  MA_DE_MAX, MA_DE_MIN, maTranHref, maTranListHref, MODE_LABEL, rutCau, SCOPE_LABEL, taoMaDe, taoTuMaTran, updateBlueprint, variantCodeOf,
  type BlueprintRow, type CategoryFlat, type Counts, type ExamMode, type Level, type PickItem, type RutRes, type Scope, type StatsRes,
} from "./deThiClient";

type Cells = Record<string, Partial<Record<Level, string>>>;
const newSeed = () => Math.random().toString(36).slice(2, 10);
const toCount = (v: string | undefined): number => { const n = Number((v ?? "").trim()); return Number.isInteger(n) && n > 0 ? n : 0; };

export default function MaTranBuilder({ id }: { id: string }) {
  const isNew = id === "moi";
  const router = useRouter();
  const { ask, dialog } = useKinConfirm();

  // ── dữ liệu nền ──
  const [cats, setCats] = useState<CategoryFlat[] | null>(null);
  const [catErr, setCatErr] = useState<string | null>(null);
  const [rootId, setRootId] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("all");
  const [stats, setStats] = useState<StatsRes | null>(null);
  const [statsFor, setStatsFor] = useState<string | null>(null);
  const [statsErr, setStatsErr] = useState<{ key: string; msg: string } | null>(null);
  const [courses, setCourses] = useState<{ id: string; name: string }[]>([]);
  const [reload, setReload] = useState(0);
  const [drawer, setDrawer] = useState(false);
  const [openCh, setOpenCh] = useState<Set<string>>(new Set());

  // ── ma trận ──
  const [savedId, setSavedId] = useState<string | null>(isNew ? null : id);
  const [loadedBp, setLoadedBp] = useState(isNew);
  const [bpGone, setBpGone] = useState(false);
  const [bpErr, setBpErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [cells, setCells] = useState<Cells>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "xong" | "loi"; text: string } | null>(null);

  // ── bốc câu ──
  const [draw, setDraw] = useState<RutRes | null>(null);
  const [drawRows, setDrawRows] = useState<BlueprintRow[]>([]); // đúng danh sách dòng đã gửi lúc bốc (rowIndex trỏ vào đây)
  const [itemInfo, setItemInfo] = useState<Record<string, PickItem>>({});
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [drawBusy, setDrawBusy] = useState<string | null>(null); // "rut" | "doi:<itemId>"
  const [drawErr, setDrawErr] = useState<string | null>(null);
  const [swapNote, setSwapNote] = useState<{ id: string; text: string } | null>(null);

  // ── tạo đề ──
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [mode, setMode] = useState<ExamMode | "">("");
  const [allowShort, setAllowShort] = useState(false);
  const [codes, setCodes] = useState(1);
  const [shufQ, setShufQ] = useState(true);
  const [shufO, setShufO] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  // Tải cây (danh mục phẳng) + tên lớp.
  useEffect(() => {
    let alive = true;
    void fetchCategories().then(r => {
      if (!alive) return;
      if (!r.ok || !r.data) { setCatErr(r.error ?? "Chưa tải được ngân hàng câu hỏi."); return; }
      setCatErr(null); setCats(r.data);
      const roots = r.data.filter(c => !c.parentId);
      setRootId(cur => (cur && roots.some(x => x.id === cur) ? cur : roots[0]?.id ?? null));
    });
    void fetchCourseNames().then(c => { if (alive) setCourses(c); });
    return () => { alive = false; };
  }, [reload]);

  // Mở ma trận đã lưu.
  useEffect(() => {
    if (isNew) return;
    let alive = true;
    void fetchBlueprint(id).then(r => {
      if (!alive) return;
      if (!r.ok || !r.data) { if (r.status === 404 || r.status === 403) setBpGone(true); setBpErr(r.error ?? "Chưa tải được ma trận."); return; }
      const bp = r.data;
      setBpErr(null); setName(bp.name); setTitle(bp.name);
      const sel: string[] = []; const cs: Cells = {};
      for (const row of bp.rows ?? []) {
        if (!sel.includes(row.categoryId)) sel.push(row.categoryId);
        cs[row.categoryId] = { ...cs[row.categoryId], [row.difficulty]: String(row.count) };
      }
      setSelected(sel); setCells(cs); setLoadedBp(true);
    });
    return () => { alive = false; };
  }, [id, isNew, reload]);

  // Ma trận đã lưu nằm trong môn nào: chọn đúng môn đó (một lần, khi có cả cây lẫn ma trận).
  const rootFixed = useRef(false);
  useEffect(() => {
    if (rootFixed.current || !cats || !loadedBp || isNew || selected.length === 0) return;
    rootFixed.current = true;
    const parent = new Map(cats.map(c => [c.id, c.parentId]));
    let cur: string | null = selected[0];
    for (let i = 0; i < 12 && cur && parent.get(cur); i++) cur = parent.get(cur) ?? null;
    if (cur && parent.has(cur)) setRootId(cur);
  }, [cats, loadedBp, isNew, selected]);

  const statsKey = rootId ? `${rootId}|${scope}` : null;
  useEffect(() => {
    if (!rootId || !statsKey) return;
    let alive = true;
    void fetchStats(rootId, scope).then(r => {
      if (!alive) return;
      setStatsFor(statsKey);
      if (!r.ok || !r.data) { setStatsErr({ key: statsKey, msg: r.error ?? "Chưa tải được số câu sẵn có." }); return; }
      setStatsErr(null); setStats(r.data);
    });
    return () => { alive = false; };
  }, [rootId, scope, statsKey, reload]);
  const statsBusy = !!statsKey && statsFor !== statsKey;
  const statsErrMsg = statsErr && statsErr.key === statsKey ? statsErr.msg : null;

  const roots = useMemo(() => (cats ?? []).filter(c => !c.parentId), [cats]);
  const catName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cats ?? []) m.set(c.id, c.name);
    for (const n of stats?.nodes ?? []) m.set(n.id, n.name);
    return (cid: string) => m.get(cid) ?? "Nút đã bị xoá";
  }, [cats, stats]);
  // Số câu sẵn có theo nút (chương: cả nhánh; YCCĐ: riêng nút) — đúng số của kho đang chọn.
  const avail = useMemo(() => {
    const m = new Map<string, Counts>();
    for (const ch of stats?.chapterMatrix ?? []) { m.set(ch.chapterId, ch.counts); for (const y of ch.yccd) m.set(y.id, y.counts); }
    return m;
  }, [stats]);

  // ── dòng ma trận ──
  const rows: BlueprintRow[] = useMemo(() => selected.flatMap(cid => LEVELS.flatMap(l => { const n = toCount(cells[cid]?.[l]); return n > 0 ? [{ categoryId: cid, difficulty: l, count: n }] : []; })), [selected, cells]);
  const problem = blueprintProblem(rows);
  const total = blueprintTotal(rows);
  const shortCells = rows.filter(r => { const a = avail.get(r.categoryId); return a ? r.count > a[r.difficulty] : false; });

  function clearDraw() { setDraw(null); setKept(new Set()); setItemInfo({}); setSwapNote(null); setCreateErr(null); }
  function toggleNode(cid: string) {
    setSelected(s => (s.includes(cid) ? s.filter(x => x !== cid) : [...s, cid]));
    setMsg(null); clearDraw();
  }
  function setCell(cid: string, l: Level, v: string) {
    if (v !== "" && !/^\d{1,3}$/.test(v)) return;
    setCells(c => ({ ...c, [cid]: { ...c[cid], [l]: v } }));
    setMsg(null); clearDraw();
  }

  async function save(): Promise<string | null> {
    if (!name.trim()) { setMsg({ tone: "loi", text: "Cô đặt tên cho ma trận trước khi lưu." }); return null; }
    if (problem) { setMsg({ tone: "loi", text: problem }); return null; }
    setSaving(true); setMsg(null);
    if (savedId) {
      const r = await updateBlueprint(savedId, name.trim(), rows);
      setSaving(false);
      if (!r.ok) { setMsg({ tone: "loi", text: r.error ?? "Chưa lưu được ma trận." }); return null; }
      setMsg({ tone: "xong", text: "Đã lưu ma trận." });
      return savedId;
    }
    const r = await createBlueprint(name.trim(), rows);
    setSaving(false);
    if (!r.ok || !r.data) { setMsg({ tone: "loi", text: r.error ?? "Chưa lưu được ma trận." }); return null; }
    setSavedId(r.data.id);
    window.history.replaceState(null, "", maTranHref(r.data.id)); // cùng trang, địa chỉ của ma trận vừa lưu (không tải lại)
    setMsg({ tone: "xong", text: "Đã lưu ma trận. Cô dùng lại được ở lần tạo đề sau." });
    return r.data.id;
  }

  async function removeBlueprint() {
    if (!savedId) return;
    if (!(await ask({ title: "Xoá ma trận này?", message: "Chỉ xoá ma trận đã lưu. Các đề đã tạo từ ma trận này giữ nguyên." , confirmLabel: "Xoá ma trận", tone: "nguy-hiem" }))) return;
    const r = await deleteBlueprint(savedId);
    if (!r.ok) { setMsg({ tone: "loi", text: r.error ?? "Chưa xoá được ma trận." }); return; }
    router.push(maTranListHref());
  }

  function absorb(res: RutRes) {
    setItemInfo(prev => {
      const n = { ...prev };
      for (const p of res.picks) for (const it of p.items ?? []) n[it.id] = it;
      return n;
    });
  }
  async function pick(again: boolean) {
    if (problem) { setDrawErr(problem); return; }
    setDrawBusy("rut"); setDrawErr(null); setSwapNote(null);
    const r = await rutCau({ rows, scope, ...(again ? { seed: newSeed(), locked: [...kept] } : {}) });
    setDrawBusy(null);
    if (!r.ok || !r.data) { setDrawErr(r.error ?? "Chưa bốc được câu. Thử lại sau ít phút."); return; }
    setDrawRows(rows); absorb(r.data); setDraw(r.data);
    if (!again) setKept(new Set());
    else setKept(k => new Set([...k].filter(x => r.data!.picks.some(p => p.itemIds.includes(x)))));
  }
  async function swap(rowIndex: number, itemId: string) {
    if (!draw) return;
    setDrawBusy(`doi:${itemId}`); setSwapNote(null);
    const current = draw.picks.flatMap(p => p.itemIds);
    const r = await doiCau({ rows: drawRows, rowIndex, itemId, current, seed: draw.seed });
    setDrawBusy(null);
    if (!r.ok || !r.data) { setSwapNote({ id: itemId, text: r.code === "NO_ALTERNATIVE" ? "Kho không còn câu nào khác ở ô này để đổi." : r.error ?? "Chưa đổi được câu." }); return; }
    const nid = r.data.itemId;
    if (r.data.item) setItemInfo(p => ({ ...p, [nid]: r.data!.item! }));
    setDraw(d => d && ({ ...d, picks: d.picks.map(p => p.rowIndex === rowIndex ? { ...p, itemIds: p.itemIds.map(x => x === itemId ? nid : x) } : p) }));
    setKept(k => { const n = new Set(k); n.delete(itemId); return n; });
  }

  const pickedIds = draw ? draw.picks.flatMap(p => p.itemIds) : [];
  const shortages = draw?.shortages ?? [];
  const missing = shortages.reduce((s, x) => s + Math.max(0, x.need - x.have), 0);
  const canCreate = !!draw && pickedIds.length > 0 && !!title.trim() && (missing === 0 || allowShort) && !creating && (codes < MA_DE_MIN || shufQ || shufO);

  async function create() {
    if (!draw) return;
    setCreating(true); setCreateErr(null);
    const bpId = savedId && !problem ? savedId : null;
    const r = await taoTuMaTran({ title: title.trim(), courseId: courseId || null, blueprintId: bpId, itemIds: pickedIds, ...(mode ? { mode } : {}), ...(allowShort ? { allowShort: true } : {}) });
    if (!r.ok || !r.data) { setCreating(false); setCreateErr(r.code === "SHORTAGE" ? "Ma trận còn thiếu câu trong kho. Cô tích “Tạo đề dù còn thiếu câu” nếu vẫn muốn tạo." : r.error ?? "Chưa tạo được đề."); return; }
    const examId = r.data.examId;
    if (codes >= MA_DE_MIN) {
      const v = await taoMaDe(examId, { count: codes, shuffleQuestions: shufQ, shuffleOptions: shufO, fixed: [] });
      if (!v.ok) { router.push(`${deThiSubHref(examId, "ma-de")}?loi=1`); return; } // đề đã tạo; trang Mã đề cho thử lại
      router.push(deThiSubHref(examId, "ma-de"));
      return;
    }
    router.push(deThiDetailHref(examId));
  }

  // ── ba trạng thái của cả trang ──
  if (catErr || bpErr) {
    return (
      <KinPage>
        <KinPageHeader title={isNew ? "Ma trận mới" : "Ma trận đề"} back={{ href: maTranListHref(), label: "Ma trận đề" }} />
        {bpGone ? (
          <KinEmptyState title="Không tìm thấy ma trận này" action={<Link href={maTranListHref()} className={kinButtonClass("primary")}>Về danh sách ma trận</Link>}>Ma trận có thể đã bị xoá, hoặc không phải của cô.</KinEmptyState>
        ) : (
          <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được trang" actions={<KinButton onClick={() => { setCatErr(null); setBpErr(null); setCats(null); setReload(n => n + 1); }}>Thử lại</KinButton>}>{catErr ?? bpErr}</KinStateCard>
        )}
      </KinPage>
    );
  }
  if (!cats || !loadedBp) return <KinPageSkeleton label="Đang tải ma trận" rows={5} />;
  if (roots.length === 0) {
    return (
      <KinPage>
        <KinPageHeader title="Ma trận mới" back={{ href: maTranListHref(), label: "Ma trận đề" }} />
        <KinEmptyState title="Ngân hàng chưa có môn nào để bốc câu" action={<Link href="/lop-cua-toi/ho-tro" className={kinButtonClass("secondary")}>Nhắn hỗ trợ</Link>}>Nút gốc “Môn” do quản trị KiN tạo sẵn. Có môn và câu hỏi, cô mới dựng được ma trận.</KinEmptyState>
      </KinPage>
    );
  }

  const chapters = stats?.chapterMatrix ?? [];
  const nodeBtn = (cid: string, label: string, c: Counts | undefined, indent: boolean) => {
    const on = selected.includes(cid);
    return (
      <li key={cid} className={indent ? "ml-6" : ""}>
        <button type="button" aria-pressed={on} onClick={() => toggleNode(cid)}
          className={`w-full min-h-11 flex items-center gap-2 px-2 text-left rounded-[var(--kin-bo-sm)] ${on ? "bg-[var(--kin-nen-nhan)] text-[var(--kin-chu-chinh)] font-medium" : "text-[var(--kin-chu-phu)] hover:bg-[var(--kin-nen-re-chuot)]"}`}>
          <span aria-hidden className="w-5 flex-shrink-0 text-center">{on ? "✓" : "+"}</span>
          <span className="min-w-0 flex-1 break-words text-[length:var(--kin-co-goc)]">{label}</span>
          <span className="flex-shrink-0 text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">{c ? `${c.total} câu` : ""}</span>
          <span className="sr-only">{on ? " Đã chọn, bấm để bỏ" : " Bấm để thêm vào ma trận"}</span>
        </button>
      </li>
    );
  };

  return (
    <KinPage>
      {dialog}
      <KinPageHeader title={isNew && !savedId ? "Ma trận mới" : "Ma trận đề"} back={{ href: maTranListHref(), label: "Ma trận đề" }}
        sub="Chọn yêu cầu cần đạt, nhập số câu theo mức, bốc câu từ ngân hàng rồi tạo đề"
        actions={savedId ? <KinButton variant="danger" onClick={() => void removeBlueprint()}>Xoá ma trận</KinButton> : undefined} />

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 pb-4">
        {roots.length > 1 && (
          <div className="min-w-0 w-full sm:w-64">
            <label htmlFor="mt-mon" className={`${KIN_LABEL} mb-2`}>Môn</label>
            <select id="mt-mon" className={KIN_FIELD} value={rootId ?? ""} onChange={e => { setRootId(e.target.value); setStats(null); clearDraw(); }}>
              {roots.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        )}
        <KinTabs<Scope> label="Kho câu hỏi để bốc" value={scope} onChange={s => { setScope(s); clearDraw(); }} className="min-w-0 max-w-full"
          tabs={(["all", "mine", "shared"] as const).map(k => ({ key: k, label: SCOPE_LABEL[k] }))} />
      </div>
      <p className="pb-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Số “có X câu” tính theo kho đang chọn. Câu nháp của gia sư khác không bao giờ được bốc.</p>

      <div className="lg:hidden pb-4">
        <KinButton variant="secondary" block aria-expanded={drawer} aria-controls="mt-cay" onClick={() => setDrawer(d => !d)}>
          {drawer ? "Đóng danh sách" : `Chọn yêu cầu cần đạt · đã chọn ${selected.length}`}
        </KinButton>
      </div>

      <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-x-8 gap-y-6 items-start">
        <aside id="mt-cay" aria-label="Chọn đơn vị kiến thức" className={`${drawer ? "block" : "hidden"} lg:block min-w-0 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] p-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] overflow-y-auto`}>
          <h2 className="px-2 pt-2 pb-1 text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">Đơn vị kiến thức</h2>
          {statsErrMsg ? (
            <div role="alert" className="p-3 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{statsErrMsg} <button type="button" className="underline min-h-11 px-2" onClick={() => { setStatsFor(null); setReload(n => n + 1); }}>Thử lại</button></div>
          ) : !stats || statsBusy ? (
            <p role="status" aria-busy="true" className="p-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đang tải đơn vị kiến thức…</p>
          ) : chapters.length === 0 ? (
            <p className="p-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Môn này chưa có chương nào. Cô thêm Chương và Yêu cầu cần đạt trong <Link href="/lop-cua-toi/de-thi/ngan-hang-cau-hoi" className="underline">Ngân hàng câu hỏi</Link>.</p>
          ) : (
            <ul>
              {chapters.map(ch => {
                const open = openCh.has(ch.chapterId);
                return (
                  <li key={ch.chapterId}>
                    <div className="flex items-stretch">
                      {ch.yccd.length > 0
                        ? <button type="button" aria-expanded={open} aria-label={`${open ? "Gập" : "Mở"} yêu cầu cần đạt của ${ch.name}`} onClick={() => setOpenCh(s => { const n = new Set(s); if (n.has(ch.chapterId)) n.delete(ch.chapterId); else n.add(ch.chapterId); return n; })} className="min-h-11 min-w-11 text-[var(--kin-chu-mo)]"><span aria-hidden>{open ? "▾" : "▸"}</span></button>
                        : <span aria-hidden className="min-w-11" />}
                      <ul className="flex-1 min-w-0">{nodeBtn(ch.chapterId, ch.name, ch.counts, false)}</ul>
                    </div>
                    {open && <ul>{ch.yccd.map(y => nodeBtn(y.id, y.name, y.counts, true))}</ul>}
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <div className="min-w-0 space-y-8">
          <section aria-labelledby="mt-bang" aria-busy={statsBusy || undefined}>
            <KinSectionHead id="mt-bang" title="Số câu theo mức" aside={`${selected.length} đơn vị · ${total} câu`} />
            {selected.length === 0 ? (
              <KinEmptyState title="Chưa chọn đơn vị kiến thức nào" action={<KinButton variant="secondary" className="lg:hidden" onClick={() => setDrawer(true)}>Chọn yêu cầu cần đạt</KinButton>}>
                Cô bấm tên chương hoặc yêu cầu cần đạt ở bên cạnh để thêm vào bảng, rồi nhập số câu cho từng mức.
              </KinEmptyState>
            ) : (
              <div role="table" aria-label="Ma trận: số câu theo đơn vị kiến thức và mức" className="mt-4 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)]">
                <div role="row" className="hidden lg:grid lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_auto] gap-x-3 px-4 min-h-11 items-center bg-[var(--kin-nen-bang)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
                  <span role="columnheader">Đơn vị kiến thức</span>
                  {LEVELS.map(l => <span key={l} role="columnheader" title={LEVEL_LABEL[l]}>{l}</span>)}
                  <span role="columnheader" className="w-24"><span className="sr-only">Bỏ dòng</span></span>
                </div>
                {selected.map(cid => {
                  const a = avail.get(cid);
                  return (
                    <div role="row" key={cid} data-mt-dong={cid} className="grid grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_auto] gap-x-3 gap-y-2 px-4 py-3 border-t border-[var(--kin-vien-nhat)] items-start">
                      <div role="rowheader" className="col-span-2 lg:col-span-1 min-w-0 break-words font-medium text-[var(--kin-chu-chinh)] text-[length:var(--kin-co-goc)]">{catName(cid)}</div>
                      {LEVELS.map(l => {
                        const need = toCount(cells[cid]?.[l]);
                        const have = a ? a[l] : null;
                        const short = have !== null && need > have;
                        const iid = `mt-${cid}-${l}`;
                        return (
                          <div role="cell" key={l} className="min-w-0">
                            <label htmlFor={iid} className="block text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)] lg:sr-only">{l} · {LEVEL_LABEL[l]}</label>
                            <input id={iid} inputMode="numeric" autoComplete="off" aria-label={`${catName(cid)}, mức ${l}, số câu`} aria-invalid={short || undefined} aria-describedby={`${iid}-c`}
                              className={`${KIN_FIELD} text-right tabular-nums ${short ? "!border-[var(--kin-tt-chu-loi)]" : ""}`} value={cells[cid]?.[l] ?? ""} onChange={e => setCell(cid, l, e.target.value)} placeholder="0" />
                            <p id={`${iid}-c`} className={`mt-1 text-[length:var(--kin-co-caption)] ${short ? "text-[var(--kin-tt-chu-loi)] font-medium" : "text-[var(--kin-chu-mo)]"}`}>
                              {have === null ? (statsBusy ? "đang tải…" : "chưa rõ số câu") : short ? `Thiếu ${need - have} câu (có ${have})` : `có ${have} câu`}
                            </p>
                          </div>
                        );
                      })}
                      <div role="cell" className="col-span-2 lg:col-span-1"><KinButton variant="ghost" onClick={() => toggleNode(cid)} aria-label={`Bỏ ${catName(cid)} khỏi ma trận`}>Bỏ dòng</KinButton></div>
                    </div>
                  );
                })}
              </div>
            )}
            {selected.length > 0 && (
              <div className="mt-3 space-y-1 text-[length:var(--kin-co-goc)]" role="status">
                <p className="text-[var(--kin-chu-phu)]">Tổng cộng {total} câu · {rows.length} ô có số câu (tối đa {BP_MAX_PER_ROW} câu mỗi ô).</p>
                {shortCells.length > 0 && <p><KinStatus tone="loi">{shortCells.length} ô đòi nhiều hơn số câu có sẵn</KinStatus></p>}
                {problem && rows.length > 0 && <p className="text-[var(--kin-tt-chu-loi)]">{problem}</p>}
              </div>
            )}
          </section>

          <section aria-labelledby="mt-luu" className="space-y-4">
            <KinSectionHead id="mt-luu" title="Lưu ma trận" />
            <div className="max-w-[560px]">
              <label htmlFor="mt-ten" className={`${KIN_LABEL} mb-2`}>Tên ma trận</label>
              <input id="mt-ten" className={KIN_FIELD} value={name} maxLength={120} onChange={e => { setName(e.target.value); if (!title) setTitle(e.target.value); }} placeholder="Ví dụ: Giữa kỳ 1 · Toán 12" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <KinButton variant="secondary" onClick={() => void save()} loading={saving} loadingLabel="Đang lưu…" disabled={rows.length === 0 || !!problem}>{savedId ? "Lưu thay đổi ma trận" : "Lưu ma trận"}</KinButton>
              {msg && <p role={msg.tone === "loi" ? "alert" : "status"} className={`text-[length:var(--kin-co-goc)] min-w-0 ${msg.tone === "loi" ? "text-[var(--kin-tt-chu-loi)]" : "text-[var(--kin-tt-chu-xong)]"}`}>{msg.text}</p>}
            </div>
          </section>

          <section aria-labelledby="mt-boc" className="space-y-4">
            <KinSectionHead id="mt-boc" title="Bốc câu từ ngân hàng" aside={draw ? `${pickedIds.length} câu` : undefined} />
            <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Bốc chỉ để xem trước, chưa tạo đề. Cô tích “Giữ” ở câu ưng ý rồi “Bốc lại” để đổi các câu còn lại, hoặc “Đổi câu” từng câu.</p>
            <div className="flex flex-wrap gap-3">
              <KinButton onClick={() => void pick(false)} loading={drawBusy === "rut" && !draw} loadingLabel="Đang bốc…" disabled={rows.length === 0 || !!problem || drawBusy !== null}>{draw ? "Bốc mới từ đầu" : "Bốc câu"}</KinButton>
              {draw && <KinButton variant="secondary" onClick={() => void pick(true)} loading={drawBusy === "rut"} loadingLabel="Đang bốc…" disabled={drawBusy !== null}>Bốc lại ngẫu nhiên{kept.size ? ` (giữ ${kept.size} câu)` : ""}</KinButton>}
            </div>
            {drawErr && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{drawErr}</p>}
            {drawBusy === "rut" && !draw && <div aria-busy="true" aria-label="Đang bốc câu" className="space-y-3"><div className="h-16 rounded kin-skel kin-skel--soft" /><div className="h-16 rounded kin-skel kin-skel--soft" /></div>}

            {draw && shortages.length > 0 && (
              <KinCallout title={`Thiếu ${missing} câu trong kho`}>
                <ul className="list-disc pl-5">
                  {shortages.map(s => <li key={`${s.rowIndex}`}>{catName(s.categoryId)} · {s.difficulty}: cần {s.need}, kho chỉ có {s.have}.</li>)}
                </ul>
                <p className="mt-1">KiN không tự hạ mức hay lấy câu mức khác. Cô giảm số câu ở ô thiếu, nhập thêm câu vào ngân hàng, hoặc tạo đề thiếu rồi soạn bù.</p>
              </KinCallout>
            )}
            {draw && pickedIds.length === 0 && <KinEmptyState title="Chưa bốc được câu nào">Kho không có câu nào khớp ma trận này. Cô đổi kho (Tất cả) hoặc nhập thêm câu vào ngân hàng.</KinEmptyState>}
            {draw && draw.picks.map(p => {
              const r = drawRows[p.rowIndex];
              if (!r) return null;
              return (
                <div key={p.rowIndex} className="rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)]" data-mt-boc={p.rowIndex}>
                  <h3 className="px-4 py-3 bg-[var(--kin-nen-bang)] text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)] break-words">{catName(r.categoryId)} · {r.difficulty} · {p.itemIds.length}/{r.count} câu</h3>
                  <ol>
                    {p.itemIds.map((iid, k) => {
                      const info = itemInfo[iid];
                      return (
                        <li key={iid} className="px-4 py-3 border-t border-[var(--kin-vien-nhat)]">
                          <div className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] break-words"><span className="text-[var(--kin-chu-mo)]">{k + 1}. </span>{info?.text ? <MathText text={info.text.length > 220 ? `${info.text.slice(0, 220)}…` : info.text} /> : <span className="text-[var(--kin-chu-mo)]">Nội dung xem được sau khi tạo đề</span>}</div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                            <label className="inline-flex items-center gap-2 min-h-11 text-[length:var(--kin-co-goc)]">
                              <input type="checkbox" className="w-5 h-5" checked={kept.has(iid)} onChange={e => setKept(s => { const n = new Set(s); if (e.target.checked) n.add(iid); else n.delete(iid); return n; })} aria-label={`Giữ câu ${k + 1} của ${catName(r.categoryId)} mức ${r.difficulty} khi bốc lại`} />
                              Giữ khi bốc lại
                            </label>
                            <KinButton variant="secondary" onClick={() => void swap(p.rowIndex, iid)} loading={drawBusy === `doi:${iid}`} loadingLabel="Đang đổi…" disabled={drawBusy !== null} aria-label={`Đổi câu ${k + 1} của ${catName(r.categoryId)} mức ${r.difficulty}`}>Đổi câu</KinButton>
                            {swapNote?.id === iid && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)] min-w-0">{swapNote.text}</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
          </section>

          {draw && pickedIds.length > 0 && (
            <section aria-labelledby="mt-tao" className="space-y-4">
              <KinSectionHead id="mt-tao" title="Tạo đề từ các câu đã bốc" />
              <div className="grid md:grid-cols-2 gap-x-6 gap-y-4 max-w-[860px]">
                <div className="min-w-0 md:col-span-2">
                  <label htmlFor="mt-dt" className={`${KIN_LABEL} mb-2`}>Tên đề *</label>
                  <input id="mt-dt" className={KIN_FIELD} value={title} maxLength={150} onChange={e => setTitle(e.target.value)} />
                </div>
                <div className="min-w-0">
                  <label htmlFor="mt-lop" className={`${KIN_LABEL} mb-2`}>Lớp (chọn sau cũng được)</label>
                  <select id="mt-lop" className={KIN_FIELD} value={courseId} onChange={e => setCourseId(e.target.value)}>
                    <option value="">Chưa chọn lớp</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="min-w-0">
                  <label htmlFor="mt-mode" className={`${KIN_LABEL} mb-2`}>Chế độ</label>
                  <select id="mt-mode" className={KIN_FIELD} value={mode} onChange={e => setMode(e.target.value as ExamMode | "")}>
                    <option value="">Chọn khi giao đề</option>
                    {(Object.keys(MODE_LABEL) as ExamMode[]).map(m => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
                  </select>
                </div>
                <fieldset className="min-w-0 md:col-span-2">
                  <legend className={`${KIN_LABEL} mb-2`}>Mã đề</legend>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <label htmlFor="mt-codes" className="text-[length:var(--kin-co-goc)]">Số mã đề</label>
                    <select id="mt-codes" className={`${KIN_FIELD} !w-auto`} value={codes} onChange={e => setCodes(Number(e.target.value))}>
                      <option value={1}>Một mã (không chia)</option>
                      {Array.from({ length: MA_DE_MAX - MA_DE_MIN + 1 }, (_, i) => MA_DE_MIN + i).map(n => <option key={n} value={n}>{n} mã đề ({variantCodeOf(1)}–{variantCodeOf(n)})</option>)}
                    </select>
                  </div>
                  {codes >= MA_DE_MIN ? (
                    <div className="mt-2 flex flex-wrap gap-x-6">
                      <label className="inline-flex items-center gap-2 min-h-11 text-[length:var(--kin-co-goc)]"><input type="checkbox" className="w-5 h-5" checked={shufQ} onChange={e => setShufQ(e.target.checked)} />Đảo thứ tự câu giữa các mã</label>
                      <label className="inline-flex items-center gap-2 min-h-11 text-[length:var(--kin-co-goc)]"><input type="checkbox" className="w-5 h-5" checked={shufO} onChange={e => setShufO(e.target.checked)} />Đảo thứ tự phương án</label>
                    </div>
                  ) : (
                    <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Với một mã, mỗi lượt học sinh làm đã được KiN xáo riêng. Chia nhiều mã nếu cô cần in đề.</p>
                  )}
                </fieldset>
                {missing > 0 && (
                  <label className="md:col-span-2 inline-flex items-center gap-2 min-h-11 text-[length:var(--kin-co-goc)]"><input type="checkbox" className="w-5 h-5" checked={allowShort} onChange={e => setAllowShort(e.target.checked)} />Tạo đề dù còn thiếu {missing} câu (cô soạn bù sau)</label>
                )}
              </div>
              {createErr && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{createErr}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <KinButton onClick={() => void create()} disabled={!canCreate} loading={creating} loadingLabel="Đang tạo đề…">Tạo đề nháp với {pickedIds.length} câu</KinButton>
                {codes >= MA_DE_MIN && !shufQ && !shufO && <p role="status" className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Bật ít nhất một kiểu đảo để các mã đề khác nhau.</p>}
                {missing > 0 && !allowShort && <p role="status" className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Còn thiếu {missing} câu: tích ô tạo đề dù thiếu, hoặc chỉnh ma trận.</p>}
              </div>
              <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">KiN sao chép câu vào đề nháp; sửa đề sau đó không đổi câu trong ngân hàng. Học sinh chưa thấy đề cho tới khi cô giao.</p>
            </section>
          )}
        </div>
      </div>
    </KinPage>
  );
}
