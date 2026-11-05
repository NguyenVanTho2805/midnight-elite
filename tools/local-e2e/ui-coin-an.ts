// 05/11/2026 (CHỦ-02) — Coin ẨN hẳn khỏi giao diện (cờ COIN_VISIBLE = false ở src/lib/features.ts). Trình duyệt thật, 390 và 1280.
// Quét chữ NGƯỜI DÙNG THẤY (innerText + aria-label/title/placeholder) ở các route chính của khách, học sinh, gia sư, quản trị:
// không còn "Coin", "xu" (từ riêng, trừ "xu hướng"), biểu tượng đồng xu. Dữ liệu cũ có sẵn (ví 200 Coin, yêu cầu nạp đang chờ) để chứng minh là ẨN chứ không phải "trống".
// Kèm: API ghi Coin KHÔNG bị xoá (GET /api/wallet vẫn 200), bảng/dữ liệu còn nguyên, /student/vi và /admin/topups không còn lối vào.
// Ca phá cố ý: đổi COIN_VISIBLE thành true → bài đỏ ở nhiều route.
// Phần thuần hideCoinText (đầu bài): quay lại regex cũ `\s*[+\-]?\d+\s*(xu|Coin)\b` + `xu` đứng riêng → ca "1.000 xu", "Xu thế", "5 🪙" đỏ.
import { api, mkSuper, mkTutor, mkUser, mkCourse, wipe, check, section, done } from "./h";
import { launch, ctxFor, closeAll, ADMIN } from "./ui";
import { BASE } from "./h";
import { prisma } from "@/lib/prisma";
import { hideCoinText } from "@/lib/features";

const BAD = /coin|(^|[^\p{L}])xu(?![\p{L}])(?!\s+hướng)|🪙/iu;
const GRAB = `(() => {
  const t = document.body.innerText;
  const a = [...document.querySelectorAll('[aria-label],[title],[placeholder]')].map(e => [e.getAttribute('aria-label'), e.getAttribute('title'), e.getAttribute('placeholder')].filter(Boolean).join(' | ')).join('\\n');
  return t + '\\n' + a;
})()`;

(async () => {
  section("hideCoinText (thuần): chỉ bỏ 'số + xu/Coin/🪙', không cắt nhầm");
  const H = hideCoinText;
  check("'nhận 1.000 xu' → bỏ cả số có dấu chấm hàng nghìn (không sót '1.')", H("Bạn nhận 1.000 xu") === "Bạn nhận", H("Bạn nhận 1.000 xu"));
  check("câu kết thúc bằng dấu chấm giữ dấu chấm, không dư khoảng trắng", H("Bạn nhận 1.000 xu.") === "Bạn nhận.", H("Bạn nhận 1.000 xu."));
  check("số thập phân 12.500,5 xu", H("Số dư 12.500,5 xu") === "Số dư", H("Số dư 12.500,5 xu"));
  check("'+20 xu' đứng giữa câu", H("Bạn được +20 xu vì trả lời hay") === "Bạn được vì trả lời hay", H("Bạn được +20 xu vì trả lời hay"));
  check("'Xu thế học tập mới' giữ nguyên", H("Xu thế học tập mới") === "Xu thế học tập mới", H("Xu thế học tập mới"));
  check("'xu hướng', 'xuống' giữ nguyên (kể cả sau số)", H("Xu hướng điểm 5 xuống 3") === "Xu hướng điểm 5 xuống 3", H("Xu hướng điểm 5 xuống 3"));
  check("'xu' không đi kèm số giữ nguyên (không phải đơn vị tiền)", H("Hết xu rồi") === "Hết xu rồi");
  check("'Thưởng 5 🪙' → 'Thưởng' (không sót '5')", H("Thưởng 5 🪙") === "Thưởng", H("Thưởng 5 🪙"));
  check("'🪙 5' và 🪙 trơ trọi", H("Nhận 🪙 5 hôm nay") === "Nhận hôm nay" && H("Chúc mừng 🪙") === "Chúc mừng", [H("Nhận 🪙 5 hôm nay"), H("Chúc mừng 🪙")]);
  check("'Coin' đứng riêng → 'điểm thưởng'; 'Bitcoin' giữ nguyên", H("Nạp Coin thành công") === "Nạp điểm thưởng thành công" && H("Bitcoin tăng") === "Bitcoin tăng", [H("Nạp Coin thành công"), H("Bitcoin tăng")]);
  check("'20 Coin' là số + đơn vị → bỏ cả số", H("Nhận 20 Coin") === "Nhận", H("Nhận 20 Coin"));
  check("'bạn bị trừ 20 xu' → câu thay thế", H("Câu bị gỡ, bạn bị trừ 20 xu") === "Câu bị gỡ, phần thưởng của câu trả lời này bị trừ lại", H("Câu bị gỡ, bạn bị trừ 20 xu"));
  check("'bạn bị trừ 1.000 xu' (dấu chấm hàng nghìn)", !/\d/.test(H("Câu bị gỡ, bạn bị trừ 1.000 xu")), H("Câu bị gỡ, bạn bị trừ 1.000 xu"));
  check("chuỗi không có gì để ẩn giữ nguyên từng chữ; chạy hai lần ra cùng kết quả", H("Lớp Toán 9 thứ 5 lúc 19:00") === "Lớp Toán 9 thứ 5 lúc 19:00" && H(H("Bạn nhận 1.000 xu.")) === H("Bạn nhận 1.000 xu."));

  await wipe();
  const S = await mkUser({ name: "Trần Thị Bích" });
  const T = await mkTutor("Cô Lan");
  const A = await mkSuper("Quản trị");
  const course = await mkCourse(T.id, { name: "Toán 9 Cô Lan" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: course.id, status: "active" } });
  await prisma.wallet.upsert({ where: { userId: S.id }, update: { balance: 200 }, create: { userId: S.id, balance: 200 } });
  await prisma.wallet.upsert({ where: { userId: T.id }, update: { balance: 5000 }, create: { userId: T.id, balance: 5000 } });
  await prisma.coinTransaction.create({ data: { userId: S.id, amount: 200, reason: "signup_bonus" } });
  await prisma.coinTopupRequest.create({ data: { userId: T.id, amountVnd: 100000, coinAmount: 100000, status: "pending", bankRef: "FT123" } });

  // Thông báo CŨ đã lưu có chữ xu/Coin/🪙 (do bản trước tạo): bảng thông báo vẫn không được hiện chúng.
  await prisma.notification.createMany({ data: [
    { userId: S.id, type: "answer_accepted", title: "Câu trả lời được chọn +20 xu", message: "Bạn nhận +20 xu 🪙 vì câu trả lời được chấp nhận" },
    { userId: S.id, type: "answer_penalized", title: "Câu trả lời bị xác nhận vi phạm", message: "Câu trả lời của bạn bị xác nhận vi phạm, bạn bị trừ 20 xu" },
    { userId: S.id, type: "reward", title: "Quà đăng ký", message: "Bạn có 200 Coin" },
  ] });

  section("Dữ liệu và API Coin còn nguyên (chỉ ẩn lối vào)");
  const w = await api("GET", "/api/wallet", { as: S });
  check("GET /api/wallet vẫn 200 và còn số dư 200", w.status === 200 && JSON.stringify(w.json).includes("200"), { s: w.status });
  check("bảng ví / giao dịch / yêu cầu nạp còn dữ liệu cũ", (await prisma.wallet.count()) === 2 && (await prisma.coinTransaction.count()) === 1 && (await prisma.coinTopupRequest.count()) === 1);
  const qa = await api("GET", "/api/admin/kiem-duyet?limit=20", { as: A });
  check("API Hàng chờ không còn liệt kê/đếm 'nap-coin'", qa.status === 200 && !JSON.stringify(qa.json).includes("nap-coin") && !(qa.json?.items ?? []).some((i: { kind: string }) => i.kind === "nap-coin"), qa.json?.counts);

  section("Đặt câu hỏi không trừ xu khi Coin ẩn (chủ quyết 05/11/2026); bật cờ lại thì vẫn trừ");
  const { QUESTION_COST } = await import("@/lib/wallet");
  const before = (await prisma.wallet.findUnique({ where: { userId: S.id } }))?.balance ?? 0;
  const qp = await api("POST", "/api/questions", { as: S, body: { title: "Giải phương trình bậc hai", content: "Em chưa hiểu delta." } });
  const after = (await prisma.wallet.findUnique({ where: { userId: S.id } }))?.balance ?? 0;
  const qrow = await prisma.question.findFirst({ where: { authorId: S.id }, orderBy: { createdAt: "desc" } });
  check("POST /api/questions → 201, ví không đổi, bountyPaid 0", qp.status === 201 && after === before && qrow?.bountyPaid === 0, { s: qp.status, before, after, b: qrow?.bountyPaid });
  const zero = await mkUser({ name: "Ví rỗng" });
  const qz = await api("POST", "/api/questions", { as: zero, body: { title: "Hỏi khi ví rỗng", content: "Vẫn hỏi được." } });
  check("ví 0 vẫn đặt được câu hỏi (không 402)", qz.status === 201, qz.status);
  const src = (await import("node:fs")).readFileSync("src/app/api/questions/route.ts", "utf8");
  check("mã: khi cờ bật lại thì vẫn trừ QUESTION_COST (COIN_VISIBLE ? QUESTION_COST : 0) và ghi bountyPaid", /COIN_VISIBLE \? QUESTION_COST : 0/.test(src) && /bountyPaid:\s*charge/.test(src) && QUESTION_COST > 0);

  await launch();
  const sizes = [[390, 844], [1280, 900]] as const;
  const guestRoutes = ["/", "/cong-dong", "/tin-tuc", "/khoa-hoc", "/giang-vien", "/thi-thu", "/diem-chuan", "/dang-ky", "/dang-nhap", "/chinh-sach"];
  const studentRoutes = ["/student/viec-cua-toi", "/student/lich-hoc", "/student/hoc-tap", "/student/bai-tap", "/student/ho-so", "/student/hoc-phi", "/student/nhap-ma-lop", "/student/tin-tuc", "/cong-dong", "/student/vi"];
  const tutorRoutes = ["/lop-cua-toi", "/lop-cua-toi/goi", "/lop-cua-toi/ho-tro", "/lop-cua-toi/hoc-phi", "/lop-cua-toi/ho-so"];
  const adminRoutes = ["/admin", "/admin/kiem-duyet", "/admin/kiem-duyet?loai=nap-coin", "/admin/doanh-thu", "/admin/goi-pro", "/admin/trien-khai", "/admin/nhat-ky", "/admin/hoc-sinh", "/admin/topups", "/admin/quan-tri-vien"];
  const jobs: [string, typeof S | null, string[], string][] = [
    ["khách", null, guestRoutes, BASE], ["học sinh", S, studentRoutes, BASE], ["gia sư", T, tutorRoutes, BASE], ["quản trị", A, adminRoutes, ADMIN],
  ];
  const leaks: string[] = [];
  let scanned = 0;
  for (const [vw, vh] of sizes) {
    section(`Quét chữ Coin/xu ở ${vw}px`);
    for (const [who, user, routes, origin] of jobs) {
      const ctx = await ctxFor(user, { width: vw, height: vh, rail: "mac-dinh" });
      const page = await ctx.newPage();
      for (const r of routes) {
        try {
          await page.goto(origin + r, { waitUntil: "domcontentloaded", timeout: 60000 });
          await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
          await page.waitForTimeout(500);
          const txt: string = await page.evaluate(GRAB);
          scanned++;
          if (who === "học sinh" && r === "/student/viec-cua-toi") {
            await page.locator('button[aria-label^="Thông báo"]').first().click().catch(() => {});
            await page.waitForTimeout(700);
            const nt: string = await page.evaluate(GRAB);
            check(`${vw}: bảng thông báo mở ra và có hàng thông báo cũ`, /Câu trả lời được chọn/.test(nt), nt.slice(0, 120));
            const nm = nt.split("\n").filter(l => BAD.test(l)).slice(0, 3);
            if (nm.length) leaks.push(`${vw} học sinh bảng thông báo: ${nm.join(" // ").slice(0, 160)}`);
          }
          const m = txt.split("\n").filter(l => BAD.test(l)).slice(0, 3);
          if (m.length) leaks.push(`${vw} ${who} ${r}: ${m.join(" // ").slice(0, 160)}`);
        } catch (e) { leaks.push(`${vw} ${who} ${r}: không mở được (${String(e).slice(0, 80)})`); }
      }
      await ctx.close();
    }
  }
  check(`không còn chữ Coin/xu ở ${scanned} lượt mở route (4 vai × 2 cỡ màn hình)`, leaks.length === 0, leaks);

  section("Không còn lối vào");
  const ctx = await ctxFor(S, { width: 1280, height: 900, rail: "mac-dinh" });
  const pg = await ctx.newPage();
  await pg.goto(BASE + "/student/vi", { waitUntil: "domcontentloaded", timeout: 60000 });
  await pg.waitForTimeout(800);
  check("/student/vi chuyển về Việc của tôi", new URL(pg.url()).pathname === "/student/viec-cua-toi", pg.url());
  check("không có ô số dư (🪙) ở thanh trên học sinh", (await pg.locator("text=🪙").count()) === 0);
  await ctx.close();
  const actx = await ctxFor(A, { width: 1280, height: 900, rail: "mac-dinh" });
  const ap = await actx.newPage();
  await ap.goto(ADMIN + "/admin/topups", { waitUntil: "domcontentloaded", timeout: 60000 });
  await ap.waitForTimeout(800);
  check("/admin/topups chuyển về /admin", new URL(ap.url()).pathname === "/admin", ap.url());
  await actx.close();
  await closeAll();
  done();
})().catch(e => { console.error(e); process.exit(1); });
