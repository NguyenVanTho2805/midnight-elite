// FE-144 — danh sách lớp đang dạy dạng thẻ; dùng ở Tổng quan và module "Lớp".
// Thẻ: vạch màu theo lớp, chấm trạng thái kèm chữ, thanh sĩ số, "Mở lớp" là nút chính.
import Link from "next/link";
import { CLASS_STATUS_LABEL } from "@/lib/tutorTodo";
import { classAccent, fillPercent } from "@/lib/classColor";

const CARD = { background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" } as const;

export interface TutorClassRow {
  id: string; name: string; category: string; status: boolean; classStatus: string; capacity: number | null; students: number;
}

export default function TutorClassList({ classes, headingId }: { classes: TutorClassRow[]; headingId: string }) {
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="text-sm font-semibold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Các lớp đang dạy</h2>
      {classes.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ ...CARD, borderStyle: "dashed" }}>
          <p className="font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Bạn chưa mở lớp nào</p>
          <p className="text-sm mt-1 mb-4" style={{ color: "var(--kin-chu-phu)" }}>Tạo lớp đầu tiên, rồi gửi mã mời cho học viên để vào lớp.</p>
          <Link href="/lop-cua-toi/quan-lop?tao=1" className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold min-h-[44px]"
            style={{ background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" }}>Tạo lớp đầu tiên</Link>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {classes.map(c => {
            const full = c.capacity != null && c.students >= c.capacity;
            const pct = fillPercent(c.students, c.capacity);
            const open = c.classStatus === "open" && c.status;
            return (
              <li key={c.id} className="rounded-lg overflow-hidden flex" style={CARD}>
                <span aria-hidden className="w-1 flex-shrink-0" style={{ background: classAccent(c.id) }} />
                <div className="px-3 pt-2.5 pb-1 flex flex-col gap-1.5 flex-1 min-w-0">
                  <div>
                    <Link href={`/lop-cua-toi/${c.id}`} className="font-semibold text-sm hover:underline break-words" style={{ color: "var(--kin-chu-chinh)" }}>{c.name}</Link>
                    <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: "var(--kin-chu-phu)" }}>
                      <span aria-hidden className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: open ? "var(--kin-tt-cham-xong)" : "var(--kin-tt-cham-trung-tinh)" }} />
                      <span>{c.category} · {CLASS_STATUS_LABEL[c.classStatus] ?? c.classStatus}{!c.status ? " · đang ẩn" : ""}</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: "var(--kin-chu-chinh)" }}>
                      <b className="tabular-nums">{c.students}{c.capacity != null ? `/${c.capacity}` : ""}</b> học viên{full ? " · đã đầy" : ""}
                    </p>
                    {pct != null && (
                      <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--kin-nen-re-chuot)" }} aria-hidden>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: full ? "var(--kin-tt-cham-cho)" : "var(--kin-tt-cham-xong)" }} />
                      </div>
                    )}
                  </div>
                  <div className="flex gap-x-4 flex-wrap mt-auto">
                    <Link href={`/lop-cua-toi/${c.id}`} className="text-xs font-semibold min-h-[44px] inline-flex items-center whitespace-nowrap"
                      style={{ color: "var(--kin-nhan-link)" }}>Mở lớp</Link>
                    {[["Điểm danh", `/lop-cua-toi/quan-lop/${c.id}/diem-danh`], ["Danh sách HS", `/lop-cua-toi/quan-lop/${c.id}/hoc-vien`]].map(([l, h]) => (
                      <Link key={h} href={h} className="text-xs min-h-[44px] inline-flex items-center whitespace-nowrap"
                        style={{ color: "var(--kin-chu-phu)" }}>{l}</Link>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
