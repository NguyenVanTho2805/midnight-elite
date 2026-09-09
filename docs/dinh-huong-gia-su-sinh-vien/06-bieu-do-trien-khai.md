# Biểu đồ kiến trúc & triển khai (Component · Deployment)

> Nguồn: artifact "Sơ Đồ Triển Khai Tsix".

## 1. Component Diagram

Next.js monolith — không tách microservice. `Nạp Coin & Thanh toán` chỉ chạm cổng thanh toán ở bước nạp; `Coin, Thưởng & Đăng ký lớp` xử lý nội bộ toàn bộ phần dùng Coin.

```mermaid
flowchart TB
  CLIENT["«device»<br/>Trình duyệt (Gia sư / Học viên / Phụ huynh)"]
  PAGES["«component»<br/>App Router Pages (SSR/RSC)"]

  subgraph CORE["HỆ THỐNG TSIX — Next.js monolith"]
    direction TB
    M_AUTH["«component»<br/>Auth & IAM<br/>session.ts · permissions.ts · proxy.ts"]
    M_CLASS["«component»<br/>Quản lý lớp đa-gia-sư<br/>Course · Enrollment · ClassSchedule"]
    M_DOC["«component»<br/>Tài liệu & AI chuẩn hoá<br/>aiExamImport.ts · pdfRaster.ts"]
    M_ASSIGN["«component»<br/>Bài tập & Chấm điểm<br/>examGrading.ts"]
    M_BILL["«component»<br/>Nạp Coin & Thanh toán<br/>(module mới)"]
    M_WALLET["«component»<br/>Coin, Thưởng & Đăng ký lớp<br/>wallet.ts (closed-loop)"]
    M_NOTI["«component»<br/>Thông báo<br/>notify.ts"]
    M_COMM["«component»<br/>Cộng đồng<br/>Thread/ThreadReply"]
    CRON["«component»<br/>Vercel Cron<br/>remind-class · remind-exam"]
  end

  DB[("«component»<br/>Prisma Client")]

  EXT_CLOUD["Cloudinary"]
  EXT_AI["Google Gemini API"]
  EXT_PAY["Cổng thanh toán VN"]
  EXT_MAIL["SMTP Provider"]
  EXT_ZALO["Zalo OA API (P1)"]

  CLIENT --> PAGES
  PAGES --> M_AUTH & M_CLASS & M_DOC & M_ASSIGN & M_BILL & M_WALLET & M_NOTI & M_COMM

  M_AUTH & M_CLASS & M_DOC & M_ASSIGN & M_BILL & M_WALLET & M_NOTI & M_COMM --> DB

  CRON --> M_NOTI
  CRON --> M_WALLET

  M_BILL -- "«cộng Coin sau khi nạp thành công»" --> M_WALLET

  M_DOC -- "«Cloudinary SDK»" --> EXT_CLOUD
  M_DOC -- "«Gemini API»" --> EXT_AI
  M_BILL -- "«Webhook/REST»" --> EXT_PAY
  M_NOTI -- "«SMTP»" --> EXT_MAIL
  M_NOTI -. "«Zalo OA API»" .-> EXT_ZALO
```

## 2. Deployment Diagram

Chỉ 2 node do Tsix vận hành thật (Vercel serverless + Neon Postgres serverless); còn lại là SaaS bên thứ ba. Cố tình **không** dùng Kafka/Redis/MongoDB như tài liệu kiến trúc cũ trong `files/06_quan_tri_lop.md` — quy mô MVP sinh viên gia sư chưa cần.

```mermaid
flowchart TB
  subgraph N0["THIẾT BỊ NGƯỜI DÙNG «device»"]
    BROWSER["Trình duyệt / PWA"]
  end

  subgraph N1["VERCEL — EDGE & SERVERLESS «execution environment»"]
    EDGE["Edge Middleware<br/>(proxy.ts — RBAC, redirect)"]
    SSR["Next.js App Router<br/>SSR/RSC + Route Handlers"]
    CRONJ["Vercel Cron<br/>remind-class · remind-exam"]
  end

  subgraph N2["NEON — SERVERLESS POSTGRES «managed database»"]
    DB[("Postgres DB<br/>qua @prisma/adapter-neon")]
  end

  subgraph N3["BÊN THỨ BA — SaaS ngoài"]
    CLOUD["Cloudinary<br/>«CDN + media storage»"]
    GEMINI["Google Gemini API<br/>«AI service»"]
    PAY["Cổng thanh toán<br/>PayOS / VNPay / Momo"]
    SMTP["SMTP Provider<br/>«email relay»"]
    ZALO["Zalo OA API<br/>«P1»"]
  end

  BROWSER -- "HTTPS/TLS" --> EDGE
  EDGE -- "nội bộ tiến trình" --> SSR
  CRONJ -- "nội bộ tiến trình" --> SSR
  SSR -- "TCP/TLS (Prisma)" --> DB
  SSR -- "HTTPS REST" --> CLOUD
  SSR -- "HTTPS REST" --> GEMINI
  SSR -- "HTTPS Webhook" --> PAY
  SSR -- "SMTP/TLS" --> SMTP
  SSR -. "HTTPS REST (P1)" .-> ZALO
```
