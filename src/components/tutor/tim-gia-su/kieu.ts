// BU-06 — kiểu dữ liệu giao diện "Tìm gia sư", theo hợp đồng JSON mục C của docs/kin/phong-ban/dac-ta/BU-06.md.
// Kiểu danh sách/facet/gợi ý lấy từ src/lib/tutorSearch.ts (stu-code); phần còn lại (phản hồi trang, chi tiết hồ sơ) khai báo tại đây.
// Mọi component trong thư mục này chỉ import kiểu từ tệp này.
import type { PublicArea } from "@/lib/tutorArea";
import type { TutorListItem, TutorFacets } from "@/lib/tutorSearch";

export type { TutorListItem, TutorFacets } from "@/lib/tutorSearch";

export interface TutorListResponse {
  items: TutorListItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  facets?: Partial<TutorFacets>;
}

export type { Suggestion as TutorSuggestion } from "@/lib/tutorSearch";

export type JoinPolicyView = "open" | "approve" | "invite_only";

export interface ProfileClassRow {
  id: string; name: string; shortTitle?: string; category?: string;
  classStatus: string;
  capacity: number | null; activeCount: number; seatsLeft: number | null;
  joinPolicy?: JoinPolicyView;
  isFree?: boolean;
}

export interface TutorDetailResponse {
  tutor: {
    id: string; name: string; avatarBase64: string | null; bio: string | null;
    subjects: string[]; tutorVerified: boolean; tutorVerifiedAt: string | null;
    zalo: string | null; messenger: string | null; area?: PublicArea | null;
    coverUrl?: string | null;
    introVideo?: { id: string; watchUrl: string; embedUrl: string; thumbUrl: string } | null;
  };
  stats: { classCount: number; studentCount: number; sessionsTaught: number; recentlyActive?: boolean };
  classes: ProfileClassRow[];
}
