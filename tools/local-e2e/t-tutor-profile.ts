// LOI-05 — GET /api/tutors/[id] sau khi tách phần đọc ra src/lib/tutorPublicProfile.ts (đặc tả docs/kin/phong-ban/dac-ta/LOI-05.md mục 3.1, 5).
// Cần máy chủ Next ở $BASE + Postgres thử (stu-test chạy, tuần tự). Mẫu: h.ts. KHÔNG gọi wipe(): chỉ tạo dữ liệu riêng (đóng dấu thời gian) và
// dọn đúng những gì mình tạo ở cuối — để chạy được cả trên DB worktree đang giữ 8 gia sư của mock-tim-gia-su.ts.
//
// Kiểm: (1) tập khoá JSON giữ NGUYÊN như route cũ ở mọi tầng; (2) JSON không chứa thứ không được lộ (email, điện thoại khi chưa bật Zalo, ngày sinh,
// phụ huynh, giá lớp, tên học sinh, chuỗi thô ảnh bìa/video); (3) 404 cho id không có / NUL / 65 ký tự / chưa duyệt / bị cấm / bị khoá / ẩn;
// (4) chủ xem trước hồ sơ ẩn ⇒ 200 profileHidden:true, người khác / khách ?preview=1 ⇒ 404; (5) gọi trùng ⇒ y hệt; route ≡ gọi thẳng thư viện.
import { api, mkTutor, mkUser, mkCourse, mkAttendanceSession, check, section, done, type TUser } from "./h";
import { prisma } from "@/lib/prisma";
import { loadPublicTutorProfile, TUTOR_PUBLIC_PROFILE_KEYS, type TutorPublicProfile } from "@/lib/tutorPublicProfile";
import { FREE_CLASS_TAG } from "@/lib/joinRequest";
import type { TutorDetailResponse } from "@/components/tutor/tim-gia-su/kieu";

// Đặc tả 3.1: TutorDetailResponse (kiểu giao diện) phải gán được từ TutorPublicProfile — kiểm lúc biên dịch.
type Assignable = TutorPublicProfile extends TutorDetailResponse ? true : never;
const assignable: Assignable = true;

// Tập khoá của route TRƯỚC khi tách (chép tay từ src/app/api/tutors/[id]/route.ts bản df485dae) — không lấy từ thư viện để ca này bắt được lệch.
const OLD_KEYS = {
  top: "classes,profileHidden,stats,tutor",
  tutor: "area,avatarBase64,bio,coverUrl,id,introVideo,messenger,name,subjects,tutorVerified,tutorVerifiedAt,zalo",
  stats: "classCount,rating,recentlyActive,sessionsTaught,studentCount",
  classes: "activeCount,bg,capacity,category,classStatus,id,isFree,joinPolicy,name,rating,seatsLeft,shortTitle,strip",
};
const keys = (o: unknown) => (o && typeof o === "object" ? Object.keys(o).sort().join() : "");
const NOT_FOUND = "Không tìm thấy gia sư";
const get = (id: string, o: { as?: TUser; qs?: string } = {}) => api("GET", `/api/tutors/${id}${o.qs ?? ""}`, { as: o.as });
const is404 = (r: { status: number; json: any }) => r.status === 404 && r.json?.error === NOT_FOUND;
const day = (n: number) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - n); return d; };

const madeUsers: string[] = [];
const madeCourses: string[] = [];
const track = <X extends { id: string }>(u: X) => { madeUsers.push(u.id); return u; };

(async () => {
  check("TutorPublicProfile gán được vào TutorDetailResponse (tsc)", assignable === true);
  try {
    // ── Dữ liệu ────────────────────────────────────────────────────────────────────────────────────────────
    const P = track(await mkTutor("Cô Hồ Sơ Đầy Đủ Ltp"));
    const verifiedAt = new Date("2026-10-20T03:04:05.000Z");
    await prisma.user.update({
      where: { id: P.id },
      data: {
        subjects: ["Toán 9", "Vật lý 12"], bio: "Dạy Toán 9 và Vật lý 12.", city: "Hà Nội", tutorVerifiedAt: verifiedAt,
        phone: "0912345678", dateOfBirth: new Date("1991-04-23"), parentPhone: "0987654321", parentName: "Phụ Huynh Ltp", school: "THPT Bí Mật Ltp",
        coverUrl: "https://evil.example/cover.png", introVideoUrl: "javascript:alert(1)",
        preferences: { teaching: { district: "Cầu Giấy", mode: "both", price: 250000, showPrice: true, credential: "ĐH Sư phạm" }, connections: { showZalo: false, messenger: "co.ho.so" } } as any,
      },
    });
    const S1 = track(await mkUser({ name: "Em Học Sinh Bí Mật Ltp" }));
    const S2 = track(await mkUser({ name: "Em Thứ Hai Bí Mật Ltp" }));
    const paid = await mkCourse(P.id, { name: "Lớp Toán Có Phí Ltp", capacity: 10 }); madeCourses.push(paid.id);
    await prisma.course.update({ where: { id: paid.id }, data: { price: 777777, joinPolicy: "open" } });
    const free = await mkCourse(P.id, { name: "Lớp Miễn Phí Ltp", capacity: null }); madeCourses.push(free.id);
    await prisma.course.update({ where: { id: free.id }, data: { price: 0, tag: FREE_CLASS_TAG, joinPolicy: "open" } });
    const hiddenCourse = await mkCourse(P.id, { name: "Lớp Đã Tắt Ltp" }); madeCourses.push(hiddenCourse.id);
    await prisma.course.update({ where: { id: hiddenCourse.id }, data: { status: false } });
    await prisma.enrollment.create({ data: { userId: S1.id, courseId: paid.id } });
    await prisma.enrollment.create({ data: { userId: S2.id, courseId: paid.id } });
    await prisma.courseReview.create({ data: { userId: S1.id, courseId: paid.id, rating: 4, comment: "Nhận xét bí mật Ltp", status: "approved" } });
    const sess = await mkAttendanceSession(paid.id, P.id, day(2));
    const sessRec = await prisma.attendanceRecord.findMany({ where: { sessionId: sess.id }, select: { userId: true } });
    sessRec.forEach(r => madeUsers.push(r.userId));

    const NV = track(await mkUser({ name: "Chưa Duyệt Ltp", role: "admin", adminRole: "teacher", tutorVerified: false }));
    const BAN = track(await mkTutor("Bị Cấm Ltp")); await prisma.user.update({ where: { id: BAN.id }, data: { banned: true } });
    const LOCK = track(await mkTutor("Bị Khoá Ltp")); await prisma.user.update({ where: { id: LOCK.id }, data: { profileLockedAt: new Date(), profileLockReason: "lý do khoá Ltp" } });
    const HID = track(await mkTutor("Đã Ẩn Ltp")); await prisma.user.update({ where: { id: HID.id }, data: { preferences: { profile: { hidden: true } } as any } });
    const STU = track(await mkUser({ name: "Học Sinh Thường Ltp" }));
    const OTHER = track(await mkTutor("Gia Sư Khác Ltp"));
    const ADMIN = track(await mkUser({ name: "Quản Trị Ltp", role: "admin", adminRole: "admin_super" }));
    const NUL = track(await mkTutor("Toàn Null Ltp"));
    await prisma.user.update({ where: { id: NUL.id }, data: { preferences: undefined, city: null, subjects: [], bio: null, tutorVerifiedAt: null } });

    // ── (1) Tập khoá giữ nguyên ──────────────────────────────────────────────────────────────────────────────
    section("(1) JSON giữ NGUYÊN tập khoá của route cũ");
    const R = await get(P.id);
    const J = R.json as TutorPublicProfile;
    check("200", R.status === 200, R.status);
    check("tầng ngoài: profileHidden, tutor, stats, classes", keys(J) === OLD_KEYS.top, keys(J));
    check("tutor: đúng 12 khoá cũ", keys(J?.tutor) === OLD_KEYS.tutor, keys(J?.tutor));
    check("stats: đúng 5 khoá cũ (kể cả rating)", keys(J?.stats) === OLD_KEYS.stats, keys(J?.stats));
    check("classes[]: đúng 13 khoá cũ ở MỌI lớp (kể cả rating)", (J?.classes ?? []).length > 0 && J.classes.every(c => keys(c) === OLD_KEYS.classes), J?.classes?.map(keys));
    check("hằng TUTOR_PUBLIC_PROFILE_KEYS khớp tập khoá cũ", (["top", "tutor", "stats", "classes"] as const).every(k => [...TUTOR_PUBLIC_PROFILE_KEYS[k]].sort().join() === OLD_KEYS[k]));
    check("area chỉ 5 khoá công khai", keys(J?.tutor?.area) === "city,credential,district,mode,price", J?.tutor?.area);
    check("tutorVerifiedAt là chuỗi ISO đúng mốc", J?.tutor?.tutorVerifiedAt === verifiedAt.toISOString(), J?.tutor?.tutorVerifiedAt);
    check("profileHidden=false với người ngoài", J?.profileHidden === false);
    check("rating vẫn có ở stats và lớp (giữ tương thích, giao diện không vẽ)", J?.stats?.rating?.total === 1 && J?.stats?.rating?.avg === 4 && J.classes.find(c => c.id === paid.id)?.rating?.total === 1);
    check("chỉ lớp status:true (lớp đã tắt không có), đúng thứ tự sortOrder", J.classes.map(c => c.id).join() === [paid.id, free.id].join(), J.classes.map(c => c.id));
    check("số đếm: classCount 2, studentCount 2 (chỉ số, không tên), sessionsTaught 1, recentlyActive", J.stats.classCount === 2 && J.stats.studentCount === 2 && J.stats.sessionsTaught === 1 && J.stats.recentlyActive === true, J.stats);
    const cPaid = J.classes.find(c => c.id === paid.id)!, cFree = J.classes.find(c => c.id === free.id)!;
    check("lớp có phí: open → invite_only, isFree false, seatsLeft 8", cPaid.joinPolicy === "invite_only" && cPaid.isFree === false && cPaid.seatsLeft === 8 && cPaid.activeCount === 2, cPaid);
    check("lớp miễn phí: open giữ, isFree true, capacity null ⇒ seatsLeft null", cFree.joinPolicy === "open" && cFree.isFree === true && cFree.seatsLeft === null, cFree);
    check("giá tham khảo tự khai có (showPrice), messenger có, Zalo null (chưa bật)", J.tutor.area?.price === 250000 && J.tutor.messenger === "co.ho.so" && J.tutor.zalo === null);

    // ── (2) Không lộ ─────────────────────────────────────────────────────────────────────────────────────────
    section("(2) JSON không chứa thứ không được lộ");
    const txt = R.text;
    check("không email", !/@test\.local/.test(txt));
    check("không số điện thoại (mọi dạng) khi chưa bật Zalo", !/0912345678|912345678|84912345678|0987654321/.test(txt));
    check("không ngày sinh / phụ huynh / trường học", !/1991-04-23|Phụ Huynh Ltp|THPT Bí Mật Ltp/.test(txt));
    check("không khoá nhạy cảm (password, preferences, phone, dateOfBirth, parent*, tutorRejectReason, profileLockReason)", !/"(password|preferences|phone|phoneE164|dateOfBirth|parentPhone|parentName|school|tutorRejectReason|profileLockReason|email)"/.test(txt));
    check("không giá lớp (price / 777777) ở lớp", J.classes.every(c => !("price" in c)) && !/777777/.test(txt));
    check("không tên học sinh, không lời nhận xét", !/Em Học Sinh Bí Mật Ltp|Em Thứ Hai Bí Mật Ltp|Học sinh điểm danh|Nhận xét bí mật Ltp/.test(txt));
    check("ảnh bìa http:// hỏng → null; video javascript: → null (không trả chuỗi thô)", J.tutor.coverUrl === null && J.tutor.introVideo === null && !/evil\.example|javascript:/.test(txt));
    check("không chữ 'đã xác minh'", !/đã xác minh/i.test(txt));
    await prisma.user.update({ where: { id: P.id }, data: { preferences: { teaching: { district: "Cầu Giấy", mode: "both", price: 250000, showPrice: false }, connections: { showZalo: true } } as any } });
    const R2 = await get(P.id);
    check("BẬT showZalo ⇒ zalo là số đã chuẩn hoá (do gia sư tự bật)", typeof R2.json?.tutor?.zalo === "string" && R2.json.tutor.zalo.length > 0, R2.json?.tutor?.zalo);
    check("TẮT showPrice ⇒ area.price null (giá đang lưu không rò)", R2.json?.tutor?.area?.price === null && !/250000|250\.000/.test(R2.text));
    check("gia sư toàn null: area null, bio null, subjects [], tutorVerifiedAt null, zalo/messenger null, vẫn đủ khoá", (await (async () => {
      const r = await get(NUL.id); const t = r.json?.tutor;
      return r.status === 200 && keys(t) === OLD_KEYS.tutor && t.area === null && t.bio === null && Array.isArray(t.subjects) && t.subjects.length === 0 && t.tutorVerifiedAt === null && t.zalo === null && t.messenger === null && r.json.classes.length === 0 && r.json.stats.sessionsTaught === 0;
    })()));

    // ── (3) 404 ──────────────────────────────────────────────────────────────────────────────────────────────
    section("(3) 404 như nhau, không chênh");
    const cases: [string, string][] = [
      ["id không tồn tại", "khong-ton-tai-" + Date.now()],
      ["id có NUL (%00)", "%00"],
      ["id có NUL giữa chuỗi", encodeURIComponent(P.id + "\u0000")],
      ["id 65 ký tự", "a".repeat(65)],
      ["id 65 ký tự = id thật + đuôi", encodeURIComponent((P.id + "x".repeat(65)).slice(0, 65))],
      ["chưa duyệt", NV.id], ["bị cấm", BAN.id], ["bị khoá", LOCK.id], ["ẩn hồ sơ", HID.id],
      ["học sinh", STU.id], ["quản trị", ADMIN.id],
    ];
    for (const [name, id] of cases) {
      const r = await get(id);
      check(`${name} ⇒ 404 { error: "${NOT_FOUND}" }`, is404(r), [r.status, r.text.slice(0, 120)]);
      check(`${name} ⇒ thân 404 chỉ có khoá error (không lộ tên / lý do)`, keys(r.json) === "error" && !/Ltp|lý do/.test(r.text));
    }
    check("id 64 ký tự (biên) không tồn tại ⇒ 404, không 500", is404(await get("b".repeat(64))));

    // ── (4) Xem trước ────────────────────────────────────────────────────────────────────────────────────────
    section("(4) ?preview=1: chỉ chính chủ thấy hồ sơ ẩn");
    const own = await get(HID.id, { as: HID, qs: "?preview=1" });
    check("chủ + ?preview=1 ⇒ 200, profileHidden:true, đủ khoá", own.status === 200 && own.json?.profileHidden === true && keys(own.json) === OLD_KEYS.top && keys(own.json?.tutor) === OLD_KEYS.tutor, [own.status, own.json?.profileHidden]);
    check("chủ KHÔNG có ?preview=1 ⇒ 404", is404(await get(HID.id, { as: HID })));
    check("chủ + ?preview=true / preview=2 ⇒ 404 (chỉ đúng \"1\")", is404(await get(HID.id, { as: HID, qs: "?preview=true" })) && is404(await get(HID.id, { as: HID, qs: "?preview=2" })));
    check("khách ?preview=1 ⇒ 404", is404(await get(HID.id, { qs: "?preview=1" })));
    check("gia sư khác ?preview=1 ⇒ 404", is404(await get(HID.id, { as: OTHER, qs: "?preview=1" })));
    check("học sinh ?preview=1 ⇒ 404", is404(await get(HID.id, { as: STU, qs: "?preview=1" })));
    check("quản trị ?preview=1 ⇒ 404 (không có ngoại lệ quản trị ở API công khai)", is404(await get(HID.id, { as: ADMIN, qs: "?preview=1" })));
    check("cookie rác ?preview=1 ⇒ 404 (không 500)", (await api("GET", `/api/tutors/${HID.id}?preview=1`, { headers: { cookie: "midnight_session=rac.rac.rac" } })).status === 404);
    check("chủ bị khoá + ?preview=1 ⇒ vẫn 404 (khoá thắng xem trước)", is404(await get(LOCK.id, { as: LOCK, qs: "?preview=1" })));
    check("chủ chưa duyệt + ?preview=1 ⇒ 404", is404(await get(NV.id, { as: NV, qs: "?preview=1" })));
    const pv = await get(P.id, { qs: "?preview=1" });
    check("hồ sơ KHÔNG ẩn + ?preview=1 của khách ⇒ 200 profileHidden:false, giống hệt không preview", pv.status === 200 && pv.json?.profileHidden === false && pv.text === (await get(P.id)).text);

    // ── (5) Gọi trùng + route ≡ thư viện ─────────────────────────────────────────────────────────────────────
    section("(5) Gọi trùng: y hệt; route ≡ gọi thẳng loadPublicTutorProfile (trang /mentor dùng)");
    const a = await get(P.id), b = await get(P.id);
    check("hai lần GET liên tiếp ⇒ cùng một JSON", a.status === 200 && a.text === b.text);
    const direct = await loadPublicTutorProfile(prisma, P.id);
    check("JSON route === JSON.stringify(thư viện, không preview)", direct !== null && JSON.stringify(direct) === a.text, [a.text.length, JSON.stringify(direct).length]);
    check("thư viện: hồ sơ ẩn không preview ⇒ null; preview đúng chủ ⇒ profileHidden true", (await loadPublicTutorProfile(prisma, HID.id)) === null
      && (await loadPublicTutorProfile(prisma, HID.id, { preview: true, viewerId: HID.id }))?.profileHidden === true);
    check("thư viện: preview với viewerId người khác / null / thiếu preview ⇒ null", (await loadPublicTutorProfile(prisma, HID.id, { preview: true, viewerId: OTHER.id })) === null
      && (await loadPublicTutorProfile(prisma, HID.id, { preview: true, viewerId: null })) === null
      && (await loadPublicTutorProfile(prisma, HID.id, { viewerId: HID.id })) === null);
    check("thư viện: id rỗng / NUL / 65 ký tự ⇒ null (không ném, không chạm DB lỗi)", (await loadPublicTutorProfile(prisma, "")) === null
      && (await loadPublicTutorProfile(prisma, "x\u0000y")) === null && (await loadPublicTutorProfile(prisma, "a".repeat(65))) === null);
    const loop = await Promise.all(Array.from({ length: 5 }, () => get(P.id)));
    check("5 lần gọi song song ⇒ cùng 200 + cùng JSON (chỉ đọc, không ghi gì)", loop.every(r => r.status === 200 && r.text === a.text));
  } finally {
    // Dọn đúng phần mình tạo (lớp trước: ghi danh / đánh giá / buổi học xoá theo; rồi người dùng).
    try {
      if (madeCourses.length) await prisma.course.deleteMany({ where: { id: { in: madeCourses } } });
      if (madeUsers.length) await prisma.user.deleteMany({ where: { id: { in: madeUsers } } });
    } catch (e) {
      console.log("  (dọn dữ liệu thử chưa xong — không ảnh hưởng kết quả)", String(e).slice(0, 200));
    }
  }
  await done();
})();
