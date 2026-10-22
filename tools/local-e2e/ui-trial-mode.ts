// NC2-023 — trình duyệt: cờ KIN_TRIAL_MODE. Chạy HAI lần, máy chủ khởi động khác nhau:
//   EXPECT_TRIAL=0 bash .nc2023-run.sh npx tsx tools/local-e2e/ui-trial-mode.ts   (máy chủ không đặt cờ)
//   EXPECT_TRIAL=1 bash .nc2023-run.sh npx tsx tools/local-e2e/ui-trial-mode.ts   (máy chủ chạy với KIN_TRIAL_MODE=1)
import { BASE, mkTutor, mkUser, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, type Page } from "./ui";

const BUY_TEXT = /Mua VIP|Mua gói|Nâng cấp VIP|Nạp Coin|Yêu cầu nạp|Gửi yêu cầu nạp/i;

// Mọi lối dẫn tới màn mua / nạp: liên kết tới /student/vi, /purchase, hoặc chữ mua / nạp trên trang.
async function buyEntries(p: Page) {
  return p.evaluate((src) => {
    const re = new RegExp(src, "i");
    const links = [...document.querySelectorAll("a[href]")].map(a => a.getAttribute("href") || "").filter(h => /\/student\/vi(\/|\?|#|$)|\/purchase|\/nap-coin|\/goi-vip/.test(h));
    const text = [...document.querySelectorAll("button, a, h1, h2, h3, label")].map(e => (e.textContent || "").trim()).filter(t => re.test(t));
    return { links, text };
  }, BUY_TEXT.source);
}

(async () => {
  const expect = process.env.EXPECT_TRIAL;
  if (expect !== "0" && expect !== "1") throw new Error("Đặt EXPECT_TRIAL=0 hoặc 1 (cờ mà máy chủ đang chạy).");
  const on = expect === "1";
  await wipe();
  const T = await mkTutor("Cô Lan"), S = await mkUser({ name: "Học sinh" });
  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); }); };

  section(`Gia sư mở trang ví (${on ? "cờ BẬT" : "cờ TẮT"}) ở 390px`);
  const tctx = await ctxFor(T, { width: 390, height: 844 });
  const tp = await tctx.newPage(); watch(tp);
  await tp.goto(`${BASE}/student/vi`, { waitUntil: "networkidle", timeout: 150000 });
  await tp.getByRole("heading", { name: "Ví Coin" }).waitFor({ timeout: 90000 });
  if (on) {
    await tp.getByText("KiN miễn phí trong giai đoạn chạy thử").waitFor({ timeout: 30000 });
    check("banner hiện, có chữ giải thích", await tp.getByText("Bạn chưa cần mua gói hay nạp Coin").isVisible());
    check("KHÔNG còn form nạp (tiêu đề, ô số tiền, nút gửi)", (await tp.getByText("Yêu cầu nạp Coin").count()) === 0 && (await tp.getByPlaceholder("VD: 300000").count()) === 0 && (await tp.getByRole("button", { name: /Gửi yêu cầu nạp/ }).count()) === 0);
    check("dòng mô tả không mời nạp Coin để mua VIP", (await tp.getByText(/Nạp Coin để mua gói VIP/).count()) === 0);
    const e = await buyEntries(tp);
    check("không còn lối mua/nạp nào trên trang (liên kết + chữ)", e.links.length === 0 && e.text.length === 0, e);
    check("vẫn thấy số dư và lịch sử Coin (không đụng ví)", await tp.getByText("Số dư hiện tại").isVisible() && await tp.getByText("Giao dịch Coin gần đây").isVisible());
  } else {
    await tp.getByRole("button", { name: /Gửi yêu cầu nạp/ }).waitFor({ timeout: 30000 });
    check("cờ TẮT: form nạp Coin hiện như cũ, không banner", await tp.getByPlaceholder("VD: 300000").isVisible() && (await tp.getByText("KiN miễn phí trong giai đoạn chạy thử").count()) === 0);
    check("dòng mô tả cũ vẫn còn", await tp.getByText(/Nạp Coin để mua gói VIP/).isVisible());
  }
  check("không tràn ngang ở 390px", await tp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await shot(tp, on ? "trial-tutor-wallet-on" : "trial-tutor-wallet-off");

  section("Các màn của gia sư: không có lối mua nào (cả hai chế độ)");
  for (const path of ["/lop-cua-toi", "/lop-cua-toi/tong-quan", "/lop-cua-toi/cai-dat", "/lop-cua-toi/doanh-thu", "/lop-cua-toi/ho-so", "/lop-cua-toi/bai-dang"]) {
    await tp.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 150000 });
    const khac = tp.getByRole("button", { name: "Khác" });
    if (await khac.count()) await khac.first().click().catch(() => {});
    const e = await buyEntries(tp);
    check(`${path}: không lối Mua VIP / Nạp Coin`, e.links.length === 0 && e.text.length === 0, e);
  }

  section("Học sinh: ví và nạp Coin KHÔNG đổi (cả hai chế độ)");
  const sctx = await ctxFor(S, { width: 390, height: 844 });
  const sp = await sctx.newPage(); watch(sp);
  await sp.goto(`${BASE}/student/vi`, { waitUntil: "networkidle", timeout: 150000 });
  await sp.getByRole("heading", { name: "Ví Coin" }).waitFor({ timeout: 90000 });
  check("học sinh KHÔNG còn thấy form nạp Coin (Coin học sinh chỉ nhận từ làm bài)", !(await sp.getByRole("button", { name: /Gửi yêu cầu nạp/ }).isVisible()) && !(await sp.getByPlaceholder("VD: 300000").isVisible()));
  check("học sinh KHÔNG thấy banner chạy thử", (await sp.getByText("KiN miễn phí trong giai đoạn chạy thử").count()) === 0);
  check("dòng mô tả của học sinh nói Coin nhận từ làm bài, không mua được", await sp.getByText(/Coin không mua được bằng tiền/).isVisible());
  await shot(sp, on ? "trial-student-wallet-on" : "trial-student-wallet-off");

  await closeAll();
  check("không lỗi trang", errors.length === 0, errors.slice(0, 4));
  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
