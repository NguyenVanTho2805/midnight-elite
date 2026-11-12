// HOME-02 — màn sửa chữ trang chủ công khai. Form 5 khối ở cột trái, xem trước (cùng component với trang thật) ở cột phải; điện thoại: tab Sửa | Xem trước.
// Kiểm tại chỗ bằng đúng hàm của máy chủ (validateHomeContent + cụm cấm + số ô/thẻ); máy chủ vẫn kiểm lại khi lưu (422) và chống ghi đè mù (409).
// Không hộp thoại xác nhận: khôi phục có Hoàn tác, rời trang có dải cảnh báo trong trang.
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { KinButton, KinCallout, KinPanel, KinSkeleton, KinStateCard, KinTabs, KinToast, type ToastTone } from "@/components/kin";
import { KIN_PAGE, KinPageHeader } from "@/components/kin/PageLayout";
import { HOME_LIMITS, validateHomeContent, type HomeContent, type HomeIconKey } from "@/lib/siteContent";
import { checkHomeClaims, checkHomeCounts, diffHomeContent, hiddenHrefWarning, hrefNeedsManualCheck, HREF_SUGGESTIONS, limitFor } from "@/lib/homeContentGuard";
import { MAIN_HOST } from "@/lib/hostRouting";
import { BlockCard, Field, fieldId } from "./BlockCard";
import IconPicker from "./IconPicker";
import PreviewFrame from "./PreviewFrame";
import { KinSelect } from "@/components/kin/KinSelect";

interface Loaded { content: HomeContent; defaults: HomeContent; isDefault: boolean; updatedAt: string | null; updatedBy: { name: string } | null }
interface Toast { tone: ToastTone; title: string; detail?: string; action?: { label: string; run: () => void }; keep?: boolean }
type Conflict = { content: HomeContent; updatedAt: string | null; updatedBy: { name: string } | null };

const clone = <T,>(v: T): T => structuredClone(v);
const BLOCKS = {
  "khoi-dau": { title: "Đầu trang", keys: ["badge", "title", "lead"] },
  "khoi-ky-thi": { title: "Ô kỳ thi", keys: ["exams"] },
  "khoi-loi-ich": { title: "“Học ở đây thì được gì?”", keys: ["why"] },
  "khoi-gia-su": { title: "Khối tìm gia sư", keys: ["findTutor"] },
  "khoi-keu-goi": { title: "Kêu gọi cuối trang", keys: ["cta"] },
} as const;
type BlockId = keyof typeof BLOCKS;
const BLOCK_IDS = Object.keys(BLOCKS) as BlockId[];

const sameKeys = (a: HomeContent, b: HomeContent, keys: readonly (keyof HomeContent)[]) => keys.every(k => JSON.stringify(a[k]) === JSON.stringify(b[k]));
const when = (iso: string) => new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const hhmm = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "");

export default function HomeEditor() {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [server, setServer] = useState<Loaded | null>(null);
  const [saved, setSaved] = useState<HomeContent | null>(null);
  const [draft, setDraft] = useState<HomeContent | null>(null);
  const [base, setBase] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(true);
  const [meta, setMeta] = useState<{ updatedAt: string | null; by: string | null }>({ updatedAt: null, by: null });
  const [saving, setSaving] = useState(false);
  const [serverErr, setServerErr] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [categories, setCategories] = useState<string[] | null>(null);
  const [tab, setTab] = useState<"sua" | "xem">("sua");
  const [toast, setToast] = useState<Toast | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [leave, setLeave] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setState("loading");
    try {
      const r = await fetch("/api/admin/site-content/home", { credentials: "same-origin", cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const d = (await r.json()) as Loaded;
      setServer(d); setSaved(clone(d.content)); setDraft(clone(d.content)); setBase(d.updatedAt); setIsDefault(d.isDefault);
      setMeta({ updatedAt: d.updatedAt, by: d.updatedBy?.name ?? null });
      setServerErr({}); setConflict(null); setState("ready");
    } catch { setState("error"); }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    fetch("/api/categories", { credentials: "same-origin" }).then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && Array.isArray(d.categories)) setCategories(d.categories.map((c: { name: string }) => c.name)); }).catch(() => {});
  }, [load]);

  const showToast = useCallback((t: Toast, ms = 6000) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(t);
    if (!t.keep) toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);

  // ── kiểm tại chỗ ──
  const localErr = useMemo(() => {
    const m: Record<string, string> = {};
    if (!draft) return m;
    const v = validateHomeContent(draft);
    const all = [...checkHomeCounts(draft), ...(v.ok ? [] : v.issues), ...checkHomeClaims(draft)];
    for (const i of all) if (!(i.path in m)) m[i.path] = i.message;
    return m;
  }, [draft]);
  const errors = useMemo(() => ({ ...localErr, ...serverErr }), [localErr, serverErr]);
  const errCount = Object.keys(errors).length;
  const changed = useMemo(() => (draft && saved ? diffHomeContent(saved, draft) : []), [draft, saved]);
  const dirty = changed.length > 0;
  const canSave = dirty && Object.keys(localErr).length === 0 && !saving && state === "ready";

  function edit(fn: (d: HomeContent) => void) {
    setDraft(prev => { if (!prev) return prev; const n = clone(prev); fn(n); return n; });
    setServerErr({});
  }

  // ── lưu ──
  const draftRef = useRef(draft), baseRef = useRef(base);
  const saveRef = useRef<(b?: string | null) => void>(() => {});
  async function save(forceBase?: string | null) {
    const sent = draftRef.current;
    if (!sent || saving) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/site-content/home", {
        method: "PUT", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: sent, baseUpdatedAt: forceBase !== undefined ? forceBase : baseRef.current }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.unchanged) { setBase(d.updatedAt ?? null); setSaved(clone(sent)); setConflict(null); }
      else if (r.ok) {
        setBase(d.updatedAt); setSaved(clone(d.content)); setIsDefault(false); setConflict(null); setServerErr({});
        setMeta({ updatedAt: d.updatedAt, by: "bạn" });
        if (JSON.stringify(draftRef.current) === JSON.stringify(sent)) setDraft(clone(d.content));
        showToast(d.revalidated === false
          ? { tone: "cho", title: "Đã lưu", detail: "Trang chủ có thể chậm tới 1 giờ mới đổi." }
          : { tone: "xong", title: "Đã lưu", detail: "Trang chủ cập nhật trong vài giây." });
      } else if (r.status === 422 && d.fields) {
        setServerErr(d.fields);
        const first = Object.keys(d.fields)[0];
        if (first) document.getElementById(fieldId(first))?.scrollIntoView({ behavior: "smooth", block: "center" });
        showToast({ tone: "loi", title: "Chưa lưu", detail: `Có ${Object.keys(d.fields).length} chỗ cần sửa.` });
      } else if (r.status === 409 && d.current) {
        setConflict(d.current as Conflict);
      } else {
        showToast({ tone: "loi", title: "Chưa lưu được", detail: "Nội dung bạn gõ vẫn còn đây.", action: { label: "Thử lại", run: () => saveRef.current() }, keep: true });
      }
    } catch {
      showToast({ tone: "loi", title: "Chưa lưu được", detail: "Nội dung bạn gõ vẫn còn đây.", action: { label: "Thử lại", run: () => saveRef.current() }, keep: true });
    } finally { setSaving(false); }
  }

  // Ctrl/Cmd+S, cảnh báo rời trang
  const canSaveRef = useRef(canSave);
  useEffect(() => { draftRef.current = draft; baseRef.current = base; canSaveRef.current = canSave; saveRef.current = (b) => { void save(b); }; });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (canSaveRef.current) saveRef.current(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank") return;
      const href = a.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href.startsWith("//")) return;
      e.preventDefault(); e.stopPropagation(); setLeave(href);
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => { window.removeEventListener("beforeunload", onUnload); document.removeEventListener("click", onClick, true); };
  }, [dirty]);

  // ── khôi phục ──
  function restore(ids: BlockId[], label: string) {
    if (!draft || !server) return;
    const prev = clone(draft);
    edit(d => { for (const id of ids) for (const k of BLOCKS[id].keys) (d as unknown as Record<string, unknown>)[k] = clone(server.defaults[k as keyof HomeContent]); });
    setOpen(null);
    showToast({ tone: "tin", title: `Đã khôi phục ${label}`, detail: "Chưa lưu.", action: { label: "Hoàn tác", run: () => { setDraft(prev); setToast(null); } } }, 8000);
  }

  if (state === "loading") {
    return (
      <div className={KIN_PAGE} aria-busy="true" data-home-state="loading">
        <KinPageHeader title="Trang chủ" sub="Chữ trên trang chủ công khai." />
        <div className="grid lg:grid-cols-[minmax(0,600px)_minmax(0,1fr)] gap-6">
          <div className="flex flex-col gap-4">{[1, 2, 3, 4, 5].map(i => <KinPanel key={i} className="p-5"><KinSkeleton /></KinPanel>)}</div>
          <div className="hidden lg:block h-[480px] rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-bang)]" />
        </div>
      </div>
    );
  }
  if (state === "error" || !draft || !saved || !server) {
    return (
      <div className={KIN_PAGE} data-home-state="error">
        <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Không tải được nội dung trang chủ"
          actions={<KinButton onClick={() => void load()}>Thử lại</KinButton>}>
          Chưa hiện biểu mẫu để tránh lưu nhầm một bản trắng.
        </KinStateCard>
      </div>
    );
  }

  const L = HOME_LIMITS, D = server.defaults;
  const lim = (p: string) => limitFor(p);
  const err = (p: string) => errors[p];
  const mainUrl = `https://${MAIN_HOST}/`;
  const catWarn = (href: string) => {
    if (!categories) return undefined;
    try {
      const u = new URL(href, "https://x.invalid");
      if (u.pathname.replace(/\/$/, "") !== "/khoa-hoc" || !href.startsWith("/")) return undefined;
      const c = u.searchParams.get("category");
      return c && !categories.includes(c) ? "Danh mục này hiện không có khoá nào, ô sẽ mở ra danh sách trống." : undefined;
    } catch { return undefined; }
  };
  const hrefHelp = (href: string) => catWarn(href) ?? (hrefNeedsManualCheck(href) && !href.startsWith("/khoa-hoc") ? "Hãy mở thử đường dẫn này." : "Bắt đầu bằng / (trong KiN) hoặc https://");
  const statusText = isDefault && !meta.updatedAt ? "Chưa sửa lần nào, đang dùng nội dung mặc định." : meta.updatedAt ? `Sửa lần cuối ${when(meta.updatedAt)}${meta.by ? ` bởi ${meta.by}` : ""}.` : "Đang dùng nội dung mặc định.";
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const linkFields = (basePath: string, v: { label: string; href: string }, set: (p: Partial<{ label: string; href: string }>) => void, name: string) => (
    <div className="grid sm:grid-cols-2 gap-3">
      <Field path={`${basePath}.label`} label={`Chữ ${name}`} value={v.label} onChange={x => set({ label: x })} limit={lim(`${basePath}.label`)} error={err(`${basePath}.label`)} />
      <Field path={`${basePath}.href`} label={`Đường dẫn ${name}`} value={v.href} onChange={x => set({ href: x })} limit={null} error={err(`${basePath}.href`)} list="home-href-list" help={hrefHelp(v.href)} warn={hiddenHrefWarning(v.href)} />
    </div>
  );

  return (
    <div className={KIN_PAGE} data-home-editor data-home-state="ready">
      <KinPageHeader title="Trang chủ" sub="Chữ trên trang chủ công khai. Số liệu (học sinh, đề thi, gia sư) lấy tự động từ hệ thống, không sửa ở đây."
        actions={<a href={mainUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-11 text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-nhan-link)] underline">Mở trang chủ<span aria-hidden> ↗</span></a>} />

      <div className="sticky top-0 z-20 -mx-4 md:-mx-10 px-4 md:px-10 py-2 mb-4 flex items-center justify-between gap-3 bg-[var(--kin-nen-trang)] border-b border-[var(--kin-vien-nhat)]">
        <p data-home-status className="min-w-0 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]" aria-live="polite">
          {saving ? "Đang lưu…" : dirty ? "Có thay đổi chưa lưu." : statusText}
        </p>
        <KinButton data-save disabled={!canSave} onClick={() => void save()}>{saving ? "Đang lưu…" : "Lưu"}</KinButton>
      </div>

      {leave && (
        <KinCallout className="mb-4" title="Còn thay đổi chưa lưu">
          <p>Rời trang này thì mất phần chưa lưu.</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <KinButton variant="secondary" onClick={() => setLeave(null)}>Ở lại</KinButton>
            <KinButton variant="danger" onClick={() => { setDirtyAndGo(leave); }}>Rời đi, bỏ thay đổi</KinButton>
          </div>
        </KinCallout>
      )}

      {conflict && (
        <div data-conflict className="mb-4"><KinPanel variant="canh-bao" className="p-4">
          <p className="font-medium text-[var(--kin-chu-chinh)]" role="alert">
            {(conflict.updatedBy?.name ?? "Một quản trị viên")} vừa lưu{conflict.updatedAt ? ` lúc ${hhmm(conflict.updatedAt)}` : ""}. Bạn đang sửa bản cũ hơn.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <KinButton variant="secondary" data-conflict-reload onClick={() => {
              setDraft(clone(conflict.content)); setSaved(clone(conflict.content)); setBase(conflict.updatedAt); setIsDefault(false);
              setMeta({ updatedAt: conflict.updatedAt, by: conflict.updatedBy?.name ?? null }); setConflict(null); setServerErr({});
            }}>Tải bản mới (mất thay đổi của bạn)</KinButton>
            <KinButton data-conflict-overwrite onClick={() => void save(conflict.updatedAt)}>Giữ bản của tôi và ghi đè</KinButton>
          </div>
        </KinPanel></div>
      )}

      {isDefault && !dirty && (
        <KinCallout className="mb-4">Chưa ai sửa: trang chủ đang dùng nội dung mặc định. Sửa một chỗ rồi bấm Lưu để bắt đầu quản lý ở đây.</KinCallout>
      )}

      <KinTabs className="lg:hidden mb-4" label="Chế độ xem" value={tab} onChange={setTab}
        tabs={[{ key: "sua", label: "Sửa" }, { key: "xem", label: "Xem trước" }]} />

      <div className="grid lg:grid-cols-[minmax(0,600px)_minmax(0,1fr)] gap-6 items-start">
        <div className={`${tab === "sua" ? "" : "hidden"} lg:block flex flex-col gap-4 min-w-0`} data-pane="sua">
          <nav aria-label="Các khối của trang chủ" className="flex gap-1 overflow-x-auto mb-4">
            {BLOCK_IDS.map(id => (
              <button key={id} type="button" onClick={() => jump(id)} className="min-h-11 px-3 whitespace-nowrap text-[length:var(--kin-co-goc)] text-[var(--kin-nhan-link)] underline">{BLOCKS[id].title}</button>
            ))}
          </nav>

          {errCount > 0 && (
            <div className="mb-4"><KinPanel variant="loi" className="p-4" data-error-summary>
              <p role="alert" className="font-medium text-[var(--kin-tt-chu-loi)]">Có {errCount} chỗ cần sửa</p>
              <ul className="mt-2 flex flex-col">
                {Object.entries(errors).slice(0, 8).map(([p, m]) => (
                  <li key={p}><button type="button" onClick={() => document.getElementById(fieldId(p))?.focus()} className="min-h-11 text-left text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] underline">{m}{p ? ` (${p})` : ""}</button></li>
                ))}
              </ul>
            </KinPanel></div>
          )}

          <div className="flex flex-col gap-4">
            {/* 1. Đầu trang */}
            <BlockCard id="khoi-dau" title="Đầu trang" canRestore={!sameKeys(draft, D, BLOCKS["khoi-dau"].keys)} onRestore={() => restore(["khoi-dau"], "khối Đầu trang")}>
              <Field path="badge" label="Dòng nhỏ trên tiêu đề" value={draft.badge} onChange={v => edit(d => { d.badge = v; })} limit={lim("badge")} error={err("badge")} />
              <Field path="title" label="Tiêu đề lớn" multiline rows={2} value={draft.title} onChange={v => edit(d => { d.title = v; })} limit={lim("title")} error={err("title")}
                help={`Enter để xuống dòng, tối đa ${L.titleLines} dòng, mỗi dòng ${L.titleLine} ký tự.`} />
              <Field path="lead" label="Mô tả" multiline rows={3} value={draft.lead} onChange={v => edit(d => { d.lead = v; })} limit={lim("lead")} error={err("lead")} />
              <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">Hai nút “Xem lớp học” và “Thi thử miễn phí” ở đầu trang là cố định.</p>
            </BlockCard>

            {/* 2. Ô kỳ thi */}
            <BlockCard id="khoi-ky-thi" title="Ô kỳ thi" hint={`Từ 1 đến ${L.examsMax} ô. Đường dẫn nên là danh sách khoá của đúng danh mục.`}
              canRestore={!sameKeys(draft, D, BLOCKS["khoi-ky-thi"].keys)} onRestore={() => restore(["khoi-ky-thi"], "khối Ô kỳ thi")}>
              {err("exams") && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{err("exams")}</p>}
              {draft.exams.map((ex, i) => (
                <fieldset key={i} className="flex flex-col gap-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-nhat)] p-3 min-w-0">
                  <legend className="px-1 text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">Ô {i + 1}</legend>
                  <Field path={`exams[${i}].label`} label="Chữ hiển thị" value={ex.label} onChange={v => edit(d => { d.exams[i].label = v; })} limit={lim(`exams[${i}].label`)} error={err(`exams[${i}].label`)} />
                  <Field path={`exams[${i}].desc`} label="Mô tả ngắn" value={ex.desc} onChange={v => edit(d => { d.exams[i].desc = v; })} limit={lim(`exams[${i}].desc`)} error={err(`exams[${i}].desc`)} />
                  <Field path={`exams[${i}].href`} label="Đường dẫn" value={ex.href} onChange={v => edit(d => { d.exams[i].href = v; })} limit={null} error={err(`exams[${i}].href`)} list="home-href-list" help={hrefHelp(ex.href)} warn={hiddenHrefWarning(ex.href)} />
                  {categories && categories.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`cat-${i}`} className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Lấy đường dẫn từ danh mục</label>
                      <KinSelect id={`cat-${i}`} data-cat-pick={i} value="" onChange={v => { const c = v; if (c) edit(d => { d.exams[i].href = "/khoa-hoc?category=" + encodeURIComponent(c); }); }}>
                        <option value="">Chọn danh mục…</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </KinSelect>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <KinButton variant="ghost" disabled={draft.exams.length <= 1} onClick={() => edit(d => { d.exams.splice(i, 1); })}>Xoá ô {i + 1}</KinButton>
                  </div>
                </fieldset>
              ))}
              <KinButton variant="secondary" disabled={draft.exams.length >= L.examsMax} onClick={() => edit(d => { d.exams.push({ label: "", desc: "", href: "/khoa-hoc" }); })}>Thêm ô kỳ thi</KinButton>
            </BlockCard>

            {/* 3. Lợi ích */}
            <BlockCard id="khoi-loi-ich" title="“Học ở đây thì được gì?”" hint={`Từ 1 đến ${L.cardsMax} thẻ.`}
              canRestore={!sameKeys(draft, D, BLOCKS["khoi-loi-ich"].keys)} onRestore={() => restore(["khoi-loi-ich"], "khối Lợi ích")}>
              <Field path="why.title" label="Tiêu đề" value={draft.why.title} onChange={v => edit(d => { d.why.title = v; })} limit={lim("why.title")} error={err("why.title")} />
              <Field path="why.subtitle" label="Dòng phụ" value={draft.why.subtitle} onChange={v => edit(d => { d.why.subtitle = v; })} limit={lim("why.subtitle")} error={err("why.subtitle")} />
              {err("why.cards") && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{err("why.cards")}</p>}
              <ul className="flex flex-col gap-2">
                {draft.why.cards.map((c, i) => {
                  const isOpen = open === i, bad = Object.keys(errors).some(p => p.startsWith(`why.cards[${i}]`));
                  const swap = (to: number) => { edit(d => { const [x] = d.why.cards.splice(i, 1); d.why.cards.splice(to, 0, x); }); setOpen(to); setMenu(null); };
                  return (
                    <li key={i} data-card={i} className="rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-nhat)] min-w-0">
                      <div className="flex items-center gap-2 p-2">
                        <p className="flex-1 min-w-0 truncate text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
                          {i + 1}. {c.title || "(chưa có tiêu đề)"}{bad && <span className="text-[var(--kin-tt-chu-loi)]"> · Có lỗi</span>}
                        </p>
                        <KinButton variant="secondary" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : i)}>{isOpen ? "Thu gọn" : "Sửa"}</KinButton>
                        <KinButton variant="ghost" aria-label={`Thêm thao tác cho thẻ ${i + 1}`} aria-expanded={menu === i} onClick={() => setMenu(menu === i ? null : i)}>⋯</KinButton>
                      </div>
                      {menu === i && (
                        <div className="flex flex-wrap gap-2 px-2 pb-2">
                          <KinButton variant="secondary" disabled={i === 0} onClick={() => swap(i - 1)}>Lên</KinButton>
                          <KinButton variant="secondary" disabled={i === draft.why.cards.length - 1} onClick={() => swap(i + 1)}>Xuống</KinButton>
                          <KinButton variant="danger" disabled={draft.why.cards.length <= 1} onClick={() => { edit(d => { d.why.cards.splice(i, 1); }); setOpen(null); setMenu(null); }}>Xoá</KinButton>
                        </div>
                      )}
                      {isOpen && (
                        <div className="flex flex-col gap-3 p-3 border-t border-[var(--kin-vien-nhat)]">
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Icon</span>
                            <IconPicker name={`thẻ ${i + 1}`} value={c.icon} onChange={(k: HomeIconKey) => edit(d => { d.why.cards[i].icon = k; })} />
                            {err(`why.cards[${i}].icon`) && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{err(`why.cards[${i}].icon`)}</p>}
                          </div>
                          <Field path={`why.cards[${i}].title`} label="Tiêu đề thẻ" value={c.title} onChange={v => edit(d => { d.why.cards[i].title = v; })} limit={lim(`why.cards[${i}].title`)} error={err(`why.cards[${i}].title`)} />
                          <Field path={`why.cards[${i}].desc`} label="Mô tả thẻ" multiline rows={3} value={c.desc} onChange={v => edit(d => { d.why.cards[i].desc = v; })} limit={lim(`why.cards[${i}].desc`)} error={err(`why.cards[${i}].desc`)} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <KinButton variant="secondary" disabled={draft.why.cards.length >= L.cardsMax} onClick={() => { edit(d => { d.why.cards.push({ icon: "star", title: "", desc: "" }); }); setOpen(draft.why.cards.length); }}>Thêm thẻ</KinButton>
            </BlockCard>

            {/* 4. Khối tìm gia sư */}
            <BlockCard id="khoi-gia-su" title="Khối tìm gia sư" hint="Liên kết “Đăng ký gia sư” bên dưới khối là cố định, không sửa ở đây."
              canRestore={!sameKeys(draft, D, BLOCKS["khoi-gia-su"].keys)} onRestore={() => restore(["khoi-gia-su"], "khối Tìm gia sư")}>
              <Field path="findTutor.title" label="Tiêu đề" value={draft.findTutor.title} onChange={v => edit(d => { d.findTutor.title = v; })} limit={lim("findTutor.title")} error={err("findTutor.title")} />
              <Field path="findTutor.desc" label="Mô tả" multiline rows={3} value={draft.findTutor.desc} onChange={v => edit(d => { d.findTutor.desc = v; })} limit={lim("findTutor.desc")} error={err("findTutor.desc")} />
              <div className="grid sm:grid-cols-2 gap-3">
                <Field path="findTutor.buttonLabel" label="Chữ trên nút" value={draft.findTutor.buttonLabel} onChange={v => edit(d => { d.findTutor.buttonLabel = v; })} limit={lim("findTutor.buttonLabel")} error={err("findTutor.buttonLabel")} />
                <Field path="findTutor.buttonHref" label="Đường dẫn của nút" value={draft.findTutor.buttonHref} onChange={v => edit(d => { d.findTutor.buttonHref = v; })} limit={null} error={err("findTutor.buttonHref")} list="home-href-list" help={hrefHelp(draft.findTutor.buttonHref)} warn={hiddenHrefWarning(draft.findTutor.buttonHref)} />
              </div>
              <Field path="findTutor.parentNote" label="Dòng ghi chú cho phụ huynh" multiline rows={2} value={draft.findTutor.parentNote} onChange={v => edit(d => { d.findTutor.parentNote = v; })} limit={lim("findTutor.parentNote")} error={err("findTutor.parentNote")} />
            </BlockCard>

            {/* 5. Kêu gọi */}
            <BlockCard id="khoi-keu-goi" title="Kêu gọi cuối trang" canRestore={!sameKeys(draft, D, BLOCKS["khoi-keu-goi"].keys)} onRestore={() => restore(["khoi-keu-goi"], "khối Kêu gọi")}>
              <Field path="cta.title" label="Tiêu đề" value={draft.cta.title} onChange={v => edit(d => { d.cta.title = v; })} limit={lim("cta.title")} error={err("cta.title")} />
              <Field path="cta.desc" label="Mô tả" multiline rows={3} value={draft.cta.desc} onChange={v => edit(d => { d.cta.desc = v; })} limit={lim("cta.desc")} error={err("cta.desc")} />
              {linkFields("cta.primary", draft.cta.primary, p => edit(d => { Object.assign(d.cta.primary, p); }), "nút 1")}
              {linkFields("cta.secondary", draft.cta.secondary, p => edit(d => { Object.assign(d.cta.secondary, p); }), "nút 2")}
            </BlockCard>

            <div className="pt-2 pb-8">
              <KinButton variant="secondary" data-restore-all disabled={BLOCK_IDS.every(id => sameKeys(draft, D, BLOCKS[id].keys))} onClick={() => restore(BLOCK_IDS, "toàn bộ trang")}>Khôi phục toàn bộ trang</KinButton>
            </div>
          </div>
        </div>

        <div className={`${tab === "xem" ? "" : "hidden"} lg:block lg:sticky lg:top-20 min-w-0`} data-pane="xem">
          <PreviewFrame draft={draft} valid={Object.keys(localErr).length === 0} />
        </div>
      </div>

      <datalist id="home-href-list">{HREF_SUGGESTIONS.map(h => <option key={h} value={h} />)}</datalist>

      {toast && (
        <div className="fixed left-4 right-4 sm:left-auto bottom-20 md:bottom-6 z-50 flex justify-end" data-toast>
          <KinToast tone={toast.tone} title={toast.title} onClose={() => setToast(null)}
            detail={<>{toast.detail}{toast.action && <> <button type="button" onClick={toast.action.run} className="min-h-11 px-2 font-medium underline text-[var(--kin-nhan-link)]">{toast.action.label}</button></>}</>} />
        </div>
      )}
    </div>
  );

  function setDirtyAndGo(href: string) { window.onbeforeunload = null; setLeave(null); window.location.assign(href); }
}
