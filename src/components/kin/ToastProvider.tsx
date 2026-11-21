// FE-094 — Toast context + hook useToast() dùng chung toàn ứng dụng. Thay
// cho AdminToast (component single-slot) + nhiều toast tự viết ở student/ho-so,
// admin/hoc-sinh và các trang guest.
//
// Dùng:
//   // Trong layout gốc (hoặc layout admin/student)
//   <ToastProvider>{children}</ToastProvider>
//
//   // Trong component:
//   const toast = useToast();
//   toast.ok("Đã lưu");
//   toast.err("Không lưu được");
//   toast.warn("Cần nhắc");                       // loại "chờ" (cam)
//   toast.ok("Đã lưu điểm danh", { detail: "4 buổi được tính tiền" });   // dòng phụ 11,1px
//   toast.show({ msg: "...", kind: "info", timeout: 5000 });
// 13/10/2026: hiển thị bằng KinToast (Figma "Toast" 106:23) — chấm + tiêu đề đậm + dòng phụ, 4 loại xong/chờ/lỗi/tin.
"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { KinToast, type ToastTone } from "@/components/kin/Toast";

type Kind = "ok" | "err" | "info" | "warn";
interface Entry { id: number; msg: string; detail?: string; kind: Kind; }
interface Opts { timeout?: number; detail?: string }

const TONE: Record<Kind, ToastTone> = { ok: "xong", err: "loi", info: "tin", warn: "cho" };

interface ToastAPI {
  ok: (msg: string, opts?: Opts) => void;
  err: (msg: string, opts?: Opts) => void;
  info: (msg: string, opts?: Opts) => void;
  warn: (msg: string, opts?: Opts) => void;
  show: (opts: Opts & { msg: string; kind?: Kind }) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastAPI | null>(null);

export function ToastProvider({ children, defaultTimeout = 3000 }: { children: ReactNode; defaultTimeout?: number }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const idRef = useRef(0);
  const timeouts = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setEntries(xs => xs.filter(x => x.id !== id));
    const t = timeouts.current.get(id);
    if (t) { clearTimeout(t); timeouts.current.delete(id); }
  }, []);

  const show = useCallback<ToastAPI["show"]>((opts) => {
    const id = ++idRef.current;
    setEntries(xs => [...xs, { id, msg: opts.msg, detail: opts.detail, kind: opts.kind ?? "info" }]);
    const t = setTimeout(() => dismiss(id), opts.timeout ?? defaultTimeout);
    timeouts.current.set(id, t);
  }, [defaultTimeout, dismiss]);

  // Dọn timers nếu provider unmount (tránh leak khi hot-reload)
  useEffect(() => () => {
    const current = timeouts.current;
    for (const t of current.values()) clearTimeout(t);
    current.clear();
  }, []);

  const api: ToastAPI = {
    ok:   (msg, opts) => show({ msg, kind: "ok",   ...opts }),
    err:  (msg, opts) => show({ msg, kind: "err",  ...opts }),
    info: (msg, opts) => show({ msg, kind: "info", ...opts }),
    warn: (msg, opts) => show({ msg, kind: "warn", ...opts }),
    show,
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-4 left-4 right-4 sm:left-auto sm:w-[400px] z-[200] flex flex-col items-end gap-2 pointer-events-none" aria-live="polite">
        {entries.map(e => (
          <div key={e.id} className="pointer-events-auto w-full max-w-[400px]">
            <KinToast tone={TONE[e.kind]} title={e.msg} detail={e.detail} onClose={() => dismiss(e.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastAPI {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast phải nằm trong <ToastProvider> — bọc layout gốc.");
  }
  return ctx;
}
