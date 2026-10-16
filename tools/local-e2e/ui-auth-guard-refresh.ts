// AuthGuard + AuthContext.refresh (16/10/2026): máy chủ tạo phiên SAU lần gọi /api/auth/me lúc mở trang mà trang không tải cứng
// (vd GET /api/auth/verify-email tự đăng nhập) → trước đây `user` vẫn null → AuthGuard đẩy sang /dang-nhap → proxy.ts 307 đẩy về lại → TRANG TRẮNG.
// Trình duyệt thật. Ca A/B là ca lỗi gốc (đỏ trước khi sửa); ca C khẳng định khách thật vẫn bị chuyển sang đăng nhập, không vòng lặp, chỉ thêm 1 lần /api/auth/me; ca D người đã có phiên không bị gọi thừa.
import { BASE, mkUser, wipe, check, eventually, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { randomBytes } from "node:crypto";

const mkToken = async (userId: string) => {
  const token = randomBytes(16).toString("hex");
  await prisma.verifyToken.create({ data: { token, userId, expiresAt: new Date(Date.now() + 3600_000) } });
  return token;
};

(async () => {
  await wipe();
  await launch();
  const errors: string[] = [];
  const watch = (p: any) => {
    p.on("pageerror", (e: unknown) => errors.push(String(e)));
    p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)|Hydration/i.test(m.text())) errors.push(m.text()); });
  };
  // Ghi lại mọi lần trình duyệt đi tới /dang-nhap và mọi lần gọi /api/auth/me (đếm để chứng minh không vòng lặp, không gọi thừa).
  const track = (p: any) => {
    const t = { loginHits: [] as string[], me: 0 };
    p.on("framenavigated", (f: any) => { if (f === p.mainFrame() && /\/dang-nhap/.test(f.url())) t.loginHits.push(f.url()); });
    p.on("request", (r: any) => { if (new URL(r.url()).pathname === "/api/auth/me") t.me++; });
    return t;
  };
  const isBlank = (p: any) => p.evaluate(`(document.body?.innerText ?? "").trim().length === 0`) as Promise<boolean>;
  const acct = (p: any, name: string) => p.getByRole("button", { name: `Tài khoản của ${name}` });

  // ───────────────────────────── A. Trang xác thực email tự chuyển (router.push sau 3 giây) — đường thật của người dùng mới
  section("A. /xac-thuc-email → tự vào trang học viên bằng router.push (không tải cứng)");
  const A = await mkUser({ name: "Bích Ngọc", emailVerified: false });
  const tokenA = await mkToken(A.id);
  const ctxA = await ctxFor(null);
  const pa = await ctxA.newPage(); watch(pa);
  const ta = track(pa);
  await pa.goto(`${BASE}/xac-thuc-email?token=${tokenA}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pa.getByText("Xác thực thành công!").waitFor({ timeout: 90000 });
  check("máy chủ đã tạo phiên (cookie midnight_session có mặt) mà trang KHÔNG tải cứng", (await ctxA.cookies()).some(c => c.name === "midnight_session"));
  await pa.waitForURL(/\/student\/hoc-tap/, { timeout: 90000 });
  await acct(pa, "Bích Ngọc").waitFor({ timeout: 90000 }).catch(() => {});
  await shot(pa, "auth-refresh-A");
  check("đang ở /student/hoc-tap (không bị đẩy sang /dang-nhap)", /\/student\/hoc-tap/.test(pa.url()), pa.url());
  check("trang KHÔNG trắng: có vỏ học viên và nút tài khoản của người vừa xác thực", await acct(pa, "Bích Ngọc").isVisible());
  check("không có lần nào đi tới /dang-nhap trên đường đi", ta.loginHits.length === 0, ta.loginHits);
  await ctxA.close();

  // ───────────────────────────── B. Cùng lỗi nhưng bấm tay: đứng ở trang khách, máy chủ tạo phiên bằng fetch, rồi router.push
  section("B. Phiên được tạo bằng fetch rồi router.push sang trang học viên (không tải cứng)");
  const B = await mkUser({ name: "Gia Huy", emailVerified: false });
  const tokenB = await mkToken(B.id);
  const ctxB = await ctxFor(null);
  const pb = await ctxB.newPage(); watch(pb);
  const tb = track(pb);
  await pb.goto(`${BASE}/khoa-hoc`, { waitUntil: "networkidle", timeout: 120000 });
  check("lúc mở trang chưa có người dùng (cookie rỗng)", !(await ctxB.cookies()).some(c => c.name === "midnight_session"));
  const ok = await pb.evaluate(async (t: string) => (await (await fetch(`/api/auth/verify-email?token=${t}`)).json()).success === true, tokenB);
  check("verify-email trả success và đặt cookie phiên", ok && (await ctxB.cookies()).some(c => c.name === "midnight_session"));
  const hasRouter = await pb.evaluate(`typeof window.next?.router?.push === "function"`);
  check("có window.next.router.push để đẩy trang kiểu client (không tải cứng)", hasRouter);
  await pb.evaluate(`window.__stillSamePage = true; window.next.router.push("/student/viec-cua-toi")`);
  await pb.waitForURL(/\/student\/viec-cua-toi/, { timeout: 90000 });
  await acct(pb, "Gia Huy").waitFor({ timeout: 90000 }).catch(() => {});
  await shot(pb, "auth-refresh-B");
  check("đúng là điều hướng client (biến trên window còn nguyên = không tải lại trang)", await pb.evaluate(`window.__stillSamePage === true`));
  check("vẫn ở /student/viec-cua-toi, KHÔNG trắng, thấy nút tài khoản", /\/student\/viec-cua-toi/.test(pb.url()) && !(await isBlank(pb)) && await acct(pb, "Gia Huy").isVisible(), pb.url());
  check("không có lần nào đi tới /dang-nhap", tb.loginHits.length === 0, tb.loginHits);
  await ctxB.close();

  // ───────────────────────────── C. Khách thật: vẫn bị chuyển sang đăng nhập, đúng 1 lần, thêm đúng 1 lần hỏi /api/auth/me
  section("C. Khách chưa đăng nhập vào /student/viec-cua-toi");
  const ctxC = await ctxFor(null);
  const pc = await ctxC.newPage(); watch(pc);
  const tc = track(pc);
  await pc.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await pc.waitForURL(/\/dang-nhap/, { timeout: 90000 });
  await pc.waitForLoadState("networkidle").catch(() => {});
  await shot(pc, "auth-refresh-C");
  const u = new URL(pc.url());
  check("chuyển sang /dang-nhap kèm redirect về đúng trang đang định vào", u.pathname === "/dang-nhap" && u.searchParams.get("redirect") === "/student/viec-cua-toi", pc.url());
  check("trang đăng nhập hiện ra (không trắng)", !(await isBlank(pc)));
  await new Promise(r => setTimeout(r, 2500)); // chờ thêm: nếu có vòng lặp thì số lần sẽ tăng
  check("không vòng lặp: đúng 1 lần tới /dang-nhap", tc.loginHits.length === 1, tc.loginHits);
  check("chỉ thêm ĐÚNG 1 lần hỏi /api/auth/me so với lúc mở trang (tổng 2; bản dev StrictMode có thể hỏi thêm 1 lần lúc mở)", tc.me >= 2 && tc.me <= 3, tc.me);
  await ctxC.close();

  // ───────────────────────────── D. Người đã đăng nhập sẵn: không gọi thêm /api/auth/me, vào thẳng
  section("D. Người đã có phiên từ trước vào /student/viec-cua-toi");
  const D = await mkUser({ name: "Thu Hà" });
  const ctxD = await ctxFor(D);
  const pd = await ctxD.newPage(); watch(pd);
  const td = track(pd);
  await pd.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 });
  await acct(pd, "Thu Hà").waitFor({ timeout: 90000 });
  check("vào thẳng, thấy nút tài khoản", await acct(pd, "Thu Hà").isVisible());
  check("không gọi thừa: /api/auth/me chỉ 1 lần lúc mở trang (dev StrictMode tối đa 2)", td.me >= 1 && td.me <= 2, td.me);
  check("không đi qua /dang-nhap", td.loginHits.length === 0, td.loginHits);
  await ctxD.close();

  await eventually("không có lỗi trang / console", () => errors.length === 0);
  if (errors.length) console.log("   lỗi:", errors.slice(0, 4));
  await closeAll();
  await done();
})();
