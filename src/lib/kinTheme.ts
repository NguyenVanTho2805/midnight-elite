// TK-167 — hằng số chủ đề KiN, dùng được ở cả server và client (ThemeApplier là
// "use client" nên server không import trực tiếp được mảng hằng từ đó).
export const KIN_THEMES = ["navy", "co-vit", "man", "ca-phe", "muc"] as const;
export const KIN_MODES  = ["auto", "sang", "toi"] as const;
export type KinTheme = (typeof KIN_THEMES)[number];
export type KinMode  = (typeof KIN_MODES)[number];

export const KIN_THEME_KEY = "kin.chu-de";
export const KIN_MODE_KEY = "kin.che-do";

/**
 * Chạy TRƯỚC khi trình duyệt vẽ (chèn ở layout gốc, cạnh RAIL_INIT_SCRIPT): đọc lựa chọn đã lưu trên máy và đặt data-chu-de / data-che-do
 * lên <html> ngay. Layout gốc mặc định render data-che-do="sang" (người chưa chọn gì thì sáng); không có dòng này, người đã chọn "Tối" hoặc
 * "Theo máy" (máy tối) sẽ thấy một nháy NỀN SÁNG rồi mới tối, vì ThemeApplier chỉ chạy sau khi trang nạp xong. "auto" = bỏ thuộc tính để CSS theo máy.
 * Một dòng, không chứa "</script", không ném lỗi khi trình duyệt chặn localStorage.
 */
export const THEME_INIT_SCRIPT =
  `try{var h=document.documentElement,t=localStorage.getItem(${JSON.stringify(KIN_THEME_KEY)}),m=localStorage.getItem(${JSON.stringify(KIN_MODE_KEY)});` +
  `if(${JSON.stringify(KIN_THEMES)}.indexOf(t)>=0)h.setAttribute("data-chu-de",t);` +
  `if(m==="auto")h.removeAttribute("data-che-do");else if(m==="toi"||m==="sang")h.setAttribute("data-che-do",m)}catch(e){}`;
