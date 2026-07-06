"use client";
import { useState, useEffect, useCallback } from "react";

export type CoinTransaction = {
  id: string;
  amount: number;
  reason: string;
  refId: string | null;
  createdAt: string;
};

// Module-level cache — survives Navbar remounts across zone navigation
let _balance: number | null = null;
let _transactions: CoinTransaction[] = [];

export function useWallet() {
  const [balance, setBalance]           = useState(_balance ?? 0);
  const [transactions, setTransactions] = useState<CoinTransaction[]>(_transactions);
  const [loading, setLoading]           = useState(_balance === null);

  const refetch = useCallback(() => {
    return fetch("/api/wallet")
      .then(r => r.json())
      .then(data => {
        const b = data.balance ?? 0;
        const t = data.transactions ?? [];
        _balance = b;
        _transactions = t;
        setBalance(b);
        setTransactions(t);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refetch().finally(() => setLoading(false));
  }, [refetch]);

  return { balance, transactions, loading, refetch };
}
