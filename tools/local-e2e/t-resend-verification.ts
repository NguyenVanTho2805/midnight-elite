// 07/11 — POST /api/auth/resend-verification: gửi mail lỗi ⇒ 502 JSON có `error` tiếng Việt (trước đây 500 trống, nút "Gửi lại" im lặng).
// Hai chế độ theo môi trường của MÁY CHỦ DEV (bài đọc cùng biến, nên khởi động dev và chạy bài với cùng giá trị):
//  - KHÔNG đặt EMAIL_SINK_DIR và không GMAIL_USER: getTransport() ném lỗi ⇒ phải 502 + {error}.
//  - Đặt EMAIL_SINK_DIR: thư ghi vào tệp ⇒ 200 {success:true} (kiểm đường vui vẫn đúng).
import { api, mkUser, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const sink = !!process.env.EMAIL_SINK_DIR;
  section(`resend-verification (${sink ? "có EMAIL_SINK_DIR ⇒ đường vui" : "không có nơi gửi mail ⇒ đường lỗi"})`);

  const anon = await api("POST", "/api/auth/resend-verification");
  check("chưa đăng nhập ⇒ 401 JSON có error", anon.status === 401 && typeof anon.json?.error === "string", anon.status);

  const verified = await mkUser({ name: "Đã xác thực", emailVerified: true });
  const v = await api("POST", "/api/auth/resend-verification", { as: verified });
  check("email đã xác thực ⇒ 400 JSON có error", v.status === 400 && typeof v.json?.error === "string", { status: v.status, json: v.json });

  const u = await mkUser({ name: "Chưa xác thực", emailVerified: false });
  const r = await api("POST", "/api/auth/resend-verification", { as: u });
  if (sink) {
    check("có nơi gửi mail ⇒ 200 {success:true}", r.status === 200 && r.json?.success === true, { status: r.status, text: r.text.slice(0, 200) });
  } else {
    check("gửi mail lỗi ⇒ 502 (không phải 500)", r.status === 502, { status: r.status, text: r.text.slice(0, 200) });
    check("thân là JSON có `error` tiếng Việt", r.json && typeof r.json.error === "string" && /Chưa gửi được email/.test(r.json.error), r.text.slice(0, 200));
    check("không lộ chi tiết kỹ thuật (GMAIL_USER…) ra ngoài", !/GMAIL|smtp|Error:|stack/i.test(r.text), r.text.slice(0, 200));
    check("không có success:true khi mail lỗi", r.json?.success !== true);
  }
  const tokens = await prisma.verifyToken.count({ where: { userId: u.id } });
  check("token xác thực vẫn được tạo (lần bấm sau có thể gửi lại)", tokens === 1, tokens);
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
