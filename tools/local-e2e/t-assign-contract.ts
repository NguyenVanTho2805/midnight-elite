// BU-03 P3 — HỢP ĐỒNG với BU-04 (stu-code): phòng thi học sinh phải TỰ ÉP những gì giao đề chỉ mới GHI. Mục 8 của đặc tả: in SKIP (chờ BU-04), KHÔNG tính pass.
// Khi BU-04 xong (D2): đổi `READY` thành true, viết thân từng ca (gọi API học sinh thật như t-quiz-hs.ts) và đổi hai cờ ở src/lib/deThiAssign.ts.
// Chạy: DATABASE_URL=postgresql://x:y@localhost:5432/z npx tsx tools/local-e2e/t-assign-contract.ts
import { section, done } from "./h";
import { AUDIENCE_LINK_READY, VARIANT_STUDENT_SUPPORT } from "@/lib/deThiAssign";

const READY = false; // BU-04 chưa xong
const CASES = [
  "ép khung giờ: bài mode=test, start trước giờ mở → 409 not_open; sau giờ đóng → 409 closed",
  "ép số lần: maxAttempts=1 → lượt thứ hai 409 (kể cả khi lượt đầu ở MÃ ĐỀ KHÁC trong nhóm)",
  "mã đề: hai học sinh được chia mã khác nhau bằng pickVariantFor, cùng học sinh luôn nhận cùng mã",
  "gộp lượt/điểm theo nhóm mã đề ở bảng xếp hạng và 'bài của tôi'",
  "ẩn hàng variantOfId != null khỏi danh sách đề của học sinh",
  "giao theo link: đề không gắn lớp KHÔNG lọt danh sách công khai (GET /api/exams)",
  "mode=practice: không ép khung giờ; mode=null (đề cũ): hành vi hiện tại không đổi",
  "mật khẩu: vào thi đúng/sai theo passwordHash, GET công khai không lộ hash",
];

(async () => {
section("Hợp đồng giao đề ↔ phòng thi (BU-04)");
if (!READY) {
  for (const c of CASES) console.log(`  - SKIP (chờ BU-04): ${c}`);
  console.log(`  - cờ hiện tại: VARIANT_STUDENT_SUPPORT=${VARIANT_STUDENT_SUPPORT}, AUDIENCE_LINK_READY=${AUDIENCE_LINK_READY} (đổi true khi BU-04 xong)`);
}
await done();
})();
