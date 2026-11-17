// TB-LOP (17/11/2026) — tab "Thông báo" trong trang lớp của học sinh (/student/hoc-tap?course=<id>&tab=thong-bao). Chỉ ĐỌC: tin một chiều của gia sư,
// tin ghim lên đầu. Đọc /api/courses/<id>/thong-bao (403 nếu chưa / không còn trong lớp). Đang tải → chữ; lỗi → ErrorStrip có nút thử lại; rỗng → KinEmptyState.
"use client";
import { useEffect, useState } from "react";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { ThongBaoTin, type ThongBaoItem } from "@/components/lop/ThongBaoTin";

export default function ThongBaoHocSinh({ courseId, enrolled }: { courseId: string; enrolled: boolean }) {
  const [items, setItems] = useState<ThongBaoItem[] | "loi" | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enrolled) return;
    let live = true;
    void Promise.resolve().then(() => { if (live) setItems(null); });
    fetch(`/api/courses/${encodeURIComponent(courseId)}/thong-bao`, { credentials: "same-origin", cache: "no-store" })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { items: ThongBaoItem[] }) => { if (live) setItems(Array.isArray(d.items) ? d.items : []); })
      .catch(() => { if (live) setItems("loi"); });
    return () => { live = false; };
  }, [courseId, enrolled, tick]);

  if (!enrolled) return <KinEmptyState title="Thông báo dành cho học sinh của lớp">Khi bạn vào lớp, tin gia sư gửi cả lớp sẽ hiện ở đây.</KinEmptyState>;
  if (items === null) return <p data-tb-dang-tai className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đang tải thông báo…</p>;
  if (items === "loi") return <ErrorStrip message="Không tải được thông báo của lớp." onRetry={() => setTick(t => t + 1)} />;
  if (items.length === 0) return <KinEmptyState title="Lớp chưa có thông báo nào">Khi gia sư gửi tin cho cả lớp (đổi giờ, link phòng học, việc cần chuẩn bị), tin sẽ hiện ở đây.</KinEmptyState>;
  return (
    <section aria-label="Thông báo của lớp" data-tb-hoc-sinh>
      <ul className="space-y-3">{items.map(it => <li key={it.id}><ThongBaoTin item={it} /></li>)}</ul>
    </section>
  );
}
