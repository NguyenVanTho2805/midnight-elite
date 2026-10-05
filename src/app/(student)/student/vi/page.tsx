// FE-128 — trang ví Coin cho user (chủ yếu gia sư nạp để mua VIP; học
// viên có thể vẫn dùng Coin cho Q&A bounty).
//
// 4 phần:
//   1. Số dư hiện tại.
//   2. Lịch sử giao dịch (CoinTransaction gần nhất).
//   3. Form yêu cầu nạp + thông tin chuyển khoản.
//   4. Lịch sử yêu cầu nạp (pending/approved/rejected).
"use client";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui";
import { MIN_TOPUP_VND, MAX_TOPUP_VND } from "@/lib/coinTopup-constants";

interface CoinTx { id: string; amount: number; reason: string; sourceType: string | null; createdAt: string; }
interface TopupReq {
  id: string; amountVnd: number; coinAmount: number; status: string;
  bankRef: string | null; note: string | null; rejectReason: string | null;
  createdAt: string; reviewedAt: string | null;
}
interface BankInfo { bankName: string; accountNo: string; accountName: string; memo: string; }

const REASON_LABEL: Record<string, string> = {
  signup_bonus:        "Tặng khi đăng ký",
  answer_reward:       "Thưởng trả lời được chấp nhận",
  lesson_reward:       "Thưởng hoàn thành bài học",
  thread_reward:       "Thưởng đăng bài",
  reply_reward:        "Thưởng trả lời bài viết",
  question_cost:       "Trừ khi đăng câu hỏi",
  report_penalty:      "Phạt bài viết vi phạm",
  tutor_vip_purchase:  "Mua gói VIP",
  subscription_refund: "Hoàn Coin",
  topup:               "Nạp Coin",
};

function statusChip(s: string) {
  if (s === "approved") return { label: "Đã duyệt",   bg: "#dcfce7", color: "#166534" };
  if (s === "rejected") return { label: "Bị từ chối", bg: "#fee2e2", color: "#b91c1c" };
  return                     { label: "Đang chờ",   bg: "#fef3c7", color: "#b45309" };
}

export default function CoinWalletPage() {
  const toast = useToast();
  const [balance, setBalance] = useState<number | null>(null);
  const [txs, setTxs]         = useState<CoinTx[]>([]);
  const [reqs, setReqs]       = useState<TopupReq[]>([]);
  const [bank, setBank]       = useState<BankInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [amountVnd, setAmountVnd] = useState<string>("");
  const [bankRef, setBankRef]     = useState("");
  const [note, setNote]           = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadAll = useCallback(async () => {
    // Set loading qua microtask để eslint rule không khiếu nại khi gọi
    // từ useEffect sync body.
    await Promise.resolve();
    setLoading(true);
    try {
      const [w, t] = await Promise.all([
        fetch("/api/wallet", { credentials: "same-origin" }).then(r => r.ok ? r.json() : { balance: 0, transactions: [] }),
        fetch("/api/wallet/topups", { credentials: "same-origin" }).then(r => r.ok ? r.json() : { items: [], bank: null }),
      ]);
      setBalance(w.balance);
      setTxs(w.transactions);
      setReqs(t.items ?? []);
      setBank(t.bank ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAll();
  }, [loadAll]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amountVnd.replace(/[^0-9]/g, ""));
    if (!Number.isInteger(n) || n < MIN_TOPUP_VND || n > MAX_TOPUP_VND) {
      toast.err(`Số tiền phải từ ${MIN_TOPUP_VND.toLocaleString("vi-VN")} đến ${MAX_TOPUP_VND.toLocaleString("vi-VN")} VND`);
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch("/api/wallet/topups", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ amountVnd: n, bankRef: bankRef || undefined, note: note || undefined }),
      });
      const d = await r.json();
      if (!r.ok) { toast.err(d.error ?? "Không gửi được yêu cầu"); return; }
      toast.ok("Đã gửi yêu cầu nạp. Admin sẽ xử lý sau khi đối chiếu sao kê.");
      setAmountVnd(""); setBankRef(""); setNote("");
      await loadAll();
    } catch {
      toast.err("Mạng lỗi, thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold" style={{ color: "#1E2938" }}>Ví Coin</h1>
        <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
          1 Coin = 1 VND. Nạp Coin để mua gói VIP, hoặc dùng cho các hoạt động cộng đồng.
        </p>
      </div>

      {/* Số dư */}
      <div className="rounded-2xl p-6" style={{ background: "linear-gradient(135deg, #0068FF, #0042AA)", color: "#fff" }}>
        <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Số dư hiện tại</p>
        <p className="text-4xl font-extrabold mt-1">
          {loading ? "..." : balance?.toLocaleString("vi-VN")} <span className="text-base font-semibold opacity-80">Coin</span>
        </p>
      </div>

      {/* Form nạp */}
      <form onSubmit={submit} className="rounded-2xl p-5 space-y-4" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
        <h2 className="font-bold text-base" style={{ color: "#1E2938" }}>Yêu cầu nạp Coin</h2>

        {bank && (
          <div className="rounded-xl p-4 text-sm space-y-1" style={{ background: "#f0f9ff", border: "1px solid #bae6fd", color: "#1E2938" }}>
            <p className="font-semibold" style={{ color: "#0369a1" }}>Bước 1: Chuyển khoản thủ công</p>
            <p>Ngân hàng: <b>{bank.bankName}</b></p>
            <p>Số tài khoản: <b className="font-mono">{bank.accountNo}</b></p>
            <p>Chủ TK: <b>{bank.accountName}</b></p>
            <p>Nội dung (quan trọng): <b className="font-mono">{bank.memo}</b></p>
            <p className="text-xs mt-1" style={{ color: "#6B7280" }}>Sao chép đúng nội dung để admin đối chiếu nhanh.</p>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>Bước 2 · Số tiền (VND)</label>
          <input
            value={amountVnd}
            onChange={e => setAmountVnd(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="VD: 300000"
            className="w-full px-4 py-2.5 rounded-xl text-sm"
            style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}
            inputMode="numeric"
          />
          <p className="text-xs mt-1" style={{ color: "#6B7280" }}>
            Tối thiểu {MIN_TOPUP_VND.toLocaleString("vi-VN")}, tối đa {MAX_TOPUP_VND.toLocaleString("vi-VN")} VND / lần.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>Mã giao dịch ngân hàng (nếu có)</label>
          <input value={bankRef} onChange={e => setBankRef(e.target.value)} placeholder="FT25100500001234"
            className="w-full px-4 py-2.5 rounded-xl text-sm font-mono"
            style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }} />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>Ghi chú (không bắt buộc)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="VD: Nạp 300k mua gói VIP tháng"
            className="w-full px-4 py-2.5 rounded-xl text-sm"
            style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }} />
        </div>

        <button type="submit" disabled={submitting}
          className="w-full py-3 rounded-xl font-bold text-sm text-white disabled:opacity-50"
          style={{ background: "#0068FF" }}>
          {submitting ? "Đang gửi..." : "Gửi yêu cầu nạp"}
        </button>
      </form>

      {/* Lịch sử yêu cầu nạp */}
      {reqs.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
          <h2 className="font-bold text-base mb-3" style={{ color: "#1E2938" }}>Lịch sử yêu cầu nạp</h2>
          <div className="space-y-2">
            {reqs.map(r => {
              const chip = statusChip(r.status);
              return (
                <div key={r.id} className="rounded-xl p-3 flex items-start justify-between gap-3"
                  style={{ background: "#f6f5f4" }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "#1E2938" }}>
                      {r.amountVnd.toLocaleString("vi-VN")} VND → {r.coinAmount.toLocaleString("vi-VN")} Coin
                    </p>
                    <p className="text-xs" style={{ color: "#6B7280" }}>
                      {new Date(r.createdAt).toLocaleString("vi-VN")}
                      {r.bankRef && <> · <span className="font-mono">{r.bankRef}</span></>}
                    </p>
                    {r.status === "rejected" && r.rejectReason && (
                      <p className="text-xs mt-1" style={{ color: "#b91c1c" }}>Lý do: {r.rejectReason}</p>
                    )}
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full flex-shrink-0"
                    style={{ background: chip.bg, color: chip.color }}>{chip.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lịch sử Coin */}
      <div className="rounded-2xl p-5" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
        <h2 className="font-bold text-base mb-3" style={{ color: "#1E2938" }}>Giao dịch Coin gần đây</h2>
        {txs.length === 0 ? (
          <p className="text-sm italic" style={{ color: "#9CA3AF" }}>Chưa có giao dịch nào.</p>
        ) : (
          <div className="space-y-1">
            {txs.map(t => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "#f3f4f6" }}>
                <div className="min-w-0">
                  <p className="text-sm" style={{ color: "#1E2938" }}>{REASON_LABEL[t.reason] ?? t.reason}</p>
                  <p className="text-xs" style={{ color: "#9CA3AF" }}>{new Date(t.createdAt).toLocaleString("vi-VN")}</p>
                </div>
                <span className="text-sm font-bold" style={{ color: t.amount >= 0 ? "#16a34a" : "#dc2626" }}>
                  {t.amount >= 0 ? "+" : ""}{t.amount.toLocaleString("vi-VN")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
