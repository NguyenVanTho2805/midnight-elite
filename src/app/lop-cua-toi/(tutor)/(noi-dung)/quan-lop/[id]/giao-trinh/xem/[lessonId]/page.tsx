// BU-02 — "Xem như học sinh" (Figma 607:491, chưa đối chiếu). Bản xem thử: không ghi tiến độ, không ghi chú, không "đã làm xong". Chỉ gia sư (đã duyệt) vào được.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import XemNhuHocSinh from "@/components/tutor/giao-trinh/XemNhuHocSinh";

export const dynamic = "force-dynamic";

export default async function XemNhuHocSinhPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const { id, lessonId } = await params;
  await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/quan-lop/${id}/giao-trinh/xem/${lessonId}`, adminTo: "/admin" });
  return <XemNhuHocSinh courseId={id} lessonId={lessonId} embedded />;
}
