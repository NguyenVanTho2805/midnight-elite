// LOI-05 — gọi GET /api/tutors (API giữ nguyên) từ trình duyệt theo bộ lọc tối giản. Lỗi mạng/HTTP đều ném để trang hiện trạng thái lỗi.
import { apiQuery, type SanLoc } from "@/lib/tutorFloorFilter";
import type { TutorListResponse } from "@/components/tutor/tim-gia-su/kieu";

export const TRANG = 24;

export async function taiTrang(f: SanLoc, page: number, signal?: AbortSignal): Promise<TutorListResponse> {
  const res = await fetch(`/api/tutors?${apiQuery(f, page, TRANG)}`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = (await res.json()) as Partial<TutorListResponse>;
  const items = Array.isArray(d.items) ? d.items : [];
  return { items, total: d.total ?? items.length, page: d.page ?? page, pageSize: d.pageSize ?? TRANG, hasMore: d.hasMore ?? false, facets: d.facets };
}
