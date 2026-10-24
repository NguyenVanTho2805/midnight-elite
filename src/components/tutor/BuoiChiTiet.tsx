// BU-01..BU-04, BU-14, LI-16, LI-17 — trang chi tiết một buổi học của gia sư (Figma 464:5816 "Buổi học · Ghi chép và chốt buổi").
//
// Nút "Đã dạy xong" gọi POST /api/courses/[id]/sessions/[dateKey]/close: ghi trạng thái + thời điểm chốt; với lớp kiểu mới (theo buổi / theo giờ)
// máy chủ đồng thời sinh dòng học phí cho em có mặt hoặc đi muộn (chủ chốt 24/10/2026: chốt buổi là điều kiện sinh phí). Lớp cũ: không ghi gì ở bảng phí.
// KHÔNG đổi cách tính phiếu, không đụng dòng đã vào phiếu.
// Ô Figma chưa làm vì cần dữ liệu/tiền chưa có: "Phí dự kiến khi chốt", "Chính sách cho em", "Xem trước PNG/PDF", ảnh bài làm của em (BU-10), điểm buổi (đã ở khối riêng).
"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { KinButton, useKinConfirm } from "@/components/kin";
import { kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinPage, KinPageHeader, KinTwoCol, KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { KinPanel } from "@/components/kin/Panel";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinStateCard } from "@/components/kin/StateCard";
import { KinStatus } from "@/components/kin/Status";
import { Modal, callApi, copyText, useNotify } from "@/components/tutor/shared";
import DiemDanhPanel from "@/components/tutor/DiemDanh";
import { dayOfWeekOfKey, hmOf, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";
import { JOIN_SOURCE_LABEL, KIND_LABEL, MODE_LABEL, NOTE_MAX, buildSessionShareMessage, isClosed, sessionStatusLabel, type SessionKind } from "@/lib/sessionBook";
import { openZalo } from "@/lib/zaloShare";
import type { SessionDetail } from "@/lib/sessionBookServer";

const WEEKDAY = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const dmy = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;
const vnWhen = (iso: string) => `${hmOf(vnMinutesOfDay(new Date(iso)))} ngày ${vnDateKeyOf(new Date(iso)).slice(8, 10)}/${vnDateKeyOf(new Date(iso)).slice(5, 7)}`;

interface ChargeInfo { skipped?: string; created: number; updated: number; removed: number; locked: number }
interface Form { taught: string; homework: string; summary: string; mode: "" | "online" | "offline"; location: string; joinUrl: string }
const toForm = (d: SessionDetail): Form => ({
  taught: d.session?.taught ?? "", homework: d.session?.homework ?? "", summary: d.session?.summary ?? "",
  mode: d.session?.mode === "online" || d.session?.mode === "offline" ? d.session.mode : "", location: d.session?.location ?? "", joinUrl: d.session?.joinUrl ?? "",
});

export default function BuoiChiTiet({ courseId, dateKey }: { courseId: string; dateKey: string }) {
  const notify = useNotify();
  const { ask, dialog } = useKinConfirm();
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error" | "forbidden" | "missing">("loading");
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [share, setShare] = useState<string | null>(null);
  const url = `/api/courses/${courseId}/sessions/${dateKey}`;

  const load = useCallback(async (quiet = false) => {
    await Promise.resolve();
    if (!quiet) setState("loading");
    const r = await callApi<SessionDetail>(url);
    if (!r.ok) { if (!quiet) setState(r.status === 403 ? "forbidden" : r.status === 404 ? "missing" : "error"); return; }
    setDetail(r.data);
    if (!quiet) { const f = toForm(r.data); setForm(f); setSaved(f); setState("ok"); }
  }, [url]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  if (state === "loading") return <KinPage><div aria-busy="true" aria-label="Đang tải buổi học" className="space-y-3 max-w-3xl">{[0, 1, 2].map(i => <div key={i} className="h-16 rounded kin-skel kin-skel--soft" />)}</div></KinPage>;
  if (state === "forbidden" || state === "missing") {
    return <KinPage><KinStateCard tone="loi" kicker="Lỗi · Buổi học" title={state === "forbidden" ? "Bạn không có quyền với lớp này" : "Không tìm thấy lớp"} actions={<Link href="/lop-cua-toi/lop" className={kinButtonClass("secondary")}>Về danh sách lớp</Link>}>
      {state === "forbidden" ? "Buổi học này thuộc lớp của gia sư khác." : "Lớp có thể đã bị xoá hoặc liên kết bị sai."}</KinStateCard></KinPage>;
  }
  if (state === "error" || !detail || !form || !saved) {
    return <KinPage><KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Không tải được buổi học" actions={<KinButton onClick={() => void load()}>Thử lại</KinButton>}>Kiểm tra mạng rồi thử lại.</KinStateCard></KinPage>;
  }

  const now = new Date();
  const closed = isClosed(detail.session?.state);
  const status = sessionStatusLabel({ dateKey, state: detail.session?.state, now, cancelled: detail.cancelled });
  const dirty = (Object.keys(form) as (keyof Form)[]).some(k => form[k] !== saved[k]);
  const past = dateKey <= vnDateKeyOf(now);
  const when = `${WEEKDAY[dayOfWeekOfKey(dateKey)]}, ${dmy(dateKey)}`;
  const kindText = detail.kind !== "regular" ? KIND_LABEL[detail.kind as SessionKind] : null;

  async function saveNotes() {
    if (!form || saving) return;
    setSaving(true);
    const r = await callApi<SessionDetail>(url, { method: "PATCH", body: JSON.stringify({
      taught: form.taught, homework: form.homework, summary: form.summary, mode: form.mode || null, location: form.location, joinUrl: form.joinUrl,
    }) });
    setSaving(false);
    if (!r.ok) { notify.err(r.data.error ?? "Chưa lưu được, thử lại nhé."); return; }
    setDetail(r.data); const f = toForm(r.data); setForm(f); setSaved(f);
    notify.ok("Đã lưu ghi chép buổi.");
  }

  async function close() {
    if (closing) return;
    setClosing(true);
    const r = await callApi<{ already: boolean; detail: SessionDetail; charges?: ChargeInfo | null }>(`${url}/close`, { method: "POST", body: JSON.stringify({ action: "close" }) });
    setClosing(false);
    if (!r.ok) { notify.err(r.data.error ?? "Chưa chốt được buổi."); return; }
    setDetail(r.data.detail);
    if (r.data.already) { notify.ok("Buổi này đã chốt từ trước."); return; }
    const c = r.data.charges;
    const detail = !c || c.skipped === "mode" ? undefined
      : c.skipped === "preview" ? "Bản xem trước không tính học phí."
      : c.created + c.updated > 0 ? `Đã tính học phí cho ${c.created + c.updated} em.` : "Chưa có em nào có mặt hoặc đi muộn nên chưa có khoản học phí.";
    notify.ok(detail ? `Đã ghi: buổi đã dạy xong. ${detail}` : "Đã ghi: buổi đã dạy xong.");
  }

  async function reopen() {
    if (closing) return;
    setClosing(true);
    let r = await callApi<{ detail: SessionDetail; needsConfirm?: boolean; warning?: string; charges?: ChargeInfo | null }>(`${url}/close`, { method: "POST", body: JSON.stringify({ action: "reopen" }) });
    if (!r.ok && r.status === 409 && r.data.needsConfirm) {
      const yes = await ask({ title: "Mở lại buổi đã chốt?", message: r.data.warning ?? r.data.error, confirmLabel: "Vẫn mở lại", cancelLabel: "Giữ nguyên", tone: "thuong" });
      if (!yes) { setClosing(false); return; }
      r = await callApi<{ detail: SessionDetail; charges?: ChargeInfo | null }>(`${url}/close`, { method: "POST", body: JSON.stringify({ action: "reopen", confirm: true }) });
    }
    setClosing(false);
    if (!r.ok) { notify.err(r.data.error ?? "Chưa mở lại được buổi."); return; }
    setDetail(r.data.detail);
    const rm = r.data.charges?.removed ?? 0;
    notify.ok(rm > 0 ? `Đã mở lại buổi. Đã gỡ ${rm} khoản học phí chưa vào phiếu; phiếu đã lập không thay đổi.` : "Đã mở lại buổi. Phiếu đã lập không thay đổi.");
  }

  async function openShare() {
    if (!detail) return;
    setShare(buildSessionShareMessage({ courseName: detail.course.name, dateKey, taught: saved?.taught || null, homework: saved?.homework || null, summary: saved?.summary || null }));
  }
  async function sendShare() {
    if (share === null || !detail) return;
    const res = await openZalo({ text: share, groupUrl: detail.course.zaloGroupUrl });
    if (!res.opened) { if (res.reason === "failed") notify.err("Không mở được Zalo. Hãy chép tin và gửi tay."); return; }
    notify.info(res.method === "share" ? "Chọn nhóm Zalo trong bảng chia sẻ rồi bấm gửi." : "Đã chép tin và mở Zalo — dán vào nhóm rồi bấm gửi.");
    setShare(null);
  }

  const field = (k: "taught" | "homework" | "summary", label: string, hint: string) => (
    <div>
      <label htmlFor={`bu-${k}`} className={KIN_LABEL}>{label}</label>
      <textarea id={`bu-${k}`} rows={4} maxLength={NOTE_MAX} value={form[k]} onChange={e => setForm(f => (f ? { ...f, [k]: e.target.value } : f))} placeholder={hint}
        className={`${KIN_FIELD} mt-2 py-2`} />
    </div>
  );

  return (
    <KinPage>
      <nav aria-label="Đường dẫn" className="mb-2 flex items-center flex-wrap gap-x-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]" data-bu-breadcrumb>
        <Link href="/lop-cua-toi/lop" className="inline-flex items-center min-h-11 hover:underline">Lớp</Link><span aria-hidden>›</span>
        <Link href={`/lop-cua-toi/${courseId}`} className="inline-flex items-center min-h-11 hover:underline">{detail.course.name}</Link><span aria-hidden>›</span>
        <span className="text-[var(--kin-chu-chinh)]">{when}</span><span aria-hidden>›</span>
        <KinStatus tone={status.tone}>{status.text}</KinStatus>
      </nav>

      <KinPageHeader
        title={`${detail.course.name} · Ghi chép và chốt buổi`}
        sub={<>
          {dmy(dateKey)}{detail.time ? ` · ${detail.time.start}–${detail.time.end}` : ""}
          {kindText ? ` · ${kindText}` : ""}
          {detail.mode ? ` · ${MODE_LABEL[detail.mode]}` : ""}
          {detail.mode === "offline" && detail.location ? ` · ${detail.location}` : ""}
          {!detail.scheduled && detail.kind === "regular" ? " · Ngày này không có trong lịch tuần" : ""}
        </>}
        actions={<>
          {detail.join && <a href={detail.join.url} target="_blank" rel="noopener noreferrer" className={kinButtonClass("secondary")}>Mở link học online</a>}
          <KinButton variant="secondary" onClick={() => void openShare()}>Chia sẻ báo cáo buổi</KinButton>
        </>}
      />

      {!closed && past && !detail.cancelled && (
        <KinCallout title="Buổi đã qua nhưng chưa chốt" className="mb-6">
          Khi dạy xong, bấm <b>Đã dạy xong</b> ở khung bên cạnh để ghi lại trạng thái. Việc này không tạo hay sửa học phí.
        </KinCallout>
      )}
      {detail.cancelled && <KinCallout title="Buổi này đã huỷ trên Lịch" className="mb-6">Bạn vẫn xem và ghi chép được, nhưng buổi huỷ không cần chốt.</KinCallout>}

      <KinTwoCol>
        <div className="min-w-0 space-y-10">
          <section aria-labelledby="bu-dd" id="diem-danh">
            <KinSectionHead id="bu-dd" title="Điểm danh và nhận xét từng em" />
            <div className="pt-4">
              <DiemDanhPanel courseId={courseId} embedded fixedDate={dateKey} onChanged={() => void load(true)} />
            </div>
          </section>

          <section aria-labelledby="bu-nd">
            <KinSectionHead id="bu-nd" title="Nội dung chung của buổi" aside={`${detail.rosterCount} học sinh đang học`} />
            <div className="pt-4 space-y-4">
              {field("taught", "Đã dạy", "Ví dụ: Nhận diện phương trình bậc hai; luyện dạng cơ bản.")}
              {field("homework", "Bài tập về nhà", "Ví dụ: Hoàn thiện 6 bài trang 40 trước 23:59 ngày 23/10.")}
              {field("summary", "Nhận xét chung", "Nhận xét chung cho cả lớp, không nêu tên em nào.")}
              <p className="text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]">Nhận xét chung dành cho cả lớp: đừng ghi tên hay chuyện riêng của một em ở đây. Nhận xét riêng từng em ghi ở phần điểm danh phía trên.</p>
            </div>
          </section>

          <section aria-labelledby="bu-ht">
            <KinSectionHead id="bu-ht" title="Hình thức và link học" />
            <div className="pt-4 grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="bu-mode" className={KIN_LABEL}>Hình thức buổi này</label>
                <select id="bu-mode" value={form.mode} onChange={e => setForm(f => (f ? { ...f, mode: e.target.value as Form["mode"] } : f))} className={`${KIN_FIELD} mt-2`}>
                  <option value="">Theo khung giờ của lớp{detail.mode && !detail.session?.mode ? ` (${MODE_LABEL[detail.mode]})` : ""}</option>
                  <option value="online">Online</option><option value="offline">Offline</option>
                </select>
              </div>
              <div>
                <label htmlFor="bu-loc" className={KIN_LABEL}>Địa chỉ học offline</label>
                <input id="bu-loc" value={form.location} onChange={e => setForm(f => (f ? { ...f, location: e.target.value } : f))} maxLength={300} disabled={(form.mode || detail.mode) !== "offline"}
                  placeholder={(form.mode || detail.mode) === "offline" ? "Số nhà, đường, quận" : "Chỉ dùng khi học offline"} className={`${KIN_FIELD} mt-2 disabled:opacity-60`} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="bu-url" className={KIN_LABEL}>Link học online riêng buổi này (không bắt buộc)</label>
                <input id="bu-url" type="url" value={form.joinUrl} onChange={e => setForm(f => (f ? { ...f, joinUrl: e.target.value } : f))} placeholder="https://meet.google.com/…" className={`${KIN_FIELD} mt-2`} />
                <p className="mt-2 text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]">
                  {detail.join ? `Đang dùng ${JOIN_SOURCE_LABEL[detail.join.source]}. ` : "Chưa có link nào. "}
                  Thứ tự: riêng buổi, rồi theo khung giờ, rồi chung của lớp (đặt ở tab Lịch học của lớp).
                </p>
              </div>
            </div>
          </section>

          <div className="flex items-center gap-3 flex-wrap">
            <KinButton variant="secondary" onClick={() => void saveNotes()} disabled={!dirty} loading={saving} loadingLabel="Đang lưu...">Lưu ghi chép</KinButton>
            <span className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]" aria-live="polite">{dirty ? "Có thay đổi chưa lưu." : "Đã lưu."}</span>
          </div>
        </div>

        <aside aria-label="Chốt buổi" className="min-w-0 space-y-6">
          <KinPanel variant={closed ? "nhan" : "mac-dinh"} className="p-5 space-y-3" data-bu-close>
            <h2 className="text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)]">Chốt buổi đã dạy</h2>
            <p><KinStatus tone={status.tone}>{status.text}</KinStatus></p>
            {closed && detail.session?.closedAt && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đã chốt lúc {vnWhen(detail.session.closedAt)}.</p>}
            {!closed && detail.session?.reopenedAt && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đã mở lại lúc {vnWhen(detail.session.reopenedAt)}.</p>}
            <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Có mặt {detail.tally.present + detail.tally.late}/{detail.rosterCount} · Vắng {detail.tally.absent} · Có phép {detail.tally.excused} · Chưa điểm danh {Math.max(0, detail.rosterCount - detail.tally.total)}</p>
            {closed
              ? <KinButton variant="secondary" onClick={() => void reopen()} loading={closing} loadingLabel="Đang mở lại...">Mở lại buổi</KinButton>
              : <KinButton onClick={() => void close()} loading={closing} loadingLabel="Đang chốt..." disabled={!past || detail.cancelled}>Đã dạy xong</KinButton>}
            {!past && !closed && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Buổi này chưa tới ngày nên chưa chốt được.</p>}
            <KinCallout title="Chốt buổi và học phí">Lớp tính học phí theo buổi hoặc theo giờ chỉ có khoản học phí khi buổi đã dạy xong: bấm Đã dạy xong thì KiN tính cho em có mặt hoặc đi muộn; lưu điểm danh thôi thì chưa tính. Mở lại buổi sẽ gỡ khoản chưa vào phiếu, khoản đã vào phiếu giữ nguyên. Lớp tính theo số buổi trong tháng (cách cũ) không đổi.</KinCallout>
          </KinPanel>

          <div className="space-y-3">
            <h2 className="text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)]">Liên quan</h2>
            <div className="flex flex-col items-start gap-1">
              <Link href={`/lop-cua-toi/ke-hoach-buoi?courseId=${encodeURIComponent(courseId)}&date=${dateKey}`} className="inline-flex items-center min-h-11 underline text-[var(--kin-nhan-link)]">Soạn kế hoạch buổi này</Link>
              <Link href="/lop-cua-toi/lich" className="inline-flex items-center min-h-11 underline text-[var(--kin-nhan-link)]">Về Lịch dạy</Link>
            </div>
          </div>
        </aside>
      </KinTwoCol>

      {share !== null && (
        <Modal title="Chia sẻ báo cáo buổi học" onClose={() => setShare(null)}>
          <label className="block text-sm" htmlFor="tin-bao-cao-buoi">Tin nhắn (sửa được trước khi gửi)</label>
          <textarea id="tin-bao-cao-buoi" rows={6} value={share} onChange={e => setShare(e.target.value)} className={`${KIN_FIELD} mt-1 py-2`} />
          <p className="text-xs mt-2" style={{ color: "var(--kin-chu-phu)" }}>
            Tin chung cho cả lớp: không tên em, không điểm, không tiền. {detail.course.zaloGroupUrl ? "Sẽ mở nhóm Zalo của lớp." : "Chưa gắn nhóm Zalo — KiN sẽ chép tin và mở Zalo, bạn chọn đúng nhóm."} KiN không gửi giúp: bạn tự bấm gửi trong Zalo.
          </p>
          <div className="flex gap-2 flex-wrap mt-4 justify-end">
            <KinButton variant="secondary" onClick={async () => { if (await copyText(share)) notify.ok("Đã sao chép tin."); else notify.err("Không sao chép được."); }}>Sao chép</KinButton>
            <KinButton onClick={() => void sendShare()} disabled={!share.trim()}>Mở Zalo</KinButton>
          </div>
        </Modal>
      )}
      {dialog}
    </KinPage>
  );
}
