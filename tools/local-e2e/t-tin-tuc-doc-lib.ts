// 05/11/2026 (BU-07) — thời lượng đọc của bài tin: hàm THUẦN thoiLuongDoc (src/components/student/tin-tuc/kieu.ts). Không DB, không mạng.
// Ca phá cố ý: đổi Math.ceil thành Math.floor hoặc bỏ Math.max(1, …) → ca "1 từ = 1 phút" và "201 từ = 2 phút" đỏ.
import { TU_MOI_PHUT, thoiLuongDoc } from "@/components/student/tin-tuc/kieu";
import { check, section, done } from "./h";

const tu = (n: number) => Array.from({ length: n }, (_, i) => `từ${i}`).join(" ");
section("thoiLuongDoc");
check("tốc độ đọc là 200 từ/phút", TU_MOI_PHUT === 200);
check("rỗng / toàn khoảng trắng / null → 0 (không hiện)", thoiLuongDoc("") === 0 && thoiLuongDoc("  \n\t ") === 0 && thoiLuongDoc(null, undefined) === 0);
check("1 từ = 1 phút (tối thiểu)", thoiLuongDoc("Chào") === 1);
check("200 từ = 1 phút; 201 từ = 2 phút (làm tròn lên)", thoiLuongDoc(tu(200)) === 1 && thoiLuongDoc(tu(201)) === 2);
check("1000 từ = 5 phút", thoiLuongDoc(tu(1000)) === 5);
check("cộng nhiều đoạn: sapo 100 + nội dung 150 = 250 từ → 2 phút", thoiLuongDoc(tu(100), tu(150)) === 2);
check("xuống dòng, nhiều khoảng trắng liên tiếp không đếm thành từ", thoiLuongDoc("a\n\nb   c\t\td") === 1 && thoiLuongDoc(tu(199) + "\n\n\n   ") === 1);
done();
