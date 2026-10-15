// Phần THUẦN của scripts/db-push-on-production.mjs (tách ra để test, xem tools/local-e2e/t-db-push-guard.ts).
//
// Chuyện gì: khi thêm `@unique` vào một cột mới, `prisma db push` in "⚠️ There might be data loss..." kèm dòng
//   • A unique constraint covering the columns `[phoneE164]` on the table `users` will be added. If there are existing duplicate values, this will fail.
// rồi thoát lỗi, buộc phải có --accept-data-loss. Với riêng loại cảnh báo này thì cờ ấy VÔ HẠI: thêm ràng buộc duy nhất không xoá
// hay sửa dòng nào; nếu có giá trị trùng thì chính lệnh ALTER TABLE thất bại (không áp dụng gì). Bản build production 15/10/2026
// (PR #54, cột users.phoneE164) từng đỏ vì đúng chỗ này và phải bật tạm PRISMA_ACCEPT_DATA_LOSS=1 bằng tay.
//
// Quy tắc: chỉ cho chạy lại với --accept-data-loss khi MỌI cảnh báo trong kết quả đều là "thêm ràng buộc duy nhất". Chỉ cần MỘT cảnh báo khác
// (xoá cột, xoá bảng, đổi kiểu, thu hẹp kiểu...) là không tự chấp nhận — build vẫn đỏ như cũ.

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const HEADER = /There might be data loss when applying the changes/i;
const NEED_FLAG = /--accept-data-loss/;
const BULLET = /^\s*•\s+(.*\S)\s*$/; // đúng ký hiệu Prisma in; đổi ký hiệu thì không nhận ra cảnh báo nào → từ chối (an toàn)
const UNEXECUTABLE = /changes that cannot be executed/i; // có bước không thể chạy thì cờ cũng không cứu được — không tự chấp nhận gì
const UNIQUE_ADDED = /^A unique constraint covering the columns `?\[[^\]]+\]`? on the table `?[^`\s]+`? will be added\./;

/** Các dòng cảnh báo (bỏ ký hiệu đầu dòng) nằm sau tiêu đề "There might be data loss...". */
export function dataLossWarnings(output) {
  const lines = String(output ?? "").replace(ANSI, "").split(/\r?\n/);
  const at = lines.findIndex(l => HEADER.test(l));
  if (at < 0) return [];
  const out = [];
  for (const l of lines.slice(at + 1)) {
    if (/^\s*(Error|Use the --accept-data-loss)/i.test(l)) break;
    const m = BULLET.exec(l);
    if (m) out.push(m[1]);
  }
  return out;
}

/** true ⇔ lệnh thất bại ĐÚNG vì cảnh báo mất dữ liệu và mọi cảnh báo đều chỉ là "thêm ràng buộc duy nhất". */
export function onlyUniqueConstraintAdditions(output) {
  const text = String(output ?? "").replace(ANSI, "");
  if (!HEADER.test(text) || !NEED_FLAG.test(text) || UNEXECUTABLE.test(text)) return false;
  const w = dataLossWarnings(text);
  return w.length > 0 && w.every(x => UNIQUE_ADDED.test(x));
}
