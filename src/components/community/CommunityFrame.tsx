"use client";
// BU-05 — vỏ chung của mọi màn Cộng đồng (bảng tin, chi tiết bài, hồ sơ): điều hướng trái + cột phải + khung 3/2/1 cột.
// Nạp một lần: danh sách lớp (cho mục "Lớp của tôi") và dữ liệu cột phải (GET /api/community/sidebar, công khai, không theo người dùng).
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { SidebarData } from "@/lib/communityTypes";
import { CommunityLayout } from "./CommunityLayout";
import { LeftNav, type NavActive } from "./LeftNav";
import { RightRail } from "./RightRail";
import { useScopeOptions, type ScopeOption } from "./useScopeOptions";

type FrameCtx = { sidebar: SidebarData | null; scopes: ScopeOption[]; signedIn: boolean };
const Ctx = createContext<FrameCtx>({ sidebar: null, scopes: [], signedIn: false });
export const useCommunityFrame = () => useContext(Ctx);

export function CommunityFrame({ active, scope = "all", children }: { active: NavActive; scope?: string; children: ReactNode }) {
  const { user } = useAuth();
  const signedIn = !!user;
  const scopes = useScopeOptions(signedIn);
  const [sidebar, setSidebar] = useState<SidebarData | null>(null);

  useEffect(() => {
    let off = false;
    const ac = new AbortController();
    fetch("/api/community/sidebar", { signal: ac.signal })
      .then(r => (r.ok ? (r.json() as Promise<SidebarData>) : null))
      .then(d => { if (!off && d) setSidebar(d); })
      .catch(() => { /* cột phải là phụ: lỗi thì ẩn khối, không báo */ });
    return () => { off = true; ac.abort(); };
  }, []);

  return (
    <Ctx.Provider value={{ sidebar, scopes, signedIn }}>
      <CommunityLayout
        nav={<LeftNav active={active} scope={scope} options={scopes} signedIn={signedIn} />}
        rail={<RightRail data={sidebar} />}
      >
        {children}
      </CommunityLayout>
    </Ctx.Provider>
  );
}
