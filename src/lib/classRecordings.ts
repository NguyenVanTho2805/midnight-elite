// MD-02 / MD-17 / BC-03 / MD-11 — phần THUẦN (không DB, không môi trường) của "Bản ghi của lớp".
//
// Bản ghi = LINK CHỮ gia sư dán sau buổi học (YouTube, Drive, Vimeo, Zoom cloud). KiN không tải video lên, không phát lại,
// không biết ai mở link ngoài (chỉ video đăng thành BÀI GIẢNG mới có LessonProgress). Hai việc khác nhau, luôn nói rõ ở giao diện.
import { checkLinkForSlot, classifyMediaLink, parseLinkList, type MediaKind } from "./mediaLink";

/** Loại link nhận làm bản ghi. Không nhận video tải lên KiN (MD-04 chưa mở), Azota, phòng Zoom, link lạ. */
export const RECORDING_KINDS: readonly MediaKind[] = ["youtube", "vimeo", "drive", "zoom_record"];
export const MAX_RECORDINGS_PER_COURSE = 300;
export const RECORDING_TITLE_MAX = 120;

/** Cam kết bản quyền khi dán link (MD-11). CHỮ NÀY CẦN LUẬT SƯ DUYỆT trước khi công bố rộng (KE-HOACH-HOAN-THIEN mục 7). */
export const COPYRIGHT_PLEDGE_LABEL =
  "Tôi là người tạo ra nội dung này, hoặc tôi có quyền chia sẻ nó với học sinh của lớp. Tôi không dán link chứa hình ảnh hay giọng nói của học sinh nếu chưa có sự đồng ý phù hợp.";
export const COPYRIGHT_NOTICE =
  "KiN chỉ lưu đường link bạn dán, không lưu tệp và không kiểm tra bản quyền thay bạn. Nếu có khiếu nại về nội dung, KiN có thể gỡ link khỏi lớp; bạn chịu trách nhiệm về quyền chia sẻ nội dung này.";
/** Đánh dấu cho người rà soát: chữ ở trên chưa qua luật sư. Không hiện cho người dùng cuối. */
export const COPYRIGHT_TEXT_NEEDS_LAWYER_REVIEW = true;

export interface RecordingLinkCheck { ok: boolean; error: string | null; warning: string | null; url: string; kind: MediaKind | null; label: string }

/** Kiểm một link bản ghi (đúng bộ kiểm của ô Video bài giảng, rồi thu hẹp về 4 nguồn). Một link duy nhất, không danh sách. */
export function checkRecordingLink(raw: string | null | undefined): RecordingLinkCheck {
  const text = (raw ?? "").trim();
  const fail = (error: string): RecordingLinkCheck => ({ ok: false, error, warning: null, url: "", kind: null, label: "" });
  if (!text) return fail("Chưa dán link bản ghi.");
  if (parseLinkList(text).length !== 1) return fail("Mỗi lần chỉ dán MỘT link bản ghi.");
  const slot = checkLinkForSlot(text, "video");
  if (!slot.ok) return fail(slot.error ?? "Link chưa đúng.");
  const info = classifyMediaLink(text);
  if (!info.ok || !RECORDING_KINDS.includes(info.kind as MediaKind)) {
    return fail(info.kind === "upload"
      ? "KiN chưa nhận video tải lên. Hãy đưa bản ghi lên YouTube (Không công khai), Google Drive, Vimeo hoặc Zoom cloud rồi dán link."
      : "Chỉ nhận link bản ghi từ YouTube, Google Drive, Vimeo hoặc Zoom cloud.");
  }
  return { ok: true, error: null, warning: slot.warning ?? info.warning, url: info.url, kind: info.kind as MediaKind, label: info.label };
}

/** Tên bản ghi: bỏ ký tự điều khiển, gộp khoảng trắng; 1..120 ký tự. */
export function cleanRecordingTitle(raw: unknown): { ok: true; title: string } | { ok: false; error: string } {
  if (typeof raw !== "string") return { ok: false, error: "Chưa đặt tên bản ghi." };
  const t = raw.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return { ok: false, error: "Chưa đặt tên bản ghi." };
  if (t.length > RECORDING_TITLE_MAX) return { ok: false, error: `Tên bản ghi tối đa ${RECORDING_TITLE_MAX} ký tự.` };
  return { ok: true, title: t };
}

// ── Gom theo buổi ────────────────────────────────────────────────────────────

export interface RecordingLite { id: string; title: string; url: string; kind: string; sessionId: string | null; createdAt: Date }
export interface SessionLite { id: string; dateKey: string; note?: string | null }
export interface SessionRecordings<R extends RecordingLite = RecordingLite> { session: SessionLite; recordings: R[] }

/**
 * Buổi mới nhất trước, mỗi buổi kèm bản ghi gắn vào nó (mới nhất trước). `unattached` = bản ghi chưa gắn buổi nào, HOẶC gắn vào buổi không còn
 * (đã xoá) — không để bản ghi biến mất chỉ vì buổi bị xoá.
 */
export function groupRecordingsBySession<R extends RecordingLite>(recordings: R[], sessions: SessionLite[]): { bySession: SessionRecordings<R>[]; unattached: R[] } {
  const newest = (a: R, b: R) => b.createdAt.getTime() - a.createdAt.getTime();
  const known = new Set(sessions.map(s => s.id));
  const bySession = [...sessions]
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .map(session => ({ session, recordings: recordings.filter(r => r.sessionId === session.id).sort(newest) }));
  const unattached = recordings.filter(r => !r.sessionId || !known.has(r.sessionId)).sort(newest);
  return { bySession, unattached };
}

/** Một nhóm tháng của trang Bản ghi (NC2-042): thu gọn / mở được. `key` là "YYYY-MM" hoặc UNATTACHED_KEY. */
export interface RecordingMonthGroup<R extends RecordingLite = RecordingLite> {
  key: string;
  /** "Tháng 10/2026" hoặc "Chưa gắn buổi". */
  label: string;
  /** Mỗi bản ghi kèm khoá ngày của buổi nó thuộc về (null = chưa gắn buổi). Bản ghi mới nhất trước trong từng buổi. */
  items: { rec: R; sessionDateKey: string | null }[];
}
export const UNATTACHED_KEY = "chua-gan-buoi";

/**
 * Gom kết quả của groupRecordingsBySession theo THÁNG của buổi học (tháng mới nhất trước), để danh sách dài thu gọn được.
 * Buổi không có bản ghi nào thì không tạo nhóm rỗng. Bản ghi chưa gắn buổi (hoặc buổi đã xoá) vào nhóm cuối, không biến mất.
 * Không đổi dữ liệu đầu vào.
 */
export function groupRecordingsByMonth<R extends RecordingLite>(g: { bySession: SessionRecordings<R>[]; unattached: R[] }): RecordingMonthGroup<R>[] {
  const groups: RecordingMonthGroup<R>[] = [];
  for (const { session, recordings } of g.bySession) {
    if (recordings.length === 0) continue;
    const key = session.dateKey.slice(0, 7);
    let grp = groups.find(x => x.key === key);
    if (!grp) { grp = { key, label: `Tháng ${Number(key.slice(5, 7))}/${key.slice(0, 4)}`, items: [] }; groups.push(grp); }
    for (const rec of recordings) grp.items.push({ rec, sessionDateKey: session.dateKey });
  }
  if (g.unattached.length) groups.push({ key: UNATTACHED_KEY, label: "Chưa gắn buổi", items: g.unattached.map(rec => ({ rec, sessionDateKey: null })) });
  return groups;
}

// ── MD-17: ai đã xem video (LessonProgress) ───────────────────────────────────

export type WatchState = "xong" | "dang-xem" | "chua";
export interface WatchLesson { id: string; title: string; hasVideo: boolean }
export interface WatchProgressRow { userId: string; lessonId: string; completed: boolean; watchedSeconds: number }
export interface WatchTable {
  lessons: { id: string; title: string; xong: number; dangXem: number; chua: number }[];
  students: { id: string; name: string; cells: Record<string, WatchState>; xong: number }[];
  videoCount: number;
}

/** "đã xem" = đã đánh dấu xong; "đang xem" = có giây xem nhưng chưa xong. Chỉ tính bài CÓ video; chỉ các em trong `students` (đã lọc theo lớp ở nơi gọi). */
export function buildWatchTable(lessons: WatchLesson[], students: { id: string; name: string }[], progress: WatchProgressRow[]): WatchTable {
  const videos = lessons.filter(l => l.hasVideo);
  const byKey = new Map(progress.map(p => [`${p.userId}|${p.lessonId}`, p]));
  const stateOf = (uid: string, lid: string): WatchState => {
    const p = byKey.get(`${uid}|${lid}`);
    if (!p) return "chua";
    if (p.completed) return "xong";
    return p.watchedSeconds > 0 ? "dang-xem" : "chua";
  };
  const rows = students.map(s => {
    const cells: Record<string, WatchState> = {};
    for (const l of videos) cells[l.id] = stateOf(s.id, l.id);
    return { id: s.id, name: s.name, cells, xong: videos.filter(l => cells[l.id] === "xong").length };
  });
  return {
    videoCount: videos.length,
    students: rows,
    lessons: videos.map(l => ({
      id: l.id, title: l.title,
      xong: rows.filter(r => r.cells[l.id] === "xong").length,
      dangXem: rows.filter(r => r.cells[l.id] === "dang-xem").length,
      chua: rows.filter(r => r.cells[l.id] === "chua").length,
    })),
  };
}

export const WATCH_LABEL: Record<WatchState, string> = { xong: "Đã xem xong", "dang-xem": "Đang xem", chua: "Chưa xem" };

// ── BC-03: tiến độ học liệu của MỘT em trong MỘT lớp, để vào báo cáo tháng ─────

export interface MediaProgress { videosTotal: number; videosWatched: number; azotaTotal: number; azotaPending: number }
export interface MediaLesson { id: string; hasVideo: boolean; hasAzota: boolean }

/**
 * Chỉ ĐẾM số đã có: video của lớp (bài có link video) em đã đánh dấu xong; bài Azota em chưa báo "đã làm".
 * "Chưa làm" ở đây nghĩa là KiN chưa thấy em báo (KiN không biết em có làm ở Azota hay không, và không biết điểm).
 */
export function summariseMediaProgress(lessons: MediaLesson[], watchedLessonIds: ReadonlySet<string>, azotaDoneLessonIds: ReadonlySet<string>): MediaProgress {
  const videos = lessons.filter(l => l.hasVideo);
  const azota = lessons.filter(l => l.hasAzota);
  return {
    videosTotal: videos.length,
    videosWatched: videos.filter(l => watchedLessonIds.has(l.id)).length,
    azotaTotal: azota.length,
    azotaPending: azota.filter(l => !azotaDoneLessonIds.has(l.id)).length,
  };
}

/** Dòng chữ trong báo cáo tháng, hoặc null khi lớp chưa có video lẫn Azota (không in dòng trống / số 0/0). */
export function mediaProgressLine(m: MediaProgress | undefined | null): string | null {
  if (!m || (m.videosTotal === 0 && m.azotaTotal === 0)) return null;
  const parts: string[] = [];
  if (m.videosTotal > 0) parts.push(`đã xem ${m.videosWatched}/${m.videosTotal} video bài giảng`);
  if (m.azotaTotal > 0) parts.push(m.azotaPending === 0 ? "đã báo làm hết bài Azota" : `${m.azotaPending}/${m.azotaTotal} bài Azota chưa báo đã làm`);
  return parts.join("; ");
}
