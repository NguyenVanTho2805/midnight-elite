"use client";
import { useState, useEffect, useCallback } from "react";

// Lớp học viên đang theo dõi (BE-079) — thay cho giỏ hàng cũ (useCart).
export interface FollowedCourse {
  id: string;
  name: string;
  category: string;
  bg: string;
  instructor: string;
  lessons: number;
  hours: number;
  classStatus: string; // "open" | "closed" | "paused"
}

export interface FollowedItem {
  courseId: string;
  createdAt: string;
  course: FollowedCourse;
}

export function useFollowedCourses() {
  const [items, setItems]     = useState<FollowedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    fetch("/api/followed-courses")
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const follow = useCallback(async (courseId: string) => {
    const res = await fetch(`/api/followed-courses/${encodeURIComponent(courseId)}`, { method: "POST" });
    if (res.ok) reload();
    return res;
  }, [reload]);

  const unfollow = useCallback((courseId: string) => {
    setItems(prev => prev.filter(i => i.courseId !== courseId));
    fetch(`/api/followed-courses/${encodeURIComponent(courseId)}`, { method: "DELETE" }).catch(() => reload());
  }, [reload]);

  const isFollowing = useCallback(
    (courseId: string) => items.some(i => i.courseId === courseId),
    [items],
  );

  return { items, loading, follow, unfollow, isFollowing, reload };
}
