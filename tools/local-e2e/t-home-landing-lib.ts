// BU-HS-LANDING — bốn khối dữ liệu thật trên trang chủ công khai, phần THUẦN (src/lib/homeLanding.ts). Không cần máy chủ, không cần DB.
// Đặc tả: docs/kin/phong-ban/dac-ta/BU-HS-LANDING.md mục 5. Chạy: npx tsx tools/local-e2e/t-home-landing-lib.ts (chạy lại với TZ=Asia/Ho_Chi_Minh cho chắc).
//
// Ca phá (sửa gì trong mã thì ca nào phải đỏ):
//  - pickHomeCourses: bỏ `hasSeat` → "lớp đầy/đóng/tạm ngừng không có mặt" đỏ.
//  - pickHomeExams: sắp theo chuỗi `date` thay vì mốc giờ → "05/12/2026 đứng trước 20/11/2026" đỏ (ca đối chứng bên dưới chứng minh chuỗi sẽ đảo).
//  - pickHomeExams: dùng giờ máy thay vì +07:00 → ca "23:30 UTC" của viDate và ca biên giờ mở đỏ khi chạy TZ khác.
//  - pickHomeTutors: bỏ `toListItem` → "khoá của phần tử đúng bằng TUTOR_LIST_ITEM_KEYS" và "không lộ email/verifiedAtMs" đỏ.
//  - pickHomeTutors: bỏ ngưỡng 2 → ca "1 người → []" đỏ. Bỏ cắt ảnh → ca avatar 24.001 ký tự đỏ.
//  - clipText: cắt theo đơn vị UTF-16 → ca emoji/dấu kết hợp đỏ.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EMPTY_LANDING, HOME_CONTACT, HOME_LANDING_LIMITS, clipText, pickHomeCourses, pickHomeExams, pickHomeTutors, safeBlock, toLandingArticle, viDate,
  type ExamRowLike, type LandingExam,
} from "@/lib/homeLanding";
import { TUTOR_LIST_ITEM_KEYS, type SearchableTutor } from "@/lib/tutorSearch";
import type { PublicCard, SeatInfo } from "@/lib/courseCatalogPublic";
import type { ArticleCard } from "@/lib/articlesPublic";
import { check, section, done } from "./h";

// ─── Dữ liệu dựng ───────────────────────────────────────────────────────────────────────────────────────────
const tutor = (id: string, o: Partial<SearchableTutor> = {}): SearchableTutor => ({
  id, name: o.name ?? `GS ${id}`, avatarBase64: null, bio: null, subjects: ["Toán 12"], tutorVerified: true,
  classCount: 1, studentCount: 3, sessionsTaught: 0, recentlyActive: false, area: null, rating: { avg: null, total: 0 }, verifiedAtMs: 1, ...o,
});
const OPEN: SeatInfo = { state: "open", left: null };
const card = (slug: string, category: string, seat: SeatInfo = OPEN, o: Partial<PublicCard> = {}): PublicCard => ({
  slug, title: `Lớp ${slug}`, category, teacher: "GV", teacherAvatar: "", lessons: 10, hours: 20, price: 0, originalPrice: null, tag: null, tagColor: null, seat, ...o,
});
const exam = (id: string, date: string, time: string, o: Partial<ExamRowLike> = {}): ExamRowLike => ({
  id, code: `HSA.${id}`, title: `Đề ${id}`, category: "ĐGNL HSA", date, time, duration: "90 phút", questionCount: 50, ...o,
});
const article = (o: Partial<ArticleCard> = {}): ArticleCard => ({
  id: "a1", slug: "bai-1", title: "Tuyển sinh 2027", excerpt: "Đoạn trích", category: "tuyen-sinh", categoryLabel: "Tuyển sinh", author: "KiN", tag: null,
  isPinned: false, readTime: 3, views: 10, publishedAt: new Date("2026-11-01T03:00:00Z"), createdAt: new Date("2026-10-30T03:00:00Z"),
  coverImage: null, coverCaption: null, ...o,
});
const NOW = new Date("2026-11-09T05:00:00Z"); // 12:00 giờ VN

// ─── pickHomeTutors ─────────────────────────────────────────────────────────────────────────────────────────
section("pickHomeTutors — sắp, cắt, ngưỡng, ảnh, khoá");
{
  const all = [
    tutor("a", { name: "An", recentlyActive: false, sessionsTaught: 50 }),
    tutor("b", { name: "Bình", recentlyActive: true, sessionsTaught: 5 }),
    tutor("c", { name: "Chi", recentlyActive: true, sessionsTaught: 9 }),
    tutor("d", { name: "Dũng", recentlyActive: false, sessionsTaught: 50 }),
    tutor("e", { name: "Em", recentlyActive: false, sessionsTaught: 1 }),
    tutor("f", { name: "Phúc", recentlyActive: false, sessionsTaught: 0 }),
  ];
  const snapshot = JSON.stringify(all);
  const r = pickHomeTutors(all);
  check("cắt tối đa 4", r.length === HOME_LANDING_LIMITS.tutors && r.length === 4, r.map(t => t.id));
  check("thứ tự: đang hoạt động (nhiều buổi hơn trước) → rồi nhiều buổi đã dạy → tên", r.map(t => t.id).join() === "c,b,a,d", r.map(t => t.id));
  check("không đổi mảng đầu vào", JSON.stringify(all) === snapshot);
  check("0 người → []", pickHomeTutors([]).length === 0);
  check("1 người → [] (không dựng lưới 1 thẻ)", pickHomeTutors([tutor("x")]).length === 0);
  check("2 người → 2 thẻ", pickHomeTutors([tutor("x"), tutor("y")]).length === 2);
  check("đầu vào rác (undefined) không ném lỗi", (() => { try { return pickHomeTutors(undefined as unknown as SearchableTutor[]).length === 0; } catch { return false; } })());

  const exact = "x".repeat(HOME_LANDING_LIMITS.avatarChars), over = "x".repeat(HOME_LANDING_LIMITS.avatarChars + 1);
  const av = pickHomeTutors([tutor("a", { avatarBase64: exact }), tutor("b", { avatarBase64: over }), tutor("c", { avatarBase64: "" }), tutor("d", { avatarBase64: "data:image/png;base64,AAAA" })]);
  const by = Object.fromEntries(av.map(t => [t.id, t.avatarBase64]));
  check("ảnh đúng 24.000 ký tự → giữ", by.a === exact);
  check("ảnh 24.001 ký tự → null (chữ cái đầu)", by.b === null);
  check("ảnh rỗng → null; ảnh ngắn → giữ", by.c === null && by.d === "data:image/png;base64,AAAA");

  const dirty = { ...tutor("a"), email: "gs@bi-mat.vn", phone: "0900000000", dateOfBirth: "2000-01-01", school: "Trường Bí Mật", passwordHash: "x" } as unknown as SearchableTutor;
  const ks = Object.keys(pickHomeTutors([dirty, tutor("b")])[0]).sort().join();
  check("khoá của phần tử đúng bằng TUTOR_LIST_ITEM_KEYS (không verifiedAtMs, không email/SĐT/trường/ngày sinh)", ks === [...TUTOR_LIST_ITEM_KEYS].sort().join(), ks);
  check("JSON không chứa dữ liệu cá nhân lỡ có trong đầu vào", !/bi-mat|0900000000|Bí Mật|passwordHash|dateOfBirth/.test(JSON.stringify(pickHomeTutors([dirty, tutor("b")]))));
  const longBio = pickHomeTutors([tutor("a", { bio: "Bio ".repeat(200) }), tutor("b")])[0].bio ?? "";
  check("tiểu sử quá dài bị cắt (≤240 ký tự)", Array.from(longBio).length <= 240 && longBio.endsWith("…"), longBio.length);
}

// ─── pickHomeCourses ────────────────────────────────────────────────────────────────────────────────────────
section("pickHomeCourses — chỗ, kỳ thi, giới hạn, chip");
{
  const full: SeatInfo = { state: "full", left: 0 }, closed: SeatInfo = { state: "closed", left: null }, paused: SeatInfo = { state: "paused", left: null };
  const cards = [
    card("hsa-full", "HSA", full), card("hsa-closed", "HSA", closed), card("hsa-paused", "HSA", paused),
    card("hsa-1", "HSA"), card("hsa-2", "HSA", { state: "low", left: 2 }), card("hsa-3", "HSA", { state: "unlimited", left: null }),
    card("hcm-1", "HCM"), card("tsa-1", "TSA"), card("bca-full", "BCA", full),
    card("hsa-4", "HSA"), card("hsa-5", "HSA"), card("hsa-6", "HSA"),
  ];
  const snapshot = JSON.stringify(cards);
  const r = pickHomeCourses(cards);
  const slugs = r.courses.map(c => c.slug);
  check("lớp đầy / đóng / tạm ngừng KHÔNG có mặt", !slugs.some(s => /full|closed|paused/.test(s)), slugs);
  check("tối đa 6", r.courses.length === 6, slugs);
  check("mỗi kỳ thi còn chỗ có thẻ trước khi bù (HSA, HCM, TSA đều có mặt)", ["hsa-1", "hcm-1", "tsa-1"].every(s => slugs.includes(s)), slugs);
  check("kỳ thi chỉ có lớp đầy (BCA) không có thẻ, không có chip", !r.courses.some(c => c.category === "BCA") && !r.chips.some(c => c.name === "BCA"), r.chips);
  check("bù theo thứ tự đầu vào đến đủ 6", slugs.join() === "hsa-1,hcm-1,tsa-1,hsa-2,hsa-3,hsa-4", slugs);
  check("chip: mỗi kỳ thi còn lớp có chỗ, đếm theo lớp có chỗ", r.chips.map(c => `${c.name}:${c.count}`).join() === "HSA:6,HCM:1,TSA:1", r.chips);
  check("không đổi mảng đầu vào", JSON.stringify(cards) === snapshot);

  const ordered = pickHomeCourses(cards, 6, ["TSA", "HCM", "HSA"]);
  check("theo thứ tự danh mục khi được truyền (TSA, HCM, HSA đứng đầu)", ordered.courses.slice(0, 3).map(c => c.slug).join() === "tsa-1,hcm-1,hsa-1", ordered.courses.map(c => c.slug));
  check("max nhỏ hơn số kỳ thi → cắt theo thứ tự kỳ thi", pickHomeCourses(cards, 2).courses.length === 2);
  check("max = 0 → không thẻ", pickHomeCourses(cards, 0).courses.length === 0);

  const none = pickHomeCourses([]);
  check("đầu vào rỗng → { courses: [], chips: [] }", none.courses.length === 0 && none.chips.length === 0);
  const allFull = pickHomeCourses([card("x", "HSA", full), card("y", "HCM", closed)]);
  check("toàn lớp đầy/đóng → rỗng cả thẻ lẫn chip (ẩn cả khối)", allFull.courses.length === 0 && allFull.chips.length === 0);
  const big = pickHomeCourses([card("p", "HSA", OPEN, { teacherAvatar: "y".repeat(HOME_LANDING_LIMITS.avatarChars + 1) }), card("q", "HCM", OPEN, { teacherAvatar: "ok" })]).courses;
  check("ảnh gia sư của lớp quá dài → rỗng; ngắn → giữ", big[0].teacherAvatar === "" && big[1].teacherAvatar === "ok");
  check("giá vẫn nguyên (chỉ để hiển thị)", pickHomeCourses([card("p", "HSA", OPEN, { price: 900000, originalPrice: 1200000 })]).courses[0].price === 900000);
}

// ─── pickHomeExams ──────────────────────────────────────────────────────────────────────────────────────────
section("pickHomeExams — thứ tự theo mốc giờ VN, giới hạn, ngày rác, biên giờ mở");
{
  const rows = [exam("1", "20/11/2026", "08:00"), exam("2", "05/12/2026", "08:00"), exam("3", "01/11/2026", "08:00")];
  const byString = [...rows].sort((a, b) => b.date.localeCompare(a.date)).map(r => r.id).join();
  check("(đối chứng ca phá) nếu sắp theo chuỗi dd/mm/yyyy thì 20/11 sẽ đứng trước 05/12 (sai) — ca bên dưới phải bắt được", byString.indexOf("1") < byString.indexOf("2"), byString);
  const r = pickHomeExams(rows, NOW);
  check("mới nhất trước theo mốc giờ: 05/12/2026 trước 20/11/2026 trước 01/11/2026", r.map(e => e.id).join() === "2,1,3", r.map(e => e.id));
  check("cùng ngày: giờ muộn hơn đứng trước", pickHomeExams([exam("a", "10/11/2026", "08:00"), exam("b", "10/11/2026", "19:30")], NOW).map(e => e.id).join() === "b,a");
  check("sang năm: 02/01/2027 trước 30/12/2026", pickHomeExams([exam("a", "30/12/2026", "08:00"), exam("b", "02/01/2027", "08:00")], NOW).map(e => e.id).join() === "b,a");

  const many = Array.from({ length: 10 }, (_, i) => exam(String(i), `${String(i + 1).padStart(2, "0")}/11/2026`, "08:00"));
  const m = pickHomeExams(many, NOW);
  check("tối đa 6", m.length === 6 && m[0].id === "9" && m[5].id === "4", m.map(e => e.id));
  check("max tuỳ chọn", pickHomeExams(many, NOW, 2).length === 2);

  const junk = pickHomeExams([
    exam("ok", "10/11/2026", "08:00"),
    exam("j1", "abc", "08:00"), exam("j2", "31/02/2026", "08:00"), exam("j3", "10/13/2026", "08:00"), exam("j4", "10/11/2026", "25:00"),
    exam("j5", "10/11/2026", "8h"), exam("j6", "2026-11-10", "08:00"), exam("j7", "10/11/26", "08:00"), exam("j8", "00/11/2026", "08:00"),
  ], NOW);
  check("ngày/giờ rác bị bỏ (chỉ còn đề hợp lệ)", junk.length === 1 && junk[0].id === "ok", junk.map(e => e.id));
  const noDate = pickHomeExams([exam("e", "", "")], NOW);
  check("đề không ghi ngày/giờ: giữ, chữ ngày/giờ rỗng, coi là đang mở, xếp cuối", noDate.length === 1 && noDate[0].date === "" && noDate[0].time === "" && noDate[0].state === "open");
  check("ngày/giờ 1 chữ số được chuẩn hoá", (() => { const e = pickHomeExams([exam("n", "5/2/2027", "8:05")], NOW)[0]; return e.date === "05/02/2027" && e.time === "08:05"; })());

  // 20/11/2026 10:00 giờ VN = 03:00 UTC
  const start = Date.UTC(2026, 10, 20, 3, 0);
  const at = (ms: number) => pickHomeExams([exam("s", "20/11/2026", "10:00")], new Date(ms))[0];
  check("mốc bắt đầu tính theo giờ VN (+07:00)", at(start).startsAtMs === start, at(start).startsAtMs);
  check("trước giờ mở 1ms → upcoming", at(start - 1).state === "upcoming");
  check("đúng giờ mở → open", at(start).state === "open");
  check("sau giờ mở → open", at(start + 1).state === "open");
  check("05:00Z (12:00 giờ VN) đã qua giờ mở 10:00 giờ VN → open (nếu lỡ coi \"10:00\" là giờ UTC thì sẽ sai)", at(Date.UTC(2026, 10, 20, 5, 0)).state === "open");

  const keys = Object.keys(r[0]).sort().join();
  const want = (["id", "code", "title", "category", "date", "time", "duration", "questionCount", "state", "startsAtMs"] as (keyof LandingExam)[]).sort().join();
  check("không có khoá ngoài LandingExam", keys === want, keys);
  const dirty = pickHomeExams([{ ...exam("z", "10/11/2026", "08:00"), passwordHash: "MA-MOI", azotaUrl: "https://azota/bi-mat", ownerId: "u1", explanation: "MA-MOI", participants: 9, clusterScorePercents: [1] } as unknown as ExamRowLike], NOW);
  check("JSON không lộ khoá lạ lỡ có trong đầu vào", !/MA-MOI|azota|ownerId|participants|clusterScorePercents|passwordHash|explanation/.test(JSON.stringify(dirty)), JSON.stringify(dirty));
  check("số câu hỏi âm/NaN → 0", pickHomeExams([exam("q", "10/11/2026", "08:00", { questionCount: -3 }), exam("r", "09/11/2026", "08:00", { questionCount: Number.NaN })], NOW).every(e => e.questionCount === 0));
  check("không đổi mảng đầu vào", (() => { const a = [exam("2", "05/12/2026", "08:00"), exam("1", "20/11/2026", "08:00")]; const s = JSON.stringify(a); pickHomeExams(a, NOW); return JSON.stringify(a) === s; })());
  check("đầu vào rỗng → []", pickHomeExams([], NOW).length === 0);
}

// ─── clipText / viDate / toLandingArticle ───────────────────────────────────────────────────────────────────
section("clipText / viDate / toLandingArticle");
{
  const long = "Tuyển sinh đại học năm 2027: những điều thí sinh cần biết ".repeat(10);
  const c = clipText(long, 140);
  check("cắt về ≤140 ký tự (kể cả …) và kết thúc bằng …", Array.from(c).length <= 140 && c.endsWith("…"), Array.from(c).length);
  check("ngắn hơn hạn → giữ nguyên", clipText("Ngắn thôi", 140) === "Ngắn thôi");
  check("đúng bằng hạn → không thêm …", clipText("a".repeat(140), 140) === "a".repeat(140));
  check("gộp khoảng trắng/xuống dòng", clipText("  a \n\n b\t c  ", 50) === "a b c");
  const emoji = "😀".repeat(200);
  const ce = clipText(emoji, 140);
  check("đếm theo ký tự Unicode (emoji không bị chẻ đôi)", Array.from(ce).length === 140 && !/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(ce), Array.from(ce).length);
  const nfd = "Việt Nam ".normalize("NFD").repeat(40);
  const cn = clipText(nfd, 30);
  check("chữ tổ hợp (NFD) được chuẩn NFC, không dấu mồ côi ở cuối", Array.from(cn).length <= 30 && cn === cn.normalize("NFC") && !/\p{M}…$/u.test(cn) && !/^\p{M}/u.test(cn), cn);
  check("max 0 / âm / NaN không ném lỗi", clipText("abc", 0) === "" && clipText("abc", -5) === "" && clipText("abc", Number.NaN) === "");
  check("đầu vào không phải chuỗi → rỗng", clipText(undefined as unknown as string, 10) === "");
  check("xoá ký tự điều khiển/zero-width", clipText("a\u0000b​c", 10) === "a b c");

  check("viDate: 23:30 UTC đã sang ngày sau giờ VN", viDate(new Date("2026-11-09T23:30:00Z")) === "10/11/2026", viDate(new Date("2026-11-09T23:30:00Z")));
  check("viDate: 16:59 UTC vẫn cùng ngày giờ VN", viDate(new Date("2026-11-09T16:59:59Z")) === "09/11/2026");
  check("viDate: 17:00 UTC là 00:00 ngày sau", viDate(new Date("2026-11-09T17:00:00Z")) === "10/11/2026");
  check("viDate: qua năm 31/12 23:00 UTC → 01/01 năm sau", viDate(new Date("2026-12-31T23:00:00Z")) === "01/01/2027");
  check("viDate: ngày không hợp lệ → rỗng", viDate(new Date("x")) === "" && viDate(undefined as unknown as Date) === "");

  const a = toLandingArticle(article({ excerpt: long, coverImage: "" }));
  check("toLandingArticle: đoạn trích ≤140, cover rỗng → null", Array.from(a.excerpt).length <= HOME_LANDING_LIMITS.excerpt && a.coverImage === null);
  check("toLandingArticle: ngày = giờ đăng theo giờ VN (03:00Z → 01/11/2026)", a.dateText === "01/11/2026", a.dateText);
  check("toLandingArticle: bài không có giờ đăng → ngày tạo", toLandingArticle(article({ publishedAt: null, createdAt: new Date("2026-10-30T20:00:00Z") })).dateText === "31/10/2026");
  check("toLandingArticle: cover có thật → giữ", toLandingArticle(article({ coverImage: "https://cdn.kin/a.jpg" })).coverImage === "https://cdn.kin/a.jpg");
  check("toLandingArticle: không có khoá thừa (không tác giả, lượt xem, nội dung, id)", Object.keys(a).sort().join() === "categoryLabel,coverImage,dateText,excerpt,slug,title", Object.keys(a).join());
}

// ─── EMPTY_LANDING & liên hệ ────────────────────────────────────────────────────────────────────────────────
section("EMPTY_LANDING, HOME_CONTACT");
{
  check("EMPTY_LANDING: bốn mảng + chip rỗng", EMPTY_LANDING.tutors.length + EMPTY_LANDING.courses.length + EMPTY_LANDING.courseChips.length + EMPTY_LANDING.exams.length + EMPTY_LANDING.articles.length === 0);
  check("EMPTY_LANDING bất biến", Object.isFrozen(EMPTY_LANDING) && Object.isFrozen(EMPTY_LANDING.tutors) && Object.isFrozen(EMPTY_LANDING.exams));
  const footer = readFileSync(join(process.cwd(), "src/components/Footer.tsx"), "utf8");
  check("HOME_CONTACT.phoneHref/phoneText khớp Footer.tsx", footer.includes(`href="${HOME_CONTACT.phoneHref}"`) && footer.includes(`Hotline: ${HOME_CONTACT.phoneText}`));
  check("HOME_CONTACT.zaloHref khớp Footer.tsx", footer.includes(`href="${HOME_CONTACT.zaloHref}"`));
  check("HOME_CONTACT.hours khớp Footer.tsx", footer.includes(`Hỗ trợ: ${HOME_CONTACT.hours}`));
  check("tel: chỉ có chữ số khớp số hiển thị", HOME_CONTACT.phoneHref.replace("tel:", "") === HOME_CONTACT.phoneText.replace(/\s/g, ""));
  check("giới hạn khớp đặc tả", HOME_LANDING_LIMITS.tutors === 4 && HOME_LANDING_LIMITS.tutorsMin === 2 && HOME_LANDING_LIMITS.courses === 6 && HOME_LANDING_LIMITS.exams === 6 && HOME_LANDING_LIMITS.articles === 3 && HOME_LANDING_LIMITS.excerpt === 140 && HOME_LANDING_LIMITS.avatarChars === 24_000);
  const src = readFileSync(join(process.cwd(), "src/lib/homeLanding.ts"), "utf8").replace(/\/\/.*$/gm, "");
  check("homeLanding.ts thuần: không import prisma/next/react", !/from\s+["'](@\/lib\/prisma|next[/"']|react)/.test(src) && !/@\/lib\/(articlesPublic|tutorSearchServer|courseCatalogPublicServer)["']/.test(src.replace(/import type[^;]*;/g, "")));
}

// ─── safeBlock ──────────────────────────────────────────────────────────────────────────────────────────────
section("safeBlock");
const safeBlockDone = (async () => {
  const origErr = console.error; const logged: unknown[][] = []; console.error = (...a: unknown[]) => { logged.push(a); };
  try {
    const bad = await safeBlock(async () => { throw new Error("DB sập"); }, ["rỗng"], "thử");
    check("hàm ném lỗi → trả fallback, không ném", bad.length === 1 && bad[0] === "rỗng");
    check("ghi console.error có nhãn", logged.length === 1 && String(logged[0][0]).includes("thử"), logged);
    const sync = await safeBlock((() => { throw new Error("đồng bộ"); }) as () => Promise<number>, -1, "đồng bộ");
    check("hàm ném ĐỒNG BỘ cũng được bắt", sync === -1);
    const rej = await safeBlock(() => Promise.reject("chuỗi"), 7, "reject");
    check("Promise bị từ chối bằng giá trị không phải Error → fallback", rej === 7);
    logged.length = 0;
    check("hàm trả được → giá trị, không ghi lỗi", (await safeBlock(async () => 42, 0, "ok")) === 42 && logged.length === 0);
  } finally { console.error = origErr; }
})();

void safeBlockDone.then(() => done());
