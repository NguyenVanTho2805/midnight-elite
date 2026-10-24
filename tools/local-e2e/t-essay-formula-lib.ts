// Thanh công thức cho ô tự luận (24/10/2026): chỉ chèn chữ thuần, vị trí con trỏ đúng, không HTML, không vượt giới hạn. Thuần, không máy chủ.
import { check, section, done } from "./h";
import { applyFormula, FORMULA_BUTTONS, ESSAY_MAX_CHARS } from "@/lib/essayFormula";

section("Chèn khi không chọn chữ");
let r = applyFormula("Đáp số: ", 8, 8, "square");
check("x² → 'x^2' ở cuối, con trỏ sau ký hiệu", r.value === "Đáp số: x^2" && r.selStart === r.value.length && r.selEnd === r.selStart, r);
r = applyFormula("a=", 2, 2, "sqrt");
check("√x → 'sqrt()' và con trỏ NẰM GIỮA ngoặc", r.value === "a=sqrt()" && r.selStart === 7, r);
r = applyFormula("", 0, 0, "fraction");
check("phân số → '(a)/(b)', con trỏ cuối", r.value === "(a)/(b)" && r.selStart === 7, r);
r = applyFormula("abc", 1, 1, "sqrt");
check("chèn giữa chữ: giữ nguyên hai bên", r.value === "asqrt()bc" && r.selStart === 6, r);

section("Chèn khi đang chọn chữ: bọc đúng đoạn chọn");
r = applyFormula("tính 16 nhé", 5, 7, "sqrt");
check("chọn '16' → 'sqrt(16)'", r.value === "tính sqrt(16) nhé" && r.selStart === 13, r);
r = applyFormula("tính 3 nhé", 5, 6, "fraction");
check("chọn '3' → '(3)/()', con trỏ trong ngoặc thứ hai", r.value === "tính (3)/() nhé" && r.value[r.selStart] === ")" && r.value[r.selStart - 1] === "(", r);
r = applyFormula("x", 0, 1, "square");
check("chọn 'x' → 'x^2'", r.value === "x^2", r);

section("An toàn");
check("[phá cố ý] mọi nút chỉ thêm ký tự chữ-số-ký hiệu thuần (không '<', '>', '&', dấu nháy): thử trên chữ trống và chữ đang chọn", FORMULA_BUTTONS.every(b => /^[a-z0-9^()/]+$/i.test(applyFormula("", 0, 0, b.kind).value) && /^[a-z0-9^()/]+$/i.test(applyFormula("ab12", 0, 4, b.kind).value)));
check("vùng chọn đảo (3,1) = chọn 'bc'; ngoài khoảng được kẹp; NaN = chèn cuối; không ném lỗi", applyFormula("abc", 3, 1, "square").value === "abc^2" && applyFormula("abc", -5, 99, "square").value === "abc^2" && applyFormula("abc", NaN, NaN, "square").value === "abcx^2");
const big = "a".repeat(ESSAY_MAX_CHARS);
check("đầy giới hạn thì giữ nguyên chữ cũ, không cắt cụt", applyFormula(big, big.length, big.length, "sqrt").value === big);
check("3 nút đúng tên và đều có nhãn đọc được", FORMULA_BUTTONS.map(b => b.kind).join() === "square,sqrt,fraction" && FORMULA_BUTTONS.every(b => b.aria.length > 8 && b.label.length > 0));

section("Không để lại dấu sao thô (bài tự luận hiện dưới dạng chữ thuần, không render markdown)");
check("[phá cố ý] KHÔNG nút nào chèn '*' (kể cả khi đang chọn chữ): dấu sao thô sẽ hiện nguyên trong bài của em", FORMULA_BUTTONS.every(b => !applyFormula("", 0, 0, b.kind).value.includes("*") && !applyFormula("quan trọng", 0, 4, b.kind).value.includes("*")));
check("không còn nút 'B' / 'In đậm' nào", !FORMULA_BUTTONS.some(b => b.label === "B" || /đậm/i.test(b.aria) || (b.kind as string) === "bold"));
check("loại lạ ('bold' của bản cũ) không đổi chữ và không chèn 'undefined'", (() => { const r = applyFormula("abc", 0, 3, "bold" as never); return r.value === "abc" && !r.value.includes("undefined"); })());
done();
