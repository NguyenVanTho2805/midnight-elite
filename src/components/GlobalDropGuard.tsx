"use client";

import { useEffect } from "react";

// Lưới an toàn toàn trang: nếu người dùng thả file lệch ra ngoài đúng vùng
// DropZone (dù chỉ vài pixel — dễ xảy ra vì các khung kéo-thả có viền/đệm),
// trình duyệt sẽ tự làm theo hành vi mặc định của nó — cố mở file đó như 1
// trang mới hoặc điều hướng rời khỏi trang hiện tại, trông y hệt "kéo-thả
// không hoạt động". Bắt ở cấp window, giai đoạn bubble (chạy SAU handler của
// từng DropZone/kéo-thả sắp xếp bài học — không đụng gì tới các handler đó,
// preventDefault() gọi lại ở đây là vô hại nếu đã bị chặn từ trước) — chỉ
// chặn hành vi mặc định của trình duyệt cho những lần thả KHÔNG rơi trúng
// bất kỳ vùng nào đã xử lý.
export function GlobalDropGuard() {
  useEffect(() => {
    function preventDefault(e: DragEvent) {
      e.preventDefault();
    }
    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", preventDefault);
    return () => {
      window.removeEventListener("dragover", preventDefault);
      window.removeEventListener("drop", preventDefault);
    };
  }, []);

  return null;
}
