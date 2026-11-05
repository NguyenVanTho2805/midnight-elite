"use client";
import { useState, useEffect } from "react";

export function useEnrollments() {
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  // Lớp em đã vào nhưng đang CHỜ PHỤ HUYNH ĐỒNG Ý (chưa có quyền học): thẻ lớp hiện nhãn thay cho nút theo dõi (2A).
  const [pendingConsentIds, setPendingConsentIds] = useState<Set<string>>(new Set());
  // NO-0511: lớp em đã nghỉ (suspended): thẻ lớp hiện nhãn trung tính thay cho nút theo dõi (POST theo dõi vẫn 409).
  const [suspendedIds, setSuspendedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    fetch("/api/enrollments")
      .then(r => r.json())
      .then(data => {
        setEnrolledIds(new Set((data.courseIds ?? []) as string[]));
        setPendingConsentIds(new Set((data.pendingConsentCourseIds ?? []) as string[]));
        setSuspendedIds(new Set((data.suspendedCourseIds ?? []) as string[]));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { enrolledIds, pendingConsentIds, suspendedIds, loading };
}
