// Lịch học của học sinh (Figma "Học sinh · Lịch học" 299:114537). Dữ liệu và bố cục nằm ở components/student/LichHoc.
import type { Metadata } from "next";
import LichHoc from "@/components/student/LichHoc";

export const metadata: Metadata = { title: "Lịch học — KiN" };

export default function LichHocPage() {
  return <LichHoc />;
}
