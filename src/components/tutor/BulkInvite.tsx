// ĐX-07 (NC1-082) — "Mời cả lớp một lần", phương án NHẸ (Thọ chốt Q5 ngày 21/10).
// Gia sư dán danh sách "tên em, số Zalo phụ huynh" → tạo MỘT mã mời của lớp (đúng API mã mời hiện có) → soạn sẵn tin cho từng phụ huynh.
// Mỗi em vẫn tự tạo tài khoản và vào lớp bằng mã. KHÔNG có học sinh không tài khoản.
// Số điện thoại phụ huynh chỉ nằm trong bộ nhớ trình duyệt này: không gửi lên máy chủ (API chỉ nhận maxUses + expiresAt), không lưu.
"use client";
import { useId, useMemo, useState } from "react";
import { KinButton, KinConfirm } from "@/components/kin";
import { KinCopyButton } from "@/components/kin/CopyButton";
import { Badge, CARD_STYLE, FIELD_STYLE, callApi, useNotify } from "@/components/tutor/shared";
import { openZalo } from "@/lib/zaloShare";
import {
  BULK_INVITE_DAYS, BULK_MAX_ROWS, bulkInviteExpiry, bulkInviteLink, composeBulkInviteMessage, parseBulkRoster,
  type BulkRow,
} from "@/lib/bulkInvite";

interface CreatedInvite { id: string; code: string; maxUses: number | null; expiresAt: string | null }
interface Batch { code: string; link: string; expiresAt: string | null; maxUses: number | null; rows: BulkRow[] }

const hhmm = (t: number) => new Date(t).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
const MUTED = { color: "var(--kin-chu-phu)" } as const;

export default function BulkInvite({ courseId, courseName, tutorName, onCreated }: { courseId: string; courseName: string; tutorName?: string | null; onCreated: () => void }) {
  const notify = useNotify();
  const fieldId = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [batch, setBatch] = useState<Batch | null>(null);
  /** Chỉ số dòng → thời điểm gia sư bấm mở Zalo gần nhất. Không lưu đi đâu. */
  const [opened, setOpened] = useState<Record<number, number>>({});
  const [confirmReset, setConfirmReset] = useState(false);

  const parsed = useMemo(() => parseBulkRoster(text), [text]);
  const canCreate = parsed.rows.length > 0 && parsed.errors.length === 0;

  async function create() {
    if (!canCreate || busy) return;
    setBusy(true);
    const rows = parsed.rows;
    // Lên máy chủ CHỈ có số lượt và hạn dùng — không có tên em, không có số điện thoại.
    const r = await callApi<CreatedInvite>(`/api/courses/${courseId}/invites`, {
      method: "POST",
      body: JSON.stringify({ maxUses: rows.length, expiresAt: bulkInviteExpiry(new Date()).toISOString() }),
    });
    setBusy(false);
    if (!r.ok) { notify.err(r.data.error ?? "Không tạo được mã mời"); return; }
    setBatch({ code: r.data.code, link: bulkInviteLink(window.location.origin, r.data.code), expiresAt: r.data.expiresAt, maxUses: r.data.maxUses, rows });
    setOpened({});
    setText("");
    notify.ok(`Đã tạo mã ${r.data.code} cho ${rows.length} em.`);
    onCreated();
  }

  async function open(i: number) {
    if (!batch) return;
    const row = batch.rows[i];
    const res = await openZalo({ text: composeBulkInviteMessage({ studentName: row.name, className: courseName, tutorName, link: batch.link, code: batch.code }), phone: row.phone });
    if (res.opened) {
      // Chỉ biết gia sư đã MỞ Zalo; không biết tin có được gửi thật hay không.
      setOpened(o => ({ ...o, [i]: Date.now() }));
      if (res.method === "copy") notify.info(res.copied ? "Đã chép tin. Dán vào Zalo rồi gửi." : "Đã mở Zalo. Chưa chép được tin, hãy bấm “Chép tin”.");
    } else if (res.reason !== "cancelled") notify.err("Không mở được Zalo. Bấm “Chép tin” rồi dán vào Zalo.");
  }

  function reset() { setBatch(null); setOpened({}); setConfirmReset(false); }
  const notOpened = batch ? batch.rows.filter((_, i) => !opened[i]).length : 0;

  if (batch) {
    return (
      <section className="rounded-xl p-4 space-y-3" style={CARD_STYLE} aria-label="Kết quả mời cả lớp">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="font-medium" style={{ color: "var(--kin-chu-chinh)" }}>Đã tạo mã cho {batch.rows.length} em</p>
          <span className="text-lg font-mono font-medium tracking-wider" style={{ color: "var(--kin-chu-chinh)" }} data-testid="bulk-code">{batch.code}</span>
        </div>
        <p className="text-xs" style={MUTED}>
          Dùng được {batch.maxUses ?? batch.rows.length} lượt{batch.expiresAt ? `, hết hạn ${new Date(batch.expiresAt).toLocaleDateString("vi-VN")}` : ""}.
          Mỗi em tự tạo tài khoản rồi vào lớp bằng link trong tin.
        </p>
        <p className="text-xs rounded-lg px-3 py-2" style={{ ...MUTED, background: "var(--kin-nen-trang)" }} role="note">
          Số điện thoại phụ huynh chỉ nằm trên trình duyệt này. KiN không lưu. Rời khỏi trang hoặc bấm “Làm đợt mới” là danh sách này mất; mã mời vẫn còn ở danh sách bên dưới.
          KiN chỉ biết bạn đã mở Zalo, không biết tin đã được gửi hay chưa.
        </p>
        <ul className="space-y-2" aria-label="Phụ huynh cần nhắn">
          {batch.rows.map((row, i) => (
            <li key={`${row.name}|${row.phone}`} className="rounded-lg p-3 flex items-center justify-between gap-3 flex-wrap" style={{ border: "1px solid var(--kin-vien-thuong)" }}>
              <div className="min-w-0">
                <p className="font-medium truncate" style={{ color: "var(--kin-chu-chinh)" }}>{row.name}</p>
                <p className="text-xs" style={MUTED}>{row.phone}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge tone={opened[i] ? "ok" : "neutral"}>{opened[i] ? `Đã mở Zalo lúc ${hhmm(opened[i])}` : "Chưa mở Zalo"}</Badge>
                <KinCopyButton appearance="button" buttonVariant="ghost" label={`Chép tin cho phụ huynh ${row.name}`}
                  text={() => composeBulkInviteMessage({ studentName: row.name, className: courseName, tutorName, link: batch.link, code: batch.code })}
                  onResult={ok => notify[ok ? "ok" : "err"](ok ? "Đã chép tin." : "Không chép được.")}>Chép tin<span className="sr-only"> cho phụ huynh {row.name}</span></KinCopyButton>
                <KinButton variant={opened[i] ? "secondary" : "primary"} onClick={() => void open(i)}
                  aria-label={`${opened[i] ? "Mở lại Zalo" : "Mở Zalo"} cho phụ huynh ${row.name}`}>{opened[i] ? "Mở lại" : "Mở Zalo"}</KinButton>
              </div>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 flex-wrap">
          <KinCopyButton appearance="button" buttonVariant="secondary" label="Sao chép link mời" text={batch.link}
            onResult={ok => notify[ok ? "ok" : "err"](ok ? "Đã sao chép link mời." : "Không sao chép được.")}>Sao chép link chung</KinCopyButton>
          <KinButton variant="ghost" onClick={() => (notOpened > 0 ? setConfirmReset(true) : reset())}>Làm đợt mới</KinButton>
        </div>
        <KinConfirm open={confirmReset} tone="nguy-hiem" title="Làm đợt mới?"
          message={`Còn ${notOpened} phụ huynh chưa mở Zalo. Danh sách số điện thoại sẽ mất, bạn phải dán lại nếu muốn nhắn tiếp. Mã mời vẫn dùng được.`}
          cancelLabel="Ở lại" confirmLabel="Làm đợt mới" onCancel={() => setConfirmReset(false)} onConfirm={reset} />
      </section>
    );
  }

  return (
    <form onSubmit={e => { e.preventDefault(); void create(); }} className="rounded-xl p-4" style={CARD_STYLE} aria-label="Mời cả lớp một lần">
      <p className="font-medium mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Mời cả lớp một lần</p>
      <p className="text-xs mb-3" style={MUTED}>
        Dán danh sách, mỗi dòng một em: tên em rồi số Zalo của phụ huynh (dán thẳng từ Excel cũng được). Tối đa {BULK_MAX_ROWS} em.
        KiN tạo một mã cho cả lớp, hiệu lực {BULK_INVITE_DAYS} ngày, và soạn sẵn tin cho từng phụ huynh để bạn bấm gửi.
      </p>
      <label htmlFor={fieldId} className="text-sm">Danh sách em và số phụ huynh</label>
      <textarea id={fieldId} value={text} onChange={e => setText(e.target.value)} rows={6} spellCheck={false}
        placeholder={"Minh Anh, 0912 345 678\nQuốc Huy, 0987 654 321"}
        aria-describedby={`${fieldId}-sum`} aria-invalid={parsed.errors.length > 0}
        className="block w-full mt-1 px-3 py-2 rounded-lg font-mono text-sm" style={FIELD_STYLE} />
      <div id={`${fieldId}-sum`} aria-live="polite" className="mt-2 text-sm">
        {text.trim() === "" ? null : (
          <>
            <p style={{ color: "var(--kin-chu-chinh)" }}>
              {parsed.rows.length} em hợp lệ{parsed.duplicates > 0 ? ` · bỏ ${parsed.duplicates} dòng trùng` : ""}
            </p>
            {parsed.errors.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-xs" style={{ color: "var(--kin-tt-chu-loi)" }}>
                {parsed.errors.slice(0, 8).map((er, i) => (
                  <li key={i}>{er.line > 0 ? `Dòng ${er.line}: ` : ""}{er.message}{er.text ? ` (“${er.text}”)` : ""}</li>
                ))}
                {parsed.errors.length > 8 && <li>… và {parsed.errors.length - 8} dòng lỗi khác</li>}
              </ul>
            )}
          </>
        )}
      </div>
      <div className="mt-3"><KinButton type="submit" loading={busy} disabled={!canCreate}>Tạo mã mời và soạn tin</KinButton></div>
    </form>
  );
}
