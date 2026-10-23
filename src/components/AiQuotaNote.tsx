"use client";
// KiN Pro F5 — dòng "còn N lượt AI trích đề tháng này" đặt cạnh nút tải đề. Đọc /api/tutor/ai-quota (chỉ đọc, không trừ lượt).
// Đọc lại mỗi khi một lần trích kết thúc (`busy` từ true về false): thấy số sau khi dùng, và thấy lượt được TRẢ LẠI khi trích lỗi.
// Hết lượt (cổng BẬT) → câu rõ + nút tới "Gói của tôi"; lượt tính lại từ đầu tháng sau (giờ VN). Quản trị không phải gia sư: không hiện gì.
// Không gửi gì cho AI từ đây; không dữ liệu học sinh.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { kinButtonClass } from "@/components/kin/Button";

interface Q { applicable: boolean; plan?: "free" | "pro"; enforced?: boolean; used?: number; limit?: number; remaining?: number; state?: string }

export function AiQuotaNote({ busy = false, className = "" }: { busy?: boolean; className?: string }) {
  const [q, setQ] = useState<Q | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const prevBusy = useRef(busy);

  const load = useCallback(async () => {
    await Promise.resolve();
    setLoading(true); setFailed(false);
    try {
      const res = await fetch("/api/tutor/ai-quota", { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setQ(await res.json() as Q);
    } catch { setFailed(true); }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (prevBusy.current && !busy) void load();
    prevBusy.current = busy;
  }, [busy, load]);

  if (q && !q.applicable) return null;
  const cls = `text-xs ${className}`;
  const mute = { color: "var(--kin-chu-phu)" } as const;
  if (failed) return <p className={cls} style={mute} data-testid="ai-quota-note">Không đọc được số lượt AI còn lại. <button type="button" className="underline min-h-[44px] px-1" onClick={() => void load()}>Thử lại</button></p>;
  if (loading && !q) return <p className={cls} style={mute} data-testid="ai-quota-note" aria-busy="true">Đang đọc số lượt AI còn lại…</p>;
  if (!q) return null;

  const remaining = q.remaining ?? 0, limit = q.limit ?? 0, out = remaining === 0;
  const planName = q.plan === "pro" ? "KiN Pro" : "Free";
  return (
    <div className={cls} style={mute} data-testid="ai-quota-note" data-remaining={remaining} data-enforced={q.enforced ? "1" : "0"} role="status">
      {out && q.enforced ? (
        <p>
          <b style={{ color: "var(--kin-tt-chu-loi)" }}>Đã hết lượt AI trích đề tháng này</b> (gói {planName} có {limit} lượt mỗi tháng). Lượt tính lại từ đầu tháng sau.
          Bạn vẫn nhập câu hỏi bằng tay được.
        </p>
      ) : (
        <p>
          <b data-testid="ai-quota-remaining" style={{ color: "var(--kin-chu-chinh)" }}>Còn {remaining} lượt</b> AI trích đề tháng này (gói {planName}, {limit} lượt mỗi tháng).
          {!q.enforced && " Hiện KiN chưa chặn khi hết lượt."} Trích lỗi thì lượt được trả lại.
        </p>
      )}
      <Link href="/lop-cua-toi/goi" data-testid="ai-quota-link" className={`${kinButtonClass(out && q.enforced ? "primary" : "secondary")} mt-2`}>
        {out && q.enforced ? "Xem Gói của tôi" : "Xem gói"}
      </Link>
    </div>
  );
}
