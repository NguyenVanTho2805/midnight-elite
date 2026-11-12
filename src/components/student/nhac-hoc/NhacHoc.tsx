// LOI-04 — "Nhắc học" của học sinh (kiểu Reminders): việc em tự ghi + buổi học có hẹn ngày. Đặc tả: docs/kin/phong-ban/dac-ta/LOI-04.md mục 5.
// Dữ liệu: GET /api/student/nhac-hoc (NhacResp) — MÁY CHỦ cấp `now`/`todayKey`; nhóm tính bằng chiaNhom(items, new Date(resp.now)), làm mới mỗi lần tải lại.
// Ghi: fetch JSON (POST / PATCH / DELETE / xoa-da-xong) + AbortController 15 giây (./api.ts). Lỗi / hết giờ ⇒ tải lại danh sách rồi báo lỗi TẠI CHỖ; không báo thành công giả.
// Bố cục theo bề rộng KHUNG NỘI DUNG (container query, không theo màn hình — thanh bên rộng/hẹp đổi chỗ trống):
//   ≥ 1000px: 3 cột — nhóm + thẻ 240px · danh sách · panel chi tiết 400px (không phủ màn).
//   720–999px: hàng nhóm + thẻ ở trên; danh sách · panel 360px.
//   < 720px (điện thoại): một cột; bấm hàng ⇒ chi tiết THAY danh sách trong trang (?muc=<id> bằng history.pushState, nút Quay lại của máy về danh sách). Không modal.
// Mục tự động theo lớp (PhieuBuoiHoc) chỉ ở "Hôm nay" và "Đã hẹn", trên các mục tự ghi; ẩn khi đang lọc thẻ (bài lớp không mang thẻ).
// Quản trị xem thử: API 403 ⇒ câu "Nhắc học chỉ dùng được với tài khoản học sinh." (không ErrorStrip đỏ).
// Ghi chú là dữ liệu riêng: không vào title trang, không console.log.
// Móc kiểm thử: [data-nhac-hoc], [data-nhac-nhom=<key>], [data-nhac-the=<tag>], [data-nhac-bo-loc], [data-nhac-them], [data-nhac-them-loi], [data-nhac-danh-sach=<nhóm>],
// [data-nhac-muc=<id>], [data-nhac-mo], [data-nhac-xong], [data-nhac-rong=<nhóm>], [data-nhac-xoa-da-xong], [data-nhac-gan-du], [data-nhac-khong-phai-hoc-sinh].
"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { kinButtonClass } from "@/components/kin/Button";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinPanel } from "@/components/kin/Panel";
import { KinStatus } from "@/components/kin/Status";
import { KIN_FIELD } from "@/components/kin/PageLayout";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { WorkSkeleton } from "@/components/student/shared";
import { addDaysKey } from "@/lib/classSessions";
import { vnDayLong, vnDayTitle, type HomNayItem, type HomNayUpcomingItem } from "@/lib/studentLop";
import {
  NHAC_NHOM_KEYS, NHAC_NHOM_LABEL, NHAC_TITLE_MAX,
  chiaNhom, cleanNhacCreate, demThe, dueLabel, isOverdue, locTheoThe,
  type NhacItem, type NhacNhom, type NhacResp,
} from "@/lib/nhacHoc";
import { NHAC_API, nhacFetch } from "./api";
import NhacHocChiTiet, { NhacDoneBox } from "./NhacHocChiTiet";
import { PhieuBuoiHoc } from "./PhieuBuoiHoc";

const GOC = "text-[length:var(--kin-co-goc)]";
const NEAR_FULL = 480;
const EMPTY_TEXT: Record<Exclude<NhacNhom, "tat-ca">, string> = {
  "hom-nay": "Hôm nay chưa có việc nào. Gõ vào ô trên để thêm.",
  "da-hen": "Chưa hẹn việc nào cho những ngày tới.",
  "da-xong": "Chưa có việc nào đã xong.",
};
type Lesson = HomNayItem | HomNayUpcomingItem;
type Load = { s: "dang-tai" } | { s: "loi" } | { s: "khong-phai-hoc-sinh" } | { s: "ok"; data: NhacResp };

const mucOfUrl = (): string | null => {
  try { return new URL(window.location.href).searchParams.get("muc"); } catch { return null; }
};

function NhacRow({ it, now, selected, pending, onOpen, onToggle }: {
  it: NhacItem; now: Date; selected: boolean; pending: boolean; onOpen: (id: string) => void; onToggle: (it: NhacItem, done: boolean) => void;
}) {
  const overdue = isOverdue(it, now);
  const done = !!it.doneAt;
  const label = dueLabel(it, now);
  const sub = [overdue ? label.replace(/^Quá hạn · /, "") : label, ...it.tags.map(t => `#${t}`), it.lop?.courseName ?? ""].filter(Boolean).join(" · ");
  return (
    <li data-nhac-muc={it.id} data-nhac-qua-han={overdue ? "" : undefined}
      className={`flex items-start gap-1 pl-1 pr-[var(--kin-kc-5)] border-b border-[var(--kin-vien-nhat)] last:border-b-0 ${selected ? "bg-[var(--kin-nen-dang-chon)]" : ""}`}>
      <NhacDoneBox checked={done} disabled={pending} label={`Đánh dấu xong: ${it.title}`} hook={{ "data-nhac-xong": "" }} onChange={v => onToggle(it, v)} />
      <button type="button" data-nhac-mo onClick={() => onOpen(it.id)} aria-current={selected ? "true" : undefined}
        className="flex-1 min-w-0 min-h-11 py-[10px] text-left hover:bg-[var(--kin-nen-re-chuot)] rounded-[var(--kin-bo-sm)] px-1">
        <span className={`block text-[length:var(--kin-co-body)] leading-6 break-words [overflow-wrap:anywhere] ${done ? "line-through text-[var(--kin-chu-mo)]" : "text-[var(--kin-chu-chinh)]"}`}>{it.title}</span>
        {sub && <span className={`block mt-0.5 ${GOC} leading-5 text-[var(--kin-chu-mo)] break-words [overflow-wrap:anywhere]`}>{sub}</span>}
      </button>
      {overdue && <span className="pt-3 flex-shrink-0"><KinStatus tone="loi">Quá hạn</KinStatus></span>}
    </li>
  );
}

export default function NhacHoc() {
  const [st, setSt] = useState<Load>({ s: "dang-tai" });
  const [reloadErr, setReloadErr] = useState(false);
  const [nhom, setNhom] = useState<NhacNhom>("hom-nay");
  const [tag, setTag] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const pushed = useRef(false);
  const [quick, setQuick] = useState("");
  const [quickBusy, setQuickBusy] = useState(false);
  const quickLock = useRef(false);
  const [quickErr, setQuickErr] = useState("");
  const quickRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [listErr, setListErr] = useState("");
  const [noteBusy, setNoteBusy] = useState<string | null>(null);
  const [clearBusy, setClearBusy] = useState(false);
  const { ask, dialog } = useKinConfirm();

  /** Tải từ máy chủ. Lần đầu lỗi ⇒ màn lỗi; đã có dữ liệu mà tải lại lỗi ⇒ giữ danh sách cũ + ErrorStrip. */
  const load = useCallback(async () => {
    const r = await nhacFetch<NhacResp>(NHAC_API);
    if (r.ok) {
      const d = r.data;
      const lop = d.lop && typeof d.lop === "object" ? d.lop : { now: d.now, todayKey: d.todayKey, today: [], upcoming: [] };
      setSt({ s: "ok", data: { ...d, items: Array.isArray(d.items) ? d.items : [], lop: { ...lop, today: Array.isArray(lop.today) ? lop.today : [], upcoming: Array.isArray(lop.upcoming) ? lop.upcoming : [] } } });
      setReloadErr(false);
      return;
    }
    if (r.status === 403) { setSt({ s: "khong-phai-hoc-sinh" }); return; }
    setSt(prev => (prev.s === "ok" ? prev : { s: "loi" }));
    setReloadErr(true);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => { setOpenId(mucOfUrl()); return load(); });
    const onFocus = () => void load();
    const onPop = () => { pushed.current = false; setOpenId(mucOfUrl()); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("popstate", onPop);
    return () => { window.removeEventListener("focus", onFocus); window.removeEventListener("popstate", onPop); };
  }, [load]);

  const retry = useCallback(() => { setSt(prev => (prev.s === "ok" ? prev : { s: "dang-tai" })); void load(); }, [load]);

  const data = st.s === "ok" ? st.data : null;
  const now = useMemo(() => (data ? new Date(data.now) : new Date(0)), [data]);
  const groups = useMemo(() => (data ? chiaNhom(data.items, now) : null), [data, now]);
  const tagCounts = useMemo(() => (data ? demThe(data.items) : []), [data]);
  const openItem = data && openId ? data.items.find(i => i.id === openId) ?? null : null;

  const upsert = useCallback((it: NhacItem) => {
    setSt(prev => {
      if (prev.s !== "ok") return prev;
      const has = prev.data.items.some(x => x.id === it.id);
      const items = has ? prev.data.items.map(x => (x.id === it.id ? it : x)) : [it, ...prev.data.items];
      return { s: "ok", data: { ...prev.data, items, used: has ? prev.data.used : prev.data.used + 1 } };
    });
  }, []);
  const dropItem = useCallback((id: string) => {
    setSt(prev => (prev.s !== "ok" ? prev : { s: "ok", data: { ...prev.data, items: prev.data.items.filter(x => x.id !== id), used: Math.max(0, prev.data.used - 1) } }));
  }, []);

  // ── Mở / đóng chi tiết (?muc=<id>) ───────────────────────────────────────
  const openDetail = useCallback((id: string) => {
    const u = new URL(window.location.href);
    const had = u.searchParams.has("muc");
    u.searchParams.set("muc", id);
    const href = `${u.pathname}${u.search}${u.hash}`;
    if (had) window.history.replaceState(null, "", href);
    else { window.history.pushState(null, "", href); pushed.current = true; }
    setOpenId(id);
  }, []);
  const closeDetail = useCallback(() => {
    const id = openId;
    setOpenId(null);
    if (pushed.current) { pushed.current = false; window.history.back(); }
    else {
      const u = new URL(window.location.href);
      u.searchParams.delete("muc");
      window.history.replaceState(null, "", `${u.pathname}${u.search}${u.hash}`);
    }
    if (id) requestAnimationFrame(() => (document.querySelector(`[data-nhac-muc="${CSS.escape(id)}"] [data-nhac-mo]`) as HTMLElement | null)?.focus());
  }, [openId]);
  // Mục đang mở không còn (đã xoá / xoá các mục đã xong / id lạ trong URL) ⇒ đóng chi tiết.
  useEffect(() => {
    if (data && openId && !openItem) void Promise.resolve().then(closeDetail);
  }, [data, openId, openItem, closeDetail]);

  // ── Ghi ──────────────────────────────────────────────────────────────────
  async function addQuick(e: FormEvent) {
    e.preventDefault();
    if (!data || quickLock.current) return; // chống Enter đôi: khoá ngay, không chờ React vẽ lại
    const text = quick.trim();
    if (!text) return;
    const body: Record<string, unknown> = { title: text };
    if (nhom === "hom-nay") body.dueDate = data.todayKey;
    else if (nhom === "da-hen") body.dueDate = addDaysKey(data.todayKey, 1);
    if (tag) body.tags = [tag];
    const c = cleanNhacCreate(body, data.todayKey);
    if (!c.ok) { setQuickErr(c.error); return; }
    quickLock.current = true; setQuickBusy(true); setQuickErr("");
    const r = await nhacFetch<{ item?: NhacItem }>(NHAC_API, { method: "POST", body });
    if (r.ok && r.data.item) { upsert(r.data.item); setQuick(""); }
    else { setQuickErr(r.ok ? "Chưa lưu được, thử lại nhé." : r.error); await load(); }
    quickLock.current = false; setQuickBusy(false);
    requestAnimationFrame(() => quickRef.current?.focus());
  }

  async function toggleDone(it: NhacItem, done: boolean) {
    if (pending[it.id]) return;
    setPending(p => ({ ...p, [it.id]: true })); setListErr("");
    const r = await nhacFetch<{ item?: NhacItem }>(`${NHAC_API}/${encodeURIComponent(it.id)}`, { method: "PATCH", body: { done } });
    setPending(p => ({ ...p, [it.id]: false }));
    if (r.ok && r.data.item) { upsert(r.data.item); return; }
    setListErr(`${done ? "Chưa đánh dấu xong được" : "Chưa bỏ đánh dấu được"}: ${r.ok ? "thử lại nhé." : r.error}`);
    await load();
  }

  async function noteForLesson(l: Lesson) {
    if (!data || noteBusy) return;
    const body = { title: `Ghi chú: ${l.lessonTitle.replace(/#/g, "")}`.slice(0, NHAC_TITLE_MAX) /* bỏ "#" để tên bài không bị máy chủ tách thành thẻ */, lessonId: l.lessonId, dueDate: l.dateKey, dueTime: l.time };
    setNoteBusy(l.lessonId); setListErr("");
    const r = await nhacFetch<{ item?: NhacItem }>(NHAC_API, { method: "POST", body });
    setNoteBusy(null);
    if (r.ok && r.data.item) { upsert(r.data.item); openDetail(r.data.item.id); return; }
    setListErr(`Chưa tạo được ghi chú cho buổi này: ${r.ok ? "thử lại nhé." : r.error}`);
    await load();
  }

  async function clearDone() {
    if (!(await ask({ title: "Xoá các mục đã xong?", message: "Các nhắc việc đã đánh dấu xong sẽ bị xoá hẳn, không lấy lại được.", confirmLabel: "Xoá các mục đã xong" }))) return;
    setClearBusy(true); setListErr("");
    const r = await nhacFetch<{ deleted?: number }>(`${NHAC_API}/xoa-da-xong`, { method: "POST" });
    setClearBusy(false);
    if (!r.ok) setListErr(`Chưa xoá được các mục đã xong: ${r.error}`);
    await load();
  }

  // ── Vẽ ───────────────────────────────────────────────────────────────────
  const head = (
    <header className={`pb-6 ${openId ? "@max-[720px]:hidden" : ""}`}>
      <h1 className="text-[length:var(--kin-co-h2)] leading-9 font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)]">Nhắc học</h1>
      <p className={`mt-1 ${GOC} text-[var(--kin-chu-mo)]`}>Việc bạn tự ghi và buổi học có hẹn ngày. Chỉ mình bạn xem được.</p>
    </header>
  );

  let body: React.ReactNode;
  if (st.s === "dang-tai") body = <WorkSkeleton label="Đang tải Nhắc học" />;
  else if (st.s === "loi") body = <div data-nhac-loi><ErrorStrip message="Không tải được Nhắc học." onRetry={retry} /></div>;
  else if (st.s === "khong-phai-hoc-sinh") {
    body = <KinEmptyState title="Nhắc học chỉ dùng được với tài khoản học sinh." className="text-left md:text-center"><span data-nhac-khong-phai-hoc-sinh>Đăng nhập bằng tài khoản học sinh để ghi và hẹn việc học của mình.</span></KinEmptyState>;
  } else if (data && groups) {
    const counts = Object.fromEntries(NHAC_NHOM_KEYS.map(k => [k, groups[k].length])) as Record<NhacNhom, number>;
    const shown = locTheoThe(groups[nhom], tag);
    const lop = data.lop;
    const showLop = !tag && (nhom === "hom-nay" || nhom === "da-hen");
    const todayLessons: Lesson[] = showLop && nhom === "hom-nay" ? lop.today : [];
    const upLessons: Lesson[] = showLop && nhom === "da-hen" ? lop.upcoming : [];
    const selectedOn = (it: NhacItem) => it.id === openId;
    const row = (it: NhacItem) => <NhacRow key={it.id} it={it} now={now} selected={selectedOn(it)} pending={!!pending[it.id]} onOpen={openDetail} onToggle={(x, v) => void toggleDone(x, v)} />;
    const lessonList = (ls: Lesson[]) => ls.length > 0 && (
      <ul aria-label="Buổi học có hẹn" className="flex flex-col gap-3 mb-4">{ls.map(l => <PhieuBuoiHoc key={l.lessonId} it={l} busy={noteBusy === l.lessonId} onNote={x => void noteForLesson(x)} />)}</ul>
    );

    let list: React.ReactNode;
    const nothingHere = shown.length === 0 && todayLessons.length === 0 && upLessons.length === 0;
    if (nothingHere) {
      list = tag ? (
        <div data-nhac-rong={nhom} className={`py-6 flex flex-wrap items-center gap-3 ${GOC} text-[var(--kin-chu-mo)]`}>
          <p>Không có mục nào mang #{tag}.</p>
          <button type="button" onClick={() => setTag(null)} className={kinButtonClass("secondary")}>Bỏ lọc thẻ</button>
        </div>
      ) : nhom === "tat-ca" ? (
        <div data-nhac-rong={nhom}><KinEmptyState title="Chưa có nhắc việc nào">Ghi việc cần làm, hẹn ngày giờ, gắn #thẻ — như ghi chú trên điện thoại.</KinEmptyState></div>
      ) : (
        <p data-nhac-rong={nhom} role="status" className={`py-6 ${GOC} text-[var(--kin-chu-mo)]`}>{EMPTY_TEXT[nhom]}</p>
      );
    } else if (nhom === "da-hen") {
      // Theo ngày: buổi học của ngày đó (trên) rồi các mục tự ghi (theo dueAt, đúng thứ tự chiaNhom).
      const days = Array.from(new Set([...shown.map(i => i.dueDate ?? ""), ...upLessons.map(l => l.dateKey)].filter(Boolean))).sort();
      list = days.map(day => {
        const t = vnDayTitle(day, data.todayKey);
        const title = t === "Ngày mai" ? `Ngày mai · ${vnDayLong(day)}` : vnDayLong(day) || t;
        const its = shown.filter(i => i.dueDate === day);
        return (
          <section key={day} aria-label={title} data-nhac-ngay-nhom={day} className="mb-5">
            <h3 className={`mb-2 ${GOC} font-semibold text-[var(--kin-chu-chinh)]`}>{title}</h3>
            {lessonList(upLessons.filter(l => l.dateKey === day))}
            {its.length > 0 && <KinPanel flush><ul>{its.map(row)}</ul></KinPanel>}
          </section>
        );
      });
    } else {
      list = (
        <>
          {lessonList(todayLessons)}
          {shown.length > 0 && <KinPanel flush><ul aria-label={`Nhắc việc · ${NHAC_NHOM_LABEL[nhom]}`}>{shown.map(row)}</ul></KinPanel>}
          {nhom === "hom-nay" && shown.length === 0 && <p role="status" className={`py-2 ${GOC} text-[var(--kin-chu-mo)]`}>Chưa có việc tự ghi nào cho hôm nay.</p>}
        </>
      );
    }

    const pill = (on: boolean) => `${kinButtonClass("secondary")} flex-shrink-0 rounded-[var(--kin-bo-tron)] @min-[1000px]:w-full @min-[1000px]:justify-between @min-[1000px]:rounded-[var(--kin-bo-md)] ${on ? "border-[var(--kin-nhan-link)] bg-[var(--kin-nen-nhan)] text-[var(--kin-nhan-link)]" : ""}`;

    const side = (
      <div className={`min-w-0 @min-[720px]:col-span-2 @min-[1000px]:col-span-1 ${openId ? "@max-[720px]:hidden" : ""}`}>
        <nav aria-label="Nhóm nhắc việc" className="-mx-4 px-4 @min-[720px]:mx-0 @min-[720px]:px-0 flex gap-2 overflow-x-auto pb-1 @min-[1000px]:flex-col @min-[1000px]:overflow-visible">
          {NHAC_NHOM_KEYS.map(k => (
            <button key={k} type="button" data-nhac-nhom={k} aria-pressed={nhom === k} onClick={() => setNhom(k)} className={pill(nhom === k)}>
              <span>{NHAC_NHOM_LABEL[k]}</span> <span className="tabular-nums">({counts[k]})</span>
            </button>
          ))}
        </nav>
        {(tagCounts.length > 0 || tag) && (
          <div className="mt-3 @min-[1000px]:mt-6">
            <h2 className={`hidden @min-[1000px]:block mb-2 ${GOC} font-semibold text-[var(--kin-chu-chinh)]`}>Thẻ</h2>
            <div role="group" aria-label="Lọc theo thẻ" className="-mx-4 px-4 @min-[720px]:mx-0 @min-[720px]:px-0 flex gap-2 overflow-x-auto pb-1 @min-[1000px]:flex-wrap @min-[1000px]:overflow-visible">
              {tagCounts.map(t => (
                <button key={t.tag} type="button" data-nhac-the={t.tag} aria-pressed={tag === t.tag} onClick={() => setTag(cur => (cur === t.tag ? null : t.tag))}
                  className={`${kinButtonClass("secondary")} flex-shrink-0 rounded-[var(--kin-bo-tron)] ${tag === t.tag ? "border-[var(--kin-nhan-link)] bg-[var(--kin-nen-nhan)] text-[var(--kin-nhan-link)]" : ""}`}>
                  #{t.tag} <span className="tabular-nums">({t.count})</span>
                </button>
              ))}
            </div>
            {tag && <button type="button" data-nhac-bo-loc onClick={() => setTag(null)} className={`mt-1 inline-flex items-center min-h-11 px-1 ${GOC} text-[var(--kin-nhan-link)] underline`}>Bỏ lọc thẻ</button>}
          </div>
        )}
      </div>
    );

    const main = (
      <div className={`min-w-0 ${openId ? "@max-[720px]:hidden" : ""}`}>
        {data.used >= NEAR_FULL && (
          <KinPanel variant="canh-bao" data-nhac-gan-du className="mb-4">
            <p className={`${GOC} text-[var(--kin-chu-chinh)]`}>Bạn đã dùng {data.used}/{data.max} mục. Xoá bớt các mục đã xong để có chỗ thêm mục mới.</p>
          </KinPanel>
        )}
        <form onSubmit={e => void addQuick(e)} className="sticky top-0 z-10 -mx-4 px-4 py-2 @min-[720px]:static @min-[720px]:mx-0 @min-[720px]:px-0 @min-[720px]:pt-0 bg-[var(--kin-nen-trang)]">
          <label htmlFor="nhac-them" className="sr-only">Thêm nhắc việc</label>
          <input id="nhac-them" ref={quickRef} data-nhac-them value={quick} onChange={e => { setQuick(e.target.value); if (quickErr) setQuickErr(""); }}
            readOnly={quickBusy} aria-busy={quickBusy || undefined} autoComplete="off" enterKeyHint="done"
            aria-invalid={quickErr ? true : undefined} aria-describedby={quickErr ? "nhac-them-loi" : "nhac-them-goi-y"}
            placeholder="Thêm nhắc việc… gõ #thẻ, Enter để lưu" className={`${KIN_FIELD} text-[length:var(--kin-co-body)]`} />
          <p id="nhac-them-goi-y" className="sr-only">
            {nhom === "hom-nay" ? "Mục mới được hẹn hôm nay." : nhom === "da-hen" ? "Mục mới được hẹn ngày mai." : "Mục mới chưa có ngày hẹn."}
          </p>
          {quickBusy && <p role="status" className={`mt-1 ${GOC} text-[var(--kin-chu-mo)]`}>Đang lưu…</p>}
          {quickErr && <p id="nhac-them-loi" role="alert" data-nhac-them-loi className={`mt-1 ${GOC} text-[var(--kin-tt-chu-loi)]`}>{quickErr}</p>}
        </form>
        {reloadErr && <div className="mt-2"><ErrorStrip message="Không tải được Nhắc học." onRetry={retry} /></div>}
        {listErr && <p role="alert" data-nhac-loi-tai-cho className={`mt-2 ${GOC} text-[var(--kin-tt-chu-loi)]`}>{listErr}</p>}
        <div data-nhac-danh-sach={nhom} className="mt-4">{list}</div>
        {nhom === "da-xong" && counts["da-xong"] > 0 && (
          <button type="button" data-nhac-xoa-da-xong onClick={() => void clearDone()} disabled={clearBusy} aria-busy={clearBusy || undefined} className={`mt-4 ${kinButtonClass("secondary")}`}>
            {clearBusy ? "Đang xoá…" : "Xoá các mục đã xong"}
          </button>
        )}
      </div>
    );

    const detail = (
      <aside aria-label="Chi tiết nhắc việc" className={`min-w-0 ${openId ? "" : "@max-[720px]:hidden"} @min-[720px]:sticky @min-[720px]:top-4 @min-[720px]:self-start @min-[720px]:max-h-[calc(100vh-2rem)] @min-[720px]:overflow-y-auto @min-[720px]:border-l @min-[720px]:border-[var(--kin-vien-nhat)] @min-[720px]:pl-6`}>
        {openItem ? (
          <NhacHocChiTiet key={openItem.id} item={openItem} todayKey={data.todayKey} now={now} onSaved={upsert}
            onDeleted={id => { dropItem(id); closeDetail(); }} onFailed={load} onClose={closeDetail} />
        ) : (
          <p className={`hidden @min-[720px]:block py-6 ${GOC} text-[var(--kin-chu-mo)]`}>Chọn một nhắc việc để xem chi tiết, thêm ghi chú, hẹn giờ hoặc gắn thẻ.</p>
        )}
      </aside>
    );

    body = (
      <div className="grid gap-y-4 @min-[720px]:grid-cols-[minmax(0,1fr)_360px] @min-[720px]:gap-x-6 @min-[1000px]:grid-cols-[240px_minmax(0,1fr)_400px]">
        {side}{main}{detail}
      </div>
    );
  }

  return (
    // Lề trang: /student/nhac-hoc CHƯA nằm trong danh sách "flush" của (student)/layout.tsx (tệp chung, ngoài phạm vi LOI-04) ⇒ dùng lề <main> của layout
    // (px-4 md:px-8 py-6), không thêm lề riêng để khỏi lề đôi. Khi COO thêm trang vào danh sách đó thì đổi thành "px-4 md:px-10 pt-6 md:pt-8 pb-10" như màn chị em.
    <div data-nhac-hoc className="bg-[var(--kin-nen-trang)]">
      <div className="mx-auto max-w-[1120px] @container">
        {head}
        {body}
      </div>
      {dialog}
    </div>
  );
}
