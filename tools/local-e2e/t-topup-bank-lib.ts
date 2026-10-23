// PRO D8 — bài thuần: tài khoản nhận tiền nạp Coin đọc từ biến môi trường KIN_TOPUP_*, không còn số giả trong mã.
// Không cần máy chủ.
import { getTopupBank } from "@/lib/topupBank";
import { check, section, done } from "./h";

(async () => {
  const full = { KIN_TOPUP_BANK_NAME: "  Vietcombank ", KIN_TOPUP_ACCOUNT_NO: "9704 2200 11", KIN_TOPUP_ACCOUNT_NAME: " NGUYEN VAN A " };

  section("Đủ ba biến → trả tài khoản");
  const ok = getTopupBank(full);
  check("đủ ba biến → có tài khoản", ok !== null, ok);
  check("cắt khoảng trắng đầu/cuối tên ngân hàng và tên chủ tài khoản", ok?.bankName === "Vietcombank" && ok?.accountName === "NGUYEN VAN A", ok);
  check("bỏ mọi khoảng trắng trong số tài khoản", ok?.accountNo === "9704220011", ok);

  section("Thiếu hoặc sai dạng → null (không bịa số)");
  check("không có biến nào → null", getTopupBank({}) === null);
  for (const k of Object.keys(full)) {
    check(`thiếu ${k} → null`, getTopupBank({ ...full, [k]: undefined }) === null);
    check(`${k} chỉ có khoảng trắng → null`, getTopupBank({ ...full, [k]: "   " }) === null);
  }
  check("số tài khoản có chữ → null", getTopupBank({ ...full, KIN_TOPUP_ACCOUNT_NO: "97042200AB" }) === null);
  check("số tài khoản có dấu gạch → null", getTopupBank({ ...full, KIN_TOPUP_ACCOUNT_NO: "9704-2200-11" }) === null);
  check("số tài khoản 5 chữ số (quá ngắn) → null", getTopupBank({ ...full, KIN_TOPUP_ACCOUNT_NO: "12345" }) === null);
  check("số tài khoản 6 chữ số → hợp lệ", getTopupBank({ ...full, KIN_TOPUP_ACCOUNT_NO: "123456" })?.accountNo === "123456");
  check("số tài khoản 20 chữ số → hợp lệ", getTopupBank({ ...full, KIN_TOPUP_ACCOUNT_NO: "1".repeat(20) })?.accountNo === "1".repeat(20));
  check("số tài khoản 21 chữ số (quá dài) → null", getTopupBank({ ...full, KIN_TOPUP_ACCOUNT_NO: "1".repeat(21) }) === null);
  check("biến khác tên (KIN_BANK_NAME) không được đọc", getTopupBank({ KIN_BANK_NAME: "X", KIN_TOPUP_ACCOUNT_NO: "123456", KIN_TOPUP_ACCOUNT_NAME: "A" }) === null);

  section("Mặc định đọc process.env");
  const keys = Object.keys(full) as (keyof typeof full)[];
  const old = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  check("không truyền env, chưa đặt biến → null", getTopupBank() === null);
  for (const k of keys) process.env[k] = full[k];
  check("không truyền env, process.env đủ ba biến → có tài khoản", getTopupBank()?.accountNo === "9704220011");
  for (const k of keys) { if (old[k] === undefined) delete process.env[k]; else process.env[k] = old[k]; }

  section("Quét tĩnh: không còn số tài khoản giả trong mã");
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join, relative } = await import("node:path");
  const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? (f === "generated" ? [] : walk(p)) : /\.(ts|tsx)$/.test(f) ? [p] : []; });
  const repo = join(__dirname, "..", "..");
  const files = walk(join(repo, "src")).map(f => ({ rel: relative(repo, f), txt: readFileSync(f, "utf8") }));
  const hits = (re: RegExp) => files.filter(f => re.test(f.txt)).map(f => f.rel).sort();
  check("không còn chuỗi \"CONG TY KIN EDUCATION\"", hits(/CONG TY KIN EDUCATION/).length === 0, hits(/CONG TY KIN EDUCATION/));
  check("không còn số 0123456789 trong src", hits(/0123456789/).length === 0, hits(/0123456789/));
  check("không còn biểu tượng BANK_INFO", hits(/\bBANK_INFO\b/).length === 0, hits(/\bBANK_INFO\b/));
  const readers = hits(/KIN_TOPUP_/);
  check("chỉ MỘT chỗ đọc biến KIN_TOPUP_*: src/lib/topupBank.ts", readers.length === 1 && readers[0] === "src/lib/topupBank.ts", readers);
  const route = files.find(f => f.rel === "src/app/api/wallet/topups/route.ts")!.txt;
  check("route nạp Coin lấy tài khoản từ getTopupBank()", /getTopupBank\(\)/.test(route));
  const page = files.find(f => f.rel === "src/app/(student)/student/vi/page.tsx")!.txt;
  check("trang ví báo \"chưa công bố tài khoản nhận\" khi bank là null và khoá nút gửi", /chưa công bố tài khoản nhận/.test(page) && /disabled=\{submitting \|\| \(!loading && !bank\)\}/.test(page));

  await done();
})();
