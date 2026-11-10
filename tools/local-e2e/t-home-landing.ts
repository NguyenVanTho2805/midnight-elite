// BU-HS-LANDING — bốn bộ tải dữ liệu thật của trang chủ công khai (src/lib/homeLandingServer.ts), chạy trên DB thật. KHÔNG cần máy chủ Next.
// Đặc tả: docs/kin/phong-ban/dac-ta/BU-HS-LANDING.md mục 5. Cần DATABASE_URL trỏ DB thử (h.ts có wipe() = TRUNCATE mọi bảng, KHÔNG chạy trên DB thật).
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-home-landing.ts   (lặp lại với TZ=Asia/Ho_Chi_Minh).
//
// Ca phá (sửa gì trong mã thì ca nào phải đỏ):
//  - loadHomeExams: bỏ `courseId: null` → "đề gắn lớp vắng" đỏ. Bỏ `isListedToStudent` → "đề của gia sư không lớp (giao theo link) vắng" đỏ.
//    Bỏ `activeGuest/active/isDraft/supersededById/variantOfId` hoặc điều kiện giá → ca tương ứng đỏ. Thay `select` bằng `include` → ca "JSON không lộ" đỏ.
//  - loadHomeTutors (tutorSearchServer.loadVisibleTutors): bỏ lọc `isProfileHidden` → "hồ sơ ẩn vắng" đỏ; bỏ `banned:false` → "gia sư bị cấm vắng" đỏ.
//  - loadHomeCourses: bỏ `hasSeat` (ở pickHomeCourses) → "lớp đầy/đóng/tạm ngừng vắng" đỏ.
//  - loadHomeArticles: bỏ `now` (dùng giờ khác) hoặc bỏ điều kiện đã đăng → "nháp / hẹn giờ vắng" đỏ.
//  - loadHomeLanding: thêm `cookies()`/`headers()`/`getSession` → ca đọc nguồn đỏ.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";
import { loadHomeLanding } from "@/lib/homeLandingServer";
import { loadTutorAggregates } from "@/lib/tutorSearchServer";
import { EMPTY_LANDING } from "@/lib/homeLanding";
import { TUTOR_LIST_ITEM_KEYS } from "@/lib/tutorSearch";
import { mkTutor, mkUser, mkSuper, mkCourse, mkAttendanceSession, wipe, check, section, done } from "./h";

const stamp = Date.now().toString(36);
const BAIT = `MA-MOI-${stamp}`;
let seq = 0;

async function mkExam(o: {
  title: string; owner?: string | null; courseId?: string | null; date?: string; time?: string; price?: number | null; active?: boolean; activeGuest?: boolean;
  isDraft?: boolean; supersededById?: string | null; variantOfId?: string | null; questions?: number; secrets?: boolean;
}) {
  seq++;
  const id = `de-${stamp}-${seq}`;
  const ex = await prisma.exam.create({
    data: {
      id, code: `HSA.${stamp}.${seq}`, title: o.title, category: "ĐGNL HSA", date: o.date ?? "01/09/2026", time: o.time ?? "08:00", duration: "90 phút",
      questions: 999, status: "available", createdAt: new Date(Date.now() - seq * 1000).toISOString(),
      ownerId: o.owner ?? null, courseId: o.courseId ?? null, price: o.price ?? null,
      active: o.active ?? true, activeGuest: o.activeGuest ?? true, isDraft: o.isDraft ?? false,
      supersededById: o.supersededById ?? null, variantOfId: o.variantOfId ?? null,
      ...(o.secrets ? { passwordHash: `${BAIT}-PW`, password: `${BAIT}-PW2`, azotaUrl: `https://azota.test/${BAIT}`, participants: 777, clusterScorePercents: [11, 22, 33, 44] } : {}),
    },
  });
  for (let i = 0; i < (o.questions ?? 2); i++) {
    const q = await prisma.examQuestion.create({ data: { id: `${id}-q${i}`, examId: id, order: i, text: `${BAIT} nội dung câu ${i}`, points: 1, type: "MC", explanation: `${BAIT} lời giải ${i}` } });
    await prisma.examOption.create({ data: { id: `${q.id}-o1`, questionId: q.id, order: 0, text: `${BAIT} đáp án đúng`, isCorrect: true } });
    await prisma.examOption.create({ data: { id: `${q.id}-o2`, questionId: q.id, order: 1, text: `${BAIT} đáp án sai`, isCorrect: false } });
  }
  return ex;
}

(async () => {
  await wipe();

  // ─── Rỗng ─────────────────────────────────────────────────────────────────────────────────────────────────
  section("Ca dữ liệu rỗng — DB không gia sư/lớp/đề/bài");
  {
    let threw = false, empty = null as Awaited<ReturnType<typeof loadHomeLanding>> | null;
    try { empty = await loadHomeLanding(); } catch { threw = true; }
    check("không ném lỗi", !threw);
    check("trả đúng EMPTY_LANDING (bốn mảng + chip rỗng)", !!empty && JSON.stringify(empty) === JSON.stringify(EMPTY_LANDING), empty);
  }

  // ─── Dựng dữ liệu ─────────────────────────────────────────────────────────────────────────────────────────
  const now = new Date();
  const TA = await mkTutor(`Cô Lan Hiện ${stamp}`);
  const TB = await mkTutor(`Thầy Bình Hiện ${stamp}`);
  const TC = await mkTutor(`Gia sư Chưa Duyệt ${stamp}`); await prisma.user.update({ where: { id: TC.id }, data: { tutorVerified: false } });
  const TD = await mkTutor(`Gia sư Bị Cấm ${stamp}`); await prisma.user.update({ where: { id: TD.id }, data: { banned: true } });
  const TE = await mkTutor(`Gia sư Bị Khoá ${stamp}`); await prisma.user.update({ where: { id: TE.id }, data: { profileLockedAt: now } });
  const TF = await mkTutor(`Gia sư Ẩn Hồ Sơ ${stamp}`); await prisma.user.update({ where: { id: TF.id }, data: { preferences: { profile: { hidden: true } } } });
  const SECRET_PHONE = "0911222333", SECRET_SCHOOL = `Trường Bí Mật ${stamp}`, SECRET_DOB = "1990-04-05";
  await prisma.user.update({
    where: { id: TA.id },
    data: { avatarBase64: "data:image/png;base64,AAAA", bio: "Dạy Toán luyện thi", subjects: ["Toán 12"], city: "Hà Nội", phone: SECRET_PHONE, school: SECRET_SCHOOL, dateOfBirth: new Date(`${SECRET_DOB}T00:00:00Z`) },
  });
  await prisma.user.update({ where: { id: TB.id }, data: { subjects: ["Vật lí 11"], avatarBase64: "z".repeat(24_001), preferences: { teaching: { district: "Cầu Giấy", mode: "online", price: 200000, showPrice: false } } } });

  const lopA = await mkCourse(TA.id, { name: `Toán HSA mở ${stamp}`, capacity: 10 });
  const lopFull = await mkCourse(TA.id, { name: `Lý HSA đầy ${stamp}`, capacity: 1 });
  const lopClosed = await mkCourse(TA.id, { name: `Hoá HSA đóng ${stamp}`, classStatus: "closed" });
  const lopPaused = await mkCourse(TB.id, { name: `Sinh HSA tạm ngừng ${stamp}`, classStatus: "paused" });
  const lopHidden = await mkCourse(TB.id, { name: `Văn HSA ẩn ${stamp}` });
  const lopFree = await mkCourse(TB.id, { name: `Anh HCM miễn phí ${stamp}` });
  const ZALO = `https://zalo.me/g/${BAIT}`;
  await prisma.course.update({ where: { id: lopA.id }, data: { category: "ĐGNL HSA", price: 900000, zaloGroupLink: ZALO } });
  await prisma.course.update({ where: { id: lopFull.id }, data: { category: "ĐGNL HSA" } });
  await prisma.course.update({ where: { id: lopClosed.id }, data: { category: "ĐGNL HSA" } });
  await prisma.course.update({ where: { id: lopPaused.id }, data: { category: "ĐGNL HSA" } });
  await prisma.course.update({ where: { id: lopHidden.id }, data: { category: "ĐGNL HSA", status: false } });
  await prisma.course.update({ where: { id: lopFree.id }, data: { category: "ĐGNL HCM", price: 0 } });
  const kids: string[] = [];
  for (let i = 0; i < 3; i++) { const k = await mkUser({ name: `Em Học Sinh ${i} ${stamp}` }); kids.push(k.id); await prisma.enrollment.create({ data: { userId: k.id, courseId: lopA.id, status: "active" } }); }
  const kFull = await mkUser({ name: `Em Giữ Chỗ Cuối ${stamp}` }); kids.push(kFull.id);
  await prisma.enrollment.create({ data: { userId: kFull.id, courseId: lopFull.id, status: "active" } });
  await mkAttendanceSession(lopA.id, TA.id, new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 3)));

  const admin = await mkSuper(`Quản trị Đề ${stamp}`);
  const okOpen = await mkExam({ title: `Đề chung ĐANG MỞ ${stamp}`, owner: admin.id, date: "01/09/2026", secrets: true });
  const okFree0 = await mkExam({ title: `Đề chung giá 0 ${stamp}`, owner: admin.id, date: "02/09/2026", price: 0 });
  const future = new Date(now.getTime() + 40 * 86_400_000);
  const dd = (d: Date) => `${String(new Date(d.getTime() + 7 * 3_600_000).getUTCDate()).padStart(2, "0")}/${String(new Date(d.getTime() + 7 * 3_600_000).getUTCMonth() + 1).padStart(2, "0")}/${new Date(d.getTime() + 7 * 3_600_000).getUTCFullYear()}`;
  const okUpcoming = await mkExam({ title: `Đề chung SẮP MỞ ${stamp}`, owner: admin.id, date: dd(future), time: "19:30" });
  const bad = {
    guestOff: await mkExam({ title: `VẮNG activeGuest=false ${stamp}`, owner: admin.id, activeGuest: false }),
    inactive: await mkExam({ title: `VẮNG active=false ${stamp}`, owner: admin.id, active: false }),
    draft: await mkExam({ title: `VẮNG nháp ${stamp}`, owner: admin.id, isDraft: true }),
    superseded: await mkExam({ title: `VẮNG đã bị thay ${stamp}`, owner: admin.id, supersededById: okOpen.id }),
    variant: await mkExam({ title: `VẮNG mã đề con ${stamp}`, owner: admin.id, variantOfId: okOpen.id }),
    withCourse: await mkExam({ title: `VẮNG gắn lớp ${stamp}`, owner: admin.id, courseId: lopA.id }),
    paid: await mkExam({ title: `VẮNG thu phí ${stamp}`, owner: admin.id, price: 50000 }),
    noQuestion: await mkExam({ title: `VẮNG không câu hỏi ${stamp}`, owner: admin.id, questions: 0 }),
    byLink: await mkExam({ title: `VẮNG giao theo link ${stamp}`, owner: TA.id }),
    badDate: await mkExam({ title: `VẮNG ngày rác ${stamp}`, owner: admin.id, date: "32/13/2026" }),
  };

  const mkArticle = (slug: string, title: string, o: { published: boolean; publishedAt: Date | null }) =>
    prisma.article.create({ data: { slug: `${slug}-${stamp}`, title, excerpt: `Tóm tắt ${title}`, content: `${BAIT} nội dung dài ${title}`, category: "tuyen-sinh", author: "KiN", authorId: admin.id, ...o } });
  const aPosted = await mkArticle("da-dang", `Bài ĐÃ ĐĂNG ${stamp}`, { published: true, publishedAt: new Date(now.getTime() - 86_400_000) });
  const aLegacy = await mkArticle("cu", `Bài CŨ không giờ đăng ${stamp}`, { published: true, publishedAt: null });
  const aDraft = await mkArticle("nhap", `Bài NHÁP ${stamp}`, { published: false, publishedAt: null });
  const aSched = await mkArticle("hen-gio", `Bài HẸN GIỜ ${stamp}`, { published: true, publishedAt: new Date(now.getTime() + 2 * 86_400_000) });
  const aDraftPast = await mkArticle("nhap-qua-khu", `Bài NHÁP có giờ quá khứ ${stamp}`, { published: false, publishedAt: new Date(now.getTime() - 86_400_000) });

  const L = await loadHomeLanding(now);
  const json = JSON.stringify(L);

  // ─── JSON không lộ ────────────────────────────────────────────────────────────────────────────────────────
  section("Ca phá JSON lộ — mã mồi, khoá cấm, dữ liệu cá nhân");
  check("dữ liệu có thật để thử (không rỗng cả bốn)", L.tutors.length > 0 && L.courses.length > 0 && L.exams.length > 0 && L.articles.length > 0, { t: L.tutors.length, c: L.courses.length, e: L.exams.length, a: L.articles.length });
  check("không chứa mã mồi (lời giải, đáp án, nội dung câu, mật khẩu băm, azota, link nhóm Zalo, nội dung bài)", !json.includes(BAIT), json.slice(json.indexOf(BAIT) - 40, json.indexOf(BAIT) + 60));
  for (const k of ["passwordHash", "password", "azotaUrl", "ownerId", "explanation", "isCorrect", "participants", "clusterScorePercents", "capacity", "zaloGroupLink", "enrolled", "email", "phone", "dateOfBirth", "school", "content", "authorId", "views"]) {
    check(`không có khoá "${k}"`, !json.includes(`"${k}"`));
  }
  const allMail = (await prisma.user.findMany({ select: { email: true } })).map(u => u.email);
  check("không chứa email nào của người dùng", !allMail.some(m => json.includes(m)));
  check("không chứa SĐT / trường / ngày sinh của gia sư mẫu", !json.includes(SECRET_PHONE) && !json.includes(SECRET_SCHOOL) && !json.includes(SECRET_DOB) && !json.includes("Hà Nội"));
  check("không chứa tên học sinh nào", !json.includes("Em Học Sinh") && !json.includes("Giữ Chỗ"));
  check("khoá của mỗi gia sư đúng bằng TUTOR_LIST_ITEM_KEYS", L.tutors.every(t => Object.keys(t).sort().join() === [...TUTOR_LIST_ITEM_KEYS].sort().join()));

  // ─── Đề ───────────────────────────────────────────────────────────────────────────────────────────────────
  section("Thi thử — chỉ đề chung, miễn phí, đang mở công khai");
  const examTitles = L.exams.map(e => e.title);
  const has = (t: string) => examTitles.some(x => x === t);
  check("đề hợp lệ có mặt (giá null, giá 0, sắp mở)", has(`Đề chung ĐANG MỞ ${stamp}`) && has(`Đề chung giá 0 ${stamp}`) && has(`Đề chung SẮP MỞ ${stamp}`), examTitles);
  for (const [k, ex] of Object.entries(bad)) check(`vắng: ${ex.title.replace(` ${stamp}`, "")} (${k})`, !has(ex.title) && !L.exams.some(e => e.id === ex.id));
  const open = L.exams.find(e => e.id === okOpen.id), up = L.exams.find(e => e.id === okUpcoming.id);
  check("số câu = đếm hàng ExamQuestion (2), không phải cột Exam.questions (999)", open?.questionCount === 2, open);
  check("đề đã qua giờ mở → state open; đề 40 ngày nữa → upcoming", open?.state === "open" && up?.state === "upcoming", { open, up });
  check("sắp mới nhất trước theo mốc giờ (sắp mở → 02/09 → 01/09)", L.exams.map(e => e.id).join() === [okUpcoming.id, okFree0.id, okOpen.id].join(), L.exams.map(e => `${e.date} ${e.time}`));
  check("ngày giờ hiện đúng khuôn dd/mm/yyyy · HH:mm", open?.date === "01/09/2026" && open?.time === "08:00" && open?.duration === "90 phút");
  check("khoá của đề đúng bằng LandingExam", L.exams.every(e => Object.keys(e).sort().join() === "category,code,date,duration,id,questionCount,startsAtMs,state,time,title"));
  const later = await loadHomeLanding(new Date(future.getTime() + 2 * 86_400_000));
  check("mốc giờ do máy chủ truyền: qua giờ mở thì đề sắp mở thành open", later.exams.find(e => e.id === okUpcoming.id)?.state === "open");

  // ─── Gia sư ───────────────────────────────────────────────────────────────────────────────────────────────
  section("Gia sư — duyệt, không khoá/cấm/ẩn; số liệu khớp loadTutorAggregates");
  const tIds = new Set(L.tutors.map(t => t.id));
  check("hai gia sư hợp lệ có mặt", tIds.has(TA.id) && tIds.has(TB.id) && L.tutors.length === 2, [...tIds]);
  check("vắng: chưa duyệt (tutorVerified:false)", !tIds.has(TC.id) && !json.includes(`Chưa Duyệt ${stamp}`));
  check("vắng: bị cấm (banned)", !tIds.has(TD.id) && !json.includes(`Bị Cấm ${stamp}`));
  check("vắng: bị khoá (profileLockedAt)", !tIds.has(TE.id) && !json.includes(`Bị Khoá ${stamp}`));
  check("vắng: hồ sơ ẨN (preferences.profile.hidden)", !tIds.has(TF.id) && !json.includes(`Ẩn Hồ Sơ ${stamp}`));
  const agg = await loadTutorAggregates(prisma, [TA.id, TB.id]);
  const ta = L.tutors.find(t => t.id === TA.id), tb = L.tutors.find(t => t.id === TB.id);
  const sameAgg = (t: typeof ta, id: string) => { const a = agg.get(id); return !!t && !!a && t.studentCount === a.studentCount && t.classCount === a.classCount && t.sessionsTaught === a.sessionsTaught && t.recentlyActive === a.recentlyActive; };
  check("số liệu khớp loadTutorAggregates (lớp, học viên đang học, buổi đã dạy, hoạt động gần đây)", sameAgg(ta, TA.id) && sameAgg(tb, TB.id), { ta, tb, a: [...agg.entries()] });
  check("số cụ thể của gia sư A: 3 học viên đang học (cộng cả lớp đầy = 4), 3 lớp, 1 buổi đã dạy, đang hoạt động", ta?.studentCount === 4 && ta?.classCount === 3 && ta?.sessionsTaught === 1 && ta?.recentlyActive === true, ta);
  check("gia sư đang hoạt động xếp trước", L.tutors[0]?.id === TA.id, L.tutors.map(t => t.id));
  check("ảnh nhỏ giữ; ảnh 24.001 ký tự → null", ta?.avatarBase64 === "data:image/png;base64,AAAA" && tb?.avatarBase64 === null);
  check("gia sư A (không khai khu vực) → area null, không rò users.city", ta?.area === null);
  check("gia sư B có khu vực tự khai: không giá (đã tắt showPrice), không email/SĐT", !!tb?.area && tb.area.district === "Cầu Giấy" && tb.area.price === null);

  // Chỉ 1 gia sư hiển thị → [] (không lưới 1 thẻ)
  await prisma.user.update({ where: { id: TB.id }, data: { preferences: { profile: { hidden: true } } } });
  const one = await loadHomeLanding(now);
  check("chỉ còn 1 gia sư hợp lệ → tutors = []", one.tutors.length === 0, one.tutors.map(t => t.id));
  check("các khối khác không bị ảnh hưởng khi khối gia sư rỗng", one.courses.length > 0 && one.exams.length === 3 && one.articles.length > 0);
  await prisma.user.update({ where: { id: TB.id }, data: { preferences: {} } });

  // ─── Lớp ──────────────────────────────────────────────────────────────────────────────────────────────────
  section("Lớp — còn chỗ, đang mở; không sĩ số/link nhóm");
  const cTitles = L.courses.map(c => c.title);
  check("lớp còn chỗ có mặt (có giá, miễn phí)", cTitles.includes(`Toán HSA mở ${stamp}`) && cTitles.includes(`Anh HCM miễn phí ${stamp}`), cTitles);
  check("vắng: lớp đầy", !json.includes(`Lý HSA đầy ${stamp}`));
  check("vắng: lớp đóng (classStatus closed)", !json.includes(`Hoá HSA đóng ${stamp}`));
  check("vắng: lớp tạm ngừng", !json.includes(`Sinh HSA tạm ngừng ${stamp}`));
  check("vắng: lớp status:false", !json.includes(`Văn HSA ẩn ${stamp}`));
  check("tiền chỉ để hiển thị: 900000 và 0 đúng như trong DB", L.courses.find(c => c.slug === lopA.id)?.price === 900000 && L.courses.find(c => c.slug === lopFree.id)?.price === 0);
  check("chip kỳ thi: đủ hai kỳ thi còn lớp có chỗ", L.courseChips.map(c => c.name).sort().join() === ["ĐGNL HCM", "ĐGNL HSA"].sort().join(), L.courseChips);
  check("lớp đầy KHÔNG tính vào chip (HSA chỉ còn 1 lớp có chỗ)", L.courseChips.find(c => c.name === "ĐGNL HSA")?.count === 1, L.courseChips);

  // ─── Tin ──────────────────────────────────────────────────────────────────────────────────────────────────
  section("Tin — đã đăng và đã tới giờ");
  const aTitles = L.articles.map(a => a.title);
  check("bài đã đăng và bài cũ không giờ đăng có mặt", aTitles.includes(aPosted.title) && aTitles.includes(aLegacy.title), aTitles);
  check("vắng: bản nháp (published:false)", !json.includes(aDraft.title));
  check("vắng: nháp dù giờ đăng ở quá khứ", !json.includes(aDraftPast.title));
  check("vắng: bài hẹn giờ chưa tới giờ", !json.includes(aSched.title));
  check("tối đa 3 bài, ngày đúng khuôn dd/mm/yyyy", L.articles.length <= 3 && L.articles.every(a => /^\d{2}\/\d{2}\/\d{4}$/.test(a.dateText)));
  const afterSched = await loadHomeLanding(new Date(now.getTime() + 3 * 86_400_000));
  check("mốc giờ do máy chủ truyền: qua giờ hẹn thì bài hiện, nháp vẫn vắng", afterSched.articles.some(a => a.title === aSched.title) && !afterSched.articles.some(a => a.title === aDraft.title || a.title === aDraftPast.title));
  check("khoá của bài đúng bằng LandingArticle", L.articles.every(a => Object.keys(a).sort().join() === "categoryLabel,coverImage,dateText,excerpt,slug,title"));

  // ─── Tĩnh ─────────────────────────────────────────────────────────────────────────────────────────────────
  section("Tĩnh — homeLandingServer.ts không phụ thuộc người xem");
  {
    const src = readFileSync(join(process.cwd(), "src/lib/homeLandingServer.ts"), "utf8").replace(/\/\/.*$/gm, "");
    for (const bad of ["cookies(", "headers(", "getSession", "unstable_noStore", "force-dynamic", "next/headers", "process.env"]) check(`không chứa ${bad}`, !src.includes(bad));
    check("điều kiện đề có `courseId: null` và `activeGuest: true` và `isDraft: false`", /courseId:\s*null/.test(src) && /activeGuest:\s*true/.test(src) && /isDraft:\s*false/.test(src));
    check("mỗi bộ tải bọc safeBlock riêng (4 lần)", (src.match(/safeBlock\(/g) ?? []).length === 4);
    check("đề dùng `select` liệt kê cột, không `include`", /select:\s*{/.test(src) && !/include:\s*{/.test(src));
  }

  // ─── Rỗng lần nữa sau khi xoá sạch ────────────────────────────────────────────────────────────────────────
  section("Xoá sạch dữ liệu → quay về EMPTY_LANDING");
  await wipe();
  const again = await loadHomeLanding(new Date());
  check("loadHomeLanding sau wipe() = EMPTY_LANDING", JSON.stringify(again) === JSON.stringify(EMPTY_LANDING), again);

  void kids; void bad;
  await done();
})().catch(e => { console.error(e); process.exit(1); });
