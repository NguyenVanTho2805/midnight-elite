# Biểu đồ cấu trúc tĩnh (Class Diagram · ERD)

> Nguồn: artifact "Sơ Đồ Cấu Trúc Tsix".

## 1. Class Diagram — mức khái niệm (logical view)

`User` là lớp cha, kế thừa xuống `Tutor / Student / Parent / Admin` để thể hiện đúng hành vi khác nhau của từng vai trò — điều mà cột `role` đơn lẻ trong DB không lột tả được.

```mermaid
classDiagram
  class User {
    +String id
    +String name
    +String email
    +String phone
    +Date createdAt
    +login()
    +updateProfile()
  }
  class Tutor {
    +String bio
    +String[] subjects
    +Boolean verified
    +openClass()
    +inviteStudent(inviteCode)
    +uploadDocument(file)
    +createAssignment(title, dueDate)
    +gradeSubmission(submission, score)
    +subscribeToPlan(plan)
  }
  class Student {
    +String school
    +String grade
    +joinClass(inviteCode)
    +submitAssignment(assignment)
    +viewDocument(doc)
  }
  class Parent {
    +confirmConsent(request)
    +viewChildProgress(student)
  }
  class Admin {
    +moderateContent(item)
    +reviewReport(report)
  }
  User <|-- Tutor
  User <|-- Student
  User <|-- Parent
  User <|-- Admin

  class ClassRoom {
    +String name
    +String subject
    +String inviteCode
    +generateInviteCode()
  }
  class ClassSchedule {
    +Int dayOfWeek
    +String startTime
    +String endTime
    +notifyUpcoming()
  }
  class Enrollment {
    +Date joinedAt
    +String status
  }
  class ParentConsent {
    +String status
    +Date decidedAt
  }
  class DocumentFolder {
    +String name
  }
  class Document {
    +String fileUrl
    +String rawType
    +Json normalizedContent
    +normalizeWithAI()
  }
  class Assignment {
    +String title
    +Date dueDate
    +Int maxScore
    +close()
  }
  class AssignmentSubmission {
    +Date submittedAt
    +Int score
    +grade(score, feedback)
  }
  class Plan {
    +String name
    +Int coinCostPerMonth
    +Int storageQuotaMb
    +Int maxStudents
  }
  class Subscription {
    +String status
    +Date startDate
    +Date endDate
    +activate()
    +renew()
    +cancel()
  }
  class Wallet {
    +Int balance
    +topUp(amountVnd)
    +earnCoin(amount, reason)
    +spendOnRenewal(cost)
    +redeemPerk(cost)
  }
  class CoinTransaction {
    +Int amount
    +String reason
    +Date createdAt
  }
  class Notification {
    +String channel
    +String message
    +send()
  }
  class CourseReview {
    +Int rating
    +String comment
  }

  Tutor "1" *-- "0..*" ClassRoom : sở hữu
  ClassRoom "1" o-- "0..*" ClassSchedule : có lịch
  ClassRoom "1" o-- "0..*" DocumentFolder : chứa
  DocumentFolder "1" *-- "0..*" Document : chứa tài liệu
  Tutor "1" -- "0..*" Document : upload
  ClassRoom "1" o-- "0..*" Assignment : giao bài
  Assignment "1" *-- "0..*" AssignmentSubmission : nhận bài nộp
  Student "1" -- "0..*" AssignmentSubmission : nộp
  Student "1" -- "0..*" Enrollment : tham gia
  ClassRoom "1" -- "0..*" Enrollment : có học viên
  Enrollment "0..1" -- "0..1" ParentConsent : cần xác nhận nếu vị thành niên
  Parent "1" -- "0..*" ParentConsent : xác nhận
  Parent "1" -- "0..*" Student : theo dõi con
  Tutor "1" -- "0..*" Subscription : đăng ký
  Subscription "0..*" -- "1" Plan : thuộc gói
  Subscription "0..*" -- "1" Wallet : trừ Coin khi gia hạn
  User "1" *-- "1" Wallet : sở hữu ví
  Wallet "1" *-- "0..*" CoinTransaction : lịch sử
  User "1" -- "0..*" Notification : nhận
  Student "1" -- "0..*" CourseReview : đánh giá
  ClassRoom "1" -- "0..*" CourseReview : được đánh giá
```

## 2. ERD — mức vật lý (khớp Prisma/Postgres sau migration đa-gia-sư)

So với schema hiện tại: đổi `Course.adminId` (1-1) thành `Course.tutorId` (N-1); gộp `ExamFileFolder/ExamFile` thành `DOCUMENT_FOLDER/DOCUMENT` tổng quát; thêm 5 bảng mới `PARENT_LINK`, `PARENT_CONSENT`, `PLAN`, `SUBSCRIPTION`, `PAYMENT_TRANSACTION`. Luồng tiền đi một chiều: `USER → PAYMENT_TRANSACTION → COIN_TRANSACTION(+) → WALLET`, sau đó `SUBSCRIPTION` chỉ *trừ* từ số dư `WALLET` khi gia hạn.

```mermaid
erDiagram
  USER ||--o{ COURSE : "so huu (tutorId)"
  USER ||--o{ ENROLLMENT : "tham gia (userId)"
  COURSE ||--o{ ENROLLMENT : "co hoc vien"
  COURSE ||--o{ CLASS_SCHEDULE : "co lich"
  COURSE ||--o{ DOCUMENT_FOLDER : "chua thu muc"
  DOCUMENT_FOLDER ||--o{ DOCUMENT : "chua tai lieu"
  USER ||--o{ DOCUMENT : "upload (uploaderId)"
  COURSE ||--o{ ASSIGNMENT : "giao bai"
  ASSIGNMENT ||--o{ ASSIGNMENT_SUBMISSION : "nhan bai nop"
  USER ||--o{ ASSIGNMENT_SUBMISSION : "nop bai (studentId)"
  USER ||--o{ PARENT_LINK : "la phu huynh (parentUserId)"
  USER ||--o{ PARENT_LINK : "duoc lien ket (studentUserId)"
  USER ||--o{ PARENT_CONSENT : "xac nhan (parentUserId)"
  ENROLLMENT ||--o| PARENT_CONSENT : "can xac nhan"
  USER ||--o{ SUBSCRIPTION : "dang ky (tutorId)"
  PLAN ||--o{ SUBSCRIPTION : "thuoc goi"
  USER ||--o{ PAYMENT_TRANSACTION : "nap coin (userId)"
  USER ||--|| WALLET : "so huu vi"
  WALLET ||--o{ COIN_TRANSACTION : "lich su coin"
  USER ||--o{ NOTIFICATION : "nhan thong bao"
  COURSE ||--o{ THREAD : "co dien dan"
  USER ||--o{ THREAD : "dang bai (authorId)"
  THREAD ||--o{ THREAD_REPLY : "co tra loi"
  USER ||--o{ THREAD_REPLY : "tra loi (authorId)"
  COURSE ||--o{ COURSE_REVIEW : "duoc danh gia"
  USER ||--o{ COURSE_REVIEW : "danh gia (studentId)"

  USER {
    string id PK
    string name
    string email UK
    string role "student | tutor | parent | admin"
    string phone
    datetime createdAt
  }
  COURSE {
    string id PK
    string tutorId FK
    string name
    string subject
    string inviteCode UK
    datetime createdAt
  }
  CLASS_SCHEDULE {
    string id PK
    string courseId FK
    int dayOfWeek
    string startTime
    string endTime
  }
  ENROLLMENT {
    string id PK
    string userId FK
    string courseId FK
    string status
    datetime joinedAt
  }
  PARENT_LINK {
    string id PK
    string parentUserId FK
    string studentUserId FK
    string relation
  }
  PARENT_CONSENT {
    string id PK
    string enrollmentId FK
    string parentUserId FK
    string status
    datetime decidedAt
  }
  DOCUMENT_FOLDER {
    string id PK
    string courseId FK
    string name
  }
  DOCUMENT {
    string id PK
    string folderId FK
    string uploaderId FK
    string fileUrl
    string rawType
    json normalizedContent
    datetime createdAt
  }
  ASSIGNMENT {
    string id PK
    string courseId FK
    string title
    datetime dueDate
    int maxScore
  }
  ASSIGNMENT_SUBMISSION {
    string id PK
    string assignmentId FK
    string studentId FK
    datetime submittedAt
    int score
  }
  PLAN {
    string id PK
    string name
    int coinCostPerMonth
    int storageQuotaMb
    int maxStudents
  }
  SUBSCRIPTION {
    string id PK
    string tutorId FK
    string planId FK
    string status
    datetime startDate
    datetime endDate
  }
  PAYMENT_TRANSACTION {
    string id PK
    string userId FK
    int amountVnd
    string gateway
    string status "PENDING | SUCCESS | FAILED"
    datetime paidAt
  }
  WALLET {
    string userId PK
    int balance
  }
  COIN_TRANSACTION {
    string id PK
    string userId FK
    int amount
    string reason "topup | class_renewal | activity_reward"
    string refId "PAYMENT_TRANSACTION.id hoac SUBSCRIPTION.id"
    datetime createdAt
  }
  NOTIFICATION {
    string id PK
    string userId FK
    string channel
    string message
    datetime sentAt
  }
  THREAD {
    string id PK
    string courseId FK
    string authorId FK
    string title
  }
  THREAD_REPLY {
    string id PK
    string threadId FK
    string authorId FK
  }
  COURSE_REVIEW {
    string id PK
    string courseId FK
    string studentId FK
    int rating
  }
```
