// BU-08 mục 4.4 — dò nhánh chưa gộp (src/lib/adminQueueExternal.ts): `khach-hoi` (BU-05) và `vao-lop` (BU-01) chỉ bật khi model/cột có.
// Ca phá cố ý: để detectExternal trả guestQuestions=true khi thiếu `guestName` → ca "chỉ có status" đỏ; bỏ kiểm `guestName` trong isGuestRow → ca "hàng lạ bị bỏ" đỏ;
// để toJoinRep mang theo `userId` → ca "vao-lop không mang userId" đỏ.
import { detectExternal, isGuestRow, isJoinGroupRow, looksLikePhoneOrLink, toGuestRep, toJoinRep } from "@/lib/adminQueueExternal";
import { buildAdminQueue, visibleKinds } from "@/lib/adminQueue";
import { Prisma } from "@/generated/prisma/client";
import { check, section, done } from "./h";

const NOW = new Date("2026-11-02T03:00:00Z");

section("detectExternal (bảng giả)");
check("thiếu cả hai → false / false", JSON.stringify(detectExternal({ User: "User" }, { id: "id", content: "content" })) === '{"joinRequests":false,"guestQuestions":false}');
check("có ClassJoinRequest → joinRequests", detectExternal({ ClassJoinRequest: "ClassJoinRequest" }, {}).joinRequests === true);
check("Thread có status + guestName → guestQuestions", detectExternal({}, { status: "status", guestName: "guestName" }).guestQuestions === true);
check("chỉ có status (thiếu guestName) → false", detectExternal({}, { status: "status" }).guestQuestions === false);
check("chỉ có guestName (thiếu status) → false", detectExternal({}, { guestName: "guestName" }).guestQuestions === false);
check("tên model gần giống (classjoinrequest, ClassJoinRequests) → false; không dò theo tiền tố của Object", !detectExternal({ classjoinrequest: "x", ClassJoinRequests: "x" }, {}).joinRequests && !detectExternal({}, {}).joinRequests && !detectExternal({}, {}).guestQuestions);
check("null / không phải đối tượng không ném", (() => { try { return detectExternal(null as never, undefined as never).joinRequests === false; } catch { return false; } })());

section("Bản sinh Prisma hiện tại (chạy được trên main khi chưa có model)");
const now = detectExternal(Prisma.ModelName as Record<string, string>, Prisma.ThreadScalarFieldEnum as Record<string, string>);
console.log(`  ℹ bản sinh hiện tại: ClassJoinRequest=${now.joinRequests} · Thread.status+guestName=${now.guestQuestions}`);
check("`Prisma.ModelName` và `Prisma.ThreadScalarFieldEnum` xuất ra ở RUNTIME (đối tượng có khoá)", Object.keys(Prisma.ModelName).length > 10 && Object.keys(Prisma.ThreadScalarFieldEnum).includes("content"));
check("khớp với schema.prisma hiện tại: có ClassJoinRequest ⇔ schema có model đó", now.joinRequests === ("ClassJoinRequest" in Prisma.ModelName));
check("khi chưa hỗ trợ, visibleKinds KHÔNG liệt kê loại đó (vắng khoá, không phải 0)", (!now.joinRequests ? !visibleKinds("admin_super", now).includes("vao-lop") : true) && (!now.guestQuestions ? !visibleKinds("admin_super", now).includes("khach-hoi") : true));

section("Kiểm dạng hàng thô (hàng lạ bị bỏ, không ném)");
const okGuest = { id: "g1", content: "Câu hỏi?", guestName: "Bé Na", createdAt: new Date("2026-11-01T01:00:00Z") };
check("hàng đúng dạng → nhận", isGuestRow(okGuest));
check("thiếu guestName / guestName rỗng / null → bỏ", !isGuestRow({ ...okGuest, guestName: undefined }) && !isGuestRow({ ...okGuest, guestName: "  " }) && !isGuestRow({ ...okGuest, guestName: null }));
check("thiếu id / content / createdAt sai → bỏ", !isGuestRow({ ...okGuest, id: "" }) && !isGuestRow({ ...okGuest, content: 5 }) && !isGuestRow({ ...okGuest, createdAt: "không phải ngày" }) && !isGuestRow(null) && !isGuestRow("x") && !isGuestRow(undefined));
check("toGuestRep: tên khách được cắt khoảng trắng; createdAt chuỗi ISO được nhận; hàng lạ → null", toGuestRep({ ...okGuest, guestName: "  Bé Na " })?.guestName === "Bé Na" && toGuestRep({ ...okGuest, createdAt: "2026-11-01T01:00:00Z" })?.createdAt.toISOString() === "2026-11-01T01:00:00.000Z" && toGuestRep({ id: 1 }) === null);
check("title không phải chuỗi → null (BU-05 có thể chưa có cột title)", toGuestRep({ ...okGuest, title: 5 })?.title === null && toGuestRep({ ...okGuest, title: " Tiêu đề " })?.title === "Tiêu đề");
const okJoin = { courseId: "c1", _count: { _all: 3 }, _min: { createdAt: new Date("2026-10-29T00:00:00Z") } };
check("nhóm vao-lop đúng dạng → nhận; count 0 / thiếu _min / courseId rỗng → bỏ", isJoinGroupRow(okJoin) && !isJoinGroupRow({ ...okJoin, _count: { _all: 0 } }) && !isJoinGroupRow({ ...okJoin, _min: {} }) && !isJoinGroupRow({ ...okJoin, courseId: "" }) && !isJoinGroupRow({}) && !isJoinGroupRow(null));

section("Số điện thoại / đường dẫn (bắt tick xác nhận)");
const phone = ["Gọi em 0901234567 nhé", "zalo 090 123 4567", "+84 912 345 678", "đt: 0912.345.678", "84912345678"];
const link = ["xem https://abc.com/x", "vào www.hoc.vn", "kết bạn zalo.me/abc", "facebook fb.com/abc", "xem abc.vn"];
const clean = ["Làm sao giải phương trình bậc hai?", "Bài 12 trang 45 câu 3", "Năm 2026 có 365 ngày", "tính 12 + 34 = ?"];
check("nhận ra số điện thoại (nhiều kiểu gõ)", phone.every(looksLikePhoneOrLink), phone.filter(t => !looksLikePhoneOrLink(t)));
check("nhận ra đường dẫn / tên miền / zalo / fb", link.every(looksLikePhoneOrLink), link.filter(t => !looksLikePhoneOrLink(t)));
check("câu hỏi bình thường không bị báo nhầm", clean.every(t => !looksLikePhoneOrLink(t)), clean.filter(t => looksLikePhoneOrLink(t)));
check("toGuestRep gắn cờ phoneOrLink theo tiêu đề + nội dung", toGuestRep({ ...okGuest, content: "gọi 0901234567" })?.phoneOrLink === true && toGuestRep(okGuest)?.phoneOrLink === false);

section("vao-lop: không tên học sinh, không userId");
const courses = new Map([["c1", { name: "Lý 10", ownerName: "Thầy Nam" }]]);
const rep = toJoinRep({ ...okJoin, userId: "uBiMat", studentName: "Em Bí Mật" }, courses);
check("ghép với tên lớp / chủ lớp, mang số lượng và ngày cũ nhất", rep?.courseName === "Lý 10" && rep?.ownerName === "Thầy Nam" && rep?.count === 3 && rep?.oldestAt.toISOString() === "2026-10-29T00:00:00.000Z");
check("KHÔNG mang userId / tên học sinh dù hàng thô có", !JSON.stringify(rep).includes("uBiMat") && !JSON.stringify(rep).includes("Bí Mật"));
check("lớp không còn (đã xoá) → bỏ; hàng lạ → bỏ", toJoinRep(okJoin, new Map()) === null && toJoinRep({ courseId: "c1" }, courses) === null);
const it = buildAdminQueue({ joins: [rep!], now: NOW }).items[0];
check("dòng dựng ra: 4 ngày → tone loi (≥ 3 ngày), nhóm theo-doi, không lệnh duyệt", it.status.tone === "loi" && it.group === "theo-doi" && it.detail.actions.length === 0 && !JSON.stringify(it).includes("uBiMat"));
done();
