// BU-07 — /tin-tuc: SERVER component (SEO đọc được, có generateMetadata). Khách và học sinh thấy cùng một trang; vỏ do GuestChrome quyết định.
// Máy tính: nổi bật + cột tin phụ 280, bốn khối chuyên mục, thanh bên "Xem nhiều". Điện thoại: một cột kiểu Threads (tối đa 540, căn giữa).
import type { Metadata } from "next";
import Link from "next/link";
import { getHomeBlocks, isValidMuc, listPublicArticles } from "@/lib/articlesPublic";
import { newsListMetadata } from "@/lib/seoPublic";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { ThanhChuyenMuc } from "@/components/student/tin-tuc/ThanhChuyenMuc";
import { TinNoiBat } from "@/components/student/tin-tuc/TinNoiBat";
import { TinPhu } from "@/components/student/tin-tuc/TinPhu";
import { KhoiChuyenMuc } from "@/components/student/tin-tuc/KhoiChuyenMuc";
import { XemNhieu } from "@/components/student/tin-tuc/XemNhieu";
import { DongTin } from "@/components/student/tin-tuc/DongTin";
import { HangTin } from "@/components/student/tin-tuc/HangTin";
import { TimTin } from "@/components/student/tin-tuc/TimTin";
import { hrefMuc, nhanMuc } from "@/components/student/tin-tuc/kieu";

export const dynamic = "force-dynamic";

const PER_PAGE = 10;
type SP = Promise<{ muc?: string | string[]; trang?: string | string[] }>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const trangOf = (v: string | undefined) => { const n = Number.parseInt(v ?? "1", 10); return Number.isFinite(n) && n >= 1 && n <= 1000 ? n : 1; };

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const sp = await searchParams;
  return newsListMetadata(one(sp.muc), trangOf(one(sp.trang)));
}

export default async function TinTucPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const mucRaw = one(sp.muc);
  const muc = isValidMuc(mucRaw) ? mucRaw : "";
  const trang = trangOf(one(sp.trang));
  const now = new Date();

  const dau = (
    <div className="px-4 md:px-0">
      <h1 className="text-[length:var(--kin-co-display)] font-bold leading-tight max-md:text-[length:var(--kin-co-so)]" style={{ color: "var(--kin-chu-chinh)" }}>
        {muc ? nhanMuc(muc) : "Tin tức"}
      </h1>
      {!muc && <p className="mt-1 text-[length:var(--kin-co-goc)]" style={{ color: "var(--kin-chu-mo)" }}>Tuyển sinh, học tập, tin từ KiN và gia sư — ghi rõ nguồn.</p>}
    </div>
  );

  // ───────── Một chuyên mục
  if (muc) {
    const [ds, tiep, xemNhieu] = await Promise.all([
      listPublicArticles({ muc, limit: PER_PAGE, sort: "moi", trang, now }),
      listPublicArticles({ muc, limit: PER_PAGE, sort: "moi", trang: trang + 1, now }),
      listPublicArticles({ limit: 5, sort: "xem-nhieu", now }),
    ]);
    const lead = ds[0];
    const phan = (
      <nav aria-label="Phân trang" className="mt-6 flex items-center justify-between gap-3 px-4 md:px-0">
        {trang > 1 ? <Link href={`${hrefMuc(muc)}&trang=${trang - 1}`} className={kinButtonClass("secondary")}>← Trang trước</Link> : <span />}
        {tiep.length > 0 ? <Link href={`${hrefMuc(muc)}&trang=${trang + 1}`} className={kinButtonClass("secondary")}>Trang sau →</Link> : <span />}
      </nav>
    );
    return (
      <div className="mx-auto w-full max-w-[1280px] py-6 md:px-4 md:py-10">
        <div className="space-y-4 md:space-y-5">
          {dau}
          <div className="px-4 md:px-0"><ThanhChuyenMuc muc={muc} /></div>
        </div>
        {ds.length === 0 ? (
          <KinEmptyState title={trang > 1 ? "Hết bài ở trang này" : `Chưa có bài trong mục ${nhanMuc(muc)}`}
            action={<Link href="/tin-tuc" className={kinButtonClass("primary")}>Xem tất cả tin tức</Link>}>
            {trang > 1 ? "Bạn đã đi qua bài cuối cùng của mục." : "Quay lại sau nhé, hoặc xem các mục khác."}
          </KinEmptyState>
        ) : (
          <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0">
              <div className="mx-auto max-w-[540px] md:hidden">{ds.map((a) => <DongTin key={a.id} bai={a} now={now} />)}</div>
              <div className="hidden md:block">
                {lead && <TinNoiBat bai={lead} now={now} />}
                <div className="mt-4">{ds.slice(1).map((a) => <HangTin key={a.id} bai={a} now={now} />)}</div>
              </div>
              {phan}
            </div>
            <div className="hidden lg:block"><XemNhieu bai={xemNhieu} /></div>
          </div>
        )}
      </div>
    );
  }

  // ───────── Trang tin tức chung
  const h = await getHomeBlocks(now);
  if (h.empty || !h.featured) {
    return (
      <div className="mx-auto w-full max-w-[1280px] px-4 py-6 md:py-10">
        {dau}
        <div className="mt-6"><KinEmptyState title="Chưa có bài viết" action={<Link href="/" className={kinButtonClass("primary")}>Về trang chủ</Link>}>
          Chưa có bài viết. Quay lại sau nhé.
        </KinEmptyState></div>
      </div>
    );
  }
  const tatCa = [h.featured, ...h.secondary, ...h.blocks.flatMap((b) => [b.lead, ...b.items])];
  const mobileDau = [h.featured, ...h.secondary].slice(0, 5);
  const mobileCon = [h.featured, ...h.secondary].slice(5);

  return (
    <div className="mx-auto w-full max-w-[1280px] py-6 md:px-4 md:py-10">
      <div className="space-y-4 md:space-y-5">
        {dau}
        <div className="grid gap-3 px-4 md:grid-cols-[1fr_280px] md:px-0 lg:gap-8">
          <ThanhChuyenMuc muc="" />
          <TimTin bai={tatCa} />
        </div>
      </div>

      {/* Điện thoại: kiểu Threads */}
      <div className="mx-auto mt-4 max-w-[540px] md:hidden">
        {mobileDau.map((a) => <DongTin key={a.id} bai={a} now={now} />)}
        <XemNhieu bai={h.mostRead} ngang />
        {mobileCon.map((a) => <DongTin key={a.id} bai={a} now={now} />)}
        {h.blocks.map((b) => (
          <section key={b.block.key} data-khoi-mobile={b.block.muc} aria-labelledby={`m-${b.block.key}`}>
            <div className="flex items-center justify-between px-4 pt-4">
              <h2 id={`m-${b.block.key}`} className="text-[length:var(--kin-co-tieu-de)] font-bold" style={{ color: "var(--kin-chu-chinh)" }}>{b.block.label}</h2>
              <Link href={hrefMuc(b.block.muc)} className="inline-flex min-h-[var(--kin-cham-toi-thieu)] items-center text-[length:var(--kin-co-goc)] font-medium" style={{ color: "var(--kin-nhan-link)" }}>Xem thêm →</Link>
            </div>
            {[b.lead, ...b.items].map((a) => <DongTin key={a.id} bai={a} now={now} />)}
          </section>
        ))}
      </div>

      {/* Máy tính */}
      <div className="mt-6 hidden gap-8 md:grid lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0 space-y-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <TinNoiBat bai={h.featured} now={now} />
            <TinPhu bai={h.secondary} now={now} />
          </div>
          {h.blocks.map((b) => <KhoiChuyenMuc key={b.block.key} muc={b.block.muc} bai={[b.lead, ...b.items]} now={now} />)}
        </div>
        <div><XemNhieu bai={h.mostRead} /></div>
      </div>
    </div>
  );
}
