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
import ClassInvitesPanel from "@/components/tutor/ClassInvites";
import DiemDanhPanel from "@/components/tutor/DiemDanh";

export type LopTab = "diem-danh" | "hoc-sinh" | "ma-moi" | "hoc-phi" | "cong-dong";
export interface LopChiTietData {
  courseId: string; courseName: string; category: string; viewerName: string | null;
  schedule: string | null;
  students: { id: string; name: string }[];
  history: { id: string; dateKey: string; note: string | null; marked: number }[];
  sessionsTaught: number;
  inviteCode: string | null;
  initialTab: LopTab; justCreated: boolean; scheduleFailed: boolean;
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
    <div className="px-4 md:px-10 pt-6 md:pt-8 pb-10 bg-[var(--kin-nen-trang)]">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6">
        <div className="min-w-0">
          <Link href="/lop-cua-toi/lop" className="inline-flex items-center min-h-11 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] hover:underline">← Lớp học</Link>
          <h1 className="text-[length:var(--kin-co-h2)] leading-9 font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)] break-words">{d.courseName}</h1>
          <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{sub}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start flex-shrink-0">
          <button type="button" onClick={() => setTab("ma-moi")} className={kinButtonClass("secondary")}>Mời học sinh</button>
          <Link href={`/admin/khoa-hoc/${d.courseId}`} className={kinButtonClass("ghost")}>Cài đặt lớp</Link>
        </div>
      </header>

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
          <div className="grid lg:grid-cols-[minmax(0,1fr)_354px] gap-x-12 gap-y-10 items-start">
            <div className="min-w-0">
              <Suspense fallback={null}><DiemDanhPanel courseId={d.courseId} embedded /></Suspense>
            </div>
            <aside className="min-w-0 space-y-8">
              <section aria-labelledby="lop-hs">
                <KinSectionHead id="lop-hs" title="Học sinh" aside={<Link href={`/admin/khoa-hoc/${d.courseId}/hoc-vien`} className="text-[var(--kin-nhan-link)] hover:underline">Danh bạ lớp →</Link>} />
                {n === 0 ? (
                  <KinEmptyState title="Lớp chưa có học sinh" action={<button type="button" onClick={() => setTab("ma-moi")} className={kinButtonClass("secondary")}>Mời học sinh</button>}>
                    Gửi mã mời để học sinh tự vào lớp.
                  </KinEmptyState>
                ) : (
                  <ul aria-label="Học sinh của lớp">
                    {d.students.map(s => (
                      <li key={s.id} className="px-[var(--kin-kc-6)] py-[var(--kin-kc-6)] border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">{s.name}</li>
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
                        <li key={h.id} className="flex items-baseline justify-between gap-3 px-[var(--kin-kc-6)] py-[var(--kin-kc-6)] border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)]">
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
                  {d.students.map(s => <li key={s.id} className="px-[var(--kin-kc-6)] py-[var(--kin-kc-6)] border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">{s.name}</li>)}
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

        {tab === "hoc-phi" && (
          <OpenPage title="Học phí và đối soát" href="/lop-cua-toi/hoc-phi" action="Mở Học phí"
            note="Lập phiếu có mã, theo dõi tiền vào, nhận tiền thẳng vào tài khoản của cô. Học phí tính theo tháng, không tính theo buổi có mặt." />
        )}

        {tab === "cong-dong" && (
          <OpenPage title="Kiểm duyệt cộng đồng lớp" href="/lop-cua-toi/kiem-duyet" action="Mở Kiểm duyệt"
            note="Xem báo cáo bài viết trong các lớp của cô, xoá bài vi phạm hoặc bỏ qua." />
        )}
      </div>
    </div>
  );
}
