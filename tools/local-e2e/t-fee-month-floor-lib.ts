// HOCPHI-THEO-BUOI 3.3 — bài THUẦN cho src/lib/feeModeFloor.ts (mốc tháng chống hai hệ phí). Có ca phá. Không DB, không mạng.
import { effectiveFeeModeForMonth, feeFloorMonth, floorViolation } from "@/lib/feeModeFloor";
import { check, section, done } from "./h";

(async () => {
const fresh = [{ effectiveFrom: "2000-01-01" }];
const conv = [{ effectiveFrom: "2026-12-01" }];

section("feeFloorMonth");
check("lớp mới (mốc đầu 2000-01-01) → không có mốc", feeFloorMonth(fresh) === null);
check("lớp chuyển (mốc 2026-12-01) → 2026-12", feeFloorMonth(conv) === "2026-12");
check("[phá] chưa có đơn giá nào → null", feeFloorMonth([]) === null);
check("mốc đầu là NHỎ NHẤT dù thứ tự mảng đảo; thêm mốc sau không đổi sàn", feeFloorMonth([{ effectiveFrom: "2027-03-01" }, { effectiveFrom: "2026-12-01" }]) === "2026-12");
check("lớp mới có thêm mốc đổi giá về sau vẫn không có sàn", feeFloorMonth([{ effectiveFrom: "2026-11-15" }, { effectiveFrom: "2000-01-01" }]) === null);

section("effectiveFeeModeForMonth");
check("lớp mới: mọi tháng → per_session", ["1999-12", "2026-11", "2030-01"].every(m => effectiveFeeModeForMonth("per_session", fresh, m) === "per_session"));
check("lớp chuyển: tháng < S → monthly_sessions", effectiveFeeModeForMonth("per_session", conv, "2026-11") === "monthly_sessions" && effectiveFeeModeForMonth("per_session", conv, "2025-12") === "monthly_sessions");
check("lớp chuyển: tháng ≥ S → per_session", effectiveFeeModeForMonth("per_session", conv, "2026-12") === "per_session" && effectiveFeeModeForMonth("per_session", conv, "2027-06") === "per_session");
check("ranh giới 12/2026 → 01/2027 (S = 2027-01): 2026-12 cũ, 2027-01 mới", effectiveFeeModeForMonth("per_hour", [{ effectiveFrom: "2027-01-01" }], "2026-12") === "monthly_sessions" && effectiveFeeModeForMonth("per_hour", [{ effectiveFrom: "2027-01-01" }], "2027-01") === "per_hour");
check("giữ đúng kiểu mới (per_hour, per_course) từ mốc trở đi", effectiveFeeModeForMonth("per_hour", conv, "2026-12") === "per_hour" && effectiveFeeModeForMonth("per_course", conv, "2027-01") === "per_course");
check("monthly_sessions luôn monthly_sessions (kể cả có mốc, kể cả tháng sau mốc)", effectiveFeeModeForMonth("monthly_sessions", conv, "2027-05") === "monthly_sessions" && effectiveFeeModeForMonth("monthly_sessions", fresh, "2026-11") === "monthly_sessions");
check("[phá] feeMode lạ / null / undefined → cách cũ", effectiveFeeModeForMonth("per_week", conv, "2027-01") === "monthly_sessions" && effectiveFeeModeForMonth(null, fresh, "2027-01") === "monthly_sessions" && effectiveFeeModeForMonth(undefined, conv, "2027-01") === "monthly_sessions");
check("[phá] kiểu mới nhưng chưa có đơn giá nào → giữ kiểu (không có mốc để lùi)", effectiveFeeModeForMonth("per_session", [], "2020-01") === "per_session");

section("floorViolation (fee-rates POST không cho lùi trước mốc)");
check("lớp không có mốc → mọi ngày được", floorViolation("2020-01-01", fresh) === null && floorViolation("2026-11-15", []) === null);
check("lớp có mốc 2026-12: ngày 2026-12-01 và sau → được", floorViolation("2026-12-01", conv) === null && floorViolation("2027-02-10", conv) === null);
const bad = floorViolation("2026-11-30", conv);
check("[phá] ngày 2026-11-30 (trước mốc 1 ngày) → có lỗi, nêu tháng 12/2026", typeof bad === "string" && bad.includes("12/2026"), bad);
check("[phá] ngày rất xa trong quá khứ → lỗi", floorViolation("2000-01-01", conv) !== null);
check("lỗi không chứa số tiền hay tên", !/đ\b|\bk\b/.test(bad ?? ""));

await done();
})();
