// Lớp học từ sách: sách PDF của bạn (Grammar in Use, Improve your Skills…) → bài học có tóm tắt, bài tập chấm theo answer key.
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { KinButton } from "@/components/kin";
import { api, Card, ErrorLine, INK, PageHead, Pill, Progress, Skeleton } from "@/components/english/ui";
import { extractPdfText } from "@/components/english/pdfText";
import { useBookProcessing } from "@/components/english/useBookProcessing";

interface Book { id: string; title: string; kind: string; pageCount: number; status: string; statusNote: string | null; unitsTotal: number; unitsDone: number; studied: number; mastered: number }
const KIND = { grammar: "Ngữ pháp", skills: "Kỹ năng IELTS", other: "Khác" } as const;
const STATUS: Record<string, { label: string; tone: "xong" | "cho" | "loi" | "mo" }> = {
  pages: { label: "Đang nạp trang", tone: "cho" }, processing: { label: "Đang soạn bài", tone: "cho" }, ready: { label: "Sẵn sàng", tone: "xong" }, error: { label: "Lỗi", tone: "loi" },
};

export default function Classroom() {
  const router = useRouter();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<keyof typeof KIND>("grammar");
  const [step, setStep] = useState<{ label: string; pct: number } | null>(null);
  const load = useCallback(() => { api<{ items: Book[] }>("/api/english/books").then(d => { setBooks(d.items); setErr(null); }).catch(e => setErr(e.message)); }, []);
  useEffect(load, [load]);
  const proc = useBookProcessing(load);

  const upload = async () => {
    if (!file) return;
    setErr(null);
    try {
      setStep({ label: "Đang đọc chữ trong file PDF (trên máy bạn)…", pct: 0 });
      const { pageCount, pages } = await extractPdfText(file, (d, t) => setStep({ label: `Đang đọc trang ${d}/${t} (trên máy bạn)…`, pct: (d / t) * 40 }));
      const chars = pages.reduce((n, p) => n + p.text.length, 0);
      if (chars < pageCount * 30) throw new Error("File này gần như không có chữ (bản scan ảnh). Cần bản PDF có thể bôi đen chữ, hoặc chạy OCR trước.");
      const { id } = await api<{ id: string }>("/api/english/books", { body: { title: title.trim() || file.name.replace(/\.pdf$/i, ""), kind, fileName: file.name, pageCount } });
      for (let k = 0; k < pages.length; k += 30) {
        setStep({ label: `Đang gửi chữ trang ${k + 1}–${Math.min(k + 30, pages.length)}…`, pct: 40 + (k / pages.length) * 20 });
        await api(`/api/english/books/${id}/pages`, { body: { pages: pages.slice(k, k + 30) } });
      }
      setStep(null); setFile(null); setTitle("");
      load();
      void proc.run(id);
      router.push(`/student/tieng-anh/lop-hoc/${id}`);
    } catch (e) { setStep(null); setErr((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <PageHead title="Lớp học từ sách" sub="Sách được chia theo unit: tóm tắt tiếng Việt, ví dụ, lỗi hay gặp, bài tập gốc chấm theo đáp án của sách + bài luyện thêm do AI soạn." />

      <Card aria-labelledby="h-them">
        <h2 id="h-them" className="font-bold mb-2" style={{ color: INK.chinh }}>Thêm sách (PDF)</h2>
        <form className="grid sm:grid-cols-[1fr_1fr_auto_auto] gap-2 items-end" onSubmit={e => { e.preventDefault(); void upload(); }}>
          <label className="text-sm" style={{ color: INK.chinh }}>File PDF
            <input type="file" accept="application/pdf" onChange={e => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.pdf$/i, "")); }}
              className="mt-1 w-full min-h-11 text-sm" />
          </label>
          <label className="text-sm" style={{ color: INK.chinh }}>Tên sách
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="vd English Grammar in Use" className="mt-1 w-full min-h-11 px-3 rounded-[var(--kin-bo-md)] border" style={{ borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)" }} />
          </label>
          <label className="text-sm" style={{ color: INK.chinh }}>Loại
            <select value={kind} onChange={e => setKind(e.target.value as keyof typeof KIND)} className="mt-1 w-full min-h-11 px-3 rounded-[var(--kin-bo-md)] border" style={{ borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)" }}>
              {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <KinButton type="submit" disabled={!file || !!step} loading={!!step} loadingLabel="Đang xử lý…">Tạo lớp học</KinButton>
        </form>
        {step && <div className="mt-3"><Progress value={step.pct} label={step.label} /></div>}
        <p className="text-xs mt-3" style={{ color: INK.mo }}>
          File không được tải lên máy chủ — trình duyệt chỉ gửi phần chữ. Sách có bản quyền nên lớp học này chỉ mình bạn thấy; đừng chia sẻ nội dung trích ra.
        </p>
      </Card>

      {err && <ErrorLine message={err} onRetry={load} />}
      {!books ? <Skeleton /> : books.length === 0 ? (
        <Card><p className="text-sm" style={{ color: INK.phu }}>Chưa có sách. Gợi ý thứ tự: Essential Grammar in Use (chặng 1) → English Grammar in Use + Improve your Skills 4.5–6.0 (chặng 2–3) → Improve your Skills 6.0–7.5.</p></Card>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3">
          {books.map(b => (
            <li key={b.id}>
              <Link href={`/student/tieng-anh/lop-hoc/${b.id}`} className="block rounded-[var(--kin-bo-the)] p-4 h-full" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold" style={{ color: INK.chinh }}>{b.title}</span>
                  <Pill tone={STATUS[b.status]?.tone ?? "mo"}>{STATUS[b.status]?.label ?? b.status}</Pill>
                </div>
                <p className="text-xs mt-1 mb-3" style={{ color: INK.phu }}>{KIND[b.kind as keyof typeof KIND] ?? b.kind} · {b.pageCount} trang · {b.unitsTotal} unit</p>
                {b.status === "ready"
                  ? <Progress value={b.unitsTotal ? (b.mastered / b.unitsTotal) * 100 : 0} label={`Đã vững ${b.mastered}/${b.unitsTotal} unit`} />
                  : <Progress value={b.unitsTotal ? (b.unitsDone / b.unitsTotal) * 100 : 0} label="Đang soạn bài" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
