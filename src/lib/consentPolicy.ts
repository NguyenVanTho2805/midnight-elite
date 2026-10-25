// Quy tắc "cần đồng ý của ai" cho dữ liệu của trẻ (chủ dự án quyết 23/10/2026: "Làm đầy đủ, có hộp đồng ý").
// Hàm THUẦN — không Prisma, không giờ hệ thống ẩn: giờ truyền vào. Test: tools/local-e2e/t-consent-policy-lib.ts.
//
// CHƯA có ý kiến luật sư (Nghị định 13/2023, Luật Trẻ em 2016, Luật 91/2025/QH15). Các mốc dưới đây là mốc KỸ THUẬT chủ chọn
// (D04: ngưỡng 16, đồng ý kép từ 7 tuổi), không phải kết luận pháp lý. Đổi mốc = sửa ĐÚNG hai hằng số này.
//
// Quy tắc:
//  • Dưới 7 tuổi : người giám hộ (phụ huynh) đồng ý.
//  • 7 đến 15    : người giám hộ VÀ chính em cùng đồng ý (đồng ý kép).
//  • Từ 16       : chính người học tự đồng ý.
//  • Có ngày sinh thì ngày sinh quyết định nhóm tuổi; chưa có thì dùng nhóm tuổi gia sư khai. Hai bên khác nhau → lấy nhóm đòi
//    nhiều bên hơn (an toàn), KHÔNG lấy nhóm dễ hơn.
//  • Mặc định an toàn: chưa đủ đồng ý ⇒ không lưu, không hiện thêm dữ liệu của em (xem maskProfile ở studentProfile.ts).
//  • Đồng ý ghi trên KiN do GIA SƯ xác nhận (tutor_attestation). KiN không kiểm giấy tờ nên KHÔNG gọi là "đã xác minh".
import { isValidDateKey, vnDateKeyOf } from "@/lib/classSessions";

/** Ngưỡng tuổi tự đồng ý (D04). */
export const CONSENT_ADULT_AGE = 16;
/** Từ tuổi này trở lên, chính em cũng phải đồng ý cùng người giám hộ. */
export const CONSENT_DUAL_FROM_AGE = 7;
/** Tăng khi chữ trong hộp đồng ý đổi (để đối chiếu khi có tranh chấp). */
export const CONSENT_TEXT_VERSION = "2026-10-tre-v1";

export type AgeGroup = "u7" | "7to15" | "16plus";
export const AGE_GROUPS: readonly AgeGroup[] = ["u7", "7to15", "16plus"];
export const AGE_GROUP_LABEL: Record<AgeGroup, string> = { u7: "Dưới 7 tuổi", "7to15": "Từ 7 đến 15 tuổi", "16plus": "Từ 16 tuổi trở lên" };
export const isAgeGroup = (v: unknown): v is AgeGroup => typeof v === "string" && (AGE_GROUPS as readonly string[]).includes(v);

export type ConsentParty = "guardian" | "child" | "self";
export const PARTY_LABEL: Record<ConsentParty, string> = { guardian: "Phụ huynh / người giám hộ", child: "Em (từ 7 tuổi)", self: "Chính người học (từ 16 tuổi)" };

export type ConsentScope = "basic" | "extended" | "scores" | "family";
export const CONSENT_SCOPES: readonly ConsentScope[] = ["basic", "extended", "scores", "family"];
export const SCOPE_LABEL: Record<ConsentScope, { label: string; detail: string }> = {
  basic:    { label: "Thông tin cơ bản",    detail: "tên em, lớp, trạng thái học, tên và số liên hệ của phụ huynh" },
  extended: { label: "Thông tin mở rộng",   detail: "ngày sinh, địa chỉ, số điện thoại và email bổ sung, môn học, ngày bắt đầu, ghi chú, các trường tuỳ chỉnh" },
  scores:   { label: "Điểm từng buổi",      detail: "điểm 0 đến 10 và phần trăm hoàn thành bài tập về nhà của em ở từng buổi" },
  family:   { label: "Liên kết anh chị em", detail: "ghi các em cùng một gia đình để dùng chung liên hệ (không gộp học phí)" },
};
export const isConsentScope = (v: unknown): v is ConsentScope => typeof v === "string" && (CONSENT_SCOPES as readonly string[]).includes(v);

/** Tuổi (năm tròn) của người sinh ngày `birthKey` tại ngày `todayKey` (cả hai "YYYY-MM-DD", giờ VN). Sai định dạng / sinh sau hôm nay → null. */
export function ageOnKey(birthKey: string | null | undefined, todayKey: string): number | null {
  if (!birthKey || !isValidDateKey(birthKey) || !isValidDateKey(todayKey)) return null;
  if (birthKey > todayKey) return null;
  const [by, bm, bd] = birthKey.split("-").map(Number);
  const [ty, tm, td] = todayKey.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age;
}

export function groupOfAge(age: number): AgeGroup {
  return age < CONSENT_DUAL_FROM_AGE ? "u7" : age < CONSENT_ADULT_AGE ? "7to15" : "16plus";
}

export const partiesOfGroup = (g: AgeGroup): ConsentParty[] => g === "u7" ? ["guardian"] : g === "7to15" ? ["guardian", "child"] : ["self"];

export interface RequiredConsent {
  /** Nhóm tuổi dùng để quyết định. */
  group: AgeGroup;
  /** Tuổi tính từ ngày sinh (nếu có). */
  age: number | null;
  /** Các bên PHẢI đồng ý, theo thứ tự hiển thị. */
  parties: ConsentParty[];
  /** Ngày sinh và nhóm tuổi khai không khớp: đã lấy nhóm đòi nhiều bên hơn. */
  conflict: boolean;
  /** "Con" (dưới 16) hay "Người lớn" (từ 16) — HS-11. */
  kind: "child" | "adult";
}

/** Thứ tự cố định: guardian, child, self. */
const ORDER: ConsentParty[] = ["guardian", "child", "self"];

/**
 * Ai phải đồng ý. `declared` là nhóm tuổi gia sư khai; `birthKey` là ngày sinh nếu có. `now` truyền vào (giờ VN lấy từ vnDateKeyOf).
 * Cả hai vắng → coi là nhóm đòi nhiều nhất của trẻ ("7to15"): chưa biết tuổi thì giữ an toàn, KHÔNG đoán là người lớn.
 */
export function requiredConsent(o: { declared?: AgeGroup | null; birthKey?: string | null; now: Date }): RequiredConsent {
  const age = ageOnKey(o.birthKey, vnDateKeyOf(o.now));
  const fromDob = age === null ? null : groupOfAge(age);
  const declared = o.declared ?? null;
  const group: AgeGroup = fromDob && declared ? (strict(fromDob) >= strict(declared) ? fromDob : declared) : (fromDob ?? declared ?? "7to15");
  return { group, age, parties: partiesOfGroup(group), conflict: !!fromDob && !!declared && fromDob !== declared, kind: group === "16plus" ? "adult" : "child" };
}
const strict = (g: AgeGroup) => g === "7to15" ? 2 : g === "u7" ? 1 : 0;

/** Một dòng ghi vết đã lưu (chỉ các trường quyết định hiệu lực). */
export interface ConsentRow {
  party: string;
  scopes: string[];
  revokedAt: Date | string | null;
  grantedAt?: Date | string;
  textVersion?: string;
}

export interface ConsentState {
  required: ConsentParty[];
  /** Phạm vi nào ĐÃ đủ mọi bên đồng ý và chưa bên nào thu hồi. */
  ok: Record<ConsentScope, boolean>;
  /** Mỗi phạm vi còn thiếu bên nào. */
  missing: Record<ConsentScope, ConsentParty[]>;
  /** Bên nào đã từng đồng ý rồi thu hồi (và chưa đồng ý lại). */
  revoked: ConsentParty[];
  /** Có ít nhất một dòng đồng ý còn hiệu lực. */
  anyActive: boolean;
}

/** Hiệu lực = dòng chưa thu hồi. Một bên coi là đồng ý phạm vi X nếu có dòng còn hiệu lực chứa X. */
export function evaluateConsent(required: ConsentParty[], rows: readonly ConsentRow[], extra?: { childOrSelfByAccount?: boolean }): ConsentState {
  const ok = {} as Record<ConsentScope, boolean>;
  const missing = {} as Record<ConsentScope, ConsentParty[]>;
  for (const s of CONSENT_SCOPES) {
    const miss = required.filter(p => {
      if ((p === "child" || p === "self") && extra?.childOrSelfByAccount) return false; // chính em đã tự bấm đồng ý trong tài khoản (User.selfConsentAt)
      return !rows.some(r => r.party === p && !r.revokedAt && r.scopes.includes(s));
    });
    missing[s] = miss;
    ok[s] = miss.length === 0 && required.length > 0;
  }
  const revoked = ORDER.filter(p => required.includes(p) && rows.some(r => r.party === p && r.revokedAt) && !rows.some(r => r.party === p && !r.revokedAt));
  return { required, ok, missing, revoked, anyActive: rows.some(r => !r.revokedAt) };
}

/** Các bên mà gia sư PHẢI tích trong hộp (để gửi lên máy chủ). Dùng chung phía giao diện và máy chủ. */
export function attestationFromBody(raw: unknown): { parties: ConsentParty[]; scopes: ConsentScope[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const parties = ORDER.filter(p => o[p] === true);
  const scopes = Array.isArray(o.scopes) ? CONSENT_SCOPES.filter(s => (o.scopes as unknown[]).includes(s)) : [];
  if (!scopes.includes("basic") && scopes.length) scopes.unshift("basic");
  return { parties, scopes };
}

/** Còn thiếu bên nào so với `required` (để trả lỗi rõ). */
export function missingParties(required: ConsentParty[], given: readonly ConsentParty[]): ConsentParty[] {
  return required.filter(p => !given.includes(p));
}

// ── Chữ trong hộp đồng ý (một nguồn duy nhất cho giao diện và ghi vết) ───────────────────────

/** Chữ cho gia sư xác nhận, theo bên. Trung thực: đây là lời gia sư xác nhận, KiN không kiểm chứng. */
export function attestationText(p: ConsentParty): string {
  switch (p) {
    case "guardian": return "Phụ huynh / người giám hộ của em đã được tôi giải thích và đồng ý để tôi ghi các thông tin dưới đây của em vào sổ lớp trên KiN, chỉ để dạy học và liên lạc về lớp học.";
    case "child":    return "Em đã được tôi hỏi và tự đồng ý để thông tin của em được ghi vào sổ lớp trên KiN, chỉ để dạy học và liên lạc về lớp học.";
    case "self":     return "Người học (từ 16 tuổi) đã được tôi giải thích và tự đồng ý để tôi ghi các thông tin dưới đây vào sổ lớp trên KiN, chỉ để dạy học và liên lạc về lớp học.";
  }
}
export const ATTESTATION_NOTE =
  "KiN ghi lại việc bạn bấm xác nhận (ai, lúc nào, phạm vi nào, chữ nào). KiN không kiểm tra giấy tờ nên đây là lời xác nhận của gia sư, không phải KiN đã xác minh. Bạn có quyền cung cấp thông tin này và chịu trách nhiệm về lời xác nhận.";
export const REVOKE_NOTE =
  "Thu hồi đồng ý: KiN ẩn mọi thông tin của em trừ tên và không cho ghi thêm. Muốn xoá hẳn hồ sơ, bấm Xoá hồ sơ. Việc thu hồi được ghi vết.";

/** Chữ hộp xác nhận cho nhập hàng loạt (LO-06 / LO-17): một câu nêu quyền cung cấp và đồng ý, ghi vết theo lần nhập. */
export function bulkAttestationText(parties: readonly ConsentParty[]): string {
  const who = parties.map(p => p === "guardian" ? "phụ huynh / người giám hộ của từng em" : p === "child" ? "từng em từ 7 tuổi" : "từng người học từ 16 tuổi").join(" và ");
  return `Tôi có quyền cung cấp danh sách này và đã có đồng ý của ${who} để ghi thông tin vào sổ lớp trên KiN, chỉ để dạy học và liên lạc về lớp học.`;
}

/** Nhãn người thanh toán theo loại (HS-11): con → phụ huynh; người lớn → chính em. */
export function payerLabel(kind: "child" | "adult", guardianName?: string | null): string {
  return kind === "adult" ? "Chính người học" : guardianName ? `Phụ huynh ${guardianName}` : "Phụ huynh";
}
