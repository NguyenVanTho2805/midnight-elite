// BU-06 — Tìm gia sư kiểu sàn, API với dữ liệu thật: GET /api/tutors (lọc, facet, sắp, phân trang), /api/tutors/suggest, /api/tutors/[id] (bìa, video, joinPolicy/isFree),
// không rò PII, ẩn đúng người, số khớp hồ sơ, bẫy NULL, vào lớp miễn phí từ hồ sơ (BU-01).
// Cần máy chủ Next ở cổng 3100 + Postgres demo (COO chạy tuần tự). Phần thuần: t-tutor-search-lib.ts. Mẫu: h.ts.
// Chưa có ở đây (phụ thuộc phiếu BU-06b của phòng Gia sư — xem mục D đặc tả): ghi coverUrl/introVideoUrl qua PUT /api/users/me/tutor-profile (ca 10).
import { api, mkTutor, mkUser, mkCourse, mkAttendanceSession, wipe, check, section, done, type TUser } from "./h";
import { prisma } from "@/lib/prisma";
import { TUTOR_LIST_ITEM_KEYS } from "@/lib/tutorSearch";

const FORM = { "content-type": "application/x-www-form-urlencoded" };
const form = (path: string, as: TUser | undefined) => api("POST", path, { as, raw: new URLSearchParams([]), headers: FORM });
const loc = (r: { headers: Headers }) => { const h = r.headers.get("location") ?? ""; if (!h) return ""; const u = new URL(h, "http://x"); return u.pathname + u.search; };
const list = (qs = "") => api("GET", `/api/tutors${qs ? "?" + qs : ""}`);
// nhận cả phản hồi {status,json} lẫn thân JSON; thiếu items ⇒ mảng rỗng (để ca đỏ báo rõ thay vì làm cả bài sập)
const idsOf = (j: any) => ((j?.items ?? j?.json?.items ?? []) as any[]).map(x => x.id as string);
const day = (n: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - n); return d; };
async function setPrefs(id: string, prefs: unknown, extra: Record<string, unknown> = {}) {
  await prisma.user.update({ where: { id }, data: { preferences: prefs as any, ...extra } });
}
const B64 = "A".repeat(400);

(async () => {
  await wipe();

  // ── Dữ liệu: ≥ 30 gia sư thường + các ca phá ───────────────────────────────────────────────
  const bulk: TUser[] = [];
  for (let i = 0; i < 30; i++) {
    const t = await mkTutor(i % 6 === 0 ? "Trần Trùng Tên" : `Gia sư ${String(i).padStart(2, "0")}`);
    bulk.push(t);
    const hn = i % 2 === 0;
    await setPrefs(t.id, {
      teaching: { district: hn ? (i % 4 === 0 ? "Cầu Giấy" : "Đống Đa") : "Hải Châu", mode: (["online", "offline", "both"] as const)[i % 3], price: 100000 + (i % 5) * 50000, showPrice: i % 3 !== 2 },
    }, { city: hn ? "Hà Nội" : "Đà Nẵng", subjects: [i % 2 ? "Toán 9" : "Toán 10", i % 5 === 0 ? "IELTS" : "Văn 9"], tutorVerifiedAt: new Date(Date.now() - i * 3_600_000) });
  }

  // Gia sư có đủ PII + lớp + học sinh có tên (để quét rò rỉ)
  const P = await mkTutor("Cô Phương PII");
  const S1 = await mkUser({ name: "Em Hocsinh Bimat" });
  await setPrefs(P.id, { teaching: { district: "Cầu Giấy", mode: "both", price: 220000, showPrice: true, credential: "ĐH Sư phạm" }, connections: { showZalo: false } },
    { city: "Hà Nội", subjects: ["Toán 9"], phone: "0912345678", dateOfBirth: new Date("1990-05-17"), school: "THPT Bí Mật", parentPhone: "0987654321", parentName: "Phụ Huynh Bí Mật", bio: "Gia sư Toán." });
  const pc = await mkCourse(P.id, { name: "Lớp Toán P" });
  await prisma.enrollment.create({ data: { userId: S1.id, courseId: pc.id } });
  await prisma.user.update({ where: { id: S1.id }, data: { school: "THPT Em Bí Mật", highSchool: "THPT Em Bí Mật" } });

  // Ca phá: chưa duyệt, banned, khoá, ẩn, đơn đang chờ (student), toàn NULL
  const NV = await mkUser({ name: "Chưa Duyệt Xx", role: "admin", adminRole: "teacher", tutorVerified: false });
  const BAN = await mkTutor("Bị Cấm Xx"); await prisma.user.update({ where: { id: BAN.id }, data: { banned: true } });
  const LOCK = await mkTutor("Bị Khoá Xx"); await prisma.user.update({ where: { id: LOCK.id }, data: { profileLockedAt: new Date(), profileLockReason: "test" } });
  const HID = await mkTutor("Đã Ẩn Xx"); await setPrefs(HID.id, { profile: { hidden: true }, teaching: { district: "Cầu Giấy", mode: "online" } }, { city: "Hà Nội" });
  const PEND = await mkUser({ name: "Đơn Chờ Xx", role: "student" });
  const NUL = await mkTutor("Zeta Toàn Null"); // preferences null, city null, subjects [], bio null, tutorVerifiedAt null
  await prisma.user.update({ where: { id: NUL.id }, data: { preferences: undefined, city: null, subjects: [], bio: null, tutorVerifiedAt: null } });
  const hiddenIds = [NV.id, BAN.id, LOCK.id, HID.id, PEND.id];

  // Hoạt động: một gia sư có buổi đã dạy gần đây
  const ACT = bulk[1];
  const ac = await mkCourse(ACT.id, { name: "Lớp Hoạt Động" });
  await mkAttendanceSession(ac.id, ACT.id, day(3));
  // Lớp ẩn có ghi danh + buổi dạy (A5): không được tính ở danh sách
  const HC = await mkCourse(P.id, { name: "Lớp Ẩn P" });
  await prisma.course.update({ where: { id: HC.id }, data: { status: false } });
  const S2 = await mkUser({ name: "Em Lớp Ẩn" });
  await prisma.enrollment.create({ data: { userId: S2.id, courseId: HC.id } });
  await mkAttendanceSession(HC.id, P.id, day(2));
  await mkAttendanceSession(pc.id, P.id, day(40));

  // ── (1) Không lộ PII ────────────────────────────────────────────────────────────────────────
  section("(1) Không lộ PII");
  const L1 = await list("pageSize=48");
  const SG = await api("GET", "/api/tutors/suggest?q=gia");
  const DT = await api("GET", `/api/tutors/${P.id}`);
  const all = L1.text + SG.text + DT.text;
  check("ba API trả 200", L1.status === 200 && SG.status === 200 && DT.status === 200, [L1.status, SG.status, DT.status]);
  check("không có email của bất kỳ ai", !/@test\.local/.test(all));
  check("không có số điện thoại (mọi dạng), ngày sinh, phụ huynh, trường", !/0912345678|912345678|\+84912345678|84912345678|0987654321|1990-05-17|1990|Phụ Huynh Bí Mật|THPT Bí Mật|THPT Em Bí Mật/.test(all));
  check("không có password / preferences thô / phoneE164 / dateOfBirth / parentPhone", !/password|preferences|phoneE164|dateOfBirth|parentPhone|parentName|highSchool/i.test(all));
  check("không có tên học sinh đã ghi danh", !/Em Hocsinh Bimat|Em Lớp Ẩn/.test(all));
  check("không có tutorRejectReason / profileLockReason; chi tiết lớp không có price", !/tutorRejectReason|profileLockReason/.test(all) && DT.json.classes.every((c: any) => !("price" in c)));
  check("showZalo=false ⇒ chi tiết không có Zalo", DT.json?.tutor?.zalo === null);
  await setPrefs(P.id, { teaching: { district: "Cầu Giấy", mode: "both", price: 220000, showPrice: true }, connections: { showZalo: true } });
  const DT2 = await api("GET", `/api/tutors/${P.id}`);
  const L2 = await list("pageSize=48"), SG2 = await api("GET", "/api/tutors/suggest?q=gia");
  check("showZalo=true ⇒ CHỈ chi tiết có Zalo đã chuẩn hoá", !!DT2.json?.tutor?.zalo && !/84912345678|0912345678/.test(L2.text + SG2.text), DT2.json?.tutor?.zalo);
  const keys = new Set<string>();
  for (const it of L1.json.items) Object.keys(it).forEach(k => keys.add(k));
  check("khoá của items[i] ⊆ tập khoá cho phép", [...keys].every(k => (TUTOR_LIST_ITEM_KEYS as readonly string[]).includes(k)), [...keys]);
  check("danh sách không có coverUrl / introVideo", !/coverUrl|introVideo/.test(L1.text));
  check("area chỉ năm khoá công khai", L1.json.items.filter((i: any) => i.area).every((i: any) => Object.keys(i.area).sort().join() === "city,credential,district,mode,price"));
  check("không đặt cookie", !L1.headers.get("set-cookie") && !SG.headers.get("set-cookie") && !DT.headers.get("set-cookie"));
  check("suggest không có ảnh", !/avatarBase64/.test(SG.text));

  // ── (2) Ẩn đúng người ───────────────────────────────────────────────────────────────────────
  section("(2) Ẩn đúng người (danh sách, facet, gợi ý, chi tiết)");
  const everything = await list("pageSize=48&page=1");
  const p2 = await list("pageSize=48&page=2");
  const seenIds = [...idsOf(everything), ...idsOf(p2)];
  check("tổng số hiển thị = 30 + P + NUL", everything.json.total === 32 && seenIds.length === 32, everything.json.total);
  check("chưa duyệt / banned / khoá / ẩn / đơn chờ KHÔNG có trong items", hiddenIds.every(h => !seenIds.includes(h)));
  const xx = await list("q=xx");
  check("tìm 'xx' không ra ai trong số bị ẩn", xx.json.total === 0, xx.json.total);
  const sgX = await api("GET", "/api/tutors/suggest?q=xx");
  check("suggest không gợi ý người bị ẩn", sgX.json.suggestions.length === 0, sgX.json);
  const hidCity = await list("city=H%C3%A0%20N%E1%BB%99i&district=C%E1%BA%A7u%20Gi%E1%BA%A5y&mode=online&pageSize=48");
  check("gia sư ẩn không lọt vào facets.districts/activeCount (district 'Cầu Giấy' tồn tại nhờ người khác, đếm không tính HID)", !idsOf(hidCity).includes(HID.id));
  for (const [n, u] of [["chưa duyệt", NV], ["banned", BAN], ["khoá", LOCK], ["ẩn", HID], ["đơn chờ", PEND]] as const) {
    check(`/api/tutors/[id] của gia sư ${n} ⇒ 404`, (await api("GET", `/api/tutors/${u.id}`)).status === 404);
  }
  check("?preview=1 đúng chủ ⇒ 200 + profileHidden", (await api("GET", `/api/tutors/${HID.id}?preview=1`, { as: HID })).json?.profileHidden === true);
  check("?preview=1 người khác / khách ⇒ vẫn 404", (await api("GET", `/api/tutors/${HID.id}?preview=1`, { as: S1 })).status === 404 && (await api("GET", `/api/tutors/${HID.id}?preview=1`)).status === 404);
  check("id không tồn tại ⇒ 404", (await api("GET", "/api/tutors/khong-co-ai")).status === 404);
  await prisma.user.update({ where: { id: LOCK.id }, data: { profileLockedAt: null } });
  check("mở khoá ⇒ hiện lại NGAY (không cache)", (await api("GET", `/api/tutors/${LOCK.id}`)).status === 200 && idsOf(await list("q=xx")).includes(LOCK.id));
  await prisma.user.update({ where: { id: LOCK.id }, data: { profileLockedAt: new Date() } });
  check("khoá lại ⇒ biến mất NGAY", (await api("GET", `/api/tutors/${LOCK.id}`)).status === 404 && !idsOf(await list("q=xx")).includes(LOCK.id));
  check("Cache-Control no-store (không cache công khai)", /no-store/.test(everything.headers.get("cache-control") ?? "") && !/s-maxage/.test(everything.headers.get("cache-control") ?? ""));

  // ── (3) Facet đúng ──────────────────────────────────────────────────────────────────────────
  section("(3) Facet khớp tính tay");
  const F0 = (await list("pageSize=1")).json.facets;
  const hn = bulk.filter((_, i) => i % 2 === 0).length + 1; // + P (Hà Nội)
  const dn = bulk.filter((_, i) => i % 2 === 1).length;
  check("facets.cities có đúng Hà Nội, Đà Nẵng", JSON.stringify([...F0.cities].sort()) === JSON.stringify(["Hà Nội", "Đà Nẵng"].sort()), F0.cities);
  const sub = (v: string) => F0.subjects.find((s: any) => s.value === v)?.count;
  check("subjects: 'Toán 9' = 15 lẻ + P; 'Toán 10' = 15 chẵn; 'IELTS' = 6; 'Văn 9' = 24", sub("Toán 9") === 15 + 1 && sub("Toán 10") === 15 && sub("IELTS") === 6 && sub("Văn 9") === 24, F0.subjects);
  check("subjects giảm dần theo count", F0.subjects.every((s: any, i: number, a: any[]) => i === 0 || a[i - 1].count >= s.count));
  const g9 = F0.grades.find((g: any) => g.value === "9")?.count, gth = F0.grades.find((g: any) => g.value === "thcs")?.count, gtp = F0.grades.find((g: any) => g.value === "thpt")?.count;
  // Lớp 9 = gia sư lẻ (Toán 9: 15) ∪ gia sư chẵn không phải bội 5 (Văn 9: 12) ∪ P (Toán 9) = 28; mỗi gia sư đếm MỘT lần dù có hai môn cùng cấp.
  check("grades: lớp 9 = thcs = 28 (hợp nhất theo gia sư, không đếm đôi); thpt = 15 (Toán 10)", g9 === 28 && gth === 28 && gtp === 15, { gth, g9, gtp });
  const onl = bulk.filter((_, i) => i % 3 !== 1).length + 1, off = bulk.filter((_, i) => i % 3 !== 0).length + 1; // online|both ; offline|both (+P both)
  check("modes: both tính vào cả hai", F0.modes.online === onl && F0.modes.offline === off, F0.modes);
  const priced = bulk.filter((_, i) => i % 3 !== 2).length + 1; // + P (bật giá 220000)
  check("price: min 100000, max 300000 chỉ từ giá công khai; count đúng số gia sư bật giá", F0.price.min === 100000 && F0.price.max === 300000 && F0.price.count === priced, F0.price);
  check("activeCount = 1 (chỉ ACT dạy 3 ngày trước; lớp ẩn của P không tính)", F0.activeCount === 1, F0.activeCount);
  const Fc = (await list("city=" + encodeURIComponent("Hà Nội") + "&pageSize=1")).json;
  check("chọn city KHÔNG làm facets.cities co lại; districts của city đó", Fc.facets.cities.length === 2 && Fc.facets.districts.join() === "Cầu Giấy,Đống Đa" && Fc.total === hn, { c: Fc.facets.cities, d: Fc.facets.districts, t: Fc.total, hn });
  const Fd = (await list("city=" + encodeURIComponent("Đà Nẵng") + "&pageSize=1")).json;
  check("Đà Nẵng: districts = Hải Châu, total đúng", Fd.facets.districts.join() === "Hải Châu" && Fd.total === dn, { d: Fd.facets.districts, t: Fd.total });
  check("facets.districts rỗng khi không chọn city", F0.districts.length === 0);

  // ── (4) Lọc ─────────────────────────────────────────────────────────────────────────────────
  section("(4) Lọc");
  const q1 = await list("q=" + encodeURIComponent("gia su 03"));
  check("q không dấu / hoa thường: 'gia su 03' ⇒ đúng 1 người", q1.json.total === 1 && q1.json.items[0].name === "Gia sư 03", q1.json.total);
  check("q 'TRAN trung' khớp 'Trần Trùng Tên'", (await list("q=TRAN%20trung")).json.total === 5, (await list("q=TRAN%20trung")).json.total);
  check("q khớp tên môn không dấu: 'ielts' ⇒ 6", (await list("q=ielts")).json.total === 6);
  check("subject chính xác", (await list("subject=" + encodeURIComponent("Toán 10"))).json.total === 15 && (await list("subject=" + encodeURIComponent("Toan 10"))).json.total === 0);
  const g9r = await list("grade=9&pageSize=48"), gth2 = await list("grade=thcs&pageSize=48");
  check("grade=9 / thcs ⇒ gia sư có môn 9 (Văn 9 hoặc Toán 9); grade rác ⇒ bỏ lọc", g9r.json.total === gth2.json.total && g9r.json.total > 0 && (await list("grade=13")).json.total === 32 && g9r.json.total === 28, g9r.json.total);
  check("grade=thpt ⇒ 15 (Toán 10)", (await list("grade=thpt")).json.total === 15);
  check("city+district", (await list("city=" + encodeURIComponent("Hà Nội") + "&district=" + encodeURIComponent("cau giay"))).json.total === bulk.filter((_, i) => i % 4 === 0).length + 1);
  const mo = await list("mode=online&pageSize=48");
  check("mode=online gồm 'both'", mo.json.total === onl && mo.json.items.every((i: any) => i.area && (i.area.mode === "online" || i.area.mode === "both")), mo.json.total);
  const pr = await list("priceMin=150000&priceMax=200000&pageSize=48");
  check("priceMin/Max: chỉ gia sư có giá công khai trong khoảng; không giá bị loại", pr.json.total > 0 && pr.json.items.every((i: any) => i.area?.price >= 150000 && i.area.price <= 200000));
  check("priceMin>priceMax tự đổi chỗ", (await list("priceMin=200000&priceMax=150000&pageSize=48")).json.total === pr.json.total);
  check("lọc giá loại gia sư không bật giá (và NUL) nhưng không lọc thì còn", !idsOf(pr.json).includes(NUL.id) && seenIds.includes(NUL.id));
  const ac1 = await list("active=1");
  check("active=1 ⇒ chỉ ACT", ac1.json.total === 1 && ac1.json.items[0].id === ACT.id && ac1.json.items[0].recentlyActive === true, ac1.json.total);
  check("phối hợp là giao", (await list("city=" + encodeURIComponent("Hà Nội") + "&mode=offline&subject=" + encodeURIComponent("Toán 10") + "&pageSize=48")).json.items.every((i: any) => i.area.city === "Hà Nội" && ["offline", "both"].includes(i.area.mode) && i.subjects.includes("Toán 10")));
  for (const junk of ["priceMin=abc", "pageSize=9999", "page=-3", "sort=;DROP", "page=NaN&pageSize=Infinity", "priceMax=1e9", "grade=%00", "q=" + "x".repeat(500), "city=%27%20OR%201%3D1", "mode=both", "active=yes", "district=" + "d".repeat(500)]) {
    const r = await list(junk);
    check(`tham số rác '${junk.slice(0, 30)}' ⇒ 200, không 500`, r.status === 200 && Array.isArray(r.json?.items), [r.status]);
  }
  check("pageSize=9999 bị kẹp 48; page=-3 ⇒ trang 1", (await list("pageSize=9999")).json.pageSize === 48 && (await list("page=-3")).json.page === 1);
  const def = (await list("")).json;
  check("mặc định trả 24 mục + total + hasMore", def.items.length === 24 && def.hasMore === true && def.total === 32 && def.page === 1 && def.pageSize === 24);
  const sg = await api("GET", "/api/tutors/suggest?q=" + encodeURIComponent("toan"));
  check("suggest 'toan' ⇒ môn trước (Toán 9, Toán 10), tối đa 8, môn có count", sg.json.suggestions.length > 0 && sg.json.suggestions.length <= 8 && sg.json.suggestions[0].kind === "subject" && typeof sg.json.suggestions[0].count === "number", sg.json);
  check("suggest tên: 'Zeta' ⇒ tutor Zeta", (await api("GET", "/api/tutors/suggest?q=zeta")).json.suggestions.some((s: any) => s.kind === "tutor" && s.id === NUL.id));
  check("suggest q 1 ký tự / rỗng / thiếu ⇒ []", (await api("GET", "/api/tutors/suggest?q=a")).json.suggestions.length === 0 && (await api("GET", "/api/tutors/suggest")).json.suggestions.length === 0 && (await api("GET", "/api/tutors/suggest?q=")).json.suggestions.length === 0);

  // ── (5) Sắp xếp + phân trang ────────────────────────────────────────────────────────────────
  section("(5) Sắp xếp + phân trang");
  for (const s of ["relevant", "newest", "sessions", "price_asc", "price_desc", "active", "rating", "students", "classes"]) {
    const seen: string[] = []; let page = 1, total = -1, more = true, guard = 0;
    while (more && guard++ < 10) { const r = (await list(`sort=${s}&page=${page}&pageSize=7`)).json; seen.push(...idsOf(r)); total = r.total; more = r.hasMore; page++; }
    check(`sort=${s}: đi hết trang ⇒ không trùng id, không mất id, total = số id`, new Set(seen).size === seen.length && seen.length === 32 && total === 32 && !more, { n: seen.length, u: new Set(seen).size, total });
  }
  const t1 = idsOf(await list("sort=active&pageSize=48")).join(), t2 = idsOf(await list("sort=active&pageSize=48")).join(), t3 = idsOf(await list("sort=active&pageSize=48")).join();
  check("6 gia sư trùng tên 'Trần Trùng Tên' ⇒ thứ tự ổn định qua 3 lần gọi", t1 === t2 && t2 === t3);
  const pa = idsOf(await list("sort=price_asc&pageSize=48"));
  const priceById = new Map(L1.json.items.concat((await list("pageSize=48&page=2")).json.items).map((i: any) => [i.id, i.area?.price ?? null]));
  const sorted = pa.map(id => priceById.get(id) as number | null);
  const firstNull = sorted.findIndex(p => p === null);
  check("price_asc: giá tăng dần và gia sư không giá nằm CUỐI", firstNull > 0 && sorted.slice(firstNull).every(p => p === null) && sorted.slice(0, firstNull).every((p, i, a) => i === 0 || (a[i - 1] as number) <= (p as number)), sorted);
  const pd = idsOf(await list("sort=price_desc&pageSize=48")).map(id => priceById.get(id) as number | null);
  check("price_desc: giảm dần, không giá vẫn CUỐI", pd.findIndex(p => p === null) === firstNull && pd.slice(0, firstNull).every((p, i, a) => i === 0 || (a[i - 1] as number) >= (p as number)));
  const nw = idsOf(await list("sort=newest&pageSize=48"));
  check("newest: bulk[0] (duyệt mới nhất) đứng đầu, bulk[29] (cũ nhất) đứng sau mọi gia sư có mốc duyệt khác", nw[0] === bulk[0].id && nw.indexOf(bulk[29].id) === 29, nw.slice(0, 3));
  check("newest: gia sư tutorVerifiedAt=null (P, NUL) nằm CUỐI, theo tên", nw.slice(-2).join() === [P.id, NUL.id].join(), nw.slice(-3));
  check("sessions: gia sư có buổi dạy đứng trước", idsOf(await list("sort=sessions&pageSize=48")).slice(0, 2).includes(ACT.id));
  check("active (mặc định): gia sư hoạt động gần đây đứng đầu", idsOf(await list("pageSize=48"))[0] === ACT.id);
  const last = (await list("page=2&pageSize=24")).json;
  check("hasMore đúng ở trang cuối; page vượt cuối ⇒ items=[], total đúng", last.hasMore === false && last.items.length === 8 && (await list("page=200&pageSize=24")).json.items.length === 0 && (await list("page=200&pageSize=24")).json.total === 32);

  // ── (6) Số khớp hồ sơ (A5) ──────────────────────────────────────────────────────────────────
  section("(6) Số trên thẻ = số trên hồ sơ (lớp ẩn không tính)");
  const card = (await list("pageSize=48&page=1")).json.items.concat((await list("pageSize=48&page=2")).json.items).find((i: any) => i.id === P.id);
  const prof = (await api("GET", `/api/tutors/${P.id}`)).json;
  check("classCount bằng nhau và không tính lớp ẩn (=1)", card.classCount === prof.stats.classCount && card.classCount === 1, [card.classCount, prof.stats.classCount]);
  check("studentCount bằng nhau và không tính học sinh của lớp ẩn (=1)", card.studentCount === prof.stats.studentCount && card.studentCount === 1, [card.studentCount, prof.stats.studentCount]);
  check("sessionsTaught bằng nhau (lớp ẩn không tính)", card.sessionsTaught === prof.stats.sessionsTaught && card.sessionsTaught === 1, [card.sessionsTaught, prof.stats.sessionsTaught]);
  check("recentlyActive bằng nhau (buổi 2 ngày trước ở lớp ẩn không làm P 'hoạt động')", card.recentlyActive === prof.stats.recentlyActive && card.recentlyActive === false);

  // ── (7) Bẫy NULL ────────────────────────────────────────────────────────────────────────────
  section("(7) Bẫy NULL: gia sư không khai gì vẫn hiện, không 500");
  check("NUL hiện khi KHÔNG lọc", seenIds.includes(NUL.id));
  const nulItem = (await list("q=zeta")).json.items[0];
  check("NUL: area=null, subjects=[], bio=null, các số = 0", nulItem?.area === null && nulItem.subjects.length === 0 && nulItem.bio === null && nulItem.classCount === 0, nulItem);
  let ok = true;
  for (const s of ["newest", "price_asc", "price_desc", "relevant", "sessions", "rating"]) ok = ok && (await list(`sort=${s}&pageSize=48`)).status === 200;
  check("sắp theo newest/price/... với NUL trong tập ⇒ 200", ok);
  check("NUL bị loại khi lọc city/mode/giá/grade/subject (không đoán), không phải vì lỗi", !idsOf(await list("city=" + encodeURIComponent("Hà Nội") + "&pageSize=48")).includes(NUL.id) && !idsOf(await list("mode=online&pageSize=48")).includes(NUL.id) && !idsOf(await list("grade=9&pageSize=48")).includes(NUL.id));
  const nd = await api("GET", `/api/tutors/${NUL.id}`);
  check("chi tiết NUL ⇒ 200, area=null, zalo=null, coverUrl=null, introVideo=null", nd.status === 200 && nd.json.tutor.area === null && nd.json.tutor.zalo === null && nd.json.tutor.coverUrl === null && nd.json.tutor.introVideo === null, nd.json?.tutor);

  // ── (8) Chi tiết: bìa, video, joinPolicy/isFree ─────────────────────────────────────────────
  section("(8) /api/tutors/[id]: bìa + video + lớp");
  const R = bulk[2];
  const cvOk = `data:image/jpeg;base64,${B64}`;
  const setMedia = (cover: string | null, video: string | null) => prisma.user.update({ where: { id: R.id }, data: { coverUrl: cover, introVideoUrl: video } });
  const detail = async () => (await api("GET", `/api/tutors/${R.id}`)).json.tutor;
  for (const [n, v] of [["javascript:", "javascript:alert(1)"], ["svg", `data:image/svg+xml;base64,${B64}`], ["dài 1 MB", `data:image/jpeg;base64,${"A".repeat(1_000_000)}`], ["https", "https://evil.test/a.jpg"], ["base64 hỏng", "data:image/png;base64,@@@"]] as const) {
    await setMedia(v, null);
    check(`coverUrl hỏng trong DB (${n}) ⇒ null`, (await detail()).coverUrl === null);
  }
  await setMedia(cvOk, null);
  check("coverUrl hợp lệ ⇒ trả nguyên", (await detail()).coverUrl === cvOk);
  for (const bad of ["https://youtube.com.xau.vn/watch?v=dQw4w9WgXcQ", "javascript:alert(1)", "xyz", "https://vimeo.com/123", "https://www.youtube.com@evil.test/watch?v=dQw4w9WgXcQ", "https://evilyoutube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be.evil.test/dQw4w9WgXcQ", "https://user:pw@youtu.be/dQw4w9WgXcQ"]) {
    await setMedia(null, bad);
    check(`introVideoUrl hỏng/tên miền giả (${bad.slice(0, 30)}) ⇒ introVideo=null`, (await detail()).introVideo === null);
  }
  await setMedia(null, "https://youtu.be/dQw4w9WgXcQ?si=abc");
  const vd = await api("GET", `/api/tutors/${R.id}`);
  check("video hợp lệ ⇒ embedUrl nocookie, watchUrl dẫn xuất", vd.json.tutor.introVideo?.embedUrl.startsWith("https://www.youtube-nocookie.com/embed/") && vd.json.tutor.introVideo.watchUrl === "https://www.youtube.com/watch?v=dQw4w9WgXcQ", vd.json.tutor.introVideo);
  check("KHÔNG trả introVideoUrl thô (và không trả phần '?si=')", !/introVideoUrl|si=abc/.test(vd.text));
  check("danh sách không có media dù đã đặt", !/dQw4w9WgXcQ|data:image/.test((await list("pageSize=48")).text));

  const FREE = await mkCourse(R.id, { name: "Lớp Miễn Phí Mở" });
  await prisma.course.update({ where: { id: FREE.id }, data: { joinPolicy: "open", tag: "Miễn phí", price: 0 } });
  const RATED = await mkCourse(R.id, { name: "Lớp Có Đơn Giá" });
  await prisma.course.update({ where: { id: RATED.id }, data: { joinPolicy: "open", tag: "Miễn phí", price: 0 } });
  await prisma.courseFeeRate.create({ data: { courseId: RATED.id, mode: "per_session", rate: 100000, effectiveFrom: "2026-01-01", createdBy: R.id } });
  const APPR = await mkCourse(R.id, { name: "Lớp Duyệt" });
  await prisma.course.update({ where: { id: APPR.id }, data: { joinPolicy: "approve", tag: "Miễn phí", price: 0 } });
  const PAID = await mkCourse(R.id, { name: "Lớp Học Phí" });
  await prisma.course.update({ where: { id: PAID.id }, data: { joinPolicy: "open", tag: null, price: 500000 } });
  const OLD = await mkCourse(R.id, { name: "Lớp Cũ Null" });
  const cl = (await api("GET", `/api/tutors/${R.id}`)).json;
  const byId = (id: string) => cl.classes.find((c: any) => c.id === id);
  check("open + miễn phí ⇒ joinPolicy 'open', isFree true", byId(FREE.id)?.joinPolicy === "open" && byId(FREE.id)?.isFree === true, byId(FREE.id));
  check("open nhưng có CourseFeeRate ⇒ 'invite_only', isFree false", byId(RATED.id)?.joinPolicy === "invite_only" && byId(RATED.id)?.isFree === false, byId(RATED.id));
  check("approve ⇒ giữ 'approve'", byId(APPR.id)?.joinPolicy === "approve");
  check("open nhưng có học phí ⇒ 'invite_only'", byId(PAID.id)?.joinPolicy === "invite_only" && byId(PAID.id)?.isFree === false);
  check("joinPolicy null ⇒ 'invite_only'", byId(OLD.id)?.joinPolicy === "invite_only" && byId(OLD.id)?.isFree === false);
  check("classes[i] KHÔNG có price / tag", cl.classes.every((c: any) => !("price" in c) && !("tag" in c)) && !/"price":\s*(500000|0)\b/.test(JSON.stringify(cl.classes)));

  // ── (9) Vào lớp từ hồ sơ (BU-01) ────────────────────────────────────────────────────────────
  section("(9) Vào lớp miễn phí từ hồ sơ (dùng BU-01)");
  const SA = await mkUser({ name: "Em Vao Lop A" }), SB = await mkUser({ name: "Em Vao Lop B" });
  const g1 = await form(`/api/courses/${FREE.id}/join`, undefined);
  check("khách ⇒ 303 /dang-nhap?redirect=", g1.status === 303 && loc(g1).startsWith("/dang-nhap?redirect="), loc(g1));
  check("khách không tạo Enrollment / ClassJoinRequest", (await prisma.enrollment.count({ where: { courseId: FREE.id } })) === 0 && (await prisma.classJoinRequest.count({ where: { courseId: FREE.id } })) === 0);
  const j1 = await form(`/api/courses/${FREE.id}/join`, SA);
  check("học sinh + open + miễn phí ⇒ 303 /student/hoc-tap và đúng 1 Enrollment", j1.status === 303 && loc(j1).startsWith("/student/hoc-tap") && (await prisma.enrollment.count({ where: { courseId: FREE.id, userId: SA.id } })) === 1, loc(j1));
  await form(`/api/courses/${FREE.id}/join`, SA);
  check("bấm hai lần ⇒ vẫn 1 Enrollment", (await prisma.enrollment.count({ where: { courseId: FREE.id, userId: SA.id } })) === 1);
  await Promise.all([form(`/api/courses/${APPR.id}/join`, SB), form(`/api/courses/${APPR.id}/join`, SB)]);
  const inv = await prisma.classInvite.findMany({ where: { courseId: APPR.id, boundUserId: SB.id, kind: "personal" } });
  check("lớp approve: bấm hai lần ⇒ đúng 1 mã cá nhân", inv.length === 1, inv.length);
  const rd = await api("POST", `/api/invites/${inv[0]?.code}/redeem`, { as: SB });
  check("redeem mã ⇒ pending, đúng 1 ClassJoinRequest, chưa Enrollment", rd.json?.pending === true && (await prisma.classJoinRequest.count({ where: { courseId: APPR.id, userId: SB.id } })) === 1 && (await prisma.enrollment.count({ where: { courseId: APPR.id, userId: SB.id } })) === 0, rd);
  const nt = await prisma.notification.findMany({ where: { userId: R.id, type: { startsWith: "join_request" } } });
  check("thông báo cho gia sư không chứa tên học sinh hay số tiền", nt.length > 0 && nt.every(n => !/Em Vao Lop|VND|₫|\d{4,}/.test(`${n.title} ${n.message} ${n.link ?? ""}`.replace(/[A-Za-z0-9_-]{20,}/g, "")) ), nt.map(n => ({ t: n.type, title: n.title, m: n.message })));
  const gt = await form(`/api/courses/${FREE.id}/join`, R);
  check("gia sư gọi ⇒ 403, không Enrollment", gt.status === 403 && (await prisma.enrollment.count({ where: { courseId: FREE.id, userId: R.id } })) === 0, gt.status);
  const gi = await form(`/api/courses/${OLD.id}/join`, SA);
  check("lớp invite_only ⇒ 303 ?join=chi-ma", gi.status === 303 && /join=chi-ma/.test(loc(gi)), loc(gi));
  const gr = await form(`/api/courses/${RATED.id}/join`, SA);
  check("lớp open nhưng có đơn giá ⇒ ?join=chi-ma (đúng như API báo 'invite_only')", gr.status === 303 && /join=chi-ma/.test(loc(gr)), loc(gr));

  // ── (10) Ghi coverUrl/introVideoUrl (BU-06b) ─────────────────────────────────────────────────
  section("(10) Ghi bìa/video qua PUT /api/users/me/tutor-profile");
  const W = bulk[3]; // gia sư đã duyệt, chưa có bìa/video
  const put = (as: TUser | undefined, body: unknown) => api("PUT", "/api/users/me/tutor-profile", { as, body });
  const rowOf = (id: string) => prisma.user.findUnique({ where: { id }, select: { coverUrl: true, introVideoUrl: true, bio: true } });
  const goodCover = `data:image/png;base64,${B64}`;

  const w1 = await put(W, { coverUrl: goodCover, introVideoUrl: "https://youtu.be/dQw4w9WgXcQ?si=abc&t=9" });
  check("gia sư ghi bìa + video hợp lệ ⇒ 200", w1.status === 200, w1.json);
  check("DB: bìa lưu nguyên; video lưu dạng CHUẨN do máy chủ dựng (không lưu chữ gõ, không '?si=')", (await rowOf(W.id))?.coverUrl === goodCover && (await rowOf(W.id))?.introVideoUrl === "https://www.youtube.com/watch?v=dQw4w9WgXcQ", await rowOf(W.id));
  check("phản hồi trả bìa + link chuẩn, không trả chữ gõ thô", w1.json?.coverUrl === goodCover && w1.json?.introVideoUrl === "https://www.youtube.com/watch?v=dQw4w9WgXcQ" && !/si=abc/.test(w1.text), w1.json);
  check("GET hồ sơ của chính mình trả lại bìa + video (để form điền sẵn)", (await api("GET", "/api/users/me/tutor-profile", { as: W })).json?.coverUrl === goodCover);
  const pubW = (await api("GET", `/api/tutors/${W.id}`)).json?.tutor;
  check("hồ sơ công khai /api/tutors/[id] hiện bìa + video nhúng nocookie", pubW?.coverUrl === goodCover && pubW?.introVideo?.embedUrl === "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", pubW);

  // Kẻ tấn công: giá trị xấu ⇒ 400, và KHÔNG ghi gì (cột giữ nguyên)
  const before = await rowOf(W.id);
  const badCovers: [string, unknown][] = [["svg", `data:image/svg+xml;base64,${B64}`], ["html", `data:text/html;base64,${B64}`], ["gif", `data:image/gif;base64,${B64}`], ["https ngoài", "https://evil.test/a.jpg"], ["javascript:", "javascript:alert(1)"],
    ["base64 hỏng", "data:image/png;base64,@@@"], ["base64 lệch 4", "data:image/png;base64,AAAAA"], ["quá 250 000 ký tự", `data:image/jpeg;base64,${"A".repeat(250_000)}`], ["số", 123], ["mảng", [goodCover]], ["đối tượng", { url: goodCover }]];
  for (const [n, v] of badCovers) {
    const r = await put(W, { coverUrl: v });
    check(`bìa xấu (${n}) ⇒ 400`, r.status === 400, r.status);
  }
  const badVideos: [string, unknown][] = [["tên miền giả", "https://youtube.com.xau.vn/watch?v=dQw4w9WgXcQ"], ["javascript:", "javascript:alert(1)"], ["vimeo", "https://vimeo.com/123"], ["@ lừa tên miền", "https://www.youtube.com@evil.test/watch?v=dQw4w9WgXcQ"], ["iframe HTML", "<iframe src=\"https://evil.test\"></iframe>"], ["số", 5], ["mã thiếu 1 ký tự", "dQw4w9WgXc"]];
  for (const [n, v] of badVideos) {
    const r = await put(W, { introVideoUrl: v });
    check(`video xấu (${n}) ⇒ 400`, r.status === 400, r.status);
  }
  const after = await rowOf(W.id);
  check("sau 18 lần gửi xấu: bìa + video trong DB KHÔNG đổi", after?.coverUrl === before?.coverUrl && after?.introVideoUrl === before?.introVideoUrl, after);

  // undefined = giữ nguyên; null / rỗng = xoá
  const keep = await put(W, { bio: "Chỉ đổi giới thiệu." });
  check("PUT chỉ có bio ⇒ giữ nguyên bìa + video", keep.status === 200 && (await rowOf(W.id))?.coverUrl === goodCover && (await rowOf(W.id))?.introVideoUrl === before?.introVideoUrl && (await rowOf(W.id))?.bio === "Chỉ đổi giới thiệu.");
  const clearV = await put(W, { introVideoUrl: "   " });
  check("video rỗng ⇒ xoá video, bìa giữ", clearV.status === 200 && (await rowOf(W.id))?.introVideoUrl === null && (await rowOf(W.id))?.coverUrl === goodCover);
  const clearC = await put(W, { coverUrl: null });
  check("bìa null ⇒ xoá bìa", clearC.status === 200 && (await rowOf(W.id))?.coverUrl === null);
  // Biên: phần base64 phải dài chia hết cho 4 nên với tiền tố jpeg (23 ký tự) lớn nhất hợp lệ là 249 999; thêm một khối 4 ký tự là 250 003 > 250 000.
  const edge = `data:image/jpeg;base64,${"A".repeat(249_976)}`, over = `data:image/jpeg;base64,${"A".repeat(249_980)}`;
  check("bìa 249 999 ký tự (lớn nhất hợp lệ) ⇒ nhận", edge.length === 249_999 && (await put(W, { coverUrl: edge })).status === 200);
  check("bìa 250 003 ký tự (vượt biên) ⇒ 400", over.length === 250_003 && (await put(W, { coverUrl: over })).status === 400);
  await prisma.user.update({ where: { id: W.id }, data: { coverUrl: null, introVideoUrl: null } });

  // Quyền: học sinh / khách không ghi được; gia sư không ghi hộ người khác; gia sư chờ duyệt ghi được nhưng chưa ra công khai
  const rs = await put(S1, { coverUrl: goodCover });
  check("học sinh PUT ⇒ 403 và KHÔNG ghi", rs.status === 403 && (await rowOf(S1.id))?.coverUrl === null, rs.status);
  check("khách PUT ⇒ 401", (await put(undefined, { coverUrl: goodCover })).status === 401);
  const other = await put(W, { coverUrl: goodCover, userId: R.id, id: R.id });
  check("thân có userId/id của người khác ⇒ bị bỏ qua: chỉ ghi vào chính mình", other.status === 200 && (await rowOf(W.id))?.coverUrl === goodCover && (await rowOf(R.id))?.coverUrl === null);
  const pn = await put(NV, { coverUrl: goodCover, introVideoUrl: "https://youtu.be/dQw4w9WgXcQ" });
  check("gia sư chưa duyệt ghi được (sửa trước khi nộp lại)", pn.status === 200, pn.status);
  check("…nhưng hồ sơ chưa duyệt KHÔNG ra công khai", (await api("GET", `/api/tutors/${NV.id}`)).status === 404);
  await prisma.user.update({ where: { id: W.id }, data: { coverUrl: null, introVideoUrl: null } });

  // ── (11) Kẻ tấn công: tham số cực đoan ở cả ba API (BU-06 rà bổ sung) ─────────────────────────
  section("(11) Tham số cực đoan: không 500, không rò ẩn/PII");
  const EXTREME = ["page=-1", "pageSize=0", "pageSize=-5", "page=0&pageSize=0", "page=99999999999999999999", "priceMin=-100&priceMax=-1", "priceMin=99999999999999999999",
    "priceMin=300000&priceMax=100000", "q=" + encodeURIComponent(".*(["), "q=" + encodeURIComponent("%_\\"), "q=" + encodeURIComponent("'; DROP TABLE \"User\";--"), "q=%00", "q=" + "%E1%BB%87".repeat(300),
    "q=" + encodeURIComponent("<script>alert(1)</script>"), "subject=" + "z".repeat(5000), "q=a&q=b&sort=price_asc&sort=rating&page=1&page=2", "sort=__proto__&page=constructor", "city=&district=&mode=&grade="];
  for (const junk of EXTREME) {
    const r = await list(junk);
    check(`/api/tutors?${junk.slice(0, 40)} ⇒ 200, items là mảng, không có người bị ẩn`, r.status === 200 && Array.isArray(r.json?.items) && !(r.json.items as any[]).some(i => hiddenIds.includes(i.id)) && !/@test\.local/.test(r.text), [r.status]);
  }
  const rev = await list("priceMin=300000&priceMax=100000&pageSize=48");
  check("priceMin>priceMax ⇒ cùng kết quả với khoảng đã đổi chỗ", rev.json.total === (await list("priceMin=100000&priceMax=300000&pageSize=48")).json.total && rev.json.total > 0);
  check("q rất dài bị cắt, không khớp nhầm cả danh sách", (await list("q=" + "x".repeat(2000))).json.total === 0);
  // Ký hiệu bị bỏ khi chuẩn hoá (normalizeKey) ⇒ q chỉ gồm ký hiệu = không có từ khoá = không lọc (như q rỗng); điều cần chặn là nó KHÔNG hoạt động như ký tự đại diện khi đi kèm chữ.
  const unfilteredTotal = (await list("pageSize=1")).json.total;
  check("q chỉ gồm % _ \\ = không có từ khoá (bằng danh sách không lọc), không lỗi", (await list("q=%25&pageSize=1")).json.total === unfilteredTotal && (await list("q=_&pageSize=1")).json.total === unfilteredTotal, unfilteredTotal);
  check("q = chữ + % hoặc _ không khớp đại diện (không ra cả danh sách)", (await list("q=zzzq%25&pageSize=1")).json.total === 0 && (await list("q=zzzq_&pageSize=1")).json.total === 0);
  for (const q of ["x".repeat(500), encodeURIComponent("'; DROP TABLE x;--"), encodeURIComponent(".*"), "%00%00", "chua%20duyet", "don%20cho", "bi%20cam", "bi%20khoa", "da%20an", "%25%25"]) {
    const r = await api("GET", `/api/tutors/suggest?q=${q}`);
    check(`suggest?q=${q.slice(0, 24)} ⇒ 200, mảng, không người bị ẩn / PII`, r.status === 200 && Array.isArray(r.json?.suggestions) && r.json.suggestions.length <= 8 && !(r.json.suggestions as any[]).some(x => hiddenIds.includes(x.id)) && !/@test\.local|09123/.test(r.text), [r.status, r.text.slice(0, 80)]);
  }
  for (const id of ["%00", "x".repeat(3000), encodeURIComponent("' OR '1'='1"), "..%2F..%2Fetc%2Fpasswd", "%25", "undefined", "null"]) {
    const r = await api("GET", `/api/tutors/${id}`);
    check(`/api/tutors/${id.slice(0, 24)} ⇒ 404 (không 500, không rò)`, r.status === 404, [r.status]);
  }
  const noAuthHidden = await api("GET", `/api/tutors/${HID.id}?preview=1&preview=0`, { as: S1 });
  check("preview lặp tham số bởi người khác ⇒ vẫn 404", noAuthHidden.status === 404);

  await done();
})();
