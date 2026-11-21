// Học sinh của gia sư (Figma 299:113083). Chỉ gia sư; dữ liệu tải ở HocSinh qua /api/tutor/hoc-sinh.
// SCL P2-20: có yêu cầu xin vào lớp (mọi lớp) thì hiện lối "Xin vào lớp (n)" ở đầu trang, tới hàng chờ gộp.
import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { JOIN_QUEUE_PATH } from "@/lib/enrollServer";
import { kinButtonClass } from "@/components/kin/buttonClass";
import HocSinh from "@/components/tutor/HocSinh";

export const dynamic = "force-dynamic";

export default async function HocSinhPage() {
  const session = await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/hoc-sinh" });
  const pending = await prisma.classJoinRequest.count({ where: { status: "pending", course: { ownerId: session.userId } } }).catch(() => 0);
  return (
    <>
      {pending > 0 && (
        <div className="px-4 md:px-10 pt-6" data-join-queue-link>
          <Link href={JOIN_QUEUE_PATH} className={kinButtonClass("primary")}>Xin vào lớp ({pending})</Link>
        </div>
      )}
      <HocSinh />
    </>
  );
}
