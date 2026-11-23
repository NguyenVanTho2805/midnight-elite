import { redirect } from "next/navigation";
import { STUDENT_HOME } from "@/lib/landing";

export default function StudentDashboardPage() {
  redirect(STUDENT_HOME); // 23/11/2026: trang đầu học sinh là Lớp
}
