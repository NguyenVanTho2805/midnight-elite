import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/rate-limit";
import { validateGuestQuestion } from "@/lib/communityRules";
import { communityError, getOrCreateGuestAuthor, hashIp, NO_STORE, withLock } from "@/lib/communityServer";
import type { CommunityErrorCode } from "@/lib/communityTypes";

// POST /api/community/guest-questions — khách đặt câu hỏi (không cần tài khoản). Luôn vào hàng chờ duyệt (status "pending"):
// không xuất hiện ở feed, chi tiết, cột phải, hồ sơ, đã lưu, thông báo. Sau cờ KIN_GUEST_QUESTIONS=1.
// Form (urlencoded) → 303 về /cong-dong?da-gui=1 | ?loi=<mã>; JSON → JSON.
const PER_HOUR = 3;
const PER_DAY = 10;
const HOUR = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  if (process.env.KIN_GUEST_QUESTIONS !== "1") {
    return communityError(503, "guest_questions_closed", "Hiện chưa nhận câu hỏi của khách. Hãy đăng nhập để đặt câu hỏi.");
  }
  const isForm = (req.headers.get("content-type") ?? "").includes("application/x-www-form-urlencoded");
  const back = (q: string) => NextResponse.redirect(new URL(`/cong-dong?${q}`, req.url), { status: 303, headers: NO_STORE });
  const fail = (status: number, code: CommunityErrorCode, msg: string) =>
    isForm ? back(`loi=${code}`) : communityError(status, code, msg);

  let body: Record<string, unknown>;
  try {
    if (isForm) { const fd = await req.formData(); body = Object.fromEntries(fd.entries()); }
    else { const j = await req.json(); body = j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : {}; }
  } catch {
    body = {};
  }

  // Ô bẫy: có chữ → coi như thành công nhưng KHÔNG lưu (bot không biết bị chặn).
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return isForm ? back("da-gui=1") : NextResponse.json({ ok: true, status: "pending" }, { status: 201, headers: NO_STORE });
  }
  if ("imageUrls" in body || "fileUrl" in body || "fileName" in body) {
    return fail(400, "not_allowed_for_guest", "Câu hỏi của khách không đính kèm ảnh hay tệp");
  }
  const v = validateGuestQuestion({ name: body.name, title: body.title, content: body.content });
  if (!v.ok) return fail(v.code === "under_13" ? 422 : 400, v.code, v.error);

  const ipHash = hashIp(getClientIp(req));
  const authorId = await getOrCreateGuestAuthor();
  // Đếm-rồi-ghi trong cùng một khoá: 5 yêu cầu song song cùng IP chỉ lọt đúng PER_HOUR hàng.
  const created = await withLock(`guestq:${ipHash}`, async tx => {
    const now = Date.now();
    const [hour, day] = await Promise.all([
      tx.thread.count({ where: { guestIpHash: ipHash, createdAt: { gte: new Date(now - HOUR) } } }),
      tx.thread.count({ where: { guestIpHash: ipHash, createdAt: { gte: new Date(now - 24 * HOUR) } } }),
    ]);
    if (hour >= PER_HOUR || day >= PER_DAY) return false;
    await tx.thread.create({
      data: {
        authorId, kind: "question", status: "pending", category: "hoi-dap", courseId: null,
        title: v.value.title, content: v.value.content, guestName: v.value.name, guestIpHash: ipHash,
      },
    });
    return true;
  });
  if (!created) return fail(429, "rate_limited", "Bạn đã gửi quá nhiều câu hỏi. Vui lòng thử lại sau.");
  return isForm ? back("da-gui=1") : NextResponse.json({ ok: true, status: "pending" }, { status: 201, headers: NO_STORE });
}
