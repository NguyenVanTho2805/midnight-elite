// GET  /api/english/mock — lịch sử thi thử của tôi + điểm mới nhất từng kỹ năng + band tổng ước tính + mục tiêu từng kỹ năng.
// POST /api/english/mock
//   Listening/Reading: { skill, module?, title, answers: string[40], keyText, seconds } → máy chủ đọc đáp án, chấm, quy đổi band.
//   Writing/Speaking:  { skill, title, band, note? } → lưu band người học tự nhập (giáo viên chấm, bài nói thử…).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, isResp, bad, getProfile, logStudy } from "@/lib/english/server";
import { bandFromRaw, componentTargets, gradeSheet, MOCK_SKILLS, overallBand, parseAnswerKey, QUESTIONS, rawNeeded, type MockSkill, type ReadingModule } from "@/lib/english/mock";

export async function GET() {
  const s = await requireUser();
  if (isResp(s)) return s;
  const [items, profile] = await Promise.all([
    prisma.engMock.findMany({ where: { userId: s.userId }, orderBy: { takenAt: "desc" }, take: 100, select: { id: true, skill: true, module: true, title: true, raw: true, band: true, seconds: true, note: true, takenAt: true } }),
    getProfile(s.userId),
  ]);
  const latest = Object.fromEntries(MOCK_SKILLS.map(k => [k, items.find(i => i.skill === k) ?? null])) as Record<MockSkill, (typeof items)[number] | null>;
  const targets = componentTargets(profile.targetBand);
  const bands = MOCK_SKILLS.map(k => latest[k]?.band);
  return NextResponse.json({
    items, latest, targets, targetBand: profile.targetBand,
    overall: bands.every((b): b is number => typeof b === "number") ? overallBand(bands) : null,
    rawTargets: {
      listening: rawNeeded("listening", targets.listening),
      reading: rawNeeded("reading", targets.reading, (latest.reading?.module as ReadingModule) ?? "academic"),
    },
  });
}

export async function POST(req: NextRequest) {
  const s = await requireUser();
  if (isResp(s)) return s;
  const b = await req.json().catch(() => null) as {
    skill?: string; module?: string; title?: string; answers?: unknown; keyText?: string; seconds?: number; band?: number; note?: string;
  } | null;
  if (!b || !MOCK_SKILLS.includes(b.skill as MockSkill)) return bad("Chọn kỹ năng");
  const skill = b.skill as MockSkill;
  const title = (b.title ?? "").trim().slice(0, 120);
  if (!title) return bad("Ghi tên đề (vd Cambridge 18 — Test 2)");
  const count = await prisma.engMock.count({ where: { userId: s.userId } });
  if (count >= 500) return bad("Đã lưu quá nhiều bài thi thử — xoá bớt bài cũ.");

  if (skill === "writing" || skill === "speaking") {
    const band = Number(b.band);
    if (!(band >= 1 && band <= 9) || (band * 2) % 1 !== 0) return bad("Band từ 1.0 đến 9.0, bước 0.5");
    const m = await prisma.engMock.create({ data: { userId: s.userId, skill, title, band, note: b.note?.trim().slice(0, 300) || null } });
    return NextResponse.json({ id: m.id, band });
  }

  const mod: ReadingModule = skill === "reading" && b.module === "general" ? "general" : "academic";
  if (!Array.isArray(b.answers) || b.answers.length !== QUESTIONS) return bad("Phiếu trả lời phải có đủ 40 ô");
  const answers = b.answers.map(a => String(a ?? "").slice(0, 80));
  const key = parseAnswerKey(String(b.keyText ?? "").slice(0, 8000));
  const keyed = key.filter(Boolean).length;
  if (keyed < QUESTIONS) {
    const missing = key.map((k, i) => (k ? null : i + 1)).filter((x): x is number => x !== null);
    return bad(`Chưa đọc được đáp án câu ${missing.slice(0, 8).join(", ")}${missing.length > 8 ? "…" : ""}. Mỗi câu một dòng dạng "1 TRUE" rồi gửi lại.`);
  }
  const graded = gradeSheet(key, answers);
  const band = bandFromRaw(skill, graded.raw, mod);
  const seconds = Math.max(0, Math.min(Math.round(Number(b.seconds) || 0), 4 * 3600));
  const m = await prisma.engMock.create({ data: { userId: s.userId, skill, module: mod, title, raw: graded.raw, band, answers, answerKey: key, seconds } });
  await logStudy(s.userId, "thi-thu", { items: 1, correct: graded.raw, total: QUESTIONS, seconds });
  return NextResponse.json({ id: m.id, raw: graded.raw, band, module: mod, items: graded.items, seconds });
}
