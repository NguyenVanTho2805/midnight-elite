// Kho tài liệu công khai có tìm kiếm (NC2-046): gộp TÀI LIỆU CÔNG KHAI (bài miễn phí của các khoá đang mở) và VIDEO YOUTUBE do quản trị chọn.
// THUẦN: không DB. Phần có DB: src/lib/libraryKhoServer.ts. Test: tools/local-e2e/t-library-kho-lib.ts.
//
// Ranh giới riêng tư: kho này CHỈ chứa thứ đã công khai sẵn ở trang /thu-vien của khách (tài liệu của bài `isFree`) và video đã `published`.
// Tài liệu riêng của lớp gia sư KHÔNG bao giờ nằm trong kho — học sinh trong lớp tìm được tài liệu lớp mình bằng dữ liệu đã tải theo phiên (xem libraryOwn).
import { docKind, viewerHref, type DocKind, type LibDoc } from "@/lib/library";
import { searchRank } from "@/lib/librarySearch";
import { thumbUrl, watchUrl } from "@/lib/youtubeLink";

export interface KhoDoc extends LibDoc { courseName: string; lessonTitle: string }
export interface KhoVideo { id: string; title: string; videoId: string; topics: string[]; channel: string; note: string }

export interface KhoDocDTO { name: string; kind: DocKind; href: string; courseName: string; lessonTitle: string }
export interface KhoVideoDTO { id: string; title: string; topics: string[]; channel: string; note: string; url: string; thumb: string }
export interface KhoResult { docs: KhoDocDTO[]; videos: KhoVideoDTO[] }

export const KHO_MAX_DOCS = 30;
export const KHO_MAX_VIDEOS = 20;

/** Tìm trong kho: tiêu đề / tên tệp trọng số cao nhất, rồi chủ đề (video) và tên bài, cuối cùng tên khoá / kênh / ghi chú. Truy vấn quá ngắn → rỗng. */
export function searchKho(docs: readonly KhoDoc[], videos: readonly KhoVideo[], query: unknown): KhoResult {
  const d = searchRank(docs, query, x => [{ text: x.name, weight: 3 }, { text: x.lessonTitle, weight: 2 }, { text: x.courseName, weight: 1 }], KHO_MAX_DOCS);
  const v = searchRank(videos, query, x => [{ text: x.title, weight: 3 }, { text: x.topics.join(" "), weight: 3 }, { text: x.channel, weight: 1 }, { text: x.note, weight: 1 }], KHO_MAX_VIDEOS);
  return {
    docs: d.map(({ item: x }) => ({ name: x.name, kind: docKind(x), href: viewerHref(x.name, x.url), courseName: x.courseName, lessonTitle: x.lessonTitle })),
    videos: v.map(({ item: x }) => ({ id: x.id, title: x.title, topics: x.topics, channel: x.channel, note: x.note, url: watchUrl(x.videoId), thumb: thumbUrl(x.videoId) })),
  };
}
