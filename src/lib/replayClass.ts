// Chạy lại một hoạt hình CSS từ đầu bằng cách gỡ rồi gắn lại lớp (ép tính lại bố cục giữa hai lần); tự gỡ khi hoạt hình chạy xong.
// Gắn lớp thẳng lên DOM — không qua state — nên không dựng lại thành phần chỉ để phát một hiệu ứng.
export function replayClass(el: HTMLElement | null, cls: string): void {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  el.addEventListener("animationend", () => el.classList.remove(cls), { once: true });
}
