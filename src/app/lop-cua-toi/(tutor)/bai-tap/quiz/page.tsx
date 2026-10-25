// /lop-cua-toi/bai-tap/quiz không có trang riêng: danh sách quiz nằm ở Bài tập. Chuyển thẳng (307, mặc định của redirect) để địa chỉ cụt không thành 404.
import { redirect } from "next/navigation";

export default function QuizIndexPage() {
  redirect("/lop-cua-toi/bai-tap");
}
