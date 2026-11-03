import { NextResponse } from "next/server";
import { requirePermission, isNextResponse } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { documentUploadConfig, videoUploadConfig } from "@/lib/mediaStorageServer";
import { usedDocumentBytes } from "@/lib/giaoTrinhServer";
import { DOCUMENT_MAX_BYTES, VIDEO_UPLOAD_NOTICE } from "@/lib/mediaStorage";

// GET /api/media/config — cho màn soạn bài biết có hiện nút "Tải video lên" không, giới hạn bao nhiêu. Chỉ người soạn bài.
export async function GET() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_CURRICULUM);
  if (isNextResponse(auth)) return auth;
  const c = videoUploadConfig();
  const d = documentUploadConfig();
  // BU-02: khối `document` mở rộng; `document.maxBytes` và toàn bộ `video` giữ nguyên hình để VideoUploadBox / màn cũ không vỡ.
  return NextResponse.json(
    {
      video: { enabled: c.enabled, driver: c.driver, maxBytes: c.maxBytes, reason: c.reason, notice: VIDEO_UPLOAD_NOTICE },
      document: { enabled: d.enabled, driver: d.driver, maxBytes: d.enabled ? d.maxBytes : DOCUMENT_MAX_BYTES, exts: d.exts, reason: d.reason, quotaBytes: d.quotaBytes, usedBytes: await usedDocumentBytes(auth.userId) },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
