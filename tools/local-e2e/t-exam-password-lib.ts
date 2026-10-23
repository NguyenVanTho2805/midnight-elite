// QZ-14 — mật khẩu vào thi băm (src/lib/examPassword.ts). Thuần (bcrypt chạy cục bộ), không DB. Ca phá cố ý ở cuối mỗi mục.
import { check, section, done } from "./h";
import { examPasswordPatch, hasExamPassword, MAX_EXAM_PASSWORD_LEN, verifyExamPassword, withoutExamSecrets } from "@/lib/examPassword";

(async () => {
  section("Đặt mật khẩu → chỉ ghi băm");
  const p = await examPasswordPatch("Mat-khau-1");
  check("password thô = null; passwordHash là chuỗi bcrypt", p.password === null && typeof p.passwordHash === "string" && /^\$2[aby]\$\d\d\$/.test(p.passwordHash!));
  check("băm KHÔNG chứa mật khẩu gốc", !p.passwordHash!.includes("Mat-khau-1"));
  const p2 = await examPasswordPatch("Mat-khau-1");
  check("băm hai lần khác nhau (có muối)", p.passwordHash !== p2.passwordHash);
  check("cắt khoảng trắng đầu/cuối khi đặt", (await verifyExamPassword(await examPasswordPatch("  abc  ").then(x => ({ password: null, passwordHash: x.passwordHash })), "abc")).ok);
  check("chuỗi rỗng / khoảng trắng / null / không phải chuỗi = BỎ mật khẩu (cả hai cột null)", (await Promise.all(["", "   ", null, undefined, 123, {}].map(v => examPasswordPatch(v)))).every(x => x.password === null && x.passwordHash === null));

  section("Kiểm tra với băm");
  const withHash = { password: null, passwordHash: p.passwordHash };
  check("đúng → ok, không cần nâng cấp", JSON.stringify(await verifyExamPassword(withHash, "Mat-khau-1")) === JSON.stringify({ ok: true, needsUpgrade: false }));
  check("sai / sai hoa thường / thiếu ký tự → từ chối", (await Promise.all(["mat-khau-1", "Mat-khau-", "Mat-khau-12", "x"].map(v => verifyExamPassword(withHash, v)))).every(r => !r.ok));
  check("rỗng, null, số, đối tượng, mảng → từ chối, không ném lỗi", (await Promise.all(["", null, undefined, 5, {}, ["Mat-khau-1"]].map(v => verifyExamPassword(withHash, v)))).every(r => !r.ok));
  check("mật khẩu có dấu tiếng Việt và rất dài vẫn khớp đúng (không bị bcrypt cắt 72 byte ngầm)", await (async () => {
    const long = "Đề thi Toán ".repeat(8) + "A"; // > 72 byte, chỉ khác nhau ở cuối
    const h = { password: null, passwordHash: (await examPasswordPatch(long)).passwordHash };
    return (await verifyExamPassword(h, long)).ok && !(await verifyExamPassword(h, long.slice(0, -1) + "B")).ok;
  })());
  check("đầu vào dài vô lý (>4×giới hạn) bị từ chối ngay", !(await verifyExamPassword(withHash, "a".repeat(MAX_EXAM_PASSWORD_LEN * 4 + 1))).ok);
  check("đề đã có băm thì KHÔNG chấp nhận bản thô cũ còn sót (chỉ xét băm)", !(await verifyExamPassword({ password: "cu", passwordHash: p.passwordHash }, "cu")).ok);
  check("băm hỏng (không phải bcrypt) → từ chối, không ném lỗi", !(await verifyExamPassword({ password: null, passwordHash: "khong-phai-bcrypt" }, "abc")).ok);

  section("Tương thích ngược: đề cũ còn mật khẩu thô");
  const legacy = { password: "cu123", passwordHash: null };
  check("đúng → ok + needsUpgrade (để tự nâng lên băm)", JSON.stringify(await verifyExamPassword(legacy, "cu123")) === JSON.stringify({ ok: true, needsUpgrade: true }));
  check("sai → từ chối, KHÔNG nâng cấp", JSON.stringify(await verifyExamPassword(legacy, "cu124")) === JSON.stringify({ ok: false, needsUpgrade: false }));
  check("rỗng / không phải chuỗi → từ chối", (await Promise.all(["", null, 1].map(v => verifyExamPassword(legacy, v)))).every(r => !r.ok));
  check("sau khi nâng cấp bằng examPasswordPatch, mật khẩu cũ vẫn dùng được và cột thô bị xoá", await (async () => {
    const up = await examPasswordPatch("cu123");
    return up.password === null && (await verifyExamPassword({ password: up.password, passwordHash: up.passwordHash }, "cu123")).ok;
  })());

  section("Đề không có mật khẩu");
  check("hasExamPassword đúng với cả bốn tổ hợp", !hasExamPassword({ password: null, passwordHash: null }) && hasExamPassword({ password: "a", passwordHash: null }) && hasExamPassword({ password: null, passwordHash: "x" }) && !hasExamPassword({}));
  check("không có mật khẩu → ai vào cũng ok", (await verifyExamPassword({ password: null, passwordHash: null }, undefined)).ok);
  check("mật khẩu thô là chuỗi rỗng coi như không có", !hasExamPassword({ password: "", passwordHash: "" }));

  section("Không lộ bí mật qua API");
  const exam = { id: "e1", title: "Đề 1", password: "cu123", passwordHash: "$2b$10$abcdefghijklmnopqrstuv" };
  const pub = withoutExamSecrets(exam) as Record<string, unknown>;
  check("withoutExamSecrets bỏ CẢ password và passwordHash, thêm hasPassword", !("password" in pub) && !("passwordHash" in pub) && pub.hasPassword === true && pub.title === "Đề 1");
  check("JSON trả về không chứa chuỗi mật khẩu / băm", !/cu123|abcdefghijklmnopqrstuv|passwordHash/.test(JSON.stringify(pub)));
  check("đề không mật khẩu → hasPassword false", (withoutExamSecrets({ id: "e2", password: null, passwordHash: null }) as Record<string, unknown>).hasPassword === false);

  done();
})();
