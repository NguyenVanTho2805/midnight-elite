// Hàng chờ một cửa (BU-08): bảng + panel bên, lọc theo loại bằng ?loai=.
import { Suspense } from "react";
import type { Metadata } from "next";
import HangCho from "@/components/admin/HangCho";
import { QueueSkeleton } from "@/components/admin/queue/shared";

export const metadata: Metadata = { title: "Hàng chờ — KiN" };

export default function KiemDuyetPage() {
  return (
    <Suspense fallback={<div className="p-4 sm:p-6"><QueueSkeleton /></div>}>
      <HangCho />
    </Suspense>
  );
}
