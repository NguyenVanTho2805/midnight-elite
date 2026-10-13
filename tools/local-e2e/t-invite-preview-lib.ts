// Xem trước lớp khi nhập mã mời — chữ lịch / học phí / số buổi (src/lib/invitePreview.ts).
import { check, section, done } from "./h";
import { scheduleLabel, taughtLabel, tuitionLabel, tuitionPreview } from "@/lib/invitePreview";

// dayOfWeek khớp Date.getDay(): 0 = Chủ nhật, 1 = Thứ 2, 2 = Thứ 3 … 6 = Thứ 7
const slot = (d: number, a = "19:30", b = "21:30") => ({ dayOfWeek: d, startTime: a, endTime: b });

section("Lịch học");
check("Figma 32:71: Thứ 3 & Thứ 5 · 19:30–21:30", scheduleLabel([slot(2), slot(4)]) === "Thứ 3 & Thứ 5 · 19:30–21:30");
check("một buổi một tuần: 'Thứ 7 · 15:00–17:00'", scheduleLabel([slot(6, "15:00", "17:00")]) === "Thứ 7 · 15:00–17:00");
check("ba buổi cùng giờ: dấu phẩy + '&' ở cuối", scheduleLabel([slot(1), slot(3), slot(5)]) === "Thứ 2, Thứ 4 & Thứ 6 · 19:30–21:30");
check("thứ tự theo tuần (Thứ 2 → Chủ nhật), không theo thứ tự nhập; Chủ nhật đứng cuối", scheduleLabel([slot(0), slot(1)]) === "Thứ 2 & Chủ nhật · 19:30–21:30");
check("khác giờ: tách nhóm", scheduleLabel([slot(2, "19:00", "21:00"), slot(6, "15:00", "17:00")]) === "Thứ 3 19:00–21:00 · Thứ 7 15:00–17:00");
check("trùng ngày trùng giờ chỉ in một lần", scheduleLabel([slot(2), slot(2)]) === "Thứ 3 · 19:30–21:30");
check("chưa có lịch → câu rõ ràng, không để trống", scheduleLabel([]) === "Gia sư chưa đặt lịch cố định");

section("Học phí");
check("Figma 32:74: 3 môn → '55.000đ một buổi khi học 3 môn · tính theo tháng'", tuitionLabel(tuitionPreview(2, null)) === "55.000đ một buổi khi học 3 môn · tính theo tháng");
check("chưa học môn nào của gia sư này → 1 môn 70.000đ", tuitionLabel(tuitionPreview(0, null)) === "70.000đ một buổi khi học 1 môn · tính theo tháng");
check("đang học 1 môn, vào thêm môn này → 2 môn 60.000đ", tuitionLabel(tuitionPreview(1, null)) === "60.000đ một buổi khi học 2 môn · tính theo tháng");
check("từ 4 môn: bậc cuối 50.000đ, ghi 'trở lên' (không hứa giảm tiếp)", tuitionLabel(tuitionPreview(3, null)) === "50.000đ một buổi khi học 4 môn trở lên · tính theo tháng" && tuitionLabel(tuitionPreview(6, null)).includes("4 môn trở lên"));
check("có mức riêng của em: dùng mức đó, ghi rõ, bỏ bậc thang", tuitionLabel(tuitionPreview(2, 40_000)) === "40.000đ một buổi (mức riêng của em) · tính theo tháng");
check("mức riêng 0đ vẫn là mức riêng (miễn phí), không rơi về bậc thang", tuitionPreview(1, 0).pricePerSession === 0 && tuitionPreview(1, 0).override === true);
check("số môn đếm cả môn này (+1); số âm không làm hỏng", tuitionPreview(2, null).subjectCount === 3 && tuitionPreview(-5, null).subjectCount === 1);

section("Số buổi đã học");
check("0 → 'Chưa học buổi nào'; 12 → '12 buổi'", taughtLabel(0) === "Chưa học buổi nào" && taughtLabel(12) === "12 buổi");

done();
