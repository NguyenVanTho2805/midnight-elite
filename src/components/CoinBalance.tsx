"use client";
import { useWallet } from "@/hooks/useWallet";

export default function CoinBalance() {
  const { balance, loading } = useWallet();
  if (loading) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg flex-shrink-0"
      style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
      <span className="text-sm leading-none">🪙</span>
      <span className="text-sm font-bold" style={{ color: "#92400E" }}>{balance}</span>
    </div>
  );
}
