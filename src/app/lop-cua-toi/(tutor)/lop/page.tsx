// Module "Lớp" của gia sư (bo-cuc-outlook.md mục 3): các lớp đang dạy, sĩ số, lối vào lớp.
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { loadTutorDashboard } from "@/lib/tutorDashboard";
import Link from "next/link";
import TutorClassList from "../TutorClassList";

export const dynamic = "force-dynamic";

export default async function LopPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/lop");
  if (session.role !== "admin" || session.adminRole !== "teacher") redirect("/lop-cua-toi");
  const d = await loadTutorDashboard(session.userId);
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <header className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Lớp</h1>
          <p className="text-caption mt-1" style={{ color: "var(--kin-chu-phu)" }}>{d.classes.length} lớp bạn đang dạy · {d.totalStudents} học viên</p>
        </div>
        <Link href="/lop-cua-toi/bao-cao-thang" className="px-3 py-2 text-sm rounded-lg min-h-[44px] inline-flex items-center"
          style={{ background: "var(--kin-nen-nhan)", color: "var(--kin-th-navy)", border: "1px solid var(--kin-vien-thuong)" }}>Báo cáo tháng</Link>
      </header>
      <TutorClassList classes={d.classes} headingId="h-lop" />
    </div>
  );
}
