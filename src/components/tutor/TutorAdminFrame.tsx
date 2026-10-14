// Khung cho các trang /admin/* khi người mở là GIA SƯ: vỏ gia sư (thanh bên của họ) + dải tab các trang con của module, thay cho vỏ quản trị.
// Gia sư dùng các trang này (đề thi, ngân hàng đề, quản lớp, điểm danh…) và không được rời dashboard của mình sang giao diện quản trị.
"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import TutorShellClient from "@/components/shell/TutorShellClient";
import { AdminTabStrip } from "@/components/admin/AdminShell";
import { matchSub, visibleModules } from "@/lib/adminNav";

export default function TutorAdminFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const hit = matchSub(pathname);
  const current = visibleModules(user?.adminRole).find(m => m.key === hit?.moduleKey) ?? null;
  const tabs = current && current.subs.length > 1 ? current.subs : null;
  return (
    <TutorShellClient>
      {tabs && <AdminTabStrip label={current!.label} tabs={tabs} activeHref={hit?.sub.href} />}
      <main className="p-4 sm:p-6">{children}</main>
    </TutorShellClient>
  );
}
