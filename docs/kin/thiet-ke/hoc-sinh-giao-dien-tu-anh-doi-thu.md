# Thiết kế giao diện học sinh — mẫu rút từ các bên khác (22/10/2026)

Nguồn: 28 ảnh sàn gia sư trong báo cáo research, do 2 agent mở từng ảnh: Preply 19 ảnh (3 ảnh trắng do lỗi chụp), Superprof 4, Wyzant 5; thêm 4 ảnh màn học sinh của Shub (đã xem ở lượt trước). Đây là sàn kết nối gia sư với người học, nên khớp với màn **học viên chọn gia sư, đặt lịch, thanh toán**; **không có ảnh** nào về làm bài, phòng thi, bài tập, nên phần cốt lõi của KiN học sinh (luyện thi, bài tập) không có mẫu từ nguồn này, cần dựa vào Shub và tự thiết kế.

## Nguyên tắc rút ra (cho điện thoại, học sinh có thể dưới 16 tuổi)
1. **Một hành động chính mỗi màn**, tương phản cao. Preply, Superprof dùng đúng một nút lớn ở đầu trang.
2. **Hỏi một câu rồi mới lọc:** "Bạn muốn học gì?" với nút chọn môn dạng chip cuộn ngang, hiện luôn số kết quả.
3. **Chia quyết định nhỏ:** thời lượng → ngày → giờ → xác nhận; nút "Tiếp tục" xám đến khi đã chọn.
4. **Giá và rủi ro nói thẳng gần nút:** tổng tiền lặp lại ngay trong nút thanh toán, câu "không bị tính phí trước khi buổi học xong", chính sách huỷ nêu rõ giờ.
5. **Trạng thái rỗng có một câu và một nút** ("Hiện không có buổi học sắp tới" + "Tìm gia sư").
6. **Chọn giờ bằng lưới nút 3 cột**; ngày chọn viền đậm. Giờ hết chỗ vừa xám vừa có chữ (đừng chỉ phân biệt bằng sắc độ).
7. **Tránh:** tiêu đề khổng lồ, hai cột trên điện thoại, chân trang dài, nhãn lẫn tiếng Anh, vùng trắng lớn.

## Từng màn học sinh
| Màn | Thiết kế | Nguồn |
|---|---|---|
| **Trang chủ** | Lời chào một dòng; khối "Buổi học sắp tới" (giờ, lớp, nút Vào lớp); khối "Việc cần làm" (bài tập, thanh toán); lối tắt Lịch / Lớp / Bài tập. Tab dưới 4–5 mục, không menu ngang dài. Banner vàng nhỏ, đóng được, cho việc cần làm như chưa thanh toán. | Wyzant dashboard, Superprof, Shub |
| **Lớp của tôi** | Thẻ gọn: tên lớp, gia sư, buổi kế tiếp; nút duy nhất "Vào lớp". Rỗng: "Bạn chưa vào lớp nào" + nhập mã mời (ô mã 5 ký tự như Shub). | Shub, Wyzant |
| **Lịch học** | Dải 7 ngày cuộn ngang, chấm là có buổi, danh sách buổi dưới dải; ghi rõ hạn huỷ. | Preply, Wyzant |
| **Bài tập / Thi** | **Chưa có mẫu từ ảnh.** Đề xuất: danh sách theo hạn nộp, mỗi dòng một trạng thái bằng chữ (Chưa làm / Đã nộp / Chờ chấm), một nút "Làm bài". Thưởng Coin hiện ngay sau khi nộp. | Tự thiết kế |
| **Tìm gia sư** | Ô tìm + chip môn; thẻ gia sư một cột: ảnh vừa, sao + số đánh giá, giá, nhãn "buổi thử miễn phí" nếu có. Hồ sơ: thẻ giá + nút "Đặt lịch" dính đáy màn hình. | Superprof, Preply |
| **Thanh toán học phí** | Tóm tắt phiếu (lớp, tháng, số tiền) trước khi chuyển; mã QR + nội dung chuyển khoản copy được; sau chuyển tự gạch nợ (đã có sẵn). Không có nút "mua Coin" cho học sinh. | Preply (tóm tắt đơn), Wyzant (cam kết phí) |

## Không làm
- Không sao chép khung chọn "ngôn ngữ", bảng giá theo giờ, hay thanh toán thẻ/Apple Pay: KiN thu học phí theo tháng qua chuyển khoản.
- Không thêm màu mới ngoài token `--kin-*`; không mã hex.
- Học sinh có thể dưới 16 tuổi: không thêm thu thập dữ liệu, không đưa nội dung cờ bạc.

## Việc cần anh quyết trước khi dựng
Thứ tự dựng đề xuất: **Trang chủ học sinh → Lịch học → Lớp của tôi → Bài tập / Thi**. Phần Bài tập / Thi không có mẫu tham khảo, anh có muốn tôi bám vào phòng thi hiện có của KiN và chỉ làm gọn lại không?
