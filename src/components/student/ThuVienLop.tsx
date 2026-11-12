// LOI-03 mục 4.1 — THƯ VIỆN LỚP của học sinh ("Lớp của tôi" = /student/hoc-tap không ?course=, và /lop-cua-toi vai học sinh). Kiểu HSA: thẻ ngang có ảnh bìa,
// nhãn chữ Đang học / Hoàn thành, tên lớp (liên kết vào trang lớp), "Gia sư: … · Môn", thanh + "Đã hoàn thành x/y bài", vòng % và MỘT nút đặc "Học tiếp →".
// LUÔN là thư viện, kể cả khi em chỉ có 1 lớp (Q1 — bỏ tự nhảy vào lớp của NC2-041). Dữ liệu: MỘT lượt GET /api/student/lop (x/y, %, bài "Học tiếp" tính sẵn
// ở máy chủ bằng src/lib/studentLop.ts — cùng hàm với trang lớp nên hai nơi không lệch). Lọc Tất cả / Đang học / Hoàn thành chạy ở trình duyệt (locLop), không gọi lại API.
// KHÔNG có trên thẻ: "Lịch học", "Học phí", số tiền, bạn học, "lượt xem", "Đánh giá". Ảnh bìa đến từ máy chủ (coverImageOf, chỉ https) — không có / lỗi ⇒ ô chữ tên lớp trên nền token.
// Ba trạng thái: đang tải (WorkSkeleton), lỗi (ErrorStrip + Thử lại — KHÔNG coi là "chưa vào lớp"), rỗng (giải thích + Nhập mã lớp + Tìm lớp miễn phí). Lọc rỗng có câu + "Xem tất cả".
// Dưới danh sách: "Đang chờ duyệt" (BU-01), "Tham gia lớp khác", "Tự học" — dời từ LopCuaToi.tsx, trang lớp dùng lại qua export.
// Móc kiểm thử: ul[data-class-catalog] > li[data-class-card=<id>] (giữ từ DanhMucLop cho ui-lop-nhieu-lop), [data-loc-lop=<key>], [data-hoc-tiep], [data-lop-bia-chu].
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { kinButtonClass } from "@/components/kin/Button";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinStatus } from "@/components/kin/Status";
import { KinProgressRing } from "@/components/kin/ProgressRing";
import { WorkSkeleton } from "@/components/student/shared";
import { featureOn } from "@/lib/features";
import { demLoc, hocTiepLabel, locLop, LOP_LOC_KEYS, LOP_LOC_LABEL, LOP_TRANG_THAI_LABEL, type LopLoc, type ThuVienResp, type ThuVienRow } from "@/lib/studentLop";

const GOC = "text-[length:var(--kin-co-goc)]";

// ── Khối phụ dùng chung với trang lớp ──────────────────────────────────────────

interface MyJoinReq { id: string; status: string; course: { id: string; name: string }; personalCode?: string | null }

/** BU-01: yêu cầu vào lớp đang chờ gia sư duyệt của chính em. Rỗng/đang tải = không hiện gì; lỗi = báo và cho thử lại. Huỷ = biểu mẫu POST (máy chủ 303). */
export function PendingJoinBlock({ className = "" }: { className?: string }) {
  const [items, setItems] = useState<MyJoinReq[] | "loi" | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    fetch("/api/invites/my-requests", { credentials: "same-origin", cache: "no-store" })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { items?: MyJoinReq[] }) => { if (live) setItems((d.items ?? []).filter(i => i.status === "pending")); })
      .catch(() => { if (live) setItems("loi"); });
    return () => { live = false; };
  }, [tick]);
  if (items === null || (Array.isArray(items) && items.length === 0)) return null;
  if (items === "loi") return <div className={className}><ErrorStrip message="Không tải được các yêu cầu vào lớp của bạn." onRetry={() => { setItems(null); setTick(t => t + 1); }} /></div>;
  return (
    <section aria-labelledby="lop-cho-duyet" data-pending-join className={className}>
      <KinSectionHead id="lop-cho-duyet" title="Đang chờ duyệt" aside={`${items.length} lớp`} />
      <ul>
        {items.map(r => (
          <li key={r.id} data-pending-join-row className={`py-[var(--kin-kc-5)] border-b border-[var(--kin-vien-nhat)] ${GOC}`}>
            <p className="min-w-0 break-words text-[var(--kin-chu-chinh)]">{r.course.name}</p>
            <p className="mt-1"><KinStatus tone="cho">Chờ gia sư duyệt</KinStatus></p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Link href={r.personalCode ? `/student/nhap-ma-lop?code=${encodeURIComponent(r.personalCode)}` : "/student/nhap-ma-lop"} className={kinButtonClass("secondary")}>Xem yêu cầu</Link>
              <form method="post" action={`/api/invites/my-requests/${encodeURIComponent(r.id)}/cancel`}>
                <button type="submit" aria-label={`Huỷ yêu cầu vào lớp ${r.course.name}`} className={kinButtonClass("ghost")}>Huỷ yêu cầu</button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Lối duy nhất vào "Nhập mã lớp" khi đã có lớp (mục này không còn ở bảng Khác). Màn trống của học sinh mới có nút riêng. */
export function JoinAnotherClass({ className = "" }: { className?: string }) {
  return (
    <section aria-labelledby="lop-join" className={className}>
      <KinSectionHead id="lop-join" title="Tham gia lớp khác" />
      <p className={`pt-4 ${GOC} text-[var(--kin-chu-mo)]`}>Nhập mã mời do gia sư cung cấp, hoặc xem các lớp miễn phí đang mở.</p>
      <div className="flex flex-wrap gap-3 mt-4">
        <Link href="/student/nhap-ma-lop" className={kinButtonClass("secondary")}>Nhập mã lớp</Link>
        <Link href="/khoa-hoc?gia=free" className={kinButtonClass("ghost")}>Tìm lớp miễn phí</Link>
      </div>
    </section>
  );
}

export function SelfStudy({ className = "" }: { className?: string }) {
  // LOI-01: khối Tự học chỉ hiện khi phần Tiếng Anh tự học đang mở (src/lib/features.ts).
  if (!featureOn("TIENG_ANH")) return null;
  return (
    <section aria-labelledby="lop-tu-hoc" data-self-study className={className}>
      <KinSectionHead id="lop-tu-hoc" title="Tự học" />
      <p className={`pt-4 ${GOC} text-[var(--kin-chu-mo)]`}>Lộ trình Tiếng Anh IELTS, từ vựng, đọc, nghe, viết và thi thử — không cần vào lớp.</p>
      <Link href="/student/tieng-anh" className={`${kinButtonClass("secondary")} mt-4`}>Mở Tiếng Anh tự học</Link>
    </section>
  );
}

// ── Thẻ lớp ────────────────────────────────────────────────────────────────────

function Cover({ row }: { row: ThuVienRow }) {
  const [broken, setBroken] = useState(false);
  if (row.cover && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={row.cover} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />;
  }
  // Không ảnh: khối nền nhấn nhạt + tên lớp (2 dòng). aria-hidden vì tên lớp đã đọc ngay bên cạnh.
  return (
    <span aria-hidden data-lop-bia-chu className="flex h-full w-full items-center justify-center px-4 text-center bg-[var(--kin-nhan-nen-nhat)] text-[length:var(--kin-co-tieu-de)] font-medium leading-6 text-[var(--kin-nhan-link)]">
      <span className="line-clamp-2 [overflow-wrap:anywhere]">{row.name}</span>
    </span>
  );
}

/** Vòng % : KinProgressRing vẽ "x/y" ở giữa; ở thư viện chữ giữa là "pct%" (đặc tả 4.1), nên ẩn chữ gốc và đặt chữ % lên trên. Xong hết thì vòng tự hiện dấu tích. */
function PctRing({ row, size, className }: { row: ThuVienRow; size: number; className: string }) {
  const all = row.total > 0 && row.done >= row.total;
  return (
    <div className={`relative flex-shrink-0 [&_.kin-ring-num]:hidden! ${className}`} style={{ width: size, height: size }}>
      <KinProgressRing done={row.done} total={row.total} size={size} label={`Hoàn thành ${row.pct}%`} />
      {!all && <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center text-[length:var(--kin-co-phu)] font-semibold tabular-nums text-[var(--kin-chu-chinh)]">{row.pct}%</span>}
    </div>
  );
}

function ClassCard({ row }: { row: ThuVienRow }) {
  const lopHref = `/student/hoc-tap?course=${encodeURIComponent(row.id)}`;
  const sub = [row.giaSu, row.category.trim()].filter(Boolean).join(" · ");
  const empty = row.total === 0;
  return (
    <li data-class-card={row.id} className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:gap-6 p-[var(--kin-kc-6)] md:p-[var(--kin-kc-7)] rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)]">
      <div className="w-full aspect-video max-h-[180px] md:w-[240px] md:h-[135px] md:max-h-none md:aspect-auto flex-shrink-0 overflow-hidden rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-bang)]">
        <Cover row={row} />
      </div>
      <div className="min-w-0 flex-1">
        <KinStatus tone={row.trangThai === "hoan-thanh" ? "xong" : "cho"}>{LOP_TRANG_THAI_LABEL[row.trangThai]}</KinStatus>
        <h2 className="mt-1 text-[length:var(--kin-co-tieu-de)] font-semibold leading-6 text-[var(--kin-chu-chinh)]">
          <Link href={lopHref} className="inline-flex items-center min-h-11 break-words [overflow-wrap:anywhere] hover:underline">{row.name}</Link>
        </h2>
        {sub && <p className={`${GOC} leading-5 text-[var(--kin-chu-mo)] break-words`}>{sub}</p>}
        <div className="mt-3 flex items-center gap-4">
          <div className="min-w-0 flex-1">
            {empty ? (
              <p className={`${GOC} text-[var(--kin-chu-mo)]`}>Lớp chưa có bài học</p>
            ) : (
              <>
                <div role="progressbar" aria-label={`Tiến độ lớp ${row.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.pct} className="h-1.5 rounded-full overflow-hidden bg-[var(--kin-vien-thuong)]">
                  <div className="h-1.5 rounded-full bg-[var(--kin-nhan-nen)]" style={{ width: `${row.pct}%` }} />
                </div>
                <p className={`mt-2 ${GOC} tabular-nums text-[var(--kin-chu-chinh)]`}>Đã hoàn thành {row.done}/{row.total} bài</p>
              </>
            )}
          </div>
          {!empty && <PctRing row={row} size={56} className="md:hidden" />}
        </div>
      </div>
      <div className="flex flex-col items-stretch gap-3 md:w-[168px] md:flex-shrink-0 md:items-center">
        {!empty && <PctRing row={row} size={64} className="hidden md:block" />}
        {row.hocTiep ? (
          <Link href={`/student/bai-giang/${encodeURIComponent(row.hocTiep.lessonId)}`} data-hoc-tiep={row.hocTiep.lessonId} aria-label={`${hocTiepLabel(row.hocTiep.reason, row.done).replace(" →", "")}: ${row.hocTiep.title} (${row.name})`}
            className={`${kinButtonClass("primary")} w-full md:w-auto`}>{hocTiepLabel(row.hocTiep.reason, row.done)}</Link>
        ) : (
          <Link href={lopHref} className={`${kinButtonClass("secondary")} w-full md:w-auto`}>Vào lớp</Link>
        )}
      </div>
    </li>
  );
}

const LOC_EMPTY: Record<Exclude<LopLoc, "tat-ca">, string> = { "dang-hoc": "Không có lớp nào đang học.", "hoan-thanh": "Chưa có lớp nào đã hoàn thành." };

// ── Trang ──────────────────────────────────────────────────────────────────────

type State = { s: "dang-tai" } | { s: "loi" } | { s: "khong-phai-hoc-sinh" } | { s: "ok"; rows: ThuVienRow[] };

export default function ThuVienLop() {
  const [st, setSt] = useState<State>({ s: "dang-tai" });
  const [tick, setTick] = useState(0);
  const [loc, setLoc] = useState<LopLoc>("tat-ca");
  useEffect(() => {
    let live = true;
    fetch("/api/student/lop", { credentials: "same-origin", cache: "no-store" })
      .then(async r => {
        if (r.status === 403) return { s: "khong-phai-hoc-sinh" } as const;
        if (!r.ok) throw new Error(String(r.status));
        const d = (await r.json()) as ThuVienResp;
        return { s: "ok", rows: Array.isArray(d.classes) ? d.classes : [] } as const;
      })
      .then(next => { if (live) setSt(next); })
      .catch(() => { if (live) setSt({ s: "loi" }); });
    return () => { live = false; };
  }, [tick]);
  const retry = useCallback(() => { setSt({ s: "dang-tai" }); setTick(t => t + 1); }, []);

  const rows = st.s === "ok" ? st.rows : [];
  const head = (
    <header className="pb-6">
      <h1 className="text-[length:var(--kin-co-h2)] leading-9 font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)]">Lớp của tôi</h1>
      {st.s === "ok" && rows.length > 0 && <p className={`mt-1 ${GOC} text-[var(--kin-chu-mo)]`}>Bạn đang học {rows.length} lớp.</p>}
    </header>
  );

  let body: React.ReactNode;
  if (st.s === "dang-tai") body = <WorkSkeleton label="Đang tải Lớp của tôi" />;
  else if (st.s === "loi") body = <ErrorStrip message="Không tải được danh sách lớp của bạn." onRetry={retry} />;
  else if (st.s === "khong-phai-hoc-sinh") {
    body = <KinEmptyState title="Lớp của tôi dành cho tài khoản học sinh" action={<Link href="/khoa-hoc" className={kinButtonClass("secondary")}>Xem các lớp đang mở</Link>}>Đăng nhập bằng tài khoản học sinh để xem các lớp bạn đang học.</KinEmptyState>;
  } else if (rows.length === 0) {
    body = (
      <>
        <KinEmptyState title="Bạn chưa vào lớp nào" action={<span className="flex flex-wrap gap-3"><Link href="/student/nhap-ma-lop" className={kinButtonClass("primary")}>Nhập mã lớp</Link><Link href="/khoa-hoc?gia=free" data-lop-mien-phi className={kinButtonClass("secondary")}>Tìm lớp miễn phí</Link></span>}>
          Gia sư sẽ gửi cho bạn mã mời của lớp. Nhập mã đó để vào lớp, bài tập và buổi học sẽ hiện ở đây. Chưa có mã thì xem các lớp miễn phí đang mở.
        </KinEmptyState>
        <div className="max-w-[560px]"><PendingJoinBlock className="pt-8" /></div>
      </>
    );
  } else {
    const counts = demLoc(rows);
    const shown = locLop(rows, loc);
    body = (
      <>
        <div role="group" aria-label="Lọc lớp" className="-mx-4 px-4 md:mx-0 md:px-0 flex gap-2 overflow-x-auto pb-1">
          {LOP_LOC_KEYS.map(k => {
            const on = loc === k;
            return (
              <button key={k} type="button" data-loc-lop={k} aria-pressed={on} onClick={() => setLoc(k)}
                className={`${kinButtonClass("secondary")} flex-shrink-0 rounded-[var(--kin-bo-tron)] ${on ? "border-[var(--kin-nhan-link)] bg-[var(--kin-nen-nhan)] text-[var(--kin-nhan-link)]" : ""}`}>
                {LOP_LOC_LABEL[k]} <span className="tabular-nums">({counts[k]})</span>
              </button>
            );
          })}
        </div>
        {shown.length === 0 && loc !== "tat-ca" ? (
          <div data-loc-rong className={`mt-6 flex flex-wrap items-center gap-3 ${GOC} text-[var(--kin-chu-mo)]`}>
            <p>{LOC_EMPTY[loc]}</p>
            <button type="button" onClick={() => setLoc("tat-ca")} className={kinButtonClass("secondary")}>Xem tất cả</button>
          </div>
        ) : (
          <ul aria-label="Các lớp của tôi" data-class-catalog className="mt-6 flex flex-col gap-[var(--kin-kc-6)]">
            {shown.map(r => <ClassCard key={r.id} row={r} />)}
          </ul>
        )}
        <div className="mt-10 max-w-[560px] space-y-8">
          <PendingJoinBlock />
          <JoinAnotherClass />
          <SelfStudy />
        </div>
      </>
    );
  }

  return (
    <div className="px-4 md:px-10 pt-6 md:pt-8 pb-10 bg-[var(--kin-nen-trang)]">
      <div className="mx-auto max-w-[1120px]">
        {head}
        {body}
      </div>
    </div>
  );
}
