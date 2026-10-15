// Giao diện Thư viện theo Figma 30:2 "Bản ghi và tài liệu": mỗi lớp một khối; trong lớp, mỗi BÀI một nhóm (tiêu đề nhóm xám) chứa video, tài liệu, bài tập
// kèm trạng thái của riêng người xem. Gom theo bài chứ không theo loại tệp — học sinh tìm "bài hôm thứ Năm", không tìm "file PDF thứ tư".
// Thành phần máy chủ (không trạng thái); dữ liệu từ src/lib/libraryServer.ts.
import Link from "next/link";
import { KinStatus } from "@/components/kin/Status";
import { docKind, viewerHref, LESSON_TYPE_LABEL } from "@/lib/library";
import type { LibClass, LibLesson } from "@/lib/libraryServer";

const CHIP = "inline-flex items-center justify-center w-[60px] h-10 flex-shrink-0 rounded-[var(--kin-bo-sm)] text-[length:var(--kin-co-caption)] font-semibold";

function Row({ chip, chipVideo, title, sub, href, status }: { chip: string; chipVideo?: boolean; title: string; sub?: string; href: string; status?: { label: string; tone: "xong" | "cho" | "loi" | "mo" } | null }) {
  return (
    <li className="border-t border-[var(--kin-vien-nhat)] first:border-t-0">
      <Link href={href} className="flex items-center gap-3 px-4 py-3 min-h-[56px] hover:bg-[var(--kin-nen-bang)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--kin-nhan-link)] transition-colors">
        <span aria-hidden className={CHIP} style={chipVideo ? { background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" } : { background: "var(--kin-nen-nhan)", color: "var(--kin-chu-phu)" }}>{chip}</span>
        <span className="flex-1 min-w-0">
          <span className="block truncate text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-chinh)]">{title}</span>
          {sub && <span className="block truncate text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">{sub}</span>}
        </span>
        {status && <KinStatus tone={status.tone} className="flex-shrink-0">{status.label}</KinStatus>}
      </Link>
    </li>
  );
}

function Lesson({ l, role, courseId }: { l: LibLesson; role: "student" | "tutor"; courseId: string }) {
  const open = role === "student" ? `/student/bai-giang/${l.id}` : `/admin/khoa-hoc/${courseId}?tab=chuong-bai`;
  return (
    <section aria-labelledby={`l-${l.id}`} className="rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] overflow-hidden bg-[var(--kin-nen-trang)]">
      <div className="flex items-center gap-3 px-4 py-3 bg-[var(--kin-nen-bang)] border-b border-[var(--kin-vien-thuong)]">
        <div className="flex-1 min-w-0">
          <h3 id={`l-${l.id}`} className="truncate text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)]">{l.title}</h3>
          <p className="truncate text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">{[l.where, LESSON_TYPE_LABEL[l.type]].filter(Boolean).join(" · ")}</p>
        </div>
        <Link href={open} className="flex-shrink-0 inline-flex items-center min-h-11 px-2 text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-nhan-link)] hover:underline">{role === "student" ? "Mở bài" : "Sửa bài"}</Link>
      </div>
      <ul>
        {l.hasVideo && <Row chip="VIDEO" chipVideo title="Bản ghi bài học" sub={[l.duration, "đường dẫn của gia sư"].filter(Boolean).join(" · ")} href={open} status={l.watch} />}
        {l.docs.map(d => <Row key={d.url} chip={docKind(d)} title={d.name} href={viewerHref(d.name, d.url)} />)}
        {l.assignments.map(a => <Row key={a.id} chip="BÀI TẬP" title={a.title} sub={a.due ? `hạn nộp ${a.due}` : undefined} href={open} status={a.status} />)}
      </ul>
    </section>
  );
}

export default function LibraryView({ role, classes }: { role: "student" | "tutor"; classes: LibClass[] }) {
  const lessons = classes.reduce((n, c) => n + c.lessons.length, 0);
  return (
    <div className="bg-[var(--kin-nen-trang)]">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <header className="mb-4">
          <h1 className="kin-chu-tieu-de text-[length:var(--kin-co-h3)] font-semibold text-[var(--kin-chu-chinh)]">Thư viện</h1>
          <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)] mt-1">
            {role === "student" ? "Bản ghi và tài liệu của các lớp bạn đang học" : "Bản ghi và tài liệu của các lớp bạn dạy"} · {classes.length} lớp · {lessons} bài có nội dung · mọi tệp đều thuộc về một bài học
          </p>
        </header>

        <p role="note" className="mb-5 flex gap-2 rounded-[var(--kin-bo-sm)] px-[14px] py-3 bg-[var(--kin-nhan-nen-nhat)] text-[length:var(--kin-co-small)] text-[var(--kin-nhan-chu-tren-nhat)]">
          <span aria-hidden className="mt-[7px] w-[7px] h-[7px] rounded-full flex-shrink-0 bg-[var(--kin-nhan-nen)]" />
          <span>Video là đường dẫn tới nơi gia sư đăng (YouTube, Drive…) — KiN không lưu file video, chỉ ghi nó thuộc bài nào{role === "student" ? " và bạn đã xem đến đâu" : ""}.</span>
        </p>

        {classes.length === 0 ? (
          <div className="rounded-[var(--kin-bo-the)] p-6 text-center text-[length:var(--kin-co-small)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] text-[var(--kin-chu-phu)]">
            {role === "student"
              ? <>Bạn chưa vào lớp nào nên chưa có gì ở đây. <Link href="/student/nhap-ma-lop" className="font-semibold text-[var(--kin-nhan-link)] underline">Nhập mã mời để vào lớp</Link>.</>
              : <>Bạn chưa mở lớp nào. <Link href="/admin/khoa-hoc" className="font-semibold text-[var(--kin-nhan-link)] underline">Tạo lớp</Link> rồi thêm bài giảng, tài liệu và bài tập.</>}
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {classes.map(c => (
              <section key={c.id} aria-labelledby={`c-${c.id}`}>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 id={`c-${c.id}`} className="text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-chu-chinh)]">{c.name}</h2>
                  {/* "Lớp" là đường học theo thứ tự (tiến độ, "Tiếp tục học"); Thư viện là nơi tìm lại — nối hai nơi để khỏi hỏi "khác gì?". */}
                  {role === "student" && (
                    <Link href={`/student/hoc-tap?course=${c.id}`} data-lop-link className="flex-shrink-0 min-h-11 inline-flex items-center text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-nhan-link)] hover:underline">Học tiếp trong lớp →</Link>
                  )}
                </div>
                {c.lessons.length === 0 ? (
                  <p className="rounded-[var(--kin-bo-sm)] px-4 py-3 text-[length:var(--kin-co-small)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] text-[var(--kin-chu-phu)]">
                    Lớp này chưa có bản ghi, tài liệu hay bài tập nào.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {c.lessons.map(l => <Lesson key={l.id} l={l} role={role} courseId={c.id} />)}
                    {c.emptyLessons > 0 && <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">{c.emptyLessons} bài khác chưa có bản ghi hay tài liệu.</p>}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
