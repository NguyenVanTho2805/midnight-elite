// KH-04 — biểu mẫu "Yêu cầu tìm gia sư" gửi tới gia sư đang xem. Khách, không cần tài khoản. Gia sư ẩn / chưa duyệt / bị khoá → báo không tìm thấy.
import type { Metadata } from "next";
import Link from "next/link";
import { publicTutor } from "@/lib/tutorRequestServer";
import YeuCauForm from "@/components/guest/YeuCauForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gửi yêu cầu tìm gia sư — KiN", robots: { index: false, follow: false } };

export default async function YeuCauPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await publicTutor(id);
  if (!t) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <h1 className="text-2xl font-extrabold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Không tìm thấy gia sư</h1>
        <p className="text-sm mb-6" style={{ color: "var(--kin-chu-mo)" }}>Gia sư này không tồn tại hoặc chưa được duyệt công khai.</p>
        <Link href="/giang-vien" className="px-6 py-3 rounded-lg font-semibold text-sm" style={{ background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)", borderRadius: "8px" }}>Xem danh sách gia sư</Link>
      </div>
    );
  }
  return (
    <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 lg:py-10">
      <Link href={`/mentor/${t.id}`} className="inline-flex items-center min-h-[44px] text-[length:var(--kin-co-small)] font-medium" style={{ color: "var(--kin-chu-mo)" }}>← Quay lại hồ sơ</Link>
      <h1 className="mt-2 mb-1 text-[length:var(--kin-co-h1)] leading-[var(--kin-dong-h1)] font-medium" style={{ color: "var(--kin-chu-chinh)" }}>Gửi yêu cầu cho {t.name}</h1>
      <p className="mb-6 text-[length:var(--kin-co-goc)]" style={{ color: "var(--kin-chu-mo)" }}>Điền vài thông tin để gia sư liên hệ lại. Gia sư tự quyết định có nhận hay không.</p>
      <YeuCauForm tutorId={t.id} tutorName={t.name} />
    </div>
  );
}
