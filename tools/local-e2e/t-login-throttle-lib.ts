// Giới hạn đăng nhập bằng mật khẩu — phần thuần src/lib/loginThrottle.ts + src/lib/passwordLogin.ts (giờ giả, không DB, không mạng).
// SCL-J: bộ đếm nằm ở Postgres; ở đây giả lập bảng login_failures bằng một mảng để kiểm đúng quy tắc của throttleDecision.
import { throttleDecision, WINDOW_MS, IP_MAX_WRONG, PAIR_MAX_WRONG, ACCOUNT_SOFT_AFTER, ACCOUNT_DELAY_MS, type LoginFailureRow } from "@/lib/loginThrottle";
import { parsePasswordLogin, wrongMessage, waitMessage, MAX_PASSWORD_LEN, MAX_IDENTIFIER_LEN } from "@/lib/passwordLogin";
import { check, section, done } from "./h";

let t = 1_000_000;
const advance = (ms: number) => { t += ms; };
function table() {
  const rows: LoginFailureRow[] = [];
  return {
    fail: (ip: string, key: string) => { rows.push({ ip, accountKey: key, at: t, cleared: false }); },
    ok: (key: string) => { for (const r of rows) if (r.accountKey === key) r.cleared = true; },
    wait: (ip: string, key = "k@test.local") => throttleDecision(rows, ip, key, t).waitSec,
    delay: (key: string, ip = "9.9.9.9") => throttleDecision(rows, ip, key, t).delayMs,
  };
}

section(`Theo CẶP email + máy: sai ${PAIR_MAX_WRONG} lần thì lần thứ ${PAIR_MAX_WRONG + 1} bị chặn, hết 15 phút tự mở`);
{
  const th = table();
  for (let i = 0; i < PAIR_MAX_WRONG - 1; i++) { th.fail("1.1.1.1", "a@test.local"); advance(1000); }
  check(`sai ${PAIR_MAX_WRONG - 1} lần: vẫn được thử`, th.wait("1.1.1.1", "a@test.local") === 0);
  th.fail("1.1.1.1", "a@test.local");
  const w = th.wait("1.1.1.1", "a@test.local");
  check(`sai ${PAIR_MAX_WRONG} lần: lần thứ ${PAIR_MAX_WRONG + 1} bị chặn, chờ gần 15 phút`, w > WINDOW_MS / 1000 - 10 && w <= WINDOW_MS / 1000, w);
  check("cùng email ở MÁY KHÁC vẫn được thử (kẻ dò không khoá được người thật)", th.wait("2.2.2.2", "a@test.local") === 0);
  check("cùng máy, email KHÁC vẫn được thử (tầng máy còn xa ngưỡng 20)", th.wait("1.1.1.1", "b@test.local") === 0);
  advance(WINDOW_MS - 3_000); // lần sai đầu (cách đây 4 giây khi đủ 5) đã trượt khỏi cửa sổ
  check("lần sai cũ nhất trượt khỏi 15 phút → mở lại (không cần ai mở khoá)", th.wait("1.1.1.1", "a@test.local") === 0, th.wait("1.1.1.1", "a@test.local"));
  advance(10_000);
  th.fail("1.1.1.1", "c@test.local");
  for (let i = 0; i < PAIR_MAX_WRONG; i++) th.fail("1.1.1.1", "c@test.local");
  check("bị chặn rồi", th.wait("1.1.1.1", "c@test.local") > 0);
  th.ok("c@test.local");
  check("đăng nhập đúng (từ máy khác) / đặt lại mật khẩu → mở cặp đó", th.wait("1.1.1.1", "c@test.local") === 0);
}

section("Theo MÁY: sai 20 lần trong 15 phút thì chặn");
{
  const th = table();
  check("máy mới: được thử", th.wait("1.1.1.1") === 0);
  for (let i = 0; i < IP_MAX_WRONG - 1; i++) { th.fail("1.1.1.1", `a${i}`); advance(1000); }
  check(`sai ${IP_MAX_WRONG - 1} lần (mỗi lần một email): vẫn được thử`, th.wait("1.1.1.1") === 0);
  th.fail("1.1.1.1", "alast");
  const w = th.wait("1.1.1.1");
  check(`sai đủ ${IP_MAX_WRONG} lần: bị chặn, còn phải chờ gần 15 phút (≤ ${WINDOW_MS / 1000}s)`, w > 0 && w <= WINDOW_MS / 1000 && w > WINDOW_MS / 1000 - 40, w);
  check("máy khác không bị ảnh hưởng", th.wait("2.2.2.2") === 0);
  th.ok("alast");
  check("đăng nhập đúng KHÔNG xoá bộ đếm theo máy (kẻ dò không rửa được bộ đếm bằng một tài khoản của chính mình)", th.wait("1.1.1.1") > 0);
  advance(WINDOW_MS - 18_000); // lần sai CŨ NHẤT (cách đây 19 giây khi đủ 20) trượt khỏi cửa sổ
  check("khi lần sai cũ nhất trượt khỏi 15 phút → được thử lại (cửa sổ trượt, không phải khoá cứng)", th.wait("1.1.1.1") === 0, th.wait("1.1.1.1"));
}

section("Theo TÀI KHOẢN (mọi máy): chỉ làm chậm, không bao giờ chặn");
{
  const th = table();
  for (let i = 0; i < ACCOUNT_SOFT_AFTER - 1; i++) th.fail(`ip${i}`, "x@test.local");
  check(`sai ${ACCOUNT_SOFT_AFTER - 1} lần: chưa chậm`, th.delay("x@test.local") === 0);
  th.fail("ipN", "x@test.local");
  check(`sai ${ACCOUNT_SOFT_AFTER} lần (từ nhiều máy khác nhau): lần thử kế tiếp bị chờ thêm ${ACCOUNT_DELAY_MS}ms`, th.delay("x@test.local") === ACCOUNT_DELAY_MS);
  for (let i = 0; i < 50; i++) th.fail(`ipz${i}`, "x@test.local");
  check("sai rất nhiều lần từ máy khác nhau vẫn chỉ là chờ 1,5 giây, máy mới không bị chặn", th.delay("x@test.local") === ACCOUNT_DELAY_MS && th.wait("ip-moi", "x@test.local") === 0);
  check("tài khoản khác không bị chậm lây", th.delay("y@test.local") === 0);
  th.ok("x@test.local");
  check("đăng nhập đúng → xoá bộ đếm của tài khoản đó", th.delay("x@test.local") === 0);
  th.fail("a", "w@test.local");
  for (let i = 0; i < 5; i++) th.fail(`b${i}`, "w@test.local");
  advance(WINDOW_MS + 1);
  check("hết 15 phút → bộ đếm tài khoản tự hết", th.delay("w@test.local") === 0);
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
