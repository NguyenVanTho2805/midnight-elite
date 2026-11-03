// BU-08: cửa duyệt gia sư thứ hai đã gỡ — duyệt ở Hàng chờ, xem lịch sử ở /admin/gia-su. 308 vĩnh viễn (đích không phụ thuộc người xem).
import { permanentRedirect } from "next/navigation";

export default function HoSoGiaSuCu(): never {
  permanentRedirect("/admin/kiem-duyet?loai=gia-su");
}
