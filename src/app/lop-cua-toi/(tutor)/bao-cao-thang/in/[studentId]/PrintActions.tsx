// Nút trên trang in (client vì dùng kinButtonClass / window.print): đổi giữa bản có thương hiệu và mẫu KiN, và "In / Lưu thành PDF" (hộp thoại in của trình duyệt, không thêm thư viện).
"use client";
import Link from "next/link";
import { KinButton, kinButtonClass } from "@/components/kin";

export function PrintActions({ studentId, yearMonth, hasBrand, useKin }: { studentId: string; yearMonth: string; hasBrand: boolean; useKin: boolean }) {
  const base = `/lop-cua-toi/bao-cao-thang/in/${studentId}?yearMonth=${yearMonth}`;
  return (
    <>
      {hasBrand && (useKin
        ? <Link href={base} className={kinButtonClass("secondary")}>Xem bản có thương hiệu</Link>
        : <Link href={`${base}&mau=kin`} className={kinButtonClass("secondary")}>In bằng mẫu KiN</Link>)}
      <KinButton onClick={() => window.print()}>In / Lưu thành PDF</KinButton>
    </>
  );
}

export function BackToReports() {
  return <Link href="/lop-cua-toi/bao-cao-thang" className={kinButtonClass("primary")}>Về Báo cáo tháng</Link>;
}
