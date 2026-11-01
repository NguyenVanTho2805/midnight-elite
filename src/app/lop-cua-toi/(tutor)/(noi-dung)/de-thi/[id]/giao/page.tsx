// BU-03 — CHỖ GIỮ cho màn Giao đề (P3, vòng sau): tut-dev sẽ thay bằng GiaoDe.tsx. Có mặt để nút "Giao đề" ở trình soạn và ở Mã đề không dẫn tới 404.
import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { KinPage, KinPageHeader } from "@/components/kin/PageLayout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { kinButtonClass } from "@/components/kin/Button";

export const dynamic = "force-dynamic";

export default async function GiaoDePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await redirectIfNotTutor(await getSession(), { path: `/lop-cua-toi/de-thi/${id}/giao` });
  return (
    <KinPage>
      <KinPageHeader title="Giao đề" back={{ href: `/lop-cua-toi/de-thi/${id}`, label: "Về đề" }} />
      <KinEmptyState title="Màn Giao đề đang được hoàn thiện" action={<Link href={`/lop-cua-toi/de-thi/${id}`} className={kinButtonClass("primary")}>Về trình soạn đề</Link>}>
        Lớp, giờ làm, mật khẩu và cách hiển thị đáp án cô đặt tạm ở tab “Đáp án và phát hành” của trình soạn đề.
      </KinEmptyState>
    </KinPage>
  );
}
