# Tiến độ — chốt 12/10/2026 (Claude, nhánh `claude/peaceful-bell-6vfrb5`)

Mọi việc "sẵn sàng làm ngay" đã làm hoặc đã ghi rõ vì sao chưa làm. Ghi chú từng việc nằm trong Google Sheet (cột H/I của Thọ; không đụng cột J/K của Thanh).
Bộ test chạy với Postgres + Next dev + Chromium thật nằm ở `tools/local-e2e/` (xem README ở đó).

## Đã xong và đã đẩy lên nhánh (đều có test, xem `tools/local-e2e/`)
- Doanh thu: BE-074/075/076, FE-137, FE-153/154, FE-164
- Duyệt gia sư: FE-138
- Gia sư Dashboard: FE-141..146, 147, 149, 151, 155/156, 160, 161/162/163 (FE-148/152 giữ nguyên; FE-150 không áp dụng theo D01)
- TT-200 (phiếu học phí + đối soát VietQR/SePay), TT-201 (nhắc lịch), TT-202 (báo nghỉ sát giờ + buổi bù), TT-203 (chế độ gọn), TK-167 (chủ đề theo tài khoản)
- Đã ghi vào sheet cho các việc trên (TK-170 và TK-173 ghi "làm một phần", chưa tick).

## NV-188 (Chữa bài) — XONG ngày 12/10
API `/api/exams/attempts/[attemptId]/correction[/questionId]`, `CorrectionPanel` ở `/student/thi-thu/[examId]` (nút "Chữa lại các câu sai"
ở màn xem lại), ô "Gợi ý" trong form soạn câu hỏi (đề thi + ngân hàng), copy gợi ý khi lưu/copy/nhân bản. Test API 58/58 + trình duyệt 25/25.
Ràng buộc đã chốt: chỉ MC + câu điền ngắn, chỉ câu làm sai/bỏ trống; chỉ bật khi đề cho xem đáp án và không bật "ẩn đáp án câu sai";
đáp án/lời giải chỉ về khi câu đã xong; không bao giờ đổi điểm bài thi. Câu tự luận và đúng-sai chưa có chữa bài.

## NV-189 (Báo cáo tháng + mục "Điều chưa đạt") — XONG ngày 12/10
Bảng `monthly_reports` (mới, chỉ thêm). Gia sư vào `/lop-cua-toi/bao-cao-thang`: chọn tháng, thấy từng học sinh với Nỗ lực và Năng lực **riêng**,
KiN gợi ý các dòng chưa đạt (môn đang tụt / học chăm mà chưa đạt / bài về nhà trễ / chuyên cần thấp), gia sư sửa-xoá-thêm rồi bấm Duyệt.
Phụ huynh chỉ thấy **bản đã duyệt** (đóng băng lúc duyệt) ở "Sổ của con"; mục "Điều chưa đạt tháng này" luôn có (rỗng thì hiện câu cố định).
Gửi phụ huynh qua Zalo là bán tự động ("Đã mở Zalo lúc…", không bao giờ ghi "đã gửi"). Năng lực không bao giờ tô đỏ, không có điểm gộp, không xếp hạng.
Test: lib 37/37, API 48/48, trình duyệt 29/29. Giới hạn: loại dòng thứ 4 (buổi gia sư dời/huỷ) CHƯA có nguồn dữ liệu nên chưa sinh dòng nào;
"bài về nhà đúng hạn" = bài giao có hạn nộp trong tháng và đã nộp trước hạn.

## TT-199 giai đoạn 1 (gửi qua Zalo bằng tay) — XONG ngày 12/10
Phiếu học phí: tab Phiếu có nút "Gửi phiếu qua Zalo" (chỉ phiếu đã gửi / phụ huynh đã báo chuyển / đóng một phần). Hộp thoại chọn
"Chat riêng" hoặc "Nhóm Zalo lớp", tin soạn sẵn theo `gui-qua-zalo.md`, gia sư sửa được; KiN mở Zalo (bảng chia sẻ trên điện thoại, chép + mở
`zalo.me/<SĐT>` trên máy tính) và ghi "Đã mở Zalo lúc …" (không bao giờ "đã gửi"). Chat riêng có link riêng `/phieu/<mã 32 ký tự>` hết hạn sau
30 ngày (Thọ chốt 12/10), dùng lại link còn hạn, hết hạn thì cấp link mới; nhóm lớp chỉ có tin chung, không số tiền, không link, không tên con.
Trang `/phieu/[token]` không cần tài khoản, có QR + STK của gia sư + nút "Tôi đã chuyển"; thẻ xem trước chỉ chữ chung; ghi "Phụ huynh đã xem lúc …"
từ trình duyệt (không phải lúc bot Zalo xem trước link). Điểm danh: nút "Nhắn phụ huynh" cho em đã LƯU điểm danh, tin "Buổi [môn] [ngày] của con [tên]: [trạng thái]."
Test: lib 12/12, API 57/57, trình duyệt phiếu 33/33 và điểm danh 28/28.
Chưa làm: câu mời xem "bản ghi buổi học" cho buổi Vắng (chưa có trang bản ghi buổi cho phụ huynh nên tin chưa kèm link); giai đoạn 2 (Zalo OA) chờ
Thọ có pháp nhân; link "Sổ của con" (TK-178) vẫn KHÔNG có hạn tự động (quyết định cũ; Thọ mới chốt hạn cho link phiếu).

## Phễu gia sư (PH-207..216, PH-223) — XONG phần dựng được, ngày 12/10
- **A · Hồ sơ công khai + đo + chống lừa đảo** (PH-207/210/212/214): `/mentor/[id]` có số buổi đã dạy (từ sổ lớp), nhãn "Không thu phí nhận lớp",
  khung "không chuyển khoản trước buổi học thử" + nút Báo cáo, chân trang "Tạo hồ sơ của bạn" (mở sẵn vai Gia sư). Đo lượt mở / xem hết theo `?n=`
  (ghi từ trình duyệt, không đếm bot xem trước, không đếm trùng trong phiên). Thẻ xem trước og:title ≤ 60, og:description ≤ 110, ảnh `public/og-kin.png` 1200×630.
  Báo cáo hồ sơ (không cần tài khoản, giới hạn tốc độ); `/admin/pheu`: bảng phễu theo kênh + hàng chờ báo cáo, bỏ qua hoặc khoá hồ sơ (404 với người ngoài), mở khoá.
- **B · Soạn bài đăng** (PH-209): `/lop-cua-toi/bai-dang`, link riêng từng nhóm Facebook, sao chép / chia sẻ Facebook / gửi Zalo, dòng "không nhận chuyển khoản trước buổi học thử" luôn giữ.
- **C · Kết nối + nhóm Zalo lớp** (PH-213/215/216): Cài đặt → Kết nối (link nhóm Zalo từng lớp, Messenger, hiện số Zalo tắt sẵn; đăng nhập Zalo và OA ghi rõ chưa mở);
  tin điểm danh / nhắc lịch / báo cáo tháng vào nhóm là tin CHUNG (không tên em, không điểm, không tiền); phiếu học phí luôn gửi riêng.
- **D · Kế hoạch buổi** (PH-223): `/lop-cua-toi/ke-hoach-buoi`, 4 hoạt động có Sản phẩm, một lần soạn ra bản gia sư và phiếu học sinh KHÔNG đáp án / KHÔNG ghi chú gia sư; in bằng hộp thoại in.
Test: A lib 32 + API 52 + trình duyệt 35; B lib 49 + API 20 + trình duyệt 27; C lib 60 + API 23 + trình duyệt 34; D lib 46 + API 26 + trình duyệt 37.
**KHÔNG làm, và vì sao** (theo `CLAUDE-cho-kho-trien-khai.md` mục 9: có trẻ dưới 16 tuổi hoặc tiền thì dừng và hỏi):
PH-208 (form đăng ký học thử: tên con + lớp + số Zalo phụ huynh + bằng chứng đồng ý — dữ liệu trẻ em, chờ PH-225); PH-211, PH-217..222, PH-226 (cộng đồng / tin nhắn học sinh);
PH-224 (5 bậc thành thạo: ngưỡng từng bậc chờ anh Thanh chốt, mục 9.1 của pheu-gia-su.md); đánh giá hồ sơ chỉ sau 4 buổi phụ huynh xác nhận (PH-207: chưa có dữ liệu "buổi được phụ huynh xác nhận" trong sổ lớp này);
"Đã xác minh số điện thoại" (chưa có OTP số điện thoại); Đăng nhập Zalo (cần ứng dụng Zalo đã đăng ký); AI soạn nháp kế hoạch buổi (Đợt 2, Coin).
**Hạn link phiếu: 30 ngày** (Thọ chốt 12/10; `gui-qua-zalo.md`/GD-28 ghi 60 là bản cũ). Link "Sổ của con" (TK-178) không có hạn tự động.

## Redesign / tái cấu trúc (FE-098/099/130/134/136/139/140) và component dùng chung
- **XONG:** FE-139 (nhãn + lọc theo lớp ở kiểm duyệt cộng đồng), FE-140 (quyền danh mục: gia sư chỉ xem, quản trị mới đổi tên, con số theo người xem),
  FE-157/158 (TutorCard, TutorProfileHeader tách thành component dùng chung, so ảnh trước/sau giống từng điểm ảnh; Hồ sơ gia sư có bản xem trước hồ sơ công khai),
  FE-099 (`/diem-chuan` dùng dữ liệu thật có nguồn + CMS — xem mục "Điểm chuẩn" bên dưới), đổi tên hiển thị Midnight Elite → KiN (Thọ chốt 12/10).
- **CHƯA LÀM, cần anh quyết hoặc cần khung thiết kế:** FE-098 / FE-134 / FE-130 (redesign hàng loạt trang guest, admin, bài giảng — repo chưa có khung thiết kế cho các trang đó);
  FE-136 (tách quản lý lớp ra khỏi `/admin/khoa-hoc` — đụng điểm danh, bài giảng, lịch học mà gia sư đang dùng hằng ngày; đề xuất 3 bước trong sheet);
  FE-159 (SubscriptionPicker — "chọn mua" là tiền, giá/gói chưa chốt).
- **Đổi tên hiển thị → KiN: XONG** (Thọ chốt 12/10). Giữ nguyên các khoá kỹ thuật để không đăng xuất mọi người và không phải di chuyển dữ liệu: cookie `midnight_session`,
  chuyên mục tin `tin-midnight` (hiển thị "Tin KiN"), tên miền `admin.midnightelite-edu.com`. Test `t-brand` (5 kiểm tra) giữ cho không còn chữ "Midnight Elite" / logo "ME" trong `src`.
  Chưa đổi: ngày "Cập nhật lần cuối: 01/05/2026" ở `/chinh-sach` (chữ pháp lý đã nói KiN nhưng ngày chưa đổi — cần người chịu trách nhiệm pháp lý duyệt).
  Trang phụ huynh (`/phieu/[token]`, `/so-cua-con/[token]`) đã chuyển sang khung riêng `src/app/(parent)/layout.tsx` (URL không đổi): thanh trên chỉ có logo KiN + "Trang riêng cho phụ huynh", chân trang nhắc "đừng chuyển tiếp"; không còn menu bán khoá học, nút "Bắt đầu miễn phí", chân trang quảng bá, thanh điều hướng dưới của học viên; link sai trả HTTP 404 thật. Test `ui-parent-shell` 20/20.

## Điểm chuẩn (FE-099) — dựng xong; DỮ LIỆU MỚI LÀ TẬP NHỎ, CHƯA ĐỐI CHIẾU — ngày 12/10
`/diem-chuan` không còn 8 dòng gõ cứng bịa. Bảng mới `admission_scores` (chỉ thêm): mỗi dòng = một ngành, một năm, một phương thức, **kèm đường dẫn nguồn bắt buộc**,
lưu kèm thang điểm (30 / 90 / 100…). Trang công khai gom các năm của cùng ngành; chỉ hiện ▲/▼ khi hai năm liền kề **cùng thang** (Bách khoa TP.HCM 2024 thang 90 vs 2025 thang 100: không so);
mỗi điểm là một liên kết tới nguồn; dòng chưa đối chiếu ghi rõ "Chưa đối chiếu với thông báo của trường"; khung "Đọc trước khi dùng" nói thang/phương thức khác nhau.
`/admin/diem-chuan` (admin_super, admin_content): thêm/sửa/xoá, công tắc "Đã đối chiếu" và "Công khai", nhập CSV/JSON (kiểm tra trước, lỗi theo số dòng, **một dòng lỗi thì không nhập dòng nào**),
nút "Nạp dữ liệu khởi đầu" (chỉ thêm dòng còn thiếu, không đè chỉnh sửa). Trùng khoá (trường, ngành, chương trình, năm, phương thức) tính không phân biệt hoa/thường và dạng dấu NFC/NFD.
Bảng trống thì trang công khai tạm dùng dữ liệu khởi đầu có sẵn (`src/lib/admissionScoreSeed.ts`); có dữ liệu trong bảng thì dùng bảng.
**Dữ liệu hiện có: 8 dòng / 6 ngành** (Bách khoa HN IT1 2024–2025 + IT-E10 2025, Y Hà Nội Y khoa 2025, Ngoại thương Kinh tế đối ngoại tiên tiến 2025, Bách khoa TP.HCM KHMT 2024–2025, KTQD Thương mại điện tử 2025),
mỗi dòng có một đường dẫn báo/trang tuyển sinh. **Chưa dòng nào được đối chiếu với thông báo chính thức của trường** — môi trường làm việc này không mở được website các trường (mạng bị chặn),
nên số liệu lấy từ kết quả tìm kiếm tin báo; tất cả `verified = false`. Cần người có mạng mở nguồn, so với thông báo của trường rồi bật "Đã đối chiếu" trong `/admin/diem-chuan`;
muốn thêm trường khác: dán CSV/JSON vào "Nhập CSV / JSON" (cột: school, major, variant, year, method, score, scale, sourceUrl, sourceName, note, verified, published).
Chưa có: điểm HSA / ĐGNL ĐHQG-HCM / TSA theo từng trường (chưa tìm được số có nguồn), điểm chuẩn Ngoại thương/KTQD các năm trước.
Test: lib 49/49, API 54/54, trình duyệt 57/57.

## Không làm (chờ Thọ / luật sư / Thanh)
PH-208, PH-211, PH-217..222, PH-226 (trẻ em / cộng đồng, chờ PH-225); PH-224 (ngưỡng bậc thành thạo chờ Thanh); TK-170 (đăng nhập bằng mã 6 số);
nối "không tính phí" của báo nghỉ vào phiếu học phí (GD-25, tiền); NV-184 (học bổng theo ngưỡng — Thanh ghi hoãn 02/10, liên quan tiền); NV-190 và AS-198 (việc của người, không phải code).

## Việc Thọ cần làm khi triển khai
- Build **production** trên Vercel chạy `prisma db push` (`scripts/db-push-on-production.mjs`; bản xem trước bỏ qua bước này; `PRISMA_ACCEPT_DATA_LOSS` đang 0 nên không xoá được gì). So với `main` ngày 09/10, lược đồ chỉ THÊM (đã kiểm bằng `git diff`: không có dòng nào bị xoá/sửa):
  - **13 bảng mới:** `class_absences`, `makeup_credits`, `class_reminder_logs`, `exam_corrections`, `monthly_reports`, `tutor_payout_accounts`, `tuition_invoices`, `bank_transactions`, `tuition_credits`, `profile_visits`, `tutor_profile_reports`, `session_plans`, `admission_scores`.
  - **Cột mới (cho phép trống) trên bảng đã có:** `users.preferences`, `users.profileLockedAt`, `users.profileLockReason`, `courses.zaloGroupUrl`, `class_schedules.joinUrl`, `exam_questions.hint`, `question_bank_items.hint`, `attendance_records.zaloOpenedAt`.
  - Bản xem trước dùng chung cơ sở dữ liệu với production và không có `SESSION_SECRET` nên KHÔNG đăng nhập / thử tính năng được; lần thử thật đầu tiên là sau khi lên production — nên tạo nhánh hoặc sao lưu Neon trước khi merge.
- Không chạy được `next build` trong môi trường làm việc này (Google Fonts bị chặn), nhưng Vercel đã dựng thành công bản xem trước của nhánh (biên dịch, kiểm kiểu, 135 trang); `tsc` sạch, lint không tệ hơn mốc ban đầu, mọi trang chạy được trên Next dev.
- Chưa kiểm được ảnh QR VietQR thật (img.vietqr.io bị chặn); mới kiểm được URL.
- Lưu ý hành vi mới: gia sư hiện có (chưa chọn gì) vào chế độ gọn (Lịch + Học phí); bật lại ở Cài đặt → Module hiển thị.
- Lưu ý hành vi mới (NV-188): màn xem lại bài thi không hiện đáp án câu sai cho tới khi học sinh chữa xong câu đó (khi đề cho phép chữa bài).
- Lưu ý hành vi mới (FE-140): `/api/categories` trả con số `courseCount` theo người xem (gia sư chỉ thấy số khoá của mình).
- Còn mở: có cho link "Sổ của con" hết hạn không (hiện không).
