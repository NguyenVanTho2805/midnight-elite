"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useContentHref } from "@/components/tutor/useContentHref";

// Form tạo đề thi đã chuyển sang drawer trong trang danh sách.
// BU-00 bước 3: chờ biết vai rồi mới chuyển — gia sư (mở ở bí danh /lop-cua-toi/de-thi/tao-moi) đi thẳng /lop-cua-toi/de-thi, không đi vòng qua /admin rồi 307.
export default function TaoMoiRedirect() {
  const router = useRouter();
  const { isLoading } = useAuth();
  const href = useContentHref();
  useEffect(() => { if (!isLoading) router.replace(href("/admin/thi-thu")); }, [router, href, isLoading]);
  return null;
}
