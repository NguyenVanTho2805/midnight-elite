"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Form tạo đề thi đã chuyển sang drawer trong trang danh sách
export default function TaoMoiRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/thi-thu"); }, [router]);
  return null;
}
