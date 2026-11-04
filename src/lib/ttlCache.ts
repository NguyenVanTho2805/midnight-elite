// Bộ nhớ đệm có hạn dùng, trong bộ nhớ của từng máy chủ (không chia sẻ giữa các bản chạy của Vercel; mất khi máy chủ khởi động lại — chấp nhận được cho dữ liệu chỉ để GIẢM TẢI
// truy vấn nặng). THUẦN: không DB, không React; giờ hệ thống truyền vào được để kiểm.
// Dùng cho bảng xếp hạng (STU-003): src/app/api/leaderboard, src/app/api/honor-leaderboard. Test: tools/local-e2e/t-ttl-cache-lib.ts.
//
// Quy tắc:
//   - `ttlMs <= 0` = TẮT: get luôn trả undefined, set không lưu gì (dùng ở máy dev / bài kiểm để dữ liệu mới thấy ngay).
//   - Khoá có thể do người gọi API tự đặt (vd. ?category=…) nên bộ đếm có TRẦN `max` khoá: đầy thì bỏ các mục hết hạn, rồi bỏ mục CŨ NHẤT — không để bộ nhớ phình theo khoá lạ.
export interface TtlCache<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
  clear(): void;
  size(): number;
}

export function makeTtlCache<V>(ttlMs: number, opts: { max?: number; now?: () => number } = {}): TtlCache<V> {
  const max = Math.max(1, Math.floor(opts.max ?? 50));
  const now = opts.now ?? Date.now;
  const store = new Map<string, { value: V; at: number }>();
  const off = !(ttlMs > 0);

  const dropExpired = (t: number) => { for (const [k, e] of store) if (t - e.at >= ttlMs) store.delete(k); };

  return {
    get(key) {
      if (off) return undefined;
      const e = store.get(key);
      if (!e) return undefined;
      if (now() - e.at >= ttlMs) { store.delete(key); return undefined; }
      return e.value;
    },
    set(key, value) {
      if (off) return;
      const t = now();
      store.delete(key);                       // đặt lại thì mục này thành MỚI NHẤT (Map giữ thứ tự thêm vào)
      if (store.size >= max) dropExpired(t);
      while (store.size >= max) { const oldest = store.keys().next().value; if (oldest === undefined) break; store.delete(oldest); }
      store.set(key, { value, at: t });
    },
    clear() { store.clear(); },
    size() { return store.size; },
  };
}

/** Số giây giữ đệm: biến môi trường LEADERBOARD_CACHE_SECONDS nếu đặt (0 = tắt); mặc định 60 giây ở production, TẮT ở máy dev / bài kiểm. */
export function leaderboardCacheMs(env: { LEADERBOARD_CACHE_SECONDS?: string; NODE_ENV?: string } = process.env): number {
  const raw = env.LEADERBOARD_CACHE_SECONDS;
  if (raw !== undefined && raw.trim() !== "") {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 300) * 1000 : 0;   // trần 300 giây: quản trị ẩn / cấm học sinh thì chậm nhất 5 phút là hết
  }
  return env.NODE_ENV === "production" ? 60_000 : 0;
}
