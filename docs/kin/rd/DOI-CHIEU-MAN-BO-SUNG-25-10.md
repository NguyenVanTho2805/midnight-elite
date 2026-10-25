# Đối chiếu 28 màn "bổ sung 25/10" và thanh bên mới (trang Figma "Nền móng")

Viết 25/10/2026. File Figma `2orXvoHL2upkiGoMjlq8aX`, trang `0:1` "📐 Nền móng": từ 84 lên **88 nút cấp 1**, thêm bốn khu 🆕 với **28 màn** và đổi **thanh bên** của mọi màn gia sư / học sinh / quản trị.

Cách đo: lấy mọi dòng chữ giao diện (bỏ dữ liệu mẫu có chữ số) của từng màn, tìm **nguyên văn** trong `src` của `main` (chuẩn hoá khoảng trắng và dấu thanh). Nhãn "không thấy" chưa chắc là thiếu tính năng (Thanh viết lại câu), nên con số là **cận dưới**. Không đo pixel / trạng thái lỗi / responsive. Công cụ: `label_scan.py` (cùng cách đo với báo cáo sáng 25/10).

## 1. Thanh bên mới — ĐÃ DỰNG (PR riêng)
Mọi khung đều có khung con "Điều hướng" 272px: logo + nhãn vai, mục xếp theo nhóm, chân "Miễn phí ra mắt". Đây chính là trạng thái "rộng" mà `thiet-ke/thanh-ben-trai.md` mục 8 ghi "chưa có khung Figma, cần Thanh vẽ". Đã dựng và đặt làm **mặc định** (xem mục 9 của tài liệu đó): 272px từ 1024px, thanh hẹp 79px và thu hẳn vẫn chọn được, điện thoại không đổi. Số đo, token và chỗ lệch có chủ ý (mục 37px → 44px ở màn cảm ứng) ghi ở đó.

## 2. 28 màn: độ phủ nhãn và chỗ lệch chính
`n/m` = nhãn thấy nguyên văn / nhãn đã chọn. Cột "Việc" ước lượng: **S** chỉ sửa chữ / thêm dòng phụ, **M** đổi bố cục một vùng, **L** dựng lại trang.

### Gia sư (vỏ `/lop-cua-toi`)
| Khung Figma | Trang trong mã | n/m | Lệch chính | Việc |
|---|---|---|---|---|
| 565:4641 Gói của tôi | `/lop-cua-toi/goi` (`GoiClient.tsx`) | 22/29 | Figma 2 cột: trái "Gói hiện tại" (Gói / Hạn dùng / Trạng thái) + "Mức bạn đã dùng" + "So sánh Free và KiN Pro"; phải "Mở KiN Pro" + "Cách tính" (3 gạch đầu dòng). Mã đang một cột, ghép số liệu thành hàng `KinStat`. Chữ khác: "Mức dưới đây chỉ để bạn theo dõi…", "Cấu hình sau", "Toàn bộ mẫu" | L |
| 565:4947 Liên hệ hỗ trợ | `/lop-cua-toi/ho-tro` | 7/10 | Dòng "Bạn đang ở gói Free: KiN trả lời theo thứ tự gửi…", gợi ý ô nhập "Mô tả việc đang kẹt…", nhắc "Đừng gửi mật khẩu hay mã một lần." | S |
| 574:5188 Tổng quan | `/lop-cua-toi/tong-quan` | 10/15 | Dòng phụ "Lớp, học sinh và việc cần xem của cô trong tuần."; thẻ "Phiếu chưa thu / Chờ phụ huynh chuyển khoản", "Đếm mỗi em một lần"; bảng "Việc cần xem" | M |
| 574:5489 Kế hoạch buổi | `/lop-cua-toi/ke-hoach-buoi` | 4/9 | Nút "Thêm kế hoạch", dòng phụ, trạng thái "Đã có kế hoạch" / "Chưa có kế hoạch cho buổi này", dòng "chỉ gia sư thấy" | M |
| 574:5777 Báo cáo tháng | `/lop-cua-toi/bao-cao-thang` | 10/12 | Khung "KiN chỉ cho biết báo cáo đã được chia sẻ" + "KiN không xác nhận phụ huynh đã đọc…" | S |
| 574:6082 Kiểm duyệt cộng đồng | `/lop-cua-toi/kiem-duyet` | 4/10 | Cột "Nội dung bị báo cáo / Lý do / Gửi lúc", các lý do mẫu, dòng "Ẩn một nội dung không xoá nó…" | M |
| 574:6351 Bài đăng tìm học sinh | `/lop-cua-toi/bai-dang` | 9/14 | Nút "Tạo bài đăng", dòng phụ, "Tại lớp" / "Tại nhà", dòng "Yêu cầu từ bài đăng vào Hộp việc, kèm đồng ý của phụ huynh." | S–M |

### Học sinh (vỏ `/student`)
| Khung Figma | Trang trong mã | n/m | Lệch chính | Việc |
|---|---|---|---|---|
| 575:5571 Thi thử | `/student/thi-thu` | 11/14 | Dòng phụ, ô "Tìm đề thi", dòng "Điểm hiện sau khi gia sư công bố…" | S |
| 575:5805 Bảng xếp hạng | `/student/bang-xep-hang` | 4/7 | Dòng quyền riêng tư "Em chỉ thấy tên hiển thị của các bạn…", cột "Số đề đã làm", dòng "(em)" | S |
| 575:5999 Ví và Coin | `/student/vi` | 5/13 | Trang cũ ("Ví Coin", `text-2xl`). Figma: "Số dư Coin / Nhận tháng này / Đã dùng", khối "Coin là điểm thưởng", bảng Ngày / Nội dung / Coin. Mã đã **không** cho học sinh nạp tiền (khớp Figma) | M–L |
| 575:6186 Hồ sơ | `/student/ho-so` | 9/10 | Gần khớp; thiếu dòng phụ | S |
| 575:6349 Tiếng Anh tự học | `/student/tieng-anh` | 9/11 | Dòng phụ, cột "Bài đang học" | S |
| 575:6538 Hỏi đáp | `/student/hoi-dap` | 10/13 | Dòng phụ, nhãn lọc "Chưa có trả lời", trạng thái "Đã có trả lời" | S |
| 575:6741 Cộng đồng | `/student/cong-dong` | 4/8 | Dòng phụ, cột "Lớp / môn", "Đăng lúc", dòng báo cáo nội dung | S–M |

### Quản trị (vỏ `/admin`, tên miền admin)
| Khung Figma | Trang trong mã | n/m | Lệch chính | Việc |
|---|---|---|---|---|
| 567:4791 Nội dung — Khoá học | `/admin/khoa-hoc` | 10/12 | Dòng phụ, chữ gợi ý ô tìm "Tìm khoá học hoặc người phụ trách" | S |
| 567:5048 Cài đặt — Gói KiN Pro | `/admin/goi-pro` | 16/21 | "Giá mỗi kỳ (đ)", "Số ngày mỗi kỳ", khối "Yêu cầu mua gói" + dòng trống | S–M (**tiền**: cần Thọ xem) |
| 568:4923 Hỗ trợ gia sư | `/admin/ho-tro` | 12/13 | Gần khớp | S |
| 568:5154 Duyệt nạp Coin | `/admin/topups` | 11/12 | Dòng phụ | S (**tiền**) |
| 576:5883 Danh mục | `/admin/khoa-hoc/danh-muc` | 9/10 | Dòng phụ | S |
| 576:6117 Đề thi | `/admin/thi-thu` | 9/11 | Dòng phụ, ô "Tìm đề thi" | S |
| 576:6355 Ngân hàng câu hỏi | `/admin/thi-thu/ngan-hang-cau-hoi` | 7/10 | Dòng phụ, ô tìm, cột "Nhóm câu hỏi" | S |
| 576:6594 Ngân hàng đề | `/admin/thi-thu/ngan-hang-de-thi` | 9/13 | Nút "Thêm đề", dòng phụ, ô tìm, "Đề trong ngân hàng" | S |
| 576:6817 Tin tức & Blog | `/admin/tin-tuc` | 9/11 | Dòng phụ, ô "Tìm bài viết" | S |
| 576:7032 Điểm chuẩn | `/admin/diem-chuan` | 5/8 | Nút "Nhập điểm", dòng phụ, dòng "Nguồn điểm chuẩn do quản trị nhập thủ công. KiN không tự cập nhật." | S |
| 576:7239 Bảng vinh danh | `/admin/vinh-danh` | 6/9 | Nút "Thêm vinh danh", dòng phụ, dòng "Chỉ hiển thị khi học sinh và phụ huynh đồng ý." (**trẻ em**: giữ đúng điều kiện đồng ý) | S |

### Điện thoại (390px, thanh dưới 4 tab — không đổi)
| Khung Figma | Trang trong mã | n/m | Lệch chính | Việc |
|---|---|---|---|---|
| 570:5054 Gia sư · Lịch | `/lop-cua-toi/lich` | 9/10 | Dòng "Buổi đã huỷ, báo phụ huynh" | S |
| 570:5237 Học sinh · Lớp của tôi | `/student/hoc-tap` | 7/10 | Dòng phụ, "Đã nhập mã lớp · chờ gia sư duyệt", "Lớp chỉ hiện sau khi gia sư duyệt…" | S |
| 570:5387 Học sinh · Bài tập | `/student/bai-tap` | 8/13 | Dòng phụ "Bài tập, đề thi và quiz của các lớp em học.", nút "Làm bài tiếp" | S |

## 3. Nhận xét chung
- **Nhóm "dòng phụ" (S)** chiếm đa số: mỗi trang trong khung mới có một dòng giải thích dưới tiêu đề (`KinPageHeader sub=…`). Trang gia sư đã có thành phần này; các trang học sinh và hầu hết trang quản trị chưa dùng `KinPageHeader` (đã dò thư mục trang của chúng; chỉ `/admin/ho-tro` có), nên cần chuyển sang cùng khung trang (một lần, rồi các dòng phụ đi theo).
- **Chữ giữ đúng Figma nhưng không bịa tính năng:** Figma có vài khối chưa có tính năng thật (đã nêu ở báo cáo sáng 25/10); khi dựng, chỉ lấy chữ mô tả đúng hành vi hiện có.
- **Hai việc chạm tiền** (`/admin/goi-pro`, `/admin/topups`) và **một việc chạm dữ liệu trẻ em** (`/admin/vinh-danh`) cần Thọ xem trước khi gộp, theo quy tắc cứng của kho.
- **Kiểm tra hiện có:** các bài `ui-*` kiểm chữ tiêu đề / dòng phụ hiện tại sẽ phải sửa theo khi đổi chữ; không xoá ca nào.

## 4. Thứ tự đề nghị
1. (Xong) Thanh bên rộng mặc định.
2. Dòng phụ + ô tìm + nhãn trạng thái cho nhóm **S** ở khu học sinh (7 trang) và khu quản trị không chạm tiền (8 trang), kèm chuyển học sinh sang `KinPageHeader`.
3. Gia sư: Liên hệ hỗ trợ, Báo cáo tháng, Bài đăng, Kế hoạch buổi, Tổng quan, Kiểm duyệt (nhóm S–M).
4. Ví và Coin, Gói của tôi (nhóm L): làm riêng từng trang, mỗi trang một PR.
5. Gói KiN Pro, Duyệt nạp Coin, Bảng vinh danh: sau khi Thọ xem.

## 5. Rà lần 2 (25/10, sau khi bắt tay làm lô "S") — nhóm S không còn là S
Đọc từng trang với Figma (ảnh khung + chữ) và với mã. Kết luận: ước lượng "S" ở mục 2 chỉ dựa trên độ phủ nhãn, **không** tính bố cục. Chỉ có Thi thử thật sự là việc nhỏ; các trang còn lại hoặc đã khớp, hoặc dính quyết định của chủ, hoặc là trang cũ phải dựng lại (M/L).

| Trang | Kết quả | Vì sao |
|---|---|---|
| `/thi-thu` (học sinh) | **ĐÃ LÀM** | Dựng lại theo 575:5571: ô "Tìm đề thi" (không dấu cũng ra), Tất cả / Chưa làm / Đã làm, bảng Đề · Môn · Thời gian · Số câu · Trạng thái, "Làm bài" / "Xem lại", dòng chú thích. Giữ lọc theo kỳ thi (ô chọn; cột Figma "Môn" đổi tên "Kỳ thi" vì dữ liệu `category` là nhóm đề ĐGNL HSA / THPT / BCA…, không phải môn), khoá đề của lớp chưa ghi danh, điểm / hạng, "Chờ gia sư chấm". Bỏ ba ô thống kê (Figma không vẽ). Khách vẫn thấy trang cũ. |
| `/bang-xep-hang` | **DỪNG, cần Thọ** | Figma ghi "Em chỉ thấy tên hiển thị của các bạn, không thấy lớp hay thông tin liên hệ." Mã đang hiện **tên trường** (`/api/leaderboard` trả `school`) nên câu này sẽ sai. Quyết định: ẩn tên trường khỏi bảng xếp hạng (dữ liệu học sinh) hay sửa câu của Figma. Trang còn có tab Vinh danh, dùng chung với khách. |
| `/student/tieng-anh` | **DỪNG, cần Thọ** | Figma "Luyện bốn kỹ năng" (Nghe, Nói, Đọc, Viết). Mã (IELTS, PR #60) có Nghe, Đọc, Viết, Từ vựng, **không có Nói**. Quyết định: bỏ "Nói" khỏi Figma hay dựng Nói. |
| `/student/hoc-tap` (Lớp của tôi) | Chưa làm | Figma có trạng thái "Đã nhập mã lớp · chờ gia sư duyệt". Mã chưa có trạng thái chờ gia sư duyệt (chỉ có `pending_consent`, chờ phụ huynh). Cần quyết định có thêm bước gia sư duyệt không. Đầu trang đã có dòng phụ. |
| `/student/bai-tap` | Đã khớp | Đã dựng theo Figma, đã có dòng phụ (chữ khác Figma nhưng đúng). |
| `/cong-dong`, tab Hỏi đáp | Giữ nguyên | Dòng phụ hiện có ("Trao đổi, hỏi đáp và chia sẻ kinh nghiệm") đúng. Câu Figma "giữa các bạn học cùng lớp" **sai** với cộng đồng công khai (TK-175: ai cũng xem bài công khai). |
| `/student/ho-so` | Chưa làm | Trang 771 dòng, tiêu đề là tên em + thẻ thông tin; Figma là tiêu đề "Hồ sơ" + khối đồng ý. Là việc M, nên làm riêng. |
| Quản trị: Khoá học, Danh mục, Đề thi, Ngân hàng câu hỏi, Ngân hàng đề, Tin tức, Điểm chuẩn | Chưa làm | Đều là trang **cũ dạng thẻ** (`rounded-xl`, `border-gray-200`, `text-lg font-extrabold`), nhiều trang đã có dòng phụ và ô tìm riêng, một số **chi tiết hơn Figma** (Điểm chuẩn: "mỗi dòng bắt buộc có đường dẫn nguồn", "Đã đối chiếu"). Gắn chữ Figma lên bố cục cũ chỉ đổi câu chữ. Đưa về Figma = dựng lại từng trang (M/L, riêng `/admin/thi-thu` dài ~2000 dòng); chưa nên làm khi bài `ui-*` chưa chạy được. |
| Quản trị: Hỗ trợ gia sư | Đã khớp | Đã dùng `KinPageHeader`. |

**Bài học cho ước lượng:** đo độ phủ nhãn (mục 2) chỉ cho cận dưới về chữ; muốn ước lượng việc phải nhìn cả bố cục của trang hiện có (đã dùng `KinPage` / `KinPageHeader` hay còn dạng thẻ cũ).
