// BU-08 mục 4.6: bảng chuyển hướng VĨNH VIỄN (308) từ đường quản trị cũ sang mới. PHẦN THUẦN, một nguồn duy nhất:
//  • next.config.ts nhập `nextAdminRedirects()` (COO gắn: xem phiếu bàn giao);
//  • trang cũ (nếu còn) gọi `lookupAdminRedirect()` rồi `permanentRedirect()`.
// Đích KHÔNG phụ thuộc người xem, nên 308 an toàn (khác các chuyển hướng theo phiên của hostRouting.ts).
export interface AdminRedirect { from: string; to: string }

export const ADMIN_REDIRECTS: readonly AdminRedirect[] = [
  { from: "/admin/ho-so-gia-su", to: "/admin/kiem-duyet?loai=gia-su" },
  { from: "/admin/cong-dong/bao-cao", to: "/admin/kiem-duyet?loai=tra-loi" },
];

/** Dạng đưa thẳng vào `redirects()` của Next (Next tự giữ query của yêu cầu). */
export function nextAdminRedirects(): { source: string; destination: string; permanent: true }[] {
  return ADMIN_REDIRECTS.map(r => ({ source: r.from, destination: r.to, permanent: true as const }));
}

/**
 * Tra đích cho một đường cũ; null nếu không phải đường cũ. Query của yêu cầu được GIỮ và nối sau query của đích
 * (`/admin/ho-so-gia-su?x=1` → `/admin/kiem-duyet?loai=gia-su&x=1`); tham số trùng tên với đích thì đích thắng.
 */
export function lookupAdminRedirect(pathname: string, search?: string | URLSearchParams | null): string | null {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const hit = ADMIN_REDIRECTS.find(r => r.from === path);
  if (!hit) return null;
  const [toPath, toQuery = ""] = hit.to.split("?");
  const out = new URLSearchParams(toQuery);
  const extra = typeof search === "string" ? new URLSearchParams(search.replace(/^\?/, "")) : search ?? new URLSearchParams();
  extra.forEach((v, k) => { if (!out.has(k)) out.append(k, v); });
  const q = out.toString();
  return q ? `${toPath}?${q}` : toPath;
}
