// BU-08 mục 4.5 — bài hẹn giờ: chọn bài cần báo (src/lib/articleSchedule.ts). Ca phá cố ý: bỏ điều kiện `<= now` (lte) trong selectArticlesToNotify
// → ca "bài chưa tới giờ" đỏ; bỏ điều kiện cửa sổ 3 ngày → ca "bài quá 3 ngày" đỏ; bỏ lọc `alreadyNoticedLinks` → ca "đã có thông báo" đỏ.
import { SCHEDULE_BATCH, SCHEDULE_WINDOW_DAYS, articleNoticeLink, articleNoticeText, articleNotifiedKey, scheduleWindow, selectArticlesToNotify, type ScheduledCandidate } from "@/lib/articleSchedule";
import { check, section, done } from "./h";

const NOW = new Date("2026-11-02T03:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MIN = 60_000, DAY = 86_400_000;
const art = (id: string, o: Partial<ScheduledCandidate> = {}): ScheduledCandidate => ({ id, slug: `bai-${id}`, title: `Bài ${id}`, published: true, publishedAt: ago(10 * MIN), ...o });
const pick = (a: ScheduledCandidate[], noticed: string[] = []) => selectArticlesToNotify(a, new Set(noticed), NOW).map(x => x.id).join();

section("Cửa sổ");
const w = scheduleWindow(NOW);
check("cửa sổ (now-3 ngày, now]; hằng số 3 ngày", SCHEDULE_WINDOW_DAYS === 3 && w.lte.getTime() === NOW.getTime() && NOW.getTime() - w.gt.getTime() === 3 * DAY);

section("Chọn bài cần báo");
check("bài vừa lên 10 phút trước → chọn", pick([art("a")]) === "a");
check("bài CHƯA tới giờ (publishedAt tương lai) → không chọn", pick([art("a", { publishedAt: new Date(NOW.getTime() + MIN) })]) === "");
check("đúng giây hiện tại (publishedAt = now) → chọn (lte)", pick([art("a", { publishedAt: NOW })]) === "a");
check("bài nháp (published=false) → không chọn dù có publishedAt hợp lệ", pick([art("a", { published: false })]) === "");
check("bài không có publishedAt → không chọn", pick([art("a", { publishedAt: null })]) === "");
check("bài lên quá 3 ngày → không chọn (ngoài cửa sổ); đúng biên 3 ngày cũng không (gt)", pick([art("a", { publishedAt: ago(3 * DAY + MIN) })]) === "" && pick([art("a", { publishedAt: ago(3 * DAY) })]) === "" && pick([art("a", { publishedAt: ago(3 * DAY - MIN) })]) === "a");
check("bài đã có thông báo (bài đăng ngay đã báo lúc lưu, hoặc đã báo rồi) → bỏ", pick([art("a"), art("b")], [articleNoticeLink("bai-a")]) === "b");
check("cũ nhất trước; cùng giờ thì theo id", pick([art("c", { publishedAt: ago(5 * MIN) }), art("a", { publishedAt: ago(30 * MIN) }), art("b", { publishedAt: ago(30 * MIN) })]) === "a,b,c");
check(`tối đa ${SCHEDULE_BATCH} bài một lần`, selectArticlesToNotify(Array.from({ length: 45 }, (_, i) => art(`x${String(i).padStart(2, "0")}`)), new Set(), NOW).length === SCHEDULE_BATCH);
check("danh sách rỗng → rỗng", pick([]) === "");

section("Chữ thông báo và khoá chống gửi đôi");
check("cùng chữ và loại với route lưu bài: 'Bài viết mới' / 'Bài viết mới: \"<tiêu đề>\"' / type article_new", articleNoticeText("Điểm chuẩn 2026").type === "article_new" && articleNoticeText("Điểm chuẩn 2026").title === "Bài viết mới" && articleNoticeText("Điểm chuẩn 2026").message === 'Bài viết mới: "Điểm chuẩn 2026"');
check("liên kết /tin-tuc/<slug>; khoá SettingKV article.notified.<id>", articleNoticeLink("abc") === "/tin-tuc/abc" && articleNotifiedKey("c1") === "article.notified.c1");
done();
