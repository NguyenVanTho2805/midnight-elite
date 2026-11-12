// QT-01/02/03/04 — phần thuần của src/lib/adminOps.ts + GO-08 src/lib/tutorQuota.ts: cờ triển khai (chỉ bật/tắt, không lộ giá trị), lần gọi cron,
// nhật ký (không tên trẻ), danh sách việc hôm nay, bảng vai, thẻ hạn mức (không bịa hạn mức).
import { check, section, done } from "./h";
import { COIN_LOGIC_ON } from "@/lib/features"; // LOI-01: hàng chờ nạp Coin theo LOGIC Coin (hằng COIN_LOGIC_ON), không theo cờ hiển thị
import {
  AUDIT_ACTION_OPTIONS, AUDIT_PAGE_SIZE, CRON_JOBS, actionInGroup, auditActionLabel, auditActor, auditGroupWhere, auditResourceLabel, auditRowView, buildTodayList, cronSecretMissingIsFatal, cronSettingKey, cronView, deployEnv, foldQueueItems, deployFlags,
  groupTodayItems, parseAuditFilter, roleSummaries, shortId, whenText, type AuditGroup, type TodayCounts,
} from "@/lib/adminOps";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { formatBytes, quotaCards } from "@/lib/tutorQuota";
import { quotaState } from "@/lib/planLimits";

const NOW = new Date("2026-10-24T05:00:00Z"); // 12:00 giờ VN thứ Bảy 24/10/2026

section("Cờ triển khai: chỉ bật/tắt, không lộ giá trị");
const flag = (env: Record<string, string | undefined>, k: string) => deployFlags(env).find(f => f.key === k)!;
check("không đặt gì → trial tắt, enforce tắt, push tắt, cron chưa đặt", !flag({}, "KIN_TRIAL_MODE").on && !flag({}, "KIN_PLAN_ENFORCE").on && !flag({}, "PUSH_ENABLED").on && !flag({}, "CRON_SECRET").on);
check("KIN_TRIAL_MODE=1 → bật; 'true' / '0' / rỗng → tắt (cùng luật với isTrialMode)", flag({ KIN_TRIAL_MODE: "1" }, "KIN_TRIAL_MODE").on && !flag({ KIN_TRIAL_MODE: "true" }, "KIN_TRIAL_MODE").on && !flag({ KIN_TRIAL_MODE: "0" }, "KIN_TRIAL_MODE").on && !flag({ KIN_TRIAL_MODE: "" }, "KIN_TRIAL_MODE").on);
check("KIN_PLAN_ENFORCE=1 → bật, nhưng bản xem trước luôn tắt và nói rõ lý do", flag({ KIN_PLAN_ENFORCE: "1" }, "KIN_PLAN_ENFORCE").on && !flag({ KIN_PLAN_ENFORCE: "1", VERCEL_ENV: "preview" }, "KIN_PLAN_ENFORCE").on && /xem trước/.test(flag({ KIN_PLAN_ENFORCE: "1", VERCEL_ENV: "preview" }, "KIN_PLAN_ENFORCE").note));
check("PUSH_ENABLED=1 bật; bản xem trước tắt", flag({ PUSH_ENABLED: "1" }, "PUSH_ENABLED").on && !flag({ PUSH_ENABLED: "1", VERCEL_ENV: "preview" }, "PUSH_ENABLED").on);
const SECRET = "bi-mat-khong-duoc-lo-xyz";
const dump = JSON.stringify(deployFlags({ CRON_SECRET: SECRET, KIN_TRIAL_MODE: "1", VAPID_PRIVATE_KEY: "khoa-rieng-abc", DATABASE_URL: "postgres://u:p@h/d" })) + JSON.stringify(deployEnv({ CRON_SECRET: SECRET }));
check("KHÔNG BAO GIỜ chứa giá trị biến môi trường (CRON_SECRET, VAPID, DATABASE_URL)", !dump.includes(SECRET) && !dump.includes("khoa-rieng") && !dump.includes("postgres://"));
check("CRON_SECRET đã đặt → 'Đã đặt'; chưa → 'Chưa đặt'", flag({ CRON_SECRET: "x" }, "CRON_SECRET").state === "Đã đặt" && flag({}, "CRON_SECRET").state === "Chưa đặt");
check("mỗi cờ có chữ trạng thái + giải thích (màu không nói một mình)", deployFlags({}).every(f => f.state && f.note && f.label));
check("môi trường: production / preview / máy thử đọc đúng", deployEnv({ VERCEL_ENV: "production" }).text === "Production" && /Preview/.test(deployEnv({ VERCEL_ENV: "preview" }).text) && deployEnv({}).label === "Máy thử cục bộ");

section("CRON_SECRET bắt buộc ở bản chạy thật");
check("production (Vercel) thiếu khoá → phải ĐÓNG", cronSecretMissingIsFatal({ VERCEL_ENV: "production" }));
check("NODE_ENV=production ngoài Vercel thiếu khoá → cũng ĐÓNG", cronSecretMissingIsFatal({ NODE_ENV: "production" }));
check("máy thử (không biến nào) → không đóng, để chạy thử", !cronSecretMissingIsFatal({}) && !cronSecretMissingIsFatal({ NODE_ENV: "development" }));
check("cờ CRON_SECRET thiếu ở production nói rõ 'bị từ chối (503)'", /503/.test(flag({ VERCEL_ENV: "production" }, "CRON_SECRET").note));

section("Lần gọi cron gần nhất");
const job = CRON_JOBS[0];
check("đủ tám tác vụ (ADM-003 thêm english-voa, BU-08 thêm article-publish, BU-HS-NOP-TEP thêm het-han-tep-nop-bai, LOI-04 thêm nhac-hoc-sang), khoá cài đặt riêng từng cái", CRON_JOBS.length === 8 && new Set(CRON_JOBS.map(j => cronSettingKey(j.key))).size === 8 && CRON_JOBS.map(j => j.path).sort().join() === "/api/cron/article-publish,/api/cron/english-voa,/api/cron/expire-tutor-subscriptions,/api/cron/het-han-tep-nop-bai,/api/cron/nhac-hoc-sang,/api/cron/pro-renewal-reminders,/api/cron/remind-class,/api/cron/remind-exam");
const ap = CRON_JOBS.find(j => j.key === "article-publish")!;
check("article-publish: đường /api/cron/article-publish, 'Mỗi ngày 07:15 giờ VN', maxGapHours 36 (cron hằng ngày); quá 36 giờ mới 'Chậm', trong 36 giờ 'Đúng lịch'", ap.path === "/api/cron/article-publish" && ap.schedule === "Mỗi ngày 07:15 giờ VN" && ap.maxGapHours === 36 && cronView(ap, new Date(NOW.getTime() - 35 * 3600_000).toISOString(), NOW).status === "Đúng lịch" && cronView(ap, new Date(NOW.getTime() - 37 * 3600_000).toISOString(), NOW).status === "Chậm so với lịch");
check("mọi tác vụ trong CRON_JOBS có tệp route thật dưới src/app/api/cron", CRON_JOBS.every(j => { try { return statSync(join(process.cwd(), "src/app", j.path, "route.ts")).isFile(); } catch { return false; } }), CRON_JOBS.filter(j => { try { return !statSync(join(process.cwd(), "src/app", j.path, "route.ts")).isFile(); } catch { return true; } }).map(j => j.key));
check("chưa có lần nào / giá trị hỏng → 'Chưa ghi nhận' (không đoán)", cronView(job, null, NOW).status === "Chưa ghi nhận" && cronView(job, "rác", NOW).status === "Chưa ghi nhận" && cronView(job, "", NOW).tone === "mo");
check("gọi 5 giờ trước → Đúng lịch, hiện 'hôm nay 07:00'", cronView(job, "2026-10-24T00:00:00Z", NOW).status === "Đúng lịch" && cronView(job, "2026-10-24T00:00:00Z", NOW).lastText === "Gọi gần nhất hôm nay 07:00", cronView(job, "2026-10-24T00:00:00Z", NOW).lastText);
check("gọi 3 ngày trước (quá 36 giờ) → Chậm so với lịch, tone cho", cronView(job, "2026-10-21T00:00:00Z", NOW).status === "Chậm so với lịch" && cronView(job, "2026-10-21T00:00:00Z", NOW).tone === "cho");
check("đúng 36 giờ vẫn Đúng lịch; 36 giờ + 1 phút thì Chậm (biên)", cronView(job, new Date(NOW.getTime() - 36 * 3_600_000).toISOString(), NOW).status === "Đúng lịch" && cronView(job, new Date(NOW.getTime() - 36 * 3_600_000 - 60_000).toISOString(), NOW).status === "Chậm so với lịch");
check("nhãn giờ theo giờ VN: 23:30 UTC ngày 23 = 06:30 hôm nay (24 giờ VN)", whenText(new Date("2026-10-23T23:30:00Z"), NOW) === "hôm nay 06:30" && whenText(new Date("2026-10-23T10:00:00Z"), NOW) === "hôm qua 17:00");

section("Nhật ký: không lộ tên trẻ, không lộ chi tiết");
const adminA = { role: "admin", adminRole: "admin_super", name: "Cô Hà" };
check("nhân sự: vai + tên", auditActor(adminA) === "Quản trị cấp 1 · Cô Hà" && auditActor({ role: "admin", adminRole: "teacher", name: "Thầy Nam" }) === "Gia sư · Thầy Nam");
check("học sinh / phụ huynh: CHỈ vai, KHÔNG tên", auditActor({ role: "student", adminRole: null, name: "Nguyễn Văn Bé" }) === "Học sinh hoặc phụ huynh" && !auditActor({ role: "student", adminRole: null, name: "Nguyễn Văn Bé" }).includes("Bé"));
check("hệ thống tự làm: 'Hệ thống'", auditActor(null) === "Hệ thống");
const row = auditRowView({ id: "r1", action: "student_profile.update", resourceType: "StudentProfile", resourceId: "cmabcdefghijklmnop123456", createdAt: new Date("2026-10-24T03:00:00Z"), actor: { role: "student", adminRole: null, name: "Bé Tên Thật" }, ...({ metadata: { studentName: "Bé Tên Thật", phone: "0901234567", dob: "2015-05-05" } } as object) } as never, NOW);
const rowJson = JSON.stringify(row);
check("dòng nhật ký KHÔNG chứa tên / SĐT / ngày sinh dù đầu vào có metadata", !/Tên Thật|0901234567|2015-05-05|metadata/.test(rowJson), rowJson);
check("mã tài nguyên rút gọn (6 ký tự cuối), không in nguyên mã dài", row.resourceId === "…123456" && shortId("abc") === "abc");
check("nhãn việc tiếng Việt; việc lạ không vỡ", auditActionLabel("user.role_change") === "Đổi vai người dùng" && auditActionLabel("foo_bar.do_it") === "foo bar · do it" && auditActionLabel("x") === "x");
check("mọi nhãn hiển thị đều có chữ tiếng Việt, không lộ khoá kỹ thuật dạng 'a.b' cho việc đã biết", ["user.role_change", "tutor.approve", "coin_topup.approve", "pro_order.activate", "student_profile.consent"].every(a => !/^[a-z_]+\.[a-z_.]+$/.test(auditActionLabel(a))));
const f1 = parseAuditFilter(new URLSearchParams("action=tutor.approve&from=2026-10-01&to=2026-10-24&page=3"));
check("bộ lọc đọc đúng: action, từ, đến, trang", f1.action === "tutor.approve" && f1.from === "2026-10-01" && f1.to === "2026-10-24" && f1.page === 3);
const f2 = parseAuditFilter(new URLSearchParams("action=%27%3B%20drop--&from=2026-13-45&to=abc&page=-4"));
check("giá trị lạ / cố tình phá bị bỏ: action không hợp lệ, ngày sai, trang âm → mặc định", f2.action === null && f2.from === null && f2.to === null && f2.page === 1, f2);
check("trang quá lớn hoặc chữ → 1", parseAuditFilter(new URLSearchParams("page=99999")).page === 1 && parseAuditFilter(new URLSearchParams("page=abc")).page === 1);
// P3 từ rà soát BU-08: ngày không có thật không được lọt (V8 cuộn 31/02 sang 03/03).
const bad = ["2026-02-31", "2026-02-30", "2026-02-29", "2026-04-31", "2026-06-31", "2026-00-10", "2026-13-01", "2026-01-00", "2026-01-32", "2025-02-29", "2100-02-29"];
check("ngày không có thật (31/02, 30/02, 29/02 năm thường, 31/04, tháng 0/13, ngày 0/32) → null", bad.every(d => parseAuditFilter(new URLSearchParams(`from=${d}&to=${d}`)).from === null && parseAuditFilter(new URLSearchParams(`from=${d}&to=${d}`)).to === null), bad.filter(d => parseAuditFilter(new URLSearchParams(`from=${d}`)).from !== null));
const good = ["2026-02-28", "2024-02-29", "2000-02-29", "2026-01-31", "2026-12-31", "2026-04-30"];
check("ngày có thật (28/02, 29/02 năm nhuận kể cả 2000, 31/01, 31/12, 30/04) → giữ nguyên", good.every(d => parseAuditFilter(new URLSearchParams(`from=${d}&to=${d}`)).from === d && parseAuditFilter(new URLSearchParams(`from=${d}&to=${d}`)).to === d), good.filter(d => parseAuditFilter(new URLSearchParams(`from=${d}`)).from !== d));
check("cỡ trang cố định", AUDIT_PAGE_SIZE === 50);

section("Hôm nay cần làm gì");
const base: TodayCounts = { tutorsPending: 0, threadReports: 0, profileReports: 0, answerReports: 0, topupsPending: 0, proOrdersPending: 0, supportOpen: 0 };
check("không có gì chờ → danh sách rỗng (không hiện số 0)", buildTodayList(base).length === 0);
const some = buildTodayList({ ...base, tutorsPending: 2, topupsPending: 1, supportOpen: 3 });
// Coin ẩn: nạp Coin không vào mục Hôm nay dù có yêu cầu đang chờ.
check("chỉ giữ việc có số > 0, đúng số, có đường vào", some.map(i => `${i.key}:${i.count}`).join() === (COIN_LOGIC_ON ? "gia-su:2,nap-coin:1,ho-tro:3" : "gia-su:2,ho-tro:3") && some.every(i => i.href.startsWith("/admin/") && i.label && i.hint));
check("null = không có quyền xem loại đó → không hiện dù sau này có số", buildTodayList({ ...base, tutorsPending: 1, topupsPending: null, proOrdersPending: null, supportOpen: null }).map(i => i.key).join() === "gia-su");
check("mọi loại hàng chờ dẫn tới /admin/kiem-duyet?loai=<loại>; không còn trỏ /admin/cong-dong/bao-cao hay /admin/topups", (() => {
  const l = buildTodayList({ ...base, tutorsPending: 1, threadReports: 1, profileReports: 1, answerReports: 1, topupsPending: 1, reviewsPending: 1, guestQuestions: 1, joinSlowCourses: 1 });
  return l.filter(i => i.group === "duyet" && !["goi-pro", "ho-tro"].includes(i.key)).every(i => i.href === `/admin/kiem-duyet?loai=${i.key}`) && !l.some(i => i.href === "/admin/cong-dong/bao-cao" || i.href === "/admin/topups") && l.find(i => i.key === "vao-lop-cham")!.href === "/admin/kiem-duyet?loai=vao-lop";
})());

section("Hôm nay: nhóm duyet · theo-doi · he-thong (BU-08)");
const full = buildTodayList({ ...base, tutorsPending: 2, reviewsPending: 5, topupsPending: 1, guestQuestions: 3, joinSlowCourses: 2, scheduledArticles: 4, cronSlow: 1 });
check("đủ nhóm: duyet (gia-su, danh-gia, khach-hoi, nap-coin khi cờ Coin bật), theo-doi (vao-lop-cham, bai-hen-gio), he-thong (cron-cham)", full.map(i => `${i.group}:${i.key}`).join() === (COIN_LOGIC_ON ? "duyet:gia-su,duyet:danh-gia,duyet:khach-hoi,duyet:nap-coin," : "duyet:gia-su,duyet:danh-gia,duyet:khach-hoi,") + "theo-doi:vao-lop-cham,theo-doi:bai-hen-gio,he-thong:cron-cham", full.map(i => `${i.group}:${i.key}`));
check("loại không đủ quyền (null / vắng) KHÔNG hiện dù đếm được: reviewsPending vắng + guestQuestions null + cronSlow null", buildTodayList({ ...base, tutorsPending: 1, guestQuestions: null, cronSlow: null, joinSlowCourses: null, scheduledArticles: null }).map(i => i.key).join() === "gia-su");
check("số 0 không hiện ở bất kỳ nhóm nào", buildTodayList({ ...base, reviewsPending: 0, guestQuestions: 0, joinSlowCourses: 0, scheduledArticles: 0, cronSlow: 0 }).length === 0);
const groups = groupTodayItems(full);
check("groupTodayItems: 3 nhóm, thứ tự duyet → theo-doi → he-thong, mỗi nhóm có nhãn tiếng Việt", groups.map(g => g.key).join() === "duyet,theo-doi,he-thong" && groups.map(g => g.label).join() === "Việc chờ,Theo dõi,Hệ thống" && groups[0].items.length === (COIN_LOGIC_ON ? 4 : 3));
check("nhóm rỗng bị bỏ: chỉ có việc duyet → 1 nhóm", groupTodayItems(buildTodayList({ ...base, tutorsPending: 1 })).length === 1 && groupTodayItems([]).length === 0);
section("Hôm nay: gộp việc duyệt thành một dòng tổng → Hàng chờ (điều hướng B1/B4)");
const mixed = buildTodayList({ ...base, tutorsPending: 2, threadReports: 1, reviewsPending: 5, proOrdersPending: 3, supportOpen: 4, joinSlowCourses: 2, cronSlow: 1 });
const folded = foldQueueItems(mixed);
const hc = folded.filter(i => i.key === "hang-cho");
check("gộp: đúng MỘT dòng hang-cho, đếm = tổng các loại trong Hàng chờ (2+1+5), dẫn tới /admin/kiem-duyet (không ?loai=)", hc.length === 1 && hc[0].count === 8 && hc[0].href === "/admin/kiem-duyet" && hc[0].group === "duyet", hc);
check("gộp: không còn dòng duyệt nào dẫn ?loai= (gia-su, bai-viet, danh-gia biến mất)", folded.every(i => !(i.group === "duyet" && i.href.includes("?loai="))));
check("Gói Pro và Hỗ trợ gia sư giữ dòng riêng tới trang của chúng (không qua Hàng chờ) và vẫn đếm vào tổng", folded.some(i => i.key === "goi-pro" && i.href === "/admin/goi-pro" && i.count === 3) && folded.some(i => i.key === "ho-tro" && i.href === "/admin/ho-tro" && i.count === 4) && folded.reduce((s, i) => s + i.count, 0) === mixed.reduce((s, i) => s + i.count, 0));
check("gộp không đổi tổng; nhóm theo-doi / he-thong giữ nguyên", folded.some(i => i.key === "vao-lop-cham") && folded.some(i => i.key === "cron-cham"));
check("mô tả dòng tổng chỉ có số theo loại, không tên người / tiền", /2 hồ sơ gia sư/.test(hc[0].hint) && /5 đánh giá/.test(hc[0].hint) && !/đ\b|@/.test(hc[0].hint), hc[0].hint);
check("không có việc duyệt trong Hàng chờ → không thêm dòng tổng; Pro/hỗ trợ đứng một mình", foldQueueItems(buildTodayList({ ...base, proOrdersPending: 1 })).map(i => i.key).join() === "goi-pro");
check("KHÔNG có trường tiền tổng nào trong mục Hôm nay (chỉ số lượng)", !/amount|total|tong|vnd|coin\b/i.test(Object.keys(full[0]).join()) && full.every(i => Number.isInteger(i.count)));

section("Nhật ký: nhóm lọc `nhom` (BU-08)");
const fn = parseAuditFilter(new URLSearchParams("nhom=duyet&action=tutor.approve"));
check("`nhom` hợp lệ được đọc; kết hợp được với action", fn.nhom === "duyet" && fn.action === "tutor.approve");
check("`nhom` lạ / chuỗi tự do / rỗng bị bỏ (client không gửi được tiền tố tuỳ ý)", ["tuy-y", "tutor.", "' OR 1=1", "", "DUYET"].every(v => parseAuditFilter(new URLSearchParams({ nhom: v })).nhom === null) && parseAuditFilter(new URLSearchParams("")).nhom === null);
const G = (a: string) => (["duyet", "tien", "nguoi", "noi-dung", "he-thong"] as AuditGroup[]).filter(g => actionInGroup(a, g)).join();
check("ánh xạ tiền tố đúng bảng đặc tả", G("tutor.approve") === "duyet" && G("thread_report.reject") === "duyet" && G("answer_report.approve") === "duyet" && G("review.delete") === "duyet" && G("profile_report.lock") === "duyet" && G("community.guest_question.approve") === "duyet"
  && G("coin_topup.approve") === "tien" && G("pro_order.activate") === "tien" && G("invoice.issue") === "tien" && G("bank_tx.resolve") === "tien" && G("payout_account.update") === "tien"
  && G("user.role_change") === "nguoi" && G("student_profile.update") === "nguoi" && G("parent_link.verify") === "nguoi" && G("self_consent.grant") === "nguoi" && G("enrollment.create") === "nguoi"
  && G("article.scheduled_notify") === "noi-dung,he-thong" && G("course.update") === "noi-dung" && G("admission_score.update") === "noi-dung" && G("tutor_subscription.expire") === "he-thong");
check("`tutor_subscription.expire` KHÔNG lọt nhóm duyet (tiền tố tutor. có dấu chấm)", !actionInGroup("tutor_subscription.expire", "duyet"));
check("auditGroupWhere dựng OR các tiền tố từ chính bảng (một nguồn)", auditGroupWhere("duyet").OR.length === 6 && JSON.stringify(auditGroupWhere("he-thong").OR).includes('"contains":".scheduled_"'));

section("Nhật ký: nhãn cho mã BU-08 (quét nguồn)");
const BU08 = ["thread_report.approve", "thread_report.reject", "answer_report.approve", "answer_report.reject", "review.approve", "review.reject", "review.delete", "community.guest_question.approve", "community.guest_question.reject", "article.scheduled_notify"];
check("mọi mã hành động BU-08 có nhãn tiếng Việt (không rơi về dạng 'a b · c d')", BU08.every(a => !/ · /.test(auditActionLabel(a)) && AUDIT_ACTION_OPTIONS.some(o => o.value === a)), BU08.filter(a => / · /.test(auditActionLabel(a))));
check("nhãn đúng chữ đặc tả", auditActionLabel("thread_report.approve") === "Gỡ bài viết bị báo cáo" && auditActionLabel("review.delete") === "Xoá đánh giá khoá học" && auditActionLabel("article.scheduled_notify") === "Báo bài hẹn giờ đã lên");
check("nhãn tài nguyên: ThreadReport · AnswerReport · CourseReview · thread · Article", auditResourceLabel("ThreadReport") === "Báo cáo bài viết" && auditResourceLabel("AnswerReport") === "Báo cáo câu trả lời" && auditResourceLabel("CourseReview") === "Đánh giá khoá học" && auditResourceLabel("thread") === "Bài cộng đồng" && auditResourceLabel("Article") === "Bài viết");
// Quét nguồn: mọi `logAction(..., "<mã>", ...)` trong src/app/api/admin và src/app/api/cron mà là mã BU-08 thì phải có nhãn (chống thêm mã mới mà quên nhãn).
const codes = new Set<string>();
const scan = (dir: string) => { for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) scan(p); else if (n === "route.ts") for (const m of readFileSync(p, "utf8").matchAll(/logAction\([^,]+,\s*(?:decision === "approved" \? "([a-z_.]+)" : "([a-z_.]+)"|status === "approved" \? "([a-z_.]+)" : "([a-z_.]+)"|"([a-z_.]+)")/g)) m.slice(1).filter(Boolean).forEach(c => codes.add(c!)); } };
scan(join(process.cwd(), "src/app/api/admin")); scan(join(process.cwd(), "src/lib"));
const unlabeled = [...codes].filter(c => /^(thread_report|answer_report|review|community|article)\./.test(c) && / · /.test(auditActionLabel(c)));
check(`quét ${codes.size} mã logAction trong api/admin + lib: mã thuộc BU-08 đều có nhãn`, codes.size > 5 && unlabeled.length === 0, unlabeled);

section("Cờ KIN_GUEST_QUESTIONS (BU-05 / BU-08): chỉ hiển thị");
const gq = (env: Record<string, string | undefined>) => deployFlags(env).find(f => f.key === "KIN_GUEST_QUESTIONS")!;
check("có trong danh sách cờ; mặc định tắt; =1 bật; 'true' vẫn tắt", !!gq({}) && !gq({}).on && gq({ KIN_GUEST_QUESTIONS: "1" }).on && !gq({ KIN_GUEST_QUESTIONS: "true" }).on && gq({}).label === "Cho khách đặt câu hỏi" && /hàng chờ có người xử lý/.test(gq({}).note));

section("Bảng vai (một nguồn: permissions.ts)");
const roles = roleSummaries();
check("đủ ba vai, mỗi vai có mô tả và danh sách quyền", roles.length === 3 && roles.every(r => r.who && r.can.length > 0));
check("số quyền hiển thị = số quyền thật trong ROLE_PERMISSIONS", roles.every(r => r.can.length === ROLE_PERMISSIONS[r.role].length));
check("gia sư KHÔNG có quyền tiền / đổi vai / kiểm duyệt trong bảng", !roles.find(r => r.role === "teacher")!.can.some(c => /Đổi vai|gói, nạp Coin|Kiểm duyệt|Duyệt hồ sơ/.test(c)));
check("chỉ cấp 1 có 'Đổi vai và xem nhật ký'", roles.filter(r => r.can.includes("Đổi vai và xem nhật ký")).map(r => r.role).join() === "admin_super");

section("GO-08 · Thẻ hạn mức không bịa");
const cards = quotaCards({ students: quotaState(8, 10), planName: "Free", enforced: false, storageBytes: 33_554_432, storageFiles: 4 });
check("đủ 4 thẻ: học sinh, mẫu phiếu, dung lượng, Drive", cards.map(c => c.key).join() === "hoc-sinh,mau-phieu,dung-luong,drive");
check("học sinh: 8 / 10, 80% → 'Gần đến hạn mức' (tone cho), có thanh", cards[0].value === "8 / 10" && cards[0].pct === 80 && cards[0].tone === "cho" && cards[0].stateText === "Gần đến hạn mức");
check("cổng tắt → nói 'chỉ đo, không chặn'; cổng bật → nói 'chỉ chưa nhận thêm'", /chỉ đo, không chặn/.test(cards[0].hint) && /chưa nhận thêm/.test(quotaCards({ students: quotaState(8, 10), planName: "Free", enforced: true, storageBytes: 0, storageFiles: 0 })[0].hint));
check("mẫu phiếu / dung lượng / Drive: KHÔNG có thanh phần trăm (không có hạn mức để chia)", cards.slice(1).every(c => c.pct === null) && cards.slice(1).every(c => /Chưa có/.test(c.stateText)));
check("dung lượng đọc đúng: 32 MB; Drive 'Chưa kết nối'", cards[2].value === "32 MB" && cards[3].value === "Chưa kết nối");
check("vượt trần: thanh không quá 100% dù dùng 15/10", quotaCards({ students: quotaState(15, 10), planName: "Free", enforced: false, storageBytes: 0, storageFiles: 0 })[0].pct === 100);
check("formatBytes: 0, âm, rác → '0 B'; 1536 → '1,5 KB'; 5 GB → '5 GB'", formatBytes(0) === "0 B" && formatBytes(-5) === "0 B" && formatBytes(NaN) === "0 B" && formatBytes(1536) === "1,5 KB" && formatBytes(5 * 1024 ** 3) === "5 GB", formatBytes(5 * 1024 ** 3));

done();
