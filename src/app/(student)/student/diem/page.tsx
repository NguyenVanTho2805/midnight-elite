// SCL-C (P1-1, HS4) — "Điểm" của học sinh: điểm / trạng thái từng bài ở mọi lớp đang học (trước đây /student/diem là 404).
import type { Metadata } from "next";
import { KinPage, KinPageHeader } from "@/components/kin/PageLayout";
import KetQua from "@/components/student/KetQua";

export const metadata: Metadata = { title: "Điểm — KiN" };

export default function DiemPage() {
  return (
    <KinPage>
      <KinPageHeader title="Điểm của bạn" sub="Bài tập, quiz và đề của các lớp bạn đang học. Điểm bạn tự khai cần gia sư duyệt mới được tính." />
      <KetQua />
    </KinPage>
  );
}
