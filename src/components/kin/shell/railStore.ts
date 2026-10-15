// Phần chạm trình duyệt của trạng thái thu/mở thanh bên (phần thuần: src/lib/railState.ts).
// NGUỒN SỰ THẬT là thuộc tính data-kin-rail trên <html>: CSS đọc nó để ẩn/hiện thanh (kể cả trước khi React chạy, nhờ RAIL_INIT_SCRIPT ở layout gốc),
// còn các thành phần React nghe sự kiện "kin-rail" để cập nhật nút bấm và aria.
"use client";
import { useSyncExternalStore } from "react";
import { RAIL_ATTR, RAIL_KEY, RAIL_OPEN_KEY, reopenRail, type RailOpen, type RailState } from "@/lib/railState";

const EVENT = "kin-rail";

export function readRail(): RailState {
  if (typeof document === "undefined") return "mo";
  const a = document.documentElement.getAttribute(RAIL_ATTR);
  return a === "thu" ? "thu" : a === "rong" ? "rong" : "mo";
}

/** Áp lên <html> và báo cho các thành phần đang nghe. Không lưu gì. */
export function applyRail(s: RailState): void {
  const html = document.documentElement;
  if (s === "mo") html.removeAttribute(RAIL_ATTR); else html.setAttribute(RAIL_ATTR, s);
  window.dispatchEvent(new Event(EVENT));
}

export function saveRailLocal(s: RailState): void {
  try {
    localStorage.setItem(RAIL_KEY, s);
    if (s !== "thu") localStorage.setItem(RAIL_OPEN_KEY, s); // nhớ bề rộng MỞ gần nhất để thu rồi mở lại về đúng chỗ
  } catch { /* chế độ riêng tư / bị chặn: bỏ qua, lần sau mặc định là hiện */ }
}

/** Bề rộng để mở lại thanh sau khi thu ("mo" 79px hoặc "rong" 220px — cái đã dùng lần trước). */
export function lastOpenRail(): RailOpen {
  try { return reopenRail(localStorage.getItem(RAIL_OPEN_KEY)); } catch { return "mo"; }
}

/** Ghi lên tài khoản (không chờ, không báo lỗi: máy đã áp rồi). Chỉ gọi khi đã đăng nhập — các vỏ chỉ có khi đã đăng nhập. */
export function saveRailToAccount(s: RailState): void {
  void fetch("/api/users/me/preferences", {
    method: "PUT", credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rail: s }),
  }).catch(() => {});
}

/** Người dùng chủ động thu/mở: áp ngay, nhớ ở máy (để lần tải sau không nháy) và nhớ ở tài khoản (để máy khác cũng vậy). */
export function chooseRail(s: RailState): void {
  applyRail(s);
  saveRailLocal(s);
  saveRailToAccount(s);
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
}

export function useRail(): [RailState, (s: RailState) => void] {
  const state = useSyncExternalStore(subscribe, readRail, () => "mo" as RailState);
  return [state, chooseRail];
}
