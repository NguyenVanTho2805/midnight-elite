// SCL5 — khối học thử dùng chung cho Hôm nay, trang lớp và trang bài (docs/kin/rd/HOC-THU-VA-DANG-KY.md D5–D8, D16; QUYET-DINH-HOI-DONG P1-1, P2-11, P2-12).
//   HocThuBang : băng "Học thử · còn N ngày · hết 21:40 Thứ Tư 25/11" — giọng trung tính (KinPanel "nhan", không nền cảnh báo, không thanh đếm ngày tiêu hao).
//                Còn ≤ 3 ngày (tình huống 10) thì thêm lối Đăng ký chính thức + Zalo anh Thanh; data-trial-bang="sap-het".
//   HocThuKhoa : màn hết hạn (D16) — lớp vẫn KHOÁ HẲN (máy chủ không gửi cây bài, không link), nhưng hiện kết quả em đã có: đã học N bài, nộp M bài,
//                điểm từng bài bằng CHỮ (không link, không mở được nội dung). Số đến từ /api/student/lop (tiến độ thật) và /api/student/ket-qua?courseId=.
"use client";
import { useEffect, useState } from "react";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { KinPanel } from "@/components/kin/Panel";
import { KinStat, KinStatRow } from "@/components/kin/Stat";
import { KinGradeStatus, type GradeState } from "@/components/kin/Status";
import { TRIAL_DAYS, TRIAL_WARN_DAYS } from "@/lib/trial";
import type { ThuVienResp, TrialView } from "@/lib/studentLop";
import { average10, on10, trialEndLine } from "@/lib/studentClassPage";

export const DANG_KY_URL = "https://aodtsix-cmd.github.io/bca-midnight-class/";
export const ZALO_ANH_THANH = "https://zalo.me/0384409051";
const GOC = "text-[length:var(--kin-co-goc)]";

/** `mon` = tên các lớp đang học thử (màn Hôm nay gom mọi lớp — một hạn chung, D5). `trongLop` = đang ở trang lớp: máy chủ vừa mở đồng hồ khi tải lớp,
 *  nên "chưa bắt đầu" ở đây nghĩa là bắt đầu từ hôm nay (tình huống 9). */
export function HocThuBang({ t, mon, trongLop = false, className = "" }: { t: TrialView; mon?: string[]; trongLop?: boolean; className?: string }) {
  const sapHet = t.kind === "dang_thu" && t.daysLeft <= TRIAL_WARN_DAYS;
  const head = t.kind === "chua_bat_dau" && !trongLop
    ? `Học thử ${TRIAL_DAYS} ngày, bắt đầu tính từ lần đầu bạn vào lớp`
    : t.kind === "chua_bat_dau" || t.daysLeft >= TRIAL_DAYS ? `Bắt đầu tính ${TRIAL_DAYS} ngày học thử từ hôm nay` : `Học thử · còn ${t.daysLeft} ngày`;
  const end = t.kind === "dang_thu" ? trialEndLine(t.endsAt) : "";
  return (
    <KinPanel variant="nhan" data-trial-bang={sapHet ? "sap-het" : "nhan"} className={className}>
      {mon && mon.length > 0 && <p className={`${GOC} text-[var(--kin-chu-phu)] [overflow-wrap:anywhere]`}>Học thử · {mon.join(", ")}</p>}
      <p className={`${GOC} font-semibold text-[var(--kin-chu-chinh)]`}>{head}</p>
      <p className={`mt-1 ${GOC} text-[var(--kin-chu-phu)]`}>
        {end && <>Hết lúc <span data-trial-het className="font-medium text-[var(--kin-chu-chinh)]">{end}</span>. </>}
        Trong hạn bạn làm được mọi việc như học sinh chính thức. Hết hạn thì bài đã nộp và điểm vẫn được giữ.
      </p>
      {sapHet && (
        <div className="mt-3 flex flex-wrap gap-3">
          <a href={DANG_KY_URL} target="_blank" rel="noopener noreferrer" className={kinButtonClass("secondary")}>Đăng ký chính thức</a>
          <a href={ZALO_ANH_THANH} target="_blank" rel="noopener noreferrer" className={kinButtonClass("ghost")}>Hỏi anh Thanh qua Zalo</a>
        </div>
      )}
    </KinPanel>
  );
}

type KqItem = { id: string; title: string; max: number; state: GradeState; score: number | null };

export function HocThuKhoa({ courseId, courseName }: { courseId: string; courseName: string }) {
  const [hoc, setHoc] = useState<{ done: number; total: number } | null>(null);
  const [kq, setKq] = useState<KqItem[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/student/lop", { credentials: "same-origin", cache: "no-store" }).then(r => (r.ok ? r.json() : null))
      .then((d: ThuVienResp | null) => { const row = d?.classes?.find(c => c.id === courseId); if (live && row) setHoc({ done: row.done, total: row.total }); }).catch(() => {});
    fetch(`/api/student/ket-qua?courseId=${encodeURIComponent(courseId)}`, { credentials: "same-origin", cache: "no-store" }).then(r => (r.ok ? r.json() : null))
      .then((d: { classes?: { courseId: string; items: KqItem[] }[] } | null) => { if (live) setKq(d?.classes?.find(c => c.courseId === courseId)?.items ?? []); }).catch(() => { if (live) setKq([]); });
    return () => { live = false; };
  }, [courseId]);
  const nop = (kq ?? []).filter(i => i.state !== "chua-nop");
  const avg = kq ? average10(kq) : null;
  return (
    <div data-trial-khoa className="pt-6">
      <KinPanel className="text-center">
        <h2 className="text-[length:var(--kin-co-tieu-de)] leading-6 font-semibold text-[var(--kin-chu-chinh)]">Hết thời gian học thử</h2>
        <p className={`mt-2 ${GOC} text-[var(--kin-chu-phu)] [overflow-wrap:anywhere]`}>
          {TRIAL_DAYS} ngày học thử {courseName} đã hết. Bài học, tài liệu và bài tập đang khoá. Mọi thứ bạn đã làm vẫn được giữ, đăng ký chính thức xong là mở lại ngay.
        </p>
        <KinStatRow boxed className="mt-4 text-left">
          <KinStat label="Bài đã học" value={<span data-kq-da-hoc>{hoc ? hoc.done : "…"}</span>} hint={hoc && hoc.total > 0 ? `trên ${hoc.total} bài` : undefined} />
          <KinStat label="Bài đã nộp" value={<span data-kq-da-nop>{kq ? nop.length : "…"}</span>} />
          {avg && <KinStat label="Điểm trung bình" value={<span data-kq-tb>{avg}</span>} hint="thang 10" />}
        </KinStatRow>
        {nop.length > 0 && (
          <ul aria-label="Điểm từng bài của bạn" data-kq-bai className="mt-2 text-left border-t border-[var(--kin-vien-nhat)]">
            {nop.map(i => (
              <li key={i.id} className={`flex items-center justify-between gap-3 py-3 border-b border-[var(--kin-vien-nhat)] ${GOC}`}>
                <span className="min-w-0 text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{i.title}</span>
                {i.state === "da-cham" && i.score !== null
                  ? <span className="flex-shrink-0 font-semibold tabular-nums text-[var(--kin-chu-chinh)]">{on10(i.score, i.max)}/10</span>
                  : <KinGradeStatus state={i.state} />}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a href={DANG_KY_URL} target="_blank" rel="noopener noreferrer" data-dang-ky-chinh-thuc className={`${kinButtonClass("primary", "lg")} w-full sm:w-auto`}>Đăng ký chính thức</a>
          <a href={ZALO_ANH_THANH} target="_blank" rel="noopener noreferrer" className={`${kinButtonClass("secondary", "lg")} w-full sm:w-auto`}>Nhắn Zalo anh Thanh</a>
        </div>
        <p className={`mt-3 ${GOC} text-[var(--kin-chu-phu)]`}>Đã gửi phiếu chính thức thì anh Thanh xác nhận và mở lại lớp cho bạn, không cần gửi lại.</p>
      </KinPanel>
    </div>
  );
}
