// Hỏi sách (kiểu NotebookLM, nhưng chỉ trong sách của chính bạn): trả lời tiếng Việt, luôn kèm unit + trang để mở sách kiểm tra.
"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, Card, INK, LinkButton, PageHead, Skeleton } from "@/components/english/ui";
import AskBox from "@/components/english/AskBox";

interface Book { id: string; title: string; status: string }

function Inner() {
  const initial = useSearchParams().get("sach") ?? "";
  const [books, setBooks] = useState<Book[] | null>(null);
  const [bookId, setBookId] = useState(initial);
  useEffect(() => { api<{ items: Book[] }>("/api/english/books").then(d => setBooks(d.items)).catch(() => setBooks([])); }, []);
  if (!books) return <Skeleton rows={2} />;
  if (!books.length) return (
    <Card className="flex items-center justify-between gap-3 flex-wrap">
      <p className="text-sm" style={{ color: INK.phu }}>Chưa có sách nào. Thêm sách PDF ở Lớp học rồi quay lại hỏi.</p>
      <LinkButton href="/student/tieng-anh/lop-hoc">Mở Lớp học</LinkButton>
    </Card>
  );
  return (
    <Card>
      <label className="text-sm block mb-3" style={{ color: INK.chinh }}>Hỏi trong
        <select value={bookId} onChange={e => setBookId(e.target.value)} className="ml-2 min-h-11 px-3 rounded-[var(--kin-bo-md)] border" style={{ borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)" }}>
          <option value="">Tất cả sách của tôi</option>
          {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
        </select>
      </label>
      <AskBox key={bookId} bookId={bookId || undefined} />
    </Card>
  );
}

export default function AskPage() {
  return (
    <>
      <PageHead title="Hỏi sách" sub="Câu trả lời chỉ lấy từ sách bạn đã thêm. Không tìm thấy thì app nói thẳng là không có, không đoán." />
      <Suspense fallback={<Skeleton rows={2} />}><Inner /></Suspense>
    </>
  );
}
