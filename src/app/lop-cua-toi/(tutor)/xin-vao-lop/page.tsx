// SCL P2-20 (21/11/2026) — hàng chờ "Xin vào lớp" GỘP mọi lớp của gia sư (bảng class_join_requests sẵn có). Duyệt / từ chối dùng đúng biểu mẫu POST + 303 của từng lớp
// (JoinRequests), kèm ve=hang-cho để quay lại trang này. Chỉ lớp gia sư là chủ; tên học sinh chỉ hiện với chủ lớp.
import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { loadOwnerJoinQueue, JOIN_QUEUE_PATH } from "@/lib/enrollServer";
import { vnDateKeyOf } from "@/lib/classSessions";
import JoinRequests from "@/components/tutor/JoinRequests";
import { KinPage, KinPageHeader } from "@/components/kin/PageLayout";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { duyetMessage } from "@/components/tutor/quan-lop/duyetMessage";

export const dynamic = "force-dynamic";

export default async function XinVaoLopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await redirectIfNotTutor(await getSession(), { path: JOIN_QUEUE_PATH });
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : null);
  const n = one("n");
  const toast = duyetMessage(one("duyet"), n && /^\d{1,3}$/.test(n) ? Number(n) : null);

  let groups: Awaited<ReturnType<typeof loadOwnerJoinQueue>> | null = null;
  try { groups = await loadOwnerJoinQueue(session.userId); } catch { groups = null; }
  const total = groups?.reduce((a, g) => a + g.items.length, 0) ?? 0;

  return (
    <KinPage>
      <KinPageHeader title={groups ? `Xin vào lớp (${total})` : "Xin vào lớp"} sub="Học sinh dùng mã hoặc link mời của bạn sẽ chờ ở đây. Bạn duyệt thì em vào lớp ngay." />
      {toast && <div role={toast.tone === "err" ? "alert" : "status"} data-duyet-toast={one("duyet") ?? ""}><KinCallout title={toast.text} className="mb-6" /></div>}
      {groups === null ? (
        <KinCallout title="Chưa tải được hàng chờ">
          <Link href={JOIN_QUEUE_PATH} className={`${kinButtonClass("secondary")} mt-3`}>Thử lại</Link>
        </KinCallout>
      ) : groups.length === 0 ? (
        <KinEmptyState title="Chưa có ai xin vào lớp" action={<Link href="/lop-cua-toi/lop" className={kinButtonClass("secondary")}>Xem các lớp của bạn</Link>}>
          Khi học sinh nhập mã lớp hoặc mở link mời, yêu cầu của em hiện ở đây.
        </KinEmptyState>
      ) : (
        <div data-join-queue className="max-w-3xl">
          {groups.map(g => (
            <JoinRequests key={g.courseId} courseId={g.courseId} title={g.courseName} back="hang-cho" failed={false} retryHref={JOIN_QUEUE_PATH} show
              items={g.items.map(r => { const k = vnDateKeyOf(r.createdAt); return { id: r.id, studentName: r.studentName, sentOn: `${k.slice(8, 10)}/${k.slice(5, 7)}` }; })} />
          ))}
        </div>
      )}
    </KinPage>
  );
}
