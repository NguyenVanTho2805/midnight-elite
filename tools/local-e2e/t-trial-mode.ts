// NC2-023 — API + DB: cờ KIN_TRIAL_MODE.
// Chạy HAI lần, mỗi lần với máy chủ khởi động khác nhau (cờ là biến môi trường của máy chủ):
//   EXPECT_TRIAL=0 bash .nc2023-run.sh npx tsx tools/local-e2e/t-trial-mode.ts     (máy chủ KHÔNG đặt KIN_TRIAL_MODE)
//   EXPECT_TRIAL=1 bash .nc2023-run.sh npx tsx tools/local-e2e/t-trial-mode.ts     (máy chủ chạy với KIN_TRIAL_MODE=1)
import { api, mkTutor, mkUser, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

const DAY = 24 * 60 * 60 * 1000;

(async () => {
  const expect = process.env.EXPECT_TRIAL;
  if (expect !== "0" && expect !== "1") throw new Error("Đặt EXPECT_TRIAL=0 hoặc 1 (cờ mà máy chủ đang chạy).");
  const on = expect === "1";
  await wipe();
  const T = await mkTutor("Cô Chưa Gói"), TV = await mkTutor("Cô Có Gói");
  const S = await mkUser({ name: "Học sinh" });
  for (const u of [T, TV, S]) await prisma.wallet.upsert({ where: { userId: u.id }, update: { balance: 1_000_000 }, create: { userId: u.id, balance: 1_000_000 } });
  const now = Date.now();
  const vipSub = await prisma.tutorSubscription.create({
    data: { userId: TV.id, planCode: "monthly", priceCoinPaid: 300_000, durationDays: 30, startDate: new Date(now - 5 * DAY), endDate: new Date(now + 25 * DAY), status: "active" },
  });
  const bal = async (id: string) => (await prisma.wallet.findUnique({ where: { userId: id } }))?.balance;
  const txCount = () => prisma.coinTransaction.count();
  const subCount = (id: string) => prisma.tutorSubscription.count({ where: { userId: id } });

  section(`Máy chủ đúng chế độ (${on ? "BẬT" : "TẮT"})`);
  const mine = await api("GET", "/api/users/me/subscription", { as: T });
  check("GET /api/users/me/subscription có trial đúng với chế độ máy chủ", mine.status === 200 && mine.json.trial === on, mine.json);
  const plans = await api("GET", "/api/subscriptions");
  check("GET /api/subscriptions: trial đúng chế độ", plans.status === 200 && plans.json.trial === on, plans.json);
  check("bảng giá KHÔNG đổi (300k / 1,5tr / 2,5tr Coin)", JSON.stringify(plans.json.plans.map((p: any) => [p.code, p.priceCoin, p.durationDays])) === JSON.stringify([["monthly", 300000, 30], ["half_year", 1500000, 180], ["yearly", 2500000, 365]]), plans.json.plans);

  section("Mua VIP");
  const txBefore = await txCount();
  const buy = await api("POST", "/api/subscriptions/monthly/purchase", { as: T });
  if (on) {
    check("cờ BẬT: mua → 403 kèm thông điệp tiếng Việt", buy.status === 403 && buy.json.error === "KiN đang miễn phí trong giai đoạn chạy thử, chưa cần mua gói.", buy.json);
    check("không tạo bản ghi gói", (await subCount(T.id)) === 0);
    check("không trừ Coin, không có giao dịch Coin mới", (await bal(T.id)) === 1_000_000 && (await txCount()) === txBefore);
    const buy2 = await api("POST", "/api/subscriptions/yearly/purchase", { as: T });
    check("gói khác cũng 403, vẫn không gì thay đổi", buy2.status === 403 && (await subCount(T.id)) === 0 && (await bal(T.id)) === 1_000_000);
    const bad = await api("POST", "/api/subscriptions/khong-co/purchase", { as: T });
    check("mã gói lạ cũng 403 (cờ chặn trước), không ghi gì", bad.status === 403 && (await subCount(T.id)) === 0);
  } else {
    check("cờ TẮT: mua → 201 như cũ", buy.status === 201 && buy.json.subscription?.planCode === "monthly", buy.json);
    check("có 1 bản ghi gói, trừ đúng 300.000 Coin, 1 giao dịch Coin mới", (await subCount(T.id)) === 1 && (await bal(T.id)) === 700_000 && (await txCount()) === txBefore + 1);
    const bad = await api("POST", "/api/subscriptions/khong-co/purchase", { as: T });
    check("mã gói lạ → 404 như cũ", bad.status === 404);
  }
  check("chưa đăng nhập → 401 (cả hai chế độ)", (await api("POST", "/api/subscriptions/monthly/purchase")).status === 401);
  const stu = await api("POST", "/api/subscriptions/monthly/purchase", { as: S });
  check("học sinh mua → 403 (cả hai chế độ), ví học sinh không đổi", stu.status === 403 && (await bal(S.id)) === 1_000_000);

  section("Gia sư đã có gói không bị ảnh hưởng");
  const tv = await api("GET", "/api/users/me/subscription", { as: TV });
  check("vẫn thấy gói đang hiệu lực, trial đúng chế độ", tv.status === 200 && tv.json.subscription?.id === vipSub.id && tv.json.trial === on, tv.json);
  check("bản ghi gói và ví của gia sư có gói giữ nguyên", (await bal(TV.id)) === 1_000_000 && (await prisma.tutorSubscription.findUnique({ where: { id: vipSub.id } }))?.status === "active");

  section("Phía học sinh / ví không đổi");
  const w = await api("GET", "/api/wallet", { as: S });
  check("học sinh xem ví → 200, đúng số dư", w.status === 200 && w.json.balance === 1_000_000, w.json);
  const tp = await api("POST", "/api/wallet/topups", { as: S, body: { amountVnd: 100000, bankRef: "FTNC2023" } });
  check("học sinh gửi yêu cầu nạp → 201 (cả hai chế độ)", tp.status === 201, tp.json);
  check("học sinh xem danh sách yêu cầu nạp → 200", (await api("GET", "/api/wallet/topups", { as: S })).status === 200);
  await done();
})();
