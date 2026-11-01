// BU-06 — khoá tab hồ sơ (thuần, dùng được ở cả trang máy chủ lẫn TabHoSo). Giá trị lạ ⇒ "gioi-thieu".
export type TabHoSoKey = "gioi-thieu" | "lop" | "chi-so";
export const TAB_HO_SO: { key: TabHoSoKey; label: string }[] = [
  { key: "gioi-thieu", label: "Giới thiệu" },
  { key: "lop", label: "Lớp đang mở" },
  { key: "chi-so", label: "Chỉ số" },
];
export const parseTab = (raw: unknown): TabHoSoKey => (raw === "lop" || raw === "chi-so" ? raw : "gioi-thieu");
