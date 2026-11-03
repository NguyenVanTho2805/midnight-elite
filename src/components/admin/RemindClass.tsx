// "Nhắc cả lớp" (chuyển từ /admin sang trang Học viên của lớp, BU-08 Q7). Gọi API sẵn POST /api/admin/remind-all (bắt buộc courseId, quyền MANAGE_STUDENTS).
// Xác nhận nội dòng (không hộp thoại, không window.confirm): bấm "Nhắc cả lớp" → mở khối soạn → "Gửi" → hiện số người nhận + "Xác nhận gửi".
"use client";
import { useState } from "react";
import { KinButton } from "@/components/kin";
import { hasPermission, PERMISSIONS, useAuth } from "@/contexts/AuthContext";

const DEFAULT_MSG = "Thầy/cô nhắc cả lớp duy trì tiến độ học tập nhé! Hãy vào hệ thống xem video và hoàn thành bài tập đầy đủ.";

export default function RemindClass({ courseId, recipients }: { courseId: string; recipients: number }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [step, setStep] = useState<"soan" | "xac-nhan">("soan");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  // API chỉ cho MANAGE_STUDENTS: người không có quyền thì không thấy nút (gia sư dùng cùng trang qua bí danh).
  if (!hasPermission(user, PERMISSIONS.MANAGE_STUDENTS)) return null;

  const send = async () => {
    setBusy(true); setResult(null);
    try {
      const r = await fetch("/api/admin/remind-all", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg.trim() || DEFAULT_MSG, courseId }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) { setResult({ ok: true, text: `Đã gửi nhắc nhở tới ${d.sent}/${d.total} học viên.` }); setOpen(false); setMsg(""); setStep("soan"); }
      else setResult({ ok: false, text: typeof d.error === "string" ? d.error : "Chưa gửi được. Thử lại." });
    } catch { setResult({ ok: false, text: "Không kết nối được. Thử lại." }); }
    finally { setBusy(false); }
  };

  return (
    <div data-nhac-ca-lop className="mb-4">
      {!open && <KinButton variant="secondary" onClick={() => { setOpen(true); setStep("soan"); setResult(null); }} disabled={recipients === 0}>Nhắc cả lớp</KinButton>}
      {open && (
        <div role="group" aria-label="Nhắc cả lớp" className="flex flex-col gap-3 rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] p-4">
          <label className="flex flex-col gap-1">
            <span className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">Lời nhắn (gửi qua email)</span>
            <textarea rows={3} value={msg} disabled={busy || step === "xac-nhan"} onChange={e => setMsg(e.target.value)} placeholder={DEFAULT_MSG}
              className="w-full rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] px-3 py-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]" />
          </label>
          {step === "xac-nhan" && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-cho)]">{`Lời nhắn sẽ gửi cho khoảng ${recipients} học viên đang học lớp này. Gửi rồi không thu lại được.`}</p>}
          <div className="flex flex-wrap gap-2">
            {step === "soan"
              ? <KinButton onClick={() => setStep("xac-nhan")}>Gửi cho cả lớp</KinButton>
              : <KinButton loading={busy} loadingLabel="Đang gửi…" onClick={() => void send()}>Xác nhận gửi</KinButton>}
            <KinButton variant="secondary" disabled={busy} onClick={() => { if (step === "xac-nhan") setStep("soan"); else setOpen(false); }}>{step === "xac-nhan" ? "Quay lại" : "Huỷ"}</KinButton>
          </div>
        </div>
      )}
      {result && <p role="status" data-loi={result.ok ? undefined : ""} className={`mt-2 text-[length:var(--kin-co-goc)] font-medium ${result.ok ? "text-[var(--kin-tt-chu-xong)]" : "text-[var(--kin-tt-chu-loi)]"}`}>{result.text}</p>}
    </div>
  );
}
