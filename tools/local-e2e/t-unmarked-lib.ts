// ĐX-01 (NC1-016) — "Buổi đã qua giờ, chưa điểm danh xong": quy tắc thuần (src/lib/unmarkedSessions.ts). Không cần DB hay máy chủ.
// Chạy: DATABASE_URL=postgresql://x:x@localhost/x npx tsx tools/local-e2e/t-unmarked-lib.ts   (DATABASE_URL chỉ để h.ts nạp được)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findUnmarkedSessions, recordKey, absenceKey, unmarkedHref, UNMARKED_NAMES_SHOWN, type UnmarkedInput, type UnmarkedOccurrence, type UnmarkedStudent } from "@/lib/unmarkedSessions";
import { isValidDateKey, UNMARKED_GRACE_MIN, UNMARKED_WINDOW_DAYS } from "@/lib/classSessions";
import { check, section, done } from "./h";

// 21/10/2026 15:00 giờ VN
const NOW = new Date("2026-10-21T08:00:00Z");
const MIN = 60_000;

// Buổi mẫu: 20/10 19:00–21:00 giờ VN (12:00–14:00 UTC), khung giờ tạo từ tháng 9
const occ = (o: Partial<UnmarkedOccurrence> = {}): UnmarkedOccurrence => ({
  scheduleId: "s1", courseId: "c1", courseName: "Toán 9", courseOpen: true,
  dateKey: "2026-10-20", originalDateKey: "2026-10-20",
  startAt: new Date("2026-10-20T12:00:00Z"), endAt: new Date("2026-10-20T14:00:00Z"),
  status: "scheduled", ruleCreatedAt: new Date("2026-09-01T00:00:00Z"), ...o,
});
const stu = (id: string, name: string, enrolledAt = "2026-09-05T00:00:00Z"): UnmarkedStudent => ({ id, name, enrolledAt: new Date(enrolledAt) });
const roster = new Map<string, UnmarkedStudent[]>([["c1", [stu("a", "An"), stu("b", "Bình"), stu("c", "Chi")]]]);
const rec = (...ids: string[]) => new Set(ids.map(id => recordKey("c1", "2026-10-20", id)));
const run = (o: Partial<UnmarkedInput> = {}) => findUnmarkedSessions({ now: NOW, occurrences: [occ()], studentsByCourse: roster, recorded: new Set(), handled: new Set(), ...o });

section("Hằng số");
check("chờ 60 phút sau giờ kết thúc, nhìn lại 14 ngày", UNMARKED_GRACE_MIN === 60 && UNMARKED_WINDOW_DAYS === 14);

section("Thiếu / đủ bản ghi");
let r = run();
check("chưa em nào có bản ghi → 1 buổi, thiếu 3/3, nêu tên sắp theo tiếng Việt", r.length === 1 && r[0].missing === 3 && r[0].total === 3 && r[0].missingNames.join() === "An,Bình,Chi", r);
check("buổi nêu đúng lớp, ngày hiệu lực, giờ bắt đầu", r[0].courseName === "Toán 9" && r[0].dateKey === "2026-10-20" && r[0].startAt.toISOString() === "2026-10-20T12:00:00.000Z");
r = run({ recorded: rec("a", "b", "c") });
check("đủ bản ghi cả 3 em → không còn việc", r.length === 0, r);
r = run({ recorded: rec("a", "b") });
check("thiếu 1 em → thiếu 1/3, nêu tên em còn thiếu", r.length === 1 && r[0].missing === 1 && r[0].total === 3 && r[0].missingNames.join() === "Chi", r);
const five = new Map([["c1", ["An", "Bình", "Chi", "Dũng", "Em"].map((n, i) => stu(`s${i}`, n))]]);
r = run({ studentsByCourse: five });
check(`nêu tối đa ${UNMARKED_NAMES_SHOWN} tên nhưng đếm đủ 5`, r[0].missing === 5 && r[0].missingNames.length === UNMARKED_NAMES_SHOWN, r);
r = run({ recorded: new Set([recordKey("c1", "2026-10-19", "a"), recordKey("c1", "2026-10-19", "b"), recordKey("c1", "2026-10-19", "c")]) });
check("bản ghi của NGÀY KHÁC không tính", r.length === 1 && r[0].missing === 3, r);
r = run({ recorded: new Set([recordKey("c2", "2026-10-20", "a"), recordKey("c2", "2026-10-20", "b"), recordKey("c2", "2026-10-20", "c")]) });
check("bản ghi của LỚP KHÁC (cùng em, cùng ngày) không tính", r.length === 1 && r[0].missing === 3, r);

section("Buổi huỷ, buổi dời, lớp đóng, lịch mới tạo");
check("buổi đã huỷ → không nhắc", run({ occurrences: [occ({ status: "cancelled" })] }).length === 0);
const moved = occ({ status: "moved", dateKey: "2026-10-19", originalDateKey: "2026-10-20", startAt: new Date("2026-10-19T12:00:00Z"), endAt: new Date("2026-10-19T14:00:00Z") });
check("buổi dời: chỉ bản ghi ở NGÀY MỚI mới tính", run({ occurrences: [moved], recorded: rec("a", "b", "c") }).length === 1
  && run({ occurrences: [moved], recorded: new Set(["a", "b", "c"].map(id => recordKey("c1", "2026-10-19", id))) }).length === 0);
check("buổi dời: nêu ngày hiệu lực (ngày mới) để mở đúng trang điểm danh", run({ occurrences: [moved] })[0].dateKey === "2026-10-19");
check("buổi dời: báo nghỉ khoá theo ngày GỐC vẫn nhận ra", run({ occurrences: [moved], handled: new Set([absenceKey("s1", "2026-10-20", "a"), absenceKey("s1", "2026-10-20", "b"), absenceKey("s1", "2026-10-20", "c")]) }).length === 0);
check("lớp đã đóng / tạm ngừng → không nhắc", run({ occurrences: [occ({ courseOpen: false })] }).length === 0);
check("buổi bắt đầu TRƯỚC lúc tạo khung giờ → không đòi lịch sử", run({ occurrences: [occ({ ruleCreatedAt: new Date("2026-10-20T13:00:00Z") })] }).length === 0);
check("khung giờ tạo đúng lúc buổi bắt đầu → vẫn tính (không phải 'trước')", run({ occurrences: [occ({ ruleCreatedAt: new Date("2026-10-20T12:00:00Z") })] }).length === 1);

section("Em đã báo nghỉ, em ghi danh sau");
const abs = (id: string) => absenceKey("s1", "2026-10-20", id);
check("em đã báo nghỉ (kể cả 'tính phí' không sinh bản ghi) KHÔNG bị tính là thiếu", run({ recorded: rec("a", "b"), handled: new Set([abs("c")]) }).length === 0);
r = run({ recorded: rec("a"), handled: new Set([abs("c")]) });
check("báo nghỉ chỉ loại đúng em đó: còn thiếu 1/2 (Bình)", r.length === 1 && r[0].missing === 1 && r[0].total === 2 && r[0].missingNames.join() === "Bình", r);
check("báo nghỉ của buổi KHÁC (ngày gốc khác) không loại", run({ handled: new Set([absenceKey("s1", "2026-10-13", "a")]) })[0].missing === 3);
const late = new Map([["c1", [stu("a", "An"), stu("b", "Bình"), stu("c", "Chi", "2026-10-20T15:00:00Z")]]]); // Chi ghi danh SAU khi buổi kết thúc (14:00Z)
check("em ghi danh sau khi buổi kết thúc không thuộc buổi này", run({ studentsByCourse: late, recorded: rec("a", "b") }).length === 0);
const during = new Map([["c1", [stu("a", "An"), stu("c", "Chi", "2026-10-20T13:00:00Z")]]]); // ghi danh giữa buổi
r = run({ studentsByCourse: during, recorded: rec("a") });
check("em ghi danh trong lúc buổi đang diễn ra thì tính", r.length === 1 && r[0].missing === 1 && r[0].total === 2, r);
check("lớp không có em nào đang học → không có gì để điểm danh", run({ studentsByCourse: new Map([["c1", []]]) }).length === 0 && run({ studentsByCourse: new Map() }).length === 0);

section("Tới hạn: sau giờ kết thúc 60 phút");
const endsAgo = (min: number) => occ({ startAt: new Date(NOW.getTime() - (min + 120) * MIN), endAt: new Date(NOW.getTime() - min * MIN), dateKey: "2026-10-21", originalDateKey: "2026-10-21" });
check("đang diễn ra → chưa nhắc", run({ occurrences: [occ({ endAt: new Date(NOW.getTime() + 10 * MIN), startAt: new Date(NOW.getTime() - 100 * MIN) })] }).length === 0);
check("vừa kết thúc 59 phút → chưa nhắc", run({ occurrences: [endsAgo(59)] }).length === 0);
check("kết thúc đúng 60 phút → nhắc", run({ occurrences: [endsAgo(60)] }).length === 1);
check("kết thúc 61 phút → nhắc", run({ occurrences: [endsAgo(61)] }).length === 1);

section("Hai khung cùng lớp cùng ngày, thứ tự");
const slot2 = occ({ scheduleId: "s2", startAt: new Date("2026-10-20T07:00:00Z"), endAt: new Date("2026-10-20T09:00:00Z") });
r = run({ occurrences: [occ(), slot2] });
check("dùng chung MỘT phiên điểm danh (ngày) → chỉ nhắc một lần, lấy khung sớm hơn", r.length === 1 && r[0].scheduleId === "s2", r);
const other = occ({ courseId: "c2", scheduleId: "s9", courseName: "Văn 9", dateKey: "2026-10-18", originalDateKey: "2026-10-18", startAt: new Date("2026-10-18T12:00:00Z"), endAt: new Date("2026-10-18T14:00:00Z") });
const both = new Map([...roster, ["c2", [stu("x", "Xuân")]]]);
r = findUnmarkedSessions({ now: NOW, occurrences: [occ(), other], studentsByCourse: both, recorded: new Set(), handled: new Set() });
check("nhiều lớp: sắp CŨ NHẤT trước (việc để lâu lên đầu)", r.length === 2 && r[0].courseName === "Văn 9" && r[1].courseName === "Toán 9", r.map(x => x.courseName));
check("số việc = số BUỔI (không phải số em)", r.length === 2 && r[1].missing === 3);

section("Đích của dòng việc và trang điểm danh");
check("href mở đúng trang điểm danh của lớp kèm ngày (BU-00 bước 3: bí danh gia sư /lop-cua-toi/quan-lop/…)", unmarkedHref("c1", "2026-10-20") === "/lop-cua-toi/quan-lop/c1/diem-danh?date=2026-10-20");
check("isValidDateKey (trang điểm danh dùng để nhận ?date=): nhận ngày thật, bỏ rác", isValidDateKey("2026-10-20") && !isValidDateKey("2026-13-01") && !isValidDateKey("2026-02-30") && !isValidDateKey("abc") && !isValidDateKey("") && !isValidDateKey("2026-10-20; DROP"));
const page = readFileSync(join(process.cwd(), "src/app/(admin)/admin/khoa-hoc/[id]/diem-danh/page.tsx"), "utf8");
check("trang điểm danh đọc ?date= qua useSearchParams, bọc Suspense, kiểm bằng isValidDateKey", /useSearchParams\(\)\.get\("date"\)/.test(page) && /<Suspense/.test(page) && /isValidDateKey\(queryDate\)/.test(page));

done();
