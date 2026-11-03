import { NextRequest, NextResponse } from "next/server";
import { isValidMuc, listPublicArticles, getPublicArticleBySlug, isPlausibleSlug, LIST_LIMIT_MAX, type ArticleSort } from "@/lib/articlesPublic";
// BU-07 mục 4.2: chỉ bài ĐANG HIỂN THỊ (đã đăng, giờ đăng đã tới). Không tăng lượt xem ở đây (xem POST /api/articles/[slug]/view).
// Không bao giờ trả cho khách: content (ở danh sách), authorId, published, sourceUrl (ở danh sách).

const CACHE = "public, s-maxage=60, stale-while-revalidate=300";
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
/** Số nguyên dương thuần chữ số; còn lại (rỗng, "abc", "1.5", "-1", "1e2") → null. */
const intParam = (v: string): number | null => (/^\d{1,6}$/.test(v) ? Number(v) : null);

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const slug = sp.get("slug");

  try {
    if (slug !== null) {
      // 404 giống hệt nhau cho: không tồn tại, nháp, lên lịch tương lai, slug lạ.
      const article = isPlausibleSlug(slug) ? await getPublicArticleBySlug(slug) : null;
      if (!article) return NextResponse.json({ error: "Không tìm thấy bài viết" }, { status: 404 });
      return NextResponse.json(article, { headers: { "Cache-Control": CACHE } });
    }

    const limitRaw = sp.get("limit");
    let limit = 20;
    if (limitRaw !== null) {
      const n = intParam(limitRaw);
      if (n === null || n < 1 || n > LIST_LIMIT_MAX) return bad(`limit phải từ 1 đến ${LIST_LIMIT_MAX}`);
      limit = n;
    }
    const trangRaw = sp.get("trang");
    let trang = 1;
    if (trangRaw !== null) {
      const n = intParam(trangRaw);
      if (n === null || n < 1 || n > 10000) return bad("trang phải là số từ 1");
      trang = n;
    }
    const sortRaw = sp.get("sort") ?? "moi";
    if (sortRaw !== "moi" && sortRaw !== "xem-nhieu") return bad("sort chỉ nhận moi hoặc xem-nhieu");
    const sort: ArticleSort = sortRaw;

    // `muc` thắng `category`. `muc` lạ → 400; `category` cũ giữ tương thích: giá trị lạ vẫn nhận (lọc đúng chuỗi, thường ra rỗng).
    const mucRaw = sp.get("muc");
    let muc: string | undefined;
    if (mucRaw !== null) {
      if (mucRaw !== "all" && !isValidMuc(mucRaw)) return bad("muc không hợp lệ");
      muc = mucRaw === "all" ? undefined : mucRaw;
    } else {
      const cat = sp.get("category");
      if (cat && cat !== "all") {
        if (!/^[a-z0-9-]{1,40}$/.test(cat)) return NextResponse.json([], { headers: { "Cache-Control": CACHE } });
        muc = cat;
      }
    }

    const articles = await listPublicArticles({ muc, limit, sort, trang });
    return NextResponse.json(articles, { headers: { "Cache-Control": CACHE } });
  } catch (e) {
    console.error("[GET /api/articles]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
