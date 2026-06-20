import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SalesBotWidget from "@/components/SalesBotWidget";

function PageSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-6 animate-pulse">
      <div className="h-8 w-64 rounded-lg" style={{ background: "#e5e3df" }} />
      <div className="h-4 w-96 rounded-lg" style={{ background: "#ebe9e6" }} />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-xl" style={{ background: "#e5e3df" }} />
        ))}
      </div>
    </div>
  );
}

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#ffffff" }}>
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<PageSkeleton />}>
          <div className="page-enter">{children}</div>
        </Suspense>
      </main>
      <Footer />
      <SalesBotWidget />
    </div>
  );
}
