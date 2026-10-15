// Test trình duyệt cho phần Tiếng Anh: Hôm nay (lộ trình), Thi thử IELTS (làm phiếu → dán đáp án → chấm, khôi phục nháp), Tiến độ + Sổ lỗi.
// Chạy: source tools/local-e2e/env.sh && SHOTS=<thư mục ảnh> npx tsx tools/local-e2e/ui-english.ts
import { prisma } from "@/lib/prisma";
import { api, check, done, eventually, mkUser, section, wipe } from "./h";
import { launch, ctxFor, shot, closeAll, type Page } from "./ui";
import { addDays, vnDay } from "@/lib/english/day";
import { allListEntries } from "@/lib/english/lexicon";

const BASE = process.env.BASE ?? "http://localhost:3100";
const KEY = Array.from({ length: 40 }, (_, i) => `${i + 1} ${["TRUE", "B", "(the) river"][i % 3]}`).join("\n");

async function noOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

async function main() {
  await wipe();
  const entries0 = allListEntries(); // máy chủ nhớ cờ "đã nạp từ" trong bộ nhớ → nạp lại kho từ sau wipe()
  for (let i = 0; i < entries0.length; i += 1000) {
    await prisma.engWord.createMany({ data: entries0.slice(i, i + 1000).map(e => ({ lemma: e.lemma, list: e.list, listRank: e.listRank, freqRank: e.freqRank })), skipDuplicates: true });
  }
  const a = await mkUser({ name: "Thọ" });
  // dữ liệu nền qua API
  await api("PATCH", "/api/english/profile", { as: a, body: { examDate: addDays(vnDay(), 7 * 17 + 3), targetBand: 6.5 } });
  const pl = await api("GET", "/api/english/placement", { as: a });
  await api("POST", "/api/english/placement", { as: a, body: { answers: pl.json.items.map((i: { lemma: string }) => ({ lemma: i.lemma, known: false })) } });
  const ans = Array.from({ length: 40 }, (_, i) => (i < 30 ? ["T", "b", "river"][i % 3] : "x"));
  await api("POST", "/api/english/mock", { as: a, body: { skill: "listening", title: "Cambridge 18 — Test 1", answers: ans, keyText: KEY, seconds: 1900 } });
  await api("POST", "/api/english/mock", { as: a, body: { skill: "writing", title: "Cô X chấm", band: 6 } });
  await api("POST", "/api/english/mock", { as: a, body: { skill: "speaking", title: "Nói thử", band: 6 } });
  const txt = await api("POST", "/api/english/texts", { as: a, body: { title: "A small town", body: "The students in the small town go to school every morning. They read books and talk with their teachers. ".repeat(4) } });
  await api("POST", `/api/english/texts/${txt.json.id}/questions`, { as: a });
  const tx = await api("GET", `/api/english/texts/${txt.json.id}`, { as: a });
  await api("POST", `/api/english/exercises/${tx.json.exercises[0].id}/answer`, { as: a, body: { answer: "FALSE" } });
  await api("POST", "/api/english/dictation", { as: a, body: { textId: txt.json.id, correct: 7, total: 10, seconds: 120 } });

  await launch();
  const ctx = await ctxFor(a);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("console", m => { if (m.type() === "error" && !/favicon|Download the React DevTools|net::ERR_ABORTED/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  page.on("pageerror", e => errors.push(String(e).slice(0, 200)));

  section("Hôm nay: thẻ lộ trình");
  await page.goto(`${BASE}/student/tieng-anh`);
  await eventually("thấy chặng + tuần", async () => (await page.getByText("Chặng Tăng tốc").count()) > 0 && (await page.getByText("Tuần 9/26").count()) > 0);
  await eventually("thấy mốc thi thử tuần 14", async () => (await page.getByText(/Thi thử tuần 14/).count()) > 0);
  check("có tab Thi thử IELTS + Tiến độ", (await page.getByRole("link", { name: "Thi thử IELTS" }).count()) === 1 && (await page.getByRole("link", { name: "Tiến độ" }).count()) === 1);
  await shot(page, "en-today");

  section("Thi thử: danh sách + band tổng");
  await page.goto(`${BASE}/student/tieng-anh/thi-thu`);
  await eventually("band tổng chưa đủ 4 kỹ năng → —", async () => (await page.getByText("cần đủ 4 kỹ năng").count()) > 0);
  await shot(page, "en-mock-list");

  section("Thi thử: làm phiếu Reading → dán đáp án → chấm");
  await page.getByRole("button", { name: "Làm đề Reading" }).click();
  await page.getByLabel("Tên đề").fill("Cambridge 18 — Test 2");
  await page.getByRole("button", { name: "Bắt đầu bấm giờ" }).click();
  await eventually("hiện đồng hồ đếm ngược", async () => /^\d+:\d\d$/.test((await page.getByRole("timer").textContent())?.trim() ?? ""));
  for (let n = 1; n <= 40; n++) await page.getByLabel(`Đáp án của bạn câu ${n}`, { exact: true }).fill(n <= 28 ? ["true", "B", "the river"][(n - 1) % 3] : "");
  await shot(page, "en-mock-sheet");
  section("Thi thử: tải lại trang không mất phiếu");
  await page.reload();
  await eventually("phiếu được khôi phục", async () => (await page.getByLabel("Đáp án của bạn câu 2", { exact: true }).inputValue()) === "B");
  await page.getByRole("button", { name: /Nộp phiếu/ }).click();
  await page.getByLabel("Đáp án của sách").first().fill(KEY.split("\n").slice(0, 38).join("\n"));
  await eventually("báo thiếu câu 39, 40", async () => (await page.getByText(/còn thiếu câu 39, 40/).count()) > 0);
  check("chưa đủ đáp án thì chưa cho chấm", await page.getByRole("button", { name: "Chấm điểm" }).isDisabled());
  await page.getByLabel("Đáp án của sách câu 39", { exact: true }).fill("TRUE");
  await page.getByLabel("Đáp án của sách câu 40", { exact: true }).fill("B");
  await eventually("đủ 40 đáp án", async () => (await page.getByText("Đọc đủ 40 đáp án").count()) > 0);
  await shot(page, "en-mock-key");
  await page.getByRole("button", { name: "Chấm điểm" }).click();
  await eventually("kết quả 28/40 → band 6.5", async () => (await page.getByText("28/40").count()) > 0 && (await page.getByText("6.5", { exact: true }).count()) > 0);
  check("liệt kê câu sai", (await page.getByText(/Câu 29/).count()) > 0);
  await shot(page, "en-mock-result");
  check("đã lưu vào DB", (await prisma.engMock.count({ where: { userId: a.id, skill: "reading" } })) === 1);
  await page.getByRole("button", { name: "Về danh sách thi thử" }).click();
  await eventually("band tổng sau đủ 4 kỹ năng = 6.5", async () => (await page.getByText("Band tổng ước tính").locator("..").getByText("6.5").count()) > 0);
  await page.getByRole("button", { name: "Xem phiếu" }).first().click();
  await eventually("xem lại phiếu đã chấm", async () => (await page.getByLabel("Phiếu câu 40", { exact: true }).count()) === 1);
  await shot(page, "en-mock-history");

  section("Tiến độ + Sổ lỗi");
  await page.goto(`${BASE}/student/tieng-anh/tien-do`);
  await eventually("sổ lỗi có 1 câu", async () => (await page.getByText(/Sổ lỗi · 1 câu/).count()) > 0);
  await eventually("biểu đồ thi thử có nhãn L 7.0", async () => (await page.locator("svg text", { hasText: "L 7.0" }).count()) > 0);
  await page.getByText(/Bài đọc: A small town/).click();
  await eventually("mở nhóm lỗi thấy đáp án sai đã gạch", async () => (await page.locator("s", { hasText: "FALSE" }).count()) > 0);
  await shot(page, "en-progress");

  section("Mọi tab đều mở được");
  const TABS: [string, string][] = [["", "Tiếng Anh hôm nay"], ["/tu-vung", "Từ vựng"], ["/tu-vung/on", "Ôn từ"], ["/doc", "Đọc"], ["/nghe", "Nghe"], ["/lop-hoc", "Lớp học từ sách"],
    ["/hoi-sach", "Hỏi sách"], ["/viet", "Viết"], ["/thi-thu", "Thi thử IELTS"], ["/tien-do", "Tiến độ"], [`/doc/${txt.json.id}`, "A small town"], [`/nghe/${txt.json.id}`, "Chép chính tả"]];
  for (const [p, h] of TABS) {
    await page.goto(`${BASE}/student/tieng-anh${p}`);
    await eventually(`mở /tieng-anh${p || "/"}`, async () => (await page.getByRole("heading", { level: 1 }).filter({ hasText: h }).count()) > 0);
  }
  await shot(page, "en-reader");

  section("Điện thoại 390px");
  const m = await (await ctxFor(a, { width: 390, height: 844 })).newPage();
  for (const p of ["", "/tu-vung", "/doc", "/nghe", "/lop-hoc", "/viet", "/thi-thu", "/tien-do", `/doc/${txt.json.id}`]) {
    await m.goto(`${BASE}/student/tieng-anh${p}`);
    await m.waitForLoadState("networkidle");
    await m.waitForTimeout(500);
    check(`không tràn ngang: /tieng-anh${p}`, await noOverflow(m));
  }
  await shot(m, "en-progress-mobile");
  await m.goto(`${BASE}/student/tieng-anh`); await m.waitForLoadState("networkidle"); await m.waitForTimeout(400);
  await shot(m, "en-today-mobile");

  check("không có lỗi console", errors.length === 0, errors);
  await closeAll();
  await done();
}

main().catch(async e => { console.error(e); await closeAll(); process.exit(1); });
