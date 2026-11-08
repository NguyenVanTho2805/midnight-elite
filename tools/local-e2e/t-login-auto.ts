// Tự động đăng nhập — API thật + Postgres thật: cờ `auto: true` của POST /api/auth/login (trình duyệt tự đưa mật khẩu đã lưu, không phải người dùng bấm).
// Quy tắc: học sinh và gia sư (mốc 30 ngày) vào được như thường; QUẢN TRỊ (mốc 12 giờ, sessionPolicy.ts) bị từ chối 403 `auto_not_allowed` SAU khi mật khẩu đúng và TRƯỚC khi
// cấp phiên (không cookie); sai mật khẩu với `auto` vẫn là 401 cùng câu như thường (không lộ gì thêm); cờ chỉ có nghĩa khi là boolean `true`; đăng nhập thủ công của quản trị không đổi.
import { BASE, mkUser, mkTutor, mkSuper, wipe, check, section, done } from "./h";

// Bộ đếm theo máy sống trong server dev: mỗi lần chạy dùng dải IP riêng (xem t-login-password.ts).
let ipSeq = Math.floor(Math.random() * 40) * 250 + 20_000;
const nextIp = () => `10.98.${Math.floor(++ipSeq / 250) % 250}.${ipSeq % 250}`;
async function login(body: unknown) {
  const res = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": nextIp() }, body: JSON.stringify(body) });
  const text = await res.text(); let json: any = null; try { json = JSON.parse(text); } catch { /* */ }
  return { status: res.status, json, text, headers: res.headers };
}
const hasSession = (r: { headers: Headers }) => (r.headers.get("set-cookie") ?? "").includes("midnight_session=");
const PW = "Passw0rd!";

(async () => {
  await wipe();
  const S = await mkUser({ name: "Em Học Sinh" });
  const T = await mkTutor("Cô Gia Sư");
  const A = await mkSuper("Quản trị cấp 1");
  const C = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });

  section("Học sinh và gia sư: tự đăng nhập vào được");
  const s = await login({ identifier: S.email, password: PW, auto: true });
  check("học sinh + auto → 200 + cookie phiên", s.status === 200 && hasSession(s) && s.json.id === S.id, s);
  const t = await login({ identifier: T.email, password: PW, auto: true });
  check("gia sư (role admin, adminRole teacher) + auto → 200 + cookie phiên", t.status === 200 && hasSession(t) && t.json.adminRole === "teacher", t);

  section("Quản trị: không tự đăng nhập (mốc 12 giờ có chủ ý)");
  for (const [label, u] of [["quản trị cấp 1", A], ["quản trị nội dung", C]] as const) {
    const r = await login({ identifier: u.email, password: PW, auto: true });
    check(`${label} + auto → 403 code auto_not_allowed`, r.status === 403 && r.json?.code === "auto_not_allowed", r);
    check(`${label} + auto → KHÔNG cấp cookie phiên`, !hasSession(r), r.headers.get("set-cookie"));
    check(`${label} + auto: lời Việt, không chứa mật khẩu/băm`, /quản trị/.test(r.json?.error ?? "") && !r.text.includes(PW) && !/\$2[aby]\$/.test(r.text), r.text);
    check(`${label} + auto: không đặt được bộ nhớ đệm`, /no-store/.test(r.headers.get("cache-control") ?? ""), r.headers.get("cache-control"));
  }

  section("Đăng nhập thủ công của quản trị không đổi");
  const m1 = await login({ identifier: A.email, password: PW });
  check("quản trị không cờ auto → 200 + cookie phiên", m1.status === 200 && hasSession(m1) && m1.json.adminRole === "admin_super", m1);
  const m2 = await login({ identifier: A.email, password: PW, auto: false });
  check("quản trị với auto:false → 200 + cookie phiên", m2.status === 200 && hasSession(m2), m2);

  section("Cờ chỉ có nghĩa khi là boolean true");
  for (const v of ["true", 1, "1", {}, [], null, "yes"]) {
    const r = await login({ identifier: A.email, password: PW, auto: v });
    check(`auto = ${JSON.stringify(v)} (không phải boolean true) → coi là đăng nhập thủ công: 200`, r.status === 200 && hasSession(r), r);
  }

  section("Sai mật khẩu với auto: không lộ thêm gì");
  const w1 = await login({ identifier: S.email, password: "sai-mat-khau", auto: true });
  const w2 = await login({ identifier: S.email, password: "sai-mat-khau" });
  const w3 = await login({ identifier: A.email, password: "sai-mat-khau", auto: true });
  check("sai mật khẩu + auto → 401, không cookie, cùng câu với đăng nhập thường", w1.status === 401 && !hasSession(w1) && w1.text === w2.text, [w1.text, w2.text]);
  check("quản trị sai mật khẩu + auto → 401 như thường (KHÔNG lộ 'đây là tài khoản quản trị')", w3.status === 401 && w3.json?.code === undefined && w3.text === w2.text, w3.text);
  const w4 = await login({ identifier: `khong.co.${Date.now()}@test.local`, password: "x", auto: true });
  check("tài khoản không tồn tại + auto → 401 cùng câu", w4.status === 401 && w4.text === w2.text, w4.text);

  section("Dữ liệu xấu không làm hỏng đường cũ");
  const b1 = await login({ identifier: S.email, password: PW, auto: true, extra: "x".repeat(50) });
  check("thêm trường lạ vẫn đăng nhập được", b1.status === 200, b1);
  const b2 = await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": nextIp() }, body: "không phải json" });
  check("thân không phải JSON → 400 như cũ (không sập)", b2.status === 400, b2.status);
  done();
})();
