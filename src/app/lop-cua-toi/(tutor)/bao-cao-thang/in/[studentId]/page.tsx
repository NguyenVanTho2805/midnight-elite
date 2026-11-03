// KiN Pro F3 — bản IN báo cáo tháng (A4 dọc). Chỉ in báo cáo ĐÃ DUYỆT, đọc số liệu ĐÃ ĐÓNG BĂNG lúc duyệt (cùng nguồn phụ huynh thấy).
// Có ảnh chụp thương hiệu (brandSnapshot) thì in có thương hiệu; không thì mẫu mặc định KiN. Trang này KHÔNG hỏi gói: bản đã tạo luôn xem được,
// kể cả khi hết hạn Pro. Việc tạo mới nằm ở POST …/branded (có cổng). Nhãn "ghi trên KiN" ở chân trang là hằng số, thương hiệu không che được.
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { prisma } from "@/lib/prisma";
import { KinEmptyState, KinMark, KinPage, KinPageHeader } from "@/components/kin";
import { isYearMonth } from "@/lib/monthlyReportServer";
import { vnMonthKey } from "@/lib/revenue";
import { vnDateKeyOf, tutorTitle } from "@/lib/classSessions";
import { EMPTY_UNMET_TEXT, fmtScore, type SubjectMonthMetrics } from "@/lib/monthlyReport";
import { PRINT_FOOTER, PRINT_PRIVACY_HINT, printLook, readBrandSnapshot } from "@/lib/docBrand";
import { BackToReports, PrintActions } from "./PrintActions";

export const dynamic = "force-dynamic";

const PRINT_CSS = `
@page { size: A4 portrait; margin: 14mm; }
@media print {
  body * { visibility: hidden !important; }
  .kin-print, .kin-print * { visibility: visible !important; }
  .kin-print { position: absolute; left: 0; top: 0; width: 100%; border: 0 !important; box-shadow: none !important; padding: 0 !important; }
  .kin-print, .kin-print * { color: black !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .kin-print .kin-print-accent { color: var(--bc) !important; }
  .kin-print .kin-print-rule { border-color: var(--bc) !important; }
  .kin-print section { break-inside: avoid; }
}`;

export default async function InBaoCaoPage({ params, searchParams }: { params: Promise<{ studentId: string }>; searchParams: Promise<{ yearMonth?: string; mau?: string }> }) {
  const { studentId } = await params;
  const sp = await searchParams;
  const ym = sp.yearMonth ?? vnMonthKey(new Date());
  const session = await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/bao-cao-thang/in/${studentId}?yearMonth=${ym}` });
  if (!isYearMonth(ym)) notFound();

  // Chỉ báo cáo của CHÍNH gia sư này (tutorId trong điều kiện): của người khác hay không có → 404, không lộ sự tồn tại.
  const [report, me] = await Promise.all([
    prisma.monthlyReport.findUnique({
      where: { tutorId_studentId_yearMonth: { tutorId: session.userId, studentId, yearMonth: ym } },
      select: { approvedAt: true, approvedItems: true, approvedSnapshot: true, brandSnapshot: true, brandedAt: true },
    }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { name: true } }),
  ]);
  if (!report) notFound();

  const back = { href: "/lop-cua-toi/bao-cao-thang", label: "← Báo cáo tháng" };
  if (!report.approvedAt) {
    return (
      <KinPage>
        <KinPageHeader title="In báo cáo tháng" back={back} />
        <KinEmptyState title="Báo cáo này chưa được duyệt" action={<BackToReports />}>
          Bản in lấy đúng bản đã duyệt (cùng bản phụ huynh thấy trên Sổ của con). Duyệt báo cáo xong thì quay lại đây để in.
        </KinEmptyState>
      </KinPage>
    );
  }

  const snap = (report.approvedSnapshot ?? null) as { subjects?: SubjectMonthMetrics[]; studentName?: string } | null;
  const subjects = snap?.subjects ?? [];
  const studentName = snap?.studentName ?? "";
  const items = (Array.isArray(report.approvedItems) ? report.approvedItems : []) as { text: string }[];
  const brand = readBrandSnapshot(report.brandSnapshot);
  const useKin = sp.mau === "kin";
  const look = printLook(useKin ? null : brand);
  const [y, m] = [ym.slice(0, 4), String(Number(ym.slice(5, 7)))];
  const k = vnDateKeyOf(report.approvedAt);
  const approvedLabel = `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;
  const tutorName = tutorTitle(me?.name);

  return (
    <KinPage>
      <style>{PRINT_CSS}</style>
      <KinPageHeader title="In báo cáo tháng" back={back}
        sub={look.mode === "brand" ? "Bản có thương hiệu của bạn" : "Mẫu mặc định của KiN"}
        actions={<PrintActions studentId={studentId} yearMonth={ym} hasBrand={brand !== null} useKin={useKin} />} />
      <p className="mb-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{PRINT_PRIVACY_HINT}</p>

      <article data-vung="sang" className="kin-print mx-auto max-w-[760px] rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-white p-4 sm:p-8 text-black"
        style={{ "--bc": look.accentCss, background: "white", color: "black" } as React.CSSProperties}>
        <header className="kin-print-rule border-b-[3px] pb-3" style={{ borderColor: "var(--bc)" }}>
          <div className="flex items-center gap-3">
            {look.mode === "kin" && <KinMark size={32} />}
            <p className="kin-print-accent text-[length:var(--kin-co-h1,27.6px)] font-semibold break-words min-w-0" style={{ color: "var(--bc)" }}>{look.headline}</p>
          </div>
          <h1 className="mt-2 text-[length:var(--kin-co-tieu-de)] font-medium">Báo cáo tháng {m}/{y}</h1>
          {studentName && <p className="text-[length:var(--kin-co-goc)]">Học sinh: {studentName}</p>}
        </header>

        {subjects.length === 0 ? (
          <p className="mt-4 text-[length:var(--kin-co-goc)]">Báo cáo này chưa có số liệu theo môn.</p>
        ) : subjects.map(s => (
          <section key={s.courseId} className="mt-4">
            <h2 className="kin-print-accent text-[length:var(--kin-co-tieu-de)] font-semibold" style={{ color: "var(--bc)" }}>{s.courseName}</h2>
            <dl className="mt-1 grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-3 gap-y-1 text-[length:var(--kin-co-goc)]">
              <dt>Chuyên cần</dt>
              <dd>{s.attendance.ratio === null ? "chưa có buổi điểm danh" : `${Math.round(s.attendance.ratio * 100)}% (${s.attendance.sessions} buổi)`}</dd>
              <dt>Bài về nhà đúng hạn</dt>
              <dd>{s.homework.assigned === 0 ? "không giao bài" : `${s.homework.onTime}/${s.homework.assigned}`}</dd>
              <dt>Nỗ lực</dt>
              <dd>{s.effort === null ? "chưa đo được" : `${s.effort}/10`}</dd>
              <dt>Năng lực</dt>
              <dd>{s.mastery.value === null ? "chưa có bài kiểm tra" : `${fmtScore(s.mastery.value)}/10${s.mastery.scores.length ? ` (${s.mastery.scores.map(fmtScore).join(" · ")})` : ""}`} — {s.mastery.text}</dd>
            </dl>
          </section>
        ))}

        <section className="mt-5">
          <h2 className="kin-print-accent text-[length:var(--kin-co-tieu-de)] font-semibold" style={{ color: "var(--bc)" }}>Điều chưa đạt tháng này</h2>
          {items.length === 0
            ? <p className="mt-1 text-[length:var(--kin-co-goc)]">{EMPTY_UNMET_TEXT}</p>
            : <ul className="mt-1 list-disc pl-5 text-[length:var(--kin-co-goc)] space-y-1">{items.map((it, i) => <li key={i} className="break-words">{it.text}</li>)}</ul>}
        </section>

        {(look.signature || tutorName) && (
          <section className="mt-6 text-[length:var(--kin-co-goc)]">
            {look.signature && <p className="italic break-words">{look.signature}</p>}
            {tutorName && <p className="font-medium">{tutorName}</p>}
          </section>
        )}

        <footer className="kin-print-rule mt-6 border-t pt-2 text-[length:var(--kin-co-small)]" style={{ borderColor: "var(--bc)" }}>
          <p>Duyệt ngày {approvedLabel}.</p>
          <p>{PRINT_FOOTER}</p>
        </footer>
      </article>
    </KinPage>
  );
}
