// QZ-07 — "Chỉnh sửa và phiên bản quiz" (Figma 521:5150): so sánh phiên bản đang dùng với bản đề xuất, cách áp dụng an toàn, nhật ký thay đổi.
// Nguyên tắc hiện rõ trên màn hình: quiz đã có người làm thì KHÔNG sửa đè — lưu phiên bản mới; bài làm cũ vẫn thuộc phiên bản cũ, điểm cũ không đổi.
// Tab "Hạn riêng" (Figma: "Điều chỉnh thời hạn riêng"): hạn nộp riêng cho từng học sinh, bảng quiz_student_deadlines, không đổi lịch chung của đề (QuizDeadlines.tsx).
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KinPage, KinPageHeader, KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { KinTabs } from "@/components/kin/Tabs";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinStatus, type StatusTone } from "@/components/kin/Status";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { dayAt } from "@/lib/baiTap";
import type { QuizDiff } from "@/lib/quizVersion";
import { qfetch, quizHref, type QuizDetail } from "./quizClient";
import QuizDeadlines from "./QuizDeadlines";

interface Version { id: string; versionNo: number; status: "draft" | "superseded" | "current"; attemptCount: number; submittedCount: number; date: string; time: string; duration: string; questionCount: number; versionNote: string | null; supersededAt: string | null; title: string }
interface VersionsData { rootId: string; currentId: string | null; draftId: string | null; thisId: string; chain: Version[]; diff: { summary: string; data: QuizDiff } | null; log: { id: string; kind: string; note: string | null; at: string; actorName: string }[] }
type Tab = "so-sanh" | "han-rieng" | "nhat-ky";

const KIND_LABEL: Record<string, string> = {
  create: "Tạo quiz nháp", publish: "Phát hành", edit: "Sửa khi chưa có lượt làm", new_version: "Soạn đề xuất phiên bản mới", import: "Nhập đề từ tệp",
  version_published: "Phát hành phiên bản mới", discard: "Bỏ bản nháp", deadline: "Hạn nộp riêng",
};
const STATUS: Record<Version["status"], { tone: StatusTone; text: string }> = {
  current: { tone: "xong", text: "Đang dùng · không sửa trực tiếp nếu đã có lượt làm" }, superseded: { tone: "mo", text: "Đã được thay bằng bản mới · chỉ để xem" }, draft: { tone: "cho", text: "Chưa phát hành" },
};
const CHANGE_LABEL = { same: "Giữ nguyên", changed: "Đã sửa", added: "Thêm mới", removed: "Bỏ khỏi bản mới" } as const;

function Card({ v, role }: { v: Version; role: "live" | "draft" }) {
  const s = STATUS[v.status];
  return (
    <section aria-label={`Phiên bản v${v.versionNo}`} className={`min-w-0 rounded-[var(--kin-bo-md)] p-6 ${role === "draft" ? "bg-[var(--kin-nen-bang)]" : "border border-[var(--kin-vien-thuong)]"}`}>
      <h3 className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">v{v.versionNo} · {role === "draft" ? "Bản đề xuất" : v.status === "superseded" ? "Đã thay" : "Đã phát hành"}</h3>
      <KinStatus tone={s.tone} className="mt-2">{role === "draft" ? STATUS.draft.text : s.text}</KinStatus>
      <dl className="mt-4 text-[length:var(--kin-co-goc)]">
        {([
          ["Mở đề", `${v.date} · ${v.time}`],
          ["Thời lượng", v.duration],
          ["Số câu", `${v.questionCount} câu`],
          ["Lượt làm hiện có", `${v.attemptCount} lượt bắt đầu · ${v.submittedCount} bài nộp`],
          ["Kết quả", role === "draft" ? "Chỉ áp dụng cho lượt làm mới sau khi phát hành" : `Giữ theo đúng đề và đáp án v${v.versionNo}`],
        ] as const).map(([k, val]) => (
          <div key={k} className="flex flex-col sm:flex-row sm:justify-between gap-1 py-3 border-b border-[var(--kin-vien-nhat)]">
            <dt className="text-[var(--kin-chu-mo)]">{k}</dt><dd className="min-w-0 break-words sm:text-right">{val}</dd>
          </div>
        ))}
      </dl>
      {v.versionNote && <p className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Lý do: {v.versionNote}</p>}
    </section>
  );
}

export default function QuizVersions({ id }: { id: string }) {
  const router = useRouter();
  const { ask, dialog } = useKinConfirm();
  const [data, setData] = useState<VersionsData | null>(null);
  const [live, setLive] = useState<QuizDetail | null>(null);
  const [draft, setDraft] = useState<QuizDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [gone, setGone] = useState(false);
  const [tab, setTab] = useState<Tab>("so-sanh");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actErr, setActErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await qfetch<VersionsData>("GET", `/api/tutor/quiz/${id}/versions`);
    if (!r.ok || !r.data) { if (r.status === 404 || r.status === 403) setGone(true); setErr(r.error); return; }
    setErr(null); setData(r.data);
    const [a, b] = await Promise.all([
      r.data.currentId ? qfetch<QuizDetail>("GET", `/api/tutor/quiz/${r.data.currentId}`) : null,
      r.data.draftId ? qfetch<QuizDetail>("GET", `/api/tutor/quiz/${r.data.draftId}`) : null,
    ]);
    setLive(a?.data ?? null); setDraft(b?.data ?? null);
  }, [id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function createVersion() {
    if (!data?.currentId) return;
    setBusy("new"); setActErr(null);
    const r = await qfetch<{ id: string }>("POST", `/api/tutor/quiz/${data.currentId}/new-version`, { note });
    setBusy(null);
    if (!r.ok || !r.data) { setActErr(r.error); return; }
    router.push(quizHref(r.data.id));
  }
  async function discard() {
    if (!data?.draftId) return;
    if (!(await ask({ title: "Bỏ đề xuất này?", message: "Bản nháp phiên bản mới sẽ bị xoá. Phiên bản đang dùng giữ nguyên.", confirmLabel: "Bỏ đề xuất" }))) return;
    setBusy("discard"); setActErr(null);
    const r = await qfetch("DELETE", `/api/tutor/quiz/${data.draftId}`);
    setBusy(null);
    if (!r.ok) { setActErr(r.error); return; }
    await load();
  }

  if (gone) return <KinPage><KinEmptyState title="Không tìm thấy quiz này" action={<Link href="/lop-cua-toi/bai-tap" className={kinButtonClass("primary")}>Về Bài tập</Link>}>Quiz có thể đã bị xoá, hoặc không nằm trong các quiz của cô.</KinEmptyState></KinPage>;
  if (!data) return <KinPage>{err ? <ErrorStrip message={err} onRetry={() => void load()} /> : <div aria-busy="true" aria-label="Đang tải phiên bản" className="space-y-3"><div className="kin-skel kin-skel--soft h-9 w-64 rounded" /><div className="kin-skel kin-skel--soft h-[260px] rounded" /></div>}</KinPage>;

  const cur = data.chain.find(c => c.id === data.currentId) ?? null;
  const dr = data.chain.find(c => c.id === data.draftId) ?? null;
  const title = (cur ?? dr ?? data.chain[0])?.title ?? "Quiz";
  const questionsOf = (d: QuizDetail | null) => d?.questions ?? [];

  return (
    <KinPage>
      <KinPageHeader title="Chỉnh sửa và phiên bản quiz" back={{ href: quizHref(cur?.id ?? dr?.id ?? id), label: "Về quiz" }}
        sub={<>{title} · {cur ? `v${cur.versionNo} đang dùng` : "chưa có phiên bản nào được phát hành"}</>} />
      {err && <ErrorStrip message={err} onRetry={() => void load()} />}
      <KinTabs<Tab> label="Phiên bản và nhật ký" value={tab} onChange={setTab} tabs={[{ key: "so-sanh", label: "So sánh phiên bản" }, { key: "han-rieng", label: "Hạn riêng" }, { key: "nhat-ky", label: "Nhật ký thay đổi" }]} />

      {tab === "so-sanh" && (
        <div className="mt-6 space-y-8">
          {cur ? (
            <KinCallout title={`v${cur.versionNo} đang được giữ nguyên`}>
              {cur.attemptCount} lượt bắt đầu, {cur.submittedCount} bài nộp. {cur.attemptCount > 0
                ? "Vì đã có người làm nên KiN không sửa đè: mọi chỉnh sửa đi qua phiên bản mới, bài đã làm và điểm cũ giữ nguyên."
                : "Chưa ai làm nên cô vẫn sửa thẳng được ở trang quiz; tạo phiên bản mới nếu muốn giữ một bản để đối chiếu."}
            </KinCallout>
          ) : <KinCallout>Quiz này chưa có phiên bản nào được phát hành. Cô phát hành bản nháp ở trang quiz trước.</KinCallout>}

          <div className="grid lg:grid-cols-2 gap-6 items-start">
            {cur && <Card v={cur} role="live" />}
            {dr ? <Card v={dr} role="draft" /> : cur && (
              <section aria-label="Tạo phiên bản mới" className="min-w-0 rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-bang)] p-6">
                <h3 className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">v{cur.versionNo + 1} · Chưa có đề xuất</h3>
                <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Tạo phiên bản mới để sửa câu hỏi, đáp án hay điểm mà không đụng tới bài đã làm.</p>
                <div className="mt-4"><label htmlFor="qv-note" className={`${KIN_LABEL} mb-2`}>Lý do chỉnh (không bắt buộc)</label><input id="qv-note" className={KIN_FIELD} value={note} maxLength={500} onChange={e => setNote(e.target.value)} /></div>
                <KinButton className="mt-4" onClick={() => void createVersion()} loading={busy === "new"} loadingLabel="Đang tạo…">Tạo phiên bản mới</KinButton>
              </section>
            )}
          </div>

          {dr && diffBlock()}

          <section aria-labelledby="qv-an">
            <KinSectionHead id="qv-an" title="Cách áp dụng an toàn" />
            <ul className="mt-4 space-y-3 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-phu)]">
              <li>Tạo bản mới và phiên làm mới. KiN không thay thế bản cũ.</li>
              <li>Khi đã có lượt làm: không âm thầm đổi đáp án, đề hay điểm của lượt cũ. Lượt đã bắt đầu giữ phiên bản ban đầu.</li>
              <li>Học sinh đang làm dở bản cũ vẫn nộp được vào bản cũ; từ lúc phát hành, lượt làm mới chỉ mở bản mới.</li>
              <li>KiN không tự gửi điểm hay lời giải cho học sinh khi phát hành phiên bản mới.</li>
            </ul>
          </section>

          {actErr && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{actErr}</p>}
          {dr && (
            <div className="flex flex-wrap gap-3">
              <Link href={quizHref(dr.id)} className={kinButtonClass("primary")}>Soạn và phát hành bản đề xuất</Link>
              <KinButton variant="danger" onClick={() => void discard()} loading={busy === "discard"} loadingLabel="Đang bỏ…">Bỏ đề xuất</KinButton>
            </div>
          )}

          <section aria-labelledby="qv-all">
            <KinSectionHead id="qv-all" title="Mọi phiên bản" aside={`${data.chain.length} bản`} />
            <ul className="mt-2">
              {[...data.chain].reverse().map(v => (
                <li key={v.id} className="py-3 border-b border-[var(--kin-vien-nhat)] flex flex-wrap items-center justify-between gap-3 text-[length:var(--kin-co-goc)]">
                  <span>v{v.versionNo} · {v.questionCount} câu · {v.attemptCount} lượt làm · <KinStatus tone={STATUS[v.status].tone} className="align-middle">{v.status === "current" ? "Đang dùng" : v.status === "draft" ? "Nháp" : "Đã thay"}</KinStatus></span>
                  <Link href={quizHref(v.id)} className={kinButtonClass("secondary")}>{v.status === "superseded" ? "Xem" : "Mở"}</Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {tab === "han-rieng" && (cur ? <QuizDeadlines examId={cur.id} onChanged={() => void load()} /> : <KinEmptyState title="Chưa có phiên bản đang dùng">Hạn riêng áp dụng cho phiên bản đã phát hành. Phát hành quiz trước, rồi quay lại đây.</KinEmptyState>)}

      {tab === "nhat-ky" && (
        <section className="mt-6" aria-labelledby="qv-nk">
          <KinSectionHead id="qv-nk" title="Nhật ký gần nhất" aside={`${data.log.length} dòng`} />
          {data.log.length === 0 ? <KinEmptyState title="Chưa có dòng nhật ký">Mỗi lần tạo, phát hành hay tạo phiên bản mới, KiN ghi một dòng ở đây.</KinEmptyState> : (
            <table className="w-full mt-2 text-[length:var(--kin-co-goc)]">
              <caption className="sr-only">Nhật ký thay đổi của quiz</caption>
              <thead><tr className="text-left text-[var(--kin-chu-mo)] bg-[var(--kin-nen-bang)]"><th scope="col" className="px-3 py-3 font-normal">Thời điểm</th><th scope="col" className="px-3 py-3 font-normal">Người thực hiện</th><th scope="col" className="px-3 py-3 font-normal">Nội dung</th></tr></thead>
              <tbody>
                {data.log.map(l => (
                  <tr key={l.id} className="border-b border-[var(--kin-vien-nhat)] align-top">
                    <td className="px-3 py-3 whitespace-nowrap">{dayAt(new Date(l.at))}</td>
                    <td className="px-3 py-3">{l.actorName}</td>
                    <td className="px-3 py-3 break-words">{KIND_LABEL[l.kind] ?? l.kind}{l.note ? ` · ${l.note}` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
      {dialog}
    </KinPage>
  );

  function diffBlock() {
    if (!data?.diff) return null;
    const d = data.diff.data;
    const a = questionsOf(live), b = questionsOf(draft);
    return (
      <section aria-labelledby="qv-diff">
        <KinSectionHead id="qv-diff" title="Thay đổi so với bản đang dùng" aside={`Tổng điểm ${d.totalPointsFrom} → ${d.totalPointsTo}`} />
        <p className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]" role="status">{data.diff.summary}</p>
        {d.keyChanges > 0 && <KinCallout title="Có câu đổi đáp án hoặc điểm" tone="nhan" className="mt-3">Học sinh làm bản mới sẽ được chấm theo đáp án mới. Lượt đã làm ở bản cũ không bị chấm lại.</KinCallout>}
        <ul className="mt-2" aria-label="Từng câu">
          {d.rows.map(r => {
            const q = b[r.index] ?? a[r.index];
            const tone: StatusTone = r.change === "same" ? "mo" : r.keyChanged ? "loi" : "cho";
            return (
              <li key={r.index} className="py-3 border-b border-[var(--kin-vien-nhat)] grid sm:grid-cols-[72px_minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-[length:var(--kin-co-goc)]">
                <span className="text-[var(--kin-chu-mo)]">Câu {r.index + 1}</span>
                <span className="min-w-0 break-words text-[var(--kin-chu-chinh)]">{q ? (q.text.length > 120 ? q.text.slice(0, 120) + "…" : q.text) : "—"}</span>
                <KinStatus tone={tone}>{CHANGE_LABEL[r.change]}{r.keyChanged ? " · đổi đáp án hoặc điểm" : ""}</KinStatus>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }
}
