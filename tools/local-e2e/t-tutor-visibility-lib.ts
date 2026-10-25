// NC2-022 — công tắc Hiện / Ẩn hồ sơ công khai: đọc / kiểm / ghi khoá `User.preferences.profile.hidden` (src/lib/tutorVisibility.ts) + nối vào
// preferences / hồ sơ gia sư + quét tĩnh các nơi công khai. Không cần DB hay máy chủ.
// Chạy: DATABASE_URL=postgresql://x:x@localhost/x npx tsx tools/local-e2e/t-tutor-visibility-lib.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { applyProfileHidden, isProfileHidden, parseProfileInput, readProfilePrefs } from "@/lib/tutorVisibility";
import { applyPreferencesPatch, readPreferences } from "@/lib/userPreferences";
import { parseTutorProfileInput } from "@/lib/tutorProfile";
import { check, section, done } from "./h";

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  section("Đọc từ DB (readProfilePrefs): khoan dung, mặc định HIỆN");
  check("không phải đối tượng → undefined (= hiện)", [null, undefined, "x", 5, [], true].every(v => readProfilePrefs(v) === undefined));
  check("{} / hidden: false → undefined (= hiện)", readProfilePrefs({}) === undefined && readProfilePrefs({ hidden: false }) === undefined);
  check("chỉ hidden === true (đúng kiểu) mới là ẨN; \"true\", 1, \"yes\", null KHÔNG làm ẩn (không ẩn nhầm vì dữ liệu hỏng)", readProfilePrefs({ hidden: true })?.hidden === true
    && ["true", 1, "yes", null, {}, []].every(v => readProfilePrefs({ hidden: v }) === undefined));
  check("khoá lạ bị bỏ, chỉ giữ hidden", eq(readProfilePrefs({ hidden: true, evil: 1 }), { hidden: true }));
  check("isProfileHidden: mặc định (không có khoá) = hiện", !isProfileHidden({}) && !isProfileHidden(null) && !isProfileHidden(undefined) && !isProfileHidden(readPreferences({})) && isProfileHidden(readPreferences({ profile: { hidden: true } })));

  section("Kiểm dữ liệu gia sư gửi lên (parseProfileInput)");
  check("không gửi profile → không đổi gì", eq(parseProfileInput(undefined), {}) && eq(parseProfileInput({}), {}));
  check("hidden true / false → nhận đúng giá trị", parseProfileInput({ hidden: true }).hidden === true && parseProfileInput({ hidden: false }).hidden === false);
  check("sai kiểu bị từ chối (\"true\", 1, null, 0), không ghi dở", ["true", 1, 0, null, "", {}].every(v => !!parseProfileInput({ hidden: v }).error));
  check("profile không phải đối tượng / mảng / null → lỗi", [null, "x", 5, [], true].every(v => !!parseProfileInput(v).error));
  check("khoá lạ trong profile bị từ chối (kể cả 'isPublic', 'hide')", !!parseProfileInput({ hidden: true, isPublic: false }).error && !!parseProfileInput({ hide: true }).error);
  check("lỗi có câu tiếng Việt", /đúng-sai/.test(parseProfileInput({ hidden: "x" }).error ?? "") && /profile/.test(parseProfileInput("x").error ?? ""));

  section("Ghi khoá (applyProfileHidden): không làm mất khoá khác");
  const base = readPreferences({ theme: "navy", mode: "sang", modules: ["lop"], teaching: { district: "Cầu Giấy", mode: "both" }, connections: { showZalo: true, messenger: "co.lan" }, push: { types: { parent_reported: true } } });
  const hid = applyProfileHidden(base, true);
  check("ẨN: ghi profile.hidden = true, MỌI khoá khác còn nguyên", hid.profile?.hidden === true && eq({ ...hid, profile: undefined }, { ...base, profile: undefined }), hid);
  check("không đổi bản gốc (hàm không có tác dụng phụ)", !("profile" in base));
  const shown = applyProfileHidden(hid, false);
  check("HIỆN lại: xoá hẳn khoá profile (về đúng như chưa từng bấm), khoá khác còn nguyên", !("profile" in shown) && eq(shown, base), shown);
  check("hidden vắng (undefined) → giữ nguyên, cả khi đang ẩn", applyProfileHidden(hid, undefined) === hid && applyProfileHidden(base, undefined) === base);
  check("ẨN hai lần liên tiếp vẫn một giá trị (lặp lại không gây hại)", eq(applyProfileHidden(hid, true), hid));

  section("Nối vào preferences: đổi giao diện / khu vực / thông báo không làm mất công tắc");
  const cur = readPreferences({ theme: "navy", profile: { hidden: true } });
  check("readPreferences GIỮ profile.hidden", cur.profile?.hidden === true);
  check("readPreferences không tự bịa profile khi DB không có / hỏng", !("profile" in readPreferences({ theme: "navy" })) && !("profile" in readPreferences({ profile: "x" })) && !("profile" in readPreferences({ profile: { hidden: "true" } })));
  const r1 = applyPreferencesPatch(cur, { mode: "toi" });
  check("đổi chế độ sáng/tối: profile.hidden còn nguyên", r1.ok && r1.value.profile?.hidden === true && r1.value.mode === "toi", r1);
  const r2 = applyPreferencesPatch(cur, { modules: ["lop"], reminders: { parent: false }, connections: { showZalo: true } });
  check("đổi module / nhắc lịch / kết nối: profile.hidden còn nguyên", r2.ok && r2.value.profile?.hidden === true, r2);
  const r3 = applyPreferencesPatch(cur, { profile: { hidden: false } });
  check("API giao diện KHÔNG ghi được profile (chỉ qua API hồ sơ gia sư có kiểm dữ liệu riêng)", !r3.ok && /profile/.test((r3 as { error: string }).error), r3);
  check("cũng không xoá được qua API giao diện", !applyPreferencesPatch(cur, { profile: null }).ok);

  section("parseTutorProfileInput nhận profile");
  const p = parseTutorProfileInput({ bio: "x", profile: { hidden: true } });
  check("chuyển tiếp hidden, vẫn xử lý bio như cũ", !p.error && p.hidden === true && p.bio === "x", p);
  check("thiếu profile → không có khoá hidden (PUT giữ nguyên, không ghi đè)", (() => { const q = parseTutorProfileInput({ bio: "x" }); return !("hidden" in q); })());
  check("profile sai → trả lỗi, không ghi dở", !!parseTutorProfileInput({ bio: "x", profile: { hidden: "true" } }).error && !!parseTutorProfileInput({ profile: { x: 1 } }).error);
  check("hidden: false được chuyển tiếp (để XOÁ khoá), không bị nuốt như 'không gửi'", parseTutorProfileInput({ profile: { hidden: false } }).hidden === false);

  section("Quét tĩnh: mọi lối công khai đều tôn trọng công tắc");
  const root = join(__dirname, "..", "..");
  const read = (f: string) => readFileSync(join(root, f), "utf8");
  const tp = read("src/app/api/users/me/tutor-profile/route.ts"), pubId = read("src/app/api/tutors/[id]/route.ts"), pubList = read("src/app/api/tutors/route.ts");
  const visit = read("src/app/api/tutors/[id]/visit/route.ts"), draft = read("src/app/api/tutor/post-draft/route.ts"), home = read("src/app/page.tsx");
  const mentor = read("src/app/(guest)/mentor/[id]/page.tsx"), toggle = read("src/app/lop-cua-toi/(tutor)/ho-so/ProfileVisibilityToggle.tsx"), hoso = read("src/app/lop-cua-toi/(tutor)/ho-so/page.tsx");
  const prev = read("src/components/tutor/PublicProfilePreview.tsx"), baidang = read("src/app/lop-cua-toi/(tutor)/bai-dang/BaiDangClient.tsx"), prefsApi = read("src/app/api/users/me/preferences/route.ts");
  check("API hồ sơ gia sư: ghi profile trong CÙNG giao dịch + khoá prefsLockKey với teaching", /\$transaction/.test(tp) && /parsed\.hidden !== undefined/.test(tp) && /applyProfileHidden\(prefs, parsed\.hidden\)/.test(tp) && /prefsLockKey\(auth\.userId\)/.test(tp));
  check("API hồ sơ gia sư: GET trả profile.hidden để giao diện điền sẵn", /isProfileHidden\(readPreferences\(u\.preferences\)\)/.test(tp));
  check("API giao diện (preferences) không có đường ghi profile", !/profile/.test(prefsApi) || /applyPreferencesPatch/.test(prefsApi));
  check("GET /api/tutors: bỏ gia sư ẩn TRƯỚC khi tính area / facets", /isProfileHidden\(readPreferences\(t\.preferences\)\)/.test(pubList) && pubList.indexOf("isProfileHidden(") < pubList.indexOf("const areaOf"));
  check("GET /api/tutors/[id]: ẩn → 404; ngoại lệ DUY NHẤT là chính chủ xem trước (?preview=1 + phiên đúng chủ)", /isProfileHidden\(readPreferences\(t\.preferences\)\)/.test(pubId) && /preview"\) === "1"/.test(pubId) && /\.userId === id/.test(pubId) && /status: 404/.test(pubId));
  check("POST /api/tutors/[id]/visit: hồ sơ ẩn không ghi lượt (404)", /isProfileHidden\(/.test(visit));
  check("trang /mentor/[id] và thẻ og lấy dữ liệu qua API công khai KHÔNG kèm cookie (nên ẩn = 404 cho cả thẻ og)", /fetch\(`\$\{proto\}:\/\/\$\{host\}\/api\/tutors\/\$\{id\}`, \{ cache: "no-store" \}\)/.test(mentor) && !/preview=1/.test(mentor) && !/cookie/i.test(mentor.split("fetchTutor")[1]?.slice(0, 600) ?? ""));
  check("bài đăng tìm học sinh: cảnh báo 'đang ẩn nên link chưa mở được'", /profileHidden/.test(draft) && /đang ẩn nên link/.test(baidang));
  check("số 'Gia sư' ở trang chủ không đếm gia sư ẩn", /isProfileHidden/.test(home));
  check("công tắc: PUT profile.hidden, trạng thái 'Đang lưu…', lỗi + 'Thử lại', role=switch, vùng bấm ≥ 44px", /profile: \{ hidden: wantHidden \}/.test(toggle) && /Đang lưu…/.test(toggle) && /Thử lại/.test(toggle) && /role="switch"/.test(toggle) && /h-11/.test(toggle));
  check("chữ giải thích đúng giọng đã duyệt", /Phụ huynh có thể tìm thấy và xem hồ sơ của bạn/.test(toggle) && /Hồ sơ không hiện trên trang Gia sư và link cũ báo không tìm thấy; lớp và học sinh của bạn không bị ảnh hưởng/.test(toggle));
  check("Q11: không có điều kiện nào để bật Hiện (công tắc không đọc trường/bằng cấp, không chặn)", !/credential|teaching|disabled=\{!/.test(toggle));
  check("trang Hồ sơ: có công tắc, và xem trước ghi 'Hồ sơ đang ẩn'", /ProfileVisibilityToggle/.test(hoso) && /Hồ sơ đang ẩn/.test(prev) && /preview=1/.test(prev));
  check("không có màu mã hex trong công tắc", !/#[0-9a-fA-F]{3,8}\b/.test(toggle));

  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
