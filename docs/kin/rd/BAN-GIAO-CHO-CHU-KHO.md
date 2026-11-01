# KiN: bản giao cho chủ kho (25/10/2026)

Dành cho chủ kho và cho Claude của chủ kho khi mở kho này. Đọc hết file này trước khi làm gì.
Người bàn giao: Thanh (cộng sự), làm cùng Claude. Nhánh: `claude/giao-dien-moi`, PR 75 vào `main`.
Tài liệu nền đã có: [KE-HOACH-HOAN-THIEN.md](KE-HOACH-HOAN-THIEN.md) (kế hoạch 245 tính năng), [bang-tinh-nang.csv](bang-tinh-nang.csv), [FIGMA-BAN-DO.md](FIGMA-BAN-DO.md) (84 khung Figma), [HIEN-CO-VA-DINH-VI.md](HIEN-CO-VA-DINH-VI.md), [pro/QUYET-DINH-CHU.md](pro/QUYET-DINH-CHU.md) (mọi quyết định), `../CLAUDE-cho-kho-trien-khai.md`.

## 1. Việc đầu tiên: đưa lên production đúng thứ tự

Chưa merge PR 75 khi chưa làm xong 3 bước sau, vì mã mới cần bảng mới trong CSDL.

1. **Sao lưu CSDL production** (Neon: Branches, tạo nhánh con từ nhánh production, Auto-delete đặt Never).
2. **Cập nhật bảng.** Chỉ thêm bảng và cột, không xoá dữ liệu. Lấy chuỗi kết nối trực tiếp (tắt Connection pooling) rồi:
   - Xem trước SQL: `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema prisma/schema.prisma --script`. Chỉ nên có `CREATE TABLE`, `ADD COLUMN`, `CREATE INDEX`. Thấy `DROP` thì dừng và hỏi.
   - Áp dụng: `npx prisma db push` (không thêm `--accept-data-loss`).
3. **Biến môi trường Production trên Vercel:**
   - `CRON_SECRET`: bắt buộc. Thiếu thì mọi tác vụ định kỳ trả 503 (nhắc lớp, nhắc thi, hết hạn gói, nhắc gia hạn Pro).
   - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`: nên có nếu dùng video.
   - Chỉ khi mở bán Pro: `KINPRO_SEPAY_API_KEY` (từ 16 ký tự), `KINPRO_BANK_BIN`, `KINPRO_ACCOUNT_NO`, `KINPRO_ACCOUNT_NAME`, rồi trỏ webhook SePay tới `/api/webhooks/sepay-pro`. Chưa đặt thì Pro hiện "Chưa mở bán" và webhook tắt.
   - Giữ `KIN_TRIAL_MODE` như hiện tại cho đến khi muốn mở bán. Đừng đặt `KIN_PLAN_ENFORCE=1` ở lần đầu (cổng hạn mức tắt thì không ai bị chặn).
4. Merge (nên chọn "Create a merge commit"), rồi xem đăng nhập, Hộp việc, Lớp, Học phí và tab Logs của Vercel trong 10 phút đầu.
5. Quay lui nếu có sự cố: Vercel, Deployments, bản trước, Promote to Production. Bảng và cột mới chỉ thêm nên mã cũ vẫn chạy được.

## 2. Cách chạy và kiểm tra trên máy

- Chạy demo: `bash .local-dev/start.sh` (web ở http://localhost:3000, chặn không cho trỏ vào CSDL thật), rồi `bash .local-dev/seed.sh --reset` ở cửa sổ khác. Tài khoản thử và đường dẫn "xem ở đâu" được seed in ra cuối lệnh. Đọc thêm `.local-dev/HUONG-DAN.md`.
- Test: `source tools/local-e2e/env.sh`, rồi `npx tsx tools/local-e2e/<bài>.ts`. `t-*.ts` là logic và API, `ui-*.ts` là trình duyệt. Xem `tools/local-e2e/README.md`.
- Làm song song bằng nhiều worktree: `.local-dev/mk-wt.sh`, `wt-up.sh`, `AGENT-COMMON.md`, `AGENT-UI.md`. Mỗi worktree khoảng 2 GB cộng bộ nhớ đệm `.next`, đừng mở quá 3 cái cùng lúc, xoá `.next/dev/cache` khi ổ đĩa thấp.
- Không chạy test trên CSDL thật: `h.ts` có hàm xoá sạch mọi bảng.
- Ba bài quét theo vai trò (`ui-role-everything`, `ui-tutor-everything`, `ui-links-everywhere`) cần dòng `127.0.0.1 midnightelite-edu.com admin.midnightelite-edu.com` trong `/etc/hosts`; lần hồi quy cuối chưa chạy được vì thiếu dòng này.

Kết quả hồi quy cuối (bản `e5a4e8c`, 146 bài): 135 đạt ngay, `tsc` sạch, không có bài đỏ mới do mã. Bốn bài đỏ có sẵn từ trước: `t-attendance-export-lib`, `t-health-metrics-lib`, `t-taught-sessions-lib` (truy vấn `attendanceSession.count` trần ở `src/app/lop-cua-toi/[courseId]/page.tsx` dòng 71), `t-unmarked-lib`. Cũng đỏ sẵn hoặc hay chập chờn: `ui-schedule`, `ui-journey-new-tutor`, `ui-pro-stats`, `ui-theme`, `ui-media` (ca "Ghim mốc"), `ui-account-menu` (chập chờn), `ui-invoice-zalo` (cứng cổng 3100), `t-hocphi-schema-additive` (so với commit gốc cũ nên luôn đỏ). Bài chập chờn thường là timeout lúc máy tải nặng: chạy lại một lần rồi mới kết luận.

## 3. Đã làm trong đợt này

- **Nền và giao diện theo Figma** (trang "📐 Nền móng"): token `--kin-*`, thành phần dùng chung trong `src/components/kin`, phông Inter cho vỏ gia sư, chế độ Sáng/Tối/Theo máy. Mười màn gia sư (Hộp việc, Lịch, Lớp, Học sinh, Bài tập, Học phí...), màn học sinh, phụ huynh, khách, quản trị, các trạng thái rỗng/lỗi.
- **Gia sư:** Hộp việc có thẻ số buổi trong tháng và thẻ yêu cầu tìm gia sư; Lịch; tạo lớp qua wizard 3 bước; hồ sơ học sinh (có "Lưu trữ khác với xoá" và nút "Xem ảnh hưởng khi xoá", chỉ đọc); buổi học (có "Ghi chú buổi trước"); dời buổi và học bù; kiểm dữ liệu tại chỗ ở form đăng ký, tạo lớp, thêm học sinh, hồ sơ.
- **Học phí:** kiểu tính mới (theo buổi, theo giờ, theo khoá), chốt buổi là điều kiện sinh phí cho lớp kiểu mới, hoàn tác, gợi ý phí trễ hạn (chỉ chữ, không tự cộng tiền). Số cũ không đổi: test chứng minh 0 sai lệch với lớp cũ.
- **Quiz:** hạn nộp riêng từng học sinh, tải mẫu Excel và nhập lại, xuất nhật ký CSV (chống chèn công thức), chữa bài nhiều đáp án, lưu câu vào ngân hàng, màn hết giờ theo Figma, thanh công thức (x², √x, phân số), logic giữ/công bố điểm hợp nhất (`src/lib/examHold.ts`).
- **Gói KiN Pro:** đo trước thu sau, cổng hạn mức tắt mặc định, thanh toán VietQR, webhook SePay tự kích hoạt (idempotent, sai số tiền thì để admin duyệt tay), nhắc gia hạn T-7/T-3/T-0, trang admin `/admin/goi-pro`.
- **Quản trị:** `/admin/ho-tro`, `/admin/nhat-ky`, `/admin/trien-khai`, hàng chờ.
- **Media và bảo mật:** bản ghi bằng link chữ, trang Bản ghi của lớp, các lỗ bảo mật media đã vá (MD-03, MD-09, QZ-14).
- **Dữ liệu học sinh:** dán danh sách, nhập Excel/CSV, hồ sơ không tài khoản, biểu mẫu khách tìm gia sư, có hộp đồng ý.

## 4. Quyết định của chủ (mới nhất đứng trên)

**25/10/2026 (Thanh, thay mặt dự án):**
1. **Không có gói buổi trả trước.** Học xong rồi mới thu học phí, theo số buổi gia sư báo cho học sinh hoặc phụ huynh. Hệ quả: tính năng "gói buổi trả trước" (HP-31: bảng `session_packages`, `session_package_uses`, `src/lib/sessionPackage*.ts`, `LopGoiBuoi.tsx`, `SessionPackages.tsx`, API `/api/courses/[id]/packages`) **không còn cần**. Việc cần làm: ẩn hoặc gỡ mục "Gói buổi trả trước" ở tab Học phí của gia sư và ở Sổ của con (phụ huynh); quyết định giữ hay xoá hai bảng (giữ thì vô hại, bảng mới chỉ thêm). Gỡ phải kèm sửa bài `t-session-package*`, `ui-session-package`, `mock/hp-hoc-phi-3-goi-buoi.ts`.
2. **Người học đều từ 17 tuổi trở lên**, không cần làm quá chặt phần dữ liệu trẻ em. Hệ quả: các luồng đồng ý của phụ huynh, ngưỡng 16 tuổi, hộp đồng ý kép (ConsentRecord, consentPolicy, maskProfile, `selfConsentAt`) có thể đơn giản hoá cho người học từ 17 tuổi. Lưu ý khi làm, đừng gỡ hết:
   - Giữ một rào tuổi rõ ràng ở đăng ký và khi gia sư thêm học sinh (tối thiểu 17), để hệ thống không nhận người dưới ngưỡng ngoài ý muốn.
   - Với người trưởng thành vẫn cần thông báo thu thập dữ liệu ngắn gọn (Nghị định 13/2023 áp dụng cho dữ liệu cá nhân nói chung, không chỉ trẻ em) và mỗi gia sư chỉ thấy dữ liệu học sinh của mình.
   - Chưa có ý kiến luật sư. Nên xin ý kiến trước khi bỏ hẳn các hộp đồng ý và trước khi mở cho người dùng thật.
   - Làm từng bước nhỏ, giữ test cũ, sửa test cho đúng quy tắc mới (không xoá ca).
3. **Thanh bên mặc định hiện đủ mọi module.** Không giấu tính năng theo tuỳ chọn. Hiện trạng: `TUTOR_MODULES` trong `src/lib/userPreferences.ts` chỉ cho `Lịch` và `Học phí` luôn hiện (`always: true`); các module còn lại tuỳ chọn, và khi `preferences.modules` chưa có thì thanh bên ở "chế độ gọn" (chỉ Lịch và Học phí). `TutorShell.tsx` có dòng "Thêm module" khi còn module ẩn. Việc cần làm: khi `preferences.modules` chưa có, mặc định coi như đã bật đủ mọi module tuỳ chọn; ai đã chọn rõ thì giữ lựa chọn của họ. Cài đặt › Module hiển thị vẫn cho ẩn bớt. Tìm và sửa các bài kiểm có chữ "chế độ gọn", "TT-203", `modules` (ví dụ `ui-tutor-shell`, `ui-sidebar`, bài về `userPreferences`) cho đúng quy tắc mới, không xoá ca. Sơ đồ mới ở Figma, mục 8 (thanh bên rộng, đủ mục, không còn nút Khác).

**24/10/2026:** bỏ hết mục "Cố ý không làm" khỏi phạm vi (tải video lên, ảnh bài làm của trẻ, gói Nhóm/Trung tâm, thẻ tín dụng, điểm danh sinh trắc); chốt buổi là điều kiện sinh phí; nhãn "Đã xác minh" đổi thành "Đã duyệt hồ sơ"; phí trễ hạn chỉ gợi ý; Pro tự kích hoạt bằng webhook SePay. Chi tiết ở `pro/QUYET-DINH-CHU.md`.

**23/10/2026:** học phí thêm kiểu tính mới; video chỉ nhận link chữ; Pro "đo trước thu sau", không dùng Coin trả Pro, không tự trừ tiền.

## 5. Việc còn lại (theo thứ tự nên làm)

### A. Kiểm tra trên bản thật sau khi merge
Đăng nhập gia sư và học sinh, Hộp việc, tạo lớp, điểm danh, chốt buổi, phiếu học phí, thi thử quiz, `/admin/trien-khai`. Chưa có ai thử webhook SePay với dữ liệu thật; payload và header theo `parseSepayPayload` và `extractApiKey` của luồng học phí.

### B. Lệch Figma chưa làm (đã so ảnh, đa số lệch lớn)
- **Đăng nhập và đăng ký:** Figma dùng header tối giản, tab "Gia sư / Học sinh", nút "Tiếp tục với Google", ô "Ghi nhớ trên thiết bị này". Bản thật dùng thanh điều hướng đầy đủ, tab "Mật khẩu / Mã một lần", đăng ký 2 bước. Đăng nhập Google chưa làm (cần tích hợp bên ngoài).
- **Điểm danh theo tháng:** chưa có lưới tháng (học sinh × ngày), bộ lọc Lớp/Tháng/Học sinh, bảng "Tổng hợp chuyên cần", khung "Ô đang chọn". Hiện chỉ có điểm danh từng buổi.
- **Đổi buổi và học bù:** chưa có bảng "Chọn buổi bù" (khung giờ/tình trạng), nút "Huỷ thay đổi / Xác nhận phương án", khối "Chuẩn bị thông báo Zalo" trên cùng màn. Phần "Xử lý học phí buổi gốc" và "Phí buổi bù" cố ý chưa làm vì dính tiền.
- **Kết nối và lưu trữ:** chưa có màn riêng, chưa có "Tệp theo lớp" kèm dung lượng, "Xuất dữ liệu cá nhân", "Quản lý quyền và xoá dữ liệu".
- **Phân tích dạy học và doanh thu:** chưa có bảng "Đối chiếu tiền học phí", "Dự kiến lịch tương lai", "Minh chứng chờ xem", các ô lọc Kỳ/Lớp.
- **Kiểm duyệt và nhật ký admin:** Figma gom một màn có "Quyết định xử lý", "Bằng chứng tối thiểu", luồng Giữ hiển thị / Rà soát ẩn hồ sơ / Khôi phục và nút xuất nhật ký; bản thật tách thành hai trang.
- **`/admin/trien-khai`:** chưa có khối "Rà soát cấu hình" (huỷ bản nháp, xem lại, khôi phục), hạn mức Free/Pro, chống spam, phễu.
- **Hồ sơ học sinh:** chưa có đơn giá và "Đổi cách tính phí" theo từng em, PIN 4 số và "Lần xem / Kênh" của link báo cáo, nút "Lưu trữ học sinh" (hiện dùng "Đã nghỉ").
- **Buổi học:** chưa có xem trước PNG báo cáo, tải PDF buổi, "Phí dự kiến khi chốt", "Chính sách cho em", nhận xét riêng của buổi trước, tải ảnh bài làm (đã loại khỏi phạm vi).
- Ghi chú đo lường: phép đo "nút nhỏ hơn 44px" chưa lọc riêng các nút, nên quy tắc nút từ 44px chưa được kết luận cho từng trang; hãy đo lại chỉ với `button` và `a` đóng vai nút.

### C. Việc kỹ thuật nhỏ
- Nhắc gia hạn Pro hiện chỉ có trong ứng dụng; tài liệu Pro còn nói email, chưa làm.
- Khoản thanh toán Pro sai số tiền chỉ nằm ở danh sách admin, gia sư không được báo.
- Hạn riêng của quiz gắn theo từng đề, phiên bản đề mới không tự mang hạn sang.
- Lint còn vài lỗi cũ ở `QuestionBankPicker`, trang học sinh `thi-thu`, trang admin ngân hàng câu hỏi.
- Logo gia sư tải lên chưa làm (chưa có cách tải ảnh an toàn).
- Tệp mock dữ liệu: `tools/local-e2e/mock/` (hv-04, hv-05, qz-hoan-thien, ui6, hp-hoc-phi-3-goi-buoi).

### D. Cần ý kiến bên ngoài trước khi dùng thật
- Luật sư: Nghị định 13/2023, Luật Trẻ em 2016, Luật 91/2025, nhất là sau khi đơn giản hoá phần đồng ý theo mục 4.
- Kế toán: cách ghi nhận các loại phí học phí mới; thu thuê bao Pro. Khoản này nên có ý kiến trước khi đặt `KINPRO_*`.

## 6. Quy tắc cứng của kho (đừng phá)

- **Schema chỉ thêm** (cột/bảng mới, không xoá, không `@unique` mới trên bảng cũ). `t-db-push-guard` kiểm.
- **Tiền:** không đổi phiếu đã chốt; test phải chứng minh số cũ không đổi (0 sai lệch); chặn `VERCEL_ENV=preview` ở mọi đường tính tiền; không tự trừ tiền; không dùng Coin trả Pro.
- **Dữ liệu học sinh:** gia sư chỉ thấy học sinh của mình; thông báo không kèm tên hay số tiền; không gửi dữ liệu học sinh cho AI ngoài; không thêm trường dữ liệu cá nhân mới khi chưa cần.
- **Giọng và nội dung trung thực:** không viết "đã gửi", "đã xác minh", "đúng luật", "miễn thuế" khi chưa đúng; không số liệu bịa (`t-no-fabricated`).
- **Giao diện:** chỉ dùng token `--kin-*`, không mã hex (`t-no-hex`); không link chết (`t-links`); 390px không tràn ngang; nút từ 44px; ghi dữ liệu bằng POST rồi chuyển 303.
- **Next 16 không chuẩn:** đọc `node_modules/next/dist/docs` trước khi viết mã Next (xem `AGENTS.md`).
- **Sửa test:** không xoá ca. Bài lỗi thời thì sửa kèm lý do bằng chú thích trong tệp; mã mới thì thêm ca phá cố ý (bẻ mã cho bài đỏ rồi trả lại).
- Mọi thay đổi dính tiền hoặc dữ liệu học sinh: ghi rõ vào báo cáo để chủ duyệt.

## 7. Bẫy đã gặp

- Gộp `schema.prisma`: luôn chạy `npx prisma validate` và đếm dấu ngoặc `}`. Từng mất một dấu `}` sau `@@map("support_requests")`.
- Sau khi gộp schema: `npx prisma generate` rồi `prisma db push` lên CSDL demo trước khi chạy `tsc`.
- Chuỗi kết nối cho `prisma db push` lên Neon phải là kết nối trực tiếp (không có `-pooler`).
- Ổ đĩa đầy làm test lỗi `ENOSPC` giả: `du -sh .claude/worktrees/*`, xoá worktree đã gộp, xoá `.next/dev/cache`.
- Bộ nhớ đệm `.next` mỗi worktree tăng tới 3 đến 4 GB khi chạy test dài.
- Test dùng ngày hôm nay: `ui-session-book` từng đỏ vào Chủ nhật vì buổi "ngày mai" rơi sang tuần sau của Lịch. Mọi bài tạo dữ liệu theo "hôm nay/ngày mai" phải xử lý tuần.
- Component báo thành công trước khi làm mới dữ liệu thì test đọc quá sớm và người dùng thấy danh sách cũ: luôn làm mới rồi mới báo.
- Bản xem trước của Vercel chặn đường tiền (`VERCEL_ENV=preview`), nên không thử thanh toán Pro ở đó được.

## 8. Figma: thanh bên đầy đủ và các màn bổ sung (25/10/2026)

File Figma: `https://www.figma.com/design/2orXvoHL2upkiGoMjlq8aX/KiN-Design-System`. Làm việc trực tiếp trong file, không qua GitHub. Đã dọn còn 13 page; xoá 25 page cũ, thử nghiệm, lưu trữ và trùng lặp (khôi phục bằng File › Show version history nếu cần).

**Đọc theo thứ tự:**
1. Page `📖 Mục lục & liên kết`: cấu trúc file, mỗi mục thanh bên dẫn tới màn chủ, danh mục màn theo vai, khoảng trống còn lại.
2. Page `✅ Bản final — thanh bên & tính năng` (id `578:2`): thanh bên mở rộng đủ mọi tính năng của gia sư (18 mục), học sinh (19 mục), quản trị (24 mục trang con), kèm bản đồ `tính năng → màn Figma → đường dẫn ứng dụng`. Đây là chuẩn để dựng web. Mục không có màn Figma ghi "chưa có màn".
3. Page `📐 Nền móng`: 84 màn gốc và 4 Section `🆕 … màn bổ sung 25/10` (28 màn mới, dựng từ khung vỏ có sẵn, dùng biến màu, kiểu chữ và thành phần chung).

**Thanh bên chuẩn (một chuẩn duy nhất, đã áp cho mọi màn desktop trong `📐 Nền móng`):**
- Thanh bên mở rộng, rộng 272px, chia nhóm, hiện đủ mọi mục. Khung màn rộng 1600px = thanh bên 272 + vùng làm việc 1328. Không còn thanh icon 112px và không còn nút "Khác" giấu mục. Đừng dựng bản thanh icon + bảng "Khác": đó là bản cũ.
- Gia sư (18 mục): Làm việc hằng ngày (Hộp việc, Lịch, Lớp, Học sinh, Bài tập, Thư viện), Dạy học (Tổng quan, Kế hoạch buổi, Báo cáo tháng, Sổ điểm, Kiểm duyệt cộng đồng), Tiền (Học phí, Doanh thu), Giới thiệu (Hồ sơ gia sư, Bài đăng tìm học sinh), Tài khoản (Gói của tôi, Liên hệ hỗ trợ, Cài đặt).
- Học sinh (19 mục): Làm việc hằng ngày (Việc của tôi, Lịch học, Lớp của tôi, Bài tập), Học tập (Thư viện, Tiếng Anh tự học, Thi thử, Bảng xếp hạng, Hỏi đáp, Cộng đồng), Khám phá (Khoá học đang mở, Lớp đang theo dõi, Gia sư, Tin tức, Tra cứu điểm chuẩn), Tài khoản (Hồ sơ, Học phí, Ví và Coin, Chủ đề màu).
- Quản trị (24 trang con): 5 nhóm Kiểm duyệt, Người dùng, Nội dung, Báo cáo, Cài đặt; mỗi trang con có mục riêng, trang đang mở được tô sáng. Trong màn Nội dung và Cài đặt còn dải tab trang con ở đầu trang.
- Điện thoại: thanh dưới 4 mục, không có bảng Khác. Phụ huynh không có thanh bên.
- Mỗi màn chỉ tô sáng đúng một mục (đã kiểm: 80 màn, 0 màn thiếu hoặc thừa mục đang chọn). Page `🖥 Vỏ ứng dụng — 4 vai` là bản cũ, đã ghi chú không dùng để dựng.

**Màn bổ sung (node id, đường dẫn app):**

| Vai | Màn | Id | Đường dẫn |
|---|---|---|---|
| Gia sư | Gói của tôi | `565:4641` | `/lop-cua-toi/goi` |
| Gia sư | Liên hệ hỗ trợ | `565:4947` | `/lop-cua-toi/ho-tro` |
| Gia sư | Tổng quan | `574:5188` | `/lop-cua-toi/tong-quan` |
| Gia sư | Kế hoạch buổi | `574:5489` | `/lop-cua-toi/ke-hoach-buoi` |
| Gia sư | Báo cáo tháng | `574:5777` | `/lop-cua-toi/bao-cao-thang` |
| Gia sư | Kiểm duyệt cộng đồng | `574:6082` | `/lop-cua-toi/kiem-duyet` |
| Gia sư | Bài đăng tìm học sinh | `574:6351` | `/lop-cua-toi/bai-dang` |
| Học sinh | Thi thử | `575:5571` | `/student/thi-thu` |
| Học sinh | Bảng xếp hạng | `575:5805` | `/student/bang-xep-hang` |
| Học sinh | Ví và Coin | `575:5999` | `/student/vi` |
| Học sinh | Hồ sơ | `575:6186` | `/student/ho-so` |
| Học sinh | Tiếng Anh tự học | `575:6349` | `/student/tieng-anh` |
| Học sinh | Hỏi đáp | `575:6538` | `/student/hoi-dap` |
| Học sinh | Cộng đồng | `575:6741` | `/student/cong-dong` |
| Quản trị | Nội dung — Khoá học | `567:4791` | `/admin/khoa-hoc` |
| Quản trị | Nội dung — Danh mục | `576:5883` | `/admin/khoa-hoc/danh-muc` |
| Quản trị | Nội dung — Đề thi | `576:6117` | `/admin/thi-thu` |
| Quản trị | Nội dung — Ngân hàng câu hỏi | `576:6355` | `/admin/thi-thu/ngan-hang-cau-hoi` |
| Quản trị | Nội dung — Ngân hàng đề | `576:6594` | `/admin/thi-thu/ngan-hang-de-thi` |
| Quản trị | Nội dung — Tin tức & Blog | `576:6817` | `/admin/tin-tuc` |
| Quản trị | Nội dung — Điểm chuẩn | `576:7032` | `/admin/diem-chuan` |
| Quản trị | Nội dung — Bảng vinh danh | `576:7239` | `/admin/vinh-danh` |
| Quản trị | Cài đặt — Gói KiN Pro | `567:5048` | `/admin/goi-pro` |
| Quản trị | Cài đặt — Hỗ trợ gia sư | `568:4923` | `/admin/ho-tro` |
| Quản trị | Cài đặt — Duyệt nạp Coin | `568:5154` | `/admin/topups` |
| Điện thoại | Gia sư · Lịch | `570:5054` | thanh dưới |
| Điện thoại | Học sinh · Lớp của tôi | `570:5237` | thanh dưới |
| Điện thoại | Học sinh · Bài tập | `570:5387` | thanh dưới |

**Lưu ý khi dựng từ các màn này:**
- Số liệu và tên trong màn là ví dụ minh hoạ, không phải dữ liệu thật.
- Ví và Coin của học sinh: Coin là điểm thưởng làm bài, học sinh không nạp bằng tiền. Duyệt nạp Coin của quản trị là cho yêu cầu nạp của gia sư.
- Gói của tôi: gói Free hiện "Chưa mở bán" cho tới khi đặt đủ biến `KINPRO_*`; KiN không tự trừ tiền.
- Chưa có màn Figma cho: Thư viện, Khoá học đang mở, Lớp đang theo dõi, Tin tức, Tra cứu điểm chuẩn, Học phí và Chủ đề màu của học sinh; Bài viết cộng đồng, Báo cáo trả lời, Đánh giá khoá học, Hồ sơ học sinh, Doanh thu, Phễu gia sư, Số đo sản phẩm của quản trị.
- Liên kết prototype (mục thanh bên, dải tab) đã nối giữa các màn trong `📐 Nền móng`; mới kiểm bằng ảnh chụp, chưa chạy thử chế độ Present.
