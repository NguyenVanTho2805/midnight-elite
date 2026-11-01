// BU-06 — kiểu dữ liệu giao diện "Tìm gia sư", theo hợp đồng JSON mục C của docs/kin/phong-ban/dac-ta/BU-06.md.
// Khi stu-code đẩy src/lib/tutorSearch.ts (TutorListItem, TutorListResponse...), thay phần khai báo dưới bằng
// `export type { ... } from "@/lib/tutorSearch"` — mọi component trong thư mục này chỉ import kiểu từ tệp này.
import type { PublicArea } from "@/lib/tutorArea";

export interface TutorListItem {
  id: string;
  name: string;
  avatarBase64: string | null;
  bio: string | null;
  subjects: string[];
  tutorVerified: boolean;
  classCount: number;
  /** Số học sinh đang dạy (chỉ số đếm, không có tên). */
  studentCount: number;
  sessionsTaught: number;
  recentlyActive: boolean;
  area?: PublicArea | null;
}

export interface TutorFacets {
  cities: string[];
  districts: string[];
  subjects: { value: string; count: number }[];
  grades: { value: string; label: string; count: number }[];
  modes: { online: number; offline: number };
  price: { min: number | null; max: number | null; count: number };
  activeCount: number;
}

export interface TutorListResponse {
  items: TutorListItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  facets?: Partial<TutorFacets>;
}

export type TutorSuggestion =
  | { kind: "subject"; label: string; value: string; count: number }
  | { kind: "tutor"; label: string; id: string };

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
