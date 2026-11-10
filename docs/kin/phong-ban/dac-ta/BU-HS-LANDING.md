# BU-HS-LANDING · Dựng lại trang chủ công khai theo cách bố trí hsavnu.edu.vn, dữ liệu thật của KiN

Đặc tả của `stu-rnd` (pb-hoc-sinh), 09/11/2026. Nhánh nền `claude/bu-hs-trang-chu` (mã trang chủ mới đã commit b97a0501, chưa test). Mã đọc trực tiếp: `src/app/page.tsx`, `src/components/guest/HomeSections.tsx` (150 dòng), `HomeCommunity.tsx`, `HomeScore.tsx`, `HomeCtaGuard.tsx`, `src/lib/homeLayout.ts`, `src/lib/siteContent.ts`, `Navbar.tsx`, `Footer.tsx`, `src/lib/courseCatalogPublic*.ts`, `tutorSearch*.ts`, `tutorVisibility.ts`, `articlesPublic.ts`, `api/exams/route.ts`, `(guest)/thi-thu`, `(guest)/giang-vien`, `api/yeu-cau/route.ts`, `YeuCauForm.tsx`, `t-no-fabricated.ts`, `homeContentGuard.ts`, `BU-HS-TRANG-CHU.md`, `HOME-01.md`, `HOME-02.md`.
**Không mở được Figma và không mở hsavnu.edu.vn trong phiên này.** Bố cục HSA lấy đúng theo mô tả của phiếu COO (7 khối, thứ tự, nền đan xen, thanh trên cố định). Số đo ở mục 3 là số ước lượng từ mã; Figma đã duyệt (nếu có) thắng. Không chép chữ, ảnh, logo, mã của HSA.

Cờ: **TIỀN = chỉ ĐỌC** (hiện `Course.price` và nhãn "Miễn phí", không tính, không ghi, không Coin) · **TRẺ EM = không phát sinh dữ liệu mới** cho phần làm ngay (không hiện học sinh nào); ba khối có dữ liệu học sinh (lời chứng thực, bảng vàng, biểu mẫu tư vấn) **CHƯA LÀM, chờ chủ** · **ĐỔI NỀN = không** (không thư viện, không dịch vụ ngoài mới, không biến môi trường mới).
**Schema: không thêm gì.** (Mục 4 chỉ có một đề xuất cho biểu mẫu tư vấn, chưa tạo.)

---

## 0. Tóm tắt quyết định

1. Trang chủ vẫn **TĨNH** (`revalidate = 3600`, không `cookies()`/`headers()`/`getSession`), HTML ban đầu là bản của khách. Không thêm khối máy khách mới; bốn khối dữ liệu mới là **component máy chủ nhận props**, dữ liệu tải ở `page.tsx`.
2. Thứ tự mới: **Hero → [Lớp của tôi, chỉ học sinh] → Gia sư → Lớp theo kỳ thi → Thi thử miễn phí → Tin tức → Cộng đồng → Tính điểm → "Học ở đây thì được gì?" → CTA cuối → Footer.** Nền đan xen trắng / tô nhạt do bọc ngoài quyết, không khối nào tự đặt nền.
3. **Lời chứng thực (HSA 3) và Bảng vàng (HSA 7): KHÔNG hiện, không dựng khung "sắp có".** Lý do mục 2.2.
4. **Biểu mẫu "Đăng ký tư vấn": CHƯA LÀM, chờ chủ.** `POST /api/yeu-cau` bắt buộc `targetTutorId` (gửi cho MỘT gia sư), không phải hộp thư chung của KiN; năm sinh là dữ liệu trẻ em chưa có luật thu. Thay bằng dải "Cần tư vấn?" với hotline và Zalo đã có ở Footer (không thu dữ liệu nào).
5. Hero: giữ nền navy đã duyệt (Figma 145:8), một nút đặc ("Xem lớp học"), nút viền "Thi thử miễn phí", **dòng cuối của `title` tô màu nhấn** (`--kin-th-vang-nang`, 4,82:1 trên navy), 3 chỉ số thật như cũ (số 0 thì ẩn). Chữ hero/CTA vẫn do `site_content` (HOME-01) quyết; không đổi schema nội dung.
6. **Thanh dưới 5 mục trên điện thoại: KHÔNG làm** (mục 6). Giữ thanh trên cố định + menu bung của Navbar.
7. Bốn bộ tải mới ở `src/lib/homeLandingServer.ts`, mỗi bộ bọc lỗi riêng: lỗi hoặc rỗng → khối **không có trong DOM** (không khung trống). Phần chọn/sắp/cắt là hàm thuần ở `src/lib/homeLanding.ts`, test không cần DB.
8. Bản xem trước quản trị (`/admin/trang-chu/xem-truoc`) không truyền `slots.landing` → vẽ đúng như cũ (Hero, "Học ở đây…", "Tìm gia sư", CTA).
9. Việc chia theo tệp tách bạch (mục 7); tệp chung xin COO ở mục 8 chỉ là dòng ghi chú (`README` bài thử, bảng phạm vi), không đụng `kin-tokens.css`/`kin-site.css`/`schema.prisma`.
10. Có 9 chỗ cần chủ chọn (mục 9); mỗi chỗ có mặc định để làm tiếp nếu chủ chưa trả lời.

---

## 1. Vấn đề và bằng chứng

- Mặt tiền hiện chỉ nói về KiN bằng chữ: Hero + 4 thẻ kỳ thi + 3 số đếm (`HomeSections.tsx:48-95`), "Học ở đây thì được gì?" (`:101-125`), "Tìm gia sư" (`:128-144`), CTA (`:147`); cộng thêm Lớp của tôi / bảng tin / quiz / tính điểm do `page.tsx:63-70` chèn vào. **Không một khối nào cho khách thấy thứ KiN thật sự có**: gia sư đã duyệt, lớp đang mở, đề thi thử đang mở, bài tin đã đăng. Khách phải bấm sang `/giang-vien`, `/khoa-hoc`, `/thi-thu`, `/tin-tuc` mới biết (cả bốn trang đã có dữ liệu thật và đã được test).
- HSA dựng mặt tiền kiểu "bán hàng bằng dữ liệu": mỗi khối một tiêu đề + một câu phụ + một lối đi tiếp, nền đan xen (phiếu COO).
- Rủi ro cần chặn: chép nguyên HSA sẽ kéo theo số liệu, lời chứng thực, bảng vàng, tên giáo viên **không có trong KiN**; `t-no-fabricated.ts` (danh sách BANNED và mục "Số liệu trang chủ là số đếm thật") và `homeContentGuard.ts:11-27` cấm đúng loại này (số bịa, "hàng đầu", cam kết, "50.000+"...).

---

## 2. So sánh khối HSA ↔ KiN

### 2.1 Bảng khối

| # HSA | Khối HSA | KiN có dữ liệu thật? | Quyết định |
|---|---|---|---|
| 1 | Hero: nhãn, tiêu đề + cụm nhấn, mô tả, 2 nút, 3 chỉ số, thẻ "Đăng ký tư vấn" | Có chữ (`site_content`), có 3 số đếm thật (`loadStats`, `page.tsx:35-51`). **Không** có nơi nhận biểu mẫu tư vấn chung | Giữ hero, thêm cụm nhấn + dải "Cần tư vấn?" (hotline/Zalo). Form: CHƯA LÀM (2.3) |
| 2 | Đội ngũ giáo viên (thẻ + "năm kinh nghiệm" + nút) | **Có**: gia sư đã duyệt (`loadVisibleTutors`, `tutorSearchServer.ts:27-43`). **Không có** trường "năm kinh nghiệm" | **Làm.** Thẻ dùng lại `GiaSuCard` (tên, môn, khu vực, số buổi đã dạy/số học sinh đang dạy chỉ khi >0). Không hiện "năm kinh nghiệm" |
| 3 | Học viên & phụ huynh nói gì | Cơ chế có (`CourseReview`, `status:"approved"`, `api/courses/[id]/reviews`), nhưng **chưa có nơi công khai nào ngoài chi tiết lớp** và dữ liệu là lời học sinh | **ẨN.** Mục 2.2 |
| 4 | Chuyên luyện thi theo từng kỳ thi: lưới thẻ, nút Đăng ký | **Có**: `loadPublicCatalog()` (`courseCatalogPublicServer.ts`) | **Làm.** Chip kỳ thi + 6 thẻ, nhãn "Miễn phí" khi `price<=0`, không số học viên |
| 5 | Thi thử miễn phí: lưới đề, nút Vào thi ngay | **Có**: bảng `Exam` (`/api/exams?activeGuest=true`) | **Làm.** Chỉ đề chung, miễn phí, đang mở công khai (3.5) |
| 6 | Tin giáo dục & Tuyển sinh + Xem tất cả | **Có**: `listPublicArticles` (`articlesPublic.ts:122`) | **Làm.** 3 bài mới nhất |
| 7 | Bảng vàng học viên (dải nền màu) | **Không**: không bảng nào lưu thành tích có đồng ý; `honorData.ts` là dữ liệu mẫu (`t-no-hex.ts` ghi rõ) | **ẨN.** Mục 2.2 |
| — | (KiN thêm, đã có) | Lớp của tôi, bảng tin cộng đồng, Quiz (cờ), Tính điểm, "Học ở đây thì được gì?", CTA | Giữ, đổi chỗ (mục 3) |

### 2.2 Vì sao ẩn, không "sắp có"

1. **Khung "sắp có" trên mặt tiền production** nói với khách rằng KiN chưa có học viên nào nói gì: hại hơn là không nói. Cùng lập luận BU-HS-TRANG-CHU 5.1 đã dùng cho khối Quiz.
2. **Lời chứng thực** là lời của học sinh (nhiều em còn nhỏ) kèm tên. Dùng nó ở mặt tiền công khai cần: chủ cho phép dùng bài đánh giá đã duyệt, rút gọn tên hay không, có xin đồng ý khi em gửi đánh giá hay chưa. Hiện `POST /api/courses/[id]/reviews` không hỏi đồng ý công khai. **TRẺ EM, chưa làm.**
3. **Bảng vàng** cần dữ liệu thành tích có đồng ý của học sinh/phụ huynh; KiN chưa có. Bịa là vi phạm `t-no-fabricated`.
4. Cả hai sẽ **tự hiện lại** khi có nguồn thật vì cùng khuôn "khối rỗng thì không vẽ" (mục 3.9); chỉ cần thêm một bộ tải, không đổi bố cục.

### 2.3 Biểu mẫu tư vấn: CHƯA LÀM — chờ chủ

Bằng chứng: `api/yeu-cau/route.ts:46-48` buộc `targetTutorId`, tạo `TutorRequest` và `notify(tutor.id, …)`; chỉ dùng từ `(guest)/mentor/[id]/yeu-cau`. Không có hộp thư/nhân sự "tư vấn" cho KiN. Footer chỉ có hotline `0384 409 051`, Zalo, giờ hỗ trợ `09:00 – 21:30 hằng ngày` (`Footer.tsx:64-72`, trang chính sách đã khoá số này ở `t-no-fabricated.ts:78`). Phiếu cấm hỏi năm sinh/SĐT mới nếu chưa có luật. Câu hỏi cụ thể ở mục 9 (câu 3). **Thay thế làm ngay, không thu dữ liệu:** dải "Cần tư vấn?" dưới số liệu hero.

### 2.4 Nguồn dữ liệu, hàm tải ở máy chủ (stu-code), kiểu trả về, giới hạn, rỗng

Mọi hàm nằm ở `src/lib/homeLandingServer.ts`, chạy trong `HomePage` (đã `revalidate = 3600`). `loadHomeLanding(now = new Date()): Promise<HomeLanding>` gọi bốn bộ tải bằng `Promise.all`, mỗi bộ qua `safeBlock(fn, [], nhãn)` (ghi `console.error`, không ném). **Cấm** `cookies`, `headers`, `getSession`, đọc `process.env` theo người dùng.

```ts
// src/lib/homeLanding.ts — THUẦN (không prisma/next/react)
export const HOME_LANDING_LIMITS = { tutors: 4, tutorsMin: 2, courses: 6, exams: 6, articles: 3, excerpt: 140, avatarChars: 24_000 } as const;
export const HOME_CONTACT = { phoneHref: "tel:0384409051", phoneText: "0384 409 051", zaloHref: "https://zalo.me/0384409051", hours: "09:00 – 21:30 hằng ngày" } as const;

export interface LandingExam { id: string; code: string; title: string; category: string; date: string; time: string; duration: string;
  questionCount: number; state: "open" | "upcoming"; startsAtMs: number }
export interface LandingArticle { slug: string; title: string; excerpt: string; categoryLabel: string; dateText: string; coverImage: string | null }
export interface HomeLanding { tutors: TutorListItem[]; courses: PublicCard[]; courseChips: Chip[]; exams: LandingExam[]; articles: LandingArticle[] }
export const EMPTY_LANDING: HomeLanding;   // mọi mảng rỗng — stu-dev dùng để dựng trước khi bộ tải xong

export function pickHomeTutors(all: readonly SearchableTutor[]): TutorListItem[];
export function pickHomeCourses(cards: readonly PublicCard[], max?: number): { courses: PublicCard[]; chips: Chip[] };
export function pickHomeExams(rows: readonly ExamRowLike[], now: Date, max?: number): LandingExam[];
export function toLandingArticle(a: ArticleCard): LandingArticle;
export function clipText(s: string, max: number): string;            // cắt theo ký tự Unicode, thêm "…"
export function viDate(d: Date): string;                              // dd/mm/yyyy, múi +07:00 cố định (như VN_OFFSET_MS)
export function safeBlock<T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T>;
```

| Khối | Nguồn | Điều kiện lấy | Sắp xếp / giới hạn | Rỗng |
|---|---|---|---|---|
| Gia sư | `loadVisibleTutors` + `loadTutorAggregates` (`tutorSearchServer.ts`, cùng luật hiện của `/giang-vien`: đã duyệt, không khoá, không `isProfileHidden`) | Không lọc thêm | `sortTutors(…, "active")` (`tutorActivity.ts:54-62`) → 4 người đầu. **Dưới 2 người → `[]`** | Khối vẫn có nhưng chỉ còn phần chữ "Đang tìm gia sư?" + nút (giống hôm nay), không thẻ |
| Lớp | `loadPublicCatalog()` → `PublicCard[]` (đã loại `status:false`, không có link nhóm/sĩ số) | Chỉ `hasSeat(card.seat)` (không hiện lớp đầy/đóng/tạm ngừng ở mặt tiền) | Lấy 1 thẻ đầu mỗi kỳ thi theo `categories`, rồi bù theo `sortOrder` đến 6. Chip = `catalogChips(categories, cards, "")` | Không thẻ → ẩn cả khối (kể cả chip) |
| Thi thử | `prisma.exam.findMany` (`select` TỪNG cột, 3.5) | `active:true, activeGuest:true, isDraft:false, supersededById:null, variantOfId:null, courseId:null`, `OR:[{price:null},{price:0}]`, `examQuestions:{some:{}}`; trong bộ nhớ thêm `isListedToStudent(e, owner.adminRole, null)` và bỏ đề có `date/time` đọc không ra (`examStartInstant` Invalid) | Theo `examStartInstant` giảm dần (mới nhất trước), 6 đề; `take:60` ở truy vấn | Không đề → ẩn |
| Tin | `listPublicArticles({ limit: 3, sort: "moi", now })` | Luật sẵn của `publicArticleWhere` (đã đăng, đã tới giờ) | Ghim trước, rồi mới nhất; 3 bài | Không bài → ẩn |

Các luật này **chặt hơn** `/thi-thu` ở chỗ: chỉ đề không gắn lớp (`courseId:null`) và đang `active`. Lý do: `computeExamStatus` coi mọi đề `active` đã qua giờ mở là "đang mở" mãi (`examData.ts:9-12`), và danh sách khách của `/thi-thu` hiện cả đề gắn lớp (cùng phát hiện STU-004). Mặt tiền không nên khuếch đại điều đó.

`state` của đề tính lúc dựng trang (`computeExamStatus(date, time, true, now)`), nên có thể **trễ tối đa 1 giờ** với đề vừa tới giờ mở: thẻ "upcoming" **không phải liên kết**, chỉ ghi "Mở lúc HH:mm ngày dd/mm"; thẻ "open" là liên kết `/student/thi-thu/<id>` (khách tự bị chuyển `/dang-nhap?redirect=`, đã có `ui-exam-guest-redirect.ts`).

### 2.5 Trường KHÔNG được ra HTML (người đang làm bài, dữ liệu cá nhân)

Trang chủ **không bao giờ** chứa: đáp án đúng (`isCorrect`/`correctAnswer`), lời giải (`explanation`), nội dung câu hỏi, `password`/`passwordHash`, `azotaUrl`, `ownerId`, `clusterScorePercents`, `participants` (số thí sinh lưu tay, không hiện), mã mời/link nhóm của lớp, `capacity`/số đang học, email/SĐT/ngày sinh/trường/thành phố gia sư, `avatarBase64` dài quá `avatarChars`. Thực hiện bằng `select` liệt kê từng cột + `toListItem` (khoá cho phép `TUTOR_LIST_ITEM_KEYS`, `tutorSearch.ts:38-41`) và test ca phá ở mục 5. `questionCount` là **đếm hàng `ExamQuestion`** (không dùng cột `Exam.questions` lưu tay). Mốc giờ đều từ máy chủ lúc dựng trang; trình duyệt không tính mốc nào.

---

## 3. Bố cục từng khối (1440 và 390)

Quy ước chung: khung nội dung `mx-auto max-w-[1120px] px-4 sm:px-8` (hero giữ `max-w-[1440px]`); khoảng đệm dọc khối `py-12` (48px); chữ lấy token (`--kin-co-h2` cho tiêu đề khối, `--kin-co-small` cho câu phụ, `--kin-co-caption` cho nhãn nhỏ viết hoa `tracking-[0.09em]` màu `--kin-nhan-link`); mọi màu qua `--kin-*` (không hex: `t-no-hex`); nút/liên kết ≥44px (`min-h-11`); **một nút đặc cho cả màn: nút hero** (nút đặc có sẵn của "Tìm gia sư" và CTA cuối giữ như HOME-01, khối mới chỉ dùng nút viền hoặc liên kết gạch chân). Chiều cao là ước lượng từ mã, dùng để ngân sách chứ không để khoá test.

**Nền đan xen** do một khung bọc `data-home-alt` quyết (`[&>section:nth-child(odd)]:bg-[var(--kin-nen-trang)] [&>section:nth-child(even)]:bg-[var(--kin-nen-bang)]`); các khối con **bỏ** lớp nền của riêng mình (hiện `HomeCommunity`, `HomeScore`, "Học ở đây" tự đặt nền). Khối ẩn không có trong DOM nên đan xen không bao giờ lệch. "Lớp của tôi" đứng **ngoài** khung (ngay dưới hero) để khi học sinh đăng nhập nó hiện ra không đổi màu mọi khối sau.

| Thứ tự | Khối (`data-home-block`) | Nền | 1440 | 390 | Cao ~1440 / ~390 |
|---|---|---|---|---|---|
| 0 | Navbar (có sẵn, cố định) | `--kin-nen-trang` | giữ nguyên, 60px | giữ nguyên, hamburger 44px | 60 / 60 |
| 1 | **Hero** (`hero`) | `--kin-nhan-nen` (navy) | Hai cột như cũ. Trái: nhãn, `h1` (dòng cuối `title` tô `--kin-th-vang-nang`), mô tả, nút đặc "Xem lớp học" + nút viền "Thi thử miễn phí". Phải: "ĐANG MỞ LUYỆN THI" 4 thẻ, 3 số liệu, dải "Cần tư vấn?" | Một cột, cùng thứ tự; dải "Cần tư vấn?" ngay sau hai nút (chỗ HSA đặt form) | ≤440 / ~760 |
| 2 | Lớp của tôi (`my-class`, chỉ học sinh) | `--kin-nen-bang` | Như BU-HS-TRANG-CHU (không đổi) | idem | ~220 / ~300 |
| 3 | **Gia sư** (`tutors`) | trắng | Tiêu đề `c.findTutor.title`, câu phụ `c.findTutor.desc`; lưới 4 cột `GiaSuCard` (ảnh 4:3 ~268px + thân ~110px); dưới lưới: nút đặc `c.findTutor.buttonLabel` → `c.findTutor.buttonHref`, dòng `parentNote`, "Bạn là gia sư? Đăng ký gia sư" | Lưới 2 cột × 2 hàng (cùng `GiaSuCard`); nút full-width | ~570 / ~700 |
| 4 | **Lớp theo kỳ thi** (`courses`) | tô nhạt | Nhãn "LỚP ĐANG MỞ", h2 "Lớp luyện thi theo từng kỳ thi", câu phụ "Chọn theo kỳ thi. Mỗi thẻ cho biết ai dạy, giá và lớp còn chỗ không.", chip kỳ thi (liên kết `/khoa-hoc?category=<tên>`, 44px), lưới 3 cột × 2 hàng, "Xem tất cả lớp học →" | Chip và thẻ đều là **dải cuộn ngang** (`overflow-x-auto snap-x`, thẻ rộng 280px, `tabindex=0` + `aria-label`), 1 hàng; liên kết "Xem tất cả" 44px | ~830 / ~520 |
| 5 | **Thi thử miễn phí** (`exams`) | trắng | Nhãn "THI THỬ MIỄN PHÍ", h2 "Đề thi thử đang mở", câu phụ "Làm đề có giờ như thi thật. Cần đăng nhập để làm bài và lưu kết quả.", lưới 3 cột × 2 hàng thẻ đề, "Xem tất cả đề thi thử →" | Một cột, thẻ gọn (~104px), **hiện 4 đề đầu**, đề 5–6 `hidden sm:flex` | ~520 / ~600 |
| 6 | **Tin tức** (`news`) | tô nhạt | Nhãn "TIN TỨC", h2 "Tin giáo dục và tuyển sinh", câu phụ "Tuyển sinh, học tập, tin từ KiN — ghi rõ nguồn.", lưới 3 cột (ảnh bìa 16:9 nếu có), "Xem tất cả tin tức →" | Một cột, hàng ngang: ảnh vuông 96px + tiêu đề 3 dòng (~104px/bài) | ~560 / ~500 |
| 7 | Cộng đồng (`community`, đã có) | trắng | Giữ như BU-HS-TRANG-CHU (5 bài + Quiz theo cờ) | idem | ~900 / ~1100 |
| 8 | Tính điểm (`score`, đã có) | tô nhạt | Giữ | Giữ | ~420 / ~520 |
| 9 | "Học ở đây thì được gì?" (`why`) | trắng | Giữ, bỏ nền riêng | Giữ | ~420 / ~900 |
| 10 | CTA cuối (`cta`, ẩn khi đã đăng nhập) | `--kin-nen-bang` bọc thẻ navy | Giữ nguyên | Giữ nguyên | ~360 / ~420 |
| 11 | Footer | trắng | Giữ nguyên | Giữ nguyên | ~330 / ~620 |

Tổng ước ~5,4k px ở 1440 cho khách; ~7,5k px ở 390. Dài hơn hôm nay nhưng mỗi khối có lối đi tiếp, đúng mẫu HSA. Ở 390 các khối 4 và 5 là chỗ dễ làm trang kéo dài, nên đã dùng dải cuộn và giới hạn 4 thẻ.

### 3.1 Hero (thay đổi cụ thể)
- `title` vẫn là chuỗi có `\n` (HOME-01). **Dòng cuối** được bọc `<span class="text-[var(--kin-th-vang-nang)]">` khi `title` có ≥2 dòng; một dòng thì không tô. Không cần trường mới và quản trị vẫn sửa được. Tương phản `#f59e0b` trên `#1e3a8a` = 4,82:1 (đo), qua ngưỡng 4,5:1; hero nằm trong `data-vung="sang"` nên không đổi theo chế độ tối.
- Dải "Cần tư vấn?" (dưới 3 số liệu, cùng khung mờ như số liệu): "Cần tư vấn? Gọi 0384 409 051 hoặc nhắn Zalo." — hai liên kết chữ gạch chân 44px (`tel:`; Zalo mở tab mới `rel="noopener noreferrer"`), một dòng nhỏ "Hỗ trợ: 09:00 – 21:30 hằng ngày". Giá trị lấy từ `HOME_CONTACT` và test khoá bằng đúng số ở `Footer.tsx`. Không có ô nhập.
- Hai nút hero giữ: đặc (`btnOnNavy`) "Xem lớp học" → `/khoa-hoc`; viền (`btnGhostOnNavy`) "Thi thử miễn phí" → `/thi-thu`.

### 3.2 Gia sư
Thẻ **dùng lại nguyên `GiaSuCard`** (`components/tutor/tim-gia-su/GiaSuCard.tsx`, không "use client", đã nhận `TutorListItem`): cả thẻ là một liên kết `/mentor/<id>`, ≥44px. Không sửa tệp đó (thuộc phòng Gia sư); chỉ bọc lưới `grid grid-cols-2 gap-3 lg:grid-cols-4`. Ảnh: loader trả `avatarBase64` **chỉ khi** ≤ `avatarChars` (24.000 ký tự, ~18KB; tối đa 4 ảnh ~100KB vào HTML tĩnh), còn lại `null` → chữ cái đầu. Ảnh đại diện lưu base64 tới 160.000 ký tự (`api/users/me/avatar/route.ts:28`), nhét nguyên vào HTML tĩnh sẽ làm trang nặng thêm cỡ 1MB. Câu hỏi chủ ở mục 9 (câu 4).

### 3.3 Lớp theo kỳ thi
Thẻ mới `HomeCourseCard`: dải đầu `CATEGORY_GRADIENT[category]` (đã dùng ở `/khoa-hoc`, nằm trong tệp được phép có màu), tên kỳ thi viết hoa nhỏ; tiêu đề lớp 2 dòng làm **liên kết kéo giãn** phủ cả thẻ (`after:absolute after:inset-0`, cùng cách `CourseCatalog.tsx:36`); dòng "Gia sư <tên>" (`teacher`); "{lessons} bài · {hours} giờ"; trạng thái chỗ `seatLabel` ("Còn chỗ" / "Chỉ còn N chỗ" / "Đang nhận học viên"); chân thẻ: giá (`priceView`: `free` → "Miễn phí" màu `--kin-tt-chu-xong`; ngược lại "{price}đ", giá gốc gạch ngang nếu có) và **nhãn nút viền "Đăng ký →"** (một `span` kiểu nút `h-11`, không lồng liên kết). Nhãn `tag` hiện chip trung tính, **không** dùng `tagColor` từ DB. **Không** số học viên, không "-N%" tự suy (nếu `originalPrice` có thật thì mới hiện `discountPct` của `priceView`, đúng như `/khoa-hoc`).

### 3.4 Thi thử
Thẻ `HomeExamCard`: nhãn tiền tố mã đề (`code.split(".")[0]`, như `/thi-thu`), chip "Miễn phí", tên đề 2 dòng, dòng "dd/mm/yyyy · HH:mm · {duration} · {questionCount} câu" (bỏ phần nào rỗng), chân thẻ: "Vào thi ngay →" (đề mở, liên kết kéo giãn) hoặc "Mở lúc HH:mm ngày dd/mm" (đề chưa tới giờ, không liên kết). Không hiện số thí sinh, không điểm, không hạng.

### 3.5 Tin tức
Thẻ `HomeNewsCard`: ảnh bìa nếu `coverImage` còn sau `shapeCover` (khác thì khung nền `--kin-nen-nhan` kèm nhãn mục), nhãn `categoryLabel`, tiêu đề 2 dòng, đoạn trích cắt 140 ký tự, ngày `viDate`. Cả thẻ là liên kết `/tin-tuc/<slug>`. Dùng `<img>` thường (như `GiaSuCard`), `loading="lazy"`, `alt=""`.

### 3.6 Ba trạng thái (trang tĩnh, nên thực tế là hai)
| Khối | Đủ dữ liệu | Ít/rỗng | Lỗi tải |
|---|---|---|---|
| Gia sư | ≥2 thẻ + chữ + nút | 0–1 người → chỉ chữ + nút (giống hôm nay) | như rỗng, ghi `console.error` |
| Lớp / Thi thử / Tin | ≥1 thẻ → vẽ khối; ít thẻ thì **canh giữa**, không kéo giãn giả | **Không vẽ gì, không `<section>`** | như rỗng |
Không có khung xương: dữ liệu đã nằm trong HTML. Khách và học sinh thấy **cùng** các khối này; khác nhau duy nhất là "Lớp của tôi" (học sinh) và CTA cuối (chỉ khách), vẫn do client quyết như BU-HS-TRANG-CHU.

---

## 4. Phần chuyển khỏi HomeSections cũ, và schema

| Phần | Hôm nay | Sau BU-HS-LANDING |
|---|---|---|
| Hero | `HomeSections.tsx:48-95` | Giữ; thêm cụm nhấn dòng cuối `title` + dải "Cần tư vấn?" |
| `slots.afterHero` (Lớp của tôi) | `:97` | Giữ, đứng ngoài khung đan xen |
| `slots.afterWhyIntro` (Cộng đồng, Tính điểm) | `:98` | Giữ tên slot, **đặt SAU 4 khối mới** và vào trong khung đan xen |
| "Học ở đây thì được gì?" | `:101-125` | Giữ, đứng sau Tính điểm, bỏ nền riêng |
| "Tìm gia sư" (khối chữ riêng) | `:128-144` | Khi có `slots.landing`: **không vẽ riêng**, chữ và nút chuyển vào khối Gia sư (cùng `c.findTutor`, cùng `id="h-tim-gia-su"`, cùng chữ "Bạn là gia sư?"). Khi không có `slots.landing` (xem trước quản trị): vẽ như cũ |
| CTA cuối | `:147` + `CtaWrap` | Giữ |
| Props | `{content, stats, slots?}` | Thêm **`slots.landing?: ReactNode`**. `HomeSections` vẫn KHÔNG hook, KHÔNG prisma, KHÔNG async |
| `page.tsx` | `loadStats` + `loadHomeContent` + `loadPublicFormulas` | Thêm `loadHomeLanding()` vào `Promise.all`; giữ `export const revalidate = 3600`, `loadStats` nguyên văn (có `prisma.`, `filter(s => s.value > 0)`, `catch { return []; }`) |
| Navbar / Footer | — | **Không đổi** (thanh trên đã cố định `sticky top-0 z-50 h-[60px]`) |

**Schema: không thêm gì.** Mọi bảng đọc đã có (`User`, `Course`, `Enrollment`, `Exam`, `ExamQuestion`, `Article`).
Đề xuất chưa tạo, chỉ khi chủ duyệt biểu mẫu tư vấn (mục 9, câu 3): `model ConsultRequest { id, name, phone, phoneKey, examCategory?, status, createdAt }` cộng `ConsentRecord(subjectType:"consult_request")`, rate limit giống `api/yeu-cau`; **không** cột năm sinh.

---

## 5. Test phải có

Chạy trên DB thử `kin_test`, tuần tự, COO chạy. Mỗi bài có dòng "Ca phá" (sửa gì trong mã thì ca nào phải đỏ).

### `t-home-landing-lib.ts` (thuần, stu-code)
- `pickHomeTutors`: sắp `active` (đang hoạt động → nhiều buổi → tên); cắt 4; **1 người → `[]`**; `avatarBase64` dài hơn `avatarChars` → `null`, ngắn hơn giữ; khoá của mỗi phần tử đúng bằng `TUTOR_LIST_ITEM_KEYS`.
- `pickHomeCourses`: chỉ `hasSeat`; thẻ `full`/`closed`/`paused` không có mặt; ≤6; mỗi kỳ thi có thẻ trước khi bù; đầu vào rỗng → `{courses:[], chips:[]}`; không đổi mảng gốc.
- `pickHomeExams`: mới nhất trước theo giờ Việt Nam (không theo chuỗi `dd/mm/yyyy`: ca 05/12/2026 phải đứng trước 20/11/2026); ≤6; ngày/giờ rác bị bỏ; `state` đúng quanh biên giờ mở; không có khoá ngoài `LandingExam`.
- `toLandingArticle`: cắt đoạn trích 140 ký tự theo ký tự Unicode (không cắt giữa dấu); `viDate` đúng ở 23:30 UTC (đã sang ngày sau giờ Việt Nam); cover rỗng → `null`.
- `safeBlock`: hàm ném lỗi → trả `fallback`, không ném; hàm trả được → giá trị.
- `HOME_CONTACT.phoneText/zaloHref` khớp với chữ trong `Footer.tsx` (đọc nguồn, regex).
- **Ca phá**: bỏ `hasSeat` → ca "lớp đầy không hiện" đỏ; sắp theo chuỗi `date` → ca 05/12 vs 20/11 đỏ; bỏ `toListItem` → ca khoá thừa đỏ.

### `t-home-landing.ts` (DB thật, stu-code; không cần máy chủ Next)
- **Ca phá JSON lộ**: dựng đề có `passwordHash`, `azotaUrl`, một `ExamQuestion` có `explanation`/đáp án đúng chứa mã mồi; `JSON.stringify(await loadHomeLanding())` **không** chứa mã mồi, không chứa các khoá `passwordHash`, `password`, `azotaUrl`, `ownerId`, `explanation`, `isCorrect`, `participants`, `clusterScorePercents`; gia sư mẫu có email/SĐT/`city`/`dateOfBirth` → không xuất hiện.
- Đề: `activeGuest:false`, `active:false`, `isDraft:true`, `supersededById`, `variantOfId`, `courseId` khác null, `price>0`, 0 câu hỏi, chủ là gia sư và không lớp ("giao theo link") → **đều vắng**; đề hợp lệ → có.
- Gia sư: `tutorVerified:false`, `banned`, `profileLockedAt`, hồ sơ **ẩn** (`preferences` đặt ẩn) → vắng; số `studentCount`/`sessionsTaught` khớp `loadTutorAggregates`.
- Lớp: `status:false` vắng, lớp `classStatus:"closed"` vắng, lớp đầy vắng; JSON không có `capacity`, link nhóm.
- Tin: `published:false` và `publishedAt` ở tương lai → vắng; đã đăng → có.
- **Ca dữ liệu rỗng**: DB không gia sư/lớp/đề/bài → `loadHomeLanding()` trả `EMPTY_LANDING` (bốn mảng rỗng), không ném.
- Tĩnh: `homeLandingServer.ts` không chứa `cookies(`, `headers(`, `getSession`, `unstable_noStore`, `force-dynamic` (đọc nguồn).
- **Ca phá**: bỏ điều kiện `courseId:null` → ca đề gắn lớp đỏ; bỏ lọc ẩn hồ sơ → ca hồ sơ ẩn đỏ.

### `t-no-fabricated.ts` (mở rộng, stu-test)
- Mục mới "Landing: khối không có dữ liệu thật không được dựng": không tệp `src/components/guest/Home{Testimonials,Honor,Reviews}*.tsx`; bộ quét không bắt chữ `Học viên nói gì|Bảng vàng|lời chứng thực|Phụ huynh nói` trong `HomeSections.tsx` và `src/components/guest/Home*.tsx` (bỏ chú thích).
- Cụm số bịa thêm vào danh sách cấm của `src`: `\d{1,3}(\.\d{3})+\+` và `\d+\+\s*(học viên|học sinh|gia sư|giáo viên|đề)` (đồng bộ `GUARD_LISTS`/`homeContentGuard.ts` nếu cần). **Đo bộ quét trên cây hiện tại trước** để không đỏ vì chữ có sẵn.
- Không tên người viết cứng trong component mới: regex `(Thầy|Cô|ThS|TS)\.?\s+[A-ZĐ][a-zà-ỹ]+` không khớp trong `Home*.tsx` (tên chỉ đến từ dữ liệu).
- Giữ các điều kiện cũ của mục "Số liệu trang chủ là số đếm thật": `page.tsx` còn `prisma.`, `revalidate = 3600`, `filter(s => s.value > 0)`, `catch { return []; }`; `HomeSections.tsx` còn `stats.length > 0`.
- Ca phá cố ý: bộ quét bắt "50.000+ học viên", "Cô Nguyễn Lan", "Học viên nói gì"; không bắt nhầm "Gia sư <tên từ dữ liệu>".

### `t-links` / `t-no-hex` (chạy lại, không sửa)
- `t-links`: mọi liên kết mới khớp trang thật: `/mentor/<id>`, `/khoa-hoc/<slug>`, `/khoa-hoc?category=`, `/student/thi-thu/<id>`, `/tin-tuc/<slug>`, `/thi-thu`, `/giang-vien`, `/tin-tuc`, `/dang-ky?vai=gia-su`; tham số `category` được `khoa-hoc/page.tsx` đọc.
- `t-no-hex`: không hex trong tệp mới (gradient kỳ thi lấy từ `courseData.ts`, đã được phép).

### `ui-home-landing.ts` (trình duyệt, stu-test; 1440, 1280, 390, 320)
- **Thứ tự và nền**: khách thấy `data-home-block` theo thứ tự `hero → tutors → courses → exams → news → community → score → why → cta`; học sinh có thêm `my-class` ngay sau hero. Nền hai khối kề nhau **khác nhau** (đọc `getComputedStyle`, so với `--kin-nen-trang`/`--kin-nen-bang`).
- **Ca dữ liệu rỗng mỗi khối** (xoá dần, dựng lại trang): không gia sư → còn khối chữ "Đang tìm gia sư?" + nút; không lớp / đề / bài → **`[data-home-block="courses|exams|news"]` có 0 phần tử** và không còn tiêu đề của nó trong trang; **không có khối nào có 0 thẻ con**. Không đề: hết nhãn "Thi thử miễn phí" ở khối (nút hero vẫn còn).
- 1 gia sư duy nhất → khối Gia sư chỉ còn chữ + nút (không lưới 1 thẻ).
- Đề chưa tới giờ: thẻ **không** là liên kết, có chữ "Mở lúc". Đề đang mở: liên kết `/student/thi-thu/<id>`; khách bấm → `/dang-nhap?redirect=%2Fstudent%2Fthi-thu%2F<id>` (ca "khách gọi trang học sinh").
- HTML tĩnh (`curl /` không cookie) chứa tên lớp/gia sư/đề/bài mẫu và **không** chứa mã mồi lời giải, `passwordHash`, email gia sư; lặp với cookie học sinh cho **cùng** thân HTML (khối Lớp của tôi không nằm trong HTML máy chủ).
- Khách mở `/` **không** phát sinh yêu cầu tới `/api/student/*`, `/api/enrollments`, `/api/progress` (đếm request).
- Mọi nút/liên kết nhìn thấy cao ≥44px (kể cả chip kỳ thi, dải "Cần tư vấn?"); `scrollWidth ≤ innerWidth` ở 1440, 1280, 390, 320; chữ phóng 130% không tràn; dải cuộn của "Lớp" có `tabindex="0"` và `aria-label`; 0 `pageerror`/`console.error`.
- Hero ≤440px ở 1280 (đo); dòng cuối `h1` có màu `--kin-th-vang-nang`; chỉ MỘT nút đặc trong hero.
- Xem trước quản trị `/admin/trang-chu/xem-truoc`: vẽ được với `DEFAULT_HOME_CONTENT`, không `pageerror`, **không** có khối `tutors/courses/exams/news`, vẫn có "Đang tìm gia sư?" (HOME-02 không vỡ); `ui-admin-home-content.ts` và `t-home-content-admin.ts` chạy lại xanh.
- Chữ tiếng Việt thật: không "Lorem", "Sample", "Tên giáo viên", "00.000".
- Ảnh chụp 1440 + 390 (khách; học sinh; từng khối rỗng), chủ duyệt hình riêng.

### Chạy lại (không đỏ mới)
`ui-home-signed-in`, `ui-journey-new-student`, `ui-kin-site`, `ui-cong-dong`, `t-home-layout-lib`, `t-site-content-lib`, `t-home-content-guard-lib`, `t-home-feed`, `t-course-catalog-public`, `t-articles-api`, `t-tutor-search`, `ui-exam-guest-redirect`, `t-no-fabricated`, `t-no-hex`, `t-links`, `tsc`.

---

## 6. Thanh dưới 5 mục trên điện thoại (Trang chủ, My Class, Khoá học, Cộng đồng, Xem thêm): đề xuất KHÔNG làm

Bằng chứng và cân nhắc:
- Khu học sinh **đã có** thanh dưới 4 ô (3 module + Khác, `ModuleRail.tsx:238-243`, `h-[60px]`, test 4 ô ở 320/390). Khi khách đăng nhập, `GuestChrome` đổi cả khung sang `StudentShell`: thanh dưới 5 mục của khách sẽ **biến thành thanh 4 ô khác nghĩa** ngay giữa phiên, một lần nhảy khó hiểu.
- "My Class" của HSA vô nghĩa với khách (cần đăng nhập); "Xem thêm" chính là menu bung của Navbar (`Navbar.tsx:170-211`, đã có "Lớp học · Thi thử · Cộng đồng · Tin tức", đăng nhập/đăng ký, 44px).
- Thêm một thanh cố định ở đáy buộc sửa `GuestChrome`/`(guest)/layout.tsx` (mọi trang khách: đăng nhập, đăng ký, điều khoản, form gia sư có bàn phím ảo) và thêm đệm đáy; chạm vỏ chung, không nằm trong phạm vi một phiếu trang chủ.
- Trang chủ mới đã dẫn tới đủ bốn đích (Lớp, Thi thử, Tin, Cộng đồng) bằng chính nội dung và nút "Xem tất cả" 44px.
**Phương án B (chỉ khi chủ muốn):** thanh dưới 4 ô cho khách `Trang chủ · Lớp học · Thi thử · Cộng đồng` + nút "Menu" mở hamburger, đặt trong `GuestChrome`, ẩn khi vỏ học sinh/gia sư lên. Tệp: `GuestChrome.tsx` (stu-dev), thêm đệm `pb-[60px]` cho khách ở điện thoại; cần `ui-shell-everywhere` và ảnh chụp mọi trang guest. Mặc định: **không làm** (mục 9, câu 5).

---

## 7. Chia việc theo tệp (không trùng)

Hợp đồng nối hai bên chỉ là `src/lib/homeLanding.ts` (viết TRƯỚC, bước 0, gồm kiểu + `EMPTY_LANDING` để stu-dev dựng giao diện song song). stu-dev **không import prisma**, không sửa `src/lib/**`. stu-code **không sửa component/trang**.

### stu-code
| Tệp | Việc |
|---|---|
| `src/lib/homeLanding.ts` (MỚI, thuần) | Kiểu, hằng, `pick*`, `toLandingArticle`, `clipText`, `viDate`, `safeBlock`, `EMPTY_LANDING` (mục 2.4) |
| `src/lib/homeLandingServer.ts` (MỚI) | `loadHomeLanding(now?)` + bốn bộ tải; dùng lại `loadVisibleTutors`, `loadTutorAggregates`, `loadPublicCatalog`, `listPublicArticles`, `isListedToStudent`, `examStartInstant`, `computeExamStatus`; không `cookies/headers/getSession` |
| `tools/local-e2e/t-home-landing-lib.ts` (MỚI) | Mục 5 |
| `tools/local-e2e/t-home-landing.ts` (MỚI) | Mục 5 (DB) |
| API / schema | **Không sửa**, không thêm route |

### stu-dev
| Tệp | Việc |
|---|---|
| `src/app/page.tsx` | Gọi `loadHomeLanding()` trong `Promise.all` (bọc `.catch(() => EMPTY_LANDING)`), truyền `slots.landing` = `<HomeLandingBlocks …/>`; giữ `revalidate = 3600`, `loadStats` |
| `src/components/guest/HomeSections.tsx` | Hero (cụm nhấn + `HomeHeroContact`); `slots.landing`; khung `data-home-alt`; khối "Tìm gia sư" chỉ vẽ riêng khi không có `slots.landing`; thứ tự mục 3 |
| `src/components/guest/HomeLandingBlocks.tsx` (MỚI, máy chủ) | Ghép bốn khối theo thứ tự, không khối nào vẽ khi rỗng |
| `src/components/guest/HomeTutors.tsx`, `HomeCourses.tsx`, `HomeExams.tsx`, `HomeNews.tsx` (MỚI, máy chủ, không hook, không prisma) | Mục 3.2–3.5 |
| `src/components/guest/HomeHeroContact.tsx` (MỚI) | Dải "Cần tư vấn?" |
| `src/components/guest/HomeCommunity.tsx`, `HomeScore.tsx` | Chỉ **bỏ lớp nền riêng** (nền do khung `data-home-alt` quyết). Không đổi hành vi |
| `src/components/Navbar.tsx`, `Footer.tsx` | **Không sửa** |

### stu-test
`tools/local-e2e/ui-home-landing.ts` (MỚI), sửa `t-no-fabricated.ts` (mục 5), chạy lại các bài ở "Chạy lại". Không sửa `h.ts`.

Thứ tự: stu-code xong `homeLanding.ts` (kiểu + hằng + `EMPTY_LANDING` + hàm `pick*`) → stu-dev và stu-code chạy song song → stu-test → COO chạy tuần tự → chủ duyệt hình.

---

## 8. (Mục D) Tệp chung cần xin COO

Không cần: `prisma/schema.prisma`, `kin-tokens.css`, `kin-site.css`, `globals.css`, `src/components/kin/**`, `StudentShell.tsx`, `layout.tsx`, `landing.ts`, `signedInShell.ts`, `hostRouting.ts`.
Chỉ cần ghi chú (COO sửa, một người một lúc):
1. `docs/kin/phong-ban/PHAM-VI.md`: thêm một dòng cho phòng Học sinh: `src/app/page.tsx`, `src/components/guest/Home*.tsx`, `src/components/Navbar.tsx`, `src/components/Footer.tsx` → stu-dev; `src/lib/homeLanding*.ts`, `homeLayout.ts` → stu-code. Hiện bảng chỉ ghi "trang chủ" ở `(guest)/**` trong khi trang chủ nằm ở `src/app/page.tsx` ngoài nhóm `(guest)`.
2. `tools/local-e2e/README.md`: ghi ba bài mới `t-home-landing-lib`, `t-home-landing`, `ui-home-landing`.
3. `docs/kin/tien-do-dang-do.md`: dòng tiến độ BU-HS-LANDING.
4. (Chỉ nếu chủ chọn phương án B ở mục 6) `GuestChrome.tsx` đang thuộc vỏ chung của `(guest)`, COO xác nhận người sửa.
5. (Tuỳ chọn, không thuộc phiếu này) `Footer.tsx` dùng `HOME_CONTACT` thay số viết cứng để hai nơi không lệch; hôm nay test khoá hai bên bằng nhau là đủ.

---

## 9. Cờ, quan sát, và câu hỏi cho chủ

**Cờ**
- **TIỀN = chỉ đọc.** Hiện `Course.price`/`originalPrice`, nhãn "Miễn phí" khi `price<=0`; không tính, không ghi, không Coin. Đề "miễn phí" là đề có `price` null hoặc 0.
- **TRẺ EM = không phát sinh dữ liệu mới.** Bốn khối mới không hiện học sinh nào, không đếm theo em nào (`participants` bị bỏ); số hiện là số đếm của gia sư/lớp. **Lời chứng thực, Bảng vàng, Biểu mẫu tư vấn: CHƯA LÀM — chờ chủ.**
- **ĐỔI NỀN = không.**
- **Quan sát (P2, không sửa trong phiếu này):** danh sách khách của `/thi-thu` (`api/exams?activeGuest=true`) có thể hiện cả đề gắn lớp (chỉ lọc "giao theo link"); đề tạo bởi gia sư luôn `activeGuest:false` nên rủi ro thấp, đề do quản trị gắn lớp thì chưa kiểm. Mặt tiền đã tự chặt hơn (`courseId:null`).

**Câu hỏi và mặc định**
1. **Thứ tự.** Mặc định: kiểu HSA (Gia sư → Lớp → Thi thử → Tin tức → Cộng đồng → Tính điểm → Lợi ích). Phương án khác: giữ BU-HS-TRANG-CHU (Cộng đồng ngay dưới "Lớp của tôi", bốn khối HSA xuống sau). Chọn theo việc ai cần thấy gì trước: khách mới (HSA) hay học sinh quay lại (cộng đồng). Một trang tĩnh chỉ có một thứ tự.
2. **Lời chứng thực / Bảng vàng.** Mặc định: ẩn. Nếu chủ muốn có: (a) cho dùng bài đánh giá đã duyệt (`CourseReview approved`) ở mặt tiền không? (b) hiện tên thế nào (rút gọn, hay chỉ "Học viên lớp X")? (c) form gửi đánh giá có cần thêm ô "đồng ý hiển thị công khai" không? Bảng vàng: KiN chưa lưu thành tích có đồng ý, cần luật riêng trước.
3. **Biểu mẫu "Đăng ký tư vấn".** Mặc định: không làm, dùng hotline/Zalo. Muốn làm, cần chủ trả lời: (a) ai nhận và trả lời (KiN chưa có vai tư vấn; yêu cầu gửi cho gia sư nào?); (b) chỉ thu **họ tên + số điện thoại + kỳ thi quan tâm**, **không năm sinh**, đúng không; (c) người điền là phụ huynh hay học sinh ≥17, chữ đồng ý lấy từ `consentPolicy`; (d) có cho tạo bảng mới `ConsultRequest` (mục 4) và giữ bao lâu.
4. **Ảnh gia sư trên trang chủ.** Mặc định: hiện nếu ảnh ≤24.000 ký tự, còn lại chữ cái đầu. Đặt `avatarChars = 0` nếu muốn luôn chữ cái đầu (nhẹ nhất).
5. **Thanh dưới 5 mục.** Mặc định: không (mục 6). Chọn phương án B nếu chủ muốn có thanh cố định cho khách.
6. **Gia sư tối thiểu để hiện lưới.** Mặc định 2 (một người thì chỉ chữ + nút). Và có nên chỉ hiện gia sư đã có ≥1 lớp công khai không (mặc định: không lọc, theo đúng `/giang-vien`).
7. **Thi thử.** Mặc định: chỉ đề chung, miễn phí, đang `active`. Chủ có muốn hiện cả đề gắn lớp thu phí kèm giá không (mặc định: không).
8. **Tin tức.** Mặc định: cả 4 chuyên mục, 3 bài mới nhất. Hay chỉ Tuyển sinh + Học tập?
9. **Độ trễ.** Bài hẹn giờ, đề mới mở, lớp mới đầy có thể hiện trễ tối đa 1 giờ vì trang tĩnh (`revalidate = 3600`, `t-no-fabricated` khoá số này). Chấp nhận không? (Nếu không, cần gọi làm mới trang khi quản trị đăng bài/đổi lớp: việc của phòng Quản trị/Gia sư, không nằm ở đây.)

**Số liệu hero.** Ba số đếm vẫn theo luật "0 thì ẩn" (không có ngưỡng tối thiểu). Khi KiN còn ít học sinh, số nhỏ (ví dụ "3 gia sư") vẫn hiện, đúng sự thật nhưng kém hấp dẫn. Nếu chủ muốn ngưỡng (ví dụ chỉ hiện từ 10 trở lên), phải sửa cả `t-no-fabricated.ts` (mục "Số liệu trang chủ là số đếm thật") (đang khoá `filter(s => s.value > 0)`).
