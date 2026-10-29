// NC2-043 — src/lib/personalEvents.ts: kiểm dữ liệu "việc riêng" của học sinh. PHÁ CỐ Ý: tên rỗng / quá dài / toàn ký tự điều khiển, ngày không có thật,
// ngày quá xa, giờ sai, giờ kết thúc không sau giờ bắt đầu, ghi chú quá dài, kiểu dữ liệu sai (mảng, null, số), khoảng ngày đảo / quá rộng.
import { cleanPersonalEvent, cleanPersonalRange, PERSONAL_TITLE_MAX, PERSONAL_NOTE_MAX, PERSONAL_RANGE_MAX_DAYS } from "@/lib/personalEvents";
import { check, section, done } from "./h";

const TODAY = "2026-10-28";
const ok = (o: unknown) => cleanPersonalEvent(o, TODAY);
const base = { title: "Ôn Sử chương 3", dateKey: "2026-10-29", startTime: "19:30", endTime: "21:00", note: "Làm đề cương" };

section("Việc hợp lệ");
let r = ok(base);
check("đủ ô → nhận, giữ nguyên giá trị", r.ok && r.value.title === "Ôn Sử chương 3" && r.value.dateKey === "2026-10-29" && r.value.startTime === "19:30" && r.value.endTime === "21:00" && r.value.note === "Làm đề cương", r);
r = ok({ title: "Học thêm Toán", dateKey: "2026-10-28", startTime: "7:05" });
check("chỉ cần tên + ngày + giờ bắt đầu; giờ 7:05 chuẩn hoá 07:05; không giờ kết thúc / ghi chú → null", r.ok && r.value.startTime === "07:05" && r.value.endTime === null && r.value.note === null, r);
r = ok({ ...base, endTime: "", note: "   " });
check("giờ kết thúc rỗng và ghi chú toàn khoảng trắng → null (không phải chuỗi rỗng)", r.ok && r.value.endTime === null && r.value.note === null, r);
r = ok({ ...base, title: "  Ôn \t Sử\n chương   3  " });
check("tên: gộp khoảng trắng, bỏ ký tự điều khiển, cắt hai đầu", r.ok && r.value.title === "Ôn Sử chương 3", r);
r = ok({ ...base, note: "dòng 1\r\ndòng 2\n\n\n\ndòng 3" });
check("ghi chú giữ đổi dòng (CRLF → LF, tối đa một dòng trống)", r.ok && r.value.note === "dòng 1\ndòng 2\n\ndòng 3", r);
r = ok({ ...base, title: "<img src=x onerror=alert(1)>" });
check("ký tự HTML lưu như chữ thường (React tự thoát khi hiển thị), không bị cắt", r.ok && r.value.title === "<img src=x onerror=alert(1)>", r);
check("ngày đúng ranh giới: lùi 366 ngày và tiến 731 ngày vẫn nhận", ok({ ...base, dateKey: "2025-10-27" }).ok && ok({ ...base, dateKey: "2028-10-28" }).ok);
check("tên đúng 80 ký tự → nhận; ghi chú đúng 300 → nhận", ok({ ...base, title: "a".repeat(PERSONAL_TITLE_MAX) }).ok && ok({ ...base, note: "b".repeat(PERSONAL_NOTE_MAX) }).ok);

section("PHÁ CỐ Ý — phải từ chối, có lý do bằng tiếng Việt");
const bad = (name: string, o: unknown, re: RegExp) => { const x = ok(o); check(`${name} → từ chối`, !x.ok && re.test(x.error), x); };
bad("tên rỗng", { ...base, title: "" }, /tên/i);
bad("tên toàn khoảng trắng / ký tự điều khiển", { ...base, title: " \t\n\u0007 " }, /tên/i);
bad("tên 81 ký tự", { ...base, title: "a".repeat(PERSONAL_TITLE_MAX + 1) }, /80/);
bad("tên không phải chuỗi", { ...base, title: 123 }, /tên/i);
bad("ngày không có thật 31/02", { ...base, dateKey: "2026-02-31" }, /ngày/i);
bad("ngày sai dạng dd/mm/yyyy", { ...base, dateKey: "29/10/2026" }, /ngày/i);
bad("thiếu ngày", { ...base, dateKey: undefined }, /ngày/i);
bad("ngày quá xa trong quá khứ (367 ngày)", { ...base, dateKey: "2025-10-26" }, /quá khứ/);
bad("ngày quá xa trong tương lai (732 ngày)", { ...base, dateKey: "2028-10-29" }, /tương lai/);
bad("giờ bắt đầu 25:00", { ...base, startTime: "25:00" }, /bắt đầu/);
bad("giờ bắt đầu thiếu", { ...base, startTime: undefined }, /bắt đầu/);
bad("giờ kết thúc sai dạng", { ...base, endTime: "9h" }, /kết thúc/);
bad("giờ kết thúc bằng giờ bắt đầu", { ...base, endTime: "19:30" }, /sau giờ bắt đầu/);
bad("giờ kết thúc trước giờ bắt đầu", { ...base, endTime: "18:00" }, /sau giờ bắt đầu/);
bad("ghi chú 301 ký tự", { ...base, note: "b".repeat(PERSONAL_NOTE_MAX + 1) }, /300/);
bad("dữ liệu là mảng", [base], /dạng/);
bad("dữ liệu là null", null, /dạng/);
bad("dữ liệu là chuỗi", "xin chào", /dạng/);
bad("dữ liệu là số", 7, /dạng/);

section("Khoảng ngày khi đọc");
const rg = (a: unknown, b: unknown) => cleanPersonalRange(a, b);
check("một tuần → nhận", rg("2026-10-26", "2026-11-01").ok);
check("một ngày (from = to) → nhận", rg("2026-10-28", "2026-10-28").ok);
check(`đúng ${PERSONAL_RANGE_MAX_DAYS} ngày → nhận; ${PERSONAL_RANGE_MAX_DAYS + 1} ngày → từ chối`, rg("2026-10-01", "2026-11-31".replace("31", "30")).ok === true && !rg("2026-10-01", "2026-12-02").ok);
check("from sau to → từ chối", !rg("2026-11-01", "2026-10-26").ok);
check("thiếu một đầu / sai dạng / ngày không có thật → từ chối", !rg("2026-10-26", undefined).ok && !rg("26/10/2026", "2026-11-01").ok && !rg("2026-02-30", "2026-03-02").ok && !rg(null, null).ok);
done();
