// NC2-026a — trần ngày cho chuyên cần phụ huynh/báo cáo tháng (attendanceDateWindow). Thuần, không cần DB hay máy chủ.
// Chạy: DATABASE_URL=postgresql://x:x@localhost/x npx tsx tools/local-e2e/t-attendance-window-lib.ts
import { readFileSync } from "node:fs";
import { attendanceDateWindow } from "@/lib/taughtSessions";
import { computeAttendanceStats } from "@/lib/attendance";
import { check, section, done } from "./h";

const D = (s: string) => new Date(`${s}T00:00:00Z`);
const FIRST = D("2026-10-01"), NEXT = D("2026-11-01");
// Mô phỏng đúng điều kiện Prisma {gte, lt} trên ngày buổi điểm danh.
const inWin = (w: { gte: Date; lt: Date }, day: string) => D(day).getTime() >= w.gte.getTime() && D(day).getTime() < w.lt.getTime();

section("Ranh giới theo giờ VN");
let w = attendanceDateWindow(FIRST, NEXT, new Date("2026-10-21T05:00:00Z")); // 12:00 VN 21/10
check("hôm nay (21/10) tính; ngày mai (22/10) không", inWin(w, "2026-10-21") && !inWin(w, "2026-10-22"));
w = attendanceDateWindow(FIRST, NEXT, new Date("2026-10-20T17:00:00Z")); // 00:00 VN 21/10 (UTC vẫn 20/10)
check("00:00 VN: hôm nay = 21/10 (không phải 20/10 theo UTC)", inWin(w, "2026-10-21") && !inWin(w, "2026-10-22"));
w = attendanceDateWindow(FIRST, NEXT, new Date("2026-10-21T16:59:59Z")); // 23:59:59 VN 21/10
check("23:59 VN: vẫn là 21/10, ngày mai không tính", inWin(w, "2026-10-21") && !inWin(w, "2026-10-22"));
w = attendanceDateWindow(FIRST, NEXT, new Date("2026-10-21T17:00:00Z")); // 00:00 VN 22/10
check("qua nửa đêm VN: 22/10 bắt đầu tính", inWin(w, "2026-10-22") && !inWin(w, "2026-10-23"));

section("Cuối tháng / đầu tháng / tháng cũ");
w = attendanceDateWindow(FIRST, NEXT, new Date("2026-11-15T05:00:00Z"));
check("tháng đã qua: giữ nguyên cả tháng (31/10 tính; 1/11 không)", inWin(w, "2026-10-31") && !inWin(w, "2026-11-01") && w.lt.getTime() === NEXT.getTime());
w = attendanceDateWindow(FIRST, NEXT, new Date("2026-10-31T17:30:00Z")); // 00:30 VN 01/11
check("00:30 VN ngày 1/11: tháng 10 vẫn trọn vẹn, không vượt sang tháng 11", w.lt.getTime() === NEXT.getTime());
w = attendanceDateWindow(FIRST, NEXT, new Date("2026-09-30T20:00:00Z")); // 03:00 VN 01/10
check("sáng 1/10 VN: ngày 1/10 tính, 2/10 không", inWin(w, "2026-10-01") && !inWin(w, "2026-10-02"));
w = attendanceDateWindow(FIRST, NEXT, new Date("2026-09-15T05:00:00Z"));
check("tháng chưa tới: cửa sổ rỗng (không ngày nào lọt)", !inWin(w, "2026-10-01") && !inWin(w, "2026-10-15"));

section("Ca 'excused' tương lai không kéo tỷ lệ");
const now = new Date("2026-10-05T05:00:00Z");
const win = attendanceDateWindow(FIRST, NEXT, now);
const kept = [{ day: "2026-10-08", status: "excused" }].filter(r => inWin(win, r.day)); // báo nghỉ buổi 8/10, hôm nay 5/10
const st = computeAttendanceStats(kept);
check("em chưa học buổi nào + 1 excused ngày +3 → 0 buổi, tỷ lệ null (không '80% · 1 buổi')", kept.length === 0 && st.total === 0 && st.ratio === null, st);
const kept2 = [{ day: "2026-10-02", status: "present" }, { day: "2026-10-05", status: "late" }, { day: "2026-10-09", status: "excused" }, { day: "2026-10-12", status: "excused" }].filter(r => inWin(win, r.day));
check("quá khứ + hôm nay vẫn tính (2 buổi), 2 excused tương lai không", kept2.length === 2);
check("bản ghi excused ĐÃ qua ngày vẫn tính như cũ", inWin(attendanceDateWindow(FIRST, NEXT, new Date("2026-10-31T05:00:00Z")), "2026-10-08"));

section("Ca phá cố ý: mã nguồn phải dùng hàm ở cả 3 chỗ");
for (const f of ["src/app/(parent)/so-cua-con/[token]/page.tsx", "src/app/api/parent-portal/[token]/route.ts", "src/lib/monthlyReportServer.ts"]) {
  check(`${f} gọi attendanceDateWindow`, readFileSync(f, "utf8").includes("attendanceDateWindow("));
}
done();
