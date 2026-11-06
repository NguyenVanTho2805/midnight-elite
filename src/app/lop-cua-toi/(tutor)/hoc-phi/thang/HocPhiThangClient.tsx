"use client";
import { useCallback, useEffect, useState } from "react";
import HocPhiThang, { type HocPhiThangData } from "@/components/tutor/HocPhiThang";
import { callApi } from "@/components/tutor/shared";

const API = "/api/tutor/hoc-phi-thang";

export default function HocPhiThangClient({ ym, maxYm }: { ym: string; maxYm: string }) {
  // Kết quả gắn với tháng đã hỏi: đổi tháng (liên kết ?ym=) thì coi như đang tải lại, không hiện số của tháng cũ.
  const [res, setRes] = useState<{ ym: string; data: HocPhiThangData | null; error: string | null } | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    callApi<HocPhiThangData>(`${API}?ym=${encodeURIComponent(ym)}`).then(r => {
      if (!alive) return;
      setRes(r.ok ? { ym, data: r.data, error: null } : { ym, data: null, error: r.data.error ?? "Không tải được bảng học phí tháng này." });
    });
    return () => { alive = false; };
  }, [ym, tick]);
  const retry = useCallback(() => { setRes(null); setTick(t => t + 1); }, []);

  const mine = res && res.ym === ym ? res : null;
  return (
    <HocPhiThang
      state={!mine ? "loading" : mine.data ? "ok" : "error"}
      data={mine?.data ?? null}
      errorText={mine?.error}
      onRetry={retry}
      ym={ym} maxYm={maxYm}
      monthHref={m => `/lop-cua-toi/hoc-phi/thang?ym=${m}`}
      csvHref={`${API}?ym=${encodeURIComponent(ym)}&format=csv`}
      emptyHref="/lop-cua-toi/lich"
    />
  );
}
