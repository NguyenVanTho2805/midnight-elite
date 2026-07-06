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
        _balance = data.balance ?? 0;
        _transactions = data.transactions ?? [];
        setBalance(_balance);
        setTransactions(_transactions);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refetch().finally(() => setLoading(false));
  }, [refetch]);

  return { balance, transactions, loading, refetch };
}
