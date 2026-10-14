// Hộp xác nhận KiN dùng kiểu `await` — thay cho window.confirm ở những chỗ đang viết `if (!confirm("…")) return;`.
//
//   const { ask, dialog } = useKinConfirm();
//   async function xoa() {
//     if (!(await ask({ title: "Xoá đề thi này?", message: "…", confirmLabel: "Xoá", tone: "nguy-hiem" }))) return;
//     …
//   }
//   return <>…{dialog}</>;
//
// `ask` trả Promise<boolean>: true = bấm xác nhận, false = Huỷ / Esc / bấm nền. Hỏi tiếp khi hộp trước còn mở thì hộp trước coi như Huỷ.
// Thành phần bị gỡ khi hộp còn mở → Promise trả false (không treo mãi). Mặc định là loại "nguy-hiem" vì các chỗ này đều là việc không hoàn tác.
"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { KinConfirm } from "./Confirm";

export interface AskOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "thuong" | "nguy-hiem";
}

interface Pending { opts: AskOptions; resolve: (ok: boolean) => void }

export function useKinConfirm(): { ask: (opts: AskOptions) => Promise<boolean>; dialog: ReactNode } {
  const [pending, setPending] = useState<Pending | null>(null);
  const live = useRef<Pending | null>(null);

  const ask = useCallback((opts: AskOptions) => new Promise<boolean>(resolve => {
    live.current?.resolve(false);
    const next = { opts, resolve };
    live.current = next;
    setPending(next);
  }), []);

  const settle = useCallback((ok: boolean) => {
    const cur = live.current;
    live.current = null;
    setPending(null);
    cur?.resolve(ok);
  }, []);

  useEffect(() => () => { live.current?.resolve(false); live.current = null; }, []);

  const o = pending?.opts;
  const dialog = (
    <KinConfirm open={!!pending} title={o?.title ?? ""} message={o?.message} confirmLabel={o?.confirmLabel ?? "Xoá"} cancelLabel={o?.cancelLabel ?? "Huỷ"}
      tone={o?.tone ?? "nguy-hiem"} onConfirm={() => settle(true)} onCancel={() => settle(false)} />
  );
  return { ask, dialog };
}
