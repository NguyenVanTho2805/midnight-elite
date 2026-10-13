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
    bgColor: "var(--kin-tt-nen-cho)",
    borderColor: "var(--kin-tt-vien-cho)",
    color: "var(--kin-tt-chu-cho)",
    accentBg: "var(--kin-tt-chu-cho)",
    consequence: "Nhắc nhở. Tiếp tục vi phạm sẽ bị hạn chế tính năng.",
    canAppeal: true,
  },
  2: {
    Icon: AlertCircle,
    title: "Cảnh báo Strike 2/3 — Hạn chế tính năng",
    bgColor: "var(--kin-tt-nen-loi)",
    borderColor: "var(--kin-tt-vien-loi)",
    color: "var(--kin-tt-chu-loi)",
    accentBg: "var(--kin-tt-chu-loi)",
    consequence: "Bị khoá Q&A và Cộng đồng trong 7 ngày. Một strike nữa sẽ bị đình chỉ.",
    canAppeal: true,
  },
  3: {
    Icon: StopCircle,
    title: "Strike 3/3 — Tài khoản bị đình chỉ",
    bgColor: "var(--kin-chu-chinh)",
    borderColor: "var(--kin-chu-phu)",
    color: "var(--kin-chu-tren-nut-chinh)",
    accentBg: "var(--kin-chu-phu)",
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
        <div className="p-6" style={{ background: "var(--kin-nen-bang)" }}>
          {/* Strike indicators */}
          <div className="flex items-center justify-center gap-3 mb-5">
            {[1, 2, 3].map((s) => (
              <div key={s} className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-extrabold"
                style={{
                  background: s <= strikeLevel ? cfg.accentBg : "var(--kin-nen-bang)",
                  color: s <= strikeLevel ? "var(--kin-chu-tren-nut-chinh)" : "var(--kin-chu-mo)",
                  boxShadow: s <= strikeLevel ? "none" : "3px 3px 6px var(--kin-vien-thuong), -3px -3px 6px var(--kin-nen-trang)",
                }}>
                {s}
              </div>
            ))}
          </div>

          {/* Reason */}
          <div className="rounded-xl p-4 mb-4" style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-chim)" }}>
            <p className="text-xs font-semibold mb-1" style={{ color: "var(--kin-chu-mo)" }}>Lý do vi phạm</p>
            <p className="text-sm font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>{reason}</p>
          </div>

          {/* Consequence */}
          <div className="rounded-xl p-4 mb-5" style={{ background: cfg.bgColor, border: `1px solid ${cfg.borderColor}` }}>
            <p className="text-xs font-semibold mb-1" style={{ color: cfg.color }}>Hậu quả</p>
            <p className="text-sm" style={{ color: cfg.color }}>{cfg.consequence}</p>
          </div>

          <div className="space-y-2">
            {cfg.canAppeal && onAppeal && (
              <button onClick={onAppeal} className="w-full py-3 rounded-xl text-sm font-bold text-white"
                style={{ background: "var(--kin-nhan-nen)" }}>
                Gửi khiếu nại
              </button>
            )}
            <button onClick={onClose} className="w-full py-3 rounded-xl text-sm font-semibold"
              style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-the)", color: "var(--kin-chu-mo)" }}>
              {strikeLevel === 3 ? "Liên hệ admin" : "Đã hiểu"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
