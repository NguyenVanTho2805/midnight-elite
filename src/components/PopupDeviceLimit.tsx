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
      <div className="w-full max-w-sm rounded-3xl p-6" style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-noi)" }}>
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi)" }}>
          <Lock size={32} />
        </div>

        <h2 className="text-lg font-extrabold text-center mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Giới hạn thiết bị</h2>
        <p className="text-sm text-center mb-5" style={{ color: "var(--kin-chu-mo)" }}>
          Tài khoản của bạn đang đăng nhập trên <strong>2/2 thiết bị</strong> (tối đa). Hãy đăng xuất 1 thiết bị để tiếp tục.
        </p>

        {/* Device list */}
        <div className="space-y-2 mb-5">
          {activeDevices.map((device, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-chim)" }}>
              <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" style={{ color: "var(--kin-chu-phu)" }}>
                {device.name.includes("iPhone") ? <Mobile size={20} /> : <Laptop size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>{device.name}</p>
                <p className="text-xs" style={{ color: device.current ? "var(--kin-tt-chu-xong)" : "var(--kin-chu-mo)" }}>
                  {device.current ? "● " : ""}{device.lastActive}
                </p>
              </div>
              {device.current ? (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" }}>Đây</span>
              ) : (
                <button onClick={onKickOther} className="text-xs px-2 py-1.5 rounded-lg font-bold" style={{ background: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi)" }}>
                  Kick
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-center mb-5" style={{ color: "var(--kin-chu-mo)" }}>
          IP: {activeDevices[1].ip} · Quản lý tại Hồ sơ → Thiết bị
        </p>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ background: "var(--kin-nen-bang)", boxShadow: "var(--kin-bong-the)", color: "var(--kin-chu-mo)" }}>
            Hủy
          </button>
          <button onClick={onKickOther} className="flex-1 py-3 rounded-xl text-sm font-bold text-white" style={{ background: "var(--kin-tt-chu-loi)" }}>
            Kick &amp; Đăng nhập
          </button>
        </div>
      </div>
    </div>
  );
}
