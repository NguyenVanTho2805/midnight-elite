// SCL-B (rà soát): Chủ nhiệm đứng lớp trong vỏ gia sư, nhưng các API ghi của lớp (thêm học sinh, mã mời, duyệt xin vào lớp, học online, học phí) chỉ nhận gia sư chủ lớp
// ⇒ thay nút bấm-là-403 bằng một dòng chỉ sang trang quản trị của lớp. <a> chứ không Link: /admin/* được proxy chuyển sang tên miền quản trị.
import { kinButtonClass } from "@/components/kin/buttonClass";
import { KinCallout } from "@/components/kin/Callout";

export default function AdminManageNote({ courseId, what }: { courseId: string; what: string }) {
  return (
    <div data-admin-manage-note className="max-w-3xl">
      <KinCallout title={`${what} ở trang quản trị`}>
        Bạn đang xem lớp với vai Chủ nhiệm. Phần này của lớp làm ở trang quản trị.
        <div className="mt-3">
          <a href={`/admin/khoa-hoc/${encodeURIComponent(courseId)}`} className={kinButtonClass("secondary")}>Mở lớp ở trang quản trị</a>
        </div>
      </KinCallout>
    </div>
  );
}
