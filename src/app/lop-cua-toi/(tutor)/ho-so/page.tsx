// FE-145/146 — hồ sơ gia sư: sửa giới thiệu, môn dạy, ảnh đại diện; hiện trạng thái
// xác minh. Dùng được bởi gia sư đã duyệt và người đang có đơn (chờ duyệt / bị từ chối).
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { tutorApplicationStatus } from "@/lib/tutorProfile";
import TutorProfileForm from "./TutorProfileForm";
import PublicProfilePreview from "@/components/tutor/PublicProfilePreview";

export const dynamic = "force-dynamic";

export default async function HoSoGiaSuPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?redirect=/lop-cua-toi/ho-so");
  const u = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, bio: true, subjects: true, adminRole: true, tutorAppliedAt: true, tutorVerified: true, tutorVerifiedAt: true, tutorRejectedAt: true, tutorRejectReason: true, profileLockedAt: true },
  });
  if (!u || (u.adminRole !== "teacher" && !u.tutorAppliedAt)) redirect("/lop-cua-toi");
  const status = u.adminRole === "teacher" ? "approved" : tutorApplicationStatus(u);

  return (
    <div style={{ background: "var(--kin-nen-trang)", minHeight: "100vh" }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link href="/lop-cua-toi" className="text-sm hover:underline" style={{ color: "var(--kin-chu-phu)" }}>← Lớp của tôi</Link>
        <h1 className="mt-2 text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Hồ sơ gia sư</h1>
        <p className="text-caption mt-1 mb-5" style={{ color: "var(--kin-chu-phu)" }}>{u.name}</p>

        {status === "pending" && (
          <div role="status" className="rounded-xl p-4 mb-5 text-sm" style={{ background: "var(--kin-tt-cham-cho)", color: "var(--kin-chu-chinh)", border: "1px solid var(--kin-vien-thuong)" }}>
            <b>Hồ sơ đang chờ duyệt.</b> Một số tính năng bị giới hạn cho tới khi hồ sơ được xác minh. Bạn vẫn có thể cập nhật giới thiệu và môn dạy.
          </div>
        )}
        {status === "rejected" && (
          <div role="alert" className="rounded-xl p-4 mb-5 text-sm" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-tt-chu-loi)", color: "var(--kin-chu-chinh)" }}>
            <b style={{ color: "var(--kin-tt-chu-loi)" }}>Hồ sơ chưa được duyệt.</b>
            {u.tutorRejectReason && <> Lý do: {u.tutorRejectReason}</>}
            <br />Bạn có thể cập nhật giới thiệu và môn dạy; hãy liên hệ quản trị viên để được xem xét lại.
          </div>
        )}
        {status === "approved" && (
          <p className="mb-5 text-sm inline-flex items-center gap-2" style={{ color: "var(--kin-tt-chu-xong)" }}>
            <span aria-hidden className="w-2 h-2 rounded-full inline-block" style={{ background: "var(--kin-tt-cham-xong)" }} />
            <b>Đã xác minh</b>{u.tutorVerifiedAt && <span style={{ color: "var(--kin-chu-phu)" }}>từ {u.tutorVerifiedAt.toLocaleDateString("vi-VN")}</span>}
            {" · "}<Link href={`/mentor/${u.id}`} className="underline" style={{ color: "var(--kin-th-xanh-link)" }}>Xem hồ sơ công khai</Link>
          </p>
        )}

        {status === "approved" && <PublicProfilePreview tutorId={u.id} reason={u.profileLockedAt ? "bi-khoa" : u.tutorVerified ? null : "chua-duyet"} />}
        {status !== "approved" && <PublicProfilePreview tutorId={u.id} reason="chua-duyet" />}

        <TutorProfileForm initialBio={u.bio ?? ""} initialSubjects={u.subjects} />
      </div>
    </div>
  );
}
