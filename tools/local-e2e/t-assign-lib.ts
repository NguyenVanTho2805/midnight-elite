// BU-03 P3 — luật giao đề (src/lib/deThiAssign.ts) + hai chỗ vá mã đề con ở api/tutor/quiz (pickerWhere, variantLockedBlock). THUẦN, không DB.
// Chạy: DATABASE_URL=postgresql://x:y@localhost:5432/z npx tsx tools/local-e2e/t-assign-lib.ts
// Ca phá cố ý (sửa mã → ca tương ứng đỏ):
//   - bỏ "price" khỏi FORBIDDEN_FIELDS → ca "price/activeGuest/guestCanTake bị từ chối" đỏ;
//   - bỏ điều kiện `patch.mode !== ctx.current.mode` quanh mặc định → ca "cùng chế độ không đè lại mặc định" đỏ;
//   - bỏ khối HAS_ATTEMPTS → ca khoá mode/courseId/durationMin đỏ; đổi `changed` thành "có trong patch" → ca "gửi lại đúng giá trị cũ" đỏ;
//   - bỏ kiểm NEED_SCHEDULE → ca bài kiểm tra thiếu giờ đỏ;
//   - bỏ `variantOfId: null` trong pickerWhere → ca "không liệt kê mã đề con" đỏ.
import { check, section, done } from "./h";
import { AUDIENCE_LINK_READY, VARIANT_STUDENT_SUPPORT, defaultsForMode, validateAssignPatch, type AssignCtx } from "@/lib/deThiAssign";
import { pickerWhere } from "@/lib/deThiVariants";
import { variantLockedBlock } from "@/lib/deThiServer";

const ctx = (o: Omit<Partial<AssignCtx>, "current"> & { current?: Partial<AssignCtx["current"]> } = {}): AssignCtx => ({
  attemptCount: 0, isDraft: true, todayKey: "2026-11-02", audienceLinkReady: false,
  ...o,
  current: { mode: null, courseId: "c1", dateKey: "2026-11-10", time: "19:00", durationMin: 45, ...(o.current ?? {}) },
});
const err = (b: unknown, c = ctx()) => { const r = validateAssignPatch(b, c); return r.ok ? null : r; };
const ok = (b: unknown, c = ctx()) => { const r = validateAssignPatch(b, c); return r.ok ? r : null; };

(async () => {
section("Mặc định theo chế độ (bảng P3.2)");
const pr = defaultsForMode("practice"), te = defaultsForMode("test");
check("luyện tập: không giới hạn lần, xem sau khi nộp, không ẩn đáp án sai, không xếp hạng, không bắt buộc khung giờ", pr.maxAttempts === null && pr.answerVisibility === "after_submit" && !pr.hideAnswerForWrong && !pr.showLeaderboard && !pr.scheduleRequired);
check("kiểm tra: 1 lần, xem khi hết giờ, ẩn đáp án câu sai, không xếp hạng, bắt buộc khung giờ", te.maxAttempts === 1 && te.answerVisibility === "after_exam_ends" && te.hideAnswerForWrong && !te.showLeaderboard && te.scheduleRequired);
check("hai chế độ KHÁC nhau ở đúng các khoá cần khác (chống dò đáp án)", pr.answerVisibility !== te.answerVisibility && pr.hideAnswerForWrong !== te.hideAnswerForWrong);

section("Điền mặc định khi ĐỔI chế độ");
const t1 = ok({ mode: "test" });
check("đề cũ (mode null) → test: điền 1 lần / after_exam_ends / hide=true / không xếp hạng, và báo đã áp", !!t1 && t1.patch.maxAttempts === 1 && t1.patch.answerVisibility === "after_exam_ends" && t1.patch.hideAnswerForWrong === true && t1.patch.showLeaderboard === false && t1.modeDefaultsApplied, t1);
const t2 = ok({ mode: "practice", maxAttempts: 3 });
check("khoá gia sư gửi rõ ràng THẮNG mặc định (practice + maxAttempts 3)", !!t2 && t2.patch.maxAttempts === 3 && t2.patch.answerVisibility === "after_submit");
const t3 = ok({ mode: "practice", maxAttempts: null });
check("maxAttempts: null gửi rõ = không giới hạn (có mặt trong patch để máy chủ xoá dòng giới hạn)", !!t3 && "maxAttempts" in t3.patch && t3.patch.maxAttempts === null);
const t4 = ok({ mode: "test", dateKey: "2026-11-20" }, ctx({ current: { mode: "test" } }));
check("PHÁ: gửi lại CÙNG chế độ không đè lại mặc định (giữ cài đặt gia sư đã chỉnh)", !!t4 && !t4.modeDefaultsApplied && !("maxAttempts" in t4.patch) && !("answerVisibility" in t4.patch), t4);
check("không gửi mode → không điền mặc định nào", (() => { const r = ok({ time: "20:00" }); return !!r && !r.modeDefaultsApplied && Object.keys(r.patch).join() === "time"; })());

section("Từ chối price / khách / khoá lạ");
for (const k of ["price", "activeGuest", "guestCanTake"]) {
  const r = err({ [k]: k === "price" ? 50000 : true });
  check(`${k} → 400 FORBIDDEN_FIELD`, !!r && r.status === 400 && r.code === "FORBIDDEN_FIELD", r);
}
check("PHÁ: price đi kèm khoá hợp lệ vẫn bị từ chối cả yêu cầu (không lưu nửa vời)", err({ mode: "practice", price: 0 })?.code === "FORBIDDEN_FIELD");
check("price: null cũng bị từ chối (không mở đường để 'xoá giá')", err({ price: null })?.code === "FORBIDDEN_FIELD");
check("khoá lạ (ownerId, isDraft, active, passwordHash) → 400 UNKNOWN_FIELD, không nhận âm thầm", ["ownerId", "isDraft", "active", "passwordHash", "variantOfId"].every(k => err({ [k]: "x" })?.code === "UNKNOWN_FIELD"));
check("khoá chỉ đọc của GET (hasPassword, status, variants, attemptCount) bị bỏ qua, không lỗi, không ghi", (() => { const r = ok({ hasPassword: true, status: "x", variants: [], attemptCount: 9, time: "20:15" }); return !!r && Object.keys(r.patch).join() === "time"; })());
check("chỉ có khoá chỉ đọc → EMPTY (không có gì để lưu)", err({ hasPassword: false })?.code === "EMPTY" && err({})?.code === "EMPTY");
check("thân không phải đối tượng → BAD_BODY", [null, "x", 5, [], undefined].every(b => err(b)?.code === "BAD_BODY"));

section("Mật khẩu (băm ở máy chủ; ở đây chỉ chuẩn hoá)");
check("cắt khoảng trắng; rỗng hoặc null = bỏ mật khẩu", ok({ password: "  abc  " })?.patch.password === "abc" && ok({ password: "   " })?.patch.password === null && ok({ password: null })?.patch.password === null);
check("không phải chuỗi / quá 200 ký tự → BAD_PASSWORD", [123, true, {}, "x".repeat(201)].every(p => err({ password: p })?.code === "BAD_PASSWORD") && ok({ password: "x".repeat(200) }) !== null);
check("không gửi password → patch không có khoá password (không vô tình xoá mật khẩu)", !("password" in (ok({ time: "20:00" })?.patch ?? {})));

section("Số lần làm, đáp án, cờ");
check("maxAttempts 1..20 hoặc null hợp lệ", [1, 5, 20, null].every(n => ok({ maxAttempts: n }) !== null));
check("PHÁ: 0, 21, 1.5, '3', NaN, -1 → BAD_ATTEMPTS", [0, 21, 1.5, "3", NaN, -1].every(n => err({ maxAttempts: n })?.code === "BAD_ATTEMPTS"));
check("answerVisibility ngoài ba giá trị → BAD_VISIBILITY", err({ answerVisibility: "always" })?.code === "BAD_VISIBILITY" && ok({ answerVisibility: "never" }) !== null);
check("cờ phải là boolean thật ('true', 1 bị từ chối)", ["true", 1, null].every(v => err({ hideAnswerForWrong: v })?.code === "BAD_FLAG") && ok({ holdUntilPublish: true, showLeaderboard: false }) !== null);

section("Ngày / giờ / thời lượng");
check("giờ '7:05' được chuẩn hoá '07:05'; '25:00' sai", ok({ time: "7:05" })?.patch.time === "07:05" && err({ time: "25:00" })?.code === "BAD_TIME");
check("ngày không có thật (2026-02-30), sai dạng, không phải chuỗi → BAD_DATE", ["2026-02-30", "26-1-1", "2026/11/05", 20261105].every(d => err({ dateKey: d })?.code === "BAD_DATE"));
check("thời lượng 1..300 nguyên", ok({ durationMin: 1 }) !== null && ok({ durationMin: 300 }) !== null && [0, 301, 1.5, "45"].every(n => err({ durationMin: n })?.code === "BAD_DURATION"));
check("ngày quá khứ khi chưa có lượt → CẢNH BÁO, không chặn", (() => { const r = ok({ dateKey: "2026-10-01" }); return !!r && r.warnings.length === 1 && r.warnings[0].code === "PAST_DATE" && r.patch.dateKey === "2026-10-01"; })());
check("hôm nay và tương lai: không cảnh báo", ok({ dateKey: "2026-11-02" })!.warnings.length === 0 && ok({ dateKey: "2026-12-01" })!.warnings.length === 0);
check("đã có lượt: đổi ngày quá khứ không cảnh báo (ngày không bị khoá)", (() => { const r = ok({ dateKey: "2026-10-01" }, ctx({ attemptCount: 2 })); return !!r && r.warnings.length === 0; })());

section("Bài kiểm tra bắt buộc khung giờ (NEED_SCHEDULE)");
check("test + dateKey rỗng → 400 NEED_SCHEDULE", err({ mode: "test", dateKey: null })?.code === "NEED_SCHEDULE" && err({ mode: "test", dateKey: "" })?.code === "NEED_SCHEDULE");
check("test + giờ / thời lượng rỗng → NEED_SCHEDULE", err({ mode: "test", time: null })?.code === "NEED_SCHEDULE" && err({ mode: "test", durationMin: null })?.code === "NEED_SCHEDULE");
check("PHÁ: đề đã là test, xoá giờ → vẫn NEED_SCHEDULE (không chỉ khi đổi chế độ)", err({ time: "" }, ctx({ current: { mode: "test" } }))?.code === "NEED_SCHEDULE");
check("test mà đề hiện CHƯA có giờ hợp lệ (null) và không gửi bù → NEED_SCHEDULE", err({ mode: "test" }, ctx({ current: { time: null } }))?.code === "NEED_SCHEDULE" && err({ mode: "test" }, ctx({ current: { dateKey: null } }))?.code === "NEED_SCHEDULE");
check("test có giờ hiện hợp lệ → chỉ đổi chế độ là được", ok({ mode: "test" }) !== null);
check("luyện tập: gửi ngày / giờ rỗng bị BỎ QUA (cột không nhận rỗng), không lỗi", (() => { const r = ok({ mode: "practice", dateKey: null, time: "", answerVisibility: "never" }); return !!r && !("dateKey" in r.patch) && !("time" in r.patch); })());

section("Khoá khi đã có lượt làm (HAS_ATTEMPTS)");
const hasAtt = ctx({ attemptCount: 3, current: { mode: "test", courseId: "c1", durationMin: 45 } });
check("đổi mode / courseId / durationMin → 409 HAS_ATTEMPTS", err({ mode: "practice" }, hasAtt)?.code === "HAS_ATTEMPTS" && err({ courseId: "c2" }, hasAtt)?.code === "HAS_ATTEMPTS" && err({ durationMin: 60 }, hasAtt)?.status === 409);
check("PHÁ: gửi lại ĐÚNG giá trị cũ (client gửi nguyên đối tượng GET) không bị chặn", ok({ mode: "test", courseId: "c1", durationMin: 45, maxAttempts: 2 }, hasAtt) !== null);
check("xoá lớp (courseId null) khi có lượt = đổi → 409", err({ courseId: null }, hasAtt)?.code === "HAS_ATTEMPTS");
check("xoá thời lượng khi có lượt → 409 (chặn trước NEED_SCHEDULE)", err({ durationMin: null }, hasAtt)?.code === "HAS_ATTEMPTS");
check("phần còn lại vẫn đổi được: mật khẩu, số lần, hiện đáp án, giờ, cờ", ok({ password: "mk", maxAttempts: 2, answerVisibility: "never", time: "21:00", hideAnswerForWrong: false, showLeaderboard: true, holdUntilPublish: true }, hasAtt) !== null);
check("chưa có lượt thì đổi thoải mái", ok({ mode: "practice", courseId: "c2", durationMin: 60 }, ctx({ attemptCount: 0, current: { mode: "test" } })) !== null);

section("Giao theo link (AUDIENCE_LINK_READY)");
const pub = ctx({ isDraft: false });
const pubOff = { ...pub, audienceLinkReady: false }; // cờ truyền tường minh: ca này kiểm NHÁNH tắt, không phụ thuộc hằng
check("đề ĐÃ phát hành bỏ lớp (courseId null) khi cờ tắt → 422 AUDIENCE_LINK_NOT_READY", err({ courseId: null }, pubOff)?.status === 422 && err({ courseId: "" }, pubOff)?.code === "AUDIENCE_LINK_NOT_READY");
check("bản nháp bỏ lớp được (phát hành mới chặn)", ok({ courseId: null }, ctx({ isDraft: true })) !== null);
check("cờ bật → đề đã phát hành bỏ lớp được", ok({ courseId: null }, { ...pub, audienceLinkReady: true }) !== null);
check("đề vốn không có lớp, gửi null lại → không đổi gì nên không chặn", ok({ courseId: null }, ctx({ isDraft: false, current: { courseId: null } })) !== null);
check("đổi sang lớp khác khi cờ tắt: không dính chặn link", ok({ courseId: "c9" }, pubOff) !== null);
check("cờ mặc định BẬT (BU-04 xong, D2): đề đã phát hành bỏ lớp được khi không truyền cờ", ok({ courseId: null }, { ...pub, audienceLinkReady: undefined }) !== null);
check("hai cờ cổng đã BẬT (BU-04 xong)", VARIANT_STUDENT_SUPPORT === true && AUDIENCE_LINK_READY === true);

section("Vá mã đề con (api/tutor/quiz)");
check("pickerWhere luôn loại mã đề con và bản đã bị thay, và khoá theo chủ", (() => { const w = pickerWhere("t1", false); return w.ownerId === "t1" && w.variantOfId === null && w.supersededById === null && !("attempts" in w); })());
check("editable=1 thêm 'chưa ai làm'", JSON.stringify(pickerWhere("t1", true)) === JSON.stringify({ ownerId: "t1", supersededById: null, variantOfId: null, attempts: { none: {} } }));
check("variantLockedBlock: mã đề con → 409 VARIANT_LOCKED kèm variantOfId; đề thường → null", await (async () => {
  const b = variantLockedBlock({ variantOfId: "root1" }); const n = variantLockedBlock({ variantOfId: null });
  if (!b || n !== null) return false;
  const j = await b.json();
  return b.status === 409 && j.code === "VARIANT_LOCKED" && j.variantOfId === "root1";
})());

await done();
})();
