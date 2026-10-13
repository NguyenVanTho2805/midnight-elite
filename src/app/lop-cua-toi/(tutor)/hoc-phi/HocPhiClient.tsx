"use client";
import { useCallback, useState } from "react";
import { KinTabs } from "@/components/kin";
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
      <KinTabs
        className="mb-4"
        label="Học phí"
        value={tab}
        onChange={choose}
        tabId={k => `tab-${k}`}
        panelId={k => `panel-${k}`}
        tabs={TABS.map(t => ({ key: t.key, label: `${t.label}${t.key === "doi-soat" && count > 0 ? ` (${count})` : ""}` }))}
      />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "phieu" && <InvoicesTab onGoPayout={() => choose("nhan-tien")} />}
        {tab === "doi-soat" && <ReconcileTab onCount={setCount} />}
        {tab === "nhan-tien" && <PayoutTab />}
      </div>
    </div>
  );
}
