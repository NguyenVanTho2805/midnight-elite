import { afterSubmit, afterReveal, correctionState, canReveal, isFinished, hintVisible, reflectionAllowed, shortAnswerCorrect, EMPTY_CORRECTION as E, isCorrectableType } from "@/lib/examCorrection";
import { check, section, done } from "./h";
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

section("Ba trạng thái theo đặc tả NV-188 (câu CÓ gợi ý)");
check("chưa nộp → new, chưa có gợi ý, chưa thể xem đáp án", correctionState(E) === "new" && !hintVisible(E, "gợi ý") && !canReveal(E) && !isFinished(E));
const w1 = afterSubmit(E, false, true);
check("nộp lần 1 sai → hint (tries 1, chưa lộ đáp án)", correctionState(w1) === "hint" && w1.tries === 1 && !w1.revealed && !w1.solved);
check("lúc đó hiện gợi ý và được bấm 'Xem đáp án'", hintVisible(w1, "gợi ý") && canReveal(w1));
const w2 = afterSubmit(w1, false, true);
check("nộp lần 2 vẫn sai → hiện đáp án (điểm dừng)", correctionState(w2) === "revealed" && w2.tries === 2 && isFinished(w2));
check("xong rồi thì không còn gợi ý và không xem đáp án nữa", !hintVisible(w2, "gợi ý") && !canReveal(w2));
check("bấm 'Xem đáp án' sau lần 1 sai → revealed, giữ số lần", eq(afterReveal(w1), { tries: 1, solved: false, revealed: true }));

section("Đúng");
const ok1 = afterSubmit(E, true, true);
check("đúng ngay lần 1 → solved, KHÔNG qua bước gợi ý", correctionState(ok1) === "solved" && ok1.tries === 1 && !hintVisible(ok1, "gợi ý") && !reflectionAllowed(ok1, false));
const ok2 = afterSubmit(w1, true, true);
check("sai lần 1 rồi đúng lần 2 → solved (tries 2)", correctionState(ok2) === "solved" && ok2.tries === 2);
check("ô tự giải thích chỉ khi đã được xem gợi ý và đã xong", reflectionAllowed(ok2, true) && reflectionAllowed(w2, true) && !reflectionAllowed(w1, true) && !reflectionAllowed(E, true) && !reflectionAllowed(ok1, true) && !reflectionAllowed(ok2, false));

section("Câu CHƯA có gợi ý: bỏ bước 2");
const nh = afterSubmit(E, false, false);
check("sai lần 1 → hiện đáp án luôn", correctionState(nh) === "revealed" && nh.tries === 1);
check("không có gợi ý thì không bao giờ lộ gợi ý", !hintVisible(w1, "") && !hintVisible(w1, "   ") && !hintVisible(w1, null) && !hintVisible(w1, undefined));
check("đúng lần 1 vẫn solved", correctionState(afterSubmit(E, true, false)) === "solved");

section("So khớp câu điền ngắn");
check("không phân biệt hoa/thường, khoảng trắng, dấu phẩy = dấu chấm", shortAnswerCorrect(" 3,5 ", "3.5") && shortAnswerCorrect("Hà  Nội", "hà nội") && shortAnswerCorrect("ABC", "abc"));
check("sai / rỗng / thiếu đáp án đúng → sai", !shortAnswerCorrect("4", "3") && !shortAnswerCorrect("", "3") && !shortAnswerCorrect(null, "3") && !shortAnswerCorrect("3", "") && !shortAnswerCorrect("3", null));

section("Loại câu chữa được");
check("chỉ MC và câu điền ngắn", isCorrectableType("MC") && isCorrectableType("SHORT_ANSWER") && !isCorrectableType("ESSAY") && !isCorrectableType("TRUE_FALSE_CLUSTER"));
done();
