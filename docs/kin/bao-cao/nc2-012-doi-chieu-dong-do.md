# NC2-012 — Đối chiếu 8 dòng Trang tính1 Thọ chưa tick

Soạn 22/10/2026 (nhánh `claude/nang-cap-2`). Chỉ đọc sheet và mã, không ghi sheet, không sửa `src/`.
Nguồn: sheet `Todo list - Kin class` tab `Trang tính1` (đọc đủ cột H, I, J, K từng dòng), `docs/kin/tien-do-dang-do.md`, `docs/kin/ke-hoach-nang-cap-2.md` (mục 2, NC2-012/013), mã trong `src/`.

Ghi chú phương pháp, nói thẳng:
- Cột K (Thanh) của cả 8 dòng đều ghi "Xong phần Thanh … Chờ dựng" (01/10, 30/09). Mã khung Figma lấy từ đó.
- Các tệp đặc tả mà K nhắc (`pheu-gia-su.md`, `dua-bang-tinh-len-web.md`, `doi-soat-vietqr.md`, `ban-giao-man-hinh.md`, `gui-qua-zalo.md`) **không có trong kho này**; trong `src/` và `docs/` cũng không có chỗ nào ghi mã khung Figma. Em **chưa mở Figma**, nên chưa so được giao diện đã dựng với từng khung — chỉ so được theo chữ ở cột I, tien-do và mã.
- Quy tắc phân loại: tiền = đụng cách tính/số tiền; trẻ em = dữ liệu học sinh dưới 16 tuổi; [GIAO DIỆN-ĐƯỢC LÀM] chỉ khi không đổi cách tính tiền, không đụng dữ liệu trẻ em, và có khung Figma ở cột K.

---

## TK-170 · 3.2.1 Vào lớp — Đăng nhập / Nhập mã mời / Vào lớp (3 màn Figma)
- **Thọ đã tick?** Chưa (H = FALSE). Thanh đã tick J.
- **Đã có:**
  - Màn 1, 2: `/dang-nhap` dựng theo Figma 32:2 và 32:27 — `src/app/(guest)/dang-nhap/page.tsx:1` ghi rõ "khung 32:2 màn đầu, 32:27 nhập mã 6 số"; tien-do mục "Đăng nhập bằng mã 6 số qua email (TK-170) — XONG ngày 13/10".
  - **Màn 3: Figma 32:54 đã dựng, XONG 13/10.** Bằng chứng: tien-do mục "Vào lớp bằng mã mời (Figma 32:54) — XONG ngày 13/10" (dòng 288) và mục "CHƯA làm" dòng 268 đã gạch bỏ mục 8; mã `src/app/(student)/student/nhap-ma-lop/page.tsx:1` ("Vào lớp bằng mã mời (Figma 32:54, FE-125/126)"), nút "Vào lớp này" (dòng 125) và "Không phải lớp của tôi" (dòng 133); chữ xem trước ở `src/lib/invitePreview.ts`; test `t-invite-preview-lib` 15, `t-invite-preview` 14, `ui-invite-input` 26. Ghi chú I 14/10 mục (1) cũng nói "Cả 3 màn đã dựng".
  - Ngoài 3 màn: tab "Mật khẩu"/"Mã một lần", quên mật khẩu, phiên 30 ngày/12 giờ, đăng nhập SĐT (tắt mặc định) — đã merge main (PR #61, 15/10).
  - Ghi chú I còn câu "CHƯA LÀM … xem lại /student/nhap-ma-lop so với Figma 32:54" ở đoạn đầu: **đã lỗi thời**, đoạn 14/10 ngay dưới đã đính chính.
- **Còn thiếu:**
  - Thọ thử đăng nhập bằng mã email thật trên midnightelite-edu.com (I [14/10] mục 3 và [15/10]) — [CẦN NGƯỜI] (máy thật/hộp thư thật).
  - Figma 32:2 còn chữ "KiN không dùng mật khẩu" (32:14, 32:25) trái với giao diện hiện tại; Thanh cần cập nhật Figma — [CẦN NGƯỜI].
  - SMS thật (Twilio) chưa từng gửi, đang tắt — [CẦN NGƯỜI] (chọn nhà cung cấp, khoá, tiền SMS).
  - Mã mời dạng `HSA-2K9-T7F3` theo Figma, mã thật vẫn 8 ký tự ngẫu nhiên (tien-do dòng 296; BE-064) — [CẦN NGƯỜI] (quyết định đổi định dạng mã; không phải việc giao diện).
  - Không còn phần nào [GIAO DIỆN-ĐƯỢC LÀM].
- **Đề nghị: ĐỀ NGHỊ TICK phần "3 màn đã dựng" (bằng chứng ở trên).** Tick H cả dòng khi Thọ xác nhận đã nhận mã email thật và vào được, như chính ghi chú I [14/10] mục 3 đặt ra; nếu Thọ coi dòng này chỉ là "3 màn có bản Figma, chờ dựng" thì tick được ngay.

## TK-173 · 3.2.3 Tiền — Phiếu học phí theo tháng + mã VietQR
- **Thọ đã tick?** Chưa.
- **Đã có:** `src/app/(student)/student/hoc-phi/page.tsx:2` (Figma 200:74, breakdown theo môn, gộp/giảm); `src/components/parent/InvoiceCard.tsx` (phiếu tháng, QR VietQR đúng phần còn lại, nội dung bắt đầu bằng mã KIN, nút "Tôi đã chuyển"); `src/app/(parent)/phieu/[token]/page.tsx`; Sổ của con có khối "Tổng phải đóng"; tien-do TT-199/TT-200.
  Trên trang học viên chỉ có hai dòng giảm: học bổng (`scholarship`, dòng 143) và giảm trừ (`discount`, dòng 149).
- **Còn thiếu:**
  - "Ba loại giảm" theo `dua-bang-tinh-len-web.md`; công thức hiện có 2 loại — [TIỀN-DỪNG] (cách tính, thuộc NV-184).
  - "Tiền = tổng đơn giá từng buổi"; hiện tính theo số buổi môn/tháng gia sư nhập tay — [TIỀN-DỪNG].
  - Em không tìm được phần chỉ-giao-diện nào còn hở trong chữ ghi chú; muốn chắc phải mở bốn khung Figma 24:2, 108:114, 199:74, 200:74 so với trang đã dựng — việc này chưa làm.
- **Đề nghị: KHÔNG tick.** Hai phần còn thiếu đều chờ quyết định công thức học phí.

## PH-207 · 7.1 Hồ sơ công khai gia sư (Figma A1 182:78)
- **Thọ đã tick?** Chưa.
- **Đã có:** `src/app/(guest)/mentor/[id]/page.tsx` — nhãn "Không thu phí nhận lớp" + "Đã xác minh", chân trang "Hồ sơ tạo bằng KiN … Tạo hồ sơ của bạn" (dòng ~150, chỉ hiện cho khách, `?vai=gia-su&n=ho-so`), khối Zalo/Messenger tắt sẵn. `src/components/tutor/TutorProfileHeader.tsx`: số buổi đã dạy, lớp, học viên, "Có dạy trong 30 ngày qua" (ĐX-05, tien-do). I [21/10]: Thọ đã bỏ vế "tỉ lệ buổi phụ huynh xác nhận". Đoạn mã không còn mã màu hex (token `--kin-*`), nên câu I 12/10 "vẫn dùng bảng màu cũ" **đã lỗi thời**.
- **Còn thiếu:**
  - Đánh giá "chỉ sau 4 buổi đã xác nhận": vế "xác nhận" đã bị bỏ 21/10 nên điều kiện cần viết lại (4 buổi ghi trên KiN?) — [CẦN NGƯỜI] (quyết định). Hiện `TutorProfileHeader.tsx:74` hiện đánh giá không có ngưỡng.
  - Nhãn "Đã xác minh số điện thoại": mã OTP đã có nhưng SMS tắt, chưa ai xác minh được — [CẦN NGƯỜI] (SMS thật).
  - Tên ẩn "Phụ huynh học sinh lớp 9" trên đánh giá: suy từ lớp của học sinh — [TRẺ EM-DỪNG].
  - Câu I 12/10 "(gia sư không sửa được)" sai (tien-do dòng 21) — sửa ghi chú, không phải mã.
- **Đề nghị: KHÔNG tick** (còn ngưỡng đánh giá, nhãn SĐT, tên ẩn). Nên nối vào I: hai câu đã lỗi thời nói trên.

## PH-210 · 7.1 Đo nguồn và bảng phễu quản trị (Figma D 191:77)
- **Thọ đã tick?** Chưa.
- **Đã có:** `src/lib/funnel.ts` (đuôi `?n=`, kênh fb/zl-rieng/zl-nhom/bc/truc-tiep), `src/components/tutor/ProfileTracker.tsx`, `/admin/pheu` (`src/app/(admin)/admin/pheu/page.tsx`: chia kênh, 7/30/90 ngày), `api/tutors/[id]/visit`, `api/admin/funnel`, `api/tutor/channels`. Bước 1–2 trong 5 bước.
- **Còn thiếu:**
  - Bước 3–5 (đăng ký học thử, học thử xong, nhận lớp) — phụ thuộc PH-208, form có tên con/lớp/Zalo phụ huynh — [TRẺ EM-DỪNG].
  - Link báo cáo/phiếu chưa gắn `?n=bc`, `?n=zl-rieng`: `?n=bc` chỉ có nghĩa khi báo cáo/Sổ của con có chân trang trỏ về hồ sơ gia sư — xem PH-213 dưới, đó là phần [GIAO DIỆN-ĐƯỢC LÀM] (cùng một việc); `?n=zl-rieng` ở tin Zalo riêng cũng gắn khi đó.
- **Đề nghị: KHÔNG tick** (bước 3–5 bị chặn trẻ em).

## PH-212 · 7.1 Chống lừa đảo làm lợi thế (Figma A1, A2, A3, D)
- **Thọ đã tick?** Chưa.
- **Đã có:** nhãn "Không thu phí nhận lớp"; khung "Không chuyển khoản trước buổi học thử" + nút `ReportProfileButton` (`src/app/(guest)/mentor/[id]/page.tsx:~135`, `src/components/tutor/ReportProfileButton.tsx`); dòng an toàn cuối bài đăng (`src/lib/funnel.ts:121`); `/admin/pheu`: bỏ qua/khoá/mở khoá, lý do bắt buộc, đếm báo cáo chờ + hồ sơ khoá.
- **Còn thiếu:**
  - Dòng "không chuyển khoản trước buổi thử" trên FORM đăng ký — form là PH-208 — [TRẺ EM-DỪNG].
  - Báo cho gia sư biết hồ sơ bị khoá: hiện chỉ có dòng cảnh báo ở trang Bài đăng (`BaiDangClient.tsx:110`). Thêm thông báo đẩy/trong ứng dụng là việc backend, không đụng tiền hay trẻ em nhưng cũng không có khung Figma riêng — [CẦN NGƯỜI] (Thọ cho phép làm, và chữ thông báo).
- **Đề nghị: KHÔNG tick** (còn dòng trên form, bị chặn bởi PH-208).

## PH-213 · 7.2 Gửi báo cáo buổi vào Zalo / Messenger (Figma B1 186:77)
- **Thọ đã tick?** Chưa.
- **Đã có:** hộp thoại báo cáo tháng "Chat riêng"/"Nhóm Zalo lớp" có Sao chép; nút "Nhắn phụ huynh"; KiN chỉ mở Zalo, không gửi thay (tien-do TT-199, mục "Phễu gia sư" C).
- **Còn thiếu:**
  - Messenger như đích gửi tới phụ huynh: không làm được bằng link (m.me chỉ nhắn vào Trang của gia sư) — [CẦN NGƯỜI] (đề nghị sửa mô tả thành "không áp dụng", chỉ giữ nút ở hồ sơ).
  - "Sổ của con" chưa có chân trang hồ sơ gia sư: `src/app/(parent)/so-cua-con/[token]/page.tsx:199-204` chỉ có "Sổ của con · KiN". Cần thêm chân trang "Hồ sơ gia sư → xem" trỏ `/mentor/<id>?n=bc`, chỉ hiện khi hồ sơ gia sư đã công khai và không bị khoá, và gắn `?n=bc` — [GIAO DIỆN-ĐƯỢC LÀM], khung Figma B1 186:77 (cột K). Cần luồn thêm `tutorId` vào dữ liệu trang (công khai, không thêm dữ liệu trẻ em). Cần Thanh xác nhận khung B1 có chân trang này vì tệp đặc tả không có trong kho.
  - Trang "báo cáo buổi" công khai riêng có link chuyển tiếp — chứa điểm/tên con — [TRẺ EM-DỪNG].
- **Đề nghị: KHÔNG tick**; làm chân trang ở NC2-013.

## PH-214 · 7.2 Thẻ xem trước link Open Graph (Figma B2 186:112)
- **Thọ đã tick?** Chưa.
- **Đã có:** hồ sơ `/mentor/[id]` có og:title ≤60, og:description ≤110, ảnh `public/og-kin.png` 1200×630, twitter summary_large_image (`page.tsx:46-60`); `/phieu/[token]` thẻ chữ chung, noindex, không tên/tiền (`phieu/[token]/page.tsx:15-19`); hạn link phiếu 30 ngày.
- **Còn thiếu:**
  - "Hai kiểu thẻ" (riêng phụ huynh có tên / nhóm không tên) cho báo cáo: cần link công khai riêng cho báo cáo, chứa dữ liệu học sinh — [TRẺ EM-DỪNG].
  - "Link hết hạn 30 ngày" cho báo cáo: cùng phụ thuộc trang báo cáo công khai — [TRẺ EM-DỪNG]. (Sổ của con không hạn theo quyết định cũ — [CẦN NGƯỜI] nếu muốn đổi.)
- **Đề nghị: KHÔNG tick.**

## PH-215 · 7.2 Cài đặt → Kết nối của gia sư (Figma B4 187:124, P2)
- **Thọ đã tick?** Chưa.
- **Đã có:** `src/app/lop-cua-toi/(tutor)/cai-dat/CaiDatClient.tsx` (#ket-noi): link nhóm Zalo từng lớp (chỉ `https://zalo.me/g/…`), Messenger (nhận link m.me), công tắc "Hiện số Zalo trên hồ sơ" tắt sẵn có cảnh báo, Zalo OA hiện "đang khoá".
- **Còn thiếu:**
  - "Đăng nhập Zalo" (không trả SĐT, OTP riêng): cần ứng dụng Zalo đăng ký cho KiN (app id + secret) — [CẦN NGƯỜI]; màn đã ghi "chưa mở".
  - Zalo OA khoá tới khi xác thực — [CẦN NGƯỜI] (pháp nhân).
  - Không còn phần giao diện nào hở.
- **Đề nghị: KHÔNG tick.**

---

## Bảng tóm tắt

| Mã | Thọ tick? | Đề nghị | Phần còn lại | Giao diện làm được |
|---|---|---|---|---|
| TK-170 | chưa | **Đề nghị tick** (3 màn đã dựng; 32:54 xong 13/10) hoặc chờ Thọ thử mã thật | thử email thật, Figma "không mật khẩu", SMS, định dạng mã | không |
| TK-173 | chưa | không tick | 3 loại giảm, tiền theo buổi (TIỀN) | không rõ; chưa so 4 khung Figma |
| PH-207 | chưa | không tick | ngưỡng 4 buổi, nhãn SĐT, tên ẩn (TRẺ EM) | không |
| PH-210 | chưa | không tick | bước 3–5 (TRẺ EM); `?n=bc` | có, gộp với PH-213 |
| PH-212 | chưa | không tick | dòng trên form (TRẺ EM); báo gia sư khi khoá | không |
| PH-213 | chưa | không tick | Messenger; trang báo cáo công khai (TRẺ EM) | **có: chân trang hồ sơ ở Sổ của con** |
| PH-214 | chưa | không tick | hai kiểu thẻ báo cáo (TRẺ EM) | không |
| PH-215 | chưa | không tick | Đăng nhập Zalo, OA (CẦN NGƯỜI) | không |

Ghi chú nên nối vào cột I khi Thọ cho phép (em không ghi sheet): TK-170 (đính chính "xem lại 32:54" đã lỗi thời), PH-207 (bảng màu đã theo token; "gia sư không sửa được" sai).

## Danh sách cho NC2-013 (chỉ [GIAO DIỆN-ĐƯỢC LÀM])

1. **Chân trang hồ sơ gia sư ở "Sổ của con"** (PH-213, kéo theo PH-210/PH-214 `?n=bc`) — Figma B1 **186:77**.
   - Sửa `src/app/(parent)/so-cua-con/[token]/page.tsx` (chân trang dòng ~199) và nạp `tutorId` của gia sư vào dữ liệu trang.
   - Chỉ hiện khi hồ sơ gia sư đang công khai và không bị khoá (`profileLockedAt` rỗng, đã duyệt); link `/mentor/<id>?n=bc`.
   - Không đổi tiền, không thêm dữ liệu trẻ em, không đổi lược đồ. Test cần: `ui-parent-shell`, `ui-portal-absence` (bài sẵn có) + `t-no-hex`, `t-links`.
   - Điều kiện: Thanh xác nhận khung 186:77 đúng là chân trang này (đặc tả `pheu-gia-su.md` không có trong kho).

Không còn mục thứ hai: TK-170 đã xong về giao diện; TK-173 chỉ còn phần tiền; các dòng còn lại bị trẻ em hoặc cần người chặn.
