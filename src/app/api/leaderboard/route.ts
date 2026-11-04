import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dropHeldResults } from "@/lib/examHold";
import { getSession } from "@/lib/session";
import { NOT_SYSTEM_ACCOUNT } from "@/lib/adminSystemAccounts";
import { shapeLeaderboard, type LeaderboardRow } from "@/lib/leaderboardPublic";
import { makeTtlCache, leaderboardCacheMs } from "@/lib/ttlCache";

// Nội dung KHÁC nhau theo người xem (khách: tên che, không trường, top 10; đã đăng nhập: như cũ) nên KHÔNG cho trình duyệt / CDN giữ chung một bản; chỉ đệm trong bộ nhớ máy chủ,
// khoá theo người xem + kỳ thi (khoá ?category= do người gọi đặt nên bộ đệm có trần số khoá). Production giữ 60 giây (STU-003), máy dev / bài kiểm tắt đệm.
const NO_STORE = { "Cache-Control": "private, no-store" };
const cache = makeTtlCache<unknown[]>(leaderboardCacheMs(), { max: 40 });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const isMember = !!(await getSession());
  const cacheKey = `${isMember ? "member" : "guest"}:${category ?? ""}`;
  const cached = cache.get(cacheKey);
  if (cached) return NextResponse.json(cached, { headers: NO_STORE });

  try {
    // Bản công khai (khách) còn loại tài khoản bị cấm và tài khoản hệ thống; người đã đăng nhập giữ cách tính cũ.
    const userWhere = isMember ? { deletedAt: null } : { deletedAt: null, banned: false, ...NOT_SYSTEM_ACCOUNT };
    // Chỉ tính điểm của lượt đã công bố / đề không giữ điểm (examHold): điểm tự luận dở dang không vào bảng xếp hạng.
    const results = await dropHeldResults(await prisma.examResult.findMany({
      where: category ? { exam: { category }, user: userWhere } : { user: userWhere },
      select: {
        userId: true, examId: true, score: true,
        user: { select: { id: true, name: true, school: true } },
      },
    }));

    const map = new Map<string, {
      userId: string; name: string; school: string | null;
      totalScore: number; count: number; best: number;
    }>();

    for (const r of results) {
      const existing = map.get(r.userId);
      if (existing) {
        existing.totalScore += r.score;
        existing.count++;
        existing.best = Math.max(existing.best, r.score);
      } else {
        map.set(r.userId, {
          userId: r.userId,
          name:   r.user.name,
          school: r.user.school,
          totalScore: r.score,
          count: 1,
          best:  r.score,
        });
      }
    }

    const sorted: LeaderboardRow[] = [...map.values()]
      .map(({ totalScore, ...u }) => ({
        ...u,
        avg: Math.round(totalScore / u.count * 10) / 10,
      }))
      .sort((a, b) => b.best - a.best);

    // Cắt + che theo người xem ở MỘT chỗ (leaderboardPublic.ts): khách top 10, tên che, không trường / mã học sinh; đã đăng nhập top 20 như cũ.
    const leaderboard = shapeLeaderboard(sorted, isMember);
    cache.set(cacheKey, leaderboard);
    return NextResponse.json(leaderboard, { headers: NO_STORE });
  } catch (e) {
    console.error("[GET /api/leaderboard]", e);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
