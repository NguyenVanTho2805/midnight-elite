// HOCPHI-THEO-BUOI (TUT-001): một cửa tạo lớp của gia sư là TaoLop (chọn được cách tính học phí). Tệp mỏng của gia sư; không sửa trang admin.
import { redirect } from "next/navigation";

export default function TaoMoiRedirect() {
  redirect("/lop-cua-toi/lop/tao");
}
