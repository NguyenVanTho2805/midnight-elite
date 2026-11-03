// Hàng chờ quản trị — quy tắc thuần của src/lib/adminQueue.ts (BU-08): 8 loại, quyền từng loại, tên rút gọn, lệnh nhanh / hàng loạt, con trỏ phân trang, badge chính xác.
// Ca phá cố ý (sửa tạm src/lib/adminQueue.ts, bài phải ĐỎ, rồi hoàn lại):
//   • thêm `bulk: ["approve"]` cho topupItem → ca "bulk chỉ ở 4 lệnh an toàn" đỏ;
//   • bỏ `...(self ? { disabled: … } : {})` ở topupItem → ca "tự duyệt nạp Coin" đỏ;
//   • bỏ dòng `if (role !== "admin_super" && role !== "admin_content") return false` trong canSeeKind → ca "gia sư không thấy loại nào" đỏ;
//   • badgeOf đếm cả `vao-lop` → ca "vao-lop không tính vào badge" đỏ;
//   • shortName bỏ nhánh `staff` → ca "nhân sự hiện đủ tên" đỏ.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { check, section, done } from "./h";
import {
  JOIN_SLOW_DAYS, MAX_QUEUE_ITEMS, QUEUE_KINDS, QUEUE_KIND_GROUP, SNIPPET, afterCursor, agoLabel, badgeOf, buildAdminQueue, canSeeKind, decodeCursor, encodeCursor,
  formatVndText, isQueueKind, shortName, visibleKinds, waitedText,
  type AnswerRep, type GuestRep, type JoinRep, type ProfileRep, type QueueItem, type ReviewRep, type ThreadRep, type TopupRep, type TutorApp,
} from "@/lib/adminQueue";
import { matchSub } from "@/lib/adminNav";
import { ADMIN_REDIRECTS } from "@/lib/adminRedirects";
import { PERMISSIONS, checkPermission, type AdminRole } from "@/lib/permissions";

// Thứ Ba 13/10/2026 20:00 giờ VN
const NOW = new Date("2026-10-13T13:00:00Z");
const vn = (key: string, hm: string) => new Date(`${key}T${hm}:00+07:00`);
const tutor = (o: Partial<TutorApp> = {}): TutorApp => ({ id: "u1", name: "Lê Thu", email: "thu@x.vn", phone: "0901234567", city: "Hà Nội", emailVerified: true, bio: "Dạy Toán 9 năm năm", subjects: ["Toán", "Lý"], appliedAt: vn("2026-10-12", "23:02"), ...o });
const thread = (o: Partial<ThreadRep> = {}): ThreadRep => ({ id: "t1", reason: "Quảng cáo", createdAt: vn("2026-10-11", "08:00"), reporter: "An", author: "Bình", content: "Bán sách giá rẻ liên hệ 090", course: null, ...o });
const prof = (o: Partial<ProfileRep> = {}): ProfileRep => ({ id: "p1", tutorId: "u9", tutorName: "Cô Mai", reason: "Ảnh không phải của gia sư", detail: null, channel: null, createdAt: vn("2026-10-10", "10:00"), ...o });
const ans = (o: Partial<AnswerRep> = {}): AnswerRep => ({ id: "a1", reason: "Sai kiến thức", createdAt: vn("2026-10-13", "19:30"), reporter: "Chi", author: "Dũng", content: "Đáp án là 5", questionTitle: "Tính 2+2", rewardPaid: 0, ...o });
const rev = (o: Partial<ReviewRep> = {}): ReviewRep => ({ id: "r1", rating: 4, comment: "Cô dạy dễ hiểu", createdAt: vn("2026-10-13", "09:00"), reviewer: "Trần Thị Bích", courseId: "c1", courseName: "Toán 9", ...o });
const top = (o: Partial<TopupRep> = {}): TopupRep => ({ id: "n1", requesterId: "uX", requester: "Nguyễn Văn Cường", amountVnd: 1_250_000, coinAmount: 1_250_000, bankRef: "FT123", note: "Chuyển lúc 9h", createdAt: vn("2026-10-13", "10:00"), ...o });
const guest = (o: Partial<GuestRep> = {}): GuestRep => ({ id: "g1", title: null, content: "Làm sao để giải phương trình bậc hai?", guestName: "Bé Na", createdAt: vn("2026-10-13", "11:00"), phoneOrLink: false, ...o });
const jn = (o: Partial<JoinRep> = {}): JoinRep => ({ courseId: "c9", courseName: "Lý 10", ownerName: "Thầy Nam", count: 3, oldestAt: vn("2026-10-09", "08:00"), ...o });
type In = Parameters<typeof buildAdminQueue>[0];
const run = (p: Partial<In>) => buildAdminQueue({ ...p, now: NOW } as In);
const act = (it: QueueItem, k: string) => it.detail.actions.find(a => a.key === k)!;

section("Hồ sơ gia sư xin duyệt");
let q = run({ tutors: [tutor()] });
let it = q.items[0];
check("một dòng, kind gia-su, nhóm duyet, 'Chờ duyệt'", q.items.length === 1 && it.kind === "gia-su" && it.group === "duyet" && it.status.label === "Chờ duyệt" && it.status.tone === "cho");
check("tiêu đề + phụ đề: môn và thành phố; who = tên đầy đủ (người lớn tự khai)", it.title === "Hồ sơ gia sư: Lê Thu" && it.subtitle === "Toán, Lý · Hà Nội" && it.who === "Lê Thu", it.subtitle);
check("hai lệnh: Duyệt (không cần lý do) và Từ chối (bắt buộc lý do ≤ 500)", it.detail.actions.length === 2 && it.detail.actions[0].key === "approve" && !it.detail.actions[0].reason && it.detail.actions[1].key === "reject" && it.detail.actions[1].reason?.max === 500);
check("đúng API đã có: approve/reject theo id người nộp", it.detail.actions[0].url === "/api/admin/tutor-applications/u1/approve" && it.detail.actions[1].url === "/api/admin/tutor-applications/u1/reject" && it.detail.actions.every(a => a.method === "POST"));
check("không lệnh nhanh, không hàng loạt (không bao giờ hàng loạt gia sư)", it.quick === undefined && it.bulk.length === 0);
check("liên kết sang lịch sử đơn (/admin/gia-su), KHÔNG còn trỏ /admin/ho-so-gia-su", it.detail.links[0].href === "/admin/gia-su");
q = run({ tutors: [tutor({ emailVerified: false })] });
it = q.items[0];
check("chưa xác thực email: trạng thái đỏ + nút Duyệt bị khoá kèm lý do", it.status.label === "Chưa xác thực email" && it.status.tone === "loi" && !!act(it, "approve").disabled && !act(it, "reject").disabled);
q = run({ tutors: [tutor({ subjects: [], city: null, bio: null, phone: null })] });
check("thiếu môn / thành phố / giới thiệu: có câu rõ ràng, không rỗng", q.items[0].subtitle === "Chưa ghi môn dạy" && q.items[0].detail.sections[0].text === "Người nộp đơn chưa viết giới thiệu.");

section("Báo cáo bài viết");
q = run({ threads: [thread()] });
it = q.items[0];
check("kind bai-viet, 'Chờ xử lý'; chỉ lệnh 'Giữ bài lại' được làm hàng loạt", it.kind === "bai-viet" && it.status.label === "Chờ xử lý" && it.bulk.join() === "keep" && it.quick === undefined);
check("Gỡ bài (hỏi lại, decision approved) + Giữ bài lại (decision rejected)", act(it, "remove").confirm && JSON.stringify(act(it, "remove").body) === '{"decision":"approved"}' && !act(it, "keep").confirm && JSON.stringify(act(it, "keep").body) === '{"decision":"rejected"}');
check("đúng API: /api/admin/thread-reports/<id>/resolve", it.detail.actions.every(a => a.url === "/api/admin/thread-reports/t1/resolve" && a.method === "POST"));
check("khung đọc: nội dung bài, lý do, người báo cáo + bài của ai + lớp nào", it.detail.sections.map(s => s.title).join("|") === "Nội dung bài viết|Lý do báo cáo|Người báo cáo" && it.detail.sections[2].text === "An · bài của Bình · cộng đồng chung");
q = run({ threads: [thread({ course: "Toán 9", content: "  ", reason: "" })] });
check("lớp có tên được ghi; bài trống / không lý do vẫn có câu; place = tên lớp", q.items[0].detail.sections[2].text.endsWith("Toán 9") && q.items[0].detail.sections[0].text === "(bài không có chữ)" && q.items[0].place === "Toán 9");
check("phụ đề cắt gọn có '…'", run({ threads: [thread({ content: "x".repeat(200) })] }).items[0].subtitle.length <= SNIPPET && run({ threads: [thread({ content: "x".repeat(200) })] }).items[0].subtitle.endsWith("…"));
q = run({ threads: [thread({ reporter: "Trần Thị Bích", author: "Lê Văn Hoàng" })] });
check("học sinh báo cáo / tác giả: TÊN RÚT GỌN trong dòng và khung đọc, không lộ họ tên đầy đủ", q.items[0].who === "Bích T." && !JSON.stringify(q.items[0]).includes("Trần Thị Bích") && !JSON.stringify(q.items[0]).includes("Lê Văn Hoàng") && q.items[0].detail.heading === "Bài viết của Hoàng L. bị báo cáo", q.items[0].detail.heading);

section("Báo cáo hồ sơ gia sư");
q = run({ profiles: [prof()] });
it = q.items[0];
check("kind ho-so, Khoá cần lý do ≤ 500 (PATCH lock), Bỏ qua không cần (dismiss); chỉ 'Bỏ qua' được hàng loạt", it.kind === "ho-so" && act(it, "lock").reason?.max === 500 && act(it, "lock").method === "PATCH" && JSON.stringify(act(it, "lock").body) === '{"action":"lock"}' && !act(it, "dismiss").reason && JSON.stringify(act(it, "dismiss").body) === '{"action":"dismiss"}' && it.bulk.join() === "dismiss");
check("đúng API: /api/admin/profile-reports/<id>", it.detail.actions.every(a => a.url === "/api/admin/profile-reports/p1"));
check("khung đọc nói rõ khoá làm gì", it.detail.sections.some(s => s.title === "Khoá hồ sơ làm gì" && /ẩn hồ sơ công khai/.test(s.text)));
q = run({ profiles: [prof({ detail: "Số điện thoại không đúng", channel: "Zalo" })] });
check("chi tiết + kênh báo hiện khi có; place = kênh", q.items[0].detail.sections.some(s => s.title === "Chi tiết") && q.items[0].detail.sections.some(s => s.title === "Báo cáo từ" && s.text === "Zalo") && q.items[0].place === "Zalo");

section("Báo cáo câu trả lời: xử lý trong panel, NHƯNG có thể trừ Coin");
q = run({ answers: [ans(), ans({ id: "a2", rewardPaid: 20, author: "Phạm Thị Dung" })] });
const a1 = q.items.find(i => i.id === "tra-loi:a1")!, a2 = q.items.find(i => i.id === "tra-loi:a2")!;
check("có 2 lệnh (Xác nhận vi phạm / Giữ câu trả lời) gọi /api/admin/answer-reports/<id>/resolve", [a1, a2].every(i => i.detail.actions.length === 2 && i.detail.actions.every(a => a.url === `/api/admin/answer-reports/${i.id.split(":")[1]}/resolve` && a.method === "POST")) && JSON.stringify(act(a1, "remove").body) === '{"decision":"approved"}' && JSON.stringify(act(a1, "keep").body) === '{"decision":"rejected"}');
check("không bao giờ hàng loạt, không lệnh nhanh (cả hai dòng)", [a1, a2].every(i => i.bulk.length === 0 && i.quick === undefined));
check("đã trả thưởng: nút Xác nhận vi phạm đòi tick 'Tôi hiểu sẽ trừ 20 Coin của …' và panel có mục 'Sẽ trừ Coin'", act(a2, "remove").ack === "Tôi hiểu sẽ trừ 20 Coin của Dung P." && a2.detail.sections.some(s => s.title === "Sẽ trừ Coin" && s.text.includes("20 Coin") && s.text.includes("Dung P.")), act(a2, "remove").ack);
check("chưa trả thưởng: không đòi tick, không mục trừ Coin", !act(a1, "remove").ack && !a1.detail.sections.some(s => s.title === "Sẽ trừ Coin"));
check("lệnh 'Giữ câu trả lời' không bao giờ đòi tick (không trừ gì)", !act(a2, "keep").ack);

section("Đánh giá khoá học (mới)");
q = run({ reviews: [rev()] });
it = q.items[0];
check("kind danh-gia, nhóm duyet; tiêu đề 'Đánh giá · Toán 9 · 4 sao'; who rút gọn 'Bích T.'; place = lớp", it.kind === "danh-gia" && it.group === "duyet" && it.title === "Đánh giá · Toán 9 · 4 sao" && it.who === "Bích T." && it.place === "Toán 9", it.title);
check("lệnh nhanh DUY NHẤT là 'approve'; hàng loạt cả duyệt lẫn từ chối", it.quick === "approve" && it.bulk.join() === "approve,reject");
check("đúng API: PATCH /api/admin/reviews/<id> với status approved / rejected, không cần lý do", act(it, "approve").method === "PATCH" && act(it, "approve").url === "/api/admin/reviews/r1" && JSON.stringify(act(it, "approve").body) === '{"status":"approved"}' && JSON.stringify(act(it, "reject").body) === '{"status":"rejected"}' && !act(it, "approve").reason && !act(it, "reject").reason);
check("không lộ tên đầy đủ của người đánh giá (có thể là học sinh)", !JSON.stringify(it).includes("Trần Thị Bích"));
check("số sao ngoài khoảng 0–5 bị kẹp, không in '9 sao'", run({ reviews: [rev({ rating: 9 })] }).items[0].title.endsWith("5 sao") && run({ reviews: [rev({ rating: -2 })] }).items[0].title.endsWith("0 sao"));

section("Nạp Coin (mới): API duyệt cũ, không đổi");
q = run({ topups: [top()], viewerId: "uSuper" });
it = q.items[0];
check("kind nap-coin, nhóm duyet; who rút gọn; tiêu đề có số Coin", it.kind === "nap-coin" && it.group === "duyet" && it.who === "Cường N." && it.title === "Nạp Coin · 1250000 Coin", it.title);
check("số tiền khai báo chỉ là CHUỖI hiển thị: '1.250.000 đ' trong phụ đề và khung đọc", it.subtitle.includes("1.250.000 đ") && it.detail.sections.find(s => s.title === "Số tiền khai báo")?.text === "1.250.000 đ" && formatVndText(0) === "0 đ" && formatVndText(999) === "999 đ" && formatVndText(1000) === "1.000 đ");
check("đúng API cũ: POST /api/admin/topups/<id>/approve và /reject", act(it, "approve").url === "/api/admin/topups/n1/approve" && act(it, "reject").url === "/api/admin/topups/n1/reject" && it.detail.actions.every(a => a.method === "POST"));
check("Duyệt đòi tick 'Đã đối chiếu sao kê'; Từ chối đòi lý do ≤ 500", act(it, "approve").ack === "Đã đối chiếu sao kê" && act(it, "reject").reason?.max === 500);
check("KHÔNG BAO GIỜ lệnh nhanh / hàng loạt cho tiền", it.quick === undefined && it.bulk.length === 0);
check("người xem KHÁC người yêu cầu → Duyệt không bị khoá", !act(it, "approve").disabled);
q = run({ topups: [top()], viewerId: "uX" });
check("người xem = người yêu cầu → Duyệt bị khoá 'Không tự duyệt yêu cầu của chính mình'; Từ chối vẫn bấm được", act(q.items[0], "approve").disabled === "Không tự duyệt yêu cầu của chính mình" && !act(q.items[0], "reject").disabled);
check("không viewerId (chưa biết) thì không khoá nhầm", !act(run({ topups: [top()] }).items[0], "approve").disabled);
check("JSON dòng không chứa userId của người nạp", !JSON.stringify(run({ topups: [top({ requesterId: "uBiMat123" })], viewerId: "x" }).items[0]).includes("uBiMat123"));
check("ghi chú / mã trống có câu thay thế", run({ topups: [top({ note: null, bankRef: null })] }).items[0].detail.sections.some(s => s.text === "Không có ghi chú.") && run({ topups: [top({ bankRef: null })] }).items[0].subtitle.includes("không có"));

section("Câu hỏi của khách (mới; BU-05) và Yêu cầu vào lớp (mới; BU-01)");
q = run({ guests: [guest(), guest({ id: "g2", phoneOrLink: true, createdAt: vn("2026-10-13", "12:00") })] });
const g1 = q.items.find(i => i.id === "khach-hoi:g1")!, g2 = q.items.find(i => i.id === "khach-hoi:g2")!;
check("khach-hoi: who = tên khách tự gõ; place 'Hỏi đáp công khai'; nhóm duyet", g1.kind === "khach-hoi" && g1.who === "Bé Na" && g1.place === "Hỏi đáp công khai" && g1.group === "duyet");
check("duyệt / từ chối gọi POST /api/community/moderation/<id> (decision approve / reject); từ chối đòi lý do ≤ 300", act(g1, "approve").url === "/api/community/moderation/g1" && JSON.stringify(act(g1, "approve").body) === '{"decision":"approve"}' && JSON.stringify(act(g1, "reject").body) === '{"decision":"reject"}' && act(g1, "reject").reason?.max === 300);
check("có số điện thoại / đường dẫn → Duyệt đòi tick; không có thì không", !!act(g2, "approve").ack && g2.flags?.phoneOrLink === true && !act(g1, "approve").ack && g1.flags?.phoneOrLink === false);
check("không bao giờ hàng loạt / lệnh nhanh cho câu hỏi của khách", [g1, g2].every(i => i.bulk.length === 0 && i.quick === undefined));
q = run({ joins: [jn()] });
it = q.items[0];
check("vao-lop: nhóm theo-doi, id theo LỚP, who = tên lớp, place = 'Gia sư <chủ lớp>'", it.kind === "vao-lop" && it.group === "theo-doi" && it.id === "vao-lop:c9" && it.who === "Lý 10" && it.place === "Gia sư Thầy Nam");
check("KHÔNG có lệnh duyệt nào; đúng 1 liên kết 'Mở lớp' sang /admin/khoa-hoc/<id>/hoc-vien", it.detail.actions.length === 0 && it.quick === undefined && it.bulk.length === 0 && it.detail.links.length === 1 && it.detail.links[0].label === "Mở lớp" && it.detail.links[0].href === "/admin/khoa-hoc/c9/hoc-vien");
check("chờ ≥ 3 ngày (cũ nhất 9/10, nay 13/10) → tone 'loi' 'Chờ quá 3 ngày'", it.status.tone === "loi" && it.status.label === `Chờ quá ${JOIN_SLOW_DAYS} ngày`);
check("chờ chưa tới 3 ngày → tone 'cho' 'Chờ gia sư'", run({ joins: [jn({ oldestAt: vn("2026-10-12", "20:00") })] }).items[0].status.tone === "cho");
check("biên đúng 3 ngày (72 giờ) tính là quá hạn; thiếu 1 phút thì chưa", run({ joins: [jn({ oldestAt: new Date(NOW.getTime() - 72 * 3_600_000) })] }).items[0].status.tone === "loi" && run({ joins: [jn({ oldestAt: new Date(NOW.getTime() - 72 * 3_600_000 + 60_000) })] }).items[0].status.tone === "cho");
check("không tên học sinh / userId trong JSON (chỉ lớp, chủ lớp, số lượng)", !/userId|student|học sinh tên/i.test(JSON.stringify(it)) && it.subtitle === "3 yêu cầu chờ · đã chờ 4 ngày", it.subtitle);
check("vao-lop không tính vào badge của kết quả dựng", run({ joins: [jn()], reviews: [rev()] }).badge === 1);

section("Quyền từng loại (ma trận vai × loại)");
const SUPER: AdminRole = "admin_super", CONTENT: AdminRole = "admin_content", TEACHER: AdminRole = "teacher";
const ext = { joinRequests: true, guestQuestions: true };
check("admin_super thấy cả 6 loại thật khi chưa có nhánh B (gia-su, bai-viet, ho-so, tra-loi, danh-gia, nap-coin)", visibleKinds(SUPER).join() === "gia-su,bai-viet,ho-so,tra-loi,danh-gia,nap-coin", visibleKinds(SUPER));
check("admin_super thấy cả 8 khi nhánh B đã gộp", visibleKinds(SUPER, ext).length === 8);
check("admin_content thấy 5 loại, KHÔNG có nap-coin (cần MANAGE_REVENUE)", visibleKinds(CONTENT).join() === "gia-su,bai-viet,ho-so,tra-loi,danh-gia" && !canSeeKind(CONTENT, "nap-coin"), visibleKinds(CONTENT));
check("admin_content có khach-hoi và vao-lop khi nhánh B đã gộp", visibleKinds(CONTENT, ext).includes("khach-hoi") && visibleKinds(CONTENT, ext).includes("vao-lop") && visibleKinds(CONTENT, ext).length === 7);
check("gia sư (teacher) KHÔNG thấy loại nào dù có MANAGE_COURSES (danh-gia) — kể cả khi nhánh B đã gộp", QUEUE_KINDS.every(k => !canSeeKind(TEACHER, k)) && visibleKinds(TEACHER, ext).length === 0 && checkPermission(TEACHER, PERMISSIONS.MANAGE_COURSES));
check("chưa biết vai / null / undefined → không loại nào", visibleKinds(null, ext).length === 0 && visibleKinds(undefined, ext).length === 0);
check("loại nhánh B vắng khi chưa gộp: không truyền support = không có khach-hoi / vao-lop", !visibleKinds(SUPER).includes("khach-hoi") && !visibleKinds(SUPER).includes("vao-lop") && !visibleKinds(SUPER, { joinRequests: false, guestQuestions: true }).includes("vao-lop") && visibleKinds(SUPER, { joinRequests: false, guestQuestions: true }).includes("khach-hoi"));
check("quyền route duyệt gia sư (requireCenterAdmin = admin_super + admin_content) TRÙNG tập vai có MANAGE_TUTORS (nếu lệch ⇒ đỏ)",
  (["admin_super", "admin_content", "teacher"] as AdminRole[]).filter(r => checkPermission(r, PERMISSIONS.MANAGE_TUTORS)).join() === "admin_super,admin_content");
check("isQueueKind: nhận 8 loại, từ chối chuỗi lạ / số / null", QUEUE_KINDS.every(isQueueKind) && !isQueueKind("khac") && !isQueueKind(null) && !isQueueKind(3) && QUEUE_KINDS.length === 8);

section("Tên rút gọn (tuổi nhỏ: không lộ họ tên đầy đủ)");
check("'Trần Thị Bích' → 'Bích T.'; 'An Nguyễn' → 'Nguyễn A.'", shortName("Trần Thị Bích") === "Bích T." && shortName("An Nguyễn") === "Nguyễn A.");
check("một từ giữ nguyên; thừa dấu cách gọn lại; rỗng / null → 'Người dùng'", shortName("An") === "An" && shortName("  Lê   Văn   Hoàng ") === "Hoàng L." && shortName("") === "Người dùng" && shortName(null) === "Người dùng" && shortName(undefined) === "Người dùng");
check("nhân sự hiện đủ tên", shortName("Trần Thị Bích", true) === "Trần Thị Bích");
check("chữ cái đầu họ viết hoa theo tiếng Việt ('đặng văn khoa' → 'khoa Đ.')", shortName("đặng văn khoa") === "khoa Đ.", shortName("đặng văn khoa"));

section("Gộp, thứ tự, badge, hàng loạt an toàn");
q = run({ tutors: [tutor()], threads: [thread()], profiles: [prof()], answers: [ans()], reviews: [rev()], topups: [top()], guests: [guest()], joins: [jn()] });
check("tám loại trong cùng một hàng chờ", new Set(q.items.map(i => i.kind)).size === 8 && q.items.length === 8);
check("chờ lâu nhất lên trước (vao-lop 9/10 → ho-so 10/10 → bai-viet 11/10 → gia-su 12/10 → … )", q.items[0].kind === "vao-lop" && q.items[1].kind === "ho-so" && q.items[2].kind === "bai-viet" && q.items[3].kind === "gia-su", q.items.map(i => i.kind));
check("badge của kết quả = số dòng nhóm duyet (7); vao-lop (theo-doi) KHÔNG tính", q.badge === 7 && QUEUE_KIND_GROUP["vao-lop"] === "theo-doi");
check("id duy nhất và mang tiền tố loại", new Set(q.items.map(i => i.id)).size === 8 && q.items.every(i => i.id.startsWith(i.kind + ":")));
check("cùng thời điểm: thứ tự ổn định theo id", run({ threads: [thread({ id: "b" }), thread({ id: "a" })] }).items.map(i => i.id).join() === "bai-viet:a,bai-viet:b");
check("không có dữ liệu → trống, badge 0", run({}).items.length === 0 && run({}).badge === 0);
check("mỗi dòng có tiêu đề, phụ đề, who, place, nhãn thời gian, khung đọc có tiêu đề + meta + ít nhất một mục", q.items.every(i => i.title && i.subtitle && i.who && i.place && i.when && i.detail.heading && i.detail.meta && i.detail.sections.length >= 1));
check("mỗi dòng ≤ 2 nút hiển thị ngoài hàng (Xem + tối đa một lệnh nhanh), và `quick` luôn trỏ tới một lệnh có thật", q.items.every(i => (1 + (i.quick ? 1 : 0)) <= 2 && (!i.quick || i.detail.actions.some(a => a.key === i.quick))));
check("chỉ MỘT loại có lệnh nhanh: danh-gia", q.items.filter(i => i.quick).map(i => i.kind).join() === "danh-gia");
const bulkPairs = q.items.flatMap(i => i.bulk.map(b => `${i.kind}:${b}`)).sort().join();
check("`bulk` chỉ ở 4 lệnh an toàn: danh-gia duyệt/từ chối, bai-viet giữ bài, ho-so bỏ qua", bulkPairs === "bai-viet:keep,danh-gia:approve,danh-gia:reject,ho-so:dismiss", bulkPairs);
check("quét toàn bộ: không loại tiền / trừ Coin / gỡ / khoá / duyệt gia sư nào có bulk; mọi bulk tồn tại trong actions", q.items.filter(i => ["nap-coin", "tra-loi", "gia-su", "khach-hoi", "vao-lop"].includes(i.kind)).every(i => i.bulk.length === 0)
  && q.items.every(i => i.bulk.every(b => i.detail.actions.some(a => a.key === b) && b !== "remove" && b !== "lock")));
check("lệnh có `ack` chỉ nằm ở nap-coin / tra-loi có thưởng / khach-hoi có SĐT — và lệnh đó KHÔNG nằm trong bulk", q.items.every(i => i.detail.actions.filter(a => a.ack).every(a => !i.bulk.includes(a.key))));
check("JSON toàn hàng chờ không chứa email / điện thoại của người KHÔNG phải đơn gia sư", (() => {
  const others = q.items.filter(i => i.kind !== "gia-su");
  return !/@|0901234567/.test(JSON.stringify(others));
})());
const many = run({ threads: Array.from({ length: MAX_QUEUE_ITEMS + 30 }, (_, i) => thread({ id: `t${String(i).padStart(3, "0")}`, createdAt: new Date(NOW.getTime() - (1000 - i) * 60_000) })) });
check(`mặc định cắt ở ${MAX_QUEUE_ITEMS} dòng (giữ những dòng chờ lâu nhất)`, many.items.length === MAX_QUEUE_ITEMS && many.items[0].id === "bai-viet:t000");
check("`limit` tuỳ chọn cắt theo yêu cầu; số đếm chính xác KHÔNG lấy từ độ dài này (máy chủ dùng count())", run({ threads: many.items.map((_, i) => thread({ id: `x${i}` })), limit: 10 }).items.length === 10);
check("badgeOf cộng CHÍNH XÁC từ counts, không cắt ở 100: 120 đánh giá + 3 gia sư + 2 vao-lop → 123", badgeOf({ "danh-gia": 120, "gia-su": 3, "vao-lop": 2 }) === 123 && badgeOf({}) === 0 && badgeOf({ "nap-coin": 0 }) === 0);

section("Con trỏ phân trang");
const c = encodeCursor({ at: "2026-10-13T03:00:00.000Z", id: "danh-gia:r7" });
check("mã hoá rồi giải mã ra đúng at|id; chuỗi chỉ gồm [A-Za-z0-9_-]", /^[A-Za-z0-9_-]+$/.test(c) && JSON.stringify(decodeCursor(c)) === '{"at":"2026-10-13T03:00:00.000Z","id":"danh-gia:r7"}');
check("con trỏ hỏng → null: rỗng / null / ký tự lạ / không có '|' / ngày sai / id rỗng", [undefined, null, "", "!!!", btoa("khong-co-gach"), btoa("2026-13-99|x"), btoa("2026-10-13T03:00:00.000Z|"), btoa("abc|x")].every(b => decodeCursor(b as string | null | undefined) === null));
const cur = { at: "2026-10-13T03:00:00.000Z", id: "danh-gia:r7" };
check("afterCursor: sau theo (at,id); đúng bằng con trỏ thì KHÔNG nằm sau", afterCursor({ at: cur.at, id: "danh-gia:r8" }, cur) && afterCursor({ at: "2026-10-13T03:00:00.001Z", id: "a" }, cur) && !afterCursor(cur, cur) && !afterCursor({ at: cur.at, id: "danh-gia:r6" }, cur) && !afterCursor({ at: "2026-10-13T02:59:59.999Z", id: "z" }, cur));
// 120 đánh giá cùng 1 phút + 3 trang: không trùng, không sót
(() => {
  const all = Array.from({ length: 120 }, (_, i) => rev({ id: `r${String(i).padStart(3, "0")}`, createdAt: new Date(NOW.getTime() - 5_000_000 + Math.floor(i / 10) * 1000) })); // 10 dòng trùng giờ mỗi nhóm
  const full = run({ reviews: all, limit: 1000 }).items;
  const seen: string[] = []; let cursor: ReturnType<typeof decodeCursor> = null;
  for (let page = 0; page < 10; page++) {
    const rest = cursor ? full.filter(i => afterCursor(i, cursor!)) : full;
    const part = rest.slice(0, 50);
    seen.push(...part.map(i => i.id));
    if (rest.length <= 50) break;
    cursor = decodeCursor(encodeCursor({ at: part[part.length - 1].at, id: part[part.length - 1].id }));
  }
  check("120 dòng chia trang 50: tổng đúng 120, không trùng, không sót, giữ thứ tự", seen.length === 120 && new Set(seen).size === 120 && seen.join() === full.map(i => i.id).join(), seen.length);
})();

section("Nhãn thời gian");
check("hôm nay → giờ VN (19:30)", agoLabel(vn("2026-10-13", "19:30"), NOW) === "19:30");
check("sau nửa đêm giờ VN vẫn đúng ngày VN", agoLabel(new Date("2026-10-13T17:05:00Z"), new Date("2026-10-14T01:00:00Z")) === "00:05");
check("hôm qua → 'Hôm qua'; cũ hơn → dd/mm", agoLabel(vn("2026-10-12", "23:02"), NOW) === "Hôm qua" && agoLabel(vn("2026-10-10", "10:00"), NOW) === "10/10");
check("đã chờ: 3 ngày / 5 giờ / 12 phút / vừa gửi", waitedText(new Date(NOW.getTime() - 3 * 86_400_000 - 5 * 3_600_000), NOW) === "đã chờ 3 ngày" && waitedText(new Date(NOW.getTime() - 5 * 3_600_000), NOW) === "đã chờ 5 giờ" && waitedText(new Date(NOW.getTime() - 12 * 60_000), NOW) === "đã chờ 12 phút" && waitedText(new Date(NOW.getTime() - 5_000), NOW) === "vừa gửi");
check("giờ ở tương lai (lệch đồng hồ) không âm: 'vừa gửi'", waitedText(new Date(NOW.getTime() + 60_000), NOW) === "vừa gửi");

section("Mọi trang quản trị đang có đều có chỗ đứng trong một module");
const root = join(process.cwd(), "src/app/(admin)/admin");
const routes: string[] = [];
const walk = (dir: string, url: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, `${url}/${name.replace(/^\[.+\]$/, "x")}`);
    else if (name === "page.tsx") routes.push(url || "/admin");
  }
};
walk(root, "/admin");
const goneFrom = new Set(ADMIN_REDIRECTS.map(r => r.from)); // t-admin-redirects-lib kiểm riêng việc các trang cũ đã bị xoá
const orphan = routes.filter(r => !goneFrom.has(r) && !matchSub(r)); // ADM-003 (#92): trang mẫu đã chuyển ra docs, không còn ngoại lệ
check(`${routes.length} trang quản trị tìm thấy; trang mới thêm mà quên đưa vào module sẽ làm ca này đỏ`, routes.length >= 18 && orphan.length === 0, orphan);

done();
