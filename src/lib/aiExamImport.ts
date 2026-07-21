// Trích xuất câu hỏi từ file đề thi gốc (PDF/ảnh/Word) bằng Gemini 2.5 Flash —
// server-only (dùng GEMINI_API_KEY). Output ép về đúng shape ParseResult mà
// examQuestionParser.ts đã định nghĩa, để màn hình review dùng lại y nguyên.
import { GoogleGenAI, Type } from "@google/genai";
import mammoth from "mammoth";
import {
  validateQuestionOptions,
  type ParsedQuestion,
  type ParsedOption,
  type ParseError,
  type ParseResult,
  type QuestionType,
} from "@/lib/examQuestionParser";
import { renderPdfPageToPng, getPdfPageCount } from "@/lib/pdfRaster";
import { cropImageBox } from "@/lib/imageCrop";
import { uploadBufferToCloudinary, cloudinaryServerConfigured } from "@/lib/cloudinaryServer";
import sharp from "sharp";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY chưa được cấu hình");
  return new GoogleGenAI({ apiKey });
}

export interface AiInputFile {
  buffer: Buffer;
  mimeType: string;
  filename: string;
}

const NATIVE_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const SUPPORTED_AI_MIME_TYPES = [...NATIVE_MIME_TYPES, DOCX_MIME_TYPE];

// PDF/ảnh: Gemini đọc thẳng qua inlineData (base64). File .docx không có
// content-type native — trích text thuần bằng mammoth rồi gửi dạng text.
async function buildFileParts(file: AiInputFile, label: string) {
  if (NATIVE_MIME_TYPES.has(file.mimeType)) {
    return [
      { text: `${label} (file "${file.filename}"):` },
      { inlineData: { mimeType: file.mimeType, data: file.buffer.toString("base64") } },
    ];
  }
  if (file.mimeType === DOCX_MIME_TYPE) {
    const { value: text } = await mammoth.extractRawText({ buffer: file.buffer });
    return [{ text: `${label} (nội dung trích từ file Word "${file.filename}"):\n${text}` }];
  }
  throw new Error(`Định dạng file không hỗ trợ: ${file.mimeType}`);
}

const questionSchema = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING, description: "Nội dung câu hỏi, giữ nguyên công thức toán dạng LaTeX trong $...$ (inline) hoặc $$...$$ (khối riêng)" },
    type: { type: Type.STRING, enum: ["MC", "TRUE_FALSE_CLUSTER", "ESSAY"] },
    pageIndex: {
      type: Type.INTEGER,
      description: "CHỈ điền khi câu hỏi này đi kèm 1 hình ảnh/biểu đồ/bảng số liệu/đồ thị nằm ngay trên trang đề (không phải công thức toán trong text). Số trang 0-based trong file đề thi. Bỏ trống nếu câu không có hình đi kèm.",
    },
    chartBox: {
      type: Type.ARRAY,
      description: "CHỈ điền cùng với pageIndex: toạ độ khung bao quanh SÁT phần hình ảnh/biểu đồ (không lấy cả câu chữ đề bài) dạng [yMin, xMin, yMax, xMax], mỗi giá trị số nguyên 0-1000 chuẩn hoá theo kích thước trang.",
      items: { type: Type.INTEGER },
    },
    options: {
      type: Type.ARRAY,
      description: "MC: các đáp án A/B/C/D. TRUE_FALSE_CLUSTER: đúng 4 ý a/b/c/d. ESSAY: mảng rỗng.",
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          isCorrect: { type: Type.BOOLEAN, description: "MC: true cho đúng 1 đáp án đúng. CLUSTER: true/false cho từng ý a/b/c/d." },
          subLabel: { type: Type.STRING, enum: ["a", "b", "c", "d"], description: "Chỉ dùng cho TRUE_FALSE_CLUSTER" },
        },
        required: ["text", "isCorrect"],
      },
    },
  },
  required: ["text", "type", "options"],
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    questions: { type: Type.ARRAY, items: questionSchema },
  },
  required: ["questions"],
};

const SYSTEM_INSTRUCTION = `Bạn là trợ lý trích xuất câu hỏi thi trắc nghiệm/tự luận từ file đề thi gốc.

Nhiệm vụ: đọc file đề thi (và file đáp án/hướng dẫn giải nếu có) rồi trả về JSON đúng schema — danh sách câu hỏi đã cấu trúc, xác định đúng loại và đáp án đúng.

Quy tắc phân loại:
- "MC": câu trắc nghiệm 1 đáp án đúng trong các phương án (thường A/B/C/D). Đúng 1 option có isCorrect=true.
- "TRUE_FALSE_CLUSTER": câu có đúng 4 ý nhỏ a)/b)/c)/d), mỗi ý là 1 mệnh đề Đúng/Sai độc lập. Mỗi option ứng với 1 ý, subLabel là "a"/"b"/"c"/"d", isCorrect = mệnh đề đó đúng hay sai.
- "ESSAY": câu tự luận / điền đáp án ngắn không có phương án lựa chọn. options để mảng rỗng.

Quy tắc xác định đáp án đúng:
- Nếu có file đáp án/hướng dẫn giải đính kèm, LUÔN ưu tiên đối chiếu với file đó để xác định đáp án đúng chính xác — đây là nguồn đáng tin cậy nhất.
- Nếu không có file đáp án, tự giải bài toán để suy ra đáp án đúng — nhưng đây là fallback kém tin cậy hơn, cần cẩn thận.

Công thức toán: giữ nguyên dạng LaTeX, bọc trong $...$ (inline) hoặc $$...$$ (khối riêng dòng), không tự ý đơn giản hóa hay bỏ qua công thức.

Hình ảnh/biểu đồ đi kèm câu hỏi: nếu câu hỏi có 1 hình ảnh/biểu đồ/đồ thị/bảng số liệu/hình vẽ minh hoạ nằm ngay trên trang đề (KHÔNG phải công thức toán viết bằng chữ), điền "pageIndex" (số trang 0-based) và "chartBox" (khung toạ độ [yMin,xMin,yMax,xMax], 0-1000) SÁT quanh đúng vùng hình đó — không lấy lẫn phần chữ đề bài xung quanh. Nếu không chắc chắn vị trí chính xác, hoặc câu không có hình đi kèm, để trống cả 2 trường — TUYỆT ĐỐI không đoán bừa toạ độ.

Chỉ trả về đúng JSON theo schema, không thêm giải thích ngoài JSON.`;

interface RawQuestion {
  text?: unknown;
  type?: unknown;
  options?: unknown;
  pageIndex?: unknown;
  chartBox?: unknown;
}

interface ChartRef {
  pageIndex: number;
  box: { yMin: number; xMin: number; yMax: number; xMax: number };
}

function coerceChartRef(raw: RawQuestion): ChartRef | undefined {
  if (typeof raw.pageIndex !== "number" || !Array.isArray(raw.chartBox) || raw.chartBox.length !== 4) return undefined;
  const [yMin, xMin, yMax, xMax] = raw.chartBox;
  if (![yMin, xMin, yMax, xMax].every(n => typeof n === "number" && n >= 0 && n <= 1000)) return undefined;
  if (yMax <= yMin || xMax <= xMin) return undefined;
  return { pageIndex: raw.pageIndex, box: { yMin, xMin, yMax, xMax } };
}

function coerceOptions(raw: unknown): ParsedOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((o): o is Record<string, unknown> => typeof o === "object" && o !== null)
    .map(o => ({
      text: typeof o.text === "string" ? o.text : "",
      isCorrect: o.isCorrect === true,
      subLabel: (["a", "b", "c", "d"] as const).includes(o.subLabel as "a")
        ? (o.subLabel as ParsedOption["subLabel"])
        : undefined,
    }));
}

function coerceQuestion(raw: RawQuestion, idx: number): { question: ParsedQuestion; chartRef?: ChartRef } | { error: string } {
  const text = typeof raw.text === "string" ? raw.text.trim() : "";
  if (!text) return { error: `Câu ${idx + 1}: thiếu nội dung câu hỏi` };

  const type: QuestionType = raw.type === "TRUE_FALSE_CLUSTER" || raw.type === "ESSAY" ? raw.type : "MC";
  const options = coerceOptions(raw.options);

  const optionsErr = validateQuestionOptions(type, options);
  if (optionsErr) return { error: `Câu ${idx + 1}: ${optionsErr}` };

  return { question: { text, type, options }, chartRef: coerceChartRef(raw) };
}

// Cắt ảnh biểu đồ THẬT từ file đề gốc theo toạ độ Gemini xác định, upload
// Cloudinary, gán vào question.imageUrl — không tự vẽ/tạo ảnh mới, chỉ cắt
// đúng pixel từ file người dùng đã tải lên. Chỉ áp dụng cho examFile (PDF/ảnh
// gốc) — không hỗ trợ ảnh trong file .docx hay trong answerKeyFile.
async function resolveChartImages(
  examFile: AiInputFile,
  items: { question: ParsedQuestion; chartRef?: ChartRef }[]
): Promise<void> {
  if (!cloudinaryServerConfigured) return; // chưa cấu hình Cloudinary — bỏ qua, không fail cả batch
  const isPdf = examFile.mimeType === "application/pdf";
  const isImage = ["image/jpeg", "image/png", "image/webp"].includes(examFile.mimeType);
  if (!isPdf && !isImage) return; // .docx — không có ảnh gốc để cắt

  let pageCount = 1;
  if (isPdf) {
    try {
      pageCount = await getPdfPageCount(examFile.buffer);
    } catch {
      return; // file PDF hỏng/không đọc được — bỏ qua toàn bộ chartRef, không fail batch
    }
  }

  const pageCache = new Map<number, { buffer: Buffer; width: number; height: number }>();
  async function getPageRaster(pageIndex: number) {
    const cached = pageCache.get(pageIndex);
    if (cached) return cached;
    let raster: { buffer: Buffer; width: number; height: number };
    if (isPdf) {
      const { png, width, height } = await renderPdfPageToPng(examFile.buffer, pageIndex);
      raster = { buffer: png, width, height };
    } else {
      const meta = await sharp(examFile.buffer).metadata();
      raster = { buffer: examFile.buffer, width: meta.width ?? 0, height: meta.height ?? 0 };
    }
    pageCache.set(pageIndex, raster);
    return raster;
  }

  for (const item of items) {
    const ref = item.chartRef;
    if (!ref) continue;
    if (ref.pageIndex < 0 || ref.pageIndex >= pageCount) continue;
    try {
      const page = await getPageRaster(ref.pageIndex);
      if (!page.width || !page.height) continue;
      const cropped = await cropImageBox(page.buffer, ref.box, page.width, page.height);
      const url = await uploadBufferToCloudinary(cropped, `chart-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`);
      item.question.imageUrl = url;
    } catch (e) {
      console.error("[resolveChartImages] cắt/upload ảnh thất bại cho 1 câu, bỏ qua:", e);
    }
  }
}

export async function extractQuestionsFromFiles(
  examFile: AiInputFile,
  answerKeyFile?: AiInputFile
): Promise<ParseResult> {
  const ai = getClient();

  const parts = [
    ...(await buildFileParts(examFile, "Đề thi")),
    ...(answerKeyFile ? await buildFileParts(answerKeyFile, "Đáp án / hướng dẫn giải") : []),
  ];

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  const raw = response.text;
  if (!raw) throw new Error("Gemini không trả về nội dung");

  let parsed: { questions?: RawQuestion[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Gemini trả về JSON không hợp lệ");
  }

  const items: { question: ParsedQuestion; chartRef?: ChartRef }[] = [];
  const errors: ParseError[] = [];

  (parsed.questions ?? []).forEach((rawQuestion, idx) => {
    const result = coerceQuestion(rawQuestion, idx);
    if ("error" in result) errors.push({ block: idx + 1, message: result.error });
    else items.push(result);
  });

  await resolveChartImages(examFile, items);

  return { questions: items.map(i => i.question), errors };
}
