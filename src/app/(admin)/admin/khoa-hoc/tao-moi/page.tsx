"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useContentHref } from "@/components/tutor/useContentHref";

// Form tạo khoá học đã chuyển sang drawer trong trang danh sách; ?tao=1 mở sẵn drawer để đường cũ (bookmark, liên kết) vẫn tới đúng việc "tạo mới".
// BU-00 bước 3: chờ biết vai rồi mới chuyển — gia sư (mở ở bí danh /lop-cua-toi/quan-lop/tao-moi) đi thẳng /lop-cua-toi/quan-lop?tao=1, không đi vòng qua /admin rồi 307.
export default function TaoMoiRedirect() {
  const router = useRouter();
  const { isLoading } = useAuth();
  const href = useContentHref();
  useEffect(() => { if (!isLoading) router.replace(href("/admin/khoa-hoc?tao=1")); }, [router, href, isLoading]);
  return null;
}
