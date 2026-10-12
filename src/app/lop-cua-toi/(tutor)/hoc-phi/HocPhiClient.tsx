"use client";
import { useCallback, useState } from "react";
import InvoicesTab from "./InvoicesTab";
import ReconcileTab from "./ReconcileTab";
import PayoutTab from "./PayoutTab";

type Tab = "phieu" | "doi-soat" | "nhan-tien";
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "phieu", label: "Phiếu" }, { key: "doi-soat", label: "Chờ đối soát" }, { key: "nhan-tien", label: "Nhận tiền" },
];

export default function HocPhiClient({ initialTab, pending }: { initialTab: Tab; pending: number }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [count, setCount] = useState(pending);
  const choose = useCallback((t: Tab) => {
    setTab(t);
    try { window.history.replaceState(null, "", t === "phieu" ? "/lop-cua-toi/hoc-phi" : `/lop-cua-toi/hoc-phi?tab=${t}`); } catch { /* không bắt buộc */ }
  }, []);

  return (
    <div>
      <div role="tablist" aria-label="Học phí" className="flex gap-1 mb-4 overflow-x-auto" style={{ borderBottom: "1px solid var(--kin-vien-thuong)" }}>
        {TABS.map(t => (
          <button key={t.key} role="tab" id={`tab-${t.key}`} aria-selected={tab === t.key} aria-controls={`panel-${t.key}`} onClick={() => choose(t.key)}
            className="px-4 py-2.5 text-sm font-semibold whitespace-nowrap min-h-[44px] -mb-px"
            style={{ borderBottom: `3px solid ${tab === t.key ? "var(--kin-th-navy)" : "transparent"}`, color: tab === t.key ? "var(--kin-th-navy)" : "var(--kin-chu-phu)" }}>
            {t.label}{t.key === "doi-soat" && count > 0 ? ` (${count})` : ""}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "phieu" && <InvoicesTab onGoPayout={() => choose("nhan-tien")} />}
        {tab === "doi-soat" && <ReconcileTab onCount={setCount} />}
        {tab === "nhan-tien" && <PayoutTab />}
      </div>
    </div>
  );
}
