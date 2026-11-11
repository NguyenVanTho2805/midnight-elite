# BU-HS-NOP-TEP · Học sinh nộp bài bằng tệp Word/PDF (riêng tư, lưu 60 ngày), gia sư xem/tải và trả bài kèm tệp

Đặc tả của `stu-rnd` (pb-hoc-sinh), 09/11/2026. Nhánh `claude/bu-hs-trang-chu` (cùng worktree với BU-HS-TRANG-CHU). Thay cho "chờ chủ" ở Phụ lục A của `BU-HS-TRANG-CHU.md`: chủ đã trả lời qua COO.
Quyết định của chủ (nguyên văn tóm tắt): bài học sinh nộp lưu **60 ngày**; tệp gia sư trả về cũng **60 ngày**; mỗi tệp **dưới 10 MB**; được làm MÃ: học sinh kéo thả Word/PDF trên trang nộp bài tập, gia sư của lớp xem/tải được và trả bài kèm tệp.
Giả định ghi vào PR để chủ xem lại: chỉ học sinh đó và gia sư của lớp xem được tệp; chặn ảnh/video; kiểm đuôi + magic bytes; tải qua đường có kiểm quyền (`/api/media`), không công khai; hết 60 ngày đánh dấu hết hạn và xoá tệp gốc bằng cron có log, chạy khô trước; giữ điểm và nhận xét; schema chỉ thêm; không đụng tiền/Coin.
Nguồn: mã đọc trực tiếp (tệp:dòng ở từng mục), `BU-02.md` (kho tài liệu riêng tư của gia sư), `TUT-dong-giang.md` (ma trận quyền), `BU-HS-TRANG-CHU.md` mục 1.6 + Phụ lục A, `CLAUDE-cho-kho-trien-khai.md` mục 5.5, `.claude/agents/kin-backend.md` (8 quy tắc cứng).
Không truy cập được Figma trong phiên này; mục 5 mô tả đủ để vẽ. Số đo lệch khung đã duyệt thì khung thắng.

Cờ: **TIỀN = không** · **TRẺ EM = có** (bài làm của học sinh; mục 6) · **ĐỔI NỀN = KHÔNG nếu production đã có ba biến `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET`; CÓ (chỉ là biến môi trường, không phải dịch vụ mới) nếu chưa có** — xem mục 1, đây là điểm sống còn.
Schema: **một bảng mới `SubmissionFile`, không sửa bảng cũ nào.** `t-db-push-guard` không có gì để cảnh báo.

---

## 0. Tóm tắt quyết định

1. Hạ tầng sẵn có (BU-02, `FileAsset` + Cloudinary raw `type=authenticated` + proxy `/api/media/[id]/file`) **đã là tệp riêng tư, có ký, xoá được từ máy chủ**; không cần dịch vụ mới. Luồng nộp bài **hiện tại** thì KHÔNG dùng nó: nó dùng preset không ký ⇒ URL công khai (mục 1.1).
2. Khuyến nghị MỘT phương án: **tái dùng đúng cơ chế BU-02 cho học sinh qua bảng mới `SubmissionFile`**, lib mới `nopTep*.ts`, không sửa `mediaStorage*.ts`.
3. **Việc chủ phải xác nhận trước khi bật:** production đã có ba biến Cloudinary có khoá bí mật chưa? Cách kiểm 1 phút: gia sư đăng nhập production mở `/api/media/config`, xem `document.enabled` (mục 1.3). Thiếu ⇒ tính năng tự TẮT và nói rõ, không rơi về preset không ký.
4. Cloudinary bản miễn phí giới hạn **raw 10 MB/tệp** (trang giá của Cloudinary) trùng đúng trần "dưới 10 MB" của chủ; đường Cloudinary riêng tư của BU-02 **chưa từng chạy với khoá thật** (ghi chú `mediaStorageServer.ts:6`): bật lần đầu phải thử tay một tệp ~9 MB tải lên + tải xuống.
5. Mỗi tệp: `.docx` hoặc `.pdf`, `< 10 MiB`, tối đa **3 tệp mỗi bài nộp**; ảnh/video/zip/`.doc`/`.docm`/tệp thực thi bị chặn; kiểm đuôi + nội dung THẬT trên máy chủ (docx đọc danh mục zip, pdf kiểm đầu/đuôi), không tin tên/MIME trình duyệt.
6. Tải xuống: `GET /api/media/nop-bai/<fileId>` — **đăng nhập + kiểm quyền mỗi lượt**, luôn `attachment` (PDF có thêm `?xem=1` để xem trong tab), `nosniff`, `no-store`, không bao giờ lộ `storageKey`/địa chỉ Cloudinary. Không dùng URL ký hạn ngắn đưa cho trình duyệt (mục 3.5, lý do).
7. Hết hạn: tệp có cột `expiresAt` chốt lúc tạo (`+60×24 giờ`). **Hai lớp**: API ngừng phát ngay khi qua `expiresAt` (410), cron `het-han-tep-nop-bai` xoá tệp gốc sau đó, đánh dấu `expired`, **không đụng `AssignmentSubmission`** (điểm/nhận xét còn nguyên).
8. Cron mặc định **chạy khô**; chỉ xoá thật khi có `?xoa=1`; PR phát hành với `vercel.json` KHÔNG có `?xoa=1`; chuyển sang xoá thật là một commit riêng sau khi chủ xem log khô và `t-nop-tep-het-han` xanh.
9. Siết luồng cũ trong cùng phiếu (nhỏ): `POST /api/assignments/[id]/submit` ngừng nhận `fileUrl` do trình duyệt gửi; bài nộp cũ (URL Cloudinary công khai) giữ nguyên, ghi nhãn "Tệp cũ", dọn bằng việc riêng (backlog, mục 9).
10. Quét mã độc: **không có**. Chỉ kiểm cấu trúc + chặn macro/đối tượng nhúng/JavaScript trong PDF. Không dịch vụ bên thứ ba (sẽ gửi bài làm của học sinh ra ngoài: TRẺ EM + ĐỔI NỀN).
11. Không giữ nhiều phiên bản: nộp lại **thay** bộ tệp cũ (xoá ngay khỏi kho), giữ hành vi cũ "nộp lại xoá điểm cũ" (có hộp xác nhận).
12. Có 4 câu hỏi "chờ chủ" (mục 9) và 5 việc xin COO (mục 10); phần gia sư phải sửa duy nhất một tệp UI của phòng Gia sư (`components/tutor/BaiTap.tsx`, ~10 dòng ghép).

---

## 1. QUYẾT ĐỊNH LƯU TRỮ

### 1.1 Hiện trạng: `/api/media` có phải "tải có ký, riêng tư"? — Phần của gia sư: CÓ. Phần của học sinh: KHÔNG.

| Đường | Bằng chứng | Riêng tư? |
|---|---|---|
| Nộp bài hiện tại | trình duyệt gửi thẳng lên Cloudinary bằng **preset không ký** (`src/lib/cloudinary.ts:1-35`, gọi ở `bai-giang/[lessonId]/page.tsx:176`), rồi `POST /api/assignments/[id]/submit` tin nguyên chuỗi `fileUrl` (`submit/route.ts:51-52`); `<input type="file">` không `accept` (`page.tsx:225`) | **Không**: URL `secure_url` công khai, ai có link đều mở; nhận cả ảnh; máy chủ không biết tệp là gì, không xoá được (không có `CLOUDINARY_API_SECRET` ở đường này) |
| Tệp tài liệu của gia sư (BU-02) | Cloudinary raw `type=authenticated`: `cloudinaryDocUploadInit` (`mediaStorageServer.ts:117`), phát qua proxy có ký `cloudinarySignedRawUrl` (`:127`), `GET /api/media/[id]/file` kiểm quyền mỗi lượt (`[id]/file/route.ts`), xoá bằng `cloudinaryDestroy` (`:133`), đo dung lượng thật `cloudinaryVerify` (`:159`), đọc đầu tệp `cloudinaryReadHead` (`:143`), kiểm magic bytes `fileSniff.ts` | **Có**: không có địa chỉ công khai; xoá từ máy chủ được |
| Dành cho học sinh? | `document/init` chặn bằng `requireTutorOnly` (`init/route.ts:18`); `PUT /api/media/upload/[id]` cần `MANAGE_CURRICULUM` | **Chưa**: học sinh không có đường nào |

Kết luận: **không cần đổi nền**. Cần: (a) tái dùng cơ chế riêng tư BU-02 cho học sinh, (b) ba biến môi trường Cloudinary có khoá bí mật có mặt ở production. (b) là thứ duy nhất tôi KHÔNG kiểm được từ mã (BU-02 Q1, `BU-02.md:316`, chưa thấy trả lời trong kho).

### 1.2 Các phương án và khuyến nghị

| | Cách làm | Ưu | Nhược | Đổi nền? |
|---|---|---|---|---|
| **A (KHUYẾN NGHỊ)** | Cloudinary raw `authenticated` + proxy qua `/api/media/nop-bai/<id>` + `cloudinaryDestroy` từ máy chủ (đúng cơ chế BU-02) | Dùng ngay hạ tầng có; tải thẳng từ trình duyệt lên Cloudinary nên không vướng trần ~4,5 MB của hàm Vercel; xoá được bằng API; đã có test thuần cho chữ ký | Cần ba biến ở production; đường ký chưa chạy thật với khoá thật; bản miễn phí raw 10 MB (sát trần); phát lại qua proxy là phát luồng 10 MB qua hàm (đã có tiền lệ 25 MB ở `/api/media/[id]/file`, chưa kiểm ở production) | **Không** nếu đã có 3 biến. Nếu thiếu: thêm 3 biến từ tài khoản Cloudinary sẵn có, không dịch vụ mới ⇒ cần chủ làm |
| B | Lưu `bytea` trong Postgres (Neon), ≤10 MB | Một nguồn dữ liệu, xoá = `DELETE` | Hàm Vercel nhận tối đa ~4,5 MB mỗi yêu cầu ⇒ phải cắt mảnh 4 MB rồi ghép; phình DB (100 tệp × 10 MB = 1 GB, gói Neon miễn phí nhỏ hơn); backup/replica nặng; đọc 10 MB vào bộ nhớ mỗi lượt tải | Không đổi dịch vụ nhưng **đổi cách dùng DB** — không khuyến nghị |
| C | Vercel Blob private (`access: 'private'`, GA 30/06/2026 theo changelog Vercel) | Riêng tư, xoá bằng API, có presigned URL | Cửa hàng Blob + biến `BLOB_READ_WRITE_TOKEN` mới, thêm gói/chi phí, thêm một nhà cung cấp lưu bài làm của học sinh | **CÓ** (dịch vụ + biến mới): chủ/COO duyệt |

**Chọn A.** Nếu chủ xác nhận production CHƯA có ba biến và không muốn thêm: tính năng đứng ở trạng thái TẮT (`nopTepConfig().enabled=false`, màn nói "Tính năng nộp tệp chưa bật", vẫn nộp bằng link Azota như cũ). Không có "cách tạm".

### 1.3 Cách kiểm trước khi bật (ghi vào PR cho chủ)
1. Gia sư đã duyệt đăng nhập production, mở `/api/media/config`: `document.enabled: true` và `document.driver: "cloudinary"` ⇒ ba biến có mặt.
2. Sau khi gộp: thử tay 1 tệp `.docx` ~9 MB làm học sinh thử: tải lên, nộp, gia sư tải xuống, xoá ở màn học sinh, kiểm tệp biến khỏi Cloudinary (Media Library, thư mục `kin-nop-bai/`).
3. Nếu Cloudinary từ chối tệp trong khoảng 10.000.000–10.485.759 byte (trần "10 MB" tính thập phân): hạ hằng số `NOP_TEP_MAX_BYTES` xuống 9.500.000 (một dòng, test theo hằng số).

---

## 2. Schema CHỈ THÊM

Không sửa/xoá/đổi kiểu cột nào; không `@unique` trên bảng cũ. Bảng mới rỗng nên `prisma db push` không in cảnh báo mất dữ liệu (`t-db-push-guard` chạy như mọi lần, kỳ vọng "không có cảnh báo").

```prisma
// BU-HS-NOP-TEP — tệp bài nộp của học sinh và tệp gia sư trả bài. Riêng tư: chỉ mở qua GET /api/media/nop-bai/<id> sau khi kiểm quyền.
// KHÔNG khai báo quan hệ tới AssignmentSubmission / User / Course (cùng kiểu ClassRecording.sessionId): xoá bài tập, xoá bài nộp hay ẩn danh tài khoản
// không được âm thầm làm mất hàng ghi còn trỏ tới tệp gốc trên kho; cron dọn theo expiresAt, và hai chỗ xoá có chủ đích gọi hàm dọn trước (mục 3.6).
model SubmissionFile {
  id            String    @id @default(cuid())
  kind          String    // "student" (học sinh nộp) | "tutor_return" (gia sư trả bài). Kiểm bằng hằng số trong nopTep.ts, không CHECK ở DB.
  assignmentId  String    // bài tập
  submissionId  String?   // AssignmentSubmission.id; null = đang chuẩn bị, CHƯA nộp / CHƯA trả (người khác không thấy)
  studentUserId String    // học sinh có bài nộp (luôn có; kind "student" thì = ownerUserId)
  ownerUserId   String    // người tải lên: học sinh, hoặc gia sư/quản trị khi kind "tutor_return"
  courseId      String    // lớp chứa bài, chốt lúc tải (kiểm quyền lớp không phải join 4 bảng)
  driver        String    // "cloudinary" | "local" (local chỉ máy dev/test)
  storageKey    String    @unique // Cloudinary public_id hoặc đường dẫn local; do MÁY CHỦ sinh, không bao giờ từ tên tệp, không bao giờ trả ra API
  originalName  String    // tên đã làm sạch (nopTepSafeName). Có thể chứa tên thật: không log, không đưa vào thông báo/audit/cron log
  ext           String    // "docx" | "pdf"
  mimeType      String    // lấy từ BẢNG đuôi, không từ trình duyệt
  sizeBytes     Int?      // null tới khi complete đo dung lượng thật (Admin API / stat)
  sha256        String?   // băm nội dung đã kiểm (chỉ để phát hiện nộp trùng; không trả ra API)
  status        String    @default("pending") // pending | ready | removed | expired
  createdAt     DateTime  @default(now())
  readyAt       DateTime?
  expiresAt     DateTime  // = createdAt + 60 ngày, CHỐT lúc tạo (đổi chính sách sau này không xoá hồi tố)
  removedAt     DateTime? // học sinh/gia sư bỏ tệp, hoặc bị thay khi nộp lại
  expiredAt     DateTime? // cron đánh dấu hết hạn
  deletedAt     DateTime? // thời điểm tệp gốc THẬT SỰ đã xoá khỏi kho (null = còn trên kho)

  @@index([deletedAt, expiresAt])               // cron hết hạn
  @@index([assignmentId, studentUserId, kind, status]) // danh sách + đếm số tệp tối đa
  @@index([submissionId])
  @@index([status, createdAt])                  // dọn tệp tải dở
  @@map("submission_files")
}
```

Quy ước trạng thái: `pending` (đã xin chỗ, chưa kiểm xong) → `ready` (đã kiểm magic bytes + dung lượng) → `removed` (bị bỏ/thay; chờ xoá kho nếu `deletedAt` còn null) hoặc `expired` (cron xoá do hết hạn). Hằng số `NOP_TEP_RETENTION_DAYS = 60`, `NOP_TEP_MAX_BYTES = 10 * 1024 * 1024` (nhận khi `size < MAX`), `NOP_TEP_MAX_FILES = 3`, `NOP_TEP_PENDING_TTL_HOURS = 24`.

**Cột/giá trị mới trên bảng cũ: không có.** `AssignmentSubmission.kind` là chuỗi tự do (`schema.prisma:269`): thêm giá trị `"tep"` (tệp trên KiN). `fileUrl` (bắt buộc) = `/api/media/nop-bai/<fileIdĐầu>` (đường riêng tư, KHÔNG phải URL công khai), nên màn gia sư cũ (`BaiTap.tsx:112` mở thẳng `cur.fileUrl`) vẫn tải được tệp đầu tiên khi có phiên đăng nhập hợp lệ. Hai giá trị cũ giữ nguyên: `"file"` (URL Cloudinary công khai, bài cũ), `"link"` (link Azota). (`"done"` chỉ có trong chú thích schema, không có nơi nào ghi — không phụ thuộc.)

---

## 3. Hợp đồng API

Quy ước chung (luật kho): ghi dữ liệu = POST thường (form + redirect 303) cho thao tác đổi trạng thái chính; JSON `fetch` cho các bước upload/danh sách/xoá chạy trong vùng thả (không phải server action). Mốc giờ (`createdAt`, `expiresAt`, `submittedAt`) do MÁY CHỦ đặt; trình duyệt chỉ hiển thị. Mọi phản hồi: `Cache-Control: no-store`. Lỗi tiếng Việt, **không bao giờ lặp lại tên tệp** trong thông điệp lỗi hay log (chỉ "Tệp thứ 2").

### 3.1 Lib thuần (không DB, không mạng) — stu-code

`src/lib/nopTep.ts` (hằng số + hàm thuần, chạy cả ở trình duyệt để báo trước):
- `nopTepConfig(env)` → `{ enabled, driver:"cloudinary"|"local"|"none", maxBytes, maxFiles, exts:["docx","pdf"], retentionDays:60, reason }`. Production thiếu một trong ba biến ⇒ `enabled:false` + `reason`; máy dev ⇒ `local`. **Không** phụ thuộc `NEXT_PUBLIC_CLOUDINARY_*` (preset không ký) — cố ý để một cấu hình sai không đưa ta về đường công khai.
- `nopTepSafeName(name)` → NFC, bỏ đường dẫn (`/`, `\`), bỏ ký tự điều khiển và ký tự điều khiển hướng chữ (U+202A–E, U+2066–9: mẹo `đổi chiều chữ` làm `.exe` trông như `.docx`), chỉ giữ `\p{L}\p{N}._ -`, gộp khoảng trắng, **cắt phần tên chứ không cắt đuôi**, ≤120 ký tự, không bắt đầu bằng dấu chấm. (Khác `safeFileName` ở `mediaStorage.ts:173` cắt cả đuôi.)
- `nopTepExt(name)` → đuôi cuối cùng, thường hoá (`a.docx.exe` ⇒ `exe` ⇒ bị chặn).
- `validateNopTepRequest({name,size,type}, cfg)` → `{ok}|{ok:false,error,code}` với `code ∈ bad_ext | too_big | empty | blocked_image | blocked_video | blocked_exec | blocked_macro_ext | bad_mime`. Quy tắc: đuôi ∈ {docx,pdf}; `size ≥ 1` và `size < maxBytes`; MIME trình duyệt khai (nếu có và khác `application/octet-stream`) phải thuộc họ của đuôi (**không dùng để tin, chỉ để báo sớm**); thông điệp riêng cho ảnh (`png jpg jpeg gif webp heic bmp svg tif`), video (`mp4 mov webm m4v avi mkv`), tệp thực thi/script (`exe dll bat cmd com msi js vbs ps1 sh jar apk app`), macro (`docm dotm xlsm pptm`), lưu trữ (`zip rar 7z gz tar`), `.doc` ("Hãy lưu lại thành .docx").
- `inspectDocx(bytes)` → `{ok}|{ok:false,code,error}`: đọc **thư mục trung tâm của zip** (EOCD ở cuối tệp ⇒ danh sách tên + kích thước giải nén; không giải nén nội dung trừ `[Content_Types].xml`, trần 64 KB đầu ra bằng `inflateRaw` giới hạn). Yêu cầu: bắt đầu `PK\x03\x04`; có `[Content_Types].xml` **và** `word/document.xml`; ≤ 2.000 mục; tổng kích thước giải nén khai ≤ 100 MiB và mỗi mục ≤ 50 MiB; tỉ số nén mỗi mục ≤ 200 (chặn zip bomb); không có bit mã hoá; tên mục không chứa `..`, bắt đầu bằng `/`, hay ký tự điều khiển (zip-slip); **chặn** `word/vbaProject.bin`, mọi tên `*vbaProject*`, `word/activeX/**`, `word/embeddings/**`, và `[Content_Types].xml` có chuỗi `macroEnabled` hoặc `vbaProject`. Đây là điểm khác với `fileSniff.ts:62-66` (chỉ PK + `[Content_Types].xml` trong 4 KB đầu ⇒ `.xlsx` đổi tên `.docx` vẫn lọt, macro cũng lọt).
- `inspectPdf(bytes)` → bắt đầu `%PDF-1.` hoặc `%PDF-2.`; có `%%EOF` trong 2 KiB cuối; **chặn** mọi PDF có `/Encrypt`, `/Launch`, `/EmbeddedFile`, `/JavaScript`, `/JS` (quét byte thô; PDF giấu trong luồng nén không bị phát hiện — nói rõ ở mục 6); không bắt đầu bằng `PK`/`MZ` (đa dạng hoá).
- `nopTepExpiresAt(createdAt)` = `createdAt + 60 × 86 400 000 ms` (Việt Nam không có giờ mùa hè). `isNopTepExpired(f, now)` = `f.deletedAt == null && f.expiresAt.getTime() < now.getTime()` (so sánh **nghiêm ngặt**; đúng bằng mốc chưa hết hạn). `describeNopTepFile(f, viewer)` → dạng trả ra API (mục 3.4) — **một nơi duy nhất** quyết trường nào được ra.
- `canViewNopTepFile(ctx)` (thuần, bảng quyền ở 3.3) để test không cần DB.

`src/lib/nopTepServer.ts` (máy chủ; **chỉ import** từ `mediaStorageServer.ts`, không sửa nó): `cloudinaryNopTepPublicId(courseId, assignmentId, fileId, ext)` = `kin-nop-bai/<courseId đã làm sạch>/<assignmentId>/<fileId>.<ext>`; `readAllLimited(driver, key, max)` (tải trọn tệp ≤ 10 MiB để kiểm: Cloudinary qua `cloudinarySignedRawUrl`, local qua `fs`, dừng khi vượt trần, không tin `Content-Length`); `deleteStored(file)` (Cloudinary `cloudinaryDestroy` — "không tìm thấy" coi là thành công — hoặc `removeLocal`); `loadAssignmentScope(assignmentId)` (khoá lớp + bài + `isLearnerVisible`); `runNopTepExpiry(...)` (mục 4).

### 3.2 Đường API (tất cả thư mục MỚI; chủ sở hữu stu-code, xem mục 7/10)

| Đường | Ai | Việc |
|---|---|---|
| `POST /api/media/nop-bai/init` | học sinh (kind `student`) hoặc người chấm (kind `tutor_return`, cần `submissionId`) | Kiểm quyền + điều kiện (3.3), `validateNopTepRequest`, đếm tối đa 3 (khoá `pg_advisory_xact_lock(hashtext('nop-tep:'+assignmentId+':'+studentId))` như `topups/approve`), tạo hàng `pending`, **dọn tệp `pending` quá 24 giờ của chính người này**, trả `{ fileId, driver, maxBytes, upload }` (Cloudinary: `cloudinaryDocUploadInit` với `public_id` do máy chủ chọn, `type=authenticated`, `overwrite=false`; local: `PUT /api/media/nop-bai/dai/<fileId>`). Không nhận byte. |
| `PUT /api/media/nop-bai/dai/[fileId]` | chủ hàng `pending`, **chỉ driver local & không production** | Ghi luồng bằng `writeStreamLimited` (dừng khi vượt `maxBytes`, không tin `Content-Length`). Production ⇒ 404. |
| `POST /api/media/nop-bai/complete` | người tải | `{fileId}`. Đo dung lượng thật (`cloudinaryVerify`/`stat`), `size ≥ 1` và `< maxBytes`, tải trọn tệp, `inspectDocx`/`inspectPdf` theo đuôi, băm `sha256`, đếm lại tối đa 3 theo thứ tự `(createdAt, id)` (tệp thứ 4 bị từ chối), ⇒ `ready`. **Sai ở bất kỳ bước nào ⇒ xoá tệp gốc + xoá hàng.** Gọi lại khi đã `ready` ⇒ 200 như cũ (idempotent). |
| `POST /api/media/nop-bai/[fileId]/xoa` | người tải (học sinh: tệp của mình; gia sư: tệp mình trả) | Đặt `removed`, xoá kho ngay (`deleteStored`); lỗi mạng ⇒ giữ `removed` với `deletedAt` null để cron bước 3 thử lại. Học sinh chỉ bỏ được khi bài chưa chấm, hoặc sau xác nhận (nộp lại xoá điểm, như cũ). |
| `GET /api/media/nop-bai/danh-sach?assignmentId=` (học sinh) · `?submissionId=` (người chấm) | theo 3.3 | `{ enabled, limits, files:[…] }` (3.4). |
| `GET /api/media/nop-bai/[fileId]` (`?xem=1` chỉ PDF) | theo 3.3 | Tải/xem (3.5). |
| `POST /api/student/nop-bai/[assignmentId]/nop` | học sinh | **Form POST + 303.** Chốt bài nộp (3.2.1). |
| `POST /api/media/nop-bai/dinh-kem` | người chấm | JSON `{ submissionId, fileIds[] }`: gắn tệp trả bài đã `ready` vào bài nộp; xoá khỏi tệp trả cũ nếu thay; thông báo "đã trả bài". JSON (không 303) vì chạy trong khung chấm điểm, không rời trang. |

**3.2.1 `nop` (form + 303).** Kiểm: phiên học sinh; bài tập `mode≠azota`, mục `published` (`isLearnerVisible`), ghi danh `active` (cùng thứ tự với `submit/route.ts:28-39`: bài Nháp/Ẩn ⇒ 404 TRƯỚC kiểm ghi danh); không đang nghỉ lớp (`suspendedLessonBlock`). Trong một `$transaction` (khoá advisory như trên): lấy các tệp `student`/`ready`/`submissionId=null` của người này ở bài này (phải có ≥1, ≤3); `upsert` `AssignmentSubmission` `{kind:"tep", fileUrl:"/api/media/nop-bai/<id đầu>", fileName: tên đầu đã làm sạch, submittedAt: now}`; **nếu là nộp lại**: xoá điểm/nhận xét như hành vi cũ (`submit/route.ts:55-64`), đặt `removed` mọi tệp cũ đã gắn của bài nộp này (kể cả tệp gia sư đã trả: nhận xét cũ cũng bị xoá, cùng lý do) và xoá kho SAU giao dịch; gắn `submissionId` cho tệp mới. Bấm đúp / hai tab: lần hai không còn tệp "chưa gắn" nhưng bài nộp đã có đúng các tệp ấy ⇒ coi là thành công (idempotent), vẫn 303 `?nop=ok`. Thông báo cho người chấm (3.6). 303 về `/student/bai-giang/<lessonId>?nop=ok` hoặc `?nop=loi-chua-co-tep|loi-lop|loi-tat` (mã, không dán chữ người dùng vào URL).

### 3.3 Bảng quyền (mặc định TỪ CHỐI; một chỗ quyết: `canViewNopTepFile`, route chỉ gọi)

Điều kiện chung: tệp `status=ready`, `deletedAt=null`, `expiresAt ≥ now`. Người có quyền mà tệp hết hạn nhận **410** + câu "Tệp đã được xoá sau 60 ngày. Điểm và nhận xét vẫn giữ."; người không có quyền không thấy khác biệt (404/403 như bảng).

| Người gọi | Tệp học sinh nộp | Tệp gia sư trả | Trả về nếu không được |
|---|---|---|---|
| Khách (chưa đăng nhập) | không | không | **401** |
| Học sinh — chủ bài nộp, còn ghi danh `active` và không nghỉ lớp | **xem + tải + xoá của mình** | xem + tải (chỉ khi đã `dinh-kem`) | — |
| Học sinh khác (kể cả cùng lớp) | không | không | **404** (không lộ tồn tại) |
| Học sinh cũ đã nghỉ lớp/ngưng | không (khớp quyết định 06/11: không còn thấy bài đã nộp) | không | 403 `enrollmentDeniedBody` |
| Chủ lớp (`owner`) | xem + tải (chỉ tệp ĐÃ nộp: `submissionId≠null`) | xem + tải + trả + xoá tệp mình trả | 403 `ROLE_FORBIDDEN` |
| Đồng giảng đang hiệu lực (`co_teacher`, ma trận có `grade`) | xem + tải | xem + tải + trả | — |
| Đồng giảng **chưa chấp nhận / đã bị gỡ / bị khoá** (`CourseTeacher.status≠active`) | không (`loadCourseAccess` đọc lại DB, mất quyền ngay) | không | 403 |
| Giáo viên bộ môn: bài trong nhóm giao cho mình hoặc bài do mình soạn | xem + tải (**tên tệp ẩn** nếu `namesVisible=false`) | xem + tải + trả | — |
| Giáo viên bộ môn: bài ngoài nhóm | không | không | 403 |
| Gia sư lớp khác | không | không | **403** |
| Quản trị cấp 1 / nội dung (`admin_super`, `admin_content`) | xem + tải (đã có quyền xem/chấm bài nộp ở `requireAssignmentAccess`); **mỗi lượt ghi `logAction("submission_file.download")` chỉ gồm `fileId`, `assignmentId`, không tên tệp** | như vậy | — |
| Phụ huynh đã liên kết (`ParentLink` verified) | **KHÔNG** (mặc định; câu hỏi chờ chủ Q2) | không | 403 |
| Gia sư/đồng giảng khi tệp CHƯA nộp (`submissionId=null`, bản nháp của học sinh) | không | chỉ người tải | 404 |

Cổng quyền phía chấm dùng lại **nguyên** `requireAssignmentAccess(assignmentId, "grade")` (`courseAccessServer.ts:257`) — cùng cổng với `GET …/submissions` và `PATCH …/grade`, nên "ai chấm được bài thì xem được tệp bài đó", không thêm ma trận mới; **không sửa** tệp đó.

### 3.4 Trường trả ra API

`describeNopTepFile` trả đúng: `{ id, kind, name, ext, sizeBytes, status, createdAt, expiresAt, expired: boolean, href }` với `href = /api/media/nop-bai/<id>`; `name` = tên đã làm sạch, hoặc `"Bài nộp <n>.<ext>"` khi `namesVisible=false`.
**KHÔNG BAO GIỜ trả** (kiểm bằng `JSON.stringify(resp)` không chứa các chuỗi này): `storageKey`, `driver`, `sha256`, `ownerUserId`, `studentUserId` cho người không phải chủ, `courseId`, bất kỳ địa chỉ `cloudinary.com`/`res.cloudinary.com`/`api.cloudinary.com`, chữ ký, khoá API; tệp/bài nộp của học sinh khác; nội dung `comment`/`score` chưa chấm. Học sinh nhận thêm `retentionDays` và `limits`; không nhận danh sách tệp của lớp.

### 3.5 Tải xuống

`GET /api/media/nop-bai/<fileId>`: thứ tự **401 → định dạng id (404) → hàng có & quyền (3.3) → hết hạn (410) → phát**. Tiêu đề: `Content-Type` **từ bảng đuôi** (không từ tệp/trình duyệt), `Content-Disposition: attachment; filename*=UTF-8''<tên đã làm sạch>` (PDF + `?xem=1` ⇒ `inline`), `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`, `Content-Security-Policy: default-src 'none'; sandbox` (PDF: `default-src 'none'`), `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`; hỗ trợ `Range` như `/api/media/[id]/file` (tái dùng `parseRangeHeader`). Cloudinary: máy chủ tải bằng địa chỉ ký (`cloudinarySignedRawUrl`) rồi chuyển tiếp luồng.

**Về "URL ký hạn ngắn":** tôi KHÔNG đưa cho trình duyệt một URL ký rời. Đường tải là proxy có kiểm phiên + quyền ở MỖI lượt; phần "ký" là chữ ký Cloudinary giữa máy chủ KiN và Cloudinary, không bao giờ rời máy chủ. Lý do: URL ký hạn ngắn vẫn chuyển tiếp/dán vào nhóm Zalo được trong thời hạn; proxy thì link vô dụng với người ngoài phiên. Cloudinary bản không phải enterprise cũng không có URL hết hạn theo thời gian (chữ ký `s--…--` không mang `expires`). Test "URL ký hết hạn" trong yêu cầu được thay bằng test **`expiresAt` thực thi ngay cả khi cron chưa chạy** (mục 8). Nếu COO vẫn cần token HMAC hạn 5 phút: đó là việc thêm, không thay thế.

### 3.6 Thông báo (không tên, không tiền, không tên tệp)

Dùng `notify()` có sẵn (`notify.ts`), loại mới, **chỉ trong ứng dụng** (không thêm vào `pushRules`, không đẩy ra điện thoại):
- `submission_received` → người chấm của bài: chủ lớp, hoặc giáo viên bộ môn nhóm chứa bài (`Assignment.ownerId` / `chapter.teacherId`; đồng giảng không bị spam). Tiêu đề "Có bài nộp mới"; nội dung "Một học sinh vừa nộp bài. Mở để xem và chấm."; link `/lop-cua-toi/bai-tap`. Không có tên học sinh, tên tệp, tên bài, số lượng.
- `submission_returned` → học sinh. Tiêu đề "Gia sư đã trả bài"; nội dung "Bài của bạn đã được trả. Mở để xem điểm và nhận xét."; link `/student/bai-giang/<lessonId>`.
- Tuỳ chọn (xin COO ở mục 10): `notify` trong `PATCH …/grade` để trả bài **không kèm tệp** cũng báo học sinh; nếu không, chỉ trả bài kèm tệp mới có thông báo.
- Dọn dữ liệu: khi `Assignment` bị xoá (`api/assignments/[id]` DELETE, cascade xoá bài nộp) và khi ẩn danh hoá tài khoản (`account-delete.ts` của ADM-xoa-tk) phải gọi `purgeSubmissionFiles({assignmentId}|{studentUserId})` trước; mục 10. Nếu chưa gọi, tệp mồ côi vẫn bị cron dọn khi `expiresAt` qua (tối đa 60 ngày), và không ai tải được vì không còn bài nộp để kiểm quyền (404).

---

## 4. Cron hết hạn

- Đường: `GET /api/cron/het-han-tep-nop-bai`. Khoá `het-han-tep-nop-bai`. Thêm vào `CRON_JOBS` (`adminOps.ts:58`) và `vercel.json`; lịch `30 18 * * *` (UTC) ⇒ "Mỗi ngày 01:30 giờ VN", `maxGapHours: 36`. Khớp `t-adm-003-lib` (lịch dạng `phút giờ * * *`, hai chiều `vercel.json` ↔ `CRON_JOBS`, route gọi `recordCronRun("het-han-tep-nop-bai")` sau `checkCronAuth`, **không** bọc `try` trước `recordCronRun`).
- Bảo vệ: `checkCronAuth(process.env.CRON_SECRET, authorization)` (`cronAuth.ts:17`) đầu tiên — thiếu/ngắn ⇒ 503, sai ⇒ 401, như `article-publish/route.ts`. Cron hỏng ồn ào hơn là mở cửa.
- **Chế độ:** mặc định **chạy khô** (đếm + liệt kê id, không chạm kho, không ghi DB ngoài `recordCronRun`). Chỉ xoá thật khi query `xoa=1`. `vercel.json` của PR này giữ `"path": "/api/cron/het-han-tep-nop-bai"` (khô); chuyển sang `"…?xoa=1"` là commit sau, kèm dòng cập nhật `CRON_JOBS.path` để hai chiều vẫn khớp. (Vercel Cron cho `path` có query — cần xác nhận ở log ngày đầu; nếu không, cờ chuyển sang giá trị `SettingKV` `nopTep.cron.xoa=1` đặt từ trang Triển khai.)
- **Điều kiện xoá — chỉ ba tập, mỗi tập một câu `where` được xuất ra từ lib và khớp hàm thuần:**
  1. **Hết hạn:** `deletedAt = null AND expiresAt < now` (mọi `status` trừ đã `expired`). Chính xác 60 ngày đúng giây chưa xoá; 60 ngày + 1 ms xoá.
  2. **Tải dở:** `status = "pending" AND createdAt < now − 24 giờ AND submissionId = null`.
  3. **Bỏ đi nhưng kho còn:** `status = "removed" AND deletedAt = null` (thử lại lần xoá kho thất bại).
  Không còn tập nào khác; không có `deleteMany` toàn bảng; không có nhánh "xoá theo bài/lớp" trong cron.
- **Giới hạn:** mỗi tập `take: 100`, sắp theo `expiresAt`/`createdAt` tăng; ngân sách thời gian 8 giây (hàm Vercel gói thấp chạy ngắn), song song ≤5 lệnh xoá Cloudinary; hết ngân sách ⇒ `partial: true`, phần còn lại ngày mai.
- **Thứ tự để lỗi giữa chừng không mất bản ghi:** với mỗi tệp: (1) xoá tệp gốc ở kho (`deleteStored`; "không tìm thấy" = thành công); (2) **chỉ khi (1) thành công** mới cập nhật hàng `status="expired"`, `expiredAt=now`, `deletedAt=now` (có điều kiện `where: {id, deletedAt: null}` để hai lần chạy chồng nhau không giẫm); (3) lỗi ở (1) ⇒ hàng giữ nguyên, đếm `failed`, thử lại ngày mai; lỗi DB ở (2) sau khi kho đã xoá ⇒ lần sau (1) trả "không tìm thấy" = thành công rồi cập nhật. Không bao giờ xoá hàng `SubmissionFile` (giữ làm dấu vết). **Không chạm `AssignmentSubmission`** (score/comment/gradedAt/gradedBy/submittedAt, `fileUrl`, `fileName` nguyên vẹn).
- **Log:** `console.info` một dòng JSON `{ job, dryRun, at, sets:{expired:{found,deleted,failed,ids}, pending:{…}, removed:{…}}, partial }` (`ids` ≤100 phần tử là `fileId`, **không tên tệp, không id học sinh**) + phản hồi JSON y hệt, `no-store`. Admin xem "lần gọi gần nhất" ở trang Triển khai qua `recordCronRun` có sẵn.

---

## 5. Luồng màn (khối bài tập trong trang bài giảng học sinh; 1280 và 390)

Thay `AssignmentCard`'s khối nộp (`bai-giang/[lessonId]/page.tsx:164-233`) bằng một thành phần mới; giữ phần tiêu đề, hướng dẫn, tệp đề bài, hạn và khối điểm/nhận xét. Bố cục: một cột trong thẻ bài tập; ở 1280 vùng thả + danh sách nằm cạnh nhau (7/5) khi thẻ rộng ≥ 720px, ở 390 xếp dọc. Một nút đặc mỗi màn: **"Nộp bài"**. Mọi nút ≥ 44px; trạng thái bằng CHỮ, không chỉ màu; token `--kin-*` (vùng thả: viền nét đứt `--kin-vien-o-nhap`, nền `--kin-nen-bang`, bo `--kin-bo-xl`, cao tối thiểu 160px ở 1280 / 132px ở 390).

**Học sinh** (đã đăng nhập, đã ghi danh):
1. **Trống:** vùng thả "Kéo tệp Word hoặc PDF vào đây" + nút **"Chọn tệp"** (44px, bắt buộc cho điện thoại, `<input type="file" accept=".docx,.pdf" multiple>`) + dòng nhỏ "Chỉ nhận .docx và .pdf, dưới 10 MB mỗi tệp, tối đa 3 tệp. Tệp được giữ 60 ngày rồi tự xoá." + khung cảnh báo (TRẺ EM): "Đừng đưa ảnh có mặt người, số điện thoại hay địa chỉ nhà vào bài." Nút "Nộp bài" tắt (có chữ lý do "Chọn ít nhất 1 tệp").
2. **Đang chọn/tải:** mỗi tệp một hàng ≥56px: biểu tượng loại tệp, tên (cắt giữa, đủ tên trong `title`), dung lượng "182 KB", thanh tiến độ `role="progressbar"` + chữ "Đang tải lên… 60%", rồi "Đã kiểm tra, sẵn sàng" / "Không dùng được: <lý do>"; nút "Bỏ tệp" 44px. Tiến độ lấy từ `XMLHttpRequest.upload.onprogress` gửi thẳng lên Cloudinary (hoặc `PUT` local). `aria-busy` khi đang tải.
3. **Sẵn sàng:** "Nộp bài" bật khi ≥1 tệp `ready`; khi bấm là form POST thường (nút submit thật), nút hiện "Đang nộp…" và tắt (chống bấm đúp; máy chủ vẫn idempotent).
4. **Đã nộp:** dải "Đã nộp lúc 20:41 ngày 09/11/2026." (mốc từ máy chủ, giờ Việt Nam) + danh sách tệp (tên, dung lượng) + mỗi tệp dòng nhỏ "Tải được đến 20:41, 08/01/2027; sau đó tệp bị xoá, điểm và nhận xét vẫn giữ." + nút "Tải xuống" (liên kết `href`) + **"Nộp lại bài"** (viền). Chưa chấm: "Gia sư sẽ chấm và nhận xét." Đã chấm: khối điểm/nhận xét như cũ + các tệp gia sư trả ("Tệp gia sư trả bài", có "Tải xuống"); nộp lại hỏi xác nhận (hộp `useKinConfirm` đã có) "Nộp lại sẽ xoá điểm, nhận xét và tệp gia sư đã trả."
5. **Hết hạn:** thay danh sách bằng "Tệp đã được xoá sau 60 ngày; điểm và nhận xét vẫn giữ." (điểm/nhận xét hiện bình thường). Không còn nút tải.
6. **Lỗi** (chữ + việc làm tiếp, không chỉ đỏ): đuôi sai "Tệp này không phải Word hoặc PDF. Hãy lưu thành .docx hoặc .pdf rồi chọn lại." · ảnh "KiN không nhận ảnh làm bài. Hãy chụp vào tài liệu Word/PDF hoặc nộp bằng link Azota." · >10 MB "Tệp lớn hơn 10 MB. Hãy nén ảnh trong bài hoặc chia nhỏ tệp." · nội dung không khớp "Nội dung tệp không phải Word/PDF. Hãy xuất lại tệp từ Word." · macro/nhúng "Tệp có macro hoặc đối tượng nhúng nên không nhận. Hãy lưu thành tệp thường." · quá 3 tệp "Mỗi bài chỉ nộp tối đa 3 tệp." · mạng "Không tải lên được. Kiểm tra mạng rồi bấm Thử lại." (nút "Thử lại" 44px, giữ các tệp đã `ready`) · tắt "Tính năng nộp tệp chưa bật. Bạn vẫn nộp được bằng link Azota." · 429 "Bạn thao tác hơi nhanh, đợi một chút."
7. Ba trạng thái dữ liệu của khối: **đang tải** (khung xương), **trống** (như 1), **lỗi tải danh sách** (`ErrorStrip` + "Thử lại").

**Khách / chưa đăng nhập / chưa ghi danh:** không thấy vùng thả (trang bài giảng đã chặn từ trước); gọi API ⇒ 401/403. **Học sinh đã nghỉ lớp:** không thấy khối này (cùng `SuspendedNotice` có sẵn).

**Gia sư** (khung chấm trong `components/tutor/BaiTap.tsx`, GradePanel — `BaiTap.tsx:107-139`): dưới dòng tên bài nộp thêm danh sách tệp của học sinh (tên đã ẩn nếu `namesVisible=false`, dung lượng, "Tải xuống", PDF có thêm "Xem"), thay nút "Mở bài nộp gốc ↗" (vẫn chạy với tệp đầu nhờ `fileUrl`, mục 2). Phía dưới ô điểm/phản hồi thêm khung **"Tệp trả bài (tuỳ chọn)"**: một vùng thả nhỏ cùng luật (docx/pdf, <10 MB, ≤3), cùng trạng thái lỗi; bấm "Gửi điểm & phản hồi" ⇒ `PATCH …/grade` (có sẵn) rồi `POST /api/media/nop-bai/dinh-kem`; nếu bước 2 lỗi, giữ điểm đã gửi và hiện "Điểm đã gửi, chưa đính kèm được tệp. Thử lại." Khi hết hạn: "Tệp đã được xoá sau 60 ngày; điểm và nhận xét vẫn giữ." Đồng giảng/bộ môn thấy y hệt trong phạm vi quyền ở 3.3.

**Tương thích luồng cũ (giữ / thay / siết):**
- GIỮ: nộp bằng link Azota (`linkUrl`, `validateWorkLink`), `kind:"link"`; bài nộp cũ `kind:"file"` hiển thị như cũ (nhãn "Tệp cũ (lưu công khai)") và không bao giờ bị cron đụng (không có `SubmissionFile`).
- THAY: nút/`DropZone`/`uploadToCloudinary` trong `AssignmentCard` bằng thành phần mới; `api.assignments.submit` không còn được gọi từ trang học sinh.
- SIẾT (nhỏ, cùng phiếu): `POST /api/assignments/[id]/submit` bỏ nhánh `fileUrl`/`fileName` do trình duyệt gửi ⇒ trả 400 "Hãy dùng chức năng nộp tệp mới" (chỉ nhánh `linkUrl` Azota còn). Chỉ một nơi gọi (`page.tsx:177`) nên không vỡ ai. Cần xin COO sửa tệp này (mục 10). Nếu COO không cho: ghi nợ P2 "đường cũ vẫn nhận mọi URL" và giữ.
- BACKLOG (không làm ở đây): dọn các tệp công khai cũ đã lên Cloudinary bằng preset không ký (tên thư mục `assignments/submissions`): với ba biến có khoá bí mật có thể xoá hàng loạt theo `public_id` suy ra từ URL — đây là dữ liệu học sinh đang công khai, chủ nên quyết nhanh (câu hỏi Q4).

---

## 6. Cờ

**TIỀN = không.** Không đụng `fee*`, `invoice*`, `sessionBook*`, Coin, điểm thưởng. Chi phí duy nhất: dung lượng Cloudinary (tự giới hạn bởi 60 ngày + 3 tệp × 10 MB mỗi bài nộp).

**TRẺ EM = CÓ.** Đây là bài làm của học sinh, người học ≥17 theo quyết định 25/10 nhưng cổng ≥17 vẫn tắt (`KIN_ENROLL_CONSENT_GATE`) nên hệ thống thực tế **không kiểm tuổi**: coi như có em nhỏ hơn. Việc đã làm để không thu thêm dữ liệu cá nhân:
- Không thu trường mới về người; chỉ tên tệp (có thể là tên thật: "Nguyen Van A - Toan.docx"). Tên tệp CHỈ hiện cho học sinh chủ bài + người có quyền chấm; **không** vào log máy chủ, log cron, thông báo, audit, thông điệp lỗi, URL, tên trả về của giáo viên bộ môn ngoài nhóm (nhãn chung "Bài nộp 1.docx"), tên `Content-Disposition` cho họ.
- Chặn mọi đường nhận ảnh/video (đuôi + magic bytes). Nhưng **tệp Word/PDF vẫn có thể NHÚNG ảnh** (kể cả ảnh có mặt người) hoặc chứa tên/SĐT/thuộc tính tác giả (`docProps/core.xml` thường điền tên tài khoản Word). KiN không phát hiện được: giảm bằng cảnh báo trên màn nộp (mục 5), 60 ngày tự xoá, đúng 2 nhóm người xem. Chưa chặn `word/media/` vì bài toán/vẽ hình thường nhúng ảnh hợp lệ (câu hỏi Q3).
- Giữ tối thiểu: chỉ giữ một bộ tệp hiện hành (nộp lại xoá bộ cũ ngay), hết 60 ngày tự xoá, dọn bản nháp 24 giờ.
- Xoá tài khoản (ADM-xoa-tk giữ bài làm): phải xoá tệp (mục 3.6, 10).
- Bài tập thuộc lớp có học sinh <16/<18 nếu sau này bật cổng đồng ý ParentConsent: không đổi gì ở đây, nhưng chủ cần nhớ tệp lưu ở Cloudinary (bên thứ ba, máy chủ ngoài Việt Nam) — một dòng cho luật sư khi duyệt chính sách bảo mật (căn cứ để hỏi, không phải ý kiến pháp lý).

**ĐỔI NỀN = như đầu tệp:** KHÔNG nếu ba biến Cloudinary đã có ở production; CÓ ở mức "thêm biến môi trường" nếu chưa. Phương án C (Vercel Blob) và B (bytea) là ĐỔI NỀN/đổi cách dùng — không khuyến nghị. Không thêm thư viện: zip đọc bằng `node:zlib` + DataView tự viết (không `jszip`/`adm-zip`); nếu stu-code muốn thư viện, đó là ĐỔI NỀN nhỏ phải hỏi.

**Quét mã độc: KHÔNG.** Không có virus scan. Có: kiểm cấu trúc (docx: danh mục zip, chặn macro/ActiveX/nhúng/zip-slip/zip bomb; pdf: chặn `/Launch /JavaScript /JS /EmbeddedFile /Encrypt`), tên tệp làm sạch, `attachment` + `nosniff` + CSP sandbox, không bao giờ thực thi/mở nội dung trên máy chủ. Hạn chế nói thẳng: PDF giấu lệnh trong luồng nén, hay docx dùng lỗ hổng trình đọc Word, không bị bắt. Gia sư tải về và mở bằng Word/PDF của họ; đề nghị ghi trong màn gia sư "Bật chế độ xem bảo vệ của Word". ClamAV không chạy được trên Vercel; dịch vụ quét ngoài (VirusTotal…) gửi bài làm của học sinh ra bên thứ ba ⇒ TRẺ EM + ĐỔI NỀN, không làm.

---

## 7. Chia việc và phạm vi tệp (không trùng)

**stu-code** (mọi tệp MỚI trừ khi ghi khác):
- `src/lib/nopTep.ts`, `src/lib/nopTepServer.ts` (mục 3.1)
- `src/app/api/media/nop-bai/**`: `init/route.ts`, `complete/route.ts`, `dai/[fileId]/route.ts`, `danh-sach/route.ts`, `dinh-kem/route.ts`, `[fileId]/route.ts`, `[fileId]/xoa/route.ts` — **thư mục mới trong `api/media`, cần COO giao (mục 10 #1)**
- `src/app/api/student/nop-bai/[assignmentId]/nop/route.ts` (thuộc `api/student/**` — của phòng Học sinh)
- `src/app/api/cron/het-han-tep-nop-bai/route.ts` (**`api/cron/**` thuộc adm-code ⇒ xin COO giao một tệp mới cho stu-code, mục 10 #2**) + `src/lib/nopTepExpiryServer.ts`
- `prisma/schema.prisma` (thêm một model; tệp chung ⇒ mục 10 #3)
- Test: `tools/local-e2e/t-nop-tep-lib.ts`, `t-nop-tep.ts`, `t-nop-tep-het-han.ts` (mục 8)

**stu-dev:**
- `src/components/student/nop-tep/NopTepBox.tsx` (vùng thả + danh sách + tiến độ + lỗi + trạng thái đã nộp/hết hạn; dùng chung cho tệp trả bài qua prop `mode: "student" | "tutor_return"`), `src/components/student/nop-tep/nopTepClient.ts` (gọi init → tải → complete, XHR có tiến độ)
- `src/app/(student)/student/bai-giang/[lessonId]/page.tsx`: thay khối nộp trong `AssignmentCard` (`:164-233`), bỏ `uploadToCloudinary`/`cloudinaryConfigured` khỏi trang
- Test giao diện: `tools/local-e2e/ui-nop-tep.ts`

**Phòng Gia sư sở hữu — phải xin COO (mục D), mỗi việc nhỏ và một tệp:**
- `src/components/tutor/BaiTap.tsx` (tut-dev): ghép `<NopTepBox mode="tutor_return">` + danh sách tệp học sinh vào `GradePanel` (≈10 dòng), thay `:112` "Mở bài nộp gốc" bằng danh sách; gọi `dinh-kem` sau `api.assignments.grade`. stu-dev dựng toàn bộ thành phần, tut-dev chỉ ghép — để không vỡ ranh giới `components/tutor/**`.
- Không cần sửa `src/app/lop-cua-toi/**`, `api/tutor/**`, `api/courses/**` (không có việc nào ở đó). Trang chấm của gia sư hiện là `lop-cua-toi/(tutor)/bai-tap/page.tsx` → `BaiTap.tsx`; API chấm là `PATCH /api/assignments/[id]/submissions/[submissionId]/grade` (không đổi).

**Phần phòng Học sinh tự làm được:** mọi thứ trừ các việc xin COO ở mục 10 (tệp mới trong `api/media`, cron, schema, siết `submit`, ghép UI gia sư).

---

## 8. Test phải có

**`t-nop-tep-lib` (thuần, không máy chủ):**
- `nopTepConfig`: production đủ 3 biến ⇒ cloudinary bật; thiếu 1/3 ⇒ tắt + `reason`; chỉ có `NEXT_PUBLIC_CLOUDINARY_*` (preset không ký) ⇒ **tắt** (không rơi về đường công khai); dev ⇒ local.
- Đuôi/MIME: `.docx`,`.pdf` ok; `.DOCX` ok; `a.docx.exe` ⇒ chặn; `a.exe` đổi tên `.pdf` (kiểm ở `inspect`); `.png/.jpg/.heic/.svg` ⇒ `blocked_image`; `.mp4/.mov` ⇒ `blocked_video`; `.docm/.xlsm` ⇒ `blocked_macro_ext`; `.zip/.rar` ⇒ chặn; `.doc` ⇒ gợi ý lưu `.docx`; MIME khai `image/png` với đuôi `.docx` ⇒ `bad_mime`; MIME trống/`octet-stream` ⇒ không báo (nội dung quyết).
- Kích thước: `0` ⇒ rỗng; `10 MiB − 1` ⇒ nhận; `10 MiB` ⇒ từ chối; `10 MiB + 1` ⇒ từ chối; `NaN`/âm ⇒ từ chối.
- Tên: `../../etc/passwd.docx`, `C:\x\y.docx`, `a\u202Efdp.docx`, tên 400 ký tự giữ nguyên đuôi, tên rỗng/chỉ dấu chấm, ký tự điều khiển, emoji; kết quả luôn không có `/`, `\`, không bắt đầu bằng `.`.
- `inspectDocx` với tệp dựng bằng tay (mảng byte): docx hợp lệ (có `[Content_Types].xml` + `word/document.xml`) ok; **xlsx đổi tên .docx ⇒ từ chối**; zip thường đổi tên ⇒ từ chối; docx có `word/vbaProject.bin` ⇒ từ chối; `[Content_Types].xml` có `macroEnabled` ⇒ từ chối; có `word/embeddings/` ⇒ từ chối; tên mục `../evil.xml` ⇒ từ chối; zip bomb (khai 1 GiB giải nén, tỉ số 10 000) ⇒ từ chối mà **không giải nén**; 5.000 mục ⇒ từ chối; EOCD hỏng/cụt ⇒ từ chối không ném lỗi; ảnh PNG đổi `.docx` ⇒ từ chối.
- `inspectPdf`: `%PDF-1.7` + `%%EOF` ok; ảnh/`MZ`/`PK` đổi `.pdf` ⇒ từ chối; có `/JavaScript`, `/Launch`, `/Encrypt`, `/EmbeddedFile` ⇒ từ chối; thiếu `%%EOF` ⇒ từ chối; rỗng ⇒ từ chối.
- Hạn: `nopTepExpiresAt` = đúng 60×24 giờ; `isNopTepExpired` tại 59 ngày, 59,9 ngày, đúng 60 ngày (không), 60 ngày + 1 ms (có), 60,1 ngày (có), `deletedAt` đã có (không bao giờ).
- `describeNopTepFile`: JSON không chứa `storageKey|driver|sha256|ownerUserId|courseId|cloudinary`; `namesVisible=false` ⇒ tên chung, không tên thật.
- `canViewNopTepFile`: đủ bảng 3.3 (khách, học sinh chủ, học sinh khác, học sinh nghỉ lớp, chủ lớp, đồng giảng hiệu lực/bị gỡ, bộ môn trong/ngoài nhóm, gia sư lớp khác, admin, phụ huynh, tệp nháp).
- Quét tĩnh mã: các route mới **không** chứa `NEXT_PUBLIC_CLOUDINARY`, `upload_preset`, `secure_url`; mọi route `nop-bai` gọi `getSession`/`requireSession` trước khi chạm DB.

**`t-nop-tep` (API, máy chủ test cổng 3100, driver local):**
- Ca phá nội dung (qua `init` + `PUT` + `complete`): ảnh PNG/JPEG đổi `.docx` và `.pdf` ⇒ 400 và **không còn tệp trên đĩa, không còn hàng**; exe giả `.docx`; zip thường giả `.docx`; xlsx giả `.docx`; docx có macro; zip bomb; PDF có `/JavaScript`; tệp rỗng; **10 MiB + 1 byte** qua `PUT` ⇒ 413 và tệp dở bị xoá (kiểm dung lượng khi đọc luồng, không tin `Content-Length`: gửi `Content-Length: 10` nhưng thân 11 MiB); 4 tệp cùng lúc (`Promise.all` 4 `init`) ⇒ đúng 3 thành công; tên `../x.docx`, `..%2f`, MIME giả `image/png`/`text/html` với đuôi `.docx` ⇒ lưu với MIME theo bảng đuôi, `storageKey` không chứa tên.
- Quyền tải (đủ hàng của bảng 3.3): khách `401`; học sinh khác **404**; học sinh cùng lớp **404**; học sinh nghỉ lớp 403; gia sư lớp khác **403**; đồng giảng `status=invited`/`removed` ⇒ 403; bộ môn ngoài nhóm 403, trong nhóm 200 với tên chung; chủ lớp 200; admin 200 **và** có đúng một dòng audit không chứa tên tệp; phụ huynh có `ParentLink` ⇒ 403; tệp nháp (chưa `nop`) gia sư ⇒ 404; id lạ/NUL ⇒ 404.
- Tiêu đề phát: `Content-Disposition: attachment`, `nosniff`, `no-store`, `Content-Type` theo bảng đuôi dù tệp lưu tên khác; PDF `?xem=1` inline, docx `?xem=1` vẫn attachment; thân phản hồi đúng từng byte đã tải lên; **không phản hồi nào (JSON, header, lỗi) chứa `storageKey`, `kin-nop-bai`, `cloudinary`**.
- Hết hạn: sửa `expiresAt` về quá khứ 1 giây ⇒ tải 410 với chủ/gia sư, 404/403 với người không quyền (không phân biệt được), **ngay cả khi cron chưa chạy**; sau khi hết hạn điểm/nhận xét vẫn trả qua API cũ.
- Nộp trùng/tương tranh: bấm `nop` hai lần liên tiếp và 5 lần song song ⇒ đúng 1 `AssignmentSubmission`, các tệp gắn một lần, 303 cả năm; nộp lại ⇒ tệp cũ `removed` + file trên đĩa biến mất + điểm cũ bị xoá + tệp trả của gia sư bị gỡ; `nop` không có tệp ⇒ 303 `?nop=loi-chua-co-tep`; `nop` với tệp của học sinh khác (gửi `fileId` lạ) ⇒ không gắn.
- Siết cũ: `POST /api/assignments/[id]/submit` với `fileUrl` ⇒ 400 (nếu COO cho sửa); với `linkUrl` Azota ⇒ vẫn 200.
- Trả bài: gia sư lớp mình `init`(tutor_return) + `complete` + `dinh-kem` ⇒ học sinh thấy tệp; gia sư lớp khác `init` ⇒ 403; học sinh gọi `dinh-kem` ⇒ 403; thông báo `submission_returned` có đúng một dòng, nội dung không chứa tên/số/tên tệp; thông báo `submission_received` tương tự.
- Tắt cấu hình (giả production không biến): `init` ⇒ 409 + `reason`, không tạo hàng.
- Hồi quy: `t-assign`, `t-assign-contract`, `t-assign-lib`, `t-db-push-guard`, `t-media-api`, `t-media-security`, `t-adm-003-lib` + `t-admin-ops-lib` (số cron 6 → 7, ADM cập nhật), `ui-bai-tap-hs`, `ui-role-everything`, `ui-links-everywhere`, `t-no-fabricated`, `tsc --noEmit`.

**`t-nop-tep-het-han` (cron; chứng minh chỉ xoá đúng tệp quá hạn):**
- Dữ liệu: các hàng `ready` với `createdAt` cách đây 59 ngày; 59,9 ngày; 60,1 ngày; 61 ngày; một hàng đã `deletedAt`; một hàng của bài khác quá hạn; một hàng `pending` 25 giờ; một hàng `pending` 1 giờ; một hàng `removed` chưa xoá kho; một hàng `AssignmentSubmission` `kind:"file"` cũ (không có `SubmissionFile`); tệp thật trên đĩa cho từng hàng.
- Khô (không `xoa=1`): phản hồi liệt kê **đúng** id quá hạn (60,1; 61; bài khác; `pending` 25 giờ; `removed`), **không tệp nào trên đĩa bị xoá, không hàng nào đổi** (so ảnh chụp trước/sau toàn bảng).
- Thật (`xoa=1`): chỉ các hàng thuộc ba tập mới mất tệp trên đĩa và chuyển `expired`/`removed→deletedAt`; 59, 59,9, `pending` 1 giờ, hàng đã xoá, hàng cũ không `SubmissionFile` còn nguyên (tệp còn, hàng không đổi); `AssignmentSubmission.score/comment/gradedAt/gradedBy` của bài bị xoá tệp **bất biến** (so từng trường); chạy lần hai ⇒ `deleted:0` (idempotent).
- Lỗi giữa chừng: tiêm lỗi xoá kho (làm tệp không xoá được) ⇒ hàng KHÔNG đổi sang `expired`, `failed:1`, lần chạy sau (hết lỗi) xoá được; tiêm lỗi DB sau khi xoá kho ⇒ lần chạy sau vẫn hội tụ.
- Giới hạn: 250 hàng quá hạn ⇒ lần 1 xử lý ≤100 (`partial:true`), lần 2 tiếp, không hàng nào bị bỏ sót hay xử lý hai lần.
- Bảo vệ: không `Authorization` ⇒ 401; `CRON_SECRET` sai ⇒ 401; thiếu/ngắn ⇒ 503; mọi trường hợp đó **không** xoá gì (kiểm đĩa). Log một dòng JSON không chứa tên tệp, không chứa id học sinh.
- Khớp quản trị: `CRON_JOBS` có `het-han-tep-nop-bai`, `vercel.json` hai chiều, lịch đổi UTC→VN đúng "01:30".

**`ui-nop-tep` (Playwright, 1280 và 390, chụp ảnh):** ba trạng thái (đang tải/trống/lỗi tải danh sách, giả bằng chặn route); thả 1 `.docx` thật ⇒ thanh tiến độ rồi "Sẵn sàng"; thả `.png` ⇒ lỗi tại chỗ "KiN không nhận ảnh…" và **không có yêu cầu mạng tới `init`**; thả tệp 11 MB ⇒ lỗi dung lượng, không gọi mạng; 4 tệp ⇒ báo tối đa 3; "Nộp bài" tắt khi chưa có tệp, bấm đúp ⇒ một bài nộp; nút "Chọn tệp" mở hộp chọn ở 390; mọi nút ≥44px; 390 không cuộn ngang, tên tệp dài cắt giữa và có `title`; trạng thái đã nộp hiện "Tải được đến …" đúng ngày; trạng thái hết hạn hiện đúng câu và không có nút tải; khối cảnh báo hiện; học sinh nghỉ lớp không thấy khối; cấu hình tắt ⇒ câu "chưa bật" + còn nút nộp link Azota; phía gia sư (nếu COO cho ghép): danh sách tệp + khung trả bài + lỗi từng loại, "Gửi điểm & phản hồi" gọi `grade` rồi `dinh-kem`.

---

## 9. Câu hỏi còn mở ("chờ chủ") và giả định ghi vào PR

Mỗi câu có mặc định để stu-code không phải chờ.
- **Q1. Production đã có ba biến `CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET` chưa?** *(mặc định: coi như chưa biết ⇒ tính năng tự TẮT cho đến khi có; kiểm bằng `/api/media/config`.)* Đây là việc chặn duy nhất để bật thật.
- **Q2. Phụ huynh đã liên kết có được xem bài làm của con không?** *(mặc định: KHÔNG.)* Cộng thêm: quản trị trung tâm (`admin_super`/`admin_content`) xem được và có ghi nhật ký *(mặc định: có, vì họ đã xem được bài nộp qua API chấm hiện tại; chủ có thể cắt)*.
- **Q3. Ảnh NHÚNG trong Word/PDF:** chặn tệp có `word/media/` quá N ảnh/quá X MB, hay chỉ cảnh báo? *(mặc định: chỉ cảnh báo bằng chữ, vì bài toán/vẽ hình cần ảnh.)*
- **Q4. Các tệp bài làm CŨ đang công khai trên Cloudinary (thư mục `assignments/submissions`, preset không ký):** xoá/chuyển riêng tư hàng loạt khi đã có khoá bí mật? *(mặc định: để backlog, không làm ở đây; đề nghị chủ quyết sớm vì đó là bài làm của học sinh đang mở cho ai có link.)*
- Giả định khác (đổi một hằng số/dòng nếu chủ muốn khác): tối đa **3 tệp** mỗi bài nộp và mỗi lần trả bài; **không giữ nhiều phiên bản** (nộp lại thay thế, xoá bộ cũ và tệp gia sư đã trả); học sinh xoá tệp của mình trước khi chấm; chỉ `.docx` và `.pdf` (không `.doc`); `expiresAt` tính từ lúc **tải lên** (không từ lúc nộp/trả; chênh vài phút); không thông báo đẩy ra điện thoại cho hai loại thông báo mới; `10 MiB` là biên "dưới 10 MB".

---

## 10. Tệp chung / ngoài phòng cần xin COO (mẫu BAN-GIAO.md mục D)

1. **`src/app/api/media/nop-bai/**`** — thư mục MỚI trong `api/media` (PHAM-VI.md không ghi chủ). Xin giao cho stu-code. Phương án thay nếu không được: đặt toàn bộ ở `src/app/api/student/nop-bai/**` (đường tải thành `/api/student/nop-bai/tep/<id>`), mất tính đối xứng "mọi tệp tải xuống qua `/api/media`".
2. **`src/app/api/cron/het-han-tep-nop-bai/route.ts` + `src/lib/adminOps.ts` (thêm 1 dòng `CRON_JOBS`) + `vercel.json` (thêm 1 cron) + cập nhật `tools/local-e2e/t-admin-ops-lib.ts:38` (6 → 7 và danh sách đường dẫn)** — thuộc adm-code. Xin: adm-code làm đúng ba dòng cấu hình + cập nhật test; stu-code viết route + lib. Nếu COO muốn KHÔNG thêm cron: gộp vào `expire-tutor-subscriptions` (cùng lịch hằng ngày) bằng cách gọi `runNopTepExpiry` sau việc cũ trong **khối `try` riêng** để lỗi một bên không chặn bên kia; mất độc lập về theo dõi "lần gọi gần nhất" trên trang Triển khai và chế độ chạy khô riêng — **không khuyến nghị**.
3. **`prisma/schema.prisma`** — thêm model `SubmissionFile` (mục 2); chạy `t-db-push-guard`; một người sửa một lúc.
4. **`src/app/api/assignments/[id]/submit/route.ts`** — bỏ nhánh `fileUrl`/`fileName` do trình duyệt gửi (siết luồng cũ). Tệp không thuộc phòng nào; xin COO cho stu-code sửa đúng khối `:46-53`.
5. **`src/components/tutor/BaiTap.tsx`** (tut-dev) — ghép `NopTepBox` vào GradePanel (mục 7). Tuỳ chọn: một lệnh `notify(submission_returned)` trong `PATCH …/submissions/[submissionId]/grade/route.ts` để trả bài không kèm tệp cũng báo học sinh. Hai việc dọn khi xoá dữ liệu (hàm `purgeSubmissionFiles` gọi trong `api/assignments/[id]` DELETE và `account-delete.ts` của ADM-xoa-tk — adm-code) có thể làm sau trong một phiếu dọn, nhưng nên làm trước khi mở cho học sinh dùng rộng.
