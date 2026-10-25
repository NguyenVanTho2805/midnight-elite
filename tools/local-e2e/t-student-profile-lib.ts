// Hồ sơ học sinh của gia sư (HS-03/04/10/11, LO-18): kiểm dữ liệu vào, che dữ liệu khi chưa đủ đồng ý, nhật ký sửa chỉ ghi TÊN trường.
// Hàm THUẦN (src/lib/studentProfile.ts). Không cần máy chủ.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-student-profile-lib.ts
import { evaluateConsent, type ConsentRow } from "@/lib/consentPolicy";
import {
  ADDRESS_MAX, CUSTOM_VALUE_MAX, NAME_MAX, NOTES_MAX, SUBJECTS_MAX, changedFields, customFieldsMax, importMaxRows, maskProfile, parseDateInput, parseProfileInput, profileKind,
  type ProfileRow,
} from "@/lib/studentProfile";
import { check, section, done } from "./h";

const NOW = new Date("2026-10-23T05:00:00Z");
const ids = new Set(["f1", "f2"]);
const create = (b: Record<string, unknown>) => parseProfileInput({ name: "Minh Anh", ageGroup: "7to15", ...b }, { partial: false, customIds: ids, now: NOW });
const patch = (b: Record<string, unknown>) => parseProfileInput(b, { partial: true, customIds: ids, now: NOW });
const ok = (r: ReturnType<typeof create>) => Object.keys(r.errors).length === 0;
const row = (o: Partial<ProfileRow> = {}): ProfileRow => ({
  id: "p1", name: "Minh Anh", ageGroup: "7to15", status: "active", courseId: "c1", userId: null, familyId: null, guardianName: "Lan", guardianPhone: "0912345678",
  birthDate: "2014-05-01", address: "1 Lê Lợi", phone: "0987654321", phoneExtra: null, email: "a@b.vn", emailExtra: null, startDate: "2026-09-01", subjects: ["Toán"], notes: "hay quên vở",
  customData: { f1: "Lớp 6A" }, source: "manual", waitlistedAt: null, createdAt: new Date(), ...o,
});
const rowsOf = (parties: string[], scopes: string[]): ConsentRow[] => parties.map(party => ({ party, scopes, revokedAt: null }));
const G7 = ["guardian", "child"] as const;

(async () => {
  section("Tạo hồ sơ: bắt buộc tên và nhóm tuổi");
  check("đủ tên + nhóm tuổi → hợp lệ", ok(create({})));
  check("thiếu tên → lỗi, thiếu nhóm tuổi → lỗi", !!parseProfileInput({ ageGroup: "u7" }, { partial: false, customIds: ids, now: NOW }).errors.name && !!parseProfileInput({ name: "A" }, { partial: false, customIds: ids, now: NOW }).errors.ageGroup);
  check("tên chỉ toàn số / dấu → lỗi", !!create({ name: "123 -" }).errors.name && !!create({ name: "   " }).errors.name);
  check(`tên dài quá ${NAME_MAX} → lỗi, đúng ${NAME_MAX} → được`, !!create({ name: "A".repeat(NAME_MAX + 1) }).errors.name && ok(create({ name: "A".repeat(NAME_MAX) })));
  check("nhóm tuổi lạ → lỗi", !!create({ ageGroup: "adult" }).errors.ageGroup && !!create({ ageGroup: 12 }).errors.ageGroup);
  check("sửa (partial): chỉ trường có mặt được kiểm; không có tên cũng được", ok(patch({ notes: "x" })) && patch({ notes: "x" }).fields.join() === "notes");
  check("tên có ký tự vô hình / đổi chiều chữ bị làm sạch", create({ name: "Minh\u202e \u200bAnh" }).data.name === "Minh Anh");

  section("Số điện thoại (HS-04: ba số)");
  const p = create({ guardianPhone: "0912 345 678", phone: "+84 987 654 321", phoneExtra: "091.234.5678" });
  check("chuẩn hoá về 10 số", p.data.guardianPhone === "0912345678" && p.data.phone === "0987654321" && p.data.phoneExtra === "0912345678");
  check("số ngắn → lỗi nêu đúng ô, KHÔNG lưu", create({ guardianPhone: "0912" }).errors.guardianPhone?.includes("10 chữ số") && !("guardianPhone" in create({ guardianPhone: "0912" }).data));
  check("để trống = xoá (null)", create({ phone: "" }).data.phone === null && create({ phone: null }).data.phone === null);

  section("Email (chính + bổ sung)");
  check("đúng dạng → chữ thường", create({ email: "Co.Lan@Gmail.COM" }).data.email === "co.lan@gmail.com");
  check("sai dạng → lỗi", !!create({ email: "co.lan" }).errors.email && !!create({ emailExtra: "a@b" }).errors.emailExtra && !!create({ email: "a b@c.vn" }).errors.email);

  section("Ngày sinh / ngày bắt đầu");
  check("nhận dd/mm/yyyy, d-m-yyyy, yyyy-mm-dd", parseDateInput("15/03/2014") === "2014-03-15" && parseDateInput("5-3-2014") === "2014-03-05" && parseDateInput("2014-03-15") === "2014-03-15");
  check("ngày không tồn tại (31/02) → null, không tràn sang tháng sau", parseDateInput("31/02/2014") === null && parseDateInput("2014-02-30") === null && parseDateInput("abc") === null && parseDateInput("15/03/14") === null);
  check("ngày sinh ở tương lai → lỗi; hôm nay theo ngày VN được", !!create({ birthDate: "2026-10-24" }).errors.birthDate && ok(create({ birthDate: "2026-10-23" })));
  check("ngày sinh quá xa (trước 1950) → lỗi", !!create({ birthDate: "1900-01-01" }).errors.birthDate);
  check("ngày bắt đầu sai → lỗi; để trống → null", !!create({ startDate: "ngày mai" }).errors.startDate && create({ startDate: "" }).data.startDate === null && create({ startDate: "01/11/2026" }).data.startDate === "2026-11-01");

  section("Địa chỉ, ghi chú, môn học");
  check(`địa chỉ > ${ADDRESS_MAX} → lỗi (không cắt im lặng)`, !!create({ address: "x".repeat(ADDRESS_MAX + 1) }).errors.address && ok(create({ address: "x".repeat(ADDRESS_MAX) })));
  check(`ghi chú > ${NOTES_MAX} → lỗi; xuống dòng được giữ`, !!create({ notes: "x".repeat(NOTES_MAX + 1) }).errors.notes && create({ notes: "a\nb" }).data.notes === "a\nb");
  check("ghi chú làm sạch ký tự điều khiển, giữ xuống dòng", create({ notes: "a\u0000b\u202ec\r\nd" }).data.notes === "abc\nd");
  check("môn: tách bằng dấu phẩy, bỏ trùng không phân biệt hoa thường", create({ subjects: "Toán, toán; Lý" }).data.subjects?.join() === "Toán,Lý");
  check(`môn > ${SUBJECTS_MAX} → lỗi`, !!create({ subjects: ["a", "b", "c", "d", "e", "f"] }).errors.subjects && ok(create({ subjects: ["a", "b", "c", "d", "e"] })));

  section("Trường tuỳ chỉnh (LO-18)");
  check("chỉ nhận id thuộc DANH SÁCH CỦA GIA SƯ; id lạ → lỗi (không lưu im lặng)", !!create({ customData: { zzz: "x" } }).errors.customData && ok(create({ customData: { f1: "Lớp 6A" } })));
  check(`giá trị > ${CUSTOM_VALUE_MAX} → lỗi; rỗng bị bỏ; toàn rỗng → null`, !!create({ customData: { f1: "x".repeat(CUSTOM_VALUE_MAX + 1) } }).errors.customData && create({ customData: { f1: "", f2: "  " } }).data.customData === null);
  check("giá trị không phải chữ (số, object) → bị coi rỗng, không lọt", create({ customData: { f1: { a: 1 } as unknown as string } }).data.customData === null);
  check("customData là mảng / chuỗi → lỗi", !!create({ customData: ["x"] }).errors.customData && !!create({ customData: "x" }).errors.customData);
  check("cấu hình số trường tối đa: mặc định 3, đọc env, ngoài khoảng 0..10 về 3", customFieldsMax({}) === 3 && customFieldsMax({ KIN_CUSTOM_FIELDS_MAX: "5" }) === 5 && customFieldsMax({ KIN_CUSTOM_FIELDS_MAX: "0" }) === 0 && customFieldsMax({ KIN_CUSTOM_FIELDS_MAX: "99" }) === 3 && customFieldsMax({ KIN_CUSTOM_FIELDS_MAX: "x" }) === 3);
  check("cấu hình số dòng nhập tối đa: mặc định 100, đọc env, ngoài 1..500 về 100", importMaxRows({}) === 100 && importMaxRows({ KIN_IMPORT_MAX_ROWS: "30" }) === 30 && importMaxRows({ KIN_IMPORT_MAX_ROWS: "0" }) === 100 && importMaxRows({ KIN_IMPORT_MAX_ROWS: "501" }) === 100);

  section("Trạng thái (HS-10) và loại Con / Người lớn (HS-11)");
  check("trạng thái hợp lệ: active / inactive / waitlist; lạ → lỗi", ok(create({ status: "inactive" })) && ok(create({ status: "waitlist" })) && !!create({ status: "deleted" }).errors.status);
  check("loại: 16plus → người lớn; u7, 7to15 → con", profileKind("16plus") === "adult" && profileKind("u7") === "child" && profileKind("7to15") === "child");

  section("Che dữ liệu khi chưa đủ đồng ý (MẶC ĐỊNH AN TOÀN)");
  const full = evaluateConsent([...G7], rowsOf([...G7], ["basic", "extended"]));
  const basicOnly = evaluateConsent([...G7], rowsOf([...G7], ["basic"]));
  const none = evaluateConsent([...G7], []);
  const revoked = evaluateConsent([...G7], [{ party: "guardian", scopes: ["basic", "extended"], revokedAt: new Date() }, { party: "child", scopes: ["basic", "extended"], revokedAt: null }]);
  const vFull = maskProfile(row(), full), vBasic = maskProfile(row(), basicOnly), vNone = maskProfile(row(), none), vRev = maskProfile(row(), revoked);
  check("đủ cơ bản + mở rộng → thấy tất cả", vFull.consentLevel === "full" && vFull.birthDate === "2014-05-01" && vFull.notes === "hay quên vở" && vFull.customData?.f1 === "Lớp 6A" && vFull.guardianPhone === "0912345678");
  check("chỉ cơ bản → thấy tên + liên hệ phụ huynh, KHÔNG thấy ngày sinh / địa chỉ / SĐT em / email / môn / ghi chú / tuỳ chỉnh", (() => {
    const j = JSON.stringify(vBasic);
    return vBasic.consentLevel === "basic_only" && vBasic.guardianPhone === "0912345678" && !j.includes("2014-05-01") && !j.includes("Lê Lợi") && !j.includes("0987654321") && !j.includes("a@b.vn") && !j.includes("hay quên vở") && !j.includes("Lớp 6A") && !("birthDate" in vBasic) && !("notes" in vBasic);
  })());
  check("chưa có đồng ý nào → KHOÁ: chỉ còn id + tên (kể cả SĐT phụ huynh cũng không hiện)", (() => { const j = JSON.stringify(vNone); return vNone.consentLevel === "locked" && Object.keys(vNone).sort().join() === "consentLevel,id,name" && !j.includes("0912345678") && !j.includes("Lan"); })());
  check("một bên thu hồi → khoá lại dù bên kia còn đồng ý", vRev.consentLevel === "locked" && !JSON.stringify(vRev).includes("2014-05-01"));
  check("hồ sơ khoá không làm lộ gì kể cả khi dữ liệu có đủ trường", !JSON.stringify(maskProfile(row({ address: "SECRET-ADDR", notes: "SECRET-NOTE" }), none)).includes("SECRET"));

  section("Nhật ký sửa chỉ ghi TÊN trường");
  const before = row();
  const ch = changedFields(before as unknown as Record<string, unknown>, { name: "Minh Anh", phone: "0900000000", subjects: ["Toán"], notes: null, address: "1 Lê Lợi" });
  check("trả đúng các trường đã đổi (phone, notes), không kèm trường giữ nguyên", ch.join() === "phone,notes", ch);
  check("kết quả KHÔNG chứa giá trị, chỉ tên trường", !JSON.stringify(ch).includes("0900000000") && ch.every(x => /^[a-zA-Z]+$/.test(x)));
  check("mảng môn đổi thứ tự / thêm bớt được nhận ra", changedFields(before as unknown as Record<string, unknown>, { subjects: ["Toán", "Lý"] }).join() === "subjects" && changedFields(before as unknown as Record<string, unknown>, { subjects: ["Toán"] }).length === 0);

  await done();
})();
