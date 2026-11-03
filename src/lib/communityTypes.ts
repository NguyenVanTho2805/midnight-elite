// BU-05 — hợp đồng kiểu giữa API cộng đồng (máy chủ) và giao diện. CHỈ KIỂU: không import prisma, không chạy mã.
// Giao diện import từ đây và gọi API theo docs/kin/phong-ban/dac-ta/BU-05.md mục 4.

export type CommunityTab = "all" | "hoi-dap" | "kinh-nghiem" | "tai-lieu" | "goc-vui";
// Giá trị `tab` client được gửi; "hoi-dap-qa" là bí danh cũ của "hoi-dap".
export const COMMUNITY_TABS: readonly CommunityTab[] = ["all", "hoi-dap", "kinh-nghiem", "tai-lieu", "goc-vui"];

export type AuthorTag = "gia-su" | "quan-tri" | "khach";

export type FeedAuthor = {
  id: string | null;          // null với khách
  label: string;              // publicName: gia sư/quản trị tên đầy đủ; học sinh "An N."; khách = guestName
  tag: AuthorTag | null;
  href: string | null;        // chỉ gia sư đã xác minh: /cong-dong/ho-so/<id>
};

export type FeedItem = {
  key: string;                // "t:<id>" | "q:<id>"
  source: "thread" | "question";
  kind: "post" | "question";
  id: string;
  title: string | null;
  content: string;
  category: string;
  imageUrls: string[];
  fileUrl: string | null;
  fileName: string | null;
  createdAt: string;          // ISO 8601, mốc giờ máy chủ
  isPinned: boolean;
  course: { id: string; name: string } | null;  // chỉ có khi người gọi là thành viên lớp
  author: FeedAuthor;
  likeCount: number;
  replyCount: number;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  isOwn: boolean;
  answered: boolean;          // câu hỏi: đã có trả lời được chọn
  href: string;               // /cong-dong/<id> hoặc /cong-dong/hoi-dap/<id> (câu hỏi cũ)
};

export type ReplyNode = {
  id: string;
  content: string;            // "" khi deleted
  imageUrls: string[];
  createdAt: string;
  author: FeedAuthor;
  likeCount: number;
  likedByMe: boolean;
  isOwn: boolean;
  isAccepted: boolean;
  deleted: boolean;           // giữ chỗ cho con
  children: ReplyNode[];      // đúng 1 cấp (con của con không có)
};

export type ThreadDetail = Omit<FeedItem, "key" | "source" | "href"> & {
  canAccept: boolean;         // người gọi được "Chọn là đúng" (chủ câu hỏi / gia sư chủ lớp / MANAGE_COMMUNITY)
  acceptedReplyId: string | null;
  replies: ReplyNode[];
};

export type FeedPage = {
  pinned: FeedItem[];         // chỉ trang đầu (cursor rỗng)
  items: FeedItem[];
  nextCursor: string | null;
};

export type BookmarksPage = { items: FeedItem[]; nextCursor: string | null };

export type SidebarData = {
  tutors: { id: string; label: string; subjects: string[]; answers30d: number; href: string }[];  // ≤3
  unanswered: { key: string; title: string; createdAt: string; href: string }[];                   // ≤5
};

export type GridItem = {
  id: string;
  imageUrl: string | null;    // imageUrls[0]
  excerpt: string;            // 4 dòng đầu khi không có ảnh
  href: string;
};

export type ProfileData = {
  profile: {
    id: string; label: string; tag: AuthorTag | null; subjects: string[];
    bio: string;              // ≤300
    postCount: number; answerCount: number; isSelf: boolean;
  };
  items: GridItem[];
  nextCursor: string | null;
};

export type PendingGuestItem = {
  id: string; guestName: string; title: string; content: string; createdAt: string;
  flags: { phoneOrLink: boolean };
};
export type PendingPage = { items: PendingGuestItem[]; nextCursor: string | null };

// Mã lỗi: thân lỗi luôn là { error: "<tiếng Việt>", code: CommunityErrorCode }.
export type CommunityErrorCode =
  | "tab_invalid" | "cursor_invalid" | "limit_invalid" | "not_member" | "not_found" | "unauthorized" | "forbidden"
  | "content_empty" | "content_too_long" | "title_required" | "title_too_long" | "category_invalid"
  | "too_many_images" | "kind_invalid" | "rate_limited" | "parent_invalid"
  | "reason_empty" | "own_post" | "already_reported"
  | "not_a_question" | "reply_invalid" | "not_allowed"
  | "name_invalid" | "title_invalid" | "content_invalid" | "under_13" | "not_allowed_for_guest" | "guest_questions_closed"
  | "decision_invalid" | "already_decided" | "reject_reason_required";

export type CommunityError = { error: string; code: CommunityErrorCode };
