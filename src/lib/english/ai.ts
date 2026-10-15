// Mọi lời gọi AI của phần Tiếng Anh đi qua file này (đổi nhà cung cấp chỉ sửa một chỗ).
// Dùng đúng client @google/genai + GEMINI_API_KEY đã có của KiN (xem aiExamImport.ts) — không thêm khoá mới.
// ENGLISH_AI_FAKE=1: trả kết quả giả, tất định — chỉ để chạy test cục bộ không có mạng / không tốn quota.
import { GoogleGenAI, Type, type Schema } from "@google/genai";

const MODEL = process.env.ENGLISH_AI_MODEL || "gemini-2.5-flash";
const MODEL_WRITING = process.env.ENGLISH_AI_MODEL_WRITING || MODEL;
const FAKE = process.env.ENGLISH_AI_FAKE === "1";

function client(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY chưa được cấu hình");
  return new GoogleGenAI({ apiKey });
}

async function askJson<T>(opts: { system: string; prompt: string; schema: Schema; model?: string; temperature?: number }): Promise<T> {
  const res = await client().models.generateContent({
    model: opts.model ?? MODEL,
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    config: {
      systemInstruction: opts.system,
      responseMimeType: "application/json",
      responseSchema: opts.schema,
      temperature: opts.temperature ?? 0.4,
    },
  });
  const raw = res.text;
  if (!raw) throw new Error("AI không trả về nội dung");
  try { return JSON.parse(raw) as T; } catch { throw new Error("AI trả về JSON không hợp lệ"); }
}

// ─── Kiểu dữ liệu ──────────────────────────────────────────────────────────

export type ExerciseType = "gap" | "choice" | "transform" | "tfng" | "error" | "order";
export interface ExerciseDraft {
  type: ExerciseType;
  instruction?: string;
  prompt: string;
  options: string[];
  answers: string[];
  explanation?: string;
}

const exerciseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING, enum: ["gap", "choice", "transform", "tfng", "error", "order"] },
    instruction: { type: Type.STRING, description: "Yêu cầu ngắn bằng tiếng Việt, vd 'Điền dạng đúng của động từ'." },
    prompt: { type: Type.STRING, description: "Câu hỏi bằng tiếng Anh. Chỗ trống viết là ____ ." },
    options: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Chỉ với choice/tfng: các lựa chọn. tfng luôn là TRUE, FALSE, NOT GIVEN." },
    answers: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Mọi đáp án đúng chấp nhận được. Với choice: chép nguyên văn lựa chọn đúng." },
    explanation: { type: Type.STRING, description: "Giải thích ngắn bằng tiếng Việt vì sao đúng." },
  },
  required: ["type", "prompt", "answers"],
};

const TYPES = new Set<ExerciseType>(["gap", "choice", "transform", "tfng", "error", "order"]);
export function cleanExercise(e: Partial<ExerciseDraft> | null | undefined): ExerciseDraft | null {
  if (!e || typeof e.prompt !== "string" || !e.prompt.trim()) return null;
  const type = TYPES.has(e.type as ExerciseType) ? (e.type as ExerciseType) : "gap";
  const answers = (e.answers ?? []).map(a => String(a).trim()).filter(Boolean).slice(0, 8);
  if (!answers.length) return null;
  let options = (e.options ?? []).map(o => String(o).trim()).filter(Boolean).slice(0, 6);
  if (type === "tfng") options = ["TRUE", "FALSE", "NOT GIVEN"];
  if (type === "choice" && options.length < 2) return null;
  return {
    type, prompt: e.prompt.trim().slice(0, 1200), options, answers,
    instruction: e.instruction?.trim().slice(0, 200) || undefined,
    explanation: e.explanation?.trim().slice(0, 800) || undefined,
  };
}

// ─── 1. Làm giàu từ: nghĩa tiếng Việt, từ loại, câu ví dụ ─────────────────

export interface WordInfo { lemma: string; pos: string; meaningVi: string; definitionEn: string; example: string }

export async function enrichWords(lemmas: string[]): Promise<WordInfo[]> {
  if (!lemmas.length) return [];
  if (FAKE) return lemmas.map(l => ({ lemma: l, pos: "n", meaningVi: `nghĩa của ${l}`, definitionEn: `meaning of ${l}`, example: `This is an example with ${l}.` }));
  const out = await askJson<{ words: WordInfo[] }>({
    system: "Bạn là từ điển Anh–Việt cho người Việt học IELTS trình độ A2–B2. Trả về JSON đúng schema.",
    prompt: `Với mỗi từ (lemma) dưới đây, cho: từ loại phổ biến nhất (n, v, adj, adv, prep, conj, pron, det), nghĩa tiếng Việt ngắn gọn (tối đa 2 nghĩa phổ biến nhất, ngăn bằng dấu ;), định nghĩa tiếng Anh dễ hiểu (≤ 12 từ), và MỘT câu ví dụ tiếng Anh đơn giản (≤ 14 từ, chỉ dùng từ phổ biến) có chứa từ đó.\nTừ: ${lemmas.join(", ")}`,
    schema: {
      type: Type.OBJECT,
      properties: { words: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {
        lemma: { type: Type.STRING }, pos: { type: Type.STRING }, meaningVi: { type: Type.STRING },
        definitionEn: { type: Type.STRING }, example: { type: Type.STRING },
      }, required: ["lemma", "meaningVi", "example"] } } },
      required: ["words"],
    },
    temperature: 0.2,
  });
  const want = new Set(lemmas);
  return (out.words ?? []).filter(w => w && want.has(String(w.lemma).toLowerCase())).map(w => ({ ...w, lemma: String(w.lemma).toLowerCase() }));
}

// ─── 2. Nghĩa theo đúng ngữ cảnh câu ───────────────────────────────────────

export async function lookupInContext(word: string, sentence: string): Promise<{ meaningVi: string; note: string }> {
  if (FAKE) return { meaningVi: `nghĩa của "${word}" trong câu`, note: "" };
  return askJson({
    system: "Bạn giải nghĩa từ tiếng Anh cho người Việt mới học (A2–B1). Ngắn gọn, đúng ngữ cảnh.",
    prompt: `Câu: "${sentence}"\nTừ cần giải nghĩa: "${word}"\nCho nghĩa tiếng Việt của từ này ĐÚNG trong câu trên (≤ 8 từ). Ghi chú (≤ 25 từ, tiếng Việt) nếu là cụm từ cố định, phrasal verb, hoặc nghĩa khác nghĩa thường gặp; không có gì đặc biệt thì để trống.`,
    schema: { type: Type.OBJECT, properties: { meaningVi: { type: Type.STRING }, note: { type: Type.STRING } }, required: ["meaningVi"] },
    temperature: 0.1,
  });
}

// ─── 3. Câu hỏi đọc hiểu cho một bài ───────────────────────────────────────

export async function textQuestions(title: string, body: string): Promise<ExerciseDraft[]> {
  if (FAKE) return [
    { type: "tfng", prompt: `The article is called "${title}".`, options: ["TRUE", "FALSE", "NOT GIVEN"], answers: ["TRUE"], explanation: "Tên bài." },
    { type: "gap", prompt: "The first word of the article is ____ .", options: [], answers: [body.split(/\s+/)[0] ?? "the"], explanation: "Từ đầu tiên." },
  ];
  const out = await askJson<{ items: ExerciseDraft[] }>({
    system: "Bạn soạn câu hỏi đọc hiểu kiểu IELTS cho người học trình độ 4.0–6.0. Mọi câu hỏi phải trả lời được CHỈ từ bài đọc.",
    prompt: `Bài: ${title}\n\n${body.slice(0, 12000)}\n\nSoạn 5 câu: 2 câu TRUE/FALSE/NOT GIVEN (type "tfng"), 2 câu trắc nghiệm 4 lựa chọn (type "choice"), 1 câu điền từ ≤ 2 từ lấy nguyên văn trong bài (type "gap"). Giải thích bằng tiếng Việt, chỉ ra câu trong bài làm căn cứ.`,
    schema: { type: Type.OBJECT, properties: { items: { type: Type.ARRAY, items: exerciseSchema } }, required: ["items"] },
  });
  return (out.items ?? []).map(cleanExercise).filter((e): e is ExerciseDraft => !!e);
}

// ─── 4. Cấu trúc một unit sách: tóm tắt + bài tập gốc + đáp án ─────────────

export interface UnitStructure {
  title: string;
  group: string;
  summaryVi: string;
  keyPoints: string[];
  examples: string[];
  mistakesVi: string[];
  exercises: ExerciseDraft[];
  /** true = đáp án lấy từ phần đáp án của sách; false = AI tự giải (cần đối chiếu). */
  answersFromKey: boolean;
}

export async function structureUnit(opts: { bookTitle: string; kind: string; unitLabel: string; unitText: string; keyText: string | null }): Promise<UnitStructure> {
  if (FAKE) {
    const firstLine = opts.unitText.split("\n").find(l => l.trim()) ?? opts.unitLabel;
    return {
      title: firstLine.slice(0, 80), group: "", summaryVi: `Tóm tắt ${opts.unitLabel}.`, keyPoints: ["Điểm chính 1"],
      examples: [firstLine.slice(0, 120)], mistakesVi: ["Lỗi hay gặp 1"], answersFromKey: !!opts.keyText,
      exercises: [{ type: "gap", instruction: "Điền từ", prompt: "She ____ (be) a student.", options: [], answers: ["is / 's"], explanation: "Chủ ngữ số ít." }],
    };
  }
  const out = await askJson<UnitStructure>({
    system: "Bạn chuyển một bài (unit) trong sách học tiếng Anh thành bài học có cấu trúc cho người Việt trình độ A2–B2. Chỉ dùng nội dung có trong văn bản được đưa; không bịa bài tập không có trong sách.",
    prompt: [
      `Sách: ${opts.bookTitle} (loại: ${opts.kind}). ${opts.unitLabel}.`,
      `--- NỘI DUNG UNIT (chữ trích từ PDF, có thể lộn xộn thứ tự) ---\n${opts.unitText.slice(0, 18000)}`,
      opts.keyText ? `--- PHẦN ĐÁP ÁN CỦA SÁCH CHO UNIT NÀY ---\n${opts.keyText.slice(0, 6000)}` : "--- Sách không kèm đáp án cho unit này: tự giải và ghi rõ trong explanation là 'đáp án do AI giải' ---",
      "Yêu cầu:",
      "- title: tên unit tiếng Anh như trong sách; group: nhóm chủ điểm nếu nhận ra (vd 'Present and past', 'Modals'), không rõ thì để trống.",
      "- summaryVi: tóm tắt quy tắc bằng tiếng Việt, 5–7 câu ngắn, dễ hiểu cho người mới. Viết bằng lời của bạn, KHÔNG chép nguyên đoạn giải thích của sách.",
      "- keyPoints: 3–6 ý chính (tiếng Việt). examples: tối đa 6 câu ví dụ tiếng Anh ngắn lấy từ unit.",
      "- mistakesVi: 2–4 lỗi người Việt hay mắc với điểm ngữ pháp này, mỗi lỗi kèm câu sai → câu đúng.",
      "- exercises: tách TỪNG câu hỏi nhỏ của các bài tập trong unit thành một phần tử (tối đa 40). prompt chứa đủ để làm độc lập (thay chỗ trống bằng ____ , giữ gợi ý trong ngoặc). answers lấy từ phần đáp án nếu có; nếu đáp án ghi nhiều cách viết thì đưa hết vào answers.",
      "- answersFromKey: true nếu đáp án lấy từ phần đáp án của sách.",
    ].join("\n"),
    schema: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING }, group: { type: Type.STRING }, summaryVi: { type: Type.STRING },
        keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } }, examples: { type: Type.ARRAY, items: { type: Type.STRING } },
        mistakesVi: { type: Type.ARRAY, items: { type: Type.STRING } }, exercises: { type: Type.ARRAY, items: exerciseSchema },
        answersFromKey: { type: Type.BOOLEAN },
      },
      required: ["title", "summaryVi", "exercises"],
    },
    temperature: 0.2,
  });
  return {
    title: String(out.title ?? opts.unitLabel).slice(0, 200), group: String(out.group ?? "").slice(0, 80),
    summaryVi: String(out.summaryVi ?? ""), keyPoints: (out.keyPoints ?? []).slice(0, 8).map(String),
    examples: (out.examples ?? []).slice(0, 8).map(String), mistakesVi: (out.mistakesVi ?? []).slice(0, 6).map(String),
    exercises: (out.exercises ?? []).map(cleanExercise).filter((e): e is ExerciseDraft => !!e).slice(0, 40),
    answersFromKey: !!out.answersFromKey && !!opts.keyText,
  };
}

// ─── 5. Bài biến thể + kiểm chứng bằng lần giải thứ hai ────────────────────

export async function generateVariants(opts: { unitTitle: string; summaryVi: string; examples: string[]; vocab: string[]; n: number }): Promise<ExerciseDraft[]> {
  if (FAKE) return Array.from({ length: opts.n }, (_, i) => ({ type: "gap" as const, instruction: "Điền từ", prompt: `Variant ${i + 1}: He ____ (go) to school every day.`, options: [], answers: ["goes"], explanation: "Hiện tại đơn, ngôi 3 số ít." }));
  const out = await askJson<{ items: ExerciseDraft[] }>({
    system: "Bạn soạn bài luyện ngữ pháp MỚI (không chép sách) cho người Việt trình độ A2–B2. Mỗi câu chỉ có một cách hiểu, đáp án không gây tranh cãi.",
    prompt: `Điểm ngữ pháp: ${opts.unitTitle}\nTóm tắt: ${opts.summaryVi}\nVí dụ gốc: ${opts.examples.slice(0, 4).join(" | ")}\nƯu tiên dùng các từ người học đang học: ${opts.vocab.slice(0, 30).join(", ") || "(không có)"}\n\nSoạn ${opts.n} câu, trộn các dạng: gap (điền dạng đúng, có gợi ý trong ngoặc), choice (4 lựa chọn), transform (viết lại câu giữ nghĩa), error (tìm và sửa lỗi sai — answers là câu đã sửa). Câu ngắn ≤ 18 từ. Giải thích tiếng Việt.`,
    schema: { type: Type.OBJECT, properties: { items: { type: Type.ARRAY, items: exerciseSchema } }, required: ["items"] },
    temperature: 0.8,
  });
  return (out.items ?? []).map(cleanExercise).filter((e): e is ExerciseDraft => !!e).slice(0, opts.n);
}

/** Giải lại các câu (không thấy đáp án) để kiểm chứng — trả câu trả lời theo đúng thứ tự. */
export async function solveExercises(items: ExerciseDraft[]): Promise<string[]> {
  if (!items.length) return [];
  if (FAKE) return items.map(i => i.answers[0].split("/")[0].trim());
  const out = await askJson<{ answers: string[] }>({
    system: "Bạn là giáo viên tiếng Anh. Giải chính xác từng câu, chỉ trả về câu trả lời ngắn gọn, không giải thích.",
    prompt: items.map((it, i) => `${i + 1}. [${it.type}] ${it.instruction ?? ""} ${it.prompt}${it.options.length ? `\nLựa chọn: ${it.options.join(" | ")}` : ""}`).join("\n\n")
      + "\n\nVới choice/tfng: chép nguyên văn lựa chọn đúng. Với gap: chỉ phần điền vào chỗ trống. Với transform/error: cả câu đã viết lại/sửa.",
    schema: { type: Type.OBJECT, properties: { answers: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["answers"] },
    temperature: 0,
  });
  return (out.answers ?? []).map(String);
}

// ─── 6. Góp ý Writing theo 4 tiêu chí IELTS ────────────────────────────────

export interface WritingIssue { quote: string; criterion: "TR" | "CC" | "LR" | "GRA"; problemVi: string; fix: string }
export interface WritingFeedback {
  criteria: { key: "TR" | "CC" | "LR" | "GRA"; band: number; commentVi: string }[];
  bandLow: number;
  bandHigh: number;
  issues: WritingIssue[];
  priorityVi: string;
  strengthsVi: string[];
}

// Tóm tắt 4 tiêu chí bằng lời của KiN (không chép nguyên văn band descriptors — bản gốc công khai ở ielts.org, cập nhật 05/2023).
const CRITERIA_GUIDE = `
TR (Task Response / Task Achievement): trả lời đủ mọi phần của đề; có quan điểm rõ và nhất quán (Task 2) hoặc có tổng quan + số liệu chính (Task 1); ý được phát triển, có ví dụ/lý do. Thiếu đoạn văn thì không quá 5; Task 1 không có số liệu thì không quá 5.
CC (Coherence & Cohesion): bố cục đoạn hợp lý, mỗi đoạn một ý trung tâm; từ nối dùng đúng, không máy móc; đại từ quy chiếu rõ.
LR (Lexical Resource): vốn từ đủ rộng cho đề, dùng đúng nghĩa và kết hợp từ; lỗi chính tả/cấu tạo từ có cản trở hiểu không.
GRA (Grammatical Range & Accuracy): có cả câu đơn và câu phức; tỉ lệ câu không lỗi; lỗi có cản trở hiểu không; dấu câu.
Mốc tham khảo: 5 = ý có nhưng phát triển yếu, lỗi nhiều nhưng vẫn hiểu; 6 = trả lời đủ, có bố cục, lỗi có nhưng hiếm khi cản trở; 7 = phát triển ý tốt, từ vựng linh hoạt, phần lớn câu không lỗi.`;

export async function writingFeedback(opts: { taskType: string; prompt: string; body: string; wordCount: number }): Promise<WritingFeedback> {
  if (FAKE) return {
    criteria: (["TR", "CC", "LR", "GRA"] as const).map(k => ({ key: k, band: 5.5, commentVi: `Nhận xét ${k}.` })),
    bandLow: 5, bandHigh: 6, priorityVi: "Phát triển ý bằng ví dụ cụ thể.", strengthsVi: ["Có mở bài rõ."],
    issues: [{ quote: opts.body.split(/[.!?]/)[0].slice(0, 60), criterion: "GRA", problemVi: "Ví dụ lỗi.", fix: "Example fix." }],
  };
  const out = await askJson<WritingFeedback>({
    model: MODEL_WRITING,
    system: `Bạn là giám khảo IELTS Writing giàu kinh nghiệm, góp ý cho người Việt đang ở band 4–6. Nghiêm và trung thực: không nâng điểm. Giọng tiếng Việt thân thiện, cụ thể.\n${CRITERIA_GUIDE}`,
    prompt: `Loại bài: ${opts.taskType}. Số từ: ${opts.wordCount}${opts.taskType === "task2" && opts.wordCount < 250 ? " (dưới 250 từ — bị trừ điểm TR)" : ""}${opts.taskType === "task1" && opts.wordCount < 150 ? " (dưới 150 từ — bị trừ điểm TA)" : ""}.\nĐề: ${opts.prompt}\n\nBài làm:\n${opts.body.slice(0, 8000)}\n\nCho: band từng tiêu chí (bước 0.5) kèm nhận xét ngắn; khoảng band tổng (bandLow–bandHigh, cách nhau 0.5 hoặc 1 — điểm AI không chính xác tuyệt đối); tối đa 8 lỗi cụ thể, mỗi lỗi trích NGUYÊN VĂN đoạn sai trong bài (quote), tiêu chí, vấn đề (tiếng Việt) và cách sửa (tiếng Anh); MỘT việc ưu tiên nhất cần sửa ở bài sau (priorityVi); 1–3 điểm mạnh.`,
    schema: {
      type: Type.OBJECT,
      properties: {
        criteria: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { key: { type: Type.STRING, enum: ["TR", "CC", "LR", "GRA"] }, band: { type: Type.NUMBER }, commentVi: { type: Type.STRING } }, required: ["key", "band", "commentVi"] } },
        bandLow: { type: Type.NUMBER }, bandHigh: { type: Type.NUMBER },
        issues: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { quote: { type: Type.STRING }, criterion: { type: Type.STRING, enum: ["TR", "CC", "LR", "GRA"] }, problemVi: { type: Type.STRING }, fix: { type: Type.STRING } }, required: ["quote", "criterion", "problemVi", "fix"] } },
        priorityVi: { type: Type.STRING }, strengthsVi: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["criteria", "bandLow", "bandHigh", "issues", "priorityVi"],
    },
    temperature: 0.2,
  });
  const half = (x: number) => Math.min(9, Math.max(0, Math.round(Number(x) * 2) / 2));
  let lo = half(out.bandLow), hi = half(out.bandHigh);
  if (lo > hi) [lo, hi] = [hi, lo];
  if (hi - lo > 1) lo = hi - 1;
  return {
    criteria: (out.criteria ?? []).slice(0, 4).map(c => ({ ...c, band: half(c.band) })),
    bandLow: lo, bandHigh: hi,
    issues: (out.issues ?? []).slice(0, 8),
    priorityVi: String(out.priorityVi ?? ""),
    strengthsVi: (out.strengthsVi ?? []).slice(0, 3).map(String),
  };
}

// ─── 7. Hỏi sách (RAG): chỉ trả lời từ các đoạn được đưa ───────────────────

export async function answerFromBook(question: string, chunks: { n: number; label: string; text: string }[]): Promise<{ answerVi: string; cites: number[]; found: boolean }> {
  if (FAKE) return chunks.length ? { answerVi: `Theo sách: ${chunks[0].text.slice(0, 80)}`, cites: [chunks[0].n], found: true } : { answerVi: "", cites: [], found: false };
  if (!chunks.length) return { answerVi: "", cites: [], found: false };
  const out = await askJson<{ answerVi: string; cites: number[]; found: boolean }>({
    system: "Bạn trả lời câu hỏi về ngữ pháp/kỹ năng tiếng Anh CHỈ dựa trên các đoạn sách được cung cấp. Nếu các đoạn không đủ để trả lời, đặt found=false và không đoán. Trả lời tiếng Việt, ngắn gọn, có ví dụ tiếng Anh lấy từ đoạn sách.",
    prompt: `Các đoạn sách:\n${chunks.map(c => `[${c.n}] (${c.label})\n${c.text}`).join("\n\n")}\n\nCâu hỏi: ${question}\n\ncites: số thứ tự các đoạn đã dùng.`,
    schema: { type: Type.OBJECT, properties: { answerVi: { type: Type.STRING }, cites: { type: Type.ARRAY, items: { type: Type.INTEGER } }, found: { type: Type.BOOLEAN } }, required: ["answerVi", "found"] },
    temperature: 0.2,
  });
  const valid = new Set(chunks.map(c => c.n));
  return { answerVi: String(out.answerVi ?? ""), cites: (out.cites ?? []).filter(n => valid.has(n)), found: !!out.found };
}

// ─── Embedding (cùng model + số chiều với question_bank_items) ─────────────

export async function embed(texts: string[]): Promise<(number[] | null)[]> {
  if (!texts.length) return [];
  if (FAKE) return texts.map(t => fakeEmbedding(t));
  const res = await client().models.embedContent({
    model: "gemini-embedding-001",
    contents: texts,
    config: { outputDimensionality: 768 },
  });
  return texts.map((_, i) => { const v = res.embeddings?.[i]?.values; return v && v.length === 768 ? v : null; });
}

/** Embedding giả cho test: túi từ băm vào 768 chiều, đủ để câu hỏi chung từ khoá tìm ra đoạn đúng. */
function fakeEmbedding(text: string): number[] {
  const v = new Array(768).fill(0);
  for (const w of text.toLowerCase().match(/[a-z]+/g) ?? []) {
    let h = 0; for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    v[h % 768] += 1;
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map(x => x / norm);
}
