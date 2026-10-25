# Hiện trạng QUYẾT ĐỊNH và MÃ về gói / VIP / Coin / chạy thử miễn phí của KiN (đọc đến 22/10/2026)

> **Phạm vi.** Chỉ đọc (kho, nhánh Git, API GitHub chỉ-đọc, Google Sheet chỉ-đọc). Không sửa tệp nào ngoài tệp này, không chạy máy chủ hay test, không ghi vào sheet, không commit/push. Mục tiêu: để báo cáo thiết kế gói Pro không đề xuất thứ đã có, đã bị bác, hoặc đã quyết khác.
>
> **Thẻ.** `[Đã đọc mã]` mở tệp thấy tận mắt · `[Đã đọc tài liệu]` · `[Đã đọc sheet]` (4 cột H=Thọ, I=Thọ Note, J=Thanh, K=Thanh Note, đúng quy tắc CLAUDE.md) · `[Đã đọc Git/GitHub]` · `[Suy luận]` · `[Chưa kiểm được]`. Đường dẫn tính từ gốc kho `/home/user/midnight-elite`; `NC2:` = nhánh `origin/claude/nang-cap-2` (đầu `5d583f7`); `HEAD:` = nhánh `claude/keen-allen-wiz3em` (đầu `2dd48a4`).
>
> **Đã đọc đến đâu.** (a) Ba tài liệu NC2 đọc trọn; bản trong nhánh và bản sao ở scratchpad giống nhau (`diff` trống). Cũng đọc trọn `PROMPT-nang-cap-2.md`, `docs/kin/ke-hoach-nang-cap-2.md`, `docs/kin/backlog/nang-cap-lan-2.csv`, `du-thao-chinh-sach.md`, khối "Nâng cấp lần 2" của `tien-do-dang-do.md`, `CLAUDE-cho-kho-trien-khai.md`, `quyet-dinh-va-doi-chieu.md`. (b) Sheet: tải **trọn** tab "Trang tính1" (A1:K300, 237 dòng), lọc bằng từ khoá ra 75 dòng rồi đọc cả 4 cột của từng dòng đó; **không** đọc từng dòng của ~160 dòng còn lại. Tab "Nâng cấp lần 2" đọc trọn (A1:Q60). Tab "Nâng cấp lần 1" tải trọn 71 dòng, đọc hàng Q1–Q8, NC1-100/110/111 và các dòng khớp từ khoá. Tab "Bảng điều khiển" đọc 60 dòng đầu. (c) Mã: đọc trọn các tệp ghi ở từng mục. **Không** đọc: giá thật trên Vercel, biến môi trường Production, dữ liệu DB thật, Figma. Test chỉ đọc mã test, **không chạy**; mọi số "đạt/đỏ" là số các tài liệu NC2 tự ghi.
>
> **Hai lưu ý phương pháp.** (1) `git diff origin/claude/keen-allen-wiz3em...origin/claude/nang-cap-2 --stat` ra 214 tệp vì NC2 được cherry-pick (mã băm khác, merge-base chỉ là `main` `de1fb2e`) nên gồm cả ĐX-00…07. Phần **chỉ của NC2** so với bản NC1 là `git diff 3b06e8e origin/claude/nang-cap-2`: 137 tệp, +5889/−191; trong `src/` + `prisma/` là 59 tệp. (2) Có nhánh mới `origin/claude/giao-dien-moi` (`bcba99b`) và 8 nhánh PR chồng `claude/nc2-pr1…pr8` chưa nằm trong tham chiếu cục bộ; tôi tải riêng `giao-dien-moi` vào kho tạm ở scratchpad (không đụng kho chính) và chỉ tìm từ khoá giá/Coin/VIP; nội dung là tài liệu thiết kế giao diện, không có mã gói.

---

## 1. KIN_TRIAL_MODE hoạt động thế nào; điều gì CHƯA chặn; các thay đổi NC2 khác về gói/tiền/hạn mức

### Takeaway
KIN_TRIAL_MODE là một công tắc môi trường (`"1"` mới bật, mặc định tắt) chỉ **ẩn lối mua**: API mua gói trả 403 trước mọi chạm ví và form nạp Coin của gia sư được thay bằng banner. Nó **không** chặn `POST /api/wallet/topups` của gia sư, không khoá tính năng nào, không đổi giá/ví/schema; và toàn bộ mã này chưa vào `main` (PR #72 còn mở), env Production chưa đặt.

### Cited Findings

**A. Cờ**
- Một chỗ duy nhất đọc cờ: `src/lib/trialMode.ts` (NC2, 13 dòng). `isTrialMode(env = process.env)` trả `env.KIN_TRIAL_MODE === "1"`; mọi giá trị khác (`""`, `"0"`, `"true"`, thiếu) là TẮT (`trialMode.ts:7-9`). Chữ cố định: `TRIAL_MODE_MESSAGE = "KiN đang miễn phí trong giai đoạn chạy thử, chưa cần mua gói."`, banner `"KiN miễn phí trong giai đoạn chạy thử"` / `"Bạn chưa cần mua gói hay nạp Coin để dùng KiN."` (`trialMode.ts:11-13`). Chú thích đầu tệp: "Cờ CHỈ ẩn lối MUA phía gia sư (mua VIP, nạp Coin). Không xoá gói/giá, không đụng ví, không đổi cách tính; gia sư đã có gói đang hiệu lực không bị ảnh hưởng." [Đã đọc mã] — `NC2:src/lib/trialMode.ts:1-13`.
- Commit `a4b1275` (22/10/2026 15:13 +0700, tác giả git "Nguyễn Phúc Thanh", dòng cherry-pick từ `49e2e57`), 9 tệp, +265/−5. Thông điệp commit: "Bật: POST /api/subscriptions/[code]/purchase trả 403, GET subscription trả trial:true, trang ví của gia sư hiện banner thay form nạp. Không đụng ví/Coin/giá/schema; học sinh và gia sư đã có gói không đổi." [Đã đọc Git] — `git show a4b1275`.

**B. Cái cờ chạm (khi BẬT)**
1. `POST /api/subscriptions/[code]/purchase`: sau kiểm vai gia sư (`purchase/route.ts:26-28`), `if (isTrialMode()) return 403 {error: TRIAL_MODE_MESSAGE, trial: true}` (`:30-33`), **trước** `getTutorVIPPlan` và `prisma.$transaction`, nên mã gói lạ cũng ra 403, không trừ Coin, không tạo `TutorSubscription`. [Đã đọc mã] — `NC2:src/app/api/subscriptions/[code]/purchase/route.ts:26-38`.
2. `GET /api/subscriptions` (công khai, danh sách 3 gói) nay trả thêm `trial: isTrialMode()` — **vẫn trả bảng giá** (`subscriptions/route.ts:14`). `GET /api/users/me/subscription` trả `{subscription, trial}` (`me/subscription/route.ts:14`). [Đã đọc mã]
3. Trang ví `src/app/(student)/student/vi/page.tsx` (một trang dùng chung học sinh + gia sư): `isTutor = user.role==="admin" && user.adminRole==="teacher"` (`:47`), gọi `/api/users/me/subscription` lấy `trial` (`:84-92`), `hideTopup = !isTutor || trial !== false` (`:94`); khi cờ bật gia sư thấy banner (`:144`) và form "Yêu cầu nạp Coin" bị bọc `{!hideTopup && <form…>}` (`:152`); dòng mô tả đổi, bỏ lời mời "Nạp Coin để mua gói VIP" (`:127-131`). [Đã đọc mã]

**C. Cái cờ CHƯA chặn / không làm (đã kiểm trong mã)**
1. **`POST /api/wallet/topups` của gia sư vẫn nhận khi cờ bật.** Route NC2 chỉ có thêm khối chặn `role === "student"` (`NC2:src/app/api/wallet/topups/route.ts:22-26`); không có `isTrialMode()` nào trong route. Chính tài liệu NC2 xác nhận: "CHƯA chặn POST /api/wallet/topups — chờ Thọ quyết (dính ví)" (CSV NC2-023 cột I; NC2-Q9 cột I); báo cáo cuối: "Quyết có chặn `POST /api/wallet/topups` khi bật cờ không (hiện chỉ ẩn form)" (`bao-cao-nang-cap-2-2026-10-22.md:56`). [Đã đọc mã + tài liệu]
2. Trang admin `/admin/topups` và `POST /api/admin/topups/[id]/approve|reject` không đổi — admin vẫn duyệt, Coin vẫn được cộng, kể cả khi cờ bật. `grep isTrialMode` chỉ ra 4 tệp: `purchase/route.ts`, `subscriptions/route.ts`, `me/subscription/route.ts`, `trialMode.ts` (+ import chữ ở trang ví). [Đã đọc mã]
3. Không có hạn mức hay khoá tính năng nào: `isActiveTutorVIP` chỉ được định nghĩa (`src/lib/tutorSubscription.ts:38`) và **không ai gọi** — kiểm bằng `grep` ở cả HEAD và NC2; ra-soat NC2 ghi cùng kết luận ("Đúng: định nghĩa ở `tutorSubscription.ts:38`, không nơi nào gọi", `ra-soat-goi-nang-cap-2-2026-10-22.md:17`). [Đã đọc mã]
4. **Không có giao diện nào để mua gói**, kể cả khi cờ tắt: bài test quét tĩnh khẳng định "không giao diện nào gọi API mua gói (hiện chỉ có API)" và "chỉ MỘT trang gọi API nạp Coin: /student/vi" và "liên kết tới /student/vi chỉ nằm ở vỏ học sinh (gia sư không có mục menu nào dẫn tới)" (`NC2:tools/local-e2e/t-trial-mode-lib.ts:30-36` theo bản đọc). Phiếu việc NC2-023 cũng ghi "LỆCH PHIẾU: … `POST /api/subscriptions` không tồn tại; không có màn 'Gói'/nút 'Mua VIP' của gia sư". [Đã đọc mã + tài liệu]
5. Giá và hằng `TUTOR_VIP_PLANS` giữ nguyên (300.000 / 1.500.000 / 2.500.000 Coin; 30/180/365 ngày) — bài `t-trial-mode.ts` kiểm đúng mảng này. [Đã đọc mã test]
6. Học sinh: `POST /api/wallet/topups` trả 403 vô điều kiện (không phụ thuộc cờ) — xem D dưới.
7. Trang ví "fail-open": nếu gọi `/api/users/me/subscription` lỗi hoặc không `ok` thì `setTrial(false)` (`vi/page.tsx:87-90`) → `hideTopup=false` → gia sư thấy lại form nạp. Tài liệu NC2 ghi nhận "form nạp Coin ở ví có thể hiện một nhịp cho gia sư trước khi AuthContext tải xong" là nợ P3 (`tien-do-dang-do.md` khối "Rà soát độc lập", mục (5)). [Đã đọc mã]

**D. Các thay đổi khác của NC2 liên quan tiền/Coin/hạn mức**
- **NC2-036 (commit `6db9658`, 22/10 20:01, "theo chỉ đạo của Thọ 22/10" theo CSV):** (i) `POST /api/wallet/topups` trả 403 cho `role = student` — "Coin của học sinh nhận từ làm bài, không nạp bằng tiền. Học phí chuyển khoản theo phiếu của gia sư." (`topups/route.ts:22-26`); (ii) thưởng Coin làm bài: `src/lib/quizReward.ts` (+42 dòng, hàm thuần), `addQuizRewardCoins` ở `wallet.ts`, nối ở `POST /api/exams/attempts/[attemptId]/submit` (trả thêm `coinsEarned`): nộp đúng hạn & đúng ≥50% → +5; đúng ≥80% và dùng ≤50% thời gian (tối thiểu 30 giây) → +5 nữa; mỗi (học sinh, đề) 1 lần; tối đa 5 lượt/ngày; rời tab >3 lần, nộp trễ, hết giờ, đề của chính mình → không thưởng; ngưỡng ở `wallet-constants.ts` (`QUIZ_REWARD_BASE=5`, `QUIZ_REWARD_FAST_BONUS=5`, `MAX_QUIZ_REWARDS_PER_DAY=5`…); ghi `CoinTransaction.reason="quiz_reward"`, `sourceType="reward"`, không đổi schema; (iii) trang ví học sinh ẩn form nạp, chữ "Coin không mua được bằng tiền"; (iv) **chưa làm game cược**; rào cản ghi lại: "Coin học sinh KHÔNG được mua bằng tiền, KHÔNG đổi ra tiền/quà có giá trị, KHÔNG chuyển giữa tài khoản; trẻ em + cược → hỏi luật sư trước (Q-LS-16)". Comment trong `wallet-constants.ts`: "Đây là nền để sau này làm game trong web mà không biến thành đánh bạc bằng tiền thật." [Đã đọc mã + tài liệu] — `git show 6db9658`; CSV NC2-036; `tien-do-dang-do.md` khối NC2-036.
- Ngoài ra NC2-036 xác nhận phần "học sinh chuyển khoản học phí tự xác nhận": "ĐÃ CÓ từ TT-200 — webhook SePay tự gạch phiếu khi đúng mã phiếu + đúng số tiền còn lại + phiếu đang mở … Không viết thêm." [Đã đọc sheet/CSV]
- **NC2-035 (`1aee302`, `6135002`):** `src/lib/courseValidation.ts` (mới) — gia sư đặt giá lớp tối đa `MAX_TUTOR_COURSE_PRICE_VND = 50_000_000`, tối đa 1.000 bài, 5.000 giờ; chỉ **từ chối** giá trị vô lý, "KHÔNG đổi cách tính phí/phiếu/học phí"; tien-do ghi "trần 50 triệu cần Thọ xem lại". Đây là hằng trần duy nhất liên quan tiền do NC2 thêm; **không phải hạn mức gói**. [Đã đọc mã]
- **NC2-010 (`c01c813`):** thêm thông báo cho gia sư khi phụ huynh bấm "Tôi đã chuyển" (`invoiceServer.ts`: `notifyTutorParentReported`, chống dội 24h/phiếu); không đổi cách ghi nhận hay tính tiền. [Đã đọc mã]
- **NC2-020 (`3f583e9`):** 3 chỉ số kích hoạt gia sư ở `/admin/so-do` (`healthMetrics.ts`: `actClass`, `actTeach`, `actMedian`), mẫu số <10 thì "chưa đủ dữ liệu" (`MIN_SAMPLE = 10`). Chỉ số "Gia sư đang dùng" (`tutors`) = gia sư đã duyệt, không khoá, có ≥1 buổi đã dạy trong khoảng. **Không có chỉ số nào đếm gia sư vượt hạn mức Free** (không có hạn mức để vượt). [Đã đọc mã]
- **NC2-022** (`564f487`) công tắc Hiện/Ẩn hồ sơ công khai, **NC2-029/029c** rút gọn luồng tạo lớp và đồng bộ vai phiên — không đụng tiền/gói. [Đã đọc tài liệu]
- Schema NC2 chỉ thêm `PushSubscription` (`push_subscriptions`); **không thêm model Plan/Setting/hạn mức** (`git diff prisma/schema.prisma`). [Đã đọc mã]
- **NC2-027** (Google OAuth) và **NC2-028** (hạn mức Free/Pro cấu hình từ admin): CHƯA LÀM. NC2-028: "Báo cáo 8.1 #4 / 8.2.1: mọi hạn mức phải cấu hình được từ admin, không viết cứng. Hiện chưa có hạn mức nào (KiN chưa khoá gì); TUTOR_VIP_PLANS viết cứng. Chỉ làm khi bật Pro." Ưu tiên P3, phụ thuộc NC2-023, cột I: "CHƯA LÀM — dính tiền (Q9, sau chạy thử). NC2-023 chỉ thêm cờ ẩn lối mua." [Đã đọc sheet + CSV]

**E. Test của cờ (chỉ đọc mã test, không chạy)**
- `t-trial-mode-lib.ts`: bảng giá trị bật/tắt, quét tĩnh các điểm vào mua/nạp, kiểm cổng `isTrialMode()` đứng trước `prisma.$transaction` và chỉ một chỗ đọc `KIN_TRIAL_MODE`. `t-trial-mode.ts` (API+DB, chạy 2 lần EXPECT_TRIAL=0/1): cờ bật → mua 403 cho cả mã gói lạ, không đổi ví, gói đang có không đổi; **học sinh gửi nạp → 403 cả hai chế độ**. `ui-trial-mode.ts`: ví gia sư bật/tắt, 6 trang `/lop-cua-toi/*` không có lối "Mua VIP / Nạp Coin". Số do tài liệu NC2 tự ghi: `t-trial-mode-lib` 23/23; `t-trial-mode` 13/13 (tắt) & 15/15 (bật); `ui-trial-mode` 13/13 & 16/16 (rồi "cập nhật" sau NC2-036, không ghi lại số mới). [Đã đọc mã test + tài liệu; **chưa chạy lại**]

**F. Trạng thái triển khai (22/10 đêm)**
- `main` vẫn ở `de1fb2e` (16/10). Mở, chưa merge: #63 (vá bảo mật + CRON_SECRET), #64–#71 (chồng ĐX), **#72 = NC2** (base `claude/nc2-pr8-dx02`), và **#73** (`claude/keen-allen-wiz3em` → `main`, "ĐX-00..07: Nâng cấp lần 1", 23 commit, 120 tệp, mở 22/10 09:45Z bởi tài khoản `NguyenVanTho2805`) — #73 và chuỗi #64–#71 cùng chứa ĐX nên là hai đường đi song song tới `main` [Đã đọc GitHub REST]. Hệ quả: trên `main` **không có** `trialMode.ts`; trên `main` route `topups` không chặn học sinh (`git show origin/main:…/topups/route.ts | grep -c student` = 0). Env `KIN_TRIAL_MODE` "chưa đặt ở Production" theo tien-do; tôi không kiểm được Vercel. [Đã đọc Git/GitHub; Chưa kiểm được env]
- Việc của Thọ: "Bật `KIN_TRIAL_MODE=1` ở Vercel Production khi muốn ẩn lối mua VIP/nạp Coin (Q9)" (`bao-cao…:56`); sheet NC2-Q9 cột H = **FALSE** (Thọ chưa tick), cột I ghi "Áp theo mặc định của prompt 22/10". [Đã đọc sheet]

### Inferences
- [Suy luận] Trong thời gian chạy thử, rủi ro "tiền vào ngoài ý muốn" còn mở ở đúng một chỗ: gia sư gọi tay `POST /api/wallet/topups` khi cờ bật. Rủi ro nhỏ vì mua gói bị 403 và admin phải duyệt tay, nhưng Coin đã nạp thành số dư thật không hoàn lại (không có đường hoàn: xem mục 5, #10).
- [Suy luận] Vì không có giao diện mua gói và `/admin/topups` không có link trong menu (không thấy `admin/topups` trong `src/lib/adminNav.ts` ở HEAD lẫn NC2), thì hiện chưa ai mua VIP bằng giao diện; mua chỉ qua gọi API. Doanh thu VIP thật nhiều khả năng bằng 0 hoặc rất nhỏ [Chưa kiểm được DB].
- [Suy luận] Với Vercel, đổi biến môi trường thường cần triển khai lại thì mới có hiệu lực cho bản đang chạy; câu của báo cáo research 8.1 hàng 4 "bật/tắt không cần phát hành lại" có thể không đúng với cờ này [Chưa kiểm được].

### Gaps
- Không biết `KIN_TRIAL_MODE` đã đặt ở Vercel Preview/Production chưa, và Production đang chạy commit nào.
- Chưa chạy lại bất kỳ test nào; số liệu test là số các tài liệu tự ghi.
- Không thấy mã đếm "số gia sư vượt hạn mức" (báo cáo research 8.5 hứa "hệ thống vẫn đếm"); chưa kiểm được nếu nằm ở nhánh khác.

---

## 2. Ba tài liệu NC2: quyết định đã chốt, câu hỏi pháp lý (Q-LS), chỗ mâu thuẫn

### Takeaway
Ba tài liệu đều là **bản nháp của agent** (tự ghi: "bản nháp", "căn cứ để hỏi, KHÔNG phải ý kiến pháp lý"); chúng ghi lại một quyết định tiền thật sự (Q9: chạy thử miễn phí bằng cờ) nhưng đó là **mặc định trong prompt**, chưa được Thọ tick. Về pháp lý có 3 mục chạm thẳng việc thu phí/ví Coin: Q-LS-15, Q-LS-21 và khối bổ sung "Coin thưởng và game cược" (đánh số **trùng** Q-LS-16).

### Cited Findings

**A. `bao-cao-nang-cap-2-2026-10-22.md` (74 dòng; "Làm bởi Claude Code trên máy Mac của Thanh")**
- Dòng bảng việc: "NC2-023 cờ chạy thử (TIỀN: chỉ ẩn lối vào) | XONG | a4b1275" (`:23`); "NC2-027 Google OAuth, NC2-028 hạn mức admin, NC2-029 rút gọn tạo lớp (mới) | CHƯA LÀM — chờ Thọ" (`:29`); "NC2-030 ĐX-08, NC2-031 ĐX-09 | KHÔNG LÀM theo quyết định (Q6, Q7)" (`:30`).
- "Việc của Thọ" mục 2: "Bật `KIN_TRIAL_MODE=1` ở Vercel Production khi muốn ẩn lối mua VIP/nạp Coin (Q9). Quyết có chặn `POST /api/wallet/topups` khi bật cờ không (hiện chỉ ẩn form)." (`:56`). Mục 5: đọc/duyệt các tài liệu nháp trước khi dùng, nêu "Q-LS-01: kho có hai văn bản luật dữ liệu cá nhân mâu thuẫn" (`:59`). Mục 6: sheet đã được cập nhật 22/10, không đụng cột Thanh/Thanh Note (`:60`).
- "Các agent nghiên cứu/rà soát có thể sai: số liệu và điều luật trong tài liệu nháp chưa ai kiểm; chỉ coi là căn cứ để hỏi." (`:74`).
- **Bản này đã cũ so với các commit sau nó:** bảng ghi "NC2-026b F2, F3 … CHƯA LÀM — chủ động dừng" (`:28`) và "NC2-029 … CHƯA LÀM — chờ Thọ" (`:29`), nhưng tien-do và sheet ghi NC2-026b "XONG MỘT PHẦN" (`cc70f6d`) và NC2-029 "LÀM 4 PHẦN" (`504dbf8`). Tức báo cáo cuối chưa cập nhật các lượt "chọn phương án tối ưu" buổi chiều. [Đã đọc tài liệu]

**B. `ra-soat-goi-nang-cap-2-2026-10-22.md` (47 dòng; "Người rà: Claude Code (phiên của Thanh)")**
- Kiểm và khớp: "NC2-023: `isActiveTutorVIP` chưa khoá tính năng nào — Đúng: định nghĩa ở `tutorSubscription.ts:38`, không nơi nào gọi" (`:17`).
- Bảng khoảng trống so với báo cáo research: "8.1 #4, 8.2.1: 'mọi hạn mức Free/Pro phải cấu hình được từ admin' | Không có hạn mức nào (KiN chưa khoá gì); `TUTOR_VIP_PLANS` viết cứng | **NC2-028 (mới, chưa làm):** chỉ khi bật Pro (dính tiền, Q9); NC2-023 chỉ thêm cờ ẩn lối mua" (`:38`).
- "8.6 #2, #10: đổi hình thức phí, gói N buổi | KiN tính theo tháng (quyết định 27/09) | Không làm" (`:40`). ("Quyết định 27/09" khớp `docs/kin/quyet-dinh-giao-dien-va-hoc-phi.md`, đề ngày 27/09/2026 — học phí theo tháng, không phải gói Pro.)
- Chỗ gói/prompt không chạy đúng như viết (mục 3), liên quan tiền: #5 "Q12 đảo một chốt cũ" (tin 07:00) — không phải tiền; **không có mục nào nói về Q9**. [Đã đọc tài liệu]

**C. `cau-hoi-luat-su.md` (124 dòng, NC2-006, commit `20dc72e`; "Căn cứ để hỏi luật sư, KHÔNG phải ý kiến pháp lý … Không tự kết luận điều gì là được phép hay bị cấm. Tên văn bản nêu dưới đây là tên đã xuất hiện trong kho; người soạn chưa đọc bản gốc của chúng.")**
- Bối cảnh (a), `:23-24`: "KiN **không giữ học phí**, **không thu hoa hồng**, không thu phí kết nối ở bất kỳ phía nào; doanh thu dự kiến duy nhất là gói Pro, hiện chạy thử miễn phí (báo cáo research 8.2, Q9)." và "Chưa có pháp nhân (báo cáo research 8.2)."
- Các mục chạm thu phí / ví Coin:
  - **Q-LS-15** (`:60`, nhóm 3): "Đối soát chuyển khoản (TT-200): KiN đọc giao dịch tiền vào tài khoản của gia sư qua SePay. Dữ liệu giao dịch của gia sư và tên phụ huynh trong nội dung chuyển khoản cần đồng ý gì theo Luật 91? **Khi KiN bắt đầu thu phí, cách này có thành 'trung gian thanh toán' theo Nghị định 52/2024 không?**" Nguồn: câu 8 của Thanh. Mở khoá: TT-200, ĐX-08.
  - **Q-LS-21** (`:81`, nhóm 6): "Zalo OA (TT-199 giai đoạn 2): một OA của KiN gửi tin thay cho nhiều gia sư có được không, hay mỗi gia sư phải có OA riêng? **KiN cần đăng ký hộ kinh doanh hay doanh nghiệp?**" (câu 9 của Thanh).
  - **Q-LS-16 (bản 1, Thông tư 29/2024/TT-BGDĐT)** (`:66`): người dạy thêm có thu tiền phải công khai lịch dạy, tên, học phí — có áp cho gia sư tự do và cho KiN với tư cách nền tảng không (liên quan thông tin/giá hiển thị, không phải phí thuê bao).
  - **"Bổ sung 22/10 — Coin thưởng và game cược (Q-LS-16)"** (`:118-124`, thêm bởi `6db9658`), 4 câu: (1) game "cược" bằng Coin chỉ kiếm nhờ học, không mua/đổi ra tiền hay quà: có bị coi là đánh bạc/trò chơi có thưởng không; (2) người chơi dưới 16 và dưới 18 tuổi; (3) nếu sau cho đổi Coin lấy quà/ưu đãi học phí/giảm giá: điểm nào làm Coin có giá trị tài sản; (4) nguyên văn: "**Hiện ví gia sư có Coin quy đổi 1 Coin = 1 đồng (mua VIP). Cần tách hẳn loại Coin này khỏi Coin thưởng của học sinh ở mức nào để không dính tới câu 1–3?**"
  - Gián tiếp: **Q-LS-05** (`:40`, "bên kiểm soát/bên xử lý" dữ liệu học sinh; do người gom thêm), **Q-LS-13/14** (biên lai chuyển khoản là dữ liệu cá nhân, nhạy cảm?), **Q-LS-01** (NĐ 13/2023 hay Luật 91/2025 + NĐ 356/2025).
- Mục (d) "Việc làm được ngay trong lúc chờ luật sư" gồm NC2-025 và loại trừ mọi việc tiền: "ĐX-08 (cần Q-LS-13..15 và quyết định Q6 về tiền)". Không có mục nào liệt kê "bật Pro / thu phí thuê bao" là việc đang chờ luật sư. [Đã đọc tài liệu]
- Chưa gửi luật sư: sheet PH-225 cột I (22/10): "Chưa gửi luật sư; căn cứ để hỏi, không phải ý kiến pháp lý." [Đã đọc sheet]

**D. Quyết định về gói/tiền/Coin/VIP được các tài liệu NC2 ghi lại (ai chốt, khi nào)**
| Quyết định | Ai / khi nào (theo tài liệu) | Nguồn |
|---|---|---|
| Q9: làm cờ `KIN_TRIAL_MODE`, ẩn lối mua VIP/nạp Coin của gia sư, không xoá code, không đụng ví, **env chưa bật, "tôi tự bật"** | Mặc định ghi trong `PROMPT-nang-cap-2.md` viết giọng Thọ ("Tôi là Thọ") ngày 22/10; lý do: "Thọ 19/10: 'trước mắt cứ free'". Commit do tài khoản git "Nguyễn Phúc Thanh" tạo trên máy Mac của Thanh. Sheet NC2-Q9 H=FALSE | `PROMPT-nang-cap-2.md:8`; `ke-hoach-nang-cap-2.md:102`; sheet NC2-Q9 |
| Trước mắt miễn phí toàn bộ (SaaS lẫn sàn), Pro bật sau; hạn mức Free/Pro "cấu hình được từ admin" | "Quyết định 4" của Thọ trả lời báo cáo research, 19/10 (báo cáo viết cho "bạn" = Thọ) | `research-so-gia-su-2026-10-19.md` §8.1 hàng 4, §8.9 |
| NC2-028 hạn mức Free/Pro: chỉ làm khi bật Pro | Agent NC2, 22/10; chưa ai duyệt | CSV/sheet NC2-028 |
| Chặn `POST /api/wallet/topups` khi bật cờ: **KHÔNG chặn** ("chỉ tạo yêu cầu chờ admin duyệt; endpoint dùng chung với học sinh") | "Chủ dự án giao Claude chọn phương án tối ưu" — buổi chiều 22/10; ghi là nợ P3, "đúng phạm vi, chờ Thọ" | `tien-do-dang-do.md` bảng "Lượt tiếp 22/10 (chiều)"; khối rà soát độc lập (1) |
| Học sinh không nạp Coin bằng tiền; Coin học sinh chỉ thưởng khi làm bài; không game cược khi chưa hỏi luật sư | "Thọ chỉ đạo 22/10" (CSV NC2-036) | CSV NC2-036; `6db9658` |
| Học phí tự xác nhận khi chuyển khoản: đã có từ TT-200 (không viết thêm) | Thanh viết spec 01–02/10 ("Anh chốt: giai đoạn đầu chưa thu phí … → dựng được"), agent dựng xong 11/10 | CSV NC2-036; sheet TT-200 |

**E. Mâu thuẫn trong/giữa ba tài liệu**
1. Số hiệu **Q-LS-16 bị dùng hai lần** (Thông tư 29/2024 ở `:66`; Coin/game cược ở `:118`); sheet PH-225 cột I vẫn nói "21 câu Q-LS" trong khi tệp nay có 21 số + 1 khối trùng số. [Đã đọc tài liệu + sheet]
2. Bối cảnh (a) nói "doanh thu dự kiến duy nhất là gói Pro, hiện chạy thử miễn phí", nhưng trên mã hiện có (kể cả `main`) gia sư **đã** có thể nạp Coin bằng chuyển khoản và mua VIP bằng API — "chạy thử miễn phí" chỉ là chính sách, chưa được mã ép (cờ chưa merge, env chưa bật). [Đã đọc mã]
3. Bối cảnh (a) viết "KiN không giữ học phí … không thu phí kết nối"; đúng với học phí, nhưng luồng nạp Coin khiến KiN nhận tiền trước của gia sư vào một tài khoản ngân hàng (`BANK_INFO` — hiện là giả) và giữ số dư; câu 4 của khối bổ sung tự thừa nhận "ví gia sư có Coin quy đổi 1 Coin = 1 đồng". Không câu Q-LS nào hỏi riêng về tính hợp pháp của ví trả trước này (chỉ Q-LS-15 hỏi theo hướng "trung gian thanh toán" khi đọc giao dịch). [Suy luận từ mã + tài liệu]
4. `cau-hoi-luat-su.md` viện NĐ 13/2023 ở mục 0.1 như văn bản **có thể đã hết hiệu lực** (Q-LS-01), nhưng `CLAUDE-cho-kho-trien-khai.md:183`, `du-thao-chinh-sach.md` và `research…` §8.7 vẫn viện NĐ 13/2023 như văn bản đang áp dụng. Thanh ghi "NĐ 13/2023 đã hết hiệu lực từ 01/01/2026, thay bằng Luật 91/2025/QH15 và NĐ 356/2025/NĐ-CP" nhưng chưa đọc bản gốc NĐ 356 (`cau-hoi-luat-su.md:90-94`). Báo cáo Pro không nên viện NĐ 13/2023 làm căn cứ hiện hành. [Đã đọc tài liệu; Chưa kiểm được văn bản luật]
5. `du-thao-chinh-sach.md` mục 13 viết: "Tien-do dòng 157: 'Thọ có pháp nhân' — tên chưa có trong mã". Dòng gốc là "giai đoạn 2 (Zalo OA) chờ Thọ có pháp nhân" (`NC2:tien-do-dang-do.md:156-157`), tức **chưa có**; bản nháp trích cụt thành câu khẳng định ngược nghĩa. Đồng thời mục 8 cùng tệp: "OK khi KIN_TRIAL_MODE miễn phí, nhưng phải xem lại nếu NC2-023 bật gói Pro/thu phí (khi đó mục 1 ở trên sai)" — chính tệp thừa nhận trang `/chinh-sach` sẽ sai ngay khi thu phí. [Đã đọc tài liệu]
6. Trạng thái "chặn topups": báo cáo cuối coi là **câu hỏi còn mở cho Thọ** (`:56`); `tien-do` coi là **đã quyết KHÔNG chặn** (do agent chọn) nhưng cũng liệt vào "Việc của Thọ (3)". Hai trạng thái cùng tồn tại. [Đã đọc tài liệu]

### Inferences
- [Suy luận] Không có chỗ nào cho thấy Thọ **đích thân** chốt "tắt hẳn đường nạp Coin của gia sư khi chạy thử"; Q9 chỉ ghi "ẩn lối mua", và chính Thọ 19/10 chỉ nói "trước mắt cứ free". Báo cáo Pro nên coi việc chặn API nạp là câu hỏi mở, không phải đã quyết.
- [Suy luận] Bộ Q-LS hiện **không** có câu hỏi trực tiếp về: thuế/hóa đơn khi KiN thu phí thuê bao; đăng ký kinh doanh/pháp nhân để thu tiền từ gia sư (chỉ có Q-LS-21 trong ngữ cảnh Zalo OA); tính hợp pháp của số dư Coin nạp tiền thật (ví trả trước). Nếu báo cáo Pro đề xuất thu phí, cần nói rõ đây là khoảng trống chưa được đưa vào danh sách hỏi luật sư.

### Gaps
- Không đọc được bản gốc các văn bản luật (ngoài phạm vi, cấm web); mọi điều luật chỉ là tên đã xuất hiện trong kho.
- Chưa rõ ai và khi nào sẽ gửi `cau-hoi-luat-su.md` cho luật sư; hiện "chưa gửi".
- Không xác định được Thọ đã đọc/duyệt ba tài liệu nháp chưa (sheet NC2-006, NC2-012, NC2-025, NC2-026 đều "XONG BẢN NHÁP", cột H có tick do agent).

---

## 3. Sheet "Todo list - Kin class": quyết định của Thọ và Thanh về gói / VIP / Coin / TT-204 / D01 / BE-020 / PH-2xx

### Takeaway
Quyết định cốt lõi trên sheet là **D01 (BE-020, 05/10)**: đổi từ "học viên mua gói lớp" sang **SaaS — gia sư trả VIP**, 3 gói cố định (tháng/6 tháng/1 năm), học viên miễn phí; câu trả lời gốc nằm ở **cột Thanh**, còn ghi chú dài ở cột Thọ Note do agent Claude viết. Mọi thứ còn lại về giá/hạn mức (free-tier, TT-204, FE-159) **chưa chốt**.

### Cited Findings
Định dạng: `[mã · dòng sheet] H=… | I=… | J=… | K=…`; ngoặc kép là nguyên văn. Tab "Trang tính1" trừ khi ghi khác. [Đã đọc sheet, đọc cả 4 cột; không ghi gì]

**D01 / gói VIP**
- **BE-020 · dòng 21 ("Quyết định D01 — Gói theo lớp trả Coin — 1 lớp có nhiều gói hay 1 giá cố định?")** — H=TRUE. I=`- 04/10/2026 (cũ): Chốt HOÃN. -- 05/10/2026 (cập nhật): Đổi hướng theo trả lời mới ở cột Thanh. Mô hình chuyển sang SaaS — GIA SƯ trả phí VIP (không phải học viên trả gói lớp như backlog gốc BE-055). 3 gói cố định: tháng / 6 tháng / 1 năm. Học viên free (giai đoạn đầu). Course.price deprecated (giữ field, không dùng). CoinTransaction.sourceType thêm 'tutor_subscription' thay cho 'class_subscription' với ý nghĩa cũ. Model TutorSubscription gắn userId thay vì courseId. [CHƯA ENFORCE free-tier limits — chờ user chốt max số lớp / tính năng nào bị khoá.]` J=`1 gia sư đăng ký 1 gọi gọi là gói VIP lúc này có thể mở full tính năng, giá gói sẽ có gói tháng, gói 6 tháng và gói 1 năm với mức giá cố định cho mỗi gói` K=(trống). (Cột J cũng hiện ở tab "Bảng điều khiển", cột J, dòng BE-020.)
- **BE-055 · 56** H=TRUE I=`05/10/2026: Đổi hướng theo D01 chốt 05/10. Thay model Subscription(courseId) bằng TutorSubscription(userId) — SaaS gia sư trả phí VIP … Field: planCode, priceCoinPaid (snapshot), durationDays, startDate, endDate, status. Xem PR #11.` J=FALSE K=trống.
- **BE-056 · 57** H=TRUE I=`Không áp dụng theo mô hình SaaS mới. TutorSubscription giữ lịch sử trực tiếp (mỗi lần mua = 1 bản ghi mới khi chưa VIP, hoặc cộng dồn endDate khi đang VIP) …`
- **BE-057 · 58** (API quản lý gói theo lớp) H=**FALSE** I=`05/10/2026: Không áp dụng theo mô hình SaaS mới. Giá gói cố định trong code (TUTOR_VIP_PLANS tại src/lib/tutorSubscription.ts), gia sư không tự quản gói. **Khi cần admin UI đổi giá, chuyển sang bảng SettingKV.**` — (bảng `SettingKV` **không tồn tại** trong schema; xem mục 5.)
- **BE-058 · 59** H=FALSE I=`Không áp dụng — lý do như BE-057 (gói cố định trong code, không sửa từng gói qua API).`
- **BE-059 · 60** H=TRUE I=`05/10/2026: Đã làm POST /api/subscriptions/[code]/purchase theo hướng Tutor VIP. -- 06/10/2026 (test + fix): vá race … advisory lock theo userId … mua chồng giờ tạo bản ghi MỚI nối tiếp … Harness 27/27. PR #11.`
- **BE-060 · 61** H=TRUE I=`Đã làm GET /api/users/me/subscription … isActiveTutorVIP kiểm startDate ≤ now < endDate. PR #11.`
- **BE-061 · 62** H=TRUE I=`Xong (PR #20 merged). Cron /api/cron/expire-tutor-subscriptions chạy 1:00 UTC hàng ngày, batch 100 … Enrollment KHÔNG suspended (D01 chốt học viên free).` **BE-062 · 63** H=TRUE: logAction `tutor_subscription.expire`.
- **BE-083 · 84** H=TRUE: `logAction coin_transaction.tutor_vip_purchase sau khi $transaction commit`.
- **BE-074 · 75 / BE-075 · 76** H=TRUE I (11/10, Claude): báo cáo `GET /api/admin/analytics` đọc sổ Coin thật, "doanh thu nền tảng = Coin gia sư trả để mua VIP (sourceType 'tutor_subscription', 1 Coin = 1đ)"; bảng "theo từng gia sư". **BE-077 · 78** H=TRUE I=`Đóng theo chỉ đạo Thọ '1.4.1 làm hoàn toàn mới, không giữ song song'. Khi ráp Subscription mới sẽ cắt cách tính Enrollment×price cũ luôn, không đối chiếu.` **FE-137 · 138 / FE-164 · 165** (admin doanh thu theo gia sư) H=TRUE xong 11/10.
- **BE-024 · 25 (D05, nguồn Coin nào trừ trước)** H=TRUE I=`04/10/2026: Chốt HOÃN. spendCoins hiện tại trừ 1 pool duy nhất không phân biệt nguồn — đủ dùng ở giai đoạn này. Khi user đông, triển khai FIFO theo CoinTransaction.createdAt với rule nạp-trước-trừ-trước.` J=`chưa cần làm ngay sau này có số lượng user đông rồi tính`.
- **BE-029 · 30 (D10, gia hạn thủ công hay tự động)** H=TRUE I=`04/10/2026: Chốt HOÃN. Gia hạn/đổi gói chưa triển khai (phụ thuộc D01 — Subscription cũng hoãn).` J=`chưa cần làm ngay sau này có số lượng user đông rồi tính`. (Sau đó D01 05/10 làm VIP nhưng không có dòng nào mở lại D10; hiện không có tự gia hạn, mua chồng nối tiếp thủ công.)
- **BE-033…039 · 34–40 (Wallet & Coin: sourceType, classId, hằng số, `GET /api/wallet/transactions`)** H=TRUE, I=`04/10/2026 … PR #6`.
- **FE-103 · 104** H=TRUE I=`06/10/2026: Xác nhận đã xong. Nút 'Mua khóa học' + PopupBuyRequired đã gỡ (D01 học viên free).` **FE-120…124 · 121–125 (mua gói theo lớp, phía học viên)** H=TRUE I=`06/10/2026: Đóng theo D01 (chốt SaaS gia sư trả gói, học viên dùng free). Không có luồng 'học viên mua gói theo lớp' nữa.` **FE-133 · 134** đóng theo D01. **FE-150 · 151 (Tab Gói CRUD)** H=FALSE I=`11/10/2026 (Claude): KHÔNG ÁP DỤNG theo D01 (SaaS: gia sư trả VIP, học viên học miễn phí) …`
- **FE-128 · 129 (trang nạp Coin)** H=TRUE I=`06/10/2026: Xong (PR #27 merged). Trang /student/vi + /admin/topups. Lấy chuyển khoản thủ công (chưa cổng VNPay/MoMo). Model CoinTopupRequest … admin approve/reject với $transaction + advisory lock. Harness 20/20 pass. **BANK_INFO hiện là placeholder — Thọ cập nhật STK thật ở src/lib/coinTopup-constants.ts.**` (Dòng gốc ghi "[CHỜ QUYẾT ĐỊNH] — … cần hỏi lại có phải làm không hay Coin chỉ đến từ thưởng hoạt động".) Thanh J=FALSE.
- **FE-159 · 160 (SubscriptionPicker)** H=FALSE I=`[12/10] CHƯA LÀM — dừng vì có TIỀN: SubscriptionPicker là 'chọn mua' gói (TutorSubscription), theo CLAUDE-cho-kho-trien-khai.md mục 9 chỗ nào có tiền thì dừng và hỏi người; mục 8 ghi 'Giá và gói miễn phí (bảng PLAN) — chưa chốt'. Phần 'xem trước gói mình tạo' của Gia sư Dashboard cũng cần quyết định giá. Anh chốt giá/gói rồi em làm.`

**Định giá / thu phí / pháp nhân**
- **TT-204 · 205 ("Nguyên tắc định giá nếu có ngày bán: giá phẳng, không phí giao dịch, dưới 500.000đ/tháng cho cơ sở 25 học sinh. Vượt ngưỡng đó người ta quay về Google Sheets + Zalo. Đối thủ thật là bảng tính miễn phí, không phải Eduspace.")** — H=**FALSE**, I=**(trống)**, J=FALSE, K=`[02/10] Giữ hoãn theo anh. [30/09] Hoãn: anh chốt giá do từng gia sư tự quyết, KiN chưa làm tính năng định giá. Giữ nguyên tắc không cắt phần trăm doanh thu.` Ưu tiên P2.
- **TT-200 · 201 (đối soát VietQR/SePay)** H=TRUE; I(11/10): "QR VietQR trỏ vào TÀI KHOẢN CỦA GIA SƯ (KiN không giữ tiền, không cắt %)"; "Việc của Thọ: câu hỏi luật sư NĐ 52/2024 (PH-225), nối webhook SePay thật." K=`[02/10] **Anh chốt: giai đoạn đầu chưa thu phí, điều khoản bổ sung sau → dựng được.** … Đối soát: SePay Free 0đ, 50 giao dịch vào/tháng … Có tính là trung gian thanh toán (NĐ 52/2024) không → hỏi luật sư.` J=TRUE.
- **TT-199 · 200 (Zalo)** H=FALSE; I(12/10): "GIAI ĐOẠN 1 XONG … chưa tick vì giai đoạn 2 (Zalo OA) cần anh có pháp nhân … (2) giai đoạn 2 Zalo OA/ZBS chờ pháp nhân + câu hỏi 1 OA gửi thay nhiều gia sư." K=`[02/10] … Giai đoạn 2 cần anh: đăng ký hộ kinh doanh hoặc doanh nghiệp, mở Zalo OA xác thực … Gói OA Tiêu chuẩn 1.000.000đ/năm; tin theo SĐT (ZBS Template, thay ZNS từ 01/01/2026) ~300đ/tin → 25 HS × 8 tin ≈ 143k/tháng.` J=FALSE.
- **PH-215 · 216** I(12/10): "Zalo OA hiện 'đang khoá' (chờ pháp nhân)".
- **PH-225 · 226 (Hỏi luật sư)** H=FALSE; I(22/10): "Danh sách câu hỏi đã gom ở docs/kin/bao-cao/cau-hoi-luat-su.md (NC2-006, bản nháp, 21 câu Q-LS; PR #72) … Chưa gửi luật sư"; J=FALSE; K=`[02/10] Thêm 3 câu hỏi (mục 7, câu 7–9 …): khách xem bài công khai của học sinh, dữ liệu giao dịch khi đối soát VietQR, một OA gửi thay nhiều gia sư. [30/09] Việc của anh: danh sách câu hỏi ở mục 7 của docs/kin/nghiep-vu/pheu-gia-su.md.`
- **PH-207 · 208 / PH-212 · 213** — nhãn công khai "Không thu phí nhận lớp" trên hồ sơ gia sư (làm một phần 12/10); K Thanh: "Xong phần Thanh: Figma A1…". Đây là cam kết sản phẩm: KiN không thu phí kết nối của gia sư với phụ huynh (khớp research 8.2 "bạn không thu phí kết nối ở bất kỳ phía nào").
- Không có dòng PH-2xx nào khác nói về thu phí/Coin/Pro. PH-209 ("Công cụ soạn bài đăng tìm HS"), PH-211 (phụ huynh đăng yêu cầu — dừng vì trẻ em) không có nội dung giá. [Đã đọc sheet]

**Tab "Nâng cấp lần 2" (đọc trực tiếp 22/10; cột Thanh/Thanh Note đều trống/FALSE)**
- **NC2-Q9** H=FALSE I=`[22/10] Áp theo mặc định của prompt 22/10: làm cờ KIN_TRIAL_MODE (NC2-023, commit a4b1275), env chưa bật — Thọ bật ở Vercel Production. Chưa chặn POST /api/wallet/topups (chờ Thọ quyết).` Căn cứ: `Mặc định: CÓ, làm cờ; env chưa bật. Thọ 19/10 chốt "trước mắt cứ free"; code hiện có TUTOR_VIP_PLANS 300k/1,5tr/2,5tr Coin nhưng isActiveTutorVIP chưa khoá tính năng nào.`
- **NC2-023** H=TRUE (do Claude tick "XONG"); **NC2-028** H=FALSE (xem mục 1); **NC2-032** ("Việc của Thọ") H=FALSE.
- **NC2-036 (Coin thưởng làm bài)** có trong CSV trên nhánh NC2 nhưng **chưa thấy trên tab sheet** khi tôi đọc A1:Q60 (dòng cuối tab là NC2-035) → sheet đang chậm hơn CSV; NC2-037 chỉ có trong tien-do, không có trong CSV hay sheet. [Đã đọc sheet + CSV]
- Tab "Nâng cấp lần 1" không có dòng gói/VIP; hàng NC1-Q6 (ngưỡng mở ĐX-08): `Ví dụ mốc: từ 30% phiếu đóng bằng ghi tay/ghép tay trong 2 tháng liên tiếp. Mốc này CHƯA có căn cứ, do Thanh và Thọ đặt.` H=FALSE — **khác** ngưỡng bật Pro (đừng nhầm hai ngưỡng có cùng dạng "30% / 2 tháng liên tiếp").

### Inferences
- [Suy luận] Trong ghi chú của Thanh, "anh" chỉ Thọ (vd "Việc của anh", "Giai đoạn 2 cần anh: đăng ký hộ kinh doanh…"); tài liệu 26/09 do một agent viết cho Thọ lại gọi người chốt là "anh Thanh". Vì vậy câu "Anh chốt: giai đoạn đầu chưa thu phí" ở TT-200 K nhiều khả năng là Thọ chốt, do Thanh ghi lại; còn D01 05/10 là **Thanh trả lời ở cột J** và agent ghi vào cột Thọ. Cột H=TRUE ở nhiều dòng do agent tick, nên không chứng minh Thọ đích thân xác nhận D01.
- [Suy luận] Ghi chú TT-204 của Thanh "anh chốt giá do từng gia sư tự quyết, KiN chưa làm tính năng định giá" có hai cách hiểu: (a) giá **học phí** do gia sư tự đặt (KiN không làm công cụ định giá học phí — khớp "không cắt phần trăm"); (b) giá **gói KiN**. Câu "Giữ nguyên tắc không cắt phần trăm doanh thu" nghiêng về (a) và về nguyên tắc chung. Dòng TT-204 vì thế **không** phải quyết định giá Pro; các CSV NC2 gắn TT-204 với Q9/NC2-028 như thể là "dòng định giá của KiN".
- [Suy luận] "VIP … mở full tính năng" (Thanh) chưa nói "full" là gì; mã không khoá gì; ghi chú BE-020 tự thừa nhận "CHƯA ENFORCE". Báo cáo Pro cần tự định nghĩa ranh Free/Pro, không thể trích D01 làm căn cứ cho một danh sách khoá cụ thể.

### Gaps
- Không đọc từng dòng của khoảng 160 dòng Trang tính1 không khớp từ khoá; có thể còn ghi chú giá nằm dưới từ khác (tôi đã quét cột E, H, I, J, K theo VIP/Coin/Pro/giá gói/trả phí/thu phí/pháp nhân/hạn mức/doanh thu/nạp/SaaS/SePay/luật sư/chạy thử).
- Không xem được lịch sử chỉnh sửa ô (ai gõ, lúc nào) nên không xác nhận được ai viết cột Thọ Note ở D01.

---

## 4. Tổng hợp mô hình thu tiền: đã quyết / chưa quyết / mâu thuẫn

### Takeaway
Đã chốt chắc: học sinh/phụ huynh không trả KiN; KiN không giữ học phí, không cắt %, không thu phí kết nối; **nếu thu** thì thu ở gia sư theo thuê bao có kỳ hạn (D01), trước mắt miễn phí. Chưa chốt: giá, ranh Free/Pro, kênh thu, pháp nhân, điều kiện bật Pro. Mâu thuẫn nặng nhất: "Coin = Knowledge Bounty, đừng động vào" đã bị hạ tầng VIP/nạp Coin vượt qua mà không văn bản nào thu hồi quy tắc cũ.

### Cited Findings

**Dòng thời gian quyết định (gia sư trả VIP / Coin / thuê bao)**
| Ngày | Điều ghi | Nguồn |
|---|---|---|
| 23/09 | Định hướng: "Thu phí ở đầu gia sư qua Coin nạp trước, KiN không giữ học phí giữa gia sư và phụ huynh." — "Coin nạp trước, dưới 20k/tháng" | `docs/kin/backlog/README.md` (mục "Đọc trước"); `CLAUDE-cho-kho-trien-khai.md:25` |
| 26/09 | 4 quyết định "anh Thanh đã chốt": #2 **Bỏ Coin khỏi phạm vi** — "KiN đứng ở vai cầu nối, chưa thu phí"; "'bỏ Coin' nghĩa là ĐỪNG ĐỘNG VÀO"; hoãn 15 việc gồm BE-033…039, BE-059, FE-128, FE-137, FE-150; #4 **Chưa cần luật sư** ("Chưa thu tiền, quy mô nhỏ") | `quyet-dinh-va-doi-chieu.md:28-68` |
| 04/10 | D01, D05, D10 "Chốt HOÃN" | sheet BE-020/024/029 cột I |
| 05/10 | **D01 đổi hướng:** SaaS gia sư trả VIP, 3 gói cố định, học viên free (trả lời của Thanh, cột J) → model `TutorSubscription`, API mua bằng Coin | sheet BE-020/055; commit VIP/audit/cron 05/10 |
| 06/10 | FE-128 nạp Coin thủ công (PR #27, `82f40f4`, merge bởi tài khoản Thọ); BE-059/060 sửa race; FE-103/120–124 đóng | sheet; `git log` |
| 11/10 | Báo cáo doanh thu VIP cho admin (`ec957fc`); TT-200 đối soát SePay (KiN không giữ tiền, không cắt %) | sheet BE-074/075, TT-200 |
| 12/10 | FE-159 dừng vì "Giá và gói miễn phí (bảng PLAN) — chưa chốt" | sheet FE-159 I |
| 19/10 | Thọ (với agent research): "Trước mắt miễn phí toàn bộ; chạy ổn rồi mới nâng Pro"; Pro là doanh thu duy nhất; "chưa có pháp nhân" | research §8.1, §8.2, §8.9 |
| 22/10 | KIN_TRIAL_MODE (`a4b1275`); học sinh không nạp Coin (`6db9658`); NC2-028 hạn mức Free/Pro chưa làm | CSV NC2 |

**ĐÃ QUYẾT** (kèm mức chắc)
1. **Học viên/phụ huynh không trả KiN** — D01 05/10 ("Học viên free (giai đoạn đầu)"); FE-103/120–124/133 đóng; NC2-036 chặn học sinh nạp Coin. Mức: chắc. [Đã đọc sheet + mã]
2. **KiN không giữ học phí, không cắt phần trăm doanh thu, không thu phí kết nối, nhãn "Không thu phí nhận lớp"** — `CLAUDE-cho-kho-trien-khai.md:26`; TT-200/TT-204 K; PH-207/212; research §8.2 lưu ý ("bạn không thu phí kết nối ở bất kỳ phía nào. Doanh thu duy nhất là gói Pro"). Mức: chắc.
3. **Nếu thu phí: gia sư trả** (SaaS thuê bao) — D01. Mô hình hiện có: thuê bao **cố định theo kỳ** (30/180/365 ngày), mua **bằng Coin**, **thủ công** (không tự gia hạn: D10 hoãn; mua chồng nối tiếp ngay sau hạn gói trước). Mức: chắc về hướng, lỏng về chi tiết.
4. **Trước mắt miễn phí toàn bộ, Pro bật sau** — Thọ 19/10; TT-200 K 02/10 ("giai đoạn đầu chưa thu phí"); đã có mã cờ (chưa merge, env chưa bật). Chưa có lệnh nào trái với câu này sau 19/10.
5. **Coin học sinh = Coin thưởng**: không mua bằng tiền, không đổi tiền/quà, không chuyển giữa tài khoản; không game cược trước khi hỏi luật sư — NC2-036 (Thọ chỉ đạo 22/10 theo CSV). Mức: chắc theo CSV, nhưng dòng này chưa lên sheet.
6. **Không làm**: hoa hồng, phí kết nối, đổi hình thức phí, gói N buổi, PIN link phụ huynh (`ke-hoach-phat-trien-tu-research.md` mục 6; ra-soat `:40-41`).
7. **Nạp Coin = chuyển khoản thủ công + admin duyệt**, chưa cổng VNPay/MoMo (FE-128).
8. **KiN chưa có pháp nhân** — nhất quán ở 5 nguồn: sheet TT-199 cột I và K ("cần anh có pháp nhân"; "đăng ký hộ kinh doanh hoặc doanh nghiệp"), PH-215 I ("chờ pháp nhân"), research §8.1 hàng 3 ("Chưa có pháp nhân/đối tác ngân hàng"), `cau-hoi-luat-su.md:24`, `tien-do-dang-do.md` "chờ Thọ có pháp nhân". (Dòng sheet cần tra là **TT-199**, đúng như nghi ngờ.) [Đã đọc sheet + tài liệu]
9. Coin dùng **một pool** cho mọi nguồn, không hết hạn, không FIFO (D05 hoãn; `spendCoins` trừ từ một số dư). Hệ quả: Coin thưởng (kể cả 50 Coin tặng lúc đăng ký, `SIGNUP_BONUS`, cả ở `register-tutor`) cộng chung vào cùng số dư dùng để mua VIP, không phân biệt được với Coin nạp bằng tiền. [Đã đọc mã: `wallet-constants.ts:5`, `register-tutor/route.ts:72`, purchase route `:40-44`]

**CHƯA QUYẾT**
1. **Giá thật và bảng gói** — "Giá và gói miễn phí (bảng `PLAN`) — chưa chốt" (`CLAUDE-cho-kho-trien-khai.md:185`); `tutorSubscription.ts:4` "Giá hiện tại là PLACEHOLDER (admin sẽ chỉnh qua dashboard sau khi có số chính thức)"; FE-159 H=FALSE; TT-204 H=FALSE.
2. **Ranh Free/Pro:** "VIP mở full tính năng" nhưng không khoá gì; BE-020 "CHƯA ENFORCE free-tier limits — chờ user chốt max số lớp / tính năng nào bị khoá." Hạn mức tham chiếu của research (8 học sinh / 4 mẫu phiếu / 50MB / Excel) chưa được ai nhận làm quyết định.
3. **Kênh thu khi bật Pro** (Coin thủ công như hiện tại, cổng thanh toán, hay chuyển khoản/QR trực tiếp mỗi kỳ): `BANK_INFO` là giả; chưa pháp nhân; chưa cổng. Không văn bản nào quyết "thuê bao QR".
4. **Có chặn `POST /api/wallet/topups` của gia sư khi cờ bật** (câu hỏi mở với Thọ) và **khi nào bật cờ** (Thọ tự bật).
5. **Điều kiện bật Pro** — xem mục dưới.
6. **Hoàn tiền/huỷ gói/gia hạn tự động** — D10 hoãn; không có mã hoàn tiền (xem mục 5 #10).
7. **Thuế, đăng ký kinh doanh để thu tiền gia sư, tính hợp pháp ví Coin nạp tiền thật** — chưa có trong danh sách Q-LS (xem mục 2).
8. **Game cược bằng Coin** — chờ luật sư (Q-LS-16 bổ sung).
9. Q9 chưa được Thọ tick (H=FALSE).

**"Điều kiện bật Pro ≥200 gia sư hoạt động và ≥30% vượt hạn mức Free trong 2 tháng liên tiếp" — ai đặt, còn hiệu lực không**
- Xuất hiện đúng **một** lần trong `docs/`, `.claude/` và `PROMPT-nang-cap-2.md` (git grep trên NC2; HEAD không có tệp báo cáo này): `research-so-gia-su-2026-10-19.md:740`, câu chữ nghiêng cuối §8.5: "Điều kiện **gợi ý** để bật Pro: ≥ 200 gia sư hoạt động và ≥ 30% trong số đó vượt hạn mức Free trong 2 tháng liên tiếp." [Đã đọc tài liệu]
- Người đặt: tác giả báo cáo research (agent, bản 2.1, 19/10/2026, viết cho Thọ; mục 8 tự nói "Những chỗ tôi phải chọn thay bạn được đánh dấu rõ là 'đề xuất' để bạn gật hoặc lắc"). Ngay trên câu đó: "Mọi con số trong bảng là hạn mức cấu hình được và chưa bật." §8.9 chỉ liệt 3 điểm đã chốt (hồ sơ Hiện/Ẩn, chống spam, phần sàn miễn phí) — ngưỡng bật Pro không nằm trong đó.
- Không có dòng sheet, `ke-hoach-*.md`, `PROMPT`, hay ra-soat nào nhận ngưỡng này; NC2-028 chỉ ghi "chỉ làm khi bật Pro". **Kết luận: đề xuất của agent, chưa được Thọ/Thanh chốt; không phải quyết định.**
- Điều kiện tiên quyết **chưa có trong mã**: không có hạn mức Free nào để "vượt" (`grep` không thấy hằng hạn mức học sinh/mẫu phiếu/dung lượng); không có bộ đếm vượt hạn mức; chỉ có chỉ số "Gia sư đang dùng" (≥1 buổi đã dạy trong khoảng, `healthMetrics.ts`) có thể dùng làm định nghĩa "hoạt động" cho mốc 200. [Đã đọc mã]
- Đừng nhầm với **NC1-Q6** (ngưỡng mở ĐX-08: "30% phiếu đóng bằng ghi tay/ghép tay trong 2 tháng liên tiếp", "CHƯA có căn cứ"), cùng dạng "30% / 2 tháng" nhưng cho việc khác.

**MÂU THUẪN** (mỗi mục ghi nguồn hai phía)
1. **Coin "đừng động vào" vs Coin đã mở rộng:** `CLAUDE-cho-kho-trien-khai.md:13-18` và `quyet-dinh-va-doi-chieu.md:28-44` (26/09: "bỏ Coin khỏi phạm vi … ĐỪNG ĐỘNG VÀO", hoãn BE-033…039, FE-128, FE-150…) ↔ sheet và mã: BE-033…039, FE-128 đều **xong** (06/10), có `tutor_vip_purchase`, `topup`, `quiz_reward`. Quy tắc 26/09 chưa được văn bản nào thu hồi; D01 05/10 làm trái trên thực tế. Chỉ dẫn "Coin hiện là Knowledge Bounty của Hỏi Đáp (đừng động vào)" đã **lỗi thời** — cùng bảng `Wallet`/`CoinTransaction` nay chứa bounty Hỏi Đáp, thưởng cộng đồng/bài học/làm bài, nạp tiền thật, mua VIP.
2. **"Chưa cần luật sư" (26/09) vs PH-225 / Q-LS (30/09–22/10)** — đã đổi: trẻ em/dữ liệu/NĐ 52 đã vào danh sách hỏi (chưa gửi).
3. **Bốn mốc giá khác nhau, không cái nào là quyết định:** "Coin nạp trước, dưới 20k/tháng" (`CLAUDE-cho-kho-trien-khai.md:25`); ~42.000đ/tháng trả năm, 179.000đ/quý, 499.000đ/năm (tham chiếu Sổ Gia Sư, research §3.1/§8.5); "dưới 500.000đ/tháng cho cơ sở 25 học sinh" (TT-204, từ Deep Research 29/9); placeholder trong mã **300.000 / 1.500.000 / 2.500.000 Coin** (`tutorSubscription.ts:12-14`; quy ra mỗi tháng: 300.000 / 250.000 / ~208.000 Coin, tức gấp khoảng 7 / 6 / 5 lần mốc 42.000đ/tháng — [Suy luận] phép chia của tôi, 1 Coin = 1 đồng theo mã). Kỳ hạn cũng khác: mã 30/180/365 ngày; research có quý/năm.
4. **Hai triết lý khoá khác nhau:** D01 "VIP mở full tính năng" (tất cả hoặc không) ↔ research §8.5 freemium theo hạn mức (8 học sinh/4 mẫu/50MB, Pro mở thêm). Chưa ai chọn.
5. **"Chạy thử miễn phí" ↔ mã `main` vẫn bán được** (cờ chưa merge/chưa bật) và học sinh vẫn gửi được yêu cầu nạp trên `main`.
6. **"Chưa có pháp nhân" ↔ `BANK_INFO.accountName = "CONG TY KIN EDUCATION"`** (`src/lib/coinTopup-constants.ts:43`) — tên công ty không có thật hiển thị cho người nạp Coin; `du-thao-chinh-sach.md` mục 13 hiểu nhầm "Thọ có pháp nhân".
7. **"KiN không giữ tiền" ↔ ví Coin nạp tiền thật** (KiN giữ số dư trả trước của gia sư; D05 24/09 từng gọi Coin nạp là "khoản phải trả" về kế toán, `quyet-dinh.csv` dòng D05).
8. **Hai trạng thái của "chặn topups"** (mở vs đã quyết không chặn) — mục 2.E.6.
9. **`ke-hoach…` "Hoãn có chủ đích (TT-204, chưa có model Plan)"** ↔ TT-204 H trống và `TutorSubscription` đã tồn tại — mục 5.
10. **Hai đường PR tới `main`** cho cùng ĐX (#73 và #64–#71) — chưa rõ đường nào sẽ merge; ảnh hưởng thời điểm cờ KIN_TRIAL_MODE tới Production.

### Inferences
- [Suy luận] Nhu cầu quyết định trước khi thiết kế Pro: (i) ranh Free/Pro (all-or-nothing hay quota); (ii) mốc giá (42k vs 300k+); (iii) kênh thu và chủ thể nhận tiền (pháp nhân/STK thật); (iv) bỏ hay giữ Coin làm tiền tệ thuê bao của gia sư (Coin là nguồn rủi ro pháp lý lớn nhất vì chạm cả ví trả trước lẫn game cược của học sinh, và dùng chung bảng).
- [Suy luận] Nếu báo cáo Pro đề xuất "gói gia sư trả theo kỳ, học viên miễn phí, KiN không cắt %" thì **trùng** quyết định đã có; phần mới thực sự là: ranh khoá, giá, kênh thu, cơ chế đếm hạn mức, và pháp lý ví/thuế.

### Gaps
- Không xác định được ai là người dùng thật đang có `TutorSubscription` (không đọc DB); không biết có gia sư nào đã mua VIP hay đã nạp Coin.
- Không rõ nội dung `docs/kin/nghiep-vu/pheu-gia-su.md`, `gui-qua-zalo.md`, `doi-soat-vietqr.md` (không có trong kho này; ghi chú NC2 cũng nói vậy); có thể chứa chi tiết thêm về giá/Zalo OA.

---

## 5. Điểm sự thật CẦN SỬA trong tài liệu/mã cũ vì lệch với mã hiện tại

### Takeaway
Có 16 chỗ cần sửa (bảng dưới); nặng nhất là các tài liệu nói "chưa có model Plan / chưa có gì về gói" trong khi hạ tầng `TutorSubscription` đã chạy từ 05–06/10, và các chỉ dẫn "Coin = Knowledge Bounty, đừng động vào".

### Cited Findings
| # | Chỗ (đường dẫn:dòng) | Đang nói | Sự thật theo mã/sheet | Mức |
|---|---|---|---|---|
| 1 | `docs/kin/ke-hoach-phat-trien-tu-research.md:54` và `:273` (cả HEAD lẫn NC2) | "Hạn mức Free/Pro / Gói Pro ~42.000đ: Hoãn có chủ đích (TT-204, chưa có model `Plan`)" | Chưa có model `Plan`/bảng hạn mức là **đúng**, nhưng thiếu: đã có model `TutorSubscription` (`prisma/schema.prisma` ~888), `TUTOR_VIP_PLANS`, API mua, cron hết hạn, báo cáo doanh thu VIP (D01/BE-055…062/074…). Và TT-204 không phải lý do "hoãn" hạ tầng (TT-204 H trống; chỉ là nguyên tắc giá) | Cao |
| 2 | `docs/kin/ke-hoach-nang-cap-2.md:52`, `:86`; `PROMPT-nang-cap-2.md:53` | "`POST /api/subscriptions` (403)", "ẩn nút Mua VIP", "banner ở trang gói" | Route thật: `POST /api/subscriptions/[code]/purchase`; `GET /api/subscriptions` chỉ liệt kê; **không có** màn "Gói"/nút "Mua VIP" (CSV NC2-023, tien-do). Đã sửa ở CSV/tien-do nhưng chưa sửa kế hoạch/prompt | Trung bình |
| 3 | `docs/kin/CLAUDE-cho-kho-trien-khai.md:13-18`, `:82-109` (§0, §4) và chỉ dẫn "Coin = Knowledge Bounty, đừng động vào" | "Coin đang chạy là Knowledge Bounty … bỏ Coin khỏi phạm vi … mục 'Ai trả Coin' không còn là câu hỏi mở"; mục §4 vẫn mô tả mâu thuẫn BE-059 học viên mua gói | Coin nay còn là tiền thuê bao gia sư (`tutor_vip_purchase`), nạp tiền thật (`topup`), thưởng làm bài (`quiz_reward`); BE-059 đã làm theo hướng gia sư (D01), không còn "học viên spendCoins" | Cao |
| 4 | `docs/kin/CLAUDE-cho-kho-trien-khai.md:25` | "gia sư trả phí nền tảng (Coin nạp trước, dưới 20k/tháng)" | Mã đặt giá mẫu 300.000 Coin/tháng (`tutorSubscription.ts:12`); không có nguồn nào chốt "dưới 20k" | Cao |
| 5 | `docs/kin/CLAUDE-cho-kho-trien-khai.md:185` | "Giá và gói miễn phí (bảng `PLAN`) — chưa chốt" | Vẫn đúng về giá chưa chốt; nhưng không có bảng `PLAN`, thay bằng hằng `TUTOR_VIP_PLANS` | Thấp |
| 6 | `docs/kin/quyet-dinh-va-doi-chieu.md` §1.2 (`:42-44`) | Liệt kê BE-033…039, BE-059, FE-128, FE-137, FE-150 là việc **bị hoãn** | BE-033…039, BE-059, FE-128, FE-137 đều **XONG** (sheet); chỉ FE-150 "không áp dụng" | Cao |
| 7 | `docs/kin/quyet-dinh-va-doi-chieu.md` §1.4 (`:61-63`) | "Chưa cần luật sư … Bỏ khỏi đường găng" | PH-225 và `cau-hoi-luat-su.md` (22 mục) đã đưa pháp lý vào đường găng cho trẻ em/dữ liệu/thanh toán | Trung bình |
| 8 | `src/lib/tutorSubscription.ts:4-7` | "admin sẽ chỉnh qua dashboard sau khi có số chính thức" | Không có dashboard nào sửa giá; không có bảng `SettingKV` (sheet BE-057 I hẹn "chuyển sang bảng SettingKV" — `grep` schema/src không thấy) | Trung bình |
| 9 | `src/app/api/cron/expire-tutor-subscriptions/route.ts:7-10` và `:14-15` | "hết VIP chỉ ảnh hưởng quyền của gia sư (tạo lớp mới, mời học viên…)"; "chạy 0:00 UTC"; "Bearer CRON_SECRET nếu env có" | Không có mã nào khoá quyền khi hết VIP (`isActiveTutorVIP` không ai gọi); `vercel.json:11-13` đặt `0 1 * * *` (sheet BE-061 cũng ghi 1:00 UTC); ở HEAD CRON_SECRET tuỳ chọn, PR #63 sẽ bắt buộc (thiếu env thì cron 503) | Trung bình |
| 10 | `src/app/api/users/me/subscription/route.ts:5-7`; `wallet-constants.ts:47` (`SUBSCRIPTION_REFUND`, `refund`) | gợi ý CTA "nâng cấp VIP"; có lý do hoàn xu | Không giao diện nào dùng CTA; **không có mã nào ghi `subscription_refund`** (chỉ báo cáo đọc và test) và không có đường huỷ gói (`status: "cancelled"` không được gán ở đâu) | Trung bình |
| 11 | `src/app/(admin)/admin/topups/page.tsx:1-3` | "Chỉ admin_super/admin_content (MANAGE_REVENUE) truy cập được" | `ROLE_PERMISSIONS`: `MANAGE_REVENUE` chỉ có ở `admin_super` (`permissions.ts:26-34`); trang không có link trong `adminNav.ts` (HEAD và NC2) | Thấp |
| 12 | `src/lib/coinTopup-constants.ts:40-44` | `Vietcombank / 0123456789 / "CONG TY KIN EDUCATION"` | STK giả (FE-128 I đã nói "placeholder"); tên "CÔNG TY KIN EDUCATION" mâu thuẫn "chưa có pháp nhân" | Cao nếu mở nạp |
| 13 | `docs/kin/bao-cao/research-so-gia-su-2026-10-19.md` §8.1 hàng 3, §8.5 | "Không webhook ngân hàng … chưa có đối tác"; "hệ thống vẫn đếm để biết bao nhiêu người vượt hạn mức Free"; "hạn mức cấu hình được từ admin"; Free = Excel, Pro = + PDF | KiN **đã có** webhook SePay (TT-200, ke-hoach mục 2 đã ghi "giả định đã lỗi thời"); **chưa** có bộ đếm vượt hạn mức hay hạn mức nào; PDF điểm danh là trang in của trình duyệt (ĐX-03) nên khó làm quyền Pro | Cao |
| 14 | `docs/kin/bao-cao/bao-cao-nang-cap-2-2026-10-22.md:28-29`; `cau-hoi-luat-su.md:66 & 118`; sheet PH-225 I | NC2-026b, NC2-029 "CHƯA LÀM"; Q-LS-16 hai nghĩa; "21 câu" | NC2-026b/029 đã làm (`cc70f6d`, `504dbf8`); Q-LS-16 trùng số; thực tế 21 số + 1 khối trùng | Thấp |
| 15 | `docs/kin/bao-cao/du-thao-chinh-sach.md` mục 13 | trích "Thọ có pháp nhân" | Nguyên văn `tien-do`: "chờ Thọ có pháp nhân" → **chưa có** | Trung bình |
| 16 | Tên/đường dẫn `src/app/(student)/student/vi/page.tsx` (`/student/vi`), comment `:1` "chủ yếu gia sư nạp để mua VIP; học…" | Tên route gợi ý "ví của học sinh", nhưng đây là trang **duy nhất** nạp Coin và dùng chung cho cả gia sư; gia sư không có mục menu nào dẫn tới (chỉ `StudentShell.tsx` có link; `t-trial-mode-lib` quét tĩnh) → muốn bán gói cần thêm lối vào cho gia sư và đổi tên/tách trang | Thấp |

Ghi chú: các dòng 1, 3, 4, 6, 13 là những chỗ báo cáo Pro dễ trích sai nhất.

### Inferences
- [Suy luận] Khi báo cáo Pro viện dẫn "chưa có model Plan", nên diễn đạt lại: "chưa có bảng gói/hạn mức cấu hình được; đã có `TutorSubscription` + hằng `TUTOR_VIP_PLANS`; chưa khoá tính năng nào".
- [Suy luận] Nên coi `main` và NC2 là hai trạng thái: trên `main` mua VIP/nạp Coin chưa bị chặn và học sinh còn nạp được; trên NC2 đã chặn học sinh và có cờ cho gia sư.

### Gaps
- Không rà toàn bộ `docs/kin/*` ngoài các tệp đã nêu (vd `tien-do-dang-do.md` 600+ dòng chỉ grep theo từ khoá gói/VIP/Coin/Pro).
- Chưa kiểm `src/app/(guest)/chinh-sach/page.tsx` (trang điều khoản công khai) để xem còn câu nào hứa "miễn phí mãi mãi" hay "không bao giờ thu phí" — `du-thao-chinh-sach.md` mục 1 và 8 cho biết trang chưa có chữ về hoa hồng và cần sửa khi thu phí.
