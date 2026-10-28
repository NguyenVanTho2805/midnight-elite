// Tra cứu học viên theo số điện thoại — phần thuần src/lib/traCuu.ts: che tên khi trả cho người CHƯA đăng nhập.
import { maskName } from "@/lib/traCuu";
import { check, section, done } from "./h";

section("maskName — chỉ chữ cái đầu của từng từ");
check("'Nguyễn Minh Anh' → 'N••• M••• A•••'", maskName("Nguyễn Minh Anh") === "N••• M••• A•••", maskName("Nguyễn Minh Anh"));
check("viết thường vẫn ra chữ hoa đầu từ", maskName("lê văn tâm") === "L••• V••• T•••", maskName("lê văn tâm"));
check("một từ → 'A•••'", maskName("Linh") === "L•••", maskName("Linh"));
check("khoảng trắng thừa / nhiều dấu cách / xuống dòng không sinh từ rỗng", maskName("  Trần   Thị \n Bích  Ngọc ") === "T••• T••• B••• N•••", maskName("  Trần   Thị \n Bích  Ngọc "));

section("maskName — tiếng Việt và không lộ độ dài");
check("tên gõ dạng NFD (dấu rời) → chữ cái đầu vẫn giữ nguyên dấu, không bị cắt giữa chữ và dấu", maskName("Ơn Việt".normalize("NFD")) === "Ơ••• V•••", maskName("Ơn Việt".normalize("NFD")));
check("chữ Đ ở đầu từ giữ nguyên (không biến thành D)", maskName("đỗ Quyên") === "Đ••• Q•••", maskName("đỗ Quyên"));
check("tên rất dài và tên rất ngắn cùng số từ → cùng độ dài kết quả (không lộ độ dài tên)", maskName("Nguyễn Hoàng Thiên Phúc Bảo").length === maskName("Lê Bo Ân Vi Tú").length);
check("kết quả không chứa chữ nào ngoài chữ cái đầu của mỗi từ", !/[a-zà-ỹ]/.test(maskName("Nguyễn Minh Anh").replace(/[NMA]•••/g, "").replace(/\s/g, "")));
check("không lọt tên đầy đủ: 'Nguyễn', 'Minh', 'Anh' đều vắng mặt", !/Nguy|inh|nh\b/.test(maskName("Nguyễn Minh Anh")));
check("emoji / ký tự ngoài mặt phẳng cơ bản đứng đầu từ → lấy trọn một ký tự, không vỡ nửa chữ", maskName("😀bé Na") === "😀••• N•••", maskName("😀bé Na"));

section("maskName — đầu vào xấu");
check("rỗng → '•••'", maskName("") === "•••");
check("toàn khoảng trắng → '•••'", maskName("   \n ") === "•••");

void done();
