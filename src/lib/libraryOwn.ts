// Tìm trong tài liệu CỦA CÁC LỚP MÌNH ĐANG HỌC (học sinh, NC2-046). THUẦN: không DB. Test: tools/local-e2e/t-library-kho-lib.ts.
// Không có đường truy cập mới: dữ liệu là `LibClass[]` mà trang Thư viện ĐÃ tải theo phiên của chính học sinh (src/lib/libraryServer.ts → loadStudentLibrary,
// chỉ lớp có Enrollment active của người đó); ở đây chỉ làm phẳng rồi lọc trong trình duyệt. Tài liệu riêng của lớp khác không bao giờ có trong dữ liệu này.
import { docKind, viewerHref, LESSON_TYPE_LABEL } from "@/lib/library";
import { searchRank } from "@/lib/librarySearch";
import type { LibClass } from "@/lib/libraryServer";

export interface OwnItem { key: string; chip: string; title: string; sub: string; href: string; className: string; lessonTitle: string; where: string }
export const OWN_MAX = 30;

/** Mỗi bài có nội dung là một mục (chip VIDEO nếu có bản ghi, không thì BÀI); mỗi tài liệu là một mục riêng mở ở trang xem trước. */
export function ownItemsOf(classes: readonly LibClass[]): OwnItem[] {
  const out: OwnItem[] = [];
  for (const c of classes) for (const l of c.lessons) {
    const open = `/student/bai-giang/${l.id}`;
    out.push({ key: `${l.id}`, chip: l.hasVideo ? "VIDEO" : "BÀI", title: l.title, sub: [c.name, LESSON_TYPE_LABEL[l.type]].filter(Boolean).join(" · "), href: open, className: c.name, lessonTitle: l.title, where: l.where });
    for (const d of l.docs) out.push({ key: `${l.id}:${d.url}`, chip: docKind(d), title: d.name, sub: [c.name, l.title].join(" · "), href: viewerHref(d.name, d.url), className: c.name, lessonTitle: l.title, where: l.where });
  }
  return out;
}

export function searchOwn(items: readonly OwnItem[], query: unknown): OwnItem[] {
  return searchRank(items, query, i => [{ text: i.title, weight: 3 }, { text: i.lessonTitle, weight: 2 }, { text: i.where, weight: 1 }, { text: i.className, weight: 1 }], OWN_MAX).map(r => r.item);
}
