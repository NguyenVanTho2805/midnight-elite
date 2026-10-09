// TK-180 (09/10/2026) — "Lớp của tôi".
// Figma 123:145, 34:2. Bối cảnh: 3.3.1 "Trong lớp". Bấm 1 lớp mở
// giao diện lớp kiểu Outlook (TK-179).
//
// Role-aware:
// - Gia sư (role=admin, Course.ownerId=self): các lớp mình dạy.
// - Học viên (role=student): các lớp đã Enrollment status="active".
// - Chưa đăng nhập: redirect về /dang-nhap.
//
// Click 1 lớp → tạm thời sang trang quản khoá cũ (/admin/khoa-hoc/[id])
// cho gia sư và /student/hoc-tap cho học viên. Khi TK-179 có → trỏ về
// /lop-cua-toi/[courseId].
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function LopCuaToiPage() {
  const session = await getSession();
  if (!session) redirect("/dang-nhap?next=/lop-cua-toi");

  // 2 danh sách tuỳ role.
  const [owned, enrolled] = await Promise.all([
    session.role === "admin"
      ? prisma.course.findMany({
          where:   { ownerId: session.userId },
          select:  { id: true, name: true, category: true, status: true },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    session.role === "student"
      ? prisma.enrollment.findMany({
          where:   { userId: session.userId, status: "active" },
          include: { course: { select: { id: true, name: true, category: true } } },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const items = session.role === "admin"
    ? owned.map(c => ({ id: c.id, name: c.name, category: c.category,
         hrefOpen: `/lop-cua-toi/${c.id}`,
         actions: [
           { label: "Điểm danh",  href: `/admin/khoa-hoc/${c.id}/diem-danh` },
           { label: "Danh sách HS", href: `/admin/khoa-hoc/${c.id}/hoc-vien` },
         ],
         subtitle: c.status ? "Đang mở" : "Đã đóng",
      }))
    : enrolled.map(e => ({ id: e.course.id, name: e.course.name, category: e.course.category,
         hrefOpen: `/lop-cua-toi/${e.course.id}`,
         actions: [
           { label: "Lịch học",   href: "/student/lich-hoc" },
           { label: "Học phí",    href: "/student/hoc-phi" },
         ],
         subtitle: "Đang học",
      }));

  const roleLabel = session.role === "admin" ? "Lớp bạn đang dạy" : "Lớp bạn đang học";

  return (
    <div style={{ background: "var(--kin-nen-trang)", minHeight: "100vh" }}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <header className="mb-5">
          <h1 className="text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>
            Lớp của tôi
          </h1>
          <p className="text-caption mt-1" style={{ color: "var(--kin-chu-phu)" }}>
            {roleLabel} · {items.length} lớp
          </p>
        </header>

        {items.length === 0 ? (
          <div className="rounded-xl p-6 text-center"
            style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-phu)" }}>
            {session.role === "admin"
              ? "Bạn chưa mở lớp nào. Tạo lớp mới ở /admin/khoa-hoc."
              : "Bạn chưa đăng ký lớp nào."}
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map(c => (
              <li key={c.id}
                className="rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
                <Link href={c.hrefOpen} className="flex-1 min-w-0 group">
                  <p className="font-semibold group-hover:underline" style={{ color: "var(--kin-chu-chinh)" }}>
                    {c.name}
                  </p>
                  <p className="text-caption mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>
                    {c.category} · {c.subtitle}
                  </p>
                </Link>
                <div className="flex gap-2 flex-wrap">
                  {c.actions.map(a => (
                    <Link key={a.href} href={a.href}
                      className="px-3 py-1.5 text-sm rounded-lg whitespace-nowrap"
                      style={{
                        background: "var(--kin-nen-nhan)",
                        color:      "var(--kin-th-navy)",
                        border:     "1px solid var(--kin-vien-thuong)",
                      }}>
                      {a.label}
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
