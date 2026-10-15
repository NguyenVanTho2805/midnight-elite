"use client";
import { useEffect, useRef, useState } from "react";
import { KinButton } from "@/components/kin";
import { CARD_STYLE, FIELD_STYLE, callApi, useNotify } from "@/components/tutor/shared";

const BIO_MAX = 2000, SUBJECTS_MAX = 10, SUBJECT_LEN = 50;
// Chính tả KHỚP form đăng ký gia sư (dang-ky/page.tsx: "Hóa học", "Kỹ năng mềm"). Gia sư đăng ký bằng "Hóa học" mà gợi ý ghi "Hoá học" thì hồ sơ hiện hai môn trùng nhau.
const SUGGEST = ["Toán", "Vật lý", "Hóa học", "Sinh học", "Ngữ văn", "Tiếng Anh", "Lịch sử", "Địa lý", "Tin học", "GDCD", "Luyện thi HSA", "Kỹ năng mềm"];

// Thu nhỏ ảnh về 256×256 (cắt giữa) rồi mã hoá JPEG — API giới hạn ~120KB.
async function toAvatarDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas"); c.width = 256; c.height = 256;
  c.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256);
  return c.toDataURL("image/jpeg", 0.85);
}

export default function TutorProfileForm({ initialBio, initialSubjects }: { initialBio: string; initialSubjects: string[] }) {
  const notify = useNotify();
  const [bio, setBio] = useState(initialBio);
  const [subjects, setSubjects] = useState<string[]>(initialSubjects);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    callApi<{ avatarBase64?: string | null }>("/api/users/me/avatar").then(r => { if (alive && r.ok) setAvatar(r.data.avatarBase64 ?? null); });
    return () => { alive = false; };
  }, []);

  function addSubject(raw: string) {
    const s = raw.trim();
    if (!s) return;
    if (s.length > SUBJECT_LEN) { notify.err(`Tên môn tối đa ${SUBJECT_LEN} ký tự`); return; }
    if (subjects.some(x => x.toLocaleLowerCase("vi") === s.toLocaleLowerCase("vi"))) { setDraft(""); return; }
    if (subjects.length >= SUBJECTS_MAX) { notify.err(`Tối đa ${SUBJECTS_MAX} môn`); return; }
    setSubjects([...subjects, s]); setDraft("");
  }

  async function save() {
    if (subjects.length === 0) { notify.err("Chọn ít nhất 1 môn dạy"); return; }
    setSaving(true);
    const r = await callApi<{ error?: string }>("/api/users/me/tutor-profile", { method: "PUT", body: JSON.stringify({ bio, subjects }) });
    setSaving(false);
    if (r.ok) notify.ok("Đã lưu hồ sơ."); else notify.err(r.data.error ?? "Không lưu được hồ sơ");
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith("image/")) { notify.err("Hãy chọn một tệp ảnh"); return; }
    setAvatarBusy(true);
    try {
      const dataUrl = await toAvatarDataUrl(f);
      const r = await callApi<{ error?: string }>("/api/users/me/avatar", { method: "PUT", body: JSON.stringify({ avatarBase64: dataUrl }) });
      if (r.ok) { setAvatar(dataUrl); notify.ok("Đã cập nhật ảnh đại diện."); } else notify.err(r.data.error ?? "Không lưu được ảnh");
    } catch { notify.err("Không đọc được ảnh này"); }
    finally { setAvatarBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl p-5 flex items-center gap-4" style={CARD_STYLE} aria-labelledby="h-avatar">
        {avatar
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={avatar} alt="Ảnh đại diện hiện tại" className="w-20 h-20 rounded-full object-cover" style={{ border: "1px solid var(--kin-vien-thuong)" }} />
          : <div className="w-20 h-20 rounded-full flex items-center justify-center text-xl" style={{ background: "var(--kin-nen-nhan)", color: "var(--kin-chu-phu)" }} aria-hidden>?</div>}
        <div>
          <h2 id="h-avatar" className="font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Ảnh đại diện</h2>
          <p className="text-xs mb-2" style={{ color: "var(--kin-chu-phu)" }}>Ảnh vuông, hiện trên hồ sơ công khai của bạn.</p>
          <input ref={fileRef} id="avatar-file" type="file" accept="image/*" className="sr-only" onChange={e => onFile(e.target.files?.[0])} />
          <KinButton variant="secondary" loading={avatarBusy} onClick={() => fileRef.current?.click()}>Chọn ảnh</KinButton>
        </div>
      </section>

      <section className="rounded-xl p-5" style={CARD_STYLE} aria-labelledby="h-bio">
        <h2 id="h-bio" className="font-bold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Giới thiệu</h2>
        <p className="text-xs mb-2" style={{ color: "var(--kin-chu-phu)" }}>Kinh nghiệm dạy, thành tích, cách dạy. Phụ huynh đọc phần này khi chọn gia sư.</p>
        <label htmlFor="bio" className="sr-only">Giới thiệu</label>
        <textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} maxLength={BIO_MAX} rows={7} className="w-full px-3 py-2 rounded-lg" style={FIELD_STYLE} />
        <p className="text-xs text-right mt-1" style={{ color: "var(--kin-chu-phu)" }}>{bio.length}/{BIO_MAX}</p>
      </section>

      <section className="rounded-xl p-5" style={CARD_STYLE} aria-labelledby="h-mon">
        <h2 id="h-mon" className="font-bold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Môn dạy</h2>
        <p className="text-xs mb-2" style={{ color: "var(--kin-chu-phu)" }}>Tối đa {SUBJECTS_MAX} môn. Gõ rồi nhấn Enter hoặc dấu phẩy để thêm.</p>
        <ul className="flex flex-wrap gap-2 mb-3" aria-label="Môn đã chọn">
          {subjects.map(s => (
            <li key={s} className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full text-sm" style={{ background: "var(--kin-nen-nhan)", color: "var(--kin-nhan-chu-tren-nhat)", border: "1px solid var(--kin-vien-thuong)" }}>
              {s}
              <button type="button" aria-label={`Bỏ môn ${s}`} onClick={() => setSubjects(subjects.filter(x => x !== s))} className="w-8 h-8 rounded-full">×</button>
            </li>
          ))}
          {subjects.length === 0 && <li className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Chưa chọn môn nào.</li>}
        </ul>
        <label htmlFor="subject-input" className="sr-only">Thêm môn dạy</label>
        <input id="subject-input" value={draft} maxLength={SUBJECT_LEN} placeholder="Ví dụ: Toán" className="w-full px-3 py-2 rounded-lg min-h-[44px]" style={FIELD_STYLE}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSubject(draft); } }}
          onBlur={() => addSubject(draft)} />
        <div className="flex flex-wrap gap-2 mt-3" aria-label="Gợi ý môn">
          {SUGGEST.filter(s => !subjects.some(x => x.toLocaleLowerCase("vi") === s.toLocaleLowerCase("vi"))).map(s => (
            <button key={s} type="button" onClick={() => addSubject(s)} className="px-3 py-1.5 rounded-full text-sm min-h-[44px]" style={{ border: "1px dashed var(--kin-vien-thuong)", color: "var(--kin-chu-phu)" }}>+ {s}</button>
          ))}
        </div>
      </section>

      <KinButton size="lg" onClick={save} loading={saving}>Lưu hồ sơ</KinButton>
    </div>
  );
}
