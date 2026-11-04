"use client";
import { useState, useEffect } from "react";

export function useEnrollments() {
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  // Lớp em đã vào nhưng đang CHỜ PHỤ HUYNH ĐỒNG Ý (chưa có quyền học): thẻ lớp hiện nhãn thay cho nút theo dõi (2A).
  const [pendingConsentIds, setPendingConsentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    fetch("/api/enrollments")
      .then(r => r.json())
      .then(data => {
        setEnrolledIds(new Set((data.courseIds ?? []) as string[]));
        setPendingConsentIds(new Set((data.pendingConsentCourseIds ?? []) as string[]));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { enrolledIds, pendingConsentIds, loading };
}
