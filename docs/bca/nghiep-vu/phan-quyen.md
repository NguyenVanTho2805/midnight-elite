# Nghiệp vụ — Phân quyền chủ lớp / giáo viên (Đợt 1)

Nguồn: các quyết định 2, 4, 5, 8, 14 và 16; script v8.12. Script **không có phân quyền**: chỉ chủ sheet dùng; giáo viên chỉ được nhắc đến qua `EMAIL_GIAO_VIEN` (giữ trong lớp Meet) và ô "Giáo viên" của từng môn. Quy ước chung xem đầu tệp `ghi-danh.md`.

## Điều 1. Vai trò

1.1. Có bốn nhóm người dùng (quyết định 2):

| Vai trò | Đợt có tài khoản | Ghi chú |
|---|---|---|
| **Chủ lớp** (quản trị) | Đợt 1 | Toàn quyền. Có thể có hơn một người là chủ. |
| **Giáo viên cộng tác** | Đợt 1 | Chỉ làm việc trên các môn được phân công. |
| Học sinh | Đợt 2 | Đăng nhập Google bằng Gmail đã khai (quyết định 4). |
| Phụ huynh | Không có | Chủ sao chép tin nhắn Zalo soạn sẵn để gửi (quyết định 5). |

1.2. Một người có thể vừa là chủ vừa là GV, ví dụ chủ sheet hiện tại cũng dạy 3 môn. Khi đó quyền là **hợp** của hai vai.

## Điều 2. Phân công môn

2.1. Bảng `phan_cong(nguoi_dung_id, mon_id)` là quan hệ nhiều–nhiều.
- Mỗi môn có thể có nhiều GV: Toán và Anh hiện mỗi môn 2 GV.
- Mỗi GV có thể dạy nhiều môn.
- Chỉ chủ được thêm hoặc gỡ phân công.

2.2. GV bị gỡ khỏi một môn thì **mất quyền ngay** ở môn đó, áp dụng từ request kế tiếp. Dữ liệu GV đã nhập (điểm danh, nội dung, record) vẫn giữ và vẫn ghi tên người nhập.

2.3. Hai GV cùng một môn cùng điểm danh một buổi: bản ghi **sau cùng thắng**. Nhật ký giữ cả hai lần ghi, và màn điểm danh hiện "Lần sửa cuối: GV X lúc 22:41".
- Ví dụ: GV-A (giả) chọn Vắng cho một em lúc 22:30, GV-B (giả) đổi thành Phép lúc 22:41. Kết quả là Phép, nhật ký có 2 dòng.

## Điều 3. Bảng quyền (Đợt 1)

Ký hiệu: ✔ = được · ✖ = không · "môn mình" = môn có trong `phan_cong` của GV.

| Hành động / dữ liệu | Chủ | GV |
|---|---|---|
| Xem danh sách học sinh | ✔ tất cả | ✔ chỉ em có ghi danh môn mình (đang hoặc đã từng) |
| Xem mã HS, họ tên, lứa, loại (Thử/Chính thức), tình trạng ở môn mình | ✔ | ✔ |
| Xem username Azota | ✔ | ✔ (cần cho nhập điểm ở Đợt 3) |
| Xem SĐT HS, Gmail HS | ✔ | Xem Câu hỏi 1 |
| Xem họ tên PH, SĐT PH, Zalo PH | ✔ | ✖ (quyết định 14) |
| Xem học phí, còn nợ, đơn giá, số dư | ✔ | ✖ (quyết định 14) |
| Xem ghi chú riêng của chủ trên hồ sơ | ✔ | ✖ |
| Tạo hoặc sửa hồ sơ học sinh | ✔ | ✖ |
| Thêm môn, nghỉ môn, nghỉ hẳn, ẩn | ✔ | ✖ |
| **Gia hạn thử, chuyển chính thức** | ✔ | ✖ (quyết định 16) |
| Sinh buổi theo lịch, sửa lịch môn | ✔ | ✖ |
| Huỷ buổi, thêm học bù | ✔ | Xem `buoi-hoc.md` Câu hỏi 2 (khuyên ✖) |
| Sửa nội dung buổi, link record | ✔ | ✔ môn mình |
| Điểm danh | ✔ | ✔ môn mình (giới hạn sửa: `diem-danh.md` Câu hỏi 2) |
| Xem ma trận điểm danh, số chuyên cần | ✔ | ✔ môn mình |
| Màn Hôm nay | ✔ đầy đủ | ✔ lọc theo môn mình (`hom-nay.md` Điều 6) |
| Đơn đăng ký | ✔ | ✖ |
| Cài đặt (giá, ngày bắt đầu, số ngày thử, Zalo, số tài khoản) | ✔ | ✖ |
| Quản lý tài khoản và phân công GV | ✔ | ✖ |
| Chạy chuyển dữ liệu từ sheet | ✔ | ✖ |
| Xem nhật ký thay đổi | ✔ tất cả | ✔ chỉ những thay đổi của chính mình |

- Ví dụ: GV chỉ dạy Anh (giả) mở danh sách học sinh ngày 26/11.
  - GV thấy các em từng có ghi danh Anh, gồm 51 em đang học hoặc thử, cộng với em đã nghỉ Anh.
  - Mỗi dòng có mã, tên, lứa, loại và tình trạng ở môn Anh. Không có cột SĐT PH hay "Còn nợ".
  - Em chỉ học Toán thì không hiện trong danh sách này.

## Điều 4. Kiểm tra quyền ở máy chủ

4.1. Mọi API và server action đều phải kiểm tra vai trò và phân công **ở máy chủ**. Ẩn nút trên giao diện là chưa đủ.
- Ví dụ: GV Anh gửi request điểm danh cho buổi Toán 28/11 (ví dụ sửa tay mã buổi). Máy chủ trả **403**, không ghi gì, và ghi nhật ký "từ chối".

4.2. Truy vấn dữ liệu cho vai trò GV **không được chọn** các cột cấm: họ tên PH, SĐT PH, các cột tiền, ghi chú của chủ. Không được lấy hết cột rồi giấu ở giao diện. Nên dùng view hoặc hàm select riêng cho vai trò GV.

4.3. Học sinh (Đợt 2) chỉ đọc dữ liệu của chính mình. Em thử chỉ đọc được trong khoảng thử (quyết định 8). Quá `den_ngay`, request đọc buổi, record hay điểm đều bị chặn ở máy chủ, không phải chỉ ẩn trên giao diện.
- Ví dụ: em thử hết 15/12. Ngày 16/12 lúc 00:01 (giờ Việt Nam), em mở link record buổi Toán 15/12 thì bị chặn, và thấy màn khoá có nút "Liên hệ gia hạn".

## Điều 5. Đăng nhập và phiên

5.1. Chủ và GV đăng nhập theo Câu hỏi 4. Tài khoản GV do chủ tạo bằng cách nhập Gmail rồi chọn môn. Không có trang tự đăng ký làm GV.

5.2. Chủ khoá tài khoản GV thì mọi phiên đang mở của GV đó hết hiệu lực ngay từ request kế tiếp.

## Điều 6. Nhật ký

6.1. Phải ghi nhật ký cho mọi thay đổi ghi danh, buổi học, điểm danh, phân công và cài đặt. Mỗi dòng gồm: người làm, vai trò, thời điểm (`timestamptz`, hiển thị giờ Việt Nam), đối tượng, giá trị trước và sau.

6.2. Không xoá được nhật ký từ giao diện. Sheet có tab `__Log` (99 dòng) nhưng không nhật ký nào theo người dùng.

## Khác sheet

| # | Sheet | Web mới |
|---|---|---|
| K1 | Một người (chủ sheet) làm mọi việc. | Thêm vai trò GV với phân công theo môn. |
| K2 | GV chỉ có mặt trong lớp Meet qua `EMAIL_GIAO_VIEN` (đang trống). | GV có tài khoản. Danh sách Gmail GV lấy từ bảng tài khoản, không lấy từ ô cài đặt. |
| K3 | Không có nhật ký theo người. | Mọi thay đổi đều có người làm. |

## Câu hỏi cho chủ

1. **GV có thấy SĐT và Gmail của học sinh không?** Quyết định 14 chỉ cấm SĐT phụ huynh.
   - A. Không thấy cả hai; GV chỉ thấy mã, tên, lứa, loại và username Azota. Liên lạc em qua nhóm Zalo môn. **(khuyên dùng: ít lộ dữ liệu nhất, GV vẫn đủ để dạy)**
   - B. Thấy Gmail, không thấy SĐT.
   - C. Thấy cả SĐT HS và Gmail.
2. **GV có thấy em đã nghỉ môn mình không?**
   - A. Có, chỉ để xem: điểm danh và (sau này) điểm cũ của các buổi em đã học. **(khuyên dùng)**
   - B. Không; chỉ thấy em đang học hoặc đang thử.
3. **Học sinh chính thức đã nghỉ (hoặc em thử đã hết hạn) có xem lại dữ liệu cũ của mình không?** Câu này để chốt trước cho Đợt 2.
   - A. Khoá hết, giống em hết thử.
   - B. Chỉ xem điểm và điểm danh của chính mình; không xem record hay tài liệu. **(khuyên dùng)**
   - C. Xem được hết như khi đang học.
4. **Chủ và GV đăng nhập bằng gì?**
   - A. Google, bằng Gmail mà chủ đã nhập vào danh sách GV (giống cách học sinh đăng nhập). **(khuyên dùng)**
   - B. Email kèm link đăng nhập một lần.
   - C. Tên đăng nhập và mật khẩu.
