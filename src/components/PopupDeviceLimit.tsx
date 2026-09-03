"use client";

import { Lock, DeviceMobile as Mobile, Laptop } from "@phosphor-icons/react";

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
      <div className="w-full max-w-sm rounded-xl p-6" style={{ background: "var(--canvas)", border: "1px solid var(--hairline)", boxShadow: "var(--shadow-3)" }}>
        {/* Icon */}
        <div className="w-16 h-16 rounded-lg flex items-center justify-center mx-auto mb-4" style={{ background: "#fee2e2", color: "#991b1b" }}>
          <Lock size={32} />
        </div>

        <h2 className="text-lg font-extrabold text-center mb-2" style={{ color: "var(--ink)" }}>Giới hạn thiết bị</h2>
        <p className="text-sm text-center mb-5" style={{ color: "var(--steel)" }}>
          Tài khoản của bạn đang đăng nhập trên <strong>2/2 thiết bị</strong> (tối đa). Hãy đăng xuất 1 thiết bị để tiếp tục.
        </p>

        {/* Device list */}
        <div className="space-y-2 mb-5">
          {activeDevices.map((device, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-md" style={{ background: "var(--surface)", border: "1px solid var(--hairline)" }}>
              <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ color: "var(--slate)" }}>
                {device.name.includes("iPhone") ? <Mobile size={20} /> : <Laptop size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>{device.name}</p>
                <p className="text-xs" style={{ color: device.current ? "#00A63D" : "var(--stone)" }}>
                  {device.current ? "● " : ""}{device.lastActive}
                </p>
              </div>
              {device.current ? (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "#d1fae5", color: "#065f46" }}>Đây</span>
              ) : (
                <button onClick={onKickOther} className="text-xs px-2 py-1.5 rounded-md font-bold" style={{ background: "#fee2e2", color: "#991b1b" }}>
                  Kick
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-center mb-5" style={{ color: "var(--stone)" }}>
          IP: {activeDevices[1].ip} · Quản lý tại Hồ sơ → Thiết bị
        </p>

        <div className="flex gap-3">
          <button onClick={onClose} className="notion-btn-secondary flex-1 flex items-center justify-center text-sm">
            Hủy
          </button>
          <button onClick={onKickOther} className="flex-1 py-2.5 rounded-md text-sm font-bold text-white" style={{ background: "#e03131" }}>
            Kick &amp; Đăng nhập
          </button>
        </div>
      </div>
    </div>
  );
}
