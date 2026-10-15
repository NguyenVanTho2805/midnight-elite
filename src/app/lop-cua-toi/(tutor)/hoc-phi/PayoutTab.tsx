// TT-200 — Cài đặt → Nhận tiền. Tiền đi THẲNG vào tài khoản của gia sư; KiN chỉ
// ĐỌC tiền vào qua SePay do gia sư tự mở. KiN không nhận mật khẩu/tên đăng nhập ngân hàng.
"use client";
import { useCallback, useEffect, useState } from "react";
import { KinButton } from "@/components/kin";
import { BANKS } from "@/lib/banks";
import { CARD_STYLE, FIELD_STYLE, callApi, copyText, useNotify } from "@/components/tutor/shared";

interface Account { bankBin: string; bankName: string; accountNo: string; accountName: string; hasKey: boolean; keyHint: string | null; seenAt: string | null }
interface Info { account: Account | null; webhookUrl: string; sepay: { monthCount: number; freeLimit: number; warn: boolean } }
const OTHER = "other";

export default function PayoutTab() {
  const notify = useNotify();
  const [info, setInfo] = useState<Info | null>(null);
  const [failed, setFailed] = useState(false);
  const [bank, setBank] = useState("970436");
  const [customBin, setCustomBin] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [accountName, setAccountName] = useState("");
  const [saving, setSaving] = useState(false);
  const [keying, setKeying] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    await Promise.resolve();
    const r = await callApi<Info>("/api/tutor/payout-account");
    if (!r.ok) { setFailed(true); return; }
    setFailed(false); setInfo(r.data);
    const a = r.data.account;
    if (a) {
      setBank(BANKS.some(b => b.bin === a.bankBin) ? a.bankBin : OTHER);
      setCustomBin(BANKS.some(b => b.bin === a.bankBin) ? "" : a.bankBin);
      setAccountNo(a.accountNo); setAccountName(a.accountName);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    const r = await callApi<{ error?: string }>("/api/tutor/payout-account", { method: "PUT", body: JSON.stringify({ bankBin: bank === OTHER ? customBin : bank, accountNo, accountName }) });
    setSaving(false);
    if (!r.ok) { notify.err(r.data.error ?? "Không lưu được"); return; }
    notify.ok("Đã lưu tài khoản nhận tiền.");
    await load();
  }

  async function makeKey() {
    setKeying(true);
    const r = await callApi<{ key?: string; error?: string }>("/api/tutor/payout-account/webhook-key", { method: "POST" });
    setKeying(false);
    if (!r.ok || !r.data.key) { notify.err(r.data.error ?? "Không tạo được khoá"); return; }
    setNewKey(r.data.key);
    await load();
  }

  async function copy(text: string, what: string) {
    if (await copyText(text)) notify.ok(`Đã sao chép ${what}.`); else notify.err("Không sao chép được.");
  }

  if (failed) return <div role="alert" className="rounded-xl p-6 text-center text-sm" style={CARD_STYLE}>Không tải được cài đặt. <button className="underline font-semibold" onClick={load}>Thử lại</button></div>;
  if (!info) return <div className="h-40 rounded-xl animate-pulse" style={CARD_STYLE} aria-busy="true" />;
  const a = info.account;

  return (
    <div className="space-y-5">
      <section className="rounded-xl p-5" style={CARD_STYLE} aria-labelledby="h-acc">
        <h2 id="h-acc" className="font-bold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Tài khoản nhận học phí</h2>
        <p className="text-sm mb-4" style={{ color: "var(--kin-chu-phu)" }}>
          Mã VietQR trên phiếu trỏ thẳng vào tài khoản này. KiN không giữ tiền, không thu hộ và không cắt phần trăm.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Ngân hàng
            <select value={bank} onChange={e => setBank(e.target.value)} className="block w-full mt-1 px-3 py-2 rounded-lg min-h-[44px]" style={FIELD_STYLE}>
              {BANKS.map(b => <option key={b.bin} value={b.bin}>{b.name}</option>)}
              <option value={OTHER}>Ngân hàng khác (nhập mã BIN)</option>
            </select>
          </label>
          {bank === OTHER && (
            <label className="text-sm">Mã BIN (6 số)
              <input inputMode="numeric" value={customBin} maxLength={6} onChange={e => setCustomBin(e.target.value.replace(/\D/g, ""))} className="block w-full mt-1 px-3 py-2 rounded-lg min-h-[44px]" style={FIELD_STYLE} />
            </label>
          )}
          <label className="text-sm">Số tài khoản
            <input inputMode="numeric" value={accountNo} onChange={e => setAccountNo(e.target.value)} className="block w-full mt-1 px-3 py-2 rounded-lg min-h-[44px] font-mono" style={FIELD_STYLE} />
          </label>
          <label className="text-sm sm:col-span-2">Tên chủ tài khoản (in hoa, không dấu — đúng như ngân hàng)
            <input value={accountName} onChange={e => setAccountName(e.target.value)} className="block w-full mt-1 px-3 py-2 rounded-lg min-h-[44px]" style={FIELD_STYLE} />
          </label>
        </div>
        <div className="mt-4"><KinButton onClick={save} loading={saving}>Lưu tài khoản</KinButton></div>
      </section>

      <section className="rounded-xl p-5" style={CARD_STYLE} aria-labelledby="h-sepay">
        <h2 id="h-sepay" className="font-bold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Tự gạch phiếu khi tiền vào (SePay)</h2>
        {!a ? (
          <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Lưu tài khoản ở trên trước, sau đó lấy địa chỉ và khoá để nối SePay. Không nối cũng được — bạn vẫn ghi “Đã nhận tiền” bằng tay.</p>
        ) : (<>
          <ol className="text-sm list-decimal pl-5 space-y-1 mb-4" style={{ color: "var(--kin-chu-phu)" }}>
            <li>Tự mở tài khoản SePay và liên kết ngân hàng của bạn (gói miễn phí {info.sepay.freeLimit} giao dịch/tháng).</li>
            <li>Dán <b>địa chỉ webhook</b> bên dưới vào SePay, lọc theo tiền tố mã thanh toán <b className="font-mono">KIN</b>.</li>
            <li>Đặt <b>khoá API</b> do KiN cấp để SePay gửi kèm (kiểu xác thực: API Key).</li>
            <li>KiN hiện “Đang nối SePay” khi nhận giao dịch đầu tiên.</li>
          </ol>

          <label className="text-sm block">Địa chỉ webhook của bạn
            <div className="flex gap-2 mt-1">
              <input readOnly value={info.webhookUrl} onFocus={e => e.currentTarget.select()} className="flex-1 min-w-0 px-3 py-2 rounded-lg font-mono text-xs min-h-[44px]" style={FIELD_STYLE} />
              <KinButton variant="secondary" onClick={() => copy(info.webhookUrl, "địa chỉ webhook")}>Sao chép</KinButton>
            </div>
          </label>

          <div className="mt-4">
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Khoá API</p>
            {a.hasKey && !newKey && <p className="text-sm mb-2" style={{ color: "var(--kin-chu-phu)" }}>Đã có khoá (đuôi …{a.keyHint}). Vì lý do an toàn KiN chỉ lưu bản băm nên không xem lại được. Cần khoá mới thì tạo lại — khoá cũ ngừng dùng được ngay.</p>}
            {newKey && (
              <div role="alert" className="rounded-lg p-3 mb-2" style={{ background: "var(--kin-tt-nen-cho)", color: "var(--kin-chu-chinh)", border: "1px solid var(--kin-tt-vien-cho)" }}>
                <p className="text-sm font-semibold mb-1">Khoá mới — chỉ hiện một lần này. Hãy dán vào SePay ngay.</p>
                <div className="flex gap-2">
                  <input readOnly value={newKey} onFocus={e => e.currentTarget.select()} className="flex-1 min-w-0 px-3 py-2 rounded-lg font-mono text-xs min-h-[44px]" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-o-nhap)", color: "var(--kin-chu-chinh)" }} aria-label="Khoá API mới" />
                  <KinButton variant="secondary" onClick={() => copy(newKey, "khoá API")}>Sao chép</KinButton>
                </div>
                <button className="text-xs underline mt-2" onClick={() => setNewKey(null)}>Tôi đã lưu khoá, ẩn đi</button>
              </div>
            )}
            <KinButton variant={a.hasKey ? "secondary" : "primary"} onClick={makeKey} loading={keying}>{a.hasKey ? "Tạo khoá mới" : "Tạo khoá API"}</KinButton>
          </div>

          <p className="mt-4 text-sm" role="status" style={{ color: "var(--kin-chu-chinh)" }}>
            Trạng thái: {a.seenAt ? <b style={{ color: "var(--kin-tt-chu-xong)" }}>Đang nối SePay</b> : <b>Chưa nhận giao dịch nào</b>}
            {a.seenAt && <span style={{ color: "var(--kin-chu-phu)" }}> (từ {new Date(a.seenAt).toLocaleDateString("vi-VN")})</span>}
          </p>
          <p className="mt-1 text-sm" style={{ color: info.sepay.warn ? "var(--kin-tt-chu-cho)" : "var(--kin-chu-phu)", fontWeight: info.sepay.warn ? 600 : 400 }}>
            Tháng này đã nhận {info.sepay.monthCount}/{info.sepay.freeLimit} giao dịch qua SePay{info.sepay.warn ? " — sắp hết gói miễn phí" : ""}.
          </p>
        </>)}
      </section>
    </div>
  );
}
