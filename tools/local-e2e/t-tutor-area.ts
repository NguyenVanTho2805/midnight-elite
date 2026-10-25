// ĐX-06 (NC1-074) — khu vực và hình thức dạy với dữ liệu thật: quyền, kiểm dữ liệu, lưu / đọc, CÔNG KHAI (opt-in, giá chỉ khi bật),
// không mất khi đổi giao diện (kể cả hai yêu cầu đồng thời), lọc theo tỉnh / hình thức.
// Cần Postgres + Next dev (xem README). Phần thuần đã có ở t-tutor-area-lib.ts.
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done, type TUser } from "./h";
import { prisma } from "@/lib/prisma";

const PROFILE = "/api/users/me/tutor-profile";
const PREFS = "/api/users/me/preferences";
const put = (as: TUser | undefined, body: unknown, path = PROFILE) => api("PUT", path, { as, body });
const area = async (t: TUser) => (await api("GET", `/api/tutors/${t.id}`)).json?.tutor?.area;
const dbTeaching = async (t: TUser) => ((await prisma.user.findUnique({ where: { id: t.id }, select: { preferences: true } }))?.preferences as any)?.teaching;
const names = (j: any) => (j.items as any[]).map(x => x.name).sort().join(" | ");

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), LA = await mkTutor("Lọc A Hà Nội Online"), LB = await mkTutor("Lọc B HCM Trực Tiếp"), LC = await mkTutor("Lọc C Hà Nội Cả Hai"), D = await mkTutor("Dũng Chưa Khai");
  const S = await mkUser({ name: "Học sinh" });
  await prisma.user.update({ where: { id: D.id }, data: { city: "Hà Nội" } }); // users.city cũ (từ lúc form đăng ký còn ô Tỉnh/Thành), gia sư chưa lưu mục khu vực

  section("Quyền");
  check("chưa đăng nhập → 401", (await put(undefined, { city: "Hà Nội" })).status === 401);
  check("học sinh → 403", (await put(S, { city: "Hà Nội" })).status === 403);
  check("gia sư → 200", (await put(T, { city: "Hà Nội" })).status === 200);

  section("Kiểm dữ liệu (400, không ghi dở)");
  const before = await dbTeaching(T);
  const bad = async (teaching: unknown) => (await put(T, { teaching })).status;
  check("hình thức lạ / quá dài / khoá lạ (address) / bật giá không có giá / giá ngoài khoảng / giá lẻ → 400",
    (await bad({ mode: "tai-nha" })) === 400 && (await bad({ credential: "x".repeat(101) })) === 400 && (await bad({ address: "12 Ngõ 5" })) === 400
    && (await bad({ showPrice: true })) === 400 && (await bad({ price: 5000 })) === 400 && (await bad({ price: 99999999 })) === 400 && (await bad({ price: 150000.5 })) === 400);
  check("city sai kiểu / quá dài → 400", (await put(T, { city: 5 })).status === 400 && (await put(T, { city: "x".repeat(61) })).status === 400);
  check("sau các lần lỗi, dữ liệu đã lưu KHÔNG đổi", JSON.stringify(await dbTeaching(T)) === JSON.stringify(before));

  section("Lưu và đọc lại");
  const saved = await put(T, { city: "tp.hcm", teaching: { district: "  Quận  7 ", mode: "offline", credential: "ĐH Bách khoa · Kỹ sư", price: 150000, showPrice: false } });
  check("200; Tỉnh/Thành được thống nhất 'TP. Hồ Chí Minh'; quận/huyện làm sạch", saved.status === 200 && saved.json.city === "TP. Hồ Chí Minh" && saved.json.teaching.district === "Quận 7", saved.json);
  const mine = await api("GET", PROFILE, { as: T });
  check("GET của chính gia sư trả lại ĐỦ thứ đã lưu (kể cả giá đang tắt) để form điền sẵn", mine.json.city === "TP. Hồ Chí Minh" && mine.json.teaching.price === 150000 && mine.json.teaching.mode === "offline" && mine.json.teaching.credential === "ĐH Bách khoa · Kỹ sư", mine.json);
  const row = await prisma.user.findUnique({ where: { id: T.id }, select: { city: true, preferences: true } });
  check("DB: users.city + preferences.teaching (không thêm cột mới)", row?.city === "TP. Hồ Chí Minh" && (row?.preferences as any)?.teaching?.district === "Quận 7");

  section("Công khai: opt-in, chỉ quận/huyện, giá chỉ khi gia sư bật");
  const pub = await area(T);
  check("hồ sơ công khai có tỉnh, quận, hình thức, trường + bằng cấp", pub?.city === "TP. Hồ Chí Minh" && pub?.district === "Quận 7" && pub?.mode === "offline" && pub?.credential === "ĐH Bách khoa · Kỹ sư", pub);
  check("giá đang TẮT → price = null dù DB vẫn nhớ 150000", pub?.price === null && (await dbTeaching(T)).price === 150000);
  check("area chỉ có đúng năm khoá (không địa chỉ nhà, không số điện thoại)", JSON.stringify(Object.keys(pub).sort()) === JSON.stringify(["city", "credential", "district", "mode", "price"]));
  await put(T, { teaching: { district: "Quận 7", mode: "offline", credential: "ĐH Bách khoa · Kỹ sư", price: 150000, showPrice: true } });
  check("bật giá → hồ sơ công khai hiện 150000", (await area(T))?.price === 150000);
  check("gia sư CHƯA lưu mục khu vực: area = null, KHÔNG lộ users.city cũ ('Hà Nội')", (await area(D)) === null && !JSON.stringify((await api("GET", `/api/tutors/${D.id}`)).json).includes("Hà Nội"));

  section("Đổi giao diện không làm mất khu vực");
  check("đổi chế độ sáng/tối ở API giao diện → 200, teaching còn nguyên", (await put(T, { mode: "toi" }, PREFS)).status === 200 && (await dbTeaching(T))?.district === "Quận 7");
  check("lưu hồ sơ chỉ đổi giới thiệu (không gửi teaching) → khu vực giữ nguyên", (await put(T, { bio: "Giới thiệu mới" })).status === 200 && (await dbTeaching(T))?.district === "Quận 7");
  check("API giao diện KHÔNG ghi được teaching (400)", (await put(T, { teaching: { district: "Quận 1" } }, PREFS)).status === 400 && (await dbTeaching(T))?.district === "Quận 7");
  let lost = 0;
  for (let i = 0; i < 8; i++) {
    const wantMode = i % 2 ? "toi" : "sang";
    await Promise.all([put(T, { teaching: { district: `Quận ${i + 1}`, mode: "offline" } }), put(T, { mode: wantMode }, PREFS)]);
    const p: any = (await prisma.user.findUnique({ where: { id: T.id }, select: { preferences: true } }))?.preferences;
    if (p?.teaching?.district !== `Quận ${i + 1}` || p?.mode !== wantMode) lost++;
  }
  check("hai yêu cầu ĐỒNG THỜI (lưu khu vực + đổi sáng/tối) × 8 lần: không lần nào ghi đè mất phần của bên kia", lost === 0, lost);
  check("gỡ khu vực: teaching null + city null → công khai không còn, DB sạch", (await put(T, { city: null, teaching: null })).status === 200 && (await area(T)) === null && (await dbTeaching(T)) === undefined
    && (await prisma.user.findUnique({ where: { id: T.id }, select: { city: true } }))?.city === null);

  section("Lọc /api/tutors theo tỉnh và hình thức");
  await put(LA, { city: "ha noi", teaching: { mode: "online" } });
  await put(LB, { city: "TP.HCM", teaching: { mode: "offline", district: "Quận 3" } });
  await put(LC, { city: "Hà Nội", teaching: { mode: "both", district: "Cầu Giấy" } });
  const all = (await api("GET", "/api/tutors")).json;
  const NA = "Lọc A Hà Nội Online", NB = "Lọc B HCM Trực Tiếp", NC = "Lọc C Hà Nội Cả Hai", ND = "Dũng Chưa Khai";
  check("không lọc: mọi gia sư hiện, kể cả người chưa khai khu vực", all.items.some((x: any) => x.name === ND) && [NA, NB, NC].every(n => all.items.some((x: any) => x.name === n)));
  check("mỗi mục có area (người chưa khai = null); không lộ users.city cũ của người chưa khai", all.items.find((x: any) => x.name === ND).area === null && all.items.find((x: any) => x.name === NA).area.city === "Hà Nội");
  const q = async (qs: string) => (await api("GET", `/api/tutors?${qs}`)).json;
  check("?city=Hà Nội → A và C (viết bỏ dấu 'ha noi' cho cùng kết quả)", names(await q("city=H%C3%A0%20N%E1%BB%99i")) === `${NA} | ${NC}` && names(await q("city=ha%20noi")) === `${NA} | ${NC}`, names(await q("city=ha%20noi")));
  check("?city=hcm / Sài Gòn → B", names(await q("city=hcm")) === NB && names(await q("city=S%C3%A0i%20G%C3%B2n")) === NB);
  check("?mode=online → A và C (C dạy cả hai); ?mode=offline → B và C", names(await q("mode=online")) === `${NA} | ${NC}` && names(await q("mode=offline")) === `${NB} | ${NC}`);
  check("?city=Hà Nội&mode=offline → chỉ C", names(await q("city=ha%20noi&mode=offline")) === NC);
  check("người chưa khai khu vực KHÔNG xuất hiện khi đang lọc (không đoán), dù users.city cũ là Hà Nội", !(await q("city=ha%20noi")).items.some((x: any) => x.name === ND));
  check("mode lạ (both / zzz) bị bỏ qua, không lọc", (await q("mode=both")).items.length === all.items.length && (await q("mode=zzz")).items.length === all.items.length);
  const fa = (await q("")).facets, fb = (await q("city=hcm&mode=offline")).facets;
  check("facets.cities = các tỉnh có gia sư, không trùng, sắp theo tên; KHÔNG co lại khi đang lọc", JSON.stringify(fa.cities) === JSON.stringify(["Hà Nội", "TP. Hồ Chí Minh"]) && JSON.stringify(fb.cities) === JSON.stringify(fa.cities), [fa, fb]);
  check("lọc không ra ai → items rỗng nhưng facets vẫn có", (await q("city=Khong%20Co%20Tinh")).items.length === 0 && (await q("city=Khong%20Co%20Tinh")).facets.cities.length === 2);

  // ───────── NC2-022: công tắc Hiện / Ẩn hồ sơ công khai ─────────
  section("NC2-022 Hiện / Ẩn hồ sơ: quyền và kiểm dữ liệu");
  const H = await mkTutor("Thầy Ẩn Thử"), H2 = await mkTutor("Cô Hiện Thử");
  await put(H, { teaching: { district: "Quận 1", mode: "online", credential: "ĐH Sư phạm" } });
  await put(H2, { teaching: { district: "Quận 2", mode: "online" } });
  const hc = await mkCourse(H.id, { name: "Lớp thử của thầy ẩn" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: hc.id, status: "active" } });
  const dbPrefs = async (t: TUser) => (await prisma.user.findUnique({ where: { id: t.id }, select: { preferences: true } }))?.preferences as any;
  const pubStatus = async (t: TUser, qs = "") => (await api("GET", `/api/tutors/${t.id}${qs}`)).status;
  const inList = async (t: TUser, qs = "") => ((await api("GET", `/api/tutors${qs}`)).json.items as any[]).some(x => x.id === t.id);
  check("mặc định HIỆN: GET hồ sơ của mình → profile.hidden = false; công khai 200 và có trong danh sách", (await api("GET", PROFILE, { as: H })).json.profile?.hidden === false && (await pubStatus(H)) === 200 && (await inList(H)));
  check("chưa đăng nhập → 401; học sinh → 403 (không ghi được)", (await put(undefined, { profile: { hidden: true } })).status === 401 && (await put(S, { profile: { hidden: true } })).status === 403);
  check("gia sư KHÁC không ghi được vào hồ sơ của H (PUT luôn ghi vào chính người gọi)", (await put(H2, { profile: { hidden: true } })).status === 200 && (await dbPrefs(H))?.profile === undefined);
  await put(H2, { profile: { hidden: false } });
  const badH = async (profile: unknown) => (await put(H, { profile })).status;
  check("sai kiểu / khoá lạ → 400 và KHÔNG ghi dở", (await badH({ hidden: "true" })) === 400 && (await badH({ hidden: 1 })) === 400 && (await badH({ hidden: null })) === 400
    && (await badH({ isPublic: false })) === 400 && (await badH("x")) === 400 && (await badH(null)) === 400 && (await badH([])) === 400 && (await dbPrefs(H))?.profile === undefined);
  check("API giao diện KHÔNG ghi được profile (400)", (await put(H, { profile: { hidden: true } }, PREFS)).status === 400 && (await dbPrefs(H))?.profile === undefined);
  check("PUT không gửi profile (chỉ đổi giới thiệu) → công tắc giữ nguyên", (await put(H, { bio: "bio" })).status === 200 && (await api("GET", PROFILE, { as: H })).json.profile?.hidden === false);

  section("NC2-022 ẨN: không ai thấy nữa");
  const vis0 = (await api("GET", "/api/tutors")).json;
  const res = await put(H, { profile: { hidden: true } });
  check("200, GET của chính gia sư trả profile.hidden = true; DB ghi preferences.profile.hidden (không thêm cột)", res.status === 200 && res.json.profile?.hidden === true && (await dbPrefs(H))?.profile?.hidden === true, res.json);
  check("khu vực đã khai KHÔNG mất khi ẩn", (await dbPrefs(H))?.teaching?.district === "Quận 1");
  check("GET /api/tutors/[id] → 404 (người ngoài)", (await pubStatus(H)) === 404);
  check("?preview=1 không mở khoá cho người ngoài / gia sư khác / học sinh", (await pubStatus(H, "?preview=1")) === 404
    && (await api("GET", `/api/tutors/${H.id}?preview=1`, { as: H2 })).status === 404 && (await api("GET", `/api/tutors/${H.id}?preview=1`, { as: S })).status === 404);
  check("CHÍNH gia sư xem trước (?preview=1 + phiên) → 200, có cờ profileHidden; không có ?preview=1 vẫn 404", (await api("GET", `/api/tutors/${H.id}?preview=1`, { as: H })).status === 200 && (await api("GET", `/api/tutors/${H.id}?preview=1`, { as: H })).json.profileHidden === true && (await api("GET", `/api/tutors/${H.id}`, { as: H })).status === 404);
  check("GET /api/tutors bỏ gia sư ẩn; người khác vẫn còn", !(await inList(H)) && (await inList(H2)));
  check("lọc theo môn / tỉnh / hình thức cũng không lộ", !(await inList(H, "?mode=online")) && (await inList(H2, "?mode=online")));
  const visHidden = (await api("GET", "/api/tutors")).json;
  check("số lượng trong danh sách giảm đúng 1", vis0.items.length - visHidden.items.length === 1, [vis0.items.length, visHidden.items.length]);
  // Facets không đếm gia sư ẩn: cho H một tỉnh DUY NHẤT rồi ẩn.
  await put(H, { city: "Thành phố Chỉ Có Thầy Ẩn", profile: { hidden: false } });
  const fOn = (await api("GET", "/api/tutors")).json.facets.cities as string[];
  await put(H, { profile: { hidden: true } });
  const fOff = (await api("GET", "/api/tutors")).json.facets.cities as string[];
  check("facets.cities: tỉnh của người ẩn có khi hiện, MẤT khi ẩn", fOn.includes("Thành phố Chỉ Có Thầy Ẩn") && !fOff.includes("Thành phố Chỉ Có Thầy Ẩn"), [fOn, fOff]);
  check("ghi lượt xem hồ sơ ẩn bị từ chối (404, không đếm)", (await api("POST", `/api/tutors/${H.id}/visit`, { body: { kind: "open", vk: "abcdefgh1234" } })).status === 404
    && (await prisma.profileVisit.count({ where: { tutorId: H.id } })) === 0);
  const draft = (await api("GET", "/api/tutor/post-draft", { as: H })).json;
  check("bài đăng tìm học sinh: profilePublic = false, profileHidden = true", draft.profilePublic === false && draft.profileHidden === true, draft);
  check("lớp và học sinh của gia sư không bị ảnh hưởng (lớp và đăng ký còn nguyên, gia sư vẫn thấy lớp của mình)", (await prisma.course.count({ where: { ownerId: H.id } })) === 1 && (await prisma.enrollment.count({ where: { courseId: hc.id } })) === 1);

  section("NC2-022 Hiện lại: về như cũ");
  check("hiện lại → 200; khoá profile bị XOÁ khỏi DB (về đúng như chưa từng bấm)", (await put(H, { profile: { hidden: false } })).status === 200 && (await dbPrefs(H))?.profile === undefined);
  check("công khai 200, có trong danh sách, facets có lại", (await pubStatus(H)) === 200 && (await inList(H)) && ((await api("GET", "/api/tutors")).json.facets.cities as string[]).includes("Thành phố Chỉ Có Thầy Ẩn"));
  check("bài đăng: profilePublic = true, profileHidden = false", (await api("GET", "/api/tutor/post-draft", { as: H })).json.profilePublic === true && (await api("GET", "/api/tutor/post-draft", { as: H })).json.profileHidden === false);
  check("Q11: bật Hiện không đòi trường/bằng cấp (xoá hết khu vực rồi ẩn → hiện vẫn được)", (await put(H, { teaching: null, profile: { hidden: true } })).status === 200 && (await put(H, { profile: { hidden: false } })).status === 200 && (await pubStatus(H)) === 200);

  section("NC2-022 Không làm mất khoá khác; hai yêu cầu đồng thời");
  await put(H, { teaching: { district: "Quận 9", mode: "both" }, profile: { hidden: true } });
  check("đổi chế độ sáng/tối ở API giao diện: ẩn + khu vực còn nguyên", (await put(H, { mode: "toi" }, PREFS)).status === 200 && (await dbPrefs(H))?.profile?.hidden === true && (await dbPrefs(H))?.teaching?.district === "Quận 9");
  check("đổi module / kết nối / nhắc lịch: công tắc còn nguyên", (await put(H, { modules: ["lop"], connections: { messenger: "thay.an" }, reminders: { parent: false } }, PREFS)).status === 200 && (await dbPrefs(H))?.profile?.hidden === true);
  check("lưu khu vực (không gửi profile) → vẫn ẨN", (await put(H, { teaching: { district: "Quận 10" } })).status === 200 && (await dbPrefs(H))?.profile?.hidden === true);
  let lost2 = 0;
  for (let i = 0; i < 8; i++) {
    const wantHidden = i % 2 === 1, wantMode = i % 2 ? "toi" : "sang";
    await Promise.all([put(H, { profile: { hidden: wantHidden } }), put(H, { mode: wantMode }, PREFS), put(H, { teaching: { district: `Quận ${i + 20}`, mode: "offline" } })]);
    const p = await dbPrefs(H);
    if (!!p?.profile?.hidden !== wantHidden || p?.mode !== wantMode || p?.teaching?.district !== `Quận ${i + 20}`) lost2++;
  }
  check("ba yêu cầu ĐỒNG THỜI (ẩn/hiện + đổi sáng/tối + lưu khu vực) × 8 lần: không lần nào ghi đè mất phần của bên kia", lost2 === 0, lost2);

  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
