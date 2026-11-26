# Hướng giao diện đã chọn — 26/11/2026

3 giám khảo độc lập (`bca-giam-khao`) chấm 3 mẫu A "Midnight" (tối navy + vàng), B "Sổ tay" (sáng, Inter), C "Sân trường" (trắng, Lexend, chữ to).

| Góc chấm | A | B | C | Kết luận của giám khảo |
|---|---|---|---|---|
| 1 · Học sinh trên điện thoại | 38/50 | 25/50 | 33/50 | Nền A + phần đầu dạng câu, nút to của C |
| 2 · Chủ lớp, giáo viên | 31/50 | 27/50 | 22/50 | A làm khung, B cho bảng dày, C cho bố cục điện thoại |
| 3 · Thương hiệu, WCAG, kỹ thuật | 42/50 | 32/50 | 33/50 | A làm nền, ghép bố cục câu của C; bỏ B |

## Chốt
- **Một ngôn ngữ thiết kế duy nhất: nền tối "Midnight" của A** cho cả học sinh, quản lý và trang giới thiệu. Khác nhau ở mật độ: học sinh thoáng, quản lý dày.
- **Phần đầu màn học sinh lấy của C:** câu "Tối nay học Toán lúc 22:15", nút "Vào lớp Meet" vàng, cao 56px, rộng hết hàng; đổi theo giờ (còn N phút → Vào lớp ngay → Xem record).
- **Bảng dày lấy của B:** ma trận điểm danh tháng, sổ điểm, học phí — tô theo token A, cột tên dính, tự cuộn tới cột hôm nay.
- **Điện thoại < 640px (quản lý):** bỏ thanh bên → thanh dưới; điểm danh thành danh sách 1 cột, nút Có / Phép / Vắng cao 48px dưới ngón cái (cách bố trí của C).
- **Biến thể sáng** chỉ cho phiếu học phí VietQR, tin nhắn Zalo xuất ảnh, bản in.
- **Font:** chỉ Be Vietnam Pro (400/600/800), `next/font` subsets `vietnamese` + `latin`, số dùng `tabular-nums`.

## Sửa bắt buộc so với mẫu (gộp từ 3 phiếu)
1. Điểm danh: nút "Đánh tất cả có mặt" + thanh "Hoàn tác" 5 giây; chọn thẳng trạng thái, không bấm đổi vòng; lưu ngay sau mỗi lần bấm, hiện "Đã lưu 22:31", hàng đợi khi mất mạng. Sửa buổi quá 48 giờ phải xác nhận.
2. Một bộ ký hiệu duy nhất: nút ghi chữ đầy đủ **Có / Phép / Vắng**; ma trận dùng ✓ / P / K kèm màu và `aria-label`. (Mẫu A và B từng dùng chữ V ngược nghĩa nhau.)
3. Màn đầu của quản lý là **Hôm nay**: buổi tối nay + nút điểm danh, đơn mới, em hết thử trong 3 ngày (chỉ chủ lớp), phiếu chưa thu (chỉ chủ lớp). Thẻ số liệu bấm được để lọc.
4. Học thử: thanh tiến độ 14 ngày, còn ≤ 3 ngày thì đổi màu cam; màn khoá riêng (lịch, record làm mờ, link Zalo, liên hệ gia hạn).
5. Học sinh: chuỗi buổi đi học liên tiếp (vắng có phép không làm đứt chuỗi) thay cho ô "Chuyên cần %".
6. Mọi mục "Cần làm" là `<a>`/`<button>` thật; chip cho xuống dòng, không cắt; vùng an toàn đáy màn; `touch-action: manipulation`.
7. Không nền cam/xanh lá có chữ trắng (trượt WCAG); viền ô nhập đủ 3:1; viền tiêu điểm vàng 2px.

## Chuyển động
- **Trang giới thiệu:** Lenis (chỉ nhóm route này, chạy theo `gsap.ticker`), GSAP ScrollTrigger ghim mục lộ trình 163 bài + đường tiến độ theo cuộn; React Bits `SplitText`, `ScrollReveal`, `Counter`, `ScrollStack` (vinh danh), `SpotlightCard` (4 môn), `FadeContent`; `Galaxy` (WebGL) chỉ từ 1024px. 21st.dev: `@cubby-ui/components/timeline`, `@ln-dev7/components/faqs-01` (đều MIT).
- **Khu học sinh:** chỉ hiện dần phần đầu, số đếm, tick khi xong bài. Cuộn gốc của máy (không Lenis).
- **Khu quản lý:** gần như không chuyển động.
- Mọi hiệu ứng tắt khi `prefers-reduced-motion`. Ngân sách JS trang giới thiệu ≈ 150 KB gz.
