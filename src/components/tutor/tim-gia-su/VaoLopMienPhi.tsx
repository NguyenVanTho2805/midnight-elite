// BU-06 — nút vào lớp miễn phí trên hồ sơ gia sư. Là <form method="post"> tới luồng BU-01 (POST /api/courses/[id]/join → 303), không JS:
// máy chủ quyết định (khách → /dang-nhap?redirect=, học sinh "open" → vào ngay, "approve" → mã cá nhân + chờ duyệt, gia sư → 403).
// Giao diện chỉ hiện nút khi lớp đúng là miễn phí và mở cửa; nếu không thì không hứa điều máy chủ sẽ từ chối.
import { kinButtonClass } from "@/components/kin/buttonClass";
import type { ProfileClassRow } from "./kieu";

export type NguoiXem = "guest" | "student" | "staff";

export function duocVaoLop(c: Pick<ProfileClassRow, "isFree" | "joinPolicy" | "classStatus" | "seatsLeft">): boolean {
  return c.isFree === true && (c.joinPolicy === "open" || c.joinPolicy === "approve") && c.classStatus === "open" && c.seatsLeft !== 0;
}

export function VaoLopMienPhi({ course, viewer, size = "md" }: { course: Pick<ProfileClassRow, "id" | "name" | "joinPolicy">; viewer: NguoiXem; size?: "md" | "lg" }) {
  if (viewer === "staff") return null;
  const approve = course.joinPolicy === "approve";
  return (
    <form method="post" action={`/api/courses/${encodeURIComponent(course.id)}/join`} data-join-form={course.joinPolicy} className="m-0">
      <button type="submit" aria-label={`${approve ? "Xin vào lớp miễn phí" : "Vào lớp miễn phí"}: ${course.name}`} className={`${kinButtonClass("primary", size)} w-full sm:w-auto`}>
        {approve ? "Xin vào lớp miễn phí" : "Vào lớp miễn phí"}
      </button>
    </form>
  );
}
