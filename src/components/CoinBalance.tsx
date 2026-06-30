"use client";
import { useState, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";

export default function CoinBalance() {
  const { balance, loading, refetch } = useWallet();
  const [earned, setEarned] = useState(0);

  useEffect(() => {
    function handler(e: Event) {
      const amount = (e as CustomEvent<{ amount: number }>).detail?.amount ?? 0;
      if (amount > 0) {
        refetch();
        setEarned(amount);
        setTimeout(() => setEarned(0), 2500);
      }
    }
    window.addEventListener("coin:earned", handler);
    return () => window.removeEventListener("coin:earned", handler);
  }, [refetch]);

  if (loading) return null;

  return (
    <div className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg flex-shrink-0"
      style={{ background: "#FFFBEB", border: "1px solid #FDE68A" }}>
      <span className="text-sm leading-none">🪙</span>
      <span className="text-sm font-bold" style={{ color: "#92400E" }}>{balance}</span>

      {earned > 0 && (
        <span
          className="absolute -top-5 left-1/2 text-xs font-bold whitespace-nowrap pointer-events-none"
          style={{
            color: "#16a34a",
            transform: "translateX(-50%)",
            animation: "coinFloat 2.5s ease-out forwards",
          }}>
          +{earned} 🪙
        </span>
      )}

      <style>{`
        @keyframes coinFloat {
          0%   { opacity: 1; transform: translateX(-50%) translateY(0);    }
          60%  { opacity: 1; transform: translateX(-50%) translateY(-12px); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
      `}</style>
    </div>
  );
}
