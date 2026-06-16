// Simple in-memory rate limiter — reset every window
interface Entry { count: number; resetAt: number }
const store = new Map<string, Entry>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }

  if (entry.count >= max) return false; // blocked

  entry.count++;
  return true; // allowed
}

// Lấy IP client từ x-forwarded-for: client có thể tự thêm IP giả vào đầu chuỗi,
// nên lấy IP CUỐI CÙNG — IP do reverse proxy gắn vào, đáng tin hơn.
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (!xff) return req.headers.get("x-real-ip") ?? "unknown";
  const parts = xff.split(",").map(s => s.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? "unknown";
}

// Helper: trả về NextResponse 429 nếu bị block
import { NextResponse } from "next/server";
export function limitOrBlock(
  ip: string, route: string, max = 10, windowMs = 60_000
): NextResponse | null {
  const key = `${route}:${ip}`;
  if (!rateLimit(key, max, windowMs)) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Vui lòng thử lại sau." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(windowMs / 1000)) } }
    );
  }
  return null;
}
