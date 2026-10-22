// Giao diện gia sư — bài thuần: màu theo lớp, lời chào, tỉ lệ lấp đầy. Không cần máy chủ.
import { CLASS_ACCENTS, classAccent, greetingForHour, fillPercent } from "@/lib/classColor";
import { check, section, done } from "./h";

(async () => {
  section("classAccent");
  check("cùng mã lớp → luôn cùng màu", classAccent("lop-1") === classAccent("lop-1"));
  check("luôn là một token trong danh sách, không mã hex", ["a", "lop-123", "", "Toán 9 (rà liên kết)", "x".repeat(500)].every(id => (CLASS_ACCENTS as readonly string[]).includes(classAccent(id)) && !/#/.test(classAccent(id))));
  check("20 mã khác nhau dùng ít nhất 3 màu (không dồn về một màu)", new Set(Array.from({ length: 20 }, (_, i) => classAccent(`lop-${i}`))).size >= 3);
  section("greetingForHour");
  check("sáng / trưa / chiều / tối đúng ranh giới", greetingForHour(0) === "Chào buổi sáng" && greetingForHour(10) === "Chào buổi sáng" && greetingForHour(11) === "Chào buổi trưa" && greetingForHour(13) === "Chào buổi trưa" && greetingForHour(14) === "Chào buổi chiều" && greetingForHour(17) === "Chào buổi chiều" && greetingForHour(18) === "Chào buổi tối" && greetingForHour(23) === "Chào buổi tối");
  section("fillPercent");
  check("không giới hạn sĩ số → null; sức chứa 0 hoặc âm → null", fillPercent(5, null) === null && fillPercent(5, 0) === null && fillPercent(5, -3) === null);
  check("0/10 = 0, 5/10 = 50, 10/10 = 100", fillPercent(0, 10) === 0 && fillPercent(5, 10) === 50 && fillPercent(10, 10) === 100);
  check("vượt sức chứa kẹp ở 100, số âm kẹp ở 0", fillPercent(15, 10) === 100 && fillPercent(-2, 10) === 0);
  await done();
})();
