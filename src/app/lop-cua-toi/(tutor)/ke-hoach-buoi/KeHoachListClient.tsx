// PH-223 — xem ke-hoach-buoi/page.tsx. Mở bằng ?courseId=…&date=YYYY-MM-DD (từ Lịch) thì điền sẵn lớp và ngày.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KinButton } from "@/components/kin";
import { CARD_STYLE, FIELD_STYLE, callApi, useNotify } from "@/components/tutor/shared";
import { ACTIVITY_KEYS, TITLE_MAX, isDateKey } from "@/lib/sessionPlan";

interface Item { id: string; courseId: string; courseName: string; title: string; dateKey: string | null; filled: number; minutes: number; updatedAt: string }
interface Payload { items: Item[]; courses: { id: string; name: string }[] }

const dmy = (k: string | null) => (k ? `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}` : "chưa chọn ngày");

export default function KeHoachListClient() {
  const notify = useNotify();
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [courseId, setCourseId] = useState("");
  const [dateKey, setDateKey] = useState("");
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    await Promise.resolve();
    const my = ++seq.current;
    setLoading(true); setFailed(false);
    const r = await callApi<Payload>("/api/tutor/session-plans");
    if (my !== seq.current) return;
    if (!r.ok) setFailed(true);
    else {
      setData(r.data);
      const q = new URLSearchParams(window.location.search);
      const qc = q.get("courseId"), qd = q.get("date");
      setCourseId(c => c || (qc && r.data.courses.some(x => x.id === qc) ? qc : r.data.courses[0]?.id ?? ""));
      if (qd && isDateKey(qd)) setDateKey(d => d || qd);
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function create() {
    if (!courseId || busy) return;
    setBusy(true);
    const r = await callApi<{ id: string }>("/api/tutor/session-plans", { method: "POST", body: JSON.stringify({ courseId, title: title.trim() || undefined, dateKey: dateKey || undefined }) });
    setBusy(false);
    if (!r.ok) { notify.err(r.data.error ?? "Không tạo được kế hoạch"); return; }
    router.push(`/lop-cua-toi/ke-hoach-buoi/${r.data.id}`);
  }

  const items = (data?.items ?? []).filter(i => !filter || i.courseId === filter);
  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Link href="/lop-cua-toi" className="text-sm hover:underline" style={{ color: "var(--kin-chu-phu)" }}>← Lớp của tôi</Link>
      <h1 className="mt-2 text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Kế hoạch buổi</h1>
      <p className="text-caption mt-1 mb-4" style={{ color: "var(--kin-chu-phu)" }}>
        Soạn một lần theo {ACTIVITY_KEYS.length} hoạt động (Mở đầu, Hình thành kiến thức, Luyện tập, Vận dụng), ra hai bản: <b>bản gia sư</b> (đủ đáp án và ghi chú)
        và <b>phiếu học sinh</b> (chỉ câu hỏi dẫn đường và sản phẩm, không có đáp án).
      </p>

      {loading ? (
        <div className="space-y-3" aria-busy="true">{[0, 1].map(i => <div key={i} className="h-24 rounded-xl animate-pulse" style={CARD_STYLE} />)}</div>
      ) : failed || !data ? (
        <div role="alert" className="rounded-xl p-6 text-center text-sm" style={CARD_STYLE}>Không tải được danh sách. <button className="underline font-semibold" onClick={() => void load()}>Thử lại</button></div>
      ) : data.courses.length === 0 ? (
        <div role="status" className="rounded-xl p-8 text-center text-sm" style={{ ...CARD_STYLE, borderStyle: "dashed", color: "var(--kin-chu-phu)" }}>Bạn chưa có lớp nào để soạn kế hoạch.</div>
      ) : (
        <>
          <section aria-labelledby="h-tao" className="rounded-xl p-4 mb-5" style={CARD_STYLE}>
            <h2 id="h-tao" className="text-sm font-bold mb-3" style={{ color: "var(--kin-chu-chinh)" }}>Tạo kế hoạch mới</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-sm block">Lớp
                <select value={courseId} onChange={e => setCourseId(e.target.value)} className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE}>
                  {data.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="text-sm block">Ngày dạy (không bắt buộc)
                <input type="date" value={dateKey} onChange={e => setDateKey(e.target.value)} className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} />
              </label>
              <label className="text-sm block">Tên buổi (không bắt buộc)
                <input value={title} maxLength={TITLE_MAX} onChange={e => setTitle(e.target.value)} placeholder="Ví dụ: Hàm số bậc nhất" className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} />
              </label>
            </div>
            <div className="mt-3"><KinButton loading={busy} onClick={() => void create()}>Tạo và soạn</KinButton></div>
          </section>

          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <h2 className="text-sm font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Kế hoạch đã soạn ({items.length})</h2>
            {data.courses.length > 1 && (
              <label className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>Lọc theo lớp
                <select value={filter} onChange={e => setFilter(e.target.value)} className="ml-2 px-2 py-1.5 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE}>
                  <option value="">Tất cả lớp</option>
                  {data.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
          </div>
          {items.length === 0 ? (
            <p role="status" className="rounded-xl p-6 text-center text-sm" style={{ ...CARD_STYLE, borderStyle: "dashed", color: "var(--kin-chu-phu)" }}>Chưa có kế hoạch nào. Tạo kế hoạch đầu tiên ở trên.</p>
          ) : (
            <ul className="space-y-2">
              {items.map(i => (
                <li key={i.id}>
                  <Link href={`/lop-cua-toi/ke-hoach-buoi/${i.id}`} className="block rounded-xl p-4 min-h-[44px]" style={CARD_STYLE}>
                    <p className="font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>{i.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>
                      {i.courseName} · {dmy(i.dateKey)} · đã soạn {i.filled}/{ACTIVITY_KEYS.length} hoạt động{i.minutes ? ` · ${i.minutes} phút` : ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
