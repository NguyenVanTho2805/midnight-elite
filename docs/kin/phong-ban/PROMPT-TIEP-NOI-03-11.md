# Prompt tiếp nối Bigupdate KiN — bản đã kiểm và sửa (02/11/2026, sau phiên chạy test thật)

Thay cho `PROMPT-TIEP-NOI-02-11.md` (chỉ nằm trên nhánh `claude/phong-ban-agent`, PR #96). Phiên này chạy trong container cloud (Postgres 16 cục bộ, Next dev, Chromium thật), **không** phải máy Mac của chủ kho.
Mọi con số dưới đây là số chạy thật; ô nào ghi "chưa chạy" thì chưa chạy. Không có PR nào được mở, không nhánh nào bị đẩy lên ngoài nhánh làm việc của phiên này (xem mục 5).

## 1. Lỗi tìm thấy trong prompt gốc (đã sửa ở bản này)

| # | Lỗi trong prompt gốc | Thực tế đã kiểm | Sửa |
|---|---|---|---|
| 1 | "Người dùng là Thanh; chủ kho là Thọ" | `CLAUDE.md` (06/10) và email phiên này: **người dùng là Thọ**; Thanh là cộng sự | Mục 4: các quyết định "của chủ" là của chính người đang đọc |
| 2 | Bảo đọc `PROMPT-TIEP-NOI-02-11.md`, `BIGUPDATE-KE-HOACH.md`, `dac-ta/` như thể cùng một nơi | `PROMPT-TIEP-NOI…` chỉ ở `claude/phong-ban-agent`; `BIGUPDATE-KE-HOACH.md` có ở `main`/`bu-04` nhưng **không** có ở nhánh đó; `dac-ta/BU-0x.md` mỗi nhánh BU một tệp (BU-04 ở `bu-04`, BU-08 ở `bu-08`, BU-06 ở `bu-06`…) | Mở đặc tả bằng `git show origin/claude/<nhánh>:docs/kin/phong-ban/dac-ta/BU-xx.md` |
| 3 | BU-04 "rẽ từ BU-03" | Lệch 1 commit (`2659253`, một tệp test) so với đầu #107 | Đã gộp vào BU-04 (bản vá 0001) |
| 4 | #97, #99 "đã test xanh, chờ gộp" | **Xung đột với `main`** ở `src/lib/hostRouting.ts` + `t-host-routing-lib.ts` (chỉ là dòng chú thích đầu tệp; #92/#93/#94/#97/#99 rẽ từ `b099289`, thiếu 29 commit của `main`). Giữ cả hai dòng chú thích → `t-host-routing-lib` 89/89 | Phải "Update branch" #97, #99 trước khi gộp |
| 5 | BU-08 "PR base `main`, rẽ từ main" | Đặc tả BU-08 mục D5 bắt xếp chồng sau #92 → #98 → #99; đo thật: BU-08 xung đột với #92 (6 chỗ: `_template` đổi tên vs xoá…), #99 (5: `adminNav`, `adminOps`, `t-admin-queue-lib`…), #98 và #100 (`adminOps.ts`) | Gộp BU-08 sau cùng, giải xung đột khi đó |
| 6 | Việc 2(c): "thay tab Chương bài bằng `giao-trinh/*`" | Đặc tả BU-08 mục 0-C(1) ghi **không khả thi** (tab còn `AssignmentEditor` của BU-02); BU-08 chỉ **đóng đường tải không ký** (`t-no-unsigned-upload` 4/4) | Giữ đúng đặc tả; phần thay tab là nợ |
| 7 | Việc 1.4: "`participants`/`justSubmitted` có thể đếm đôi khi nộp đồng thời; Coin P1 nếu không chống trùng" | **Không tái hiện**: 180 lời gọi `submit` song song / 15 vòng → 0 lỗi, `participants` = `ExamResult` = Coin = 1 mỗi vòng. `unique(userId, examId)` chặn đếm đôi; `addQuizRewardCoins` có khoá tư vấn + `findFirst(refId=examId)`. Múi giờ: `examWindow.ts` dựng mốc bằng `+07:00`, `t-exam-window-lib` đạt ở TZ=UTC, Asia/Ho_Chi_Minh, America/New_York, Pacific/Kiritimati | Đóng 3 mục "chờ chủ" này (mục 3) |
| 8 | `t-exam-submit-race` "20/20" coi như bằng chứng | Bài dùng `debt()` nên các ca nộp trùng **không bao giờ làm bài đỏ** | Đừng coi số đạt là bằng chứng; dùng script thăm dò nhiều vòng |
| 9 | Công thức chạy test (`/tmp/kin-run-branch.sh`, `midnight-elite-test`, cổng 3100 trên Mac) | Không có ở cloud | Mục 6 |
| 10 | Danh sách hồi quy BU-04 thiếu bài đọc lịch | Lịch thi lọt mã đề con là do `studentSchedule.ts`, mà `t-exam-roles-attack` mới bắt | Thêm `t-student-schedule-link`, `t-student-todo`, `t-session-change`, `t-media-security` vào hồi quy |
| 11 | Lỗi có sẵn ở `main` chưa đủ | Thêm: `ui-tutor-shell` (strict-mode "GIA SƯ" ra 3 phần tử), `ui-host-flows` 24/4 — **đỏ y hệt trên `main`** (đã chạy đối chứng) | Mục 2 |

## 2. Trạng thái thật

Bảng PR #92–#107 trong prompt gốc **đúng** (số PR, nhánh, base). Phiên này không chạy lại test của #92–#107, chỉ đo xung đột (mục 3).

| Mã | Nhánh | Trạng thái |
|---|---|---|
| **BU-04** | `claude/bu-04-phong-thi` (+4 commit sửa và 1 commit gộp #107, chưa đẩy) | tsc 0 lỗi (cần heap 6 GB); eslint 0 lỗi/1 cảnh báo cố ý. Chạy thật trên commit cuối: `t-quiz-hs` 60 · `t-exam-variants-hs` 35 · `t-exam-practice` 28 · `t-exam-attack` 53 · `t-exam-submit-race` 20 · `t-exam-roles-attack` 50 · `t-assign-contract` 29 (không còn SKIP) · `t-assign` 91 · `t-exam-variants` 79 · `t-bu03-quyen` 204 · `t-student-schedule-link` 50 · `t-student-todo` 36 · `t-kin-components` 44 · `ui-exam-guest-redirect` 12 · `ui-exam-room` 81 (6/6 lần) · `ui-bai-tap-hs` 14 · `ui-quiz-hs` 27 · `ui-quiz-timeup` 17. Cùng nhánh, sau khi sửa mã nhưng trước 1 commit chỉ-sửa-bài: `ui-role-everything` 38 · `ui-links-everywhere` 7/7 kịch bản · `ui-quiz-tutor` 63 · `ui-quiz-cham` 24 · `ui-quiz-hoan-thien` 41 · `ui-bai-tap-thu-vien` 30 · `t-session-change` 67 · `t-media-security` 81 · `t-db-push-guard` 28 · `t-no-fabricated` 37. Thuần: `t-exam-room-lib` 80 · `t-exam-practice-lib` 27 · `t-exam-window-lib` 25 · `t-exam-variant-route-lib` 17 · `t-assign-lib` 52 · `t-exam-variants-lib` 80 · `t-no-hex` 17. Chạy trước vài sửa, suy ra không bị ảnh hưởng (**chưa chạy lại**): `t-quiz-tutor` 107, `t-notify-links` 15. **Chưa mở PR, chưa chạy `kin-ra-soat`, chưa ghi sổ.** |
| **BU-06b** | `claude/bu-06b-anh-bia-video` (1 commit từ `bu-06`, chưa đẩy) | Xong: `PUT /api/users/me/tutor-profile` ghi ảnh bìa + video; form có "Không đăng ảnh/video có học sinh". `t-tutor-search` 202 (ca (10) đã bật; bẻ một dòng ghi bìa → 7 ca đỏ) · `t-tutor-search-lib` 179 · `ui-ho-so-bia-video` 51 (1440 và 390) · `ui-ht02-forms` 55 · `ui-tutor-pending` 37 · `t-tutor-area` 55 · `t-no-hex` 17 · `t-kin-components` 44; tsc/eslint sạch. P3 kèm theo (cache `loadVisibleTutors`, `role="tab"`, iframe sandbox): **chưa làm**. |
| **BU-08** | `claude/bu-08-quan-tri` (+2 commit, chưa đẩy) | Số dưới đây chạy trên commit cuối (kể cả sau khi sửa `AdminShell`). tsc 0 lỗi; eslint không thêm lỗi nào so với `main` (14 vs 17 cùng tệp). `t-admin-queue` 25 · `t-admin-ops` 48 · `t-admin-queue-external` 2 (10 trên bản gộp #103+#104) · `t-admin-students-guest` 3 · `t-admin-audit-gaps` 21 · `t-cron-article-publish` 12 · `t-admin-redirects` 13 · `ui-admin-shell-4module` 21 · `ui-admin-shell` 17 · `ui-admin-ops` 37 · `ui-admin-hang-cho` 36 · `ui-admin-hom-nay` 15 · `ui-admin-gia-su` 10 · `ui-admin-tai-lieu` 13 · `ui-role-everything` 38 · `ui-links-everywhere` 7/7 · lib thuần (nav 30, queue 89, ops 62, external 24, redirects 16, system-accounts 10, article-schedule 13, client-boundary 4, no-unsigned-upload 4). `ui-admin-community-guest`: trên nhánh riêng **BỎ QUA** (không tính xanh); trên bản gộp tạm BU-08+#103+#104 đạt 5/5. **Chưa làm D2** (`vercel.json` cron, cần chủ xác nhận gói) và phần thay tab Chương bài (nợ). |
| Figma, `SO-VIEC.md`, `bigupdate.csv` | — | **Chưa làm** (Việc 4 và Việc 5.1 của prompt gốc). |

**Lỗi có sẵn ở `main` (đã chạy đối chiếu hoặc README đã ghi):** `ui-tutor-shell`, `ui-student-shell` (strict-mode ở chữ "GIA SƯ"/"HỌC SINH"), `ui-host-flows` 24/4 (3 ca `/admin/khoa-hoc`), `t-health-metrics-lib` 61/1; các lỗi prompt gốc đã nêu (`ui-tutor-everything`, `ui-english` cần `GEMINI_API_KEY`, `t-links`, …) **không** chạy lại. **Đỏ do PR #105 (BU-06):** `ui-profile-preview` — `/giang-vien` và `/mentor/[id]` mới không còn vẽ `data-testid="tutor-activity"`/`"recently-active"` (chỉ còn trong `TutorCard`/`TutorProfileHeader` không còn dùng); suy từ mã, **chưa chạy trên bản BU-06 nguyên thủy**.

### Lỗi mã đã sửa trong phiên này (5) và lỗi bài (4)

Lỗi mã (nằm trong bản vá): ① `studentSchedule.ts` lộ mã đề con + đề giao-theo-link của thầy khác ở "Lịch thi" (`t-exam-roles-attack` đỏ 4 ca) · ② cùng hàm: đề gắn lớp hiện tên cho học sinh ngoài lớp (`ui-bai-tap-hs` đỏ) · ③ `useRoomPage`: màn kết quả dùng `gate.canStart` cũ nên "Làm lại" bật dù hết lượt (`ui-quiz-hs` đỏ) · ④ `QuestionGrid`: `text-[10px]` (`t-kin-components` đỏ) · ⑤ BU-08 `next.config.ts` chưa nối `redirects()` (D1) và `AdminShell` chưa lọc tab theo nhóm + logo < 44px (D3a).
Lỗi bài: `t-admin-redirects` (so thứ tự tham số), `ui-admin-community-guest` (thiếu `authorId`), `ui-exam-room` (đỏ ngẫu nhiên khi đề xáo ra `q2,q1`), `ui-ho-so-bia-video` (bài mới của mình: nhầm iframe hiện sẵn).

## 3. Xung đột đã đo (`git merge-tree`, từng cặp) và các việc còn lại cho thứ tự gộp

- Vào `main` hiện tại: **sạch** — #92 #93 #94 #96 #98 #100–#107, BU-04, BU-08. **Xung đột:** #97 và #99 (chỉ chú thích, xem mục 1-#4).
- **#94 × BU-04 — xung đột ngữ nghĩa, 4 tệp** (`thi-thu/[examId]/page.tsx` 167 dòng, `gate/route.ts`, `start/route.ts`, `review/route.ts`): #94 (STU-001) thay `getMaxAttempts` bằng `loadEffectivePolicy` (đề công khai mặc định 2 lượt), BU-04 đếm lượt theo cả nhóm mã đề. Cần một người quyết cách ghép (lấy `maxAttempts` từ `loadEffectivePolicy` của đề gốc nhưng đếm theo nhóm) rồi chạy lại `t-exam-*` và test của STU-001. **Chưa làm.**
- Khác: #92×#98/#99/#100 `adminOps.ts` · #92×#102 `api/admin/articles/*` · #93×#103/#105/#106 `api/invites/[id]/redeem/route.ts` · #97×#98/#100 `prisma/schema.prisma` · #98×#99 `schema.prisma`+`adminOps.ts` · #101×#103/#105/#106 `LopCuaToi.tsx` · #102×#103/#105/#106 `khoa-hoc/[slug]/page.tsx` · #105×#106 `docs/kin/tien-do-dang-do.md` · #106×#107/BU-04 `tutorRoutes.ts` · #99×BU-08 `adminNav.ts`.
- Thứ tự đề nghị (giữ của prompt gốc, thêm bước cập nhật): #96 → #92 → #93 → #94 (rồi ghép BU-04, xem trên) → cập nhật #97 với `main` → #97 → #99 (cập nhật) → #98 → #100 → #101 → #102 → #104 → #103 → #106 → #105 → BU-06b → #107 → BU-04 → BU-08 (sau cùng). Sau gộp: `prisma db push` (site_content, `User.deletedAt`, `course_categories`, schema BU-01/03/05/06/07).

## 4. Việc cần chủ quyết (người đọc là Thọ)

1. **Lộ tên học sinh qua API** (TRẺ EM): `GET /api/exam-results?examId=` vẫn trả top 50 kèm `user.name` cho mọi học sinh đăng nhập dù giao diện chỉ dùng điểm; `showLeaderboard=false` cũng chưa được máy chủ tôn trọng (đặc tả BU-04 mục 4.8 chưa làm; comment trong mã ghi "quyết định COO 02/11"). **Không tự sửa.** Đề nghị: trả `label` ẩn danh như 4.8.
2. **Lịch thi đã siết** (sửa ② ở trên): học sinh ngoài lớp không còn thấy tên đề của lớp khác (trước đó mọi học sinh đăng nhập thấy). Nếu muốn giữ lịch công khai như cũ, bỏ phép lọc `enrolledCourses` trong `src/lib/studentSchedule.ts`.
3. **D2 `vercel.json`**: cron `/api/cron/article-publish` mỗi 15 phút — cần xác nhận gói Vercel (Q9). Không có nó thì bài hẹn giờ không tự đăng.
4. **KHÔNG bật `KIN_GUEST_QUESTIONS` ở production** cho tới khi #104 **và** BU-08 cùng đã lên (giao diện duyệt câu hỏi khách của BU-08 chỉ chạy được khi có `Thread.status/guestName` của #104 — đã kiểm 5/5 trên bản gộp).
5. Giữ nguyên các mục (i)–(x) của prompt gốc mục "Chốt 4" (Cloudinary + `KIN_VIDEO_UPLOAD`, `jszip`/`@xmldom/xmldom`, MathType, nút gốc "Môn", Coin/≥17/feeMode/lớp 2 ca, "lớp miễn phí" Q1, sitemap, lọc cấp lớp BU-06, `GET /api/exams/[id]` lộ metadata nháp). Riêng 2 mục đã **đóng**: nộp trùng/Coin và múi giờ (mục 1-#7).

## 5. Bản vá

`docs/kin/phong-ban/ban-va-03-11/` — `git format-patch` cho 3 nhánh, đã thử `git am` sạch lên đúng nền. Hướng dẫn trong `ban-va-03-11/README.md`. Chưa đẩy lên nhánh BU nào và chưa mở PR vì phiên này chỉ được đẩy lên `claude/optimistic-clarke-cbddza`.

## 6. Chạy test trong container cloud (công thức đã dùng được)

- Cài: `npm ci` (≈30 giây, **chạy một lần, đừng chạy chồng**). Postgres: `pg_ctlcluster 16 main start`, mật khẩu `kintest`, sửa `pg_hba` dòng 127.0.0.1 thành `password`, DB `kin_test`. DDL: `npm i --prefix /tmp/prisma-internals @prisma/internals@7.8.0` rồi `node tools/local-e2e/db/ddl.mjs prisma/schema.prisma /tmp/prisma-internals/node_modules | psql …`. Client: `PRISMA_SCHEMA_ENGINE_BINARY=/bin/true PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate`. Proxy WS: `node tools/local-e2e/db/wsproxy.mjs "$PWD/node_modules" /tmp/kin-cert` (chứng chỉ tự ký). `/etc/hosts`: `127.0.0.1 midnightelite-edu.com admin.midnightelite-edu.com`. `env.sh` thêm `ENGLISH_AI_FAKE=1` và `CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`.
- **Mỗi nhánh có schema khác nhau → DB riêng** (`kin_test`, `kin_test_b` cho BU-06, `kin_test_c` cho bản gộp). Một DB chỉ một máy chủ dev tại một thời điểm (`wipe()` mỗi bài).
- **Bẫy đã trả giá:** (a) `tsc` hết heap mặc định → `NODE_OPTIONS=--max-old-space-size=6144`. (b) **`next-server` phình tới ~10 GB RAM** khi chạy `ui-links-everywhere` → bị OOM-killer; mọi bài sau báo `ERR_CONNECTION_REFUSED` (đó là lỗi môi trường, không phải mã). Khởi động lại dev server trước mỗi bài lớn và **đừng chạy `tsc` cùng lúc**. (c) `ui-links-everywhere`/`ui-role-everything` mất 10–25 phút → giới hạn thời gian của runner ≥ 1500 giây (600 giây cắt giữa chừng, rc=124). (d) `pkill -f next-server` trong cùng lệnh tự giết shell (mã 144) → dừng server bằng script riêng. (e) `ESLint 9` không còn formatter `unix` → dùng `-f json`. (f) Next ghép query yêu cầu **trước** query đích của `redirects()`; tham số trùng tên thì đích thắng.
- Đọc số: `tr -d '\033' < log | grep -E "pass /|✗"`. Bài rc≠0 mà không có dòng `pass /` là **sập** (đọc `CRASH`), không phải ca sai.

## PROMPT (dán cho phiên mới)

Bạn là COO (`kin-coo`) của KiN (repo `midnight-elite`, Next.js 16 + Prisma 7 + Neon, token `--kin-*`, tiếng Việt). **Người dùng là Thọ** (chủ kho); Thanh là cộng sự. Đọc trước: `CLAUDE.md`, file này, rồi đặc tả từng việc bằng `git show origin/claude/<nhánh>:docs/kin/phong-ban/dac-ta/BU-xx.md`. Quy tắc cứng giữ nguyên (TIỀN hoặc dữ liệu TRẺ EM chạm tới → dừng và hỏi; schema chỉ thêm; POST+303; không hex; nút ≥44px, 390px không tràn; thông báo không tên/số tiền; commit kết `Co-Authored-By: …`; **không gộp PR, không bật cờ production, không đẩy lên nhánh khác với nhánh được giao nếu người dùng chưa cho phép**). Còn lại:

1. Nếu người dùng cho phép đẩy: áp `ban-va-03-11/*` lên `claude/bu-04-phong-thi` (bỏ bản 0001 nếu #107 đã gộp), `claude/bu-06-tim-gia-su` (tạo `claude/bu-06b-anh-bia-video`, PR base `claude/bu-06-tim-gia-su`), `claude/bu-08-quan-tri`; chạy `kin-ra-soat` rồi `kin-ghi-so`; mở PR BU-04 (base `claude/bu-03-de-thi`), BU-06b, BU-08 (base `main`, ghi rõ xung đột mục 3).
2. Ghép **#94 × BU-04** (mục 3) và "Update branch" #97, #99; chạy lại test sau mỗi ghép.
3. Việc 4 gốc (Figma): vẽ BU-01/03/06, đối chiếu các khung đã có — **chưa ai làm**, kể cả đối chiếu mã BU-04/08 với 609:285, 609:428, 608:1083, 608:1515. Chênh lệch lớn → báo người dùng chọn sửa mã hay sửa Figma.
4. Việc 5 gốc: cập nhật `docs/kin/phong-ban/SO-VIEC.md` và `docs/kin/backlog/bigupdate.csv` (nằm ở các nhánh khác nhau, cẩn thận xung đột), viết thứ tự gộp cuối từ mục 3, nhắc quyết định mục 4.
5. P3 của BU-06 còn lại; `ui-profile-preview` (đỏ do #105); D2 sau khi chủ xác nhận gói.
6. Báo cáo: bảng bài đã chạy (đạt/đỏ, lỗi mã hay lỗi bài), PR, việc của chủ. Không bao giờ ghi "xanh" khi chưa chạy hoặc khi bài tự `BỎ QUA`/`debt()`.
