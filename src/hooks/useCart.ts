"use client";
import { useState, useEffect, useCallback } from "react";

export interface CartCourse {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice: number | null;
  bg: string;
  instructor: string;
  lessons: number;
  hours: number;
}

export interface CartItem {
  courseId: string;
  createdAt: string;
  course: CartCourse;
}

export function useCart() {
  const [items, setItems]   = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    fetch("/api/cart")
      .then(r => r.json())
      .then(d => setItems(Array.isArray(d.items) ? d.items : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const addToCart = useCallback(async (courseId: string) => {
    const res = await fetch(`/api/cart/${courseId}`, { method: "POST" });
    if (res.ok) reload();
    return res;
  }, [reload]);

  const removeFromCart = useCallback((courseId: string) => {
    setItems(prev => prev.filter(i => i.courseId !== courseId));
    fetch(`/api/cart/${courseId}`, { method: "DELETE" }).catch(() => reload());
  }, [reload]);

  const inCart = useCallback(
    (courseId: string) => items.some(i => i.courseId === courseId),
    [items],
  );

  return { items, loading, addToCart, removeFromCart, inCart, reload };
}
