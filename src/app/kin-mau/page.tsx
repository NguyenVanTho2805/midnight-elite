// Bộ component KiN để đối chiếu với Figma (Nút 6:50, Thẻ trạng thái 8:139, Toast 106:23, Tab 106:30, Hộp xác nhận 106:51).
// Chỉ có ở bản dev/preview cục bộ — bản chạy thật (NODE_ENV=production) trả 404.
import { notFound } from "next/navigation";
import MauClient from "./MauClient";

export const metadata = { title: "Bộ component KiN" };

export default function KinMauPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <MauClient />;
}
