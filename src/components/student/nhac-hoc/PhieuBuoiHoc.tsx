// LOI-04 mục 5 — mục TỰ ĐỘNG theo lớp trong Nhắc học: một bài Đã đăng có hẹn ngày (dữ liệu `lop` của GET /api/student/nhac-hoc = nguyên loadHomNay của LOI-03).
// CHỈ ĐỌC: không ô "Xong". Dòng 1: "Buổi học · 19:30 · <tên lớp>"; dòng 2: tên bài (liên kết href); dưới là phiếu — hôm nay: tài liệu "Mở ↗", "Bài Azota ↗", "Làm bài tập";
// ngày khác chỉ có "Làm bài tập" (đúng dữ liệu `upcoming`). Nút viền "Ghi chú cho buổi này" do trang cha xử lý (POST một nhắc việc gắn bài).
// Không vẽ gì API không trả: không đáp án, điểm, câu hỏi, ghi chú của gia sư. Liên kết ngoài mở tab mới, rel="noopener noreferrer".
// Móc kiểm thử: [data-nhac-buoi=<lessonId>], [data-nhac-buoi-tai-lieu], [data-nhac-buoi-azota], [data-nhac-buoi-bai-tap], [data-nhac-buoi-ghi-chu].
"use client";
import Link from "next/link";
import { KinPanel } from "@/components/kin/Panel";
import { KinStatus } from "@/components/kin/Status";
import { kinButtonClass } from "@/components/kin/Button";
import type { HomNayItem, HomNayUpcomingItem } from "@/lib/studentLop";

const GOC = "text-[length:var(--kin-co-goc)]";
const linkCls = `inline-flex items-center min-h-11 ${GOC} font-medium text-[var(--kin-nhan-link)] underline [overflow-wrap:anywhere]`;

export function PhieuBuoiHoc({ it, busy, onNote }: { it: HomNayItem | HomNayUpcomingItem; busy: boolean; onNote: (it: HomNayItem | HomNayUpcomingItem) => void }) {
  const docs = "docs" in it && Array.isArray(it.docs) ? it.docs : [];
  const azota = "azota" in it && Array.isArray(it.azota) ? it.azota : [];
  return (
    <KinPanel variant="nhan" as="li" data-nhac-buoi={it.lessonId} className="list-none">
      <p className={`${GOC} leading-5 text-[var(--kin-chu-mo-tren-nen-nhan)] break-words`}>
        <span className="font-semibold text-[var(--kin-chu-chinh)]">Buổi học</span> · <span className="tabular-nums">{it.time}</span> · {it.courseName}
        {it.past && <> <KinStatus tone="mo" className="ml-1 align-middle">Đã qua</KinStatus></>}
      </p>
      <Link href={it.href} data-nhac-buoi-ten-bai className="mt-1 inline-flex items-center min-h-11 text-[length:var(--kin-co-body)] font-medium leading-6 text-[var(--kin-chu-chinh)] hover:underline [overflow-wrap:anywhere]">
        {it.lessonTitle}
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
        {docs.map((d, i) => (
          <a key={`d${i}`} href={d.href} target="_blank" rel="noopener noreferrer" data-nhac-buoi-tai-lieu className={linkCls} aria-label={`Mở tài liệu ${d.name} (tab mới)`}>
            <span className="max-w-[220px] truncate">{d.name}</span>&nbsp;· Mở ↗
          </a>
        ))}
        {azota.map((a, i) => (
          <a key={`a${i}`} href={a.url} target="_blank" rel="noopener noreferrer" data-nhac-buoi-azota className={linkCls} aria-label={`${a.label} của bài ${it.lessonTitle} (tab mới)`}>{a.label} ↗</a>
        ))}
        {it.baiTapHref && <Link href={it.baiTapHref} data-nhac-buoi-bai-tap className={kinButtonClass("secondary")}>Làm bài tập</Link>}
        <button type="button" data-nhac-buoi-ghi-chu disabled={busy} aria-busy={busy || undefined} onClick={() => onNote(it)} className={kinButtonClass("secondary")}>
          {busy ? "Đang tạo…" : "Ghi chú cho buổi này"}
        </button>
      </div>
    </KinPanel>
  );
}
