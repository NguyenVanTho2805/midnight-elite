// Khung của các trang KHÁCH (src/app/(guest)): thanh trên + chân trang cho khách; học viên / gia sư ĐÃ đăng nhập thì thay bằng vỏ của họ (thanh bên trái),
// để thanh bên không biến mất khi họ bấm "Thư viện", "Khoá học", "Gia sư"… Quyết định ở máy khách (AuthContext) chứ không ở máy chủ, vì đọc cookie ở layout
// sẽ bắt cả nhóm trang khách phải dựng lại mỗi lần (mất bộ nhớ đệm + SEO). Hệ quả đã biết: lần tải cứng đầu tiên một người đã đăng nhập thấy khung khách một
// thoáng rồi đổi sang vỏ; chuyển trang bên trong ứng dụng thì không nháy. Cách triệt để (cookie gợi ý + script trước khi vẽ) chưa làm.
"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StudentBottomNav from "@/components/StudentBottomNav";
import StudentShell from "@/components/student/StudentShell";
import TutorShellClient from "@/components/shell/TutorShellClient";
import { shellFor } from "@/lib/signedInShell";

export default function GuestChrome({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const kind = isLoading ? null : shellFor(user, pathname);
  const cho = isLoading ? "cho" : "hien";

  if (kind === "student") return <StudentShell><main className="flex-1">{children}</main></StudentShell>;
  if (kind === "tutor") return <TutorShellClient><main className="flex-1">{children}</main></TutorShellClient>;
  if (kind === "tutor-pending") return <TutorShellClient pending><main className="flex-1">{children}</main></TutorShellClient>; // BU-00 bước 5

  // data-guest-chrome="cho": CSS (kin-tokens.css) ẩn hai khối này khi <html> có data-kin-vo (máy này lần trước đã đăng nhập) VÀ còn đang chờ biết ai đăng nhập —
  // xem src/lib/signedInShell.ts. Hết chờ ("hien") thì luôn hiện: khách, và cả người đã đăng nhập ở trang không có vỏ (/quen-mat-khau…) vẫn cần thanh trên.
  // `contents` để khối bọc không tạo hộp: thanh trên / chân trang vẫn xếp trực tiếp trong cột của trang như trước.
  return (
    <>
      <div data-guest-chrome={cho} className="contents"><Navbar /></div>
      <main className="flex-1 pb-24 md:pb-0">{children}</main>
      <div data-guest-chrome={cho} className="contents"><Footer /><StudentBottomNav /></div>
    </>
  );
}
