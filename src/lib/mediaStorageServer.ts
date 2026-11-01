// Phần CHẠY THẬT của kho video (chỉ dùng ở máy chủ): đĩa cục bộ và Cloudinary. Luật giới hạn/cấu hình nằm ở mediaStorage.ts (thuần, có test).
//
// Cloudinary: video đặt ở chế độ "authenticated" (không có địa chỉ công khai). Máy chủ KiN ký yêu cầu tải lên cho trình duyệt (tải thẳng
// lên Cloudinary, không đi qua hàm máy chủ vì giới hạn ~4,5 MB của Vercel) và, khi phát, tự tải về rồi chuyển tiếp (proxy) sau khi đã kiểm quyền,
// để địa chỉ thật không bao giờ lộ cho học sinh.
//   CHƯA CHẠY THẬT với tài khoản Cloudinary (máy này không có khoá): thuật toán ký làm theo tài liệu Cloudinary và có test cho phần thuần;
//   lần đầu bật ở production phải thử tải 1 video nhỏ và phát lại.
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, statSync, createWriteStream, rmSync, openSync, readSync, closeSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { resolveDocumentUploadConfig, resolveVideoUploadConfig, safeFileName, type DocumentUploadConfig, type VideoUploadConfig } from "./mediaStorage";

export const videoUploadConfig = (): VideoUploadConfig => resolveVideoUploadConfig(process.env as Record<string, string | undefined>);
/** BU-02: cấu hình tải TÀI LIỆU lên KiN (độc lập với cờ KIN_VIDEO_UPLOAD của video). */
export const documentUploadConfig = (): DocumentUploadConfig => resolveDocumentUploadConfig(process.env as Record<string, string | undefined>);

// ── Đĩa cục bộ ──────────────────────────────────────────────────────────────

export function localMediaRoot(): string {
  return resolve(process.env.KIN_MEDIA_DIR || join(process.cwd(), ".kin-media"));
}

/** Đường dẫn tuyệt đối của một khoá lưu; ném lỗi nếu khoá thoát ra khỏi thư mục kho (chống ../). */
export function localPathFor(storageKey: string): string {
  const root = localMediaRoot();
  const full = resolve(root, storageKey);
  if (full !== root && !full.startsWith(root + sep)) throw new Error("Khoá lưu không hợp lệ");
  return full;
}

export const localKeyFor = (courseId: string, assetId: string, fileName: string): string =>
  `${courseId.replace(/[^A-Za-z0-9_-]/g, "_")}/${assetId}-${safeFileName(fileName)}`;

export function ensureDirFor(path: string): void {
  mkdirSync(join(path, ".."), { recursive: true });
}

/** Ghi luồng vào đĩa, DỪNG ngay khi vượt `maxBytes` (không tin Content-Length). Trả số byte, hoặc "too_big" (đã xoá tệp dở). */
export async function writeStreamLimited(body: ReadableStream<Uint8Array>, path: string, maxBytes: number): Promise<number | "too_big"> {
  ensureDirFor(path);
  const out = createWriteStream(path, { flags: "w" });
  let total = 0;
  const reader = body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel().catch(() => {}); out.destroy(); rmSync(path, { force: true }); return "too_big"; }
      if (!out.write(value)) await new Promise<void>(r => out.once("drain", () => r()));
    }
    await new Promise<void>((res, rej) => { out.end(() => res()); out.on("error", rej); });
    return total;
  } catch (e) {
    out.destroy(); rmSync(path, { force: true });
    throw e;
  }
}

export function openLocalRange(path: string, range: { start: number; end: number } | null): { body: ReadableStream; size: number; start: number; end: number } | null {
  if (!existsSync(path)) return null;
  const size = statSync(path).size;
  const start = range?.start ?? 0, end = range?.end ?? size - 1;
  const node = createReadStream(path, { start, end });
  return { body: Readable.toWeb(node) as unknown as ReadableStream, size, start, end };
}

/** Đọc tối đa `n` byte ĐẦU của tệp cục bộ (để kiểm magic bytes); tệp không có ⇒ null. */
export function readLocalHead(path: string, n: number): Uint8Array | null {
  if (!existsSync(path)) return null;
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(n);
    const got = readSync(fd, buf, 0, n, 0);
    return new Uint8Array(buf.subarray(0, got));
  } finally { closeSync(fd); }
}
/** Kích thước tệp cục bộ trên đĩa; không có ⇒ null. */
export function statLocalBytes(path: string): number | null {
  try { return existsSync(path) ? statSync(path).size : null; } catch { return null; }
}

export function removeLocal(storageKey: string): void {
  try { rmSync(localPathFor(storageKey), { force: true }); } catch { /* đã mất thì thôi */ }
}

// ── Cloudinary ──────────────────────────────────────────────────────────────

export interface CloudinaryEnv { cloud: string; apiKey: string; apiSecret: string }
export function cloudinaryEnv(): CloudinaryEnv | null {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME, apiKey = process.env.CLOUDINARY_API_KEY, apiSecret = process.env.CLOUDINARY_API_SECRET;
  return cloud && apiKey && apiSecret ? { cloud, apiKey, apiSecret } : null;
}

/** Chữ ký tải lên (tài liệu Cloudinary): sha1 của các tham số theo thứ tự chữ cái "k=v&k=v" nối với api_secret. Không ký file, api_key, resource_type. */
export function signCloudinaryParams(params: Record<string, string>, apiSecret: string): string {
  const base = Object.keys(params).filter(k => params[k] !== "" && !["file", "api_key", "resource_type", "cloud_name"].includes(k)).sort().map(k => `${k}=${params[k]}`).join("&");
  return createHash("sha1").update(base + apiSecret).digest("hex");
}

export const cloudinaryPublicId = (courseId: string, assetId: string): string => `kin-lessons/${courseId.replace(/[^A-Za-z0-9_-]/g, "_")}/${assetId}`;

export function cloudinaryUploadInit(env: CloudinaryEnv, publicId: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const params = { public_id: publicId, timestamp: String(nowSeconds), type: "authenticated" };
  return {
    method: "POST" as const,
    url: `https://api.cloudinary.com/v1_1/${env.cloud}/video/upload`,
    fields: { ...params, api_key: env.apiKey, signature: signCloudinaryParams(params, env.apiSecret) },
  };
}

export const cloudinaryDocPublicId = (courseId: string, assetId: string, ext: string): string =>
  `kin-docs/${courseId.replace(/[^A-Za-z0-9_-]/g, "_")}/${assetId}.${ext.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;

/** Chỉ dẫn tải TÀI LIỆU lên Cloudinary: resource_type=raw, type=authenticated (KHÔNG có địa chỉ công khai, khác preset không ký của trang quản trị cũ). Có ký, nên máy chủ KiN quyết public_id. */
export function cloudinaryDocUploadInit(env: CloudinaryEnv, publicId: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  const params = { overwrite: "false", public_id: publicId, timestamp: String(nowSeconds), type: "authenticated" }; // overwrite=false: chữ ký dùng lại không ghi đè tệp đã kiểm
  return {
    method: "POST" as const,
    url: `https://api.cloudinary.com/v1_1/${env.cloud}/raw/upload`,
    fields: { ...params, api_key: env.apiKey, signature: signCloudinaryParams(params, env.apiSecret) },
  };
}

/** Địa chỉ đã ký để máy chủ KiN tải tệp "raw authenticated" (public_id của raw đã gồm đuôi). Chữ ký giống video: 8 ký tự đầu base64url(sha1(public_id + secret)). */
export function cloudinarySignedRawUrl(env: CloudinaryEnv, publicId: string): string {
  const sig = createHash("sha1").update(publicId + env.apiSecret).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").slice(0, 8);
  return `https://res.cloudinary.com/${env.cloud}/raw/authenticated/s--${sig}--/${publicId}`;
}

/** Xoá tệp trên Cloudinary (best-effort: lỗi mạng chỉ ghi log, không ném). Dùng khi tệp sai nội dung/vượt trần hoặc chủ xoá tệp chưa dùng. */
export async function cloudinaryDestroy(env: CloudinaryEnv, publicId: string, resourceType: "raw" | "video" = "raw", nowSeconds = Math.floor(Date.now() / 1000)): Promise<boolean> {
  const params = { public_id: publicId, timestamp: String(nowSeconds), type: "authenticated" };
  const body = new URLSearchParams({ ...params, api_key: env.apiKey, signature: signCloudinaryParams(params, env.apiSecret) });
  try {
    const r = await fetch(`https://api.cloudinary.com/v1_1/${env.cloud}/${resourceType}/destroy`, { method: "POST", body, cache: "no-store" });
    return r.ok;
  } catch (e) { console.error("[cloudinaryDestroy]", publicId, e); return false; }
}

/** Đọc `n` byte ĐẦU của tệp raw authenticated bằng Range qua địa chỉ đã ký (để kiểm magic bytes). Lỗi/không thấy ⇒ null. */
export async function cloudinaryReadHead(env: CloudinaryEnv, publicId: string, n: number): Promise<Uint8Array | null> {
  try {
    const r = await fetch(cloudinarySignedRawUrl(env, publicId), { headers: { Range: `bytes=0-${n - 1}` }, cache: "no-store" });
    if (!r.ok && r.status !== 206) return null;
    const buf = new Uint8Array(await r.arrayBuffer());
    return buf.subarray(0, n);
  } catch { return null; }
}

/** Địa chỉ phát đã ký cho video "authenticated": chữ ký = 8 ký tự đầu của base64url(sha1(public_id + secret)). */
export function cloudinarySignedVideoUrl(env: CloudinaryEnv, publicId: string, format: string): string {
  const sig = createHash("sha1").update(publicId + env.apiSecret).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").slice(0, 8);
  return `https://res.cloudinary.com/${env.cloud}/video/authenticated/s--${sig}--/${publicId}.${format.replace(/[^a-z0-9]/gi, "").toLowerCase() || "mp4"}`;
}

/** Hỏi Admin API xem video đã thật sự có trên Cloudinary và nặng bao nhiêu (không tin con số trình duyệt gửi lên). */
export async function cloudinaryVerify(env: CloudinaryEnv, publicId: string, resourceType: "video" | "raw" = "video"): Promise<{ bytes: number; format: string } | null> {
  const auth = "Basic " + Buffer.from(`${env.apiKey}:${env.apiSecret}`).toString("base64");
  const url = `https://api.cloudinary.com/v1_1/${env.cloud}/resources/${resourceType}/authenticated/${publicId.split("/").map(encodeURIComponent).join("/")}`;
  try {
    const r = await fetch(url, { headers: { Authorization: auth }, cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json() as { bytes?: number; format?: string };
    return typeof j.bytes === "number" ? { bytes: j.bytes, format: j.format ?? (resourceType === "video" ? "mp4" : "") } : null;
  } catch { return null; }
}
