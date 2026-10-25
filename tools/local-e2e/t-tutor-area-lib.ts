// ĐX-06 (NC1-074) — khu vực và hình thức dạy: kiểm dữ liệu, chuẩn hoá, phần được công khai, lọc (src/lib/tutorArea.ts) + nối vào
// preferences / hồ sơ gia sư + quét tĩnh. Không cần DB hay máy chủ.
// Chạy: DATABASE_URL=postgresql://x:x@localhost/x npx tsx tools/local-e2e/t-tutor-area-lib.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CREDENTIAL_MAX, DISTRICT_MAX, CITY_MAX, MODE_LABEL, PRICE_MAX, PRICE_MIN, TEACHING_MODES, areaLine, canonicalCity, cityFacets, cityKey, cleanText,
  hasPublicArea, matchesArea, normalizeKey, parseAreaInput, parseModeFilter, priceText, publicArea, readTeaching, type PublicArea, type TutorTeaching,
} from "@/lib/tutorArea";
import { applyPreferencesPatch, prefsLockKey, readPreferences } from "@/lib/userPreferences";
import { parseTutorProfileInput } from "@/lib/tutorProfile";
import { check, section, done } from "./h";

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const err = (r: { error?: string }) => r.error ?? null;

(async () => {
  section("Làm sạch chữ tự nhập");
  check("gộp khoảng trắng, cắt hai đầu, xuống dòng thành dấu cách", cleanText("  Cầu   Giấy \n ") === "Cầu Giấy");
  check("chuẩn hoá NFC: dấu rời ghép lại (so khớp và đếm ký tự không bị lệch)", cleanText("Cầu Giấy") === "Cầu Giấy".normalize("NFC") && cleanText("Cầu").length === 3);
  check("bỏ ký tự điều khiển, khoảng rộng bằng 0, BOM, ký tự đổi chiều chữ (U+202E), ngắt dòng/đoạn Unicode", cleanText("A\u0000B\u200bC\ufeffD\u202eE\u2028F\u2029G") === "A B C D E F G");
  check("kết quả không còn ký tự vô hình nào trong dải đã chặn", !/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/.test(cleanText("x\u0007y\u200dz\u2029w\u2066v\u2060u")));

  section("Tên tỉnh/thành: thống nhất cách viết");
  check("khoá so khớp bỏ dấu, hoa thường, dấu câu", normalizeKey("  Hồ-Chí  Minh. ") === "ho chi minh" && normalizeKey("ĐÀ NẴNG") === "da nang" && normalizeKey("Đắk Lắk") === "dak lak");
  check("các cách viết TP.HCM về một dạng: TP. Hồ Chí Minh", ["TP.HCM", "tp hcm", "Sài Gòn", "sai gon", "Hồ Chí Minh", "HCM", "SG", "Thành phố Hồ Chí Minh", "tphcm"].every(s => canonicalCity(s) === "TP. Hồ Chí Minh"), ["TP.HCM", "Sài Gòn"].map(canonicalCity));
  check("Hà Nội / HN / ha noi → Hà Nội; Đà Nẵng, Hải Phòng, Cần Thơ, Huế cũng thống nhất", ["Hà Nội", "HN", "ha noi", "TP Hà Nội"].every(s => canonicalCity(s) === "Hà Nội") && canonicalCity("da nang") === "Đà Nẵng" && canonicalCity("hai phong") === "Hải Phòng" && canonicalCity("can tho") === "Cần Thơ" && canonicalCity("thua thien hue") === "Huế");
  check("nơi khác giữ nguyên chữ đã làm sạch (không đoán tên)", canonicalCity("  Bắc   Ninh ") === "Bắc Ninh" && canonicalCity("Đắk Lắk") === "Đắk Lắk");
  check("cityKey: viết khác dấu/hoa thường vẫn cùng khoá", cityKey("Bắc Ninh") === cityKey("bac ninh") && cityKey("TP.HCM") === cityKey("Hồ Chí Minh") && cityKey("Hà Nội") !== cityKey("Hải Phòng"));

  section("Kiểm dữ liệu gia sư gửi lên (parseAreaInput)");
  check("không gửi gì → không đổi gì", eq(parseAreaInput({}), {}));
  check("city: chuỗi → chuẩn hoá; null / rỗng → xoá; sai kiểu và quá dài → lỗi", parseAreaInput({ city: "tp.hcm" }).city === "TP. Hồ Chí Minh" && parseAreaInput({ city: null }).city === null && parseAreaInput({ city: "  " }).city === null
    && !!parseAreaInput({ city: 5 }).error && !!parseAreaInput({ city: "x".repeat(CITY_MAX + 1) }).error && !parseAreaInput({ city: "x".repeat(CITY_MAX) }).error);
  check("teaching: null → xoá cả mục; {} hợp lệ (đã lưu mục nhưng để trống)", parseAreaInput({ teaching: null }).teaching === null && eq(parseAreaInput({ teaching: {} }).teaching, {}));
  const full = parseAreaInput({ teaching: { district: "  Cầu  Giấy ", mode: "both", credential: " ĐH Sư phạm Hà Nội · Cử nhân Toán ", price: 150000, showPrice: true } });
  check("đủ trường: làm sạch, giữ đúng giá trị", !full.error && eq(full.teaching, { district: "Cầu Giấy", mode: "both", credential: "ĐH Sư phạm Hà Nội · Cử nhân Toán", price: 150000, showPrice: true }), full);
  check("rỗng / null từng trường → bỏ trường đó", eq(parseAreaInput({ teaching: { district: "", mode: "", credential: "  ", price: null, showPrice: null } }).teaching, {}));
  check("khoá lạ (kể cả 'address', 'phone') bị từ chối, không ghi dở", !!parseAreaInput({ teaching: { address: "12 Ngõ 5" } }).error && !!parseAreaInput({ teaching: { phone: "0901" } }).error && !!parseAreaInput({ teaching: [] }).error && !!parseAreaInput({ teaching: "x" }).error);
  check("hình thức chỉ online | offline | both", TEACHING_MODES.every(m => !parseAreaInput({ teaching: { mode: m } }).error) && !!parseAreaInput({ teaching: { mode: "tai-nha" } }).error && !!parseAreaInput({ teaching: { mode: 1 } }).error);
  check("quận/huyện tối đa 60 ký tự; trường + bằng cấp tối đa 100 (đúng 100 vẫn nhận)", !parseAreaInput({ teaching: { district: "x".repeat(DISTRICT_MAX) } }).error && !!parseAreaInput({ teaching: { district: "x".repeat(DISTRICT_MAX + 1) } }).error
    && !parseAreaInput({ teaching: { credential: "x".repeat(CREDENTIAL_MAX) } }).error && !!parseAreaInput({ teaching: { credential: "x".repeat(CREDENTIAL_MAX + 1) } }).error);
  check("giá: số nguyên trong [10.000, 10.000.000]; hai mép nhận, ngoài mép / lẻ / chữ / NaN đều lỗi", !parseAreaInput({ teaching: { price: PRICE_MIN } }).error && !parseAreaInput({ teaching: { price: PRICE_MAX } }).error
    && [PRICE_MIN - 1, PRICE_MAX + 1, 150000.5, "150000", NaN, Infinity, -5].every(p => !!parseAreaInput({ teaching: { price: p } }).error));
  check("bật hiện giá mà chưa có giá → lỗi; tắt thì không lưu cờ; sai kiểu → lỗi", !!parseAreaInput({ teaching: { showPrice: true } }).error && !parseAreaInput({ teaching: { showPrice: false, price: 150000 } }).error
    && !("showPrice" in (parseAreaInput({ teaching: { showPrice: false, price: 150000 } }).teaching ?? {})) && !!parseAreaInput({ teaching: { showPrice: "true", price: 150000 } }).error);
  check("lỗi có câu tiếng Việt cụ thể", /tối đa 100/.test(err(parseAreaInput({ teaching: { credential: "x".repeat(101) } })) ?? "") && /10\.000đ đến 10\.000\.000đ/.test(err(parseAreaInput({ teaching: { price: 5 } })) ?? ""));

  section("Đọc từ DB (readTeaching): khoan dung, không ném lỗi");
  check("không phải đối tượng → undefined (= chưa lưu mục này)", [null, undefined, "x", 5, [], true].every(v => readTeaching(v) === undefined));
  check("đối tượng rỗng → {} (đã lưu nhưng trống)", eq(readTeaching({}), {}));
  check("bỏ phần hỏng, giữ phần tốt; giá ngoài khoảng / lẻ bị bỏ; cờ giá bật mà không có giá bị bỏ", eq(readTeaching({ district: "Cầu Giấy", mode: "zzz", credential: 7, price: 5, showPrice: true, evil: 1 }), { district: "Cầu Giấy" })
    && eq(readTeaching({ price: 150000, showPrice: true }), { price: 150000, showPrice: true }));

  section("Phần được CÔNG KHAI (publicArea)");
  const t: TutorTeaching = { district: "Cầu Giấy", mode: "both", credential: "ĐH Sư phạm Hà Nội", price: 150000, showPrice: false };
  check("chưa lưu mục này → null: users.city cũ (từ lúc form đăng ký còn ô Tỉnh/Thành) KHÔNG tự lộ ra", publicArea("Hà Nội", undefined) === null && publicArea("TP.HCM", undefined) === null);
  check("giá TẮT thì không ra công khai dù vẫn lưu; BẬT thì ra", publicArea("Hà Nội", t)?.price === null && publicArea("Hà Nội", { ...t, showPrice: true })?.price === 150000);
  const a = publicArea("tp.hcm", { ...t, showPrice: true }) as PublicArea;
  check("chỉ có đúng năm trường (không địa chỉ nhà, không số điện thoại); thành phố được chuẩn hoá", eq(Object.keys(a).sort(), ["city", "credential", "district", "mode", "price"]) && a.city === "TP. Hồ Chí Minh");
  check("mục trống {} → có đối tượng nhưng mọi trường null (hasPublicArea = false: không vẽ khung rỗng)", eq(publicArea(null, {}), { city: null, district: null, mode: null, credential: null, price: null }) && !hasPublicArea(publicArea(null, {})) && !hasPublicArea(null) && hasPublicArea(a));
  check("areaLine: 'Hà Nội · Cầu Giấy', chỉ tỉnh hoặc chỉ quận vẫn đẹp", areaLine({ city: "Hà Nội", district: "Cầu Giấy" }) === "Hà Nội · Cầu Giấy" && areaLine({ city: "Hà Nội", district: null }) === "Hà Nội" && areaLine({ city: null, district: "Cầu Giấy" }) === "Cầu Giấy");
  check("priceText và nhãn hình thức", priceText(150000) === "150.000đ / buổi" && priceText(1200000) === "1.200.000đ / buổi" && MODE_LABEL.offline === "Dạy trực tiếp" && MODE_LABEL.both === "Online + dạy trực tiếp");

  section("Lọc danh sách gia sư");
  const A: PublicArea = { city: "Hà Nội", district: null, mode: "online", credential: null, price: null };
  const B: PublicArea = { city: "TP. Hồ Chí Minh", district: null, mode: "offline", credential: null, price: null };
  const C: PublicArea = { city: "Hà Nội", district: null, mode: "both", credential: null, price: null };
  const E: PublicArea = { city: null, district: "Cầu Giấy", mode: null, credential: null, price: null };
  check("không lọc → khớp mọi người, kể cả gia sư chưa khai khu vực", [A, B, C, E, null].every(x => matchesArea(x, {})) && matchesArea(null, { city: "", mode: null }));
  check("lọc tỉnh: khớp bỏ dấu và các cách viết; gia sư chưa khai KHÔNG khớp (không đoán)", matchesArea(A, { city: "ha noi" }) && matchesArea(A, { city: "Hà Nội" }) && !matchesArea(B, { city: "Hà Nội" }) && matchesArea(B, { city: "tp.hcm" }) && matchesArea(B, { city: "Sài Gòn" }) && !matchesArea(null, { city: "Hà Nội" }) && !matchesArea(E, { city: "Hà Nội" }));
  check("lọc hình thức: online khớp online + cả hai; offline khớp offline + cả hai; chưa khai hình thức không khớp", matchesArea(A, { mode: "online" }) && matchesArea(C, { mode: "online" }) && !matchesArea(B, { mode: "online" }) && matchesArea(B, { mode: "offline" }) && matchesArea(C, { mode: "offline" }) && !matchesArea(A, { mode: "offline" }) && !matchesArea(E, { mode: "online" }));
  check("lọc cả hai điều kiện: phải thoả CẢ hai", matchesArea(C, { city: "Hà Nội", mode: "offline" }) && !matchesArea(A, { city: "Hà Nội", mode: "offline" }) && !matchesArea(B, { city: "Hà Nội", mode: "offline" }));
  check("parseModeFilter chỉ nhận online | offline", parseModeFilter("online") === "online" && parseModeFilter("offline") === "offline" && parseModeFilter("both") === null && parseModeFilter("") === null && parseModeFilter(null) === null);
  check("facets: không trùng (TP.HCM = Hồ Chí Minh), sắp theo tên tiếng Việt, bỏ người chưa khai", eq(cityFacets([A, B, C, null, E, { ...B, city: "TP. Hồ Chí Minh" }, { ...A, city: "Đà Nẵng" }]), ["Đà Nẵng", "Hà Nội", "TP. Hồ Chí Minh"]), cityFacets([A, B, C]));

  check("facets: tỉnh ngoài danh sách bí danh viết khác hoa / dấu (Bắc Ninh, bắc ninh, Bac Ninh) chỉ ra MỘT mục", cityFacets([{ ...A, city: "Bắc Ninh" }, { ...A, city: "bắc ninh" }, { ...A, city: "Bac Ninh" }]).length === 1);

  section("Nối vào preferences: đổi giao diện không làm mất khu vực");
  const raw = { theme: "navy", mode: "sang", teaching: { district: "Cầu Giấy", mode: "both", showPrice: true, price: 150000, evil: 1 } };
  const cur = readPreferences(raw);
  check("readPreferences GIỮ teaching hợp lệ, bỏ khoá lạ trong đó", eq(cur.teaching, { district: "Cầu Giấy", mode: "both", price: 150000, showPrice: true }), cur.teaching);
  check("readPreferences không tự bịa teaching khi DB không có", !("teaching" in readPreferences({ theme: "navy" })) && !("teaching" in readPreferences({ teaching: "x" })));
  const r1 = applyPreferencesPatch(cur, { mode: "toi" });
  check("đổi chế độ sáng/tối: teaching còn nguyên", r1.ok && eq(r1.value.teaching, cur.teaching) && r1.value.mode === "toi", r1);
  const r2 = applyPreferencesPatch(cur, { modules: ["lop"], reminders: { parent: false } });
  check("đổi module / nhắc lịch: teaching còn nguyên", r2.ok && eq(r2.value.teaching, cur.teaching), r2);
  const r3 = applyPreferencesPatch(cur, { teaching: { district: "Quận 7" } });
  check("API giao diện KHÔNG được ghi teaching (chỉ qua API hồ sơ gia sư có kiểm dữ liệu riêng)", !r3.ok && /teaching/.test((r3 as { error: string }).error), r3);
  const r4 = applyPreferencesPatch(cur, { teaching: null });
  check("cũng không xoá được qua API giao diện", !r4.ok);
  check("khoá khoá-giao-dịch dùng chung theo từng người", prefsLockKey("u1") === "prefs:u1" && prefsLockKey("u1") !== prefsLockKey("u2"));

  section("parseTutorProfileInput nhận city và teaching");
  const p = parseTutorProfileInput({ bio: "x", subjects: ["Toán"], city: "ha noi", teaching: { mode: "online" } });
  check("chuyển tiếp city (chuẩn hoá) và teaching, vẫn xử lý bio / subjects như cũ", !p.error && p.city === "Hà Nội" && eq(p.teaching, { mode: "online" }) && p.bio === "x" && eq(p.subjects, ["Toán"]), p);
  check("thiếu city / teaching → không có khoá đó (PUT giữ nguyên, không ghi đè)", (() => { const q = parseTutorProfileInput({ bio: "x" }); return !("city" in q) && !("teaching" in q); })());
  check("teaching sai → trả lỗi, không ghi dở", !!parseTutorProfileInput({ bio: "x", teaching: { mode: "zzz" } }).error);

  section("Quét tĩnh: API, hồ sơ, đăng ký, giao diện");
  const root = join(__dirname, "..", "..");
  const read = (f: string) => readFileSync(join(root, f), "utf8");
  const tp = read("src/app/api/users/me/tutor-profile/route.ts"), prefsApi = read("src/app/api/users/me/preferences/route.ts");
  const pubId = read("src/app/api/tutors/[id]/route.ts"), pubList = read("src/app/api/tutors/route.ts");
  const form = read("src/app/lop-cua-toi/(tutor)/ho-so/TutorProfileForm.tsx"), reg = read("src/app/(guest)/dang-ky/page.tsx");
  const head = read("src/components/tutor/TutorProfileHeader.tsx"), card = read("src/components/tutor/TutorCard.tsx"), listPage = read("src/app/(guest)/giang-vien/page.tsx");
  check("API hồ sơ gia sư: ghi preferences trong giao dịch, cùng khoá khoá với API giao diện", /\$transaction/.test(tp) && /prefsLockKey\(auth\.userId\)/.test(tp) && /prefsLockKey\(auth\.userId\)/.test(prefsApi) && !/`prefs:\$\{/.test(prefsApi));
  check("API hồ sơ gia sư: không đụng teaching khi thiếu khoá (chỉ ghi khi parsed.teaching !== undefined)", /parsed\.teaching !== undefined/.test(tp) && /parsed\.city !== undefined/.test(tp));
  check("API công khai (chi tiết + danh sách) chỉ ra khu vực qua publicArea, không tự lấy users.city / preferences.teaching", /publicArea\(t\.city, readPreferences\(t\.preferences\)\.teaching\)/.test(pubId) && /publicArea\(t\.city, readPreferences\(t\.preferences\)\.teaching\)/.test(pubList) && !/teaching\.price|\.showPrice/.test(pubId + pubList));
  check("danh sách: lọc city / mode bằng matchesArea và trả facets.cities", /matchesArea\(/.test(pubList) && /parseModeFilter\(/.test(pubList) && /facets/.test(pubList) && /cityFacets\(/.test(pubList));
  check("form ĐĂNG KÝ không có ô khu vực / hình thức (giữ form ngắn — Thọ chốt Q4)", !/Quận\/Huyện|teaching|Hình thức dạy|Tỉnh\/Thành/.test(reg));
  check("form hồ sơ: có đủ năm mục, nói rõ 'tự khai', 'không bao giờ hiện địa chỉ nhà', giá mặc định tắt, không có ô địa chỉ", /Quận\/Huyện/.test(form) && /Hình thức dạy/.test(form) && /tự khai/i.test(form) && /không bao giờ hiện địa chỉ nhà/.test(form) && /useState\(initialTeaching\?\.showPrice === true\)/.test(form) && !/htmlFor="[^"]*(dia-chi|address)/i.test(form));
  check("hiển thị công khai (đầu hồ sơ + thẻ): ghi '(tự khai)' cho trường/bằng cấp, giá kèm 'giá tham khảo', dùng PublicArea", /\(tự khai\)/.test(head) && /giá tham khảo/.test(head) && /hasPublicArea/.test(head) && /hasPublicArea/.test(card));
  check("trang danh sách: có lọc Tỉnh/Thành + Hình thức, gửi city / mode cho API", /id="tutor-city"/.test(listPage) && /id="tutor-mode"/.test(listPage) && /qs\.set\("city", city\)/.test(listPage) && /qs\.set\("mode", mode\)/.test(listPage));
  check("không còn ký tự vô hình trong mã nguồn mới", ![read("src/lib/tutorArea.ts"), form, head, card].some(s => /[\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/.test(s)));

  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
