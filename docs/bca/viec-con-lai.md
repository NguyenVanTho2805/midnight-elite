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

Từ BCA-D1-VAI-CL (vai chủ lớp, KHÔNG ĐẠT — 2 P2):
20. ~~**P2** Xoá buổi: theo T42 (chỉ buổi tương lai, xác nhận + Hoàn tác, nút "Sinh buổi còn thiếu") — components/quan-ly/buoi-hoc.tsx:163-176, server/buoi-hoc.ts.~~ — đã làm 26/11 (kiểm lại 27/11: test vong-4 đạt, nút có trên web).
21. ~~**P2** Đơn đăng ký: theo T43 ("Tạo hồ sơ từ đơn", "Bỏ qua") — app/(quan-ly)/quan-ly/don/page.tsx, server/don.ts.~~ — đã làm 26/11 (kiểm lại 27/11).
22. Nút "Xem 4 em ›" mở đúng nhóm ngày (lọc theo ngày hết), số trên nút khớp số em hiện.
23. Ghi chú hồ sơ: báo "Đã lưu HH:MM"; mục Ghi chú không gập khi trống; báo khi chạm giới hạn 2000 ký tự (components/quan-ly/ghi-chu-hs.tsx).
24. Tờ "Gia hạn cả nhóm" liệt kê tên các em trước khi bấm.
25. /api/gia-han: số ngày sai (−5, 9999) trả 400 thay vì 409; trang "Không tìm thấy" trả HTTP 404 nếu làm được.

## Đợt 2 — đăng nhập Google (BCA-D2-DN, 26/11) — đã xong
Đã làm: Google OIDC (code + PKCE + state + nonce), trang `/dang-nhap` mới, T41 khoá phiên học sinh (cột `hoc_sinh.phien_huy_luc`, nút ở hồ sơ), script `them-nguoi-dung.ts`. Test: vitest 188/188 (29 ca mới), Playwright 43/43 (7 ca mới). Việc chủ ngoài mã: `bca/README.md` mục "Việc của chủ ngoài mã".

Còn lại (P3, không chặn lên chính thức):
1. ~~Màn "Tài khoản" cho chủ~~ — đã làm 27/11 (T55).
2. Bị từ chối "Gmail chưa có trong lớp": hiện Gmail đã chọn dạng che bớt (vd. `ng•••@gmail.com`) để em biết chọn nhầm tài khoản Google (truyền qua cookie ngắn hạn, không qua địa chỉ).
3. Khi có route sửa Gmail hồ sơ học sinh: tự đặt `phien_huy_luc` (Gmail cũ không còn giữ phiên).
4. `/api/dang-xuat` chỉ xoá cookie trên máy đó (token cũ còn hạn nếu bị lấy cắp) — cân nhắc đặt `phien_huy_luc` khi bấm "Đăng xuất mọi máy" của chính người dùng.
5. Thiếu `BCA_SESSION_SECRET` ở production ⇒ trang `/dang-nhap` và route Google trả 500 (giống mọi trang khác); có thể hiện trang báo cấu hình thay vì 500.
6. Nhãn "Đăng xuất em khỏi mọi máy…" gãy 2 dòng ở cột Liên hệ 1280 — rút gọn nếu giám khảo yêu cầu.

## Đợt 2 — màn Tài khoản (T55) + khu học sinh (BCA-D2-HS, 27/11) — đã xong
Test: vitest 209/209, Playwright 54/54. Còn lại (P3):
1. Khu học sinh: chưa có trang riêng một buổi (`/hoc/buoi/[id]`, API `GET /api/hs/buoi/[id]` đã có) — nội dung dài đang cắt 3 dòng.
2. Khu học sinh: chưa có điểm (Đợt 3 — sổ điểm), chưa PWA/thông báo nhắc giờ học.
3. Link Meet các môn đang trống trong dữ liệu sheet ⇒ học sinh chỉ thấy "Link Meet gửi trong nhóm Zalo" tới khi chủ điền link Meet (chưa có màn sửa môn) hoặc Đợt 4 đồng bộ Meet.
4. Chưa có màn Cài đặt để chủ sửa `ZALO_HOC_THU` / `ZALO_CHUNG` / link Meet, link Zalo môn trên web (đang lấy từ sheet khi chuyển dữ liệu).
5. Màn Tài khoản: chưa thêm được chủ thứ hai trên web (chỉ GV; chủ thứ hai dùng script dự phòng).
6. Tài khoản chủ do `BCA_GMAIL_CHU` tạo có tên "Chủ lớp" — chủ sửa ở màn Tài khoản.

## Đợt 2 — ghi chú đầu vào
- ~~Khu học sinh thay trang /hoc tạm~~ (đã làm 27/11, BCA-D2-HS): chữ có dấu thay mã máy ("thu", "nghi", "co"…), ngày dd/mm, "Tối nay học gì" + nút Meet, số ngày thử còn lại, link Zalo học thử, nội dung + record buổi, màn khoá khi hết hạn kèm "Liên hệ gia hạn" (phan-quyen.md 4.3); không hiện câu "hỏi em" (dành cho chủ); buổi đã qua chưa có dấu không ghi "chưa điểm" kiểu gây lo.
- ~~T41: khoá phiên học sinh (server/phien.ts:11-13) cùng đăng nhập Google.~~ Đã làm (BCA-D2-DN).
- Dữ liệu `/api/hs/toi` đã đủ cho màn thật.

## Thiết kế lại giao diện (QĐ 27) — tiến độ
- Bước 1 (27/11, xong): sáng + tối tự theo máy, nút đổi, tách tầng nền.
- Bước 2 (27/11, xong): khu học sinh `/hoc` (thẻ Tối nay nền đêm, tuần này theo màu môn, chuỗi dạng chấm, danh sách buổi gập còn 3 dòng, em sắp hết thử có việc để bấm) và trang đăng nhập (không còn lộ tên biến môi trường). Test trình duyệt 54/54.
- Bước 3 (27/11, xong): Hôm nay — thẻ tối nay nền đêm với đúng một nút vàng, "Buổi chưa điểm danh" lên đầu danh sách việc, nhóm thử gập danh sách từng em (chỉ "Hết thử – hỏi em" mở sẵn), thẻ "Thử hết trong 3 ngày" đổi màu khi > 0, "Có mặt tháng này" có % và thanh. Ma trận tháng — tô nền ô theo trạng thái, thêm % có mặt (đỏ khi vắng từ 2 buổi), chỉ tô vàng cột đúng hôm nay. Test 210/210 + 54/54.
  Không làm (khác đề xuất của agent): hộp việc chia tab (chip việc đang là link sang danh sách đã lọc — giữ), 4 thẻ số liệu lên hàng trên cùng, ma trận rộng hết khung, sắp xếp theo % và lọc "vắng ≥ 2".
- Bước 4 (chưa): Học sinh thành bảng dữ liệu, Buổi học thành lịch tuần, tìm nhanh ⌘K (chờ chủ quyết có thêm shadcn không).
Còn lại của bước 2 (P3):
1. Máy tính: khu học sinh vẫn một cột 560px (chưa làm bố cục hai cột).
2. Em hết hạn / sắp hết thử mà lớp chưa cấu hình `ZALO_CHUNG` / `ZALO_HOC_THU`: chỉ có câu chữ, không có nút — cần màn Cài đặt (mục 4 phần Đợt 2 ở trên) hoặc thêm tên/SĐT chủ lớp.
3. Chuyển động khu học sinh (hiện dần so le, số chuỗi đếm lên) chưa làm.
4. Tương phản màu môn và bảng màu mới chưa đo bằng máy.
