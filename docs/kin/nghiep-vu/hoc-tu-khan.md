# Học từ Khan: quy tắc cho phiếu phụ huynh và bảng giáo viên

Tài liệu này chốt cách tính cho năm việc NV-185, NV-186, NV-187, NV-188, NV-189 trong backlog,
để ai dựng (Apps Script hay app KiN) cũng ra cùng một con số. Lý do đằng sau từng quy
tắc nằm trong báo cáo *Học gì từ Khan Academy* (27/09/2026), mục 10.

**Số nào ghi "đề xuất" là số tạm.** Anh Thanh chốt lại trước khi dựng. Đổi số thì chỉ
sửa ở một chỗ (mục Tham số cuối file), không sửa công thức.

Thiết kế Figma, file *KiN Design System*:

- Phiếu tháng gửi phụ huynh: trang *👪 Trang phụ huynh*, khung *Phụ huynh — báo cáo tháng (nỗ lực tách năng lực)*, node `171:2`.
- Bảng phút luyện tập của giáo viên: trang *📚 Lớp & Thư viện*, khung *Lớp — phút luyện tập thật mỗi tuần*, node `172:2`.
- Chữa bài gợi ý trước, đáp án sau: trang *🧪 Phòng thi*, section `175:87`.

Tên và điểm trong các khung là **dữ liệu mẫu**, không phải học sinh thật.

---

## NV-186 · Hai thanh, không gộp

Trên phiếu gửi phụ huynh, mỗi môn có **hai thanh riêng**: Nỗ lực và Năng lực. Không
cộng hai thanh thành một con số, không hiện thứ hạng trên phiếu.

Lý do: một em chăm mà yếu và một em giỏi mà lười có thể ra cùng một điểm gộp. Hai
thanh nói được câu mà một con số không nói được: *"Con cố gắng tốt, kết quả chưa theo
kịp — đây là chỗ cần hỗ trợ."*

**Nỗ lực** (thang 10, làm tròn đến số nguyên):

```
Nỗ lực = 10 × ( 0,5 × Chuyên cần + 0,5 × Bài về nhà )

Chuyên cần  = (số buổi có mặt × 1 + số buổi muộn × 0,5) / số buổi của môn trong tháng   [đề xuất]
Bài về nhà  = số bài nộp đúng hạn / số bài đã giao trong tháng
```

Buổi gia sư huỷ hoặc dời không tính vào mẫu số. Tháng không giao bài về nhà thì
Nỗ lực = 10 × Chuyên cần.

**Năng lực**: xem NV-185.

Không đưa điểm kiểm tra vào Nỗ lực, không đưa chuyên cần vào Năng lực. Trọng số gộp
0,5 / 0,2 / 0,2 / 0,1 đang dùng để **xếp hạng** vẫn giữ nguyên cho phần vinh danh, chỉ
không hiện trên phiếu phụ huynh.

## NV-185 · Năng lực tính theo 3 bài gần nhất, có thể tụt

```
Năng lực môn = trung bình 3 bài kiểm tra gần nhất của môn đó
Đạt          = Năng lực môn ≥ NGƯỠNG_ĐẠT                                  [đề xuất 8,0]
```

- "Gần nhất" tính theo ngày làm bài, **không giới hạn trong tháng**. Bài tháng trước
  vẫn được tính nếu nó nằm trong 3 bài gần nhất.
- Bài em vắng không làm thì bỏ qua, lấy bài liền trước.
- Chưa đủ 3 bài: hiện các điểm đang có và nhãn "Chưa đủ 3 bài", không kết luận đạt
  hay chưa.
- Phiếu luôn in đủ 3 điểm thành phần (ví dụ `8,5 · 7,0 · 6,5`), để phụ huynh thấy
  xu hướng chứ không chỉ con số trung bình.

Nhãn trạng thái của môn, dùng màu trạng thái cố định (không đổi theo chủ đề):

| Trường hợp | Nhãn | Màu |
|---|---|---|
| Đạt ngưỡng | Đạt ngưỡng 8,0 | xong |
| Tháng trước đạt, tháng này dưới ngưỡng | Đang tụt · tháng 8 đã đạt | chờ |
| Chưa từng đạt | Chưa đạt ngưỡng | chờ |
| Chưa đủ 3 bài | Chưa đủ 3 bài | trung tính |

Không dùng màu đỏ cho năng lực của học sinh. Đỏ để dành cho lỗi hệ thống và tiền.

## NV-187 · Bảng giáo viên đo phút luyện tập, không đo lượt

Bảng của giáo viên hiện **số phút luyện tập thật mỗi tuần** của từng em.

```
Phút luyện tập tuần = tổng phút tự làm bài ngoài giờ lên lớp, thứ Hai đến Chủ nhật
```

- **Không đếm** phút trong buổi Meet (buổi nào cũng 90 phút, cộng vào là mọi em
  đều "đủ liều"). **Không đếm** đăng nhập, mở bài, xem video.
- Nguồn số phút:
  - Toán: báo cáo lớp trên Khan Academy tiếng Việt, gắn với thử nghiệm NV-190.
  - Sử, Địa, Anh: chưa có nguồn đo. Chờ bài làm trên KiN.
- **Không có nguồn thì để trống, không ghi 0.** Số 0 nghĩa là đã đo và em không luyện.

Ngưỡng, dựa trên thử nghiệm ngẫu nhiên NBER w32388 (2024) và khuyến nghị của Khan:

| Phút / tuần | Nhãn | Màu |
|---:|---|---|
| dưới 5 | Dưới 5 phút (0 phút: "Chưa luyện phút nào") | lỗi |
| 5 đến 29 | Dưới liều | chờ |
| từ 30 | Đủ liều | xong |

Bảng xếp **em ít phút nhất lên đầu**, vì đó là em giáo viên cần nhắc trước. Ba ô tổng
ở trên cùng phải cộng lại đúng bằng sĩ số lớp.

## NV-189 · Mục "Điều chưa đạt" cố định trên báo cáo tháng

Báo cáo tháng gửi phụ huynh **luôn có** mục *Điều chưa đạt tháng này*, kể cả khi
không có gì. Khi rỗng thì ghi: *"Tháng này không có mục nào chưa đạt."*

Hệ thống gợi ý sẵn các dòng sau, **gia sư đọc và sửa trước khi gửi**:

1. Môn đang tụt (NV-185), kèm hai điểm đầu và cuối trong 3 bài gần nhất.
2. Bài về nhà nộp dưới 70% trong tháng.                                  [đề xuất 70%]
3. Môn chưa đạt ngưỡng dù Nỗ lực từ 8 trở lên. Dòng này nói về **cách dạy**, không nói
   về học sinh.
4. Buổi gia sư dời hoặc huỷ trong tháng. Ghi rõ là lỗi sắp xếp của gia sư.

Lý do: Khan tự công bố chỉ 9% học sinh dùng đủ liều, và vì thế số liệu của họ được
tin. Phụ huynh tin một báo cáo có phần dở hơn một báo cáo toàn màu xanh.

## NV-188 · Gợi ý trước, đáp án sau, nhưng có điểm dừng

Thiết kế: trang *🧪 Phòng thi*, section *NV-188 · Chữa bài — gợi ý trước, đáp án sau*,
node `175:87`, ba khung cho ba trạng thái.

| Trạng thái | Học sinh thấy gì | Nút |
|---|---|---|
| Chưa nộp | Đề và 4 lựa chọn. Chưa có gợi ý, chưa có đáp án. | Nộp câu này |
| Nộp lần 1, sai | Ô đã chọn viền đỏ, chữ "Chưa đúng". Hiện **một gợi ý**, không hiện đáp án. | Thử lại · Xem đáp án |
| Nộp lần 2 vẫn sai, hoặc bấm "Xem đáp án" | Ô đúng viền xanh, ô sai viền đỏ, kèm lời giải. | Sang câu tiếp |

- Đúng ngay lần 1: hiện luôn lời giải, không hiện gợi ý.
- Điểm dừng là **hai lần nộp**. Khanmigo không bao giờ đưa đáp án nên học sinh bỏ dùng;
  KiN không lặp lại lỗi đó.
- Sau lời giải có ô không bắt buộc: *"Bạn thử viết lại một câu: gợi ý ở trên giúp bạn ở
  chỗ nào?"* Đây là khuyến nghị tự giải thích của Khan.
- Điểm bài kiểm tra (dùng cho NV-185) tính theo **lần nộp đầu**. Thử lại chỉ để học,
  không để gỡ điểm.
- Gợi ý do gia sư viết khi soạn câu hỏi. Câu nào chưa có gợi ý thì bỏ bước 2, hiện đáp án
  sau lần nộp đầu.

---

## Học bổng: để gia sư tự quyết

**NV-184 · Học bổng theo ngưỡng.** Anh Thanh chốt ngày 30/09: học bổng và giá là việc
của từng gia sư, KiN **chưa làm** tính năng này. Khung dưới đây chỉ giữ lại để tham khảo
nếu sau này làm, lấy từ báo cáo Khan, mục 10.1:

```
Thành thạo môn = Năng lực môn ≥ 8,0  VÀ  Chuyên cần ≥ 90%  VÀ  Bài về nhà ≥ 90%
→ giảm X% học phí môn đó, không giới hạn số em đạt
```

Nếu làm, gia sư tự đặt ngưỡng, mức giảm và kỳ tính; KiN chỉ tính ai đạt. Lưu ý: dùng
NV-185 làm "Năng lực môn" thì học bổng có thể mất khi tụt, cần báo trước cho phụ huynh.

---

## Tham số

| Tên | Giá trị | Trạng thái |
|---|---|---|
| NGƯỠNG_ĐẠT | 8,0 | đề xuất |
| SỐ_BÀI_GẦN_NHẤT | 3 | theo backlog NV-185 |
| HỆ_SỐ_MUỘN (Nỗ lực) | 0,5 | đề xuất |
| NGƯỠNG_PHÚT_ĐỎ | 5 phút/tuần | theo NBER w32388 |
| NGƯỠNG_PHÚT_ĐỦ | 30 phút/tuần | theo khuyến nghị Khan |
| NGƯỠNG_BTVN_CHƯA_ĐẠT | 70% | đề xuất |
