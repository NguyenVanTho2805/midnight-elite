// FE-158 — xem trước đầu hồ sơ công khai ngay trong Hồ sơ gia sư (Dashboard): đúng thứ khách nhìn thấy, lấy từ chính /api/tutors/[id]
// nên số buổi, số lớp, đánh giá không thể lệch với trang công khai. Chỉ có khi hồ sơ đã được duyệt và không bị khoá.
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TutorProfileHeader, { type ProfileHeaderStats, type ProfileHeaderTutor } from "@/components/tutor/TutorProfileHeader";

type State = { kind: "loading" } | { kind: "ready"; tutor: ProfileHeaderTutor; stats: ProfileHeaderStats } | { kind: "hidden" } | { kind: "error" };

export default function PublicProfilePreview({ tutorId, reason, hidden = false }: { tutorId: string; /** NC2-022: gia sư đang chọn Ẩn — vẫn xem trước được (chỉ chính chủ), kèm dòng "Hồ sơ đang ẩn" */ hidden?: boolean; /** lý do chưa công khai (do máy chủ biết): "chua-duyet" | "bi-khoa" | null = đang công khai */ reason: "chua-duyet" | "bi-khoa" | null }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  useEffect(() => {
    if (reason) return;
    let off = false;
    (async () => {
      await Promise.resolve();
      try {
        const r = await fetch(`/api/tutors/${tutorId}?preview=1`, { credentials: "same-origin", cache: "no-store" });
        if (off) return;
        if (r.status === 404) { setState({ kind: "hidden" }); return; }
        if (!r.ok) { setState({ kind: "error" }); return; }
        const d = await r.json();
        if (!off) setState({ kind: "ready", tutor: d.tutor, stats: d.stats });
      } catch { if (!off) setState({ kind: "error" }); }
    })();
    return () => { off = true; };
  }, [tutorId, reason, hidden]);

  const head = <h2 className="text-sm font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Hồ sơ công khai của bạn trông thế này</h2>;
  if (reason) {
    return (
      <section aria-labelledby="h-xem-truoc" className="mb-6">
        <h2 id="h-xem-truoc" className="text-sm font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Hồ sơ công khai</h2>
        <p role="status" className="rounded-xl p-4 text-sm" style={{ background: "var(--kin-nen-bang)", border: "1px dashed var(--kin-vien-thuong)", color: "var(--kin-chu-phu)" }}>
          {reason === "bi-khoa" ? "Hồ sơ công khai của bạn đang bị khoá nên khách chưa xem được. Liên hệ quản trị viên để được xem xét." : "Hồ sơ công khai sẽ hiện ở đây sau khi quản trị viên duyệt hồ sơ của bạn."}
        </p>
      </section>
    );
  }
  return (
    <section aria-labelledby="h-xem-truoc" className="mb-6">
      <div id="h-xem-truoc">{head}</div>
      {state.kind === "loading" && <div aria-busy="true" className="h-40 rounded-xl animate-pulse" style={{ background: "var(--kin-nen-bang)" }} />}
      {state.kind === "error" && <p role="alert" className="rounded-xl p-4 text-sm" style={{ border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-tt-chu-loi)" }}>Không tải được bản xem trước. Tải lại trang để thử lại.</p>}
      {state.kind === "hidden" && <p role="status" className="rounded-xl p-4 text-sm" style={{ background: "var(--kin-nen-bang)", border: "1px dashed var(--kin-vien-thuong)", color: "var(--kin-chu-phu)" }}>Hồ sơ của bạn hiện chưa công khai.</p>}
      {state.kind === "ready" && (
        <>
          {hidden && <p role="status" data-testid="xem-truoc-dang-an" className="rounded-xl p-3 mb-2 text-sm font-semibold" style={{ background: "var(--kin-tt-nen-cho)", color: "var(--kin-tt-chu-cho)", border: "1px solid var(--kin-tt-vien-cho)" }}>Hồ sơ đang ẩn — khách không thấy trang này. Đây là bản xem trước của riêng bạn.</p>}
          <TutorProfileHeader tutor={state.tutor} stats={state.stats} as="h2" />
          <p className="text-xs mt-2" style={{ color: "var(--kin-chu-phu)" }}>
            Giới thiệu và môn dạy sửa ở form bên dưới. Số buổi, số lớp lấy từ sổ lớp (không có ô nhập tay); một buổi chỉ được tính khi đã diễn ra và có ít nhất 1 em có mặt. Nhãn “Có dạy trong 30 ngày qua” hiện khi có ít nhất 1 buổi như vậy trong 30 ngày gần nhất. {hidden ? "Trang công khai đang báo không tìm thấy vì hồ sơ đang ẩn." : <Link href={`/mentor/${tutorId}`} className="underline" style={{ color: "var(--kin-th-xanh-link)" }}>Mở trang công khai</Link>}
          </p>
        </>
      )}
    </section>
  );
}
