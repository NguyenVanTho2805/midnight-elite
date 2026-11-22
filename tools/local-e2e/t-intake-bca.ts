// SCL đợt 5 — POST /api/intake/bca (Apps Script → KiN) + trang /chao/<mã> + POST /api/chao/dat-mat-khau.
// Máy chủ thử phải chạy với KIN_INTAKE_KEY / KIN_INTAKE_COURSES của tools/local-e2e/env.sh ({"Toán":"bca-toan","Sử":"bca-su"}).
// Chạy: source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/t-intake-bca.ts
import { prisma } from "@/lib/prisma";
import { hashWelcomeToken } from "@/lib/intakeServer";
import { BASE, api, mkTutor, mkUser, wipe, check, section, done } from "./h";

const KEY = process.env.KIN_INTAKE_KEY ?? "";
const D = 86_400_000;
let seq = 0;
const form = (o: Record<string, unknown> = {}) => ({ loai: "hocthu", hoTen: "Nguyễn Văn An", sdt: "0901234567", gmail: "an.bca@gmail.com", khoi: "Khối 12", mon: ["Toán", "Sử"], reqId: `r${++seq}`, ...o });
const send = (body: unknown, key: string | null = KEY) => api("POST", "/api/intake/bca", { body, headers: key === null ? {} : { "x-kin-intake-key": key } });
const tokenOf = (next: string) => next.split("/chao/")[1] ?? "";
async function mkBcaCourse(id: string, ownerId: string, name: string, capacity: number | null = null) {
  return prisma.course.create({
    data: { id, adminId: Math.floor(Math.random() * 1e9), name, adminName: name, shortTitle: name, category: "toan", instructor: "Anh Thanh", teacherAvatar: "", openDate: "2026-11-01",
      types: [], bg: "", price: 0, createdAt: new Date().toISOString(), ownerId, capacity, classStatus: "open", joinPolicy: "invite_only", status: false },
  });
}
const enrollsOf = (userId: string) => prisma.enrollment.findMany({ where: { userId }, orderBy: { courseId: "asc" } });

(async () => {
  await wipe();
  const T = await mkTutor("Anh Thanh");
  await mkBcaCourse("bca-toan", T.id, "BCA Toán 12");
  await mkBcaCourse("bca-su", T.id, "BCA Sử 12");
  await prisma.classSchedule.create({ data: { courseId: "bca-toan", dayOfWeek: 2, startTime: "20:00", endTime: "21:30" } });

  section("Khoá: thiếu / sai ⇒ 401; thiếu env hoặc ngắn ⇒ 503 (gọi thẳng hàm route)");
  check("khoá env của máy thử đủ 24 ký tự", KEY.length >= 24);
  const noKey = await send(form(), null);
  check("thiếu header ⇒ 401", noKey.status === 401 && noKey.json?.ok === false, noKey.json);
  const bad = await send(form(), KEY + "x");
  check("sai khoá ⇒ 401", bad.status === 401, bad.json);
  check("sai khoá không tạo tài khoản", (await prisma.user.count({ where: { email: "an.bca@gmail.com" } })) === 0);
  const { POST } = await import("@/app/api/intake/bca/route");
  const call = (k: string) => POST(new Request("http://x/api/intake/bca", { method: "POST", headers: { "x-kin-intake-key": k, "content-type": "application/json", "x-forwarded-for": "9.9.9.9" }, body: JSON.stringify(form()) }));
  const saved = process.env.KIN_INTAKE_KEY;
  delete process.env.KIN_INTAKE_KEY;
  check("thiếu KIN_INTAKE_KEY ⇒ 503", (await call("bat-ky")).status === 503);
  process.env.KIN_INTAKE_KEY = "ngan-qua-23-ky-tu-aaaaa";
  check("khoá ngắn < 24 ký tự ⇒ 503 (kể cả gửi đúng khoá ngắn)", (await call("ngan-qua-23-ky-tu-aaaaa")).status === 503);
  process.env.KIN_INTAKE_KEY = saved;

  section("Thân phiếu");
  const big = await send({ ...form(), hoTen: "A".repeat(6000) });
  check("thân > 5 KB ⇒ 400", big.status === 400, big.json);
  check("thiếu gmail ⇒ 400", (await send(form({ gmail: "" }))).status === 400);
  check("môn lạ ⇒ 400", (await send(form({ mon: ["Hoá"] }))).status === 400);
  check("loai lạ ⇒ 400", (await send(form({ loai: "khac" }))).status === 400);

  section("D9 Khối 10 / thí sinh tự do ⇒ skip, không tạo gì");
  const k10 = await send(form({ khoi: "Khối 10", gmail: "k10@gmail.com" }));
  check("Khối 10 ⇒ { ok: true, skip: 'khoi' }", k10.status === 200 && k10.json?.ok === true && k10.json?.skip === "khoi" && !k10.json?.next, k10.json);
  const tsd = await send(form({ khoi: "Thí sinh tự do", gmail: "tsd@gmail.com" }));
  check("Thí sinh tự do ⇒ skip khoi", tsd.json?.skip === "khoi");
  check("không tạo tài khoản cho khối 10 / tự do", (await prisma.user.count({ where: { email: { in: ["k10@gmail.com", "tsd@gmail.com"] } } })) === 0);

  section("Môn chưa có lớp");
  const noCls = await send(form({ mon: ["Địa", "Anh"], gmail: "dia@gmail.com" }));
  check("chỉ chọn môn chưa có lớp ⇒ skip 'khong_co_lop'", noCls.json?.ok === true && noCls.json?.skip === "khong_co_lop", noCls.json);
  check("không tạo tài khoản", (await prisma.user.count({ where: { email: "dia@gmail.com" } })) === 0);

  section("Tạo mới: học thử Toán + Sử + Địa (Địa bỏ qua)");
  const r1 = await send(form({ mon: ["Toán", "Sử", "Địa"], gmail: "An.BCA@Gmail.com" }));
  check("200 ok + next là /chao/<mã>", r1.status === 200 && r1.json?.ok === true && /\/chao\/[\w-]{40,}$/.test(r1.json?.next ?? ""), r1.json);
  const next1: string = r1.json?.next ?? "";
  check("link không chứa tên / SĐT / Gmail (tình huống 4)", !/an\.bca|0901234567|Nguy|gmail/i.test(next1), next1);
  const u = await prisma.user.findUnique({ where: { email: "an.bca@gmail.com" } });
  check("tạo học sinh theo gmail chữ thường, tên + SĐT, chưa xác minh email", !!u && u.role === "student" && u.name === "Nguyễn Văn An" && u.phone === "0901234567" && u.emailVerified === false, u);
  check("có ví (cùng cách /api/auth/register)", (await prisma.wallet.count({ where: { userId: u!.id } })) === 1);
  let es = await enrollsOf(u!.id);
  check("2 ghi danh thử (Toán, Sử), 14 ngày, chưa tính ngày", es.length === 2 && es.every(e => e.trialDays === 14 && e.trialStartedAt === null && e.status === "active" && e.trialConvertRequestedAt === null), es);
  check("nhật ký enrollment.create source intake ×2 + intake.bca (không tên/SĐT/Gmail)", (await prisma.auditLog.count({ where: { action: "enrollment.create", resourceId: { in: es.map(e => e.id) } } })) === 2
    && !JSON.stringify(await prisma.auditLog.findMany({ where: { action: "intake.bca" } })).match(/an\.bca|0901234567|Nguyễn/));
  const w1 = await prisma.intakeWelcome.findUnique({ where: { tokenHash: hashWelcomeToken(tokenOf(next1)) } });
  check("IntakeWelcome lưu băm, hết hạn ~7 ngày, chưa đặt mật khẩu", !!w1 && w1.userId === u!.id && Math.abs(w1.expiresAt.getTime() - Date.now() - 7 * D) < 60_000 && w1.passwordSetAt === null, w1);
  check("CSDL không lưu mã thô", (await prisma.intakeWelcome.count({ where: { tokenHash: tokenOf(next1) } })) === 0);

  section("Trang chào /chao/<mã>");
  const page = await api("GET", `/chao/${tokenOf(next1)}`);
  check("200, chào theo TÊN 'An', không họ đầy đủ / SĐT / Gmail", page.status === 200 && page.text.includes("Chào An") && !page.text.includes("Nguyễn Văn An") && !page.text.includes("0901234567") && !page.text.includes("an.bca@gmail.com"));
  check("noindex", /<meta[^>]+name="robots"[^>]+noindex/.test(page.text));
  check("có lớp + lịch từ ClassSchedule (T3 · 20:00–21:30) và nút Zalo học thử", page.text.includes("BCA Toán 12") && page.text.includes("T3 · 20:00–21:30") && page.text.includes("data-chao-zalo") && page.text.includes("zalo.me/g/"));
  check("có form đặt mật khẩu", page.text.includes('action="/api/chao/dat-mat-khau"'));
  const fake = await api("GET", `/chao/${"x".repeat(43)}`);
  check("mã sai ⇒ 'Link đã hết hạn', KHÔNG có link Zalo học thử (D3)", fake.text.includes("Link đã hết hạn") && !fake.text.includes("zalo.me/g/") && !fake.text.includes("data-chao-zalo"));

  section("Gửi trùng: không tạo thêm, không gia hạn");
  const started = new Date(Date.now() - 3 * D);
  await prisma.enrollment.updateMany({ where: { userId: u!.id }, data: { trialStartedAt: started } });
  const r2 = await send(form({ mon: ["Toán", "Sử"], gmail: "an.bca@gmail.com" }));
  check("gửi lại ⇒ ok + next (cùng người)", r2.json?.ok === true && !!r2.json?.next, r2.json);
  const w2 = await prisma.intakeWelcome.findUnique({ where: { tokenHash: hashWelcomeToken(tokenOf(r2.json?.next ?? "")) } });
  check("mã mới vẫn của cùng tài khoản, còn hiện form (chưa đặt mật khẩu)", w2?.userId === u!.id && w2?.passwordSetAt === null);
  check("vẫn MỘT tài khoản", (await prisma.user.count({ where: { email: "an.bca@gmail.com" } })) === 1);
  es = await enrollsOf(u!.id);
  check("vẫn 2 ghi danh, trialDays 14, mốc bắt đầu giữ nguyên (không gia hạn)", es.length === 2 && es.every(e => e.trialDays === 14 && e.trialStartedAt?.getTime() === started.getTime()), es);

  section("Đặt mật khẩu qua trang chào");
  const tk = tokenOf(next1);
  const post = (fields: Record<string, string>) => fetch(`${BASE}/api/chao/dat-mat-khau`, { method: "POST", body: new URLSearchParams(fields), redirect: "manual" });
  const short = await post({ token: tk, password: "1234567", confirm: "1234567" });
  check("ngắn < 8 ⇒ 303 ?loi=ngan", short.status === 303 && (short.headers.get("location") ?? "").includes("loi=ngan"));
  const mism = await post({ token: tk, password: "matkhau123", confirm: "matkhau124" });
  check("không khớp ⇒ 303 ?loi=khop", mism.status === 303 && (mism.headers.get("location") ?? "").includes("loi=khop"));
  const oldHash = (await prisma.user.findUnique({ where: { id: u!.id } }))!.password;
  const ok = await post({ token: tk, password: "matkhau123", confirm: "matkhau123" });
  check("đặt xong ⇒ 303 /student/viec-cua-toi + cookie phiên", ok.status === 303 && (ok.headers.get("location") ?? "").endsWith("/student/viec-cua-toi") && (ok.headers.get("set-cookie") ?? "").includes("midnight_session="));
  check("mật khẩu đã đổi", (await prisma.user.findUnique({ where: { id: u!.id } }))!.password !== oldHash);
  const again = await post({ token: tokenOf(r2.json?.next ?? ""), password: "matkhau999", confirm: "matkhau999" });
  check("mã thứ hai không đặt lại được (đã có mật khẩu) ⇒ ?loi=da-dat", again.status === 303 && (again.headers.get("location") ?? "").includes("loi=da-dat"));
  const afterPage = await api("GET", `/chao/${tokenOf(r2.json?.next ?? "")}`);
  check("trang chào sau khi đặt ⇒ nút Đăng nhập, không còn form", afterPage.text.includes("data-chao-dang-nhap") && !afterPage.text.includes('action="/api/chao/dat-mat-khau"'));
  const r3 = await send(form({ gmail: "an.bca@gmail.com" }));
  const w3 = await prisma.intakeWelcome.findUnique({ where: { tokenHash: hashWelcomeToken(tokenOf(r3.json?.next ?? "")) } });
  check("gửi lại sau khi đã đặt mật khẩu ⇒ mã mới đánh dấu 'đã có mật khẩu'", !!w3?.passwordSetAt);

  section("Đã có tài khoản KiN (cùng Gmail) từ trước");
  const old = await mkUser({ name: "Trần Thị Bình", emailVerified: false });
  const before = (await prisma.user.findUnique({ where: { id: old.id } }))!.password;
  const r4 = await send(form({ gmail: old.email.toUpperCase(), hoTen: "Tên Khác Hẳn", mon: ["Toán"] }));
  check("ok + next", r4.json?.ok === true && !!r4.json?.next, r4.json);
  const oldAfter = await prisma.user.findUnique({ where: { id: old.id } });
  check("KHÔNG đổi mật khẩu, KHÔNG đổi tên", oldAfter!.password === before && oldAfter!.name === "Trần Thị Bình");
  check("ghi danh thêm lớp Toán (học thử)", (await enrollsOf(old.id)).some(e => e.courseId === "bca-toan" && e.trialDays === 14));
  const p4 = await api("GET", `/chao/${tokenOf(r4.json?.next ?? "")}`);
  check("trang chào ⇒ 'Đăng nhập', không form, chào 'Bình'", p4.text.includes("data-chao-dang-nhap") && !p4.text.includes('action="/api/chao/dat-mat-khau"') && p4.text.includes("Chào Bình"));
  const steal = await fetch(`${BASE}/api/chao/dat-mat-khau`, { method: "POST", body: new URLSearchParams({ token: tokenOf(r4.json?.next ?? ""), password: "chiemquyen1", confirm: "chiemquyen1" }), redirect: "manual" });
  check("POST thẳng vẫn không đổi được mật khẩu tài khoản có sẵn", steal.status === 303 && (await prisma.user.findUnique({ where: { id: old.id } }))!.password === before);

  section("D5 một hạn chung: môn mới dùng chung mốc đã bắt đầu");
  const c = await send(form({ gmail: "chung@gmail.com", mon: ["Toán"] }));
  const cu = await prisma.user.findUnique({ where: { email: "chung@gmail.com" } });
  const startC = new Date(Date.now() - 5 * D);
  await prisma.enrollment.updateMany({ where: { userId: cu!.id }, data: { trialStartedAt: startC } });
  await send(form({ gmail: "chung@gmail.com", mon: ["Sử"] }));
  const ce = await enrollsOf(cu!.id);
  check("Sử mới nhận trialStartedAt của Toán", c.json?.ok && ce.length === 2 && ce.every(e => e.trialStartedAt?.getTime() === startC.getTime()), ce);

  section("Phiếu chính thức (D8)");
  const off = await send(form({ loai: "chinhthuc", gmail: "chung@gmail.com", mon: ["Toán"] }));
  const offE = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: cu!.id, courseId: "bca-toan" } } });
  check("ghi danh thử hiện có ⇒ trialConvertRequestedAt, vẫn trialDays 14", off.json?.ok && !!offE?.trialConvertRequestedAt && offE.trialDays === 14, offE);
  const suE0 = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: cu!.id, courseId: "bca-su" } } });
  check("môn không có trong phiếu chính thức không đổi", suE0?.trialConvertRequestedAt === null);
  const o2 = await send(form({ loai: "chinhthuc", gmail: "moi.chinhthuc@gmail.com", mon: ["Sử"] }));
  const o2u = await prisma.user.findUnique({ where: { email: "moi.chinhthuc@gmail.com" } });
  const o2e = o2u ? await enrollsOf(o2u.id) : [];
  check("chính thức mới ⇒ ghi danh THỬ 14 ngày + chờ xác nhận", o2.json?.ok && o2e.length === 1 && o2e[0].trialDays === 14 && !!o2e[0].trialConvertRequestedAt, o2e);
  const offic = await mkUser({ name: "Lê Chính Thức" });
  await prisma.enrollment.create({ data: { userId: offic.id, courseId: "bca-toan", status: "active" } });
  await send(form({ loai: "chinhthuc", gmail: offic.email, mon: ["Toán"] }));
  await send(form({ loai: "hocthu", gmail: offic.email, mon: ["Toán"] }));
  const oe = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: offic.id, courseId: "bca-toan" } } });
  check("ghi danh chính thức (trialDays null) không bị đụng", oe?.trialDays === null && oe.trialConvertRequestedAt === null && oe.trialStartedAt === null, oe);

  section("Sĩ số đầy");
  await prisma.course.update({ where: { id: "bca-su" }, data: { capacity: await prisma.enrollment.count({ where: { courseId: "bca-su", status: "active" } }) } });
  const full = await send(form({ gmail: "day@gmail.com", mon: ["Toán", "Sử"] }));
  const fu = await prisma.user.findUnique({ where: { email: "day@gmail.com" } });
  const fe = fu ? await enrollsOf(fu.id) : [];
  check("lớp đầy bị bỏ qua, môn còn chỗ vẫn vào", full.json?.ok === true && fe.length === 1 && fe[0].courseId === "bca-toan", fe);

  section("Mã hết hạn");
  await prisma.intakeWelcome.updateMany({ where: { tokenHash: hashWelcomeToken(tokenOf(r4.json?.next ?? "")) }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const exp = await api("GET", `/chao/${tokenOf(r4.json?.next ?? "")}`);
  check("hết hạn ⇒ 'Link đã hết hạn' + Quên mật khẩu + Zalo anh Thanh, KHÔNG Zalo học thử", exp.text.includes("Link đã hết hạn") && exp.text.includes("/quen-mat-khau") && exp.text.includes("zalo.me/0384409051") && !exp.text.includes("zalo.me/g/"));

  section("Vai khác");
  const tut = await mkTutor("Cô Gia Sư");
  const rt = await send(form({ gmail: tut.email }));
  check("Gmail của gia sư ⇒ ok:false, không ghi danh", rt.json?.ok === false && (await prisma.enrollment.count({ where: { userId: tut.id } })) === 0, rt.json);

  await done();
})();
