"use client";
import { useState, useEffect, useCallback } from "react";

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

const POLL_INTERVAL = 30_000;

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [loading, setLoading]             = useState(true);

  const refetch = useCallback(() => {
    return fetch("/api/notifications")
      .then(r => r.json())
      .then(data => {
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refetch().finally(() => setLoading(false));
    const interval = setInterval(refetch, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [refetch]);

  function markAsRead(id: string) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    fetch(`/api/notifications/${id}/read`, { method: "POST" }).catch(() => {});
  }

  function markAllAsRead() {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
    fetch("/api/notifications/read-all", { method: "POST" }).catch(() => {});
  }

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refetch };
}
