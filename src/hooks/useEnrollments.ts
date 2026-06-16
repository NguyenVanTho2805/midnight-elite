"use client";
import { useState, useEffect } from "react";

export function useEnrollments() {
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    fetch("/api/enrollments")
      .then(r => r.json())
      .then(data => setEnrolledIds(new Set((data.courseIds ?? []) as string[])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { enrolledIds, loading };
}
