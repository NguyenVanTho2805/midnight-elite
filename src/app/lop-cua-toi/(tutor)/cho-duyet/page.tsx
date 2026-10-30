// BU-00 bước 5 (31/10/2026) — "Trạng thái hồ sơ" của gia sư CHỜ DUYỆT (Figma Bản final 578:2, khung "Vai GIA SƯ — chờ duyệt (BU-00)" 599:237).
// Người vừa đăng ký gia sư vẫn là role student (không cột mới, không đổi JWT) nhưng có đơn đang chờ: trước đây họ rơi vào khu học sinh với một thẻ nhỏ
// "đang chờ duyệt" — không có việc gì để làm ở đó. Nay trang này là trang đầu của họ (src/lib/landing.ts), trong vỏ gia sư dạng chờ duyệt (TutorShell pending).
//   - đơn đang chờ: thẻ "Đang chờ duyệt · gửi dd/mm", môn đã khai, giới thiệu đã khai, nút Liên hệ hỗ trợ, liên kết Sửa hồ sơ / Đổi chủ đề màu;
//   - bị từ chối: thẻ "Bị từ chối" kèm lý do (nếu quản trị có ghi) — vỏ của họ là vỏ học sinh (họ là học sinh thường), nhưng trang vẫn mở để đọc lý do;
//   - gia sư đã duyệt / quản trị / học sinh chưa nộp đơn: không có gì để xem → về trang đầu của vai (307 qua redirect()).
// Đọc DB lỗi: KinEmptyState "Không tải được trạng thái hồ sơ" + Thử lại (trang máy chủ: thử lại = mở lại chính trang này).
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { landingPath } from "@/lib/landing";
import { tutorApplicationStatus } from "@/lib/tutorProfile";
import { isTeacher, TUTOR_HOME, TUTOR_PENDING_PATH } from "@/lib/tutorGate";
import { KinPage, KinPageHeader } from "@/components/kin/PageLayout";
import { KinStatus } from "@/components/kin/Status";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { kinButtonClass } from "@/components/kin/buttonClass"; // module thuần — trang máy chủ không gọi được hàm từ module "use client"

export const dynamic = "force-dynamic";

// Ghép tay "dd/mm": toLocaleDateString("vi-VN") ra "20-10" trên Node 26 (ICU 78) — dấu phân cách phụ thuộc ICU, không ổn định giữa các máy.
const fmtDay = (d: Date) => {
  const p = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" }).formatToParts(d);
  const get = (t: string) => p.find(x => x.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}`;
};

export default async function ChoDuyetPage() {
  const session = await getSession();
  if (!session) redirect(`/dang-nhap?redirect=${encodeURIComponent(TUTOR_PENDING_PATH)}`);
  if (isTeacher(session)) redirect(TUTOR_HOME);                 // đã là gia sư: không còn gì để chờ
  if (session.role !== "student") redirect(landingPath(session.role, session.adminRole)); // quản trị

  let u: { name: string; bio: string | null; subjects: string[]; tutorAppliedAt: Date | null; tutorVerified: boolean; tutorRejectedAt: Date | null; tutorRejectReason: string | null } | null = null;
  let failed = false;
  try {
    u = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, bio: true, subjects: true, tutorAppliedAt: true, tutorVerified: true, tutorRejectedAt: true, tutorRejectReason: true },
    });
  } catch {
    failed = true;
  }

  if (failed) {
    return (
      <KinPage>
        <KinPageHeader title="Hồ sơ gia sư" />
        <KinEmptyState title="Không tải được trạng thái hồ sơ"
          action={<Link href={TUTOR_PENDING_PATH} className={kinButtonClass("secondary")}>Thử lại</Link>}>
          KiN chưa đọc được hồ sơ của bạn lúc này. Hồ sơ đã gửi không bị mất — thử lại sau vài giây.
        </KinEmptyState>
      </KinPage>
    );
  }

  // redirect() phải đứng ngoài try/catch (ném NEXT_REDIRECT).
  const status = u ? tutorApplicationStatus(u) : "none";
  if (!u || (status !== "pending" && status !== "rejected")) redirect(landingPath("student", null, false));

  const pending = status === "pending";
  const subjects = u.subjects.filter(s => s.trim());

  return (
    <KinPage>
      <KinPageHeader
        title={pending ? "Hồ sơ gia sư đang chờ duyệt" : "Hồ sơ gia sư chưa được duyệt"}
        sub={pending
          ? "KiN đang xem hồ sơ của bạn. Duyệt xong, KiN báo qua thông báo và email; bạn đăng nhập lại là thấy đủ Hộp việc, Lịch, Lớp, Bài tập."
          : "KiN chưa nhận hồ sơ này. Bạn vẫn dùng KiN như học sinh; muốn nộp lại, sửa hồ sơ rồi liên hệ hỗ trợ."}
      />

      <div className="grid gap-[var(--kin-cach-muc)] max-w-2xl">
        <section data-tutor-application className="rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] p-[var(--kin-kc-7)]">
          <dl className="grid gap-3 text-[length:var(--kin-co-goc)]">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
              <dt className="sm:w-36 text-[var(--kin-chu-mo)]">Trạng thái</dt>
              <dd>
                {pending
                  ? <KinStatus tone="cho">Đang chờ duyệt{u.tutorAppliedAt ? ` · gửi ${fmtDay(u.tutorAppliedAt)}` : ""}</KinStatus>
                  : <KinStatus tone="loi">Bị từ chối{u.tutorRejectedAt ? ` · ${fmtDay(u.tutorRejectedAt)}` : ""}</KinStatus>}
                {!pending && u.tutorRejectReason && (
                  <p className="mt-1 text-[var(--kin-chu-chinh)]">Lý do KiN ghi: {u.tutorRejectReason}</p>
                )}
              </dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
              <dt className="sm:w-36 text-[var(--kin-chu-mo)]">Môn đã khai</dt>
              <dd className="text-[var(--kin-chu-chinh)]">{subjects.length ? subjects.join(", ") : "Chưa khai môn nào — thêm ở Sửa hồ sơ."}</dd>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4">
              <dt className="sm:w-36 text-[var(--kin-chu-mo)]">Giới thiệu</dt>
              <dd className="text-[var(--kin-chu-chinh)] whitespace-pre-line leading-5">{u.bio?.trim() || "Chưa có đoạn giới thiệu — viết vài dòng ở Sửa hồ sơ để KiN duyệt nhanh hơn."}</dd>
            </div>
          </dl>
        </section>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <Link href="/lop-cua-toi/ho-tro" className={kinButtonClass("primary")}>Liên hệ hỗ trợ</Link>
          <div className="flex items-center gap-4 text-[length:var(--kin-co-goc)]">
            <Link href="/lop-cua-toi/ho-so" className="min-h-11 inline-flex items-center underline text-[var(--kin-nhan-link)]">Sửa hồ sơ</Link>
            <Link href="/cai-dat/chu-de" className="min-h-11 inline-flex items-center underline text-[var(--kin-nhan-link)]">Đổi chủ đề màu</Link>
          </div>
        </div>
      </div>
    </KinPage>
  );
}
