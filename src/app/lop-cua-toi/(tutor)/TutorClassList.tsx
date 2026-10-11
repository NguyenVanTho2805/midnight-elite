// FE-144 — danh sách lớp đang dạy dạng thẻ; dùng ở Tổng quan và module "Lớp".
import Link from "next/link";
import { CLASS_STATUS_LABEL } from "@/lib/tutorTodo";

const CARD = { background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" } as const;

export interface TutorClassRow {
  id: string; name: string; category: string; status: boolean; classStatus: string; capacity: number | null; students: number;
}

export default function TutorClassList({ classes, headingId }: { classes: TutorClassRow[]; headingId: string }) {
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="font-bold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Các lớp đang dạy</h2>
      {classes.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ ...CARD, borderStyle: "dashed" }}>
          <p className="font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Bạn chưa mở lớp nào</p>
          <p className="text-sm mt-1 mb-4" style={{ color: "var(--kin-chu-phu)" }}>Tạo lớp đầu tiên, rồi gửi mã mời cho học viên để vào lớp.</p>
          <Link href="/admin/khoa-hoc/tao-moi" className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold min-h-[44px]"
            style={{ background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" }}>Tạo lớp đầu tiên</Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {classes.map(c => {
            const full = c.capacity != null && c.students >= c.capacity;
            return (
              <li key={c.id} className="rounded-xl p-4 flex flex-col gap-3" style={CARD}>
                <div>
                  <Link href={`/lop-cua-toi/${c.id}`} className="font-semibold hover:underline" style={{ color: "var(--kin-chu-chinh)" }}>{c.name}</Link>
                  <p className="text-xs mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>
                    {c.category} · {CLASS_STATUS_LABEL[c.classStatus] ?? c.classStatus}{!c.status ? " · đang ẩn" : ""}
                  </p>
                </div>
                <p className="text-sm" style={{ color: "var(--kin-chu-chinh)" }}>
                  <b className="tabular-nums">{c.students}{c.capacity != null ? `/${c.capacity}` : ""}</b> học viên{full ? " · đã đầy" : ""}
                </p>
                <div className="flex gap-2 flex-wrap mt-auto">
                  {[["Mở lớp", `/lop-cua-toi/${c.id}`], ["Điểm danh", `/admin/khoa-hoc/${c.id}/diem-danh`], ["Danh sách HS", `/admin/khoa-hoc/${c.id}/hoc-vien`]].map(([l, h]) => (
                    <Link key={h} href={h} className="px-3 py-2 text-sm rounded-lg min-h-[44px] inline-flex items-center whitespace-nowrap"
                      style={{ background: "var(--kin-nen-nhan)", color: "var(--kin-th-navy)", border: "1px solid var(--kin-vien-thuong)" }}>{l}</Link>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
