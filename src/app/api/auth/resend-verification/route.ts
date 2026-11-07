import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { requestSignupCode } from "@/lib/loginCodeServer";
import { signupRequestResponse, MAIL_FAILED_MSG } from "@/lib/signupCodeHttp";
import { limitOrBlock, getClientIp } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });

  const ip = getClientIp(req);
  const blocked = limitOrBlock(`${ip}:${session.userId}`, "resend-verification", 3, 300_000); // 3 lần/5 phút
  if (blocked) return blocked;

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "Không tìm thấy user" }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ error: "Email đã được xác thực" }, { status: 400 });

  // Gửi MÃ 6 số (kèm link dự phòng mới; link cũ trong thư đã gửi vẫn dùng được). Chờ 60 giây giữa hai lần, sai 5 lần thì khoá tạm — cùng lõi với đăng ký.
  try {
    const r = await requestSignupCode(user.email.trim().toLowerCase());
    if (r.status !== "sent") return signupRequestResponse(r);
    return NextResponse.json({ success: true, resendAfterSec: r.resendAfterSec, expiresInSec: r.expiresInSec });
  } catch (e) {
    // Trước đây lỗi gửi thư làm cả route sập 500 và nút "Gửi lại" im lặng; nay báo rõ để người dùng biết thư chưa đi.
    console.error("[email] Không gửi lại được mail xác thực:", (e as Error).message);
    return NextResponse.json({ error: MAIL_FAILED_MSG }, { status: 502 });
  }
}
