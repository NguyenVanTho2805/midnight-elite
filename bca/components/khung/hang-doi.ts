"use client";
// Hàng đợi thay đổi khi rớt mạng (khung-quan-ly §5, T26): lưu trong IndexedDB, mỗi thay đổi có khoá,
// cùng khoá thì bản sau ghi đè. Gửi lần lượt theo thứ tự; gửi lại khi có sự kiện `online`, khi mở lại trang
// và mỗi 15 giây. Không dựa vào Background Sync (Safari trên iPhone chưa hỗ trợ).
import { useSyncExternalStore } from "react";

export type Viec = {
  khoa: string;
  /** Nhóm để trang đăng ký xử lý kết quả, ví dụ `dd:12` (điểm danh buổi 12). */
  nhom: string;
  url: string;
  method: "PUT" | "POST" | "PATCH";
  body: Record<string, unknown>;
  thuTu?: number;
};
export type TrangThaiHang = {
  cho: number;
  dangGui: boolean;
  matMang: boolean;
  /** Máy chủ lỗi (5xx): giữ thay đổi, chờ bấm Thử lại. */
  loiMayChu: boolean;
  hetPhien: boolean;
  daLuuLuc: number | null;
};
type XuLy = { ok?: (v: Viec, kq: unknown) => void; loi?: (v: Viec, status: number, kq: { loi?: string; ma?: string }) => void };

const hang = new Map<string, Viec>();
const nghe = new Set<() => void>();
const xuLy = new Map<string, XuLy>();
const BAN_DAU: TrangThaiHang = { cho: 0, dangGui: false, matMang: false, loiMayChu: false, hetPhien: false, daLuuLuc: null };
let tt = BAN_DAU;
let dangGuiKhoa: string | null = null;
let dem = Date.now();

function dat(p: Partial<TrangThaiHang>) {
  tt = { ...tt, ...p, cho: hang.size };
  nghe.forEach((f) => f());
}

// ── IndexedDB (không có thì chỉ giữ trong bộ nhớ) ──
const TEN_DB = "bca-hang-doi", KHO = "viec";
let dbP: Promise<IDBDatabase | null> | null = null;
function layDb() {
  if (dbP) return dbP;
  dbP = new Promise((res) => {
    if (typeof indexedDB === "undefined") return res(null);
    const r = indexedDB.open(TEN_DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(KHO, { keyPath: "khoa" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
  });
  return dbP;
}
async function ghiDb(v: Viec | string) {
  const db = await layDb();
  if (!db) return;
  const s = db.transaction(KHO, "readwrite").objectStore(KHO);
  if (typeof v === "string") s.delete(v);
  else s.put(v);
}
let napP: Promise<void> | null = null;
/** Nạp các thay đổi còn chờ từ lần mở trước. */
export function nap() {
  napP ??= (async () => {
    const db = await layDb();
    if (!db) return;
    const ds = await new Promise<Viec[]>((res) => {
      const r = db.transaction(KHO).objectStore(KHO).getAll();
      r.onsuccess = () => res(r.result as Viec[]);
      r.onerror = () => res([]);
    });
    for (const v of ds.sort((a, b) => (a.thuTu ?? 0) - (b.thuTu ?? 0))) if (!hang.has(v.khoa)) hang.set(v.khoa, v);
    dat({});
  })();
  return napP;
}

export const layViec = (khoa: string) => hang.get(khoa);
export const viecCuaNhom = (nhom: string) => [...hang.values()].filter((v) => v.nhom === nhom);
export const dangGui = (khoa: string) => dangGuiKhoa === khoa;

export function datViec(v: Viec) {
  const cu = hang.get(v.khoa);
  const moi = { ...v, thuTu: cu?.thuTu ?? ++dem };
  hang.set(v.khoa, moi);
  void ghiDb(moi);
  dat({ loiMayChu: false });
  void gui();
}
/** Bỏ thay đổi chưa gửi (ví dụ Hoàn tác trước khi kịp gửi). Trả false nếu đang gửi dở. */
export function boViec(khoa: string) {
  if (dangGuiKhoa === khoa || !hang.has(khoa)) return false;
  hang.delete(khoa);
  void ghiDb(khoa);
  dat({});
  return true;
}
export function dangKyXuLy(nhom: string, x: XuLy) {
  xuLy.set(nhom, x);
  return () => { if (xuLy.get(nhom) === x) xuLy.delete(nhom); };
}

let dangChay = false;
export async function gui() {
  if (dangChay) return;
  dangChay = true;
  try {
    await nap();
    if (!hang.size) return;
    dat({ dangGui: true });
    while (hang.size) {
      const v = hang.values().next().value as Viec;
      dangGuiKhoa = v.khoa;
      let r: Response;
      try {
        r = await fetch(v.url, { method: v.method, headers: { "content-type": "application/json" }, body: JSON.stringify(v.body) });
      } catch {
        dat({ matMang: true });
        return;
      }
      const kq = await r.json().catch(() => ({}));
      if (r.status === 401) return dat({ hetPhien: true });
      if (r.status >= 500) return dat({ matMang: false, loiMayChu: true });
      if (hang.get(v.khoa) === v) {
        hang.delete(v.khoa);
        void ghiDb(v.khoa);
      } // bị thay trong lúc gửi → để lại, gửi bản mới ở vòng sau
      dangGuiKhoa = null;
      if (r.ok) {
        xuLy.get(v.nhom)?.ok?.(v, kq);
        dat({ matMang: false, loiMayChu: false, daLuuLuc: Date.now() });
      } else {
        xuLy.get(v.nhom)?.loi?.(v, r.status, kq);
        dat({ matMang: false });
      }
    }
  } finally {
    dangGuiKhoa = null;
    dangChay = false;
    dat({ dangGui: false });
  }
}

let daKhoiDong = false;
/** Gọi một lần ở khung quản lý: nghe online/offline, gửi lại mỗi 15 giây, cảnh báo khi đóng tab còn thay đổi. */
export function khoiDongHangDoi() {
  if (daKhoiDong || typeof window === "undefined") return;
  daKhoiDong = true;
  if (!navigator.onLine) dat({ matMang: true });
  window.addEventListener("online", () => { dat({ matMang: false }); void gui(); });
  window.addEventListener("offline", () => dat({ matMang: true }));
  window.addEventListener("beforeunload", (e) => { if (hang.size) e.preventDefault(); });
  setInterval(() => { if (hang.size && !tt.hetPhien) void gui(); }, 15_000);
  void gui();
}

const nghe1 = (f: () => void) => { nghe.add(f); return () => { nghe.delete(f); }; };
export const useHangDoi = () => useSyncExternalStore(nghe1, () => tt, () => BAN_DAU);
export const thuLai = () => { dat({ loiMayChu: false, hetPhien: false }); void gui(); };
