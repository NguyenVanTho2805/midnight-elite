"use client";

import { AlertTriangle, AlertCircle, StopCircle } from "griddy-icons";

interface Props {
  strikeLevel: 1 | 2 | 3;
  reason: string;
  onClose: () => void;
  onAppeal?: () => void;
}

const strikeConfig = {
  1: {
    Icon: AlertTriangle,
    title: "Cảnh báo Strike 1/3",
    bgColor: "#fef3c7",
    borderColor: "#fde68a",
    color: "#92400e",
    accentBg: "#FE9900",
    consequence: "Nhắc nhở. Tiếp tục vi phạm sẽ bị hạn chế tính năng.",
    canAppeal: true,
  },
  2: {
    Icon: AlertCircle,
    title: "Cảnh báo Strike 2/3 — Hạn chế tính năng",
    bgColor: "#fee2e2",
    borderColor: "#fca5a5",
    color: "#991b1b",
    accentBg: "#FF2157",
    consequence: "Bị khoá Q&A và Cộng đồng trong 7 ngày. Một strike nữa sẽ bị đình chỉ.",
    canAppeal: true,
  },
  3: {
    Icon: StopCircle,
    title: "Strike 3/3 — Tài khoản bị đình chỉ",
    bgColor: "#1E2938",
    borderColor: "#374151",
    color: "#ffffff",
    accentBg: "#374151",
    consequence: "Tài khoản tạm khoá. Vui lòng liên hệ admin để được hỗ trợ.",
    canAppeal: false,
  },
};

export default function PopupStrikeWarning({ strikeLevel, reason, onClose, onAppeal }: Props) {
  const cfg = strikeConfig[strikeLevel];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.6)" }}>
      <div className="w-full max-w-sm rounded-3xl overflow-hidden" style={{ boxShadow: "16px 16px 32px rgba(0,0,0,0.3)" }}>
        {/* Header */}
        <div className="p-6 text-center" style={{ background: cfg.bgColor, borderBottom: `2px solid ${cfg.borderColor}` }}>
          <div className="flex justify-center mb-3" style={{ color: cfg.color }}>
            <cfg.Icon size={48} />
          </div>
          <h2 className="text-lg font-extrabold" style={{ color: cfg.color }}>{cfg.title}</h2>
        </div>

        {/* Body */}
        <div className="p-6" style={{ background: "#F0F5FF" }}>
          {/* Strike indicators */}
          <div className="flex items-center justify-center gap-3 mb-5">
            {[1, 2, 3].map((s) => (
              <div key={s} className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-extrabold"
                style={{
                  background: s <= strikeLevel ? cfg.accentBg : "#F0F5FF",
                  color: s <= strikeLevel ? "#fff" : "#9CA3AF",
                  boxShadow: s <= strikeLevel ? "none" : "3px 3px 6px #C5D0EA, -3px -3px 6px #ffffff",
                }}>
                {s}
              </div>
            ))}
          </div>

          {/* Reason */}
          <div className="rounded-xl p-4 mb-4" style={{ background: "#F0F5FF", boxShadow: "inset 3px 3px 6px #C5D0EA, inset -3px -3px 6px #ffffff" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "#6B7280" }}>Lý do vi phạm</p>
            <p className="text-sm font-semibold" style={{ color: "#1E2938" }}>{reason}</p>
          </div>

          {/* Consequence */}
          <div className="rounded-xl p-4 mb-5" style={{ background: cfg.bgColor, border: `1px solid ${cfg.borderColor}` }}>
            <p className="text-xs font-semibold mb-1" style={{ color: cfg.color }}>Hậu quả</p>
            <p className="text-sm" style={{ color: cfg.color }}>{cfg.consequence}</p>
          </div>

          <div className="space-y-2">
            {cfg.canAppeal && onAppeal && (
              <button onClick={onAppeal} className="w-full py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: "linear-gradient(145deg, #0055D4, #0042AA)" }}>
                Gửi khiếu nại
              </button>
            )}
            <button onClick={onClose} className="w-full py-3 rounded-xl text-sm font-semibold"
              style={{ background: "#F0F5FF", boxShadow: "4px 4px 8px #C5D0EA, -4px -4px 8px #ffffff", color: "#6B7280" }}>
              {strikeLevel === 3 ? "Liên hệ admin" : "Đã hiểu"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
