// NC2-046 — kho tài liệu có tìm kiếm qua API (cơ sở dữ liệu thật): chỉ quản lý trung tâm quản video; kiểm nghiêm; trùng video → 409 (kể cả khi gửi song song);
// tìm công khai CHỈ trả tài liệu bài miễn phí của khoá đang mở + video đã công khai — tài liệu riêng của lớp, khoá đóng, video nháp, dòng hỏng KHÔNG bao giờ ra, dù người gọi là ai.
import { api, mkUser, mkTutor, mkSuper, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";

const A = "/api/admin/thu-vien-video", Q = "/api/thu-vien/tim";
const ID1 = "dQw4w9WgXcQ", ID2 = "abcdefghijk", ID3 = "lmnopqrstuv";
const rndIp = () => `10.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}.${Math.floor(Math.random() * 250) + 1}`;
const search = (q: string, as?: Awaited<ReturnType<typeof mkUser>>, ip = rndIp()) => api("GET", `${Q}?q=${encodeURIComponent(q)}`, { as, headers: { "x-forwarded-for": ip } });
const V1 = { title: "Chiến tranh lạnh 1947–1991", url: `https://www.youtube.com/watch?v=${ID1}`, topics: "Chiến tranh lạnh, Lịch sử 12", channel: "Thầy A", note: "Xem từ phút 3", published: false };

(async () => {
  await wipe();
  const SA = await mkSuper("Quản trị cấp 1"), CT = await mkUser({ name: "Biên tập", role: "admin", adminRole: "admin_content" });
  const T = await mkTutor("Cô Lan"), S = await mkUser({ name: "Minh Anh" }), O = await mkUser({ name: "Bạn Ngoài Lớp" });

  // Dữ liệu tài liệu: lớp mở (công khai bài miễn phí; bài trả phí là RIÊNG của lớp) và một khoá đóng.
  const C1 = await mkCourse(T.id, { name: "Sử 12 nâng cao" }), C2 = await mkCourse(T.id, { name: "Khoá đã đóng" });
  await prisma.course.update({ where: { id: C1.id }, data: { status: true } });
  await prisma.course.update({ where: { id: C2.id }, data: { status: false } });
  const sec1 = await prisma.section.create({ data: { id: "s1", title: "Phần 1", order: 1, courseId: C1.id } }), ch1 = await prisma.chapter.create({ data: { id: "ch1", title: "Chương 1", order: 1, sectionId: sec1.id } });
  const sec2 = await prisma.section.create({ data: { id: "s2", title: "Phần 1", order: 1, courseId: C2.id } }), ch2 = await prisma.chapter.create({ data: { id: "ch2", title: "Chương 1", order: 1, sectionId: sec2.id } });
  const docs = (name: string, url: string) => JSON.stringify([{ name, url, type: "pdf" }]);
  const lesson = (id: string, title: string, o: Record<string, unknown>, ch: string) => prisma.lesson.create({ data: { id, code: id, title, type: "record", order: 1, chapterId: ch, ...o } as never });
  await lesson("lPub", "Bài 5 Thế giới sau 1945", { isFree: true, documents: docs("Chiến tranh lạnh - tóm tắt.pdf", "https://files.example/cong-khai.pdf") }, ch1.id);
  await lesson("lPriv", "Bài 6 Chiến tranh lạnh nâng cao", { isFree: false, isLocked: false, documents: docs("Chiến tranh lạnh - đề cương nội bộ.pdf", "https://files.example/rieng-cua-lop.pdf") }, ch1.id);
  await lesson("lClosed", "Bài đóng", { isFree: true, documents: docs("Chiến tranh lạnh - khoá đóng.pdf", "https://files.example/khoa-dong.pdf") }, ch2.id);
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C1.id, status: "active" } });

  section("Quyền: chỉ quản lý trung tâm quản video");
  const blocked = (s: number) => [401, 403].includes(s);
  check("chưa đăng nhập: GET / POST bị chặn", blocked((await api("GET", A)).status) && blocked((await api("POST", A, { body: V1 })).status));
  check("gia sư và học sinh: GET / POST bị chặn", blocked((await api("GET", A, { as: T })).status) && blocked((await api("POST", A, { as: T, body: V1 })).status) && blocked((await api("POST", A, { as: S, body: V1 })).status));
  check("không có video nào được ghi sau các lần bị chặn", (await prisma.libraryVideo.count()) === 0);

  section("Tạo / sửa / xoá");
  const c = await api("POST", A, { as: CT, body: V1 });
  check("quản trị nội dung POST hợp lệ → 201 + id", c.status === 201 && typeof c.json.id === "string", c.json);
  let row = await prisma.libraryVideo.findUniqueOrThrow({ where: { id: c.json.id } });
  check("lưu đúng: mã video tách từ link, 2 chủ đề, chưa công khai", row.videoId === ID1 && row.topics.length === 2 && row.topics[0] === "Chiến tranh lạnh" && row.published === false && row.channel === "Thầy A", row);
  check("nhật ký quản trị ghi 'library_video.create'", (await prisma.auditLog.count({ where: { action: "library_video.create" } })) === 1);
  const dup = await api("POST", A, { as: SA, body: { ...V1, title: "Trùng", url: `https://youtu.be/${ID1}?t=5` } });
  check("cùng video qua dạng link KHÁC (youtu.be) → 409 'đã có', field url", dup.status === 409 && dup.json.field === "url", dup.json);
  const race = await Promise.all(Array.from({ length: 5 }, () => api("POST", A, { as: SA, body: { ...V1, title: "Song song", url: `https://youtu.be/${ID2}` } })));
  const codes = race.map(r => r.status).sort();
  check("5 yêu cầu SONG SONG cho cùng một video → đúng 1 cái 201, còn lại 409 (không 500)", codes.filter(x => x === 201).length === 1 && codes.filter(x => x === 409).length === 4, codes);
  check("trong DB chỉ có 1 dòng cho video đó", (await prisma.libraryVideo.count({ where: { videoId: ID2 } })) === 1);

  const before = await prisma.libraryVideo.count();
  for (const [name, body] of [
    ["link không phải YouTube", { ...V1, url: "https://vimeo.com/123" }], ["link javascript:", { ...V1, url: "javascript:alert(1)" }], ["tên miền giả youtube.com.xau.vn", { ...V1, url: `https://youtube.com.xau.vn/watch?v=${ID3}` }],
    ["thiếu tiêu đề", { ...V1, url: `https://youtu.be/${ID3}`, title: "" }], ["tiêu đề tàng hình", { ...V1, url: `https://youtu.be/${ID3}`, title: "\u200b\u200d" }], ["quá 8 chủ đề", { ...V1, url: `https://youtu.be/${ID3}`, topics: "a1,a2,a3,a4,a5,a6,a7,a8,a9" }],
    ["published là chữ", { ...V1, url: `https://youtu.be/${ID3}`, published: "true" }], ["mảng", [V1]],
  ] as const) check(`POST ${name} → 400`, (await api("POST", A, { as: SA, body })).status === 400);
  check("thân không phải JSON → 400 (không 500)", (await api("POST", A, { as: SA, raw: "{hỏng", headers: { "content-type": "application/json" } })).status === 400);
  check("không có video nào được thêm sau các lần sai", (await prisma.libraryVideo.count()) === before);

  const id = c.json.id as string;
  let p = await api("PATCH", `${A}/${id}`, { as: CT, body: { title: "Chiến tranh lạnh (bản mới)" } });
  row = await prisma.libraryVideo.findUniqueOrThrow({ where: { id } });
  check("PATCH chỉ đổi tiêu đề → 200; mã video, chủ đề, kênh GIỮ NGUYÊN", p.status === 200 && row.title === "Chiến tranh lạnh (bản mới)" && row.videoId === ID1 && row.topics.length === 2 && row.channel === "Thầy A", row);
  p = await api("PATCH", `${A}/${id}`, { as: CT, body: { url: "https://vimeo.com/1" } });
  check("PATCH link sai → 400, bản ghi không đổi", p.status === 400 && (await prisma.libraryVideo.findUniqueOrThrow({ where: { id } })).videoId === ID1);
  p = await api("PATCH", `${A}/${id}`, { as: CT, body: { url: `https://youtu.be/${ID2}` } });
  check("PATCH link sang video ĐÃ CÓ ở dòng khác → 409, bản ghi không đổi", p.status === 409 && (await prisma.libraryVideo.findUniqueOrThrow({ where: { id } })).videoId === ID1, p.json);
  check("PATCH id không có → 404; DELETE id không có → 404", (await api("PATCH", `${A}/khong-co`, { as: SA, body: { title: "x" } })).status === 404 && (await api("DELETE", `${A}/khong-co`, { as: SA })).status === 404);
  check("gia sư PATCH / DELETE → bị chặn, bản ghi còn nguyên", blocked((await api("PATCH", `${A}/${id}`, { as: T, body: { published: true } })).status) && blocked((await api("DELETE", `${A}/${id}`, { as: T })).status) && (await prisma.libraryVideo.count({ where: { id } })) === 1);
  const g = await api("GET", A, { as: CT });
  check("GET admin: thấy cả bản nháp, có link xem + ảnh nhỏ dựng từ mã, tổng / công khai", g.status === 200 && g.json.total === 2 && g.json.published === 0 && g.json.videos.every((v: { url: string; thumb: string }) => v.url.startsWith("https://www.youtube.com/watch?v=") && v.thumb.startsWith("https://i.ytimg.com/vi/")), g.json);

  section("Tìm công khai: kiểm tra đầu vào");
  check("không có q → 400; 1 ký tự → 400; toàn dấu câu → 400", (await api("GET", Q, { headers: { "x-forwarded-for": rndIp() } })).status === 400 && (await search("a")).status === 400 && (await search("!!")).status === 400);
  check("q quá 100 ký tự → 400", (await search("chiến ".repeat(30))).status === 400);

  section("Tìm công khai: bản nháp không lộ; công khai rồi mới ra");
  let r = await search("chien tranh lanh");
  check("video còn NHÁP → không ra video nào; tài liệu công khai vẫn ra", r.status === 200 && r.json.videos.length === 0 && r.json.docs.length === 1 && r.json.docs[0].name === "Chiến tranh lạnh - tóm tắt.pdf", r.json);
  await api("PATCH", `${A}/${id}`, { as: SA, body: { published: true } });
  r = await search("chien tranh lanh");
  check("sau khi công khai → ra video, tìm KHÔNG dấu", r.status === 200 && r.json.videos.length === 1 && r.json.videos[0].title === "Chiến tranh lạnh (bản mới)", r.json);
  const v = r.json.videos[0];
  check("video trả: link xem + ảnh nhỏ dựng từ mã, kèm chủ đề, kênh, ghi chú; KHÔNG có trường videoId / published", v.url === `https://www.youtube.com/watch?v=${ID1}` && v.thumb === `https://i.ytimg.com/vi/${ID1}/mqdefault.jpg` && v.topics.length === 2 && v.channel === "Thầy A" && !("videoId" in v) && !("published" in v), v);
  check("tìm theo CHỦ ĐỀ ('lich su 12') ra video dù tiêu đề không có", (await search("lich su 12")).json.videos.length === 1);
  check("từ khoá không khớp → rỗng cả hai", (await search("xyzabc")).json.docs.length === 0 && (await search("xyzabc")).json.videos.length === 0);
  check("gõ HOA có dấu cho cùng kết quả", JSON.stringify((await search("CHIẾN TRANH LẠNH")).json) === JSON.stringify((await search("chien tranh lanh")).json));

  section("Ranh giới riêng tư: tài liệu riêng của lớp KHÔNG ra, dù người gọi là ai");
  const guest = await search("chien tranh lanh"), asS = await search("chien tranh lanh", S), asO = await search("chien tranh lanh", O), asT = await search("chien tranh lanh", T), asSA = await search("chien tranh lanh", SA);
  check("chỉ ra tài liệu của bài MIỄN PHÍ ở khoá đang mở", guest.json.docs.length === 1 && guest.json.docs[0].name === "Chiến tranh lạnh - tóm tắt.pdf", guest.json.docs);
  check("tài liệu bài TRẢ PHÍ của lớp (cờ isLocked=false do gia sư quên khoá) KHÔNG ra", !/nội bộ|rieng-cua-lop/.test(guest.text), guest.text);
  check("tài liệu của khoá ĐÃ ĐÓNG (status=false) KHÔNG ra, dù bài miễn phí", !/khoá đóng|khoa-dong/.test(guest.text));
  check("học sinh ĐANG HỌC lớp đó gọi API cũng chỉ nhận đúng kết quả công khai (phần 'trong lớp' làm ở trình duyệt, không qua API này)", JSON.stringify(asS.json) === JSON.stringify(guest.json) && !/nội bộ|rieng-cua-lop/.test(asS.text));
  check("học sinh ngoài lớp, gia sư chủ lớp, quản trị: cùng một kết quả công khai", [asO, asT, asSA].every(x => JSON.stringify(x.json) === JSON.stringify(guest.json)));
  check("liên kết tài liệu là trang xem trước của KiN (không lộ đường dẫn tệp thô ở trường riêng)", guest.json.docs[0].href.startsWith("/xem-tai-lieu?url=") && !("url" in guest.json.docs[0]));

  section("Dòng hỏng / dữ liệu lạ không làm sập");
  await prisma.libraryVideo.create({ data: { title: "Chiến tranh lạnh hỏng", videoId: "ngan", topics: ["x"], published: true } });
  await prisma.libraryVideo.create({ data: { title: "Chiến tranh lạnh javascript", videoId: "javascript:1", topics: [], published: true } });
  r = await search("chien tranh lanh hong");
  check("dòng có mã video hỏng (sửa tay) bị bỏ qua: API vẫn 200, không ra dòng đó", r.status === 200 && r.json.videos.every((x: { title: string }) => !/hỏng|javascript/.test(x.title)), r.json);
  check("tìm 'javascript' không ra dòng có mã lạ", (await search("chien tranh lanh javascript")).json.videos.length === 0);

  section("Xoá");
  const del = await api("DELETE", `${A}/${id}`, { as: CT });
  check("DELETE → 200, dòng mất, nhật ký ghi delete; tìm không còn ra video đó", del.status === 200 && (await prisma.libraryVideo.count({ where: { id } })) === 0 && (await prisma.auditLog.count({ where: { action: "library_video.delete" } })) === 1 && (await search("chien tranh lanh")).json.videos.every((x: { id: string }) => x.id !== id));

  section("Giới hạn tốc độ");
  const ip = rndIp(), cs: number[] = [];
  for (let i = 0; i < 31; i++) cs.push((await search("chien tranh", undefined, ip)).status);
  check("30 lần đầu / phút từ một IP → 200; lần 31 → 429", cs.slice(0, 30).every(x => x === 200) && cs[30] === 429, cs);
  check("IP khác không bị ảnh hưởng", (await search("chien tranh")).status === 200);

  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
