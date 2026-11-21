// SCL-G-GS (21/11/2026, QUYET-DINH-GIAO-DIEN §3.4, khung Figma 733:2 và 730:2) — HỘP VIỆC dạy học của gia sư: gom MỌI lớp mình làm chủ (Chủ nhiệm: mọi lớp).
// Máy tính: mỗi lớp một nhóm hàng KinListRow "Bài chờ chấm N · Điểm chờ duyệt N · Xin vào lớp N · Buổi tới chưa có video", bấm hàng mở đúng chỗ xử lý (sổ điểm, tab Học sinh, trang lớp).
// Điện thoại: xử lý NGAY tại đây — duyệt điểm chờ, chấm từng bài, nhận / từ chối học sinh xin vào lớp — bằng đúng các form POST + 303 sẵn có (kèm ve=hop-viec).
// Không theo cờ HOP_VIEC (cờ đó là Hộp việc cũ có học phí ở /lop-cua-toi). Không đổi API, không đổi schema.
import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { loadClassTodos, loadInboxItems, loadRailClasses } from "@/lib/lopViecServer";
import { hasAnyTodo, inboxSummary, todoTotal } from "@/lib/lopViec";
import { classBase } from "@/lib/tutorClassRoutes";
import { SO_DIEM_MESSAGE } from "@/lib/soDiem";
import { duyetMessage } from "@/components/tutor/quan-lop/duyetMessage";
import { fmtScore } from "@/lib/studentTodo";
import { dayAt } from "@/lib/baiTap";
import { KinPage, KinPageHeader } from "@/components/kin/PageLayout";
import { KinListRow } from "@/components/kin/ListRow";
import { KinPanel } from "@/components/kin/Panel";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinStatus, KinGradeStatus } from "@/components/kin/Status";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { ChamBaiHang, ChamDock, HoiLaiGui } from "@/components/tutor/hop-viec/HopViecDong";

export const dynamic = "force-dynamic";
const PATH = "/lop-cua-toi/hop-viec";
const soDiem = (id: string) => `/lop-cua-toi/so-diem?lop=${encodeURIComponent(id)}`;

function MucHead({ title, n }: { title: string; n: number }) {
  return <h2 className="mt-8 mb-3 flex items-baseline justify-between text-[length:var(--kin-co-tieu-de)] font-semibold text-[var(--kin-chu-chinh)]">{title}<span className="text-[length:var(--kin-co-goc)] font-normal text-[var(--kin-chu-phu)] tabular-nums">{n}</span></h2>;
}

export default async function HopViecPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await redirectIfNotTutor(await getSession(), { path: PATH, allowAdmin: true, adminTo: "/admin" });
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const n = one("n");
  const ghi = SO_DIEM_MESSAGE[one("ghi") ?? ""] ?? null;
  const duyet = duyetMessage(one("duyet"), n && /^\d{1,3}$/.test(n) ? Number(n) : null);
  const msg = ghi ? { tone: one("ghi") === "diem-sai" ? "err" : "ok", text: ghi } : duyet;

  let data: { classes: Awaited<ReturnType<typeof loadRailClasses>>; todos: Awaited<ReturnType<typeof loadClassTodos>>; items: Awaited<ReturnType<typeof loadInboxItems>> } | null = null;
  try {
    const classes = (await loadRailClasses(session)).filter(c => c.owned);
    const ids = classes.map(c => c.id);
    const [todos, items] = await Promise.all([loadClassTodos(ids, new Date(), session.userId), loadInboxItems(ids, session.userId)]);
    data = { classes, todos, items };
  } catch { data = null; }

  // Nút chính "+ Giao bài" cùng chỗ với trang lớp (góc phải đầu trang). Điện thoại: nút chính là dock "Chấm N bài" nên ẩn nút này (mỗi màn một nút chính).
  const giao = <div className="hidden md:block"><Link href="/lop-cua-toi/bai-tap/giao" data-giao-bai className={kinButtonClass("primary")}>+ Giao bài</Link></div>;
  if (!data) {
    return (
      <KinPage>
        <KinPageHeader title="Hộp việc" sub="Việc cần bạn xử lý ở các lớp" actions={giao} />
        <KinCallout title="Chưa tải được Hộp việc"><Link href={PATH} className={`${kinButtonClass("secondary")} mt-3`}>Thử lại</Link></KinCallout>
      </KinPage>
    );
  }
  const { classes, todos, items } = data;
  const list = classes.map(c => ({ c, t: todos.get(c.id)! }));
  const busy = list.filter(x => hasAnyTodo(x.t));
  const idle = list.filter(x => !hasAnyTodo(x.t));
  const total = list.reduce((a, x) => a + todoTotal(x.t), 0);

  return (
    <KinPage className="pb-[160px] md:pb-10">
      <KinPageHeader title="Hộp việc" sub={inboxSummary(list.map(x => x.t))} actions={giao} />
      {msg && <div role={msg.tone === "err" ? "alert" : "status"} data-hop-viec-ghi><KinCallout title={msg.text} className="mb-6" /></div>}

      {classes.length === 0 ? (
        <KinEmptyState title="Bạn chưa có lớp nào" action={<Link href="/lop-cua-toi/lop/tao" className={kinButtonClass("secondary")}>Tạo lớp mới</Link>}>Hộp việc gom bài chờ chấm, điểm chờ duyệt và học sinh xin vào lớp của mọi lớp bạn dạy.</KinEmptyState>
      ) : (
        <>
          {/* Máy tính: theo lớp. */}
          <div data-hop-viec-mt className="hidden md:block max-w-[960px]">
            {busy.length === 0 && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Các lớp của bạn chưa có việc nào cần xử lý. Bài nộp mới, điểm chờ duyệt và học sinh xin vào lớp sẽ hiện ở đây.</p>}
            {busy.map(({ c, t }) => (
              <section key={c.id} aria-label={c.name} data-hop-viec-lop={c.id} className="mt-4 first:mt-0">
                <KinPanel flush>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-[var(--kin-kc-6)] min-h-14 border-b border-[var(--kin-vien-nhat)] bg-[var(--kin-nen-bang)]">
                    <span aria-hidden className="size-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                    <h2 className="font-semibold text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{c.name}</h2>
                    <span className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">{c.students} học sinh</span>
                    <Link href={classBase(c.id)} className={`ml-auto ${kinButtonClass("ghost")}`} aria-label={`Mở lớp ${c.name}`}>Mở lớp</Link>
                  </div>
                  <ul>
                    {t.choCham > 0 && <li><KinListRow size="lg" href={soDiem(c.id)} title="Bài chờ chấm" sub={`${t.choCham} bài học sinh đã nộp, chưa có điểm`} aside={<KinGradeStatus state="cho-cham">Chờ chấm {t.choCham}</KinGradeStatus>} /></li>}
                    {t.choDuyet > 0 && <li><KinListRow size="lg" href={soDiem(c.id)} title="Điểm chờ duyệt" sub={`${t.choDuyet} điểm tự khai cần bạn xác nhận`} aside={<KinGradeStatus state="cho-duyet">Chờ duyệt {t.choDuyet}</KinGradeStatus>} /></li>}
                    {t.xinVao > 0 && <li><KinListRow size="lg" href={`${classBase(c.id)}/hoc-vien?muc=xin-vao`} title="Xin vào lớp" sub={`${t.xinVao} học sinh đang chờ bạn nhận`} aside={<KinStatus tone="cho" shape="chua">Chờ nhận {t.xinVao}</KinStatus>} /></li>}
                    {t.nextNoVideo && <li><KinListRow size="lg" href={classBase(c.id)} title="Buổi tới chưa có video" sub={`${t.nextNoVideo.title} · ngày ${t.nextNoVideo.dateKey.slice(8, 10)}/${t.nextNoVideo.dateKey.slice(5, 7)}`} aside={<KinStatus tone="mo">Chưa có video</KinStatus>} /></li>}
                  </ul>
                </KinPanel>
              </section>
            ))}
            {idle.length > 0 && <p data-hop-viec-trong className="mt-6 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">{idle.map(x => x.c.name).join(", ")} không có việc nào cần xử lý.</p>}
          </div>

          {/* Điện thoại: xử lý tại chỗ. */}
          <div data-hop-viec-dt className="md:hidden">
            {total === 0 && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Chưa có việc nào cần xử lý. Bài nộp mới, điểm chờ duyệt và học sinh xin vào lớp sẽ hiện ở đây.</p>}
            {items.approve.length > 0 && (
              <section aria-labelledby="hv-duyet">
                <div id="hv-duyet"><MucHead title="Điểm chờ duyệt" n={items.approve.length} /></div>
                <KinPanel flush><ul>
                  {items.approve.map(a => (
                    <li key={a.resultId}>
                      <KinListRow size="lg" title={`${a.studentName} · ${fmtScore(a.score)}/${fmtScore(a.totalPoints)}`} sub={`${a.courseName} · ${a.title}`}
                        aside={<form method="post" action="/api/tutor/so-diem/duyet" data-duyet-ok>
                          <input type="hidden" name="resultId" value={a.resultId} /><input type="hidden" name="ve" value="hop-viec" />
                          <button type="submit" name="action" value="duyet" aria-label={`Duyệt điểm của ${a.studentName}`} className={kinButtonClass("secondary")}>Duyệt</button>
                        </form>} />
                    </li>
                  ))}
                </ul></KinPanel>
                <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Sửa hoặc từ chối điểm ở <Link href={soDiem(items.approve[0].courseId)} className="text-[var(--kin-nhan-link)] underline inline-flex min-h-11 items-center">sổ điểm</Link>.</p>
              </section>
            )}
            {items.grade.length > 0 && (
              <section aria-labelledby="hv-cham">
                <div id="hv-cham"><MucHead title="Bài chờ chấm" n={items.grade.length} /></div>
                <KinPanel flush>
                  {items.grade.map(g => <ChamBaiHang key={g.submissionId} submissionId={g.submissionId} assignmentId={g.assignmentId} maxPoints={g.maxPoints} fileUrl={g.fileUrl} kind={g.kind}
                    title={`${g.studentName} · ${g.title}`} sub={`${g.courseName} · nộp ${dayAt(g.submittedAt)}`} />)}
                </KinPanel>
              </section>
            )}
            {items.join.length > 0 && (
              <section aria-labelledby="hv-vao">
                <div id="hv-vao"><MucHead title="Xin vào lớp" n={items.join.length} /></div>
                <KinPanel flush><ul>
                  {items.join.map(j => {
                    const base = `/api/tutor/lop/${encodeURIComponent(j.courseId)}/yeu-cau/${encodeURIComponent(j.id)}`;
                    return (
                      <li key={j.id} data-xin-vao className="border-b border-[var(--kin-vien-nhat)] px-[var(--kin-kc-6)] py-[var(--kin-kc-4)]">
                        <p className="font-medium text-[length:var(--kin-co-body)] leading-6 text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{j.studentName}</p>
                        <p className="mt-0.5 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)] [overflow-wrap:anywhere]">Xin vào {j.courseName} · {dayAt(j.createdAt)}</p>
                        <div className="mt-3 flex flex-wrap gap-3">
                          <form method="post" action={`${base}/duyet`}><input type="hidden" name="ve" value="hop-viec" />
                            <button type="submit" aria-label={`Nhận ${j.studentName} vào lớp`} className={kinButtonClass("secondary")}>Nhận</button></form>
                          <form method="post" action={`${base}/tu-choi`}><input type="hidden" name="ve" value="hop-viec" />
                            <HoiLaiGui label="Từ chối" aria={`Từ chối ${j.studentName}`} title="Từ chối học sinh này?" confirmLabel="Từ chối" message="Học sinh sẽ không vào lớp. Em có thể xin lại bằng mã lớp." /></form>
                        </div>
                      </li>
                    );
                  })}
                </ul></KinPanel>
              </section>
            )}
          </div>
          {items.grade.length > 0 && <ChamDock n={items.grade.length} />}
        </>
      )}
    </KinPage>
  );
}
