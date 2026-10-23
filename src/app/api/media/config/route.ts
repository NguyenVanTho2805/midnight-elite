import { NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { videoUploadConfig } from "@/lib/mediaStorageServer";
import { DOCUMENT_MAX_BYTES, VIDEO_UPLOAD_NOTICE } from "@/lib/mediaStorage";

// GET /api/media/config — cho màn soạn bài biết có hiện nút "Tải video lên" không, giới hạn bao nhiêu. Chỉ người soạn bài.
export async function GET() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;
  const c = videoUploadConfig();
  return NextResponse.json(
    { video: { enabled: c.enabled, driver: c.driver, maxBytes: c.maxBytes, reason: c.reason, notice: VIDEO_UPLOAD_NOTICE }, document: { maxBytes: DOCUMENT_MAX_BYTES } },
    { headers: { "Cache-Control": "no-store" } },
  );
}
