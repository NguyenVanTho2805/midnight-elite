// BU-02 — "Xem như học sinh" (Figma 607:491, chưa đối chiếu). Bản xem THỬ cho gia sư: dựng riêng, KHÔNG dùng LessonVideo / AzotaPanel / StampedNotes (ba khối đó ghi dữ liệu thật:
// /api/progress, /api/lesson-notes, azota-done). Chỉ ĐỌC bài bằng GET /api/lessons/[id] (chủ lớp thấy đủ link), rồi cho hai góc nhìn:
//   • Học sinh đã vào lớp  = bài nguyên bản;
//   • Người chưa vào lớp   = đi qua đúng lessonFor() của máy chủ với viewer=null (link trống, tài liệu [], trừ bài học thử miễn phí).
// Tài liệu dùng DocumentRows (thuần). Video: YouTube/Vimeo/Drive nhúng bằng embedUrl KiN dựng lại; "kin-media:" phát bằng <video src="/api/media/<mã>/stream">.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinPage, KinPageHeader, KinPageSkeleton } from "@/components/kin/PageLayout";
import { KinStateCard } from "@/components/kin/StateCard";
import { KinStatus } from "@/components/kin/Status";
import { KinCallout } from "@/components/kin/Callout";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { DocumentRows, parseMaterials, formatDeadlineVn } from "@/components/media/StudentLessonPanels";
import { classifyMediaLink, parseLinkList, firstSafeHttpsLink, uploadIdOf } from "@/lib/mediaLink";
import { giaoTrinhHref } from "@/lib/tutorRoutes";
import { jfetch } from "@/components/tutor/studentUi";

interface RawLesson {
  id: string; title: string; type?: string; duration?: string | null; isLocked?: boolean; isFree?: boolean;
  videoUrl?: string | null; zoomUrl?: string | null; azotaUrl?: string | null; azotaDeadline?: string | null; documents?: string | null;
  chapter?: { section?: { courseId?: string } };
}
// KHÔNG import "@/lib/mediaAccess" vào component client: nó kéo "@/lib/enrollment" (nạp prisma bằng import động) vào gói trình duyệt, trang vỡ 500 ở dev.
// Bản sao nhỏ của redactLesson cho viewer=null; danh sách trường phải khớp PROTECTED_LESSON_FIELDS (src/lib/mediaAccess.ts; t-giao-trinh-lib đối chiếu).
const OUTSIDER_REDACTED_FIELDS = ["videoUrl", "zoomUrl", "azotaUrl", "documents", "adminNote"] as const;
function lessonForOutsider<L extends { isFree?: boolean | null }>(lesson: L): L {
  if (lesson.isFree === true) return lesson;
  const out: Record<string, unknown> = { ...(lesson as Record<string, unknown>) };
  for (const f of OUTSIDER_REDACTED_FIELDS) if (f in out) out[f] = f === "documents" ? "[]" : null;
  return out as L;
}
type View = "da-vao" | "chua-vao";
type Load = { phase: "loading" } | { phase: "error"; status: number } | { phase: "ready"; lesson: RawLesson };

export default function XemNhuHocSinh({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const [load, setLoad] = useState<Load>({ phase: "loading" });
  const [view, setView] = useState<View>("da-vao");
  const back = { href: giaoTrinhHref(courseId, true), label: "← Giáo trình" };

  const run = useCallback(async () => {
    setLoad({ phase: "loading" });
    const r = await jfetch(`/api/lessons/${lessonId}`);
    if (r.ok && r.json?.id) {
      // Bài phải thuộc đúng lớp trong đường dẫn (không cho mở bài lớp khác qua URL này).
      if (r.json.chapter?.section?.courseId && r.json.chapter.section.courseId !== courseId) { setLoad({ phase: "error", status: 404 }); return; }
      setLoad({ phase: "ready", lesson: r.json as RawLesson });
    } else setLoad({ phase: "error", status: r.status });
  }, [lessonId, courseId]);
  // Tải lần đầu: đúng ý "đồng bộ với hệ thống ngoài" (API); setState trong run() là trạng thái đang tải.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void run(); }, [run]);

  const shown = useMemo<RawLesson | null>(() => {
    if (load.phase !== "ready") return null;
    // Cùng hàm với máy chủ: viewer=null → khoá link trừ bài isFree.
    return view === "chua-vao" ? lessonForOutsider(load.lesson) : load.lesson;
  }, [load, view]);

  if (load.phase === "loading") return <KinPageSkeleton label="Đang tải bản xem thử" rows={3} side={false} />;
  if (load.phase === "error") {
    const gone = load.status === 403 || load.status === 404;
    return (
      <KinPage>
        <KinPageHeader title="Xem như học sinh" back={back} />
        <div className="max-w-xl">
          <KinStateCard tone="loi" kicker={gone ? "Không mở được" : "Lỗi · Có thể thử lại"} title={gone ? "Không tìm thấy bài này trong lớp của bạn" : "Chưa tải được bài để xem thử"}
            status={<KinStatus tone="loi">{gone ? "Bài không tồn tại hoặc không thuộc lớp này" : "Kết nối bị gián đoạn"}</KinStatus>}
            actions={<>{!gone && <KinButton type="button" onClick={() => void run()}>Thử lại</KinButton>}<Link href={back.href} className={kinButtonClass("secondary")}>Về Giáo trình</Link></>}>
            {gone ? "Chọn lại một bài ở màn Giáo trình." : "Dữ liệu của bạn không bị ảnh hưởng. Thử lại sau ít giây."}
          </KinStateCard>
        </div>
      </KinPage>
    );
  }

  const full = load.lesson;
  const l = shown!;
  const hidden = view === "chua-vao" && !full.isFree;
  const videos = parseLinkList(l.videoUrl).map(u => classifyMediaLink(u));
  const zoom = firstSafeHttpsLink(l.zoomUrl);
  const azota = firstSafeHttpsLink(l.azotaUrl);
  const deadline = formatDeadlineVn(l.azotaDeadline);
  const materials = parseMaterials(l.documents);
  const nothing = videos.length === 0 && !zoom && !azota && materials.length === 0;

  return (
    <KinPage>
      <KinPageHeader title={full.title} back={back} sub={full.duration || undefined}
        actions={<Link href={back.href} className={kinButtonClass("secondary")}>Quay lại soạn</Link>} />

      <div role="status" data-gt-ban-xem-thu className="mb-5"><KinCallout title="Đây là bản xem thử. Không ghi tiến độ.">Bạn xem đúng thứ học sinh thấy; những gì bạn bấm ở đây không tính vào tiến độ hay bài nộp của ai.</KinCallout></div>

      <div role="group" aria-label="Góc nhìn" className="mb-6 flex flex-wrap gap-2">
        <KinButton type="button" variant={view === "da-vao" ? "primary" : "secondary"} aria-pressed={view === "da-vao"} onClick={() => setView("da-vao")}>Học sinh đã vào lớp</KinButton>
        <KinButton type="button" variant={view === "chua-vao" ? "primary" : "secondary"} aria-pressed={view === "chua-vao"} onClick={() => setView("chua-vao")}>Người chưa vào lớp</KinButton>
      </div>

      {view === "da-vao" && full.isLocked && <p className="mb-4"><KinStatus tone="cho" className="whitespace-normal">Bài này đang khoá: học sinh chưa mở được cho tới khi bạn mở khoá ở màn Giáo trình.</KinStatus></p>}
      {hidden && <div className="mb-5"><KinCallout title="Người chưa vào lớp không thấy nội dung bài này">Link video, Zoom, Azota và tài liệu bị ẩn. Muốn cho học thử, bật “Cho học thử miễn phí” ở màn Giáo trình.</KinCallout></div>}
      {view === "chua-vao" && full.isFree && <p className="mb-4"><KinStatus tone="xong" className="whitespace-normal">Bài học thử miễn phí: người chưa vào lớp xem được. Mở tệp trên KiN vẫn cần đăng nhập.</KinStatus></p>}

      {!hidden && nothing && (
        <div role="status" className="py-10 text-center max-w-[44ch] mx-auto">
          <p className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">Bài này chưa có nội dung</p>
          <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Học sinh sẽ thấy khung trống. Thêm video, tài liệu hoặc bài tập ở màn Giáo trình.</p>
          <Link href={back.href} className={`${kinButtonClass("primary")} mt-5`}>Thêm nội dung</Link>
        </div>
      )}

      {!hidden && videos.length > 0 && (
        <section aria-labelledby="xem-video" className="mb-8">
          <KinSectionHead id="xem-video" title="Video bài giảng" />
          <div className="mt-4 space-y-5">
            {videos.map((v, i) => {
              const up = uploadIdOf(v.url);
              return (
                <div key={i} data-xem-video={v.kind}>
                  {up ? (
                    // preload="none": bản xem thử không tự tải video nặng
                    <video controls preload="none" src={`/api/media/${up}/stream`} className="w-full max-w-3xl rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-bang)]" aria-label={`Video ${i + 1}`} />
                  ) : v.ok && v.embedUrl ? (
                    <div className="relative w-full max-w-3xl aspect-video rounded-[var(--kin-bo-md)] overflow-hidden bg-[var(--kin-nen-bang)]">
                      <iframe src={v.embedUrl} title={`Video ${i + 1} · ${v.label}`} className="absolute inset-0 w-full h-full border-0" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
                    </div>
                  ) : v.ok ? (
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className={kinButtonClass("secondary")}>Mở video ({v.label}) ở tab mới</a>
                  ) : (
                    <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]" role="alert">Link video cũ bị hỏng: {v.error ?? "không đọc được"}. Gỡ rồi dán lại ở màn Giáo trình.</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!hidden && (zoom || azota) && (
        <section aria-labelledby="xem-lien-ket" className="mb-8">
          <KinSectionHead id="xem-lien-ket" title="Buổi học và bài tập" />
          <div className="mt-4 flex flex-wrap gap-3">
            {zoom && <a href={zoom} target="_blank" rel="noopener noreferrer" className={kinButtonClass("secondary")}>Vào phòng học trực tuyến</a>}
            {azota && <a href={azota} target="_blank" rel="noopener noreferrer" className={kinButtonClass("secondary")}>Mở bài tập</a>}
          </div>
          {azota && deadline && <p className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Hạn nộp: <b className="font-medium">{deadline.text}</b>{deadline.overdue ? " (đã quá hạn)" : ""}</p>}
        </section>
      )}

      {!hidden && materials.length > 0 && (
        <section aria-labelledby="xem-tai-lieu" className="mb-8 max-w-3xl">
          <h2 id="xem-tai-lieu" className="sr-only">Tài liệu</h2>
          <DocumentRows materials={materials} />
        </section>
      )}
    </KinPage>
  );
}
