// STU-001 — phần THUẦN (src/lib/examPolicy.ts): chính sách hiệu lực của đề thi thử công khai. Không cần DB/máy chủ.
// Chạy CẢ HAI: `TZ=UTC npx tsx tools/local-e2e/t-exam-policy-lib.ts` và `TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/t-exam-policy-lib.ts` — kết quả phải giống nhau.
// CA PHÁ CỐ Ý: (4) date rỗng mà hàm cũ hasExamWindowEnded coi là "đã hết hạn" → hàm mới không được mở đáp án; (14) dòng limit = 0 không được mở vô hạn lượt;
// (9)(10) attemptsExhausted KHÔNG mở khoá khi gia sư đã tự đặt.
import { effectiveExamPolicy, normalizeMaxAttempts, parseExamWindow, tutorConfigured, isPublicExam, PUBLIC_DEFAULT_MAX_ATTEMPTS, type ExamPolicyInput } from "@/lib/examPolicy";
import { hasExamWindowEnded } from "@/lib/examGrading";
import { check, section, done } from "./h";

const NOW = new Date("2026-11-01T05:00:00.000Z"); // 12:00 giờ VN, 01/11/2026
const base = (o: Partial<ExamPolicyInput> = {}): ExamPolicyInput => ({
  courseId: null, answerVisibility: "after_submit", hideAnswerForWrong: false, date: "01/01/2030", time: "08:00", duration: "90 phút", ...o,
});
const pol = (exam: ExamPolicyInput, limit?: { maxAttempts: number | null | undefined } | null, attemptsExhausted?: boolean) =>
  effectiveExamPolicy(exam, limit, { now: NOW, attemptsExhausted });

section(`Đề công khai chưa cài → KiN áp mặc định an toàn (TZ tiến trình: ${process.env.TZ ?? "(mặc định)"})`);
{
  const p = pol(base());
  check("1. hạn 2030 → guarded, after_exam_ends, hide=false, max=2, canSee=false, until_exam_ends",
    p.guarded && p.isPublic && p.answerVisibility === "after_exam_ends" && p.hideAnswerForWrong === false && p.maxAttempts === 2
    && p.hasValidWindow && !p.windowEnded && p.canSeeAnswers === false && p.answersLockedReason === "until_exam_ends", p);
  check("   PUBLIC_DEFAULT_MAX_ATTEMPTS = 2", PUBLIC_DEFAULT_MAX_ATTEMPTS === 2);
}
{
  const p = pol(base({ date: "01/01/2020" }));
  check("2. hạn 2020 đã qua → windowEnded, canSee=true, reason null, vẫn guarded max=2", p.guarded && p.windowEnded && p.canSeeAnswers && p.answersLockedReason === null && p.maxAttempts === 2, p);
}
{
  const p = pol(base(), null, true);
  check("3. hạn 2030 + attemptsExhausted → canSee=true (hết lượt mở khoá), reason null", p.guarded && !p.windowEnded && p.canSeeAnswers && p.answersLockedReason === null, p);
}
{
  const ex = base({ date: "" });
  const p = pol(ex);
  check("4. date \"\" → hasValidWindow=false, after_submit, hide=true, max=2, canSee=true, until_attempts_exhausted",
    p.guarded && !p.hasValidWindow && !p.windowEnded && p.answerVisibility === "after_submit" && p.hideAnswerForWrong === true && p.maxAttempts === 2
    && p.canSeeAnswers && p.answersLockedReason === "until_attempts_exhausted", p);
  check("   PHÁ: hàm cũ hasExamWindowEnded coi date rỗng là ĐÃ HẾT HẠN (lỗi gốc) — hàm mới không theo", hasExamWindowEnded(ex) === true && p.windowEnded === false);
}
{
  const all = ["abc", "2026-10-24", "31/02/2026", "1/1/2030", "00/01/2030", "01/13/2030"].map(date => pol(base({ date })));
  check("5. date rác/sai định dạng/31-02 → như ca 4 (không hợp lệ, hide=true, until_attempts_exhausted)",
    all.every(p => p.guarded && !p.hasValidWindow && p.answerVisibility === "after_submit" && p.hideAnswerForWrong && p.maxAttempts === 2 && p.canSeeAnswers && p.answersLockedReason === "until_attempts_exhausted"), all);
  check("   PHÁ: date rác với hàm cũ = KHÔNG BAO GIỜ hết hạn (NaN) — hàm mới không dựa vào đó", hasExamWindowEnded(base({ date: "abc" })) === false);
  const badTime = pol(base({ time: "25:00" }));
  check("   time rác (25:00) → hạn không hợp lệ", !badTime.hasValidWindow);
}
{
  const p = pol(base({ date: "" }), null, true);
  check("6. date \"\" + attemptsExhausted → hide=false (hiện hết), reason null, canSee=true", p.guarded && p.hideAnswerForWrong === false && p.answersLockedReason === null && p.canSeeAnswers, p);
}

section("Gia sư đã đặt một trong ba → tôn trọng trọn bộ (phương án b)");
{
  const p = pol(base(), { maxAttempts: 5 });
  check("7. limit 5 → không guarded, after_submit, hide=false, max=5, canSee=true, reason null", !p.guarded && p.isPublic && p.answerVisibility === "after_submit" && !p.hideAnswerForWrong && p.maxAttempts === 5 && p.canSeeAnswers && p.answersLockedReason === null, p);
}
{
  const p = pol(base({ hideAnswerForWrong: true }));
  check("8. chỉ tích hide=true → không guarded, max=null (hệ quả có ý thức), hide=true, canSee=true", !p.guarded && p.maxAttempts === null && p.hideAnswerForWrong && p.canSeeAnswers, p);
}
{
  const p = pol(base({ answerVisibility: "never" }), null, true);
  check("9. PHÁ: never → canSee=false, reason never; attemptsExhausted KHÔNG mở khoá", !p.guarded && p.answerVisibility === "never" && !p.canSeeAnswers && p.answersLockedReason === "never", p);
}
{
  const p = pol(base({ answerVisibility: "after_exam_ends" }), { maxAttempts: 3 }, true);
  check("10. PHÁ: after_exam_ends + limit 3, hết lượt, chưa hết hạn → vẫn canSee=false, until_exam_ends, max=3", !p.guarded && !p.canSeeAnswers && p.answersLockedReason === "until_exam_ends" && p.maxAttempts === 3, p);
  const ended = pol(base({ answerVisibility: "after_exam_ends", date: "01/01/2020" }), { maxAttempts: 3 });
  check("    …hết hạn thật → canSee=true, reason null", ended.canSeeAnswers && ended.answersLockedReason === null);
}

section("Đề gắn lớp → không đổi hành vi");
{
  const p = pol(base({ courseId: "lop-1" }));
  check("11. đề lớp mặc định → không guarded, not public, after_submit, max=null, canSee=true", !p.guarded && !p.isPublic && p.answerVisibility === "after_submit" && p.maxAttempts === null && p.canSeeAnswers && p.answersLockedReason === null, p);
  check("    isPublicExam", isPublicExam({ courseId: null }) && !isPublicExam({ courseId: "x" }));
}
{
  const p = pol(base({ courseId: "lop-1", answerVisibility: "after_exam_ends", date: "" }));
  check("12. đề lớp date \"\" after_exam_ends → dùng hasExamWindowEnded cũ (true) → canSee=true — không hồi quy", !p.guarded && !p.hasValidWindow && p.canSeeAnswers === true && p.answersLockedReason === null, p);
  const future = pol(base({ courseId: "lop-1", answerVisibility: "after_exam_ends" }));
  check("    đề lớp after_exam_ends hạn 2030 hợp lệ → canSee=false, until_exam_ends; hết lượt cũng không mở", !future.canSeeAnswers && future.answersLockedReason === "until_exam_ends" && !pol(base({ courseId: "lop-1", answerVisibility: "after_exam_ends" }), null, true).canSeeAnswers);
}

section("Chuẩn hoá limit và chuỗi rác");
check("13. normalizeMaxAttempts: 0, -1, NaN, 2.5, null, undefined, {maxAttempts:null} → null; 1 → 1; 2 → 2",
  [0, -1, NaN, 2.5].every(m => normalizeMaxAttempts({ maxAttempts: m }) === null)
  && normalizeMaxAttempts(null) === null && normalizeMaxAttempts(undefined) === null && normalizeMaxAttempts({ maxAttempts: null }) === null
  && normalizeMaxAttempts({ maxAttempts: 1 }) === 1 && normalizeMaxAttempts({ maxAttempts: 2 }) === 2);
{
  const p = pol(base(), { maxAttempts: 0 });
  check("14. PHÁ: limit 0 trên đề công khai → coi là chưa cài → guarded, max=2 (dòng limit rỗng không mở vô hạn)", p.guarded && p.maxAttempts === 2 && !tutorConfigured(base(), { maxAttempts: 0 }), p);
  check("    tutorConfigured: after_submit+false+null → false; từng cái một → true",
    !tutorConfigured(base()) && tutorConfigured(base({ answerVisibility: "never" })) && tutorConfigured(base({ hideAnswerForWrong: true })) && tutorConfigured(base(), { maxAttempts: 1 }));
}
{
  const p = pol(base({ answerVisibility: "ALL" }), null, true);
  check("15. answerVisibility rác \"ALL\" → never (an toàn hơn mở), không guarded, canSee=false kể cả hết lượt", !p.guarded && p.answerVisibility === "never" && !p.canSeeAnswers && p.answersLockedReason === "never", p);
}

section("parseExamWindow theo +07:00 cố định");
{
  const w = parseExamWindow({ date: "01/01/2030", time: "08:00", duration: "90 phút" });
  check("16. 01/01/2030 08:00 90 phút → startsAt 01:00Z, endsAt 02:30Z — không lệch theo TZ tiến trình",
    !!w && w.startsAt.toISOString() === "2030-01-01T01:00:00.000Z" && w.endsAt.toISOString() === "2030-01-01T02:30:00.000Z", w);
  const noTime = parseExamWindow({ date: "01/01/2030", time: "", duration: "x" });
  check("    time rỗng → 00:00 VN = 17:00Z hôm trước; duration không số → 60 phút", !!noTime && noTime.startsAt.toISOString() === "2029-12-31T17:00:00.000Z" && noTime.endsAt.getTime() - noTime.startsAt.getTime() === 60 * 60_000, noTime);
  check("    31/02 / năm 3 chữ số / rỗng → null", parseExamWindow({ date: "31/02/2026", time: "", duration: "1" }) === null && parseExamWindow({ date: "01/01/999", time: "", duration: "1" }) === null && parseExamWindow({ date: "", time: "", duration: "1" }) === null);
  // Mốc đúng tại biên: now = endsAt → đã hết hạn (<=), now = endsAt − 1ms → chưa.
  const atEnd = effectiveExamPolicy(base(), null, { now: new Date("2030-01-01T02:30:00.000Z") });
  const before = effectiveExamPolicy(base(), null, { now: new Date("2030-01-01T02:29:59.999Z") });
  check("    biên: đúng lúc endsAt → hết hạn; 1ms trước → chưa", atEnd.windowEnded && atEnd.canSeeAnswers && !before.windowEnded && !before.canSeeAnswers);
}

void done();
