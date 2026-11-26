"use client";
// Thanh Hoàn tác 5 giây (man-diem-danh §6) — tự viết, không thư viện. Dùng chung qua context để thanh
// vẫn còn khi trang làm mới dữ liệu (router.refresh). Dừng đếm khi trang ẩn, con trỏ nằm trên thanh
// hoặc tiêu điểm ở trong thanh (WCAG 2.2.1). Esc đóng (giữ kết quả); Ctrl/⌘+Z = Hoàn tác.
import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type ThongBao = { id: number; thongDiep: string; hoanTac?: () => void | Promise<void>; het?: () => void };
type Ctx = { hien: (t: Omit<ThongBao, "id">) => void; dong: () => void };
const HoanTacCtx = createContext<Ctx | null>(null);
const THOI_GIAN = 5000;

export function useHoanTac() {
  const c = use(HoanTacCtx);
  if (!c) throw new Error("useHoanTac phải nằm trong HoanTacProvider");
  return c;
}

export function HoanTacProvider({ children }: { children: ReactNode }) {
  const [tb, setTb] = useState<ThongBao | null>(null);
  const dem = useRef(0);
  const hienTai = useRef<ThongBao | null>(null);
  useEffect(() => { hienTai.current = tb; }, [tb]);
  const hien = useCallback((t: Omit<ThongBao, "id">) => {
    hienTai.current?.het?.(); // thanh cũ bị thay: coi như đã hết giờ
    const moi = { ...t, id: ++dem.current };
    hienTai.current = moi;
    setTb(moi);
  }, []);
  const dong = useCallback(() => { hienTai.current = null; setTb(null); }, []);
  return (
    <HoanTacCtx value={{ hien, dong }}>
      {children}
      {tb ? <ThanhHoanTac key={tb.id} tb={tb} xong={(chay) => {
            if (hienTai.current?.id !== tb.id) return;
            hienTai.current = null;
            if (chay) tb.het?.();
            setTb(null);
          }} /> : null}
    </HoanTacCtx>
  );
}

function ThanhHoanTac({ tb, xong }: { tb: ThongBao; xong: (chayHet: boolean) => void }) {
  const [con, setCon] = useState(THOI_GIAN);
  const [dung, setDung] = useState(false);
  const [an, setAn] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const xongRef = useRef(xong);
  xongRef.current = xong;
  const dangHoanTac = useRef(false);

  useEffect(() => {
    const f = () => setAn(document.hidden);
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, []);
  useEffect(() => {
    if (dung || an) return;
    const t = setInterval(() => setCon((c) => Math.max(0, c - 100)), 100);
    return () => clearInterval(t);
  }, [dung, an]);
  useEffect(() => {
    if (con <= 0) xongRef.current(true);
  }, [con]);

  const bam = useCallback(async () => {
    if (dangHoanTac.current || !tb.hoanTac) return;
    dangHoanTac.current = true;
    xongRef.current(false);
    await tb.hoanTac();
  }, [tb]);

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.key === "Escape") xongRef.current(true);
      if (tb.hoanTac && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void bam();
      }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [bam, tb.hoanTac]);

  const giay = Math.ceil(con / 1000);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(80px+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 sm:bottom-6">
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        className="hien-nhanh bong-noi pointer-events-auto relative w-full max-w-[480px] overflow-hidden rounded-[14px] bg-raised"
        onMouseEnter={() => setDung(true)}
        onMouseLeave={() => setDung(ref.current?.contains(document.activeElement) ?? false)}
        onFocus={() => setDung(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDung(false); }}
      >
        <div className="flex items-center justify-between gap-3 py-2 pl-4 pr-2">
          <p className="text-text">
            {tb.thongDiep}
            <span className="ml-2 hidden text-[13px] text-text-3 motion-reduce:inline so">còn {giay} giây</span>
          </p>
          {tb.hoanTac ? (
            <button type="button" onClick={bam} className="nhan min-h-11 shrink-0 rounded-[10px] border border-border-input px-4 font-semibold text-gold hover:bg-row-hover">
              Hoàn tác
            </button>
          ) : (
            <button type="button" onClick={() => xong(true)} className="nhan min-h-11 shrink-0 rounded-[10px] px-3 text-text-2 hover:bg-row-hover">Đóng</button>
          )}
        </div>
        <div aria-hidden="true" className="vach-dem absolute inset-x-0 bottom-0 h-0.5 bg-gold motion-reduce:hidden" style={{ transform: `scaleX(${con / THOI_GIAN})`, transition: "transform 100ms linear" }} />
      </div>
    </div>
  );
}
