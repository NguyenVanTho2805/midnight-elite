// Bài tập và kiểm tra của gia sư (Figma "Gia sư · Bài tập" 299:113312). TRANG DỌC như Hộp việc: tiêu đề + "Giao bài"; tab theo tình trạng;
// cột trái: lọc lớp rồi từng lớp một nhóm dòng (bài tập và đề thi); cột phải (354px→ rộng hơn ở Figma): bài đang chọn + chấm điểm.
// Điện thoại: một cột, bài chọn xong thì khung chấm hiện ngay dưới danh sách và được cuộn tới.
// Dữ liệu: /api/tutor/bai-tap; bài nộp: GET /api/assignments/[id]/submissions; chấm: PATCH …/grade (API cũ, không đổi cách chấm).
// Figma có nhưng chưa có dữ liệu thật (không bịa): ảnh xem trước từng trang bài nộp, ô "Nhận xét nhanh" tách khỏi "Phản hồi" (DB chỉ có một cột comment),
// "Lưu nháp" (chưa có bản nháp điểm), tên gia sư ở đầu từng lớp.
// LOI-02 (mục 2.E): bài nộp bằng tệp KiN (/api/media/nop-bai/…) ⇒ danh sách tệp của học sinh (NopTepStudentFiles); khung chấm có "Tệp trả bài (không bắt buộc)"
// (NopTepBox mode="tutor_return"). Gửi: CHẤM ĐIỂM TRƯỚC, chỉ khi điểm lưu xong mới đính tệp trả bài; đính lỗi ⇒ điểm GIỮ, báo riêng. Chấm lỗi ⇒ không đính.
// TRẺ EM: tên học sinh chỉ hiện trong khung chấm của người có quyền chấm (như cũ); thông báo "đã trả bài" do máy chủ gửi không tên, không điểm, không tên tệp.
"use client";
import { KinPanel } from "@/components/kin/Panel";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BaiTapItem, BaiTapGroup } from "@/lib/baiTap";
import { countGroups } from "@/lib/baiTap";
import { api, type AssignmentSubmissionFull } from "@/lib/api";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinStatus } from "@/components/kin/Status";
import { KinTabs } from "@/components/kin/Tabs";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinCallout } from "@/components/kin/Callout";
import { NopTepBox, NopTepStudentFiles, type NopTepBoxHandle } from "@/components/student/nop-tep/NopTepBox"; // BU-HS-NOP-TEP: tệp học sinh nộp + tệp trả bài (chỉ import)
import { dayAt } from "@/lib/baiTap";
import { deThiSubHref, taoDeHref } from "@/components/tutor/de-thi/deThiClient";
import { contentHref } from "@/lib/tutorRoutes";

type Tab = "all" | BaiTapGroup;
interface Data { items: BaiTapItem[]; courses: { id: string; name: string }[] }

const FIELD = "w-full min-h-11 px-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] placeholder:text-[var(--kin-chu-mo)]";
const LABEL = "block mb-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]";

function Skeleton() {
  const sk = "kin-skel kin-skel--soft";
  return (
    <div aria-busy="true" aria-label="Đang tải bài tập" className="mt-6 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-x-8 gap-y-6">
      <div className="space-y-3">{[0, 1, 2, 3].map(i => <div key={i} className={`h-[76px] rounded ${sk}`} />)}</div>
      <div className={`h-[320px] rounded ${sk}`} />
    </div>
  );
}

function GradePanel({ item, onGraded }: { item: BaiTapItem; onGraded: () => void }) {
  const [subs, setSubs] = useState<AssignmentSubmissionFull[] | null>(null);
  const [err, setErr] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [score, setScore] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  /** Lỗi RIÊNG của bước đính tệp trả bài (điểm đã lưu). */
  const [attachErr, setAttachErr] = useState<string | null>(null);
  const returnRef = useRef<NopTepBoxHandle>(null);

  const pick = useCallback((s: AssignmentSubmissionFull) => {
    setSel(s.id); setScore(s.score != null ? String(s.score) : ""); setComment(s.comment ?? ""); setMsg(null); setAttachErr(null);
  }, []);

  const fetchSubs = useCallback(() => {
    api.assignments.listSubmissions(item.id)
      .then(list => {
        setSubs(list); setErr(false);
        const first = list.find(s => s.gradedAt == null) ?? list[0];
        if (first) pick(first);
      })
      .catch(() => setErr(true));
  }, [item.id, pick]);
  // Khung chấm được dựng lại (key) mỗi lần đổi bài, nên state ban đầu đã là "đang tải".
  useEffect(() => { fetchSubs(); }, [fetchSubs]);
  const retry = () => { setErr(false); setSubs(null); fetchSubs(); };

  const cur = subs?.find(s => s.id === sel) ?? null;

  async function send() {
    if (!cur) return;
    const n = Number(score.replace(",", "."));
    if (score.trim() === "" || Number.isNaN(n) || n < 0 || n > item.maxPoints) { setMsg({ ok: false, text: `Điểm phải từ 0 đến ${item.maxPoints}.` }); return; }
    setSaving(true); setMsg(null); setAttachErr(null);
    let graded = false;
    try {
      const updated = await api.assignments.grade(item.id, cur.id, { score: n, comment: comment.trim() || undefined });
      graded = true;
      setSubs(prev => (prev ?? []).map(s => s.id === cur.id ? { ...s, ...updated, user: s.user } : s));
      setMsg({ ok: true, text: "Đã gửi điểm và phản hồi cho học sinh." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Chưa gửi được điểm. Thử lại sau ít phút." });
    }
    // Tệp trả bài (nếu có) chỉ đính SAU khi điểm đã lưu; lỗi đính ⇒ điểm vẫn giữ, báo riêng một dòng.
    if (graded) {
      try {
        const att = await returnRef.current?.attach();
        if (att && !att.ok) setAttachErr(/đang tải/i.test(att.message ?? "") ? `Điểm đã gửi. ${att.message}` : "Điểm đã gửi. Chưa đính kèm được tệp trả bài — bấm Gửi lại để thử đính kèm.");
      } catch {
        setAttachErr("Điểm đã gửi. Chưa đính kèm được tệp trả bài — bấm Gửi lại để thử đính kèm.");
      }
      onGraded();
    }
    setSaving(false);
  }

  if (err) return <ErrorStrip message="Không tải được bài nộp." onRetry={retry} />;
  if (subs === null) return <div aria-busy="true" aria-label="Đang tải bài nộp" className="kin-skel kin-skel--soft h-[220px] rounded" />;
  if (subs.length === 0) {
    return (
      <KinEmptyState title="Chưa có bài nộp" action={<Link href={item.href} className={kinButtonClass("secondary")}>Mở bài trong lớp</Link>}>
        Khi học sinh nộp bài, bài sẽ hiện ở đây để cô chấm và gửi phản hồi.
      </KinEmptyState>
    );
  }
  return (
    <div>
      {subs.length > 1 && (
        <ul aria-label="Bài nộp của học sinh" className="mb-5 flex flex-wrap gap-2">
          {subs.map(s => (
            <li key={s.id}>
              <button type="button" onClick={() => pick(s)} aria-pressed={s.id === sel}
                className={`min-h-11 px-4 rounded-[var(--kin-bo-md)] border text-[length:var(--kin-co-goc)] ${s.id === sel ? "border-[var(--kin-nhan-nen)] text-[var(--kin-chu-chinh)] font-semibold" : "border-[var(--kin-vien-o-nhap)] text-[var(--kin-chu-mo)]"}`}>
                {s.user?.name ?? "Học viên"} · {s.gradedAt ? "đã chấm" : "chờ chấm"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {cur && (
        <>
          <div>
            <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] break-words">{cur.fileName || "Bài nộp"}</p>
            <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{cur.user?.name ?? "Học viên"} · nộp {dayAt(new Date(cur.submittedAt))}</p>
            {cur.fileUrl.startsWith("/api/media/nop-bai/")
              ? <div className="mt-4"><NopTepStudentFiles assignmentId={item.id} submissionId={cur.id} /></div>
              : <a href={cur.fileUrl} target="_blank" rel="noopener noreferrer" className={`${kinButtonClass("secondary")} mt-4`}>Mở bài nộp gốc ↗</a>}
          </div>
          <form className="mt-6" onSubmit={e => { e.preventDefault(); void send(); }}>
            <div className="max-w-[200px]">
              <label htmlFor="bt-score" className={LABEL}>Điểm / {item.maxPoints}</label>
              <input id="bt-score" inputMode="decimal" className={FIELD} value={score} placeholder="Chưa nhập" onChange={e => setScore(e.target.value)} />
            </div>
            <div className="mt-5">
              <label htmlFor="bt-comment" className={LABEL}>Phản hồi cho học sinh</label>
              <textarea id="bt-comment" rows={4} className={`${FIELD} py-3 resize-y`} value={comment} onChange={e => setComment(e.target.value)} />
            </div>
            <div className="mt-5" data-tra-bai><NopTepBox key={cur.id} ref={returnRef} mode="tutor_return" assignmentId={item.id} submissionId={cur.id} /></div>
            <div className="mt-5">
              <KinButton type="submit" variant="primary" loading={saving} loadingLabel="Đang gửi…">Gửi điểm &amp; phản hồi</KinButton>
            </div>
            <p role="status" className={`mt-4 text-[length:var(--kin-co-goc)] ${msg && !msg.ok ? "text-[var(--kin-tt-chu-loi)]" : "text-[var(--kin-chu-mo)]"}`}>
              {msg ? msg.text : cur.gradedAt ? `Đã chấm ${dayAt(new Date(cur.gradedAt))}. Gửi lại nếu cô muốn sửa điểm.` : "Chưa gửi điểm. Bài vẫn ở trạng thái chờ chấm."}
            </p>
            {attachErr && <p role="status" data-tra-bai-loi className="mt-2 text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-tt-chu-loi)]">{attachErr}</p>}
          </form>
        </>
      )}
    </div>
  );
}

function Detail({ item, onGraded }: { item: BaiTapItem; onGraded: () => void }) {
  return (
    <KinPanel as="section" variant="nhan" aria-labelledby="bt-detail-h">
      <div className="flex items-start justify-between gap-4">
        <h2 id="bt-detail-h" className="text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)] min-w-0 break-words">{item.title}</h2>
        <KinStatus tone={item.statusTone} className="flex-shrink-0 mt-1">{item.statusLabel}</KinStatus>
      </div>
      <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{item.courseName} · {item.sub}</p>
      <div className="mt-6">
        {item.kind === "exam" ? (
          <KinCallout title="Đề thi">
            <p>{item.ungraded > 0 ? `${item.ungraded} bài đang chờ cô chấm tự luận. ` : ""}Chấm tự luận, công bố điểm, xem lượt làm và phân tích kết quả của đề này; soạn câu hỏi và phiên bản ở trang quiz.</p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href={deThiSubHref(item.id, "cham")} className={kinButtonClass("primary")}>Chấm và theo dõi</Link>
              <Link href={item.href} className={kinButtonClass("secondary")}>Mở đề thi</Link>
              <Link href={`${item.href}/phien-ban`} className={kinButtonClass("secondary")}>Phiên bản</Link>
            </div>
          </KinCallout>
        ) : item.mode === "interactive" ? (
          <KinCallout title="Bài làm trực tiếp trên KiN">
            <p>Bài này chấm từng câu ở trang lớp. {item.ungraded > 0 ? `${item.ungraded} bài đang chờ cô.` : ""}</p>
            <Link href={item.href} className={`${kinButtonClass("primary")} mt-3`}>Chấm ở trang lớp</Link>
          </KinCallout>
        ) : (
          <GradePanel key={item.id} item={item} onGraded={onGraded} />
        )}
      </div>
    </KinPanel>
  );
}

export default function BaiTap() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>("all");
  const [courseId, setCourseId] = useState("");
  const [selKey, setSelKey] = useState<string | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickId, setPickId] = useState("");

  const load = useCallback(() => {
    fetch("/api/tutor/bai-tap", { credentials: "same-origin", cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<Data>; })
      .then(d => { setData({ items: Array.isArray(d.items) ? d.items : [], courses: Array.isArray(d.courses) ? d.courses : [] }); setError(false); })
      .catch(() => setError(true));
  }, []);
  useEffect(() => { load(); }, [load]);

  const items = useMemo(() => data?.items ?? [], [data]);
  const inCourse = useMemo(() => items.filter(i => !courseId || i.courseId === courseId), [items, courseId]);
  const counts = countGroups(inCourse);
  const shown = inCourse.filter(i => tab === "all" || i.group === tab);
  const keyOf = (i: BaiTapItem) => `${i.kind}:${i.id}`;
  // Bài đã chọn tìm trong cả lớp đang lọc (không chỉ tab đang xem): chấm xong bài rời tab "Chờ chấm" mà khung chấm vẫn phải ở lại để cô thấy lời xác nhận.
  const selected = (selKey === null ? null : inCourse.find(i => keyOf(i) === selKey)) ?? null;
  // Mặc định (máy tính): bài đầu tiên đang chờ chấm, để cột phải không trống khi có việc.
  const active = selected ?? (selKey === null ? shown.find(i => i.group === "cho") ?? null : null);

  const byCourse = new Map<string, BaiTapItem[]>();
  for (const i of shown) byCourse.set(i.courseName, [...(byCourse.get(i.courseName) ?? []), i]);
  const groups = [...byCourse.entries()];

  // A1: "+ Giao bài" soạn bài tập tự nộp ở tab "Bài tập" của lớp. Một lớp, hoặc đã lọc lớp → đi thẳng; từ 2 lớp mà chưa chọn → hỏi lớp ngay tại trang này (không đẩy sang danh sách lớp).
  const nCourses = data?.courses.length ?? 0;
  const onlyCourse = nCourses === 1 ? data!.courses[0].id : null;
  const tuNopHref = (id: string) => contentHref(true, `/admin/khoa-hoc/${encodeURIComponent(id)}?tab=chuong-bai`);
  const directId = onlyCourse ?? (courseId || null);
  const needPick = directId === null && nCourses >= 2;
  const giaoHref = directId ? tuNopHref(directId) : "/lop-cua-toi/lop";

  function choose(i: BaiTapItem) {
    setSelKey(keyOf(i));
    if (typeof window !== "undefined" && window.innerWidth < 1024) setTimeout(() => document.getElementById("bt-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const tabs = [
    { key: "all" as Tab, label: "Tất cả" },
    { key: "cho" as Tab, label: `Chờ chấm · ${counts.cho}` },
    { key: "giao" as Tab, label: `Đang giao · ${counts.giao}` },
    { key: "xong" as Tab, label: "Đã hoàn tất" },
  ];

  return (
    <div className="px-4 md:px-10 pt-6 md:pt-8 pb-10 bg-[var(--kin-nen-trang)]">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6">
        <div className="min-w-0">
          <h1 className="text-[length:var(--kin-co-h2)] leading-9 font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)]">Bài tập &amp; kiểm tra</h1>
          <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Giao bài, xem bài nộp và gửi phản hồi theo từng lớp.</p>
        </div>
        <div className="flex flex-wrap gap-3 self-start flex-shrink-0">
          <Link href={taoDeHref()} className={kinButtonClass("secondary")}>Tạo đề</Link>
          <Link href="/lop-cua-toi/de-thi" className={kinButtonClass("secondary")}>Quản lý đề thi</Link>
          {needPick
            ? <button type="button" onClick={() => setPickOpen(o => !o)} aria-expanded={pickOpen} aria-controls="bt-giao-pick" className={kinButtonClass("primary")}>+ Giao bài</button>
            : <Link href={giaoHref} className={kinButtonClass("primary")}>+ Giao bài</Link>}
        </div>
      </header>

      {needPick && pickOpen && (
        <KinPanel as="section" id="bt-giao-pick" aria-labelledby="bt-giao-pick-h" className="mb-6">
          <h2 id="bt-giao-pick-h" className="text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)]">Giao bài cho lớp nào?</h2>
          <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Chọn lớp rồi soạn bài tập tự nộp ở tab Bài tập của lớp đó. Giao đề thi thì mở một đề ở Quản lý đề thi.</p>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="min-w-0 sm:flex-1 sm:max-w-sm">
              <label htmlFor="bt-giao-lop" className={LABEL}>Lớp</label>
              <select id="bt-giao-lop" autoFocus className={FIELD} value={pickId} onChange={e => setPickId(e.target.value)}>
                <option value="">Chọn lớp</option>
                {data?.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {pickId
              ? <Link href={tuNopHref(pickId)} className={kinButtonClass("primary")}>Soạn bài cho lớp này</Link>
              : <button type="button" disabled className={kinButtonClass("primary")}>Soạn bài cho lớp này</button>}
          </div>
        </KinPanel>
      )}

      {error && <ErrorStrip message="Không tải được danh sách bài." onRetry={load} />}
      {data === null ? (!error ? <Skeleton /> : null) : items.length === 0 ? (
        <KinEmptyState title="Chưa có bài tập hay đề thi nào"
          action={needPick
            ? <button type="button" onClick={() => setPickOpen(true)} className={kinButtonClass("primary")}>Giao bài đầu tiên</button>
            : <Link href={giaoHref} className={kinButtonClass("primary")}>{data.courses.length ? "Giao bài đầu tiên" : "Tạo lớp trước"}</Link>}>
          {data.courses.length
            ? "Giao bài trong tab Bài tập của lớp. Bài học sinh nộp sẽ hiện ở đây để cô chấm."
            : "Cô cần có lớp trước, rồi mới giao bài được. Đề thi cô tạo cũng sẽ hiện ở đây."}
        </KinEmptyState>
      ) : (
        <>
          <KinTabs tabs={tabs} value={tab} onChange={t => { setTab(t); setSelKey(null); }} label="Lọc theo tình trạng" />
          <div className="mt-6 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-x-8 gap-y-8 items-start">
            <div className="min-w-0">
              <label htmlFor="bt-lop" className={LABEL}>Lọc lớp</label>
              <select id="bt-lop" className={FIELD} value={courseId} onChange={e => { setCourseId(e.target.value); setSelKey(null); setPickOpen(false); }}>
                <option value="">Tất cả lớp</option>
                {data.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {shown.length === 0 ? (
                <KinEmptyState title="Không có bài nào ở mục này"
                  action={<button type="button" onClick={() => { setTab("all"); setCourseId(""); }} className={kinButtonClass("secondary")}>Xem tất cả</button>}>
                  Đổi tab hoặc lớp để xem các bài khác.
                </KinEmptyState>
              ) : groups.map(([name, list], gi) => (
                <section key={name} aria-labelledby={`bt-g-${gi}`} className="mt-8">
                  <KinSectionHead id={`bt-g-${gi}`} title={name} aside={`${list.length} mục`} />
                  <KinPanel flush className="mt-4">
                  <ul aria-label={`Bài của ${name}`}>
                    {list.map(i => {
                      const on = !!active && keyOf(i) === keyOf(active);
                      return (
                        <li key={keyOf(i)}>
                          <button type="button" onClick={() => choose(i)} aria-pressed={on} data-bai-tap-row
                            className={`w-full text-left px-[var(--kin-kc-6)] py-[var(--kin-kc-6)] min-h-[var(--kin-cham-toi-thieu)] border-b border-[var(--kin-vien-nhat)] hover:bg-[var(--kin-nen-re-chuot)] transition-colors ${on ? "bg-[var(--kin-nen-dang-chon)]" : ""}`}>
                            <span className="block text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)] break-words">{i.title}</span>
                            <span className="mt-1 block text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{i.sub}</span>
                            <KinStatus tone={i.statusTone} className="mt-1.5">{i.statusLabel}</KinStatus>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  </KinPanel>
                </section>
              ))}
            </div>
            <div id="bt-detail" className="min-w-0 scroll-mt-20">
              {active ? <Detail key={keyOf(active)} item={active} onGraded={() => { setSelKey(keyOf(active)); load(); }} /> : shown.length > 0 && (
                <KinCallout>Chọn một bài ở danh sách để xem bài nộp và chấm điểm.</KinCallout>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
