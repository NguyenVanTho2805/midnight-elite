// LO-06 dán danh sách tên từ Excel · LO-17 nhập CSV/Excel (học sinh và lịch hàng tuần) — luôn có bước XEM TRƯỚC và báo lỗi TỪNG DÒNG.
// Số dòng tối đa mỗi lần do cấu hình (KIN_IMPORT_MAX_ROWS). Nhập học sinh phải qua hộp xác nhận của gia sư “tôi có quyền cung cấp và đã có đồng ý”,
// ghi vết theo lần nhập. Không dòng nào được lưu trước khi gia sư bấm xác nhận.
"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { KinPage, KinPageHeader } from "@/components/kin/PageLayout";
import { kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { KinTabs } from "@/components/kin/Tabs";
import { AGE_GROUP_LABEL, type ConsentParty } from "@/lib/consentPolicy";
import ConsentBox, { EMPTY_CONSENT, consentBody, type ConsentValue } from "@/components/tutor/ConsentBox";
import { SelectField, jfetch } from "@/components/tutor/studentUi";
import { KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Mode = "dan" | "tep" | "lich";
const DAY = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

export default function NhapHocSinh() {
  const [mode, setMode] = useState<Mode>("dan");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [group, setGroup] = useState("7to15");
  const [courseId, setCourseId] = useState("");
  const [status, setStatus] = useState("active");
  const [courses, setCourses] = useState<{ id: string; name: string }[] | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [consent, setConsent] = useState<ConsentValue>(EMPTY_CONSENT);
  const [skipErrors, setSkipErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [done, setDone] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    jfetch("/api/tutor/ho-so").then(r => { if (alive) setCourses(r.ok ? r.json.courses ?? [] : []); });
    return () => { alive = false; };
  }, []);

  const kind = mode === "lich" ? "lich" : "hoc-sinh";
  const hasInput = mode === "tep" || mode === "lich" ? (!!file || !!text.trim()) : !!text.trim();
  const fieldsOf = () => ({ kind, defaultGroup: group, courseId, status: mode === "lich" ? "" : status });

  function bodyFor(extra: Record<string, unknown> = {}): { body: BodyInit; headers?: Record<string, string> } {
    if (file) {
      const fd = new FormData();
      fd.set("file", file);
      for (const [k, v] of Object.entries({ ...fieldsOf(), ...extra })) fd.set(k, typeof v === "object" ? JSON.stringify(v) : String(v ?? ""));
      return { body: fd };
    }
    return { body: JSON.stringify({ ...fieldsOf(), text, ...extra }), headers: { "Content-Type": "application/json" } };
  }

  async function doPreview() {
    setBusy(true); setMsg(null); setDone(null); setPreview(null); setConsent(EMPTY_CONSENT); setSkipErrors(false);
    const b = bodyFor();
    const r = await jfetch("/api/tutor/ho-so/nhap/xem-truoc", { method: "POST", ...b });
    setBusy(false);
    if (!r.ok) { setMsg({ tone: "err", text: r.json?.error ?? "Chưa xem trước được, thử lại nhé." }); return; }
    setPreview(r.json);
  }

  async function doCommit() {
    setBusy(true); setMsg(null);
    const attest = kind === "hoc-sinh" ? { rights: true, ...consentBody(consent) } : undefined;
    const b = bodyFor({ skipErrors, ...(attest ? { attest } : {}) });
    const r = await jfetch("/api/tutor/ho-so/nhap", { method: "POST", ...b });
    setBusy(false);
    if (r.status === 201) { setDone(r.json); setPreview(null); setText(""); setFile(null); if (fileRef.current) fileRef.current.value = ""; return; }
    setMsg({ tone: "err", text: r.json?.error ?? "Chưa nhập được, thử lại nhé." });
  }

  const parties: ConsentParty[] = preview?.parties ?? [];
  const ticked = parties.length > 0 && parties.every(p => consent[p]);
  const errs: { line: number; message: string }[] = preview?.errors ?? [];
  const canCommit = !!preview && !preview.tooMany && preview.valid > 0 && (errs.length === 0 || skipErrors) && (kind === "lich" || ticked);
  const switchMode = (m: Mode) => { setMode(m); setPreview(null); setDone(null); setMsg(null); setFile(null); setText(""); if (fileRef.current) fileRef.current.value = ""; };

  return (
    <KinPage>
      <KinPageHeader title="Nhập danh sách" back={{ href: "/lop-cua-toi/hoc-sinh", label: "← Học sinh" }} sub="Dán từ Excel hoặc chọn tệp. Luôn xem trước và xác nhận trước khi lưu." />
      <div className="max-w-[760px] space-y-5">
        <KinTabs label="Cách nhập" value={mode} onChange={switchMode} tabs={[{ key: "dan", label: "Dán danh sách" }, { key: "tep", label: "Tệp CSV / Excel" }, { key: "lich", label: "Lịch học hàng tuần" }]} />

        {mode === "dan" && <KinCallout title="Dán từ Excel hoặc Google Sheets">Mỗi dòng một em: “Tên” hoặc “Tên, số Zalo phụ huynh”. Có dòng tiêu đề (Họ tên, SĐT phụ huynh, Ngày sinh, Lớp…) thì KiN nhận đúng cột.</KinCallout>}
        {mode === "tep" && <KinCallout title="Tệp .csv, .tsv, .txt hoặc .xlsx (tối đa 1 MB)">Dòng đầu là tiêu đề cột: Họ tên, Tên phụ huynh, SĐT phụ huynh, SĐT, Email, Ngày sinh, Địa chỉ, Ngày bắt đầu, Môn, Ghi chú, Nhóm tuổi, Lớp, Trạng thái. Cột lạ bị bỏ qua và KiN nói rõ cột nào.</KinCallout>}
        {mode === "lich" && <KinCallout title="Lịch học hàng tuần của lớp">Các cột: Lớp, Thứ (2 đến 7 hoặc CN), Bắt đầu, Kết thúc, Ghi chú. Chọn lớp bên dưới thì không cần cột Lớp. Lịch không chứa thông tin của trẻ.</KinCallout>}

        <div className="grid gap-4 sm:grid-cols-2">
          {mode !== "lich" && (
            <SelectField label="Nhóm tuổi cho dòng không ghi" value={group} onChange={setGroup} hint="Dòng có cột Nhóm tuổi hoặc Ngày sinh thì dùng theo dòng đó.">
              {(["u7", "7to15", "16plus"] as const).map(g => <option key={g} value={g}>{AGE_GROUP_LABEL[g]}</option>)}
            </SelectField>
          )}
          <SelectField label={mode === "lich" ? "Lớp (nếu tệp không có cột Lớp)" : "Lớp cho dòng không ghi"} value={courseId} onChange={setCourseId}>
            <option value="">{mode === "lich" ? "Theo cột Lớp trong tệp" : "Chưa xếp lớp"}</option>
            {(courses ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
          {mode !== "lich" && (
            <SelectField label="Trạng thái" value={status} onChange={setStatus}>
              <option value="active">Hoạt động</option><option value="waitlist">Đang chờ xếp lớp</option><option value="inactive">Không hoạt động</option>
            </SelectField>
          )}
        </div>

        {mode === "dan" ? (
          <div>
            <label htmlFor="nhap-text" className={`${KIN_LABEL} mb-2`}>Danh sách</label>
            <textarea id="nhap-text" value={text} onChange={e => { setText(e.target.value); setPreview(null); }} rows={8} className={`${KIN_FIELD} py-2 leading-5`} placeholder={"Minh Anh, 0912345678\nQuốc Huy, 0987654321"} />
          </div>
        ) : (
          <div className="grid gap-4">
            <div>
              <label htmlFor="nhap-file" className={`${KIN_LABEL} mb-2`}>Chọn tệp</label>
              <input id="nhap-file" ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx" onChange={e => { setFile(e.target.files?.[0] ?? null); setPreview(null); }} className={`${KIN_FIELD} py-2`} />
            </div>
            <div>
              <label htmlFor="nhap-text2" className={`${KIN_LABEL} mb-2`}>Hoặc dán nội dung</label>
              <textarea id="nhap-text2" value={text} onChange={e => { setText(e.target.value); setPreview(null); }} rows={5} disabled={!!file} className={`${KIN_FIELD} py-2 leading-5`} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={!hasInput || busy} onClick={doPreview} className={kinButtonClass("primary")}>{busy && !preview ? "Đang đọc…" : "Xem trước"}</button>
        </div>
        {msg && <p role={msg.tone === "err" ? "alert" : "status"} className={msg.tone === "err" ? "text-[var(--kin-tt-chu-loi)]" : "text-[var(--kin-tt-chu-xong)]"}>{msg.text}</p>}

        {done && (
          <div role="status" data-import-done>
            <KinCallout tone="nhan" title="Đã nhập xong">
              {kind === "hoc-sinh"
                ? `Đã tạo ${done.created} hồ sơ${done.skippedExisting ? `, bỏ qua ${done.skippedExisting} em đã có` : ""}${done.skippedErrors ? `, bỏ qua ${done.skippedErrors} dòng lỗi` : ""}. Việc xác nhận đồng ý đã được ghi vết theo lần nhập này.`
                : `Đã thêm ${done.created} khung giờ${done.skipped ? `, bỏ qua ${done.skipped} khung đã có` : ""}.`}
              {" "}<Link href={kind === "hoc-sinh" ? "/lop-cua-toi/hoc-sinh" : "/lop-cua-toi/lich"} className="underline text-[var(--kin-nhan-link)] inline-flex items-center min-h-11">{kind === "hoc-sinh" ? "Xem danh sách học sinh" : "Mở lịch"}</Link>
            </KinCallout>
          </div>
        )}

        {preview && (
          <section data-preview aria-label="Xem trước" className="space-y-4">
            <h2 className="text-[length:var(--kin-co-tieu-de)] font-medium">Xem trước</h2>
            <p data-preview-count className="text-[length:var(--kin-co-goc)]">
              {preview.valid} dòng hợp lệ trên {preview.total}{errs.length ? `, ${errs.length} dòng lỗi` : ""}{preview.duplicates ? `, ${preview.duplicates} dòng trùng bị gộp` : ""}{preview.existing ? `, ${preview.existing} em đã có hồ sơ (sẽ bỏ qua)` : ""}. Tối đa {preview.maxRows} dòng mỗi lần.
            </p>
            {kind === "hoc-sinh" && preview.mapped?.length > 0 && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Cột đã nhận: {preview.mapped.join(", ")}.{preview.ignored?.length ? ` Cột bị bỏ qua: ${preview.ignored.join(", ")}.` : ""}</p>}
            {preview.tooMany && <p role="alert" className="text-[var(--kin-tt-chu-loi)]">{errs[0]?.message}</p>}
            {errs.length > 0 && !preview.tooMany && (
              <div>
                <p className="font-medium text-[var(--kin-tt-chu-loi)]">Dòng lỗi (chưa được lưu)</p>
                <ul data-errors className="mt-1 space-y-1 text-[length:var(--kin-co-goc)]">
                  {errs.slice(0, 100).map((e, i) => <li key={i}><span className="font-medium tabular-nums">Dòng {e.line}:</span> {e.message}</li>)}
                  {errs.length > 100 && <li>… và {errs.length - 100} dòng lỗi nữa.</li>}
                </ul>
              </div>
            )}
            {preview.rows?.length > 0 && (
              <div className="overflow-x-auto">
                <table data-preview-table className="w-full text-left text-[length:var(--kin-co-goc)]">
                  <thead><tr className="text-[var(--kin-chu-mo)]"><th className="py-2 pr-3 font-normal">Dòng</th>{kind === "hoc-sinh" ? <><th className="pr-3 font-normal">Tên em</th><th className="pr-3 font-normal">Nhóm tuổi</th><th className="pr-3 font-normal">Lớp</th><th className="font-normal">Ghi chú</th></> : <><th className="pr-3 font-normal">Lớp</th><th className="pr-3 font-normal">Thứ</th><th className="font-normal">Giờ</th></>}</tr></thead>
                  <tbody>
                    {preview.rows.slice(0, 50).map((r: any) => kind === "hoc-sinh" ? (
                      <tr key={r.line} className="border-t border-[var(--kin-vien-nhat)]"><td className="py-2 pr-3 tabular-nums">{r.line}</td><td className="pr-3 break-words">{r.name}</td><td className="pr-3">{AGE_GROUP_LABEL[r.ageGroup as "u7"] ?? ""}</td><td className="pr-3">{r.course ?? "Chưa xếp lớp"}</td><td>{r.existing ? "Đã có, bỏ qua" : r.hasExtended ? "Có thông tin mở rộng" : ""}</td></tr>
                    ) : (
                      <tr key={r.line} className="border-t border-[var(--kin-vien-nhat)]"><td className="py-2 pr-3 tabular-nums">{r.line}</td><td className="pr-3">{r.course}</td><td className="pr-3">{DAY[r.dayOfWeek]}</td><td className="tabular-nums">{r.startTime} – {r.endTime}</td></tr>
                    ))}
                  </tbody>
                </table>
                {preview.rows.length > 50 && <p className="mt-1 text-[var(--kin-chu-mo)]">Hiện 50 dòng đầu trên {preview.rows.length} dòng hợp lệ.</p>}
              </div>
            )}

            {kind === "hoc-sinh" && preview.valid > 0 && !preview.tooMany && (
              <ConsentBox bulk parties={parties} value={consent} onChange={setConsent} forcedScopes={preview.hasExtended ? ["basic", "extended"] : ["basic"]} optionalScopes={[]} id="bulk-consent" />
            )}
            {errs.length > 0 && !preview.tooMany && preview.valid > 0 && (
              <label className="flex items-start gap-3 min-h-11 text-[length:var(--kin-co-goc)]"><input type="checkbox" data-skip-errors checked={skipErrors} onChange={e => setSkipErrors(e.target.checked)} className="mt-0.5 size-5" /><span>Bỏ qua {errs.length} dòng lỗi và nhập {preview.valid} dòng hợp lệ.</span></label>
            )}
            <button type="button" data-commit disabled={!canCommit || busy} onClick={doCommit} className={kinButtonClass("primary")}>
              {busy ? "Đang lưu…" : kind === "hoc-sinh" ? `Nhập ${preview.valid} học sinh` : `Thêm ${preview.valid} khung giờ`}
            </button>
            {!canCommit && preview.valid > 0 && !preview.tooMany && <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{errs.length > 0 && !skipErrors ? "Sửa dòng lỗi hoặc chọn bỏ qua dòng lỗi. " : ""}{kind === "hoc-sinh" && !ticked ? "Tích ô xác nhận ở trên thì mới nhập được." : ""}</p>}
          </section>
        )}
      </div>
    </KinPage>
  );
}
