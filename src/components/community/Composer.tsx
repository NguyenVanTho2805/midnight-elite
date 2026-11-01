"use client";
// BU-05 — ô soạn đầu feed cho người đã đăng nhập: "Bạn muốn hỏi hay chia sẻ gì?" → mở rộng, chọn Bài viết / Câu hỏi, chủ đề, đăng vào "Chung" hoặc một lớp, ≤4 ảnh.
// Một nút đặc duy nhất: "Đăng". Không chữ về xu / ví; không đọc phần thưởng trả về. Bấm đúp không ra hai bài (khoá bằng ref).
import { useRef, useState } from "react";
import { KinButton } from "@/components/kin";
import { uploadMany, uploadToCloudinary } from "@/lib/cloudinary";
import type { FeedItem } from "@/lib/communityTypes";
import { CommunityAvatar } from "./Avatar";
import { ImagePicker } from "./ImagePicker";
import { ClipIcon } from "./Icons";
import { MAX_POST } from "./format";
import type { ScopeOption } from "./useScopeOptions";

const TOPICS = [
  { key: "kinh-nghiem", label: "Chia sẻ" },
  { key: "tai-lieu", label: "Tài liệu" },
  { key: "goc-vui", label: "Góc vui" },
] as const;

const field = "w-full rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] px-3 py-2.5 text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)] placeholder:text-[var(--kin-chu-mo)]";

export function Composer({ userName, scopes, onPosted }: { userName: string; scopes: ScopeOption[]; onPosted: (item: FeedItem) => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"post" | "question">("post");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>("kinh-nghiem");
  const [courseId, setCourseId] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "upload" | "post">("idle");
  const [error, setError] = useState("");
  const lock = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cache = useRef(new Map<File, string>());

  function reset() {
    setOpen(false); setKind("post"); setTitle(""); setContent(""); setCategory("kinh-nghiem"); setCourseId("");
    setImages([]); setFile(null); setError(""); cache.current.clear();
  }

  async function submit() {
    if (lock.current) return;
    if (kind === "question" && title.trim().length < 5) { setError("Tiêu đề câu hỏi cần ít nhất 5 ký tự."); return; }
    if (!content.trim()) { setError(kind === "question" ? "Hãy mô tả câu hỏi của bạn." : "Hãy viết nội dung bài viết."); return; }
    lock.current = true; setError("");
    try {
      let imageUrls: string[] = [];
      let fileUrl: string | null = null;
      if (kind === "post" && (images.length || file)) {
        setPhase("upload");
        imageUrls = await Promise.all(images.map(async img => {
          const hit = cache.current.get(img);
          if (hit) return hit;
          const [url] = await uploadMany([img], "community/images");
          cache.current.set(img, url);
          return url;
        }));
        if (file) {
          const hit = cache.current.get(file);
          if (hit) fileUrl = hit; else { fileUrl = (await uploadToCloudinary(file, "community/files")).url; cache.current.set(file, fileUrl); }
        }
      }
      setPhase("post");
      const res = await fetch("/api/community/threads", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind, content: content.trim(), category: kind === "question" ? "hoi-dap" : category,
          ...(kind === "question" ? { title: title.trim() } : { imageUrls, fileUrl, fileName: file?.name ?? null }),
          ...(courseId ? { courseId } : {}),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error ?? "Chưa đăng được. Bạn thử lại nhé."); return; }
      onPosted(d as FeedItem);
      reset();
    } catch (e) {
      setError(e instanceof TypeError ? "Mất kết nối. Bạn thử lại nhé." : (e as Error).message || "Chưa đăng được. Bạn thử lại nhé.");
    } finally { setPhase("idle"); lock.current = false; }
  }

  if (!open) {
    return (
      <div className="kc-card" data-kc-composer="closed">
        <div className="kc-col1"><CommunityAvatar label={userName} /></div>
        <button type="button" onClick={() => setOpen(true)}
          className="kc-focus min-h-11 text-left text-[length:var(--kin-co-body)] text-[var(--kin-chu-mo)]">
          Bạn muốn hỏi hay chia sẻ gì?
        </button>
      </div>
    );
  }

  const busy = phase !== "idle";
  return (
    <form className="kc-card" data-kc-composer="open" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <div className="kc-col1"><CommunityAvatar label={userName} /></div>
      <div className="kc-body flex flex-col gap-3">
        <div role="radiogroup" aria-label="Loại bài" className="flex gap-2">
          {([["post", "Bài viết"], ["question", "Câu hỏi"]] as const).map(([k, l]) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => { setKind(k); setError(""); }}
              className="kc-nav-item kc-focus">{l}</button>
          ))}
        </div>
        {kind === "question" && (
          <input aria-label="Tiêu đề câu hỏi" maxLength={120} value={title} onChange={e => { setTitle(e.target.value); setError(""); }}
            placeholder="Tiêu đề câu hỏi (5–120 ký tự)" className={field} />
        )}
        <textarea aria-label={kind === "question" ? "Mô tả câu hỏi" : "Nội dung bài viết"} rows={4} maxLength={MAX_POST} value={content}
          onChange={e => { setContent(e.target.value); setError(""); }} autoFocus
          placeholder={kind === "question" ? "Em đang vướng ở đâu? Em đã thử gì rồi?" : "Chia sẻ kiến thức, kinh nghiệm hay chuyện vui…"} className={`${field} resize-none`} />
        {kind === "post" && (
          <>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Chủ đề">
              {TOPICS.map(t => (
                <button key={t.key} type="button" aria-pressed={category === t.key} onClick={() => setCategory(t.key)}
                  className="kc-nav-item kc-focus">{t.label}</button>
              ))}
            </div>
            <ImagePicker files={images} onChange={setImages} max={4} disabled={busy} />
            <div className="flex items-center gap-2 flex-wrap">
              <button type="button" className="kc-act" style={{ marginLeft: -10 }} onClick={() => fileRef.current?.click()} disabled={busy || !!file}>
                <ClipIcon /><span>{file ? file.name.slice(0, 24) : "Tệp"}</span>
              </button>
              {file && <button type="button" className="kc-act" onClick={() => setFile(null)}>Bỏ tệp</button>}
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xlsx,.pptx,.txt" className="hidden"
                onChange={e => { setFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
            </div>
          </>
        )}
        {scopes.length > 0 && (
          <label className="flex items-center gap-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-phu)]">
            <span className="whitespace-nowrap">Đăng vào</span>
            <select value={courseId} onChange={e => setCourseId(e.target.value)} className={`${field} min-h-11 py-0`}>
              <option value="">Cộng đồng chung</option>
              {scopes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        )}
        {error && <p role="alert" className="text-[length:var(--kin-co-small)] text-[var(--kin-tt-chu-loi)]">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          <span className="kc-meta tabular-nums">{content.length}/{MAX_POST}</span>
          <div className="flex gap-2">
            <KinButton type="button" variant="ghost" onClick={reset} disabled={busy}>Huỷ</KinButton>
            <KinButton type="submit" loading={busy} loadingLabel={phase === "upload" ? "Đang tải ảnh…" : "Đang đăng…"}>Đăng</KinButton>
          </div>
        </div>
      </div>
    </form>
  );
}
