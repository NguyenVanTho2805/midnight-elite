// GS-LOP-GON (09/11/2026) — ĐẦU LỚP vẽ MỘT LẦN cho mọi tab của /lop-cua-toi/quan-lop/[id]* (layout lồng vẽ nó, TRÊN dải tab): "← Lớp học", tên lớp (h1 duy nhất của trang),
// dòng phụ "môn · n học sinh" (chỉ SỐ, không tên) và nhãn trạng thái bằng CHỮ ("Đang nhận học viên" / "Tạm ngừng" / "Đã đóng", thêm "đang ẩn"). Các tab con không có h1 riêng.
// Màu chỉ qua token --kin-*; nút ≥ 44px; tên dài xuống dòng (không tràn ngang ở 390px).
import Link from "next/link";
import { KinStatus } from "@/components/kin/Status";
import { CLASS_STATUS_LABEL } from "@/lib/tutorTodo";
import { kinButtonClass } from "@/components/kin/buttonClass";

export interface ClassHeadProps {
  name: string;
  category: string;
  /** Course.classStatus: open | paused | closed. */
  status: string;
  /** Course.status = false (lớp đang ẩn khỏi trang công khai). */
  hidden: boolean;
  studentCount: number;
  /** Q4 chủ chốt (14/11): chỉ chủ lớp — nút "Đề của lớp" mở ngân hàng đề lọc theo lớp này (?lop=), giao đề ngay từ đó. Đồng giảng không có nút. */
  examsHref?: string | null;
  /** SCL-G-GS (QUYET-DINH §2.2): nút chính "+ Giao bài" góc phải đầu lớp (chủ lớp / Chủ nhiệm). Vắng = không vẽ (đồng giảng). */
  giaoHref?: string | null;
  /** Màu lớp: vạch 4px trên đầu lớp (trang trí, không mang chữ). */
  color?: string;
}

const TONE: Record<string, "xong" | "cho" | "mo"> = { open: "xong", paused: "cho", closed: "mo" };

export default function ClassHead({ name, category, status, hidden, studentCount, examsHref, giaoHref, color }: ClassHeadProps) {
  return (
    <header data-class-head className="pb-4 md:pb-5">
      {color && <span aria-hidden data-vach-lop className="block h-1 w-16 rounded-full mb-2" style={{ background: color }} />}
      <Link href="/lop-cua-toi/lop" className="inline-flex items-center min-h-11 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] hover:underline">← Lớp học</Link>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <h1 className="min-w-0 break-words text-[length:var(--kin-co-h1)] leading-[var(--kin-dong-h1)] font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)]">{name}</h1>
        {(examsHref || giaoHref) && (
          <div className="flex flex-wrap items-center gap-3">
            {examsHref && <Link href={examsHref} data-de-cua-lop className={kinButtonClass("secondary")}>Đề của lớp</Link>}
            {giaoHref && <Link href={giaoHref} data-giao-bai className={kinButtonClass("primary")}>+ Giao bài</Link>}
          </div>
        )}
      </div>
      {giaoHref && <p data-cau-dan className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Giao bài tập, gắn video hoặc tài liệu cho lớp</p>}
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[length:var(--kin-co-goc)] leading-[var(--kin-dong-goc)] text-[var(--kin-chu-mo)]">
        {category && <span>{category}</span>}
        <span className="tabular-nums">{studentCount} học sinh</span>
        <KinStatus tone={TONE[status] ?? "mo"}>{CLASS_STATUS_LABEL[status] ?? status}</KinStatus>
        {hidden && <KinStatus tone="mo">Đang ẩn</KinStatus>}
      </p>
    </header>
  );
}
