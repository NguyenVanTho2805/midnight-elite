// Trang chủ "/" — bảng tin công khai (BU-HS-TRANG-CHU mục 8): khách GET /api/community/feed?tab=all&scope=common&limit=5.
// API THẬT + DB. Cần máy chủ dev cổng 3100 + DB kin_test, đã `source tools/local-e2e/env.sh`. Bài tự `wipe()` rồi dựng dữ liệu của nó; không chạy cùng lúc với bài khác.
// Cờ KIN_GUEST_QUESTIONS của máy chủ không ảnh hưởng bài này (chỉ ĐỌC feed; không gửi câu hỏi của khách).
//
// CA PHÁ CỐ Ý (đổi MỘT dòng trong src/ rồi chạy lại — bài phải ĐỎ; hoàn lại sau khi thử):
//  • Khách thấy câu hỏi cũ — communityServer.ts: bỏ `viewerId !== null &&` ở `includeLegacy`            → "khách không nhận source:question" đỏ.
//  • Lộ khoá          — communityServer.AUTHOR_SELECT thêm `email: true` (và trả author thô)           → quét khoá `email` + chuỗi email thật đỏ.
//  • Lộ tên đầy đủ     — communityRules.publicName luôn trả tên đầy đủ                                  → "author.label không chứa họ tên đầy đủ" đỏ.
//  • Bài chờ duyệt     — communityServer.publishedThreadWhere: bỏ `status: "published"`                → "pending/rejected/xoá mềm không có trong feed" đỏ.
//  • Bài của lớp       — communityServer: `scope === "common"` dùng visibleThreadScope thay `courseId: null` → "không có bài của lớp" đỏ (cả khách lẫn học sinh trong lớp).
//  • Giới hạn          — communityServer.parseLimit: bỏ kiểm `n <= MAX_LIMIT`                          → "limit=51 → 400" đỏ.
import { api, mkUser, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

const FEED = "/api/community/feed?tab=all&scope=common&limit=5";
const FORBIDDEN_KEYS = ["email", "phone", "zaloPhone", "school", "highSchool", "city", "dateOfBirth", "avatarBase64", "guestIpHash", "reviewedById", "rejectReason", "password", "phoneE164", "passwordHash"];
const keysIn = (v: unknown, path = "$", out: string[] = []): string[] => {
  if (Array.isArray(v)) v.forEach((x, i) => keysIn(x, `${path}[${i}]`, out));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { if (FORBIDDEN_KEYS.includes(k)) out.push(`${path}.${k}`); keysIn(x, `${path}.${k}`, out); }
  return out;
};
const stamp = Date.now().toString(36);
const ipHash = `iphash-${stamp}-khong-duoc-lo`;
const rejectNote = `ly-do-tu-choi-${stamp}-noi-bo`;

(async () => {
  await wipe();

  // ═════ Thế giới thử ═════
  const FULL_NAME = "Nguyễn Văn Quân Anh";
  const EMAIL = `hs-rieng-${stamp}@test.local`;
  const stu = await mkUser({ name: FULL_NAME });
  await prisma.user.update({ where: { id: stu.id }, data: { email: EMAIL, phone: "0912345678", zaloPhone: "0987654321", school: `THPT Bí Mật ${stamp}`, highSchool: `THPT Bí Mật ${stamp}`, city: `Thành Phố Bí Mật ${stamp}`, dateOfBirth: new Date("2010-03-04") } });
  stu.email = EMAIL;
  const tutor = await mkTutor("Cô Lan Hương");
  const inClass = await mkUser({ name: "Học Sinh Trong Lớp" });
  const outsider = await mkUser({ name: "Người Ngoài" });
  const course = await mkCourse(tutor.id, { name: "Lớp thử trang chủ" });
  await prisma.enrollment.create({ data: { userId: inClass.id, courseId: course.id, status: "active" } });
  const guestUser = await mkUser({ name: "Khách hệ thống" });
  // Người duyệt PHẢI là một người KHÁC mọi tác giả hiển thị trên bảng tin: `author.id` của bài đã công bố là công khai theo thiết kế (FeedAuthor {id,label,tag,href}),
  // nên nếu người duyệt trùng tác giả (trước đây dùng chính `tutor`) thì ca "không chứa id người duyệt" đỏ oan (stu-test 09/11).
  const reviewer = await mkTutor("Người Duyệt Riêng");

  const mkPost = (o: { authorId: string; content: string; courseId?: string | null; status?: string; deleted?: boolean; kind?: "post" | "question"; guestName?: string | null; at?: number }) =>
    prisma.thread.create({ data: {
      authorId: o.authorId, content: o.content, kind: o.kind ?? "post", category: o.kind === "question" ? "hoi-dap" : "kinh-nghiem", title: o.kind === "question" ? `Câu hỏi ${o.content}` : null,
      courseId: o.courseId ?? null, status: o.status ?? "published", guestName: o.guestName ?? null, guestIpHash: o.guestName ? ipHash : null,
      reviewedById: o.status === "rejected" ? reviewer.id : null, rejectReason: o.status === "rejected" ? rejectNote : null,
      deletedAt: o.deleted ? new Date() : null, createdAt: new Date(Date.now() - (o.at ?? 0) * 60_000),
    } });

  // 7 bài chung đã công bố (nhiều hơn limit=5) — đứng đầu bằng tác giả là học sinh có đủ thông tin riêng tư.
  const common: { id: string }[] = [];
  for (let i = 0; i < 7; i++) common.push(await mkPost({ authorId: i === 0 ? stu.id : tutor.id, content: `BAI-CHUNG-${stamp}-${i}`, at: i }));
  // Phải KHÔNG lọt:
  const classPost = await mkPost({ authorId: tutor.id, content: `BAI-LOP-${stamp}`, courseId: course.id });
  const pending = await mkPost({ authorId: guestUser.id, content: `BAI-CHO-DUYET-${stamp}`, status: "pending", kind: "question", guestName: "Khách Ẩn Danh" });
  const rejected = await mkPost({ authorId: guestUser.id, content: `BAI-BI-TU-CHOI-${stamp}`, status: "rejected", kind: "question", guestName: "Khách Bị Loại" });
  const deleted = await mkPost({ authorId: tutor.id, content: `BAI-DA-XOA-${stamp}`, deleted: true });
  const newQuestion = await mkPost({ authorId: stu.id, content: `CAU-HOI-MOI-${stamp}`, kind: "question", at: 1 });
  const legacyQ = await prisma.question.create({ data: { authorId: stu.id, title: `CAU-HOI-CU-${stamp}`, content: "nội dung câu hỏi cũ", bountyPaid: 0, status: "open" } });
  await prisma.answer.create({ data: { questionId: legacyQ.id, authorId: tutor.id, content: "trả lời cũ" } });
  void classPost; void pending; void rejected; void deleted; void newQuestion;

  const all = (r: { json: any }): any[] => [...(r.json?.pinned ?? []), ...(r.json?.items ?? [])];

  // ═════ 1. Khách ═════
  section("Khách: GET feed?tab=all&scope=common&limit=5");
  const g = await api("GET", FEED);
  check("200", g.status === 200, g.status);
  check("JSON có pinned và items là mảng", Array.isArray(g.json?.pinned) && Array.isArray(g.json?.items), Object.keys(g.json ?? {}));
  check("items ≤ 5 (limit=5)", g.json?.items?.length <= 5 && g.json?.items?.length > 0, g.json?.items?.length);
  check("có nextCursor vì còn bài (7 bài chung > 5)", typeof g.json?.nextCursor === "string" && g.json.nextCursor.length > 0, g.json?.nextCursor);
  check("không đọc được bằng bộ nhớ đệm dùng chung (no-store / private)", /no-store|private/.test(g.headers.get("cache-control") ?? ""), g.headers.get("cache-control"));

  section("Khách: không lộ khoá / chuỗi riêng tư");
  check("không khoá nào trong danh sách cấm (email, phone, school, city, dateOfBirth, guestIpHash, reviewedById, rejectReason, …)", keysIn(g.json).length === 0, keysIn(g.json));
  for (const k of ["email", "phone", "school", "city", "dateOfBirth", "guestIpHash", "reviewedById", "rejectReason"]) check(`thân trả về không có khoá "${k}"`, !g.text.includes(`"${k}"`));
  for (const [what, val] of [["email thật của học sinh", EMAIL], ["số điện thoại", "0912345678"], ["số Zalo", "0987654321"], ["tên trường", `THPT Bí Mật ${stamp}`], ["thành phố", `Thành Phố Bí Mật ${stamp}`], ["ngày sinh", "2010-03-04"], ["băm IP của khách", ipHash], ["lý do từ chối", rejectNote], ["id người duyệt", reviewer.id]] as const) {
    check(`thân trả về không chứa ${what}`, !g.text.includes(val));
  }
  check("tên đầy đủ của học sinh không xuất hiện (author.label đã rút gọn)", !g.text.includes(FULL_NAME) && all(g).every(i => !String(i.author?.label ?? "").includes(FULL_NAME)), all(g).map(i => i.author?.label));
  const mine = all(g).find(i => String(i.excerpt ?? i.content ?? "").includes(`BAI-CHUNG-${stamp}-0`) || JSON.stringify(i).includes(`BAI-CHUNG-${stamp}-0`));
  check("bài của học sinh có mặt và nhãn tác giả là chuỗi không rỗng, khác tên đầy đủ", !!mine && typeof mine.author?.label === "string" && mine.author.label.length > 0 && mine.author.label !== FULL_NAME, mine?.author);
  check("likedByMe / bookmarkedByMe / isOwn đều false với khách", all(g).every(i => i.likedByMe === false && i.bookmarkedByMe === false && i.isOwn === false), all(g).map(i => [i.likedByMe, i.bookmarkedByMe, i.isOwn]));

  section("Khách: không nhận câu hỏi, bài lớp, bài chờ duyệt");
  check("không có mục source:'question' (STU-006 — câu hỏi cũ chỉ cho người đăng nhập)", all(g).every(i => i.source !== "question"), all(g).map(i => i.source));
  check("không có câu hỏi cũ (đã dựng một câu có trả lời)", !g.text.includes(`CAU-HOI-CU-${stamp}`) && !g.text.includes(legacyQ.id));
  check("không có bài nào gắn lớp (course luôn null với scope=common)", all(g).every(i => i.course === null || i.course === undefined), all(g).map(i => i.course));
  check("bài của lớp không có trong kết quả", !g.text.includes(`BAI-LOP-${stamp}`));
  check("bài chờ duyệt không lộ", !g.text.includes(`BAI-CHO-DUYET-${stamp}`) && !g.text.includes("Khách Ẩn Danh"));
  check("bài bị từ chối không lộ", !g.text.includes(`BAI-BI-TU-CHOI-${stamp}`) && !g.text.includes("Khách Bị Loại"));
  check("bài xoá mềm không lộ", !g.text.includes(`BAI-DA-XOA-${stamp}`));
  const page2 = await api("GET", `${FEED}&cursor=${encodeURIComponent(g.json?.nextCursor ?? "")}`);
  const seen = new Set(all(g).map(i => i.id));
  check("trang 2 theo con trỏ: 200, không lặp mục trang 1, vẫn không có bài lớp / chờ duyệt / xoá", page2.status === 200 && all(page2).every(i => !seen.has(i.id)) && !page2.text.includes(`BAI-LOP-${stamp}`) && !page2.text.includes(`BAI-CHO-DUYET-${stamp}`) && !page2.text.includes(`BAI-DA-XOA-${stamp}`), page2.status);
  check("tab hoi-dap cho khách: không có câu hỏi chờ duyệt / cũ", await (async () => { const r = await api("GET", "/api/community/feed?tab=hoi-dap&scope=common&limit=5"); return r.status === 200 && !r.text.includes(`BAI-CHO-DUYET-${stamp}`) && !r.text.includes(`CAU-HOI-CU-${stamp}`); })());

  section("limit hợp lệ / không hợp lệ");
  for (const bad of ["0", "51", "abc", "-1", "5.5", "999999", "1e1", "%20"]) {
    const r = await api("GET", `/api/community/feed?tab=all&scope=common&limit=${bad}`);
    check(`limit=${bad} → 400 limit_invalid`, r.status === 400 && (r.json?.error === "limit_invalid" || r.json?.code === "limit_invalid" || JSON.stringify(r.json).includes("limit_invalid")), [r.status, r.json]);
  }
  for (const ok of ["1", "5", "50"]) check(`limit=${ok} → 200`, (await api("GET", `/api/community/feed?tab=all&scope=common&limit=${ok}`)).status === 200);
  check("limit=1 → đúng ≤1 mục trong items", (await api("GET", "/api/community/feed?tab=all&scope=common&limit=1")).json?.items?.length <= 1);
  check("tab lạ → 400, không 500", (await api("GET", "/api/community/feed?tab=lung-tung&scope=common&limit=5")).status === 400);
  check("con trỏ rác → 400, không 500", (await api("GET", `${FEED}&cursor=khong-phai-con-tro`)).status === 400);

  // ═════ 2. Học sinh trong lớp ═════
  section("Học sinh trong lớp: scope=common vẫn không có bài của lớp");
  const m = await api("GET", FEED, { as: inClass });
  check("200", m.status === 200, m.status);
  check("không có bài của lớp dù là thành viên (trang chủ là bộ mặt công khai)", !m.text.includes(`BAI-LOP-${stamp}`) && all(m).every(i => i.course === null || i.course === undefined), all(m).map(i => i.course));
  check("không lộ khoá riêng tư với học sinh", keysIn(m.json).length === 0 && !m.text.includes(EMAIL) && !m.text.includes(rejectNote) && !m.text.includes(ipHash), keysIn(m.json));
  check("tên đầy đủ của học sinh khác không lộ", !m.text.includes(FULL_NAME));
  check("bài chờ duyệt / bị từ chối / xoá vẫn không lộ với học sinh", !m.text.includes(`BAI-CHO-DUYET-${stamp}`) && !m.text.includes(`BAI-BI-TU-CHOI-${stamp}`) && !m.text.includes(`BAI-DA-XOA-${stamp}`));
  check("items ≤ 5", m.json?.items?.length <= 5);
  const o = await api("GET", FEED, { as: outsider });
  check("người ngoài lớp: cùng kết luận (không bài lớp)", o.status === 200 && !o.text.includes(`BAI-LOP-${stamp}`));

  // ═════ 3. Khách không vào được API học sinh / không đăng được từ trang chủ ═════
  section("Khách gọi API học sinh → không có dữ liệu của ai (401, hoặc 200 với mảng RỖNG theo thiết kế có sẵn của hai API dùng chung với trang khách)");
  // stu-test 09/11/2026: đặc tả mục 8 ghi "→ 401" cho cả ba, nhưng /api/enrollments và /api/progress CHỦ ĐÍCH trả 200 + mảng rỗng khi chưa đăng nhập
  // (enrollments/route.ts:13 "Chưa đăng nhập → ba mảng rỗng"; useMyClasses/useProgress dùng chung ở trang khách). Hai API không đổi trong BU-HS-TRANG-CHU → kỳ vọng 401 là lỗi của đặc tả/bài, không phải mã.
  // Giữ khẳng định mạnh nhất còn đúng: không lộ dữ liệu (mọi mảng rỗng); /api/student/viec-cua-toi vẫn phải 401.
  for (const p of ["/api/enrollments?detail=1", "/api/progress"]) {
    const r = await api("GET", p);
    const arrays = Object.values(r.json ?? {}).filter(Array.isArray) as unknown[][];
    check(`GET ${p} → 200 và mọi mảng rỗng (không dữ liệu của ai)`, r.status === 200 && arrays.length > 0 && arrays.every(a => a.length === 0), [r.status, r.text.slice(0, 120)]);
  }
  {
    const r = await api("GET", "/api/student/viec-cua-toi");
    check("GET /api/student/viec-cua-toi → 401", r.status === 401, r.status);
  }
  const pt = await api("POST", "/api/community/threads", { body: { content: "khách thử đăng từ trang chủ", category: "kinh-nghiem" } });
  check("POST /api/community/threads → 401 (khách không đăng được bài thường)", pt.status === 401, [pt.status, pt.json]);
  check("…và không tạo hàng nào", await prisma.thread.count({ where: { content: "khách thử đăng từ trang chủ" } }) === 0);

  void common;
  await done();
})().catch(e => { console.error(e); process.exit(1); });
