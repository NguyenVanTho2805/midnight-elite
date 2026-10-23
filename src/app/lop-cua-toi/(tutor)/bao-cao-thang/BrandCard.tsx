// KiN Pro F3 — "Thương hiệu giấy tờ": tên hiển thị, màu nhấn (chọn trong danh sách, không nhập mã màu), chữ ký chữ. Chưa có logo tải lên.
// Free (cổng bật) chỉ ĐỌC được cài đặt đã lưu; sửa nằm trong KiN Pro. Chữ ở đây chỉ nói với gia sư, không bao giờ hiện cho phụ huynh.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { KinButton, kinButtonClass } from "@/components/kin";
import { Badge, CARD_STYLE, FIELD_STYLE, callApi, useNotify } from "@/components/tutor/shared";
import { ACCENTS, ACCENT_KEYS, DEFAULT_ACCENT, NAME_MAX, SIGNATURE_MAX, type AccentKey } from "@/lib/docBrand";

interface Loaded { brand: { displayName: string; accent: string; signature: string } | null; canBrand: boolean }

export default function BrandCard({ onSaved }: { onSaved?: () => void }) {
  const notify = useNotify();
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [accent, setAccent] = useState<AccentKey>(DEFAULT_ACCENT);
  const [sig, setSig] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    await Promise.resolve();
    setFailed(false);
    const r = await callApi<Loaded>("/api/tutor/doc-brand");
    if (!r.ok) { setFailed(true); return; }
    setData(r.data);
    const b = r.data.brand;
    setName(b?.displayName ?? ""); setSig(b?.signature ?? "");
    setAccent((b && b.accent in ACCENTS ? b.accent : DEFAULT_ACCENT) as AccentKey);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    const r = await callApi("/api/tutor/doc-brand", { method: "PUT", body: JSON.stringify({ displayName: name, accent, signature: sig }) });
    setBusy(false);
    if (!r.ok) { notify.err(r.data.error ?? "Không lưu được, thử lại"); return; }
    notify.ok("Đã lưu thương hiệu giấy tờ.");
    onSaved?.();
    void load();
  }

  const can = !!data?.canBrand;
  return (
    <section aria-labelledby="brand-h" className="rounded-xl mb-4" style={CARD_STYLE}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-controls="brand-body"
        className="w-full text-left px-4 py-3 flex items-center gap-3 min-h-[44px]">
        <span className="flex-1 min-w-0">
          <span id="brand-h" className="block font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Thương hiệu giấy tờ</span>
          <span className="block text-xs" style={{ color: "var(--kin-chu-phu)" }}>
            {data?.brand ? `Đang dùng: ${data.brand.displayName}` : "Chưa cài. Bản in vẫn dùng được với mẫu KiN."}
          </span>
        </span>
        {data && !can && <Badge tone="neutral">Có trong KiN Pro</Badge>}
        <span aria-hidden style={{ color: "var(--kin-chu-phu)" }}>{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div id="brand-body" className="px-4 pb-4 pt-3 space-y-3" style={{ borderTop: "1px solid var(--kin-vien-thuong)" }}>
          {failed ? (
            <div role="alert" className="flex items-center justify-between gap-3">
              <span className="text-sm" style={{ color: "var(--kin-tt-chu-loi)" }}>Không tải được cài đặt. Kiểm tra mạng rồi thử lại.</span>
              <KinButton variant="secondary" onClick={() => void load()}>Thử lại</KinButton>
            </div>
          ) : !data ? (
            <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }} aria-busy="true">Đang tải…</p>
          ) : (
            <>
              <p className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>
                Tên, màu và chữ ký hiện trên bản in báo cáo tháng. Nhãn “ghi trên KiN” và số liệu luôn có, không che được. Bản in mẫu KiN luôn miễn phí.
              </p>
              {!can && (
                <p className="text-sm rounded-lg p-3" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-phu)" }}>
                  Sửa thương hiệu và tạo bản in có thương hiệu mới nằm trong KiN Pro. Bản đã tạo trước đó vẫn xem và in lại được.{" "}
                  <Link href="/lop-cua-toi/goi" className="underline" style={{ color: "var(--kin-nhan-link)" }}>Xem gói</Link>
                </p>
              )}
              <div>
                <label htmlFor="brand-name" className="block text-sm font-semibold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Tên hiển thị</label>
                <input id="brand-name" value={name} maxLength={NAME_MAX} disabled={!can} onChange={e => setName(e.target.value)}
                  placeholder="Ví dụ: Lớp Toán cô Lan" className="w-full px-3 py-2 min-h-[44px] rounded-lg text-sm" style={FIELD_STYLE} />
              </div>
              <fieldset>
                <legend className="text-sm font-semibold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Màu nhấn</legend>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_KEYS.map(k => (
                    <label key={k} className="inline-flex items-center gap-2 px-3 min-h-[44px] rounded-lg text-sm cursor-pointer"
                      style={{ background: "var(--kin-nen-trang)", border: accent === k ? "2px solid var(--kin-nhan-link)" : "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }}>
                      <input type="radio" name="brand-accent" value={k} checked={accent === k} disabled={!can} onChange={() => setAccent(k)} />
                      <span aria-hidden className="inline-block w-4 h-4 rounded-full" style={{ background: ACCENTS[k].css }} />
                      {ACCENTS[k].label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor="brand-sig" className="block text-sm font-semibold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Chữ ký (một dòng chữ, không bắt buộc)</label>
                <input id="brand-sig" value={sig} maxLength={SIGNATURE_MAX} disabled={!can} onChange={e => setSig(e.target.value)}
                  placeholder="Ví dụ: Chúc em tiến bộ mỗi ngày" className="w-full px-3 py-2 min-h-[44px] rounded-lg text-sm" style={FIELD_STYLE} />
              </div>
              <div className="rounded-lg p-3" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
                <p className="text-xs mb-1" style={{ color: "var(--kin-chu-phu)" }}>Xem trước phần đầu bản in</p>
                <p className="font-semibold break-words" style={{ color: ACCENTS[accent].css, borderBottom: `3px solid ${ACCENTS[accent].css}`, paddingBottom: 6 }}>{name.trim() || "Tên hiển thị của bạn"}</p>
              </div>
              {can && <KinButton loading={busy} disabled={!name.trim()} onClick={() => void save()}>Lưu thương hiệu</KinButton>}
              {!can && <Link href="/lop-cua-toi/goi" className={kinButtonClass("secondary")}>Xem gói KiN Pro</Link>}
            </>
          )}
        </div>
      )}
    </section>
  );
}
