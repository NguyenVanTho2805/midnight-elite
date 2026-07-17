"use client";

import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import StudentBottomNav from "@/components/StudentBottomNav";
import AIChatWidget from "@/components/AIChatWidget";
import SalesBotWidget from "@/components/SalesBotWidget";
import AuthGuard from "@/components/AuthGuard";
import VerifyEmailBanner from "@/components/VerifyEmailBanner";
import { useEnrollments } from "@/hooks/useEnrollments";

function StudentChatWidget() {
  const { enrolledIds, loading } = useEnrollments();
  if (loading) return null;
  return enrolledIds.size > 0 ? <AIChatWidget /> : <SalesBotWidget />;
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard requiredRole="student">
      <div className="min-h-screen" style={{ background: "#ffffff" }}>
        <VerifyEmailBanner />
        <Navbar />
        <main className="pb-24 md:pb-8 px-4 md:px-8 py-6 max-w-screen-2xl mx-auto">
          <Suspense fallback={
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 rounded-xl" style={{ background: "#e5e3df" }} />
              ))}
            </div>
          }>
            <div className="page-enter">{children}</div>
          </Suspense>
        </main>
        <StudentBottomNav />
        <StudentChatWidget />
      </div>
    </AuthGuard>
  );
}
