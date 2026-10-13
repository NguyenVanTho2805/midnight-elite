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
- **Vùng sáng cố định:** thanh trên, chân trang, trang chủ và khung `(guest)` đặt `data-vung="sang"` (khoá chế độ sáng, vẫn theo chủ đề màu). Lý do: các trang guest/student còn lại viết cứng màu cho nền sáng; để thanh trên đổi tối theo máy thì vỡ trang. Khi mọi trang đã dùng token thì gỡ khối này.
- **CHƯA làm (đều cần quyết định hoặc chưa có khung Figma tương ứng):**
  - Đăng nhập "một ô, một mã": **đã làm ngày 13/10 qua email** — xem mục "Đăng nhập bằng mã 6 số qua email" ngay dưới đây. Chưa làm: đăng nhập bằng số điện thoại (cần SMS), cookie `kin_s`, phiên quản trị 12 giờ không gia hạn.
  - Vỏ ứng dụng 4 vai kiểu Outlook (5:39): gia sư đã có (`TutorShell`, `OutlookShell`); **học sinh đã làm ngày 13/10** (mục "Vỏ học sinh" bên dưới); **quản trị cũng đã làm ngày 13/10** (mục "Vỏ quản trị").
  - Các trang không có khung Figma: **đã áp ngôn ngữ KiN ngày 13/10** (mục "Áp ngôn ngữ KiN cho trang cũ" bên dưới). `/khoa-hoc` còn dòng cũ "Học trọn đời — Mua 1 lần" (chữ bán hàng, chờ Thọ chốt).
  - Chưa kiểm được phông thật trong môi trường làm việc (Google Fonts bị chặn nên chạy bằng phông thay thế); Vercel sẽ tải đúng Inter / Be Vietnam Pro / Plus Jakarta Sans.

## Đăng nhập bằng mã 6 số qua email (TK-170) — XONG ngày 13/10 (Thọ chốt: dùng, và dùng email)
Màn `/dang-nhap` dựng theo Figma 32:2 (nhập email) và 32:27 (nhập mã 6 số). Nhập email → KiN gửi mã → nhập mã là vào. **Đăng nhập bằng mật khẩu vẫn còn làm lối phụ** ("Đăng nhập bằng mật khẩu"), vì mọi tài khoản cũ có mật khẩu và đăng ký vẫn đặt mật khẩu; chưa tắt mật khẩu như Figma ghi "KiN không dùng mật khẩu".
- **Quy tắc (đúng bản đồ đường vào Figma 33:2):** mã 6 số ngẫu nhiên an toàn mật mã; sống 10 phút; dùng một lần (xoá dòng ngay khi đúng, hai yêu cầu cùng mã đúng chỉ một cái vào được); sai 5 lần thì khoá email đó 15 phút (kể cả mã đúng và kể cả xin mã mới); xin mã mới được sau 60 giây.
- **An toàn:** DB chỉ lưu băm HMAC-SHA256(khoá bí mật của server, "email:mã"), so bằng `timingSafeEqual`; lượt thử được TRỪ NGUYÊN TỬ trước khi so nên gửi song song 25 lần đoán cũng chỉ so được ≤ 5 lần; lần sai được giữ qua các lần xin mã mới trong 15 phút (không lách bằng cách xin mã liên tục); giới hạn thêm theo IP (10 lần xin / 30 lần nhập mỗi 10 phút) và theo email (6 lần xin / 10 phút, chống dội thư vào hộp thư người khác).
- **Không lộ email nào có tài khoản:** email lạ vẫn nhận phản hồi y hệt (gửi, chờ 60 giây, còn 4/3/2/1 lần, khoá 15 phút), được mô phỏng trong bộ nhớ và không gửi thư thật. Tài khoản bị khoá (`banned`) vẫn nhận thư, vào bằng mã đúng thì bị từ chối 403 như đăng nhập mật khẩu.
- **Lưu ý hạn chế:** mô phỏng email lạ và giới hạn theo IP/email nằm trong bộ nhớ từng máy chủ (serverless nhiều bản chạy song song thì mỗi bản đếm riêng) — phần chặn thật cho tài khoản có thật nằm trong DB nên vẫn đúng.
- **Bảng mới (chỉ thêm):** `login_codes` (xem `prisma/schema.prisma`); build production tự tạo. Không đổi `emailVerified` khi đăng nhập bằng mã.
- **Thư:** `sendLoginCodeEmail` trong `src/lib/email.ts` (màu KiN navy, có bản văn bản thường). Dùng Gmail SMTP sẵn có (`GMAIL_USER`, `GMAIL_APP_PASSWORD`); không cần biến mới. Chỉ để test cục bộ: đặt `EMAIL_SINK_DIR` thì thư ghi thành tệp JSON thay vì gửi.
- **Đi kèm:** `/dang-nhap?redirect=` chỉ nhận đường dẫn nội bộ (trước đó nhận cả địa chỉ ngoài → có thể bị dùng để đẩy người dùng sang trang giả mạo sau khi đăng nhập); `AuthGuard` đưa người chưa đăng nhập về `/dang-nhap?redirect=<trang đang định vào>` để đăng nhập xong quay lại đúng trang (Figma 33:2).
- **Test:** `t-login-code-lib` (43), `t-login-code` (61: API + Postgres thật, đua song song, đoán mã hàng loạt, email lạ, bị khoá, vai trò), `ui-login-code` (62: màn hình thật, gõ phím/dán mã, đồng hồ gửi lại, khoá, điện thoại 390px, chặn redirect ngoài).
- **Chưa làm:** đăng nhập bằng số điện thoại (cần dịch vụ SMS — Figma có "Số điện thoại hoặc email"; hiện chỉ email); tắt hẳn mật khẩu; phiên 30 ngày gia hạn mỗi lần dùng và phiên quản trị 12 giờ (phiên hiện vẫn 7 ngày cho mọi vai).

## Áp ngôn ngữ KiN cho các trang cũ không có khung Figma — XONG HAI ĐỢT, 13/10 (Thọ: "áp dụng luôn, không chờ")
> **Lịch sử:** đợt 1 chỉ đổi BẢNG MÀU CŨ liệt kê bên dưới và báo là xong; đếm lại thì còn ~1.600 mã hex viết cứng trong 95 file (bảng màu "nổi" cũ của admin/học viên `#1E2938 #6B7280 #9CA3AF #C5D0EA #F0F5FF…` và màu trạng thái `#16A34A #DC2626 #FEF3C7…`) cùng ~1.350 lớp Tailwind kiểu `text-gray-500`. **Đợt 2** (cùng ngày) xử lý nốt, xem mục "Đợt 2" cuối phần này. Test `t-no-hex` giữ cho không quay lại.
- **Cách làm:** công cụ chuyển có kiểm soát (không thay mù): ánh xạ màu cũ → token `--kin-*` THEO NGỮ CẢNH thuộc tính CSS (chữ / nền / viền / tô SVG), chạy trên ~88 file `.tsx` của `(guest)`, `(student)`, `(admin)` và các component dùng chung; sau đó rà tay các chỗ công cụ không an toàn (viền có độ trong suốt dùng `color-mix`, màu ghép chuỗi `${màu}40`, khoá React trùng sau khi hai màu cũ gộp thành một token). `globals.css`: `--color-primary*` trỏ về token KiN nên mọi class `bg-primary`… tự đổi.
- **Vùng sáng cố định đổi tên `data-vung="khach-sang"` → `"sang"`** và đặt thêm cho `(student)` và `(admin)`. Trong vùng này `kin-site.css` khai báo lại token trung tính theo bản sáng + giá trị nhấn theo 5 chủ đề màu, kể cả viền focus và ô nhập (`.notion-input`) — trước đó viền focus toàn cục `#0068FF` làm rò màu cũ ra mọi ô nhập.
- **Cố ý giữ nguyên màu cứng (là DỮ LIỆU, không phải giao diện):** màu thẻ/nhãn do quản trị chọn và lưu vào cơ sở dữ liệu (`TAG_COLORS` ở trang khoá học admin, khoá `"#0068FF": "MỚI"`), đánh dấu bằng `data-mau-du-lieu`; ô mẫu của bộ chọn chủ đề màu. Test `ui-kin-site` bỏ các chỗ có `data-mau-du-lieu` khi quét. (Phần còn lại ở đầu mục là chưa làm, không phải cố ý.)
- **Test:** `ui-kin-site` (101 kiểm tra) quét các trang guest/student/admin tìm ĐÚNG BẢNG MÀU CŨ đã liệt kê (không phải mọi mã hex) trong style thật của trình duyệt, kiểm tra vùng sáng không đổi tối theo máy, tương phản chữ thật.
- **Đợt 2 — 13/10:**
  - Công cụ chuyển theo HỌ MÀU + NGỮ CẢNH (chữ / nền / viền / biểu tượng / bóng / gradient) trên 99 file: ~1.400 mã hex → token, 57 gradient xanh/xanh lá → màu đặc, 65 bóng neumorphism (`#C5D0EA` hai phía) → `--kin-bong-the/chim/noi` (phẳng, viền mảnh), 28 `rgba()` màu cũ → `color-mix` theo token.
  - **Token mới** (`kin-site.css`): nền/viền trạng thái `--kin-tt-nen-xong|cho|loi`, `--kin-tt-vien-xong|cho|loi` (pha từ chấm trạng thái, tự theo vùng sáng/tối); bóng `--kin-bong-*`; **bí danh cho biến cũ** (`--ink`, `--canvas`, `--hairline`, `--tint-*`, `--color-primary`, `--shadow-neu-*`…) trỏ về token KiN thay vì giữ mã hex.
  - **Bảng màu Tailwind** (`text-gray-*`, `border-blue-*`, `bg-red-*`… ~1.350 chỗ) trỏ về token trong `@theme inline` của `globals.css` — một chỗ sửa cho toàn app, tôn trọng vùng sáng cố định.
  - `globals.css`: bỏ hẳn các lớp `.clay-*`/`.neu-*` kiểu nổi 3D (giờ phẳng, viền mảnh); nút thao tác chính màu xanh lá (Lưu / Tạo mới / Thêm…, 40 chỗ) đổi sang màu nhấn KiN (xanh lá chỉ còn dùng cho trạng thái "xong").
  - **Còn mã hex có chủ ý** (có lý do trong `t-no-hex`): token (`kin-tokens.css`, `kin-site.css`), thư HTML (`email.ts` — ứng dụng thư bỏ qua biến CSS), dữ liệu mẫu khoá học/vinh danh, logo, màu nhãn khoá học lưu trong DB, bảng màu avatar phân loại + màu huy chương đồng.
  - **Test:** `t-no-hex` (17) quét tĩnh mọi `.ts/.tsx/.css` tìm mã hex (kiểm đã thử đột biến: thêm một mã hex và một lớp `text-gray-950` thì test đỏ), mọi lớp màu Tailwind đang dùng đã có trong `@theme`, mọi biến cũ đang dùng có bí danh. ESLint: số lỗi không đổi (80 → 80, toàn lỗi có sẵn).
  - **Chưa làm:** bố cục các trang cũ (không có khung Figma); chữ 9–10px (xem mục Rà soát Figma); dòng "Học trọn đời" ở `/khoa-hoc/[slug]`.
- **Chưa làm / cần người:** dòng "Mua 1 lần" ở `/khoa-hoc`; logo K vẽ lại bằng SVG (cần SVG gốc từ Figma); phông Inter/Be Vietnam Pro/Plus Jakarta Sans chưa kiểm được thật ở đây (Google Fonts bị chặn).

## Vỏ học sinh kiểu Outlook + "Việc của tôi" — XONG ngày 13/10 (Thọ: "làm vỏ học sinh rồi đến vỏ quản trị")
Dựng theo Figma "Vỏ — Học sinh" (11:98) và đặc tả `docs/kin/thiet-ke/bo-cuc-outlook.md`. Thay thanh trên cũ + thanh dưới cũ của khu `/student/*`.
- **Thanh module** (`src/components/kin/shell/ModuleRail.tsx`, dùng chung cho quản trị): máy tính cột trái 79px; điện thoại thanh dưới 60px. Bốn module đúng Figma: Việc của tôi · Lịch · Lớp · Thư viện, thêm **"Khác"** (bảng nổi) để các trang không có trong Figma (Thi thử, Bảng xếp hạng, Hỏi đáp, Cộng đồng, Khoá học, Gia sư, Tin tức, Điểm chuẩn, Hồ sơ, Học phí, Ví, Chủ đề màu, Đăng xuất) không mất lối vào khi bỏ thanh trên. Module đang ở dùng `aria-current` (không phải `aria-selected`); nút cao ≥ 44px.
- **Badge đỏ chỉ đếm việc học sinh phải ra tay** (bài chưa nộp hạn trong 3 ngày hoặc đã quá hạn, hạn nộp ngoài trong 3 ngày) — KHÔNG đếm "chưa đọc". Có nhãn chữ "N việc cần xử lý".
- **Việc của tôi** (`/student/viec-cua-toi`, thành trang đầu sau đăng nhập; `/student` chuyển về đây): danh sách 330px bên trái, khung đọc bên phải, mỗi khung cuộn riêng; điện thoại chọn một dòng thì hiện khung đọc, có nút ← quay lại; phím ↑ ↓ Home End; khung xương khi tải lần đầu (không vòng xoay); lỗi tải lại thì giữ danh sách cũ + dải báo lỗi + "Thử lại"; tải lại khi quay về tab.
  Nội dung = dữ liệu thật: bài tập có hạn của các lớp đang học (chưa nộp / đã nộp / đã chấm kèm điểm và nhận xét), hạn nộp ngoài (Azota), buổi học trong 3 ngày tới (kể cả buổi dời/huỷ). Bài không có hạn, bài lớp khác, quá hạn > 14 ngày đều không hiện. Logic thuần ở `src/lib/studentTodo.ts`, đọc DB ở `studentTodoServer.ts`, API `GET /api/student/viec-cua-toi` (`?badge=1` chỉ trả số).
- **Lịch dùng chung nguồn:** logic lịch tách khỏi `/api/schedule` sang `src/lib/studentSchedule.ts` để "Việc của tôi" và trang Lịch không thể lệch nhau; `/api/schedule` vẫn trả `{ events }` như cũ (test chặn hồi quy).
- **Phòng thi (`/student/thi-thu/<mã đề>`) không có vỏ** — toàn màn hình, đúng đặc tả.
- **Test:** `t-student-todo-lib` (43: từng quy tắc), `t-student-todo` (36: API + Postgres thật, đúng người, không rò dữ liệu giữa học sinh, rời lớp thì hết việc, `/api/schedule` không đổi dạng), `ui-student-shell` (62: bố cục 79/330, cuộn riêng, phím, bảng Khác, phòng thi không vỏ, khung xương/lỗi/trống, điện thoại 390px, chưa đăng nhập).
- **Khác Figma có chủ ý:** (1) nhãn nhóm "Cần làm / Sắp tới / Đã xong" trong danh sách (Figma chỉ vẽ ba dòng mẫu). (2) Danh sách rộng 330px theo đặc tả (khung Figma vẽ ~200px vì khung mẫu nhỏ). (3) Icon vẽ lại bằng nét SVG (file icon gốc không tải được vì tường lửa chặn figma.com).
- **Chưa làm:** các trang khách (`/thu-vien`, `/khoa-hoc`, `/giang-vien`, `/diem-chuan`…) vẫn nằm trong khung khách có thanh trên cũ — bấm "Thư viện" trong vỏ học sinh đi sang khung đó, chưa có vỏ học sinh bao quanh. Trang con của `/student/*` (Lớp, Hồ sơ, Học phí, Bài giảng, Phòng thi…) vẫn là giao diện trang cũ đặt trong vỏ mới và còn nhiều màu hex cũ (xem đính chính ở mục "Áp ngôn ngữ KiN"), chưa dựng lại theo Figma (không có khung Figma tương ứng).

## Vỏ quản trị kiểu Outlook + "Chờ kiểm duyệt" — XONG ngày 13/10 (Thọ: "rồi đến vỏ quản trị")
Dựng theo Figma "Vỏ — Quản trị" (11:287). Thay hẳn thanh bên tối kiểu nổi (neumorphic) + thanh trên cũ của `/admin/*`; xoá `AdminSidebar.tsx` (không còn nơi nào dùng).
- **Thanh module + dải tab:** thanh module trái 79px / thanh dưới 60px (cùng `ModuleRail` với vỏ học sinh), bốn module **Kiểm duyệt · Người dùng · Nội dung · Báo cáo** (Figma vẽ ba nút cho vai kiểm duyệt; thêm Nội dung vì quản trị còn phải làm khoá học/đề thi/tin tức). Trang con của module hiện thành dải tab phía trên nội dung (`src/lib/adminNav.ts`). Dải trên có logo, vai, tên, "Trang học viên", Đăng xuất.
  **Mọi trang quản trị cũ nguyên vẹn, nằm trong vỏ mới; quyền từng trang giữ nguyên** — test `t-admin-queue-lib` so bảng quyền mới với bảng cũ của thanh bên (cho từng vai: không thừa, không thiếu) và có một bước quét thư mục: thêm trang `/admin/...` mà quên đưa vào module thì test đỏ. `/admin/topups` vẫn không có lối vào (đúng như thanh bên cũ).
- **Bỏ có chủ ý:** dòng "Hệ thống hoạt động bình thường" kèm chấm nhấp nháy (chữ cố định, không đo gì cả — dễ làm quản trị tưởng hệ thống được giám sát); ngăn kéo ☰ trên điện thoại (thay bằng thanh dưới + dải tab cuộn ngang). Test `ui-revenue` viết lại phần điện thoại/máy tính theo vỏ mới.
- **Chờ kiểm duyệt** (`/admin/kiem-duyet`, `GET /api/admin/kiem-duyet`, `?badge=1`): MỘT hàng chờ gộp, danh sách + khung đọc, chờ lâu nhất lên trước. Bốn loại dòng, đều là dữ liệu thật đang chờ: hồ sơ gia sư xin duyệt, báo cáo bài viết, báo cáo hồ sơ gia sư, báo cáo câu trả lời. Badge trên "Kiểm duyệt" = số dòng đang chờ (có nhãn chữ), cập nhật ngay khi xử lý xong một dòng.
  **Lệnh trong khung đọc gọi đúng API xử lý đã có** (không có đường xử lý mới): Duyệt / Từ chối gia sư (từ chối bắt buộc lý do ≤ 500), Gỡ / Giữ bài viết (hỏi lại một câu trước khi gỡ), Khoá hồ sơ công khai (bắt buộc lý do) / Bỏ qua báo cáo. Người chưa xác thực email: nút Duyệt bị khoá kèm lý do (máy chủ cũng chặn 409). Hai người xử lý cùng lúc → người sau nhận 409 và dòng tự biến mất.
  **Báo cáo câu trả lời KHÔNG xử lý ngay trong hàng chờ:** "xác nhận vi phạm" trừ xu của người trả lời (vấn đề tiền) nên chỉ có liên kết sang trang riêng `/admin/cong-dong/bao-cao`, kèm cảnh báo khi câu trả lời đã được thưởng.
- **Phạm vi theo quyền (đúng như các trang cũ):** quản lý trung tâm (admin_super, admin_content) thấy cả bốn loại; giáo viên chỉ thấy báo cáo bài viết trong lớp do mình sở hữu (không thấy báo cáo bài chung, lớp khác, hồ sơ gia sư, câu trả lời); học sinh bị chặn 403.
- **Test:** `t-admin-queue-lib` (50), `t-admin-queue` (26: API + Postgres thật, từng vai, từng lệnh, cô lập dữ liệu giữa giáo viên), `ui-admin-shell` (42: bố cục 79/330, badge, duyệt/từ chối/gỡ bài với DB thật, giáo viên và quản trị nội dung, lỗi tải, điện thoại 390px, học sinh bị chặn).
- **Chưa làm:** các trang quản trị cũ (khoá học, đề thi, học sinh…) chưa dựng lại theo dạng danh sách + khung đọc (không có khung Figma) — mới chỉ vào vỏ mới; màu còn rất nhiều hex cũ (xem đính chính ở mục "Áp ngôn ngữ KiN"), nên trông vẫn như app cũ đặt trong vỏ mới. Phiên quản trị 12 giờ không gia hạn (Figma 33:2) chưa làm; hiện vẫn 7 ngày. Chưa có lịch sử "đã xử lý" (hàng chờ chỉ hiện việc đang chờ).

## Rà soát Figma ngày 13/10 — còn thiếu gì (chỉ đọc, không sửa code)
Đối chiếu 35 trang của file *KiN Design System* (`2orXvoHL2upkiGoMjlq8aX`) với code. Mức kiểm: có/không có màn, module, component, luồng chính — **không** so từng điểm ảnh của ~100 khung. Các khung của Thanh (Lớp, Điểm danh, Học phí, Lịch, Kế hoạch buổi, Phễu A/B/D, phiếu/báo cáo tháng) em chỉ rà có-hay-không, chưa kiểm hình ảnh.
**A. Màn / module trong Figma mà code CHƯA có hoặc làm lệch**
1. **Vỏ Gia sư (9:2):** Figma = thanh module 79px + "Hộp việc" dạng danh sách + khung đọc. Code (`TutorShell`) = menu 226px + biểu tượng emoji, và "Hộp việc" (`/lop-cua-toi`) là trang thẻ số liệu, không phải danh sách + khung đọc. Nhãn mobile 9,5px dưới sàn chữ 11,1px. Chính Figma cũng có hai kiểu (rail 79px ở "Vỏ 4 vai", menu 226px ở "Khung gộp A+B+C") — cần chốt một.
2. **Vỏ Phụ huynh (11:197)** (4 module, "Cần anh/chị xác nhận"): chưa có; hiện chỉ có khung tối giản `(parent)`. Nhưng Quyết định đêm #25/#26 đã bỏ xác nhận 72 giờ → khung này có thể đã lỗi thời, cần Thanh/Thọ chốt trước khi dựng.
3. **Phụ huynh "báo ghi nhầm điểm danh"** (127:62) và trạng thái "Phụ huynh báo ghi nhầm · chờ xem lại bản ghi" ở màn Điểm danh (22:2): chưa có (không có bảng, không có route).
4. **Học thử** (thẻ thoả thuận 3 trạng thái 13:2, máy trạng thái 6 bước 14:2, A2 "phụ huynh đăng ký học thử không cần tài khoản", A5 "phụ huynh đăng yêu cầu tìm gia sư"): chưa có. Dính trẻ em + tiền → cần Thọ quyết.
5. **Cộng đồng:** Hỏi đáp mở có "Mời học thử" + hàng chờ tự giữ (29:2), C1–C7 (bảng tin, chi tiết câu hỏi gợi ý trước, soạn bài chọn người xem, an toàn trẻ em, tin nhắn riêng, người chưa đăng nhập): chưa có (đang chờ PH-225 luật sư). Vỏ Quản trị 11:357 có loại dòng "Câu hỏi từ người chưa có tài khoản" — hàng chờ hiện chưa có loại này.
6. **Thư viện (30:2)** gom theo buổi (video, PDF, đã xem/đã nộp): hiện `/thu-vien` chỉ liệt kê tài liệu của khoá miễn phí; module "Thư viện" của gia sư thực ra trỏ sang ngân hàng đề (`/admin/thi-thu/ngan-hang-de-thi`).
7. **Phòng thi (27:2):** khoá cứng Navy chưa áp dụng — `[data-vung="phong-thi"]` có trong CSS nhưng không trang nào dùng (TK-168/174 ghi xong là chưa đúng); dải "Bạn đã rời khỏi tab N lần" chưa thấy; chưa kiểm ô đáp án cao 52px. Chữa bài (NV-188) thì có.
8. **Vào lớp bằng mã mời (32:54):** `/student/nhap-ma-lop` chỉ có thẻ "Mã hợp lệ" + nút; thiếu xem trước lịch/giá/số buổi đã học, câu "Vào lớp là đồng ý ba điều", nút "Không phải lớp của tôi"; còn màu cũ.
9. **Đăng nhập / Bản đồ đường vào (32:2, 33:2):** chưa có đăng nhập bằng số điện thoại (cần SMS), tắt mật khẩu, phiên 30 ngày (cookie `kin_s`), phụ huynh token 90 ngày (`kin_p`), quản trị 12 giờ không gia hạn (hiện 7 ngày cho mọi vai); chưa đặt `Referrer-Policy: no-referrer` cho đường dẫn phụ huynh (Quyết định #9).
**B. Component Figma có mà code chưa có / chưa đủ** (`src/components/kin/`: Button, Input, CodeBoxes, KinLogo + `shell/`)
- **Nút:** thiếu kiểu "Nguy hiểm" (có Chính/Thường/Ghost); nút lệnh trong khung đọc tự viết riêng, chưa dùng `KinButton`.
- **Thẻ trạng thái** (Xong/Chờ/Lỗi/Trung tính dạng thẻ): chưa có component; danh sách chỉ có chấm + chữ.
- **Tab** (Đang mở/Thường): chưa có component dùng chung (dải tab của vỏ quản trị tự vẽ).
- **Toast** (Xong/Chờ/Lỗi/Tin) và **Hộp xác nhận** (Thường/Nguy hiểm): còn bản cũ ở `ui/Toast`, `ui/ConfirmModal`; chưa phải bộ KiN. Khung xác nhận của "Chờ kiểm duyệt" cũng tự vẽ.
- **Biểu tượng:** bộ 6 icon Figma đang là bản vẽ lại; vai Quản trị trong Figma cũng dùng icon tạm (Quyết định #3); `TutorShell` dùng emoji. 21 chỗ chữ 9–10px dưới sàn 11,1px.
**C. Việc nằm ở phía Figma (không phải code)**
- Trang "Toàn cảnh" còn 4 khung theo mô hình xác nhận 72 giờ cũ (91:3, 91:112, 91:666, 91:696) mâu thuẫn Quyết định #25/#26; màn Lớp còn "7/8 buổi" trong khi Quyết định #21 nói đã sửa thành 7/9.
- TK-205/206: đồng bộ text style về thang 8 bậc; ~3.000 lớp chữ còn gõ cỡ tay.
- Logo bản mono lỗi, toàn bộ icon/logo là bản dựng lại (Quyết định #15); Quyết định #13 (màu chữ vàng) còn mở; trang "Hai không gian" thiếu khung "Không gian 2"; dữ liệu mẫu không thống nhất (giờ học 19:00 / 19:30 / 22:15, số học sinh 24 / 5 / 14); 5 hình chữ nhật thừa trang Đăng nhập, 3 text rỗng ở màn Lớp.
- `docs/kin/thiet-ke/ban-giao-man-hinh.md` được sheet nhắc nhưng **không có trong repo**.
**D. Màu hex cũ còn lại:** xem đính chính ở mục "Áp ngôn ngữ KiN" (khoảng 1.600 mã / 95 file).

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
PH-208, PH-211, PH-217..222, PH-226 (trẻ em / cộng đồng, chờ PH-225); PH-224 (ngưỡng bậc thành thạo chờ Thanh);
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
