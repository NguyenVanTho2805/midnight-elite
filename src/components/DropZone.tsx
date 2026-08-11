"use client";

import { useRef, useState, type DragEvent, type ReactNode, type CSSProperties } from "react";

// Bọc quanh 1 khu vực (nút, thẻ, cả khối lớn) để nhận file kéo-thả từ máy —
// KHÔNG thay cách bấm-chọn cũ, chỉ thêm 1 đường vào song song. Không tự lọc
// loại file/kích thước — nơi gọi tự validate y hệt logic đã có ở handler
// onChange, chỉ đổi *nguồn* file đầu vào (xem cách dùng ở mỗi nơi gọi: tách
// phần xử lý file thành 1 hàm riêng, dùng chung cho cả onChange và onFiles).
export function DropZone({ onFiles, children, className, style, disabled }: {
  onFiles: (files: File[]) => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  // Đếm dragEnter/dragLeave (không dùng boolean đơn) — tránh nhấp nháy khi
  // con trỏ đi qua các phần tử con bên trong vùng bọc (mỗi phần tử con tự
  // bắn thêm enter/leave riêng, đây là hành vi chuẩn của Drag and Drop API).
  const counter = useRef(0);

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (disabled) return;
    counter.current++;
    setDragging(true);
  }
  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    counter.current = Math.max(0, counter.current - 1);
    if (counter.current === 0) setDragging(false);
  }
  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); // bắt buộc để onDrop chạy
  }
  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    counter.current = 0;
    setDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) onFiles(files);
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={className}
      style={{
        ...style,
        ...(dragging ? { outline: "2px dashed #0068FF", outlineOffset: 2, background: "#eff6ff" } : {}),
      }}
    >
      {children}
    </div>
  );
}
