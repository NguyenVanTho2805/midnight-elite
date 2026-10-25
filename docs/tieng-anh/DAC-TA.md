# Tiếng Anh tự học (IELTS 3.0 → 6.5) — đặc tả hệ thống

> Cập nhật 15/10/2026. Đây là một module **trong KiN**, dựng theo bản research "Web app tự học tiếng Anh IELTS 3.0 → 6.5".
> Nhánh: `claude/tieng-anh-ielts`. Không nằm trong backlog 151 việc (đã đối chiếu sheet backlog ngày 15/10, không có dòng nào về Tiếng Anh/IELTS).

## 1. Là gì, cho ai, nằm ở đâu

Một bộ công cụ tự học tiếng Anh nhắm **band 6.5 trong 26 tuần** cho người ở mức **3.0–6.5**, dễ nản. Ba kỹ năng chính là
Reading, Listening và Writing, đặt trên một **kho từ chung**. Mọi bài đọc, câu nghe, bài viết, bài thi thử đều đọc và ghi vào
cùng một sổ từ và một nhật ký học.

- **Địa chỉ:** `/student/tieng-anh`. Vào từ menu **Khác → Học tập → Tiếng Anh tự học** của vỏ học sinh.
- **Ai dùng được:** mọi tài khoản đã đăng nhập. Học sinh vào thẳng. Tài khoản quản trị và gia sư vào qua chế độ xem học sinh
  (`AuthGuard` cho phép `admin` xem khu học sinh). Dữ liệu luôn gắn với `userId` của phiên: không ai thấy dữ liệu người khác,
  gia sư cũng không thấy.
- **Không đụng tới:** Coin, học phí, lớp, ghi danh, phụ huynh. Module này đứng riêng, không đổi bảng cũ nào ngoài việc thêm
  quan hệ vào `User`.

## 2. Chín mục trên thanh tab

| Tab | Trang | Làm gì | Căn cứ (bản research) |
|---|---|---|---|
| Hôm nay | `/student/tieng-anh` | Thẻ **lộ trình 26 tuần** (chặng, tuần x/26, kỹ năng chính hôm nay, mốc thi thử kế tiếp). Kèm thẻ đến hạn, unit học tiếp, 3 bài đọc vừa sức, biểu đồ 7 ngày, chuỗi ngày học. | Thiết kế chống nản: không bắt người học tự quyết hôm nay học gì |
| Từ vựng | `/tu-vung`, `/tu-vung/xep-lop`, `/tu-vung/on` | Sổ từ (đang học / đã biết / bỏ qua). Kiểm tra xếp lớp yes/no 106 từ, có 10 từ giả. Phiên ôn thẻ FSRS, bắt nhớ trước khi lật, có chế độ "Chỉ có 10 phút". | NGSL + NAWL, FSRS, luyện truy xuất |
| Đọc | `/doc`, `/doc/[id]` | Danh sách bài xếp theo **độ phủ từ của chính người học**. Trang đọc tô màu từng từ, chạm từ để tra nghĩa đúng ngữ cảnh rồi "Học từ này" (tạo thẻ kèm câu gốc), 5 câu hỏi kiểu IELTS, "Đọc xong" đánh dấu các từ không chạm là đã biết. | Đọc mở rộng ở mức 95–98% từ quen; đọc kèm bài tập |
| Nghe | `/nghe`, `/nghe/[id]` | Chép chính tả từng câu (giọng máy, 3 tốc độ, gợi ý chữ cái đầu), chấm từng từ (đúng / sai chính tả / sót / thừa), shadowing có thu âm để tự nghe lại. | Sửa khâu giải mã âm trước khi luyện đề |
| Lớp học | `/lop-hoc`, `/lop-hoc/[bookId]`, `/lop-hoc/bai/[unitId]` | Sách PDF của người học (Grammar in Use, Improve your Skills…) thành bài học theo unit: tóm tắt tiếng Việt, ý chính, ví dụ, lỗi người Việt hay mắc, bài tập gốc chấm theo answer key, 10 câu biến thể do AI soạn và đã tự kiểm chứng. | Dạy ngữ pháp tường minh rồi luyện; mục "Lớp học từ sách" |
| Hỏi sách | `/hoi-sach` | Hỏi đáp kiểu NotebookLM **chỉ trong sách của mình**. Câu trả lời luôn ghi sách, unit, trang. Không tìm thấy thì nói thẳng. | Mục "Lớp học từ sách" |
| Viết | `/viet` | Task 1 / Task 2 / đoạn văn, đếm từ, bấm giờ. AI góp ý theo 4 tiêu chí và trả **khoảng band**, trích nguyên văn chỗ sai kèm cách sửa, nêu một việc ưu tiên. Có nút viết lại. | AI góp ý tốt, chưa tin được điểm tuyệt đối |
| Thi thử IELTS | `/thi-thu` | Phiếu 40 câu bấm giờ (Listening 32 phút, Reading 60 phút) để làm đề trong sách. Sau đó dán answer key, app chấm, quy đổi band, so với mục tiêu. Nhập band Writing/Speaking do người thật chấm. Band tổng ước tính. Lịch sử và xem lại phiếu. | Mock test, mốc tuần 6/14/22 |
| Tiến độ | `/tien-do` | Giờ học so với kế hoạch 312 giờ, phút học 12 tuần theo kỹ năng, tỉ lệ nhớ khi ôn, số từ nhớ chắc, độ chính xác chép chính tả theo tuần, biểu đồ band L/R theo thời gian, **Sổ lỗi** (câu làm sai mà chưa làm lại đúng, gom theo unit hoặc bài). | Đo tiến bộ bằng số thật, không dùng XP |

## 3. Năm luồng chính

1. **Một buổi học (120 phút):** Hôm nay → Ôn từ 20 phút → kỹ năng chính 50 phút (T2 Đọc, T3 Nghe, T4 Viết, T5 Đọc, T6 Nghe,
   T7 Viết hoặc Thi thử) → ngữ pháp 20 phút ở Lớp học → nghe nhẹ 20 phút. Chủ nhật nghỉ.
2. **Đọc → từ → ôn:** bài có độ phủ ≥ 95% → chạm từ lạ → nghĩa theo câu (AI, có cache) → "Học từ này" → thẻ nhận diện
   (mặt sau là chính câu gốc) → khi tốt nghiệp mở thẻ nhớ chủ động (gõ từ tiếng Anh từ nghĩa tiếng Việt) → thẻ chủ động
   đạt mức "chín" (lịch ≥ 21 ngày) thì từ thành "đã biết" → bài sau có độ phủ cao hơn.
3. **Sách → lớp học:** chọn PDF → **trình duyệt** tự trích chữ (pdf.js, file không rời máy) → gửi chữ theo lô 30 trang → máy chủ
   chia unit (tìm "Unit N" ở đầu trang, bỏ trang mục lục) và tìm phần answer key ở nửa sau sách → mỗi lượt gọi `/process` cấu
   trúc 2 unit bằng AI và nhúng tối đa 150 đoạn để tìm kiếm; trình duyệt gọi lặp tới khi xong → học unit → câu sai thành thẻ
   "làm lại" sau 1 ngày → unit đạt ≥ 80% là "vững", Hôm nay gợi ý unit kế tiếp.
4. **Thi thử:** Làm đề Reading → phiếu 40 ô, đồng hồ đếm ngược (hết giờ chỉ nhắc, không khoá), nháp lưu trong trình duyệt nên
   tải lại trang không mất bài → Nộp phiếu → dán answer key (app đọc được cả dạng mỗi dòng một câu lẫn đoạn liền, sửa tay được
   từng ô) → Chấm → điểm thô, band, câu sai.
5. **Sổ lỗi:** mọi câu bài tập làm sai có lần làm gần nhất vẫn sai, trong 60 ngày, gom theo unit hoặc bài. Nhóm nhiều lỗi nhất
   đứng đầu. Câu ngữ pháp sai đã tự vào hàng ôn.

## 4. Dữ liệu: 17 bảng mới, đều tên `eng_*`, chỉ thêm

| Bảng | Giữ gì | Ghi chú |
|---|---|---|
| `eng_profiles` | band mục tiêu, ngày thi, số từ mới/ngày, trần thẻ ôn/ngày (150), phút/ngày, đã xếp lớp chưa | 1 dòng / người |
| `eng_words` | kho từ chung: lemma, danh sách (`ngsl` / `sup` / `nawl` / `own`), thứ hạng, nghĩa VI, ví dụ | Nạp 3.807 từ lần đầu dùng |
| `eng_user_words` | trạng thái từng từ của từng người + câu gốc lúc bắt từ | Nền tính độ phủ bài đọc |
| `eng_cards` | thẻ FSRS; khoá `w:<wordId>:<loại>` hoặc `x:<exerciseId>`, unique theo người | 4 loại thẻ từ + thẻ "làm lại" |
| `eng_review_logs` | mỗi lượt ôn | Để tối ưu tham số FSRS sau này |
| `eng_texts` | bài đọc/nghe. `ownerId = null` là bài VOA công khai; có `ownerId` là bài riêng | `license`: `public-domain` / `private` |
| `eng_books`, `eng_book_pages` | sách và **chữ** từng trang | Không lưu file PDF |
| `eng_units` | unit: tóm tắt, ý chính, ví dụ, lỗi hay gặp | Theo sách, chỉ chủ sở hữu |
| `eng_chunks` | đoạn sách + `embedding vector(768)` (gemini-embedding-001) | Đọc/ghi qua `$queryRaw` như `question_bank_items` |
| `eng_exercises` | câu hỏi: 6 dạng (`gap`, `choice`, `transform`, `tfng`, `error`, `order`), mọi đáp án chấp nhận | `origin`: `book` / `ai`; `verified`, `flagged` |
| `eng_attempts` | mỗi lần trả lời | Nguồn của Sổ lỗi và điểm unit |
| `eng_unit_progress` | điểm tốt nhất / gần nhất mỗi unit | |
| `eng_writings` | bài viết + góp ý JSON + khoảng band + bài gốc nếu là bản viết lại | |
| `eng_study_logs` | phút / số mục / đúng-tổng theo **ngày giờ Việt Nam** × module | Nguồn của chuỗi ngày học, Tiến độ |
| `eng_lookups` | cache nghĩa theo (lemma + câu) | Một câu chỉ hỏi AI một lần |
| `eng_mocks` | thi thử: kỹ năng, dạng Reading, điểm thô, band, phiếu, đáp án, thời gian | L/R chấm máy; W/S nhập tay |

Xoá tài khoản thì toàn bộ dữ liệu học của người đó bị xoá theo: trực tiếp qua `onDelete: Cascade` với `User`, hoặc gián tiếp qua
sách và bài (unit, đoạn, bài tập xoá theo sách/bài). Riêng `eng_lookups` là bộ đệm dùng chung: chỉ lưu mã băm, lemma và nghĩa,
không lưu câu của người học. Bảng có `ownerId` chỉ trả cho chính chủ, và route nào cũng kiểm quyền chủ sở hữu **trước** mọi lệnh ghi.

## 5. API (25 route)

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET | `/api/english/today` | Màn Hôm nay: thẻ đến hạn, từ mới còn được mở, chuỗi ngày, phút học, unit tiếp, bài gợi ý, **lộ trình** (`plan`) |
| GET, PATCH | `/api/english/profile` | Mục tiêu band (4–9, bước 0.5), ngày thi, từ mới/ngày (0–50), phút/ngày |
| GET, POST | `/api/english/placement` | Đề xếp lớp 6 nhóm × 16 từ + 10 từ giả; chấm, hiệu chỉnh đoán bừa, đánh dấu cả nhóm đã thuộc |
| GET, POST | `/api/english/review` | Lượt ôn kế tiếp (mở từ mới theo tần suất); chấm thẻ (1–4 hoặc câu trả lời cho thẻ làm lại), chống bấm đúp 3 giây |
| GET, POST, PATCH | `/api/english/words` | Sổ từ; bắt từ khi đọc; đổi trạng thái (tạm ngưng / bật lại thẻ) |
| POST | `/api/english/lookup` | Nghĩa tiếng Việt đúng trong câu (cache, 60 lần / 10 phút) |
| GET, POST | `/api/english/texts` | Bài tôi xem được kèm độ phủ; thêm bài bằng dán chữ hoặc link VOA |
| GET, DELETE | `/api/english/texts/[id]` | Bài đã tách token + trạng thái từng từ + câu hỏi (không lộ đáp án); xoá bài riêng |
| POST | `/api/english/texts/[id]/questions` | AI soạn 5 câu đọc hiểu, mỗi bài một lần, dùng chung cho bài công khai |
| POST | `/api/english/texts/[id]/finish` | Đọc xong: chỉ nhận lemma có trong bài, không hạ từ đang học |
| POST | `/api/english/dictation` | Ghi kết quả một câu chép chính tả (chấm ở trình duyệt) |
| POST | `/api/english/exercises/[id]/answer` | Chấm, lưu lượt làm, câu sai thành thẻ làm lại, cập nhật điểm unit |
| POST | `/api/english/exercises/[id]/flag` | Ẩn câu sai đề (chỉ câu thuộc sách/bài của mình) |
| GET, POST | `/api/english/books` | Sách của tôi; tạo sách rỗng (1–800 trang, tối đa 20 sách) |
| GET, DELETE | `/api/english/books/[id]` | Sách + unit + tiến độ; xoá sách (kéo theo trang, unit, đoạn, bài tập) |
| POST | `/api/english/books/[id]/pages` | Nhận chữ 1–40 trang mỗi lần; gửi lại trang cũ không nhân đôi |
| POST | `/api/english/books/[id]/process` | Làm tiếp một phần việc xử lý sách; `{ retryErrors: true }` làm lại unit lỗi |
| GET | `/api/english/units/[id]` | Trang bài học + bài tập (không lộ đáp án) + unit trước/sau |
| POST | `/api/english/units/[id]/variants` | AI soạn 10 câu mới; lần gọi thứ hai tự giải, chỉ giữ câu hai lần ra cùng đáp án |
| POST | `/api/english/ask` | Hỏi sách (RAG), 30 câu / 30 phút |
| GET, POST | `/api/english/writing` | Lịch sử bài viết; góp ý mới (≥ 40 từ, 12 bài / giờ) |
| GET, POST | `/api/english/mock` | Lịch sử thi thử + điểm mới nhất + band tổng + mục tiêu; chấm phiếu L/R hoặc lưu band W/S |
| GET, DELETE | `/api/english/mock/[id]` | Xem lại phiếu đã chấm; xoá |
| GET | `/api/english/progress` | Giờ học, 12 tuần, chép chính tả, sức nhớ từ, thi thử, Writing, Sổ lỗi |
| GET | `/api/cron/english-voa` | Cron mỗi ngày 23:30 UTC (06:30 giờ VN): lấy tối đa 6 bài VOA mới; cần `Authorization: Bearer CRON_SECRET` |

Lỗi luôn trả `{ error: "<câu tiếng Việt>" }` với mã HTTP đúng nghĩa: 401 chưa đăng nhập, 404 không phải của bạn, 409 chưa đủ
điều kiện, 429 quá nhanh, 502 AI bận. Ghi dữ liệu dùng `fetch` + JSON, **không dùng server action** (quy tắc 5 của KiN).

## 6. Thuật toán và con số đã chốt

| Phần | Quy tắc | File |
|---|---|---|
| Lịch ôn | FSRS v6 (`ts-fsrs`), retention mục tiêu **0,88**, có fuzz, tối đa 365 ngày | `lib/english/srs.ts` |
| Từ mới mỗi ngày | Dừng hẳn khi thẻ đến hạn ≥ trần 150; còn dưới 1/3 khoảng trống thì giảm một nửa | `newWordsAllowed` |
| Độ phủ bài | `từ đã biết / từ được tính` (bỏ tên riêng, từ 1 chữ cái trừ a/I). ≥ 98% "Đọc nhẹ", 95–98% "Vừa sức để học", < 95% "Hơi khó" | `lib/english/text.ts` |
| Xếp lớp | `(h − f) / (1 − f)` với h = tỉ lệ nói biết ở từ thật, f = ở từ giả; nhóm ≥ 0,85 coi là thuộc cả nhóm | `lib/english/placement.ts` |
| Chép chính tả | So từng từ bằng dãy con chung dài nhất; từ thừa gần chính tả một từ sót (Levenshtein ≤ 1/3 độ dài) thì tính là "gõ sai" | `lib/english/dictation.ts` |
| Chấm bài tập | Mỗi phần tử `answers` là một đáp án; trong đáp án, `/` ngăn các cách viết tương đương, `( )` là phần không bắt buộc; mở rộng dạng viết tắt (isn't = is not) | `lib/english/grading.ts` |
| Chấm thi thử | Như trên, thêm: T/F/NG/Y/N viết tắt được chấp nhận; câu chọn nhiều chữ cái không phụ thuộc thứ tự | `lib/english/mock.ts` |
| Quy đổi band | Bảng xấp xỉ. Listening: 30 → 7.0, 26 → 6.5, 23 → 6.0. Reading Academic: 30 → 7.0, 27 → 6.5, 23 → 6.0. Reading GT: 35 → 7.0, 32 → 6.5. App hiện mục tiêu "an toàn" = ngưỡng + 1 câu | `bandFromRaw`, `rawNeeded` |
| Band tổng | Trung bình 4 kỹ năng; phần lẻ < .25 làm tròn xuống, .25–.75 thành .5, ≥ .75 lên số nguyên | `overallBand` |
| Mục tiêu thành phần | Mục tiêu tổng T → L = T + 0.5, R = T, W = T − 0.5, S = T − 0.5 (6.5 → 7.0 / 6.5 / 6.0 / 6.0) | `componentTargets` |
| Lộ trình | Tuần = 26 − ⌈ngày còn lại / 7⌉ + 1. Nền móng tuần 1–6, Tăng tốc 7–14, Kỹ năng IELTS 15–22, Nước rút 23–26. Mốc thi thử tuần 6 / 14 / 22: L+R ≥ T − 2 / T − 1,5 / T − 0,5. Tuần 14 không đạt thì khuyên lùi ngày thi | `lib/english/plan.ts` |
| Chuỗi ngày học | Theo ngày giờ Việt Nam; mỗi 7 ngày được nghỉ 1 ngày mà không đứt chuỗi; bỏ 2 ngày liền mới đứt | `lib/english/day.ts` |

## 7. AI

Mọi lời gọi AI đi qua **một file** `src/lib/english/ai.ts`, dùng đúng client `@google/genai` và `GEMINI_API_KEY` mà KiN đang có.
Không thêm khoá mới. Đổi nhà cung cấp thì chỉ sửa file này.

| Hàm | Dùng ở | Ghi chú |
|---|---|---|
| `enrichWords` | ôn thẻ, bắt từ | nghĩa VI, từ loại, ví dụ; theo lô 20 từ; lỗi AI không chặn việc học |
| `lookupInContext` | tra từ trong bài | nghĩa đúng trong câu + ghi chú cụm từ |
| `textQuestions` | câu hỏi đọc hiểu | 2 TFNG + 2 trắc nghiệm + 1 điền từ, chỉ dựa trên bài |
| `structureUnit` | xử lý sách | tóm tắt **bằng lời của AI**, không chép nguyên văn sách; tách từng câu bài tập; đáp án lấy từ answer key nếu có |
| `generateVariants` + `solveExercises` | luyện thêm | lần gọi hai tự giải; chỉ giữ câu khớp đáp án |
| `writingFeedback` | Viết | 4 tiêu chí, khoảng band tối đa rộng 1.0, trích nguyên văn lỗi |
| `answerFromBook` + `embed` | Hỏi sách | chỉ trả lời từ đoạn được đưa; `found=false` thì nói không có |

`ENGLISH_AI_FAKE=1` trả kết quả giả tất định. Chỉ dùng để chạy test cục bộ, **không bao giờ đặt trên Vercel**.

Claude Code (gói Max) là công cụ **lúc build**: viết code, chuyển sách thành JSON theo lô nếu muốn. Lúc chạy, app chỉ gọi Gemini.

## 8. Nguồn nội dung và bản quyền

| Nguồn | Dùng thế nào | Giấy phép |
|---|---|---|
| NGSL 1.01 + NAWL (`lib/english/data/*.json`) | kho từ, độ khó | CC BY-SA 4.0. Đã ghi nguồn ở trang Từ vựng |
| VOA Learning English | bài công khai cho mọi người, cron hoặc dán link | Public domain. Chỉ lấy chữ bài VOA, không lấy ảnh hay bài của AP/Reuters/AFP. Chỉ nhận tên miền VOA (chặn SSRF) |
| Sách của người học (Cambridge, Macmillan…) | lớp học riêng | **Có bản quyền.** Chỉ chủ sở hữu thấy; chỉ lưu chữ đã trích, không lưu file; tóm tắt bằng lời của AI |
| Bài người học tự dán | đọc/nghe riêng | `license = private`, chỉ chủ sở hữu thấy |

**Không tích hợp The Guardian API**, dù bản research có gợi ý. Key Developer miễn phí của Guardian chỉ cho mục đích phi thương
mại, mà KiN là sản phẩm thu phí. Muốn dùng phải có key thương mại.

## 9. Biến môi trường

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `GEMINI_API_KEY` | có (KiN đã có) | AI |
| `CRON_SECRET` | có (KiN đã có) | bảo vệ `/api/cron/english-voa` |
| `ENGLISH_VOA_FEEDS` | nên có | danh sách URL RSS của VOA Learning English, ngăn bằng dấu phẩy. Lấy ở learningenglish.voanews.com (mục RSS). Để trống thì cron không lấy bài; người học vẫn dán link VOA từng bài được |
| `ENGLISH_AI_MODEL` | không | mặc định `gemini-2.5-flash` |
| `ENGLISH_AI_MODEL_WRITING` | không | model riêng cho góp ý Writing; mặc định giống trên |

## 10. Triển khai

1. Schema chỉ **thêm** 17 bảng và 11 trường quan hệ trên `User`. Lệnh `prisma db push` lúc build production
   (`scripts/db-push-on-production.mjs`) chạy an toàn: không xoá cột nào. Bản preview không đẩy schema (đúng quy tắc đã chốt).
2. Cột `eng_chunks.embedding` là `vector(768)`. DB production đã có pgvector vì `question_bank_items` dùng. Nếu thiếu, "Hỏi sách"
   tự chuyển sang tìm theo từ khoá thay vì báo lỗi.
3. Đặt `ENGLISH_VOA_FEEDS` trên Vercel (Production) rồi gọi thử cron một lần.
4. Mở `/student/tieng-anh`: lần đầu sẽ nạp kho 3.807 từ (vài giây).

## 11. Kiểm thử (đều đã chạy xanh ngày 15/10/2026)

```
npx tsx tools/local-e2e/t-english-lib.ts                       # 140 kiểm tra thuần, không cần DB
source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-english.ts   # 89 kiểm tra API trên Postgres thử
source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-english.ts  # 39 kiểm tra trình duyệt (desktop + 390px)
```

Môi trường chạy với `ENGLISH_AI_FAKE=1` trong `env.sh`. Cách dựng Postgres thử khi máy chặn tải engine Prisma xem
`tools/local-e2e/README.md`, mục "Dựng DB thử không cần engine".

## 12. Giới hạn đã biết

- **Bảng quy đổi band là xấp xỉ.** Mỗi đề thật lệch ±0.5. App đã ghi rõ điều này và đặt mục tiêu theo ngưỡng an toàn.
- **Band Writing do AI ước lượng là khoảng, không phải điểm.** Nghiên cứu cho thấy AI thường chấm thấp hơn và thiếu nhất quán.
  Band thật nên nhập ở mục Thi thử, do người chấm.
- **Speaking chưa có trong app** ngoài phần shadowing. Thi thử chỉ cho nhập band Speaking do người thật chấm.
- **PDF scan (không có lớp chữ)** bị từ chối kèm hướng dẫn chạy OCR trước. App không tự OCR.
- **Tình trạng phát hành bài mới của VOA năm 2026 chưa xác minh được.** Kho bài cũ vẫn dùng được qua link.
- **Cờ "đã nạp kho từ"** được nhớ trong bộ nhớ của từng tiến trình máy chủ. Nếu ai xoá bảng `eng_words` thì phải khởi động lại
  (production không bao giờ xoá bảng này).
