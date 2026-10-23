// Đồng ý dữ liệu trẻ (23/10/2026): "cần đồng ý của AI" theo tuổi, ngưỡng 16, đồng ý kép từ 7 tuổi, thu hồi, mặc định an toàn.
// Hàm THUẦN (src/lib/consentPolicy.ts) + công tắc vào lớp (src/lib/enrollment.ts enrollmentStatusFor) + quét tĩnh chữ hộp đồng ý.
// Không cần máy chủ. Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-consent-policy-lib.ts
// CHƯA có ý kiến luật sư: các mốc là mốc kỹ thuật chủ chọn (D04), không phải kết luận pháp lý.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AGE_GROUPS, ATTESTATION_NOTE, CONSENT_ADULT_AGE, CONSENT_DUAL_FROM_AGE, CONSENT_SCOPES, CONSENT_TEXT_VERSION, REVOKE_NOTE, ageOnKey, attestationFromBody, attestationText,
  bulkAttestationText, evaluateConsent, groupOfAge, missingParties, partiesOfGroup, payerLabel, requiredConsent, type ConsentRow,
} from "@/lib/consentPolicy";
import { enrollmentStatusFor } from "@/lib/enrollment";
import { check, section, done } from "./h";

const at = (key: string, hm = "12:00") => new Date(`${key}T${hm}:00+07:00`); // một thời điểm trong ngày VN `key`
const req = (declared: "u7" | "7to15" | "16plus" | null, birthKey: string | null, nowKey = "2026-10-23") => requiredConsent({ declared, birthKey, now: at(nowKey) });
const row = (party: string, scopes: string[], revoked = false): ConsentRow => ({ party, scopes, revokedAt: revoked ? new Date() : null });

(async () => {
  section("Hằng số: ngưỡng chủ chọn (D04)");
  check("ngưỡng tự đồng ý = 16, đồng ý kép từ 7", CONSENT_ADULT_AGE === 16 && CONSENT_DUAL_FROM_AGE === 7);
  check("3 nhóm tuổi", AGE_GROUPS.join() === "u7,7to15,16plus");

  section("Tuổi tròn năm theo ngày VN — biên sinh nhật");
  check("sinh 16/10/2019, hôm nay 23/10/2026 → 7 tuổi", ageOnKey("2019-10-16", "2026-10-23") === 7);
  check("đúng sinh nhật thứ 7 (23/10/2019 → 23/10/2026) → 7", ageOnKey("2019-10-23", "2026-10-23") === 7);
  check("hôm trước sinh nhật thứ 7 (24/10/2019) → 6", ageOnKey("2019-10-24", "2026-10-23") === 6);
  check("đúng sinh nhật thứ 16 → 16; hôm trước → 15", ageOnKey("2010-10-23", "2026-10-23") === 16 && ageOnKey("2010-10-24", "2026-10-23") === 15);
  check("29/02: sinh 2012-02-29, hôm nay 2026-02-28 → 13; 2026-03-01 → 14", ageOnKey("2012-02-29", "2026-02-28") === 13 && ageOnKey("2012-02-29", "2026-03-01") === 14);
  check("ngày sinh sai / sinh sau hôm nay / rỗng → null (không đoán)", ageOnKey("2026-02-30", "2026-10-23") === null && ageOnKey("2027-01-01", "2026-10-23") === null && ageOnKey(null, "2026-10-23") === null && ageOnKey("", "2026-10-23") === null && ageOnKey("abc", "2026-10-23") === null);
  check("groupOfAge: 0→u7, 6→u7, 7→7to15, 15→7to15, 16→16plus, 40→16plus", [0, 6, 7, 15, 16, 40].map(groupOfAge).join() === "u7,u7,7to15,7to15,16plus,16plus");
  // 00:30 sáng ngày 24/10 giờ VN vẫn là 23/10 giờ UTC: tuổi phải theo NGÀY VN.
  check("giờ VN: 00:30 ngày 24/10 VN (17:30 UTC ngày 23) tính là ngày 24 → tròn 7 tuổi sinh 24/10/2019", requiredConsent({ declared: null, birthKey: "2019-10-24", now: new Date("2026-10-23T17:30:00Z") }).age === 7);

  section("Ai phải đồng ý");
  check("dưới 7 → chỉ phụ huynh", partiesOfGroup("u7").join() === "guardian");
  check("7 đến 15 → phụ huynh VÀ em (đồng ý kép)", partiesOfGroup("7to15").join() === "guardian,child");
  check("từ 16 → chính người học", partiesOfGroup("16plus").join() === "self");
  check("khai nhóm, chưa có ngày sinh: u7 / 7to15 / 16plus", req("u7", null).parties.join() === "guardian" && req("7to15", null).parties.join() === "guardian,child" && req("16plus", null).parties.join() === "self");
  check("MẶC ĐỊNH AN TOÀN: chưa biết tuổi gì cả → đòi như nhóm 7-15 (phụ huynh + em), KHÔNG đoán là người lớn", req(null, null).parties.join() === "guardian,child" && req(null, null).kind === "child");
  check("có ngày sinh 12 tuổi → phụ huynh + em", req(null, "2014-05-01").parties.join() === "guardian,child" && req(null, "2014-05-01").age === 12);
  check("có ngày sinh 5 tuổi → chỉ phụ huynh", req(null, "2021-05-01").parties.join() === "guardian");
  check("có ngày sinh 20 tuổi → tự đồng ý, loại Người lớn", req(null, "2006-05-01").parties.join() === "self" && req(null, "2006-05-01").kind === "adult");
  check("ngày sinh QUYẾT ĐỊNH: khai 16plus nhưng ngày sinh 10 tuổi → phụ huynh + em (không tin lời khai dễ hơn)", (() => { const r = req("16plus", "2016-05-01"); return r.parties.join() === "guardian,child" && r.conflict && r.kind === "child"; })());
  check("khai u7 nhưng ngày sinh 10 tuổi → phụ huynh + em", req("u7", "2016-05-01").parties.join() === "guardian,child");
  check("khai 7to15 nhưng ngày sinh 30 tuổi → giữ nhóm nghiêm hơn (7to15) và gắn cờ mâu thuẫn", (() => { const r = req("7to15", "1996-05-01"); return r.parties.join() === "guardian,child" && r.conflict; })());
  check("khớp nhau thì không có cờ mâu thuẫn", !req("7to15", "2014-05-01").conflict);
  check("em lớn lên: 15 tuổi → 16 tuổi thì chuyển từ phụ huynh+em sang tự đồng ý", req(null, "2010-10-24", "2026-10-23").parties.join() === "guardian,child" && req(null, "2010-10-24", "2026-10-24").parties.join() === "self");
  check("mọi tổ hợp (nhóm khai × ngày sinh) luôn trả ít nhất MỘT bên, không bao giờ rỗng", (() => {
    for (const d of [null, ...AGE_GROUPS]) for (const b of [null, "2024-01-01", "2018-01-01", "2012-01-01", "2000-01-01", "bậy"]) if (req(d, b).parties.length === 0) return false;
    return true;
  })());

  section("Đã đồng ý chưa — theo từng phạm vi");
  const R715 = partiesOfGroup("7to15");
  check("không có dòng nào → mọi phạm vi chưa đủ, thiếu cả phụ huynh và em", (() => { const s = evaluateConsent(R715, []); return CONSENT_SCOPES.every(sc => !s.ok[sc]) && s.missing.basic.join() === "guardian,child" && !s.anyActive; })());
  check("chỉ phụ huynh đồng ý (7-15 tuổi) → vẫn CHƯA đủ (thiếu em)", (() => { const s = evaluateConsent(R715, [row("guardian", ["basic"])]); return !s.ok.basic && s.missing.basic.join() === "child"; })());
  check("phụ huynh + em cùng đồng ý phạm vi cơ bản → đủ cơ bản, CHƯA đủ mở rộng", (() => { const s = evaluateConsent(R715, [row("guardian", ["basic"]), row("child", ["basic"])]); return s.ok.basic && !s.ok.extended && s.missing.extended.join() === "guardian,child"; })());
  check("đồng ý cả hai bên cho cơ bản + mở rộng + điểm → ba phạm vi đủ, gia đình chưa", (() => { const sc = ["basic", "extended", "scores"]; const s = evaluateConsent(R715, [row("guardian", sc), row("child", sc)]); return s.ok.basic && s.ok.extended && s.ok.scores && !s.ok.family; })());
  check("dưới 7: chỉ cần phụ huynh", evaluateConsent(["guardian"], [row("guardian", ["basic"])]).ok.basic);
  check("từ 16: chỉ cần chính người học; dòng của phụ huynh KHÔNG thay được", (() => { const a = evaluateConsent(["self"], [row("guardian", ["basic"])]); const b = evaluateConsent(["self"], [row("self", ["basic"])]); return !a.ok.basic && b.ok.basic; })());
  check("dòng của bên KHÔNG cần (em dưới 7 mà có dòng 'child') không làm đủ phụ huynh", !evaluateConsent(["guardian"], [row("child", ["basic"])]).ok.basic);
  check("không có bên nào cần (danh sách rỗng) → KHÔNG coi là đủ (an toàn)", !evaluateConsent([], []).ok.basic && !evaluateConsent([], [row("guardian", ["basic"])]).ok.basic);

  section("Thu hồi");
  check("phụ huynh thu hồi → phạm vi mất hiệu lực, ghi nhận bên đã thu hồi", (() => { const s = evaluateConsent(R715, [row("guardian", ["basic"], true), row("child", ["basic"])]); return !s.ok.basic && s.revoked.join() === "guardian" && s.anyActive; })());
  check("em thu hồi (từ 7 tuổi) cũng làm mất hiệu lực dù phụ huynh còn đồng ý", !evaluateConsent(R715, [row("guardian", ["basic"]), row("child", ["basic"], true)]).ok.basic);
  check("đồng ý LẠI sau thu hồi (dòng mới) → có hiệu lực trở lại, không còn tính là đang thu hồi", (() => { const s = evaluateConsent(R715, [row("guardian", ["basic"], true), row("guardian", ["basic"]), row("child", ["basic"])]); return s.ok.basic && s.revoked.length === 0; })());
  check("thu hồi hết → anyActive false", !evaluateConsent(["guardian"], [row("guardian", ["basic"], true)]).anyActive);
  check("em có tài khoản tự bấm đồng ý (selfConsentAt) thay được phần 'em'/'chính người học', KHÔNG thay được phụ huynh", (() => {
    const a = evaluateConsent(R715, [row("guardian", ["basic", "extended"])], { childOrSelfByAccount: true });
    const b = evaluateConsent(R715, [], { childOrSelfByAccount: true });
    const c = evaluateConsent(["self"], [], { childOrSelfByAccount: true });
    return a.ok.basic && a.ok.extended && !b.ok.basic && b.missing.basic.join() === "guardian" && c.ok.basic;
  })());

  section("Hộp đồng ý gửi lên → bên + phạm vi");
  check("không phải object → null", attestationFromBody(null) === null && attestationFromBody("x") === null);
  check("chỉ nhận đúng `true` (chuỗi 'true', 1 không tính)", attestationFromBody({ guardian: "true", child: 1, self: false, scopes: ["basic"] })!.parties.length === 0);
  check("phạm vi lạ bị bỏ; có phạm vi thì tự thêm 'basic'", (() => { const a = attestationFromBody({ guardian: true, scopes: ["extended", "bậy"] })!; return a.scopes.join() === "basic,extended" && a.parties.join() === "guardian"; })());
  check("không gửi phạm vi → rỗng (máy chủ sẽ từ chối vì thiếu 'basic')", attestationFromBody({ guardian: true })!.scopes.length === 0);
  check("missingParties", missingParties(["guardian", "child"], ["guardian"]).join() === "child" && missingParties(["self"], []).join() === "self");

  section("Công tắc vào lớp (KIN_ENROLL_CONSENT_GATE) — mặc định TẮT");
  const now = at("2026-10-23");
  check("công tắc tắt → luôn active, kể cả em 8 tuổi chưa có đồng ý", enrollmentStatusFor({ gateOn: false, birthKey: "2018-01-01", now, guardianApproved: false }) === "active");
  check("bật + dưới 16 + chưa duyệt → pending_consent", enrollmentStatusFor({ gateOn: true, birthKey: "2018-01-01", now, guardianApproved: false }) === "pending_consent");
  check("bật + dưới 16 + phụ huynh đã duyệt → active", enrollmentStatusFor({ gateOn: true, birthKey: "2018-01-01", now, guardianApproved: true }) === "active");
  check("bật + từ 16 tuổi → active", enrollmentStatusFor({ gateOn: true, birthKey: "2010-10-23", now, guardianApproved: false }) === "active");
  check("bật + 15 tuổi 364 ngày → pending_consent (biên)", enrollmentStatusFor({ gateOn: true, birthKey: "2010-10-24", now, guardianApproved: false }) === "pending_consent");
  check("bật + KHÔNG có ngày sinh → active (không đoán tuổi tài khoản tự khai)", enrollmentStatusFor({ gateOn: true, birthKey: null, now, guardianApproved: false }) === "active");

  section("Chữ trong hộp đồng ý: trung thực");
  const src = readFileSync(join(process.cwd(), "src/lib/consentPolicy.ts"), "utf8");
  const texts = [attestationText("guardian"), attestationText("child"), attestationText("self"), ATTESTATION_NOTE, REVOKE_NOTE, bulkAttestationText(["guardian", "child"])];
  // Câu phủ định 'không phải KiN đã xác minh' là CHÍNH điều cần nói; chỉ cấm khẳng định.
  const claims = (t: string) => /đã xác minh|được xác minh|xác thực|KiN xác nhận/i.test(t.replace(/không phải KiN đã xác minh/gi, ""));
  check("không chữ nào KHẲNG ĐỊNH 'đã xác minh' / 'được xác thực' / 'KiN xác nhận' (chỉ được phủ định)", texts.every(t => !claims(t)) && claims("KiN đã xác minh phụ huynh"));
  check("hộp nói rõ KiN không kiểm tra giấy tờ và đây là lời của gia sư", /không kiểm tra giấy tờ/.test(ATTESTATION_NOTE) && /lời xác nhận của gia sư/.test(ATTESTATION_NOTE));
  check("chữ chỉ nêu mục đích dạy học và liên lạc, không nêu quảng cáo / chia sẻ bên thứ ba", texts.slice(0, 3).every(t => /dạy học và liên lạc/.test(t)) && texts.every(t => !/quảng cáo|chia sẻ|bán/i.test(t)));
  check("hộp hàng loạt nêu quyền cung cấp + đồng ý, đúng các bên", /có quyền cung cấp/.test(bulkAttestationText(["guardian"])) && /từng em từ 7 tuổi/.test(bulkAttestationText(["guardian", "child"])) && /từ 16 tuổi/.test(bulkAttestationText(["self"])));
  check("phiên bản chữ có ngày tháng (để đối chiếu khi tranh chấp)", /^\d{4}-\d{2}-/.test(CONSENT_TEXT_VERSION));
  check("nhãn người thanh toán: con → phụ huynh; người lớn → chính em", payerLabel("child", "Lan") === "Phụ huynh Lan" && payerLabel("child") === "Phụ huynh" && payerLabel("adult", "Lan") === "Chính người học");
  check("tệp lib thuần: không nạp Prisma / không đọc giờ hệ thống ẩn", !/@\/lib\/prisma/.test(src) && !/new Date\(\)/.test(src.replace(/\/\/.*$/gm, "")));

  await done();
})();
