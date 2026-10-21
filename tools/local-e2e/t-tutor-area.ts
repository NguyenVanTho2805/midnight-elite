// ĐX-06 (NC1-074) — khu vực và hình thức dạy với dữ liệu thật: quyền, kiểm dữ liệu, lưu / đọc, CÔNG KHAI (opt-in, giá chỉ khi bật),
// không mất khi đổi giao diện (kể cả hai yêu cầu đồng thời), lọc theo tỉnh / hình thức.
// Cần Postgres + Next dev (xem README). Phần thuần đã có ở t-tutor-area-lib.ts.
import { api, mkTutor, mkUser, wipe, check, section, done, type TUser } from "./h";
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

  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
