// PH-05 — danh sách "các em đã mở" trên MÁY CỦA PHỤ HUYNH, để chuyển nhanh giữa các Sổ của con.
// Mô hình KHÔNG đổi: mỗi liên kết riêng (token) vẫn chỉ cho xem MỘT em; máy chủ không biết các em có cùng một phụ huynh hay không và
// không gộp dữ liệu nào giữa các em. Danh sách chỉ nằm ở trình duyệt (localStorage), chỉ giữ liên kết + tên em mà chính phụ huynh vừa thấy.
// Hàm THUẦN (không đọc localStorage, không đồng hồ) để test được; component gọi và tự đọc/ghi.
import { isValidPortalToken } from "@/lib/parentPortal";

export const CHILD_LIST_KEY = "kin.parent.children.v1";
export const CHILD_LIST_MAX = 8;
export const CHILD_NAME_MAX = 60;
export interface ChildLink { token: string; name: string }

const cleanName = (s: unknown) => (typeof s === "string" ? s.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, CHILD_NAME_MAX) : "");

/** Đọc chuỗi đã lưu: hỏng / sai kiểu / token sai dạng / trùng đều bị bỏ; không bao giờ ném lỗi. */
export function parseChildList(raw: string | null | undefined): ChildLink[] {
  if (!raw) return [];
  let v: unknown;
  try { v = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: ChildLink[] = [];
  for (const it of v) {
    const t = (it as { token?: unknown })?.token;
    if (!isValidPortalToken(t) || seen.has(t)) continue;
    const name = cleanName((it as { name?: unknown }).name);
    if (!name) continue;
    seen.add(t); out.push({ token: t, name });
    if (out.length >= CHILD_LIST_MAX) break;
  }
  return out;
}

/** Thêm / cập nhật em vừa mở lên đầu danh sách (em khác giữ nguyên thứ tự). Token sai dạng hoặc tên rỗng → không đổi gì. */
export function rememberChild(list: ChildLink[], cur: ChildLink): ChildLink[] {
  const name = cleanName(cur.name);
  if (!isValidPortalToken(cur.token) || !name) return list;
  const rest = list.filter(c => c.token !== cur.token);
  const prev = list.findIndex(c => c.token === cur.token);
  const next = prev >= 0 ? [...list.slice(0, prev), { token: cur.token, name }, ...list.slice(prev + 1)] : [...rest, { token: cur.token, name }];
  return next.slice(-CHILD_LIST_MAX);
}

export const serializeChildList = (list: ChildLink[]) => JSON.stringify(list.map(c => ({ token: c.token, name: c.name })));
export const removeChild = (list: ChildLink[], token: string) => list.filter(c => c.token !== token);
