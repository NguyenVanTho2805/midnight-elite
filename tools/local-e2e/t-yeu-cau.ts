// KH-04 / PH-07 "Yêu cầu tìm gia sư" của khách — API thật: chỉ thu tối thiểu, chưa tích đồng ý thì KHÔNG lưu, chống spam (ô bẫy, quá nhanh, 5/giờ/IP, 3/ngày/số, trùng),
// trang theo dõi không lộ số liên hệ, rút yêu cầu xoá liên hệ, gia sư chỉ thấy / xử lý yêu cầu gửi tới MÌNH, tiếp nhận sao đồng ý sang hồ sơ, tự hết hạn.
// Chạy (máy chủ dev bật): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-yeu-cau.ts
import { prisma } from "@/lib/prisma";
import { api, check, done, mkCourse, mkTutor, mkUser, section, wipe } from "./h";

let ipN = 0, phoneN = 0;
const ip = () => ({ "x-forwarded-for": `10.20.${Math.floor(++ipN / 250)}.${ipN % 250}` });
const phone = () => `09${String(10_000_000 + ++phoneN)}`;
const startedAt = () => Date.now() - 20_000; // đã mở trang 20 giây trước
const body = (tutorId: string, o: Record<string, unknown> = {}) => ({
  targetTutorId: tutorId, level: "thcs", subject: "Toán 9", mode: "online", slots: "tối thứ 3", note: "ghi chú thử", contactName: "Chị Thử", contactPhone: phone(), role: "guardian",
  consent: { accepted: true }, startedAt: startedAt(), website: "", ...o,
});
const send = (b: Record<string, unknown>, headers = ip()) => api("POST", "/api/yeu-cau", { body: b, headers });

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Hai"), T3 = await mkTutor("Cô Ba"), T4 = await mkTutor("Thầy Tư");
  const verified = [T, T2, T3, T4];
  for (const t of verified) await prisma.user.update({ where: { id: t.id }, data: { tutorVerified: true } });
  const hidden = await mkTutor("Cô Ẩn"), banned = await mkTutor("Thầy Bị Khoá"), unverified = await mkTutor("Cô Chưa Duyệt");
  await prisma.user.update({ where: { id: hidden.id }, data: { preferences: { profile: { hidden: true } } } });
  await prisma.user.update({ where: { id: banned.id }, data: { banned: true } });
  await prisma.user.update({ where: { id: unverified.id }, data: { tutorVerified: false } });
  const cT = await mkCourse(T.id, { name: "Toán 9" }), cT2 = await mkCourse(T2.id, { name: "Lớp của T2" });
  const stu = await mkUser({ name: "Học sinh" });

  section("Gửi yêu cầu hợp lệ");
  const P1 = phone();
  const r1 = await send(body(T.id, { contactPhone: P1 }));
  check("201 + chỉ trả mã theo dõi (32 hex)", r1.status === 201 && /^[0-9a-f]{32}$/.test(r1.json.trackToken) && Object.keys(r1.json).join() === "trackToken", r1.json);
  const row = await prisma.tutorRequest.findUnique({ where: { trackToken: r1.json.trackToken } });
  check("đã lưu đúng: gửi tới T, trạng thái new, số liên hệ chuẩn hoá, băm số (không phải số thật)", row?.targetTutorId === T.id && row.status === "new" && row.contactPhone === P1 && row.phoneKey.length === 32 && row.phoneKey !== P1);
  const cr = await prisma.consentRecord.findMany({ where: { subjectType: "tutor_request", subjectId: row!.id } });
  check("1 dòng đồng ý: bên 'guardian', phương thức guest_form, người bấm = khách (không có tài khoản), phạm vi cơ bản, có phiên bản chữ", cr.length === 1 && cr[0].party === "guardian" && cr[0].method === "guest_form" && cr[0].givenByRole === "guest" && cr[0].givenById === null && cr[0].scopes.join() === "basic" && /^\d{4}-/.test(cr[0].textVersion) && !cr[0].revokedAt);
  const note = await prisma.notification.findFirst({ where: { userId: T.id, type: "tutor_request_new" } });
  check("gia sư T nhận thông báo trong ứng dụng, link tới /lop-cua-toi/yeu-cau, chữ KHÔNG có tên / số / môn", !!note && note.link === "/lop-cua-toi/yeu-cau" && !/Chị Thử|Toán|09\d{8}/.test(note.title + note.message));
  const lg = JSON.stringify(await prisma.auditLog.findMany({ where: { action: { startsWith: "tutor_request." } } }));
  check("nhật ký không chứa số, tên, môn, ghi chú", !lg.includes(P1) && !lg.includes("Chị Thử") && !lg.includes("Toán 9") && !lg.includes("ghi chú thử"));
  check("người học 16+ tự gửi → dòng đồng ý bên 'self'", await (async () => { const r = await send(body(T2.id, { role: "self" })); const q = await prisma.tutorRequest.findUnique({ where: { trackToken: r.json.trackToken } }); return r.status === 201 && (await prisma.consentRecord.findFirst({ where: { subjectId: q!.id } }))?.party === "self"; })());

  section("Chưa đồng ý ⇒ KHÔNG lưu");
  const before = await prisma.tutorRequest.count();
  check("thiếu consent → 422", (await send(body(T3.id, { consent: undefined }))).status === 422);
  check("consent.accepted = false / 'true' (chuỗi) / 1 → 422", (await send(body(T3.id, { consent: { accepted: false } }))).status === 422 && (await send(body(T3.id, { consent: { accepted: "true" } }))).status === 422 && (await send(body(T3.id, { consent: { accepted: 1 } }))).status === 422);
  check("sau đó vẫn không có yêu cầu / dòng đồng ý mới", (await prisma.tutorRequest.count()) === before);

  section("Kiểm dữ liệu — lỗi nêu từng ô, không lưu");
  const V = async (o: Record<string, unknown>) => send(body(T3.id, o));
  check("thiếu cấp học → 400 kèm errors.level", await (async () => { const r = await V({ level: "" }); return r.status === 400 && !!r.json.errors.level; })());
  check("thiếu môn / SĐT sai / thiếu vai → 400", (await V({ subject: "" })).status === 400 && (await V({ contactPhone: "123" })).status === 400 && (await V({ role: "" })).status === 400);
  check("ô lạ (tên con, ngày sinh) KHÔNG được lưu ở đâu", await (async () => { const r = await send(body(T3.id, { childName: "Nguyễn Bé Lạ", birthDate: "2014-01-01", school: "THCS Lạ" })); const all = JSON.stringify(await prisma.tutorRequest.findMany()); return r.status === 201 && !all.includes("Nguyễn Bé Lạ") && !all.includes("2014-01-01") && !all.includes("THCS Lạ"); })());

  section("Chống spam");
  const n0 = await prisma.tutorRequest.count();
  const bot = await send(body(T4.id, { website: "http://spam.example" }));
  check("ô bẫy có chữ → trả 201 giả (bot không biết bị chặn) nhưng KHÔNG lưu gì", bot.status === 201 && (await prisma.tutorRequest.count()) === n0 && (await prisma.notification.count({ where: { userId: T4.id } })) === 0);
  check("gửi quá nhanh (mở trang 500 ms trước) → 429, không lưu", (await send(body(T4.id, { startedAt: Date.now() - 500 }))).status === 429 && (await prisma.tutorRequest.count()) === n0);
  check("thiếu startedAt / ở tương lai / quá 6 giờ → 400, không lưu", (await send(body(T4.id, { startedAt: undefined }))).status === 400 && (await send(body(T4.id, { startedAt: Date.now() + 60_000 }))).status === 400 && (await send(body(T4.id, { startedAt: Date.now() - 7 * 3600_000 }))).status === 400);
  const PX = phone();
  const first = await send(body(T4.id, { contactPhone: PX }));
  const dup = await send(body(T4.id, { contactPhone: PX }));
  check("cùng số gửi tiếp cho CÙNG gia sư khi yêu cầu cũ còn chờ → 409, không lộ mã của yêu cầu cũ", first.status === 201 && dup.status === 409 && !dup.text.includes(first.json.trackToken));
  const PD = phone();
  const d1 = await send(body(T.id, { contactPhone: PD })), d2 = await send(body(T2.id, { contactPhone: PD })), d3 = await send(body(T3.id, { contactPhone: PD })), d4 = await send(body(T4.id, { contactPhone: PD }));
  check("một số: 3 yêu cầu/ngày tới 3 gia sư khác nhau được, yêu cầu thứ 4 → 429", d1.status === 201 && d2.status === 201 && d3.status === 201 && d4.status === 429, [d1.status, d2.status, d3.status, d4.status]);
  const sameIp = { "x-forwarded-for": "172.16.9.9" };
  const codes: number[] = [];
  for (let i = 0; i < 7; i++) codes.push((await send(body(T.id, { contactPhone: phone(), subject: `Môn ${i}` }), sameIp)).status);
  check("cùng một IP: 5 yêu cầu/giờ, từ yêu cầu thứ 6 → 429", codes.slice(0, 5).every(c => c === 201) && codes[5] === 429 && codes[6] === 429, codes);
  check("điền sai nhiều lần KHÔNG bị tính vào hạn 5/giờ của IP", await (async () => { const h = { "x-forwarded-for": "172.16.9.10" }; for (let i = 0; i < 8; i++) await send(body(T.id, { subject: "" }), h); return (await send(body(T.id), h)).status === 201; })());

  section("Gia sư nhận phải đang công khai");
  const notFound = async (id: unknown) => (await send(body(T.id, { targetTutorId: id }))).status === 404;
  check("không có targetTutorId / id không tồn tại → 404", await notFound(undefined) && await notFound("khong-co") && await notFound(5));
  check("gia sư đang ẨN hồ sơ, bị khoá, chưa duyệt, hoặc không phải gia sư → 404", await notFound(hidden.id) && await notFound(banned.id) && await notFound(unverified.id) && await notFound(stu.id));
  const lockT = await mkTutor("Cô Khoá Hồ Sơ"); await prisma.user.update({ where: { id: lockT.id }, data: { tutorVerified: true, profileLockedAt: new Date() } });
  check("hồ sơ bị quản trị khoá → 404", await notFound(lockT.id));

  section("Trang theo dõi (khách): không lộ số liên hệ");
  const tok = r1.json.trackToken as string;
  const tr = await api("GET", `/api/yeu-cau/${tok}`, { headers: ip() });
  check("200, trạng thái new, chữ giọng phụ huynh, nói rõ không đảm bảo thời gian", tr.status === 200 && tr.json.status === "new" && tr.json.canWithdraw === true && /không đảm bảo thời gian/.test(tr.json.detail));
  check("trả lại đúng những gì khách đã gửi (cấp học, môn, khung giờ) + tên công khai của gia sư", tr.json.request.level.includes("THCS") && tr.json.request.subject === "Toán 9" && tr.json.request.slots === "tối thứ 3" && tr.json.tutor.name === "Cô Lan");
  check("KHÔNG có số điện thoại, tên liên hệ, ghi chú, băm số trong phản hồi", !tr.text.includes(P1) && !tr.text.includes("Chị Thử") && !tr.text.includes("ghi chú thử") && !tr.text.includes(row!.phoneKey) && !/contactPhone|phoneKey|"note"/.test(tr.text));
  check("mã sai / không đủ 32 hex / rỗng → 404", (await api("GET", "/api/yeu-cau/abc", { headers: ip() })).status === 404 && (await api("GET", `/api/yeu-cau/${"0".repeat(32)}`, { headers: ip() })).status === 404);
  const page = await api("GET", `/yeu-cau/${tok}`, { headers: ip() });
  check("trang /yeu-cau/<mã> mở được không cần đăng nhập, dặn công cụ tìm kiếm KHÔNG lập chỉ mục", page.status === 200 && /noindex/.test(page.text));

  section("Khách rút yêu cầu");
  check("mã sai → 404", (await api("POST", "/api/yeu-cau/abc/rut", { headers: ip() })).status === 404);
  const rut = await api("POST", `/api/yeu-cau/${tok}/rut`, { headers: ip() });
  const after = await prisma.tutorRequest.findUnique({ where: { id: row!.id } });
  check("rút → 200; yêu cầu closed; số liên hệ, tên, ghi chú bị XOÁ", rut.status === 200 && after?.status === "closed" && after.contactPhone === "" && after.contactName === null && after.note === null);
  check("dòng đồng ý bị thu hồi (lý do guardian_request) nhưng còn trong sổ", await (async () => { const c = await prisma.consentRecord.findFirst({ where: { subjectId: row!.id } }); return !!c?.revokedAt && c.revokeCause === "guardian_request"; })());
  check("rút lần hai → 409; trang theo dõi nói 'đã đóng', hết nút rút", (await api("POST", `/api/yeu-cau/${tok}/rut`, { headers: ip() })).status === 409 && (await api("GET", `/api/yeu-cau/${tok}`, { headers: ip() })).json.canWithdraw === false);
  check("rút xong thì gia sư không còn thấy số", !(JSON.stringify((await api("GET", "/api/tutor/yeu-cau", { as: T })).json)).includes(P1));
  check("rút xong, số đó gửi lại cho T được (không bị coi là trùng 'đang chờ')", (await send(body(T.id, { contactPhone: P1 }))).status === 201);

  section("Gia sư: chỉ thấy / xử lý yêu cầu gửi tới MÌNH");
  check("chưa đăng nhập 401; học sinh 403", (await api("GET", "/api/tutor/yeu-cau")).status === 401 && (await api("GET", "/api/tutor/yeu-cau", { as: stu })).status === 403);
  const lT = await api("GET", "/api/tutor/yeu-cau", { as: T }), lT2 = await api("GET", "/api/tutor/yeu-cau", { as: T2 });
  check("T thấy yêu cầu của mình kèm số liên hệ (yêu cầu mới), T2 chỉ thấy của T2 — không lẫn", lT.json.requests.length >= 3 && lT.json.requests.some((r: { contactPhone: string }) => r.contactPhone === P1) && lT2.json.requests.every((r: { id: string }) => !lT.json.requests.some((x: { id: string }) => x.id === r.id)));
  check("yêu cầu đã đóng: số liên hệ rỗng; newCount đếm đúng", lT.json.requests.filter((r: { status: string }) => r.status === "new").length === lT.json.newCount && lT.json.requests.filter((r: { status: string }) => r.status !== "new").every((r: { contactPhone: string }) => r.contactPhone === ""));

  const mkReq = async (tutor: { id: string }, o: Record<string, unknown> = {}) => { const r = await send(body(tutor.id, o)); return (await prisma.tutorRequest.findUnique({ where: { trackToken: r.json.trackToken } }))!; };
  const rA = await mkReq(T);
  const ACC = (id: string) => `/api/tutor/yeu-cau/${id}/tiep-nhan`;
  check("T2 tiếp nhận / từ chối yêu cầu gửi cho T → 403, yêu cầu vẫn new", (await api("POST", ACC(rA.id), { as: T2, body: { name: "X", ageGroup: "u7" } })).status === 403 && (await api("POST", `/api/tutor/yeu-cau/${rA.id}/tu-choi`, { as: T2 })).status === 403 && (await prisma.tutorRequest.findUnique({ where: { id: rA.id } }))?.status === "new");
  check("id không tồn tại → 404", (await api("POST", ACC("khong-co"), { as: T, body: {} })).status === 404);
  check("thiếu tên / nhóm tuổi → 400", (await api("POST", ACC(rA.id), { as: T, body: { ageGroup: "u7" } })).status === 400 && (await api("POST", ACC(rA.id), { as: T, body: { name: "Bé A" } })).status === 400);
  check("xếp vào lớp của gia sư KHÁC → 403, vẫn new", (await api("POST", ACC(rA.id), { as: T, body: { name: "Bé A", ageGroup: "u7", courseId: cT2.id } })).status === 403 && (await prisma.tutorRequest.findUnique({ where: { id: rA.id } }))?.status === "new");

  section("Tiếp nhận thành hồ sơ: đồng ý của khách được sao sang, bên còn thiếu gia sư xác nhận");
  const a1 = await api("POST", ACC(rA.id), { as: T, body: { name: "Bé Tiếp Nhận", ageGroup: "u7", courseId: cT.id } });
  check("em dưới 7 tuổi, người gửi là phụ huynh → đủ đồng ý sẵn, KHÔNG cần gia sư xác nhận thêm → 201", a1.status === 201 && !!a1.json.profileId, a1.json);
  const prof = await prisma.studentProfile.findUnique({ where: { id: a1.json.profileId } });
  check("hồ sơ: chờ xếp lớp, đúng gia sư, nguồn 'request', liên hệ phụ huynh lấy từ yêu cầu, lớp đã gắn", prof?.tutorId === T.id && prof.status === "waitlist" && prof.source === "request" && prof.requestId === rA.id && prof.guardianPhone === rA.contactPhone && prof.guardianName === "Chị Thử" && prof.courseId === cT.id && !!prof.waitlistedAt);
  check("hồ sơ KHÔNG nhận môn / ghi chú / khung giờ (thuộc phạm vi mở rộng, chưa có đồng ý)", prof?.subjects.length === 0 && prof?.notes === null);
  const pc = await prisma.consentRecord.findMany({ where: { subjectType: "student_profile", subjectId: prof!.id } });
  check("dòng đồng ý trên hồ sơ: chép từ khách (guest_form, không người đăng nhập), chỉ phạm vi cơ bản, KHÔNG có dòng của gia sư", pc.length === 1 && pc[0].party === "guardian" && pc[0].method === "guest_form" && pc[0].givenByRole === "guest" && pc[0].givenById === null && pc[0].scopes.join() === "basic");
  const afterA = await prisma.tutorRequest.findUnique({ where: { id: rA.id } });
  check("yêu cầu: accepted, gắn profileId, số liên hệ bị xoá khỏi yêu cầu (chỉ còn ở hồ sơ)", afterA?.status === "accepted" && afterA.profileId === prof!.id && afterA.contactPhone === "" && afterA.note === null);
  const detail = await api("GET", `/api/tutor/ho-so/${prof!.id}`, { as: T });
  check("hồ sơ mở được ở trang gia sư, đủ đồng ý cơ bản", detail.status === 200 && detail.json.profile.consentLevel === "basic_only" && detail.json.profile.guardianPhone === rA.contactPhone);
  const trk = await api("GET", `/api/yeu-cau/${rA.trackToken}`, { headers: ip() });
  check("khách thấy 'Gia sư đã nhận yêu cầu', nói KiN không thu hộ học phí", trk.json.status === "accepted" && /không thu hộ/.test(trk.json.detail) && trk.json.canWithdraw === false);
  check("tiếp nhận lần hai → 409; rút sau khi đã nhận → 409", (await api("POST", ACC(rA.id), { as: T, body: { name: "Bé A", ageGroup: "u7" } })).status === 409 && (await api("POST", `/api/yeu-cau/${rA.trackToken}/rut`, { headers: ip() })).status === 409);

  const rB = await mkReq(T);
  const noChild = await api("POST", ACC(rB.id), { as: T, body: { name: "Bé B", ageGroup: "7to15" } });
  check("em 7-15 tuổi (đồng ý kép): phụ huynh đã bấm, THIẾU em → 422 nêu rõ đã có 'guardian', còn thiếu 'child', chưa tạo hồ sơ", noChild.status === 422 && noChild.json.covered.join() === "guardian" && noChild.json.missing.join() === "child" && (await prisma.studentProfile.count({ where: { requestId: rB.id } })) === 0);
  const withChild = await api("POST", ACC(rB.id), { as: T, body: { name: "Bé B", ageGroup: "7to15", status: "active", consent: { child: true } } });
  const pcB = await prisma.consentRecord.findMany({ where: { subjectType: "student_profile", subjectId: withChild.json.profileId }, orderBy: { party: "asc" } });
  check("gia sư xác nhận thêm phần của em → 201; 2 dòng: child (tutor_attestation) + guardian (guest_form)", withChild.status === 201 && pcB.map(c => `${c.party}:${c.method}`).join() === "child:tutor_attestation,guardian:guest_form", pcB.map(c => `${c.party}:${c.method}`));
  const rC = await mkReq(T);
  const adult = await api("POST", ACC(rC.id), { as: T, body: { name: "Bạn C", ageGroup: "16plus" } });
  check("phụ huynh gửi nhưng em đã 16+ → phụ huynh không thay được em: 422 thiếu 'self', covered rỗng", adult.status === 422 && adult.json.missing.join() === "self" && adult.json.covered.length === 0, adult.json);
  const adult2 = await api("POST", ACC(rC.id), { as: T, body: { name: "Bạn C", ageGroup: "16plus", consent: { self: true } } });
  check("gia sư xác nhận người học tự đồng ý → 201", adult2.status === 201);
  const rS = await mkReq(T, { role: "self" });
  check("người học (self) gửi mà gia sư xếp nhóm 7-15 → 400 (mâu thuẫn)", (await api("POST", ACC(rS.id), { as: T, body: { name: "Bạn S", ageGroup: "7to15", consent: { guardian: true, child: true } } })).status === 400);
  const sOk = await api("POST", ACC(rS.id), { as: T, body: { name: "Bạn S", ageGroup: "16plus" } });
  check("người học self + nhóm 16+ → đủ đồng ý sẵn (bên self từ biểu mẫu) → 201", sOk.status === 201 && (await prisma.consentRecord.findMany({ where: { subjectId: sOk.json.profileId } })).map(c => c.party).join() === "self");

  section("Từ chối và tự hết hạn");
  const rD = await mkReq(T), PD2 = rD.contactPhone;
  const dec = await api("POST", `/api/tutor/yeu-cau/${rD.id}/tu-choi`, { as: T });
  const afterD = await prisma.tutorRequest.findUnique({ where: { id: rD.id } });
  check("từ chối → declined, số liên hệ bị xoá, đồng ý thu hồi (request_declined)", dec.status === 200 && afterD?.status === "declined" && afterD.contactPhone === "" && (await prisma.consentRecord.findFirst({ where: { subjectId: rD.id } }))?.revokeCause === "request_declined");
  check("khách thấy 'Gia sư chưa nhận được lần này'", (await api("GET", `/api/yeu-cau/${rD.trackToken}`, { headers: ip() })).json.title.includes("chưa nhận được"));
  check("từ chối lần hai → 409", (await api("POST", `/api/tutor/yeu-cau/${rD.id}/tu-choi`, { as: T })).status === 409 && !JSON.stringify(await api("GET", "/api/tutor/yeu-cau", { as: T })).includes(PD2));
  const rE = await mkReq(T2);
  await prisma.tutorRequest.update({ where: { id: rE.id }, data: { createdAt: new Date(Date.now() - 31 * 86_400_000) } });
  const listE = await api("GET", "/api/tutor/yeu-cau", { as: T2 });
  const rEnow = await prisma.tutorRequest.findUnique({ where: { id: rE.id } });
  check("yêu cầu chưa ai phản hồi quá 30 ngày → tự đóng khi có người đọc, số liên hệ bị xoá, đồng ý thu hồi (request_expired)", rEnow?.status === "closed" && rEnow.contactPhone === "" && (await prisma.consentRecord.findFirst({ where: { subjectId: rE.id } }))?.revokeCause === "request_expired" && !JSON.stringify(listE.json).includes(rE.contactPhone));
  const rF = await mkReq(T3);
  await prisma.tutorRequest.update({ where: { id: rF.id }, data: { createdAt: new Date(Date.now() - 31 * 86_400_000) } });
  await api("GET", `/api/yeu-cau/${rF.trackToken}`, { headers: ip() });
  check("hết hạn cũng được xử lý khi KHÁCH mở trang theo dõi", (await prisma.tutorRequest.findUnique({ where: { id: rF.id } }))?.status === "closed");

  section("Nhật ký không chứa dữ liệu của trẻ / số điện thoại");
  const lg2 = JSON.stringify(await prisma.auditLog.findMany({ where: { OR: [{ action: { startsWith: "tutor_request." } }, { action: "student_profile.create" }] } }));
  check("nhật ký tiếp nhận / từ chối / rút: không có số, tên em, tên liên hệ", !/09\d{8}/.test(lg2) && !lg2.includes("Bé Tiếp Nhận") && !lg2.includes("Chị Thử"));

  await done();
})();
