# Phạm vi sở hữu tệp — hai tác tử không bao giờ sửa cùng một tệp

Mục đích: triệt tiêu xung đột gộp. Mỗi thư mục có đúng **một phòng chủ**.
Phòng khác muốn đổi → gửi "yêu cầu đổi tệp chung" cho COO (mẫu BAN-GIAO.md mục D);
COO giao cho phòng chủ hoặc chỉ định một tác tử làm, phòng kia chờ.

## Phòng Quản trị (pb-admin)

| Thư mục / tệp | Code | Dev |
|---|---|---|
| `src/app/(admin)/admin/**` | — | adm-dev |
| `src/app/api/admin/**`, `src/app/api/cron/**` | adm-code | — |
| `src/components/admin/**` | — | adm-dev |
| `src/lib/adminNav.ts`, `src/lib/permissions.ts`, `src/lib/audit*.ts` | adm-code | — |
| Tin tức phía quản trị (`admin/tin-tuc`, model `Article` viết) · Điểm chuẩn · Kiểm duyệt · Nhật ký · Duyệt gia sư · Duyệt Coin · Triển khai · Gói Pro | adm-code | adm-dev |
| **Hai tệp lớn** `src/app/(admin)/admin/khoa-hoc/[id]/page.tsx` và `src/app/(admin)/admin/thi-thu/**` (gia sư dùng qua alias `/lop-cua-toi/quan-lop`, `/lop-cua-toi/de-thi`) | adm-code | adm-dev — **cho tới khi BU-02/BU-03 tách chúng sang `components/tutor/`**; phòng Gia sư gửi yêu cầu, không tự sửa. |

## Phòng Gia sư (pb-gia-su)

| Thư mục / tệp | Code | Dev |
|---|---|---|
| `src/app/lop-cua-toi/**` (kể cả `(tutor)/(noi-dung)/*` — chỉ tệp mỏng re-export) | — | tut-dev |
| `src/app/api/tutor/**`, `api/courses/**`, `api/invites/**`, `api/sessions*`, `api/attendance*` | tut-code | — |
| `api/fees*`, `api/invoices*`, `src/lib/feeCharge*`, `invoiceServer*`, `sessionBook*` | **KHÓA** — chạm TIỀN, chỉ đọc; đổi phải có quyết định của chủ | — |
| `src/components/tutor/**`, `src/components/shell/LopCuaToiFrame.tsx` | — | tut-dev |
| `src/lib/tutorGate*.ts`, `tutorRoutes.ts`, `tutorProfile.ts`, `tutorInbox*.ts`, `tutorOverview.ts`, `joinRequest.ts` (BU-01), `enrollServer.ts` (BU-01) | tut-code | — |
| `src/app/api/auth/register-tutor/**` | tut-code | — |

## Phòng Học sinh (pb-hoc-sinh)

| Thư mục / tệp | Code | Dev |
|---|---|---|
| `src/app/(student)/**` | — | stu-dev |
| `src/app/(guest)/**` — trang chủ, `/dang-ky`, `/cong-dong`, `/tin-tuc` (đọc), `/giang-vien`, `/khoa-hoc/[slug]`, `/mentor/*` | — | stu-dev |
| `src/app/api/student/**`, `api/exams/**` phía làm bài, `api/quiz*`, `api/community*`, `api/thread*`, `api/question*`, `api/articles` (đọc), `api/auth/**` trừ register-tutor | stu-code | — |
| `src/components/student/**`, `src/components/community/**`, `src/components/AuthGuard.tsx`, `src/components/kin/shell/MorePanel.tsx` | — | stu-dev |
| `src/lib/exam*.ts`, `quiz*.ts`, `community*.ts`, `coin*.ts` (chỉ đọc số dư; không tạo giao dịch nạp) | stu-code | — |

## Tệp CHUNG — xin COO, một người sửa một lúc

- `prisma/schema.prisma` (chỉ thêm; `t-db-push-guard`)
- `src/lib/session.ts`, `loginSession.ts`, `landing.ts`, `signedInShell.ts`, `hostRouting.ts`, `notify.ts`, `pushPayload*.ts`
- `src/components/kin/**` (bộ thành phần chung), `src/app/layout.tsx`, `src/app/kin-tokens.css`, `kin-site.css`, `globals.css`
- `src/app/(admin)/layout.tsx`, `src/app/(student)/layout.tsx`, `src/components/admin/AdminShell.tsx`, `src/components/student/StudentShell.tsx`, `src/components/tutor/TutorShell.tsx` (vỏ ba vai — BU-00 vừa siết, đổi phải chạy `ui-role-everything`)
- `tools/local-e2e/h.ts`, `wipe`, `seed*`, `README.md`
- `.claude/**`, `AGENTS.md`, `CLAUDE.md`, `docs/kin/**` (trừ `docs/kin/phong-ban/dac-ta/<mã của phòng mình>.md`)

## Quy ước nhánh

- `claude/adm-<mã>`, `claude/tut-<mã>`, `claude/stu-<mã>`; việc liên phòng do COO đặt `claude/coo-<mã>` và chia thư mục như trên.
- Trước khi tạo nhánh: `git fetch`; rẽ từ `origin/main`, hoặc từ nhánh nền chưa gộp (ghi trong PR).
