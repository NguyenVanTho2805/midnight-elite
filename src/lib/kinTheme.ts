// TK-167 — hằng số chủ đề KiN, dùng được ở cả server và client (ThemeApplier là
// "use client" nên server không import trực tiếp được mảng hằng từ đó).
export const KIN_THEMES = ["navy", "co-vit", "man", "ca-phe", "muc"] as const;
export const KIN_MODES  = ["auto", "sang", "toi"] as const;
export type KinTheme = (typeof KIN_THEMES)[number];
export type KinMode  = (typeof KIN_MODES)[number];
