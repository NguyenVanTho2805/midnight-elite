// GS-LOP-GON (09/11/2026) — THƯ VIỆN LỚP: thẻ lớp dạng lưới thay cho bảng 5 cột của "Lớp học" (chủ dùng bản thật: "khó dùng, ẩu"). Mỗi thẻ: ảnh bìa 16:9 (Course.bg dạng url https,
// đã lọc ở máy chủ — không có ảnh hoặc ảnh lỗi thì ô chữ cái đầu của tên lớp trên nền token), tên lớp, môn · số học sinh, lịch cố định, nhãn trạng thái bằng CHỮ
// ("Đang nhận học viên" / "Tạm ngừng" / "Đã đóng", thêm "đang ẩn"), tiến độ đã điểm danh. Cả thẻ bấm được (mở Giáo trình của lớp); nút phụ "Mời học sinh" (lớp chưa có em) và "Đặt lịch" (chưa có lịch) ≥ 44px.
// Cột: 1 ở 390/320 (lịch xuống dòng đủ chữ, không cắt — đặc tả 6.3), 2 từ 768, 3 từ 1280 (khung Figma 1600 cũng 3 cột, không 4). Thẻ KHÔNG có tên học sinh, liên lạc hay tiền.
"use client";
import Link from "next/link";
import { useState } from "react";
import { kinButtonClass } from "@/components/kin/Button";
import { KinStatus, type StatusTone } from "@/components/kin/Status";
import type { TutorClassRow } from "@/lib/tutorClassTable";
import { CLASS_STATUS_LABEL } from "@/lib/tutorTodo";
import { giaoTrinhHref } from "@/lib/tutorRoutes";
import { classBase } from "@/lib/tutorClassRoutes";

const TONE: Record<string, StatusTone> = { open: "xong", paused: "cho", closed: "mo" };

/** Chữ cái đầu của tên lớp (bỏ khoảng trắng đầu); tên rỗng → "L". */
export const classInitial = (name: string): string => (Array.from(name.trim())[0] ?? "L").toLocaleUpperCase("vi");

function Cover({ row }: { row: TutorClassRow }) {
  const [broken, setBroken] = useState(false);
  if (row.cover && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={row.cover} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />;
  }
  return (
    <span aria-hidden data-lop-bia-chu className="flex h-full w-full items-center justify-center bg-[var(--kin-nhan-nen-nhat)] text-[length:var(--kin-co-h1)] font-medium text-[var(--kin-nhan-link)]">
      {classInitial(row.name)}
    </span>
  );
}

export default function ThuVienLop({ rows }: { rows: TutorClassRow[] }) {
  return (
    <ul aria-label="Danh sách lớp" data-thu-vien-lop className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map(c => {
        const base = classBase(c.id);
        const empty = c.students === 0;
        return (
          <li key={c.id} data-lop-the className="relative flex min-w-0 flex-col overflow-hidden rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)] focus-within:outline-2 focus-within:outline-[var(--kin-nhan-link)]">
            <div className="aspect-video w-full overflow-hidden bg-[var(--kin-nen-bang)]"><Cover row={c} /></div>
            <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
              <h3 className="text-[length:var(--kin-co-tieu-de)] font-medium leading-6 break-words">{c.name}</h3>
              <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)] break-words">
                {c.category && <>{c.category} · </>}<span className="tabular-nums">{c.students}{c.capacity != null ? `/${c.capacity}` : ""} học sinh</span>
              </p>
              <p className="text-[length:var(--kin-co-goc)] leading-5 break-words">
                {c.schedule ? <span className="tabular-nums">{c.schedule}</span> : <span className="text-[var(--kin-chu-mo)]">Chưa xếp lịch</span>}
              </p>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <KinStatus tone={TONE[c.classStatus] ?? "mo"}>{CLASS_STATUS_LABEL[c.classStatus] ?? c.classStatus}</KinStatus>
                {c.hidden && <KinStatus tone="mo">Đang ẩn</KinStatus>}
              </p>
              <p className={`text-[length:var(--kin-co-goc)] leading-5 ${c.sessionsTaught > 0 ? "tabular-nums" : "text-[var(--kin-chu-mo)]"}`}>{c.sessionsTaught > 0 ? `${c.sessionsTaught} buổi đã điểm danh` : "Chưa bắt đầu"}</p>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                {/* liên kết "Mở lớp" trải cả thẻ (::after phủ kín); các nút phụ khác nằm trên nó (relative z-10) */}
                <Link href={giaoTrinhHref(c.id, true)} aria-label={`Mở lớp ${c.name}`} className={`${kinButtonClass("secondary")} flex-1 after:absolute after:inset-0 after:content-[''] sm:flex-none`}>Mở lớp <span aria-hidden>→</span></Link>
                {empty && <Link href={`${base}/hoc-vien?muc=ma-moi`} aria-label={`Mời học sinh vào ${c.name}`} className={`${kinButtonClass("primary")} relative z-10 flex-1 sm:flex-none`}>Mời học sinh</Link>}
                {!c.schedule && <Link href={`${base}/lich-hoc`} aria-label={`Đặt lịch cho lớp ${c.name}`} className="relative z-10 inline-flex min-h-11 items-center text-[length:var(--kin-co-goc)] text-[var(--kin-nhan-link)] hover:underline">Đặt lịch</Link>}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
