// SCL-B (rà soát): (noi-dung)/layout.tsx mở cho Chủ nhiệm (allowAdmin) vì dải quan-lop/[id]* là trang dạy học. Vùng de-thi/* (đề thi, ngân hàng câu hỏi / đề) là trang riêng
// của gia sư — vài trang con là bí danh mỏng không tự gọi cổng (ngan-hang-cau-hoi, …/cau-hoi, …/[id]) ⇒ chốt lại ở đây cho cả vùng: quản trị về /admin như trước.
import type { ReactNode } from "react";
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";

export default async function DeThiLayout({ children }: { children: ReactNode }) {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/de-thi", adminTo: "/admin" });
  return children;
}
