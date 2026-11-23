// SCL đợt 5 — src/lib/trial.ts (hàm thuần) + isEnrollmentActive với học thử. THUẦN: không DB, không máy chủ.
// Chạy: DATABASE_URL=postgresql://x:x@localhost/x npx tsx tools/local-e2e/t-trial-lib.ts
import { TRIAL_DAYS, intakeGradeAllowed, isTrialExpired, trialEndsAt, trialLabel, trialState } from "@/lib/trial";
import { ENROLLMENT_STATUS, isEnrollmentActive, splitEnrollmentIds } from "@/lib/enrollment";
import { intakeCourseMap } from "@/lib/intakeServer";
import { check, section, done } from "./h";

const D = 86_400_000;
const T0 = new Date("2026-11-20T10:00:00+07:00");
const at = (ms: number) => new Date(T0.getTime() + ms);
const thu = { trialDays: TRIAL_DAYS, trialStartedAt: T0 };

section("Hằng số và mốc hết hạn");
check("TRIAL_DAYS = 14", TRIAL_DAYS === 14);
check("trialEndsAt = bắt đầu + 14 ngày (đúng mili giây)", trialEndsAt(thu)?.getTime() === T0.getTime() + 14 * D);
check("trialEndsAt chưa bắt đầu ⇒ null", trialEndsAt({ trialDays: 14, trialStartedAt: null }) === null);
check("trialEndsAt chính thức ⇒ null", trialEndsAt({ trialDays: null, trialStartedAt: T0 }) === null);
check("trialEndsAt nhận chuỗi ISO (JSON)", trialEndsAt({ trialDays: 14, trialStartedAt: T0.toISOString() })?.getTime() === T0.getTime() + 14 * D);

section("trialState ở mọi mốc");
check("chính thức (trialDays null) ⇒ khong_phai_thu", trialState({ trialDays: null, trialStartedAt: null }, T0).kind === "khong_phai_thu");
check("chính thức dù có trialStartedAt cũ ⇒ khong_phai_thu", trialState({ trialDays: null, trialStartedAt: T0 }, at(100 * D)).kind === "khong_phai_thu");
check("chưa mở lớp ⇒ chua_bat_dau (không tính ngày dù đã lâu)", trialState({ trialDays: 14, trialStartedAt: null }, at(365 * D)).kind === "chua_bat_dau");
const s0 = trialState(thu, T0);
check("đúng lúc bắt đầu ⇒ còn 14 ngày", s0.kind === "dang_thu" && s0.daysLeft === 14, s0);
const s1 = trialState(thu, at(1));
check("sau 1 ms ⇒ vẫn còn 14 ngày (làm tròn lên)", s1.kind === "dang_thu" && s1.daysLeft === 14, s1);
const s2 = trialState(thu, at(D));
check("sau đúng 1 ngày ⇒ còn 13", s2.kind === "dang_thu" && s2.daysLeft === 13, s2);
const s3 = trialState(thu, at(11 * D + 1));
check("còn chưa tới 3 ngày ⇒ daysLeft 3", s3.kind === "dang_thu" && s3.daysLeft === 3, s3);
const s4 = trialState(thu, at(14 * D - 1));
check("1 ms trước hạn ⇒ còn 1 ngày", s4.kind === "dang_thu" && s4.daysLeft === 1, s4);
check("đúng mốc hạn ⇒ het_han", trialState(thu, at(14 * D)).kind === "het_han");
check("sau hạn ⇒ het_han", trialState(thu, at(30 * D)).kind === "het_han");
check("gia hạn 21 ngày ⇒ ngày 15 vẫn đang thử", trialState({ trialDays: 21, trialStartedAt: T0 }, at(15 * D)).kind === "dang_thu");
check("trialDays 0 ⇒ hết hạn ngay khi bắt đầu", trialState({ trialDays: 0, trialStartedAt: T0 }, T0).kind === "het_han");
check("isTrialExpired khớp trialState", isTrialExpired(thu, at(14 * D)) && !isTrialExpired(thu, at(13 * D)));

section("isEnrollmentActive: hết hạn ⇒ false NGAY cả khi status chưa lật");
const now = new Date();
check("active, chính thức ⇒ true", isEnrollmentActive({ status: "active", trialDays: null, trialStartedAt: null }));
check("active, chỉ có status (người gọi cũ) ⇒ true", isEnrollmentActive({ status: "active" }));
check("active, đang thử ⇒ true", isEnrollmentActive({ status: "active", trialDays: 14, trialStartedAt: new Date(now.getTime() - D) }));
check("active, chưa bắt đầu ⇒ true", isEnrollmentActive({ status: "active", trialDays: 14, trialStartedAt: null }));
check("active nhưng ĐÃ quá hạn (cron chưa chạy) ⇒ false", !isEnrollmentActive({ status: "active", trialDays: 14, trialStartedAt: new Date(now.getTime() - 15 * D) }));
check("trial_expired ⇒ false", !isEnrollmentActive({ status: ENROLLMENT_STATUS.TRIAL_EXPIRED, trialDays: 14, trialStartedAt: new Date(now.getTime() - 15 * D) }));
check("ENROLLMENT_STATUS.TRIAL_EXPIRED = 'trial_expired'", ENROLLMENT_STATUS.TRIAL_EXPIRED === "trial_expired");
const split = splitEnrollmentIds([{ courseId: "a", status: "active" }, { courseId: "b", status: "trial_expired" }]);
check("splitEnrollmentIds: trial_expired không vào lớp đang học", split.courseIds.join() === "a" && !split.suspendedCourseIds.includes("b"), split);

section("Nhãn cho gia sư");
check("đang thử ⇒ 'Học thử · còn N ngày'", trialLabel(thu, at(4 * D)) === "Học thử · còn 10 ngày");
check("chưa bắt đầu ⇒ 'Chưa bắt đầu'", trialLabel({ trialDays: 14, trialStartedAt: null }, T0) === "Chưa bắt đầu");
check("hết hạn ⇒ 'Hết hạn'", trialLabel(thu, at(20 * D)) === "Hết hạn");
check("đã gửi phiếu chính thức ⇒ 'Chờ xác nhận chính thức' (ưu tiên)", trialLabel({ ...thu, trialConvertRequestedAt: T0 }, at(20 * D)) === "Chờ xác nhận chính thức");
check("chính thức ⇒ null", trialLabel({ trialDays: null, trialStartedAt: null }, T0) === null);

section("D9 khối + bản đồ môn → lớp");
for (const k of ["Khối 11", "Khối 12", "11", "12", "Lớp 12A1"]) check(`'${k}' được tạo`, intakeGradeAllowed(k));
for (const k of ["Khối 10", "10", "Thí sinh tự do", "112", "2011", ""]) check(`'${k}' KHÔNG tạo`, !intakeGradeAllowed(k));
check("KIN_INTAKE_COURSES hợp lệ", JSON.stringify(intakeCourseMap('{"Toán":"a","Sử":"b","Lạ":"x","Địa":""}')) === JSON.stringify({ "Toán": "a", "Sử": "b" }));
check("KIN_INTAKE_COURSES hỏng ⇒ {}", JSON.stringify(intakeCourseMap("{không phải json")) === "{}" && JSON.stringify(intakeCourseMap(undefined)) === "{}");

section("Phá cố ý (bài phải bắt được)");
const broken = (e: { trialDays: number; trialStartedAt: Date }, n: Date) => Math.floor((e.trialStartedAt.getTime() + e.trialDays * D - n.getTime()) / D); // làm tròn XUỐNG — sai
check("làm tròn xuống cho ra 13 lúc vừa bắt đầu + 1ms (khác bản thật 14)", broken(thu, at(1)) === 13 && (s1.kind === "dang_thu" && s1.daysLeft === 14));
const brokenActive = (e: { status: string }) => e.status === "active"; // bỏ kiểm hạn — sai
check("bỏ kiểm hạn thì em quá hạn vẫn 'đang học' (bản thật chặn)", brokenActive({ status: "active" }) && !isEnrollmentActive({ status: "active", trialDays: 14, trialStartedAt: new Date(now.getTime() - 15 * D) }));

done();
