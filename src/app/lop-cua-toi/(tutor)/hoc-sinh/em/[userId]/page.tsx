// Hồ sơ nhiều tab của một học sinh CÓ TÀI KHOẢN (Figma 464:6423). Chỉ gia sư; dữ liệu tải ở HoSoEm qua /api/tutor/hoc-sinh/[userId] (em lớp khác 403, không có 404).
// `?tab=` mở thẳng một tab (tong-quan, diem-danh, ghi-chu, phieu, bai-tap, bao-cao). Hồ sơ riêng của gia sư (id hồ sơ) vẫn ở /lop-cua-toi/hoc-sinh/[id].
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import HoSoEm from "@/components/tutor/HoSoEm";

export const dynamic = "force-dynamic";

export default async function HoSoEmPage({ params, searchParams }: { params: Promise<{ userId: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { userId } = await params;
  const { tab } = await searchParams;
  const session = await getSession();
  if (!session) redirect(`/dang-nhap?redirect=/lop-cua-toi/hoc-sinh/em/${userId}`);
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  return <HoSoEm userId={userId} initialTab={typeof tab === "string" ? tab : undefined} />;
}
