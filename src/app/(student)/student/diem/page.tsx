// SCL-C (P1-1, HS4) — "Điểm" của học sinh; SCL-G-HS: theo bản chốt khung 3 (theo lớp, x/10, Trung bình, "Đã xong"). Bố cục ở components/student/KetQua.
import type { Metadata } from "next";
import { KinPage, KinPageHeader } from "@/components/kin/PageLayout";
import KetQua from "@/components/student/KetQua";

export const metadata: Metadata = { title: "Điểm — KiN" };

export default function DiemPage() {
  return (
    <KinPage>
      <KinPageHeader title="Điểm" sub="Trung bình chỉ tính các bài đã có điểm. Điểm bạn tự khai cần gia sư duyệt mới được tính." />
      <KetQua />
    </KinPage>
  );
}
