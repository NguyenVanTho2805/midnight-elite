// Danh sách "Đề thi" của học sinh (BU-04 mục 5.5): đề được giao theo lớp / đường dẫn / thư viện, với chế độ, hạn ("Còn 3 ngày"), trạng thái, số lượt, điểm tốt nhất.
// Dữ liệu từ /api/student/de-thi (máy chủ lọc: không mã đề con, không tên học sinh khác, không đề lớp em chưa vào). Thứ tự và nhãn hạn là hàm thuần ở examRoomLib.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { kinButtonClass } from "@/components/kin/Button";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinPanel } from "@/components/kin/Panel";
import { KinStatus, type StatusTone } from "@/components/kin/Status";
import { examRoomApi, type AssignmentItem, type AssignmentState } from "@/lib/examRoomApi";
import { daysLeftLabel, opensLabel, sortAssignments } from "@/lib/examRoomLib";
import { ASSIGNMENT_ACTION, ASSIGNMENT_STATE_LABEL } from "./roomLogic";

const TONE: Record<AssignmentState, StatusTone> = { "dang-lam": "cho", "dang-mo": "xong", "chua-mo": "mo", "da-dong": "mo", "cho-cong-bo": "cho", "da-lam": "xong" };

/** Tải danh sách; `error` để trang hiện dải lỗi + Thử lại. */
export function useAssignments() {
  const [data, setData] = useState<{ serverNow: string; items: AssignmentItem[] } | null>(null);
  const [error, setError] = useState(false);
  const load = useCallback(() => {
    void examRoomApi.listAssignments().then(r => { if (r.ok) { setData({ serverNow: r.data.serverNow, items: sortAssignments(r.data.items) }); setError(false); } else setError(true); });
  }, []);
  useEffect(() => { load(); }, [load]);
  return { data, error, load };
}

function Row({ it, serverNow }: { it: AssignmentItem; serverNow: string }) {
  const due = daysLeftLabel(it.dueAt, serverNow);
  const opens = it.state === "chua-mo" ? opensLabel(it.opensAt) : "";
  const action = ASSIGNMENT_ACTION[it.state];
  const where = it.courseName ?? (it.source === "link" ? "Giao qua đường dẫn" : "Thư viện thi thử");
  return (
    <li data-de-thi-hang data-trang-thai={it.state} className="flex flex-col md:flex-row md:items-center gap-3 px-[var(--kin-kc-6)] py-[var(--kin-kc-6)] min-h-[72px] border-b border-[var(--kin-vien-nhat)]">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-[length:var(--kin-co-body)] leading-6 text-[var(--kin-chu-chinh)]">
          <span className="min-w-0 break-words">{it.title}</span>
          {it.mode && <span className="px-2 rounded-[var(--kin-bo-tron)] text-[length:var(--kin-co-caption)] font-semibold" style={{ border: "1px solid var(--kin-th-navy)", color: "var(--kin-th-navy)" }}>{it.mode === "practice" ? "Luyện tập" : "Kiểm tra"}</span>}
        </p>
        <p className="mt-1 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
          {where}{it.questionCount ? ` · ${it.questionCount} câu` : ""}{it.durationMinutes ? ` · ${it.durationMinutes} phút` : ""}
          {it.attempts.max ? ` · Lượt ${Math.min(it.attempts.used, it.attempts.max)}/${it.attempts.max}` : it.attempts.used ? ` · Đã làm ${it.attempts.used} lượt` : ""}
          {it.best ? ` · Điểm tốt nhất ${it.best.score}/${it.best.total}` : ""}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[length:var(--kin-co-goc)]">
          <KinStatus tone={TONE[it.state]}>{ASSIGNMENT_STATE_LABEL[it.state]}</KinStatus>
          {due && <span className="font-semibold tabular-nums" data-han style={{ color: due === "Đã quá hạn" ? "var(--kin-tt-chu-loi)" : "var(--kin-chu-phu)" }}>{due}</span>}
          {opens && <span className="text-[var(--kin-chu-mo)] tabular-nums">{opens}</span>}
        </p>
      </div>
      {action && <Link href={`/student/thi-thu/${it.id}`} className={`${kinButtonClass(it.state === "dang-mo" || it.state === "dang-lam" ? "primary" : "secondary")} min-h-12 max-md:w-full md:min-w-[120px]`}>{action}</Link>}
    </li>
  );
}

export default function AssignmentList({ items, serverNow, limit, emptyLink = true }: { items: AssignmentItem[]; serverNow: string; limit?: number; emptyLink?: boolean }) {
  const list = limit ? items.slice(0, limit) : items;
  if (list.length === 0) {
    return (
      <KinEmptyState title="Chưa có đề nào được giao" action={emptyLink ? <Link href="/thi-thu" className={kinButtonClass("secondary")}>Xem thi thử</Link> : undefined}>
        Đề của lớp em đang học hoặc đề gia sư gửi đường dẫn sẽ hiện ở đây, kèm hạn làm bài.
      </KinEmptyState>
    );
  }
  return <KinPanel flush className="mt-4"><ul aria-label="Đề thi được giao">{list.map(it => <Row key={it.id} it={it} serverNow={serverNow} />)}</ul></KinPanel>;
}
