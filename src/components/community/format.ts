// BU-05 — hàm thuần dùng chung cho khu Cộng đồng (giờ, nhãn, đường dẫn đăng nhập). Không gọi mạng.
import type { AuthorTag, CommunityError } from "@/lib/communityTypes";

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

export const CATEGORY_LABEL: Record<string, string> = {
  "kinh-nghiem": "Chia sẻ",
  "hoi-dap": "Hỏi đáp",
  "tai-lieu": "Tài liệu",
  "goc-vui": "Góc vui",
};

export const TAG_LABEL: Record<AuthorTag, string> = { "gia-su": "Gia sư", "quan-tri": "Quản trị", khach: "Khách" };

/** Chữ cái đầu của tên hiển thị (không bao giờ rỗng). */
export function initialOf(label: string): string {
  const t = label.trim();
  return t ? Array.from(t)[0].toUpperCase() : "?";
}

/** Đường dẫn đăng nhập quay về đúng chỗ đang xem. `to` mặc định là địa chỉ hiện tại (chỉ gọi trong sự kiện bấm, phía máy khách). */
export function loginHref(to?: string): string {
  const back = to ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/cong-dong");
  return `/dang-nhap?redirect=${encodeURIComponent(back)}`;
}

/** Đọc thân lỗi theo hợp đồng { error, code }; không bao giờ ném. */
export async function readError(res: Response): Promise<Partial<CommunityError>> {
  try { return (await res.json()) as Partial<CommunityError>; } catch { return {}; }
}

export const MAX_POST = 2000;
export const MAX_REPLY = 1000;

/** Lời cho `?loi=<code>` sau khi form khách bị 303 về /cong-dong. Không bao giờ đưa nguyên mã ra màn. */
export function guestErrorText(code: string | null): string | null {
  if (!code) return null;
  const map: Record<string, string> = {
    name_invalid: "Tên hiển thị cần từ 2 đến 40 ký tự.",
    title_invalid: "Tiêu đề cần từ 5 đến 120 ký tự.",
    content_invalid: "Nội dung cần từ 10 đến 600 ký tự.",
    under_13: "Bạn nhờ một người lớn trong nhà đặt câu hỏi giúp nhé.",
    rate_limited: "Bạn đã gửi khá nhiều câu hỏi. Thử lại sau ít phút nhé.",
    guest_questions_closed: "Hiện chưa nhận câu hỏi của khách. Bạn đăng nhập để đặt câu hỏi nhé.",
  };
  return map[code] ?? "Chưa gửi được câu hỏi. Bạn thử lại nhé.";
}
