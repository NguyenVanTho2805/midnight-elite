// NC2-033 — phần thuần src/lib/sessionVerify.ts: khi nào đối chiếu DB, và kết luận khi vai/khoá lệch token.
import { METHOD_HEADER, isWriteMethod, reconcileSession, type TokenSession } from "@/lib/sessionVerify";
import { check, section, done } from "./h";

const NOW = Date.UTC(2026, 9, 22, 5, 0, 0);
const H = 3_600_000, D = 24 * H;
const iatAgo = (ms: number) => Math.floor((NOW - ms) / 1000);
const tok = (role: "student" | "admin", adminRole: TokenSession["adminRole"], agoMs = 1 * H): TokenSession => ({ userId: "u1", role, ...(adminRole ? { adminRole } : {}), iat: iatAgo(agoMs), exp: iatAgo(agoMs) + 30 * 86400 });
const db = (role: string, adminRole: string | null, banned = false) => ({ role, adminRole, banned });

section("Phương thức nào phải đối chiếu DB");
check("tên tiêu đề cố định", METHOD_HEADER === "x-kin-method");
check("GET/HEAD/OPTIONS (mọi kiểu chữ) bỏ qua", ["GET", "get", "HEAD", "OPTIONS"].every(m => !isWriteMethod(m)));
check("POST/PUT/PATCH/DELETE phải đối chiếu", ["POST", "PUT", "PATCH", "DELETE", "post"].every(isWriteMethod));
check("thiếu tiêu đề / rỗng / lạ → coi là GHI (an toàn)", isWriteMethod(null) && isWriteMethod(undefined) && isWriteMethod("") && isWriteMethod("PURGE"));

section("Vai khớp DB");
const same = reconcileSession(tok("admin", "admin_super"), db("admin", "admin_super"), NOW);
check("khớp → giữ nguyên token (kể cả iat/exp)", same.ok && same.session.iat === tok("admin", "admin_super").iat && same.session.adminRole === "admin_super");
check("học sinh khớp", reconcileSession(tok("student", undefined), db("student", null), NOW).ok);

section("Hạ quyền / đổi vai: DB thắng");
const dg = reconcileSession(tok("admin", "admin_super"), db("student", null), NOW);
check("quản trị bị gỡ vai → học sinh, không còn adminRole", dg.ok && dg.session.role === "student" && !("adminRole" in dg.session), dg);
const dg2 = reconcileSession(tok("admin", "admin_super"), db("admin", "teacher"), NOW);
check("admin_super → teacher", dg2.ok && dg2.session.adminRole === "teacher");
check("giữ iat khi đổi vai (không kéo dài phiên)", dg2.ok && dg2.session.iat === tok("admin", "admin_super").iat);
const up = reconcileSession(tok("student", undefined, 3 * H), db("admin", "teacher"), NOW);
check("gia sư vừa được duyệt: token student → teacher theo DB", up.ok && up.session.role === "admin" && up.session.adminRole === "teacher");
check("adminRole lạ trong DB → admin trơn, không bịa adminRole", (() => { const r = reconcileSession(tok("student", undefined, 1 * H), db("admin", "ghost"), NOW); return r.ok && r.session.role === "admin" && r.session.adminRole === undefined; })());
check("role lạ trong DB → student", (() => { const r = reconcileSession(tok("admin", "teacher"), db("whatever", null), NOW); return r.ok && r.session.role === "student"; })());

section("Nâng lên quản trị không được lách mốc 12 giờ");
check("token student 3 giờ, DB admin_content → được (còn trong 12 giờ)", reconcileSession(tok("student", undefined, 3 * H), db("admin", "admin_content"), NOW).ok);
const ex = reconcileSession(tok("student", undefined, 13 * H), db("admin", "admin_content"), NOW);
check("token student 13 giờ, DB admin_content → expired", !ex.ok && ex.reason === "expired", ex);
check("token student 20 ngày, DB teacher → được (gia sư 30 ngày)", reconcileSession(tok("student", undefined, 20 * D), db("admin", "teacher"), NOW).ok);
check("token không có iat + lên quản trị → expired", (() => { const r = reconcileSession({ userId: "u1", role: "student" }, db("admin", "admin_super"), NOW); return !r.ok && r.reason === "expired"; })());

section("Bị khoá / bị xoá");
const bn = reconcileSession(tok("student", undefined), db("student", null, true), NOW);
check("bị khoá → banned", !bn.ok && bn.reason === "banned");
const bn2 = reconcileSession(tok("admin", "admin_super"), db("admin", "admin_super", true), NOW);
check("quản trị bị khoá, vai vẫn khớp → vẫn banned", !bn2.ok && bn2.reason === "banned");
const bn3 = reconcileSession(tok("student", undefined), db("admin", "admin_super", true), NOW);
check("bị khoá + vai lệch → banned (không cấp quyền mới)", !bn3.ok && bn3.reason === "banned");
const gone = reconcileSession(tok("admin", "admin_super"), null, NOW);
check("không còn trong DB → gone", !gone.ok && gone.reason === "gone");

done();
