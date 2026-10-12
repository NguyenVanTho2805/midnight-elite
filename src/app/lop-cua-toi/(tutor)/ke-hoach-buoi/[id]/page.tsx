// PH-223 — soạn một kế hoạch buổi: 4 hoạt động (Mở đầu, Hình thành kiến thức, Luyện tập, Vận dụng), mỗi hoạt động có Sản phẩm.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import KeHoachEditorClient from "./KeHoachEditorClient";

export const dynamic = "force-dynamic";

export default async function KeHoachEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/dang-nhap?next=/lop-cua-toi/ke-hoach-buoi/${id}`);
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <KeHoachEditorClient id={id} />;
}
