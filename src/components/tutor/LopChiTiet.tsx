// Chi tiết một lớp của gia sư (Figma "Gia sư · Chi tiết Toán 9" 299:112581): H1 tên lớp + dòng phụ (sĩ số, lịch), nút "Mời học sinh" và "Cài đặt lớp";
// dải tab; tab "Buổi học & điểm danh" = điểm danh (thành phần DiemDanh dùng chung) ở cột trái, cột phải "Học sinh", mã mời, "Lịch sử buổi học".
// Điện thoại: một cột, tab cuộn ngang, nút ≥ 44px. Không có (chưa có tính năng): "Chốt buổi đã dạy", "Xử lý nghỉ muộn" ngay trên trang lớp,
// báo cáo "Chia sẻ" từng học sinh, "Đơn giá hiện tại", tab Bài tập / Tài liệu theo lớp, "x/y buổi" (chưa có tổng số buổi dự kiến). Đã ghi trong báo cáo.
"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { KinTabs, type KinTabItem } from "@/components/kin/Tabs";
import { kinButtonClass } from "@/components/kin/Button";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinCallout } from "@/components/kin/Callout";
import { KinStatus } from "@/components/kin/Status";
import { KinCopyButton } from "@/components/kin/CopyButton";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinPage, KinPageHeader, KIN_TWO_COL, KIN_TABLE_ROW } from "@/components/kin/PageLayout";
import ClassInvitesPanel from "@/components/tutor/ClassInvites";
import DiemDanhPanel from "@/components/tutor/DiemDanh";
import LopHocPhi from "@/components/tutor/LopHocPhi";
import type { FeeMode } from "@/lib/tuitionFee";

export type LopTab = "diem-danh" | "hoc-sinh" | "ma-moi" | "hoc-phi" | "cong-dong";
export interface LopChiTietData {
  courseId: string; courseName: string; category: string; viewerName: string | null;
  schedule: string | null;
  students: { id: string; name: string }[];
  history: { id: string; dateKey: string; note: string | null; marked: number }[];
  sessionsTaught: number;
  inviteCode: string | null;
  initialTab: LopTab; justCreated: boolean; scheduleFailed: boolean;
  /** HP-15: hình thức học phí của lớp. Lớp cũ = "monthly_sessions". */
  feeMode: FeeMode;
}

const dm = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

function OpenPage({ title, href, note, action }: { title: string; href: string; note: string; action: string }) {
  return (
    <section className="max-w-xl">
      <KinSectionHead title={title} />
      <p className="pt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{note}</p>
      <Link href={href} className={`${kinButtonClass("secondary")} mt-4`}>{action}</Link>
    </section>
  );
}

export default function LopChiTiet({ d }: { d: LopChiTietData }) {
  const [tab, setTab] = useState<LopTab>(d.initialTab);
  const n = d.students.length;
  const tabs: KinTabItem<LopTab>[] = [
    { key: "diem-danh", label: "Buổi học & điểm danh" },
    { key: "hoc-sinh", label: `Học sinh · ${n}` },
    { key: "ma-moi", label: "Mã mời" },
    { key: "hoc-phi", label: "Học phí" },
    { key: "cong-dong", label: "Cộng đồng lớp" },
  ];
  const sub = [`${n} học sinh`, d.schedule ?? "Chưa xếp lịch", d.category].filter(Boolean).join(" · ");

  return (
    <KinPage>
      <KinPageHeader title={d.courseName} titleClassName="break-words" sub={sub} back={{ href: "/lop-cua-toi/lop", label: "← Lớp học" }}
        actions={<>
          <button type="button" onClick={() => setTab("ma-moi")} className={kinButtonClass("secondary")}>Mời học sinh</button>
          <Link href={`/admin/khoa-hoc/${d.courseId}`} className={kinButtonClass("ghost")}>Cài đặt lớp</Link>
        </>} />

      {d.justCreated && <KinCallout title="Đã tạo lớp" className="mb-6">Gửi mã mời ở tab Mã mời để học sinh tự vào lớp.</KinCallout>}
      {d.scheduleFailed && (
        <KinCallout title="Lớp đã tạo, nhưng khung giờ chưa lưu" className="mb-6">
          Cô thêm lại khung giờ ở <Link href={`/admin/khoa-hoc/${d.courseId}?tab=lich-hoc`} className="underline text-[var(--kin-nhan-link)]">trang cài đặt lớp</Link>.
        </KinCallout>
      )}

      <KinTabs tabs={tabs} value={tab} onChange={setTab} label="Nội dung của lớp"
        tabId={k => `lop-tab-${k}`} panelId={k => `lop-panel-${k}`} />

      <div role="tabpanel" id={`lop-panel-${tab}`} aria-labelledby={`lop-tab-${tab}`} className="pt-6">
        {tab === "diem-danh" && (
          <div className={KIN_TWO_COL}>
            <div className="min-w-0">
              <Suspense fallback={null}><DiemDanhPanel courseId={d.courseId} embedded /></Suspense>
            </div>
            <aside className="min-w-0 space-y-[var(--kin-cach-muc)]">
              <section aria-labelledby="lop-hs">
                <KinSectionHead id="lop-hs" title="Học sinh" aside={<Link href={`/admin/khoa-hoc/${d.courseId}/hoc-vien`} className="text-[var(--kin-nhan-link)] hover:underline">Danh bạ lớp →</Link>} />
                {n === 0 ? (
                  <KinEmptyState title="Lớp chưa có học sinh" action={<button type="button" onClick={() => setTab("ma-moi")} className={kinButtonClass("secondary")}>Mời học sinh</button>}>
                    Gửi mã mời để học sinh tự vào lớp.
                  </KinEmptyState>
                ) : (
                  <ul aria-label="Học sinh của lớp">
                    {d.students.map(s => (
                      <li key={s.id} className={`flex ${KIN_TABLE_ROW} text-[var(--kin-chu-chinh)]`}>{s.name}</li>
                    ))}
                  </ul>
                )}
                <p className="mt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] flex items-center gap-2 flex-wrap">
                  {d.inviteCode ? (<>Mã mời lớp: <b className="font-medium text-[var(--kin-chu-chinh)] tabular-nums">{d.inviteCode}</b>
                    <KinCopyButton text={d.inviteCode} label="Chép mã mời lớp" appearance="icon" size="sm" /></>)
                    : <>Lớp chưa có mã mời còn dùng được. <button type="button" onClick={() => setTab("ma-moi")} className="min-h-11 text-[var(--kin-nhan-link)] underline">Tạo mã mời</button></>}
                </p>
              </section>

              <section aria-labelledby="lop-ls">
                <KinSectionHead id="lop-ls" title="Lịch sử buổi học" />
                {d.history.length === 0 ? (
                  <p className="pt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Chưa có buổi nào được điểm danh. Chọn ngày ở cột trái rồi tạo buổi điểm danh đầu tiên.</p>
                ) : (
                  <ul aria-label="Các buổi đã điểm danh gần đây">
                    {d.history.map(h => {
                      const full = n > 0 && h.marked >= n;
                      return (
                        <li key={h.id} className={`flex justify-between gap-3 ${KIN_TABLE_ROW}`}>
                          <span className="min-w-0 break-words text-[var(--kin-chu-chinh)]">{dm(h.dateKey)}{h.note ? ` · ${h.note}` : ""}</span>
                          <KinStatus tone={full ? "xong" : "cho"} className="flex-shrink-0">{full ? "Đã điểm danh đủ" : `Mới ${h.marked}/${n} em`}</KinStatus>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <p className="mt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{d.sessionsTaught} buổi đã điểm danh từ đầu đến nay.</p>
              </section>
            </aside>
          </div>
        )}

        {tab === "hoc-sinh" && (
          <section className="max-w-2xl">
            <KinSectionHead title="Học sinh của lớp" aside={`${n} em`} />
            {n === 0 ? (
              <KinEmptyState title="Lớp chưa có học sinh" action={<button type="button" onClick={() => setTab("ma-moi")} className={kinButtonClass("primary")}>Mời học sinh</button>}>
                Gửi mã mời để học sinh tự vào lớp. Học sinh vào xong sẽ hiện ở đây.
              </KinEmptyState>
            ) : (
              <>
                <ul aria-label="Học sinh của lớp">
                  {d.students.map(s => <li key={s.id} className={`flex ${KIN_TABLE_ROW} text-[var(--kin-chu-chinh)]`}>{s.name}</li>)}
                </ul>
                <Link href={`/admin/khoa-hoc/${d.courseId}/hoc-vien`} className={`${kinButtonClass("secondary")} mt-4`}>Mở danh bạ lớp (gọi, Zalo phụ huynh)</Link>
              </>
            )}
          </section>
        )}

        {tab === "ma-moi" && (
          <section className="max-w-3xl">
            <KinSectionHead title="Mã mời vào lớp" />
            <p className="py-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Gửi mã hoặc link cho học sinh; các em tự vào lớp, không cần cô thêm từng người.</p>
            <ClassInvitesPanel courseId={d.courseId} courseName={d.courseName} tutorName={d.viewerName} />
          </section>
        )}

        {tab === "hoc-phi" && <LopHocPhi courseId={d.courseId} feeMode={d.feeMode} />}

        {tab === "cong-dong" && (
          <OpenPage title="Kiểm duyệt cộng đồng lớp" href="/lop-cua-toi/kiem-duyet" action="Mở Kiểm duyệt"
            note="Xem báo cáo bài viết trong các lớp của cô, xoá bài vi phạm hoặc bỏ qua." />
        )}
      </div>
    </KinPage>
  );
}
