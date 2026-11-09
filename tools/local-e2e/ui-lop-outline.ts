// BU-HS-TRANG-CHU mục 8 — cây chương của lớp: chương xổ ra / thu vào, tìm bài (không dấu / đ), Mở hết / Thu hết, thụt cấp, đếm x/y, bài đang học, bài khoá có chữ,
// thanh bên bài giảng (rail 268px, 1280) và tờ trượt (sheet, 390). 1280 / 390 / 320. Dữ liệu: 2 phần × 3 chương × 4 bài (tên có dấu), học sinh đã học 3 bài chương 1 và đủ 4 bài chương 4.
// Ca phá cố ý (stu-test chạy THẬT 09/11/2026 trên cổng 3100, mỗi ca sửa src rồi `git checkout` hoàn lại; nền = 88 pass / 0 fail):
//   (1) `filterOutline` so tên bài bằng `l.title.toLowerCase()` thay vì `fold(l.title)` (lessonOutline.ts:77) → 7 đỏ ("duong thang" ra 4 bài / 1 chương, không tự mở chương 4, đ / hoa-thường / dấu cách) rồi bài dừng;
//   (2) CourseOutline bỏ `aria-expanded` ở nút chương (CourseOutline.tsx:193) → 17 đỏ (chương mở sẵn, bấm mở/thu, Enter/Space, Mở hết, rail, 390/320, tờ trượt);
//   (3) CourseOutline bỏ `aria-disabled` ở bài khoá (CourseOutline.tsx:135) → 1 đỏ ("bài khoá: role=link, aria-disabled=true").
import { BASE, mkUser, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { launch, ctxFor, shot, closeAll, type Page } from "./ui";

const stamp = Date.now().toString(36);
const LONG = "Bài 24: " + "Hìnhkhốirấtdài".repeat(14).slice(0, 192); // đúng 200 ký tự, KHÔNG có dấu cách sau "Bài 24:" (một "từ" 192 ký tự)
const NOT_OVERFLOW = `document.documentElement.scrollWidth <= window.innerWidth`;

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const S = await mkUser({ name: "Minh Anh" });   // đã vào lớp
  const OUT = await mkUser({ name: "Bạn Chưa Vào" }); // chưa vào lớp → bài khoá hiện đúng
  const C = await mkCourse(T.id, { name: "Toán 9 cây chương" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C.id, status: "active" } });

  // 2 phần × 3 chương × 4 bài
  const secs = [
    { id: `sA-${stamp}`, title: "Đại số", chs: [
      { id: `cA1-${stamp}`, title: "Chương 1: Hệ phương trình", ls: ["Bài 1: Phương trình bậc nhất hai ẩn", "Bài 2: Giải hệ bằng phép thế", "Bài 3: Giải hệ bằng cộng đại số", "Bài 4: Giải toán bằng cách lập hệ"] },
      { id: `cA2-${stamp}`, title: "Chương 2: Hàm số bậc hai", ls: ["Bài 5: Đồ thị hàm số y = ax²", "Bài 6: Tìm đường thẳng đi qua hai điểm", "Bài 7: Tính chất hàm số", "Bài 8: Ôn tập hàm số"] },
      { id: `cA3-${stamp}`, title: "Chương 3: Phương trình bậc hai", ls: ["Bài 9: Công thức nghiệm", "Bài 10: Hệ thức Vi-ét", "Bài 11: Phương trình quy về bậc hai", "Bài 12: Ôn tập phương trình"] },
    ] },
    { id: `sB-${stamp}`, title: "Hình học", chs: [
      { id: `cB1-${stamp}`, title: "Chương 4: Đường thẳng và đường tròn", ls: ["Bài 13: Vị trí tương đối", "Bài 14: Tiếp tuyến của đường tròn", "Bài 15: Dây và khoảng cách", "Bài 16: Ôn tập chương 4"] },
      { id: `cB2-${stamp}`, title: "Chương 5: Góc và cung", ls: ["Bài 17: Góc ở tâm", "Bài 18: Góc nội tiếp", "Bài 19: Cung chứa góc", "Bài 20: Tứ giác nội tiếp"] },
      { id: `cB3-${stamp}`, title: "Chương 6: Hình khối", ls: ["Bài 21: Hình trụ", "Bài 22: Hình nón", "Bài 23: Hình cầu", LONG] },
    ] },
  ];
  const L: Record<string, string> = {}; // "A1-1" → id bài
  let n = 0;
  for (const [si, s] of secs.entries()) {
    await prisma.section.create({ data: { id: s.id, title: s.title, order: si + 1, courseId: C.id } });
    for (const [ci, c] of s.chs.entries()) {
      await prisma.chapter.create({ data: { id: c.id, title: c.title, order: ci + 1, sectionId: s.id } });
      for (const [li, title] of c.ls.entries()) {
        n++;
        const id = `l${n}-${stamp}`;
        const key = `${s.id.replace(/-.*/, "").slice(1)}${ci + 1}-${li + 1}`; // A1-1 … B3-4
        L[key] = id;
        // Chương 5 (B2): bài 3 và 4 là bài KHOÁ cho người chưa vào lớp (isLocked trong DB, không miễn phí).
        const locked = key === "B2-3" || key === "B2-4";
        await prisma.lesson.create({ data: { id, code: id, title, type: "record", order: li + 1, chapterId: c.id, isLocked: locked, isFree: !locked, duration: "30 phút" } });
      }
    }
  }
  const doneKeys = ["A1-1", "A1-2", "A1-3", "B1-1", "B1-2", "B1-3", "B1-4"];
  for (const k of doneKeys) await prisma.lessonProgress.create({ data: { userId: S.id, lessonId: L[k], watchedSeconds: 600, completed: true } });
  const CH = (k: string) => secs.flatMap(s => s.chs).find(c => c.id.startsWith("c" + k))!.id; // "A1" → id chương
  const allCh = secs.flatMap(s => s.chs).map(c => c.id);

  await launch();
  const errors: string[] = [];
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of (4|5)|Hydration|negative time stamp/i.test(m.text())) errors.push(m.text()); }); };
  const open = async (u: typeof S | null, w: number, path: string, h = 900) => {
    const c = await ctxFor(u, { width: w, height: h, rail: "mo" }); const p = await c.newPage(); watch(p);
    await p.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 240000 });
    await p.addStyleTag({ content: "[data-agentation-root]{display:none!important}" }).catch(() => {});
    return { c, p };
  };
  const waitTree = (p: Page, variant: string) => p.locator(`[data-outline][data-outline-variant="${variant}"] [data-outline-chapter]`).first().waitFor({ timeout: 90000 });
  const exp = async (p: Page, v: string) => Object.fromEntries(await p.locator(`[data-outline-variant="${v}"] [data-outline-chapter]`).evaluateAll(els => els.map(e => [e.getAttribute("data-outline-chapter"), e.getAttribute("aria-expanded")])));
  const openIds = async (p: Page, v: string) => Object.entries(await exp(p, v)).filter(([, x]) => x === "true").map(([k]) => k).sort();
  // Bài đang HIỆN (không nằm trong khối `inert` của chương đang thu).
  const shownLessons = (p: Page, v: string) => p.locator(`[data-outline-variant="${v}"] [data-outline-lesson]`).evaluateAll(els => els.filter(e => !e.closest("[inert]")).map(e => e.getAttribute("data-outline-lesson")));
  const status = async (p: Page, v: string) => (await p.locator(`[data-outline-variant="${v}"] [data-outline-status]`).innerText()).trim();
  const sameSet = (a: string[], b: string[]) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

  // ═════════ 1280: trang lớp ═════════
  section("1280 · trang lớp /student/hoc-tap?course=: cây Phần > Chương > Bài, chương mở sẵn là chương chứa bài kế");
  const { c: c1, p } = await open(S, 1280, `/student/hoc-tap?course=${C.id}`);
  await waitTree(p, "page");
  const V = "page";
  const e0 = await exp(p, V);
  check("6 nút chương, đúng 2 hàng phần", Object.keys(e0).length === 6 && (await p.locator(`[data-outline-variant="${V}"] [data-outline-section]`).count()) === 2, e0);
  check("chỉ chương chứa bài kế (A1, bài 4 chưa học) mở sẵn: aria-expanded=true đúng 1 chương, 5 chương còn lại 'false'", sameSet(await openIds(p, V), [CH("A1")]) && Object.values(e0).filter(x => x === "false").length === 5, e0);
  const ctl = await p.locator(`[data-outline-variant="${V}"] [data-outline-chapter]`).evaluateAll(els => els.map(e => { const id = e.getAttribute("aria-controls") ?? ""; const t = document.getElementById(id); return { id, ok: !!t, inert: t?.hasAttribute("inert") ?? null, exp: e.getAttribute("aria-expanded") }; }));
  check("mỗi nút chương có aria-controls trỏ tới panel có thật (id lop-ch-<id>); panel của chương thu có `inert`, chương mở không", ctl.every(x => x.ok && x.id.startsWith("lop-ch-") && x.inert === (x.exp !== "true")), ctl);
  check("chỉ 4 bài của chương mở đang hiện (A1)", sameSet((await shownLessons(p, V)) as string[], ["A1-1", "A1-2", "A1-3", "A1-4"].map(k => L[k])), await shownLessons(p, V));

  section("1280 · thụt cấp rõ (đo left): tên phần < tên chương < tên bài");
  const left = async (sel: string) => p.locator(sel).first().evaluate(e => Math.round(e.getBoundingClientRect().left));
  const lSec = await left(`[data-outline-variant="${V}"] [data-outline-section] h3 [data-outline-title]`);
  const lChap = await left(`[data-outline-variant="${V}"] [data-outline-chapter] [data-outline-title]`);
  const lLes = await p.locator(`[data-outline-variant="${V}"] [data-outline-lesson="${L["A1-1"]}"] [data-outline-title]`).evaluate(e => Math.round(e.getBoundingClientRect().left));
  check(`ba cấp thụt dần: phần ${lSec}px < chương ${lChap}px < bài ${lLes}px`, lSec < lChap && lChap < lLes, { lSec, lChap, lLes });

  section("1280 · đếm x/y, 'Đã xong', bài đang học");
  const txt = async (k: string) => (await p.locator(`[data-outline-variant="${V}"] [data-outline-chapter="${CH(k)}"]`).innerText()).replace(/\s+/g, " ");
  check("chương 1: '3/4 bài', chưa có 'Đã xong'", /3\/4 bài/.test(await txt("A1")) && !/Đã xong/.test(await txt("A1")), await txt("A1"));
  check("chương 4 (đủ 4 bài): '4/4 bài' + chữ 'Đã xong' ([data-outline-done])", /4\/4 bài/.test(await txt("B1")) && (await p.locator(`[data-outline-chapter="${CH("B1")}"] [data-outline-done]`).count()) === 1, await txt("B1"));
  check("chương chưa học bài nào: '0/4 bài'", /0\/4 bài/.test(await txt("A3")), await txt("A3"));
  check("đúng 1 chương có 'Đã xong'", (await p.locator(`[data-outline-variant="${V}"] [data-outline-done]`).count()) === 1);
  const secTxt = (await p.locator(`[data-outline-variant="${V}"] [data-outline-section] h3`).allInnerTexts()).map(x => x.replace(/\s+/g, " "));
  check("tiêu đề phần có đếm: 'Đại số 3/12 bài', 'Hình học 4/12 bài'", /Đại số.*3\/12 bài/.test(secTxt[0]) && /Hình học.*4\/12 bài/.test(secTxt[1]), secTxt);
  const cur = await p.locator(`[data-outline-variant="${V}"] [data-outline-lesson][aria-current]`).evaluateAll(els => els.map(e => [e.getAttribute("data-outline-lesson"), e.getAttribute("aria-current")]));
  check("đúng MỘT hàng aria-current (bài kế = Bài 4 chương 1)", cur.length === 1 && cur[0][0] === L["A1-4"], cur);
  check("bài kế có chữ 'Học tiếp', bài đã học có chữ 'Đã học' (không chỉ màu)", await p.locator(`[data-outline-lesson="${L["A1-4"]}"]`).getByText("Học tiếp").isVisible() && await p.locator(`[data-outline-lesson="${L["A1-1"]}"]`).getByText("Đã học").isVisible());
  check("học sinh đã vào lớp: không có bài nào aria-disabled", (await p.locator(`[data-outline-variant="${V}"] [aria-disabled="true"]`).count()) === 0);
  await shot(p, "lop-outline-1280-page");

  section("1280 · chương xổ ra / thu vào bằng chuột và bàn phím; aria-expanded đồng bộ");
  const ch = (k: string) => p.locator(`[data-outline-variant="${V}"] [data-outline-chapter="${CH(k)}"]`);
  await ch("A2").click();
  check("bấm chương 2 → aria-expanded=true; hai chương A1, A2 đang mở", (await ch("A2").getAttribute("aria-expanded")) === "true" && sameSet(await openIds(p, V), [CH("A1"), CH("A2")]));
  const shown2 = (await shownLessons(p, V)) as string[];
  check("4 bài chương 2 nằm trong phần đang hiện", ["A2-1", "A2-2", "A2-3", "A2-4"].every(k => shown2.includes(L[k])));
  await ch("A2").click();
  check("bấm lại → aria-expanded=false, bài chương 2 biến khỏi phần hiện", (await ch("A2").getAttribute("aria-expanded")) === "false" && !((await shownLessons(p, V)) as string[]).includes(L["A2-1"]));
  await ch("A3").focus();
  await p.keyboard.press("Enter");
  check("bàn phím: Enter trên nút chương → mở (aria-expanded=true)", (await ch("A3").getAttribute("aria-expanded")) === "true");
  await p.keyboard.press("Space");
  check("bàn phím: Space → thu (aria-expanded=false)", (await ch("A3").getAttribute("aria-expanded")) === "false");
  await p.keyboard.press("Tab"); // sang phần tử kế tiếp trong thứ tự DOM
  const focusTag = await p.evaluate(`document.activeElement?.tagName + "|" + (document.activeElement?.getAttribute("data-outline-chapter") ?? document.activeElement?.getAttribute("data-outline-lesson") ?? "")`);
  check("Tab đi tiếp tới một nút / liên kết trong cây (không kẹt)", /^(BUTTON|A)\|/.test(String(focusTag)), focusTag);

  section("1280 · Mở hết / Thu hết");
  await p.locator(`[data-outline-variant="${V}"] [data-outline-open-all]`).click();
  check("Mở hết → cả 6 chương aria-expanded=true, hiện đủ 24 bài", (await openIds(p, V)).length === 6 && ((await shownLessons(p, V)) as string[]).length === 24, await openIds(p, V));
  await p.locator(`[data-outline-variant="${V}"] [data-outline-close-all]`).click();
  check("Thu hết → cả 6 chương aria-expanded=false, không còn bài nào hiện", (await openIds(p, V)).length === 0 && ((await shownLessons(p, V)) as string[]).length === 0);

  section("1280 · tìm bài: không dấu / có dấu / hoa thường, tự mở chương có kết quả, không khớp, xoá từ khoá về trạng thái trước");
  await ch("A1").click(); // trạng thái trước khi tìm: chỉ A1 mở
  const before = await openIds(p, V);
  const box = p.getByRole("searchbox", { name: "Tìm bài trong lớp" });
  check("ô tìm: nhãn 'Tìm bài trong lớp', type=search, cao ≥ 44px", (await box.count()) === 1 && ((await box.boundingBox())?.height ?? 0) >= 44);
  await box.fill("duong thang");
  const stt = await status(p, V);
  check("tìm 'duong thang' → thông báo role=status 'Tìm thấy 5 bài trong 2 chương.'", stt === "Tìm thấy 5 bài trong 2 chương." && (await p.locator(`[data-outline-variant="${V}"] [data-outline-status]`).getAttribute("role")) === "status", stt);
  const afterF = await exp(p, V);
  check("chỉ còn 2 chương khớp (Chương 2 có 'đường thẳng' trong tên bài; Chương 4 khớp tên chương), cả hai tự mở", sameSet(Object.keys(afterF), [CH("A2"), CH("B1")]) && Object.values(afterF).every(x => x === "true"), afterF);
  const shownF = (await shownLessons(p, V)) as string[];
  check("bài hiện: Bài 6 (chương 2) + cả 4 bài của chương 4 (khớp tên chương giữ cả bài); các bài khác biến mất", sameSet(shownF, [L["A2-2"], ...["B1-1", "B1-2", "B1-3", "B1-4"].map(k => L[k])]), shownF);
  check("phần Đại số và Hình học vẫn còn (mỗi phần còn ≥1 chương); chương không khớp biến mất (A1, A3, B2, B3 không còn nút)", (await p.locator(`[data-outline-variant="${V}"] [data-outline-section]`).count()) === 2 && (await ch("A1").count()) === 0 && (await ch("B3").count()) === 0);
  for (const q of ["đường thẳng", "DUONG THANG", "  duong   thang "]) { await box.fill(q); check(`tìm '${q}' cho cùng kết quả (đ / hoa-thường / dấu cách thừa)`, (await status(p, V)) === "Tìm thấy 5 bài trong 2 chương.", await status(p, V)); }
  await box.fill("d");
  check("1 ký tự: không lọc (đủ 6 chương, thông báo trống)", Object.keys(await exp(p, V)).length === 6 && (await status(p, V)) === "");
  await box.fill("duong thang");
  await ch("A2").click();
  check("đang lọc vẫn thu được từng chương (bấm chương 2 → aria-expanded=false)", (await ch("A2").getAttribute("aria-expanded")) === "false");
  await box.fill("zzz");
  check("'zzz' → khung 'không khớp' có chữ và nút 'Xoá từ khoá'; thông báo status đọc 'Không tìm thấy bài nào.'", await p.locator(`[data-outline-variant="${V}"] [data-outline-nomatch]`).isVisible() && /Không có bài nào khớp “zzz”\./.test(await p.locator(`[data-outline-nomatch]`).innerText()) && (await status(p, V)) === "Không tìm thấy bài nào.");
  const clr = p.locator(`[data-outline-variant="${V}"] [data-outline-nomatch] [data-outline-clear]`);
  check("nút 'Xoá từ khoá' cao ≥ 44px", ((await clr.boundingBox())?.height ?? 0) >= 44);
  await shot(p, "lop-outline-1280-khong-khop");
  await clr.click();
  check("Xoá từ khoá → ô tìm trống, cây về ĐÚNG trạng thái mở trước khi tìm", (await box.inputValue()) === "" && sameSet(await openIds(p, V), before) && (await p.locator(`[data-outline-variant="${V}"] [data-outline-nomatch]`).count()) === 0, await openIds(p, V));
  await box.fill("duong thang");
  await p.locator(`[data-outline-variant="${V}"] [data-outline-clear]`).first().click();
  check("nút 'Xoá' trong ô tìm cũng xoá từ khoá (cao ≥ 44px)", (await box.inputValue()) === "");
  await box.fill("duong thang"); await box.press("Escape");
  check("Esc trong ô tìm xoá từ khoá", (await box.inputValue()) === "");
  await box.fill("$ ^ ( ) [ <script>alert(1)</script>");
  check("ký tự đặc biệt / thẻ script: không lỗi, hiện 'không khớp', không chạy mã", (await p.locator(`[data-outline-nomatch]`).count()) === 1 && (await p.locator("script", { hasText: "alert(1)" }).count()) === 0);
  await box.fill("");

  section("1280 · mọi hàng / nút ≥ 44px, không tràn ngang, tên bài 200 ký tự xuống dòng");
  await p.locator(`[data-outline-variant="${V}"] [data-outline-open-all]`).click();
  const sizes = await p.evaluate(`(() => { const out = []; for (const e of document.querySelectorAll('[data-outline] [data-outline-chapter], [data-outline] [data-outline-lesson], [data-outline] [data-outline-search], [data-outline] [data-outline-open-all], [data-outline] [data-outline-close-all]')) { if (e.closest('[inert]')) continue; out.push([e.getAttribute('data-outline-chapter') ? 'chuong' : e.getAttribute('data-outline-lesson') ? 'bai' : 'nut', Math.round(e.getBoundingClientRect().height)]); } return out; })()`) as [string, number][];
  check(`${sizes.length} hàng / nút đang hiện đều cao ≥ 44px`, sizes.length >= 30 && sizes.every(([, h]) => h >= 44), sizes.filter(([, h]) => h < 44));
  const lg = await p.locator(`[data-outline-lesson="${L["B3-4"]}"] [data-outline-title]`).evaluate(e => { const r = e.getBoundingClientRect(); return { h: Math.round(r.height), right: Math.round(r.right), vw: innerWidth, line: parseFloat(getComputedStyle(e).lineHeight) || 20 }; });
  check("bài dài 200 ký tự: xuống ≥ 2 dòng, mép phải trong màn hình", lg.h >= lg.line * 1.8 && lg.right <= lg.vw, lg);
  check("1280 không tràn ngang", await p.evaluate(NOT_OVERFLOW) as boolean);
  await shot(p, "lop-outline-1280-mo-het");
  await c1.close();

  // ═════════ Người chưa vào lớp: bài khoá ═════════
  section("1280 · học sinh CHƯA vào lớp: cây vẫn hiện, bài khoá là role=link aria-disabled + chữ 'Đã khoá', không bấm sang bài");
  {
    const { c, p: q } = await open(OUT, 1280, `/student/hoc-tap?course=${C.id}`);
    await waitTree(q, "page");
    await q.locator(`[data-outline-variant="page"] [data-outline-open-all]`).click();
    const lk = q.locator(`[data-outline-lesson="${L["B2-3"]}"]`);
    check("bài khoá: role=link, aria-disabled=true, không phải thẻ <a> có href", (await lk.getAttribute("role")) === "link" && (await lk.getAttribute("aria-disabled")) === "true" && (await lk.evaluate(e => e.tagName === "DIV" && !e.hasAttribute("href"))));
    check("bài khoá có CHỮ 'Đã khoá' (không chỉ làm mờ)", await lk.getByText("Đã khoá").isVisible());
    const url0 = q.url();
    await lk.click({ force: true });
    await q.waitForTimeout(800);
    check("bấm bài khoá: không chuyển trang", q.url() === url0, q.url());
    check("bài không khoá của lớp vẫn là liên kết <a> tới /student/bai-giang/<id>", (await q.locator(`[data-outline-lesson="${L["A1-1"]}"]`).getAttribute("href")) === `/student/bai-giang/${L["A1-1"]}`);
    check("hero báo 'Bạn chưa vào lớp này'", await q.getByText("Bạn chưa vào lớp này").isVisible());
    await c.close();
  }

  // ═════════ 1280: thanh bên bài giảng ═════════
  section("1280 · thanh bên bài giảng /student/bai-giang/<id> (rail 268px): cùng cây, cùng tìm, bài đang xem aria-current=page");
  {
    const { c, p: r } = await open(S, 1280, `/student/bai-giang/${L["A2-1"]}`);
    await waitTree(r, "rail");
    const R = "rail";
    check("rail: chương chứa bài đang xem (Chương 2) mở sẵn, các chương khác thu", sameSet(await openIds(r, R), [CH("A2")]), await openIds(r, R));
    const cr = await r.locator(`[data-outline-variant="${R}"] [data-outline-lesson][aria-current]`).evaluateAll(els => els.map(e => [e.getAttribute("data-outline-lesson"), e.getAttribute("aria-current")]));
    check("đúng MỘT hàng aria-current='page' = bài đang xem (Bài 5)", cr.length === 1 && cr[0][0] === L["A2-1"] && cr[0][1] === "page", cr);
    const rid = await r.locator(`[data-outline-variant="${R}"] [data-outline-chapter]`).first().getAttribute("aria-controls");
    check("tiền tố id của rail là bg-cot (không trùng id với cây khác)", /^bg-cot-ch-/.test(rid ?? ""), rid);
    const col = await r.locator("#bai-giang-cot").boundingBox();
    check("cột #bai-giang-cot rộng 268px", !!col && Math.round(col.width) === 268, col);
    const ov = await r.evaluate(`(() => { const e = document.querySelector('#bai-giang-cot'); const o = document.querySelector('#bai-giang-cot [data-outline]'); return { colScroll: e.scrollWidth - e.clientWidth, treeScroll: o.scrollWidth - o.clientWidth, doc: document.documentElement.scrollWidth - innerWidth }; })()`) as any;
    // colScroll ≤ 1: bên trong cột có khung `w-[268px]` đặt trong cột 268px có viền phải 1px → dư đúng 1px bị `overflow-hidden` cắt (có sẵn từ trước BU-HS-TRANG-CHU, không nhìn thấy được).
    check("thanh bên không tràn ngang (cột ≤ 1px do viền, cây, trang)", ov.colScroll <= 1 && ov.treeScroll <= 0 && ov.doc <= 0, ov);
    const rb = r.getByRole("searchbox", { name: "Tìm bài trong lớp" });
    await rb.fill("duong thang");
    check("rail: tìm 'duong thang' cho cùng kết quả (5 bài / 2 chương), 2 chương tự mở", (await status(r, R)) === "Tìm thấy 5 bài trong 2 chương." && (await openIds(r, R)).length === 2, await status(r, R));
    await rb.fill("");
    await r.locator(`[data-outline-variant="${R}"] [data-outline-open-all]`).click();
    check("rail: Mở hết → 6 chương mở; Thu hết → 0", (await openIds(r, R)).length === 6);
    await r.locator(`[data-outline-variant="${R}"] [data-outline-close-all]`).click();
    check("rail: Thu hết → cả 6 chương aria-expanded=false", (await openIds(r, R)).length === 0);
    const rsz = await r.evaluate(`[...document.querySelectorAll('[data-outline-variant="rail"] [data-outline-chapter], [data-outline-variant="rail"] [data-outline-search], [data-outline-variant="rail"] [data-outline-open-all], [data-outline-variant="rail"] [data-outline-close-all]')].map(e => Math.round(e.getBoundingClientRect().height))`) as number[];
    check("rail: nút chương, ô tìm, Mở hết, Thu hết đều cao ≥ 44px", rsz.length === 9 && rsz.every(h => h >= 44), rsz);
    // chọn bài trong thanh bên (onSelect → router.push): đổi bài, aria-current chuyển theo, chương chứa bài mới mở
    await r.locator(`[data-outline-variant="${R}"] [data-outline-chapter="${CH("A3")}"]`).click();
    await r.locator(`[data-outline-lesson="${L["A3-2"]}"]`).click();
    await r.waitForURL(new RegExp(L["A3-2"]), { timeout: 90000 });
    await waitTree(r, "rail");
    const cr2 = await r.locator(`[data-outline-variant="${R}"] [data-outline-lesson][aria-current="page"]`).evaluateAll(els => els.map(e => e.getAttribute("data-outline-lesson")));
    check("chọn Bài 10 trong thanh bên → sang bài đó; aria-current='page' chuyển theo, chương 3 mở", cr2.length === 1 && cr2[0] === L["A3-2"] && (await openIds(r, R)).includes(CH("A3")), cr2);
    // nút ‹ › thu / mở, nhớ lựa chọn
    const tg = r.getByRole("button", { name: /danh sách bài học/ }).first();
    check("nút ‹ › có aria-expanded=true và aria-controls=bai-giang-cot", (await tg.getAttribute("aria-expanded")) === "true" && (await tg.getAttribute("aria-controls")) === "bai-giang-cot");
    await tg.click();
    await r.waitForTimeout(600);
    check("bấm thu: aria-expanded=false, cột co về 0px", (await tg.getAttribute("aria-expanded")) === "false" && Math.round((await r.locator("#bai-giang-cot").boundingBox())?.width ?? -1) === 0);
    await r.reload({ waitUntil: "networkidle" });
    await r.locator("#bai-giang-cot").waitFor({ state: "attached", timeout: 90000 });
    await r.waitForTimeout(800);
    check("tải lại: vẫn thu (nhớ ở localStorage 'lessonSidebar'), nút vẫn aria-expanded=false", (await r.evaluate(`localStorage.getItem("lessonSidebar")`)) === "0" && (await r.getByRole("button", { name: /danh sách bài học/ }).first().getAttribute("aria-expanded")) === "false");
    await r.getByRole("button", { name: /danh sách bài học/ }).first().click();
    await waitTree(r, "rail");
    await r.waitForTimeout(800); // chuyển động mở cột 250ms
    check("bấm mở lại → cột 268px, cây hiện", Math.round((await r.locator("#bai-giang-cot").boundingBox())?.width ?? -1) === 268);
    await shot(r, "lop-outline-1280-rail");
    await c.close();
  }

  // ═════════ 390 / 320 ═════════
  for (const w of [390, 320]) {
    section(`${w}px · trang lớp: thanh công cụ xếp dọc, hàng ≥ 44px, không tràn ngang, bài 200 ký tự xuống dòng`);
    const { c, p: m } = await open(S, w, `/student/hoc-tap?course=${C.id}`, 844);
    await waitTree(m, "page");
    const g = await m.evaluate(`(() => { const t = document.querySelector('[data-outline-toolbar]'); const s = t.querySelector('[data-outline-search]').getBoundingClientRect(); const a = t.querySelector('[data-outline-open-all]').getBoundingClientRect(); const b = t.querySelector('[data-outline-close-all]').getBoundingClientRect(); return { sx: s.left, sw: s.width, sh: s.height, aTop: a.top, bTop: b.top, aw: a.width, bw: b.width, h: Math.min(a.height, b.height), vw: innerWidth, sBottom: s.bottom }; })()`) as any;
    check(`${w}px: ô tìm rộng gần hết bề ngang (một cột), cao ≥ 44px`, g.sw >= g.vw - 56 && g.sh >= 44, g);
    check(`${w}px: Mở hết / Thu hết cạnh nhau, nằm DƯỚI ô tìm, mỗi nút ≥ 44px`, Math.abs(g.aTop - g.bTop) <= 1 && g.aTop >= g.sBottom - 1 && g.h >= 44 && g.aw >= 44 && g.bw >= 44, g);
    check(`${w}px: chương chứa bài kế mở sẵn, aria-expanded đúng`, sameSet(await openIds(m, "page"), [CH("A1")]));
    await m.locator(`[data-outline-variant="page"] [data-outline-open-all]`).click();
    const szm = await m.evaluate(`[...document.querySelectorAll('[data-outline] [data-outline-chapter], [data-outline] [data-outline-lesson]')].filter(e => !e.closest('[inert]')).map(e => Math.round(e.getBoundingClientRect().height))`) as number[];
    check(`${w}px: ${szm.length} hàng chương / bài đều cao ≥ 44px`, szm.length === 30 && szm.every(h => h >= 44), szm.filter(h => h < 44));
    const lgm = await m.locator(`[data-outline-lesson="${L["B3-4"]}"] [data-outline-title]`).evaluate(e => { const r = e.getBoundingClientRect(); return { h: Math.round(r.height), right: Math.round(r.right), vw: innerWidth }; });
    check(`${w}px: bài 200 ký tự xuống nhiều dòng, mép phải trong màn hình`, lgm.h >= 40 && lgm.right <= lgm.vw, lgm);
    const ind = await m.evaluate(`(() => { const L = s => Math.round(document.querySelector(s).getBoundingClientRect().left); return [L('[data-outline-section] h3 [data-outline-title]'), L('[data-outline-chapter] [data-outline-title]'), L('[data-outline-lesson] [data-outline-title]')]; })()`) as number[];
    check(`${w}px: thụt cấp phần < chương < bài (${ind.join(" < ")})`, ind[0] < ind[1] && ind[1] < ind[2], ind);
    check(`${w}px: không tràn ngang`, await m.evaluate(NOT_OVERFLOW) as boolean);
    await m.getByRole("searchbox", { name: "Tìm bài trong lớp" }).fill("duong thang");
    check(`${w}px: tìm 'duong thang' ra 5 bài / 2 chương, không tràn ngang`, (await status(m, "page")) === "Tìm thấy 5 bài trong 2 chương." && (await m.evaluate(NOT_OVERFLOW) as boolean));
    // ô tìm dính đầu vùng nội dung khi cuộn (sticky) — đo vị trí sau khi cuộn xuống giữa cây
    await m.getByRole("searchbox", { name: "Tìm bài trong lớp" }).fill("");
    await m.locator(`[data-outline-variant="page"] [data-outline-open-all]`).click();
    await m.evaluate(`window.scrollTo(0, document.querySelector('[data-outline-lesson="${L["B1-2"]}"]').getBoundingClientRect().top + scrollY - 300)`);
    await m.waitForTimeout(300);
    const st = await m.locator(`[data-outline-variant="page"] [data-outline-toolbar]`).evaluate(e => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight }; });
    check(`${w}px: sau khi cuộn sâu, thanh công cụ (ô tìm + 2 nút) vẫn nằm trong khung nhìn (dính đầu)`, st.top >= -1 && st.top < 120 && st.bottom <= st.vh, st);
    if (w === 390) await shot(m, "lop-outline-390-page");
    await c.close();
  }

  section("390px · thanh bên bài giảng thành tờ trượt 'Nội dung khóa học' (sheet): nút nổi, ô tìm dính đầu, chọn bài → tờ đóng và sang bài");
  {
    const { c, p: s } = await open(S, 390, `/student/bai-giang/${L["A2-1"]}`, 844);
    await s.getByRole("button", { name: "Danh sách bài học" }).waitFor({ timeout: 90000 });
    check("không có thanh bên (rail) NHÌN THẤY ở 390px (DOM có nhưng ẩn bằng CSS); nút nổi 'Danh sách bài học' ≥ 44px", !(await s.locator(`[data-outline-variant="rail"]`).first().isVisible()) && ((await s.getByRole("button", { name: "Danh sách bài học" }).boundingBox())?.height ?? 0) >= 44);
    await s.getByRole("button", { name: "Danh sách bài học" }).click();
    await waitTree(s, "sheet");
    check("tờ trượt hiện cây (variant=sheet), tiền tố id bg-to, chương chứa bài đang xem mở sẵn", sameSet(await openIds(s, "sheet"), [CH("A2")]) && /^bg-to-ch-/.test((await s.locator(`[data-outline-variant="sheet"] [data-outline-chapter]`).first().getAttribute("aria-controls")) ?? ""));
    const sb = await s.locator(`[data-outline-variant="sheet"] [data-outline-search]`).boundingBox();
    check("ô tìm trong tờ cao ≥ 44px", (sb?.height ?? 0) >= 44, sb);
    check("không tràn ngang khi mở tờ", await s.evaluate(NOT_OVERFLOW) as boolean);
    await s.getByRole("searchbox", { name: "Tìm bài trong lớp" }).fill("duong thang");
    check("tờ: tìm 'duong thang' → 5 bài / 2 chương", (await status(s, "sheet")) === "Tìm thấy 5 bài trong 2 chương.", await status(s, "sheet"));
    await shot(s, "lop-outline-390-sheet");
    await s.locator(`[data-outline-variant="sheet"] [data-outline-lesson="${L["A2-2"]}"]`).click();
    await s.waitForURL(new RegExp(L["A2-2"]), { timeout: 90000 });
    check("chọn Bài 6 → sang bài đó và tờ trượt tự đóng", (await s.locator(`[data-outline-variant="sheet"]`).count()) === 0);
    await c.close();
  }

  section("Ba trạng thái: lớp 0 bài · lỗi tải (+ Thử lại) · đang tải");
  {
    const E = await mkCourse(T.id, { name: "Lớp trống bài" });
    await prisma.enrollment.create({ data: { userId: S.id, courseId: E.id, status: "active" } });
    const { c, p: e } = await open(S, 1280, `/student/hoc-tap?course=${E.id}`);
    await e.getByText("Lớp chưa có bài học nào").waitFor({ timeout: 90000 });
    check("lớp 0 bài: 'Lớp chưa có bài học nào' kèm lời giải thích, không có cây", await e.getByText("Khi gia sư đăng bài học, danh sách sẽ hiện ở đây.").isVisible() && (await e.locator("[data-outline]").count()) === 0);
    await c.close();
  }
  {
    const c = await ctxFor(S, { width: 1280, height: 900, rail: "mo" }); const e = await c.newPage(); watch(e);
    let fail = true, delay = 0;
    await e.route(`**/api/courses/${C.id}`, async route => {
      if (delay) await new Promise(r => setTimeout(r, delay));
      if (fail) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "x" }) });
      return route.continue();
    });
    await e.goto(`${BASE}/student/hoc-tap?course=${C.id}`, { waitUntil: "domcontentloaded", timeout: 240000 });
    const retry = e.getByRole("button", { name: "Thử lại" }).first();
    await retry.waitFor({ timeout: 90000 });
    check("lỗi tải lớp: có thông báo lỗi và nút 'Thử lại' bấm được (cao ≥ 44px); không có cây", ((await retry.boundingBox())?.height ?? 0) >= 44 && (await e.locator("[data-outline]").count()) === 0);
    fail = false; delay = 2500;
    await retry.click();
    await e.waitForTimeout(500);
    const busy = await e.locator("[aria-busy=true]").count();
    check("sau 'Thử lại' trong lúc chờ: có khung xương (aria-busy), chưa hiện cây", busy >= 1 && (await e.locator("[data-outline]").count()) === 0, busy);
    await waitTree(e, "page");
    check("tải xong: cây hiện, khung xương biến mất", (await e.locator("[aria-busy=true]").count()) === 0 && (await e.locator("[data-outline] [data-outline-chapter]").count()) === 6);
    await c.close();
  }

  check("không có pageerror / console.error", errors.length === 0, errors.slice(0, 5));
  await Promise.race([closeAll(), new Promise(r => setTimeout(r, 15000))]);
  await done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
