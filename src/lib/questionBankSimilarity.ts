import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeQuestionText } from "@/lib/questionDedup";

// Ngưỡng similarity() của pg_trgm (0-1) — dưới mức này coi là không đáng báo,
// tránh làm phiền với những câu chỉ tình cờ dùng chung vài từ khoá.
const SIMILARITY_THRESHOLD = 0.35;
const MAX_RESULTS = 5;

// Giai đoạn 3.5 Cấp 2 — phát hiện trùng GIỐNG CHUỖI (lỗi chính tả, đổi vài
// từ, đảo câu...) bằng pg_trgm.similarity(), khác Cấp 1 (chỉ bắt trùng Y HỆT
// tuyệt đối qua hash). Vẫn giữ nguyên "tối ưu bắt buộc" của tài liệu thiết
// kế: LUÔN thu hẹp theo subject+topic trước khi so — pg_trgm không rẻ bằng
// tra hash nên càng cần thu hẹp phạm vi. Chỉ gọi khi Cấp 1 KHÔNG tìm thấy
// trùng y hệt (route gọi hàm này có điều kiện, xem check-duplicate/route.ts)
// — tránh lãng phí 1 truy vấn khi đã có câu trả lời chắc chắn hơn.
//
// Yêu cầu hạ tầng: extension pg_trgm + index GIN trên lower("text") — đã bật
// thủ công 1 lần trên DB (CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE
// INDEX ... USING gin (lower("text") gin_trgm_ops)), KHÔNG khai báo trong
// schema.prisma (dự án dùng `db push`, không quản lý extension qua Prisma).
export async function findSimilarBankItems(opts: {
  text: string; subject: string; topic: string;
  userId: string; isReviewer: boolean;
}) {
  const normalized = normalizeQuestionText(opts.text);
  const statusFilter = opts.isReviewer
    ? Prisma.sql`TRUE`
    : Prisma.sql`("status" = 'approved' OR "ownerId" = ${opts.userId})`;

  const rows = await prisma.$queryRaw<{ id: string; similarity: number }[]>(Prisma.sql`
    SELECT "id", similarity(lower("text"), ${normalized}) AS similarity
    FROM "question_bank_items"
    WHERE "subject" = ${opts.subject} AND "topic" = ${opts.topic} AND ${statusFilter}
      AND similarity(lower("text"), ${normalized}) > ${SIMILARITY_THRESHOLD}
    ORDER BY similarity DESC
    LIMIT ${MAX_RESULTS}
  `);
  if (rows.length === 0) return [];

  const items = await prisma.questionBankItem.findMany({
    where: { id: { in: rows.map(r => r.id) } },
    include: { options: { orderBy: { order: "asc" } }, owner: { select: { name: true } } },
  });
  const itemById = new Map(items.map(i => [i.id, i]));

  return rows
    .map(r => ({ item: itemById.get(r.id), similarity: r.similarity }))
    .filter((r): r is { item: NonNullable<typeof r.item>; similarity: number } => r.item !== undefined);
}
