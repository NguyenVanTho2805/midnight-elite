"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Form chỉnh sửa đề thi đã chuyển sang drawer trong trang danh sách
export default function EditThiThuRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/thi-thu"); }, [router]);
  return null;
}
