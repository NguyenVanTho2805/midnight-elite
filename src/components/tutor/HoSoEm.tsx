// Hồ sơ nhiều tab của MỘT học sinh có tài khoản (Figma "Học sinh · Hồ sơ Gia Bảo" 464:6423; HS-02, HS-06, HS-08, HS-09, DD-07).
// Tab: Tổng quan · Điểm danh (90 ngày + buổi đã học + điểm từng buổi nếu đồng ý) · Ghi chú · Phiếu · Bài tập · Báo cáo riêng.
// Chỉ GOM dữ liệu đã có (GET /api/tutor/hoc-sinh/[userId]); thông tin riêng của em đã đi qua maskProfile ở máy chủ: thiếu đồng ý thì không có trong dữ liệu,
// giao diện chỉ nói "chưa có đồng ý", không đoán và không hiện chỗ trống giả. Tiền: chỉ hiện số trên phiếu đã lưu, không tính lại.
// Ô Figma CHƯA có nguồn dữ liệu nên không dựng: đơn giá và "đổi cách tính phí" theo em (đơn giá nằm ở tab Học phí của lớp), PIN 4 số của báo cáo,
// "Lần xem / Kênh" của báo cáo riêng, "Lưu trữ khác với xoá" (ẩn/lưu trữ riêng chưa có; Đã nghỉ giữ nguyên dữ liệu thay thế).
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { KinPage, KinPageHeader, KinPageSkeleton, KinTwoCol, KIN_TABLE_ROW } from "@/components/kin/PageLayout";
import { KinTabs, type KinTabItem } from "@/components/kin/Tabs";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinPanel } from "@/components/kin/Panel";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinStat, KinStatRow } from "@/components/kin/Stat";
import { KinStatus, type StatusTone } from "@/components/kin/Status";
import { KinCopyButton } from "@/components/kin/CopyButton";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { ATTENDANCE_LABEL, type AttendanceStatus } from "@/lib/attendance";
import { AGE_GROUP_LABEL, payerLabel, type AgeGroup } from "@/lib/consentPolicy";
import { REPORT_LINK_LABEL } from "@/lib/tutorStudentView";
import type { StudentDetail } from "@/lib/tutorStudentDetailServer";
import { jfetch, keyToVn } from "@/components/tutor/studentUi";

type TabKey = "tong-quan" | "diem-danh" | "ghi-chu" | "phieu" | "bai-tap" | "bao-cao";
const TAB_KEYS: TabKey[] = ["tong-quan", "diem-danh", "ghi-chu", "phieu", "bai-tap", "bao-cao"];
const money = (n: number) => `${n.toLocaleString("vi-VN")}đ`;
const dm = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
const attLabel = (s: string) => ATTENDANCE_LABEL[s as AttendanceStatus] ?? s;
const attTone = (s: string): StatusTone => (s === "present" || s === "late" ? "xong" : s === "excused" ? "mo" : "loi");
const invTone = (s: string): StatusTone => (s === "paid" ? "xong" : s === "cancelled" ? "mo" : s === "draft" ? "mo" : "cho");
const fmtDue = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

export default function HoSoEm({ userId, initialTab }: { userId: string; initialTab?: string }) {
  const [d, setD] = useState<StudentDetail | null>(null);
  const [err, setErr] = useState<"load" | "forbidden" | null>(null);
  const [tab, setTab] = useState<TabKey>(TAB_KEYS.includes(initialTab as TabKey) ? (initialTab as TabKey) : "tong-quan");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const { ask, dialog } = useKinConfirm();

  const load = useCallback(async () => {
    const r = await jfetch(`/api/tutor/hoc-sinh/${userId}`);
    if (r.ok) { setD(r.json as StudentDetail); setErr(null); }
    else setErr(r.status === 403 || r.status === 404 ? "forbidden" : "load");
  }, [userId]);
  useEffect(() => { void load(); }, [load]);

  async function setStatus(to: "active" | "suspended") {
    if (!d || busy) return;
    if (to === "suspended") {
      const ok = await ask({
        title: "Đánh dấu em đã nghỉ?", confirmLabel: "Đánh dấu đã nghỉ", tone: "thuong",
        message: "Em chuyển sang nhóm Đã nghỉ trong lớp của cô. KiN giữ nguyên điểm danh, điểm, phiếu và hồ sơ riêng. Cô cho em học lại bất cứ lúc nào. Em đã nghỉ không còn hoạt động mới trong lớp.",
      });
      if (!ok) return;
    }
    setBusy(true); setNote(null);
    const r = await jfetch(`/api/tutor/hoc-sinh/${userId}/trang-thai`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: to }) });
    setBusy(false);
    if (r.ok) { setNote({ tone: "ok", text: to === "suspended" ? "Đã đánh dấu em đã nghỉ. Dữ liệu của em vẫn được giữ." : "Đã cho em học lại." }); await load(); }
    else setNote({ tone: "err", text: r.json?.error ?? "Chưa đổi được trạng thái, thử lại sau." });
  }

  async function reportAction(kind: "enable" | "revoke", linkId: string) {
    if (busy) return;
    if (kind === "revoke") {
      const ok = await ask({ title: "Thu hồi link báo cáo?", confirmLabel: "Thu hồi ngay", message: "Link cũ ngừng hoạt động ngay. Ai đang giữ link sẽ không mở được nữa. Cô bật lại lúc nào cũng được, link mới sẽ khác link cũ." });
      if (!ok) return;
    }
    setBusy(true); setNote(null);
    const r = await jfetch(`/api/tutor/hoc-sinh/${userId}/bao-cao-link`, { method: kind === "enable" ? "POST" : "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ linkId }) });
    setBusy(false);
    if (r.ok) { setNote({ tone: "ok", text: kind === "enable" ? "Đã bật link báo cáo riêng." : "Đã thu hồi. Link cũ ngừng hoạt động." }); await load(); }
    else setNote({ tone: "err", text: r.json?.error ?? "Chưa làm được, thử lại sau." });
  }

  if (err === "forbidden") {
    return (
      <KinPage><KinPageHeader title="Không mở được hồ sơ" back={{ href: "/lop-cua-toi/hoc-sinh", label: "← Học sinh" }} />
        <KinEmptyState title="Em này không thuộc lớp của cô" action={<Link href="/lop-cua-toi/hoc-sinh" className={kinButtonClass("secondary")}>Về danh sách học sinh</Link>}>
          Chỉ mở được hồ sơ của học sinh đang hoặc đã học lớp của chính cô.
        </KinEmptyState></KinPage>
    );
  }
  if (!d) {
    return (
      <KinPage>
        {err === "load" ? <ErrorStrip message="Không tải được hồ sơ học sinh." onRetry={() => { setErr(null); void load(); }} /> : <KinPageSkeleton label="Đang tải hồ sơ học sinh" stats side={false} />}
      </KinPage>
    );
  }

  const left = d.enrollments.length > 0 && d.enrollments.every(e => e.status === "suspended");
  const unpaid = d.invoices.filter(i => i.status !== "paid" && i.status !== "cancelled").length;
  const tabs: KinTabItem<TabKey>[] = [
    { key: "tong-quan", label: "Tổng quan" }, { key: "diem-danh", label: "Điểm danh" }, { key: "ghi-chu", label: "Ghi chú" },
    { key: "phieu", label: `Phiếu${d.invoices.length ? ` · ${d.invoices.length}` : ""}` }, { key: "bai-tap", label: "Bài tập" }, { key: "bao-cao", label: "Báo cáo riêng" },
  ];
  const p = d.profile;
  const att = d.attendance;

  return (
    <KinPage>
      <KinPageHeader title={d.student.name} titleClassName="break-words" back={{ href: "/lop-cua-toi/hoc-sinh", label: "← Học sinh" }}
        sub={`Hồ sơ học sinh · ${left ? "Đã nghỉ" : "Đang học"} · Thông tin chỉ dành cho cô`}
        actions={<>
          <Link href={p ? `/lop-cua-toi/hoc-sinh/${p.id}` : `/lop-cua-toi/hoc-sinh/them?userId=${userId}`} className={kinButtonClass("secondary")}>{p ? "Hồ sơ riêng" : "Tạo hồ sơ riêng"}</Link>
          {left
            ? <KinButton variant="secondary" loading={busy} loadingLabel="Đang đổi…" onClick={() => void setStatus("active")}>Cho học lại</KinButton>
            : <KinButton variant="secondary" loading={busy} loadingLabel="Đang đổi…" onClick={() => void setStatus("suspended")}>Đánh dấu đã nghỉ</KinButton>}
        </>} />
      {note && <p role={note.tone === "err" ? "alert" : "status"} className={`mb-4 text-[length:var(--kin-co-goc)] ${note.tone === "err" ? "text-[var(--kin-tt-chu-loi)]" : "text-[var(--kin-chu-chinh)]"}`}>{note.text}</p>}

      <KinTabs tabs={tabs} value={tab} onChange={setTab} label="Nội dung hồ sơ học sinh" tabId={k => `em-tab-${k}`} panelId={k => `em-panel-${k}`} />

      <div role="tabpanel" id={`em-panel-${tab}`} aria-labelledby={`em-tab-${tab}`} className="pt-6">
        {tab === "tong-quan" && (
          <div className="space-y-[var(--kin-cach-muc)]">
            <KinStatRow>
              <KinStat label="Chuyên cần 90 ngày" value={att.rate === null ? "Chưa đủ dữ liệu" : `${att.rate}%`} hint={att.rate === null ? `${att.n} buổi có ghi, cần ít nhất 10` : `${att.n} buổi có ghi`} />
              <KinStat label="Buổi đã học" value={att.counts.present + att.counts.late} hint="Có mặt hoặc đi muộn, 90 ngày gần nhất" />
              <KinStat label="Buổi bù còn lại" value={d.makeupLeft} hint="Còn hạn dùng" />
              <KinStat label="Phiếu chưa đóng đủ" value={unpaid} hint={d.invoices.length ? `trên ${d.invoices.length} phiếu` : "Chưa có phiếu"} />
            </KinStatRow>
            <KinTwoCol>
              <section aria-labelledby="em-lop" className="min-w-0">
                <KinSectionHead id="em-lop" title="Lớp đang gắn với em" aside={`${d.enrollments.length} lớp`} />
                <KinPanel flush className="mt-4">
                  <ul aria-label="Lớp của em">
                    {d.enrollments.map(e => (
                      <li key={e.courseId} data-em-lop className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 ${KIN_TABLE_ROW}`}>
                        <div className="min-w-0">
                          <p className="text-[var(--kin-chu-chinh)] break-words">{e.courseName}</p>
                          <p className="text-[var(--kin-chu-mo)]">{e.schedule ?? "Chưa xếp lịch"} · Ghi danh {fmtDue(e.enrolledAt)}</p>
                        </div>
                        <span className="flex items-center gap-3">
                          <KinStatus tone={e.status === "active" ? "xong" : "mo"}>{e.status === "active" ? "Đang học" : "Đã nghỉ"}</KinStatus>
                          <Link href={`/lop-cua-toi/${e.courseId}`} aria-label={`Mở lớp ${e.courseName}`} className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Mở lớp</Link>
                        </span>
                      </li>
                    ))}
                  </ul>
                </KinPanel>
                <p className="mt-3 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Đơn giá và cách tính học phí của lớp xem ở tab Học phí của lớp. Phiếu đã chốt không đổi khi cô đổi đơn giá sau này.</p>
              </section>
              <aside className="min-w-0 space-y-[var(--kin-cach-muc)]">
                <section aria-labelledby="em-lh">
                  <KinSectionHead id="em-lh" title="Liên hệ riêng" />
                  <div className="pt-4 space-y-3 text-[length:var(--kin-co-goc)] leading-5">
                    <Field label="Học sinh" value={d.student.name} />
                    {d.student.school && <Field label="Trường (em tự khai trên tài khoản)" value={d.student.school} />}
                    {d.student.phone && <Field label="Số điện thoại tài khoản" value={<a className="underline text-[var(--kin-nhan-link)]" href={`tel:${d.student.phone}`}>{d.student.phone}</a>} />}
                    <Field label="Email tài khoản" value={<span className="break-all">{d.student.email}</span>} />
                    {!p && <p className="text-[var(--kin-chu-mo)]">Cô chưa ghi hồ sơ riêng về em. Người liên hệ (phụ huynh) chỉ hiện sau khi có hồ sơ và có đồng ý.</p>}
                    {p && p.consentLevel === "locked" && <KinCallout title="Hồ sơ riêng đang bị ẩn">Thiếu đồng ý còn hiệu lực nên KiN không hiện người liên hệ. Mở Hồ sơ riêng để xin đồng ý lại.</KinCallout>}
                    {p && p.consentLevel !== "locked" && (
                      <>
                        <Field label="Loại · người thanh toán" value={`${AGE_GROUP_LABEL[p.ageGroup as AgeGroup] ?? ""} · ${payerLabel(p.consent.kind, p.guardianName)}`} />
                        <Field label="Phụ huynh" value={p.guardianName || "Chưa ghi"} />
                        {p.guardianPhone && <Field label="Số điện thoại phụ huynh" value={<a className="underline text-[var(--kin-nhan-link)]" href={`tel:${p.guardianPhone}`}>{p.guardianPhone}</a>} />}
                      </>
                    )}
                  </div>
                </section>
                <section aria-labelledby="em-qbc">
                  <KinSectionHead id="em-qbc" title="Quyền báo cáo" />
                  <p className="pt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Link riêng: {REPORT_LINK_LABEL[d.report.state]}</p>
                  <button type="button" onClick={() => setTab("bao-cao")} className="mt-1 inline-flex items-center min-h-11 text-[length:var(--kin-co-goc)] underline text-[var(--kin-nhan-link)]">Mở tab Báo cáo riêng</button>
                </section>
              </aside>
            </KinTwoCol>
            <KinCallout title="Đã nghỉ khác với xoá">
              Đánh dấu Đã nghỉ giữ lại điểm danh, điểm, phiếu và hồ sơ riêng; em không còn hoạt động mới trong lớp. KiN chưa có chức năng lưu trữ riêng cho học sinh. Muốn xoá hẳn hồ sơ riêng thì làm ở trang Hồ sơ riêng, có xác nhận.
            </KinCallout>
          </div>
        )}

        {tab === "diem-danh" && (
          <div className="space-y-[var(--kin-cach-muc)]">
            <section aria-labelledby="em-90">
              <KinSectionHead id="em-90" title="Tham dự 90 ngày gần nhất" aside={`${keyToVn(att.fromKey)} – ${keyToVn(att.toKey)}`} />
              <KinStatRow className="mt-4">
                <KinStat label="Tỷ lệ chuyên cần" value={att.rate === null ? "Chưa đủ dữ liệu" : `${att.rate}%`} hint={att.rate === null ? `Mới có ${att.n} buổi, cần ít nhất 10` : "Có mặt 1, muộn 0,9, có phép 0,8, vắng 0,5"} />
                <KinStat label="Có mặt" value={att.counts.present} />
                <KinStat label="Muộn" value={att.counts.late} />
                <KinStat label="Có phép / Vắng" value={`${att.counts.excused} / ${att.counts.absent}`} />
              </KinStatRow>
              {att.rows.length === 0 ? (
                <KinEmptyState title="Chưa có buổi nào được điểm danh trong 90 ngày">Khi cô điểm danh em ở trang lớp, các buổi sẽ hiện ở đây. Ô để trống nghĩa là chưa điểm danh, không phải vắng.</KinEmptyState>
              ) : (
                <KinPanel flush className="mt-4">
                  <ul aria-label="Điểm danh 90 ngày">
                    {att.rows.map((r, i) => (
                      <li key={`${r.dateKey}-${r.courseName}-${i}`} data-em-diem-danh className={`flex items-center justify-between gap-3 ${KIN_TABLE_ROW}`}>
                        <span className="min-w-0 break-words text-[var(--kin-chu-chinh)] tabular-nums">{dm(r.dateKey)} · {r.courseName}</span>
                        <KinStatus tone={attTone(r.status)} className="flex-shrink-0">{attLabel(r.status)}</KinStatus>
                      </li>
                    ))}
                  </ul>
                </KinPanel>
              )}
            </section>

            <section aria-labelledby="em-da-hoc">
              <KinSectionHead id="em-da-hoc" title="Buổi đã học" aside={`${d.learned.length} buổi gần nhất`} />
              {d.learned.length === 0 ? (
                <p className="pt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Chưa có buổi nào em có mặt hoặc đi muộn được ghi trên KiN.</p>
              ) : (
                <KinPanel flush className="mt-4">
                  <ul aria-label="Các buổi em đã học">
                    {d.learned.map((r, i) => (
                      <li key={`${r.dateKey}-${i}`} data-em-da-hoc className={`flex items-center justify-between gap-3 ${KIN_TABLE_ROW}`}>
                        <span className="min-w-0 break-words text-[var(--kin-chu-chinh)] tabular-nums">{keyToVn(r.dateKey)} · {r.courseName}</span>
                        <span className="flex-shrink-0 text-[var(--kin-chu-mo)]">{attLabel(r.status)}</span>
                      </li>
                    ))}
                  </ul>
                </KinPanel>
              )}
              <p className="mt-3 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Dữ liệu cô tự ghi trên KiN khi điểm danh. KiN không kiểm chứng buổi học có diễn ra hay không.</p>
            </section>

            <section aria-labelledby="em-diem">
              <KinSectionHead id="em-diem" title="Điểm từng buổi" />
              {!d.scores.allowed ? (
                <div className="pt-4"><KinCallout title="Chưa hiện điểm từng buổi">
                  {d.scores.reason === "no_profile" ? "Cô chưa có hồ sơ riêng về em nên chưa ghi và chưa hiện điểm từng buổi." : "Hồ sơ riêng của em chưa có đồng ý ghi điểm còn hiệu lực nên KiN không hiện điểm."}
                  {" "}<Link href={p ? `/lop-cua-toi/hoc-sinh/${p.id}` : `/lop-cua-toi/hoc-sinh/them?userId=${userId}`} className="underline text-[var(--kin-nhan-link)]">{p ? "Mở Hồ sơ riêng" : "Tạo hồ sơ riêng"}</Link>
                </KinCallout></div>
              ) : d.scores.items.length === 0 ? (
                <p className="pt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Chưa có buổi nào được ghi điểm cho em.</p>
              ) : (
                <KinPanel flush className="mt-4">
                  <ul aria-label="Điểm từng buổi">
                    {d.scores.items.map((s, i) => (
                      <li key={`${s.dateKey}-${i}`} className={`flex items-center justify-between gap-3 ${KIN_TABLE_ROW}`}>
                        <span className="min-w-0 break-words text-[var(--kin-chu-chinh)] tabular-nums">{dm(s.dateKey)} · {s.courseName}</span>
                        <span className="flex-shrink-0 text-[var(--kin-chu-chinh)] tabular-nums">{s.score === null ? "Chưa có điểm" : `${String(s.score).replace(".", ",")}/10`}{s.homeworkPct !== null ? ` · BTVN ${s.homeworkPct}%` : ""}</span>
                      </li>
                    ))}
                  </ul>
                </KinPanel>
              )}
            </section>
          </div>
        )}

        {tab === "ghi-chu" && (
          <section aria-labelledby="em-gc" className="max-w-2xl">
            <KinSectionHead id="em-gc" title="Ghi chú của cô về em" />
            {!p ? (
              <KinEmptyState title="Chưa có hồ sơ riêng nên chưa có ghi chú" action={<Link href={`/lop-cua-toi/hoc-sinh/them?userId=${userId}`} className={kinButtonClass("secondary")}>Tạo hồ sơ riêng</Link>}>
                Ghi chú là thông tin mở rộng, chỉ lưu khi có xác nhận đồng ý của phụ huynh hoặc của em theo độ tuổi.
              </KinEmptyState>
            ) : p.consentLevel === "locked" ? (
              <div className="pt-4"><KinCallout title="Hồ sơ riêng đang bị ẩn">Thiếu đồng ý còn hiệu lực nên KiN không hiện ghi chú. <Link href={`/lop-cua-toi/hoc-sinh/${p.id}`} className="underline text-[var(--kin-nhan-link)]">Mở Hồ sơ riêng để xin đồng ý lại</Link></KinCallout></div>
            ) : p.consentLevel === "basic_only" ? (
              <div className="pt-4"><KinCallout title="Chưa có đồng ý cho thông tin mở rộng">Ghi chú thuộc nhóm thông tin mở rộng nên KiN chưa hiện. <Link href={`/lop-cua-toi/hoc-sinh/${p.id}`} className="underline text-[var(--kin-nhan-link)]">Mở Hồ sơ riêng để bổ sung đồng ý</Link></KinCallout></div>
            ) : p.notes ? (
              <>
                <p data-em-ghi-chu className="pt-4 whitespace-pre-wrap break-words text-[length:var(--kin-co-goc)] leading-6 text-[var(--kin-chu-chinh)]">{p.notes}</p>
                <Link href={`/lop-cua-toi/hoc-sinh/${p.id}`} className={`${kinButtonClass("secondary")} mt-4`}>Sửa ghi chú</Link>
              </>
            ) : (
              <KinEmptyState title="Chưa có ghi chú" action={<Link href={`/lop-cua-toi/hoc-sinh/${p.id}`} className={kinButtonClass("secondary")}>Thêm ghi chú</Link>}>Cô thêm ghi chú trong Hồ sơ riêng của em.</KinEmptyState>
            )}
          </section>
        )}

        {tab === "phieu" && (
          <section aria-labelledby="em-phieu">
            <KinSectionHead id="em-phieu" title="Phiếu học phí của em" aside={<Link href="/lop-cua-toi/hoc-phi" className="text-[var(--kin-nhan-link)] hover:underline">Mở trang Học phí →</Link>} />
            {d.invoices.length === 0 ? (
              <KinEmptyState title="Em chưa có phiếu học phí" action={<Link href="/lop-cua-toi/hoc-phi" className={kinButtonClass("secondary")}>Mở trang Học phí</Link>}>Phiếu do cô lập ở trang Học phí. Số tiền trên phiếu đã chốt, hồ sơ chỉ hiện lại đúng số đó.</KinEmptyState>
            ) : (
              <KinPanel flush className="mt-4">
                <ul aria-label="Phiếu học phí của em">
                  {d.invoices.map(i => (
                    <li key={i.id} data-em-phieu className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 ${KIN_TABLE_ROW}`}>
                      <div className="min-w-0">
                        <p className="text-[var(--kin-chu-chinh)] tabular-nums">Tháng {i.yearMonth.slice(5)}/{i.yearMonth.slice(0, 4)} · {i.code}</p>
                        <p className="text-[var(--kin-chu-mo)] tabular-nums">Phải đóng {money(i.amountDue)} · Đã đóng {money(i.paidAmount)}{i.remaining > 0 && i.status !== "cancelled" ? ` · Còn ${money(i.remaining)}` : ""}</p>
                      </div>
                      <span className="flex items-center gap-3">
                        <KinStatus tone={invTone(i.status)}>{i.statusLabel}</KinStatus>
                        <Link href={`/lop-cua-toi/hoc-phi?phieu=${i.id}`} aria-label={`Mở phiếu ${i.code}`} className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Mở phiếu</Link>
                      </span>
                    </li>
                  ))}
                </ul>
              </KinPanel>
            )}
          </section>
        )}

        {tab === "bai-tap" && (
          <section aria-labelledby="em-bt">
            <KinSectionHead id="em-bt" title="Bài tập của em" aside={<Link href="/lop-cua-toi/bai-tap" className="text-[var(--kin-nhan-link)] hover:underline">Mở trang Bài tập →</Link>} />
            {d.assignments.length === 0 ? (
              <KinEmptyState title="Lớp của em chưa có bài tập" action={<Link href="/lop-cua-toi/bai-tap" className={kinButtonClass("secondary")}>Mở trang Bài tập</Link>}>Bài tập cô giao trong lớp sẽ hiện ở đây, kèm việc em đã nộp hay chưa.</KinEmptyState>
            ) : (
              <KinPanel flush className="mt-4">
                <ul aria-label="Bài tập của em">
                  {d.assignments.map(a => (
                    <li key={a.id} data-em-bai-tap className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-1 ${KIN_TABLE_ROW}`}>
                      <div className="min-w-0">
                        <p className="text-[var(--kin-chu-chinh)] break-words">{a.title}</p>
                        <p className="text-[var(--kin-chu-mo)] tabular-nums">{a.courseName}{a.dueDate ? ` · Hạn ${fmtDue(a.dueDate)}` : ""}</p>
                      </div>
                      <KinStatus tone={a.state === "graded" ? "xong" : a.state === "waiting" ? "cho" : "mo"}>
                        {a.state === "graded" ? `Đã chấm${a.score !== null ? ` · ${String(a.score).replace(".", ",")}/${String(a.maxPoints).replace(".", ",")}` : ""}` : a.state === "waiting" ? "Chờ chấm" : "Chưa nộp"}
                      </KinStatus>
                    </li>
                  ))}
                </ul>
              </KinPanel>
            )}
          </section>
        )}

        {tab === "bao-cao" && (
          <section aria-labelledby="em-bc" className="max-w-2xl">
            <KinSectionHead id="em-bc" title="Link báo cáo riêng của em" aside={REPORT_LINK_LABEL[d.report.state]} />
            <p className="pt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
              Đây là trang &ldquo;Sổ của con&rdquo; của riêng em: điểm danh, phiếu học phí và điểm đã được phép hiện. Phụ huynh mở bằng link, không cần tài khoản. Đường dẫn chỉ có mã ngẫu nhiên, không có tên em.
              Sổ của con là của em trên KiN nên có cả lớp em học với gia sư khác (nếu có). Ai có link xem được, cô chỉ gửi cho đúng phụ huynh.
            </p>
            {d.report.state === "no_parent" ? (
              <div className="pt-4"><KinCallout title="Chưa có phụ huynh liên kết với em trên KiN">Link báo cáo bật được khi phụ huynh liên kết với em và liên kết được xác nhận. KiN không tạo liên kết thay phụ huynh.</KinCallout></div>
            ) : (
              <ul className="mt-4 space-y-4" aria-label="Link báo cáo riêng">
                {d.report.links.map((l, i) => (
                  <li key={l.linkId} data-em-bao-cao>
                    <KinPanel>
                      <p className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">Liên kết phụ huynh {i + 1} <KinStatus tone={l.state === "on" ? "xong" : "mo"} className="ml-2">{l.state === "on" ? "Đang bật" : "Chưa bật"}</KinStatus></p>
                      {l.state === "on" && l.url ? (
                        <>
                          <p data-em-link className="mt-2 break-all text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{typeof window !== "undefined" ? window.location.origin : ""}{l.url}</p>
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <KinCopyButton appearance="button" text={() => `${window.location.origin}${l.url}`} label="Chép link báo cáo riêng">Copy link</KinCopyButton>
                            <a href={l.url} target="_blank" rel="noopener noreferrer" className={kinButtonClass("secondary")}>Xem thử</a>
                            <KinButton variant="secondary" loading={busy} loadingLabel="Đang thu hồi…" onClick={() => void reportAction("revoke", l.linkId)}>Thu hồi ngay</KinButton>
                          </div>
                          <p className="mt-3 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Thu hồi là link ngừng hoạt động ngay. Bật lại sẽ có link mới, khác link cũ.</p>
                        </>
                      ) : (
                        <div className="mt-3"><KinButton loading={busy} loadingLabel="Đang bật…" onClick={() => void reportAction("enable", l.linkId)}>Bật link báo cáo riêng</KinButton></div>
                      )}
                    </KinPanel>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-6 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">KiN chưa có PIN 4 số cho link và chưa ghi lần xem của từng link.</p>
          </section>
        )}
      </div>
      {dialog}
    </KinPage>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-3 py-2 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)]">
      <p className="text-[var(--kin-chu-mo)]">{label}</p>
      <p className="text-[var(--kin-chu-chinh)] break-words">{value}</p>
    </div>
  );
}
