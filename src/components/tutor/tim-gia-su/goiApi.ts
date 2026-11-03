// BU-06 — gọi GET /api/tutors từ trình duyệt. Có AbortController do bên gọi truyền vào; lỗi mạng/HTTP đều ném để trang hiện trạng thái lỗi.
import { ghiBoLoc, type BoLocState } from "./locUrl";
import type { TutorListResponse } from "./kieu";

export const PAGE_SIZE = 24;

export async function taiDanhSach(f: BoLocState, page: number, signal: AbortSignal, pageSize = PAGE_SIZE): Promise<TutorListResponse> {
  const res = await fetch(`/api/tutors?${ghiBoLoc(f, { page, pageSize })}`, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = (await res.json()) as Partial<TutorListResponse>;
  const items = d.items ?? [];
  return { items, total: d.total ?? items.length, page: d.page ?? page, pageSize: d.pageSize ?? pageSize, hasMore: d.hasMore ?? false, facets: d.facets };
}
