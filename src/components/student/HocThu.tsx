// SCL5 — khối học thử dùng chung cho Hôm nay, trang lớp và trang bài (docs/kin/rd/HOC-THU-VA-DANG-KY.md D5–D8, D16; QUYET-DINH-HOI-DONG P1-1, P2-11, P2-12).
//   HocThuBang : băng "Học thử Toán 12 · còn 3 ngày" + "Hết lúc 23:59 Thứ Tư 25/11" — giọng trung tính (KinPanel "nhan", không nền cảnh báo, không thanh đếm ngày).
//                Số ngày lấy từ Enrollment.trialDays (t.trialDays), không ghi cứng 14. Còn ≤ 3 ngày (tình huống 10) thì thêm Đăng ký chính thức + Zalo anh Thanh;
//                `chinh` = màn không còn nút chính nào khác ⇒ Đăng ký chính thức là nút đặc (mục 11). data-trial-bang="sap-het".
//   HocThuKhoa : màn hết hạn (D16, mục 12) — lớp vẫn KHOÁ HẲN (máy chủ không gửi cây bài, không link), nhưng hiện kết quả em đã có: đã học N bài, nộp M bài,
//                điểm từng bài bằng CHỮ. Số đến từ /api/student/lop (tiến độ thật) và /api/student/ket-qua?courseId=. Lỗi tải ⇒ ẩn ô số đó + ErrorStrip có Thử lại
//                (không bao giờ hiện "0" thay cho "chưa tải được"). `gon` = bản gọn ở màn Hôm nay (có nút Xem kết quả ở trang lớp).
"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { KinPanel } from "@/components/kin/Panel";
import { KinGradeStatus, type GradeState } from "@/components/kin/Status";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { TRIAL_WARN_DAYS } from "@/lib/trial";
import type { ThuVienResp, TrialView } from "@/lib/studentLop";
import { average10, on10, trialEndLine } from "@/lib/studentClassPage";

export const DANG_KY_URL = "https://aodtsix-cmd.github.io/bca-midnight-class/";
export const ZALO_ANH_THANH = "https://zalo.me/0384409051";
const GOC = "text-[length:var(--kin-co-goc)]";
const LINK = `inline-flex items-center min-h-11 ${GOC} font-medium text-[var(--kin-nhan-link)] underline`;

/** `mon` = tên các lớp đang học thử (màn Hôm nay gom mọi lớp — một hạn chung, D5). `trongLop` = đang ở trang lớp: máy chủ vừa mở đồng hồ khi tải lớp,
 *  nên "chưa bắt đầu" ở đây nghĩa là bắt đầu từ hôm nay (tình huống 9). */
export function HocThuBang({ t, mon, trongLop = false, chinh = false, className = "" }: { t: TrialView; mon?: string[]; trongLop?: boolean; chinh?: boolean; className?: string }) {
  const sapHet = t.kind === "dang_thu" && t.daysLeft <= TRIAL_WARN_DAYS;
  const ten = mon && mon.length > 0 ? ` ${mon.join(", ")}` : "";
  const head = t.kind === "chua_bat_dau" && !trongLop
    ? `Học thử${ten} ${t.trialDays} ngày, bắt đầu tính từ lần đầu bạn vào lớp`
    : t.kind === "chua_bat_dau" || t.daysLeft >= t.trialDays ? `Học thử${ten}: bắt đầu tính ${t.trialDays} ngày từ hôm nay` : `Học thử${ten} · còn ${t.daysLeft} ngày`;
  const end = t.kind === "dang_thu" ? trialEndLine(t.endsAt) : "";
  return (
    <KinPanel variant="nhan" data-trial-bang={sapHet ? "sap-het" : "nhan"} className={className}>
      <p className={`${GOC} font-semibold text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]`}>{head}</p>
      <p className={`mt-1 ${GOC} text-[var(--kin-chu-phu)]`}>
        {end && <>Hết lúc <span data-trial-het className="font-medium text-[var(--kin-chu-chinh)]">{end}</span>. </>}
        Trong hạn bạn làm được mọi việc như học sinh chính thức. Hết hạn thì bài đã nộp và điểm vẫn được giữ.
      </p>
      {sapHet && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <a href={DANG_KY_URL} target="_blank" rel="noopener noreferrer" data-dang-ky-bang className={kinButtonClass(chinh ? "primary" : "secondary")}>Đăng ký chính thức</a>
          <a href={ZALO_ANH_THANH} target="_blank" rel="noopener noreferrer" className={LINK}>Hỏi anh Thanh qua Zalo</a>
        </div>
      )}
    </KinPanel>
  );
}

type KqItem = { id: string; title: string; max: number; state: GradeState; score: number | null };

/** Ô số nhỏ (một hàng 3 ô ở mọi bề rộng, mục 12): không lớn, không lệch hàng ở 390. */
function O({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-trang)] px-2 py-2 text-center">
      <p className="text-[length:var(--kin-co-tieu-de)] leading-6 font-semibold tabular-nums text-[var(--kin-chu-chinh)]">{value}</p>
      <p className={`${GOC} leading-5 text-[var(--kin-chu-phu)]`}>{label}</p>
      {hint && <p className={`${GOC} leading-5 text-[var(--kin-chu-phu)]`}>{hint}</p>}
    </div>
  );
}

export function HocThuKhoa({ courseId, courseName, trialDays, gon = false, hocSan, chinh = true }: {
  courseId: string; courseName: string; trialDays?: number | null; gon?: boolean; /** false = màn đã có nút chính khác (vd Nộp bài) ⇒ Đăng ký là nút viền */ chinh?: boolean; /** Hôm nay đã có dòng /api/student/lop ⇒ không hỏi lại. */ hocSan?: { done: number; total: number };
}) {
  const [hoc, setHoc] = useState<{ done: number; total: number } | "loi" | null>(hocSan ?? null);
  const [kq, setKq] = useState<KqItem[] | "loi" | null>(null);
  const [tick, setTick] = useState(0);
  const coSan = !!hocSan;
  useEffect(() => {
    let live = true;
    if (!coSan) {
      fetch("/api/student/lop", { credentials: "same-origin", cache: "no-store" }).then(r => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d: ThuVienResp) => { const row = d?.classes?.find(c => c.id === courseId); if (live) setHoc(row ? { done: row.done, total: row.total } : "loi"); })
        .catch(() => { if (live) setHoc("loi"); });
    }
    fetch(`/api/student/ket-qua?courseId=${encodeURIComponent(courseId)}`, { credentials: "same-origin", cache: "no-store" }).then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { classes?: { courseId: string; items: KqItem[] }[] }) => { if (live) setKq(d?.classes?.find(c => c.courseId === courseId)?.items ?? []); })
      .catch(() => { if (live) setKq("loi"); });
    return () => { live = false; };
  }, [courseId, coSan, tick]);
  const items = Array.isArray(kq) ? kq : [];
  const nop = items.filter(i => i.state !== "chua-nop");
  const avg = Array.isArray(kq) ? average10(kq) : null;
  const loi = hoc === "loi" || kq === "loi";
  const retry = () => { if (!coSan) setHoc(null); setKq(null); setTick(t => t + 1); };
  const lopHref = `/student/hoc-tap?course=${encodeURIComponent(courseId)}`;
  return (
    <div data-trial-khoa className={gon ? "" : "pt-6"}>
      <KinPanel className={gon ? "" : "text-center"}>
        <h2 className="text-[length:var(--kin-co-tieu-de)] leading-6 font-semibold text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">
          {gon ? `Hết thời gian học thử ${courseName}` : "Hết thời gian học thử"}
        </h2>
        <p className={`mt-2 ${GOC} text-[var(--kin-chu-phu)] [overflow-wrap:anywhere]`}>
          {gon ? "Bài học, tài liệu và bài tập của lớp đang khoá. Kết quả bạn đã có vẫn được giữ."
            : <>{trialDays ? `${trialDays} ngày học thử` : "Thời gian học thử"} {courseName} đã hết. Bài học, tài liệu và bài tập đang khoá. Mọi thứ bạn đã làm vẫn được giữ, đăng ký chính thức xong là mở lại ngay.</>}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-left" data-kq-o>
          {hoc !== "loi" && <O label="Bài đã học" value={<span data-kq-da-hoc>{hoc ? hoc.done : "…"}</span>} hint={hoc && hoc.total > 0 ? `trên ${hoc.total} bài` : undefined} />}
          {kq !== "loi" && <O label="Bài đã nộp" value={<span data-kq-da-nop>{kq ? nop.length : "…"}</span>} />}
          {avg && <O label="Điểm trung bình" value={<span data-kq-tb>{avg}</span>} hint="thang 10" />}
        </div>
        {loi && <div className="mt-3 text-left" data-kq-loi><ErrorStrip message="Chưa tải được kết quả của bạn ở lớp này." onRetry={retry} /></div>}
        {!gon && nop.length > 0 && (
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
        {!gon && (
          <ul data-khoa-thong-tin className={`mt-4 space-y-1 text-left ${GOC} text-[var(--kin-chu-phu)] list-disc pl-5`}>
            <li>Học sinh chính thức xem lại mọi bài và bản ghi, nộp bài và được gia sư chấm, vào buổi học online của lớp.</li>
            <li>Trong lúc khoá, link học online, tài liệu và link nhóm Zalo của lớp tạm ẩn trong KiN. Bài tập chưa nộp mở lại khi bạn đăng ký chính thức.</li>
            <li>Học phí và cách đóng ghi ở <a href={DANG_KY_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-11 font-medium text-[var(--kin-nhan-link)] underline">trang đăng ký chính thức</a>.</li>
          </ul>
        )}
        <div className={`mt-5 flex flex-col gap-2 sm:flex-row sm:items-center ${gon ? "" : "sm:justify-center"}`}>
          <a href={DANG_KY_URL} target="_blank" rel="noopener noreferrer" data-dang-ky-chinh-thuc className={`${kinButtonClass(chinh ? "primary" : "secondary", "lg")} w-full sm:w-auto`}>Đăng ký chính thức</a>
          {gon
            ? <Link href={lopHref} data-xem-ket-qua className={LINK}>Xem kết quả ở trang lớp</Link>
            : <a href={ZALO_ANH_THANH} target="_blank" rel="noopener noreferrer" className={LINK}>Nhắn Zalo anh Thanh</a>}
        </div>
        {!gon && <p className={`mt-3 ${GOC} text-[var(--kin-chu-phu)]`}>Đã gửi phiếu chính thức thì anh Thanh xác nhận và mở lại lớp cho bạn, không cần gửi lại.</p>}
      </KinPanel>
    </div>
  );
}
