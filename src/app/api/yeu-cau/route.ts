// KH-04 — khách (phụ huynh hoặc người học từ 16 tuổi, KHÔNG cần tài khoản) gửi "Yêu cầu tìm gia sư" tới MỘT gia sư đang công khai.
// POST { targetTutorId, level, subject, mode?, slots?, note?, contactName?, contactPhone, role: "guardian"|"self", consent: { accepted: true }, startedAt, website }
// Chỉ thu tối thiểu (không tên / ngày sinh trẻ). Chưa tích đồng ý thì KHÔNG lưu. Chống spam: ô bẫy, thời gian điền tối thiểu, 5 yêu cầu/giờ/IP, 3 yêu cầu/ngày/số điện thoại,
// mỗi cặp (số, gia sư) chỉ một yêu cầu đang chờ. Không có reCAPTCHA (dịch vụ ngoài, chưa dùng). Log máy chủ không chứa số điện thoại hay nội dung yêu cầu.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notify";
import { logAction } from "@/lib/auditLog";
import { CONSENT_TEXT_VERSION } from "@/lib/consentPolicy";
import { PER_IP_PER_HOUR, PER_PHONE_PER_DAY, parseRequestInput, spamVerdict } from "@/lib/tutorRequest";
import { expireOldRequests, newTrackToken, phoneKeyOf, publicTutor } from "@/lib/tutorRequestServer";

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  const ip = getClientIp(req);
  // Hai tầng: mọi lượt gọi (kể cả điền sai) 60/giờ/IP để không bị dội; riêng lượt TẠO yêu cầu 5/giờ/IP, chỉ tính khi sắp lưu thật (điền sai vài lần không bị phạt).
  if (!rateLimit(`yeu-cau-goi:${ip}`, 60, 3600_000)) return NextResponse.json({ error: "Quá nhiều yêu cầu. Vui lòng thử lại sau." }, { status: 429, headers: { "Retry-After": "3600" } });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ" }, { status: 400 });

  const now = Date.now();
  const v = spamVerdict({ website: body.website, startedAt: body.startedAt, now });
  // Bot điền ô bẫy: trả như thành công (không cho bot biết đã bị chặn) nhưng KHÔNG lưu gì.
  if (v === "bot") return NextResponse.json({ trackToken: newTrackToken() }, { status: 201, headers: NO_STORE });
  if (v === "too-fast") return NextResponse.json({ error: "Bạn gửi nhanh quá. Hãy kiểm tra lại thông tin rồi bấm gửi sau vài giây." }, { status: 429, headers: NO_STORE });
  if (v === "stale") return NextResponse.json({ error: "Biểu mẫu đã mở quá lâu. Hãy tải lại trang rồi điền lại." }, { status: 400, headers: NO_STORE });

  const p = parseRequestInput(body);
  const firstErr = Object.values(p.errors)[0];
  if (firstErr || !p.data) return NextResponse.json({ error: firstErr ?? "Thông tin chưa đúng", errors: p.errors }, { status: 400 });
  const consent = body.consent as { accepted?: unknown } | undefined;
  if (consent?.accepted !== true) return NextResponse.json({ error: "Cần tích ô đồng ý trước khi gửi", needsConsent: true }, { status: 422 });

  const targetId = typeof body.targetTutorId === "string" ? body.targetTutorId : "";
  const tutor = targetId ? await publicTutor(targetId) : null;
  if (!tutor) return NextResponse.json({ error: "Không tìm thấy gia sư này" }, { status: 404 });

  await expireOldRequests();
  const phoneKey = phoneKeyOf(p.data.contactPhone);
  const since = new Date(now - 86_400_000);
  const [today, open] = await Promise.all([
    prisma.tutorRequest.count({ where: { phoneKey, createdAt: { gte: since } } }),
    prisma.tutorRequest.count({ where: { phoneKey, targetTutorId: tutor.id, status: "new" } }),
  ]);
  if (open > 0) return NextResponse.json({ error: "Anh/chị đã gửi yêu cầu tới gia sư này và đang chờ phản hồi. Mở trang theo dõi bằng link anh/chị đã nhận lúc gửi." }, { status: 409, headers: NO_STORE });
  if (today >= PER_PHONE_PER_DAY) return NextResponse.json({ error: `Số này đã gửi ${PER_PHONE_PER_DAY} yêu cầu trong hôm nay. Vui lòng thử lại vào ngày mai.` }, { status: 429, headers: NO_STORE });

  if (!rateLimit(`yeu-cau:${ip}`, PER_IP_PER_HOUR, 3600_000)) {
    return NextResponse.json({ error: "Bạn đã gửi nhiều yêu cầu trong một giờ. Vui lòng thử lại sau." }, { status: 429, headers: { "Retry-After": "3600" } });
  }
  const trackToken = newTrackToken();
  const d = p.data;
  const created = await prisma.$transaction(async tx => {
    const r = await tx.tutorRequest.create({
      data: { trackToken, targetTutorId: tutor.id, level: d.level, subject: d.subject, mode: d.mode, slots: d.slots, note: d.note, contactName: d.contactName, contactPhone: d.contactPhone, phoneKey },
      select: { id: true },
    });
    await tx.consentRecord.create({
      data: {
        subjectType: "tutor_request", subjectId: r.id, party: d.role, scopes: ["basic"], method: "guest_form", textVersion: CONSENT_TEXT_VERSION, givenById: null, givenByRole: "guest",
      },
    });
    return r;
  });
  await logAction(null, "tutor_request.create", "TutorRequest", created.id, { role: d.role });
  await notify(tutor.id, { type: "tutor_request_new", title: "Có yêu cầu tìm gia sư mới", message: "Một khách vừa gửi yêu cầu tới bạn. Mở để xem và phản hồi.", link: "/lop-cua-toi/yeu-cau" });
  return NextResponse.json({ trackToken }, { status: 201, headers: NO_STORE });
}
