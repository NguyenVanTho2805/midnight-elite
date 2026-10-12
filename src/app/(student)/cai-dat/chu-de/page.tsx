// TK-167 (09/10/2026) — người dùng chọn chủ đề KiN.
//
// Figma Thanh: trang "Năm chủ đề" (bàn giao docs/kin/thiet-ke/ban-giao-
// man-hinh.md). 5 chủ đề × 3 chế độ (sáng / tối / theo máy).
//
// Áp dụng ngay (localStorage) rồi lưu lên TÀI KHOẢN (User.preferences) để máy khác
// cũng thấy đúng chủ đề — xem AccountThemeSync. Khách chưa đăng nhập = chỉ theo máy.
"use client";
import { useEffect, useState } from "react";
import {
  KIN_THEMES, KIN_MODES, type KinTheme, type KinMode,
  readSavedTheme, applyTheme, saveTheme,
} from "@/components/ThemeApplier";
import { saveThemeToAccount, THEME_SYNC_EVENT } from "@/components/AccountThemeSync";

const THEME_LABEL: Record<KinTheme, string> = {
  "navy":   "Navy",
  "co-vit": "Cổ vịt",
  "man":    "Mận",
  "ca-phe": "Cà phê",
  "muc":    "Mực",
};

// Màu nhấn hiển thị trong card xem trước. Dùng giá trị cứng từ Figma —
// không đổi theo trạng thái sáng/tối của app, vì card là ảnh demo.
const THEME_PREVIEW: Record<KinTheme, { nen: string; chu: string }> = {
  "navy":   { nen: "#1e3a8a", chu: "#ffffff" },
  "co-vit": { nen: "#0e7490", chu: "#ffffff" },
  "man":    { nen: "#6b21a8", chu: "#ffffff" },
  "ca-phe": { nen: "#78350f", chu: "#ffffff" },
  "muc":    { nen: "#0f172a", chu: "#ffffff" },
};

const MODE_LABEL: Record<KinMode, string> = {
  "auto": "Theo máy",
  "sang": "Sáng",
  "toi":  "Tối",
};

export default function ChonChuDePage() {
  const [theme, setTheme] = useState<KinTheme>("navy");
  const [mode,  setMode]  = useState<KinMode>("auto");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = readSavedTheme();
    // localStorage chỉ đọc được ở trình duyệt; đặt state qua microtask để không setState đồng bộ trong thân effect.
    void Promise.resolve().then(() => { setTheme(s.theme); setMode(s.mode); setReady(true); });
    // Chủ đề của TÀI KHOẢN về sau khi trang đã mở (máy mới/trình duyệt sạch): cập nhật lựa chọn hiển thị.
    const onSync = (e: Event) => {
      const d = (e as CustomEvent<{ theme: KinTheme; mode: KinMode }>).detail;
      setTheme(d.theme); setMode(d.mode);
    };
    window.addEventListener(THEME_SYNC_EVENT, onSync);
    return () => window.removeEventListener(THEME_SYNC_EVENT, onSync);
  }, []);

  function pickTheme(t: KinTheme) {
    setTheme(t);
    applyTheme(t, mode);
    saveTheme(t, mode);
    saveThemeToAccount(t, mode);
  }
  function pickMode(m: KinMode) {
    setMode(m);
    applyTheme(theme, m);
    saveTheme(theme, m);
    saveThemeToAccount(theme, m);
  }

  return (
    <div style={{ background: "var(--kin-nen-trang)", minHeight: "100vh" }}>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <header className="mb-5">
          <h1 className="text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>
            Chủ đề giao diện
          </h1>
          <p className="text-caption mt-1" style={{ color: "var(--kin-chu-phu)" }}>
            Chọn màu chủ đề và chế độ sáng/tối. Áp dụng ngay và lưu theo tài khoản — đăng nhập ở máy nào cũng giống nhau.
          </p>
        </header>

        {/* Năm chủ đề */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--kin-chu-chinh)" }}>
            Chủ đề
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {KIN_THEMES.map(t => {
              const selected = ready && t === theme;
              const p = THEME_PREVIEW[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => pickTheme(t)}
                  aria-pressed={selected}
                  className="rounded-xl p-3 flex flex-col items-center gap-2 transition-all"
                  style={{
                    background: "var(--kin-nen-bang)",
                    border: `2px solid ${selected ? "var(--kin-th-navy)" : "var(--kin-vien-thuong)"}`,
                  }}>
                  <div className="w-full h-12 rounded-md flex items-center justify-center text-xs font-semibold"
                    style={{ background: p.nen, color: p.chu }}>
                    Aa
                  </div>
                  <span className="text-sm font-medium" style={{ color: "var(--kin-chu-chinh)" }}>
                    {THEME_LABEL[t]}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Chế độ sáng/tối */}
        <section className="mb-6">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--kin-chu-chinh)" }}>
            Chế độ sáng/tối
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {KIN_MODES.map(m => {
              const selected = ready && m === mode;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => pickMode(m)}
                  aria-pressed={selected}
                  className="rounded-xl p-3 text-sm font-medium transition-all"
                  style={{
                    background: selected ? "var(--kin-nen-nhan)" : "var(--kin-nen-bang)",
                    color: "var(--kin-chu-chinh)",
                    border: `2px solid ${selected ? "var(--kin-th-navy)" : "var(--kin-vien-thuong)"}`,
                  }}>
                  {MODE_LABEL[m]}
                </button>
              );
            })}
          </div>
          <p className="text-caption mt-2" style={{ color: "var(--kin-chu-mo)" }}>
            Chế độ &quot;Theo máy&quot; tự đổi sáng/tối theo cài đặt điện thoại / máy tính.
          </p>
        </section>

        {/* Phòng thi */}
        <section className="rounded-xl p-4"
          style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>
            Phòng thi luôn dùng Navy
          </p>
          <p className="text-caption" style={{ color: "var(--kin-chu-phu)" }}>
            Màn hình thi được khoá về chủ đề Navy, không đổi theo lựa chọn trên,
            để các em đi thi thấy giao diện giống nhau — một phần của việc thi công
            bằng (TK-174).
          </p>
        </section>
      </div>
    </div>
  );
}
