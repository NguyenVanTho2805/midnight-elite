// GET /api/admin/kiem-duyet (và ?badge=1): hàng chờ gộp theo QUYỀN từng vai — quản lý trung tâm thấy hết, giáo viên chỉ thấy báo cáo trong lớp mình,
// học sinh bị chặn; và các lệnh của khung đọc gọi đúng API xử lý cũ rồi dòng biến mất.
import { prisma } from "@/lib/prisma";
import { api, mkTutor, mkUser, mkCourse, mkSuper, wipe, check, section, done } from "./h";

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1");
  const CA = await mkUser({ name: "Quản trị nội dung", role: "admin", adminRole: "admin_content" });
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Khác");
  const S = await mkUser({ name: "Học sinh" });
  const A = await mkUser({ name: "Em An" }), B = await mkUser({ name: "Em Bình" });
  const mine = await mkCourse(T.id, { name: "Toán 9 của cô Lan" }), other = await mkCourse(T2.id, { name: "Lý 9 của thầy Khác" });

  // hồ sơ gia sư xin duyệt: một người đã xác thực email, một người chưa
  const ok = await mkUser({ name: "Gia sư chờ duyệt", emailVerified: true });
  const unv = await mkUser({ name: "Gia sư chưa xác thực", emailVerified: false });
  const when = new Date(Date.now() - 3 * 86_400_000);
  await prisma.user.update({ where: { id: ok.id }, data: { tutorAppliedAt: when, bio: "Dạy Toán 8 năm", subjects: ["Toán"], city: "Hà Nội" } });
  await prisma.user.update({ where: { id: unv.id }, data: { tutorAppliedAt: new Date(when.getTime() + 1000) } });

  const th = (content: string, courseId: string | null) => prisma.thread.create({ data: { content, authorId: A.id, courseId, category: "hoi-dap" } });
  const tMine = await th("BAI_CUA_LOP_TOI", mine.id), tOther = await th("BAI_CUA_LOP_KHAC", other.id), tChung = await th("BAI_CHUNG", null);
  const trep = (threadId: string, reason: string) => prisma.threadReport.create({ data: { threadId, reporterId: B.id, reason } });
  const rMine = await trep(tMine.id, "Lạc đề"), rOther = await trep(tOther.id, "Spam"), rChung = await trep(tChung.id, "Quảng cáo");

  const q = await prisma.question.create({ data: { authorId: A.id, title: "CAU_HOI_X", content: "nội dung", bountyPaid: 0 } });
  const answer = await prisma.answer.create({ data: { questionId: q.id, authorId: A.id, content: "Trả lời sai", rewardPaid: 20 } });
  await prisma.answerReport.create({ data: { answerId: answer.id, reporterId: B.id, reason: "Sai kiến thức" } });
  const pr = await prisma.tutorProfileReport.create({ data: { tutorId: T.id, reason: "Ảnh không phải của gia sư" } });

  const get = (as: any, p = "/api/admin/kiem-duyet") => api("GET", p, { as });
  const kinds = (r: any) => r.json.items.map((i: any) => i.id.split(":")[0]).sort().join(",");

  section("Cần đăng nhập và đúng vai");
  check("không cookie → 401", (await get(undefined)).status === 401);
  check("học sinh → 403 (cả ?badge=1)", (await get(S)).status === 403 && (await get(S, "/api/admin/kiem-duyet?badge=1")).status === 403);

  section("Quản trị cấp 1 thấy mọi loại");
  let r = await get(SA);
  check("200 và đủ bốn loại: gia-su ×2, bai-viet ×3, ho-so ×1, tra-loi ×1", r.status === 200 && kinds(r) === "bai-viet,bai-viet,bai-viet,gia-su,gia-su,ho-so,tra-loi", kinds(r));
  check("badge = tổng số dòng (7)", r.json.badge === 7 && r.json.items.length === 7);
  check("chờ lâu nhất lên trước: hai hồ sơ gia sư (3 ngày trước) đứng đầu", r.json.items[0].kind === "gia-su" && r.json.items[1].kind === "gia-su");
  const rb = await get(SA, "/api/admin/kiem-duyet?badge=1");
  check("?badge=1 chỉ trả { badge }", rb.status === 200 && rb.json.badge === 7 && rb.json.items === undefined, rb.json);
  const unvItem = r.json.items.find((i: any) => i.id === `gia-su:${unv.id}`);
  check("người chưa xác thực email: nút Duyệt bị khoá, có chữ báo", unvItem.status.label === "Chưa xác thực email" && !!unvItem.detail.actions[0].disabled);
  check("không lộ mật khẩu / băm / dữ liệu thừa của người nộp đơn", !/password|\$2[aby]\$|viewToken|payoutAccount/i.test(r.text));

  section("Quản trị nội dung (admin_content)");
  r = await get(CA);
  check("thấy cả bốn loại (có MANAGE_TUTORS và MANAGE_COMMUNITY)", r.status === 200 && kinds(r) === "bai-viet,bai-viet,bai-viet,gia-su,gia-su,ho-so,tra-loi", kinds(r));

  section("Giáo viên: chỉ báo cáo bài viết trong lớp do mình sở hữu");
  r = await get(T);
  check("200; chỉ 1 dòng: bài viết của lớp mình", r.status === 200 && r.json.items.length === 1 && r.json.items[0].id === `bai-viet:${rMine.id}`, r.json.items?.map((i: any) => i.id));
  check("không thấy báo cáo bài chung, bài lớp khác, hồ sơ gia sư, câu trả lời", !r.text.includes("BAI_CHUNG") && !r.text.includes("BAI_CUA_LOP_KHAC") && !r.text.includes("Ảnh không phải") && !r.text.includes("CAU_HOI_X") && !r.text.includes(unv.name));
  check("badge của giáo viên = 1", r.json.badge === 1 && (await get(T, "/api/admin/kiem-duyet?badge=1")).json.badge === 1);
  r = await get(T2);
  check("giáo viên khác thấy đúng báo cáo lớp của họ, không phải của cô Lan", r.json.items.length === 1 && r.json.items[0].id === `bai-viet:${rOther.id}` && !r.text.includes("BAI_CUA_LOP_TOI"));

  section("Lệnh trong khung đọc gọi đúng API cũ");
  const act = async (as: any, a: any, extra: Record<string, unknown> = {}) => api(a.method, a.url, { as, body: { ...(a.body ?? {}), ...extra } });
  r = await get(SA);
  const okItem = r.json.items.find((i: any) => i.id === `gia-su:${ok.id}`);
  check("Từ chối không có lý do → 400 (API bắt buộc lý do)", (await act(SA, okItem.detail.actions[1], { reason: "" })).status === 400);
  check("Duyệt người đã xác thực email → 200, thành gia sư", (await act(SA, okItem.detail.actions[0])).status === 200 && (await prisma.user.findUnique({ where: { id: ok.id } }))?.tutorVerified === true);
  check("duyệt xong: dòng biến mất khỏi hàng chờ", !(await get(SA)).json.items.some((i: any) => i.id === `gia-su:${ok.id}`));
  check("Duyệt lại lần hai → 409 (đã xử lý, không duyệt đôi)", (await act(SA, okItem.detail.actions[0])).status === 409);
  check("người chưa xác thực email: Duyệt → 409 (chặn ở máy chủ, không chỉ ở nút)", (await act(SA, unvItem.detail.actions[0])).status === 409);
  check("Từ chối kèm lý do → 200, dòng biến mất", (await act(SA, unvItem.detail.actions[1], { reason: "Chưa đủ thông tin" })).status === 200 && !(await get(SA)).json.items.some((i: any) => i.id === `gia-su:${unv.id}`));
  const tItem = (await get(SA)).json.items.find((i: any) => i.id === `bai-viet:${rChung.id}`);
  check("Gỡ bài viết: giáo viên KHÔNG xử lý được báo cáo bài chung (403)", (await act(T, tItem.detail.actions[0])).status === 403);
  check("quản trị Gỡ bài → 200, bài bị xoá mềm (giữ bằng chứng), dòng biến mất", (await act(SA, tItem.detail.actions[0])).status === 200 && !!(await prisma.thread.findUnique({ where: { id: tChung.id } }))?.deletedAt && !(await get(SA)).json.items.some((i: any) => i.id === `bai-viet:${rChung.id}`));
  const mItem = (await get(T)).json.items[0];
  check("giáo viên Giữ bài lại của lớp mình → 200, bài còn nguyên", (await act(T, mItem.detail.actions[1])).status === 200 && (await prisma.thread.findUnique({ where: { id: tMine.id } }))?.deletedAt === null && (await get(T)).json.items.length === 0);
  const pItem = (await get(SA)).json.items.find((i: any) => i.id === `ho-so:${pr.id}`);
  check("Khoá hồ sơ không có lý do → 400", (await act(SA, pItem.detail.actions[0], { reason: "" })).status === 400);
  check("Khoá hồ sơ kèm lý do → 200, hồ sơ công khai bị khoá", (await act(SA, pItem.detail.actions[0], { reason: "Ảnh giả mạo" })).status === 200 && !!(await prisma.user.findUnique({ where: { id: T.id } }))?.profileLockedAt);
  check("báo cáo câu trả lời: không có lệnh trong hàng chờ, báo cáo vẫn đang chờ (chưa trừ xu)", (await get(SA)).json.items.filter((i: any) => i.kind === "tra-loi").every((i: any) => i.detail.actions.length === 0) && (await prisma.answer.findUnique({ where: { id: answer.id } }))?.isPenalized === false);
  r = await get(SA);
  check("còn lại đúng 2 dòng: bài lớp Lý (giáo viên khác) và câu trả lời", r.json.items.length === 2 && r.json.badge === 2 && kinds(r) === "bai-viet,tra-loi", kinds(r));

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
