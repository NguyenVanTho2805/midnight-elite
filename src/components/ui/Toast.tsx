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
//   toast.show({ msg: "...", kind: "info", timeout: 5000 });
"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Kind = "ok" | "err" | "info";
interface Entry { id: number; msg: string; kind: Kind; }

interface ToastAPI {
  ok: (msg: string, opts?: { timeout?: number }) => void;
  err: (msg: string, opts?: { timeout?: number }) => void;
  info: (msg: string, opts?: { timeout?: number }) => void;
  show: (opts: { msg: string; kind?: Kind; timeout?: number }) => void;
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
    setEntries(xs => [...xs, { id, msg: opts.msg, kind: opts.kind ?? "info" }]);
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
    ok:   (msg, opts) => show({ msg, kind: "ok",   timeout: opts?.timeout }),
    err:  (msg, opts) => show({ msg, kind: "err",  timeout: opts?.timeout }),
    info: (msg, opts) => show({ msg, kind: "info", timeout: opts?.timeout }),
    show,
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none" aria-live="polite">
        {entries.map(e => (
          <div
            key={e.id}
            className="pointer-events-auto px-4 py-3 rounded-xl text-sm font-semibold text-white shadow-xl flex items-center gap-2 min-w-[200px] max-w-sm"
            style={{ background: e.kind === "ok" ? "#16a34a" : e.kind === "err" ? "#dc2626" : "#334155" }}
            role={e.kind === "err" ? "alert" : "status"}
          >
            <span>{e.kind === "ok" ? "✓" : e.kind === "err" ? "✗" : "ⓘ"}</span>
            <span className="flex-1">{e.msg}</span>
            <button
              type="button"
              onClick={() => dismiss(e.id)}
              className="opacity-70 hover:opacity-100 text-base leading-none"
              aria-label="Đóng"
            >×</button>
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
