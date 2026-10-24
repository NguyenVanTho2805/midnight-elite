// LO-13: tổng hợp LINK BÁO CÁO RIÊNG của cả lớp (Figma "Gia sư · Chi tiết Toán 9" 299:112581 + "Báo cáo · Chi tiết buổi" 464:8775).
// Hộp chọn học sinh + link riêng từng em: Copy link, Xem thử, Bật (cho em chưa có link), Thu hồi ngay. Dùng ParentLink.portalToken qua
// GET /api/tutor/lop/[courseId]/bao-cao-link (không trả tên: tên ghép từ danh sách lớp) và /api/tutor/hoc-sinh/[userId]/bao-cao-link (bật / thu hồi từng em).
// Link chỉ có mã ngẫu nhiên, không có tên em. Em chưa có phụ huynh liên kết trên KiN thì chưa bật được: nói rõ, không tự tạo liên kết.
"use client";
import { useCallback, useEffect, useState } from "react";
import { KinButton } from "@/components/kin/Button";
import { KinCopyButton } from "@/components/kin/CopyButton";
import { KinPanel } from "@/components/kin/Panel";
import { KinStatus } from "@/components/kin/Status";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KIN_TABLE_ROW } from "@/components/kin/PageLayout";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { REPORT_LINK_LABEL, type ReportLinkState } from "@/lib/tutorStudentView";
import { jfetch } from "@/components/tutor/studentUi";

interface Item { userId: string; state: ReportLinkState; links: { linkId: string; state: "on" | "off"; url: string | null }[] }

export default function LopBaoCao({ courseId, students }: { courseId: string; students: { id: string; name: string }[] }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const { ask, dialog } = useKinConfirm();

  const load = useCallback(async () => {
    const r = await jfetch(`/api/tutor/lop/${courseId}/bao-cao-link`);
    if (r.ok) { setItems(r.json.items as Item[]); setErr(false); } else setErr(true);
  }, [courseId]);
  useEffect(() => { void load(); }, [load]);

  const by = new Map((items ?? []).map(i => [i.userId, i]));
  const call = (userId: string, linkId: string, kind: "enable" | "revoke") =>
    jfetch(`/api/tutor/hoc-sinh/${userId}/bao-cao-link`, { method: kind === "enable" ? "POST" : "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ linkId }) });

  async function enableSelected() {
    const todo = picked.flatMap(id => (by.get(id)?.links ?? []).filter(l => l.state === "off").map(l => ({ id, linkId: l.linkId })));
    if (!todo.length) { setNote({ tone: "err", text: "Các em đã chọn chưa có liên kết phụ huynh để bật, hoặc đã bật rồi." }); return; }
    setBusy(true); setNote(null);
    let ok = 0;
    for (const t of todo) { if ((await call(t.id, t.linkId, "enable")).ok) ok++; }
    setBusy(false);
    setNote(ok === todo.length ? { tone: "ok", text: `Đã bật ${ok} link báo cáo riêng.` } : { tone: "err", text: `Bật được ${ok}/${todo.length} link. Cô thử lại các em còn lại.` });
    await load();
  }
  async function one(userId: string, linkId: string, kind: "enable" | "revoke") {
    if (busy) return;
    if (kind === "revoke" && !(await ask({ title: "Thu hồi link báo cáo?", confirmLabel: "Thu hồi ngay", message: "Link cũ ngừng hoạt động ngay. Bật lại sẽ có link mới, khác link cũ." }))) return;
    setBusy(true); setNote(null);
    const r = await call(userId, linkId, kind);
    setBusy(false);
    setNote(r.ok ? { tone: "ok", text: kind === "enable" ? "Đã bật link báo cáo riêng." : "Đã thu hồi. Link cũ ngừng hoạt động." } : { tone: "err", text: r.json?.error ?? "Chưa làm được, thử lại sau." });
    await load();
  }

  const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));
  const origin = () => (typeof window !== "undefined" ? window.location.origin : "");

  return (
    <section aria-labelledby="lop-bc" className="mt-[var(--kin-cach-muc)]">
      <KinSectionHead id="lop-bc" title="Link báo cáo riêng của cả lớp" aside={items ? `${items.filter(i => i.state === "on").length}/${students.length} em đang bật` : undefined} />
      <p className="pt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
        Mỗi em một link riêng (mã ngẫu nhiên, không có tên em), phụ huynh mở không cần tài khoản. Chọn nhiều em để bật cùng lúc; thu hồi từng link là link ngừng hoạt động ngay.
      </p>
      {err && <div className="mt-4"><ErrorStrip message="Không tải được trạng thái link báo cáo." onRetry={() => { setErr(false); void load(); }} /></div>}
      {!err && items === null && <p role="status" className="pt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đang tải…</p>}
      {items && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <KinButton variant="secondary" loading={busy} loadingLabel="Đang bật…" disabled={picked.length === 0} onClick={() => void enableSelected()}>Bật link cho {picked.length} em đã chọn</KinButton>
            <button type="button" onClick={() => setPicked(picked.length === students.length ? [] : students.map(s => s.id))} className="inline-flex items-center min-h-11 text-[length:var(--kin-co-goc)] underline text-[var(--kin-nhan-link)]">
              {picked.length === students.length ? "Bỏ chọn tất cả" : "Chọn cả lớp"}
            </button>
          </div>
          {note && <p role={note.tone === "err" ? "alert" : "status"} className={`mt-3 text-[length:var(--kin-co-goc)] ${note.tone === "err" ? "text-[var(--kin-tt-chu-loi)]" : "text-[var(--kin-chu-chinh)]"}`}>{note.text}</p>}
          <KinPanel flush className="mt-4">
            <ul aria-label="Link báo cáo từng học sinh">
              {students.map(s => {
                const it = by.get(s.id);
                const state = it?.state ?? "no_parent";
                return (
                  <li key={s.id} data-lop-bao-cao className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${KIN_TABLE_ROW}`}>
                    <label className="flex items-center gap-3 min-h-11 min-w-0 flex-1 cursor-pointer">
                      <input type="checkbox" checked={picked.includes(s.id)} onChange={() => toggle(s.id)} className="size-5 shrink-0" aria-label={`Chọn ${s.name}`} />
                      <span className="min-w-0 break-words text-[var(--kin-chu-chinh)]">{s.name}</span>
                    </label>
                    <KinStatus tone={state === "on" ? "xong" : "mo"}>{REPORT_LINK_LABEL[state]}</KinStatus>
                    {(it?.links ?? []).map(l => l.state === "on" && l.url ? (
                      <span key={l.linkId} className="flex flex-wrap items-center gap-2">
                        <KinCopyButton appearance="chip" text={() => `${origin()}${l.url}`} label={`Chép link báo cáo của ${s.name}`}>Copy link</KinCopyButton>
                        <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-11 px-1 text-[var(--kin-nhan-link)] underline" aria-label={`Xem thử báo cáo của ${s.name}`}>Xem thử</a>
                        <button type="button" onClick={() => void one(s.id, l.linkId, "revoke")} className="inline-flex items-center min-h-11 px-1 text-[var(--kin-nhan-link)] underline" aria-label={`Thu hồi link báo cáo của ${s.name}`}>Thu hồi ngay</button>
                      </span>
                    ) : (
                      <button key={l.linkId} type="button" onClick={() => void one(s.id, l.linkId, "enable")} className="inline-flex items-center min-h-11 px-1 text-[var(--kin-nhan-link)] underline" aria-label={`Bật link báo cáo của ${s.name}`}>Bật link</button>
                    ))}
                  </li>
                );
              })}
            </ul>
          </KinPanel>
        </>
      )}
      {dialog}
    </section>
  );
}
