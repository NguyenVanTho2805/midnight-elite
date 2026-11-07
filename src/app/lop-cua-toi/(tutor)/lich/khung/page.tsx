// TUT-lich-keo-tha — /lop-cua-toi/lich/khung?lop=<id>: lưới khung giờ hằng tuần có ô chọn lớp (nhớ lớp trong URL).
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import LichKhung from "@/components/tutor/LichKhung";

export const dynamic = "force-dynamic";

export default async function KhungPage({ searchParams }: { searchParams: Promise<{ lop?: string }> }) {
  const { lop } = await searchParams;
  await redirectIfNotTutor(await getSession(), { path: lop ? `/lop-cua-toi/lich/khung?lop=${encodeURIComponent(lop)}` : "/lop-cua-toi/lich/khung" });
  return <LichKhung courseId={lop || null} selectable />;
}
