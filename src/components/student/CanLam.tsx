// SCL-G-HS (QUYET-DINH-GIAO-DIEN §2.1, §3.3, §3.9; bản chốt khung 1–2): thẻ "Cần làm" dùng chung cho trang lớp và màn Cần làm.
// Thẻ = việc cần làm ngay (nơi DUY NHẤT dùng thẻ ở màn học sinh): viền trái 4px theo trạng thái, icon tròn theo loại, tiêu đề 18px, nhãn hạn đủ thứ/ngày/giờ,
// câu phụ "Chụp ảnh vở hoặc chọn tệp PDF" và nút "Nộp bài" rộng hết thẻ. Chỉ việc hạn gần nhất dùng nút chính (navy), các việc sau dùng nút phụ.
// NộpNhanh: bấm "Nộp bài" mở thẳng chọn ảnh / camera / PDF → ảnh gộp thành MỘT tệp PDF ngay trên máy (đường SCL-D sẵn có) → tải lên (nopTepClient) →
// form POST thường + 303 (route /nop, trường ve=lop) về trang lớp. Lỗi mạng: báo bằng chữ, giữ nguyên ảnh đã chọn, nút "Gửi lại".
"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { KinGradeStatus } from "@/components/kin/Status";
import { uploadNopTepFile } from "@/components/student/nop-tep/nopTepClient";
import { imagesToPdfFile } from "@/lib/imagePdfClient";
import { MAX_IMAGE_PAGES } from "@/lib/imagePdf";
import { NOP_TEP_MAX_BYTES, NOP_TEP_MAX_FILES } from "@/lib/nopTep";
import { deadlineLine, type TodoCard } from "@/lib/studentClassPage";
import { examTarget } from "@/components/student/shared";

const svg = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
export const IconBaiTap = () => <svg {...svg}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 12l2 2 4-4" /></svg>;
export const IconKiemTra = () => <svg {...svg}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
export const IconTaiLen = () => <svg {...svg} width={18} height={18}><path d="M12 16V4M7 9l5-5 5 5M5 20h14" /></svg>;
export const IconVideo = () => <svg {...svg} width={16} height={16}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M10 9.5v5l4-2.5z" fill="currentColor" stroke="none" /></svg>;
export const IconTaiLieu = () => <svg {...svg} width={16} height={16}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></svg>;
export const IconNgoai = () => <svg {...svg} width={16} height={16}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></svg>;

export type CardTone = "qua-han" | "cho" | "mo";
const EDGE: Record<CardTone, string> = { "qua-han": "var(--kin-tt-chu-loi-dam)", cho: "var(--kin-tt-cham-cho)", mo: "var(--kin-tt-cham-trung-tinh)" };
const CHIP: Record<CardTone, string> = {
  "qua-han": "bg-[var(--kin-tt-nen-loi)] text-[var(--kin-tt-chu-loi-dam)] font-semibold",
  cho: "bg-[var(--kin-tt-nen-cho)] text-[var(--kin-tt-chu-cho)] font-medium",
  mo: "bg-[var(--kin-nen-bang)] text-[var(--kin-chu-phu)] font-medium",
};

/** Một thẻ Cần làm. `children` = nút / khối nộp (NopNhanh hoặc liên kết). `classLine` = chấm màu + tên lớp (màn gom mọi lớp). */
export function CanLamCard({ kind, title, deadline, tone, classLine, note, children, id }: {
  kind: "bai-tap" | "kiem-tra"; title: string; deadline: string; tone: CardTone; classLine?: { name: string; color: string };
  note?: string; children: ReactNode; id?: string;
}) {
  return (
    <article id={id} data-can-lam-the={kind} data-tone={tone}
      className="relative rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] p-4 pl-5 overflow-hidden">
      <span aria-hidden className="absolute left-0 inset-y-0 w-1" style={{ background: EDGE[tone] }} />
      <div className="flex items-start gap-3">
        <span aria-hidden className={`flex-shrink-0 grid place-items-center w-10 h-10 rounded-[var(--kin-bo-tron)] ${kind === "bai-tap" ? "bg-[var(--kin-tt-nen-cho)] text-[var(--kin-tt-chu-cho)]" : "bg-[var(--kin-nhan-nen-nhat)] text-[var(--kin-th-navy)]"}`}>
          {kind === "bai-tap" ? <IconBaiTap /> : <IconKiemTra />}
        </span>
        <div className="min-w-0 flex-1">
          {classLine && (
            <p className="flex items-center gap-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)] [overflow-wrap:anywhere]">
              <span aria-hidden className="w-2 h-2 rounded-[var(--kin-bo-tron)] flex-shrink-0" style={{ background: classLine.color }} />{classLine.name}
            </p>
          )}
          <h3 className="text-[length:var(--kin-co-tieu-de)] leading-6 font-semibold text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{title}</h3>
          {deadline && (
            <p data-can-lam-han className={`mt-2 inline-flex items-start gap-1.5 px-2.5 py-1 rounded-[var(--kin-bo-md)] text-[length:var(--kin-co-goc)] leading-5 ${CHIP[tone]}`}>
              <span className="mt-0.5 flex-shrink-0"><IconKiemTra /></span>{deadline}
            </p>
          )}
        </div>
      </div>
      {note && <p className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">{note}</p>}
      <div className="mt-3">{children}</div>
    </article>
  );
}

/** Thẻ sau khi nộp xong (§3.9): "Đã nộp lúc 20:41 thứ Sáu 20/11 · Chờ chấm" + hình nửa tô. */
export function DaNopCard({ title, line, href }: { title: string; line: string; href: string }) {
  return (
    <article data-can-lam-the="da-nop" className="relative rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] p-4 pl-5 overflow-hidden">
      <span aria-hidden className="absolute left-0 inset-y-0 w-1 bg-[var(--kin-tt-cham-xong)]" />
      <h3 className="text-[length:var(--kin-co-tieu-de)] leading-6 font-semibold text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{title}</h3>
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">
        <span data-da-nop-luc>{line}</span><span aria-hidden>·</span><KinGradeStatus state="cho-cham" />
      </p>
      <Link href={href} className="mt-2 inline-flex items-center min-h-11 text-[length:var(--kin-co-goc)] text-[var(--kin-nhan-link)] underline">Xem bài đã nộp</Link>
    </article>
  );
}

const isImage = (f: File) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif|gif|bmp)$/i.test(f.name);
const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

/** id của ô chọn tệp ẩn — dock ghim đáy bấm vào đúng ô này (bản sao của nút chính, không phải nút thứ hai). */
export const nopInputId = (assignmentId: string) => `nop-nhanh-${assignmentId}`;

/**
 * Nút "Nộp bài" mở chọn ảnh / camera / PDF và nộp luôn. `primary` = nút chính của màn (chỉ thẻ hạn gần nhất; bài quá hạn xếp trước nên không bao giờ nhạt hơn
 * bài ít khẩn hơn, §3.2). Không tự đoán gì: hạn, mốc nộp đều do máy chủ đặt.
 */
export function NopNhanh({ assignmentId, title, primary, ve = "lop" }: { assignmentId: string; title: string; primary: boolean; ve?: "lop" | "can-lam" }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const done = useRef<Set<number>>(new Set()); // tệp (theo vị trí) đã tải lên xong — "Gửi lại" không tải trùng

  async function run(picked: File[]) {
    setErr(null);
    const imgs = picked.filter(isImage), pdfs = picked.filter(f => !isImage(f) && isPdf(f));
    if (imgs.length + pdfs.length !== picked.length) { setErr("Chỉ nhận ảnh chụp bài làm hoặc tệp PDF."); return; }
    if (imgs.length > MAX_IMAGE_PAGES) { setErr(`Tối đa ${MAX_IMAGE_PAGES} ảnh mỗi lần nộp.`); return; }
    if (pdfs.length + (imgs.length ? 1 : 0) > NOP_TEP_MAX_FILES) { setErr(`Tối đa ${NOP_TEP_MAX_FILES} tệp mỗi lần nộp.`); return; }
    try {
      const queue: File[] = [...pdfs];
      if (imgs.length) {
        setBusy("Đang gộp ảnh thành PDF…");
        const pdf = await imagesToPdfFile(imgs, NOP_TEP_MAX_BYTES, `bai-lam-${imgs.length}-anh.pdf`);
        if (!pdf) { setErr("Ảnh nặng quá: gộp xong vẫn lớn hơn 10 MB. Bỏ bớt ảnh rồi chọn lại."); return; }
        queue.push(pdf);
      }
      for (let i = 0; i < queue.length; i++) {
        if (done.current.has(i)) continue;
        setBusy(queue.length > 1 ? `Đang gửi tệp ${i + 1}/${queue.length}…` : "Đang gửi bài…");
        const r = await uploadNopTepFile(queue[i], { mode: "student", assignmentId }, { onStage: () => {}, onProgress: () => {}, setAbort: () => {} });
        if (!r.ok) { setErr(r.message); return; }
        done.current.add(i);
      }
      setBusy("Đang nộp bài…");
      formRef.current?.submit(); // POST thường → 303 về trang lớp (?nop=ok&bt=…)
    } catch (e) {
      setErr(e instanceof Error && e.message ? e.message : "Chưa gửi được bài. Kiểm tra mạng rồi bấm Gửi lại.");
    } finally { setBusy(b => (b === "Đang nộp bài…" ? b : null)); }
  }
  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const fs = Array.from(e.target.files ?? []); e.target.value = "";
    if (!fs.length) return;
    done.current = new Set(); setFiles(fs); void run(fs);
  };
  const id = nopInputId(assignmentId);
  return (
    <div data-nop-nhanh={assignmentId}>
      <p className="mb-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">Chụp ảnh vở hoặc chọn tệp PDF</p>
      <input id={id} type="file" accept="image/*,application/pdf" multiple className="sr-only" tabIndex={-1} aria-hidden onChange={pick} data-nop-nhanh-input="" />
      <button type="button" disabled={!!busy} aria-label={`Nộp bài: ${title}`} onClick={() => document.getElementById(id)?.click()}
        className={`${kinButtonClass(primary ? "primary" : "secondary", "lg")} w-full min-h-12`}>
        <IconTaiLen />{busy ? "Đang nộp…" : "Nộp bài"}
      </button>
      <form ref={formRef} method="post" action={`/api/student/nop-bai/${encodeURIComponent(assignmentId)}/nop`} hidden><input type="hidden" name="ve" value={ve} /></form>
      {busy && <p role="status" className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">{busy}</p>}
      {err && (
        <div role="alert" data-nop-nhanh-loi="" className="mt-2 flex flex-wrap items-center gap-2 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi-dam)]">
          <span className="min-w-0 flex-1">{err}{files.length > 0 ? ` (${files.length} tệp đã chọn vẫn giữ)` : ""}</span>
          {files.length > 0 && <button type="button" onClick={() => void run(files)} className={kinButtonClass("secondary")}>Gửi lại</button>}
        </div>
      )}
    </div>
  );
}

/** Dựng một thẻ từ dữ liệu thuần (lib/studentClassPage.buildTodoCards). `showClass` = màn gom mọi lớp (thêm chấm màu + tên lớp). */
export function TodoCardView({ card, now, classColor, ve = "lop" }: { card: TodoCard; now: Date; classColor?: string; ve?: "lop" | "can-lam" }) {
  const a = card.action;
  const exam = a.type === "thi" ? examTarget(a.event) : null;
  return (
    <CanLamCard id={`viec-${card.key}`} kind={card.kind} title={card.title} tone={card.tone} deadline={deadlineLine(card.dueIso, now, card.kind === "kiem-tra")}
      classLine={classColor ? { name: card.courseName, color: classColor } : undefined}
      note={a.type === "ngoai" ? "Bài này nộp ở ngoài KiN. KiN chỉ nhắc hạn, không biết bạn đã nộp chưa." : a.type === "lam" ? "Làm trực tiếp trên web." : undefined}>
      {a.type === "nop" ? <NopNhanh assignmentId={a.assignmentId} title={card.title} primary={card.primary} ve={ve} />
        : a.type === "lam" ? <CardLink href={a.href} label="Làm bài" primary={card.primary} />
        : a.type === "ngoai" ? <CardLink href={a.href} label="Mở bài" primary={card.primary} external />
        : exam && <CardLink href={exam.href} label="Xem thông tin đề" primary={false} external={exam.external} />}
    </CanLamCard>
  );
}

/** Nút của một việc không nộp tệp được ở đây (làm trên web, đề Azota, kiểm tra): liên kết thật, cùng cỡ nút. */
export function CardLink({ href, label, primary, external }: { href: string; label: string; primary: boolean; external?: boolean }) {
  const cls = `${kinButtonClass(primary ? "primary" : "secondary", "lg")} w-full min-h-12`;
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{label}<IconNgoai /></a>
    : <Link href={href} className={cls}>{label}</Link>;
}

/**
 * Dock nộp bài ghim đáy (§2.1, R3): BẢN SAO của nút chính (không phải nút thứ hai), chỉ hiện khi thẻ hạn gần nhất đã cuộn lên khỏi màn hình (IntersectionObserver).
 * Cách thanh dưới 12px; trang chừa padding đáy để dock không che hàng cuối. Hiện/ẩn bằng opacity + transform 180ms, tắt dưới prefers-reduced-motion. Ẩn thì `inert`.
 */
export function NopDock({ card, now }: { card: TodoCard; now: Date }) {
  const [show, setShow] = useState(false);
  const targetId = `viec-${card.key}`;
  useEffect(() => {
    const el = document.getElementById(targetId);
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [targetId]);
  const a = card.action;
  const due = deadlineLine(card.dueIso, now).split(" · ")[0];
  const btn = `${kinButtonClass("primary", "lg")} min-h-12 flex-shrink-0`;
  return (
    <div role="region" aria-label="Nộp bài nhanh" data-nop-dock={show ? "hien" : "an"} aria-hidden={!show} inert={!show}
      className="fixed z-20 inset-x-0 bottom-[calc(var(--kin-cao-thanh-duoi)+12px)] md:bottom-6 md:left-auto md:right-8 md:w-[420px] px-4 md:px-0 transition-[opacity,transform] duration-[180ms] motion-reduce:transition-none"
      style={{ opacity: show ? 1 : 0, transform: show ? "none" : "translateY(12px)", pointerEvents: show ? "auto" : "none" }}>
      <div className="flex items-center gap-3 p-3 rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)]">
        <p className="min-w-0 flex-1">
          <span className="block text-[length:var(--kin-co-body)] leading-6 font-semibold text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">Nộp {card.title}</span>
          {due && <span className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">{due}</span>}
        </p>
        {a.type === "nop"
          ? <button type="button" tabIndex={show ? 0 : -1} onClick={() => document.getElementById(nopInputId(a.assignmentId))?.click()} className={btn}><IconTaiLen />Nộp bài</button>
          : a.type === "ngoai" ? <a href={a.href} target="_blank" rel="noopener noreferrer" tabIndex={show ? 0 : -1} className={btn}>Mở bài<IconNgoai /></a>
          : a.type === "lam" ? <Link href={a.href} tabIndex={show ? 0 : -1} className={btn}>Làm bài</Link> : null}
      </div>
    </div>
  );
}
