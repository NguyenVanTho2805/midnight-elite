// QT-01/02/03/04 — phần thuần của src/lib/adminOps.ts + GO-08 src/lib/tutorQuota.ts: cờ triển khai (chỉ bật/tắt, không lộ giá trị), lần gọi cron,
// nhật ký (không tên trẻ), danh sách việc hôm nay, bảng vai, thẻ hạn mức (không bịa hạn mức).
import { check, section, done } from "./h";
import {
  AUDIT_PAGE_SIZE, CRON_JOBS, auditActionLabel, auditActor, auditRowView, buildTodayList, cronSecretMissingIsFatal, cronSettingKey, cronView, deployEnv, deployFlags,
  parseAuditFilter, roleSummaries, shortId, whenText, type TodayCounts,
} from "@/lib/adminOps";
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
check("khớp vercel.json: đủ ba tác vụ, khoá cài đặt riêng từng cái", CRON_JOBS.length === 3 && new Set(CRON_JOBS.map(j => cronSettingKey(j.key))).size === 3 && CRON_JOBS.map(j => j.path).sort().join() === "/api/cron/expire-tutor-subscriptions,/api/cron/remind-class,/api/cron/remind-exam");
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
check("cỡ trang cố định", AUDIT_PAGE_SIZE === 50);

section("Hôm nay cần làm gì");
const base: TodayCounts = { tutorsPending: 0, threadReports: 0, profileReports: 0, answerReports: 0, topupsPending: 0, proOrdersPending: 0, supportOpen: 0 };
check("không có gì chờ → danh sách rỗng (không hiện số 0)", buildTodayList(base).length === 0);
const some = buildTodayList({ ...base, tutorsPending: 2, topupsPending: 1, supportOpen: 3 });
check("chỉ giữ việc có số > 0, đúng số, có đường vào", some.map(i => `${i.key}:${i.count}`).join() === "gia-su:2,nap-coin:1,ho-tro:3" && some.every(i => i.href.startsWith("/admin/") && i.label && i.hint));
check("null = không có quyền xem loại đó → không hiện dù sau này có số", buildTodayList({ ...base, tutorsPending: 1, topupsPending: null, proOrdersPending: null, supportOpen: null }).map(i => i.key).join() === "gia-su");
check("báo cáo trả lời dẫn sang trang riêng (có thể trừ thưởng), không xử lý ngay", buildTodayList({ ...base, answerReports: 1 })[0].href === "/admin/cong-dong/bao-cao");

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
