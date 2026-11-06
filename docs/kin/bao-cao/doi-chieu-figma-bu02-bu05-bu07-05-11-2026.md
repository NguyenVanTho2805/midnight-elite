# Đối chiếu khung Figma với bản chạy — BU-02, BU-05, BU-07 (05/11/2026)

Chỉ đọc: không sửa Figma, không sửa mã. Khung Figma đọc bằng Plugin API (chữ từng nút) trên trang "Bigupdate (11/2026)" 606:2, file `2orXvoHL2upkiGoMjlq8aX`.

- BU-02 · nhóm 606:5 · 607:218 (máy tính), 607:491 (điện thoại)
- BU-05 · nhóm 606:3 · 608:71 (máy tính), 608:285 (điện thoại)
- BU-07 · nhóm 606:4 · 608:352 (danh sách), 608:538 (bài), 608:666 (điện thoại)

**Giới hạn của bản đối chiếu này:** "bản chạy" là mã nguồn trên `origin/main` (đọc `GiaoTrinh.tsx`, `OTaiLen.tsx`, `src/components/community/*`, `src/components/student/tin-tuc/*`, đặc tả BU-02/05/07), KHÔNG phải trang đang chạy dựng lên rồi chụp. Chưa đo cỡ chữ, khoảng cách, màu. Mọi dòng dưới đây là chênh về nội dung, nút và cấu trúc.

Mức: Lớn (đổi việc người dùng làm được) / Vừa / Nhỏ / Chưa rõ (cần mở bản chạy).
Cột cuối: "Sửa mã" hoặc "Sửa Figma". Khi chưa chắc ai đúng, ghi "Hỏi Thanh".

## BU-02 · Giáo trình (607:218, 607:491)

| # | Khung nói gì | Mã đang làm gì | Mức | Đề xuất |
|---|---|---|---|---|
| 1 | Bố cục một cột: ô thả tệp ở trên, các chương nối nhau bên dưới | Ba cột: cây Phần > Chương > Bài, ô tải lên chung cùng danh sách mục theo loại, bảng thông tin bài | Lớn | Sửa Figma theo mã (mã khớp đặc tả BU-02). Hỏi Thanh nếu muốn một cột |
| 2 | Mỗi mục có trạng thái Đã đăng / Nháp / Đang tải và nút Sửa / Ẩn | Không có trạng thái Nháp/Đã đăng/Ẩn từng mục. Có "Khoá bài", "Cho học thử miễn phí", đổi tên, thời lượng | Lớn | Hỏi Thanh. Nếu cần Nháp thì thêm vào đặc tả rồi sửa mã (thêm cột, chỉ thêm). Nếu không, sửa Figma |
| 3 | Dòng "mục Nháp chỉ gia sư thấy" | Không có khái niệm này | Lớn | Cùng quyết với dòng 2 |
| 4 | Nút "Thêm chương" ở đầu trang | Chương/phần thêm trong cây; từng chương có nút "+ Bài". Không thấy chuỗi "Thêm chương" trong `GiaoTrinh.tsx` | Vừa | Sửa Figma (đổi về thao tác trong cây) hoặc sửa mã nếu "Thêm chương" là ý Thanh |
| 5 | Nhãn loại mục: VIDEO / TÀI LIỆU / BÀI TẬP / KIỂM TRA / BUỔI LIVE | Loại trong mã: Tài liệu / Bài tập/Azota / Buổi live / Bài kiểm tra. Video là phần của bài (tải tệp video chỉ khi bật cờ `KIN_VIDEO_UPLOAD`) | Vừa | Sửa Figma: bỏ nhãn VIDEO thành mục độc lập, đổi "Bài tập" thành "Bài tập/Azota" |
| 6 | Chip "Nhận diện: YouTube ✓", dải nguồn YouTube · Google Drive · Vimeo · Zoom · Azota · PDF · Word · Ảnh | Ô tải lên chung nhận liên kết và tệp, nhận diện nguồn; danh sách nguồn lấy theo cấu hình. Chưa đối chiếu từng nguồn có trong danh sách | Chưa rõ | Mở bản chạy dán thử từng loại liên kết rồi chốt |
| 7 | Nút "Xem như học sinh" ở đầu trang | Có ("Xem như học sinh" ở `KinPageHeader`) | Khớp | Không cần sửa |
| 8 | Không thấy mũi tên đổi thứ tự | Có mũi tên lên/xuống cho phần, chương, bài | Nhỏ | Sửa Figma thêm mũi tên (hoặc ghi chú) |
| 9 | Không có "Thư viện của tôi" | Có màn riêng "Thư viện của tôi" (`ThuVienCuaToi.tsx`) | Nhỏ | Sửa Figma nếu cần vẽ đủ; không bắt buộc |
| 10 | Không có ô xác nhận bản quyền, không có hạn mức tệp | Có ô xác nhận bản quyền và giới hạn dung lượng lấy từ cấu hình | Vừa | Sửa Figma: thêm ô xác nhận bản quyền (liên quan trẻ em/bản quyền, nên có trong khung) |
| 11 | Ba tab Giáo trình / Lịch / Học viên | Tab nằm ở vỏ lớp; khớp tên tab. Chưa đối chiếu thứ tự và mặc định | Chưa rõ | Mở bản chạy |
| 12 | Điện thoại: thanh dưới Hộp việc / Lịch / Lớp / Học phí | Thanh dưới của vỏ gia sư. Nhãn khớp theo đặc tả BU-00; chưa đo | Chưa rõ | Mở bản chạy |

Đề xuất chung BU-02: khung đang vẽ một màn "danh sách phẳng có trạng thái từng mục", còn mã là "cây ba cột". Hai thứ khác nhau về mô hình, không phải khác màu. Cần Thanh chọn một. Nếu giữ mã thì vẽ lại 607:218 theo 3 cột; nếu muốn Nháp/Ẩn từng mục thì đó là việc mới (thêm cột `status` ở bảng bài), chưa nằm trong BU-02 đã gộp.

## BU-05 · Cộng đồng (608:71, 608:285)

| # | Khung nói gì | Mã đang làm gì | Mức | Đề xuất |
|---|---|---|---|---|
| 1 | Tiêu đề "Cộng đồng — Bảng tin"; bên trái là thanh của HỌC SINH | Mã dựng điều hướng trái RIÊNG của cộng đồng (`LeftNav`): đúng 4 mục Bảng tin, Hỏi đáp, Lớp của tôi, Đã lưu. Thanh vỏ học sinh nằm ngoài | Vừa | Sửa Figma: tách rõ thanh vỏ và điều hướng trái của cộng đồng |
| 2 | Thanh trái còn "Chủ đề màu" và "Nhập mã lớp" | `LeftNav` ghi rõ KHÔNG thêm mục ngoài 4 mục (đã rút ở BU-00). "Nhập mã lớp" có ở vỏ học sinh, "Chủ đề màu" không thấy trong cộng đồng | Vừa | Sửa Figma: bỏ hai mục khỏi điều hướng cộng đồng (nếu để thì trái quyết định BU-00) |
| 3 | Nút "Viết bài" | Ô soạn nằm sẵn trên feed (`Composer`), nút gửi là "Đăng". Không có nút "Viết bài" riêng | Vừa | Hỏi Thanh: giữ ô soạn mở sẵn (mã) hay nút mở ô soạn (khung) |
| 4 | Tab Bảng tin / Hỏi đáp / Lớp của tôi / Đã lưu | Cùng bốn mục nhưng là điều hướng trái hoặc dải chip, đổi tab = đổi địa chỉ `?tab=` | Nhỏ | Sửa Figma: ghi rõ chuyển thành chip ở vùng hẹp |
| 5 | Ô soạn "Bạn muốn chia sẻ gì với lớp?", ba lựa chọn Bài viết / Câu hỏi / Ảnh | Ô soạn "Bạn muốn hỏi hay chia sẻ gì?". Loại bài: Bài viết / Câu hỏi. Ảnh là bộ chọn ảnh kèm theo, không phải loại bài | Nhỏ | Sửa Figma: đổi câu gợi ý, "Ảnh" thành nút đính kèm |
| 6 | "Đăng vào: Toán 9 · Cô Lan" | Có "Đăng vào" (chọn phạm vi chung / lớp), nhãn lớp "Lớp học · ..." / "Lớp dạy · ..." | Nhỏ | Sửa Figma đổi nhãn cho khớp |
| 7 | Thẻ bài có nhãn vai GIA SƯ / HỌC SINH / CÂU HỎI | Mã dùng nhãn kiểu bài (Hỏi đáp...) và trạng thái "Đã có đáp án". Nhãn vai chưa thấy trong `FeedCard`/`ThreadDetailShared` | Vừa | Chưa rõ: mở bản chạy. Nếu không có thì sửa Figma |
| 8 | Hành động Thích / Bình luận / Lưu / Báo cáo / Trả lời | Có Thích, Bình luận, Lưu, Báo cáo. "Báo cáo" nằm dưới dấu … ở vùng hẹp. "Trả lời" nằm trong chi tiết bài | Nhỏ | Sửa Figma: gộp Báo cáo vào menu … ở 390 |
| 9 | Cột phải "Gia sư nổi bật" | Có, xếp theo số trả lời thật trong 30 ngày; ẩn cả khối khi thiếu dữ liệu | Nhỏ | Sửa Figma: ghi chú khối ẩn khi trống, không bịa |
| 10 | Cột phải "Câu hỏi chưa trả lời · 4" | Có "Câu hỏi chưa trả lời"; ở vùng hẹp thành hàng cuộn ngang dưới ô soạn (`UnansweredStrip`) | Nhỏ | Sửa Figma: vẽ bản hẹp |
| 11 | Ghi chú: câu hỏi của khách vào hàng chờ kiểm duyệt | Biểu mẫu khách (`GuestQuestionForm`) tồn tại nhưng `KIN_GUEST_QUESTIONS` đang tắt tới khi BU-08 cùng lên (theo SO-VIEC) | Vừa | Giữ khung; ghi chú trên khung "đang tắt bằng cờ" |
| 12 | Điện thoại: chuỗi trả lời lồng, nút "+ Viết bài", thanh dưới Việc của tôi / Lịch học / Lớp của tôi / Bài tập | Có chuỗi trả lời (`ReplyTree`). Thanh dưới học sinh chưa đối chiếu nhãn | Chưa rõ | Mở bản chạy |

Đề xuất chung BU-05: mã đúng hơn khung ở chỗ điều hướng trái (4 mục cố định theo quyết định BU-00). Nên sửa Figma bỏ "Chủ đề màu", "Nhập mã lớp" khỏi cột trái cộng đồng. Phần cần Thanh quyết là nút "Viết bài" (dòng 3).

## BU-07 · Tin tức (608:352, 608:538, 608:666)

| # | Khung nói gì | Mã đang làm gì | Mức | Đề xuất |
|---|---|---|---|---|
| 1 | Chip chuyên mục: Tất cả, Tuyển sinh, Học tập, KiN, Gia sư | `THANH_MUC` đúng năm nhãn này | Khớp | Không cần sửa |
| 2 | Tin nổi bật một bài lớn | Có `TinNoiBat` | Khớp | Không cần sửa |
| 3 | Liên kết "Xem thêm →" theo khối | Có, ở `KhoiChuyenMuc`; mỗi khối lấy tối đa 3 tin phụ | Khớp | Không cần sửa |
| 4 | "Xem nhiều" 1 đến 5 | `XemNhieu` lấy 5 bài | Khớp | Không cần sửa |
| 5 | Trang bài có ba nút: Chia sẻ, Sao chép liên kết, In | `ChiaSe` ở trang bài: Sao chép link, Facebook, Chia sẻ… (Web Share, chỉ hiện ở điện thoại). KHÔNG có nút In | Vừa | Hỏi Thanh: bỏ "In" khỏi khung (nhanh) hoặc thêm nút In vào mã (nhỏ, `window.print`). Nên bỏ khỏi khung và thêm Facebook |
| 6 | Nhãn "Sao chép liên kết" | Mã ghi "Sao chép link" | Nhỏ | Sửa Figma cho khớp mã (hoặc đổi mã cho đúng giọng KiN) |
| 7 | Dòng ngày, thời lượng đọc | Mã có hàm tính thời gian ("N phút" ở `kieu.ts`) dùng cho "đăng cách đây". Chưa thấy "phút đọc" | Chưa rõ | Mở bản chạy. Nếu không có, bỏ "thời lượng đọc" khỏi khung |
| 8 | Chữ ký "Ban biên tập KiN" | Mã in `bai.author` ở cuối bài (`data-article-author`), giá trị do người soạn nhập | Nhỏ | Giữ khung (chỉ là ví dụ); ghi chú trên khung là dữ liệu mẫu |
| 9 | "← Trở lại Tuyển sinh" | Có: "← Trở lại {nhãn mục}" | Khớp | Không cần sửa |
| 10 | "Tin liên quan" | Có, tối đa 4 bài, loại chính bài đang đọc | Khớp | Không cần sửa |
| 11 | Mục "Ba mốc cần nhớ" trong bài | Nội dung bài do người soạn viết, không phải thành phần cố định | Nhỏ | Ghi chú trên khung: nội dung mẫu |
| 12 | Điện thoại: chip + danh sách tin | Có dòng tin gọn và nút "Chia sẻ" một nút (`kieu="dong"`) ở dòng tin | Nhỏ | Sửa Figma thêm nút Chia sẻ ở dòng tin 390 |

Đề xuất chung BU-07: khung và mã khớp phần lớn. Chênh thật duy nhất là nút "In" (dòng 5) và, nếu mở bản chạy vẫn không thấy, "thời lượng đọc" (dòng 7).

## Chưa đối chiếu

- Cỡ chữ, khoảng cách, màu, bo góc của cả 7 khung (chưa dựng bản chạy để đo).
- Bản chạy thật của BU-02 và BU-05 điện thoại (thanh dưới), dòng 6/11/12 BU-02, dòng 7/12 BU-05, dòng 7 BU-07.
- Nội dung trong khung là dữ liệu mẫu (tên lớp, tên gia sư, số đếm): không so với dữ liệu thật.

## Việc cần Thanh quyết (ngắn)

1. BU-02: giữ cây ba cột như mã (sửa Figma) hay thêm Nháp/Ẩn từng mục (việc mới)?
2. BU-05: ô soạn mở sẵn hay nút "Viết bài"?
3. BU-07: bỏ nút "In" khỏi khung hay thêm vào mã?
