// Mục nào của thanh bên đang được chọn khi người dùng đứng ở một đường dẫn. THUẦN (không đụng React / DOM) để test.
//
// Vì sao cần: nhiều mục của thanh bên là BÍ DANH — /student/thi-thu, /student/bang-xep-hang, /student/hoi-dap, /student/cong-dong, /student/tin-tuc chỉ chuyển tới trang công khai
// (/thi-thu, /bang-xep-hang, /cong-dong, /tin-tuc) và mở TRONG khung học sinh. Sau khi chuyển, đường dẫn không còn bắt đầu bằng href của mục nên không mục nào sáng.
// Mỗi mục khai thêm `also` = đường dẫn đích; và trong MỘT nhóm chỉ mục khớp DÀI NHẤT được sáng ("Hỏi đáp" /cong-dong/hoi-dap thắng "Cộng đồng" /cong-dong).
export interface NavMatchable { href: string; also?: readonly string[]; active?: boolean }

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(base + "/");

/** Độ dài đường dẫn khớp dài nhất của mục với `pathname` (0 = không khớp). Phần "#neo" của href bị bỏ. */
export function matchLen(pathname: string, item: NavMatchable): number {
  let best = 0;
  for (const p of [item.href.split("#")[0], ...(item.also ?? [])]) if (p && under(pathname, p)) best = Math.max(best, p.length);
  return best;
}

/** Chỉ số mục sáng trong một nhóm (-1 = không mục nào). Mục đã tự khai `active` (true/false) do nơi gọi quyết, không dự phần so đường dẫn; còn lại: khớp dài nhất thắng, bằng nhau thì mục đứng trước. */
export function activeIndex(pathname: string, items: readonly NavMatchable[]): number {
  let win = -1, len = 0;
  items.forEach((it, i) => {
    if (it.active !== undefined) return;
    const n = matchLen(pathname, it);
    if (n > len) { len = n; win = i; }
  });
  return win;
}
