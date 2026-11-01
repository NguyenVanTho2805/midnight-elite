"use client";
// BU-05 — hồ sơ công khai /cong-dong/ho-so/[id]: chỉ GIA SƯ. Học sinh / hồ sơ bị khoá / không có → cùng một màn "Không tìm thấy" (máy chủ trả 404).
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { KinButton, KinStateCard, kinButtonClass } from "@/components/kin";
import type { ProfileData } from "@/lib/communityTypes";
import { CommunityFrame } from "./CommunityFrame";
import { ProfileGrid } from "./ProfileGrid";
import { ProfileHeader } from "./ProfileHeader";

type State = { s: "loading" } | { s: "notfound" } | { s: "error" } | { s: "ok"; d: ProfileData };

export function ProfileView({ id }: { id: string }) {
  return <CommunityFrame active={null}><Inner id={id} /></CommunityFrame>;
}

function Inner({ id }: { id: string }) {
  const [st, setSt] = useState<State>({ s: "loading" });
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle");

  const load = useCallback(async () => {
    setSt({ s: "loading" });
    try {
      const res = await fetch(`/api/community/profiles/${id}?limit=18`, { credentials: "same-origin", cache: "no-store" });
      if (res.status === 404) { setSt({ s: "notfound" }); return; }
      if (!res.ok) { setSt({ s: "error" }); return; }
      setSt({ s: "ok", d: (await res.json()) as ProfileData });
    } catch { setSt({ s: "error" }); }
  }, [id]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function loadMore() {
    if (st.s !== "ok" || !st.d.nextCursor || more === "loading") return;
    setMore("loading");
    try {
      const res = await fetch(`/api/community/profiles/${id}?limit=18&cursor=${encodeURIComponent(st.d.nextCursor)}`, { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) { setMore("error"); return; }
      const next = (await res.json()) as ProfileData;
      setSt(cur => {
        if (cur.s !== "ok") return cur;
        const seen = new Set(cur.d.items.map(i => i.id));
        return { s: "ok", d: { ...cur.d, items: [...cur.d.items, ...next.items.filter(i => !seen.has(i.id))], nextCursor: next.nextCursor } };
      });
      setMore("idle");
    } catch { setMore("error"); }
  }

  if (st.s === "loading") {
    return (
      <div role="status" aria-busy="true" aria-label="Đang tải hồ sơ" data-kc-skeleton>
        <div aria-hidden style={{ height: 96 }} className="kc-skel" />
        <div className="p-4 flex flex-col gap-3" aria-hidden>
          <span className="kc-skel" style={{ width: 72, height: 72 }} />
          <span className="kc-skel" style={{ height: 14, width: "40%" }} />
          <span className="kc-skel" style={{ height: 12, width: "80%" }} />
        </div>
      </div>
    );
  }
  if (st.s === "notfound") {
    return <div className="p-4"><KinStateCard as="h1" kicker="Không tìm thấy" title="Không tìm thấy hồ sơ"
      actions={<Link href="/cong-dong" className={kinButtonClass("secondary")}>Về Cộng đồng</Link>}>
      Hồ sơ này không có hoặc không công khai.</KinStateCard></div>;
  }
  if (st.s === "error") {
    return <div className="p-4"><KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Không tải được"
      actions={<KinButton variant="secondary" onClick={() => void load()}>Thử lại</KinButton>}>
      Có trục trặc khi lấy hồ sơ. Bạn thử lại sau ít giây nhé.</KinStateCard></div>;
  }
  return (
    <div>
      <ProfileHeader profile={st.d.profile} />
      <div style={{ borderTop: "1px solid var(--kin-vien-thuong)" }}>
        <ProfileGrid items={st.d.items} />
        {st.d.nextCursor && (
          <div className="flex flex-col items-center gap-2 p-4">
            {more === "error" && <p role="alert" className="text-[length:var(--kin-co-small)] text-[var(--kin-tt-chu-loi)]">Chưa tải thêm được.</p>}
            <KinButton variant="secondary" loading={more === "loading"} loadingLabel="Đang tải…" onClick={() => void loadMore()}>{more === "error" ? "Thử lại" : "Xem thêm bài"}</KinButton>
          </div>
        )}
      </div>
    </div>
  );
}
