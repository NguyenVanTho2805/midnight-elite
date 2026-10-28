// Ô tìm của trang Thư viện (NC2-046, góp ý 28/10: "học sinh trong hoặc ngoài khoá search chiến tranh lạnh thì ra full tài liệu + video").
//   · Trong lớp của bạn (chỉ học sinh): lọc trong trình duyệt trên dữ liệu đã tải theo phiên (src/lib/libraryOwn.ts) — không có đường truy cập mới.
//   · Tài liệu công khai: bài miễn phí của các khoá đang mở (GET /api/thu-vien/tim).
//   · Video tham khảo: video YouTube do quản trị chọn (cùng API). KiN không quét YouTube; video mở ở youtube.com.
// Gõ có dấu hay không đều được ("chien tranh lanh"). Chờ ngừng gõ ~350ms rồi mới gọi; phản hồi của lần gõ cũ không ghi đè lần mới.
"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { queryTokens, QUERY_MAX } from "@/lib/librarySearch";
import { searchOwn, type OwnItem } from "@/lib/libraryOwn";
import type { KhoResult } from "@/lib/libraryKho";
import { KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";

const CHIP = "inline-flex items-center justify-center min-w-[52px] h-8 px-2 flex-shrink-0 rounded-[var(--kin-bo-sm)] text-[length:var(--kin-co-caption)] font-semibold bg-[var(--kin-nen-nhan)] text-[var(--kin-chu-phu)]";
const ROW = "flex items-center gap-3 px-4 py-2 min-h-[56px] hover:bg-[var(--kin-nen-bang)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--kin-nhan-link)]";
const BOX = "rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] overflow-hidden bg-[var(--kin-nen-trang)]";
const H3 = "mb-2 text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)]";

export default function KhoTimKiem({ own = [] }: { own?: OwnItem[] }) {
  const [q, setQ] = useState("");
  const [state, setState] = useState<{ q: string; res: KhoResult | null; error: boolean } | null>(null);
  const [tick, setTick] = useState(0);
  const tokens = useMemo(() => queryTokens(q), [q]);
  const key = tokens.join(" ");
  const mine = useMemo(() => (key ? searchOwn(own, q) : []), [own, q, key]);
  const seq = useRef(0);

  useEffect(() => {
    if (!key) return;
    const my = ++seq.current;
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/thu-vien/tim?q=${encodeURIComponent(q.slice(0, QUERY_MAX))}`, { credentials: "same-origin", cache: "no-store", signal: ctl.signal })
        .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((res: KhoResult) => { if (my === seq.current) setState({ q: key, res, error: false }); })
        .catch(() => { if (my === seq.current && !ctl.signal.aborted) setState({ q: key, res: null, error: true }); });
    }, 350);
    return () => { clearTimeout(t); ctl.abort(); };
    // `q` đổi thì `key` đổi (hoặc chỉ khác hoa / dấu câu — vẫn tìm lại cho đúng chữ người dùng thấy).
  }, [q, key, tick]);

  const cur = state && state.q === key ? state : null; // chưa tải xong cho từ khoá HIỆN TẠI → null (không dùng nhầm kết quả của từ khoá cũ)
  const loading = !!key && !cur;
  // Tài liệu công khai của CHÍNH lớp mình đã nằm ở "Trong lớp của bạn" (cùng liên kết xem trước) → không lặp lại ở nhóm công khai.
  const pubDocs = useMemo(() => { const own = new Set(mine.map(i => i.href)); return (cur?.res?.docs ?? []).filter(d => !own.has(d.href)); }, [mine, cur]);
  const total = mine.length + pubDocs.length + (cur?.res ? cur.res.videos.length : 0);

  return (
    <section role="search" aria-label="Tìm trong Thư viện" data-kho className="mb-6">
      <form onSubmit={e => e.preventDefault()}>
        <label htmlFor="kho-q" className={KIN_LABEL}>Tìm tài liệu và video</label>
        <input id="kho-q" type="search" name="q" value={q} onChange={e => setQ(e.target.value)} maxLength={QUERY_MAX} autoComplete="off" enterKeyHint="search"
          placeholder="Ví dụ: chiến tranh lạnh" className={`${KIN_FIELD} mt-1`} />
      </form>

      {q.trim() !== "" && tokens.length === 0 && <p role="status" className="mt-2 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Gõ ít nhất 2 ký tự.</p>}

      {key && (
        <div data-kho-results aria-live="polite" className="mt-4 flex flex-col gap-5">
          {loading && <p role="status" className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Đang tìm…</p>}
          {cur?.error && (
            <p role="alert" className="rounded-[var(--kin-bo-sm)] px-4 py-3 text-[length:var(--kin-co-small)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] text-[var(--kin-chu-phu)]">
              Không tìm được lúc này. <button type="button" onClick={() => { setState(null); setTick(t => t + 1); }} className="min-h-11 font-semibold underline text-[var(--kin-nhan-link)]">Thử lại</button>
            </p>
          )}

          {mine.length > 0 && (
            <div data-kho-own-list>
              <h3 className={H3}>Trong lớp của bạn ({mine.length})</h3>
              <ul className={BOX}>
                {mine.map(i => (
                  <li key={i.key} data-kho-own className="border-t border-[var(--kin-vien-nhat)] first:border-t-0">
                    <Link href={i.href} className={ROW}>
                      <span aria-hidden className={CHIP}>{i.chip}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-chinh)]">{i.title}</span>
                        <span className="block truncate text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">{i.sub}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pubDocs.length > 0 && (
            <div data-kho-docs>
              <h3 className={H3}>Tài liệu công khai ({pubDocs.length})</h3>
              <ul className={BOX}>
                {pubDocs.map((d, i) => (
                  <li key={`${d.href}-${i}`} data-kho-doc className="border-t border-[var(--kin-vien-nhat)] first:border-t-0">
                    <a href={d.href} target="_blank" rel="noopener noreferrer" className={ROW}>
                      <span aria-hidden className={CHIP}>{d.kind}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-chinh)]">{d.name}</span>
                        <span className="block truncate text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">{[d.courseName, d.lessonTitle].join(" · ")}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {cur?.res && cur.res.videos.length > 0 && (
            <div data-kho-videos>
              <h3 className={H3}>Video tham khảo ({cur.res.videos.length})</h3>
              <ul className={BOX}>
                {cur.res.videos.map(v => (
                  <li key={v.id} data-kho-video className="border-t border-[var(--kin-vien-nhat)] first:border-t-0">
                    <a href={v.url} target="_blank" rel="noopener noreferrer" className={`${ROW} items-start`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh nhỏ của YouTube, không qua trình tối ưu ảnh; no-referrer để không lộ trang đang đọc */}
                      <img src={v.thumb} alt="" width={120} height={68} loading="lazy" referrerPolicy="no-referrer" className="flex-shrink-0 rounded-[var(--kin-bo-sm)] bg-[var(--kin-nen-bang)]" style={{ width: 120, height: 68, objectFit: "cover" }} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-chinh)]">{v.title}<span aria-hidden> ↗</span></span>
                        {v.topics.length > 0 && <span className="block text-[length:var(--kin-co-caption)] text-[var(--kin-chu-phu)]">{v.topics.join(" · ")}</span>}
                        <span className="block text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">{[v.channel, v.note].filter(Boolean).join(" · ") || "Mở trên YouTube"}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">Video do KiN chọn từ YouTube, mở ở youtube.com — không phải bản ghi lớp học.</p>
            </div>
          )}

          {!loading && !cur?.error && total === 0 && (
            <p role="status" data-kho-empty className="rounded-[var(--kin-bo-sm)] px-4 py-3 text-[length:var(--kin-co-small)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] text-[var(--kin-chu-phu)]">
              Không có kết quả cho “{q.trim()}”. Thử từ khoá ngắn hơn; có dấu hay không dấu đều được.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
