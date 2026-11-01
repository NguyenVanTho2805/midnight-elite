// BU-07 mục 4.3 — chống tăng lượt xem bằng spam. HÀNG RÀO MỀM: cookie `kin_av` (≤20 slug đã đếm trong 24 giờ) + giới hạn tốc độ TRONG BỘ NHỚ TIẾN TRÌNH.
// Không bảng DB, không log, không IP thô: chỉ băm sha256(ip + muối ngày) cắt 8 byte. Serverless thì bộ nhớ không chung giữa các thể hiện → không chống được kẻ phân tán cố ý;
// chấp nhận vì lượt xem chỉ xếp hạng, không dính tiền. THUẦN trừ băm (node:crypto) và bộ nhớ; test: tools/local-e2e/t-articles-lib.ts.
import { createHash } from "node:crypto";

export const VIEW_COOKIE = "kin_av";
export const VIEW_COOKIE_MAX_SLUGS = 20;
export const VIEW_COOKIE_MAX_AGE_S = 24 * 3600;
export const VIEW_HOURLY_CAP = 30;
const HOUR_MS = 3600_000;
const BOT_RE = /bot|crawl|spider|headless|slurp|preview|fetch|curl|wget|python|httpclient|lighthouse/i;

/** Mã ngắn của slug để đưa vào cookie (không có ID người). */
export const slugKey = (slug: string): string => createHash("sha256").update("kin-av:" + slug).digest("hex").slice(0, 8);

export function parseViewCookie(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw.split(".").filter(k => /^[0-9a-f]{8}$/.test(k)).slice(-VIEW_COOKIE_MAX_SLUGS);
}
/** Giá trị cookie mới sau khi đếm `slug`: giữ ≤20 mã mới nhất. */
export function nextViewCookie(prev: string[], slug: string): string {
  const k = slugKey(slug);
  return [...prev.filter(x => x !== k), k].slice(-VIEW_COOKIE_MAX_SLUGS).join(".");
}

export function hashClient(ip: string, now: number): string {
  const day = Math.floor(now / 86400000);
  return createHash("sha256").update(`${ip}|${day}|kin-av-salt`).digest("hex").slice(0, 16); // 8 byte
}

/** Trạng thái giới hạn trong bộ nhớ. Truyền vào để test độc lập; mặc định dùng bản chung của tiến trình. */
export interface ViewLimiter { perClient: Map<string, number[]>; perClientSlug: Map<string, number> }
export const newLimiter = (): ViewLimiter => ({ perClient: new Map(), perClientSlug: new Map() });
const shared = newLimiter();

export interface ViewReq {
  slug: string; cookie?: string | null; ip: string; userAgent?: string | null;
  origin?: string | null; host?: string | null; secFetchSite?: string | null; now?: number;
}
export type ViewDecision = { count: true; setCookie: string } | { count: false; reason: "cookie" | "bot" | "cross-site" | "rate" | "slug-rate" };

function sameOrigin(origin: string | null | undefined, host: string | null | undefined, sfs: string | null | undefined): boolean {
  if (sfs === "cross-site") return false;
  if (origin) {
    try { if (!host || new URL(origin).host !== host) return false; } catch { return false; }
  }
  return true;
}

const CAP_CLIENT = 5000, CAP_SLUG = 10000;
/** Dọn hết hạn khi vượt trần; nếu vẫn vượt (xoay IP) thì xoá mục cũ nhất (thứ tự chèn của Map) xuống 90% trần để không quét O(n) mỗi yêu cầu. */
function trim<V>(m: Map<string, V>, cap: number, expired: (v: V) => boolean) {
  if (m.size <= cap) return;
  for (const [k, v] of m) if (expired(v)) m.delete(k);
  if (m.size <= cap) return;
  let drop = m.size - Math.floor(cap * 0.9);
  for (const k of m.keys()) { if (drop-- <= 0) break; m.delete(k); }
}
function prune(lim: ViewLimiter, now: number) {
  trim(lim.perClient, CAP_CLIENT, v => !v.some(t => now - t < HOUR_MS));
  trim(lim.perClientSlug, CAP_SLUG, t => now - t >= HOUR_MS);
}

/**
 * Quyết định có đếm lượt xem không. Chỉ khi trả `count:true` mới được `increment` và đặt cookie (`setCookie` là giá trị mới).
 * Thứ tự: cùng nguồn → UA/bot → cookie đã có slug → giới hạn ≤30 lần/giờ/băm và ≤1 lần/slug/băm/giờ. Chỉ ghi nhận vào bộ nhớ khi THỰC SỰ đếm.
 */
export function shouldCountView(r: ViewReq, lim: ViewLimiter = shared): ViewDecision {
  const now = r.now ?? Date.now();
  if (!sameOrigin(r.origin, r.host, r.secFetchSite)) return { count: false, reason: "cross-site" };
  const ua = (r.userAgent ?? "").trim();
  if (!ua || BOT_RE.test(ua)) return { count: false, reason: "bot" };
  const seen = parseViewCookie(r.cookie);
  if (seen.includes(slugKey(r.slug))) return { count: false, reason: "cookie" };

  const c = hashClient(r.ip, now);
  const hits = (lim.perClient.get(c) ?? []).filter(t => now - t < HOUR_MS);
  if (hits.length >= VIEW_HOURLY_CAP) { lim.perClient.set(c, hits); return { count: false, reason: "rate" }; }
  const sk = `${c}|${r.slug}`;
  const last = lim.perClientSlug.get(sk);
  if (last !== undefined && now - last < HOUR_MS) return { count: false, reason: "slug-rate" };

  hits.push(now);
  lim.perClient.set(c, hits);
  lim.perClientSlug.set(sk, now);
  prune(lim, now);
  return { count: true, setCookie: nextViewCookie(seen, r.slug) };
}
