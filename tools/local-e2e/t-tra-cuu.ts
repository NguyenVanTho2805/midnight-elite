// Tra cứu học viên theo số điện thoại (POST /api/tra-cuu, KHÔNG cần đăng nhập): API thật + Postgres thật.
// Phủ: chỉ số ĐÃ XÁC MINH (phoneE164) mới khớp; số tự khai (`phone`, `parentPhone`) không trả gì; chỉ trả tên che bớt + mã học viên, không trả lớp;
// người khai trùng số của người khác không chen vào kết quả; giới hạn theo SỐ (đổi IP không giúp) lẫn theo IP; SMS tắt → 503.
// Cần SMS_SINK_DIR (xem env.example.sh) và server dev chạy với cùng biến này, vì route chỉ mở khi SMS bật.
import { BASE, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { maskName } from "@/lib/traCuu";

if (!process.env.SMS_SINK_DIR) { console.error("Cần SMS_SINK_DIR (xem env.example.sh) và server dev chạy với cùng biến này."); process.exit(2); }

// Bộ giới hạn nằm trong tiến trình server dev, SỐNG QUA các lần chạy test → mỗi lần chạy dùng số + IP riêng.
const RUN = Math.floor(Math.random() * 90_000_000) + 10_000_000; // 8 chữ số
const phoneOf = (n: number) => `09${String(RUN + n).slice(-8)}`;   // 10 số, đầu 09
const e164Of = (n: number) => `+84${phoneOf(n).slice(1)}`;
let ipSeq = Math.floor(Math.random() * 60_000); // bộ đếm IP sống 60 giây trong server dev: chạy liền hai lần không được trùng IP
const nextIp = () => `10.79.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;
async function call(body: unknown, o: { ip?: string; raw?: string } = {}) {
  const res = await fetch(BASE + "/api/tra-cuu", {
    method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": o.ip ?? nextIp() },
    body: o.raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await res.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text, headers: res.headers };
}
const lookup = (phone: unknown, ip?: string) => call({ phone }, { ip });
const leaks = (text: string, secrets: string[]) => secrets.filter(s => text.includes(s));

(async () => {
  await wipe();
  const studentId = (n: number) => 700_000 + (RUN % 90_000) + n;
  const mkStudent = async (name: string, n: number, o: { phone?: string; parentPhone?: string; e164?: string | null; verifiedAt?: Date | null; course?: string } = {}) => {
    const u = await mkUser({ name });
    await prisma.user.update({
      where: { id: u.id },
      data: { studentId: studentId(n), phone: o.phone ?? null, parentPhone: o.parentPhone ?? null, phoneE164: o.e164 ?? null, phoneVerifiedAt: o.verifiedAt ?? null },
    });
    if (o.course) { const c = await mkCourse(null, { name: o.course }); await prisma.enrollment.create({ data: { userId: u.id, courseId: c.id } }); return { u, c }; }
    return { u, c: null };
  };

  // A: số ĐÃ xác minh (đúng như sau khi nhập mã SMS: phoneE164 + phoneVerifiedAt, và `phone` được gán lại dạng 0xxxxxxxxx)
  const A = await mkStudent("Nguyễn Minh Anh", 1, { phone: phoneOf(1), e164: e164Of(1), verifiedAt: new Date(), course: "Lớp Toán Bí Mật Của A" });
  // B: chỉ có số TỰ KHAI — `phone` của chính em và `parentPhone` do em gõ; không số nào được xác minh
  const B = await mkStudent("Trần Thị Bích Ngọc", 2, { phone: phoneOf(2), parentPhone: phoneOf(3), course: "Lớp Lý Riêng Của B" });
  // C: người khai trùng số ĐÃ xác minh của A vào ô tự khai (ai cũng gõ được số của người khác)
  const C = await mkStudent("Lê Hoàng Chen Ngang", 3, { phone: phoneOf(1), parentPhone: phoneOf(1), course: "Lớp Hoá Của C" });
  // D: gia sư (không phải học sinh) có số đã xác minh
  const D = await mkUser({ name: "Cô Giáo Hương", role: "admin", adminRole: "teacher", tutorVerified: true });
  await prisma.user.update({ where: { id: D.id }, data: { phoneE164: e164Of(4), phoneVerifiedAt: new Date(), phone: phoneOf(4) } });
  // E: có phoneE164 nhưng thiếu mốc xác minh (dữ liệu hỏng) — không được coi là đã xác minh
  const E = await mkStudent("Phạm Quốc Thiếu Mốc", 5, { phone: phoneOf(5), e164: e164Of(5), verifiedAt: null, course: "Lớp Sinh Của E" });
  // F: dùng riêng cho phép thử giới hạn theo số
  const F = await mkStudent("Đỗ Khánh Vy", 6, { phone: phoneOf(6), e164: e164Of(6), verifiedAt: new Date() });

  const secretsOf = (x: { u: { name: string; email: string }; c: { id: string; name: string; shortTitle: string } | null }) =>
    [...x.u.name.split(" "), x.u.email, ...(x.c ? [x.c.id, x.c.name, x.c.shortTitle] : [])];

  section("Số ĐÃ xác minh: tên che bớt + mã học viên, KHÔNG có lớp, KHÔNG có tên đầy đủ");
  const r1 = await lookup(phoneOf(1));
  check("số đã xác minh → 200 và đúng 1 kết quả (người khai trùng số ở ô tự khai không chen vào)", r1.status === 200 && Array.isArray(r1.json?.results) && r1.json.results.length === 1, r1);
  check("tên bị che: 'N••• M••• A•••'", r1.json?.results?.[0]?.maskedName === maskName("Nguyễn Minh Anh") && r1.json.results[0].maskedName === "N••• M••• A•••", r1.json);
  check("có mã học viên đúng", r1.json?.results?.[0]?.studentId === studentId(1), r1.json);
  check("chỉ đúng hai trường maskedName + studentId (không name, không courses, không email, không id)", JSON.stringify(Object.keys(r1.json?.results?.[0] ?? {}).sort()) === JSON.stringify(["maskedName", "studentId"]), r1.json);
  check("không có khoá 'courses' ở bất kỳ đâu trong phản hồi", !/"courses"|"category"|"shortTitle"/.test(r1.text), r1.text);
  check("thân phản hồi không chứa tên đầy đủ từng từ, tên lớp, mã lớp, email của A", leaks(r1.text, secretsOf(A)).length === 0, leaks(r1.text, secretsOf(A)));
  check("thân phản hồi không chứa tên / lớp của người khai trùng số (C)", leaks(r1.text, secretsOf(C)).length === 0, leaks(r1.text, secretsOf(C)));

  section("Cùng một số gõ các kiểu khác nhau → cùng kết quả (khớp theo dạng chuẩn E.164)");
  const p = phoneOf(1);
  for (const [raw, why] of [[`${p.slice(0, 4)} ${p.slice(4, 7)} ${p.slice(7)}`, "có dấu cách"], [`+84${p.slice(1)}`, "+84"], [`84${p.slice(1)}`, "84 không dấu +"]] as const) {
    const r = await lookup(raw);
    check(`"${raw}" (${why}) → cùng học viên A`, r.status === 200 && r.json?.results?.[0]?.studentId === studentId(1), r);
  }

  section("Số TỰ KHAI (chưa xác minh): không trả tên, không trả lớp — kể cả số của chính em lẫn số phụ huynh");
  for (const [n, what] of [[2, "`phone` tự khai của B"], [3, "`parentPhone` tự khai của B"]] as const) {
    const r = await lookup(phoneOf(n));
    check(`${what} → 404, không có 'results'`, r.status === 404 && r.json?.results === undefined, r);
    check(`${what} → thân phản hồi không chứa tên / lớp / mã của B`, leaks(r.text, [...secretsOf(B), String(studentId(2)), "HS-"]).length === 0, leaks(r.text, secretsOf(B)));
  }
  const rE = await lookup(phoneOf(5));
  check("phoneE164 nhưng thiếu phoneVerifiedAt → 404 (không coi là đã xác minh)", rE.status === 404 && leaks(rE.text, secretsOf(E)).length === 0, rE);
  const rD = await lookup(phoneOf(4));
  check("số đã xác minh của GIA SƯ (không phải học sinh) → 404", rD.status === 404 && leaks(rD.text, ["Hương", D.email]).length === 0, rD);
  const rNone = await lookup(phoneOf(9));
  check("số hoàn toàn lạ → 404, thông điệp không nhắc tên ai", rNone.status === 404 && typeof rNone.json?.error === "string", rNone);
  check("số tự khai và số lạ → cùng một dạng phản hồi (không phân biệt được 'có người khai số này' với 'không ai')", (await lookup(phoneOf(2))).text === rNone.text);

  section("Đầu vào xấu → 400 (không 500)");
  for (const [bad, why] of [["abc", "chữ"], ["0201234567", "số bàn"], ["090123", "ngắn"], ["+14155552671", "số nước ngoài"], ["", "rỗng"], [null, "null"], [901234567, "số, không phải chuỗi"], [{ a: 1 }, "object"]] as const) {
    const r = await lookup(bad);
    check(`phone=${JSON.stringify(bad)} (${why}) → 400`, r.status === 400, r);
  }
  check("thân không phải JSON → 400", (await call(undefined, { raw: "xx" })).status === 400);
  check("không có thân → 400", (await call(undefined)).status === 400);

  section("Giới hạn theo SỐ: đổi IP không giúp dò một số");
  const lim: number[] = [];
  for (let i = 0; i < 5; i++) lim.push((await lookup(phoneOf(6), nextIp())).status);
  check("5 lần đầu (mỗi lần một IP khác) → đều 200", lim.every(s => s === 200), lim);
  const over = await lookup(phoneOf(6), nextIp());
  check("lần thứ 6 từ IP mới tinh → 429 kèm Retry-After", over.status === 429 && Number(over.headers.get("retry-after")) > 0, over);
  check("429 không trả tên / mã của F", leaks(over.text, [...secretsOf(F), String(studentId(6))]).length === 0, over.text);
  const overFmt = await lookup(`+84${phoneOf(6).slice(1)}`, nextIp());
  check("cùng số gõ dạng +84, IP mới → vẫn 429 (đếm theo dạng chuẩn, không theo cách gõ)", overFmt.status === 429, overFmt);
  const other = await lookup(phoneOf(1), nextIp());
  check("số KHÁC từ IP mới không bị ảnh hưởng (đếm riêng từng số)", other.status === 200, other);

  section("Giới hạn theo IP vẫn còn (10 lượt / phút / IP)");
  const ip = nextIp(); const st: number[] = [];
  for (let i = 0; i < 11; i++) st.push((await lookup(phoneOf(20 + i), ip)).status);
  check("10 lượt đầu từ cùng IP (11 số khác nhau) không bị chặn", st.slice(0, 10).every(s => s !== 429), st);
  check("lượt thứ 11 từ cùng IP → 429", st[10] === 429, st);

  section("SMS tắt → chưa có số nào xác minh được → 503, không tra DB");
  // Gọi thẳng hàm xử lý trong tiến trình test (server dev luôn bật SMS vì có SMS_SINK_DIR); smsEnabled() đọc biến môi trường mỗi lần gọi.
  const { POST } = await import("@/app/api/tra-cuu/route");
  const saved = process.env.SMS_SINK_DIR; delete process.env.SMS_SINK_DIR;
  try {
    const res = await POST(new Request(BASE + "/api/tra-cuu", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": nextIp() }, body: JSON.stringify({ phone: phoneOf(1) }) }));
    const text = await res.text();
    check("số ĐÃ xác minh, SMS tắt → 503 code 'sms-off'", res.status === 503 && JSON.parse(text).code === "sms-off", text);
    check("503 không trả tên / mã học viên", leaks(text, [...secretsOf(A), String(studentId(1)), "maskedName"]).length === 0, text);
  } finally { process.env.SMS_SINK_DIR = saved; }

  await done();
})();
