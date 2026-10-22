// NC2-011 — tin 07:00 "Hôm qua có N buổi chưa điểm danh": quy tắc THUẦN (src/lib/unmarkedDaily.ts) + quét tĩnh cron/notify. Không cần DB hay máy chủ.
// Chạy: DATABASE_URL=postgresql://x:x@localhost/x npx tsx tools/local-e2e/t-unmarked-daily-lib.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { countUnmarkedOn, pickTutorsToRemind, unmarkedDailyMessage, vnDayStart, yesterdayKeyVn } from "@/lib/unmarkedDaily";
import { findUnmarkedSessions, type UnmarkedOccurrence, type UnmarkedStudent } from "@/lib/unmarkedSessions";
import { check, section, done } from "./h";

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

(async () => {
  section("Tính 'hôm qua' theo NGÀY VIỆT NAM");
  check("07:00 VN 22/10 (= 00:00 UTC 22/10) → hôm qua là 21/10", yesterdayKeyVn(new Date("2026-10-22T00:00:00Z")) === "2026-10-21");
  check("00:30 VN 22/10 (= 17:30 UTC 21/10) → vẫn lấy ngày VN: hôm qua là 21/10, KHÔNG phải 20/10", yesterdayKeyVn(new Date("2026-10-21T17:30:00Z")) === "2026-10-21");
  check("23:59 VN 21/10 (= 16:59 UTC 21/10) → hôm qua là 20/10", yesterdayKeyVn(new Date("2026-10-21T16:59:00Z")) === "2026-10-20");
  check("qua tháng / qua năm: 01/01/2027 VN → 31/12/2026; 01/03/2028 → 29/02/2028 (năm nhuận)", yesterdayKeyVn(new Date("2026-12-31T17:00:00Z")) === "2026-12-31" && yesterdayKeyVn(new Date("2028-03-01T00:00:00Z")) === "2028-02-29");
  check("mốc đầu ngày VN = 17:00 UTC hôm trước", vnDayStart(new Date("2026-10-22T00:00:00Z")).toISOString() === "2026-10-21T17:00:00.000Z" && vnDayStart(new Date("2026-10-21T17:00:00Z")).toISOString() === "2026-10-21T17:00:00.000Z" && vnDayStart(new Date("2026-10-21T16:59:59Z")).toISOString() === "2026-10-20T17:00:00.000Z");

  section("Đếm buổi của đúng ngày hôm qua");
  const S = (dateKey: string) => ({ dateKey });
  check("chỉ đếm buổi có dateKey = hôm qua; buổi cũ hơn (hôm kia, tuần trước) không tính", countUnmarkedOn([S("2026-10-21"), S("2026-10-21"), S("2026-10-20"), S("2026-10-14")], "2026-10-21") === 2);
  check("không có buổi nào của hôm qua → 0", countUnmarkedOn([S("2026-10-20")], "2026-10-21") === 0 && countUnmarkedOn([], "2026-10-21") === 0);

  section("Chọn gia sư cần báo");
  check("chỉ ai có N ≥ 1; N = 0, âm, thập phân, NaN bị bỏ; thứ tự ổn định theo id", eq(pickTutorsToRemind([["b", 2], ["a", 0], ["c", -1], ["d", 1.5], ["e", NaN], ["f", 1]]), [{ tutorId: "b", count: 2 }, { tutorId: "f", count: 1 }]));
  check("không có ai → danh sách rỗng", pickTutorsToRemind([]).length === 0);
  check("cùng một gia sư lặp hai lần → chỉ một mục (không báo đôi)", pickTutorsToRemind([["a", 1], ["a", 3]]).length === 1);
  check("chữ trong ứng dụng có đúng một số là N, không tên", eq(unmarkedDailyMessage(2).match(/\d+/g), ["2"]) && eq(unmarkedDailyMessage(14).match(/\d+/g), ["14"]));

  section("Nối với bộ đếm ĐX-01: buổi huỷ / dời / đủ điểm danh không tính");
  const NOW = new Date("2026-10-22T00:00:00Z"); // 07:00 VN 22/10
  const occ = (o: Partial<UnmarkedOccurrence>): UnmarkedOccurrence => ({
    scheduleId: "s1", courseId: "c1", courseName: "Toán 9", courseOpen: true, dateKey: "2026-10-21", originalDateKey: "2026-10-21",
    startAt: new Date("2026-10-21T12:00:00Z"), endAt: new Date("2026-10-21T14:00:00Z"), status: "scheduled", ruleCreatedAt: new Date("2026-09-01T00:00:00Z"), ...o,
  });
  const stu: UnmarkedStudent[] = [{ id: "a", name: "An", enrolledAt: new Date("2026-09-05") }];
  const roster = new Map([["c1", stu], ["c2", stu]]);
  const yday = yesterdayKeyVn(NOW);
  const run = (occurrences: UnmarkedOccurrence[], recorded = new Set<string>()) => countUnmarkedOn(findUnmarkedSessions({ now: NOW, occurrences, studentsByCourse: roster, recorded, handled: new Set() }), yday);
  const older = occ({ dateKey: "2026-10-20", originalDateKey: "2026-10-20", startAt: new Date("2026-10-20T12:00:00Z"), endAt: new Date("2026-10-20T14:00:00Z") });
  check("2 buổi hôm qua (2 lớp) chưa điểm danh + 1 buổi hôm kia → N = 2", run([occ({}), occ({ scheduleId: "s2", courseId: "c2" }), older]) === 2);
  check("buổi hôm qua đã huỷ → không tính", run([occ({ status: "cancelled" })]) === 0);
  check("buổi hôm qua đã điểm danh đủ → không tính", run([occ({})], new Set(["c1|2026-10-21|a"])) === 0);
  check("buổi gốc hôm qua nhưng DỜI sang hôm kia → tính theo ngày hiệu lực nên không thuộc 'hôm qua'", run([occ({ status: "moved", dateKey: "2026-10-20", startAt: new Date("2026-10-20T12:00:00Z"), endAt: new Date("2026-10-20T14:00:00Z") })]) === 0);

  section("Quét tĩnh: cron + notify");
  const cron = src("src/app/api/cron/remind-class/route.ts");
  const iEarly = cron.indexOf("if (todays.length === 0)"), iEarlyRet = cron.indexOf("return NextResponse.json({ sent: 0", iEarly), iEarlyCall = cron.indexOf("await runUnmarked()", iEarly);
  check("cron gọi runUnmarked() Ở nhánh thoát sớm 'todays.length === 0', TRƯỚC lệnh return (ngày mai không có buổi vẫn báo tin hôm qua)", iEarly > 0 && iEarlyCall > iEarly && iEarlyCall < iEarlyRet);
  const iLoop = cron.indexOf("for (const sched of"), iFinalCall = cron.lastIndexOf("await runUnmarked()"), iFinalRet = cron.lastIndexOf("return NextResponse.json({");
  check("cron: tin hôm qua chạy SAU vòng nhắc học viên (nhắc lịch học viên đi trước), rồi mới trả kết quả", iLoop > 0 && iFinalCall > iLoop && iFinalCall < iFinalRet && iFinalCall !== iEarlyCall);
  check("cron: cả hai nhánh trả JSON đều có trường `unmarked`, trường cũ (sent, message, day, schedules) còn nguyên", /sent: 0, message:[^\n]*unmarked \}/.test(cron) && /schedules: log/.test(cron) && /sent:      totalSent,\s+unmarked,/.test(cron));
  check("cron: lỗi của tin hôm qua bị bắt (try/catch), không làm hỏng phần nhắc học viên", /try \{ return await sendUnmarkedDaily\(\); \} catch/.test(cron));
  check("cron: đoạn xác thực CRON_SECRET không bị đụng", /const secret = process\.env\.CRON_SECRET;[\s\S]{0,300}Bearer \$\{secret\}/.test(cron));
  const srv = src("src/lib/unmarkedDailyServer.ts");
  check("chỉ duyệt gia sư có lớp mở + khung giờ hoạt động (một truy vấn), không quét mọi người dùng", /classSchedules: \{ some: \{ active: true \} \}/.test(srv) && !/prisma\.user\.findMany/.test(srv));
  check("chống trùng: tra thông báo unmarked_daily từ đầu ngày VN; truyền { count } cho notify()", /type: "unmarked_daily"[\s\S]{0,120}createdAt: \{ gte: vnDayStart\(now\) \}/.test(srv) && /\{ count: t\.count \}/.test(srv));
  check("không tự lọc giờ yên lặng / PUSH_ENABLED riêng (dùng cơ chế của notify)", !/inQuietHours|PUSH_ENABLED|pushConfig/.test(srv.replace(/^\s*\/\/.*$/gm, "")));
  await done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
