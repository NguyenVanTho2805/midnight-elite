// MD-02 + MD-17 + MD-11 — API và DB thật: dán link bản ghi gắn buổi, quyền theo vai (chủ lớp / gia sư lớp khác / học sinh ghi danh / chưa ghi danh / chờ đồng ý / khách),
// POST form → 303, gỡ bản ghi, và bảng "ai đã xem" (tên em chỉ cho gia sư chủ lớp). Cần máy chủ thử đang chạy (BASE). Bài gọi wipe(): chỉ DB riêng của worktree.
import { api, mkTutor, mkUser, mkCourse, mkSuper, mkAttendanceSession, wipe, check, section, done, cookieFor, BASE } from "./h";
import { prisma } from "@/lib/prisma";

const YT = "https://youtu.be/dQw4w9WgXcQ";
const SECRET_URL = "https://youtu.be/SECRETsecr"; // đúng 11 ký tự mã
const form = (o: Record<string, string>) => new URLSearchParams(o).toString();
async function postForm(path: string, as: Awaited<ReturnType<typeof mkUser>>, o: Record<string, string>) {
  const res = await fetch(BASE + path, { method: "POST", redirect: "manual", headers: { cookie: await cookieFor(as), "content-type": "application/x-www-form-urlencoded" }, body: form(o) });
  return { status: res.status, location: res.headers.get("location") ?? "", cache: res.headers.get("cache-control") ?? "" };
}
async function page(path: string, as: Awaited<ReturnType<typeof mkUser>> | null) {
  const res = await fetch(BASE + path, { redirect: "manual", headers: as ? { cookie: await cookieFor(as) } : {} });
  return { status: res.status, location: res.headers.get("location") ?? "", text: await res.text() };
}

(async () => {
  await wipe();
  const T = await mkTutor("Cô Chủ Lớp"), T2 = await mkTutor("Thầy Lớp Khác"), ADM = await mkSuper("Quản trị");
  const sIn = await mkUser({ name: "Học sinh Trong Lớp" }), sIn2 = await mkUser({ name: "Học sinh Hai" }), sOut = await mkUser({ name: "Học sinh Ngoài Lớp" }), sPend = await mkUser({ name: "Học sinh Chờ Đồng Ý" });
  const course = await mkCourse(T.id, { name: "Toán 9" }), other = await mkCourse(T2.id, { name: "Lý 9" });
  for (const [u, st] of [[sIn, "active"], [sIn2, "active"], [sPend, "pending_consent"]] as const) await prisma.enrollment.create({ data: { userId: u.id, courseId: course.id, status: st } });
  const ses = await mkAttendanceSession(course.id, T.id, new Date("2026-10-16T00:00:00Z"));
  const sesOther = await mkAttendanceSession(other.id, T2.id, new Date("2026-10-16T00:00:00Z"));
  const R = `/api/courses/${course.id}/recordings`;

  section("MD-02 · dán bản ghi (POST JSON)");
  const ok = await api("POST", R, { as: T, body: { title: "Bản ghi buổi 16/10", url: YT, sessionId: ses.id, pledge: true } });
  check("gia sư chủ lớp: 201, có mã", ok.status === 201 && !!ok.json?.id, ok.json);
  const row = await prisma.classRecording.findFirst({ where: { courseId: course.id } });
  check("lưu đúng: lớp, buổi, loại youtube, người tạo", row?.sessionId === ses.id && row?.kind === "youtube" && row?.createdBy === T.id && row.url === YT, row);
  const bad = async (name: string, body: Record<string, unknown>, expect: RegExp) => { const r = await api("POST", R, { as: T, body: { title: "x", url: YT, pledge: true, ...body } }); check(`${name} → 400`, r.status === 400 && expect.test(r.json?.error ?? ""), r.json); };
  await bad("link lạ", { url: "https://evil.example/v.mp4" }, /YouTube|link/i);
  await bad("giả mạo máy chủ", { url: "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ" }, /.+/);
  await bad("javascript:", { url: "javascript:alert(1)" }, /.+/);
  await bad("video tải lên KiN", { url: "kin-media:abcdefgh12345" }, /chưa nhận/);
  await bad("Azota", { url: "https://azota.vn/de-thi/x" }, /.+/);
  await bad("thiếu tên", { title: "" }, /tên/i);
  await bad("KHÔNG tick cam kết bản quyền (MD-11)", { pledge: false }, /cam kết/);
  await bad("buổi của LỚP KHÁC", { sessionId: sesOther.id }, /không thuộc lớp/);
  await bad("buổi không tồn tại", { sessionId: "khong-co" }, /không thuộc lớp/);
  check("các ca hỏng không ghi gì (vẫn 1 bản ghi)", (await prisma.classRecording.count()) === 1);

  section("MD-02 · quyền ghi theo vai");
  const body = { title: "Lén", url: YT, pledge: true };
  for (const [name, as, want] of [["gia sư LỚP KHÁC", T2, 403], ["học sinh đã ghi danh", sIn, 403], ["học sinh chưa ghi danh", sOut, 403], ["khách", undefined, 401]] as const) {
    const r = await api("POST", R, { as, body }); check(`${name} dán → ${want}`, r.status === want, r.json);
  }
  check("lớp không có → 404", (await api("POST", `/api/courses/khong-co/recordings`, { as: T, body })).status === 404);
  const adm = await api("POST", R, { as: ADM, body: { ...body, title: "Quản trị dán" } });
  check("quản trị cấp 1 dán được", adm.status === 201, adm.json);
  check("không ca nào ở trên ghi lén (còn 2 bản ghi)", (await prisma.classRecording.count()) === 2);

  section("MD-02 · POST từ <form> → 303 về trang Bản ghi");
  const f1 = await postForm(R, T, { title: "Từ form", url: "https://vimeo.com/76979871", sessionId: ses.id, pledge: "on" });
  check("form hợp lệ → 303 ?ok=1, Cache-Control no-store", f1.status === 303 && f1.location.endsWith(`/lop-cua-toi/${course.id}/ban-ghi?ok=1`) && /no-store/.test(f1.cache), f1);
  const f2 = await postForm(R, T, { title: "Từ form", url: "https://evil.example/x", pledge: "on" });
  check("form link xấu → 303 ?loi= (không 400 trắng trang)", f2.status === 303 && /ban-ghi\?loi=/.test(f2.location) && decodeURIComponent(f2.location).includes("YouTube"), f2);
  const f3 = await postForm(R, T, { title: "Từ form", url: YT });
  check("form thiếu tick cam kết → 303 ?loi= nói về cam kết", f3.status === 303 && decodeURIComponent(f3.location).includes("cam kết"), f3);
  const f4 = await postForm(R, T2, { title: "Lén", url: YT, pledge: "on" });
  check("gia sư lớp khác gửi form → 403 (không chuyển trang)", f4.status === 403, f4);
  const nForm = await prisma.classRecording.count({ where: { courseId: course.id } });
  check("chỉ form hợp lệ được ghi", nForm === 3, nForm);

  section("MD-02 · GET danh sách (không lộ link cho người chưa ghi danh)");
  const secret = await prisma.classRecording.create({ data: { courseId: course.id, title: "BÍ MẬT", url: SECRET_URL, kind: "youtube", createdBy: T.id } });
  const g = async (as?: Awaited<ReturnType<typeof mkUser>>) => api("GET", R, { as });
  const gt = await g(T);
  check("chủ lớp: 200, role manager, thấy mọi bản ghi và buổi", gt.status === 200 && gt.json.role === "manager" && gt.json.recordings.length === 4 && gt.json.sessions.some((x: { id: string }) => x.id === ses.id), gt.json);
  const gs = await g(sIn);
  check("học sinh ĐÃ ghi danh: 200, role student, thấy bản ghi", gs.status === 200 && gs.json.role === "student" && gs.json.recordings.some((r: { id: string }) => r.id === secret.id));
  check("JSON trả về KHÔNG chứa tên người nào và không có createdBy", !/Cô Chủ Lớp|Học sinh|createdBy/.test(JSON.stringify(gs.json)), gs.json);
  for (const [name, as, want] of [["học sinh CHƯA ghi danh", sOut, 403], ["học sinh chờ đồng ý (pending_consent)", sPend, 403], ["gia sư LỚP KHÁC", T2, 403], ["khách", undefined, 401]] as const) {
    const r = await g(as);
    check(`${name} → ${want}, không có chuỗi link`, r.status === want && !r.text.includes("SECRETsecr") && !r.text.includes("youtu.be"), r.json);
  }
  check("lớp không có → 404", (await api("GET", `/api/courses/khong-co/recordings`, { as: sIn })).status === 404);
  await prisma.enrollment.update({ where: { userId_courseId: { userId: sIn2.id, courseId: course.id } }, data: { status: "suspended" } });
  check("học sinh tạm ngưng (suspended) vẫn xem lại được", (await g(sIn2)).status === 200);
  await prisma.enrollment.update({ where: { userId_courseId: { userId: sIn2.id, courseId: course.id } }, data: { status: "active" } });

  section("MD-02 · gỡ bản ghi");
  const del = (rid: string, as: Awaited<ReturnType<typeof mkUser>>, cid = course.id) => postForm(`/api/courses/${cid}/recordings/${rid}/delete`, as, {});
  check("học sinh gỡ → 403", (await del(secret.id, sIn)).status === 403);
  check("gia sư lớp khác gỡ → 403", (await del(secret.id, T2)).status === 403);
  check("gia sư lớp khác gỡ qua mã lớp CỦA MÌNH → không xoá được bản ghi lớp này", (await del(secret.id, T2, other.id)).status === 303 && !!(await prisma.classRecording.findUnique({ where: { id: secret.id } })));
  const dd = await del(secret.id, T);
  check("chủ lớp gỡ → 303 ?da-go=1, bản ghi mất", dd.status === 303 && /da-go=1/.test(dd.location) && !(await prisma.classRecording.findUnique({ where: { id: secret.id } })), dd);

  section("Trang /lop-cua-toi/[id]/ban-ghi — quyền và nội dung");
  const pt = await page(`/lop-cua-toi/${course.id}/ban-ghi`, T);
  check("chủ lớp: 200, có form dán link + cam kết + chữ KiN chỉ lưu link", pt.status === 200 && /Dán link bản ghi/.test(pt.text) && /name="pledge"/.test(pt.text) && /chỉ lưu đường link/.test(pt.text));
  check("trang liệt kê bản ghi đã gắn buổi 16/10/2026", /Buổi 16\/10\/2026/.test(pt.text) && /Bản ghi buổi 16\/10/.test(pt.text));
  const pl = await page(`/lop-cua-toi/${course.id}/ban-ghi`, T2);
  check("gia sư lớp khác: 404, không lộ tên lớp và không có link", pl.status === 404 && !/Toán 9/.test(pl.text) && !pl.text.includes("youtu.be/dQw4w9WgXcQ"));
  const ps = await page(`/lop-cua-toi/${course.id}/ban-ghi`, sIn);
  check("học sinh: chuyển sang Lớp của tôi (307), không đọc được trang gia sư", ps.status === 307 && ps.location.includes(`/student/hoc-tap?course=${course.id}`), ps);
  const po = await page(`/lop-cua-toi/${course.id}/ban-ghi`, sOut);
  check("học sinh chưa ghi danh: 404, không lộ link", po.status === 404 && !po.text.includes("youtu.be"));
  const pg = await page(`/lop-cua-toi/${course.id}/ban-ghi`, null);
  check("khách: chuyển sang đăng nhập kèm redirect", [307, 302, 303].includes(pg.status) && pg.location.includes("/dang-nhap") && pg.location.includes("redirect="), pg);

  section("MD-17 · ai đã xem video (LessonProgress), theo lớp");
  const sec = await prisma.section.create({ data: { id: "s-w", title: "P1", courseId: course.id, order: 0 } });
  const ch = await prisma.chapter.create({ data: { id: "c-w", title: "C1", sectionId: sec.id, order: 0 } });
  const mkL = (id: string, o: Record<string, unknown>, order: number) => prisma.lesson.create({ data: { id, code: id, title: `Bài ${id}`, type: "record", chapterId: ch.id, order, isLocked: false, ...o } as never });
  const L1 = await mkL("w1", { videoUrl: YT }, 0), L2 = await mkL("w2", { videoUrl: "https://vimeo.com/76979871" }, 1), Ln = await mkL("w3", { videoUrl: null }, 2);
  await prisma.lessonProgress.create({ data: { userId: sIn.id, lessonId: L1.id, completed: true, watchedSeconds: 500 } });
  await prisma.lessonProgress.create({ data: { userId: sIn.id, lessonId: L2.id, completed: false, watchedSeconds: 30 } });
  await prisma.lessonProgress.create({ data: { userId: sOut.id, lessonId: L1.id, completed: true, watchedSeconds: 500 } }); // em KHÔNG thuộc lớp
  await prisma.lessonProgress.create({ data: { userId: sIn2.id, lessonId: Ln.id, completed: true, watchedSeconds: 5 } }); // bài không video
  const pw = await page(`/lop-cua-toi/${course.id}/ban-ghi`, T);
  check("bảng có đủ 2 video (không có bài không-video)", /data-watch-lesson="w1"/.test(pw.text) && /data-watch-lesson="w2"/.test(pw.text) && !/data-watch-lesson="w3"/.test(pw.text));
  check("gia sư chủ lớp thấy tên các em TRONG lớp", pw.text.includes("Học sinh Trong Lớp") && pw.text.includes("Học sinh Hai"));
  check("KHÔNG có tên em chưa ghi danh hoặc đang chờ đồng ý (dữ liệu trẻ)", !pw.text.includes("Học sinh Ngoài Lớp") && !pw.text.includes("Học sinh Chờ Đồng Ý"));
  check("số tổng bài 1: xong 1 · đang xem 0 · chưa 1 (em ngoài lớp không tính)", /Đã xem xong 1 · Đang xem 0 · Chưa xem 1/.test(pw.text.replace(/<!-- -->/g, "")));
  check("số tổng bài 2: đang xem 1", /Đã xem xong 0 · Đang xem 1 · Chưa xem 1/.test(pw.text.replace(/<!-- -->/g, "")));
  const pa = await page(`/lop-cua-toi/${course.id}/ban-ghi`, ADM);
  check("quản trị (không phải chủ lớp): thấy số tổng nhưng KHÔNG thấy tên em", pa.status === 200 && /data-watch-lesson="w1"/.test(pa.text) && !pa.text.includes("Học sinh Trong Lớp") && !/data-watch-student=/.test(pa.text));

  section("BC-03 · tiến độ học liệu trong báo cáo tháng (chỉ đếm số có sẵn)");
  const Laz = await mkL("w4", { type: "quiz", azotaUrl: "https://azota.vn/de-thi/abc" }, 3);
  const secO = await prisma.section.create({ data: { id: "s-o", title: "P1", courseId: other.id, order: 0 } });
  const chO = await prisma.chapter.create({ data: { id: "c-o", title: "C1", sectionId: secO.id, order: 0 } });
  const LO = await prisma.lesson.create({ data: { id: "wo1", code: "wo1", title: "Bài lớp khác", type: "record", chapterId: chO.id, order: 0, isLocked: false, videoUrl: YT } as never });
  await prisma.lessonProgress.create({ data: { userId: sIn.id, lessonId: LO.id, completed: true, watchedSeconds: 9 } }); // ở lớp KHÁC: không được tính vào lớp này
  const ym = new Date().toISOString().slice(0, 7);
  const rp = await api("GET", `/api/tutor/monthly-reports/${sIn.id}?yearMonth=${ym}`, { as: T });
  const subj = rp.json?.subjects?.find((x: { courseId: string }) => x.courseId === course.id);
  check("báo cáo có media: 2 video, đã xem 1 (xong), Azota 1 chưa báo", rp.status === 200 && subj?.media?.videosTotal === 2 && subj.media.videosWatched === 1 && subj.media.azotaTotal === 1 && subj.media.azotaPending === 1, subj?.media);
  check("bài ở lớp khác và bài 'đang xem' không làm tăng số đã xem", subj?.media?.videosWatched === 1);
  check("văn bản gửi phụ huynh có dòng Học liệu trên KiN", /Học liệu trên KiN \(tính đến lúc lập báo cáo\): đã xem 1\/2 video bài giảng; 1\/1 bài Azota chưa báo đã làm/.test(rp.json?.text ?? ""), rp.json?.text);
  await prisma.lessonAzotaDone.create({ data: { lessonId: Laz.id, userId: sIn.id, kind: "done" } });
  const rp2 = await api("GET", `/api/tutor/monthly-reports/${sIn.id}?yearMonth=${ym}`, { as: T });
  check("em báo đã làm Azota → còn 0 chưa báo, chữ đổi", rp2.json?.subjects?.find((x: { courseId: string }) => x.courseId === course.id)?.media?.azotaPending === 0 && /đã báo làm hết bài Azota/.test(rp2.json?.text ?? ""));
  const rp3 = await api("GET", `/api/tutor/monthly-reports/${sIn2.id}?yearMonth=${ym}`, { as: T });
  check("em khác: tiến độ riêng của em (đã xem 0/2), không lẫn của sIn", rp3.json?.subjects?.find((x: { courseId: string }) => x.courseId === course.id)?.media?.videosWatched === 0);
  const rp4 = await api("GET", `/api/tutor/monthly-reports/${sIn.id}?yearMonth=${ym}`, { as: T2 });
  check("gia sư lớp khác không đọc được báo cáo của em này (404)", rp4.status === 404);

  section("Chuyển hướng, lớp 2 không bị lẫn");
  const api2 = await api("GET", `/api/courses/${other.id}/recordings`, { as: T2 });
  check("lớp khác của gia sư khác: danh sách rỗng, không lẫn bản ghi lớp này", api2.status === 200 && api2.json.recordings.length === 0, api2.json);
  done();
})();
