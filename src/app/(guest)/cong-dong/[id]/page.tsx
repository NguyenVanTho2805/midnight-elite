// BU-05 — chi tiết bài toàn trang kiểu Threads. Máy chủ chỉ đặt metadata chung (không đọc DB nên không lộ gì về bài); phần động ở ThreadDetailView.
import type { Metadata } from "next";
import { ThreadDetailView } from "@/components/community/ThreadDetailView";

const TITLE = "Bài viết cộng đồng — KiN";
const DESC = "Đọc bài viết và các trả lời trong Cộng đồng KiN. Đăng nhập để thích, lưu và trả lời.";

export const metadata: Metadata = { title: TITLE, description: DESC, openGraph: { title: TITLE, description: DESC, type: "article" } };

export default async function ThreadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ThreadDetailView id={id} />;
}
