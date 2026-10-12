// Quy tắc thuần của đăng nhập bằng mã 6 số (src/lib/loginCode.ts): chuẩn hoá, băm, so sánh, gửi lại, khoá.
import { check, section, done } from "./h";
import { safeRedirect } from "@/lib/safeRedirect";
import {
  CODE_TTL_MS, LOCK_MS, MAX_ATTEMPTS, RESEND_MS,
  attemptsLeft, classifyBlocked, expiryFor, generateCode, hashCode, hashesEqual, lockUntilFor, normalizeCodeInput, normalizeEmail, planRequest,
  type CodeState,
} from "@/lib/loginCode";

const T0 = new Date("2026-10-12T10:00:00Z");
const at = (ms: number) => new Date(T0.getTime() + ms);
const st = (o: Partial<CodeState> = {}): CodeState => ({ codeHash: "ab".repeat(32), attempts: 0, sentAt: T0, expiresAt: at(CODE_TTL_MS), lockedUntil: null, ...o });

section("Hằng số theo Figma 33:2");
check("mã sống 10 phút, khoá 15 phút, gửi lại sau 60 giây, tối đa 5 lần sai", CODE_TTL_MS === 600_000 && LOCK_MS === 900_000 && RESEND_MS === 60_000 && MAX_ATTEMPTS === 5);

section("Chuẩn hoá email");
check("cắt khoảng trắng + chữ thường", normalizeEmail("  Minh.Anh@Gmail.COM ") === "minh.anh@gmail.com");
check("không phải email → null", normalizeEmail("abc") === null && normalizeEmail("a@b") === null && normalizeEmail("") === null && normalizeEmail("a b@c.d") === null);
check("không phải chuỗi → null", normalizeEmail(undefined) === null && normalizeEmail(123) === null && normalizeEmail(null) === null);
check("quá 254 ký tự → null", normalizeEmail("a".repeat(250) + "@b.vn") === null);

section("Chuẩn hoá mã nhập");
check("đúng 6 số", normalizeCodeInput("418293") === "418293");
check("bỏ khoảng trắng và gạch nối khi dán", normalizeCodeInput(" 418 293 ") === "418293" && normalizeCodeInput("418-293") === "418293");
check("giữ số 0 đầu", normalizeCodeInput("000123") === "000123");
check("thiếu / thừa / có chữ → null", normalizeCodeInput("41829") === null && normalizeCodeInput("4182930") === null && normalizeCodeInput("41829a") === null && normalizeCodeInput("") === null && normalizeCodeInput(418293) === null);

section("Sinh mã");
const codes = Array.from({ length: 3000 }, () => generateCode());
check("luôn đúng 6 chữ số", codes.every(c => /^\d{6}$/.test(c)));
check("có mã bắt đầu bằng 0 (không cắt số 0 đầu)", codes.some(c => c.startsWith("0")));
check("phân bố rộng (≥ 2900 mã khác nhau trong 3000)", new Set(codes).size >= 2900, new Set(codes).size);
const firstDigits = new Set(codes.map(c => c[0]));
check("chữ số đầu đủ 0–9 (không lệch)", firstDigits.size === 10, [...firstDigits]);

section("Băm + so sánh");
const h = hashCode("a@b.vn", "123456", "bi-mat");
check("băm HMAC-SHA256 dạng hex 64 ký tự", /^[0-9a-f]{64}$/.test(h));
check("cùng đầu vào → cùng băm", h === hashCode("a@b.vn", "123456", "bi-mat"));
check("khác email → khác băm (cùng mã của hai người không trùng)", h !== hashCode("c@d.vn", "123456", "bi-mat"));
check("khác mã → khác băm", h !== hashCode("a@b.vn", "123457", "bi-mat"));
check("khác khoá bí mật → khác băm", h !== hashCode("a@b.vn", "123456", "bi-mat-khac"));
check("không lưu lộ mã gốc trong chuỗi băm", !h.includes("123456"));
check("hashesEqual đúng / sai", hashesEqual(h, h) && !hashesEqual(h, hashCode("a@b.vn", "000000", "bi-mat")));
check("hashesEqual an toàn với độ dài lệch, rỗng, không phải hex", !hashesEqual(h, h.slice(0, 10)) && !hashesEqual("", "") && !hashesEqual("zz", "zz"));

section("Xin mã: chưa có mã / chờ 60 giây / gửi lại");
check("chưa có mã → gửi, lần sai 0", JSON.stringify(planRequest(null, T0)) === JSON.stringify({ action: "send", attempts: 0 }));
const w = planRequest(st(), at(20_000));
check("mới gửi 20 giây trước → chờ 40 giây", w.action === "wait" && w.retryAfterSec === 40, w);
check("còn 0,4 giây thì báo tối thiểu 1 giây", (() => { const p = planRequest(st(), at(59_600)); return p.action === "wait" && p.retryAfterSec === 1; })());
check("đúng 60 giây → gửi được", planRequest(st(), at(60_000)).action === "send");

section("Số lần sai được giữ khi xin mã mới (không lách giới hạn)");
check("sai 3 lần, 2 phút sau xin mã mới → vẫn nhớ 3 lần", (() => { const p = planRequest(st({ attempts: 3 }), at(120_000)); return p.action === "send" && p.attempts === 3; })());
check("sai 3 lần, 16 phút sau → tính lại từ 0", (() => { const p = planRequest(st({ attempts: 3 }), at(16 * 60_000)); return p.action === "send" && p.attempts === 0; })());

section("Khoá 15 phút");
const lockedAt = at(30_000);
const lk = st({ attempts: 5, lockedUntil: new Date(lockedAt.getTime() + LOCK_MS) });
check("đang khoá → không cho xin mã, báo còn 14 phút", (() => { const p = planRequest(lk, at(90_000)); return p.action === "locked" && p.retryAfterSec === 14 * 60; })());
check("khoá còn đúng số giây", (() => { const p = planRequest(lk, at(30_000 + 14 * 60_000)); return p.action === "locked" && p.retryAfterSec === 60; })());
check("hết khoá → xin mã mới được, lần sai về 0", (() => { const p = planRequest(lk, at(30_000 + LOCK_MS + 1)); return p.action === "send" && p.attempts === 0; })());
check("đủ 5 lần sai nhưng chưa kịp ghi mốc khoá vẫn coi là đang khoá", planRequest(st({ attempts: 5, lockedUntil: null }), at(5 * 60_000)).action === "locked");
check("khoá có ưu tiên cao hơn thời gian chờ 60 giây", planRequest(st({ attempts: 5, lockedUntil: at(LOCK_MS) }), at(1_000)).action === "locked");

section("classifyBlocked");
check("không có dòng → none", classifyBlocked(null, T0).reason === "none");
check("đang khoá → locked kèm số giây", (() => { const b = classifyBlocked(lk, at(60_000)); return b.reason === "locked" && b.retryAfterSec > 0; })());
check("mã quá hạn (không khoá) → expired", classifyBlocked(st({ expiresAt: at(-1) }), at(CODE_TTL_MS + 1)).reason === "expired");
check("khoá đã hết hạn → mã cũ coi như hết hạn, phải xin mã mới", classifyBlocked(st({ attempts: 5, lockedUntil: at(1000) }), at(LOCK_MS + 10_000)).reason === "expired");

section("Địa chỉ quay lại sau đăng nhập (chặn chuyển hướng ra ngoài)");
check("đường dẫn nội bộ được giữ nguyên (kể cả có query)", safeRedirect("/student/lich-hoc") === "/student/lich-hoc" && safeRedirect("/khoa-hoc?x=1#a") === "/khoa-hoc?x=1#a");
check("địa chỉ tuyệt đối bị bỏ", safeRedirect("https://evil.example/x") === null && safeRedirect("http://evil.example") === null && safeRedirect("javascript:alert(1)") === null);
check("//host và /\\host (trình duyệt hiểu là địa chỉ ngoài) bị bỏ", safeRedirect("//evil.example") === null && safeRedirect("/\\evil.example") === null);
check("không bắt đầu bằng '/' bị bỏ", safeRedirect("student/hoc-tap") === null && safeRedirect("evil.example") === null);
check("rỗng / null / quá dài / có ký tự điều khiển bị bỏ", safeRedirect("") === null && safeRedirect(null) === null && safeRedirect(undefined) === null && safeRedirect("/" + "a".repeat(2001)) === null && safeRedirect("/a\nb") === null);

section("Tiện ích");
check("attemptsLeft: 0→5, 2→3, 5→0, 9→0", attemptsLeft(0) === 5 && attemptsLeft(2) === 3 && attemptsLeft(5) === 0 && attemptsLeft(9) === 0);
check("expiryFor +10 phút, lockUntilFor +15 phút", expiryFor(T0).getTime() - T0.getTime() === 600_000 && lockUntilFor(T0).getTime() - T0.getTime() === 900_000);

done();
