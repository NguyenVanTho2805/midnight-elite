// BC-02: chọn / sắp các buổi hiện trên Sổ của con (src/lib/partySessions.ts). Hàm thuần, không cần máy chủ.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-party-sessions-lib.ts
import { readFileSync } from "node:fs";
import { PARTY_SESSIONS_LIMIT, partySessionRows } from "@/lib/partySessions";
import { check, done, section } from "./h";

const T = "2026-10-24";
const R = (dateKey: string, status: string, courseName = "Toán 9") => ({ dateKey, courseName, status });

section("Chọn và sắp");
const rows = partySessionRows([R("2026-10-16", "late"), R("2026-10-23", "present"), R("2026-10-09", "absent"), R("2026-10-02", "excused")], T);
check("mới → cũ", rows.map(r => r.dateKey).join() === "2026-10-23,2026-10-16,2026-10-09,2026-10-02");
check("chữ và màu nghĩa: Có mặt xong, Muộn xong, Vắng lỗi, Có phép mờ (luôn có chữ)", rows.map(r => `${r.label}/${r.tone}`).join() === "Có mặt/xong,Muộn/xong,Vắng/loi,Có phép/mo");
check("buổi ở ngày chưa tới (báo nghỉ trước) bị cắt; hôm nay thì tính", partySessionRows([R("2026-10-25", "excused"), R("2026-10-24", "present")], T).map(r => r.dateKey).join() === "2026-10-24");
check("trạng thái lạ / ngày sai bị bỏ, không ném lỗi", partySessionRows([R("2026-10-20", "banana"), R("2026-02-31", "present"), R("2026-10-19", "present")], T).length === 1);
check("giới hạn mặc định 12, tuỳ chỉnh được; limit 0 → rỗng", partySessionRows(Array.from({ length: 30 }, (_, i) => R(`2026-09-${String((i % 28) + 1).padStart(2, "0")}`, "present", `Lớp ${i}`)), T).length === PARTY_SESSIONS_LIMIT
  && partySessionRows([R("2026-10-20", "present")], T, 0).length === 0);
check("cùng ngày hai lớp: xếp theo tên lớp (ổn định)", partySessionRows([R("2026-10-20", "present", "Văn 9"), R("2026-10-20", "present", "Lý 9")], T).map(r => r.courseName).join() === "Lý 9,Văn 9");
let threw = false; try { partySessionRows([], "2026-13-40"); } catch { threw = true; }
check("ngày hôm nay sai → ném lỗi (không đoán)", threw);

section("Mã nguồn: không có điểm / ghi chú trong dữ liệu trả ra");
const src = readFileSync("src/lib/partySessions.ts", "utf8") + readFileSync("src/lib/partySessionsServer.ts", "utf8");
check("không đọc score / homeworkPct / note", !/\bscore\b|homeworkPct|\bnote\b/.test(src.replace(/\/\/.*$/gm, "")));
check("không new Date() thô trong phần thuần", !/new Date\(\)/.test(readFileSync("src/lib/partySessions.ts", "utf8")));
done();
