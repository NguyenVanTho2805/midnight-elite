// BU-02 — "Thư viện của tôi" (/thu-vien, nhánh gia sư; Figma 504:6046 / 299:113561 chưa đối chiếu). Thay TutorLibrary: tài liệu dùng lại giữa các lớp.
// Nguồn (tutorLibraryServer.loadTutorLibrary, mục 4.4): (1) mọi tài liệu trong bài của lớp mình, gộp theo URL ⇒ "đang dùng ở n lớp"; (2) tệp đã tải lên KiN mà chưa bài nào dùng;
// (3) đề gốc (chỉ xem). Thao tác: tìm, lọc loại và lớp, "Dùng ở lớp khác" (G2 với from:"library"), "Gỡ khỏi bài này" (G3), "Xoá tệp" chưa gắn (A5).
// Không có số liệu học sinh ở đây. Học phí/tiền: không có.
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinPage, KinPageHeader, KIN_FIELD, KIN_TABLE_HEAD, KIN_TABLE_ROW } from "@/components/kin/PageLayout";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinStateCard } from "@/components/kin/StateCard";
import { KinStatus } from "@/components/kin/Status";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { viewerHref } from "@/lib/library";
import { formatMegabytes } from "@/lib/mediaStorage";
import { contentHref, giaoTrinhHref } from "@/lib/tutorRoutes";
import { jfetch } from "@/components/tutor/studentUi";
import { itemKey, type LibUse, type TutorLibrary } from "@/lib/giaoTrinh";
import type { DocType } from "@/lib/mediaLink";

export interface TvCourse { id: string; name: string; chapters: { id: string; title: string; lessons: { id: string; title: string }[] }[] }
/** `TutorLibrary` (src/lib/giaoTrinh.ts, do tut-code gộp) + cây lớp để chọn đích "Dùng ở lớp khác" + dung lượng kho. tutorLibraryServer.loadTutorLibrary phải trả đủ ba trường thêm này. */
export interface TutorLibraryView extends TutorLibrary { courses: TvCourse[]; usedBytes: number; quotaBytes: number }
type Kind = DocType | "link";
const kindOf = (t: DocType | "file"): Kind => (t === "file" ? "link" : t);

const KIND_LABEL: Record<Kind, string> = { pdf: "PDF", word: "Word", sheet: "Excel", slide: "PowerPoint", image: "Ảnh", text: "Văn bản", link: "Link" };
const FILTERS: { key: string; label: string; match: (k: Kind) => boolean }[] = [
  { key: "all", label: "Tất cả loại", match: () => true },
  { key: "pdf", label: "PDF", match: k => k === "pdf" },
  { key: "word", label: "Word", match: k => k === "word" || k === "text" },
  { key: "office", label: "Excel / PowerPoint", match: k => k === "sheet" || k === "slide" },
  { key: "image", label: "Ảnh", match: k => k === "image" },
  { key: "link", label: "Link", match: k => k === "link" },
];
const STORAGE_LABEL: Record<"link" | "kin" | "cloudinary_cu", string> = { link: "Link ngoài", kin: "Tệp trên KiN (riêng tư)", cloudinary_cu: "Tệp cũ (công khai)" };
const COLS = "md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,0.8fr)_minmax(0,1.4fr)_minmax(0,0.8fr)] md:gap-4";
const ACT = "inline-flex items-center min-h-11 text-[length:var(--kin-co-goc)] text-[var(--kin-nhan-link)] hover:underline";

type Group = "all" | "unattached" | "exam" | `c:${string}`;

/** Chọn lớp ▸ bài (hoặc bài mới) rồi thêm tài liệu vào đó bằng G2. */
function UseElsewhere({ courses, url, name, onDone, onCancel }: { courses: TvCourse[]; url: string; name: string; onDone: (msg: string) => void; onCancel: () => void }) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [lessonId, setLessonId] = useState<string>("new");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const course = courses.find(c => c.id === courseId);
  async function go() {
    if (!course || busy) return;
    setBusy(true); setErr(null);
    const body: Record<string, unknown> = { url, name, from: "library" };
    if (lessonId === "new") { const ch = course.chapters[0]?.id; if (ch) body.chapterId = ch; body.newLessonTitle = title.trim() || name.replace(/\.[A-Za-z0-9]{1,5}$/, "").slice(0, 120) || "Bài mới"; }
    else body.lessonId = lessonId;
    const r = await jfetch(`/api/tutor/lop/${course.id}/giao-trinh/muc`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (r.ok) onDone(r.json?.duplicate ? `Bài đó đã có “${name}” rồi, không thêm lần nữa.` : `Đã thêm “${name}” vào lớp ${course.name}.`);
    else setErr(r.json?.error ?? (r.status === 0 ? "Mất kết nối. Thử lại." : r.status === 403 ? "Bạn không có quyền với lớp hoặc tệp này." : "Chưa thêm được. Thử lại sau."));
  }
  if (courses.length === 0) return <p className="py-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Bạn chưa có lớp nào để thêm vào. <Link href="/lop-cua-toi/quan-lop?tao=1" className="underline text-[var(--kin-nhan-link)]">Tạo lớp</Link></p>;
  return (
    <div data-tv-dung-lop-khac className="mt-3 rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-bang)] p-4 space-y-3 md:col-span-4">
      <div>
        <label className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]" htmlFor={`tv-lop-${url}`}>Lớp</label>
        <select id={`tv-lop-${url}`} className={`${KIN_FIELD} mt-1`} value={courseId} onChange={e => { setCourseId(e.target.value); setLessonId("new"); }}>
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]" htmlFor={`tv-bai-${url}`}>Bài</label>
        <select id={`tv-bai-${url}`} className={`${KIN_FIELD} mt-1`} value={lessonId} onChange={e => setLessonId(e.target.value)}>
          <option value="new">Bài mới…</option>
          {course?.chapters.map(ch => <optgroup key={ch.id} label={ch.title}>{ch.lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</optgroup>)}
        </select>
      </div>
      {lessonId === "new" && (
        <div>
          <label className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]" htmlFor={`tv-ten-${url}`}>Tên bài mới (để trống thì lấy theo tên tài liệu)</label>
          <input id={`tv-ten-${url}`} className={`${KIN_FIELD} mt-1`} value={title} maxLength={120} onChange={e => setTitle(e.target.value)} />
        </div>
      )}
      {err && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <KinButton type="button" loading={busy} loadingLabel="Đang thêm…" onClick={() => void go()}>Thêm vào lớp này</KinButton>
        <KinButton type="button" variant="ghost" onClick={onCancel}>Bỏ</KinButton>
      </div>
    </div>
  );
}

export default function ThuVienCuaToi({ view }: { view: TutorLibraryView | null }) {
  const router = useRouter();
  const { ask, dialog } = useKinConfirm();
  const [group, setGroup] = useState<Group>("all");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const data = view;
  const classNames = useMemo(() => (data ? data.courses.filter(c => data.items.some(i => i.usedIn.some(u => u.courseId === c.id))) : []), [data]);
  if (!data) {
    return (
      <KinPage>
        <KinPageHeader title="Thư viện" />
        <div className="max-w-xl">
          <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được thư viện của bạn" status={<KinStatus tone="loi">Kết nối bị gián đoạn</KinStatus>}
            actions={<><KinButton type="button" onClick={() => router.refresh()}>Thử lại</KinButton><Link href="/lop-cua-toi/lop" className={kinButtonClass("secondary")}>Về danh sách lớp</Link></>}>
            Tài liệu của bạn vẫn còn nguyên. Thử lại sau ít giây.
          </KinStateCard>
        </div>
      </KinPage>
    );
  }

  const needle = q.trim().toLowerCase();
  const f = FILTERS.find(x => x.key === filter) ?? FILTERS[0];
  const items = data.items.filter(i => f.match(kindOf(i.docType)) && (!needle || `${i.name} ${i.usedIn.map(u => u.courseName).join(" ")}`.toLowerCase().includes(needle))
    && (group === "all" || (group.startsWith("c:") && i.usedIn.some(u => u.courseId === group.slice(2)))));
  const unattached = data.unattached.filter(i => f.match(kindOf(i.docType)) && (!needle || i.name.toLowerCase().includes(needle)));
  const exams = data.examFiles.filter(e => !needle || e.name.toLowerCase().includes(needle));
  const showItems = group === "all" || group.startsWith("c:");
  const showUnattached = group === "all" || group === "unattached";
  const showExams = group === "exam";
  const totalAll = data.items.length + data.unattached.length;
  const uploadHref = data.courses.length === 1 ? giaoTrinhHref(data.courses[0].id, true) : "/lop-cua-toi/lop";

  const subjectBtn = (active: boolean) => `w-full text-left min-h-11 flex items-center justify-between gap-2 text-[length:var(--kin-co-goc)] ${active ? "text-[var(--kin-nhan-link)] font-medium" : "text-[var(--kin-chu-mo)] hover:text-[var(--kin-chu-chinh)]"}`;
  const pick = (g: Group) => { setGroup(g); setOpen(null); };
  const done = (text: string) => { setOpen(null); setNote({ tone: "ok", text }); router.refresh(); };

  async function removeUse(u: LibUse, url: string) {
    const key = itemKey("document", url);
    if (!(await ask({ title: "Gỡ tài liệu khỏi bài này?", message: `Tài liệu sẽ không còn hiện ở bài “${u.lessonTitle}” của lớp ${u.courseName}. Tệp vẫn còn trong thư viện của bạn.`, confirmLabel: "Gỡ khỏi bài" }))) return;
    setBusy(`g:${u.lessonId}:${key}`); setNote(null);
    const r = await jfetch(`/api/tutor/lop/${u.courseId}/giao-trinh/muc`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ lessonId: u.lessonId, key }) });
    setBusy(null);
    if (r.ok) done("Đã gỡ khỏi bài."); else setNote({ tone: "err", text: r.json?.error ?? "Chưa gỡ được. Thử lại sau." });
  }
  async function deleteAsset(a: TutorLibraryView["unattached"][number]) {
    if (!(await ask({ title: `Xoá tệp “${a.name}”?`, message: "Tệp này chưa dùng ở bài nào. Xoá xong không lấy lại được.", confirmLabel: "Xoá tệp" }))) return;
    setBusy(`x:${a.id}`); setNote(null);
    const r = await jfetch(`/api/media/document/${a.id}`, { method: "DELETE" });
    setBusy(null);
    if (r.ok) done("Đã xoá tệp."); else setNote({ tone: "err", text: r.json?.error ?? "Chưa xoá được." });
  }

  const nothing = totalAll === 0 && data.examFiles.length === 0;

  return (
    <KinPage>
      <KinPageHeader title="Thư viện" sub="Tài liệu của cô, dùng lại giữa các lớp. Mỗi tài liệu chỉ nằm một chỗ, bài nào cần thì thêm vào."
        actions={<Link href={uploadHref} className={kinButtonClass("primary")}>↑ Tải tài liệu</Link>} />

      {note && <p role={note.tone === "err" ? "alert" : "status"} data-tv-thong-bao className={`mb-4 text-[length:var(--kin-co-goc)] ${note.tone === "err" ? "text-[var(--kin-tt-chu-loi)]" : "text-[var(--kin-chu-chinh)]"}`}>{note.text}</p>}

      {nothing ? (
        <KinEmptyState title="Chưa có tài liệu" action={<Link href={uploadHref} className={kinButtonClass("primary")}>Thêm ở Giáo trình</Link>}>
          Thêm ở Giáo trình của một lớp: tài liệu sẽ hiện ở đây để dùng lại cho các lớp khác.
        </KinEmptyState>
      ) : (
        <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-x-[var(--kin-cach-cot)] gap-y-[var(--kin-cach-muc)] items-start">
          <nav aria-label="Nhóm tài liệu" className="min-w-0">
            <KinSectionHead title="Truy cập nhanh" as="h2" />
            <ul className="mt-2 mb-6">
              <li><button type="button" aria-pressed={group === "all"} onClick={() => pick("all")} className={subjectBtn(group === "all")}><span>Tất cả</span><span className="tabular-nums">{totalAll}</span></button></li>
              <li><button type="button" aria-pressed={group === "unattached"} onClick={() => pick("unattached")} className={subjectBtn(group === "unattached")}><span>Chưa gắn vào bài</span><span className="tabular-nums">{data.unattached.length}</span></button></li>
              <li><button type="button" aria-pressed={group === "exam"} onClick={() => pick("exam")} className={subjectBtn(group === "exam")}><span>Đề gốc</span><span className="tabular-nums">{data.examFiles.length}</span></button></li>
            </ul>
            {classNames.length > 0 && (<>
              <KinSectionHead title="Theo lớp" as="h2" />
              <ul className="mt-2">
                {classNames.map(c => (
                  <li key={c.id}><button type="button" aria-pressed={group === `c:${c.id}`} onClick={() => pick(`c:${c.id}`)} className={subjectBtn(group === `c:${c.id}`)}><span className="truncate">{c.name}</span></button></li>
                ))}
              </ul>
            </>)}
          </nav>

          <div className="min-w-0">
            <div className="grid sm:grid-cols-[minmax(0,1fr)_220px] gap-3">
              <div>
                <label htmlFor="tv-q" className="block mb-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Tìm tài liệu</label>
                <input id="tv-q" type="search" className={KIN_FIELD} value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm theo tên tài liệu hoặc lớp…" />
              </div>
              <div>
                <label htmlFor="tv-loai" className="block mb-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Loại</label>
                <select id="tv-loai" className={KIN_FIELD} value={filter} onChange={e => setFilter(e.target.value)}>{FILTERS.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}</select>
              </div>
            </div>

            {showExams && (
              <section aria-labelledby="tv-de" className="mt-6">
                <KinSectionHead id="tv-de" title="Đề gốc" aside={<Link href={contentHref(true, "/admin/thi-thu/ngan-hang-de-thi")} className="text-[var(--kin-nhan-link)] hover:underline">Mở Ngân hàng đề →</Link>} />
                {exams.length === 0 ? <KinEmptyState title="Chưa có đề gốc nào">Đề gốc tải lên ở Ngân hàng đề sẽ hiện ở đây để xem.</KinEmptyState> : (
                  <ul aria-label="Đề gốc" className="mt-2">
                    {exams.map(e => <li key={e.id} className={`flex justify-between gap-3 ${KIN_TABLE_ROW}`}><span className="min-w-0 break-words text-[var(--kin-chu-chinh)]">{e.name}</span><span className="text-[var(--kin-chu-mo)]"></span></li>)}
                  </ul>
                )}
              </section>
            )}

            {showItems && (
              <section aria-labelledby="tv-ds" className="mt-6">
                <h2 id="tv-ds" className="sr-only">Tài liệu trong bài</h2>
                {items.length === 0 ? (
                  <KinEmptyState title="Không có tài liệu nào khớp" action={<button type="button" onClick={() => { setQ(""); setFilter("all"); setGroup("all"); }} className={kinButtonClass("secondary")}>Xoá bộ lọc</button>}>Thử bỏ ô tìm hoặc chọn loại khác.</KinEmptyState>
                ) : (
                  <>
                    <div aria-hidden className={`hidden ${COLS} ${KIN_TABLE_HEAD}`}><span>Tên tài liệu</span><span>Loại</span><span>Đang dùng ở</span><span>Dung lượng</span></div>
                    <ul aria-label="Tài liệu" data-tv-ds>
                      {items.map(i => {
                        const where = [...new Set(i.usedIn.map(u => u.courseName))];
                        return (
                          <li key={i.url} data-tv-muc className={`${COLS} ${KIN_TABLE_ROW} max-md:flex max-md:flex-col max-md:items-stretch`}>
                            <div className="min-w-0">
                              <p className="text-[var(--kin-chu-chinh)] break-words">{i.name}</p>
                              <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">{STORAGE_LABEL[i.storage]}</p>
                            </div>
                            <p className="text-[var(--kin-chu-mo)]"><span className="md:hidden">Loại: </span>{KIND_LABEL[kindOf(i.docType)]}</p>
                            <p className="text-[var(--kin-chu-mo)] break-words" data-tv-dung-o><span className="md:hidden">Đang dùng ở: </span>{where.length ? `${where.length} lớp · ${where.join(", ")}` : "Chưa lớp nào"}</p>
                            <p className="text-[var(--kin-chu-mo)]"><span className="md:hidden">Dung lượng: </span>—</p>
                            <div className="md:col-span-4 flex flex-wrap gap-x-5 gap-y-0 md:mt-1">
                              <Link href={viewerHref(i.name, i.url)} target="_blank" rel="noopener noreferrer" className={ACT}>Xem</Link>
                              <button type="button" aria-expanded={open === i.url} onClick={() => setOpen(o => (o === i.url ? null : i.url))} className={ACT}>Dùng ở lớp khác</button>
                            </div>
                            {open === i.url && <UseElsewhere courses={data.courses} url={i.url} name={i.name} onDone={done} onCancel={() => setOpen(null)} />}
                            {i.usedIn.length > 0 && (
                              <ul aria-label={`Bài đang dùng ${i.name}`} className="md:col-span-4 flex flex-col">
                                {i.usedIn.map(u => (
                                  <li key={u.lessonId} className="flex flex-wrap items-center justify-between gap-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
                                    <span className="min-w-0 break-words">{u.courseName} · {u.lessonTitle}</span>
                                    <button type="button" disabled={busy === `g:${u.lessonId}:${itemKey("document", i.url)}`} onClick={() => void removeUse(u, i.url)} className={`${ACT} disabled:opacity-50`}>Gỡ khỏi bài này</button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </section>
            )}

            {showUnattached && (group === "unattached" || unattached.length > 0) && (
              <section aria-labelledby="tv-chua-gan" className="mt-8">
                <KinSectionHead id="tv-chua-gan" title="Chưa gắn vào bài" aside={`${unattached.length} tệp`} />
                {unattached.length === 0 ? <KinEmptyState title="Không có tệp nào chưa gắn">Tệp tải lên mà chưa dùng ở bài nào sẽ hiện ở đây để gắn hoặc xoá.</KinEmptyState> : (
                  <ul aria-label="Tệp chưa gắn vào bài" data-tv-chua-gan>
                    {unattached.map(a => (
                      <li key={a.id} className={`${KIN_TABLE_ROW} flex flex-col items-stretch gap-1`}>
                        <div className="flex justify-between gap-3"><span className="min-w-0 break-words text-[var(--kin-chu-chinh)]">{a.name}</span><span className="text-[var(--kin-chu-mo)]">{KIND_LABEL[kindOf(a.docType)]}{a.bytes ? ` · ${formatMegabytes(a.bytes)}` : ""}</span></div>
                        <div className="flex flex-wrap gap-x-5">
                          <button type="button" aria-expanded={open === a.id} onClick={() => setOpen(o => (o === a.id ? null : a.id))} className={ACT}>Gắn vào bài</button>
                          <button type="button" disabled={busy === `x:${a.id}`} onClick={() => void deleteAsset(a)} className={`${ACT} !text-[var(--kin-tt-chu-loi)] disabled:opacity-50`}>Xoá tệp</button>
                        </div>
                        {open === a.id && <UseElsewhere courses={data.courses} url={a.link} name={a.name} onDone={done} onCancel={() => setOpen(null)} />}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <p className="mt-6 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
              Kho tệp của bạn: đã dùng {formatMegabytes(data.usedBytes)} / {formatMegabytes(data.quotaBytes)}. Video là đường dẫn tới nơi cô đăng (YouTube, Drive…), KiN không lưu file video.
            </p>
          </div>
        </div>
      )}
      {dialog}
    </KinPage>
  );
}
