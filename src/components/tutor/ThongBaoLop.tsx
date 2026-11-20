// TB-LOP (17/11/2026) — tab "Thông báo" trong trang lớp của gia sư chủ lớp (…/quan-lop/<id>/thong-bao): soạn tin một chiều cho cả lớp + danh sách tin đã đăng
// (Ghim / Bỏ ghim / Gỡ). Mọi việc ghi là <form method="post"> thật → API trả 303 về đây kèm ?tb=<mã> (dải báo). Thành phần client chỉ để đếm ký tự, khoá nút khi
// đang gửi và hỏi lại trước khi gỡ tin (KinConfirm, không window.confirm). Điện thoại: một cột, nút ≥ 44px.
"use client";
import { useEffect, useState, type FormEvent } from "react";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { ThongBaoTin, type ThongBaoItem } from "@/components/lop/ThongBaoTin";
import { ANNOUNCE_BODY_MAX, ANNOUNCE_DAILY_LIMIT, ANNOUNCE_PIN_MAX, announceMessage } from "@/lib/classAnnouncement";

export interface ThongBaoLopData { courseId: string; items: ThongBaoItem[]; studentCount: number; remaining: number; tb: string | null; nowIso: string }

// TB-LOP rà soát P2: form gửi thật nên trang tải lại sau 303 — nội dung đang gõ cất vào sessionStorage lúc bấm Đăng, đăng xong (?tb=ok) thì xoá,
// bị từ chối (hết lượt, lỗi, ghim đủ…) thì trả lại vào ô. Trình duyệt chặn bộ nhớ thì thôi, không lỗi.
const draftKey = (courseId: string) => `kin-tb-nhap:${courseId}`;
function readDraft(k: string): string | null { try { return sessionStorage.getItem(k); } catch { return null; } }
function writeDraft(k: string, v: string | null): void { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch { /* bỏ qua */ } }

export default function ThongBaoLop({ d }: { d: ThongBaoLopData }) {
  const base = `/api/courses/${encodeURIComponent(d.courseId)}/thong-bao`;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { ask, dialog } = useKinConfirm();
  const key = draftKey(d.courseId);
  useEffect(() => {
    if (d.tb === "ok") { writeDraft(key, null); return; }
    const saved = readDraft(key);
    if (saved) void Promise.resolve().then(() => setText(t => t || saved));
  }, [key, d.tb]);
  // Nút Gỡ khoá tới khi trang chạy JS: bấm trước lúc đó thì form gửi thẳng, bỏ qua hộp hỏi lại (máy chậm / mạng yếu).
  const [ready, setReady] = useState(false);
  useEffect(() => { void Promise.resolve().then(() => setReady(true)); }, []);
  // Bấm Back sau khi gửi: trang lấy lại từ bfcache với nút còn "Đang đăng…" — mở khoá (như NopTepBox).
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) setBusy(false); };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  const flash = announceMessage(d.tb);
  const now = new Date(d.nowIso);
  const pinnedCount = d.items.filter(i => i.pinned).length;
  const len = text.length; // cùng đơn vị với maxLength của textarea (UTF-16); máy chủ đếm theo ký tự nên không bao giờ chặt hơn ô nhập
  const empty = text.trim().length === 0;
  const out = d.remaining <= 0;

  async function confirmRemove(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const ok = await ask({ title: "Gỡ thông báo này?", message: "Học sinh sẽ không còn thấy tin này trong lớp. Không hoàn tác được.", confirmLabel: "Gỡ thông báo", tone: "nguy-hiem" });
    if (ok) form.submit();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-[var(--kin-cach-muc)]" data-thong-bao-lop>
      {flash && (
        <p role={flash.tone === "err" ? "alert" : "status"} data-tb-flash={d.tb ?? ""}
          className={`rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] px-4 py-3 text-[length:var(--kin-co-goc)] font-medium ${flash.tone === "err" ? "text-[var(--kin-tt-chu-loi)]" : "text-[var(--kin-tt-chu-xong)]"}`}>
          {flash.text}
        </p>
      )}

      <section aria-labelledby="tb-soan">
        <KinSectionHead id="tb-soan" title="Đăng thông báo cho cả lớp" />
        <form method="post" action={base} onSubmit={e => { if (empty || out) { e.preventDefault(); return; } writeDraft(key, text); setBusy(true); }} className="mt-3 space-y-3">
          <label htmlFor="tb-noi-dung" className="block text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">Nội dung</label>
          <p id="tb-rieng-tu" className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">Cả lớp cùng đọc tin này: không ghi điểm, số điện thoại hay chuyện riêng của từng em.</p>
          <textarea id="tb-noi-dung" name="body" required rows={5} maxLength={ANNOUNCE_BODY_MAX} value={text} onChange={e => setText(e.target.value)}
            aria-describedby="tb-rieng-tu tb-goi-y tb-dem" placeholder="Ví dụ: Tối thứ Sáu lớp học online, link phòng: https://meet.google.com/…"
            className="block w-full min-w-0 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] px-3 py-2.5 text-[length:var(--kin-co-body)] leading-6 text-[var(--kin-chu-chinh)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]" />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">
            <p id="tb-goi-y">
              {d.studentCount > 0
                ? `Gửi tới ${d.studentCount} học sinh đang học. Học sinh chỉ đọc, không trả lời được; câu hỏi của các em vẫn ở Hỏi đáp.`
                : "Lớp chưa có học sinh. Tin vẫn được lưu, em vào lớp sau sẽ thấy."}
            </p>
            <p id="tb-dem" aria-live="polite" className="tabular-nums">{len}/{ANNOUNCE_BODY_MAX}</p>
          </div>
          <p data-tb-con-luot className={`text-[length:var(--kin-co-caption)] ${out ? "font-medium text-[var(--kin-tt-chu-loi)]" : "text-[var(--kin-chu-mo)]"}`}>
            {out ? `Lớp đã đăng đủ ${ANNOUNCE_DAILY_LIMIT} tin trong 24 giờ qua. Cô đợi thêm rồi đăng tiếp.` : `Còn ${d.remaining}/${ANNOUNCE_DAILY_LIMIT} lượt đăng trong 24 giờ.`}
          </p>
          <label className="flex min-h-[var(--kin-cham-toi-thieu)] items-center gap-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
            <input type="checkbox" name="pinned" value="on" disabled={pinnedCount >= ANNOUNCE_PIN_MAX} className="h-5 w-5" />
            <span>Ghim lên đầu{pinnedCount >= ANNOUNCE_PIN_MAX ? ` (đã ghim đủ ${ANNOUNCE_PIN_MAX} tin)` : ""}</span>
          </label>
          <KinButton type="submit" variant="primary" disabled={empty || busy || out} aria-busy={busy || undefined}>{busy ? "Đang đăng…" : "Đăng thông báo"}</KinButton>
        </form>
      </section>

      <section aria-labelledby="tb-da-dang">
        <KinSectionHead id="tb-da-dang" title="Đã đăng" aside={d.items.length > 0 ? `${d.items.length} tin` : undefined} />
        {d.items.length === 0 ? (
          <KinEmptyState title="Chưa có thông báo nào" className="mt-3">Tin cô đăng sẽ hiện ở đây và trong trang lớp của học sinh.</KinEmptyState>
        ) : (
          <ul className="mt-3 space-y-3">
            {d.items.map(it => (
              <li key={it.id}>
                <ThongBaoTin item={it} now={now} actions={<>
                  <form method="post" action={`${base}/${encodeURIComponent(it.id)}`}>
                    <input type="hidden" name="action" value={it.pinned ? "bo-ghim" : "ghim"} />
                    <button type="submit" className={kinButtonClass("secondary")} disabled={!it.pinned && pinnedCount >= ANNOUNCE_PIN_MAX}>{it.pinned ? "Bỏ ghim" : "Ghim"}</button>
                  </form>
                  <form method="post" action={`${base}/${encodeURIComponent(it.id)}`} onSubmit={confirmRemove}>
                    <input type="hidden" name="action" value="xoa" />
                    <button type="submit" className={kinButtonClass("danger")} disabled={!ready}>Gỡ</button>
                  </form>
                </>} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {dialog}
    </div>
  );
}
