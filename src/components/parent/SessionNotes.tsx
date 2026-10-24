// BU-07 — "Nhận xét của gia sư" trong Sổ của con: chỉ những nhận xét gia sư đã chọn cho phụ huynh của đúng em này xem.
import ParentSection from "@/components/parent/Section";
import type { PartyNote } from "@/lib/sessionNoteServer";

const ddmm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;

export default function SessionNotes({ items }: { items: PartyNote[] }) {
  if (items.length === 0) return null;
  return (
    <ParentSection id="h-nhan-xet-buoi" title="Nhận xét của gia sư">
      <ul className="divide-y divide-[color:var(--kin-vien-nhat)]" data-session-notes>
        {items.map((n, i) => (
          <li key={i} className="py-3">
            <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>{n.courseName} · {ddmm(n.dateKey)}</p>
            <p className="mt-1 break-words" style={{ color: "var(--kin-chu-chinh)" }}>{n.note}</p>
          </li>
        ))}
      </ul>
      <p className="text-xs mt-2" style={{ color: "var(--kin-chu-mo)" }}>Gia sư ghi trên KiN và chọn cho anh/chị xem. Chỉ anh/chị và gia sư của lớp xem được mục này.</p>
    </ParentSection>
  );
}
