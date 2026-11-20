// BU-03 P2 · S9 — Tệp đề gốc (/lop-cua-toi/de-thi/ngan-hang-de-thi). Thay bí danh trang quản trị. Vẫn là kho lưu tệp đề gốc (Word/PDF/ảnh, thư mục phẳng) như cũ,
// thêm cột "Đã tách thành đề" và nút "Tách thành đề": Word (.docx) được KiN đọc theo mẫu Azota (đáp án + bảng đáp án cuối đề, KHÔNG AI), cô xem tóm tắt rồi tạo ĐỀ NHÁP;
// đề tạo xong được gắn ngược vào tệp (gan-de) để lần sau hiện "Mở đề đã tách". PDF/ảnh không tách ở đây (cần AI): dẫn sang "Nhập từ PDF/ảnh".
// Dữ liệu: /api/exam-files (có sẵn, GET/POST/PATCH/DELETE), /api/exam-file-folders (có sẵn), POST /api/tutor/de-thi/tep-goc/[fileId]/tach|gan-de (mới).
// Giản lược so với trang cũ: bỏ đổi tên / xoá thư mục và xoá nhiều tệp một lúc (chưa có trong hợp đồng vòng này) — tệp và thư mục tạo mới, chuyển thư mục, xoá từng tệp vẫn đủ.
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { KinPage, KinPageHeader, KinPageSkeleton, KIN_FIELD, KIN_LABEL, KIN_TABLE_HEAD, KIN_TABLE_ROW } from "@/components/kin/PageLayout";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinStateCard } from "@/components/kin/StateCard";
import { KinStatus } from "@/components/kin/Status";
import { KinToast } from "@/components/kin/Toast";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { api, type ExamFileFolderFull, type ExamFileFull } from "@/lib/api";
import { fileProblem, IMPORT_ACCEPT, qfetch, sizeText } from "@/components/tutor/quiz/quizClient";
import { deThiDetailHref, deThiListHref, ganDe, importSave, isDocxFile, taoDeHref, tachTepGoc, toExamInputs, type AzotaParse } from "./deThiClient";
import { KinSelect } from "@/components/kin/KinSelect";

type FileRow = ExamFileFull & { extractedExamId?: string | null };
const GRID = "lg:grid lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1.8fr)] lg:gap-x-4";
const dmy = (iso: string): string => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("vi-VN"); };
const baseName = (n: string) => n.replace(/\.[^.]+$/, "");

export default function TepGoc() {
  const router = useRouter();
  const { ask, dialog } = useKinConfirm();
  const [files, setFiles] = useState<FileRow[] | null>(null);
  const [folders, setFolders] = useState<ExamFileFolderFull[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [q, setQ] = useState("");
  const [folderSel, setFolderSel] = useState("all"); // all | none | <folderId>
  const [newFolder, setNewFolder] = useState("");
  const [uploading, setUploading] = useState(false);
  const [upErr, setUpErr] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tone: "xong" | "loi"; title: string; detail?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tách thành đề
  const [target, setTarget] = useState<FileRow | null>(null);
  const [parse, setParse] = useState<AzotaParse | null>(null);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [making, setMaking] = useState(false);
  const [makeErr, setMakeErr] = useState<string | null>(null);
  const [made, setMade] = useState<string | null>(null); // đề đã tạo nhưng chưa gắn được vào tệp

  useEffect(() => {
    let alive = true;
    void Promise.all([qfetch<FileRow[]>("GET", "/api/exam-files"), qfetch<ExamFileFolderFull[]>("GET", "/api/exam-file-folders")]).then(([f, d]) => {
      if (!alive) return;
      if (!f.ok || !f.data) { setErr(f.error ?? "Chưa tải được danh sách tệp."); return; }
      setErr(null); setFiles(f.data); setFolders(d.ok && Array.isArray(d.data) ? d.data : []);
    });
    return () => { alive = false; };
  }, [reload]);
  function retry() { setErr(null); setFiles(null); setReload(n => n + 1); }

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (files ?? []).filter(f => (!t || f.fileName.toLowerCase().includes(t)) && (folderSel === "all" ? true : folderSel === "none" ? !f.folderId : f.folderId === folderSel));
  }, [files, q, folderSel]);

  async function upload(f: File | null) {
    if (!f) return;
    const p = fileProblem(f);
    if (p) { setUpErr(p); return; }
    setUploading(true); setUpErr(null);
    try {
      await api.examFiles.upload(f, folderSel !== "all" && folderSel !== "none" ? folderSel : null);
      setToast({ tone: "xong", title: "Đã lưu tệp đề gốc", detail: f.name });
      setReload(n => n + 1);
    } catch (e) { setUpErr(e instanceof Error ? e.message : "Chưa tải lên được tệp."); }
    finally { setUploading(false); if (inputRef.current) inputRef.current.value = ""; }
  }
  async function addFolder() {
    const name = newFolder.trim();
    if (!name) return;
    const r = await qfetch<ExamFileFolderFull>("POST", "/api/exam-file-folders", { name });
    if (!r.ok || !r.data) { setToast({ tone: "loi", title: "Chưa tạo được thư mục", detail: r.error ?? undefined }); return; }
    setFolders(a => [...a, r.data!]); setNewFolder(""); setFolderSel(r.data.id);
  }
  async function move(f: FileRow, folderId: string) {
    setBusy(`mv:${f.id}`);
    const r = await qfetch<FileRow>("PATCH", `/api/exam-files/${f.id}`, { folderId: folderId || null });
    setBusy(null);
    if (!r.ok || !r.data) { setToast({ tone: "loi", title: "Chưa chuyển được thư mục", detail: r.error ?? undefined }); return; }
    setFiles(a => (a ?? []).map(x => x.id === f.id ? { ...x, folderId: folderId || null, folder: folders.find(d => d.id === folderId) ? { id: folderId, name: folders.find(d => d.id === folderId)!.name } : null } : x));
  }
  async function remove(f: FileRow) {
    if (!(await ask({ title: `Xoá tệp “${f.fileName}”?`, message: "Chỉ xoá tệp lưu trữ. Đề đã tách từ tệp này và câu hỏi đã lưu vào ngân hàng giữ nguyên.", confirmLabel: "Xoá tệp", tone: "nguy-hiem" }))) return;
    setBusy(`rm:${f.id}`);
    const r = await qfetch<unknown>("DELETE", `/api/exam-files/${f.id}`);
    setBusy(null);
    if (!r.ok) { setToast({ tone: "loi", title: "Chưa xoá được tệp", detail: r.error ?? undefined }); return; }
    setFiles(a => (a ?? []).filter(x => x.id !== f.id));
    if (target?.id === f.id) closeSplit();
    setToast({ tone: "xong", title: "Đã xoá tệp" });
  }

  function closeSplit() { setTarget(null); setParse(null); setParseErr(null); setMakeErr(null); setMade(null); }
  async function split(f: FileRow) {
    setTarget(f); setParse(null); setParseErr(null); setMakeErr(null); setMade(null); setTitle(baseName(f.fileName)); setBusy(`split:${f.id}`);
    const r = await tachTepGoc(f.id);
    setBusy(null);
    if (!r.ok || !r.data) { setParseErr(r.code === "NOT_DOCX" ? "Tệp này không phải Word .docx. Với PDF hoặc ảnh, cô dùng “Nhập từ PDF/ảnh”." : r.error ?? "Chưa đọc được tệp."); return; }
    if (r.data.fatal) { setParseErr(r.data.fatal); return; }
    setParse(r.data);
  }
  const needFix = (parse?.questions ?? []).filter(q => q.flags.some(f => f === "answer_missing" || f === "answer_conflict" || f === "formula_unread")).length;
  async function makeExam() {
    if (!target || !parse) return;
    setMaking(true); setMakeErr(null);
    const r = await importSave({ title: title.trim(), fileName: target.fileName, questions: toExamInputs(parse.questions.map(q => ({ type: q.type, text: q.text, imageUrl: q.imageUrl, explanation: q.explanation, options: q.options }))) });
    if (!r.ok || !r.data) { setMaking(false); setMakeErr(r.error ?? "Chưa tạo được đề."); return; }
    const g = await ganDe(target.id, r.data.id);
    if (!g.ok) { setMaking(false); setMade(r.data.id); setMakeErr(`Đề nháp đã được tạo, nhưng chưa gắn được vào tệp: ${g.error ?? "lỗi chưa rõ"}`); return; }
    router.push(deThiDetailHref(r.data.id));
  }

  if (err) {
    return (
      <KinPage>
        <KinPageHeader title="Tệp đề gốc" back={{ href: deThiListHref(), label: "Đề thi" }} />
        <KinStateCard tone="loi" kicker="Lỗi · Có thể thử lại" title="Chưa tải được tệp đề gốc" actions={<KinButton onClick={retry}>Thử lại</KinButton>}>{err}</KinStateCard>
      </KinPage>
    );
  }
  if (!files) return <KinPageSkeleton label="Đang tải tệp đề gốc" rows={4} side={false} />;

  return (
    <KinPage>
      {dialog}
      <KinPageHeader title="Tệp đề gốc" back={{ href: deThiListHref(), label: "Đề thi" }} sub="Lưu Word/PDF đề gốc, tách thành đề khi cần"
        actions={
          <>
            <label className={`${kinButtonClass("primary")} cursor-pointer ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
              {uploading ? "Đang tải lên…" : "Tải tệp lên"}
              <input ref={inputRef} type="file" accept={IMPORT_ACCEPT} className="sr-only" aria-label="Tải tệp đề gốc lên" disabled={uploading} onChange={e => void upload(e.target.files?.[0] ?? null)} />
            </label>
          </>
        } />
      {toast && <div className="mb-4"><KinToast tone={toast.tone} title={toast.title} detail={toast.detail} onClose={() => setToast(null)} /></div>}
      {upErr && <p role="alert" className="mb-4 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{upErr}</p>}

      {target && (
        <section aria-labelledby="tg-tach" className="mb-8 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] p-6 space-y-4">
          <KinSectionHead id="tg-tach" title={`Tách thành đề · ${target.fileName}`} />
          {busy === `split:${target.id}` && <div aria-busy="true" aria-label="Đang đọc tệp" className="space-y-3"><div className="h-6 w-2/3 rounded kin-skel kin-skel--soft" /><div className="h-6 w-1/2 rounded kin-skel kin-skel--soft" /></div>}
          {parseErr && (
            <div className="space-y-3">
              <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{parseErr}</p>
              <div className="flex flex-wrap gap-3"><KinButton onClick={() => void split(target)}>Thử lại</KinButton><Link href={taoDeHref("pdf")} className={kinButtonClass("secondary")}>Nhập từ PDF/ảnh (AI)</Link><KinButton variant="ghost" onClick={closeSplit}>Đóng</KinButton></div>
            </div>
          )}
          {parse && (
            <div className="space-y-4">
              <KinCallout tone="nhan" title="Không tốn lượt AI">KiN đọc Word theo mẫu Azota ngay trên máy chủ. Chưa có gì được ghi cho tới khi cô bấm “Tạo đề nháp”.</KinCallout>
              <p role="status" className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">
                Đọc được {parse.stats.total} câu, {parse.stats.withAnswer} câu có đáp án{parse.stats.withImage ? `, ${parse.stats.withImage} câu có hình` : ""}.
                {needFix > 0 && <> <KinStatus tone="loi">{needFix} câu cần xử lý sau khi tạo đề (thiếu hoặc mâu thuẫn đáp án, còn công thức chưa đọc)</KinStatus></>}
              </p>
              {parse.errors.length > 0 && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-cho)]">{parse.errors.length} phần trong tệp chưa đọc được và bị bỏ qua: {parse.errors.slice(0, 3).map(e => e.message).join("; ")}{parse.errors.length > 3 ? "…" : ""}</p>}
              {parse.stats.total === 0 ? (
                <KinEmptyState title="Chưa đọc được câu nào" action={<Link href={taoDeHref("pdf")} className={kinButtonClass("secondary")}>Nhập từ PDF/ảnh (AI)</Link>}>Tệp có thể không theo mẫu Azota (“Câu 1.”, “A.”…). Cô thử nhập bằng AI hoặc soạn tay.</KinEmptyState>
              ) : (
                <div className="max-w-[560px]">
                  <label htmlFor="tg-ten" className={`${KIN_LABEL} mb-2`}>Tên đề *</label>
                  <input id="tg-ten" className={KIN_FIELD} value={title} maxLength={150} onChange={e => setTitle(e.target.value)} />
                  <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đề là bản nháp, tổng 10 điểm chia đều. Câu thiếu đáp án vẫn lưu được nhưng chưa phát hành được cho tới khi cô sửa trong đề.</p>
                </div>
              )}
              {makeErr && <div role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{makeErr} {made && <Link href={deThiDetailHref(made)} className="underline">Mở đề vừa tạo</Link>}</div>}
              <div className="flex flex-wrap gap-3">
                {parse.stats.total > 0 && !made && <KinButton onClick={() => void makeExam()} disabled={!title.trim() || making} loading={making} loadingLabel="Đang tạo đề…">Tạo đề nháp với {parse.stats.total} câu</KinButton>}
                <KinButton variant="secondary" onClick={closeSplit}>Đóng</KinButton>
              </div>
            </div>
          )}
        </section>
      )}

      {files.length === 0 ? (
        <KinEmptyState title="Cô chưa lưu tệp đề gốc nào" action={<KinButton onClick={() => inputRef.current?.click()}>Tải tệp lên</KinButton>}>
          Cô lưu đề Word, PDF hoặc ảnh ở đây để xem lại. Với Word theo mẫu Azota, bấm “Tách thành đề” là có ngay đề nháp, không tốn lượt AI.
        </KinEmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3 pb-4">
            <div className="min-w-0 w-full sm:w-64">
              <label htmlFor="tg-q" className={`${KIN_LABEL} mb-2`}>Tìm tệp</label>
              <input id="tg-q" type="search" className={KIN_FIELD} value={q} onChange={e => setQ(e.target.value)} />
            </div>
            <div className="min-w-0 w-full sm:w-56">
              <label htmlFor="tg-fd" className={`${KIN_LABEL} mb-2`}>Thư mục</label>
              <KinSelect id="tg-fd" value={folderSel} onChange={v => setFolderSel(v)}>
                <option value="all">Tất cả</option><option value="none">Chưa phân loại</option>
                {folders.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </KinSelect>
            </div>
            <form className="min-w-0 w-full sm:w-auto flex items-end gap-2" onSubmit={e => { e.preventDefault(); void addFolder(); }}>
              <div className="min-w-0 flex-1 sm:w-56"><label htmlFor="tg-nf" className={`${KIN_LABEL} mb-2`}>Thư mục mới</label><input id="tg-nf" className={KIN_FIELD} value={newFolder} maxLength={80} onChange={e => setNewFolder(e.target.value)} placeholder="Tên thư mục" /></div>
              <KinButton type="submit" variant="secondary" disabled={!newFolder.trim()}>Thêm</KinButton>
            </form>
          </div>

          {shown.length === 0 ? (
            <KinEmptyState title="Không có tệp nào khớp" action={<KinButton variant="secondary" onClick={() => { setQ(""); setFolderSel("all"); }}>Bỏ lọc</KinButton>}>Cô thử tên khác hoặc chọn “Tất cả” thư mục.</KinEmptyState>
          ) : (
            <div className="rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] overflow-hidden">
              <div className={`hidden ${GRID} ${KIN_TABLE_HEAD}`} aria-hidden><span>Tên tệp</span><span>Ngày tải</span><span>Thư mục</span><span>Đã tách thành đề</span><span className="text-right">Việc</span></div>
              <ul aria-label="Danh sách tệp đề gốc">
                {shown.map(f => (
                  <li key={f.id} data-tep-goc={f.id} className={`${GRID} ${KIN_TABLE_ROW} flex flex-col gap-y-2 lg:items-center`}>
                    <div className="min-w-0"><p className="font-medium text-[var(--kin-chu-chinh)] break-words">{f.fileName}</p></div>
                    <div className="min-w-0 text-[var(--kin-chu-mo)]">{dmy(f.createdAt)}</div>
                    <div className="min-w-0">
                      <label htmlFor={`tg-mv-${f.id}`} className="sr-only">Thư mục của {f.fileName}</label>
                      <KinSelect id={`tg-mv-${f.id}`} value={f.folderId ?? ""} disabled={busy === `mv:${f.id}`} onChange={v => void move(f, v)}>
                        <option value="">Chưa phân loại</option>
                        {folders.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </KinSelect>
                    </div>
                    <div className="min-w-0">{f.extractedExamId ? <KinStatus tone="xong">Đã tách thành đề</KinStatus> : <KinStatus tone="mo">Chưa tách</KinStatus>}</div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <a href={f.fileUrl} target="_blank" rel="noopener noreferrer" className={kinButtonClass("secondary")}>Xem tệp</a>
                      {f.extractedExamId
                        ? <Link href={deThiDetailHref(f.extractedExamId)} className={kinButtonClass("primary")}>Mở đề đã tách</Link>
                        : isDocxFile(f)
                          ? <KinButton onClick={() => void split(f)} loading={busy === `split:${f.id}`} loadingLabel="Đang đọc…" disabled={busy !== null}>Tách thành đề</KinButton>
                          : <Link href={taoDeHref("pdf")} className={kinButtonClass("secondary")} title="PDF và ảnh cần AI để tách">Nhập bằng AI</Link>}
                      <KinButton variant="danger" onClick={() => void remove(f)} loading={busy === `rm:${f.id}`} loadingLabel="Đang xoá…" aria-label={`Xoá tệp ${f.fileName}`}>Xoá</KinButton>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Tệp tối đa {sizeText(4 * 1024 * 1024)}. Muốn đưa câu hỏi vào ngân hàng thay vì tạo đề, cô dùng “Nhập từ Word” ở Ngân hàng câu hỏi.</p>
        </>
      )}
    </KinPage>
  );
}
