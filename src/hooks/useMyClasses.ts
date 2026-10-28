"use client";
import { useCallback, useEffect, useState } from "react";

/** Một lớp mà học sinh đang học (NC2-041). Chỉ dữ liệu của chính các lớp em đã vào. */
export interface MyClass { id: string; name: string; instructor: string; category: string; lessonCount: number }

/**
 * Danh sách lớp đã vào, kèm tên — xếp theo lúc vào lớp. `loading` đến khi có kết quả.
 * `error` = không tải được (mạng hoặc máy chủ lỗi): trang phải nói "không tải được" và cho thử lại, KHÔNG được coi là "chưa vào lớp nào"
 * (rà soát độc lập 28/10: lỗi API từng hiện câu "Bạn chưa vào lớp nào" kèm nút Nhập mã lớp). `reload` tải lại.
 */
export function useMyClasses() {
  const [classes, setClasses] = useState<MyClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    void Promise.resolve().then(() => { if (live) { setLoading(true); setError(false); } });
    fetch("/api/enrollments?detail=1", { credentials: "same-origin", cache: "no-store" })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { courses?: MyClass[] }) => { if (live) setClasses(Array.isArray(d.courses) ? d.courses : []); })
      .catch(() => { if (live) { setClasses([]); setError(true); } })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [tick]);
  const reload = useCallback(() => setTick(t => t + 1), []);
  return { classes, loading, error, reload };
}
