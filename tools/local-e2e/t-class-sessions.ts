import {
  parseHm, vnDateKeyOf, vnMinutesOfDay, instantOf, dayOfWeekOfKey, addDaysKey, weekRangeOf, isValidDateKey,
  expandOccurrences, classifyAbsenceReport, absenceDeadline, makeupExpiry, isMakeupExpired, isMakeupExpiringSoon,
  reminderPlan, dueReminderKinds, buildReminderMessage, buildAbsenceFreeMessage, buildAbsenceChargedMessage, describeLead,
} from "@/lib/classSessions";
import { check, section, done } from "./h";

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const iso = (s: string) => new Date(s);
const vn = (key: string, hm: string) => instantOf(key, parseHm(hm)!);

(async () => {
  section("Thời gian giờ VN");
  check("parseHm hợp lệ", parseHm("19:00") === 1140 && parseHm("7:05") === 425 && parseHm("00:00") === 0 && parseHm("23:59") === 1439);
  check("parseHm sai định dạng → null", [parseHm("24:00"), parseHm("19:60"), parseHm(""), parseHm(null), parseHm("7h"), parseHm("19:0")].every(x => x === null));
  check("20:00 UTC ngày 30/09 là 01/10 ở VN", vnDateKeyOf(iso("2026-09-30T20:00:00Z")) === "2026-10-01");
  check("16:59 UTC vẫn là ngày đó; 17:00 UTC sang ngày sau", vnDateKeyOf(iso("2026-09-30T16:59:00Z")) === "2026-09-30" && vnDateKeyOf(iso("2026-09-30T17:00:00Z")) === "2026-10-01");
  check("vnMinutesOfDay", vnMinutesOfDay(iso("2026-09-30T13:00:00Z")) === 20 * 60);
  check("instantOf 01/10 20:00 = 13:00Z", instantOf("2026-10-01", 1200).toISOString() === "2026-10-01T13:00:00.000Z");
  check("01/10/2026 là Thứ Năm", dayOfWeekOfKey("2026-10-01") === 4);
  check("addDaysKey qua tháng/năm", addDaysKey("2026-10-31", 1) === "2026-11-01" && addDaysKey("2026-12-31", 1) === "2027-01-01" && addDaysKey("2026-03-01", -1) === "2026-02-28");
  check("isValidDateKey chặn 31/02 và rác", !isValidDateKey("2026-02-31") && !isValidDateKey("2026-13-01") && !isValidDateKey("abc") && isValidDateKey("2028-02-29"));
  check("tuần Thứ Hai → Chủ nhật (CN thuộc tuần trước)", eq(weekRangeOf("2026-10-04"), { from: "2026-09-28", to: "2026-10-04" }) && eq(weekRangeOf("2026-10-05"), { from: "2026-10-05", to: "2026-10-11" }));

  section("Khai triển lịch tuần");
  const rules = [
    { id: "a", courseId: "c1", dayOfWeek: 4, startTime: "19:00", endTime: "21:00" },
    { id: "b", courseId: "c1", dayOfWeek: 1, startTime: "08:30", endTime: "10:00" },
    { id: "x", courseId: "c1", dayOfWeek: 4, startTime: "7h", endTime: "21:00" },
    { id: "off", courseId: "c1", dayOfWeek: 4, startTime: "10:00", endTime: "11:00", active: false },
  ];
  const occ = expandOccurrences(rules, "2026-09-28", "2026-10-11");
  check("2 tuần: 2 buổi T2 + 2 buổi T5, bỏ rule sai giờ và rule tắt", occ.length === 4, occ.map(o => o.scheduleId + o.dateKey));
  check("sắp theo giờ bắt đầu", eq(occ.map(o => o.dateKey), ["2026-09-28", "2026-10-01", "2026-10-05", "2026-10-08"]));
  check("startAt/endAt theo giờ VN", occ[1].startAt.toISOString() === "2026-10-01T12:00:00.000Z" && occ[1].endAt.toISOString() === "2026-10-01T14:00:00.000Z");
  check("hai đầu khoảng đều gồm", expandOccurrences(rules, "2026-10-01", "2026-10-01").length === 1);
  let threw = false; try { expandOccurrences(rules, "2026-01-01", "2026-12-31"); } catch { threw = true; }
  check("khoảng quá dài bị chặn", threw);
  check("endTime sai thì endAt = startAt (không lỗi)", expandOccurrences([{ id: "e", courseId: "c", dayOfWeek: 4, startTime: "19:00", endTime: "xx" }], "2026-10-01", "2026-10-01")[0].endAt.getTime() === vn("2026-10-01", "19:00").getTime());

  section("TT-202: phân loại báo nghỉ (ngưỡng 2 giờ)");
  const start = vn("2026-10-01", "20:00");
  const at = (minBefore: number) => new Date(start.getTime() - minBefore * 60_000);
  check("báo trước 24 giờ → auto", classifyAbsenceReport(start, at(1440)).kind === "auto");
  check("báo trước đúng 120 phút → auto (từ 2 giờ trở lên)", classifyAbsenceReport(start, at(120)).kind === "auto");
  check("báo trước 119 phút → late", classifyAbsenceReport(start, at(119)).kind === "late");
  check("báo trước 119 phút 59 giây → late", classifyAbsenceReport(start, new Date(start.getTime() - (120 * 60_000 - 1000))).kind === "late");
  check("báo trước 1 phút → late", classifyAbsenceReport(start, at(1)).kind === "late");
  check("đúng giờ bắt đầu → started", classifyAbsenceReport(start, at(0)).kind === "started");
  check("sau giờ bắt đầu → started", classifyAbsenceReport(start, at(-30)).kind === "started");
  check("leadMinutes được trả đúng", classifyAbsenceReport(start, at(45)).leadMinutes === 45);
  check("hạn báo nghỉ = giờ học − 2 giờ (18:00)", absenceDeadline(start).toISOString() === vn("2026-10-01", "18:00").toISOString());
  check("describeLead", describeLead(45) === "báo trước 45 phút" && describeLead(60) === "báo trước 1 giờ" && describeLead(90) === "báo trước 1 giờ 30 phút");

  section("TT-202: buổi bù 30 ngày, báo trước 3 ngày");
  const g = iso("2026-10-01T00:00:00Z");
  const exp = makeupExpiry(g);
  check("hạn = +30 ngày", exp.toISOString() === "2026-10-31T00:00:00.000Z");
  const threeDays = 3 * 86400_000;
  check("còn đúng 3 ngày → sắp hết hạn", isMakeupExpiringSoon({ expiresAt: exp }, new Date(exp.getTime() - threeDays)));
  check("còn 3 ngày + 1ms → chưa báo", !isMakeupExpiringSoon({ expiresAt: exp }, new Date(exp.getTime() - threeDays - 1)));
  check("đúng lúc hết hạn → hết hạn, không còn 'sắp'", isMakeupExpired({ expiresAt: exp }, exp) && !isMakeupExpiringSoon({ expiresAt: exp }, exp));
  check("còn 1ms → chưa hết hạn", !isMakeupExpired({ expiresAt: exp }, new Date(exp.getTime() - 1)));

  section("TT-201: lịch nhắc + giờ yên lặng");
  let p = reminderPlan(vn("2026-10-01", "20:00"));
  check("20:00: nhắc 24h đúng 20:00 hôm trước, không dời", p.h24.dueAt.toISOString() === vn("2026-09-30", "20:00").toISOString() && !p.h24.shifted);
  check("20:00: nhắc 1h lúc 19:00", p.h1?.dueAt.toISOString() === vn("2026-10-01", "19:00").toISOString());
  p = reminderPlan(vn("2026-10-01", "22:30"));
  check("22:30: 24h rơi 22:30 (yên lặng) → dời 21:30 CÙNG ngày hôm trước", p.h24.shifted && p.h24.dueAt.toISOString() === vn("2026-09-30", "21:30").toISOString());
  check("22:30: 1h lúc 21:30 vẫn gửi", p.h1?.dueAt.toISOString() === vn("2026-10-01", "21:30").toISOString());
  p = reminderPlan(vn("2026-10-01", "06:00"));
  check("06:00: 24h rơi 06:00 (yên lặng) → dời 21:30 tối hôm trước nữa", p.h24.shifted && p.h24.dueAt.toISOString() === vn("2026-09-29", "21:30").toISOString());
  check("06:00: bỏ tin 1h vì buổi trước 08:00", p.h1 === null && p.h1SkipReason === "sang-som");
  p = reminderPlan(vn("2026-10-01", "07:30"));
  check("07:30: 24h lúc 07:30 không yên lặng", !p.h24.shifted);
  check("07:30: bỏ tin 1h (trước 08:00)", p.h1 === null);
  p = reminderPlan(vn("2026-10-01", "08:00"));
  check("08:00: tin 1h lúc 07:00 (đúng mốc hết yên lặng) vẫn gửi", p.h1?.dueAt.toISOString() === vn("2026-10-01", "07:00").toISOString());
  p = reminderPlan(vn("2026-10-01", "23:30"));
  check("23:30: tin 1h lúc 22:30 rơi giờ yên lặng → bỏ", p.h1 === null && p.h1SkipReason === "gio-yen-lang");
  p = reminderPlan(vn("2026-10-01", "01:00"));
  check("01:00: 24h rơi 01:00 → dời 21:30 hai ngày trước, 1h bỏ", p.h24.dueAt.toISOString() === vn("2026-09-29", "21:30").toISOString() && p.h1 === null);
  p = reminderPlan(vn("2026-10-01", "21:30"));
  check("21:30 (sát mốc 22:00): 24h lúc 21:30 giữ nguyên", !p.h24.shifted);
  p = reminderPlan(vn("2026-10-01", "22:00"));
  check("22:00: 24h lúc 22:00 là yên lặng (gồm 22:00) → dời 21:30", p.h24.shifted);

  section("TT-201: tin nào đã tới hạn");
  const cls = vn("2026-10-01", "20:00");
  check("trước hạn 24h: chưa có tin", eq(dueReminderKinds(cls, vn("2026-09-30", "19:59")), []));
  check("đúng hạn 24h: có h24", eq(dueReminderKinds(cls, vn("2026-09-30", "20:00")), ["h24"]));
  check("18:59 hôm học: vẫn chỉ h24", eq(dueReminderKinds(cls, vn("2026-10-01", "18:59")), ["h24"]));
  check("19:00 hôm học: h24 + h1", eq(dueReminderKinds(cls, vn("2026-10-01", "19:00")), ["h24", "h1"]));
  check("đúng giờ học: hết nhắc", eq(dueReminderKinds(cls, vn("2026-10-01", "20:00")), []));
  check("sau giờ học: hết nhắc", eq(dueReminderKinds(cls, vn("2026-10-01", "20:30")), []));
  check("buổi 06:00: bao giờ cũng chỉ h24", eq(dueReminderKinds(vn("2026-10-01", "06:00"), vn("2026-10-01", "05:30")), ["h24"]));

  section("Mẫu tin (khớp đặc tả)");
  const now = vn("2026-09-30", "20:00");
  const common = { studentName: "Minh Anh", subject: "Toán 9", startAt: cls, tutorName: "Thầy/Cô Thanh", joinUrl: "https://meet.google.com/abc-defg-hij", now };
  const t24 = buildReminderMessage({ ...common, kind: "h24", recipient: "parent" });
  check("24h phụ huynh đúng mẫu",
    t24 === "KiN nhắc lịch: con Minh Anh có buổi Toán 9 lúc 20:00 tối mai, thứ Năm 01/10, với Thầy/Cô Thanh.\nLink vào lớp: https://meet.google.com/abc-defg-hij\nCon cần nghỉ thì anh/chị báo ở sổ học trước 18:00 để con được giữ buổi bù.", t24);
  const t1 = buildReminderMessage({ ...common, kind: "h1", recipient: "parent", now: vn("2026-10-01", "19:00") });
  check("1h phụ huynh đúng mẫu", t1 === "Còn 1 giờ nữa là buổi Toán 9 của Minh Anh (20:00).\nLink vào lớp: https://meet.google.com/abc-defg-hij", t1);
  check("không có link → bỏ dòng link", !buildReminderMessage({ ...common, joinUrl: null, kind: "h24", recipient: "parent" }).includes("Link vào lớp"));
  check("không có tên gia sư → bỏ cụm 'với'", !buildReminderMessage({ ...common, tutorName: "  ", kind: "h24", recipient: "parent" }).includes("với"));
  const ts = buildReminderMessage({ ...common, kind: "h24", recipient: "student" });
  check("học sinh: xưng 'bạn', vẫn có hạn báo nghỉ", ts.includes("bạn có buổi Toán 9") && ts.includes("trước 18:00"), ts);
  check("nhắc cùng ngày ghi 'hôm nay'", buildReminderMessage({ ...common, kind: "h24", recipient: "parent", now: vn("2026-10-01", "09:00") }).includes("tối hôm nay"));
  check("buổi sáng/chiều", buildReminderMessage({ ...common, startAt: vn("2026-10-01", "09:00"), kind: "h24", recipient: "parent" }).includes("09:00 sáng") && buildReminderMessage({ ...common, startAt: vn("2026-10-01", "14:00"), kind: "h24", recipient: "parent" }).includes("14:00 chiều"));
  check("không dùng 'mai' khi nhắc xa hơn 1 ngày", !buildReminderMessage({ ...common, kind: "h24", recipient: "parent", now: vn("2026-09-29", "21:30") }).includes(" mai"));
  check("hạn báo nghỉ qua ngày thì ghi rõ ngày", buildReminderMessage({ ...common, startAt: vn("2026-10-01", "01:00"), kind: "h24", recipient: "parent" }).includes("trước 23:00 ngày 30/09"));
  check("tin buổi bù đúng mẫu", buildAbsenceFreeMessage({ dateKey: "2026-09-30", makeupCount: 1 }) === "Đã ghi nhận con nghỉ buổi 30/09. Buổi này không tính phí và con còn 1 buổi bù. Thầy/Cô sẽ hẹn giờ bù với anh/chị.");
  check("tin buổi bù ghi đúng số buổi đang giữ", buildAbsenceFreeMessage({ dateKey: "2026-09-30", makeupCount: 3, tutorName: "Cô Lan" }).includes("còn 3 buổi bù. Cô Lan sẽ hẹn"));
  check("tin tính phí không hứa buổi bù", buildAbsenceChargedMessage({ dateKey: "2026-09-30" }).includes("không có buổi bù"));

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
