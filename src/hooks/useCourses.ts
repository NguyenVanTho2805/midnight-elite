"use client";
import { useState, useEffect } from "react";
import { api, type CourseFull, type CourseWithCurriculum } from "@/lib/api";

export function useCourses(params?: Record<string, string>) {
  const [data,    setData]    = useState<CourseFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const key = JSON.stringify(params);
  useEffect(() => {
    setLoading(true);
    api.courses.list(params)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading, error, refetch: () => {
    setLoading(true);
    api.courses.list(params).then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }};
}

export function useCourse(id: string) {
  const [data,    setData]    = useState<CourseWithCurriculum | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.courses.get(id)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  return { data, loading, error };
}
