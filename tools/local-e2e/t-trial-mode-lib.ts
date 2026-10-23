// NC2-023 — bài thuần: cách đọc cờ KIN_TRIAL_MODE. Không cần máy chủ.
import { isTrialMode, TRIAL_MODE_MESSAGE, TRIAL_MODE_TOPUP_MESSAGE } from "@/lib/trialMode";
import { check, section, done } from "./h";

(async () => {
  section("Chỉ đúng \"1\" mới bật");
  check("\"1\" → bật", isTrialMode({ KIN_TRIAL_MODE: "1" }) === true);
  for (const v of ["", "0", "true", "TRUE", "yes", " 1", "1 ", "on", "2", "false", undefined])
    check(`${JSON.stringify(v)} → tắt`, isTrialMode({ KIN_TRIAL_MODE: v }) === false);
  check("biến thiếu hẳn → tắt", isTrialMode({}) === false);
  check("biến khác tên (KIN_TRIAL) không bật", isTrialMode({ KIN_TRIAL: "1" }) === false);

  section("Mặc định đọc process.env");
  const old = process.env.KIN_TRIAL_MODE;
  delete process.env.KIN_TRIAL_MODE;
  check("không truyền env, biến chưa đặt → tắt", isTrialMode() === false);
  process.env.KIN_TRIAL_MODE = "1";
  check("không truyền env, process.env=1 → bật", isTrialMode() === true);
  if (old === undefined) delete process.env.KIN_TRIAL_MODE; else process.env.KIN_TRIAL_MODE = old;

  section("Chữ");
  check("thông điệp tiếng Việt đúng, không bịa số", TRIAL_MODE_MESSAGE === "KiN đang miễn phí trong giai đoạn chạy thử, chưa cần mua gói." && !/\d/.test(TRIAL_MODE_MESSAGE));
  check("thông điệp chặn nạp Coin tiếng Việt, không bịa số", TRIAL_MODE_TOPUP_MESSAGE === "KiN đang miễn phí trong giai đoạn chạy thử, chưa cần nạp Coin." && !/\d/.test(TRIAL_MODE_TOPUP_MESSAGE));
  section("Quét tĩnh: mọi điểm vào mua/nạp trong mã đều đã được kiểm");
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join, relative } = await import("node:path");
  const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? (f === "generated" ? [] : walk(p)) : /\.(ts|tsx)$/.test(f) ? [p] : []; });
  const root = join(__dirname, "..", "..", "src");
  const files = walk(root).map(f => ({ rel: relative(join(__dirname, "..", ".."), f), txt: readFileSync(f, "utf8") }));
  const hits = (re: RegExp, pre: string) => files.filter(f => f.rel.startsWith(pre) && re.test(f.txt)).map(f => f.rel).sort();
  // Giao diện (ngoài src/app/api, ngoài khu admin) gọi mua gói / nạp Coin hoặc trỏ tới trang ví
  const uiPurchase = hits(/api\/subscriptions|\/purchase\b/, "src").filter(f => !f.startsWith("src/app/api/") && !f.startsWith("src/lib/"));
  check("không giao diện nào gọi API mua gói (hiện chỉ có API)", uiPurchase.length === 0, uiPurchase);
  const uiTopup = hits(/wallet\/topups/, "src").filter(f => !f.startsWith("src/app/api/") && !f.startsWith("src/app/(admin)/"));
  check("chỉ MỘT trang gọi API nạp Coin: /student/vi", uiTopup.length === 1 && uiTopup[0] === "src/app/(student)/student/vi/page.tsx", uiTopup);
  const walletLinks = hits(/["'`]\/student\/vi["'`?#]/, "src").filter(f => f.endsWith(".tsx"));
  check("liên kết tới /student/vi chỉ nằm ở vỏ học sinh (gia sư không có mục menu nào dẫn tới)", walletLinks.length === 1 && walletLinks[0] === "src/components/student/StudentShell.tsx", walletLinks);
  const vi = files.find(f => f.rel === "src/app/(student)/student/vi/page.tsx")!.txt;
  check("trang /student/vi dùng cờ (hàm hideTopup: học sinh luôn ẩn, gia sư theo cờ) và bọc form nạp bằng !hideTopup", /hideTopup\s*=\s*!isTutor\s*\|\|\s*trial\s*!==\s*false/.test(vi) && /\{!hideTopup && <form/.test(vi));
  const purchase = files.find(f => f.rel === "src/app/api/subscriptions/[code]/purchase/route.ts")!.txt;
  const iGate = purchase.indexOf("isTrialMode()"), iDb = purchase.indexOf("await prisma.$transaction");
  check("API mua gói chặn bằng isTrialMode() TRƯỚC prisma.$transaction", iGate > 0 && iDb > iGate && /status:\s*403/.test(purchase.slice(iGate, iDb)));
  const topups = files.find(f => f.rel === "src/app/api/wallet/topups/route.ts")!.txt;
  const iPost = topups.indexOf("export async function POST");
  const iTrial = topups.indexOf("isTrialMode()", iPost), iBody = topups.indexOf("await req.json()", iPost), iCreate = topups.indexOf("topups().create", iPost);
  check("API nạp Coin (POST) chặn bằng isTrialMode() TRƯỚC khi đọc thân yêu cầu và TRƯỚC khi ghi DB, trả 403", iPost >= 0 && iTrial > iPost && iBody > iTrial && iCreate > iTrial && /status:\s*403/.test(topups.slice(iTrial, iBody)));
  check("cờ chỉ chặn POST: GET xem lịch sử yêu cầu nạp không gọi isTrialMode()", topups.split("isTrialMode()").length - 1 === 1);
  const readers = files.filter(f => /KIN_TRIAL_MODE/.test(f.txt)).map(f => f.rel).sort();
  check("chỉ MỘT chỗ đọc biến KIN_TRIAL_MODE: src/lib/trialMode.ts", readers.length === 1 && readers[0] === "src/lib/trialMode.ts", readers);

  await done();
})();
