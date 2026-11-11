// Cây nội dung khoá học Phần > Chương > Bài (BU-HS-TRANG-CHU mục 4.2): dùng chung cho trang lớp (variant "page") và thanh bên bài giảng ("rail" / "sheet").
// THUẦN: không DB, không React; không bao giờ sửa cây truyền vào. Test: tools/local-e2e/t-lesson-outline-lib.ts.
import { fold, queryTokens } from "@/lib/librarySearch";

export interface OLesson { id: string; title: string; isLocked?: boolean }
export interface OChapter { id: string; title: string; lessons: OLesson[] }
export interface OSection { id: string; title: string; chapters: OChapter[] }

// Dữ liệu từ API có thể thiếu mảng con (lớp mới tạo, bài bị lọc hết): mọi hàm dưới đây coi thiếu = rỗng thay vì ném lỗi.
const chaptersOf = (s: OSection): OChapter[] => (Array.isArray(s?.chapters) ? s.chapters : []);
const lessonsOf = (c: OChapter): OLesson[] => (Array.isArray(c?.lessons) ? c.lessons : []);
const sectionsOf = (s: readonly OSection[] | null | undefined): readonly OSection[] => (Array.isArray(s) ? s : []);

/** Cây hiện mấy cấp: hàng phần chỉ hiện khi khoá có >1 phần; hàng chương chỉ hiện khi phần đó có >1 chương (1 chương → bài đứng thẳng dưới phần). */
export function outlineShape(sections: readonly OSection[]): { showSection: boolean; showChapterIn: Record<string, boolean> } {
  const list = sectionsOf(sections);
  const showChapterIn: Record<string, boolean> = {};
  for (const s of list) showChapterIn[s.id] = chaptersOf(s).length > 1;
  return { showSection: list.length > 1, showChapterIn };
}

/** Đã học bao nhiêu bài của một chương. Id đã học không thuộc chương thì không tính; chương rỗng (0/0) không bao giờ "xong". */
export function chapterProgress(chapter: OChapter, done: ReadonlySet<string> | null | undefined): { done: number; total: number; complete: boolean } {
  const lessons = lessonsOf(chapter);
  let n = 0;
  if (done) for (const l of lessons) if (done.has(l.id)) n++;
  return { done: n, total: lessons.length, complete: lessons.length > 0 && n === lessons.length };
}

/** Mọi id chương theo thứ tự trong cây (dùng cho "Mở hết"). */
export function allChapterIds(sections: readonly OSection[]): string[] {
  const out: string[] = [];
  for (const s of sectionsOf(sections)) for (const c of chaptersOf(s)) out.push(c.id);
  return out;
}

/**
 * Chương mở sẵn: chương chứa bài đang xem (`currentId`); không có thì chương chứa bài kế (`nextId`); không có nữa thì chương đầu tiên.
 * Luôn ≥1 chương nếu cây có chương; cây rỗng → rỗng. Id bài trùng ở nhiều chương (bất thường) → lấy chương đầu tiên chứa nó, không ném lỗi.
 */
export function initialOpenChapters(sections: readonly OSection[], opts: { currentId?: string | null; nextId?: string | null } = {}): Set<string> {
  const chapterOf = (lessonId: string | null | undefined): string | null => {
    if (!lessonId) return null;
    for (const s of sectionsOf(sections)) for (const c of chaptersOf(s)) if (lessonsOf(c).some(l => l.id === lessonId)) return c.id;
    return null;
  };
  const hit = chapterOf(opts?.currentId) ?? chapterOf(opts?.nextId);
  if (hit) return new Set([hit]);
  const first = allChapterIds(sections)[0];
  return first === undefined ? new Set() : new Set([first]);
}

export type OutlineFilter =
  | { sections: OSection[]; openChapterIds: Set<string>; matchedLessons: number; matchedChapters: number }
  | { sections: OSection[]; matches: null };

/**
 * Lọc theo từ khoá: không phân biệt hoa/thường, bỏ dấu, đ = d (qua `fold`/`queryTokens` của librarySearch). Từ khoá <2 ký tự / toàn dấu cách / toàn ký tự đặc biệt
 * → KHÔNG lọc: trả đúng cây gốc kèm `matches: null`.
 * Một bài được giữ khi mọi từ khoá đều có trong tên bài HOẶC tên chương của nó (mỗi từ khoá tìm ở một trong hai chỗ, như `scoreFields`); chương khớp trọn
 * theo tên → giữ CẢ bài của nó. Chương không còn bài thì bỏ, phần không còn chương thì bỏ. `openChapterIds` = mọi chương còn lại.
 * Từ khoá chỉ là chữ đã chuẩn hoá, so bằng `includes` — không dựng regex từ chữ người dùng gõ. Không đổi cây gốc.
 */
export function filterOutline(sections: readonly OSection[], query: string): OutlineFilter {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return { sections: sectionsOf(sections) as OSection[], matches: null };

  const out: OSection[] = [];
  const open = new Set<string>();
  let matchedLessons = 0, matchedChapters = 0;
  for (const s of sectionsOf(sections)) {
    const keptChapters: OChapter[] = [];
    for (const c of chaptersOf(s)) {
      const ct = fold(c.title);
      const wholeChapter = tokens.every(t => ct.includes(t));
      const kept = wholeChapter
        ? lessonsOf(c).slice()
        : lessonsOf(c).filter(l => { const lt = fold(l.title); return tokens.every(t => lt.includes(t) || ct.includes(t)); });
      if (kept.length === 0) continue;
      keptChapters.push({ ...c, lessons: kept });
      open.add(c.id);
      matchedChapters++;
      matchedLessons += kept.length;
    }
    if (keptChapters.length > 0) out.push({ ...s, chapters: keptChapters });
  }
  return { sections: out, openChapterIds: open, matchedLessons, matchedChapters };
}
