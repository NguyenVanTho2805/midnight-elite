"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Form tạo khoá học đã chuyển sang drawer trong trang danh sách; ?tao=1 mở sẵn drawer để đường cũ (bookmark, liên kết) vẫn tới đúng việc "tạo mới"
export default function TaoMoiRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/khoa-hoc?tao=1"); }, [router]);
  return null;
}
