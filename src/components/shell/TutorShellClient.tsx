// Vỏ gia sư cho các trang KHÁCH (/thu-vien, /khoa-hoc…) khi gia sư đã đăng nhập. Vỏ gia sư gốc (src/app/lop-cua-toi/(tutor)/layout.tsx) lấy module bật
// và số việc ở máy chủ; trang khách thì tĩnh (để giữ SEO) nên phải lấy ở máy khách sau khi mở trang. Trong lúc chờ: `undefined` = đủ module (mặc định BU-00)
// rồi cập nhật theo lựa chọn đã lưu — lần tải đầu không còn "gọn rồi mới mở".
"use client";
import { useEffect, useState, type ReactNode } from "react";
import TutorShell from "@/components/tutor/TutorShell";
import { isTutorModuleVisible, readPreferences, type OptionalTutorModule } from "@/lib/userPreferences";

// `pending` (BU-00 bước 5): gia sư chờ duyệt — vỏ 3 mục, không hỏi module / số việc (API Hộp việc từ chối role student).
export default function TutorShellClient({ children, pending = false }: { children: ReactNode; pending?: boolean }) {
  const [modules, setModules] = useState<OptionalTutorModule[] | undefined>(undefined);
  const [badges, setBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    if (pending) return;
    let off = false;
    void (async () => {
      try {
        const pr = await fetch("/api/users/me/preferences", { credentials: "same-origin" });
        if (!pr.ok || off) return;
        const prefs = readPreferences((await pr.json()).preferences);
        setModules(prefs.modules); // vắng mặt giữ nguyên `undefined` = đủ module; `[]` = chế độ gọn gia sư tự chọn
        if (!isTutorModuleVisible(prefs, "hop-viec")) return;
        const hr = await fetch("/api/tutor/hop-viec", { credentials: "same-origin" });
        if (!hr.ok || off) return;
        const d = await hr.json();
        if (typeof d.total === "number") setBadges({ "hop-viec": d.total });
      } catch { /* không có mạng: giữ đủ module, không số đếm */ }
    })();
    return () => { off = true; };
  }, [pending]);

  return <TutorShell modules={modules} badges={badges} pending={pending}>{children}</TutorShell>;
}
