import { prisma } from "@/lib/prisma";

// Ghi nhật ký các hành động đổi quyền/đồng ý (G1.13, P0) — actorId null nghĩa
// là hệ thống tự thực hiện (vd tự động chuyển "expired"). Cố ý nuốt lỗi giống
// notify(): ghi log là tính năng phụ trợ, không được làm hỏng hành động chính.
export async function logAction(
  actorId: string | null,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { actorId, action, resourceType, resourceId, metadata },
    });
  } catch (e) {
    console.error("[logAction] Không ghi được audit log:", e);
  }
}
