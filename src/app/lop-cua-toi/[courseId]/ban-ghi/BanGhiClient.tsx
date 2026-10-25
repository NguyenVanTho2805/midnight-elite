"use client";
// Giao diện trang Bản ghi của lớp (xem page.tsx). Hành động ghi là <form method="post"> thường → API trả 303 về đây.
import Link from "next/link";
import { useRef } from "react";
import { KinPage, KinPageHeader, KinTwoCol, KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinListRow } from "@/components/kin/ListRow";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinPanel } from "@/components/kin/Panel";
import { KinStatus } from "@/components/kin/Status";
import { kinButtonClass } from "@/components/kin/Button";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { COPYRIGHT_NOTICE, COPYRIGHT_PLEDGE_LABEL, WATCH_LABEL, type WatchState } from "@/lib/classRecordings";

interface Rec { id: string; title: string; url: string; kind: string; sessionId: string | null; createdAt: string }
interface Props {
  courseId: string; courseName: string; isOwner: boolean;
  flash: { ok: boolean; removed: boolean; error: string };
  preselectSession: string;
  bySession: { session: { id: string; dateKey: string }; recordings: Rec[] }[];
  unattached: Rec[];
  studentCount: number;
  watch: { videoCount: number; lessons: { id: string; title: string; xong: number; dangXem: number; chua: number }[]; students: { id: string; name: string; cells: Record<string, WatchState>; xong: number }[] };
}

const KIND_LABEL: Record<string, string> = { youtube: "YouTube", vimeo: "Vimeo", drive: "Google Drive", zoom_record: "Zoom cloud" };
const dmy = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;
const TONE: Record<WatchState, "xong" | "cho" | "mo"> = { xong: "xong", "dang-xem": "cho", chua: "mo" };

export default function BanGhiClient(p: Props) {
  const { ask, dialog } = useKinConfirm();
  const formRef = useRef<HTMLFormElement>(null);
  const base = `/api/courses/${encodeURIComponent(p.courseId)}/recordings`;

  const recRow = (r: Rec) => (
    <div key={r.id} data-recording-row className="flex items-start justify-between gap-3 border-b border-[var(--kin-vien-nhat)] px-[var(--kin-kc-6)] py-[var(--kin-kc-6)]">
      <div className="min-w-0 flex-1">
        <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] break-words">{r.title}</p>
        <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{KIND_LABEL[r.kind] ?? "Liên kết ngoài"} · link do cô dán, KiN không lưu tệp</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
        <a href={r.url} target="_blank" rel="noopener noreferrer" className={kinButtonClass("secondary")}>Mở</a>
        {p.isOwner && (
          <form method="post" action={`${base}/${r.id}/delete`} onSubmit={async e => {
            e.preventDefault();
            const f = e.currentTarget;
            if (await ask({ title: "Gỡ bản ghi này khỏi lớp?", message: "Chỉ gỡ link khỏi KiN; video trên YouTube/Drive vẫn còn nguyên.", confirmLabel: "Gỡ" })) f.submit();
          }}>
            <button type="submit" className={kinButtonClass("danger")}>Gỡ</button>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <KinPage>
      <KinPageHeader title="Bản ghi của lớp" sub={p.courseName} back={{ href: `/lop-cua-toi/${p.courseId}`, label: "← Về lớp" }} />
      {p.flash.ok && <div role="status" className="mb-4"><KinCallout tone="nhan">Đã lưu bản ghi vào lớp.</KinCallout></div>}
      {p.flash.removed && <div role="status" className="mb-4"><KinCallout>Đã gỡ bản ghi khỏi lớp.</KinCallout></div>}
      {p.flash.error && <div role="alert" className="mb-4"><KinPanel variant="loi"><p className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{p.flash.error}</p></KinPanel></div>}

      <KinTwoCol>
        <div className="min-w-0 space-y-8">
          <section aria-label="Bản ghi theo buổi">
            <KinSectionHead title="Theo buổi học" aside={`${p.bySession.length} buổi`} />
            {p.bySession.length === 0 && p.unattached.length === 0 ? (
              <KinEmptyState title="Lớp chưa có buổi nào">Khi bạn điểm danh một buổi, buổi đó sẽ hiện ở đây để gắn bản ghi.</KinEmptyState>
            ) : p.bySession.map(g => (
              <div key={g.session.id} data-session-block={g.session.id}>
                <KinListRow title={`Buổi ${dmy(g.session.dateKey)}`}
                  status={g.recordings.length === 0 ? <KinStatus tone="mo">Chưa có bản ghi</KinStatus> : <KinStatus tone="xong">{g.recordings.length} bản ghi</KinStatus>}
                  trailing={p.isOwner ? <Link href={`/lop-cua-toi/${p.courseId}/ban-ghi?buoi=${g.session.id}#dan-link`} className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Dán bản ghi</Link> : undefined} />
                {g.recordings.map(recRow)}
              </div>
            ))}
          </section>
          {p.unattached.length > 0 && (
            <section aria-label="Bản ghi chưa gắn buổi">
              <KinSectionHead title="Chưa gắn buổi nào" aside={`${p.unattached.length} bản ghi`} />
              {p.unattached.map(recRow)}
            </section>
          )}
        </div>

        <aside className="min-w-0 space-y-8">
          {p.isOwner ? (
            <section id="dan-link" aria-label="Dán link bản ghi">
              <KinSectionHead title="Dán link bản ghi" />
              <form ref={formRef} method="post" action={base} className="pt-4 space-y-4">
                <div>
                  <label htmlFor="rec-title" className={KIN_LABEL}>Tên bản ghi</label>
                  <input id="rec-title" name="title" required maxLength={120} placeholder="Bản ghi buổi 16/10" className={`${KIN_FIELD} mt-2`} />
                </div>
                <div>
                  <label htmlFor="rec-url" className={KIN_LABEL}>Link (YouTube, Google Drive, Vimeo hoặc Zoom cloud)</label>
                  <input id="rec-url" name="url" required inputMode="url" autoComplete="off" placeholder="https://" className={`${KIN_FIELD} mt-2`} />
                </div>
                <div>
                  <label htmlFor="rec-session" className={KIN_LABEL}>Gắn vào buổi</label>
                  <select id="rec-session" name="sessionId" defaultValue={p.bySession.some(g => g.session.id === p.preselectSession) ? p.preselectSession : ""} className={`${KIN_FIELD} mt-2`}>
                    <option value="">Chưa gắn buổi nào</option>
                    {p.bySession.map(g => <option key={g.session.id} value={g.session.id}>Buổi {dmy(g.session.dateKey)}</option>)}
                  </select>
                </div>
                <label className="flex items-start gap-3 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)] min-h-11">
                  <input type="checkbox" name="pledge" required className="mt-1 h-5 w-5 flex-shrink-0" />
                  <span>{COPYRIGHT_PLEDGE_LABEL}</span>
                </label>
                <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{COPYRIGHT_NOTICE}</p>
                <button type="submit" className={kinButtonClass("primary")}>Lưu bản ghi</button>
              </form>
            </section>
          ) : (
            <KinCallout title="Bạn đang xem lớp với vai quản trị">Chỉ gia sư của lớp dán hoặc gỡ được bản ghi.</KinCallout>
          )}
          <KinCallout>Bản ghi là link ngoài: KiN không phát lại và không biết ai đã mở. Bảng bên dưới chỉ tính video đăng thành bài giảng.</KinCallout>
        </aside>
      </KinTwoCol>

      <section aria-label="Ai đã xem video bài giảng" className="mt-10" data-watch-table>
        <KinSectionHead title="Ai đã xem video bài giảng" aside={`${p.watch.videoCount} video · ${p.studentCount} học sinh`} />
        {p.watch.videoCount === 0 ? (
          <KinEmptyState title="Lớp chưa có video bài giảng">Khi bạn đăng bài giảng có link video, bảng ai đã xem sẽ hiện ở đây.</KinEmptyState>
        ) : p.studentCount === 0 ? (
          <KinEmptyState title="Lớp chưa có học sinh">Khi có học sinh vào lớp, bạn sẽ thấy em nào đã xem xong, đang xem hoặc chưa xem.</KinEmptyState>
        ) : (
          <>
            <ul className="pt-2">
              {p.watch.lessons.map(l => (
                <li key={l.id} data-watch-lesson={l.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[var(--kin-vien-nhat)] px-[var(--kin-kc-6)] py-[var(--kin-kc-5)] text-[length:var(--kin-co-goc)]">
                  <span className="text-[var(--kin-chu-chinh)] min-w-0 break-words">{l.title}</span>
                  <span className="text-[var(--kin-chu-mo)] tabular-nums">Đã xem xong {l.xong} · Đang xem {l.dangXem} · Chưa xem {l.chua}</span>
                </li>
              ))}
            </ul>
            {p.isOwner ? (
              <div className="mt-6 overflow-x-auto" data-watch-students>
                <table className="w-full text-left text-[length:var(--kin-co-goc)]">
                  <caption className="sr-only">Từng học sinh và từng video</caption>
                  <thead><tr className="bg-[var(--kin-nen-bang)] text-[var(--kin-chu-mo)]">
                    <th scope="col" className="px-[var(--kin-kc-6)] min-h-11 font-normal">Học sinh</th>
                    {p.watch.lessons.map(l => <th scope="col" key={l.id} className="px-[var(--kin-kc-4)] font-normal min-w-32">{l.title}</th>)}
                  </tr></thead>
                  <tbody>
                    {p.watch.students.map(s => (
                      <tr key={s.id} data-watch-student={s.id} className="border-b border-[var(--kin-vien-nhat)]">
                        <th scope="row" className="px-[var(--kin-kc-6)] py-[var(--kin-kc-5)] font-normal text-[var(--kin-chu-chinh)] min-w-40">{s.name}<span className="block text-[var(--kin-chu-mo)] tabular-nums">{s.xong}/{p.watch.videoCount} video</span></th>
                        {p.watch.lessons.map(l => <td key={l.id} className="px-[var(--kin-kc-4)]"><KinStatus tone={TONE[s.cells[l.id]]}>{WATCH_LABEL[s.cells[l.id]]}</KinStatus></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">&ldquo;Đã xem xong&rdquo; là em tự bấm đánh dấu xong hoặc xem gần hết video. Em mở video ở nơi khác thì KiN không biết.</p>
              </div>
            ) : (
              <p className="mt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Tên và tiến độ từng em chỉ hiện cho gia sư của lớp.</p>
            )}
          </>
        )}
      </section>
      {dialog}
    </KinPage>
  );
}
