// Nhóm môn tổ hợp THPT (2025+): Khoa học Tự nhiên = Lý+Hóa+Sinh, Khoa học Xã
// hội = Sử+Địa+GDCD — dùng để gợi ý môn con cụ thể khi thêm câu hỏi vào ngân
// hàng (thay vì gõ chung "Xã hội"/"Tự nhiên"), và để Rút đề tự động (Giai
// đoạn 5) rút cân đối giữa các môn con thay vì gộp chung 1 subject dễ bốc
// lệch hẳn về 1 môn. Câu cũ đã gắn "Xã hội"/"Tự nhiên" trước khi có danh
// sách này KHÔNG bị đổi tự động — vẫn hiển thị/dùng được bình thường, chỉ
// không tham gia rút cân đối theo môn con cho tới khi được sửa lại thủ công.
export interface SubjectGroup {
  group: string;
  subjects: string[];
}

export const SUBJECT_GROUPS: SubjectGroup[] = [
  { group: "Khoa học Tự nhiên", subjects: ["Vật Lý", "Hóa Học", "Sinh Học"] },
  { group: "Khoa học Xã hội", subjects: ["Lịch Sử", "Địa Lý", "GDCD"] },
];
