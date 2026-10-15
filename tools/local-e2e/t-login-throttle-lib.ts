// Giới hạn đăng nhập bằng mật khẩu — phần thuần src/lib/loginThrottle.ts + src/lib/passwordLogin.ts (giờ giả, không DB, không mạng).
import { createLoginThrottle, WINDOW_MS, IP_MAX_WRONG, ACCOUNT_SOFT_AFTER, ACCOUNT_DELAY_MS, MAX_KEYS } from "@/lib/loginThrottle";
import { parsePasswordLogin, wrongMessage, waitMessage, MAX_PASSWORD_LEN, MAX_IDENTIFIER_LEN } from "@/lib/passwordLogin";
import { check, section, done } from "./h";

let t = 1_000_000;
const clock = () => t;
const advance = (ms: number) => { t += ms; };

section("Theo MÁY: sai 20 lần trong 15 phút thì chặn");
{
  const th = createLoginThrottle(clock);
  check("máy mới: được thử", th.ipWaitSec("1.1.1.1") === 0);
  for (let i = 0; i < IP_MAX_WRONG - 1; i++) { th.fail("1.1.1.1", `a${i}`); advance(1000); }
  check(`sai ${IP_MAX_WRONG - 1} lần: vẫn được thử`, th.ipWaitSec("1.1.1.1") === 0);
  th.fail("1.1.1.1", "alast");
  const w = th.ipWaitSec("1.1.1.1");
  check(`sai đủ ${IP_MAX_WRONG} lần: bị chặn, còn phải chờ gần 15 phút (≤ ${WINDOW_MS / 1000}s)`, w > 0 && w <= WINDOW_MS / 1000 && w > WINDOW_MS / 1000 - 40, w);
  check("máy khác không bị ảnh hưởng", th.ipWaitSec("2.2.2.2") === 0);
  advance(WINDOW_MS - 18_000); // lần sai CŨ NHẤT (cách đây 19 giây khi đủ 20) trượt khỏi cửa sổ
  check("khi lần sai cũ nhất trượt khỏi 15 phút → được thử lại (cửa sổ trượt, không phải khoá cứng)", th.ipWaitSec("1.1.1.1") === 0, th.ipWaitSec("1.1.1.1"));
  advance(WINDOW_MS);
  check("sau 15 phút không sai thêm → sạch hẳn", th.ipWaitSec("1.1.1.1") === 0 && th.size().ip === 0, th.size());
}

section("Theo TÀI KHOẢN: chỉ làm chậm, không bao giờ chặn");
{
  const th = createLoginThrottle(clock);
  for (let i = 0; i < ACCOUNT_SOFT_AFTER - 1; i++) th.fail(`ip${i}`, "x@test.local");
  check(`sai ${ACCOUNT_SOFT_AFTER - 1} lần: chưa chậm`, th.accountDelayMs("x@test.local") === 0);
  th.fail("ipN", "x@test.local");
  check(`sai ${ACCOUNT_SOFT_AFTER} lần (từ nhiều máy khác nhau): lần thử kế tiếp bị chờ thêm ${ACCOUNT_DELAY_MS}ms`, th.accountDelayMs("x@test.local") === ACCOUNT_DELAY_MS);
  for (let i = 0; i < 50; i++) th.fail(`ipz${i}`, "x@test.local");
  check("sai rất nhiều lần vẫn chỉ là chờ 1,5 giây — không có trạng thái 'khoá' (kẻ gõ sai không khoá được người thật)", th.accountDelayMs("x@test.local") === ACCOUNT_DELAY_MS);
  check("tài khoản khác không bị chậm lây", th.accountDelayMs("y@test.local") === 0);
  th.ok("x@test.local");
  check("đăng nhập đúng → xoá bộ đếm của tài khoản đó", th.accountDelayMs("x@test.local") === 0);
  th.fail("ip-only", "z@test.local");
  th.ok("z@test.local");
  check("đăng nhập đúng KHÔNG xoá bộ đếm theo máy (kẻ dò không rửa được bộ đếm bằng một tài khoản của chính mình)", th.size().ip >= 1);
  th.fail("a", "w@test.local");
  advance(WINDOW_MS + 1);
  check("hết 15 phút → bộ đếm tài khoản tự hết", th.accountDelayMs("w@test.local") === 0);
}

section("Bộ nhớ có trần");
{
  const th = createLoginThrottle(clock);
  for (let i = 0; i < MAX_KEYS + 500; i++) th.fail(`ip-${i}`, `acct-${i}`);
  check(`phun ${MAX_KEYS + 500} tài khoản/địa chỉ → không quá ${MAX_KEYS} khoá mỗi bảng`, th.size().ip <= MAX_KEYS && th.size().account <= MAX_KEYS, th.size());
  check("khoá cũ nhất bị loại, khoá mới vẫn nhớ", th.accountDelayMs("acct-0") === 0 && th.size().account === MAX_KEYS);
}

section("parsePasswordLogin — đọc dữ liệu gửi lên");
const ok = (v: unknown) => parsePasswordLogin(v);
{
  const a = ok({ identifier: "  Minh.Anh@Test.Local ", password: "Passw0rd!" });
  check("email: cắt khoảng trắng + chữ thường; khoá giới hạn = email chuẩn hoá", a.ok && a.target.kind === "email" && a.target.email === "minh.anh@test.local" && a.target.key === "minh.anh@test.local", a);
  const b = ok({ email: "a@b.vn", password: "x" });
  check("tên cũ `email` vẫn nhận (nơi gọi cũ không gãy)", b.ok && b.target.kind === "email" && b.target.email === "a@b.vn", b);
  const c = ok({ identifier: "x@y", password: "x" });
  check("email lạ không có đuôi (tài khoản cũ) vẫn nhận — không chặt hơn bản cũ", c.ok && c.target.kind === "email", c);
  const d = ok({ identifier: "0901 234 567", password: "x" });
  check("số điện thoại: chuẩn hoá E.164, khoá có tiền tố 'tel:' (không trùng email)", d.ok && d.target.kind === "phone" && d.target.e164 === "+84901234567" && d.target.key === "tel:+84901234567", d);
  check("mật khẩu giữ NGUYÊN (không cắt khoảng trắng — mật khẩu có thể có dấu cách)", (() => { const r = ok({ identifier: "a@b.vn", password: "  p w  " }); return r.ok && r.password === "  p w  "; })());
}
for (const [name, body] of [
  ["null", null], ["mảng", []], ["chuỗi", "x"], ["thiếu mật khẩu", { identifier: "a@b.vn" }], ["mật khẩu rỗng", { identifier: "a@b.vn", password: "" }],
  ["thiếu tài khoản", { password: "x" }], ["tài khoản toàn khoảng trắng", { identifier: "   ", password: "x" }],
  ["tài khoản là số", { identifier: 123, password: "x" }], ["mật khẩu là số", { identifier: "a@b.vn", password: 123456 }], ["mật khẩu là object", { identifier: "a@b.vn", password: { $ne: "" } }],
] as const) check(`từ chối: ${name}`, !ok(body).ok, ok(body));
check(`tài khoản dài hơn ${MAX_IDENTIFIER_LEN} → từ chối`, !ok({ identifier: "a".repeat(MAX_IDENTIFIER_LEN) + "@b.vn", password: "x" }).ok);
check(`mật khẩu dài hơn ${MAX_PASSWORD_LEN} → từ chối (không bắt máy chủ băm chuỗi khổng lồ)`, !ok({ identifier: "a@b.vn", password: "p".repeat(MAX_PASSWORD_LEN + 1) }).ok && ok({ identifier: "a@b.vn", password: "p".repeat(MAX_PASSWORD_LEN) }).ok);
{
  const r = ok({ identifier: "abc", password: "x" });
  check("không có '@' và không phải số di động → câu hướng dẫn rõ ràng", !r.ok && /email hoặc số điện thoại/.test(r.error), r);
  check("số bàn / số nước ngoài không được coi là tài khoản", !ok({ identifier: "0201234567", password: "x" }).ok && !ok({ identifier: "+14155552671", password: "x" }).ok);
}

section("Câu báo");
{
  const e = ok({ identifier: "a@b.vn", password: "x" }), p = ok({ identifier: "0901234567", password: "x" });
  check("sai email → giữ nguyên chữ cũ 'Email hoặc mật khẩu không đúng'", e.ok && wrongMessage(e.target) === "Email hoặc mật khẩu không đúng");
  check("sai số điện thoại → 'Số điện thoại hoặc mật khẩu không đúng'", p.ok && wrongMessage(p.target) === "Số điện thoại hoặc mật khẩu không đúng");
  check("câu chặn tạm: nêu số phút (làm tròn lên) và mời dùng mã một lần", /Thử lại sau 15 phút/.test(waitMessage(900)) && /Thử lại sau 1 phút/.test(waitMessage(5)) && /mã một lần/.test(waitMessage(900)));
}

done();
