"use client";
// T41: chủ đăng xuất em khỏi mọi máy ngay (vd. em báo mất điện thoại, hoặc vừa sửa Gmail trong hồ sơ). Hỏi lại một lần.
import { useState } from "react";

export function DangXuatHs({ ma, ten }: { ma: string; ten: string }) {
  const [tt, setTt] = useState<"" | "hoi" | "dang" | "xong" | string>("");
  const gui = async () => {
    setTt("dang");
    const r = await fetch(`/api/hoc-sinh/${encodeURIComponent(ma)}/thu-hoi-phien`, { method: "POST" }).catch(() => null);
    setTt(r?.ok ? "xong" : ((await r?.json().catch(() => null))?.loi ?? "Không làm được — kiểm tra mạng rồi thử lại."));
  };
  if (tt === "xong") return <p role="status" className="basis-full text-[13px] text-ok">Đã đăng xuất {ten} khỏi mọi máy. Em đăng nhập lại bằng Google khi cần.</p>;
  if (tt === "hoi" || tt === "dang")
    return (
      <div className="flex basis-full flex-wrap items-center gap-2 text-[13px]">
        <span>Đăng xuất {ten} khỏi mọi máy?</span>
        <button type="button" disabled={tt === "dang"} onClick={gui} className="nhan min-h-11 rounded-[10px] border border-danger px-3 font-semibold text-danger hover:bg-danger-bg disabled:opacity-60">
          {tt === "dang" ? "Đang làm…" : "Đăng xuất em"}
        </button>
        <button type="button" onClick={() => setTt("")} className="nhan min-h-11 rounded-[10px] border border-border-input px-3 font-semibold hover:bg-row-hover">Huỷ</button>
      </div>
    );
  return (
    <div className="basis-full">
      {tt ? <p role="alert" className="text-[13px] text-danger">{tt}</p> : null}
      <button type="button" onClick={() => setTt("hoi")} className="min-h-11 text-left text-[13px] font-semibold text-text-2 hover:text-danger">Đăng xuất em khỏi mọi máy…</button>
    </div>
  );
}
