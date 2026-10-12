// FE-099 — dữ liệu khởi đầu cho /diem-chuan, CHỈ gồm những dòng đã có nguồn công khai kèm đường dẫn (thu thập 12/10/2026 qua tìm kiếm).
// QUAN TRỌNG: chưa dòng nào được đối chiếu với thông báo chính thức của trường (môi trường lúc thu thập không mở được website các trường)
// nên tất cả `verified: false` — trang công khai hiện nhãn "chưa đối chiếu". Quản trị đối chiếu rồi bật "đã đối chiếu" trong /admin/diem-chuan.
// Đây là TẬP NHỎ, không phải toàn bộ điểm chuẩn. Thêm dữ liệu: /admin/diem-chuan (nhập tay hoặc dán CSV/JSON).
import type { ScoreInput } from "./admissionScore";

const base = { variant: "", note: "", published: true, verified: false } as const;

export const SEED_SCORES: ScoreInput[] = [
  { ...base, school: "Đại học Bách khoa Hà Nội", major: "Khoa học máy tính (IT1)", year: 2025, method: "thpt", score: 29.19, scale: 30,
    sourceName: "Báo Đại biểu Nhân dân", sourceUrl: "https://daibieunhandan.vn/diem-chuan-dai-hoc-2025-cua-dai-hoc-bach-khoa-ha-noi-dao-dong-tu-19-29-39-diem-10384226.html",
    note: "Công bố 22/8/2025." },
  { ...base, school: "Đại học Bách khoa Hà Nội", major: "Khoa học máy tính (IT1)", year: 2024, method: "thpt", score: 28.53, scale: 30,
    sourceName: "Báo Đại biểu Nhân dân", sourceUrl: "https://daibieunhandan.vn/diem-chuan-dh-bach-khoa-ha-noi-nam-2024-nganh-cao-nhat-28-53-diem-10344128.html",
    note: "Công bố 17/8/2024." },
  { ...base, school: "Đại học Bách khoa Hà Nội", major: "Khoa học dữ liệu và Trí tuệ nhân tạo (IT-E10)", variant: "Chương trình tiên tiến", year: 2025, method: "thpt", score: 29.39, scale: 30,
    sourceName: "Tuyển sinh ĐH Bách khoa Hà Nội (ts.hust.edu.vn)", sourceUrl: "https://ts.hust.edu.vn/tin-tuc/diem-chuan-cao-nhat-dh-bach-khoa-ha-noi-2025-29-39-diem-thpt-tuong-duong-93-96-diem-xttn-va-86-97-diem-tsa",
    note: "Cao nhất toàn trường năm 2025." },
  { ...base, school: "Đại học Y Hà Nội", major: "Y khoa", variant: "Tổ hợp B00", year: 2025, method: "thpt", score: 28.13, scale: 30,
    sourceName: "Báo Tiền Phong", sourceUrl: "https://tienphong.vn/diem-chuan-truong-dai-hoc-y-ha-noi-cao-nhat-28-70-post1771726.html",
    note: "Đợt 1, cơ sở Hà Nội (không phải phân hiệu Thanh Hóa)." },
  { ...base, school: "Đại học Ngoại thương", major: "Kinh tế đối ngoại", variant: "Chương trình tiên tiến", year: 2025, method: "thpt", score: 28.5, scale: 30,
    sourceName: "Báo Tuổi Trẻ", sourceUrl: "https://tuoitre.vn/truong-dai-hoc-ngoai-thuong-diem-chuan-cao-nhat-28-5-20250822173832094.htm",
    note: "Công bố 22/8/2025; điểm chuẩn cao nhất của trường." },
  { ...base, school: "Đại học Bách khoa TP.HCM (ĐHQG-HCM)", major: "Khoa học máy tính (mã 106)", year: 2025, method: "tong-hop", score: 85.41, scale: 100,
    sourceName: "Hocmai Hướng nghiệp", sourceUrl: "https://huongnghiep.hocmai.vn/tuyen-sinh-2025-dai-hoc-bach-khoa-dhqg-tphcm-cong-bo-diem-chuan-2025-khoa-hoc-may-tinh-cham-noc-8541-100",
    note: "Xét tuyển tổng hợp (ĐGNL ĐHQG-HCM, THPT, học bạ) — thang 100." },
  { ...base, school: "Đại học Bách khoa TP.HCM (ĐHQG-HCM)", major: "Khoa học máy tính (mã 106)", year: 2024, method: "tong-hop", score: 84.16, scale: 90,
    sourceName: "Tuyển Sinh Số", sourceUrl: "https://tuyensinhso.vn/diem-chuan/diem-chuan-truong-dai-hoc-bach-khoa-dhqg-tphcm-c49173.html",
    note: "Năm 2024 dùng thang 90 — KHÔNG so trực tiếp với 2025 (thang 100)." },
  { ...base, school: "Đại học Kinh tế Quốc dân", major: "Thương mại điện tử", year: 2025, method: "khac", score: 28.83, scale: 30,
    sourceName: "Báo Znews", sourceUrl: "https://znews.vn/dai-hoc-kinh-te-quoc-dan-cong-bo-diem-chuan-post1579045.html",
    note: "Cao nhất toàn trường năm 2025 (công bố 22/8/2025). Nguồn không nêu rõ phương thức." },
];
