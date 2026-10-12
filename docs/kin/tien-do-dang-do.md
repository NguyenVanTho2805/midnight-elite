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
Test: lib 37/37, API 48/48, trình duyệt 29/29. Dòng gợi ý loại 4 (buổi gia sư dời/huỷ) ĐÃ có nguồn dữ liệu từ 12/10 — xem mục "Gia sư dời/huỷ buổi" bên dưới.
Còn giới hạn: "bài về nhà đúng hạn" = bài giao có hạn nộp trong tháng và đã nộp trước hạn.

## Gia sư dời/huỷ buổi (hoàn thiện NV-189 loại 4) — XONG ngày 12/10
Trang **Lịch** của gia sư: mở một buổi CHƯA bắt đầu → mục "Đổi lịch buổi này" có **Dời buổi** (ngày mới + giờ bắt đầu/kết thúc mới, tối đa 60 ngày tới, phải ở tương lai) và **Huỷ buổi**; ghi lý do (không bắt buộc); sau đó **Sửa / Đổi thành dời / Khôi phục lịch cũ** (khôi phục chỉ khi giờ gốc còn ở tương lai).
Bảng mới `class_session_changes` (chỉ thêm), định danh một buổi = (khung giờ, **ngày GỐC** theo lịch tuần); dời vẫn giữ định danh gốc nên báo nghỉ / nhắc lịch của buổi đó không bị mồ côi.
Mọi nơi tự dựng buổi từ lịch tuần đều đã tôn trọng thay đổi: Lịch gia sư, nhắc lịch (buổi huỷ không nhắc; buổi dời nhắc theo giờ mới; tin "Đã mở Zalo" của giờ cũ bị xoá để tin mới hiện lại), ghi "đã mở Zalo" nhắc lịch, báo nghỉ của phụ huynh (buổi huỷ → 409; buổi dời tính theo giờ MỚI, điểm danh "Có phép" ghi vào ngày buổi THẬT SỰ diễn ra),
"Sổ của con" (buổi huỷ gạch ngang + không còn nút Báo nghỉ; buổi dời ghi "lịch cũ"), lịch học viên `/api/schedule` ("[ĐÃ HUỶ]" / "[DỜI từ dd/mm]"), email + thông báo nhắc ngày mai (`/api/cron/remind-class`), và **báo cáo tháng** (mỗi buổi dời/huỷ của tháng thành một dòng gợi ý loại 4, nói rõ đó là lỗi sắp xếp của gia sư, không phải của em).
Báo lớp: học viên được thông báo trong ứng dụng; gia sư tự mở Zalo với tin chung soạn sẵn (không tên em, không điểm, không tiền, không link) — KiN chỉ ghi "Đã mở Zalo lúc …", không bao giờ "đã gửi".
Báo nghỉ liên quan: **huỷ buổi** thì báo nghỉ còn "pending" → trạng thái mới `voided` (không tính phí, không buổi bù); báo nghỉ ĐÃ xử lý (đã giữ buổi bù / tính phí) giữ nguyên — KiN không tự thu hồi, chỉ đếm để báo gia sư xem lại. Huỷ rồi khôi phục / đổi thành dời thì `voided` trở lại `pending`.
**KHÔNG đụng tiền:** không sửa phiếu học phí, không tạo / thu hồi buổi bù (nối "buổi gia sư huỷ thì không tính phí" vào phiếu là GD-25, chưa làm — học phí vẫn tính theo số buổi gia sư nhập).
Chưa có: báo từng phụ huynh riêng (tin chung dùng được cho nhóm Zalo lẫn gửi riêng); email báo đổi lịch (chỉ thông báo trong ứng dụng); giao diện riêng cho quản trị.
Test: lib 47/47, API 67/67, trình duyệt 36/36 (kể cả điện thoại 390px); các bài lịch / báo nghỉ / nhắc lịch / báo cáo tháng cũ chạy lại đều qua.

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
- **CHƯA LÀM hết, cần anh quyết:** FE-098 (làm MỘT PHẦN — xem mục "Giao diện theo Figma, đợt 1" bên dưới), FE-134 / FE-130 (admin, bài giảng — file Figma KHÔNG có khung riêng cho các trang đó; lời "repo chưa có khung thiết kế" trước đây tôi nói mà chưa mở Figma, nay đã mở và sửa lại);
  FE-136 (tách quản lý lớp ra khỏi `/admin/khoa-hoc` — đụng điểm danh, bài giảng, lịch học mà gia sư đang dùng hằng ngày; đề xuất 3 bước trong sheet);
  FE-159 (SubscriptionPicker — "chọn mua" là tiền, giá/gói chưa chốt).
- **Đổi tên hiển thị → KiN: XONG** (Thọ chốt 12/10). Giữ nguyên các khoá kỹ thuật để không đăng xuất mọi người và không phải di chuyển dữ liệu: cookie `midnight_session`,
  chuyên mục tin `tin-midnight` (hiển thị "Tin KiN"), tên miền `admin.midnightelite-edu.com`. Test `t-brand` (5 kiểm tra) giữ cho không còn chữ "Midnight Elite" / logo "ME" trong `src`.
  Chưa đổi: ngày "Cập nhật lần cuối: 01/05/2026" ở `/chinh-sach` (chữ pháp lý đã nói KiN nhưng ngày chưa đổi — cần người chịu trách nhiệm pháp lý duyệt).
  Trang phụ huynh (`/phieu/[token]`, `/so-cua-con/[token]`) đã chuyển sang khung riêng `src/app/(parent)/layout.tsx` (URL không đổi): thanh trên chỉ có logo KiN + "Trang riêng cho phụ huynh", chân trang nhắc "đừng chuyển tiếp"; không còn menu bán khoá học, nút "Bắt đầu miễn phí", chân trang quảng bá, thanh điều hướng dưới của học viên; link sai trả HTTP 404 thật. Test `ui-parent-shell` 20/20.

## Giao diện theo Figma, đợt 1 — thanh trên, trang chủ, chân trang, đăng nhập/đăng ký (FE-098 một phần) — ngày 12/10
Nguồn: file Figma *KiN Design System* (`2orXvoHL2upkiGoMjlq8aX`). Đã đọc qua Figma MCP các trang `🏠 Trang chủ (KiN) — bản dựng` (145:8), `🔐 Đăng nhập` (21:9), `🖥 Vỏ ứng dụng — 4 vai` (5:39), `🖼 Toàn cảnh 12 màn hình` (91:2).
- **Đã dựng theo Figma:** thanh trên (146:2: logo K + 4 mục Lớp học / Thi thử / Cộng đồng / Tin tức + Đăng nhập / Đăng ký), trang chủ `/` (Hero, "Học ở đây thì được gì?", khung CTA), chân trang (152:36, thêm cột Hỗ trợ giữ hotline thật),
  logo K (`src/components/kin/KinLogo.tsx`), cỡ chữ `--kin-co-*` (`src/app/kin-site.css`), phông Inter + Plus Jakarta Sans (`layout.tsx`). Trang `/phu-huynh` mới (đích của link "Dành cho phụ huynh", chữ lấy từ Figma 32:21).
  Các trang đăng nhập / đăng ký / quên & đặt lại mật khẩu đổi sang token KiN, logo K và câu "Lớp học của bạn, gọn trong một chỗ" (Figma 32:5); trang phụ huynh dùng logo K. Test `ui-kin-site` (70 kiểm tra).
- **Khác Figma có chủ ý:** (1) chữ nhỏ trên nền navy dùng độ đục 0,65–0,78 thay vì 0,45–0,68 của Figma — bản Figma đo được 3,4–4,3:1, trượt ngưỡng 4,5:1 trong `docs/kin/thiet-ke/tuong-phan.md`; test đo lại thật (5,0–7,0:1).
  (2) Thanh trên cao 60px (Figma 45px) vì nút cao 44px không nằm vừa trong 45px. (3) Thẻ "Học ở đây…" dùng biểu tượng thật thay chấm xanh giữ chỗ của Figma. (4) Tiêu đề khung CTA dùng `text-balance` để khỏi mồ côi chữ "nay".
  (5) Logo K vẽ lại bằng SVG theo ảnh xuất từ Figma vì tường lửa chặn tải file SVG gốc từ figma.com — khi mở được host đó thì thay phần `<svg>` trong `KinLogo.tsx`.
- **Bỏ khỏi trang chủ so với bản cũ:** danh sách khoá học + tìm kiếm + theo dõi (vẫn đủ ở `/khoa-hoc`), dòng "Mua 1 lần, học trọn đời" (sai cách bán — KiN thu theo tháng), đếm ngược kỳ thi (ngày viết cứng), dòng thời gian "Hành trình phát triển", ô BCA (Figma chỉ có 4 ô).
  Thanh trên không còn "Gia sư" (`/giang-vien`) và "Bảng xếp hạng" vì Figma chỉ có 4 mục; cả hai chuyển xuống chân trang (cột Công cụ học tập, thêm dòng "Danh sách gia sư" ngoài 4 dòng của Figma để `/giang-vien` không mất lối vào). Muốn đưa lại lên thanh trên thì thêm vào `navLinks` trong `Navbar.tsx`.
- **Số liệu "1.200+ học sinh / 10.000+ đề / 6 gia sư" giữ nguyên như Figma và bản cũ — chưa có nguồn đếm tự động, cần người chịu trách nhiệm xác nhận trước khi đưa ra công khai.**
- **Vùng sáng cố định:** thanh trên, chân trang, trang chủ và khung `(guest)` đặt `data-vung="khach-sang"` (khoá chế độ sáng, vẫn theo chủ đề màu). Lý do: các trang guest/student còn lại viết cứng màu cho nền sáng; để thanh trên đổi tối theo máy thì vỡ trang. Khi mọi trang đã dùng token thì gỡ khối này.
- **CHƯA làm (đều cần quyết định hoặc chưa có khung Figma tương ứng):**
  - Đăng nhập "một ô, một mã" (Figma 21:9 / TK-170): đó là đổi cơ chế xác thực (mã 6 số dùng một lần, không mật khẩu, cần SMS/email, khoá 15 phút, cookie `kin_s`, phiên quản trị 12 giờ). Giao diện hiện vẫn email + mật khẩu.
  - Vỏ ứng dụng 4 vai kiểu Outlook (5:39): gia sư đã có (`TutorShell`, `OutlookShell`); học sinh, quản trị chưa — admin trên tên miền riêng, cần làm cả bộ điều hướng.
  - Các trang không có khung Figma: `/khoa-hoc`, `/khoa-hoc/[id]`, `/thi-thu`, `/tin-tuc`, `/bang-xep-hang`, `/student/*`, `/admin/*` — vẫn giao diện cũ (xanh #0068FF), đã nằm trong thanh trên/chân trang mới nên lệch tông. `/khoa-hoc` còn dòng cũ "Học trọn đời — Mua 1 lần".
  - Chưa kiểm được phông thật trong môi trường làm việc (Google Fonts bị chặn nên chạy bằng phông thay thế); Vercel sẽ tải đúng Inter / Be Vietnam Pro / Plus Jakarta Sans.

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
  - **14 bảng mới:** `class_absences`, `makeup_credits`, `class_reminder_logs`, `exam_corrections`, `monthly_reports`, `tutor_payout_accounts`, `tuition_invoices`, `bank_transactions`, `tuition_credits`, `profile_visits`, `tutor_profile_reports`, `session_plans`, `admission_scores`, `class_session_changes`.
  - **Cột mới (cho phép trống) trên bảng đã có:** `users.preferences`, `users.profileLockedAt`, `users.profileLockReason`, `courses.zaloGroupUrl`, `class_schedules.joinUrl`, `exam_questions.hint`, `question_bank_items.hint`, `attendance_records.zaloOpenedAt`.
  - Bản xem trước dùng chung cơ sở dữ liệu với production và không có `SESSION_SECRET` nên KHÔNG đăng nhập / thử tính năng được; lần thử thật đầu tiên là sau khi lên production — nên tạo nhánh hoặc sao lưu Neon trước khi merge.
- Không chạy được `next build` trong môi trường làm việc này (Google Fonts bị chặn), nhưng Vercel đã dựng thành công bản xem trước của nhánh (biên dịch, kiểm kiểu, 135 trang); `tsc` sạch, lint không tệ hơn mốc ban đầu, mọi trang chạy được trên Next dev.
- Chưa kiểm được ảnh QR VietQR thật (img.vietqr.io bị chặn); mới kiểm được URL.
- Lưu ý hành vi mới: gia sư hiện có (chưa chọn gì) vào chế độ gọn (Lịch + Học phí); bật lại ở Cài đặt → Module hiển thị.
- Lưu ý hành vi mới (NV-188): màn xem lại bài thi không hiện đáp án câu sai cho tới khi học sinh chữa xong câu đó (khi đề cho phép chữa bài).
- Lưu ý hành vi mới (dời/huỷ buổi): huỷ một buổi tự đóng các báo nghỉ sát giờ đang chờ của buổi đó (trạng thái `voided`); báo nghỉ đã xử lý giữ nguyên.
- Lưu ý hành vi mới (FE-140): `/api/categories` trả con số `courseCount` theo người xem (gia sư chỉ thấy số khoá của mình).
- Còn mở: có cho link "Sổ của con" hết hạn không (hiện không).
