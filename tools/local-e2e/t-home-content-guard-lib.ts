// HOME-02 (thuần, không DB / mạng): luật của src/lib/homeContentGuard.ts — cụm cấm, đếm ký tự, số ô/thẻ, diff chỉ-tên-trường — cộng cổng validate của HOME-01.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_HOME_CONTENT as DEF, HOME_LIMITS, validateHomeContent, type HomeContent } from "@/lib/siteContent";
import { CLAIM_BLOCKLIST, checkClaims, checkHomeClaims, checkHomeCounts, checkHomeHiddenLinks, countChars, diffHomeContent, hiddenHrefWarning, hrefFields, hrefNeedsManualCheck, limitFor, textFields } from "@/lib/homeContentGuard";
import { FEATURES, type FeatureEnv } from "@/lib/features";
import { check, section, done } from "./h";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const good = (): HomeContent => clone(DEF);
const issuePaths = (raw: unknown) => { const r = validateHomeContent(raw); return r.ok ? [] : r.issues.map(i => i.path); };

section("1. Nội dung mặc định sạch");
check("mặc định không dính cụm cấm nào", checkHomeClaims(DEF).length === 0, checkHomeClaims(DEF));

section("2. Cụm cấm (có ca phá cố ý)");
const MUST = ["Trợ giảng riêng 1-1", "Buổi học live mỗi tối", "Theo dõi tiến độ realtime", "trợ giảng phản hồi trong ngày", "Hỗ trợ 24/7", "1.200+ học sinh", "Hoàn tiền 100%", "cam kết 100%", "hàng đầu Việt Nam", "Học trọn đời", "AI hỗ trợ giải bài", "thanh toán qua VNPay"];
check("[phá cố ý] bắt đủ các câu mẫu", MUST.every(t => checkClaims(t) !== null), MUST.filter(t => !checkClaims(t)));
check("[không bắt nhầm] 'Trợ giảng, nhiều giáo viên', 'gpa, streak, rank', 'Học ở đây thì được gì?'", ["Trợ giảng, nhiều giáo viên", "gpa, streak, rank", "Học ở đây thì được gì?", "Tốt nghiệp THPT", "8 môn thi quốc gia"].every(t => checkClaims(t) === null));
check("[phá cố ý] viết lách: chữ hoa, dấu tách rời (NFD), ký tự rộng bằng 0 chen giữa, nhiều khoảng trắng vẫn bị bắt",
  checkClaims("LIVE MỖI TỐI") !== null && checkClaims("live mỗi tối".normalize("NFD")) !== null && checkClaims("li​ve mỗi tối") !== null && checkClaims("live    mỗi \n tối") !== null);
const EVADE = ["Truong hang dau", "Hoan tien 100 phan tram", "Giảm １００％", "Top 1 Việt Nam", "Đảm bảo đầu ra", "Hỗ trợ 24h/7", "Hỗ trợ 24 / 7", "Dam bao dau ra", "TOP 1 Viet Nam", "Hoàn tiền 100 phần trăm", "Tot nhat Viet Nam"];
check("[phá cố ý] bản NFKC + không dấu: các cách lách đều bị bắt", EVADE.every(t => checkClaims(t) !== null), EVADE.filter(t => !checkClaims(t)));
check("[không bắt nhầm] chữ trang chủ hiện có không dính bản không dấu", ["Tốt nghiệp THPT", "Học thử trước khi đăng ký", "Chọn gia sư phù hợp", "Kỳ thi đánh giá năng lực"].every(t => checkClaims(t) === null));
check("lỗi nêu cụm đã khớp và lý do", (() => { const h = checkClaims("Học live mỗi tối nhé"); return !!h && /live mỗi tối/i.test(h.match) && /live/.test(h.reason); })());
{
  const c = good(); c.why.cards[1].desc = "Buổi học live mỗi tối cùng gia sư";
  const iss = checkHomeClaims(c);
  check("quét theo trường: báo đúng đường dẫn why.cards[1].desc", iss.length === 1 && iss[0].path === "why.cards[1].desc" && /live mỗi tối/.test(iss[0].message), iss);
}
// Bài khoá: danh sách cụm cấm phải bao trùm mọi dòng của t-no-fabricated.ts (hai danh sách không được lệch nhau).
{
  const src = readFileSync(join(process.cwd(), "tools/local-e2e/t-no-fabricated.ts"), "utf8");
  const block = src.slice(src.indexOf("const BANNED"), src.indexOf("for (const [re, why, allow] of BANNED)"));
  const samples: string[] = [
    "Combo 8 môn chỉ 99k", "tiết kiệm 57%", "Hoàn tiền 100%", "hàng đầu Việt Nam", "Học trọn đời", "Mua 1 lần, xem không giới hạn", "AI giải bài 24/7", "hỏi AI 24/7", "Ngoài giờ có AI", "VNPay", "1.200+", "10.000+",
    "Trợ giảng riêng 1-1", "phân công trợ giảng", "trợ giảng người thật", "live mỗi tối", "Học trực tiếp LIVE", "video quay sẵn", "realtime", "thời gian thực", "phản hồi trong ngày", "trả lời trong ngày", "24/7", "thứ hạng toàn hệ thống", "GPA, streak và",
  ];
  // các dòng của t-no-fabricated nhắm vào thứ khác (email, gậy, thiết bị…) không phải chữ trang chủ nên không đòi bao trùm
  const homeRelevant = ["Combo 8 môn", "tiết kiệm 57%", "Hoàn tiền 100%", "hàng đầu Việt Nam", "Học trọn đời", "AI hỗ trợ giải bài", "VNPay", "1\\.200", "trợ giảng", "live mỗi tối", "realtime", "trong ngày", "24\\/7", "thứ hạng toàn hệ thống"];
  check("bài khoá: t-no-fabricated vẫn có các dòng trang chủ mà bài này giả định", homeRelevant.every(k => block.includes(k)), homeRelevant.filter(k => !block.includes(k)));
  check("bài khoá: CLAIM_BLOCKLIST bao trùm mọi câu mẫu của các dòng đó", samples.every(t => checkClaims(t) !== null), samples.filter(t => checkClaims(t) === null));
  check("danh sách cụm cấm có ≥ 15 mục, mỗi mục có lý do", CLAIM_BLOCKLIST.length >= 15 && CLAIM_BLOCKLIST.every(c => c.reason.length > 5));
}

section("3. Đếm ký tự theo Unicode");
check("giới hạn từng dòng của tiêu đề: 60 đạt, 61 trượt", (() => {
  const c = good(); c.title = "a".repeat(HOME_LIMITS.titleLine); const ok = validateHomeContent(c).ok;
  c.title = "a".repeat(HOME_LIMITS.titleLine + 1); return ok && !validateHomeContent(c).ok;
})());
check("chữ có dấu đếm theo ký tự, không theo byte; khoảng trắng đầu/cuối không tính", countChars("  Đề thi thử  ") === 10 && countChars("ĐGNL") === 4 && countChars("😀a") === 2);
check(`h1: hai dòng đạt, vượt ${HOME_LIMITS.titleLines} dòng trượt ở title`, (() => {
  const a = good(); a.title = "Dòng một\nDòng hai"; const b = good(); b.title = Array.from({ length: HOME_LIMITS.titleLines + 1 }, (_, i) => "Dòng " + i).join("\n");
  return validateHomeContent(a).ok && issuePaths(b).includes("title");
})());
check("limitFor khớp HOME_LIMITS cho mọi trường chữ của mặc định", textFields(DEF).every(f => limitFor(f.path) !== null), textFields(DEF).filter(f => limitFor(f.path) === null).map(f => f.path));
check("limitFor: icon / href / lạ → null", limitFor("why.cards[0].icon") === null && limitFor("cta.primary.href") === null && limitFor("xyz") === null);

section("4. Số ô kỳ thi / thẻ và cấu trúc (có ca phá cố ý)");
{
  const mk = (f: (c: HomeContent) => void) => { const c = good(); f(c); return c; };
  check("[phá cố ý] 0 ô kỳ thi → báo 'exams'", checkHomeCounts(mk(c => { c.exams = []; })).some(i => i.path === "exams"));
  check("[phá cố ý] 7 ô → báo 'exams'", checkHomeCounts(mk(c => { c.exams = Array.from({ length: 7 }, () => clone(c.exams[0])); })).some(i => i.path === "exams"));
  check("[phá cố ý] 0 thẻ và 7 thẻ → báo 'why.cards'", checkHomeCounts(mk(c => { c.why.cards = []; })).some(i => i.path === "why.cards") && checkHomeCounts(mk(c => { c.why.cards = Array.from({ length: 7 }, () => clone(c.why.cards[0])); })).some(i => i.path === "why.cards"));
  check("4 ô và 4 thẻ → không lỗi", checkHomeCounts(good()).length === 0);
  check("[phá cố ý] icon '../../etc' → báo why.cards[0].icon", issuePaths(mk(c => { (c.why.cards[0] as { icon: string }).icon = "../../etc"; })).includes("why.cards[0].icon"));
  check("[phá cố ý] href 'javascript:alert(1)' ở nút gia sư → báo findTutor.buttonHref", issuePaths(mk(c => { c.findTutor.buttonHref = "javascript:alert(1)"; })).includes("findTutor.buttonHref"));
  check("[phá cố ý] null / mảng / số / chuỗi thay vì object → lỗi, không ném", [null, [], 5, "x"].every(v => { try { return !validateHomeContent(v).ok; } catch { return false; } }));
  check("[phá cố ý] ký tự điều khiển \\u0000 trong mô tả → từ chối", issuePaths(mk(c => { c.lead = "Chào\u0000bạn"; })).includes("lead"));
  check("chữ có thẻ HTML vẫn là CHỮ (không lọc, React tự thoát): lưu được, không có đường tới dangerouslySetInnerHTML",
    validateHomeContent(mk(c => { c.title = "<script>alert(1)</script>"; })).ok && !/dangerouslySetInnerHTML/.test(readFileSync(join(process.cwd(), "src/components/guest/HomeSections.tsx"), "utf8")));
}

section("5. diffHomeContent: chỉ tên trường");
{
  const a = good();
  check("hai bản bằng nhau → []", diffHomeContent(a, good()).length === 0);
  const b = good(); b.title = "Tiêu đề mới";
  check("đổi một trường → đúng một đường dẫn, không chứa chữ mới", (() => { const d = diffHomeContent(a, b); return d.length === 1 && d[0] === "title" && !JSON.stringify(d).includes("Tiêu đề mới"); })());
  const c = good(); [c.why.cards[0], c.why.cards[1]] = [c.why.cards[1], c.why.cards[0]];
  const d = diffHomeContent(a, c);
  check("đổi thứ tự thẻ 0 và 1 → liệt kê trường của đúng hai chỉ số đó", d.length > 0 && d.every(p => /^why\.cards\[[01]\]\./.test(p)), d);
  const e = good(); e.why.cards.pop();
  check("bớt một thẻ → báo trường của thẻ bị bớt", diffHomeContent(a, e).every(p => p.startsWith("why.cards[3]")) && diffHomeContent(a, e).length > 0);
  check("đổi nút CTA → cta.primary.href", (() => { const f = good(); f.cta.primary.href = "/dang-nhap"; return diffHomeContent(a, f).join() === "cta.primary.href"; })());
}

section("6. Đường dẫn cần mở thử");
check("gợi ý sẵn không nhắc; đường lạ nhắc; https không nhắc", !hrefNeedsManualCheck("/khoa-hoc") && !hrefNeedsManualCheck("/dang-ky?vai=gia-su") && hrefNeedsManualCheck("/trang-la") && !hrefNeedsManualCheck("https://zalo.me/g/abc"));

section("7. LOI-07: liên kết tự nhập trỏ vào phần đang tạm đóng → CẢNH BÁO, không chặn lưu");
// Ca phá cố ý (đã chạy, rồi hoàn lại): hiddenHrefWarning bỏ `ownPath` → ca "địa chỉ tuyệt đối về KiN" đỏ; luôn trả null → 3 ca đầu đỏ;
// checkHomeHiddenLinks bỏ cta.secondary khỏi hrefFields → ca "đủ 4 loại ô" đỏ.
{
  const OFF: FeatureEnv = {}, ALL: FeatureEnv = Object.fromEntries(FEATURES.map(k => [k, "1"])) as FeatureEnv;
  const HID = ["/tin-tuc", "/tin-tuc/bai-1?x=1", "/cong-dong", "/giang-vien", "/diem-chuan#a", "/bang-xep-hang"];
  check("đường vào phần ẩn ⇒ có câu cảnh báo (giọng KiN, nói 'vẫn lưu được', không tên phần)", HID.every(h => { const w = hiddenHrefWarning(h, OFF); return !!w && /tạm đóng/.test(w) && /Vẫn lưu được/.test(w) && !/TIN_TUC|CONG_DONG|Tin tức|Cộng đồng/.test(w); }), HID.map(h => hiddenHrefWarning(h, OFF)));
  check("địa chỉ tuyệt đối về chính KiN cũng bị nhắc (có/không www)", !!hiddenHrefWarning("https://midnightelite-edu.com/tin-tuc", OFF) && !!hiddenHrefWarning("https://www.midnightelite-edu.com/cong-dong?tab=1", OFF));
  check("đường đang mở / địa chỉ ngoài / rỗng ⇒ null", ["/khoa-hoc", "/thi-thu", "/dang-ky", "/cong-dong/t1", "https://zalo.me/g/abc", "https://midnightelite-edu.com.evil.vn/tin-tuc", "", "   "].every(h => hiddenHrefWarning(h, OFF) === null));
  check("bật đủ 9 cờ ⇒ không nhắc nữa", HID.every(h => hiddenHrefWarning(h, ALL) === null));
  const c = good();
  c.exams[0].href = "/tin-tuc"; c.findTutor.buttonHref = "/giang-vien"; c.cta.primary.href = "/dang-ky"; c.cta.secondary.href = "/cong-dong";
  const w = checkHomeHiddenLinks(c, OFF).map(i => i.path);
  check("đủ 4 loại ô đường dẫn (ô kỳ thi, nút Tìm gia sư, 2 nút CTA) được quét; chỉ ô trỏ vào phần ẩn bị nhắc", hrefFields(c).length === c.exams.length + 3 && w.join() === "exams[0].href,findTutor.buttonHref,cta.secondary.href", w);
  check("KHÔNG chặn lưu: nội dung có liên kết vào phần ẩn vẫn qua validateHomeContent + checkHomeClaims", validateHomeContent(c).ok && checkHomeClaims(c).length === 0, issuePaths(c));
}

done();
