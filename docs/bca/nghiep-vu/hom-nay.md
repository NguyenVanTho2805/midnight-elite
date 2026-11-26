# Nghiệp vụ — Màn Hôm nay (Đợt 1)

Nguồn: `kin_tqData`, `kin_viecList`, `kin_anXong`, `kin_setXong`, `kin_tinhTrang`, `kin_hetThu` trong script v8.12 (tab 🏠 Tổng quan); `thiet-ke/huong-chon.md` (mục "Sửa bắt buộc" 3); các quyết định 14, 21 và 23. Quy ước chung xem đầu tệp `ghi-danh.md`. Mọi số trong ví dụ đều tính từ bản xuất sheet, coi như "hôm nay" là Thứ Năm 26/11/2026.

## Điều 1. Hôm nay là ngày nào

1.1. "Hôm nay" là ngày theo lịch giờ Việt Nam, đọc từ đồng hồ máy chủ rồi đổi sang `Asia/Ho_Chi_Minh`. Không được lấy giờ trên máy người dùng.

## Điều 2. Khối "Lớp tối nay" (luôn nằm trên cùng)

2.1. Liệt kê mọi buổi có ngày là hôm nay, gồm buổi theo lịch, học bù, và cả buổi đã huỷ. Mỗi thẻ gồm:
- môn, giờ "22:15–23:45", trạng thái (Có học / Học bù / **Lớp nghỉ** kèm lý do);
- sĩ số "x chính thức · y thử";
- tiến độ điểm danh "đã điểm z/n em";
- nút **Điểm danh** to. Nút sáng từ 21:45. Thẻ của buổi đã huỷ không có nút;
- nút "Thêm nội dung / record";
- link Meet, sang Đợt 4 mới có.
- Ví dụ (26/11, T5): một thẻ **Anh 22:15–23:45 · 8 chính thức · 43 thử · đã điểm 0/51**.

2.2. **Buổi tối qua:** từ 00:00 đến 05:59 (xem Câu hỏi 1), nếu buổi của ngày hôm qua chưa điểm danh đủ thì hiện thêm thẻ **"Buổi tối qua — Anh 26/11 — còn thiếu N em"**, nằm trên thẻ của ngày mới.
- Ví dụ: 00:20 ngày 27/11, GV vẫn thấy và điểm danh được buổi Anh 26/11 (xem `diem-danh.md` Điều 4).
- Ca biên đổi tháng: 00:20 ngày 01/12 vẫn hiện "Buổi tối qua — Anh 30/11". Sau 06:00, buổi này chỉ còn trong mục việc "Buổi chưa điểm danh".

## Điều 3. Mục "Việc cần làm"

3.1. Việc xếp theo mức ưu tiên (1 là gấp nhất). Cùng một mức thì việc có ngày cũ hơn lên trước. Mỗi việc là một liên kết hoặc nút thật, bấm vào thì mở đúng chỗ cần sửa.

| Mức | Loại việc | Điều kiện hiện | Gộp | Ai thấy | Ví dụ 26/11 |
|---|---|---|---|---|---|
| 1 | Mất hồ sơ | Còn ghi danh mở nhưng không có hồ sơ học sinh. Sau khi chuyển dữ liệu, CSDL có khoá ngoại nên việc này chỉ còn là việc của lần chuyển. | theo em | chủ | 1 em, còn 4 ghi danh thử mở |
| 1 | Đơn chờ duyệt | Đơn có trạng thái Mới/Chờ duyệt. Nhận đơn tự động thuộc Đợt 4; Đợt 1 chỉ hiện các đơn chuyển từ sheet sang. | theo đơn | chủ | 1 đơn ("điền rất nhanh") |
| 2 | **Hết thử – hỏi em** | Lần ghi danh gần nhất toàn là Thử, đã hết hạn, chưa lên chính thức, chủ chưa bấm nghỉ, và em không còn ghi danh mở nào. | theo em | chủ | 0 |
| 3 | **Thử sắp hết** | Có ghi danh Thử với `hôm nay ≤ den_ngay ≤ hôm nay + 3` và em chưa có ghi danh Chính thức nào còn mở. Mỗi dòng hiện "còn N ngày". | theo em, nêu các môn | chủ | **33 em** (16 em hết 28/11, 17 em hết 29/11) |
| 4 | Học phí | Thuộc Đợt 3, chưa hiện. | | chủ | |
| 5 | **Buổi chưa điểm danh** | Buổi không huỷ, ngày nằm trong 14 ngày trước hôm nay, còn em chưa có bản ghi. | theo môn | chủ, cùng GV của môn đó | Toán 2 buổi (21/11, 24/11) · Địa 1 (20/11) · Anh 1 (23/11) · Sử 1 (25/11) |
| 5 | Em vắng nhiều | Em có từ 2 buổi Vắng trở lên trong tháng ở cùng một môn. | theo môn | chủ, cùng GV của môn đó | Sử: 34 em, nếu nhận 39 dấu chưa lưu của buổi 25/11; nếu không nhận thì 0 |
| 5 | Buổi thiếu record | Buổi đã điểm danh xong mà quá 24 giờ vẫn chưa có link record. | theo môn | chủ, cùng GV của môn đó | 5 buổi |
| 6 | Sửa dữ liệu | Gmail thiếu, sai hoặc nghi gõ nhầm; SĐT HS và SĐT PH đều sai; lứa trống; ghi danh chồng ngày (chỉ xảy ra khi chuyển dữ liệu, vì CSDL đã chặn). | theo em | chủ | 0 |

3.2. Ở mức 2 và mức 3, mỗi dòng có sẵn hai nút **"Lên chính thức"** và **"Gia hạn"** (cả hai chỉ chủ thấy, theo quyết định 16), cùng nút "Cho nghỉ".
- Ca biên đổi tháng: ngày 28/11, việc "Thử sắp hết" có 46 em: 16 em hết 28/11, 17 em hết 29/11, 13 em hết 30/11. Ngày 01/12, những em chưa được chủ xử lý chuyển sang mục "Hết thử – hỏi em".

3.3. **Đánh dấu xong:** chủ tick một việc thì việc đó ẩn đi. Việc học thử và học phí ẩn 3 ngày; các việc khác ẩn đến hết hôm nay, giống sheet. Khi điều kiện không còn đúng (ví dụ em đã lên chính thức) thì việc tự biến mất, không cần tick.

3.4. Em đã ẩn (Nghỉ/ẩn) không xuất hiện trong mọi việc, trừ việc mức 1.

## Điều 4. Thẻ số liệu (bấm vào thì mở danh sách đã lọc)

4.1. Danh sách thẻ và cách tính:

| Thẻ | Cách tính | Ví dụ 26/11 |
|---|---|---|
| Đang học chính thức | Số em có ghi danh Chính thức đang hiệu lực hôm nay. | 20 |
| Đang thử | Số em có ghi danh Thử đang hiệu lực, không tính em đã có Chính thức. | 50 |
| Thử hết trong 3 ngày | Như việc mức 3. | 33 |
| Lên chính thức tháng này | Số em có ngày Chính thức **đầu tiên** rơi vào tháng này. | 0 |
| Sĩ số theo môn hôm nay | Đếm theo `ghi-danh.md` Điều 11, tách chính thức và thử. | Toán 14 · 49, Sử 14 · 40, Địa 4 · 16, Anh 8 · 43 |
| Có mặt tháng này theo môn | Có/(Có + Phép + Vắng) trên các buổi đã có bản ghi. Sheet tính Phép là có mặt, xem `diem-danh.md` Câu hỏi 1. | Toán 59/59 = 100% · Sử 67/104 = 64% · Anh 68/86 = 79% · Địa chưa có buổi nào. Nếu nhận dấu của buổi Sử 25/11 thì Sử thành 82/158 = 52%. |

Số sĩ số theo môn ở ví dụ là đếm ngày 26/11. Ngày 29/11 các số này còn Toán 14 · 33, Sử 14 · 29, Địa 4 · 13, Anh 8 · 30, vì nhiều em hết thử ngày 28/11.

## Điều 5. Lịch 7 ngày tới

5.1. Hiện từ hôm nay đến hôm nay + 6. Mỗi ngày gồm: các buổi, trạng thái, sĩ số dự kiến của ngày đó (đếm theo ghi danh còn hiệu lực đúng ngày đó, nên đã trừ em sắp hết thử).
- Ví dụ: thẻ Sử CN 29/11 hiện 43 em, không phải 54 như buổi 25/11.

## Điều 6. Theo vai trò

6.1. **Chủ:** thấy toàn bộ màn hình.

6.2. **GV:**
- chỉ thấy thẻ "Lớp tối nay" và "Buổi tối qua" của **môn mình dạy**;
- chỉ thấy các việc mức 5 của môn mình;
- chỉ thấy thẻ sĩ số và có mặt của môn mình.

GV không thấy: đơn, học phí, hết thử hay thử sắp hết (xem Câu hỏi 2), SĐT phụ huynh, nút gia hạn hay lên chính thức. Căn cứ: quyết định 14 và 16.
- Ví dụ: GV chỉ dạy Anh (giả) mở màn lúc 22:00 ngày 26/11. GV thấy đúng một thẻ "Anh 22:15 · 51 em" và việc "Anh 1 buổi chưa điểm danh (23/11)", không thấy gì của Toán, Sử hay Địa.

6.3. Một người vừa là chủ vừa là GV thì thấy theo quyền chủ.

## Điều 7. Bố cục điện thoại (quyết định 21)

7.1. Dưới 640px chỉ có một cột, xếp theo thứ tự:
1. Lớp tối nay / Buổi tối qua;
2. Việc cần làm;
3. Thẻ số liệu;
4. Lịch 7 ngày.

Nút Điểm danh cao ít nhất 48px. Chi tiết giao diện để phòng Thiết kế viết.

## Điều 8. Làm mới số liệu

8.1. Số liệu lấy trực tiếp từ CSDL mỗi lần mở màn hoặc khi kéo xuống để làm mới, không chờ lượt làm mới định kỳ như sheet (10 phút một lần, và 20:30 mỗi tối).

## Khác sheet

| # | Sheet | Web mới |
|---|---|---|
| K1 | Có thẻ học phí, nhắc nợ và gửi phiếu. | Chưa có ở Đợt 1 (Đợt 3). |
| K2 | Có việc "Chào em mới" (email/Zalo). | Đợt 4. Cờ "Đã nhắn chào" vẫn chuyển sang nhưng chưa hiện. |
| K3 | "Lớp tối nay" mất ngay lúc 00:00. | Có thẻ "Buổi tối qua" đến 05:59, nếu chủ đồng ý ở Câu hỏi 1. |
| K4 | Không có việc em vắng nhiều hay buổi thiếu record. | Có thêm hai việc này ở mức 5. |
| K5 | Chỉ có một màn chung. | Có lọc theo vai trò GV. |

## Câu hỏi cho chủ

1. **Sau nửa đêm, buổi tối qua chưa điểm danh hiện đến mấy giờ?**
   - A. Đến 05:59 sáng, sau đó chuyển vào việc "Buổi chưa điểm danh". **(khuyên dùng)**
   - B. Như sheet: mất khỏi khối "Lớp tối nay" ngay lúc 00:00.
   - C. Hiện đến khi điểm danh xong, không giới hạn giờ.
2. **GV có thấy em thử sắp hết hoặc đã hết thử của môn mình không** (để GV tiện mời em học chính thức)?
   - A. Không, chỉ chủ thấy. **(khuyên dùng: theo thiết kế "chỉ chủ lớp")**
   - B. Có, nhưng chỉ xem, không có nút gia hạn hay lên chính thức.
