# Quyết định đã chốt, và đối chiếu với kho đang chạy

Cập nhật 26/09/2026. Thay thế phần "Đừng tự quyết" trong `CLAUDE-cho-kho-trien-khai.md`.

Tài liệu này viết sau khi **đọc `prisma/schema.prisma` thật** của kho này và mở
web đang chạy tại https://midnightelite-edu.com — nên nó sửa vài chỗ sai trong
bản tài liệu giao ngày 24/09.

---

## 1. Bốn quyết định anh Thanh đã chốt

### 1. Không chờ chốt hết mới làm

Cái nào hợp lý thì làm, sai thì sửa sau. Toàn bộ 13 quyết định trong
`backlog/quyet-dinh.csv` **lấy theo cột "Đề xuất"** làm mặc định.

Kết quả: **0 việc còn bị chặn.** Trước đó 52 việc treo chờ quyết định.

Ngoại lệ duy nhất — hai quyết định đổi hình dạng bảng dữ liệu, sửa sau đắt hơn
sửa trước nhiều:

| | Chốt theo đề xuất | Vì sao đừng đổi ý muộn |
|---|---|---|
| **D02** một gia sư một lớp | **Một.** Hoãn đồng dạy. | Cho đồng dạy sau chỉ cần thêm bảng nối. Bỏ đồng dạy sau thì phải gỡ dữ liệu đã lỡ tạo. |
| **D08** đánh giá theo lớp hay gia sư | **Thu theo lớp, hiển thị theo gia sư.** | Thu theo gia sư rồi muốn tách theo lớp thì không tách ngược được. |

### 2. Bỏ Coin khỏi phạm vi

Chưa thu lợi nhuận. KiN đứng ở vai **cầu nối, chưa thu phí**.

**Quan trọng: "bỏ Coin" nghĩa là ĐỪNG ĐỘNG VÀO, không phải xoá đi.**

Kho này đã có sẵn hệ Coin đang chạy thật, nhưng nó **không phải** để mua khoá học.
`Wallet.balance`, `CoinTransaction.reason` nhận các giá trị `signup_bonus`,
`question_cost`, `answer_reward`, `report_penalty`. `Question.bountyPaid` là xu
mất khi đặt câu hỏi, `Answer.rewardPaid` là xu nhận khi được chấp nhận.

Đây là **Knowledge Bounty** cho module Hỏi Đáp. Nó đang chạy, người dùng đang có
số dư thật. Giữ nguyên.

Cái bị hoãn là việc **mở rộng** Coin sang mua gói lớp, gồm 15 việc:
`BE-033` đến `BE-039`, `BE-059`, `BE-080`, `FE-121`, `FE-122`, `FE-124`, `FE-128`,
`FE-137`, `FE-150`.

Hoãn cả cụm này giải quyết luôn hai vấn đề mà bản tài liệu 24/09 nêu:

**Mâu thuẫn "ai trả Coin" biến mất.** Định hướng nói KiN không giữ học phí;
backlog lại cho học viên tiêu Coin mua gói. Không làm cụm đó thì hết mâu thuẫn.

**Vách doanh thu biến mất.** `BE-039` định set `sourceType = null` cho mọi giao
dịch cũ, `BE-074` lại lọc theo `sourceType` — ghép lại là báo cáo doanh thu tụt
về 0. Không chạy `BE-039` thì không có migration, không có vách. `BE-077` cũng
không còn gấp.

### 3. Kho này là nơi triển khai

kin-app chỉ là kho tham chiếu. Mọi thứ đưa về đây, anh Thọ đẩy lên
https://midnightelite-edu.com

### 4. Chưa cần luật sư

Chưa thu tiền, quy mô nhỏ. Bỏ khỏi đường găng.

Một điểm kỹ thuật, không phải pháp lý: **xin phép phụ huynh cho trẻ dưới 16 nên
dựng cột từ bây giờ dù chưa dùng.** Thêm hai cột vào `User` hoặc `Enrollment` lúc
chưa có dữ liệu là một dòng migration. Thêm sau khi đã có vài nghìn học viên thì
phải đi hỏi ngược từng người. Rẻ trước, đắt sau.

---

## 2. Ba chỗ tài liệu 24/09 nói sai

Đọc schema thật mới biết. Sửa lại:

| Bản 24/09 nói | Thực tế trong `schema.prisma` |
|---|---|
| `Enrollment.status = "pending_consent"` | `Enrollment` **không có** cột `status`. Chỉ có `id`, `userId`, `courseId`, `createdAt`. |
| "Hiện mới có `ParentConsent`" | **Không tồn tại** model nào tên `ParentConsent`. Chỉ có `User.parentPhone` và `User.parentName` — hai cột text, không có dấu vết đồng ý. |
| "Coin cho học viên mua gói lớp" | Coin đang chạy là **Knowledge Bounty** cho Hỏi Đáp, không dính gì tới mua khoá. |

---

## 3. Kho này đã có gì, còn thiếu gì

Đây là thứ đáng đọc nhất trước khi code.

### Đã có, khá chắc — đừng dựng lại

| Mảng | Model |
|---|---|
| Khoá học | `Course` › `Section` › `Chapter` › `Lesson` |
| **Lịch học lặp tuần** | `ClassSchedule` — quy luật lặp, `/api/schedule` tự tính buổi sắp tới |
| Bài tập | `Assignment`, `AssignmentSubmission`, `AssignmentQuestion` — có chế độ làm trực tiếp trên web, AI trích câu từ file |
| Thi thử | `Exam`, `ExamAttempt`, `ExamAnswer`, `ExamAnswerBoolean` — giờ riêng từng Phần đúng kiểu ĐGNL HSA, đếm thoát tab, khoá xem đáp án, bảng xếp hạng |
| Ngân hàng câu hỏi | `QuestionBankItem` + `QuestionCategory` cây nhiều tầng, tra trùng 3 cấp gồm vector embedding 768 chiều |
| Cộng đồng | `Thread`, `ThreadReply`, `ThreadLike`, `ThreadBookmark`, `ThreadReport` — có soft-delete và báo cáo vi phạm |
| Hỏi đáp có thưởng | `Question`, `Answer`, `AnswerReport` |
| Tiến độ học | `LessonProgress`, `LessonNote` |

Hai hệ quả cho đặc tả thiết kế đã giao:

- Module **Lịch** trong `thiet-ke/bo-cuc-outlook.md` dựng thẳng trên `ClassSchedule`, không cần bảng mới.
- Khu **cộng đồng** trong `thiet-ke/cong-dong.md` dựng trên `Thread` sẵn có, không cần bảng mới.

### Chưa có — đây là phần lõi của KiN

| Thiếu | Vì sao cần |
|---|---|
| **Điểm danh** | Không có model nào cho buổi học cụ thể và ai có mặt. `ClassSchedule` chỉ là quy luật lặp, không sinh bản ghi từng buổi. |
| **Phụ huynh xác nhận buổi** | Không có. Đây là lõi sản phẩm: chỉ buổi phụ huynh đã xác nhận mới được tính tiền. |
| **Học phí** | Không có model nào cho tiền. Không có VietQR. |
| **Lời mời lớp** | Không có `ClassInvite`. `Enrollment` tạo thẳng, không qua bước mời. |
| **Dấu vết đồng ý của phụ huynh** | Không có. |

Bốn thứ này là toàn bộ nội dung của `kin-app`. Mô hình đã chạy thật ở `db/schema.sql`
của kho đó: `classes` › `students` › `sessions` › `attendances`, cộng `payments`.

### Hai chỗ đang trùng nhau trong chính kho này

**Hai hệ cộng đồng song song.** `Thread` (dòng thời gian, `category="hoi-dap"`) và
`Question`/`Answer` (hỏi đáp có thưởng xu) làm gần cùng một việc. Không gấp, nhưng
nên chốt giữ cái nào trước khi xây thêm lên trên.

**Bài tập có hai đường.** `Lesson.azotaUrl` (link Azota ngoài) và `Assignment` (nộp
trên nền tảng). Ghi chú trong schema nói là song song, không thay thế — có chủ đích.

---

## 4. Chữ trên web đang chạy không phải là mô hình kinh doanh

**Đính chính bản 25/09.** Bản trước của mục này viết rằng KiN và web đang chạy đi
theo hai mô hình kinh doanh mâu thuẫn nhau. Điều đó **sai**, và sai vì tôi đọc chữ
quảng cáo trên trang chủ rồi coi đó là mô hình thật.

Anh Thanh đã nói rõ:

- **"Mua 1 lần, học trọn đời"** là chữ đặt tạm trên trang, không phải cách bán thật.
- **"1.200+ học viên"** cũng không phải số thật. Hiện tại có **25 học sinh**, và là
  học sinh anh Thanh kèm gia sư.
- Hướng đi là **mô hình KiN**. Midnight Elite là thứ đang chạy tạm, không phải đích
  đến lâu dài.

Nên **không có hai mô hình để phải chọn giữa**. Chỉ có một: hạ tầng cho người dạy,
gia sư sở hữu lớp của mình, KiN không giữ học phí, quy mô ngách 1–20 học sinh một lớp.

### Cái vẫn còn giá trị sau khi đính chính

Câu hỏi kỹ thuật bên dưới vẫn đứng, chỉ là nó không còn là câu hỏi mở nữa mà đã có
câu trả lời: **`Course` thuộc về gia sư, không thuộc về trung tâm.** Kho này đã đi
đúng hướng đó rồi — `Course.ownerId` có sẵn, kèm comment *"null = nội dung cũ/của
quản lý trung tâm"*. Tức là phần nội dung `ownerId = null` là di sản, không phải
hình mẫu để nhân bản.

Việc cần làm, ngắn gọn: mọi thứ tạo mới từ nay đều có `ownerId` trỏ về một gia sư
thật, và đừng viết thêm code nào giả định `ownerId = null` là trạng thái bình thường.

### Bài học tôi rút ra, để anh Thọ khỏi vấp lại

Con số trên trang tiếp thị không phải dữ liệu. Ở giai đoạn này gần như mọi con số
hiển thị ra ngoài đều là chữ đặt tạm. Cần số thật thì đếm trong cơ sở dữ liệu, hoặc
hỏi anh Thanh — đừng đọc trang chủ.

---

## 5. Tên gọi

Tài liệu dùng **KiN**. Web đang chạy vẫn là **Midnight Elite**, tên miền
`midnightelite-edu.com`.

Định hướng 23/09 nói từ nay gọi là KiN. Việc đổi tên trên sản phẩm chưa làm và
chưa nằm trong backlog. Cứ code trước, đổi tên là việc riêng.
