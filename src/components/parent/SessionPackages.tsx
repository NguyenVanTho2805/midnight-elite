// HP-31 — "Gói buổi trả trước" trong Sổ của con: số buổi đã dùng / còn lại của ĐÚNG em này. CHỈ TRÌNH BÀY: không giá, không ghi chú, không thanh toán.
// Server component. Không hiện mục khi em chưa có gói nào (không mục rỗng gây hiểu nhầm).
import ParentSection from "@/components/parent/Section";
import { KinStatus } from "@/components/kin/Status";
import { PACKAGE_PARENT_NOTICE, PACKAGE_STATUS_LABEL } from "@/lib/sessionPackage";
import type { PartyPackage } from "@/lib/sessionPackageServer";

const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;

export default function SessionPackages({ items }: { items: PartyPackage[] }) {
  if (items.length === 0) return null;
  return (
    <ParentSection id="h-goi-buoi" title="Gói buổi trả trước">
      <ul className="divide-y divide-[color:var(--kin-vien-nhat)]" data-session-packages>
        {items.map((p, i) => (
          <li key={i} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="min-w-0 break-words" style={{ color: "var(--kin-chu-chinh)" }}>{p.courseName}</span>
              <KinStatus tone={p.status === "used_up" ? "mo" : "xong"}>{PACKAGE_STATUS_LABEL[p.status]}</KinStatus>
            </div>
            <p className="mt-1 text-sm tabular-nums" style={{ color: "var(--kin-chu-phu)" }}>Gói {p.sessions} buổi · đã dùng {p.used} · còn {p.balance}</p>
            {p.uses.length > 0 && <p className="mt-1 text-xs break-words" style={{ color: "var(--kin-chu-mo)" }}>Các buổi đã trừ: {p.uses.map(u => ddmm(u.dateKey)).join(", ")}</p>}
          </li>
        ))}
      </ul>
      <p className="text-xs mt-2" style={{ color: "var(--kin-chu-mo)" }}>{PACKAGE_PARENT_NOTICE}</p>
    </ParentSection>
  );
}
