// SCL-F2 (P2-26): một cửa tạo lớp — đường cũ /admin/khoa-hoc/tao-moi (bookmark, liên kết) đi thẳng TaoLop trong vỏ gia sư. 307 ở máy chủ; proxy đưa sang tên miền chính.
import { redirect } from "next/navigation";

export default function TaoMoiRedirect() {
  redirect("/lop-cua-toi/lop/tao");
}
