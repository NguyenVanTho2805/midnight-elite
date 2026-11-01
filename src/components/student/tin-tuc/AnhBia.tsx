"use client";
// Ảnh bìa tin: link ngoài có thể hết hạn → ảnh lỗi thì bỏ cả khung, bài vẫn đọc bình thường (NC2-051).
import { useState } from "react";

export function AnhBia({ src, alt, className = "", contain = false, marker = false }: {
  src: string | null; alt: string; className?: string;
  /** Giữ tỉ lệ gốc, không cắt (trang bài). */
  contain?: boolean;
  /** Gắn data-article-cover (trang bài). */
  marker?: boolean;
}) {
  const [loi, setLoi] = useState(false);
  // Ảnh có thể lỗi TRƯỚC khi React gắn onError (HTML dựng sẵn từ máy chủ) → kiểm lại sau khi gắn.
  if (!src || loi) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- link ngoài do quản trị nhập; không qua trình tối ưu ảnh của Next
    <img
      ref={(i) => { if (i && i.complete && i.naturalWidth === 0) setLoi(true); }} src={src} alt={alt} referrerPolicy="no-referrer" loading="lazy" onError={() => setLoi(true)}
      {...(marker ? { "data-article-cover": "" } : {})}
      style={contain ? { maxHeight: 560 } : undefined}
      className={contain ? `h-auto max-w-full ${className}` : `h-full w-full object-cover ${className}`}
    />
  );
}
