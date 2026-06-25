"use client";
import { useState, useEffect, useCallback } from "react";

export type CoinTransaction = {
  id: string;
  amount: number;
  reason: string;
  refId: string | null;
  createdAt: string;
};

export function useWallet() {
  const [balance, setBalance]           = useState(0);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [loading, setLoading]           = useState(true);

  const refetch = useCallback(() => {
    return fetch("/api/wallet")
      .then(r => r.json())
      .then(data => {
        setBalance(data.balance ?? 0);
        setTransactions(data.transactions ?? []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refetch().finally(() => setLoading(false));
  }, [refetch]);

  return { balance, transactions, loading, refetch };
}
