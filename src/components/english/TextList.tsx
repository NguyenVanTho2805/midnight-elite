// Danh sách bài đọc/nghe kèm độ phủ từ vựng CỦA NGƯỜI HỌC + form thêm bài (dán chữ hoặc link VOA). Dùng chung cho mục Đọc và Nghe.
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { KinButton } from "@/components/kin";
import { api, Card, ErrorLine, INK, LEVEL_TEXT, Pill, Skeleton } from "./ui";

interface Item { id: string; title: string; wordCount: number; source: string; mine: boolean; hasAudio: boolean; coverage: number; level: "nhe" | "hoc" | "kho"; newWords: number }

export default function TextList({ basePath, mode }: { basePath: string; mode: "doc" | "nghe" }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ url: "", title: "", body: "" });
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  const load = useCallback(() => { api<{ items: Item[] }>("/api/english/texts").then(d => { setItems(d.items); setErr(null); }).catch(e => setErr(e.message)); }, []);
  useEffect(load, [load]);

  const add = async (byUrl: boolean) => {
    setSaving(true); setFormErr(null);
    try {
      const r = await api<{ id: string }>("/api/english/texts", { body: byUrl ? { url: form.url } : { title: form.title, body: form.body } });
      router.push(`${basePath}/${r.id}`);
    } catch (e) { setFormErr((e as Error).message); } finally { setSaving(false); }
  };

  const order = { hoc: 0, nhe: 1, kho: 2 } as const;
  const sorted = (items ?? []).slice().sort((a, b) => order[a.level] - order[b.level] || b.coverage - a.coverage);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <KinButton variant="secondary" onClick={() => setAdding(a => !a)} aria-expanded={adding}>Thêm bài</KinButton>
      </div>
      {adding && (
        <Card>
          <h2 className="font-bold mb-2" style={{ color: INK.chinh }}>Thêm bài</h2>
          <form className="flex gap-2 flex-wrap" onSubmit={e => { e.preventDefault(); void add(true); }}>
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="Link bài VOA Learning English (https://learningenglish.voanews.com/…)" aria-label="Link bài VOA"
              className="flex-1 min-w-[240px] min-h-11 px-3 rounded-[var(--kin-bo-md)] border" style={{ borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)" }} />
            <KinButton type="submit" disabled={!form.url.trim()} loading={saving} loadingLabel="Đang tải…">Lấy bài</KinButton>
          </form>
          <p className="text-xs my-3" style={{ color: INK.mo }}>Hoặc dán chữ của một bài bất kỳ (chỉ bạn thấy):</p>
          <form className="space-y-2" onSubmit={e => { e.preventDefault(); void add(false); }}>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Tên bài" aria-label="Tên bài"
              className="w-full min-h-11 px-3 rounded-[var(--kin-bo-md)] border" style={{ borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)" }} />
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={6} placeholder="Dán nội dung bài tiếng Anh…" aria-label="Nội dung bài"
              className="w-full px-3 py-2 rounded-[var(--kin-bo-md)] border" style={{ borderColor: "var(--kin-vien-o-nhap)", background: "var(--kin-nen-trang)" }} />
            <KinButton type="submit" disabled={!form.title.trim() || !form.body.trim()} loading={saving} loadingLabel="Đang lưu…">Lưu bài</KinButton>
          </form>
          {formErr && <div className="mt-2"><ErrorLine message={formErr} /></div>}
        </Card>
      )}
      {err && <ErrorLine message={err} onRetry={load} />}
      {!items ? <Skeleton /> : sorted.length === 0 ? (
        <Card><p className="text-sm" style={{ color: INK.phu }}>Chưa có bài nào. Bấm “Thêm bài” để dán một bài hoặc lấy bài từ VOA Learning English.</p></Card>
      ) : (
        <ul className="space-y-2">
          {sorted.map(t => (
            <li key={t.id}>
              <Link href={`${basePath}/${t.id}`} className="block rounded-[var(--kin-bo-md)] px-4 py-3 min-h-11" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-nhat)" }}>
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium" style={{ color: INK.chinh }}>{t.title}</span>
                  <Pill tone={LEVEL_TEXT[t.level].tone}>{LEVEL_TEXT[t.level].label}</Pill>
                </div>
                <p className="text-xs mt-1" style={{ color: INK.phu }}>
                  {t.wordCount} từ · bạn hiểu {t.coverage}% · {t.newWords} từ mới · {t.source === "voa" ? "VOA" : "bài của bạn"}{mode === "nghe" ? (t.hasAudio ? " · có audio gốc" : " · giọng máy đọc") : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
