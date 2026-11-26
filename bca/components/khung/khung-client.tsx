"use client";
// Nhà cung cấp phía client cho khu quản lý: thanh Hoàn tác dùng chung.
import type { ReactNode } from "react";
import { HoanTacProvider } from "./hoan-tac";

export function KhungClient({ children }: { children: ReactNode }) {
  return <HoanTacProvider>{children}</HoanTacProvider>;
}
