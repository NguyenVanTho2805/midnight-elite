// BU-08: báo cáo trả lời (và báo cáo bài viết) đã vào Hàng chờ. 308 vĩnh viễn.
import { permanentRedirect } from "next/navigation";

export default function BaoCaoCu(): never {
  permanentRedirect("/admin/kiem-duyet?loai=tra-loi");
}
