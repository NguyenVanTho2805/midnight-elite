# Việc còn lại — BCA Midnight

Gom các phát hiện P3 (không chặn đợt) và ghi chú cho đợt sau. Mỗi mục: nguồn phiếu · tệp · việc.

## Đợt 1 — vòng làm gọn cuối đợt
Từ BCA-D1-GK2 (giám khảo vòng 2, ĐẠT):
1. Tách `homNay` thành `lopToiNay` · `viecCanLam` · `theSo` · `lich7Ngay`; khối tối nay tải trước; bọc tính việc từng em bằng try/catch (server/hom-nay.ts:18, page.tsx:91). Kèm `lua`, `sdt_hs` trong việc thử (bỏ gọi `danhSachHocSinh` ở page.tsx:32–36).
2. Trang mở qua 21:45: nút "Điểm danh mở lúc 21:45" tự đổi thành nút vàng — hẹn một lần `router.refresh()` (dem-nguoc.tsx:8–12, page.tsx:139–143).
3. loading.tsx riêng cho hoc-sinh/ và buoi-hoc/ theo man-hoc-sinh §10.
4. Sửa chú thích forbidden.tsx:1 (trang trả 200 + noindex; API vẫn 403).
5. Cập nhật đặc tả man-hom-nay.md §6, §9 theo bản dựng (2 nút + "…", lưới 8/4).
6. Học sinh 1280: thêm nhãn "Loại:" trước chip "Nghỉ" (danh-sach-hs.tsx).
7. Thẻ tối nay 390: `whitespace-nowrap` cho cụm "GV …" (page.tsx:121).
8. Điểm danh 390: chip "Vắng 0" sát mép phải — thêm `pr-4`/`scroll-px-4` (diem-danh-buoi.tsx:287).

Từ BCA-D1-VAI-HS (vai học sinh, ĐẠT):
9. `soNguyen` chỉ nhận `^-?\d+$` (server/api.ts) — hiện `0x2` được hiểu là 2.
10. Giới hạn tần suất / gộp dòng nhật ký "từ chối" (server/api.ts:17).

Từ BCA-D1-VAI-GV (vai giáo viên, ĐẠT — 7 chạm, ~10 s máy đo / ~25 s người thật cho 5 em vắng):
11. Nút "Đã điểm đủ · Xong" phải khoá khi mất mạng hoặc còn thay đổi chưa gửi (bấm vào là trình duyệt báo lỗi mạng) — diem-danh-buoi.tsx:305-306. **Ưu tiên cao nhất trong nhóm P3.**
12. Ma trận: phím 1/2/3 trên cột quá 48 giờ phải mở hỏi xác nhận như Enter (ma-tran.tsx:118).
13. Buổi quá 48 giờ trên điện thoại: sau "Mở sửa cả buổi" áp luôn lựa chọn vừa chạm; câu cảnh báo cho GV không nhắc học phí (diem-danh-buoi.tsx:140, 279, 449).
14. PATCH /api/buoi-hoc/[id] không có trường hợp lệ ⇒ 400, không ghi nhật ký rỗng.
15. Điểm danh điện thoại: thêm nút Tìm cạnh "Đánh tất cả" ở đáy (tầm ngón cái).
16. Chip "Thử · còn N ngày" không xuống dòng khi hiện chấm "chưa gửi".
17. "Dán link record" hiện cả dưới 1024px trên màn Điểm danh (diem-danh-buoi.tsx:263-267).
18. Bỏ chữ "GV" lặp trước tên hiển thị.
19. Chặn đồng nhất: buổi môn khác cũng hiện "Không tìm thấy" như hồ sơ (không lộ việc buổi tồn tại).

## Đợt 2 — ghi chú đầu vào
- Khu học sinh thay trang /hoc tạm: chữ có dấu thay mã máy ("thu", "nghi", "co"…), ngày dd/mm, "Tối nay học gì" + nút Meet, số ngày thử còn lại, link Zalo học thử, nội dung + record buổi, màn khoá khi hết hạn kèm "Liên hệ gia hạn" (phan-quyen.md 4.3); không hiện câu "hỏi em" (dành cho chủ); buổi đã qua chưa có dấu không ghi "chưa điểm" kiểu gây lo.
- T41: khoá phiên học sinh (server/phien.ts:11-13) cùng đăng nhập Google.
- Dữ liệu `/api/hs/toi` đã đủ cho màn thật.
