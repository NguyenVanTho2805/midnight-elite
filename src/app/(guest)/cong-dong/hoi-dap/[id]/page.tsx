// BU-05 — câu hỏi cũ: chỉ làm sạch chữ về xu và dùng chung kiểu thẻ; VẪN bắt đăng nhập (xem LegacyQuestionView).
import type { Metadata } from "next";
import { LegacyQuestionView } from "@/components/community/LegacyQuestionView";

export const metadata: Metadata = { title: "Câu hỏi — Cộng đồng KiN", description: "Câu hỏi và các câu trả lời trong Cộng đồng KiN. Cần đăng nhập để xem.", robots: { index: false, follow: false } };

export default async function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LegacyQuestionView id={id} />;
}
