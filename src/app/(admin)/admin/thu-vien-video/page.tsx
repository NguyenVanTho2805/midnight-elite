// NC2-046 — quản lý VIDEO YOUTUBE trong kho tài liệu (hiện ở ô tìm của trang Thư viện). Quản lý trung tâm (admin_super, admin_content).
// Mặc định Q19: KiN không gọi YouTube Data API, không quét YouTube — quản trị dán link video và gắn chủ đề để học sinh tìm "chiến tranh lạnh" ra video đã chọn.
// KiN chỉ lưu mã video + tiêu đề + chủ đề; video mở ở youtube.com. Chỉ hiện ở trang công khai khi bật "Công khai".
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";
import { Badge, CARD_STYLE, FIELD_STYLE, Modal, callApi, useNotify } from "@/components/tutor/shared";
import { parseLibraryVideoInput, VIDEO_CHANNEL_MAX, VIDEO_NOTE_MAX, VIDEO_TITLE_MAX, VIDEO_TOPICS_MAX } from "@/lib/libraryVideo";
import { thumbUrl } from "@/lib/youtubeLink";

interface Item { id: string; title: string; videoId: string; url: string; thumb: string; topics: string[]; channel: string; note: string; published: boolean }
interface Payload { videos: Item[]; total: number; published: number }
interface Form { title: string; url: string; topics: string; channel: string; note: string; published: boolean }

const emptyForm = (): Form => ({ title: "", url: "", topics: "", channel: "", note: "", published: false });
const toForm = (v: Item): Form => ({ title: v.title, url: v.url, topics: v.topics.join(", "), channel: v.channel, note: v.note, published: v.published });

export default function ThuVienVideoAdminPage() {
  return (
    <PermissionGuard required={PERMISSIONS.MANAGE_NEWS}>
      <Content />
    </PermissionGuard>
  );
}

function Content() {
  const notify = useNotify();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState<Item | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    await Promise.resolve();
    const my = ++seq.current;
    setLoading(true); setFailed(false);
    const r = await callApi<Payload>("/api/admin/thu-vien-video");
    if (my !== seq.current) return;
    if (!r.ok) setFailed(true); else setData(r.data);
    setLoading(false);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Kiểm ngay khi gõ bằng đúng hàm của máy chủ: báo lỗi sớm, và hiện ảnh nhỏ của video khi link đã đúng.
  const live = useMemo(() => (editing ? parseLibraryVideoInput(editing.form) : null), [editing]);

  async function save() {
    if (!editing) return;
    setBusy("save"); setFormError("");
    const body = JSON.stringify(editing.form);
    const r = editing.id ? await callApi(`/api/admin/thu-vien-video/${editing.id}`, { method: "PATCH", body }) : await callApi("/api/admin/thu-vien-video", { method: "POST", body });
    setBusy(null);
    if (!r.ok) { setFormError(r.data.error ?? "Không lưu được"); return; }
    notify.ok(editing.id ? "Đã lưu thay đổi." : "Đã thêm video.");
    setEditing(null);
    await load();
  }
  async function togglePublished(it: Item) {
    setBusy(`${it.id}:published`);
    const r = await callApi(`/api/admin/thu-vien-video/${it.id}`, { method: "PATCH", body: JSON.stringify({ published: !it.published }) });
    setBusy(null);
    if (!r.ok) notify.err(r.data.error ?? "Không cập nhật được");
    await load();
  }
  async function remove() {
    if (!deleting) return;
    setBusy("delete");
    const r = await callApi(`/api/admin/thu-vien-video/${deleting.id}`, { method: "DELETE" });
    setBusy(null);
    if (!r.ok) { notify.err(r.data.error ?? "Không xoá được"); return; }
    notify.ok("Đã xoá video.");
    setDeleting(null);
    await load();
  }

  const btn = "px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px]";
  const fld = "block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]";
  const set = (patch: Partial<Form>) => setEditing(e => (e ? { ...e, form: { ...e.form, ...patch } } : e));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>Video tham khảo (YouTube)</h1>
        <p className="text-sm mt-1" style={{ color: "var(--kin-chu-phu)" }}>
          Danh sách video do bạn chọn. Khi học sinh hoặc khách tìm ở trang <code>/thu-vien</code> (VD “chiến tranh lạnh”), video có tiêu đề hoặc <b>chủ đề</b> khớp sẽ hiện cùng tài liệu.
          KiN không quét YouTube và không lưu video: chỉ lưu mã video, tiêu đề và chủ đề; video mở ở youtube.com. Chỉ video bật <b>Công khai</b> mới hiện.
        </p>
      </div>

      {loading && !data ? (
        <div aria-busy="true" className="h-32 rounded-xl animate-pulse" style={{ background: "var(--kin-nen-bang)" }} />
      ) : failed || !data ? (
        <div role="alert" className="rounded-xl p-6 text-center text-sm" style={CARD_STYLE}>
          Không tải được dữ liệu. <button className="underline font-semibold" onClick={() => void load()}>Thử lại</button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" data-add-video className={btn} style={{ background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" }} onClick={() => { setFormError(""); setEditing({ id: null, form: emptyForm() }); }}>+ Thêm video</button>
            <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }} aria-live="polite">Tổng {data.total} video · công khai {data.published}</p>
          </div>
          {data.total === 0 ? (
            <p role="status" className="rounded-xl p-8 text-sm text-center" style={{ background: "var(--kin-nen-bang)", border: "1px dashed var(--kin-vien-thuong)", color: "var(--kin-chu-phu)" }}>
              Chưa có video nào. Ô tìm ở trang Thư viện vẫn tìm được tài liệu công khai; thêm video ở đây để kết quả có cả video.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid var(--kin-vien-thuong)" }}>
              <table className="w-full text-sm" style={{ background: "var(--kin-nen-trang)" }}>
                <caption className="sr-only">Danh sách video tham khảo</caption>
                <thead>
                  <tr style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-phu)" }}>
                    <th scope="col" className="text-left px-3 py-2">Video</th>
                    <th scope="col" className="text-left px-3 py-2">Chủ đề</th>
                    <th scope="col" className="text-left px-3 py-2">Công khai</th>
                    <th scope="col" className="text-right px-3 py-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {data.videos.map(it => (
                    <tr key={it.id} data-video-row style={{ borderTop: "1px solid var(--kin-vien-nhat)" }}>
                      <th scope="row" className="text-left px-3 py-2 font-normal">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh nhỏ của YouTube, không qua trình tối ưu ảnh */}
                          <img src={it.thumb} alt="" width={96} height={54} loading="lazy" referrerPolicy="no-referrer" className="rounded flex-shrink-0" style={{ width: 96, height: 54, objectFit: "cover", background: "var(--kin-nen-bang)" }} />
                          <div className="min-w-0">
                            <div className="font-semibold">{it.title}</div>
                            <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-xs underline inline-flex items-center min-h-[44px]" style={{ color: "var(--kin-nhan-link)" }}>{it.channel || "Mở trên YouTube"}<span aria-hidden> ↗</span></a>
                          </div>
                        </div>
                      </th>
                      <td className="px-3 py-2">{it.topics.length ? it.topics.join(", ") : <span style={{ color: "var(--kin-chu-mo)" }}>Chưa gắn chủ đề</span>}</td>
                      <td className="px-3 py-2">
                        <button type="button" role="switch" aria-checked={it.published} aria-label={`Công khai: ${it.title}`} disabled={busy === `${it.id}:published`} onClick={() => void togglePublished(it)} className="min-h-[44px]">
                          <Badge tone={it.published ? "ok" : "neutral"}>{it.published ? "Công khai" : "Bản nháp"}</Badge>
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button type="button" className="underline font-semibold min-h-[44px] px-2" aria-label={`Sửa ${it.title}`} onClick={() => { setFormError(""); setEditing({ id: it.id, form: toForm(it) }); }}>Sửa</button>
                        <button type="button" className="underline font-semibold min-h-[44px] px-2" style={{ color: "var(--kin-tt-chu-loi)" }} aria-label={`Xoá ${it.title}`} onClick={() => setDeleting(it)}>Xoá</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {editing && (
        <Modal title={editing.id ? "Sửa video" : "Thêm video"} onClose={() => setEditing(null)} labelledBy="vd-form-title">
          <form onSubmit={e => { e.preventDefault(); void save(); }} className="space-y-3" data-video-form>
            <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Link YouTube
              <input id="vd-url" value={editing.form.url} onChange={e => set({ url: e.target.value })} className={fld} style={FIELD_STYLE} placeholder="https://www.youtube.com/watch?v=… hoặc https://youtu.be/…" />
            </label>
            <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Tiêu đề (hiện ở kết quả tìm)
              <input id="vd-title" value={editing.form.title} onChange={e => set({ title: e.target.value })} maxLength={VIDEO_TITLE_MAX} className={fld} style={FIELD_STYLE} placeholder="VD: Chiến tranh lạnh 1947–1991 — Lịch sử 12" />
            </label>
            <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Chủ đề (ngăn bằng dấu phẩy, tối đa {VIDEO_TOPICS_MAX}) — học sinh gõ chủ đề này sẽ ra video
              <input id="vd-topics" value={editing.form.topics} onChange={e => set({ topics: e.target.value })} className={fld} style={FIELD_STYLE} placeholder="Chiến tranh lạnh, Lịch sử 12, Thế giới sau 1945" />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Kênh (không bắt buộc)
                <input value={editing.form.channel} onChange={e => set({ channel: e.target.value })} maxLength={VIDEO_CHANNEL_MAX} className={fld} style={FIELD_STYLE} />
              </label>
              <label className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>Ghi chú ngắn (không bắt buộc)
                <input value={editing.form.note} onChange={e => set({ note: e.target.value })} maxLength={VIDEO_NOTE_MAX} className={fld} style={FIELD_STYLE} placeholder="VD: Xem từ phút 3" />
              </label>
            </div>
            <div data-video-preview role="status" className="rounded-lg p-3 text-xs flex items-center gap-3" style={{ background: "var(--kin-nen-bang)", color: live && live.ok ? "var(--kin-chu-phu)" : "var(--kin-tt-chu-cho)" }}>
              {live && live.ok ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- ảnh nhỏ của YouTube */}
                  <img src={thumbUrl(live.value.videoId)} alt="" width={96} height={54} referrerPolicy="no-referrer" className="rounded flex-shrink-0" style={{ width: 96, height: 54, objectFit: "cover" }} />
                  <span>Mã video <b>{live.value.videoId}</b>. {live.value.topics.length} chủ đề.</span>
                </>
              ) : <>Chưa hợp lệ: {live && !live.ok ? live.error : ""}</>}
            </div>
            <label className="flex items-center gap-2 text-sm min-h-[44px]"><input id="vd-pub" type="checkbox" checked={editing.form.published} onChange={e => set({ published: e.target.checked })} /> Công khai ở ô tìm của trang Thư viện</label>
            {formError && <p role="alert" className="text-sm font-semibold" style={{ color: "var(--kin-tt-chu-loi)" }}>{formError}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className={btn} style={{ ...CARD_STYLE, color: "var(--kin-chu-chinh)" }} onClick={() => setEditing(null)}>Huỷ</button>
              <button type="submit" className={btn} style={{ background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" }} disabled={busy === "save"}>Lưu</button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && (
        <Modal title="Xoá video?" onClose={() => setDeleting(null)} labelledBy="vd-del-title">
          <p className="text-sm mb-4" style={{ color: "var(--kin-chu-phu)" }}>{deleting.title}. Chỉ xoá khỏi kho của KiN, video trên YouTube không bị ảnh hưởng.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className={btn} style={{ ...CARD_STYLE, color: "var(--kin-chu-chinh)" }} onClick={() => setDeleting(null)}>Giữ lại</button>
            <button type="button" className={btn} style={{ background: "var(--kin-tt-chu-loi)", color: "var(--kin-chu-tren-nut-chinh)" }} disabled={busy === "delete"} onClick={() => void remove()}>Xoá</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
