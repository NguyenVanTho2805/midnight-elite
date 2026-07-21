// Cú pháp "khung mã nguồn" cho chế độ soạn 2 khung (rendered form bên trái +
// text mã nguồn bên phải, đồng bộ 2 chiều) trong CreateExamDrawer — LẤY CẢM
// HỨNG từ giao diện chia đôi của Azota nhưng KHÔNG sao chép cú pháp token của
// họ ([!m:$mathtype_N$]...), vì token đó gắn liền công cụ soạn công thức
// MathType riêng của họ. Công thức toán ở đây vẫn gõ LaTeX $...$ trực tiếp,
// giống hệt cách "Dán câu hỏi hàng loạt" đã hỗ trợ.
//
// Mỗi câu hỏi là 1 khối bắt đầu bằng dòng "#N [Loại] [Điểm] [Phần: ...] [Phút: N]":
//   #1 [Trắc nghiệm] [1đ] [Phần: Phần Trắc nghiệm]
//   Tập xác định của hàm số y = tan x là:
//   A) R \ {0}
//   *B) R \ {π/2 + kπ, k ∈ Z}
//   C) R
//   D) R \ {kπ, k ∈ Z}
//   [Giải thích]
//   Điều kiện xác định: cos x ≠ 0 ⇔ x ≠ π/2 + kπ
//
// Đúng-Sai 4 ý: "+a) ..." (ý đúng) / "-a) ..." (ý sai) thay cho A)/B)/C)/D.
// Trả lời ngắn: 1 dòng "[Đáp án: 42]" thay cho danh sách đáp án.
// Tự luận: không có phần đáp án nào cả.
//
// Dùng chung validateQuestionOptions() với API tạo/sửa câu hỏi — để lỗi hiện
// ra ở đây giống hệt lỗi server sẽ trả về, không phát minh luật riêng.
import type { ExamQuestionInput } from "@/lib/api";
import { type ParseError, type QuestionType, validateQuestionOptions } from "@/lib/examQuestionParser";

const TYPE_LABEL: Record<QuestionType, string> = {
  MC: "Trắc nghiệm", TRUE_FALSE_CLUSTER: "Đúng-Sai", SHORT_ANSWER: "Trả lời ngắn", ESSAY: "Tự luận",
};
const LABEL_TYPE: Record<string, QuestionType> = {
  "Trắc nghiệm": "MC", "Đúng-Sai": "TRUE_FALSE_CLUSTER", "Trả lời ngắn": "SHORT_ANSWER", "Tự luận": "ESSAY",
};
const CLUSTER_LABELS = ["a", "b", "c", "d"];

export function serializeQuestionsToMarkup(questions: ExamQuestionInput[]): string {
  return questions.map((q, idx) => {
    const type = q.type ?? "MC";
    const tags = [`#${idx + 1}`, `[${TYPE_LABEL[type]}]`, `[${q.points ?? 1}đ]`];
    if (q.sectionLabel) tags.push(`[Phần: ${q.sectionLabel}]`);
    if (q.sectionMinutes) tags.push(`[Phút: ${q.sectionMinutes}]`);
    const lines: string[] = [tags.join(" ")];
    if (q.imageUrl) lines.push(`[Ảnh: ${q.imageUrl}]`);
    lines.push(q.text);

    if (type === "MC") {
      q.options.forEach((o, i) => {
        const label = String.fromCharCode(65 + i);
        lines.push(`${o.isCorrect ? "*" : ""}${label}) ${o.text}`);
      });
    } else if (type === "TRUE_FALSE_CLUSTER") {
      q.options.forEach((o, i) => {
        const label = o.subLabel ?? CLUSTER_LABELS[i] ?? String(i);
        lines.push(`${o.isCorrect ? "+" : "-"}${label}) ${o.text}`);
      });
    } else if (type === "SHORT_ANSWER") {
      lines.push(`[Đáp án: ${q.options[0]?.text ?? ""}]`);
    }
    // ESSAY: không có phần đáp án.

    if (q.explanation) {
      lines.push("[Giải thích]");
      lines.push(q.explanation);
    }
    return lines.join("\n");
  }).join("\n\n");
}

const HEADER_RE = /^#\d+\s*(.*)$/;
const TAG_RE = /\[([^\]]*)\]/g;
const IMAGE_LINE_RE = /^\[Ảnh:\s*(.+)\]$/;
const ANSWER_LINE_RE = /^\[Đáp án:\s*(.*)\]$/;
const MC_OPTION_RE = /^(\*?)([A-Za-z])\)\s*(.*)$/;
const CLUSTER_OPTION_RE = /^([+-])([a-dA-D])\)\s*(.*)$/;

export function parseMarkupToQuestions(text: string): { questions: ExamQuestionInput[]; errors: ParseError[] } {
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  // Gom theo khối — mỗi khối bắt đầu bằng 1 dòng khớp HEADER_RE, kết thúc
  // ngay trước header tiếp theo hoặc hết text. Dòng đứng trước header đầu
  // tiên (nếu người dùng gõ lạc) bị bỏ qua, không tính là lỗi.
  const blocks: string[][] = [];
  let current: string[] | null = null;
  for (const line of lines) {
    if (HEADER_RE.test(line.trim())) {
      if (current) blocks.push(current);
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) blocks.push(current);

  const questions: ExamQuestionInput[] = [];
  const errors: ParseError[] = [];

  blocks.forEach((blockLines, i) => {
    try {
      questions.push(parseBlock(blockLines));
    } catch (e) {
      errors.push({ block: i + 1, message: e instanceof Error ? e.message : "Lỗi cú pháp không xác định" });
    }
  });

  return { questions, errors };
}

function parseBlock(lines: string[]): ExamQuestionInput {
  const headerMatch = lines[0].trim().match(HEADER_RE);
  const tagsStr = headerMatch?.[1] ?? "";
  const tags: string[] = [];
  let m: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(tagsStr))) tags.push(m[1].trim());

  let type: QuestionType = "MC";
  let points = 1;
  let sectionLabel: string | null = null;
  let sectionMinutes: number | null = null;
  for (const tag of tags) {
    if (tag in LABEL_TYPE) type = LABEL_TYPE[tag];
    else if (/^[\d.]+đ$/.test(tag)) points = parseFloat(tag);
    else if (tag.startsWith("Phần:")) sectionLabel = tag.slice(5).trim() || null;
    else if (tag.startsWith("Phút:")) sectionMinutes = parseInt(tag.slice(5).trim(), 10) || null;
  }

  let imageUrl: string | undefined;
  let shortAnswer: string | undefined;
  let explanationLines: string[] | null = null;
  const bodyLines: string[] = [];
  const optionLines: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (explanationLines !== null) { explanationLines.push(raw); continue; }
    const imgMatch = trimmed.match(IMAGE_LINE_RE);
    if (imgMatch) { imageUrl = imgMatch[1].trim(); continue; }
    const ansMatch = trimmed.match(ANSWER_LINE_RE);
    if (ansMatch) { shortAnswer = ansMatch[1].trim(); continue; }
    if (trimmed === "[Giải thích]") { explanationLines = []; continue; }
    if (MC_OPTION_RE.test(trimmed) || CLUSTER_OPTION_RE.test(trimmed)) { optionLines.push(trimmed); continue; }
    bodyLines.push(raw);
  }

  const text = bodyLines.join("\n").trim();
  if (!text) throw new Error("Thiếu nội dung câu hỏi");

  let options: { text: string; isCorrect: boolean; subLabel?: string }[] = [];
  if (type === "MC") {
    options = optionLines.map(line => {
      const opt = line.match(MC_OPTION_RE);
      return { text: opt?.[3]?.trim() ?? line, isCorrect: opt?.[1] === "*" };
    });
  } else if (type === "TRUE_FALSE_CLUSTER") {
    options = optionLines.map(line => {
      const opt = line.match(CLUSTER_OPTION_RE);
      return { text: opt?.[3]?.trim() ?? line, isCorrect: opt?.[1] === "+", subLabel: opt?.[2]?.toLowerCase() };
    });
  } else if (type === "SHORT_ANSWER" && shortAnswer) {
    options = [{ text: shortAnswer, isCorrect: true }];
  }

  const optionsErr = validateQuestionOptions(type, options);
  if (optionsErr) throw new Error(optionsErr);

  const explanation = explanationLines ? explanationLines.join("\n").trim() || undefined : undefined;

  return { text, type, imageUrl, points, explanation, sectionLabel, sectionMinutes, options };
}
