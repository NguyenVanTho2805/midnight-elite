// BU-05 — hồ sơ công khai kiểu Instagram, CHỈ gia sư. Học sinh / hồ sơ bị khoá → "Không tìm thấy" (máy chủ API trả 404). Metadata chung, không đọc DB.
import type { Metadata } from "next";
import { ProfileView } from "@/components/community/ProfileView";

const TITLE = "Hồ sơ gia sư trong Cộng đồng — KiN";
const DESC = "Xem các bài viết và câu trả lời công khai của gia sư trong Cộng đồng KiN.";

export const metadata: Metadata = { title: TITLE, description: DESC, openGraph: { title: TITLE, description: DESC, type: "profile" } };

export default async function CongDongProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProfileView id={id} />;
}
