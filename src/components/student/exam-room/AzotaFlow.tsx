// Đề làm ngoài KiN (Azota): thông tin đề → mở Azota (đếm ngược 5 giây) → nhập điểm tự báo. Không có câu hỏi trong KiN nên KHÔNG dùng phòng thi.
// Giữ nguyên luồng cũ của trang; chỉ tách ra để trang điều phối gọn.
"use client";
import { useEffect, useState } from "react";
import { KinButton } from "@/components/kin";
import type { ExamFull } from "@/lib/api";

export interface AzotaDone { score: number | null; totalPoints: number; rank: number | null }

export default function AzotaFlow({ exam, onDone }: { exam: ExamFull; onDone: (r: AzotaDone) => void }) {
  const [phase, setPhase] = useState<"ready" | "entering" | "submit">("ready");
  const [countdown, setCountdown] = useState(5);
  const [scoreInput, setScore] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (phase !== "entering") return;
    if (countdown <= 0) { if (exam.azotaUrl) window.open(exam.azotaUrl, "_blank"); setPhase("submit"); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown, exam.azotaUrl]);

  async function submitScore() {
    const score = parseFloat(scoreInput);
    if (isNaN(score) || score < 0) { setErr("Điểm không hợp lệ"); return; }
    setBusy(true); setErr("");
    try {
      const res = await fetch("/api/exam-results", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ examId: exam.id, score }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lỗi nộp kết quả");
      onDone({ score: data.score, totalPoints: data.totalPoints, rank: data.rank });
    } catch (e) { setErr(e instanceof Error ? e.message : "Lỗi không xác định"); } finally { setBusy(false); }
  }

  if (phase === "submit") {
    return (
      <div className="max-w-[480px] mx-auto space-y-5">
        <div><h1 className="text-2xl font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>Nộp kết quả</h1><p className="text-sm mt-0.5" style={{ color: "var(--kin-chu-mo)" }}>{exam.title}</p></div>
        <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
          <p className="rounded-xl p-3 text-sm font-semibold" style={{ background: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" }}>Đã mở Azota. Sau khi hoàn thành bài thi, nhập điểm của bạn dưới đây.</p>
          <label className="block text-sm font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>
            Điểm của bạn <span className="font-normal" style={{ color: "var(--kin-chu-mo)" }}>(ví dụ: 112 hoặc 8.5)</span>
            <input type="number" step="0.5" min="0" value={scoreInput} onChange={e => { setScore(e.target.value); setErr(""); }} placeholder="0 — 150"
              className="mt-2 w-full px-4 min-h-12 rounded-xl text-lg font-bold border-2 outline-none" style={{ borderColor: err ? "var(--kin-tt-vien-loi)" : "var(--kin-vien-thuong)", background: "var(--kin-nen-trang)" }} />
          </label>
          {err && <p role="alert" className="text-xs" style={{ color: "var(--kin-tt-chu-loi)" }}>{err}</p>}
          <KinButton variant="primary" size="lg" block disabled={!scoreInput} loading={busy} loadingLabel="Đang lưu…" onClick={submitScore}>Nộp kết quả</KinButton>
          {exam.azotaUrl && <a href={exam.azotaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center min-h-11 text-sm" style={{ color: "var(--kin-nhan-link)" }}>Mở lại Azota →</a>}
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-[480px] mx-auto space-y-5">
      <div><h1 className="text-2xl font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>{exam.title}</h1><p className="text-sm mt-1" style={{ color: "var(--kin-chu-mo)" }}>{exam.date} · {exam.time} · {exam.duration} · {exam.questions} câu</p></div>
      <div className="rounded-xl p-5 space-y-4" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
        <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Đề này làm trên Azota, không làm trong KiN. Làm xong, em quay lại đây nhập điểm. Đề thi mã {exam.code}.</p>
        {phase === "ready" ? (!exam.azotaUrl ? (
          <p role="alert" className="rounded-xl p-4 text-sm font-semibold text-center" style={{ background: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi)" }}>Đề thi chưa có link Azota. Admin cần cập nhật link cho đề này.</p>
        ) : <KinButton variant="primary" size="lg" block className="min-h-[52px]" onClick={() => setPhase("entering")}>▶ Vào phòng thi ngay</KinButton>
        ) : (
          <div className="text-center" role="status"><p className="text-4xl font-extrabold tabular-nums" style={{ color: "var(--kin-nhan-link)" }}>{countdown}</p><p className="text-sm font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Đang chuyển hướng đến Azota…</p></div>
        )}
      </div>
    </div>
  );
}
