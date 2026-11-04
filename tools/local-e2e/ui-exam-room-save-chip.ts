// 5A (quyết định của Thọ 04/11/2026) trong trình duyệt thật — chip lưu của phòng thi khi MÁY CHỦ TỪ CHỐI một đáp án bằng lỗi 4xx (vd. 409 section_locked "Phần này đã hết giờ"):
//   trước đây chip vẫn báo "Đã lưu" dù đáp án chưa lên máy chủ; nay chip nói "Chưa lưu được · 1 câu" kèm nút "Thử lại", KHÔNG tự thử lại mãi (4xx không tự hết),
//   bấm "Thử lại" gửi lại, em đổi đáp án câu đó thì thay bản bị từ chối. Lỗi MẠNG / 5xx vẫn tự thử lại lùi mũi như cũ.
// Máy chủ thật trả đúng dạng { error, code: "section_locked" } status 409 (answer/route.ts); ở đây chặn bằng page.route để dựng tình huống mà không phải đợi hết giờ một Phần.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-exam-room-save-chip.ts
//
// CA PHÁ CỐ Ý (mỗi lần một thứ rồi hoàn lại):
//   - useSaveQueue.ts: trả `kind === "drop"` về cách cũ (commit(dropQueued(...)); setText idle) → ca "chip 'Chưa lưu được', không 'Đã lưu'" đỏ.
//   - useSaveQueue.ts: bỏ `continue` / cho "drop" rơi xuống nhánh retry (hẹn thử lại) → ca "không tự thử lại mãi (đúng 1 lần gọi)" đỏ.
//   - useRoomSession.ts: `retrySave` gọi `q.flush()` thay `q.retry()` → ca "bấm Thử lại → gửi lại" đỏ (đáp án bị từ chối không về hàng đợi).
import { BASE, mkTutor, mkUser, mkCourse, wipe, check, section, done, eventually } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Minh Anh" });
  const C = await mkCourse(T.id, { name: "Toán 9" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C.id, status: "active" } });
  const ex = await prisma.exam.create({ data: { id: "ex-chip", code: "ex-chip", title: "Đề thử chip lưu", category: "Toán", date: "01/01/2030", time: "08:00", duration: "45 phút", questions: 2, status: "available", createdAt: "2020", ownerId: T.id, courseId: C.id } });
  const mkQ = async (id: string, order: number, text: string, opts: string[]) => {
    const q = await prisma.examQuestion.create({ data: { id, examId: ex.id, order, text, type: "MC" } });
    for (const [i, t] of opts.entries()) await prisma.examOption.create({ data: { id: `${id}-o${i}`, questionId: q.id, order: i, text: t, isCorrect: i === 0 } });
    return q;
  };
  const q1 = await mkQ("qc1", 1, "Câu một dùng để thử chip lưu?", ["Phương án Một", "Phương án Hai", "Phương án Ba", "Phương án Bốn"]);
  await mkQ("qc2", 2, "Câu hai dùng để thử chip lưu?", ["Lựa chọn Năm", "Lựa chọn Sáu"]);

  await launch();
  const errors: string[] = [];
  const watch = (p: { on: (ev: string, cb: (x: never) => void) => unknown }) => {
    p.on("pageerror", ((e: unknown) => errors.push(String(e).slice(0, 200))) as never);
    p.on("console", ((m: { type(): string; text(): string }) => { if (m.type() === "error" && /Cannot update a component|Hydration|did not match/i.test(m.text())) errors.push(m.text().slice(0, 200)); }) as never);
  };
  const ctx = await ctxFor(S, { width: 1280, height: 900 });
  const pg = await ctx.newPage(); watch(pg as never);
  const chip = pg.locator("[data-chip-luu]");
  const state = async () => (await chip.getAttribute("data-chip-luu")) ?? "";
  const text = async () => (await chip.innerText()).replace(/\s+/g, " ").trim();
  const saved = async (qid: string) => (await prisma.examAnswer.findFirst({ where: { questionId: qid } }))?.optionId ?? null;

  await pg.goto(`${BASE}/student/thi-thu/${ex.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await pg.getByRole("button", { name: /Bắt đầu làm bài/ }).waitFor({ timeout: 90000 });
  await pg.getByRole("button", { name: /Bắt đầu làm bài/ }).click();
  await pg.getByText("Câu một dùng để thử chip lưu?").waitFor({ timeout: 60000 });
  await pg.addStyleTag({ content: "[data-agentation-root]{display:none!important}" });

  section("Tiền đề: lưu được → 'Đã lưu'");
  await pg.getByText("Phương án Một", { exact: true }).click();
  await eventually("chip 'Đã lưu' và DB có đáp án", async () => (await state()) === "saved" && (await text()).includes("Đã lưu") && (await saved(q1.id)) === "qc1-o0", 30000);

  section("Máy chủ từ chối 409 section_locked → 'Chưa lưu được', không im lặng 'Đã lưu'");
  const calls: string[] = [];
  let mode: "locked" | "bad400" | "unavailable" | "pass" = "locked";
  await pg.route("**/api/exams/attempts/*/answer", async route => {
    const req = route.request();
    if (req.method() !== "PATCH") return route.continue();
    calls.push(`${mode}:${req.postData() ?? ""}`);
    if (mode === "locked") return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "Phần này đã hết giờ", code: "section_locked" }) });
    if (mode === "bad400") return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "Dữ liệu không hợp lệ" }) });
    if (mode === "unavailable") { mode = "pass"; return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Tạm thời không lưu được" }) }); }
    return route.continue();
  });
  await pg.getByText("Phương án Hai", { exact: true }).click();
  await eventually("chip chuyển 'failed' — chữ 'Chưa lưu được · 1 câu'", async () => (await state()) === "failed" && /Chưa lưu được · 1 câu/.test(await text()), 20000);
  check("chip KHÔNG còn chữ 'Đã lưu' (trước đây vẫn báo 'Đã lưu 14:03:22' dù đáp án chưa lên máy chủ)", !(await text()).includes("Đã lưu"), await text());
  check("có nút 'Thử lại' nhìn thấy", await chip.getByRole("button", { name: "Thử lại" }).isVisible());
  check("đáp án mới vẫn hiện ĐÃ CHỌN trên màn (không mất lựa chọn của em)", await pg.locator("label:has(input[type=radio]:checked)").first().innerText().then(t => t.includes("Phương án Hai")));
  check("DB vẫn là đáp án cũ (Phương án Một): đáp án mới CHƯA lên máy chủ", (await saved(q1.id)) === "qc1-o0", await saved(q1.id));
  const n0 = calls.length;
  await pg.waitForTimeout(4500);   // lùi mũi 1s/2s/4s: nếu bị coi là lỗi mạng thì trong 4,5 giây đã có ≥ 2 lần gửi nữa
  check("KHÔNG tự thử lại mãi: vẫn đúng 1 lần gọi sau 4,5 giây (4xx không tự hết)", n0 === 1 && calls.length === 1, calls.length);
  check("…và chip vẫn 'failed'", (await state()) === "failed");
  await shot(pg, "exam-room-chip-tu-choi").catch(() => {});

  section("Nút 'Thử lại'");
  await chip.getByRole("button", { name: "Thử lại" }).click();
  await eventually("bấm Thử lại khi máy chủ vẫn từ chối → gửi lại đúng 1 lần nữa, chip vẫn 'Chưa lưu được · 1 câu'", async () => calls.length === 2 && (await state()) === "failed" && /Chưa lưu được · 1 câu/.test(await text()), 15000);
  check("…lần gửi lại mang ĐÚNG đáp án bị từ chối (Phương án Hai = qc1-o1)", calls[1].includes("qc1-o1"), calls[1]);
  mode = "pass";
  await chip.getByRole("button", { name: "Thử lại" }).click();
  await eventually("máy chủ nhận lại → chip 'Đã lưu' và DB có đáp án mới (qc1-o1)", async () => (await state()) === "saved" && (await text()).includes("Đã lưu") && (await saved(q1.id)) === "qc1-o1", 30000);
  check("nút 'Thử lại' biến mất khi đã lưu", (await chip.getByRole("button", { name: "Thử lại" }).count()) === 0);

  section("Đổi đáp án câu bị từ chối → thay bản cũ, tự lưu, không cần bấm Thử lại");
  mode = "bad400";
  await pg.getByText("Phương án Ba", { exact: true }).click();
  await eventually("400 thường cũng ra 'Chưa lưu được · 1 câu'", async () => (await state()) === "failed" && /Chưa lưu được · 1 câu/.test(await text()), 20000);
  mode = "pass";
  await pg.getByText("Phương án Bốn", { exact: true }).click();
  await eventually("chọn lại câu đó khi máy chủ nhận được → 'Đã lưu', DB là Phương án Bốn (qc1-o3), không còn 'Chưa lưu được'", async () => (await state()) === "saved" && !(await text()).includes("Chưa lưu được") && (await saved(q1.id)) === "qc1-o3", 30000);

  section("Hai câu: một câu bị từ chối, câu kia lưu được → chip vẫn 'Chưa lưu được' (không 'Đã lưu' giả)");
  mode = "locked";
  await pg.getByText("Phương án Một", { exact: true }).click();   // câu 1 bị từ chối
  await eventually("câu 1 bị từ chối → failed", async () => (await state()) === "failed", 20000);
  mode = "pass";
  const q2Tab = pg.getByRole("button", { name: /Câu 2/ }).first();
  if (await q2Tab.count()) await q2Tab.click().catch(() => {});
  await pg.getByText("Lựa chọn Năm", { exact: true }).click({ timeout: 15000 }).catch(async () => { await pg.getByRole("button", { name: /Câu tiếp|Tiếp/ }).first().click(); await pg.getByText("Lựa chọn Năm", { exact: true }).click(); });
  await eventually("câu 2 lưu được trong DB", async () => (await saved("qc2")) === "qc2-o0", 30000);
  check("…nhưng chip vẫn 'failed' · 1 câu vì câu 1 còn bị từ chối (không 'Đã lưu' giả)", (await state()) === "failed" && /Chưa lưu được · 1 câu/.test(await text()) && !(await text()).includes("Đã lưu"), await text());
  await chip.getByRole("button", { name: "Thử lại" }).click();
  await eventually("bấm Thử lại → câu 1 lưu được (qc1-o0), chip 'Đã lưu'", async () => (await state()) === "saved" && (await saved(q1.id)) === "qc1-o0", 30000);

  section("Lỗi tạm thời 503 vẫn tự thử lại như cũ (không dính thay đổi)");
  mode = "unavailable";
  await pg.getByRole("button", { name: /Câu 1/ }).first().click().catch(() => {});
  await pg.getByText("Phương án Hai", { exact: true }).click({ timeout: 15000 });
  await eventually("503 → chip 'Chưa lưu được' rồi tự thử lại sau ~1 giây và 'Đã lưu' (DB qc1-o1) mà không cần bấm", async () => (await state()) === "saved" && (await saved(q1.id)) === "qc1-o1", 40000);

  section("390 — điện thoại");
  const mctx = await ctxFor(S, { width: 390, height: 800 });
  const mp = await mctx.newPage(); watch(mp as never);
  await mp.route("**/api/exams/attempts/*/answer", route => route.request().method() === "PATCH" ? route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "Phần này đã hết giờ", code: "section_locked" }) }) : route.continue());
  await mp.goto(`${BASE}/student/thi-thu/${ex.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await mp.getByRole("button", { name: /Tiếp tục làm bài/ }).click();
  await mp.getByText("Câu một dùng để thử chip lưu?").waitFor({ timeout: 60000 });
  await mp.getByText("Phương án Ba", { exact: true }).click();
  await mp.locator('[data-chip-luu="failed"]').waitFor({ timeout: 20000 });
  const box = await mp.locator("[data-chip-luu]").boundingBox();
  check("chip 'Chưa lưu được' + nút Thử lại nằm trọn trong 390px, nút cao ≥ 44px", !!box && box.x >= 0 && box.x + box.width <= 390 && ((await mp.locator("[data-chip-luu] button").boundingBox())?.height ?? 0) >= 44, box);
  check("390: không tràn ngang", await mp.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth") as boolean);
  await shot(mp, "exam-room-chip-tu-choi-390").catch(() => {});

  check("không lỗi JS / cảnh báo React", errors.length === 0, errors.slice(0, 3));
  await closeAll();
  await done();
})().catch(e => { console.error("TEST CRASH", String(e).slice(0, 400)); process.exit(1); });
