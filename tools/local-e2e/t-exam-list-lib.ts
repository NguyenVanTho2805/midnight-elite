// NC2-040 — src/lib/examList.ts: đọc ngày thi dạng chuỗi "dd/mm/yyyy", xếp đề theo thời gian thi (mới nhất trước), gom theo tháng.
// PHÁ CỐ Ý: ngày sai định dạng / không có thật, giờ sai, đề trùng thời điểm, mảng rỗng, không đổi dữ liệu đầu vào.
import { examDateKey, examSortKey, groupExamsByMonth, NO_DATE_KEY } from "@/lib/examList";
import { check, section, done } from "./h";

section("Đọc ngày thi");
check("dd/mm/yyyy → YYYY-MM-DD", examDateKey("09/10/2026") === "2026-10-09");
check("d/m/yyyy thiếu số 0 đầu vẫn đọc được", examDateKey("9/1/2026") === "2026-01-09");
check("yyyy-mm-dd giữ nguyên", examDateKey("2026-10-09") === "2026-10-09");
check("khoảng trắng hai đầu được bỏ", examDateKey("  09/10/2026 ") === "2026-10-09");
for (const [name, v] of [["rỗng", ""], ["null", null], ["undefined", undefined], ["ngày không có thật 31/02", "31/02/2026"], ["tháng 13", "01/13/2026"], ["chữ", "mai"], ["thiếu năm", "09/10"], ["năm 2 số", "09/10/26"], ["ngày 0", "00/10/2026"]] as const)
  check(`${name} → null (không ném lỗi)`, examDateKey(v as string | null | undefined) === null);

section("Khoá sắp xếp");
check("ngày + giờ", examSortKey({ date: "09/10/2026", time: "19:30" }) === "2026-10-09 19:30");
check("giờ 7:05 được chuẩn hoá 07:05", examSortKey({ date: "09/10/2026", time: "7:05" }) === "2026-10-09 07:05");
check("giờ sai / thiếu coi là 00:00 (đề vẫn có ngày)", examSortKey({ date: "09/10/2026", time: "25:99" }) === "2026-10-09 00:00" && examSortKey({ date: "09/10/2026", time: "" }) === "2026-10-09 00:00");
check("ngày không đọc được → null", examSortKey({ date: "mai", time: "19:00" }) === null);

section("Gom theo tháng");
const E = (id: string, date: string, time = "19:00") => ({ id, date, time });
const list = [E("a", "05/10/2026"), E("b", "20/11/2026", "08:00"), E("c", "28/09/2026"), E("d", "12/10/2026", "07:00"), E("e", "12/10/2026", "21:00"), E("x", "chưa rõ"), E("f", "03/01/2027")];
const g = groupExamsByMonth(list);
check("tháng mới nhất trước: 01/2027, 11/2026, 10/2026, 09/2026, rồi 'Chưa có ngày'", g.map(x => x.key).join() === `2027-01,2026-11,2026-10,2026-09,${NO_DATE_KEY}`, g.map(x => x.key));
check("nhãn tháng 'Tháng 10/2026', 'Tháng 1/2027' (không số 0 thừa)", g[2].label === "Tháng 10/2026" && g[0].label === "Tháng 1/2027");
check("trong tháng: giờ muộn hơn đứng trước (12/10 21:00 → 12/10 07:00 → 05/10)", g[2].items.map(x => x.id).join() === "e,d,a");
check("đề không đọc được ngày KHÔNG bị ẩn: nằm nhóm cuối 'Chưa có ngày thi'", g[4].label === "Chưa có ngày thi" && g[4].items.map(x => x.id).join() === "x");
check("tổng không mất, không trùng đề nào", g.flatMap(x => x.items).length === list.length && new Set(g.flatMap(x => x.items.map(i => i.id))).size === list.length);
check("cùng một thời điểm: giữ thứ tự đầu vào (ổn định)", groupExamsByMonth([E("p", "01/10/2026"), E("q", "01/10/2026"), E("r", "01/10/2026")])[0].items.map(x => x.id).join() === "p,q,r");
check("không có đề nào → không có nhóm nào", groupExamsByMonth([]).length === 0);
check("toàn đề không có ngày → chỉ một nhóm 'Chưa có ngày thi'", (() => { const r = groupExamsByMonth([E("u", ""), E("v", "??")]); return r.length === 1 && r[0].key === NO_DATE_KEY && r[0].items.length === 2; })());
check("không đổi mảng đầu vào", list.map(x => x.id).join() === "a,b,c,d,e,x,f");
check("giữ nguyên các trường khác của đề (kiểu mở rộng)", (() => { const r = groupExamsByMonth([{ id: "k", date: "01/10/2026", time: "10:00", title: "Đề K", extra: 7 }]); return r[0].items[0].title === "Đề K" && r[0].items[0].extra === 7; })());
done();
