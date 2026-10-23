// Dữ liệu GIẢ cho VIDEO + TÀI LIỆU + AZOTA (mục "Học tập", Figma 464:8628 và 504:6046). Một lớp của gia sư chính với 7 bài đủ mọi trường hợp,
// học sinh chính (hocsinh@kin.local) đã ghi danh. Chạy lặp lại được (tìm-trước-tạo-sau). KHÔNG dùng video có hình học sinh: video thử là hình vẽ tổng hợp (ffmpeg).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { mkCourse } from "../h";
import { localPathFor } from "@/lib/mediaStorageServer";
import type { MockCtx } from "../mock-seed";

export const VIDEO_MOCK_COURSE = "Lớp thử video và tài liệu (thử học liệu)";

/** Tạo một video mp4 3 giây (hình tổng hợp, không có người) vào đúng khoá lưu; trả số byte hoặc null nếu máy không có ffmpeg. */
export function makeSyntheticMp4(storageKey: string): number | null {
  const path = localPathFor(storageKey);
  if (existsSync(path) && statSync(path).size > 0) return statSync(path).size;
  mkdirSync(dirname(path), { recursive: true });
  try {
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=15:duration=3", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-movflags", "+faststart", path], { timeout: 60_000 });
    return statSync(path).size;
  } catch { return null; }
}

export default async function mock(ctx: MockCtx): Promise<string[]> {
  const { prisma, tutor, student } = ctx;
  let c = await prisma.course.findFirst({ where: { ownerId: tutor.id, name: VIDEO_MOCK_COURSE } });
  if (!c) {
    const made = await mkCourse(tutor.id, { name: VIDEO_MOCK_COURSE });
    c = await prisma.course.update({ where: { id: made.id }, data: { status: true } });
  }
  await prisma.enrollment.upsert({ where: { userId_courseId: { userId: student.id, courseId: c.id } }, create: { userId: student.id, courseId: c.id, status: "active" }, update: { status: "active" } });

  const secId = `sec-video-${c.id}`, chId = `ch-video-${c.id}`;
  if (!(await prisma.section.findUnique({ where: { id: secId } }))) await prisma.section.create({ data: { id: secId, title: "Phần 1 · Học liệu thử", order: 1, courseId: c.id } });
  if (!(await prisma.chapter.findUnique({ where: { id: chId } }))) await prisma.chapter.create({ data: { id: chId, title: "Chương 1", order: 1, sectionId: secId } });

  const docs = JSON.stringify([
    { name: "Định lý Vi-ét.pdf", url: "https://res.cloudinary.com/kin-thu/raw/upload/dinh-ly-viet.pdf", type: "pdf" },
    { name: "Bài tập về nhà.docx", url: "https://res.cloudinary.com/kin-thu/raw/upload/bai-tap.docx", type: "doc" },
    { name: "Bản ghi buổi 16/10 (Drive)", url: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view", type: "file" },
    { name: "Sơ đồ ôn tập.png", url: "https://res.cloudinary.com/kin-thu/image/upload/so-do.png", type: "file" },
  ]);
  const key = `${c.id}/mock-bai-giang-tai-len.mp4`;
  const bytes = makeSyntheticMp4(key);
  let asset = await prisma.fileAsset.findFirst({ where: { courseId: c.id, originalName: "bai-giang-tai-len.mp4" } });
  if (!asset && bytes) asset = await prisma.fileAsset.create({ data: { ownerId: tutor.id, courseId: c.id, kind: "video", driver: "local", storageKey: key, mimeType: "video/mp4", bytes, originalName: "bai-giang-tai-len.mp4", status: "ready" } });

  const defs: { id: string; title: string; data: Record<string, unknown> }[] = [
    { id: "yt", title: "Buổi 1 · Video YouTube", data: { videoUrl: "https://youtu.be/dQw4w9WgXcQ", documents: docs } },
    { id: "vimeo", title: "Buổi 2 · Video Vimeo", data: { videoUrl: "https://vimeo.com/76979871" } },
    { id: "up", title: "Buổi 3 · Video tải lên KiN", data: { videoUrl: asset ? `kin-media:${asset.id}` : null, adminNote: "Xem hết video rồi làm bài tập nhé." } },
    { id: "azota", title: "Buổi 4 · Bài Azota hai link", data: { type: "quiz", videoUrl: null, azotaUrl: JSON.stringify(["https://azota.vn/de-thi/mock-phan-1", "https://azota.vn/de-thi/mock-phan-2"]), azotaDeadline: "2026-10-30T20:00" } },
    { id: "bad", title: "Buổi 5 · Link video hỏng", data: { videoUrl: "https://example.com/khong-phai-video" } },
    { id: "empty", title: "Buổi 6 · Chưa có video", data: { videoUrl: null } },
    { id: "docs", title: "Buổi 7 · Chỉ có tài liệu", data: { type: "document", videoUrl: null, documents: docs } },
  ];
  const ids: Record<string, string> = {};
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i], id = `les-video-${d.id}-${c.id}`;
    ids[d.id] = id;
    const base = { code: `V${i + 1}`, title: d.title, type: "record", order: i + 1, chapterId: chId, isLocked: false, isFree: false, ...d.data } as never;
    await prisma.lesson.upsert({ where: { id: id }, create: { id, ...(base as object) } as never, update: base as never });
  }
  if (asset) await prisma.fileAsset.update({ where: { id: asset.id }, data: { lessonId: ids.up } });
  // Học sinh đang xem dở bài 1 ở giây 42, đã xong bài 3, đã báo "đã làm" bài Azota.
  await prisma.lessonProgress.upsert({ where: { userId_lessonId: { userId: student.id, lessonId: ids.yt } }, create: { userId: student.id, lessonId: ids.yt, watchedSeconds: 42, completed: false }, update: { watchedSeconds: 42, completed: false } });
  await prisma.lessonProgress.upsert({ where: { userId_lessonId: { userId: student.id, lessonId: ids.up } }, create: { userId: student.id, lessonId: ids.up, watchedSeconds: 3, completed: true }, update: { completed: true } });
  await prisma.lessonAzotaDone.upsert({ where: { lessonId_userId: { lessonId: ids.azota, userId: student.id } }, create: { lessonId: ids.azota, userId: student.id, kind: "link", linkUrl: "https://azota.vn/bai-lam/mock-hs" }, update: {} });

  return [
    `HỌC SINH: đăng nhập hocsinh@kin.local → /student/bai-giang/${ids.yt} (bài YouTube, đang xem dở 0:42, thanh bên ghi "Đang xem"; tab Tài liệu có Xem thử / Tải về; tab Ghi chú có "Ghim mốc đang xem").`,
    `  · Vimeo: /student/bai-giang/${ids.vimeo} (khung nhúng sandbox) · Video tải lên KiN: /student/bai-giang/${ids.up} ${asset ? "(phát được, hình test 3 giây)" : "(CHƯA tạo được: máy không có ffmpeg)"}`,
    `  · Bài Azota hai link + hạn 30/10/2026 20:00 + "Em đã làm xong" (đã báo, kèm link): /student/bai-giang/${ids.azota} · Link hỏng: /student/bai-giang/${ids.bad} · Chưa có video: /student/bai-giang/${ids.empty}`,
    `GIA SƯ: đăng nhập giasu@kin.local → /admin/khoa-hoc/${c.id}?tab=chuong-bai → mở phần "Phần 1 · Học liệu thử" → Sửa một bài: dán link Azota vào ô video để thấy báo lỗi + nút chuyển ô; bài Azota có bảng "Ai đã làm bài Azota"; hộp tải video có tích xác nhận bản quyền/riêng tư.`,
  ];
}
