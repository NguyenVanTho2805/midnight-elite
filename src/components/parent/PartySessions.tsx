// BC-02 — "Chi tiết từng buổi" trên Sổ của con: các buổi gần nhất của em, mỗi buổi một dòng (ngày, lớp, trạng thái bằng CHỮ).
// Server component, không gọi thêm. Không hiện mục khi chưa có buổi nào (không mục rỗng gây hiểu nhầm). Điểm từng buổi ở mục "Điểm từng buổi" riêng.
import ParentSection from "@/components/parent/Section";
import { KinStatus } from "@/components/kin/Status";
import type { PartySessionRow } from "@/lib/partySessions";

const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;

export default function PartySessions({ items }: { items: PartySessionRow[] }) {
  if (items.length === 0) return null;
  return (
    <ParentSection id="h-chi-tiet-buoi" title="Chi tiết từng buổi">
      <ul className="divide-y divide-[color:var(--kin-vien-nhat)]" data-party-sessions>
        {items.map((s, i) => (
          <li key={`${s.dateKey}-${s.courseName}-${i}`} className="py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="min-w-0 break-words" style={{ color: "var(--kin-chu-chinh)" }}>{s.courseName} · {ddmm(s.dateKey)}</span>
            <KinStatus tone={s.tone}>{s.label}</KinStatus>
          </li>
        ))}
      </ul>
      <p className="text-xs mt-2" style={{ color: "var(--kin-chu-mo)" }}>Gia sư ghi trên KiN khi điểm danh. Buổi để trống nghĩa là chưa điểm danh, không phải vắng.</p>
    </ParentSection>
  );
}
