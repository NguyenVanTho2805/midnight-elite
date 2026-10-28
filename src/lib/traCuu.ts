// Tra cứu học viên theo số điện thoại (trang /tra-cuu, KHÔNG cần đăng nhập). Phần thuần để test từng quy tắc.
//
// Người gõ vào ô tra cứu chưa chứng minh được số đó là của mình, nên kết quả chỉ được là thứ ít nhạy cảm nhất: chữ cái đầu của từng
// từ trong tên (đủ để người nhà nhận ra "đúng em rồi") cộng mã học viên. Tên đầy đủ và danh sách lớp chỉ có sau khi đăng nhập.

/** "Nguyễn Minh Anh" → "N••• M••• A•••". Số dấu chấm cố định nên không lộ độ dài tên; tên rỗng → "•••". */
export function maskName(name: string): string {
  const words = name.normalize("NFC").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "•••";
  return words.map(w => `${Array.from(w)[0]!.toUpperCase()}•••`).join(" ");
}
