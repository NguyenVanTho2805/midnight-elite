"use client";
// BU-05 — câu hỏi CŨ (bảng Question/Answer, trước đợt gộp feed). Chỉ làm sạch chữ về xu và dùng chung kiểu thẻ với feed; logic và API giữ nguyên.
// Trang này VẪN bắt đăng nhập (câu hỏi 5 của đặc tả: mặc định không mở cho khách) — 401 chuyển sang đăng nhập rồi quay lại đúng câu hỏi.
// Câu hỏi mới nằm ở Thread (ThreadDetailView), không đi qua đây.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KinButton, KinStateCard, KinStatus, kinButtonClass } from "@/components/kin";
import { CommunityFrame } from "./CommunityFrame";
import { CommunityAvatar } from "./Avatar";
import { MAX_REPLY, loginHref, timeAgo } from "./format";

interface AnswerDTO { id: string; content: string; isAccepted: boolean; isPenalized: boolean; createdAt: string; author: { id: string; name: string }; isOwn: boolean; reportedByMe: boolean }
interface QuestionDetailDTO { id: string; title: string; content: string; status: string; createdAt: string; author: { id: string; name: string }; isOwn: boolean; acceptedAnswerId: string | null; answers: AnswerDTO[] }

type State = { s: "loading" } | { s: "notfound" } | { s: "error" } | { s: "ok"; q: QuestionDetailDTO };

export function LegacyQuestionView({ id }: { id: string }) {
  return <CommunityFrame active="hoi-dap"><Inner id={id} /></CommunityFrame>;
}

function Inner({ id }: { id: string }) {
  const router = useRouter();
  const [st, setSt] = useState<State>({ s: "loading" });
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/questions/${id}`, { credentials: "same-origin", cache: "no-store", signal });
      if (res.status === 401) { router.replace(loginHref(`/cong-dong/hoi-dap/${id}`)); return; } // giữ khung chờ, không nháy "Không tìm thấy"
      if (res.status === 404) { setSt({ s: "notfound" }); return; }
      if (!res.ok) { setSt({ s: "error" }); return; }
      setSt({ s: "ok", q: (await res.json()) as QuestionDetailDTO });
    } catch (e) { if ((e as Error)?.name !== "AbortError") setSt({ s: "error" }); }
  }, [id, router]);
  // Qua Promise để setState "đang tải" không chạy đồng bộ trong thân effect (react-hooks/set-state-in-effect).
  useEffect(() => { const ac = new AbortController(); void Promise.resolve().then(() => load(ac.signal)); return () => ac.abort(); }, [load]);

  const flash = (m: string) => { setNotice(m); window.setTimeout(() => setNotice(""), 4000); };

  async function submitAnswer() {
    if (posting) return;
    if (!text.trim()) { setError("Hãy viết nội dung trả lời."); return; }
    setPosting(true); setError("");
    try {
      const res = await fetch(`/api/questions/${id}/answers`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: text.trim() }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Chưa gửi được trả lời."); return; }
      setText(""); await load();
    } catch { setError("Mất kết nối. Bạn thử lại nhé."); } finally { setPosting(false); }
  }

  async function accept(aid: string) {
    try {
      const res = await fetch(`/api/answers/${aid}/accept`, { method: "POST", credentials: "same-origin" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { flash(d.error ?? "Chưa chọn được đáp án."); return; }
      await load();
    } catch { flash("Mất kết nối. Thử lại nhé."); }
  }

  async function report(aid: string) {
    if (!reason.trim()) { flash("Bạn cho biết lý do giúp mình nhé."); return; }
    setSending(true);
    try {
      const res = await fetch(`/api/answers/${aid}/report`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: reason.trim() }) });
      const d = await res.json().catch(() => ({}));
      setReportFor(null); setReason("");
      flash(res.ok ? "Đã nhận báo cáo. Quản trị viên sẽ xem xét." : (d.error ?? "Chưa gửi được báo cáo."));
      if (res.ok) await load();
    } catch { flash("Mất kết nối. Thử lại nhé."); } finally { setSending(false); }
  }

  if (st.s === "loading") {
    return (
      <div role="status" aria-busy="true" aria-label="Đang tải câu hỏi" data-kc-skeleton aria-live="polite">
        <div className="kc-card" aria-hidden>
          <div className="kc-col1"><span className="kc-skel" style={{ width: 36, height: 36 }} /></div>
          <div className="kc-body flex flex-col gap-2"><span className="kc-skel" style={{ height: 12, width: "40%" }} /><span className="kc-skel" style={{ height: 12, width: "90%" }} /><span className="kc-skel" style={{ height: 12, width: "65%" }} /></div>
        </div>
      </div>
    );
  }
  if (st.s === "notfound") {
    return <div className="p-4"><KinStateCard as="h1" kicker="Không tìm thấy" title="Không tìm thấy câu hỏi"
      actions={<Link href="/cong-dong?tab=hoi-dap-qa" className={kinButtonClass("secondary")}>Về Hỏi đáp</Link>}>Câu hỏi có thể đã bị xoá.</KinStateCard></div>;
  }
  if (st.s === "error") {
    return <div className="p-4"><KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Không tải được"
      actions={<KinButton variant="secondary" onClick={() => { setSt({ s: "loading" }); void load(); }}>Thử lại</KinButton>}>Có trục trặc khi lấy câu hỏi. Bạn thử lại sau ít giây nhé.</KinStateCard></div>;
  }

  const q = st.q;
  const answered = q.status === "answered";
  return (
    <div>
      <div className="px-4 pt-2">
        <Link href="/cong-dong?tab=hoi-dap-qa" className="kc-focus inline-flex min-h-11 items-center text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-phu)] hover:underline">← Hỏi đáp</Link>
      </div>
      <article className="kc-card" data-flat>
        <div className="kc-col1"><CommunityAvatar label={q.author.name} />{q.answers.length > 0 && <span className="kc-line" aria-hidden />}</div>
        <div className="kc-body">
          <div className="flex items-baseline justify-between gap-2 flex-wrap"><span className="kc-name">{q.author.name}</span><time className="kc-meta" dateTime={q.createdAt}>{timeAgo(q.createdAt)}</time></div>
          <div className="mt-1">{answered ? <KinStatus tone="xong">Đã có đáp án</KinStatus> : <KinStatus tone="cho">Chưa có đáp án</KinStatus>}</div>
          <h1 className="mt-2" style={{ fontSize: 20, lineHeight: "28px", fontWeight: 600, color: "var(--kin-chu-chinh)" }}>{q.title}</h1>
          <p className="kc-text mt-2">{q.content}</p>
        </div>
      </article>
      {notice && <p role="status" className="px-4 pb-2 text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">{notice}</p>}
      <div style={{ borderTop: "1px solid var(--kin-vien-thuong)" }} />
      <h2 className="px-4 pt-3 text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-chu-chinh)]">{q.answers.length} câu trả lời</h2>
      {q.answers.map((a, i) => (
        <div key={a.id} className="kc-card" data-flat style={{ opacity: a.isPenalized ? 0.6 : 1 }}>
          <div className="kc-col1"><CommunityAvatar label={a.author.name} />{i < q.answers.length - 1 && <span className="kc-line" aria-hidden />}</div>
          <div className="kc-body">
            <div className="flex items-baseline justify-between gap-2 flex-wrap"><span className="kc-name">{a.author.name}</span><time className="kc-meta" dateTime={a.createdAt}>{timeAgo(a.createdAt)}</time></div>
            {a.isAccepted && <div className="mt-1"><KinStatus tone="xong">Đáp án đúng</KinStatus></div>}
            {a.isPenalized && <div className="mt-1"><KinStatus tone="loi">Đã bị gỡ vì vi phạm</KinStatus></div>}
            <p className="kc-text mt-1">{a.content}</p>
            <div className="kc-actions">
              {q.isOwn && q.status === "open" && !a.isPenalized && <button type="button" className="kc-act" onClick={() => void accept(a.id)}>Chọn là đúng</button>}
              {!a.isOwn && !a.reportedByMe && !a.isPenalized && <button type="button" className="kc-act" aria-expanded={reportFor === a.id} onClick={() => setReportFor(reportFor === a.id ? null : a.id)}>Báo cáo</button>}
              {a.reportedByMe && <span className="kc-meta px-2.5">Đã báo cáo</span>}
            </div>
            {reportFor === a.id && (
              <div className="mt-2 flex flex-col gap-2">
                <label className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]" htmlFor={`rp-${a.id}`}>Lý do báo cáo</label>
                <textarea id={`rp-${a.id}`} rows={3} value={reason} onChange={e => setReason(e.target.value)}
                  className="w-full rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] p-3 text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)]" />
                <div className="flex gap-2">
                  <KinButton variant="secondary" loading={sending} loadingLabel="Đang gửi…" onClick={() => void report(a.id)}>Gửi báo cáo</KinButton>
                  <KinButton variant="ghost" onClick={() => { setReportFor(null); setReason(""); }}>Huỷ</KinButton>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
      <form className="kc-card" data-flat style={{ borderTop: "1px solid var(--kin-vien-thuong)" }} onSubmit={e => { e.preventDefault(); void submitAnswer(); }}>
        <div className="kc-col1" />
        <div className="kc-body flex flex-col gap-2">
          <textarea aria-label="Nội dung trả lời" rows={3} maxLength={MAX_REPLY} value={text} onChange={e => { setText(e.target.value); setError(""); }} placeholder="Viết câu trả lời của bạn…"
            className="w-full resize-none rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] px-3 py-2.5 text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)] placeholder:text-[var(--kin-chu-mo)]" />
          {error && <p role="alert" className="text-[length:var(--kin-co-small)] text-[var(--kin-tt-chu-loi)]">{error}</p>}
          <div className="flex justify-end"><KinButton type="submit" loading={posting} loadingLabel="Đang gửi…">Gửi</KinButton></div>
        </div>
      </form>
    </div>
  );
}
