"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Form tạo khoá học đã chuyển sang drawer trong trang danh sách
export default function TaoMoiRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/khoa-hoc"); }, [router]);
  return null;
}
