# Đặc tả khu cộng đồng và học thử

Bản giao cho người code. Cập nhật 24/09/2026.
Bản dựng đối chiếu: `../nguyen-mau/04-hoc-thu.html`.

---

## 1. Khu cộng đồng để làm gì

Không phải để "có cộng đồng cho vui". Nó là **kênh lấy học sinh**:

> Học sinh lạ đặt câu hỏi → gia sư trả lời → học sinh thấy người này dạy được →
> mời học thử → thành học sinh thật.

Ba điều làm nó chạy được, thiếu một là hỏng:

1. **Hỏi không cần tài khoản.** Bắt đăng ký trước khi hỏi là giết luồng ngay đầu vào.
2. **Câu trả lời có danh tính.** Gia sư trả lời bằng tên thật và hồ sơ thật, vì thứ
   họ đổi lấy công sức là **uy tín nhìn thấy được**.
3. **Có đường đi từ câu trả lời sang lớp học.** Không có nó thì gia sư trả lời vài
   lần rồi thôi.

**Điều không được làm:** tin nhắn riêng giữa học sinh với học sinh. Diễn đàn công khai
thì kiểm duyệt được và có uy tín đi kèm; hộp thư riêng giữa trẻ vị thành niên thì không
kiểm được, và KiN chịu trách nhiệm.

---

## 2. Luồng hỏi đáp

| Bước | Ai | Cần tài khoản |
|---|---|---|
| Đặt câu hỏi | bất kỳ ai | **không** — chỉ cần tên hiển thị |
| Trả lời | gia sư đã xác minh | có |
| Bình chọn câu trả lời | người hỏi + người đã đăng nhập | người hỏi thì không |
| Mời học thử | gia sư đã trả lời câu hỏi đó | có |

Chỉ gia sư **đã trả lời** câu hỏi đó mới mời được. Ai cũng mời được thì khu hỏi đáp
biến thành chỗ chào mời, và người hỏi sẽ bỏ đi.

### Kiểm duyệt

Câu hỏi từ người chưa có tài khoản vào **hàng chờ kiểm duyệt** (module Kiểm duyệt của
quản trị, badge đỏ). Không đăng thẳng.

| Tín hiệu | Xử lý |
|---|---|
| Có số điện thoại hoặc liên kết ngoài | giữ lại, chờ người duyệt |
| Người hỏi nói mình dưới 13 tuổi | không đăng, hiện lời nhắn nhờ người lớn giúp |
| Trùng câu hỏi đã có | gợi ý câu cũ trước khi cho gửi |

---

## 3. Thẻ thoả thuận học thử

Thứ quan trọng nhất trong toàn bộ luồng. **Thương lượng diễn ra bên trong thẻ, không
phải trong bình luận.** Đẩy sang chat thì không ai biết cuối cùng hai bên chốt cái gì —
và khi có tranh cãi thì KiN không có gì trong tay.

Thẻ có đúng sáu dòng:

| Dòng | Ví dụ |
|---|---|
| Môn | Toán 9 |
| Thời lượng | 90 phút |
| Hình thức | Tại nhà học sinh |
| Thời gian | Thứ 7, 27/09 · 15:00 |
| Buổi thử | Miễn phí |
| Học phí nếu học tiếp | 150.000đ/buổi |

Dòng vừa bị đề nghị đổi thì **tô sáng** (`.kv.hl`) để hai bên thấy ngay khác biệt ở đâu.
Sau khi chốt, thêm dòng thứ bảy: **"Đã khoá, không sửa một phía"** màu `--green`.

---

## 4. Máy trạng thái sáu bước

Cột "Phụ huynh" đáng đọc nhất — **ba bước đầu phụ huynh không thấy gì, và đó là cố ý.**

| Bước | Tên | Gia sư thấy | Học sinh thấy | Phụ huynh thấy |
|---|---|---|---|---|
| 1 | Gia sư mời | "Đang chờ trả lời" + rút lại lời mời | Lời mời + Đồng ý / Đổi giờ / Từ chối | **không gì** |
| 2 | Học sinh xin đổi giờ | Giờ đề nghị được tô sáng + Đồng ý đổi | "Đang chờ thầy trả lời" | **không gì** |
| 3 | Chờ phụ huynh | "Buổi thử **chưa được chốt**" | "Còn một bước nữa" | **Lần đầu hiện** — xác nhận cho con |
| 4 | Đã chốt | Thẻ khoá, vào lịch cả ba bên | Thẻ khoá | Thẻ khoá |
| 5 | Học xong, hỏi cả ba | Đánh giá | Đánh giá | Đánh giá |
| 6 | Thành học sinh thật | Học sinh vào lớp chính thức | Vào lớp | Sổ học + học phí bật lên |

**Vì sao giấu phụ huynh ba bước đầu.** Làm phiền phụ huynh trước khi con họ tỏ ra quan
tâm là cách nhanh nhất để bị chặn. Người lớn chỉ được gọi vào khi đã có việc thật cần
quyết. Nhưng đến bước 3 thì **bắt buộc** — học sinh 15 tuổi không tự ký một thoả thuận
thương mại được, và người trả tiền là phụ huynh. Bỏ bước này thì buổi thử vẫn diễn ra,
nhưng KiN không có gì trong tay khi có chuyện.

### Hết hạn

Bước 3 gửi Zalo cho phụ huynh. **Im lặng 24 giờ → nhắc lại một lần → huỷ lời mời.**
Không nhắc vô hạn.

### Chặn lạm dụng

Gia sư có hạn mức lời mời đang chờ (bản dựng để **5**). Học sinh có hạn mức buổi thử
miễn phí mỗi tháng (bản dựng để **2**). Không có hạn mức thì mục này thành kênh spam
trong một tuần.

---

## 5. Thông tin cá nhân — lộ khi nào

Đây là phần dễ làm sai nhất.

| Thông tin | Trước bước 4 | Sau bước 4 (đã chốt) |
|---|---|---|
| Tên hiển thị học sinh | hiện | hiện |
| Tên thật đầy đủ | **ẩn** | hiện cho gia sư |
| Số điện thoại phụ huynh | **ẩn** | hiện cho gia sư |
| Địa chỉ học | **ẩn** | hiện cho gia sư |
| Tên và hồ sơ gia sư | hiện | hiện |

**Địa chỉ và số điện thoại chỉ lộ sau khi phụ huynh đã đồng ý.** Không sớm hơn một bước
nào. Học sinh dưới 16 mà địa chỉ nhà lộ trước khi người lớn kịp nói gì là chuyện không
sửa lại được.

Hồ sơ gia sư hiện từ đầu vì đó là thứ người hỏi dùng để quyết định — bất đối xứng này
là cố ý.

---

## 6. Đối chiếu pháp lý

Căn cứ để **hỏi luật sư**, không phải ý kiến pháp lý.

| Văn bản | Chạm vào đâu |
|---|---|
| Luật Trẻ em 2016 | người dùng dưới 16 |
| Nghị định 13/2023 | cần đồng ý của **cả** trẻ từ 7 tuổi **và** người giám hộ |
| Thông tư 29/2024/TT-BGDĐT | công khai môn học, lịch, mức phí |

Nghị định 13/2023 là chỗ cần chú ý: **đồng ý kép**. Bảng `ParentConsent` hiện chỉ có
một phía. Phải có cột riêng cho từng bên, không gộp một cờ.

---

## 7. Sáu quyết định còn treo

Đã liệt kê đầy đủ trong `../nguyen-mau/05-quyet-dinh.html`. Bốn cái chặn phần này:

1. Học sinh chưa có tài khoản hỏi được không, hay bắt đăng ký trước
2. Hạn mức lời mời và buổi thử miễn phí đặt bao nhiêu
3. Gia sư chưa xác minh có được trả lời công khai không
4. Buổi thử không thành thì hồ sơ gia sư có bị trừ điểm không

Đừng đoán. Bốn câu này quyết định luôn hình dạng bảng dữ liệu.
