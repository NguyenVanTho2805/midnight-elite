// POST /api/english/books/[id]/process — làm TIẾP một phần việc xử lý sách rồi trả trạng thái; trình duyệt gọi lặp tới khi "ready".
// Chia nhỏ để không vượt giới hạn thời gian của hàm máy chủ:
//   pages      → (đủ trang) chia unit + tạo đoạn tìm kiếm → processing
//   processing → mỗi lần cấu trúc 2 unit bằng AI (tóm tắt, bài tập, đáp án) + nhúng ≤150 đoạn → khi hết thì ready
// { retryErrors: true }: đưa các unit lỗi về hàng chờ để làm lại.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireUser, isResp, bad } from "@/lib/english/server";
import { splitUnits, keySegment, chunkPages, type PageText } from "@/lib/english/bookSplit";
import { structureUnit } from "@/lib/english/ai";
import { embedPendingChunks } from "@/lib/english/rag";

export const maxDuration = 60;
const UNITS_PER_CALL = 2;
const running = new Set<string>();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await requireUser();
  if (isResp(s)) return s;
  const book = await prisma.engBook.findFirst({ where: { id, ownerId: s.userId } });
  if (!book) return bad("Không tìm thấy sách", 404);
  const b = await req.json().catch(() => ({})) as { retryErrors?: boolean };
  if (running.has(id)) return NextResponse.json({ status: book.status, unitsDone: book.unitsDone, unitsTotal: book.unitsTotal, busy: true });
  running.add(id);
  try {
    if (b.retryErrors) {
      const n = await prisma.engUnit.updateMany({ where: { bookId: id, status: "error" }, data: { status: "raw", statusNote: null } });
      if (n.count) await prisma.engBook.update({ where: { id }, data: { status: "processing", unitsDone: { decrement: n.count } } });
      return NextResponse.json({ status: "processing", retried: n.count });
    }

    if (book.status === "pages") {
      const pages: PageText[] = await prisma.engBookPage.findMany({ where: { bookId: id }, orderBy: { pageNo: "asc" }, select: { pageNo: true, text: true } });
      if (pages.length < book.pageCount) return bad(`Mới nhận ${pages.length}/${book.pageCount} trang — tải tiếp phần còn lại.`, 409);
      const totalChars = pages.reduce((n, p) => n + p.text.trim().length, 0);
      if (totalChars < pages.length * 30) {
        await prisma.engBook.update({ where: { id }, data: { status: "error", statusNote: "PDF gần như không có chữ (bản scan ảnh). Cần bản PDF có lớp chữ hoặc chạy OCR trước." } });
        return NextResponse.json({ status: "error" });
      }
      const { units, keyStart } = splitUnits(pages);
      await prisma.engUnit.createMany({
        data: units.map(u => ({ bookId: id, ownerId: s.userId, order: u.order, unitNo: u.unitNo, title: u.label, pageStart: u.pageStart, pageEnd: u.pageEnd })),
        skipDuplicates: true,
      });
      const created = await prisma.engUnit.findMany({ where: { bookId: id }, select: { id: true, pageStart: true, pageEnd: true } });
      const unitOfPage = (p: number) => created.find(u => p >= u.pageStart && p <= u.pageEnd)?.id ?? null;
      const bodyPages = keyStart ? pages.filter(p => p.pageNo < keyStart) : pages;
      const chunks = chunkPages(bodyPages);
      for (let i = 0; i < chunks.length; i += 500) {
        await prisma.engChunk.createMany({ data: chunks.slice(i, i + 500).map(c => ({ bookId: id, ownerId: s.userId, unitId: unitOfPage(c.pageNo), pageNo: c.pageNo, text: c.text })) });
      }
      await prisma.engBook.update({
        where: { id },
        data: { status: "processing", unitsTotal: units.length, unitsDone: 0, statusNote: keyStart ? `Phần đáp án bắt đầu ở trang ${keyStart}.` : "Không tìm thấy phần đáp án — AI sẽ tự giải và ghi rõ." },
      });
      return NextResponse.json({ status: "processing", unitsDone: 0, unitsTotal: units.length, keyStart });
    }

    if (book.status === "processing") {
      const raw = await prisma.engUnit.findMany({ where: { bookId: id, status: "raw" }, orderBy: { order: "asc" }, take: UNITS_PER_CALL });
      if (raw.length) {
        const pages: PageText[] = await prisma.engBookPage.findMany({ where: { bookId: id }, orderBy: { pageNo: "asc" }, select: { pageNo: true, text: true } });
        const { keyStart } = splitUnits(pages);
        for (const u of raw) {
          const unitText = pages.filter(p => p.pageNo >= u.pageStart && p.pageNo <= u.pageEnd).map(p => `[trang ${p.pageNo}]\n${p.text}`).join("\n\n");
          try {
            const r = await structureUnit({ bookTitle: book.title, kind: book.kind, unitLabel: u.title, unitText, keyText: keySegment(pages, keyStart, u.unitNo) });
            await prisma.$transaction([
              prisma.engExercise.deleteMany({ where: { unitId: u.id, origin: "book" } }),
              prisma.engExercise.createMany({
                data: r.exercises.map((e, i) => ({
                  ownerId: s.userId, unitId: u.id, type: e.type, instruction: e.instruction ?? null, prompt: e.prompt, options: e.options, answers: e.answers,
                  explanation: e.explanation ?? (r.answersFromKey ? null : "Đáp án do AI giải (sách không kèm đáp án) — nếu thấy sai, bấm 'Báo câu sai'."),
                  origin: "book", verified: r.answersFromKey, order: i,
                })),
              }),
              prisma.engUnit.update({
                where: { id: u.id },
                data: {
                  title: r.title || u.title, group: r.group || null, summaryVi: r.summaryVi, status: "ready", statusNote: null,
                  keyPoints: r.keyPoints as Prisma.InputJsonValue, examples: r.examples as Prisma.InputJsonValue, mistakesVi: r.mistakesVi as Prisma.InputJsonValue,
                },
              }),
            ]);
          } catch (e) {
            console.error("[english.book.process] unit", u.id, e);
            await prisma.engUnit.update({ where: { id: u.id }, data: { status: "error", statusNote: e instanceof Error ? e.message.slice(0, 200) : "Lỗi AI" } });
          }
          await prisma.engBook.update({ where: { id }, data: { unitsDone: { increment: 1 } } });
        }
      }
      await embedPendingChunks(id, 150);
      const left = await prisma.engUnit.count({ where: { bookId: id, status: "raw" } });
      if (left === 0) {
        const errors = await prisma.engUnit.count({ where: { bookId: id, status: "error" } });
        await prisma.engBook.update({ where: { id }, data: { status: "ready", ...(errors ? { statusNote: `${errors} unit chưa xử lý được — bấm "Làm lại unit lỗi".` } : {}) } });
      }
      const after = await prisma.engBook.findUnique({ where: { id }, select: { status: true, unitsDone: true, unitsTotal: true, statusNote: true } });
      return NextResponse.json(after);
    }

    if (book.status === "ready") {
      const n = await embedPendingChunks(id, 150); // sách lớn: phần nhúng còn lại làm dần
      return NextResponse.json({ status: "ready", unitsDone: book.unitsDone, unitsTotal: book.unitsTotal, embedded: n });
    }
    return NextResponse.json({ status: book.status, statusNote: book.statusNote });
  } finally {
    running.delete(id);
  }
}
