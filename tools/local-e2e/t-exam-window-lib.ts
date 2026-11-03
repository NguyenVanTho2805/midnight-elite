// BU-04 — khung giờ làm bài (src/lib/examWindow.ts): +07:00 tường minh, biên mở/đóng, cắt hạn lượt, KHÔNG phụ thuộc TZ máy chủ.
// Chạy: DATABASE_URL=postgresql://x:y@localhost:5432/z npx tsx tools/local-e2e/t-exam-window-lib.ts
import { execFileSync } from "node:child_process";
import { dateKeyFromDmy, durationMinutesOf, parseExamOpenAt, examWindowOf, startVerdict, windowState, clampExpiresAt, answersOpenAtOf } from "@/lib/examWindow";
import { check, section, done } from "./h";

const EX = { date: "05/11/2026", time: "19:00", duration: "45 phút" };
const probe = () => ({
  open: parseExamOpenAt("05/11/2026", "19:00")?.toISOString(),
  late: parseExamOpenAt("31/12/2026", "23:59")?.toISOString(),
  midnight: parseExamOpenAt("01/01/2027", "00:01")?.toISOString(),
  closes: examWindowOf(EX).closesAt?.toISOString(),
  v1: startVerdict(EX, new Date("2026-11-05T11:59:59Z")), // 18:59:59 VN
  v2: startVerdict(EX, new Date("2026-11-05T12:00:00Z")), // 19:00:00 VN
  v3: startVerdict(EX, new Date("2026-11-05T12:44:59Z")),
  v4: startVerdict(EX, new Date("2026-11-05T12:45:00Z")),
});

if (process.env.WINDOW_PROBE) { console.log("PROBE:" + JSON.stringify(probe())); process.exit(0); }

(async () => {
section("dateKeyFromDmy / durationMinutesOf");
check("05/11/2026 → 2026-11-05; 5/1/2027 → 2027-01-05", dateKeyFromDmy("05/11/2026") === "2026-11-05" && dateKeyFromDmy("5/1/2027") === "2027-01-05");
check("ngày không tồn tại / sai dạng / rỗng → null", dateKeyFromDmy("31/02/2026") === null && dateKeyFromDmy("2026-11-05") === null && dateKeyFromDmy("") === null && dateKeyFromDmy(null) === null);
check("'45 phút' → 45; '90' → 90; hỏng → 60; '0 phút' → 60", durationMinutesOf("45 phút") === 45 && durationMinutesOf("90") === 90 && durationMinutesOf("abc") === 60 && durationMinutesOf("0 phút") === 60);

section("parseExamOpenAt (+07:00 tường minh)");
check("19:00 ngày 05/11/2026 VN = 12:00Z", parseExamOpenAt("05/11/2026", "19:00")?.toISOString() === "2026-11-05T12:00:00.000Z");
check("23:59 → 00:01 qua nửa đêm VN: 00:01 01/01/2027 = 17:01Z ngày 31/12", parseExamOpenAt("01/01/2027", "00:01")?.toISOString() === "2026-12-31T17:01:00.000Z");
check("giờ / ngày hỏng → null", parseExamOpenAt("05/11/2026", "25:00") === null && parseExamOpenAt("05/11/2026", "") === null && parseExamOpenAt("x", "19:00") === null);

section("examWindowOf: closesAt = mở + thời lượng");
const w = examWindowOf(EX);
check("mở 19:00, đóng 19:45 VN", w.opensAt?.toISOString() === "2026-11-05T12:00:00.000Z" && w.closesAt?.toISOString() === "2026-11-05T12:45:00.000Z");
check("khung hỏng → cả hai null", examWindowOf({ date: "?", time: "?", duration: "?" }).closesAt === null);

section("startVerdict — biên");
check("một giây trước giờ mở → not_open", startVerdict(EX, new Date("2026-11-05T11:59:59Z")) === "not_open");
check("ĐÚNG giờ mở → ok", startVerdict(EX, new Date("2026-11-05T12:00:00Z")) === "ok");
check("một giây trước giờ đóng → ok", startVerdict(EX, new Date("2026-11-05T12:44:59Z")) === "ok");
check("ĐÚNG giờ đóng → closed", startVerdict(EX, new Date("2026-11-05T12:45:00Z")) === "closed");
check("hôm sau → closed", startVerdict(EX, new Date("2026-11-06T12:00:00Z")) === "closed");
check("khung hỏng → ok (không khoá học sinh vì dữ liệu hỏng)", startVerdict({ date: "?", time: "?", duration: "?" }, new Date()) === "ok");

section("windowState theo mode");
check("practice / null → none (không ép giờ)", windowState("practice", EX, new Date("2020-01-01")) === "none" && windowState(null, EX, new Date("2020-01-01")) === "none");
check("test: not_open / open / closed", windowState("test", EX, new Date("2026-11-05T00:00:00Z")) === "not_open" && windowState("test", EX, new Date("2026-11-05T12:10:00Z")) === "open" && windowState("test", EX, new Date("2026-11-05T13:00:00Z")) === "closed");

section("clampExpiresAt");
const s0 = new Date("2026-11-05T12:30:00Z");
check("em vào muộn 30 phút: hạn bị cắt ở cuối khung (12:45Z), không phải 13:15Z", clampExpiresAt(s0, 45, w.closesAt).toISOString() === "2026-11-05T12:45:00.000Z");
check("vào đúng giờ mở: đủ 45 phút", clampExpiresAt(w.opensAt!, 45, w.closesAt).toISOString() === "2026-11-05T12:45:00.000Z");
check("không có cuối khung (luyện tập): chỉ theo thời lượng", clampExpiresAt(s0, 45, null).toISOString() === "2026-11-05T13:15:00.000Z");
check("ca phá: cuối khung đã qua → không âm, không trước startedAt", clampExpiresAt(s0, 45, new Date("2026-11-05T11:00:00Z")).getTime() === s0.getTime());
check("thời lượng âm / 0 → hạn = startedAt", clampExpiresAt(s0, -5, null).getTime() === s0.getTime() && clampExpiresAt(s0, 0, null).getTime() === s0.getTime());

section("answersOpenAtOf");
check("after_exam_ends → cuối khung; after_submit / never → null", answersOpenAtOf("after_exam_ends", EX)?.toISOString() === "2026-11-05T12:45:00.000Z" && answersOpenAtOf("after_submit", EX) === null && answersOpenAtOf("never", EX) === null);

section("Múi giờ: cùng kết quả khi TZ=UTC và TZ=Asia/Ho_Chi_Minh (và Pacific/Honolulu)");
const here = JSON.stringify(probe());
const run = (tz: string) => {
  const out = execFileSync("npx", ["tsx", __filename.replace(/^.*\/tools\//, "tools/")], {
    env: { ...process.env, TZ: tz, WINDOW_PROBE: "1" }, encoding: "utf8", cwd: process.cwd(),
  });
  return out.split("\n").find(l => l.startsWith("PROBE:"))!.slice(6);
};
const a = run("UTC"), b = run("Asia/Ho_Chi_Minh"), c = run("Pacific/Honolulu");
check("UTC = Hồ Chí Minh", a === b, { a, b });
check("Honolulu cũng giống", a === c);
check("và giống tiến trình hiện tại", a === here);
done();
})();
