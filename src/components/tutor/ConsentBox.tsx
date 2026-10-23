// Hộp đồng ý dữ liệu trẻ (23/10/2026). Dùng ở: thêm học sinh (wizard), hồ sơ học sinh, nhập hàng loạt, nhận yêu cầu của khách.
// Quy tắc: KHÔNG tích sẵn. Chữ nói thật: đây là lời GIA SƯ xác nhận, KiN không kiểm tra giấy tờ nên không phải "đã xác minh".
// Chỉ hiện các bên mà nhóm tuổi của em đòi (consentPolicy.requiredConsent). Phạm vi: cơ bản luôn có; các phạm vi khác tích thêm.
// CHƯA có ý kiến luật sư; xem docs/kin/bao-cao/cau-hoi-luat-su.md.
"use client";
import { ATTESTATION_NOTE, PARTY_LABEL, SCOPE_LABEL, attestationText, bulkAttestationText, type ConsentParty, type ConsentScope } from "@/lib/consentPolicy";

export interface ConsentValue { guardian: boolean; child: boolean; self: boolean; scopes: ConsentScope[] }
export const EMPTY_CONSENT: ConsentValue = { guardian: false, child: false, self: false, scopes: ["basic"] };

/** Thân gửi lên máy chủ: chỉ bên đã tích. */
export const consentBody = (v: ConsentValue) => ({ guardian: v.guardian || undefined, child: v.child || undefined, self: v.self || undefined, scopes: v.scopes });

export default function ConsentBox({ parties, value, onChange, optionalScopes = ["extended"], forcedScopes = ["basic"], bulk = false, disabled = false, id = "consent" }: {
  /** Các bên PHẢI đồng ý (đã loại bên em đã tự đồng ý trong tài khoản). */
  parties: readonly ConsentParty[];
  value: ConsentValue;
  onChange: (v: ConsentValue) => void;
  /** Phạm vi gia sư được tích thêm. */
  optionalScopes?: readonly ConsentScope[];
  /** Phạm vi bắt buộc theo dữ liệu đang nhập (hiện đã tích, không bỏ được). */
  forcedScopes?: readonly ConsentScope[];
  /** Nhập hàng loạt: một câu chung thay cho từng bên. */
  bulk?: boolean;
  disabled?: boolean;
  id?: string;
}) {
  const scopes = [...new Set<ConsentScope>([...forcedScopes, ...value.scopes])];
  const toggleScope = (s: ConsentScope) => onChange({ ...value, scopes: value.scopes.includes(s) ? value.scopes.filter(x => x !== s) : [...value.scopes, s] });
  const allTicked = parties.length > 0 && parties.every(p => value[p]);
  return (
    <fieldset data-consent-box disabled={disabled} className="border border-[var(--kin-vien-o-nhap)] rounded-[var(--kin-bo-md)] px-[var(--kin-kc-7)] py-[var(--kin-kc-6)] bg-[var(--kin-nen-trang)]">
      <legend className="px-1 text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">Xác nhận đồng ý trước khi lưu thông tin của em</legend>

      {parties.length === 0 ? (
        <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Em đã tự đồng ý trong tài khoản của em. Không cần thêm xác nhận cho bên này.</p>
      ) : bulk ? (
        <label className="flex items-start gap-3 min-h-11 py-1 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)]">
          <input type="checkbox" data-consent-bulk checked={allTicked} onChange={e => onChange({ ...value, guardian: e.target.checked && parties.includes("guardian"), child: e.target.checked && parties.includes("child"), self: e.target.checked && parties.includes("self") })} className="mt-0.5 size-5 shrink-0" />
          <span>{bulkAttestationText(parties)}</span>
        </label>
      ) : (
        <ul className="space-y-1">
          {parties.map(p => (
            <li key={p}>
              <label className="flex items-start gap-3 min-h-11 py-1 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)]">
                <input type="checkbox" data-consent-party={p} checked={value[p]} onChange={e => onChange({ ...value, [p]: e.target.checked })} className="mt-0.5 size-5 shrink-0" />
                <span><span className="block font-medium">{PARTY_LABEL[p]}</span>{attestationText(p)}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 border-t border-[var(--kin-vien-nhat)] pt-3">
        <p className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">Phạm vi ghi thông tin</p>
        <ul className="mt-1 space-y-0.5">
          {(["basic", ...optionalScopes.filter(s => s !== "basic")] as ConsentScope[]).map(s => {
            const forced = forcedScopes.includes(s);
            return (
              <li key={s}>
                <label className="flex items-start gap-3 min-h-11 py-1 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)]">
                  <input type="checkbox" data-consent-scope={s} checked={s === "basic" || forced || scopes.includes(s)} disabled={s === "basic" || forced} onChange={() => toggleScope(s)} className="mt-0.5 size-5 shrink-0" />
                  <span><span className="font-medium">{SCOPE_LABEL[s].label}</span>{": "}{SCOPE_LABEL[s].detail}{forced && s !== "basic" ? " (cần cho thông tin bạn đang nhập)" : ""}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
      <p id={`${id}-note`} className="mt-3 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{ATTESTATION_NOTE}</p>
    </fieldset>
  );
}
