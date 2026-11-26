// Mục điều hướng khu quản lý (khung-quan-ly §3). Đợt 1: không hiện mục chưa tới đợt (Sổ điểm, Học phí, Cài đặt).
import { IconDiemDanh, IconDon, IconHocSinh, IconLich, IconNha } from "../bieu-tuong";

export const MUC = [
  { href: "/quan-ly", nhan: "Hôm nay", Icon: IconNha, chiChu: false },
  { href: "/quan-ly/diem-danh", nhan: "Điểm danh", Icon: IconDiemDanh, chiChu: false },
  { href: "/quan-ly/hoc-sinh", nhan: "Học sinh", Icon: IconHocSinh, chiChu: false },
  { href: "/quan-ly/buoi-hoc", nhan: "Buổi học", Icon: IconLich, chiChu: false },
  { href: "/quan-ly/don", nhan: "Đơn", Icon: IconDon, chiChu: true },
] as const;

export const dangMo = (path: string, href: string) => (href === "/quan-ly" ? path === href : path === href || path.startsWith(`${href}/`));
/** soHs: số hồ sơ đang hiện (hoc-sinh.demHocSinhDangHien, đã lọc theo vai). */
export type ThongTinKhung = { chu: boolean; soDon: number; soHs: number; ten: string; vaiNhan: string };
