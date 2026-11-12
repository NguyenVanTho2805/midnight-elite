// LOI-07 (11/11/2026) — <script> khởi tạo chạy TRƯỚC khi vẽ (chủ đề, bề rộng thanh bên, gợi ý vỏ, tên miền admin), đặt ở đầu <body> của layout gốc.
//
// Vì sao không để <script> thường / next/script ngay trong layout: React 19 chỉ chạy <script> có trong HTML máy chủ gửi về. Khi React phải DỰNG LẠI cây gốc ở trình duyệt
// (vd. trang con gọi notFound() → trang 404 trong nhóm (tutor)/(parent)), nó tạo lại thẻ <script> mà không bao giờ chạy và bản dev báo console.error
// "Encountered a script tag while rendering React component". next/script `beforeInteractive` cũng dựng một <script> như vậy (self.__next_s.push…), nên bị cùng lỗi.
//
// Cách ở đây: máy chủ (SSR) in <script> thường → trình duyệt chạy ngay khi đọc HTML, đồng bộ, trước khung hình đầu (sớm hơn cả beforeInteractive, vốn đợi mã khởi động của Next).
// Ở trình duyệt, React chỉ còn GIỮ thẻ đó (lúc hydrate) hoặc tạo lại nó (lúc dựng lại cây) — cả hai trường hợp script không chạy lần nữa, nên khai đúng sự thật bằng
// type="application/json" (khối dữ liệu, React không cảnh báo). Lệch thuộc tính `type` giữa máy chủ và trình duyệt là cố ý: suppressHydrationWarning, và React không vá
// thuộc tính lúc hydrate nên thẻ trong DOM vẫn là thẻ đã chạy. Hành vi không đổi so với trước: thẻ do trình duyệt tạo lại vốn cũng không bao giờ chạy.
"use client";

export default function InitScript({ code }: { /** Một dòng JS, không chứa "</script" (các hằng *_INIT_SCRIPT ở src/lib đã kiểm điều này trong t-rail-lib / t-tutor-gate-lib). */ code: string }) {
  const onClient = typeof window !== "undefined";
  return <script suppressHydrationWarning type={onClient ? "application/json" : undefined} dangerouslySetInnerHTML={{ __html: code }} />;
}
