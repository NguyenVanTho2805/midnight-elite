"use client";
import { useState, useEffect } from "react";
import { api, type ExamFull } from "@/lib/api";

export function useExams(params?: Record<string, string>) {
  const [data,    setData]    = useState<ExamFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const key = JSON.stringify(params);
  useEffect(() => {
    setLoading(true);
    api.exams.list(params)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const refetch = () => {
    setLoading(true);
    api.exams.list(params).then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  };

  return { data, loading, error, refetch };
}
