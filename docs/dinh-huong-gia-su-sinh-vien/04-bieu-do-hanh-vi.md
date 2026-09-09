# Biểu đồ hành vi (Use Case · Activity · Sequence)

> Nguồn: artifact "Sơ Đồ Hành Vi Tsix". GitHub render mermaid trực tiếp trong file .md này.

## 1. Use Case — tổng quan hệ thống

5 tác nhân (Gia sư, Học viên, Phụ huynh, Admin nền tảng, Cổng thanh toán) và 20 use case chính. Hai quan hệ `<<include>>` mã hoá đúng quy tắc nghiệp vụ: mời học viên dưới 16 tuổi luôn kéo theo xin phép phụ huynh, và upload tài liệu luôn đi qua AI chuẩn hoá. Quan hệ `<<extend>>` thể hiện: nạp Coin có thể dẫn tới dùng Coin đăng ký lớp.

```mermaid
flowchart LR
  GS["🧑‍🏫 Gia sư (sinh viên)"]
  HV["🧑‍🎓 Học viên"]
  PH["👪 Phụ huynh"]
  ADMIN["🛡️ Admin nền tảng"]
  PAY(["💳 Cổng thanh toán VN"])

  subgraph SYS["HỆ THỐNG TSIX"]
    UC1(["Đăng ký tài khoản gia sư"])
    UC2(["Mở lớp học"])
    UC3(["Mời học viên vào lớp"])
    UC4(["Xác nhận đồng ý của phụ huynh"])
    UC5(["Upload tài liệu dạy học"])
    UC6(["AI chuẩn hoá tài liệu"])
    UC7(["Xem / tải tài liệu"])
    UC8(["Tạo và xem lịch dạy"])
    UC9(["Điểm danh buổi học"])
    UC10(["Giao bài tập"])
    UC11(["Nộp bài tập"])
    UC12(["Chấm điểm"])
    UC13(["Theo dõi tiến độ của con"])
    UC14(["Nhận thông báo"])
    UC15(["Nạp Coin bằng tiền thật"])
    UC15b(["Dùng Coin đăng ký / gia hạn lớp"])
    UC16(["Kiếm Coin thưởng qua hoạt động"])
    UC17(["Tham gia diễn đàn"])
    UC18(["Đánh giá gia sư"])
    UC19(["Kiểm duyệt và quản trị nền tảng"])
  end

  GS --> UC1
  GS --> UC2
  GS --> UC3
  GS --> UC5
  GS --> UC8
  GS --> UC9
  GS --> UC10
  GS --> UC12
  GS --> UC15
  GS --> UC15b
  GS --> UC17

  HV --> UC3
  HV --> UC7
  HV --> UC11
  HV --> UC14
  HV --> UC16
  HV --> UC17
  HV --> UC18

  PH --> UC4
  PH --> UC13
  PH --> UC14

  ADMIN --> UC19
  PAY --- UC15

  UC3 -.->|"«include»"| UC4
  UC5 -.->|"«include»"| UC6
  UC12 -.->|"«include»"| UC14
  UC15 -.->|"«extend»"| UC15b
```

## 2. Activity — Mời học viên vào lớp (nhánh consent phụ huynh)

Luồng chứa nhánh rẽ pháp lý quan trọng nhất: kiểm tra tuổi học viên, dưới 16 bắt buộc rẽ sang xin phép phụ huynh (Nghị định 13/2023/NĐ-CP + Luật Trẻ em 2016) trước khi kích hoạt Enrollment.

```mermaid
flowchart TD
  start((●)) --> A1

  subgraph LANE1["LÀN: GIA SƯ"]
    A1["Đăng nhập / mở lớp học"]
    A2["Tạo mã mời hoặc link mời"]
  end

  subgraph LANE3["LÀN: HỌC VIÊN / PHỤ HUYNH"]
    C1["Học viên mở link mời và điền hồ sơ"]
    C2["Phụ huynh nhận yêu cầu xác nhận"]
    C3{"Phụ huynh đồng ý?"}
  end

  subgraph LANE2["LÀN: HỆ THỐNG"]
    B1{"Học viên từ 16 tuổi trở lên?"}
    B2["Gửi yêu cầu xác nhận tới phụ huynh"]
    B3["Kích hoạt học viên vào lớp"]
    B4["Ghi log và thông báo cho gia sư"]
  end

  A1 --> A2 --> C1 --> B1
  B1 -->|"Có"| B3
  B1 -->|"Chưa đủ 16"| B2
  B2 --> C2 --> C3
  C3 -->|"Đồng ý"| B3
  C3 -->|"Từ chối"| ReEnd((◉))
  B3 --> B4 --> End((◉))
```

## 3a. Sequence — Upload tài liệu và AI tự chuẩn hoá

```mermaid
sequenceDiagram
  autonumber
  actor GS as Gia sư (Client)
  participant API as API (Next.js)
  participant STORE as Cloudinary (lưu file)
  participant AI as AI Engine (Gemini)
  participant DB as Database (Postgres)

  GS->>API: Upload tài liệu (PDF / ảnh / Word)
  API->>STORE: Lưu file gốc
  STORE-->>API: Trả về URL file
  API->>AI: Gửi nội dung để phân tích và chuẩn hoá
  AI-->>API: Trả về cấu trúc chuẩn hoá (đề mục / câu hỏi / đáp án)
  API->>DB: Lưu Document kèm cấu trúc đã chuẩn hoá
  DB-->>API: Xác nhận lưu thành công
  API-->>GS: Hiển thị tài liệu đã sắp xếp gọn gàng
```

## 3b. Sequence — Nạp Coin bằng tiền thật và dùng Coin đăng ký / gia hạn lớp

Coin ở đây là số dư trả trước cho dịch vụ của chính Tsix (gia sư tự nạp, tự tiêu) — không phải ví trung gian giữ tiền giữa hai người dùng, nên không vướng quy định về trung gian thanh toán của Ngân hàng Nhà nước.

```mermaid
sequenceDiagram
  autonumber
  actor GS as Gia sư (Client)
  participant API as API (Next.js)
  participant PAY as Cổng thanh toán (PayOS / VNPay)
  participant DB as Database (Postgres)

  Note over GS,DB: Bước 1 — Nạp Coin bằng tiền thật
  GS->>API: Chọn mệnh giá nạp và bấm Thanh toán
  API->>DB: Tạo giao dịch nạp (trạng thái PENDING)
  API->>PAY: Yêu cầu tạo mã thanh toán (QR / link)
  PAY-->>API: Trả về mã thanh toán
  API-->>GS: Hiển thị QR hoặc link thanh toán
  GS->>PAY: Quét mã và thanh toán qua app ngân hàng
  PAY->>API: Webhook báo giao dịch thành công
  API->>DB: Ghi nhận giao dịch nạp SUCCESS và cộng Coin vào Wallet
  DB-->>API: Xác nhận số dư Coin mới
  API-->>GS: Hiển thị số dư Coin đã cập nhật

  Note over GS,DB: Bước 2 — Dùng Coin đăng ký / gia hạn lớp (không qua cổng thanh toán nữa)
  GS->>API: Bấm "Đăng ký / gia hạn lớp"
  API->>DB: Kiểm tra số dư Coin có đủ theo gói không?
  alt Đủ Coin
    API->>DB: Trừ Coin trong Wallet, ghi CoinTransaction (reason=class_renewal)
    API->>DB: Cập nhật trạng thái lớp học sang ACTIVE
    API-->>GS: Thông báo "Lớp đã được gia hạn"
  else Không đủ Coin
    API-->>GS: Yêu cầu nạp thêm Coin (quay lại Bước 1)
  end
```
