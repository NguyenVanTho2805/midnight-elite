"use client";

import { Lock, Mobile, Laptop } from "griddy-icons";

interface Props {
  onClose: () => void;
  onKickOther: () => void;
}

const activeDevices = [
  { name: "Chrome / Windows 11", ip: "113.23.xxx.xxx", lastActive: "Đang hoạt động", current: true },
  { name: "Safari / iPhone 15", ip: "171.225.xxx.xxx", lastActive: "3 phút trước", current: false },
];

export default function PopupDeviceLimit({ onClose, onKickOther }: Props) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="w-full max-w-sm rounded-3xl p-6" style={{ background: "#F0F5FF", boxShadow: "16px 16px 32px #C5D0EA, -16px -16px 32px #ffffff" }}>
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "#fee2e2", color: "#991b1b" }}>
          <Lock size={32} />
        </div>

        <h2 className="text-lg font-extrabold text-center mb-2" style={{ color: "#1E2938" }}>Giới hạn thiết bị</h2>
        <p className="text-sm text-center mb-5" style={{ color: "#6B7280" }}>
          Tài khoản của bạn đang đăng nhập trên <strong>2/2 thiết bị</strong> (tối đa). Hãy đăng xuất 1 thiết bị để tiếp tục.
        </p>

        {/* Device list */}
        <div className="space-y-2 mb-5">
          {activeDevices.map((device, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#F0F5FF", boxShadow: "inset 2px 2px 5px #C5D0EA, inset -2px -2px 5px #ffffff" }}>
              <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ color: "#4B5563" }}>
                {device.name.includes("iPhone") ? <Mobile size={20} /> : <Laptop size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "#1E2938" }}>{device.name}</p>
                <p className="text-xs" style={{ color: device.current ? "#00A63D" : "#9CA3AF" }}>
                  {device.current ? "● " : ""}{device.lastActive}
                </p>
              </div>
              {device.current ? (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#d1fae5", color: "#065f46" }}>Đây</span>
              ) : (
                <button onClick={onKickOther} className="text-xs px-2 py-1.5 rounded-lg font-bold" style={{ background: "#fee2e2", color: "#991b1b" }}>
                  Kick
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-center mb-5" style={{ color: "#9CA3AF" }}>
          IP: {activeDevices[1].ip} · Quản lý tại Hồ sơ → Thiết bị
        </p>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: "#F0F5FF", boxShadow: "4px 4px 8px #C5D0EA, -4px -4px 8px #ffffff", color: "#6B7280" }}>
            Hủy
          </button>
          <button onClick={onKickOther} className="flex-1 py-3 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(145deg, #FF2157, #cc0033)" }}>
            Kick &amp; Đăng nhập
          </button>
        </div>
      </div>
    </div>
  );
}
