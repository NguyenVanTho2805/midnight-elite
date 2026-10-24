import { CHILD_LIST_MAX, CHILD_NAME_MAX, parseChildList, rememberChild, removeChild, serializeChildList } from "@/lib/parentChildList";
import { check, section, done } from "./h";

const tok = (n: number) => n.toString(16).padStart(32, "0");
section("parseChildList — dữ liệu hỏng không làm hỏng trang");
check("null / rỗng → []", parseChildList(null).length === 0 && parseChildList("").length === 0 && parseChildList(undefined).length === 0);
check("JSON hỏng → []", parseChildList("{khong phai json").length === 0);
check("không phải mảng → []", parseChildList('{"token":"x"}').length === 0 && parseChildList("123").length === 0 && parseChildList("null").length === 0);
check("token sai dạng (ngắn, hoa, có ký tự lạ, số) bị bỏ", parseChildList(JSON.stringify([{ token: "abc", name: "A" }, { token: tok(10).toUpperCase(), name: "B" }, { token: tok(2) + "z", name: "C" }, { token: 5, name: "D" }, null, "x"])).length === 0);
check("tên rỗng / không phải chữ bị bỏ", parseChildList(JSON.stringify([{ token: tok(1), name: "  " }, { token: tok(2), name: 7 }])).length === 0);
check("trùng token chỉ giữ một", parseChildList(JSON.stringify([{ token: tok(1), name: "A" }, { token: tok(1), name: "B" }])).length === 1);
check("quá giới hạn thì cắt ở " + CHILD_LIST_MAX, parseChildList(JSON.stringify(Array.from({ length: 30 }, (_, i) => ({ token: tok(i + 1), name: "E" + i })))).length === CHILD_LIST_MAX);
const dirty = parseChildList(JSON.stringify([{ token: tok(1), name: "<img src=x onerror=alert(1)>" + "A".repeat(200) }]));
check("tên bị lọc < > và cắt ngắn", dirty.length === 1 && !/[<>]/.test(dirty[0].name) && dirty[0].name.length <= CHILD_NAME_MAX, dirty);

section("rememberChild");
let l = rememberChild([], { token: tok(1), name: "Gia Bảo" });
l = rememberChild(l, { token: tok(2), name: "Đỗ Hà" });
check("thêm em thứ hai: 2 em, giữ thứ tự mở", l.map(c => c.name).join() === "Gia Bảo,Đỗ Hà");
l = rememberChild(l, { token: tok(1), name: "Gia Bảo (đổi tên)" });
check("mở lại em đã có: không nhân đôi, cập nhật tên tại chỗ, không đổi thứ tự", l.length === 2 && l[0].name === "Gia Bảo (đổi tên)" && l[1].token === tok(2), l);
check("token sai dạng / tên rỗng: danh sách không đổi", rememberChild(l, { token: "bad", name: "X" }) === l && rememberChild(l, { token: tok(3), name: "  " }) === l);
let full = l; for (let i = 3; i < 20; i++) full = rememberChild(full, { token: tok(i), name: "E" + i });
check("không vượt giới hạn, em mới nhất còn", full.length === CHILD_LIST_MAX && full[full.length - 1].token === tok(19), full.length);

section("serialize / remove");
check("khứ hồi giữ nguyên", JSON.stringify(parseChildList(serializeChildList(l))) === JSON.stringify(l));
check("serialize chỉ có token + tên (không thêm dữ liệu nào khác của em)", Object.keys(JSON.parse(serializeChildList([{ ...l[0], school: "THCS A" } as never]))[0]).sort().join() === "name,token");
check("removeChild", removeChild(l, tok(1)).length === 1 && removeChild(l, "khong-co").length === 2);
done();
