// Gia sư dời / huỷ buổi — logic thuần: khai triển buổi hiệu lực, kiểm dữ liệu, tin nhắn, dòng gợi ý báo cáo tháng.
import { check, section, done } from "./h";
import { applyChanges, effectiveSlot, parseChangeInput, sessionChangeMessage, sessionRestoredMessage, describeChange, changesToTutorChanged, whenText, type SessionChange } from "@/lib/sessionChange";
import { hmOf, vnDateKeyOf, vnMinutesOfDay, instantOf } from "@/lib/classSessions";
import { suggestUnmetItems } from "@/lib/monthlyReport";

// 2026-10-12 là thứ Hai. NOW = 10:00 giờ VN hôm đó.
const NOW = new Date("2026-10-12T03:00:00Z");
const TUE = { id: "r1", courseId: "c1", dayOfWeek: 2, startTime: "19:00", endTime: "21:00" };
const THU = { id: "r2", courseId: "c1", dayOfWeek: 4, startTime: "20:00", endTime: "21:30" };
const rules = [TUE, THU];
const ch = (o: Partial<SessionChange> & Pick<SessionChange, "scheduleId" | "dateKey" | "kind">): SessionChange => ({ newDateKey: null, newStartTime: null, newEndTime: null, reason: null, ...o });
const hm = (d: Date) => hmOf(vnMinutesOfDay(d));
const keyOf = (d: Date) => vnDateKeyOf(d);

section("Không có thay đổi: giống lịch tuần");
const plain = applyChanges(rules, [], "2026-10-12", "2026-10-18");
check("2 buổi (T3 13/10, T5 15/10), status scheduled, ngày gốc = ngày hiệu lực", plain.length === 2 && plain.map(o => o.dateKey).join() === "2026-10-13,2026-10-15" && plain.every(o => o.status === "scheduled" && o.originalDateKey === o.dateKey && o.movedFrom === null && o.change === null));

section("Huỷ");
const canc = applyChanges(rules, [ch({ scheduleId: "r1", dateKey: "2026-10-13", kind: "cancel", reason: "ốm" })], "2026-10-12", "2026-10-18");
check("buổi huỷ vẫn ở ngày gốc, status cancelled, giữ giờ gốc 19:00–21:00 và lý do", canc.length === 2 && canc[0].status === "cancelled" && canc[0].dateKey === "2026-10-13" && hm(canc[0].startAt) === "19:00" && hm(canc[0].endAt) === "21:00" && canc[0].change?.reason === "ốm");
check("buổi khác không bị ảnh hưởng", canc[1].status === "scheduled" && canc[1].dateKey === "2026-10-15");

section("Dời");
const mv = ch({ scheduleId: "r1", dateKey: "2026-10-13", kind: "move", newDateKey: "2026-10-14", newStartTime: "20:00", newEndTime: "22:00" });
const moved = applyChanges(rules, [mv], "2026-10-12", "2026-10-18");
const m0 = moved[0];
check("buổi dời hiện ở T4 14/10 20:00–22:00; ngày 13/10 KHÔNG còn buổi", moved.length === 2 && m0.dateKey === "2026-10-14" && hm(m0.startAt) === "20:00" && hm(m0.endAt) === "22:00" && !moved.some(o => o.dateKey === "2026-10-13"));
check("giữ định danh gốc (13/10) + ghi 'dời từ' (13/10 19:00)", m0.status === "moved" && m0.originalDateKey === "2026-10-13" && m0.movedFrom?.dateKey === "2026-10-13" && hm(m0.movedFrom!.startAt) === "19:00");
check("cửa sổ chỉ chứa NGÀY MỚI (14/10) vẫn thấy buổi dời dù ngày gốc nằm ngoài", applyChanges(rules, [mv], "2026-10-14", "2026-10-14").map(o => o.originalDateKey).join() === "2026-10-13");
check("cửa sổ chỉ chứa NGÀY GỐC (13/10) KHÔNG thấy buổi (đã dời đi)", applyChanges(rules, [mv], "2026-10-13", "2026-10-13").length === 0);
const prevWeek = ch({ scheduleId: "r1", dateKey: "2026-10-06", kind: "move", newDateKey: "2026-10-14", newStartTime: "18:00", newEndTime: "19:30" });
check("buổi có ngày gốc ở TUẦN TRƯỚC dời vào tuần này → hiện ở tuần này (dựng từ khung giờ)", applyChanges(rules, [prevWeek], "2026-10-12", "2026-10-18").some(o => o.originalDateKey === "2026-10-06" && o.dateKey === "2026-10-14" && o.status === "moved"));
const sameDay = applyChanges(rules, [ch({ scheduleId: "r1", dateKey: "2026-10-13", kind: "move", newDateKey: "2026-10-13", newStartTime: "17:00", newEndTime: "18:30" })], "2026-10-12", "2026-10-18");
check("đổi giờ trong NGÀY: vẫn ở 13/10 nhưng là 17:00–18:30, status moved", sameDay[0].dateKey === "2026-10-13" && hm(sameDay[0].startAt) === "17:00" && sameDay[0].status === "moved");
const noEnd = effectiveSlot(TUE, "2026-10-13", ch({ scheduleId: "r1", dateKey: "2026-10-13", kind: "move", newDateKey: "2026-10-14", newStartTime: "10:00" }))!;
check("thiếu giờ kết thúc mới → giữ độ dài buổi gốc (2 giờ): 10:00–12:00", hm(noEnd.startAt) === "10:00" && hm(noEnd.endAt) === "12:00");
check("sắp theo giờ bắt đầu thật (buổi dời lên 18:00 T5 đứng trước 20:00 T5)", applyChanges(rules, [ch({ scheduleId: "r1", dateKey: "2026-10-13", kind: "move", newDateKey: "2026-10-15", newStartTime: "18:00", newEndTime: "19:00" })], "2026-10-12", "2026-10-18").map(o => `${o.scheduleId}@${hm(o.startAt)}`).join() === "r1@18:00,r2@20:00");

section("Dữ liệu hỏng / không khớp bị bỏ qua, không làm hỏng cả lịch");
check("khung giờ ngừng hoạt động: không dựng buổi dời vào", applyChanges([{ ...TUE, active: false }, THU], [prevWeek], "2026-10-12", "2026-10-18").every(o => o.scheduleId === "r2"));
check("thay đổi của khung giờ không tồn tại bị bỏ qua", applyChanges(rules, [ch({ scheduleId: "khong-co", dateKey: "2026-10-13", kind: "cancel" })], "2026-10-12", "2026-10-18").length === 2);
check("ngày gốc không đúng thứ của khung (13/10 không phải thứ Năm) bị bỏ qua", applyChanges(rules, [ch({ scheduleId: "r2", dateKey: "2026-10-06", kind: "move", newDateKey: "2026-10-14", newStartTime: "20:00" })], "2026-10-12", "2026-10-18").length === 2);
check("giờ mới sai định dạng → coi như không đổi giờ (không ném lỗi)", (() => { const s = effectiveSlot(TUE, "2026-10-13", ch({ scheduleId: "r1", dateKey: "2026-10-13", kind: "move", newDateKey: "2026-10-14", newStartTime: "bảy giờ" })); return s?.status === "scheduled" && s.dateKey === "2026-10-13"; })());
check("khung giờ có giờ bắt đầu hỏng → null", effectiveSlot({ ...TUE, startTime: "xx" }, "2026-10-13", null) === null);

section("Kiểm dữ liệu gia sư gửi lên");
const P = (body: unknown, dateKey = "2026-10-13", now = NOW) => parseChangeInput(body, { rule: TUE, dateKey, now });
const okMove = (o: Record<string, unknown> = {}) => P({ kind: "move", newDateKey: "2026-10-14", newStartTime: "20:00", newEndTime: "22:00", ...o });
const c1 = P({ kind: "cancel", reason: "  Em   ốm  " });
check("huỷ hợp lệ: lý do được gọn khoảng trắng", c1.ok && c1.value.kind === "cancel" && c1.value.reason === "Em ốm" && c1.value.newDateKey === null);
check("huỷ không lý do → reason null", (P({ kind: "cancel" }) as any).value.reason === null);
const mvOk = okMove();
check("dời hợp lệ", mvOk.ok && mvOk.value.newDateKey === "2026-10-14" && mvOk.value.newStartTime === "20:00" && mvOk.value.newEndTime === "22:00");
check("giờ '9:05' chuẩn hoá thành '09:05'", (okMove({ newStartTime: "9:05", newEndTime: "11:00" }) as any).value.newStartTime === "09:05");
check("không gửi giờ kết thúc → giữ độ dài 2 giờ", (okMove({ newStartTime: "10:00", newEndTime: undefined }) as any).value.newEndTime === "12:00");
check("body không phải object / mảng / null → lỗi", !P(null).ok && !P([]).ok && !P("x").ok);
check("kind lạ → lỗi", !P({ kind: "xoa" }).ok && !P({}).ok);
check("lý do không phải chữ → lỗi; lý do > 300 ký tự → lỗi; đúng 300 → được", !P({ kind: "cancel", reason: 5 }).ok && !P({ kind: "cancel", reason: "a".repeat(301) }).ok && P({ kind: "cancel", reason: "a".repeat(300) }).ok);
check("ngày gốc không đúng thứ của khung (T4 14/10) → lỗi", !P({ kind: "cancel" }, "2026-10-14").ok && /không có buổi học/.test((P({ kind: "cancel" }, "2026-10-14") as any).error));
check("ngày gốc không tồn tại (31/02) → lỗi", !P({ kind: "cancel" }, "2026-02-31").ok);
check("buổi ĐÃ BẮT ĐẦU (19:01 ngày 13/10) → không đổi được; còn 1 phút → được", !P({ kind: "cancel" }, "2026-10-13", new Date("2026-10-13T12:01:00Z")).ok && P({ kind: "cancel" }, "2026-10-13", new Date("2026-10-13T11:59:00Z")).ok);
check("buổi đã qua → lỗi 'đã bắt đầu hoặc đã qua'", /đã bắt đầu hoặc đã qua/.test((P({ kind: "cancel" }, "2026-10-06") as any).error));
check("ngày mới thiếu / sai định dạng / không tồn tại → lỗi", !okMove({ newDateKey: undefined }).ok && !okMove({ newDateKey: "14/10" }).ok && !okMove({ newDateKey: "2026-02-30" }).ok && !okMove({ newDateKey: 20261014 }).ok);
check("giờ bắt đầu mới sai ('25:00', 'bảy giờ', thiếu) → lỗi", !okMove({ newStartTime: "25:00" }).ok && !okMove({ newStartTime: "bảy giờ" }).ok && !okMove({ newStartTime: undefined }).ok);
check("giờ kết thúc ≤ giờ bắt đầu → lỗi; giờ kết thúc sai → lỗi", !okMove({ newStartTime: "20:00", newEndTime: "20:00" }).ok && !okMove({ newEndTime: "19:00" }).ok && !okMove({ newEndTime: "abc" }).ok);
check("không có giờ kết thúc mà 23:00 + 2 giờ vượt 24:00 → lỗi; có giờ kết thúc 23:59 → được", !okMove({ newStartTime: "23:00", newEndTime: undefined }).ok && okMove({ newStartTime: "23:00", newEndTime: "23:59" }).ok);
check("thời điểm mới ở quá khứ (hôm nay 09:00 khi đang 10:00) → lỗi", !okMove({ newDateKey: "2026-10-12", newStartTime: "09:00", newEndTime: "10:00" }).ok && /tương lai/.test((okMove({ newDateKey: "2026-10-12", newStartTime: "09:00", newEndTime: "10:00" }) as any).error));
check("hôm nay 11:00 (sau giờ hiện tại 10:00) → được", okMove({ newDateKey: "2026-10-12", newStartTime: "11:00", newEndTime: "12:00" }).ok);
check("tối đa 60 ngày: 11/12 (60 ngày sau) được, 12/12 (61) bị từ chối", okMove({ newDateKey: "2026-12-11" }).ok && !okMove({ newDateKey: "2026-12-12" }).ok);
check("ngày mới là một ngày học khác của khung này (T3 20/10) → lỗi 'đã là ngày học'", /đã là ngày học/.test((okMove({ newDateKey: "2026-10-20" }) as any).error));
check("đổi giờ trong chính ngày gốc → được; trùng hệt lịch cũ → lỗi 'chưa có gì để đổi'", okMove({ newDateKey: "2026-10-13", newStartTime: "17:00", newEndTime: "18:30" }).ok && /chưa có gì để đổi/.test((okMove({ newDateKey: "2026-10-13", newStartTime: "19:00", newEndTime: "21:00" }) as any).error));
check("giờ học của khung hỏng → báo rõ để gia sư sửa", /chưa đặt đúng/.test((parseChangeInput({ kind: "cancel" }, { rule: { ...TUE, startTime: "xx" }, dateKey: "2026-10-13", now: NOW }) as any).error));

section("Tin báo lớp (chung, không tên em / điểm / tiền / link)");
const orig = instantOf("2026-10-13", 19 * 60), nw = instantOf("2026-10-14", 20 * 60);
const mc = sessionChangeMessage({ kind: "cancel", subject: "Toán 9", originalStartAt: orig, reason: "Cô ốm.", tutorName: "Lan" });
check("huỷ: nêu môn, giờ, ngày, chữ HUỶ, lý do (bỏ dấu chấm thừa), chữ ký Thầy/Cô Lan", mc.includes("Toán 9") && mc.includes("19:00 thứ Ba 13/10") && mc.includes("HUỶ") && mc.includes("Lý do: Cô ốm.") && !mc.includes("ốm..") && mc.includes("Thầy/Cô Lan"), mc);
const mm = sessionChangeMessage({ kind: "move", subject: "Toán 9", originalStartAt: orig, newStartAt: nw, tutorName: "Cô Lan" });
check("dời: nêu giờ cũ và giờ mới, chữ DỜI, không có 'Lý do' khi trống, giữ 'Cô Lan' (không thêm 'Thầy/')", mm.includes("19:00 thứ Ba 13/10") && mm.includes("DỜI sang 20:00 thứ Tư 14/10") && !mm.includes("Lý do") && mm.includes("\nCô Lan") && !mm.includes("Thầy/Cô Cô"), mm);
check("tin không có link / số tiền / điểm", ![mc, mm].some(t => /https?:|đ\b|điểm/.test(t)));
check("không có tên gia sư → không có dòng chữ ký", !sessionChangeMessage({ kind: "cancel", subject: "Toán 9", originalStartAt: orig }).includes("Thầy/Cô"));
check("tin khôi phục: GIỮ NGUYÊN lịch", sessionRestoredMessage({ subject: "Toán 9", originalStartAt: orig, tutorName: "Lan" }).includes("GIỮ NGUYÊN") && whenText(orig) === "19:00 thứ Ba 13/10");
check("describeChange: huỷ / dời", describeChange({ kind: "cancel", originalStartAt: orig }) === "buổi 19:00 thứ Ba 13/10 được huỷ" && describeChange({ kind: "move", originalStartAt: orig, newStartAt: nw }) === "buổi 19:00 thứ Ba 13/10 dời sang 20:00 thứ Tư 14/10");

section("Dòng gợi ý loại 4 trong báo cáo tháng");
const tc = changesToTutorChanged([
  { dateKey: "2026-10-20", kind: "move", courseName: "Toán 9" }, { dateKey: "2026-10-13", kind: "cancel", courseName: "Văn 9" }, { dateKey: "2026-10-13", kind: "move", courseName: "Anh 9" },
]);
check("sắp theo ngày rồi tên lớp; cancel→huy, move→doi", tc.map(c => `${c.dateKey}:${c.courseName}:${c.action}`).join("|") === "2026-10-13:Anh 9:doi|2026-10-13:Văn 9:huy|2026-10-20:Toán 9:doi");
const items = suggestUnmetItems([], "2026-10", tc);
check("mỗi buổi đổi → một dòng kind 'doi-buoi', đúng ngày dd/mm, đúng chữ huỷ/dời, nói rõ là lỗi sắp xếp của gia sư", items.length === 3 && items.every(i => i.kind === "doi-buoi") && items[1].text.includes("Văn 9") && items[1].text.includes("13/10") && items[1].text.includes("huỷ") && items[0].text.includes("dời") && items.every(i => i.text.includes("không phải của em")), items.map(i => i.text));
check("không có thay đổi → không có dòng loại 4", suggestUnmetItems([], "2026-10", []).length === 0);
done();
