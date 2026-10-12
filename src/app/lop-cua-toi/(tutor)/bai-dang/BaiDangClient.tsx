// PH-209 — xem bai-dang/page.tsx. Mọi chữ trong bài do gia sư sửa được; dòng "không nhận chuyển khoản trước buổi học thử"
// luôn được giữ khi sao chép/chia sẻ.
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { KinButton } from "@/components/kin";
import { CARD_STYLE, FIELD_STYLE, callApi, copyText, useNotify } from "@/components/tutor/shared";
import { PRONOUNS, RECRUIT_FIELD_MAX, composeRecruitPost, ensureSafetyLine, facebookChannel, facebookShareUrl, profileLink, type Pronoun } from "@/lib/funnel";
import { openZalo } from "@/lib/zaloShare";

interface Draft {
  tutorId: string; name: string; pronoun: Pronoun; subjects: string[]; profilePublic: boolean; profileLocked: boolean;
  classes: { id: string; name: string; seatsLeft: number | null }[]; sessionsTaught: number; groups: string[];
}
interface ChannelRow { channel: string; groupLabel: string; opens: number; fulls: number; fullRate: number | null }

export default function BaiDangClient() {
  const notify = useNotify();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [group, setGroup] = useState("");
  const [pronoun, setPronoun] = useState<Pronoun>("Mình");
  const [slots, setSlots] = useState("");
  const [fee, setFee] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [savedGroups, setSavedGroups] = useState<string[]>([]);
  const seq = useRef(0);

  const load = useCallback(async () => {
    await Promise.resolve();
    const my = ++seq.current;
    setLoading(true); setFailed(false);
    const [d, c] = await Promise.all([callApi<Draft>("/api/tutor/post-draft"), callApi<{ rows: ChannelRow[] }>("/api/tutor/channels?days=30")]);
    if (my !== seq.current) return;
    if (!d.ok) { setFailed(true); setLoading(false); return; }
    setDraft(d.data);
    setSavedGroups(d.data.groups);
    setPronoun(d.data.pronoun);
    setPicked(new Set(d.data.classes.map(x => x.id)));
    setChannels(c.ok ? c.data.rows : []);
    setLoading(false);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const channel = useMemo(() => facebookChannel(group), [group]);
  const link = useMemo(() => (draft && typeof window !== "undefined" ? profileLink(window.location.origin, draft.tutorId, channel) : ""), [draft, channel]);
  const generated = useMemo(() => {
    if (!draft) return "";
    return composeRecruitPost({
      pronoun, name: draft.name, subjects: draft.subjects, sessionsTaught: draft.sessionsTaught, slots, fee, link,
      classes: draft.classes.filter(c => picked.has(c.id)).map(c => ({ name: c.name, seatsLeft: c.seatsLeft })),
    });
  }, [draft, pronoun, slots, fee, link, picked]);
  // Đổi nhóm/giờ/học phí/lớp thì soạn lại để link và nội dung luôn khớp; gia sư sửa tay SAU lần đổi cuối vẫn được giữ.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setText(generated);
  }, [generated]);

  async function saveGroups(next: string[]) {
    const r = await callApi("/api/users/me/preferences", { method: "PUT", body: JSON.stringify({ connections: { groups: next } }) });
    if (!r.ok) { notify.err(r.data.error ?? "Không lưu được danh sách nhóm"); return; }
    setSavedGroups(next);
  }
  const groupName = group.trim();
  const isSaved = savedGroups.some(g => g.toLocaleLowerCase("vi") === groupName.toLocaleLowerCase("vi"));
  const finalText = () => ensureSafetyLine(text, pronoun);
  const canSend = !!draft?.profilePublic && text.trim().length > 0;

  async function copy() {
    if (await copyText(finalText())) notify.ok("Đã sao chép bài đăng — dán vào nhóm."); else notify.err("Không sao chép được, hãy thử lại.");
  }
  async function shareFacebook() {
    // Facebook chỉ nhận link, không điền sẵn nội dung → chép bài vào bộ nhớ tạm để gia sư dán.
    const copied = await copyText(finalText());
    window.open(facebookShareUrl(link), "_blank", "noopener");
    notify.info(copied ? "Đã sao chép bài đăng — dán vào ô nội dung của Facebook." : "Hãy sao chép bài đăng rồi dán vào Facebook.");
  }
  async function sendZalo() {
    const res = await openZalo({ text: finalText() });
    if (res.opened) notify.info(res.method === "share" ? "Chọn Zalo trong bảng chia sẻ rồi bấm gửi." : "Đã chép bài và mở Zalo — dán vào cuộc trò chuyện rồi bấm gửi.");
    else if (res.reason === "failed") notify.err("Không mở được Zalo. Hãy sao chép bài và gửi tay.");
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <Link href="/lop-cua-toi" className="text-sm hover:underline" style={{ color: "var(--kin-chu-phu)" }}>← Lớp của tôi</Link>
      <h1 className="mt-2 text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Bài đăng tìm học sinh</h1>
      <p className="text-caption mt-1 mb-4" style={{ color: "var(--kin-chu-phu)" }}>
        KiN soạn sẵn bài từ hồ sơ và sổ lớp của bạn. KiN <b>không tự đăng</b> vào nhóm Facebook (Facebook đã đóng quyền này): bạn sao chép rồi tự dán.
        Mỗi nhóm có một link riêng để biết nhóm nào mang người về.
      </p>

      {loading ? (
        <div className="space-y-3" aria-busy="true">{[0, 1].map(i => <div key={i} className="h-28 rounded-xl animate-pulse" style={CARD_STYLE} />)}</div>
      ) : failed || !draft ? (
        <div role="alert" className="rounded-xl p-6 text-center text-sm" style={CARD_STYLE}>
          Không tải được dữ liệu hồ sơ. <button className="underline font-semibold" onClick={() => void load()}>Thử lại</button>
        </div>
      ) : (
        <>
          {!draft.profilePublic && (
            <div role="alert" className="rounded-xl p-4 mb-4 text-sm" style={{ background: "var(--kin-tt-cham-cho)", color: "#1f2937", border: "1px solid var(--kin-vien-thuong)" }}>
              {draft.profileLocked ? "Hồ sơ công khai của bạn đang bị khoá, nên link trong bài chưa mở được. Liên hệ quản trị viên để được xem xét." : "Hồ sơ của bạn chưa được duyệt nên link công khai chưa mở được. Bài đăng sẽ dùng được ngay khi hồ sơ được duyệt."}
              {" "}<Link href="/lop-cua-toi/ho-so" className="underline font-semibold">Mở hồ sơ gia sư</Link>
            </div>
          )}

          <section className="rounded-xl p-4 space-y-3" style={CARD_STYLE} aria-labelledby="h-soan">
            <h2 id="h-soan" className="text-sm font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Soạn bài</h2>

            <div>
              <label className="block text-sm" htmlFor="nhom-fb">Nhóm Facebook sẽ đăng</label>
              <input id="nhom-fb" list="nhom-da-luu" value={group} maxLength={60} onChange={e => setGroup(e.target.value)} placeholder="Ví dụ: Gia sư Toán Hà Nội"
                className="w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} />
              <datalist id="nhom-da-luu">{savedGroups.map(g => <option key={g} value={g} />)}</datalist>
              <p className="text-xs mt-1 break-all" style={{ color: "var(--kin-chu-phu)" }}>Link riêng của nhóm này: <b className="font-mono">{link}</b></p>
              {!groupName && <p className="text-xs mt-1" style={{ color: "var(--kin-chu-phu)" }}>Chưa đặt tên nhóm nên link dùng đuôi chung <code>?n=fb</code>. Đặt tên nhóm để biết nhóm nào mang người về.</p>}
              <div className="mt-2 flex gap-2 flex-wrap items-center">
                {groupName && !isSaved && <KinButton variant="secondary" onClick={() => void saveGroups([...savedGroups, groupName])}>Lưu nhóm này</KinButton>}
                {savedGroups.map(g => (
                  <span key={g} className="inline-flex items-center gap-1 rounded-full pl-3 pr-1 py-0.5 text-xs" style={{ background: "var(--kin-nen-nhan)", color: "var(--kin-th-navy)", border: "1px solid var(--kin-vien-thuong)" }}>
                    <button type="button" onClick={() => setGroup(g)} className="min-h-[32px]">{g}</button>
                    <button type="button" aria-label={`Xoá nhóm ${g}`} onClick={() => void saveGroups(savedGroups.filter(x => x !== g))} className="w-8 h-8 rounded-full">×</button>
                  </span>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-sm block">Xưng hô
                <select value={pronoun} onChange={e => setPronoun(e.target.value as Pronoun)} className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE}>
                  {PRONOUNS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="text-sm block sm:col-span-1">Giờ còn trống
                <input value={slots} maxLength={RECRUIT_FIELD_MAX} onChange={e => setSlots(e.target.value)} placeholder="T3, T5 19h–20h30" className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} />
              </label>
              <label className="text-sm block">Học phí
                <input value={fee} maxLength={RECRUIT_FIELD_MAX} onChange={e => setFee(e.target.value)} placeholder="200.000đ/buổi" className="block w-full mt-1 px-3 py-2 rounded-lg text-sm min-h-[44px]" style={FIELD_STYLE} />
              </label>
            </div>

            {draft.classes.length > 0 && (
              <fieldset className="text-sm">
                <legend className="font-semibold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Lớp đang nhận học sinh</legend>
                {draft.classes.map(c => (
                  <label key={c.id} className="flex items-center gap-2 py-1 min-h-[44px]">
                    <input type="checkbox" checked={picked.has(c.id)} onChange={e => setPicked(s => { const n = new Set(s); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; })} />
                    {c.name}{c.seatsLeft !== null ? ` — ${c.seatsLeft > 0 ? `còn ${c.seatsLeft} chỗ` : "đã đủ chỗ"}` : ""}
                  </label>
                ))}
              </fieldset>
            )}

            <div>
              <label className="block text-sm" htmlFor="bai-dang-text">Bài đăng (sửa được; đổi nhóm, giờ, học phí hoặc lớp sẽ soạn lại)</label>
              <textarea id="bai-dang-text" rows={11} value={text} onChange={e => setText(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={FIELD_STYLE} />
              <p className="text-xs mt-1" style={{ color: "var(--kin-chu-phu)" }}>
                Số buổi đã dạy lấy từ sổ lớp, bạn không tự sửa được. Dòng “{pronoun} không nhận chuyển khoản trước buổi học thử.” luôn được giữ ở cuối bài.
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <KinButton onClick={() => void copy()} disabled={!canSend}>Sao chép bài đăng</KinButton>
              <KinButton variant="secondary" onClick={() => void shareFacebook()} disabled={!canSend}>Chia sẻ lên Facebook</KinButton>
              <KinButton variant="secondary" onClick={() => void sendZalo()} disabled={!canSend}>Gửi qua Zalo</KinButton>
            </div>
          </section>

          <section className="rounded-xl p-4 mt-4" style={CARD_STYLE} aria-labelledby="h-kenh">
            <h2 id="h-kenh" className="text-sm font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Link nào mang người về (30 ngày)</h2>
            <p className="text-xs mt-1" style={{ color: "var(--kin-chu-phu)" }}>Chỉ đếm lượt bấm link, <b>không đếm được bài đăng trong nhóm</b>.</p>
            {channels.length === 0 ? (
              <p role="status" className="text-sm mt-3" style={{ color: "var(--kin-chu-phu)" }}>Chưa có lượt mở link nào. Dán bài vào nhóm rồi quay lại xem.</p>
            ) : (
              <div className="overflow-x-auto mt-2">
                <table className="w-full text-sm">
                  <caption className="sr-only">Lượt mở link hồ sơ theo kênh</caption>
                  <thead><tr style={{ color: "var(--kin-chu-phu)" }}>
                    <th scope="col" className="text-left py-1 pr-3">Kênh</th><th scope="col" className="text-left py-1 pr-3">Loại</th>
                    <th scope="col" className="text-right py-1 pr-3">Mở link</th><th scope="col" className="text-right py-1">Xem hết hồ sơ</th>
                  </tr></thead>
                  <tbody>
                    {channels.map(c => (
                      <tr key={c.channel} style={{ borderTop: "1px solid var(--kin-vien-nhat)" }}>
                        <th scope="row" className="text-left py-2 pr-3 font-mono font-normal">{c.channel}</th>
                        <td className="py-2 pr-3">{c.groupLabel}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{c.opens}</td>
                        <td className="py-2 text-right tabular-nums">{c.fulls}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
