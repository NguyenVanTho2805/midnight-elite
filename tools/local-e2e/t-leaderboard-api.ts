// STU-003 / quyết định 1B (04/11/2026) (API + DB thật) — bảng xếp hạng:
//   GET /api/leaderboard        : công khai nhưng KHÁCH chỉ thấy tên che, không trường, không userId, tối đa 10 dòng, không tài khoản bị cấm / hệ thống / đã ẩn; người đã đăng nhập thấy như cũ.
//   GET /api/honor-leaderboard  : BẮT ĐĂNG NHẬP (khách → 401, không lộ gì); học sinh / gia sư / quản trị → 200.
//   Bộ đệm (ttlCache): khoá TÁCH theo người xem — bản khách đã che không bao giờ được phát cho người đã đăng nhập và ngược lại.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-leaderboard-api.ts
// Hai chế độ (giống t-community-api): máy chủ KHÔNG đặt LEADERBOARD_CACHE_SECONDS (dev: đệm tắt) → dữ liệu mới thấy ngay.
//   EXPECT_CACHE=1 và máy chủ chạy với LEADERBOARD_CACHE_SECONDS=300 → kiểm khoá đệm tách khách / thành viên và dữ liệu cũ vẫn được phát trong hạn.
//
// CA PHÁ CỐ Ý (mỗi lần một thứ rồi hoàn lại):
//   - leaderboard/route.ts: đổi `shapeLeaderboard(sorted, isMember)` thành `(sorted, true)` → các ca "khách thấy tên che / không trường / 10 dòng" đỏ.
//   - leaderboard/route.ts: bỏ `banned: false, ...NOT_SYSTEM_ACCOUNT` khỏi userWhere của khách → ca "khách không thấy tài khoản bị cấm / hệ thống" đỏ.
//   - leaderboard/route.ts: cacheKey bỏ phần `isMember ? "member" : "guest"` (EXPECT_CACHE=1) → ca "bản đệm của khách không phát cho thành viên" đỏ.
//   - honor-leaderboard/route.ts: bỏ dòng `if (!(await getSession())) return 401…` → ca "khách → 401" đỏ.
//   - cả hai route: bỏ `headers: NO_STORE` → ca "Cache-Control: no-store" đỏ.
import { prisma } from "@/lib/prisma";
import { api, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done } from "./h";

const EXPECT_CACHE = process.env.EXPECT_CACHE === "1";
const GIVEN = ["An", "Bình", "Cường", "Dũng", "Giang", "Hà", "Hải", "Hiếu", "Khánh", "Lan", "Minh", "Nam", "Oanh", "Phúc"];
const mkExam = (id: string, category: string) => prisma.exam.create({ data: { id, code: id, title: id, category, date: "01/01/2030", time: "08:00", duration: "15 phút", questions: 1, status: "available", totalPoints: 150, createdAt: "2026-10-24" } as never });
const res = (userId: string, examId: string, score: number) => prisma.examResult.create({ data: { userId, examId, score, totalPoints: 150 } });
const gtext = (r: { text: string }) => r.text;

async function main() {
  await wipe();
  const T = await mkTutor("Cô Lan"), SA = await mkSuper("Quản trị");
  const C = await mkCourse(T.id, { name: "Toán 9" });
  await mkExam("e-toan", "toan"); await mkExam("e-ly", "ly");

  // 14 học sinh thường, điểm tốt nhất 100, 99, … 87; mỗi em có trường riêng và đã ghi danh.
  const S: Awaited<ReturnType<typeof mkUser>>[] = [];
  for (let i = 0; i < 14; i++) {
    const u = await mkUser({ name: `Nguyễn Văn ${GIVEN[i]}` });
    await prisma.user.update({ where: { id: u.id }, data: { school: `THPT Chuyên Số ${i}, Hà Nội` } });
    await prisma.enrollment.create({ data: { userId: u.id, courseId: C.id, status: "active" } });
    await res(u.id, "e-toan", 100 - i);
    S.push(u);
  }
  await res(S[5].id, "e-ly", 95); await res(S[6].id, "e-ly", 94);   // đề khác kỳ thi, để thử ?category=

  // Ba tài khoản KHÔNG được xuất hiện ở bản công khai, điểm cao hơn mọi người.
  const banned = await mkUser({ name: "Trần Bị Cấm" }); await prisma.user.update({ where: { id: banned.id }, data: { banned: true, school: "THPT Cấm" } }); await res(banned.id, "e-toan", 149);
  const hidden = await mkUser({ name: "Lê Đã Ẩn" }); await prisma.user.update({ where: { id: hidden.id }, data: { deletedAt: new Date(), school: "THPT Ẩn" } }); await res(hidden.id, "e-toan", 148);
  const sys = await mkUser({ name: "Tài Khoản Hệ Thống" }); await prisma.user.update({ where: { id: sys.id }, data: { email: "khach-hoi@he-thong.kin.invalid" } }); await res(sys.id, "e-toan", 147);

  section("Khách — /api/leaderboard");
  const g = await api("GET", "/api/leaderboard");
  check("200 và là mảng", g.status === 200 && Array.isArray(g.json), g.status);
  check("tối đa 10 dòng (có 14 học sinh)", g.json?.length === 10, g.json?.length);
  check("đúng thứ tự điểm: 100, 99, … 91", g.json?.every((r: { best: number }, i: number) => r.best === 100 - i), g.json?.map((r: { best: number }) => r.best));
  check("mỗi dòng chỉ có 4 khoá: name, best, avg, count (không userId, không school)", g.json?.every((r: object) => Object.keys(r).sort().join() === "avg,best,count,name"), g.json?.[0]);
  check("tên đã che: hạng 1 'Nguyễn V. A.', hạng 3 'Nguyễn V. C.'", g.json?.[0]?.name === "Nguyễn V. A." && g.json?.[2]?.name === "Nguyễn V. C.", g.json?.slice(0, 3).map((r: { name: string }) => r.name));
  check("thân phản hồi không chứa tên đầy đủ, tên đệm đầy đủ hay tên trường", !/Văn An|Bình|Cường|THPT|Hà Nội|Chuyên Số/.test(gtext(g)), gtext(g).slice(0, 200));
  check("thân phản hồi không chứa mã học sinh nào", S.every(u => !gtext(g).includes(u.id)));
  check("không có tài khoản bị cấm (149), hệ thống (147), đã ẩn (148)", !g.json?.some((r: { best: number }) => [149, 148, 147].includes(r.best)));
  check("Cache-Control: no-store (không cho trình duyệt / CDN giữ chung bản của khách)", /no-store/.test(g.headers.get("cache-control") ?? ""), g.headers.get("cache-control"));
  const gl = await api("GET", "/api/leaderboard?category=ly");
  check("?category=ly → 2 dòng (95, 94), vẫn che tên", gl.status === 200 && gl.json?.length === 2 && gl.json[0].best === 95 && gl.json[0].name === "Nguyễn V. H." && gl.json[1].name === "Nguyễn V. H.", gl.json);
  const gn = await api("GET", "/api/leaderboard?category=khong-co");
  check("?category=khong-co → [] (200)", gn.status === 200 && Array.isArray(gn.json) && gn.json.length === 0, gn.status);
  for (const [what, q] of [["rất dài", `category=${"x".repeat(5000)}`], ["giống SQL", `category=${encodeURIComponent("'; drop table users; --")}`], ["mảng", "category[]=toan"], ["rỗng", "category="]] as const) {
    const r = await api("GET", `/api/leaderboard?${q}`);
    check(`?${what}: không 500, không lộ trường / mã`, r.status === 200 && Array.isArray(r.json) && !/THPT|"userId"/.test(gtext(r)), r.status);
  }
  const bad = await api("GET", "/api/leaderboard", { headers: { cookie: "midnight_session=khong-phai-phien-that" } });
  check("cookie phiên rác = khách (vẫn che tên, không 500)", bad.status === 200 && bad.json?.every((r: object) => !("school" in r) && !("userId" in r)), bad.status);
  const post = await api("POST", "/api/leaderboard", { body: {} });
  check("POST → 405 (route chỉ có GET)", post.status === 405, post.status);

  section("Học sinh đã đăng nhập — /api/leaderboard như cũ");
  const m = await api("GET", "/api/leaderboard", { as: S[0] });
  check("200, tối đa 20 dòng (có 15: 14 em + tài khoản bị cấm; tài khoản đã ẩn vẫn bị loại)", m.status === 200 && m.json?.length >= 14 && m.json?.length <= 20, m.json?.length);
  const first = m.json?.find((r: { userId: string }) => r.userId === S[0].id);
  check("thấy tên đầy đủ, trường, mã của chính mình và người khác", first?.name === "Nguyễn Văn An" && first?.school === "THPT Chuyên Số 0, Hà Nội" && S.every(u => { const r = m.json?.find((x: { userId: string }) => x.userId === u.id); return !!r && r.name === u.name && !!r.school; }), first);
  check("không có tài khoản đã ẩn (148)", !m.json?.some((r: { best: number }) => r.best === 148));
  check("Cache-Control: no-store", /no-store/.test(m.headers.get("cache-control") ?? ""));
  const mt = await api("GET", "/api/leaderboard", { as: T });
  check("gia sư (đã đăng nhập) cũng thấy bản đầy đủ", mt.status === 200 && mt.json?.[0]?.name?.startsWith("Trần Bị Cấm") === true || mt.json?.some((r: { name: string }) => r.name === "Nguyễn Văn An"), mt.json?.[0]);

  section("Bảng vinh danh — /api/honor-leaderboard bắt đăng nhập");
  const hg = await api("GET", "/api/honor-leaderboard");
  check("khách → 401", hg.status === 401, hg.status);
  check("thân 401 không lộ tên / trường / mã", !/Văn|THPT|"id"|gpa/.test(gtext(hg)), gtext(hg));
  check("401 cũng Cache-Control: no-store", /no-store/.test(hg.headers.get("cache-control") ?? ""));
  const hb = await api("GET", "/api/honor-leaderboard", { headers: { cookie: "midnight_session=khong-phai-phien-that" } });
  check("cookie phiên rác → 401", hb.status === 401, hb.status);
  const hs = await api("GET", "/api/honor-leaderboard", { as: S[0] });
  check("học sinh đã đăng nhập → 200, có tên + trường + GPA", hs.status === 200 && Array.isArray(hs.json) && hs.json.length >= 1 && hs.json.every((r: { name?: string; school?: string; gpa?: number }) => r.name && r.school && typeof r.gpa === "number"), hs.json?.[0]);
  check("không có học sinh đã ẩn trong bảng vinh danh", !hs.json?.some((r: { name: string }) => r.name === "Lê Đã Ẩn"));
  check("Cache-Control: no-store", /no-store/.test(hs.headers.get("cache-control") ?? ""));
  for (const [who, u] of [["gia sư", T], ["quản trị", SA]] as const) {
    const r = await api("GET", "/api/honor-leaderboard", { as: u });
    check(`${who} → 200`, r.status === 200 && Array.isArray(r.json), r.status);
  }
  const hp = await api("POST", "/api/honor-leaderboard", { body: {}, as: S[0] });
  check("POST → 405", hp.status === 405, hp.status);

  if (!EXPECT_CACHE) {
    section("Máy chủ dev (đệm tắt): dữ liệu mới thấy ngay");
    await res(S[13].id, "e-ly", 101);
    const g2 = await api("GET", "/api/leaderboard?category=ly");
    check("thêm điểm mới → lần gọi kế tiếp thấy ngay (101 lên đầu)", g2.json?.[0]?.best === 101, g2.json);
  } else {
    section("Đệm bật (LEADERBOARD_CACHE_SECONDS=300): khoá tách khách / thành viên");
    // THÀNH VIÊN gọi trước kỳ thi 'toan' (chưa ai gọi), rồi KHÁCH gọi cùng đường dẫn: khách KHÔNG được nhận bản đầy đủ đã đệm.
    const mFirst = await api("GET", "/api/leaderboard?category=toan", { as: S[0] });
    const mRow = mFirst.json?.find((r: { userId?: string }) => r.userId === S[0].id);
    check("thành viên gọi trước (toan): có tên đầy đủ + trường", mRow?.name === "Nguyễn Văn An" && mRow?.school === "THPT Chuyên Số 0, Hà Nội", mRow);
    const gAfterM = await api("GET", "/api/leaderboard?category=toan");
    check("khách gọi sau (cùng đường dẫn): vẫn tên che, không trường, không userId, 10 dòng", gAfterM.json?.length === 10 && gAfterM.json[0].name === "Nguyễn V. A." && gAfterM.json.every((r: object) => !("school" in r) && !("userId" in r)) && !/THPT|Văn An/.test(gtext(gAfterM)), gAfterM.json?.[0]);
    // KHÁCH đã mồi kỳ thi 'ly' (ở trên); THÀNH VIÊN gọi sau không được nhận bản che.
    const mAfterG = await api("GET", "/api/leaderboard?category=ly", { as: S[0] });
    check("thành viên gọi sau bản khách đã đệm (ly): vẫn tên đầy đủ + trường", mAfterG.json?.[0]?.name === "Nguyễn Văn Hà" && !!mAfterG.json?.[0]?.school && !!mAfterG.json?.[0]?.userId, mAfterG.json?.[0]);
    // Dữ liệu cũ còn được phát trong hạn đệm.
    await res(S[13].id, "e-ly", 101);
    const gStale = await api("GET", "/api/leaderboard?category=ly");
    check("thêm điểm 101 rồi gọi lại trong hạn → vẫn bản cũ (đệm đang chạy)", gStale.json?.[0]?.best === 95, gStale.json?.[0]);
    const gFresh = await api("GET", "/api/leaderboard?category=lý-khác");
    check("khoá khác (kỳ thi khác) không dính đệm của 'ly'", gFresh.status === 200 && Array.isArray(gFresh.json) && gFresh.json.length === 0);
    // Bảng vinh danh: đệm chung nhưng khách vẫn bị 401 dù đã có bản đệm.
    await api("GET", "/api/honor-leaderboard", { as: S[0] });
    const hgCached = await api("GET", "/api/honor-leaderboard");
    check("sau khi bảng vinh danh đã được đệm, khách vẫn nhận 401 (kiểm đăng nhập chạy TRƯỚC đệm)", hgCached.status === 401, hgCached.status);
  }
  done();
}
main().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
