"use client";
import { useEffect, useState } from "react";

/** Một lớp mà học sinh đang học (NC2-041). Chỉ dữ liệu của chính các lớp em đã vào. */
export interface MyClass { id: string; name: string; instructor: string; category: string; lessonCount: number }

/** Danh sách lớp đã vào, kèm tên — xếp theo lúc vào lớp. `loading` đến khi có kết quả (lỗi mạng coi như chưa có lớp, đúng hành vi cũ của useEnrollments). */
export function useMyClasses() {
  const [classes, setClasses] = useState<MyClass[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    fetch("/api/enrollments?detail=1", { credentials: "same-origin", cache: "no-store" })
      .then(r => (r.ok ? r.json() : { courses: [] }))
      .then((d: { courses?: MyClass[] }) => { if (live) setClasses(Array.isArray(d.courses) ? d.courses : []); })
      .catch(() => {})
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  return { classes, loading };
}
