import { Suspense } from "react";
import GuestChrome from "@/components/shell/GuestChrome";

function PageSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded-lg" style={{ background: "var(--kin-vien-thuong)" }} />
      <div className="h-4 w-96 rounded-lg" style={{ background: "var(--kin-nen-re-chuot)" }} />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-xl" style={{ background: "var(--kin-vien-thuong)" }} />
        ))}
      </div>
    </div>
  );
}

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-vung="sang" className="min-h-screen flex flex-col" style={{ background: "var(--kin-nen-trang)" }}>
      {/* Khách: thanh trên + chân trang. Học viên / gia sư đã đăng nhập: vỏ của họ (thanh bên trái) — xem GuestChrome. */}
      <GuestChrome>
        <Suspense fallback={<PageSkeleton />}>
          <div className="page-enter">{children}</div>
        </Suspense>
      </GuestChrome>
    </div>
  );
}
