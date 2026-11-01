// FE-109 / BU-06 — GET /api/tutors — danh sách gia sư công khai, có tìm, lọc, sắp xếp, phân trang và facet.
// Đặc tả: docs/kin/phong-ban/dac-ta/BU-06.md mục C.1. Không cần phiên, không đặt cookie, không bộ nhớ đệm công khai (khoá hồ sơ phải có hiệu lực ngay).
//
// Query (mọi giá trị sai → mặc định, KHÔNG trả 400):
//   q, subject, grade, city, district, mode, priceMin, priceMax, active, sort, page, pageSize — xem `parseTutorQuery` (src/lib/tutorSearch.ts).
// Phản hồi: { items, total, page, pageSize, hasMore, facets }. `items[]` giữ nguyên các trường cũ (TutorListItem).
//
// Chỉ trả gia sư đã duyệt, không khoá, không ẩn (src/lib/tutorSearchServer.ts). Không bao giờ có email/điện thoại/ngày sinh/preferences thô/tên học sinh/giá lớp.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTutorQuery, searchTutors } from "@/lib/tutorSearch";
import { loadSearchableTutors } from "@/lib/tutorSearchServer";

export type { TutorListItem } from "@/lib/tutorSearch";

export async function GET(req: NextRequest) {
  const filters = parseTutorQuery(new URL(req.url).searchParams);
  const all = await loadSearchableTutors(prisma);
  return NextResponse.json(searchTutors(all, filters), { headers: { "Cache-Control": "no-store" } });
}
