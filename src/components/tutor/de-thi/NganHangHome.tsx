// BU-03 P1 · S1 — Ngân hàng câu hỏi của gia sư (/lop-cua-toi/de-thi/ngan-hang-cau-hoi). Thay trang quản trị dùng chung (thẻ ngân hàng) bằng:
// cây Môn › Lớp › Chương › Yêu cầu cần đạt (có tên tầng) + ma trận chương × NB/TH/VD/VDC + bộ lọc kho (của tôi / dùng chung / tất cả) + ba lối nhập.
// 1600px: hai cột (cây 320px · nội dung). 390px: một cột, cây nằm trong ngăn "Chọn nút".
// Số liệu lấy từ GET /api/tutor/ngan-hang/thong-ke (đã có phạm vi kho; không trả tên người, không trả nội dung câu).
// Nút gốc "Môn" gia sư không tự tạo được (quản trị gieo) — chưa có thì trạng thái rỗng nói rõ.
"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { KinPage, KinPageHeader, KinPageSkeleton, KIN_LABEL } from "@/components/kin/PageLayout";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinStateCard } from "@/components/kin/StateCard";
import { KinTabs } from "@/components/kin/Tabs";
import { IMPORT_HREF } from "@/components/tutor/quiz/quizClient";
import {
  fetchCategories, fetchStats, LEVELS, LEVEL_LABEL, nganHangNodeHref, nganHangSoanTayHref, nhapWordHref, SCOPE_LABEL,
  type CategoryFlat, type Counts, type Scope, type StatNode, type StatsRes,
} from "./deThiClient";
import { KinSelect } from "@/components/kin/KinSelect";

const CELL = "px-3 py-2 text-right tabular-nums whitespace-nowrap";
const HEAD_CELL = "px-3 py-2 text-right font-normal whitespace-nowrap";

function CountCells({ c, strong = false }: { c: Counts; strong?: boolean }) {
  return (
    <>
      {LEVELS.map(l => <td key={l} className={`${CELL} ${c[l] === 0 ? "text-[var(--kin-chu-mo)]" : "text-[var(--kin-chu-chinh)]"}`}>{c[l]}</td>)}
      <td className={`${CELL} ${c.none === 0 ? "text-[var(--kin-chu-mo)]" : "text-[var(--kin-chu-chinh)]"}`}>{c.none}</td>
      <td className={`${CELL} ${strong ? "font-medium" : ""} text-[var(--kin-chu-chinh)]`}>{c.total}</td>
    </>
  );
}
const MatrixHead = ({ first }: { first: string }) => (
  <tr className="bg-[var(--kin-nen-bang)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
    <th scope="col" className="px-3 py-2 text-left font-normal">{first}</th>
    {LEVELS.map(l => <th key={l} scope="col" className={HEAD_CELL} title={LEVEL_LABEL[l]}>{l}</th>)}
    <th scope="col" className={HEAD_CELL}>Chưa gắn mức</th>
    <th scope="col" className={HEAD_CELL}>Tổng</th>
  </tr>
);

export default function NganHangHome() {
  const [cats, setCats] = useState<CategoryFlat[] | null>(null);
  const [catErr, setCatErr] = useState<string | null>(null);
  const [rootId, setRootId] = useState<string | null>(null);
  const [scope, setScope] = useState<Scope>("all");
  const [stats, setStats] = useState<StatsRes | null>(null);
  const [statsErr, setStatsErr] = useState<{ key: string; msg: string } | null>(null);
  const [statsFor, setStatsFor] = useState<string | null>(null); // khoá "gốc|kho" của số liệu đang giữ
  const [reload, setReload] = useState(0);
  const [selId, setSelId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState(false);
  const [openChapters, setOpenChapters] = useState<Set<string>>(new Set());

  // Mọi setState nằm trong hàm gọi lại sau khi có phản hồi (không đồng bộ trong thân effect).
  useEffect(() => {
    let alive = true;
    void fetchCategories().then(r => {
      if (!alive) return;
      if (!r.ok || !r.data) { setCatErr(r.error ?? "Chưa tải được ngân hàng."); return; }
      setCats(r.data);
      const rs = r.data.filter(c => !c.parentId);
      setRootId(cur => (cur && rs.some(x => x.id === cur) ? cur : rs[0]?.id ?? null));
    });
    return () => { alive = false; };
  }, [reload]);
  function retryCats() { setCatErr(null); setCats(null); setReload(n => n + 1); }

  const statsKey = rootId ? `${rootId}|${scope}` : null;
  useEffect(() => {
    if (!rootId || !statsKey) return;
    let alive = true;
    void fetchStats(rootId, scope).then(r => {
      if (!alive) return;
      setStatsFor(statsKey);
      if (!r.ok || !r.data) { setStatsErr({ key: statsKey, msg: r.error ?? "Chưa tải được số liệu." }); return; }
      setStatsErr(null); setStats(r.data);
      // Mặc định gập từ tầng Chương trở xuống (Môn và Lớp mở sẵn) để cây gọn trên điện thoại.
      setCollapsed(prev => (prev.size ? prev : new Set(r.data!.nodes.filter(n => n.depth >= 2).map(n => n.id))));
    });
    return () => { alive = false; };
  }, [rootId, scope, statsKey, reload]);
  const statsBusy = !!statsKey && statsFor !== statsKey;
  const statsErrMsg = statsErr && statsErr.key === statsKey ? statsErr.msg : null;
  function retryStats() { setStatsFor(null); setReload(n => n + 1); }

  const roots = useMemo(() => (cats ?? []).filter(c => !c.parentId), [cats]);
  const byParent = useMemo(() => {
    const m = new Map<string | null, StatNode[]>();
    for (const n of stats?.nodes ?? []) m.set(n.parentId, [...(m.get(n.parentId) ?? []), n]);
    return m;
  }, [stats]);
  // Máy chủ trả cả nút gốc (parentId null) hoặc chỉ các con của gốc: chịu được cả hai.
  const topParent = byParent.get(null)?.length ? null : rootId;
  const selected = useMemo(() => stats?.nodes.find(n => n.id === selId) ?? stats?.nodes.find(n => n.id === rootId) ?? null, [stats, selId, rootId]);

  function toggle(id: string) { setCollapsed(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }); }
  function pickNode(id: string) { setSelId(id); setDrawer(false); }

  function renderTree(parent: string | null, depth: number): ReactNode {
    const list = byParent.get(parent) ?? [];
    if (!list.length) return null;
    return (
      <ul role={depth === 0 ? "tree" : "group"} aria-label={depth === 0 ? "Cây ngân hàng câu hỏi" : undefined} className={depth === 0 ? "" : "ml-4 border-l border-[var(--kin-vien-nhat)]"}>
        {list.map(n => {
          const hasKids = (byParent.get(n.id) ?? []).length > 0;
          const closed = collapsed.has(n.id);
          const active = selected?.id === n.id;
          return (
            <li key={n.id} role="treeitem" aria-expanded={hasKids ? !closed : undefined} aria-selected={active}>
              <div className="flex items-stretch">
                {hasKids
                  ? <button type="button" onClick={() => toggle(n.id)} aria-label={`${closed ? "Mở" : "Gập"} ${n.name}`} className="min-h-11 min-w-11 flex items-center justify-center text-[var(--kin-chu-mo)]"><span aria-hidden>{closed ? "▸" : "▾"}</span></button>
                  : <span aria-hidden className="min-w-11" />}
                <button type="button" onClick={() => pickNode(n.id)} aria-current={active ? "true" : undefined}
                  className={`flex-1 min-w-0 min-h-11 text-left px-2 rounded-[var(--kin-bo-sm)] ${active ? "bg-[var(--kin-nen-nhan)] text-[var(--kin-chu-chinh)] font-medium" : "text-[var(--kin-chu-phu)] hover:bg-[var(--kin-nen-re-chuot)]"}`}>
                  <span className="block truncate text-[length:var(--kin-co-goc)]">{n.name}</span>
                  <span className="block truncate text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">{n.label} · {n.sub.total} câu</span>
                </button>
              </div>
              {hasKids && !closed && renderTree(n.id, depth + 1)}
            </li>
          );
        })}
      </ul>
    );
  }

  // ── Ba trạng thái ──
  if (catErr) {
    return (
      <KinPage>
        <KinPageHeader title="Ngân hàng câu hỏi" />
        <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được ngân hàng câu hỏi" actions={<KinButton onClick={retryCats}>Thử lại</KinButton>}>
          {catErr}
        </KinStateCard>
      </KinPage>
    );
  }
  if (!cats) return <KinPageSkeleton label="Đang tải ngân hàng câu hỏi" rows={5} />;

  const importActions = (
    <>
      <Link href={nhapWordHref(selId)} className={kinButtonClass("primary")}>Nhập từ Word</Link>
      <Link href={IMPORT_HREF} className={kinButtonClass("secondary")}>Nhập từ PDF/ảnh (AI)</Link>
      <Link href={nganHangSoanTayHref()} className={kinButtonClass("secondary")}>Soạn tay</Link>
    </>
  );

  if (roots.length === 0) {
    return (
      <KinPage>
        <KinPageHeader title="Ngân hàng câu hỏi" sub="Môn › Lớp › Chương › Yêu cầu cần đạt" />
        <KinEmptyState title="Ngân hàng chưa có môn nào" action={<div className="flex flex-wrap gap-3 justify-center"><Link href={nganHangSoanTayHref()} className={kinButtonClass("primary")}>Soạn câu hỏi tay</Link><Link href="/lop-cua-toi/ho-tro" className={kinButtonClass("secondary")}>Nhắn hỗ trợ</Link></div>}>
          Nút gốc “Môn” do quản trị KiN tạo sẵn, cô chưa tự tạo được. Khi có môn, cô thêm Lớp, Chương, Yêu cầu cần đạt bên dưới và nhập câu hỏi từ Word vào đó. Cô nhắn hỗ trợ nếu cần mở môn.
        </KinEmptyState>
      </KinPage>
    );
  }

  const matrix = stats?.chapterMatrix ?? [];
  const grand = stats?.nodes.find(n => n.id === rootId)?.sub;

  return (
    <KinPage>
      <KinPageHeader title="Ngân hàng câu hỏi" sub="Môn › Lớp › Chương › Yêu cầu cần đạt · mức NB / TH / VD / VDC" actions={importActions} />

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 pb-4">
        {roots.length > 1 && (
          <div className="min-w-0 w-full sm:w-64">
            <label htmlFor="nh-mon" className={`${KIN_LABEL} mb-2`}>Môn</label>
            <KinSelect id="nh-mon" value={rootId ?? ""} onChange={v => { setRootId(v); setSelId(null); setStats(null); setCollapsed(new Set()); }}>
              {roots.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </KinSelect>
          </div>
        )}
        <KinTabs<Scope> label="Kho câu hỏi" value={scope} onChange={setScope} className="min-w-0 max-w-full"
          tabs={(["all", "mine", "shared"] as const).map(k => ({ key: k, label: SCOPE_LABEL[k] }))} />
      </div>
      <p className="pb-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
        {scope === "mine" ? "Chỉ câu cô tự nhập (nháp, chờ duyệt, đã duyệt)." : scope === "shared" ? "Chỉ câu đã được duyệt, dùng chung cho mọi gia sư." : "Câu đã duyệt của mọi người cộng câu của riêng cô. Câu nháp của gia sư khác không hiện."}
      </p>

      <div className="lg:hidden pb-4">
        <KinButton variant="secondary" block aria-expanded={drawer} aria-controls="nh-cay" onClick={() => setDrawer(d => !d)}>
          {drawer ? "Đóng cây" : `Chọn nút · ${selected?.name ?? "chưa chọn"}`}
        </KinButton>
      </div>

      <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-x-8 gap-y-6 items-start">
        <aside id="nh-cay" aria-label="Cây ngân hàng" className={`${drawer ? "block" : "hidden"} lg:block min-w-0 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] p-2 lg:sticky lg:top-4 lg:max-h-[calc(100vh-6rem)] overflow-y-auto`}>
          {!stats && !statsErrMsg && <p role="status" aria-busy="true" className="p-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đang tải cây…</p>}
          {stats && renderTree(topParent, 0)}
          {stats && stats.nodes.length === 0 && <p className="p-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Môn này chưa có nút nào.</p>}
        </aside>

        <div className="min-w-0 space-y-8" aria-busy={statsBusy || undefined}>
          {statsErrMsg && (
            <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được số liệu" actions={<KinButton onClick={retryStats}>Thử lại</KinButton>}>
              {statsErrMsg}
            </KinStateCard>
          )}

          {!stats && !statsErrMsg && <div aria-busy="true" aria-label="Đang tải số liệu" className="space-y-3"><div className="h-24 rounded kin-skel kin-skel--soft" /><div className="h-64 rounded kin-skel kin-skel--soft" /></div>}

          {stats && selected && (
            <section aria-labelledby="nh-nut" className={statsBusy ? "opacity-60" : ""}>
              <KinSectionHead id="nh-nut" title={selected.name} aside={selected.label} />
              <dl className="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-x-4 gap-y-4">
                {LEVELS.map(l => (
                  <div key={l} className="min-w-0"><dt className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{LEVEL_LABEL[l]}</dt><dd className="text-[22px] leading-7 tabular-nums text-[var(--kin-chu-chinh)]">{selected.sub[l]}</dd></div>
                ))}
                <div className="min-w-0"><dt className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Chưa gắn mức</dt><dd className="text-[22px] leading-7 tabular-nums text-[var(--kin-chu-chinh)]">{selected.sub.none}</dd></div>
                <div className="min-w-0"><dt className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Tổng (cả nhánh)</dt><dd className="text-[22px] leading-7 tabular-nums font-medium text-[var(--kin-chu-chinh)]">{selected.sub.total}</dd></div>
              </dl>
              <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Riêng nút này: {selected.own.total} câu. Số trong ngoặc của cây là cả nhánh con.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={nganHangNodeHref(selected.id)} className={kinButtonClass("secondary")}>Xem câu hỏi trong nút này</Link>
                <Link href={nhapWordHref(selected.id)} className={kinButtonClass("secondary")}>Nhập Word vào nút này</Link>
              </div>
              {grand && grand.total === 0 && (
                <div className="mt-6">
                  <KinEmptyState title="Môn này chưa có câu hỏi nào" action={<Link href={nhapWordHref(selected.id)} className={kinButtonClass("primary")}>Nhập từ Word</Link>}>
                    Cô nhập đề Word theo mẫu Azota để có câu hỏi đầu tiên (không tốn lượt AI), hoặc soạn tay từng câu.
                  </KinEmptyState>
                </div>
              )}
            </section>
          )}

          {stats && (
            <section aria-labelledby="nh-mt" className={statsBusy ? "opacity-60" : ""}>
              <KinSectionHead id="nh-mt" title="Số câu theo chương và mức" aside={`${matrix.length} chương`} />
              {matrix.length === 0 ? (
                <KinEmptyState title="Chưa có chương nào để thống kê" action={<Link href={nganHangNodeHref(rootId ?? "")} className={kinButtonClass("secondary")}>Mở môn để thêm chương</Link>}>
                  Thêm nút Chương (và Yêu cầu cần đạt bên dưới) trong môn này, ma trận sẽ hiện số câu theo từng mức.
                </KinEmptyState>
              ) : (
                <div tabIndex={0} role="region" aria-label="Bảng số câu theo chương và mức, cuộn ngang được" className="mt-4 overflow-x-auto rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)]">
                  <table className="w-full min-w-[34rem] text-[length:var(--kin-co-goc)]">
                    <thead><MatrixHead first="Chương / Yêu cầu cần đạt" /></thead>
                    <tbody>
                      {matrix.map(ch => {
                        const open = openChapters.has(ch.chapterId);
                        return (
                          <ChapterRows key={ch.chapterId} ch={ch} open={open}
                            onToggle={() => setOpenChapters(s => { const n = new Set(s); if (n.has(ch.chapterId)) n.delete(ch.chapterId); else n.add(ch.chapterId); return n; })}
                            onPick={() => pickNode(ch.chapterId)} />
                        );
                      })}
                      {grand && (
                        <tr className="border-t border-[var(--kin-vien-thuong)] font-medium"><th scope="row" className="px-3 py-2 text-left font-medium">Cộng cả môn</th><CountCells c={grand} strong /></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
              <KinCallout className="mt-4" title="Đọc bảng thế nào">
                Ô “Chưa gắn mức” là câu chưa được đặt NB/TH/VD/VDC; những câu này chưa bốc được vào đề theo ma trận. Khi nhập Word, cô đặt mức ngay ở bước xem lại.
              </KinCallout>
            </section>
          )}
        </div>
      </div>
    </KinPage>
  );
}

function ChapterRows({ ch, open, onToggle, onPick }: { ch: StatsRes["chapterMatrix"][number]; open: boolean; onToggle: () => void; onPick: () => void }) {
  const hasKids = ch.yccd.length > 0;
  return (
    <>
      <tr className="border-t border-[var(--kin-vien-nhat)]">
        <th scope="row" className="px-1 py-1 text-left font-normal min-w-0">
          <div className="flex items-center">
            {hasKids
              ? <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`${open ? "Gập" : "Mở"} yêu cầu cần đạt của ${ch.name}`} className="min-h-11 min-w-11 text-[var(--kin-chu-mo)]"><span aria-hidden>{open ? "▾" : "▸"}</span></button>
              : <span aria-hidden className="min-w-11" />}
            <button type="button" onClick={onPick} className="min-h-11 px-1 text-left text-[var(--kin-chu-chinh)] hover:underline break-words">{ch.name}</button>
          </div>
        </th>
        <CountCells c={ch.counts} strong />
      </tr>
      {open && ch.yccd.map(y => (
        <tr key={y.id} className="border-t border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-bang)]">
          <th scope="row" className="pl-12 pr-3 py-2 text-left font-normal text-[var(--kin-chu-phu)] break-words">{y.name}</th>
          <CountCells c={y.counts} />
        </tr>
      ))}
    </>
  );
}
