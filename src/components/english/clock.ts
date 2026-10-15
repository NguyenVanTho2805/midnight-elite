// Đồng hồ cho các bộ đếm thời gian học — gọi trong trình xử lý sự kiện / effect, không gọi trong lúc render.
export const nowMs = (): number => Date.now();
export const secondsSince = (start: number): number => (start ? Math.round((Date.now() - start) / 1000) : 0);
