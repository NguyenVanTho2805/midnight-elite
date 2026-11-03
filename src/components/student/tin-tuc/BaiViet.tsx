import Link from "next/link";
import { AnhBia } from "./AnhBia";
import { ChiaSe } from "./ChiaSe";
import { ChipMuc } from "./ChipMuc";
import { DemLuotXem } from "./DemLuotXem";
import { TinLienQuan } from "./TinLienQuan";
import { type TinThe, hrefBai, hrefMuc, mocBai, ngayGio, nhanMuc, tenTacGia } from "./kieu";

export interface BaiDayDu extends TinThe {
  content: string;
  sourceUrl?: string | null;
  sourceName?: string | null;
}

/** Nội dung là VĂN BẢN THUẦN (React tự thoát ký tự): đoạn cách nhau bằng dòng trống. Cấm HTML thô. */
function NoiDung({ text }: { text: string }) {
  return (
    <div data-article-content className="text-[length:var(--kin-co-body)]" style={{ lineHeight: 1.8 }}>
      {text.split(/\n{2,}/).map((doan, i) => (
        <p key={i} className="mb-5" style={{ color: "var(--kin-chu-phu)" }}>
          {doan.split("\n").map((dong, j, arr) => (<span key={j}>{dong}{j < arr.length - 1 && <br />}</span>))}
        </p>
      ))}
    </div>
  );
}

/**
 * Trang bài kiểu báo điện tử (một cột ~680). Thứ tự DOM bắt buộc (BU-07 mục 5.3):
 * mục + giờ → tiêu đề → chia sẻ → sapo → ảnh bìa + chú thích → nội dung → tác giả → nguồn → trở lại + tin liên quan.
 * Dùng chung cho trang công khai và xem trước của quản trị (xemTruoc = không đếm lượt xem).
 */
export function BaiViet({ bai, lienQuan, now, xemTruoc = false }: { bai: BaiDayDu; lienQuan: TinThe[]; now: Date; xemTruoc?: boolean }) {
  return (
    <div className="mx-auto w-full max-w-[680px] px-4 py-8 md:py-12">
      <nav aria-label="Đường dẫn" className="mb-6 flex flex-wrap items-center gap-x-2 text-[length:var(--kin-co-phu)]" style={{ color: "var(--kin-chu-mo)" }}>
        <Link href="/" className="inline-flex min-h-[var(--kin-cham-toi-thieu)] items-center hover:underline">Trang chủ</Link><span aria-hidden>/</span>
        <Link href="/tin-tuc" className="inline-flex min-h-[var(--kin-cham-toi-thieu)] items-center hover:underline">Tin tức</Link><span aria-hidden>/</span>
        <Link href={hrefMuc(bai.category)} className="inline-flex min-h-[var(--kin-cham-toi-thieu)] items-center hover:underline">{nhanMuc(bai.category)}</Link>
      </nav>

      <article>
        <header>
          <div data-article-meta className="mb-3 flex flex-wrap items-center gap-2 text-[length:var(--kin-co-phu)]" style={{ color: "var(--kin-chu-mo)" }}>
            <ChipMuc muc={bai.category} /><time>{ngayGio(mocBai(bai))}</time>
          </div>
          <h1 className="text-[length:var(--kin-co-display)] font-bold leading-tight max-md:text-[length:var(--kin-co-so)]" style={{ color: "var(--kin-chu-chinh)" }}>{bai.title}</h1>
        </header>

        <div className="mt-4"><ChiaSe duongDan={hrefBai(bai.slug)} tieuDe={bai.title} /></div>

        <p data-article-sapo className="mt-5 text-[length:var(--kin-co-body)] font-semibold leading-7" style={{ color: "var(--kin-chu-chinh)" }}>{bai.excerpt}</p>

        {bai.coverImage && (
          <figure className="mx-auto my-6">
            <AnhBia src={bai.coverImage} alt={`Ảnh bìa: ${bai.title}`} contain marker className="mx-auto rounded-[var(--kin-bo-xl)]" />
            {bai.coverCaption && <figcaption data-article-caption className="mt-2 text-center text-[length:var(--kin-co-small)]" style={{ color: "var(--kin-chu-mo)" }}>{bai.coverCaption}</figcaption>}
          </figure>
        )}

        <div className="mt-6"><NoiDung text={bai.content} /></div>

        <p data-article-author className="mt-2 text-right text-[length:var(--kin-co-goc)] font-bold" style={{ color: "var(--kin-chu-chinh)" }}>{tenTacGia(bai.author)}</p>

        {bai.sourceUrl && (
          <p data-article-source className="mt-6 text-[length:var(--kin-co-goc)]" style={{ color: "var(--kin-chu-mo)" }}>
            Nguồn:{" "}
            <a href={bai.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex min-h-11 items-center underline" style={{ color: "var(--kin-nhan-link)" }}>
              {bai.sourceName || bai.sourceUrl}<span aria-hidden> ↗</span>
            </a>
          </p>
        )}
      </article>

      <div className="mt-8 border-t pt-4" style={{ borderColor: "var(--kin-vien-thuong)" }}>
        <Link href={hrefMuc(bai.category)} data-tro-lai className="inline-flex min-h-[var(--kin-cham-toi-thieu)] items-center text-[length:var(--kin-co-goc)] font-semibold" style={{ color: "var(--kin-nhan-link)" }}>
          ← Trở lại {nhanMuc(bai.category)}
        </Link>
      </div>

      <TinLienQuan bai={lienQuan} hienTai={bai.slug} now={now} />
      {!xemTruoc && <DemLuotXem slug={bai.slug} />}
    </div>
  );
}
