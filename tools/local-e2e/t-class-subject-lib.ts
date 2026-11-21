// SCL-F2 (P2-25) — src/lib/classSubject.ts: "Môn · khối" chọn từ danh sách cố định, dữ liệu cũ chỉ chuẩn hoá lúc hiển thị.
// Ca phá cố ý đã thử: bỏ ALIASES["ly"] → ca viết tắt đỏ; bỏ nhánh giữ chữ cũ trong splitCategory (trả "" khi không nhận ra) → ca "Luyện viết chữ đẹp" đỏ;
// optionsWith không thêm giá trị cũ → ca "giá trị cũ vẫn có trong lựa chọn" đỏ. Đã trả lại mã, bài xanh.
import { CLASS_GRADES, CLASS_SUBJECTS, joinCategory, normalizeGrade, normalizeSubject, optionsWith, splitCategory } from "@/lib/classSubject";
import { check, section, done } from "./h";

section("normalizeSubject / normalizeGrade");
check("môn chuẩn giữ nguyên; viết tắt, không dấu, hoa thường → môn chuẩn", normalizeSubject("Toán") === "Toán" && normalizeSubject("toan") === "Toán" && normalizeSubject("NGỮ VĂN") === "Ngữ văn" && normalizeSubject("ly") === "Vật lý" && normalizeSubject("Hóa học") === "Hoá học");
check("kỳ thi cũ (ĐGNL HSA) nằm trong danh sách", normalizeSubject("ĐGNL HSA") === "ĐGNL HSA" && CLASS_SUBJECTS.includes("ĐGNL HSA"));
check("không nhận ra → null", normalizeSubject("Luyện viết chữ đẹp") === null && normalizeSubject("") === null);
check("khối: 'Lớp 9', 'lop9', '9', 'L12', 'ôn thi' → chuẩn; 13, 0, chữ lạ → null", normalizeGrade("Lớp 9") === "Lớp 9" && normalizeGrade("lop9") === "Lớp 9" && normalizeGrade("9") === "Lớp 9" && normalizeGrade("L12") === "Lớp 12" && normalizeGrade("ôn thi") === "Ôn thi" && normalizeGrade("13") === null && normalizeGrade("0") === null && normalizeGrade("cấp tốc") === null);
check("CLASS_GRADES đủ Lớp 1–12 + Ôn thi", CLASS_GRADES.length === 13 && CLASS_GRADES[0] === "Lớp 1" && CLASS_GRADES[11] === "Lớp 12");

section("splitCategory — chuẩn hoá khi hiển thị, không mất chữ cũ");
const a = splitCategory("toan · lop 9");
check("'toan · lop 9' → Toán / Lớp 9", a.subject === "Toán" && a.grade === "Lớp 9", a);
const b = splitCategory("Luyện viết chữ đẹp");
check("môn lạ giữ NGUYÊN chữ cũ, khối rỗng", b.subject === "Luyện viết chữ đẹp" && b.grade === "", b);
const c = splitCategory("Toán · cấp tốc hè");
check("khối lạ giữ nguyên chữ cũ", c.subject === "Toán" && c.grade === "cấp tốc hè", c);
check("rỗng / null → hai ô rỗng", JSON.stringify(splitCategory("")) === JSON.stringify({ subject: "", grade: "" }) && splitCategory(null).subject === "");
check("dấu '|' cũng là phân cách", splitCategory("Anh | 7").subject === "Tiếng Anh" && splitCategory("Anh | 7").grade === "Lớp 7");

section("joinCategory / optionsWith");
check("ghép 'Toán' + 'Lớp 9' → 'Toán · Lớp 9'; không khối → chỉ môn; không môn → 'Khác'", joinCategory("Toán", "Lớp 9") === "Toán · Lớp 9" && joinCategory("Toán", "") === "Toán" && joinCategory("", "") === "Khác");
check("đi vòng: split(join(x)) = x với mọi môn × khối chuẩn", CLASS_SUBJECTS.every(s => CLASS_GRADES.every(g => { const r = splitCategory(joinCategory(s, g)); return r.subject === s && r.grade === g; })));
check("giá trị cũ vẫn có trong lựa chọn (không mất khi lưu lại)", optionsWith(CLASS_SUBJECTS, "Luyện viết chữ đẹp").includes("Luyện viết chữ đẹp") && optionsWith(CLASS_SUBJECTS, "Toán").length === CLASS_SUBJECTS.length && optionsWith(CLASS_SUBJECTS, "").length === CLASS_SUBJECTS.length);

done();
