// Giai đoạn 3.5 Cấp 3 — tính vector embedding cho nội dung câu hỏi bằng
// Gemini text-embedding-004 (768 chiều, khớp cột QuestionBankItem.embedding
// vector(768) trong schema.prisma), tái dùng đúng client @google/genai +
// GEMINI_API_KEY đã cấu hình sẵn cho tính năng AI trích xuất đề
// (src/lib/aiExamImport.ts) — không thêm provider/API key mới.
import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIM = 768;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY chưa được cấu hình");
  return new GoogleGenAI({ apiKey });
}

export async function computeEmbedding(text: string): Promise<number[] | null> {
  try {
    const res = await getClient().models.embedContent({
      model: EMBEDDING_MODEL,
      contents: [text],
      config: { outputDimensionality: EMBEDDING_DIM },
    });
    const values = res.embeddings?.[0]?.values;
    return values && values.length === EMBEDDING_DIM ? values : null;
  } catch (e) {
    console.error("[computeEmbedding]", e);
    return null;
  }
}

// Ghi embedding cho 1 bản ghi ngân hàng — TÁCH RIÊNG khỏi transaction tạo/sửa
// chính (gọi sau khi create/update Prisma bình thường đã thành công), vì gọi
// Gemini là 1 network call chậm/có thể lỗi (rate limit, mạng...) — không
// được để lỗi ở bước phụ này làm hỏng thao tác lưu câu hỏi chính. Lỗi ở đây
// chỉ log, không throw — embedding = null coi như "chưa tính", bị loại khỏi
// so khớp Cấp 3 ở lần kiểm tra sau, không chặn gì khác.
export async function setBankItemEmbedding(itemId: string, text: string): Promise<void> {
  const values = await computeEmbedding(text);
  if (!values) return;
  const vectorLiteral = `[${values.join(",")}]`;
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "question_bank_items" SET "embedding" = ${vectorLiteral}::vector WHERE "id" = ${itemId}
  `);
}

// Ngưỡng cosine similarity (1 - khoảng cách cosine của pgvector `<=>`) — cao
// hơn hẳn ngưỡng pg_trgm (0.35) vì embedding hoạt động trên thang khác: 2
// câu chỉ tình cờ cùng chủ đề cũng có thể đạt 0.6-0.7, phải đủ cao mới chắc
// là GIỐNG NGHĨA thật sự (diễn đạt khác hẳn nhưng hỏi cùng 1 điều).
const SEMANTIC_SIMILARITY_THRESHOLD = 0.82;
const MAX_RESULTS = 5;

// Giai đoạn 3.5 Cấp 3 — phát hiện trùng GIỐNG NGHĨA bằng cosine similarity
// trên vector embedding, khác hẳn Cấp 2 (giống CHUỖI ký tự) — bắt được cả
// khi từ ngữ đổi hoàn toàn nhưng hỏi cùng 1 nội dung. Chỉ gọi khi Cấp 1 VÀ
// Cấp 2 đều không tìm thấy gì (route gọi hàm này có điều kiện, xem
// check-duplicate/route.ts) — đây là tầng tốn kém nhất (1 lệnh gọi Gemini +
// 1 truy vấn vector), chỉ dùng khi 2 tầng rẻ hơn đã chắc chắn không đủ.
export async function findSemanticBankItems(opts: {
  text: string; subject: string; topic: string;
  userId: string; isReviewer: boolean;
}) {
  const values = await computeEmbedding(opts.text);
  if (!values) return [];
  const vectorLiteral = `[${values.join(",")}]`;

  const statusFilter = opts.isReviewer
    ? Prisma.sql`TRUE`
    : Prisma.sql`("status" = 'approved' OR "ownerId" = ${opts.userId})`;

  const rows = await prisma.$queryRaw<{ id: string; similarity: number }[]>(Prisma.sql`
    SELECT "id", 1 - ("embedding" <=> ${vectorLiteral}::vector) AS similarity
    FROM "question_bank_items"
    WHERE "subject" = ${opts.subject} AND "topic" = ${opts.topic} AND "embedding" IS NOT NULL AND ${statusFilter}
      AND 1 - ("embedding" <=> ${vectorLiteral}::vector) > ${SEMANTIC_SIMILARITY_THRESHOLD}
    ORDER BY "embedding" <=> ${vectorLiteral}::vector
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
