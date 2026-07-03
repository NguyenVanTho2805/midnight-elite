"use client";
import { useState } from "react";

export function AdminToast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div className="fixed top-4 right-4 z-[200] px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
      style={{ background: ok ? "#16a34a" : "#dc2626" }}>
      {ok ? "✓" : "✗"} {msg}
    </div>
  );
}

export function useAdminToast() {
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }
  return { toast, showToast };
}
