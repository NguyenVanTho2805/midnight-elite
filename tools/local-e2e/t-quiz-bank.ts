// QZ — "Lưu vào ngân hàng câu hỏi" từ quiz của gia sư (route có sẵn save-to-bank) với câu NHIỀU ĐÁP ÁN, + đường dẫn đầu mục (src/lib/quizBank.ts).
// Cần máy chủ dev đang chạy ở BASE; gọi wipe() trên DB riêng. Trọng tâm: chỉ gia sư chủ đề lưu được; MC_MULTI giữ nguyên MỌI đáp án đúng;
// lưu = SAO CHÉP độc lập (sửa ngân hàng không đổi câu trong quiz); không lưu đôi; quiz chỉ-đọc vì đã có bài làm vẫn lưu được mà nội dung quiz không đổi.
import { api, mkTutor, mkUser, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { categoryPath, BANK_DIFFICULTIES } from "@/lib/quizBank";

let seq = 0;
const stamp = Date.now().toString(36);
const id = (p: string) => `${p}-${stamp}-${++seq}`;

(async () => {
  section("categoryPath (thuần)");
  const cats = [{ id: "a", name: "Toán", parentId: null }, { id: "b", name: "Lớp 9", parentId: "a" }, { id: "c", name: "Hàm số", parentId: "b" }];
  check("đường dẫn từ gốc", categoryPath(cats, "c") === "Toán › Lớp 9 › Hàm số" && categoryPath(cats, "a") === "Toán");
  check("id không có → rỗng", categoryPath(cats, "x") === "");
  check("PHÁ: vòng lặp parentId không treo, bị cắt", (() => { const loop = [{ id: "a", name: "A", parentId: "b" }, { id: "b", name: "B", parentId: "a" }]; return categoryPath(loop, "a") === "B › A"; })());
  check("đủ 4 mức độ khó khớp route (NB/TH/VD/VDC)", BANK_DIFFICULTIES.map(d => d.v).join() === "NB,TH,VD,VDC");

  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Cô Khác"), S = await mkUser({ name: "Em An" });
  const cat = await prisma.questionCategory.create({ data: { name: "Toán 9" } });
  const eid = id("quiz");
  await prisma.exam.create({ data: { id: eid, code: eid, title: "Quiz ngân hàng", category: "Quiz", date: "01/01/2030", time: "08:00", duration: "30 phút", questions: 2, status: "available", createdAt: "2026-01-01", ownerId: T.id, totalPoints: 4 } });
  const q = await prisma.examQuestion.create({ data: { id: id("q"), examId: eid, order: 1, text: "Chọn các số nguyên tố", type: "MC_MULTI", points: 2, explanation: "2 và 3 là số nguyên tố", hint: "Chia hết cho 1 và chính nó" } });
  for (const [i, [t, c]] of ([["2", true], ["4", false], ["3", true], ["9", false]] as [string, boolean][]).entries()) await prisma.examOption.create({ data: { id: id("o"), questionId: q.id, order: i, text: t, isCorrect: c } });
  const q2 = await prisma.examQuestion.create({ data: { id: id("q"), examId: eid, order: 2, text: "Tự luận có tiêu chí", type: "ESSAY", points: 2, graderGuide: "BÍ-MẬT-CHẤM", rubric: [{ name: "Ý 1", requirement: "đủ", points: 2 }] } });
  const url = (qid: string) => `/api/exams/${eid}/questions/${qid}/save-to-bank`;
  const body = { categoryId: cat.id, difficulty: "VD" };

  section("Quyền");
  check("chưa đăng nhập → 401", (await api("POST", url(q.id), { body })).status === 401);
  check("học sinh → 403", (await api("POST", url(q.id), { as: S, body })).status === 403);
  check("gia sư KHÁC → 403", (await api("POST", url(q.id), { as: T2, body })).status === 403);
  check("các lần bị chặn: ngân hàng vẫn trống", (await prisma.questionBankItem.count()) === 0);

  section("Đầu vào");
  check("thiếu đầu mục → 400", (await api("POST", url(q.id), { as: T, body: { difficulty: "VD" } })).status === 400);
  check("đầu mục không tồn tại → 400", (await api("POST", url(q.id), { as: T, body: { categoryId: "khong-co", difficulty: "VD" } })).status === 400);
  check("độ khó lạ → 400", (await api("POST", url(q.id), { as: T, body: { categoryId: cat.id, difficulty: "RAT-KHO" } })).status === 400);
  check("câu không thuộc đề → 404", (await api("POST", url("khong-co"), { as: T, body })).status === 404);
  check("vẫn chưa ghi gì", (await prisma.questionBankItem.count()) === 0);

  section("Lưu câu nhiều đáp án");
  const snap = (await prisma.examQuestion.findUnique({ where: { id: q.id } }))!;
  const r = await api("POST", url(q.id), { as: T, body });
  check("200, type MC_MULTI, 4 đáp án, ĐÚNG 2 ô đúng (2 và 3)", r.status === 200 && r.json.type === "MC_MULTI" && r.json.options.length === 4 && r.json.options.filter((o: any) => o.isCorrect).map((o: any) => o.text).sort().join() === "2,3", r.json);
  check("điểm, giải thích, gợi ý được giữ", r.json.points === 2 && r.json.explanation === "2 và 3 là số nguyên tố" && r.json.hint === "Chia hết cho 1 và chính nó");
  check("ngân hàng: chủ là gia sư này, trạng thái NHÁP (gia sư phải gửi duyệt mới dùng chung)", r.json.ownerId === T.id && r.json.status === "draft", [r.json.ownerId, r.json.status]);
  const bankId = r.json.id as string;
  check("câu trong quiz gắn truy vết sourceBankItemId", (await prisma.examQuestion.findUnique({ where: { id: q.id } }))?.sourceBankItemId === bankId);
  check("API gia sư trả inBank=true cho câu này, false cho câu khác", await (async () => { const g = await api("GET", `/api/tutor/quiz/${eid}`, { as: T }); const qs = g.json.questions as any[]; return g.status === 200 && qs.find(x => x.id === q.id)?.inBank === true && qs.find(x => x.id === q2.id)?.inBank === false; })());
  const again = await api("POST", url(q.id), { as: T, body });
  check("lưu lần 2 → 409, không tạo bản ghi thứ hai", again.status === 409 && (await prisma.questionBankItem.count()) === 1, again.json);

  section("Sao chép độc lập");
  await prisma.questionBankItem.update({ where: { id: bankId }, data: { text: "ĐÃ SỬA Ở NGÂN HÀNG" } });
  const quizQ = await prisma.examQuestion.findUnique({ where: { id: q.id } });
  check("sửa bản trong ngân hàng KHÔNG đổi câu trong quiz", quizQ?.text === "Chọn các số nguyên tố");
  check("lưu vào ngân hàng KHÔNG đổi nội dung câu trong quiz (chỉ thêm truy vết)", quizQ?.type === snap.type && quizQ?.points === snap.points && quizQ?.explanation === snap.explanation && quizQ?.hint === snap.hint && quizQ?.order === snap.order, [quizQ, snap]);
  check("đáp án trong quiz vẫn 2 ô đúng", (await prisma.examOption.count({ where: { questionId: q.id, isCorrect: true } })) === 2);

  section("Quiz đã có bài làm vẫn lưu được (không đụng nội dung)");
  await prisma.examAttempt.create({ data: { userId: S.id, examId: eid, expiresAt: new Date(Date.now() + 3600_000), status: "submitted", submittedAt: new Date(), totalPoints: 4 } });
  const r2 = await api("POST", url(q2.id), { as: T, body });
  check("câu tự luận lưu được; rubric/hướng dẫn chấm KHÔNG sang ngân hàng", r2.status === 200 && r2.json.type === "ESSAY" && !JSON.stringify(r2.json).includes("BÍ-MẬT-CHẤM") && !("rubric" in r2.json), r2.json);
  check("câu trong quiz còn nguyên rubric và hướng dẫn chấm", (await prisma.examQuestion.findUnique({ where: { id: q2.id } }))?.graderGuide === "BÍ-MẬT-CHẤM");

  await done();
})();
