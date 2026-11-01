// HOME-02 — đọc / sửa nội dung trang chủ công khai (bảng site_content, khoá "home"). Quyền MANAGE_NEWS (admin_super, admin_content; gia sư KHÔNG có).
//   GET → nội dung đang dùng + bản mặc định + ai sửa lần cuối
//   PUT → kiểm phía máy chủ (cấu trúc + giới hạn + đường dẫn + cụm cấm + số ô/thẻ), chống ghi đè mù (409), nhật ký chỉ ghi TÊN trường, rồi revalidatePath("/")
// Chữ luôn là chữ thuần (React tự thoát ký tự khi vẽ); không có đường nào để chèn HTML.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNextResponse, requirePermission } from "@/lib/auth-guard";
import { PERMISSIONS } from "@/lib/permissions";
import { logAction } from "@/lib/auditLog";
import { DEFAULT_HOME_CONTENT, HOME_CONTENT_KEY, parseHomeContent, validateHomeContent, type HomeContent } from "@/lib/siteContent";
import { revalidateHome } from "@/lib/siteContentServer";
import { checkHomeClaims, checkHomeCounts, diffHomeContent } from "@/lib/homeContentGuard";

export const dynamic = "force-dynamic";
const MAX_BYTES = 32 * 1024;

type Row = { data: unknown; updatedAt: Date; updatedBy: string | null } | null;

async function updatedByOf(id: string | null): Promise<{ name: string } | null> {
  if (!id) return null;
  const u = await prisma.user.findUnique({ where: { id }, select: { name: true } });
  return u ? { name: u.name } : null;
}

const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function GET() {
  const auth = await requirePermission(PERMISSIONS.MANAGE_NEWS);
  if (isNextResponse(auth)) return auth;
  try {
    const row: Row = await prisma.siteContent.findUnique({ where: { key: HOME_CONTENT_KEY }, select: { data: true, updatedAt: true, updatedBy: true } });
    const isDefault = !row || !validateHomeContent(row.data).ok;
    return NextResponse.json({
      content: parseHomeContent(row?.data ?? null),
      defaults: DEFAULT_HOME_CONTENT,
      isDefault,
      updatedAt: row ? row.updatedAt.toISOString() : null,
      updatedBy: row ? await updatedByOf(row.updatedBy) : null,
    });
  } catch (e) {
    console.error("[site-content/home GET]", e instanceof Error ? e.message.split("\n").pop() : e);
    return fail(500, "Không tải được nội dung trang chủ. Thử lại sau.");
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requirePermission(PERMISSIONS.MANAGE_NEWS);
  if (isNextResponse(auth)) return auth;

  const declared = Number(req.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BYTES) return fail(413, "Nội dung quá dài (tối đa 32 KB).");
  const text = await req.text().catch(() => "");
  if (Buffer.byteLength(text, "utf8") > MAX_BYTES) return fail(413, "Nội dung quá dài (tối đa 32 KB).");
  let body: unknown;
  try { body = JSON.parse(text); } catch { return fail(400, "Dữ liệu gửi lên không đọc được."); }
  if (!body || typeof body !== "object" || Array.isArray(body) || !("content" in body)) return fail(400, "Thiếu phần nội dung.");
  const { content: raw, baseUpdatedAt } = body as { content: unknown; baseUpdatedAt?: unknown };
  if (baseUpdatedAt !== null && typeof baseUpdatedAt !== "string") return fail(400, "Thiếu mốc thời gian của bản đang sửa (baseUpdatedAt).");

  // Cấu trúc → số ô/thẻ → cụm cấm. Gom hết lỗi để người sửa thấy một lượt.
  const counts = checkHomeCounts(raw);
  const v = validateHomeContent(raw);
  const issues = [...counts, ...(v.ok ? [] : v.issues)];
  if (v.ok) issues.push(...checkHomeClaims(v.value));
  if (issues.length > 0 || !v.ok) {
    const fields: Record<string, string> = {};
    for (const i of issues) if (!(i.path in fields)) fields[i.path] = i.message;
    return NextResponse.json({ error: "invalid", fields }, { status: 422 });
  }
  const next: HomeContent = v.value;

  try {
    const row: Row = await prisma.siteContent.findUnique({ where: { key: HOME_CONTENT_KEY }, select: { data: true, updatedAt: true, updatedBy: true } });
    const curIso = row ? row.updatedAt.toISOString() : null;
    const conflict = async () => {
      const cur: Row = await prisma.siteContent.findUnique({ where: { key: HOME_CONTENT_KEY }, select: { data: true, updatedAt: true, updatedBy: true } });
      return NextResponse.json({
        error: "conflict",
        current: { content: parseHomeContent(cur?.data ?? null), updatedAt: cur ? cur.updatedAt.toISOString() : null, updatedBy: cur ? await updatedByOf(cur.updatedBy) : null },
      }, { status: 409 });
    };
    if (baseUpdatedAt !== curIso) return await conflict();

    const before = parseHomeContent(row?.data ?? null);
    const changed = diffHomeContent(before, next);
    if (changed.length === 0) return NextResponse.json({ ok: true, unchanged: true, updatedAt: curIso });

    // Ghi có điều kiện: hàng đã có → chỉ cập nhật khi updatedAt vẫn đúng mốc đã so (hai người lưu cùng lúc thì một người thua → 409);
    // hàng chưa có → tạo (khoá chính trùng = có người vừa tạo → 409).
    const now = new Date();
    if (row) {
      const r = await prisma.siteContent.updateMany({
        where: { key: HOME_CONTENT_KEY, updatedAt: row.updatedAt },
        data: { data: next as unknown as object, updatedAt: now, updatedBy: auth.userId },
      });
      if (r.count !== 1) return await conflict();
    } else {
      try { await prisma.siteContent.create({ data: { key: HOME_CONTENT_KEY, data: next as unknown as object, updatedAt: now, updatedBy: auth.userId } }); }
      catch (e) {
        if ((e as { code?: string })?.code === "P2002") return await conflict();
        throw e;
      }
    }
    // Nhật ký: CHỈ tên trường đã đổi, không chép chữ cũ / mới.
    await logAction(auth.userId, "site_content.update", "SiteContent", HOME_CONTENT_KEY, { fields: changed, count: changed.length });
    let revalidated = true;
    try { revalidateHome(); } catch { revalidated = false; }
    return NextResponse.json({ ok: true, content: next, updatedAt: now.toISOString(), changedFields: changed, revalidated });
  } catch (e) {
    console.error("[site-content/home PUT]", e instanceof Error ? e.message.split("\n").pop() : e);
    return fail(500, "Chưa lưu được. Thử lại sau.");
  }
}
