// CAT-01 — danh mục khoá học công khai. Trang MÁY CHỦ: HTML đã có đủ khoá theo bộ lọc trong URL (SEO), phần lọc tương tác ở components/catalog/CourseCatalog.
// ?category=<tên danh mục> (HOME-01 và CAT-02 dùng khoá là TÊN, không phải id số); ?kythi= là bí danh đọc. Dac-ta: docs/kin/phong-ban/dac-ta/CAT-01.md
import Link from "next/link";
import type { Metadata } from "next";
import CourseCatalog from "@/components/catalog/CourseCatalog";
import { KinStateCard, kinButtonClass } from "@/components/kin";
import { loadPublicCatalog } from "@/lib/courseCatalogPublicServer";
import { parseCatalogParams, buildCatalogQuery } from "@/lib/courseCatalogPublic";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Khoá học", description: "Chọn khoá học theo kỳ thi: giá, gia sư và số chỗ còn lại." };

export default async function KhoaHocPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseCatalogParams(await searchParams);
  let data: Awaited<ReturnType<typeof loadPublicCatalog>> | null = null;
  try { data = await loadPublicCatalog(); } catch (e) { console.error("[/khoa-hoc]", e); }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto">
      <header className="mb-[var(--kin-kc-7)]">
        <h1 className="text-h3 text-[var(--kin-chu-chinh)]">Khoá học</h1>
        <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Chọn theo kỳ thi. Mỗi thẻ cho biết ai dạy, giá và lớp còn chỗ không.</p>
      </header>
      {data ? (
        // key đổi khi liên kết từ nơi khác (trang chủ) đưa bộ lọc mới vào cùng trang → dựng lại với bộ lọc đó.
        <CourseCatalog key={buildCatalogQuery(filters)} cards={data.cards} categories={data.categories} initial={filters} />
      ) : (
        <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được danh sách khoá học"
          status={<span data-catalog-error>Máy chủ chưa trả dữ liệu.</span>}
          actions={<Link href={`/khoa-hoc${buildCatalogQuery(filters) ? `?${buildCatalogQuery(filters)}` : ""}`} className={kinButtonClass("primary")}>Thử lại</Link>}>
          Danh sách vẫn còn nguyên, chỉ là lần tải này không thành. Bạn thử lại sau ít giây.
        </KinStateCard>
      )}
    </div>
  );
}
