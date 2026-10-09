// TK-173 — VietQR URL builder. Dùng dịch vụ img.vietqr.io free, không
// cần SDK/API key. Chi tiết: https://vietqr.io/en/content/vqrdynamic/
//
// Format: /image/<bankBin>-<accountNo>-<template>.png?amount=X&addInfo=Y&accountName=Z
//
// Trong giai đoạn này KiN dùng 1 tài khoản chung của trung tâm (giống
// FE-128 BANK_INFO). Khi có tài khoản riêng per-gia sư, thêm field vào
// user profile + đọc theo courseId.

export const KIN_BANK = {
  bankBin:     "970436", // Vietcombank
  accountNo:   "0123456789",
  accountName: "CONG TY KIN EDUCATION",
};

export function buildVietQRUrl(opts: {
  amount:     number;
  addInfo:    string;
  template?:  "compact" | "compact2" | "qr_only" | "print";
}): string {
  const t = opts.template ?? "compact2";
  const url = new URL(`https://img.vietqr.io/image/${KIN_BANK.bankBin}-${KIN_BANK.accountNo}-${t}.png`);
  url.searchParams.set("amount", String(Math.max(0, Math.floor(opts.amount))));
  url.searchParams.set("addInfo", opts.addInfo.slice(0, 50));
  url.searchParams.set("accountName", KIN_BANK.accountName);
  return url.toString();
}

// Nội dung chuyển khoản ngắn — admin đối chiếu bằng chuỗi này. Format
// cùng pattern với FE-128 (KIN + prefix userId) + yearMonth cho dễ phân.
export function tuitionBankMemo(userId: string, yearMonth: string): string {
  return `KIN HP ${yearMonth.replace("-", "")} ${userId.slice(0, 6).toUpperCase()}`;
}
