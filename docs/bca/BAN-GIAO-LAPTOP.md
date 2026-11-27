# BCA Midnight — bàn giao toàn bộ dự án cho phiên Claude Code trên laptop

> Viết 27/11/2026 (phiên đám mây). Đây là tệp **đọc đầu tiên** khi mở dự án BCA trên laptop.
> Mọi chi tiết sâu hơn nằm ở các tệp được trỏ tới; tệp này là bản đồ + trạng thái + việc tiếp theo.
> Không có mật khẩu, khoá bí mật hay chuỗi kết nối DB trong tệp này — và không bao giờ được thêm vào.

---

## 0. Đọc trong 30 giây

- **Là gì:** web quản lý lớp **BCA Midnight Class** (ôn thi BCA/ĐGNL, 4 môn Toán · Sử · Địa · Anh, học Google Meet 22:15), **thay hẳn** Google Sheet + Apps Script đang dùng.
- **Mã ở đâu:** kho `NguyenVanTho2805/midnight-elite`, nhánh **`claude/optimistic-clarke-cbddza`**, thư mục **`bca/`** (app Next.js độc lập, không dùng chung gì với app KiN ở gốc kho).
- **Chạy ở đâu:** project Vercel **`bca-midnight`** → https://bca-midnight.vercel.app
- **Trạng thái 27/11 (cập nhật chiều):** Đợt 1–2 xong; đang thiết kế lại giao diện (QĐ 27, bước 1–3 xong); tên hiển thị "Kin Class" (QĐ 28). **Web chính thức đã lên** (có DB Neon, chưa có dữ liệu) nhưng **chưa đăng nhập được** vì chưa có khoá Google và chưa chuyển dữ liệu — xem mục 6.
- **Việc tiếp theo trên laptop:** mục 10 (cài đặt) rồi dán lệnh ở mục 12.

---

## 1. Ý tưởng sản phẩm

Nguồn sự thật: [`QUYET-DINH.md`](QUYET-DINH.md) (quyết định 1–26 đã chốt, T1–T58 "tạm chọn" chủ đổi được).

- Lớp hiện có ~70 học sinh (20 chính thức, 50 học thử), ~195 lượt ghi danh, ~155 đơn đăng ký, 46 buổi (số ngày 27/11).
- **Người dùng:** chủ lớp (quản trị), giáo viên cộng tác (chỉ môn mình dạy, không thấy học phí/SĐT phụ huynh), học sinh (đăng nhập Google bằng Gmail đã khai), phụ huynh (chưa có tài khoản — web soạn sẵn tin nhắn Zalo để chủ gửi).
- **Học thử:** đăng ký trên web xong có ngay link Zalo học thử; vào lớp đã chọn **14 ngày** từ ngày đăng ký; hết hạn thì khoá trừ khi chủ gia hạn.
- **Học phí:** tiền = số buổi lớp có học trong tháng (từ ngày em chính thức); 65.000đ/buổi nếu kỳ đó học 1 môn, 55.000đ/buổi/môn nếu ≥ 2 môn; phiếu có VietQR, chủ bấm "Đã thu". Không cổng thanh toán.
- **Điểm:** nhập tay + dán bảng điểm Azota (tự khớp tên / username Azota).
- **Giao diện:** nền tối "Midnight" (navy + vàng) cho mọi khu; học sinh thoáng, nút to (điện thoại trước); quản lý dày kiểu ma trận. Trang giới thiệu theo sáng/tối của máy. Chi tiết: [`thiet-ke/huong-chon.md`](thiet-ke/huong-chon.md), [`thiet-ke/token.md`](thiet-ke/token.md).
- **Giáo viên điểm danh trên điện thoại ngay trong buổi Meet** — 1 cột, nút to, "đánh tất cả có mặt".

### Lộ trình 4 đợt (quyết định 23)
| Đợt | Nội dung | Trạng thái 27/11 |
|---|---|---|
| 1 | Quản lý lớp: học sinh + ghi danh, buổi học + điểm danh, màn Hôm nay, chuyển dữ liệu từ sheet | ✅ Xong, chủ duyệt 26/11 |
| 2 | Đăng nhập Google, màn Tài khoản (thêm GV), khu học sinh `/hoc` | ✅ Mã xong (209→210 test, Playwright 54/54) — chờ lên production |
| 3 | Sổ điểm + báo cáo, học phí + thu tiền (VietQR) | ⏳ Chưa làm |
| 4 | Trang giới thiệu + form đăng ký, email chào, đồng bộ Google Meet, tin Zalo soạn sẵn | ⏳ Chưa làm |

Việc nhỏ còn tồn (P3, không chặn): [`viec-con-lai.md`](viec-con-lai.md). Hai mục **P2** (xoá buổi theo T42, đơn đăng ký theo T43 — mục 20–21 trong tệp đó) đã có trong mã từ 26/11; phiên laptop 27/11 kiểm lại: test đạt, nút có trên web.

---

## 2. Liên kết

| Thứ | Địa chỉ / định danh |
|---|---|
| Kho mã | https://github.com/NguyenVanTho2805/midnight-elite — nhánh `claude/optimistic-clarke-cbddza`, thư mục `bca/` |
| Web chính thức (đích) | https://bca-midnight.vercel.app |
| Vercel project | `bca-midnight` — id `prj_BEIjg3S2A5IbLoFcVCluLMq6bIH4`, team "tho's projects" id `team_fwHVnE8Dv7cMBC0BMLajMMmI` — https://vercel.com/thos-projects-d21895a0/bca-midnight |
| Google Cloud | tài khoản `aod.tsix@gmail.com`, project "BCA Midnight" (OAuth client loại Web application) |
| Redirect URI Google | `https://bca-midnight.vercel.app/api/dang-nhap/google/callback` (thêm `http://localhost:3100/api/dang-nhap/google/callback` nếu muốn thử Google thật trên máy) |
| Sheet lớp (nguồn dữ liệu) | "PHIẾU ĐĂNG KÝ HỌC THÊM HÈ/NĂM HỌC MỚI (Câu trả lời)" — https://docs.google.com/spreadsheets/d/1HuRczs8SxXk-EejEVcVsCihWXAShyUDEd5jAKH-3lJk (chủ sheet: anh Thanh) |
| Gmail chủ lớp trên web | `aod.tsix@gmail.com` (đã đặt `BCA_GMAIL_CHU`) |
| **KHÔNG ĐỤNG** | Vercel project `midnight-elite` (web KiN đang chạy thật) và biến `DATABASE_URL` của nó |

---

## 3. Kỹ thuật

- **Khung:** Next.js **16.2** (app router — KHÁC bản cũ, đọc `node_modules/next/dist/docs/` trước khi viết mã), React 19, TypeScript, Tailwind 4.
- **DB:** Postgres (Neon free trên production; Postgres 16 cục bộ khi dev/test), Prisma **7** + `@prisma/adapter-pg`, client sinh ra ở `bca/generated/prisma`. Lệnh dựng Vercel chạy `prisma migrate deploy`.
- **Đăng nhập:** Google OIDC (code + PKCE + state + nonce) tự viết, phiên cookie ký bằng `jose` (30 ngày, tự gia hạn ở `proxy.ts`).
- **Khác:** `exceljs` (đọc bản xuất sheet), `vitest` (test máy chủ), Playwright (`tests-ui/`, test trình duyệt).
- **Cấu trúc `bca/`:** `app/` (trang + route API mỏng) · `server/` (truy vấn + kiểm quyền + nhật ký) · `lib/` (hàm thuần: ngày giờ VN, quy tắc nghiệp vụ, quyền) · `prisma/` · `scripts/` (`seed-gia.ts`, `chuyen-tu-sheet.ts`, `them-nguoi-dung.ts`, `xem-thu-build.ts`) · `tests/` · `tests-ui/`.
- Mô tả đầy đủ biến môi trường, route, test: [`../../bca/README.md`](../../bca/README.md).

### Biến môi trường trên Vercel `bca-midnight` (27/11)
| Biến | Môi trường | Trạng thái |
|---|---|---|
| `BCA_APP_URL` = https://bca-midnight.vercel.app | Production | ✅ có |
| `BCA_SESSION_SECRET` (Sensitive) | Preview + Production | ✅ có |
| `BCA_DEV_LOGIN=1` | chỉ Preview | ✅ có (production luôn tắt) |
| `BCA_GMAIL_CHU` = aod.tsix@gmail.com | Production | ✅ có (đặt 27/11) |
| `BCA_SEED_GIA=1` | chỉ Preview | ✅ có (phiên khác đặt 27/11 — xem bẫy 4) |
| `BCA_DATABASE_URL` | chỉ Production | ✅ có (27/11, Neon tổ chức "Kin Class") |
| `BCA_GOOGLE_CLIENT_ID` | Production | ✅ có (27/11) |
| `BCA_GOOGLE_CLIENT_SECRET` (Sensitive) | Production | ✅ có (27/11) |

Build Command của project hiện là `npm run build:xem-thu` (= prisma generate && prisma migrate deploy && nạp dữ liệu giả CHỈ khi không phải production và `BCA_SEED_GIA=1` && next build).
Bảo vệ (từ 27/11): Vercel Authentication ở mức Standard — chỉ địa chỉ chính thức mở công khai; Preview và địa chỉ riêng từng bản dựng vẫn khoá.

---

## 4. Quy tắc cứng (mọi phiên phải giữ)

1. Chỉ đụng Vercel project `bca-midnight`. Không đụng `midnight-elite` (KiN).
2. Không bật gì trả phí (Neon gói Free, Vercel Hobby).
3. Không in mật khẩu, khoá bí mật, chuỗi kết nối DB ra chat hay vào tệp được commit. Chuỗi DB chỉ dùng qua biến môi trường trong terminal.
4. Không commit bản xuất `.xlsx` của sheet (có tên, SĐT, Gmail học sinh). Để ngoài kho. Script chuyển dữ liệu không in tên/SĐT/Gmail — giữ nguyên như vậy.
5. Chuyển dữ liệu thật: luôn **xem trước** (mặc định, rollback) → chỉ khi "KHỚP" và **chủ đồng ý** mới `--apply`.
6. Bấm nút quan trọng trên web (Connect DB, Publish app Google, Save cấu hình bảo vệ…) thì chụp màn hình hỏi chủ trước.
7. Đọc `QUYET-DINH.md` trước khi đổi nghiệp vụ; quyết định mới thì ghi thêm dòng có ngày.
8. Next.js 16 khác bản quen thuộc — đọc tài liệu trong `node_modules/next/dist/docs/`.

---

## 5. Bản đồ tài liệu

| Tệp | Nội dung |
|---|---|
| [`QUYET-DINH.md`](QUYET-DINH.md) | Quyết định của chủ (đọc trước tiên) |
| [`viec-con-lai.md`](viec-con-lai.md) | Việc tồn theo đợt |
| [`nghiep-vu/*.md`](nghiep-vu/) | Quy tắc: ghi danh, buổi học, điểm danh, hôm nay, phân quyền, chuyển dữ liệu |
| [`thiet-ke/*.md`](thiet-ke/) | Hướng giao diện, token màu, đặc tả từng màn |
| [`doi-ngu/README.md`](doi-ngu/README.md) | Đội agent `bca-*` (11 agent trong `.claude/agents/bca-*.md`) và vòng lặp làm việc |
| [`../../bca/README.md`](../../bca/README.md) | Cài, chạy, test, biến môi trường, route, việc chủ ngoài mã |

---

## 6. Đưa lên production — danh sách kiểm (27/11)

| # | Việc | Trạng thái |
|---|---|---|
| 1 | DB Neon | ✅ 27/11 (phiên laptop) — KHÁC kế hoạch: tạo thẳng trên Neon bằng tài khoản `aod.tsix@gmail.com` (Chrome của chủ không vào được Vercel của Thọ), tổ chức Neon "Kin Class" gói Free, project `bca-midnight` (id `bitter-shadow-91580230`), Singapore, Postgres 17. Đã `prisma migrate deploy` (có đủ bảng, chưa có dữ liệu). Chuỗi kết nối TRỰC TIẾP (không pooler — một biến dùng cho cả migrate lẫn chạy) cất trong Keychain máy chủ lớp: `security find-generic-password -a bca-midnight -s bca-neon-url -w`. `BCA_DATABASE_URL` đã đặt trên Vercel 27/11 (chỉ Production, Sensitive — chủ cho phép Claude chép qua kết nối Vercel). Production dựng lại READY, `https://bca-midnight.vercel.app/dang-nhap` trả 200 (chưa có nút Google vì chưa có khoá). Hàm chạy ở `sin1` (`bca/vercel.json`) cho gần DB. Tổ chức Neon "Vercel: KiN" (DB `kin-db` của web KiN) cùng tài khoản — KHÔNG ĐỤNG. |
| 2 | Google Cloud (project `bca-midnight`, tài khoản `aod.tsix`) | ✅ 27/11: ứng dụng "Kin Class" (Bên ngoài) **đã Publish — "In production"**; OAuth client "Kin Class web" loại Web, redirect `https://bca-midnight.vercel.app/api/dang-nhap/google/callback`; Branding có trang chủ + chính sách `https://bca-midnight.vercel.app/chinh-sach` (chủ duyệt nội dung 27/11). Không logo, chỉ quyền openid + email ⇒ không cần Google xác minh. Muốn lùi: Audience ▸ "Back to testing". |
| 3 | Client ID + secret trên Vercel (Production; secret Sensitive) | ✅ 27/11. `/api/dang-nhap/google` trên Production trả 302 sang Google đúng client, redirect, PKCE. Secret chỉ hiện một lần lúc tạo — mất thì tạo secret mới ở Google Cloud. |
| 4 | `BCA_GMAIL_CHU` | ✅ xong 27/11 |
| 5 | Chuyển dữ liệu sheet → Neon | ✅ 27/11 14:5x (phiên laptop, chủ đồng ý): xem trước KHỚP rồi `--apply` với bản xuất tải 14:44 và `--ngay-chot=2026-11-27` — 72 HS, 195 ghi danh, 46 buổi, 303 điểm danh, 155 đơn, 0 lỗi. Script nhắc xem lại: tên chữ thường ở dòng sheet 23 và 63, Gmail của HS0074, 17 đơn không còn hồ sơ. **Từ giờ sheet chỉ lưu trữ** — có nhập thêm trên sheet thì phải chạy lại trước khi web có dữ liệu người dùng nhập. Bản xuất nằm ở `~/Downloads` máy chủ lớp (không commit). |
| 6 | Mở web cho người dùng | ⏳ 27/11: Production READY (sin1). Vercel Authentication đổi từ "all" sang **Standard** (`prod_deployment_urls_and_all_previews`) theo lời chủ: `bca-midnight.vercel.app` mở công khai (trang đăng nhập + `/chinh-sach`), bản xem thử và địa chỉ riêng từng bản dựng vẫn khoá. Đã kiểm từ ngoài: `/dang-nhap` 200 có nút Google, không có đăng nhập thử; `/quan-ly` chuyển về đăng nhập; API 401. **Còn lại:** chủ đăng nhập Google lần đầu bằng `aod.tsix@gmail.com` (tự tạo tài khoản chủ), rồi làm mục 11. |

Vì sao mọi bản dựng đang đỏ: thiếu `BCA_DATABASE_URL` → `prisma migrate deploy` báo "Connection url is empty". Có DB là hết.

---

## 7. Bẫy đã gặp

1. **Sheet đổi định dạng:** 26/11 cột Tình trạng thêm biểu tượng ✅ 🧪 ⏹ → script cũ báo LỆCH. Đã sửa (T58, commit 0c49e38).
2. **Em đã ẩn trên sheet** (vd. ẩn 26/11) bị bỏ khỏi cả các buổi cũ → mất điểm danh, lệch sĩ số ma trận. Đã sửa: em ẩn vẫn thuộc các buổi trước ngày ẩn (T58).
3. **`--ngay-chot` phải là ngày tải bản xuất** (cột Tình trạng của sheet tính theo ngày hôm đó). Sai ngày → lệch "Bắt đầu …"/"Thử đến …".
4. **Preview nạp dữ liệu giả:** Build Command `build:xem-thu` + `BCA_SEED_GIA=1` ở Preview ⇒ nếu Preview dùng **chung** DB Neon với Production thì DB thật bị lẫn học sinh giả (script chuyển sẽ báo LỆCH, không cho `--apply`). Khi tạo Neon: **bỏ chọn Preview** (khuyên), hoặc xoá `BCA_SEED_GIA` trước.
5. **DB không phải localhost** cần `BCA_CHO_PHEP_CHUYEN_THAT=1` khi chạy script chuyển (kể cả xem trước).
6. **Hai phiên Claude cùng đụng Vercel** dễ giẫm nhau. 27/11 đã chốt: một phiên lead việc đưa web lên; phiên khác không đụng Vercel/DB. Trước khi đẩy mã luôn `git pull`.
7. **Phiên đám mây không điều khiển được Chrome** của chủ. Việc cần bấm trên web (Neon, Google Cloud) phải làm ở phiên Claude Code chạy trên laptop có tiện ích Claude in Chrome. Máy đang nối Remote Control là MacBook của Thanh, không cho phiên đám mây dùng thư mục.
8. **`BCA_APP_URL` chỉ đặt cho Production** — đặt cho Preview sẽ chuyển người dùng sang production và báo "hết hạn".
9. **`BCA_GMAIL_CHU` chỉ có tác dụng khi DB chưa có chủ nào còn hoạt động** — đăng nhập lần đầu bằng Gmail đó sẽ tạo tài khoản chủ tên "Chủ lớp" (sửa ở màn Tài khoản).

---

## 8. Công cụ cần mang theo / cài trên laptop

| Công cụ | Để làm gì | Bắt buộc? |
|---|---|---|
| App **Claude** (desktop) → Claude Code | Chạy phiên làm việc trên laptop | Có |
| Tiện ích Chrome **Claude in Chrome** (Chrome Web Store, nhà phát triển Anthropic) | Để Claude bấm Vercel / Google Cloud bằng tài khoản của bạn | Có (cho mục 6) |
| Chrome đã đăng nhập Vercel và Google (`aod.tsix@gmail.com`) | Như trên | Có |
| **git** + quyền vào kho GitHub | Tải mã, đẩy mã | Có |
| **Node.js 24** (Vercel dựng bằng 24.x) + npm | Chạy app, script, test | Có |
| **Postgres 16** cục bộ (cài thẳng hoặc Docker `postgres:16`) | Test vitest + xem trước chuyển dữ liệu trên DB thử | Nên có |
| Kết nối (connector) **Vercel** trong Claude | Đặt biến, xem log dựng, redeploy mà không cần bấm tay | Nên có |
| Kết nối **Google Drive** trong Claude | Tải bản xuất `.xlsx` của sheet | Tuỳ chọn (tải tay cũng được) |
| Playwright (cài qua `npx playwright install chromium`) | Test trình duyệt `npm run test:ui` | Tuỳ chọn |
| Công cụ thiết kế theo quyết định 19: Graphify, Playwright CLI, Agent Skills (Vercel), Ponytail, GSAP, Lenis, React Bits, 21st.dev (cần khoá API của chủ) | Cho Đợt 3–4 | Khi tới đợt đó |

---

## 9. Cách làm việc giữa đám mây và laptop

- **Mã luôn sống trên GitHub.** Phiên nào cũng `git pull` trước khi làm, đẩy lên nhánh khi xong. Không ai giữ mã riêng trên máy.
- **Phiên đám mây** (claude.ai/code): làm được mã, test, đặt biến Vercel, đọc log, đọc Google Drive; KHÔNG bấm được trình duyệt của bạn. Đẩy lên nhánh riêng `claude/<tên>` rồi bạn gộp (merge) vào `claude/optimistic-clarke-cbddza`, hoặc cho phép đẩy thẳng.
- **Phiên laptop:** làm mọi việc cần trình duyệt (Neon, Google Cloud, thử đăng nhập), chạy chuyển dữ liệu thật, và tiếp tục code Đợt 3–4.
- Muốn tiếp tục ở đâu cũng được: mở phiên mới, bảo nó "đọc docs/bca/BAN-GIAO-LAPTOP.md rồi làm tiếp".

---

## 10. Bắt đầu trên laptop (lần đầu)

```bash
git clone https://github.com/NguyenVanTho2805/midnight-elite.git
```
```bash
cd midnight-elite && git checkout claude/optimistic-clarke-cbddza && git pull
```
```bash
cd bca && npm ci
```
Chạy test (cần Postgres cục bộ, mật khẩu `postgres`):
```bash
createdb -h localhost -U postgres bca_test
```
```bash
BCA_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bca_test npx prisma migrate deploy
```
```bash
BCA_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bca_test BCA_SESSION_SECRET=bi-mat-chi-de-test-0123456789 npm test
```
Kỳ vọng: 210/210 đạt. Chạy app với dữ liệu giả: xem mục "Cài và chạy dev" trong `bca/README.md` (cổng 3100, đăng nhập thử theo vai).

Bạn không cần tự gõ các lệnh trên — mở Claude Code trong thư mục kho và dán lệnh ở mục 12, nó tự làm.

---

## 11. Sau khi web lên chính thức

1. Chủ đăng nhập `aod.tsix@gmail.com` → vào **Tài khoản** thêm giáo viên (Gmail, tên, môn): anh Thanh (Toán, Sử, Địa), chị Hoa (Toán), chị Thu Hương và anh Quang Minh (Anh).
2. Sửa tên tài khoản chủ ("Chủ lớp" → tên thật).
3. Báo học sinh đăng nhập bằng đúng Gmail đã khai trong phiếu.
4. Sheet chuyển sang chỉ lưu trữ (quyết định 1). Không nhập thêm trên sheet — nếu có, phải chạy lại chuyển dữ liệu trước khi web có dữ liệu do người dùng nhập.
5. Làm tiếp: Đợt 3 (sổ điểm, học phí).

---

## 12. Lệnh dán vào phiên Claude Code trên laptop

```
Trả lời bằng tiếng Việt. Tôi không biết code, hãy tự làm hết, chỉ hỏi tôi khi cần bấm xác nhận. Dùng Chrome của tôi qua tiện ích Claude in Chrome.

Đọc docs/bca/BAN-GIAO-LAPTOP.md (nhánh claude/optimistic-clarke-cbddza — git pull trước) rồi làm hết các việc còn ❌/⏳ ở mục 6, theo đúng quy tắc mục 4 và tránh các bẫy mục 7:
1. Tạo DB Neon trong Vercel bca-midnight (Free, tên bca-midnight, prefix BCA). Về chọn môi trường: nhắc tôi bẫy 4 và đề xuất bỏ Preview. Chụp màn hình hỏi tôi trước khi bấm Connect.
2. Kiểm và sửa Google Cloud (aod.tsix@gmail.com, project "BCA Midnight"). Hỏi tôi trước khi Publish/Save.
3. Chép Client ID + secret thẳng sang Vercel (Production; secret để Sensitive), không in ra chat.
4. (Đã xong.)
5. Tải bản xuất .xlsx mới của sheet ra ngoài kho, chạy xem trước scripts/chuyen-tu-sheet.ts vào Neon (chuỗi DB chỉ qua biến môi trường, BCA_CHO_PHEP_CHUYEN_THAT=1, --ngay-chot = ngày tải). Báo số đếm + ket_qua. KHỚP thì hỏi tôi rồi mới --apply; LỆCH thì dừng báo tôi.
6. Redeploy Production từ nhánh claude/optimistic-clarke-cbddza, chờ READY, đăng nhập Google bằng aod.tsix@gmail.com để thử. Ổn thì hỏi tôi rồi tắt Vercel Authentication cho Production.
Xong thì cập nhật mục 6 của docs/bca/BAN-GIAO-LAPTOP.md, commit + push, và báo tôi bằng lời đơn giản: web đã dùng được chưa, còn gì phải làm.
```
