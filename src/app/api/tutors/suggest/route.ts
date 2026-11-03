// BU-06 — GET /api/tutors/suggest?q= — gợi ý cho thanh tìm gia sư (công khai, không phiên).
// Tối đa 5 môn (khớp không dấu, kèm số gia sư) rồi tối đa 3 tên gia sư; cùng tập hiển thị với danh sách (src/lib/tutorSearchServer.ts).
// `q` sau khi làm sạch dưới 2 ký tự → { suggestions: [] }. Không trả ảnh, không trả gì ngoài id và tên công khai.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSuggestions, parseSuggestQuery } from "@/lib/tutorSearch";
import { loadSearchableTutors } from "@/lib/tutorSearchServer";

export async function GET(req: NextRequest) {
  const q = parseSuggestQuery(new URL(req.url).searchParams.get("q"));
  const headers = { "Cache-Control": "no-store" };
  if (!q) return NextResponse.json({ suggestions: [] }, { headers });
  const all = await loadSearchableTutors(prisma);
  return NextResponse.json({ suggestions: buildSuggestions(all, q) }, { headers });
}
