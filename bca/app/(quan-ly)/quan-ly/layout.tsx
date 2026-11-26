// Khung khu quản lý (khung-quan-ly.md): thanh bên ≥ 640px, thanh dưới 5 mục trên điện thoại,
// liên kết bỏ qua tới nội dung, dải mất mạng, thanh Hoàn tác dùng chung.
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { layNguoiQuanLy } from "@/components/khung/nguoi";
import { ThanhBen } from "@/components/khung/thanh-ben";
import { ThanhDuoi } from "@/components/khung/thanh-duoi";
import { MatMang } from "@/components/khung/mat-mang";
import { KhungClient } from "@/components/khung/khung-client";
import { danhSachDon } from "@/server/don";
import { demHocSinhDangHien } from "@/server/hoc-sinh";

export const metadata: Metadata = { title: { default: "Quản lý lớp · BCA Midnight", template: "%s · BCA Midnight" } };
export const viewport: Viewport = { themeColor: "#0A0F1E", colorScheme: "dark", viewportFit: "cover" };

export default async function KhungQuanLy({ children }: { children: ReactNode }) {
  const u = await layNguoiQuanLy();
  const chu = u.vai === "chu";
  const [soDon, soHs] = await Promise.all([
    chu ? danhSachDon(u).then((r) => r.don.filter((d) => d.trang_thai === "moi" || d.trang_thai === "cho_duyet").length) : 0,
    demHocSinhDangHien(u),
  ]);
  const k = { chu, soDon, soHs, ten: u.ten, vaiNhan: chu ? "Chủ lớp" : "Giáo viên" };
  return (
    <KhungClient>
      <a href="#noi-dung" className="sr-only z-50 rounded-[10px] bg-gold px-4 py-3 font-semibold text-on-gold focus:not-sr-only focus:fixed focus:left-4 focus:top-2">
        Bỏ qua tới nội dung
      </a>
      <div className="sm:flex">
        <ThanhBen {...k} />
        <div className="co-thanh-duoi min-w-0 flex-1">
          <MatMang />
          <main id="noi-dung" tabIndex={-1} className="outline-none">{children}</main>
        </div>
      </div>
      <ThanhDuoi {...k} />
    </KhungClient>
  );
}
