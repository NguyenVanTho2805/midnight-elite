// ĐX-00 (NC1-006) — định nghĩa "buổi đã dạy" (src/lib/taughtSessions.ts). Thuần, không cần DB hay máy chủ.
// Chạy: DATABASE_URL=postgresql://x:x@localhost/x npx tsx tools/local-e2e/t-taught-sessions-lib.ts   (DATABASE_URL chỉ để h.ts nạp được, không có truy vấn nào)
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { taughtSessionWhere, isTaughtSession, TAUGHT_RECORD_STATUSES } from "@/lib/taughtSessions";
import { check, section, done } from "./h";

const D = (s: string) => new Date(`${s}T00:00:00Z`);
const rec = (...st: string[]) => st.map(status => ({ status }));
type S = { date: Date; records: { status: string }[] };

// Đánh giá ĐÚNG đối tượng where mà taughtSessionWhere trả về, trên dữ liệu trong bộ nhớ — để hai định nghĩa (Prisma và thuần) không lệch nhau.
function matchesWhere(w: any, s: S): boolean {
  if (w.date?.lte && s.date.getTime() > w.date.lte.getTime()) return false;
  const inList: string[] = w.records.some.status.in;
  return s.records.some(r => inList.includes(r.status));
}

// 21/10/2026 12:00 giờ VN
const NOW = new Date("2026-10-21T05:00:00Z");

section("Trạng thái điểm danh nào chứng tỏ buổi đã diễn ra");
check("chỉ 'present' và 'late'", JSON.stringify([...TAUGHT_RECORD_STATUSES]) === JSON.stringify(["present", "late"]));

section("isTaughtSession: các ca của kế hoạch (phiên rỗng · chỉ có phép · tương lai · đủ)");
const cases: Array<[string, S, boolean]> = [
  ["phiên rỗng (không bản ghi nào)", { date: D("2026-10-14"), records: [] }, false],
  ["chỉ có bản ghi 'excused' (báo nghỉ trước tự sinh)", { date: D("2026-10-14"), records: rec("excused") }, false],
  ["chỉ có 'absent'", { date: D("2026-10-14"), records: rec("absent") }, false],
  ["'excused' + 'absent' (cả lớp nghỉ)", { date: D("2026-10-14"), records: rec("excused", "absent") }, false],
  ["một em có mặt", { date: D("2026-10-14"), records: rec("present") }, true],
  ["một em đến muộn", { date: D("2026-10-14"), records: rec("late") }, true],
  ["có phép + có mặt (một phiên lẫn trạng thái)", { date: D("2026-10-14"), records: rec("excused", "present") }, true],
  ["hôm qua, có mặt", { date: D("2026-10-20"), records: rec("present") }, true],
  ["HÔM NAY, có mặt (tính cả ngày hôm nay)", { date: D("2026-10-21"), records: rec("present") }, true],
  ["ngày mai, có mặt (tương lai)", { date: D("2026-10-22"), records: rec("present") }, false],
  ["tuần sau, có mặt (tương lai)", { date: D("2026-10-28"), records: rec("present", "late") }, false],
];
for (const [name, s, want] of cases) check(`${want ? "tính" : "KHÔNG tính"}: ${name}`, isTaughtSession(s, NOW) === want);

section("taughtSessionWhere cho cùng kết quả với isTaughtSession (hai định nghĩa không lệch)");
const w = taughtSessionWhere(NOW);
check("đối tượng where có lọc ngày và 'ít nhất một bản ghi present/late'", !!(w as any).date?.lte && Array.isArray((w as any).records?.some?.status?.in));
check("danh sách trạng thái trong where là bản sao (không lộ mảng hằng ra ngoài)", (w as any).records.some.status.in !== (TAUGHT_RECORD_STATUSES as unknown) && JSON.stringify((w as any).records.some.status.in) === JSON.stringify(["present", "late"]));
check("mọi ca trên: where và hàm thuần cùng đáp án", cases.every(([, s]) => matchesWhere(w, s) === isTaughtSession(s, NOW)));

section("Ranh giới ngày theo giờ Việt Nam (date lưu là 00:00 UTC của ngày VN)");
const lte = (now: Date) => (taughtSessionWhere(now) as any).date.lte.toISOString();
check("12:00 VN ngày 21/10 → hôm nay = 21/10", lte(NOW) === "2026-10-21T00:00:00.000Z");
check("23:59:59 VN ngày 21/10 vẫn là 21/10", lte(new Date("2026-10-21T16:59:59Z")) === "2026-10-21T00:00:00.000Z");
check("00:00:00 VN ngày 22/10 (= 17:00 UTC 21/10) sang 22/10", lte(new Date("2026-10-21T17:00:00Z")) === "2026-10-22T00:00:00.000Z");
const earlyVn = new Date("2026-10-21T20:00:00Z"); // 03:00 VN ngày 22/10
check("03:00 sáng VN: buổi của chính ngày hôm nay (22/10) được tính", isTaughtSession({ date: D("2026-10-22"), records: rec("present") }, earlyVn));
check("…trong khi cách đếm cũ `date <= new Date()` sẽ bỏ sót nó (nên không dùng new Date() thô)", D("2026-10-22").getTime() > earlyVn.getTime());
check("03:00 sáng VN: ngày 23/10 vẫn là tương lai", !isTaughtSession({ date: D("2026-10-23"), records: rec("present") }, earlyVn));

section("Mọi chỗ đếm buổi dạy đều dùng định nghĩa chung (quét mã nguồn)");
const root = process.cwd();
const files = (readdirSync(join(root, "src"), { recursive: true }) as string[])
  .filter(f => /\.(ts|tsx)$/.test(f) && !f.startsWith("generated"));
const offenders: string[] = [];
for (const f of files) {
  const lines = readFileSync(join(root, "src", f), "utf8").split("\n");
  lines.forEach((ln, i) => { if (/attendanceSession\.count\(/.test(ln) && !/taughtSessionWhere\(/.test(ln)) offenders.push(`src/${f}:${i + 1}`); });
}
check("không còn attendanceSession.count nào đếm trần (không qua taughtSessionWhere)", offenders.length === 0, offenders);
for (const f of ["src/app/api/tutors/[id]/route.ts", "src/app/api/invites/by-code/[code]/route.ts", "src/app/api/tutor/post-draft/route.ts"]) {
  check(`${f} dùng taughtSessionWhere`, /attendanceSession\.count\([^\n]*taughtSessionWhere\(/.test(readFileSync(join(root, f), "utf8")));
}

section("Chữ công khai không hứa 'không sửa được'");
const publicText = ["src/lib/funnel.ts", "src/components/tutor/PublicProfilePreview.tsx", "src/app/lop-cua-toi/(tutor)/bai-dang/BaiDangClient.tsx", "src/app/api/tutors/[id]/route.ts", "src/app/api/tutor/post-draft/route.ts"]
  .map(f => [f, readFileSync(join(root, f), "utf8")] as const);
check("không file nào còn câu 'không tự sửa được' / 'không sửa được' về số buổi", publicText.every(([, t]) => !/(không tự sửa được|gia sư không sửa được)/.test(t)), publicText.filter(([, t]) => /(không tự sửa được|gia sư không sửa được)/.test(t)).map(([f]) => f));

done();
