// FE-155/156 — gia sư kiểm duyệt cộng đồng của CÁC LỚP MÌNH. API đã giới hạn theo
// chủ lớp (BE-072); cộng đồng chung vẫn do quản lý trung tâm xử lý.
import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import KiemDuyetClient from "./KiemDuyetClient";

export const dynamic = "force-dynamic";

export default async function KiemDuyetPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/kiem-duyet" });
  return (
    <div style={{ background: "var(--kin-nen-trang)", minHeight: "100vh" }}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Link href="/lop-cua-toi" className="text-sm hover:underline" style={{ color: "var(--kin-chu-phu)" }}>← Lớp của tôi</Link>
        <h1 className="mt-2 text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Kiểm duyệt cộng đồng lớp</h1>
        <p className="text-caption mt-1 mb-5" style={{ color: "var(--kin-chu-phu)" }}>
          Báo cáo bài viết trong cộng đồng của các lớp bạn dạy. Xoá bài vi phạm hoặc bỏ qua nếu báo cáo không đúng.
        </p>
        <KiemDuyetClient />
      </div>
    </div>
  );
}
