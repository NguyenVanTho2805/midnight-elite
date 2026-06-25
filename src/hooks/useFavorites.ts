"use client";
import { useState, useEffect, useCallback } from "react";

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    fetch("/api/favorites")
      .then(r => r.json())
      .then(data => setFavoriteIds(new Set((data.courseIds ?? []) as string[])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleFavorite = useCallback((courseId: string) => {
    // Optimistic update — đảo trạng thái ngay, rollback nếu request lỗi
    setFavoriteIds(prev => {
      const next = new Set(prev);
      next.has(courseId) ? next.delete(courseId) : next.add(courseId);
      return next;
    });

    fetch(`/api/favorites/${courseId}`, { method: "POST" })
      .then(r => r.ok ? r.json() : Promise.reject())
      .catch(() => {
        setFavoriteIds(prev => {
          const next = new Set(prev);
          next.has(courseId) ? next.delete(courseId) : next.add(courseId);
          return next;
        });
      });
  }, []);

  return { favoriteIds, loading, toggleFavorite };
}
