// TUT-dong-giang 7.3 — nhóm "Lớp tôi đồng giảng" (dưới lớp riêng) + thẻ "Bạn có N lời mời đồng giảng" (chỉ ở Hộp việc).
// Rỗng (không lớp, không lời mời): KHÔNG hiện gì, không chiếm chỗ. Lỗi: dải báo + Thử lại. Dữ liệu: GET /api/tutor/dong-giang; tải lại khi lấy lại focus.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinPanel } from "@/components/kin/Panel";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { callApi } from "@/components/tutor/shared";
import DongGiangHang from "@/components/tutor/DongGiangHang";
import type { DongGiangResponse } from "@/components/tutor/dongGiangUi";

/** part: "invites" = chỉ thẻ lời mời (đầu Hộp việc, im lặng khi lỗi); "courses" = chỉ nhóm lớp; "all" = cả hai. */
export default function DongGiangNhom({ part = "courses" }: { part?: "invites" | "courses" | "all" }) {
  const [data, setData] = useState<DongGiangResponse | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const r = await callApi<DongGiangResponse>("/api/tutor/dong-giang");
    if (!r.ok || !Array.isArray(r.data.courses) || !Array.isArray(r.data.invitations)) { setError(true); return; }
    setData(r.data); setError(false);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  if (error) return part === "invites" ? null : <ErrorStrip message="Không tải được nhóm Lớp tôi đồng giảng." onRetry={() => void load()} />;
  if (data === null) return <p className="sr-only" aria-busy="true">Đang tải lớp đồng giảng</p>;
  const invites = part === "courses" ? 0 : data.invitations.length;
  const courses = part === "invites" ? [] : data.courses;
  if (courses.length === 0 && invites === 0) return null;

  return (
    <div data-dong-giang-nhom className="space-y-6 my-6">
      {invites > 0 && (
        <KinCallout title={`Bạn có ${invites} lời mời đồng giảng`}>
          Chủ lớp mời cô cùng dạy. Xem và nhận lời ở trang riêng.
          <Link href="/lop-cua-toi/dong-giang" className={`${kinButtonClass("secondary")} mt-3`}>Xem lời mời</Link>
        </KinCallout>
      )}
      {courses.length > 0 && (
        <section aria-labelledby="dg-nhom">
          <KinSectionHead id="dg-nhom" title="Lớp tôi đồng giảng" aside={`${courses.length} lớp`} />
          <KinPanel flush className="mt-4">
            <ul aria-label="Lớp tôi đồng giảng">{courses.map(c => <DongGiangHang key={c.courseId} c={c} />)}</ul>
          </KinPanel>
        </section>
      )}
    </div>
  );
}
