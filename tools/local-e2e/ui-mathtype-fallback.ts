// BU-03-MATHTYPE — GIAO DIỆN THẬT cho đường ảnh dự phòng + ảnh chụp cho chủ nhìn bằng mắt (390px và 1280px).
// (a) Nhập Word, xem trước De_Toan12_GK1_Azota.docx đường bình thường (công thức KaTeX);
// (b) cùng đề nhưng phá .bin của một số công thức (ảnh WMF còn) → xem trước thấy <img> công thức, cờ formula_image, lưu → mở lại trong ngân hàng thấy ảnh.
// Cần máy chủ dev (BASE) + DB RIÊNG; wipe() ở đầu bài. Ảnh lưu vào $SHOTS (mặc định scratchpad/shots). Bỏ qua nếu thiếu tệp ~/Downloads/De_Toan12_GK1_Azota.docx.
import JSZip from "jszip";
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { mkTutor, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { mkTree } from "./bu03";

const FILE = `${homedir()}/Downloads/De_Toan12_GK1_Azota.docx`;
const NH = "/lop-cua-toi/de-thi/ngan-hang-cau-hoi";

(async () => {
  if (!existsSync(FILE)) { console.log("  – SKIP: không có " + FILE); process.exit(0); }
  await wipe();
  const A = await mkTutor("Cô An");
  const tree = await mkTree();
  const good = readFileSync(FILE);
  const z = await JSZip.loadAsync(good);
  const bs = Object.keys(z.files).filter(n => /^word\/embeddings\/oleObject\d+\.bin$/.test(n)).sort();
  let broken = 0;
  for (const n of bs) { const num = Number(n.match(/(\d+)\.bin$/)![1]); if (num % 25 === 0) { z.file(n, Buffer.from("KHONG-PHAI-OLE-CFB-" + n)); broken++; } }
  const dir = mkdtempSync(join(tmpdir(), "kin-mt-"));
  const badPath = join(dir, "De_Toan12_du_phong_anh.docx");
  writeFileSync(badPath, await z.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => {
    p.on("pageerror", (e: unknown) => errors.push(String(e)));
    p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|Encountered a script tag/i.test(m.text())) errors.push(m.text()); });
  };
  const noOverflow = (p: any) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

  for (const [W, H] of [[1280, 900], [390, 844]] as const) {
    const ctx = await ctxFor(A, { width: W, height: H, rail: "mac-dinh" });
    const pg = await ctx.newPage(); watch(pg);
    const read = async (path: string) => {
      await pg.goto(`${BASE_URL()}${NH}/nhap-word?nut=${tree.c11}`, { waitUntil: "networkidle", timeout: 120000 });
      await pg.locator('input[type="file"][accept=".docx"]').setInputFiles(path);
      await pg.getByRole("button", { name: "Đọc tệp và xem lại" }).click();
      await pg.getByText("22 câu đã đọc").waitFor({ timeout: 90000 });
    };

    section(`${W}px (a) đường bình thường: công thức KaTeX`);
    await read(FILE);
    const katexN = await pg.locator(".katex").count(), imgN = await pg.locator('img[alt="công thức (ảnh)"]').count();
    check(`${W}px bình thường: có KaTeX (${katexN}), 0 ảnh công thức (${imgN})`, katexN > 20 && imgN === 0);
    check(`${W}px bình thường: không tràn ngang`, await noOverflow(pg));
    await shot(pg, `a-nhap-word-binh-thuong-${W}`);

    section(`${W}px (b) đường dự phòng ảnh: phá ${broken} .bin`);
    await read(badPath);
    const imgs = await pg.locator('img[alt="công thức (ảnh)"]').count();
    check(`${W}px dự phòng: thấy <img> công thức (${imgs}), không chuỗi ctimg thô`, imgs >= 1 && !/ctimg/.test(await pg.locator("main").innerText()));
    check(`${W}px dự phòng: có cờ 'hiện bằng ảnh'`, await pg.getByText(/hiện bằng ảnh — cô có thể sửa thành LaTeX/).first().isVisible());
    check(`${W}px dự phòng: không có cờ đỏ 'Còn công thức chưa đọc được'`, await pg.getByText("Còn công thức chưa đọc được").count() === 0);
    const ovf = await noOverflow(pg);
    check(`${W}px dự phòng: không tràn ngang`, ovf, await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, off: [...document.querySelectorAll<HTMLElement>("main *")].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 4).map(e => e.tagName + " r=" + Math.round(e.getBoundingClientRect().right) + " " + (e.textContent || "").slice(0, 40)) })));
    await shot(pg, `b-nhap-word-du-phong-anh-${W}`);

    if (W === 1280) {
      section("lưu → mở lại thấy ảnh");
      const sels = pg.locator("main select");
      for (let i = 0, n = await sels.count(); i < n; i++) { const sel = sels.nth(i); if ((await sel.locator('option[value="NB"]').count()) && (await sel.inputValue()) === "") await sel.selectOption("NB"); }
      await pg.waitForTimeout(500);
      const saveBtn = pg.getByRole("button", { name: /^Lưu \d+ câu vào ngân hàng/ });
      check("nút Lưu bật được (cờ ảnh không chặn)", await saveBtn.isEnabled());
      await saveBtn.click();
      await pg.getByText(/Đã lưu \d+ câu vào ngân hàng/).waitFor({ timeout: 60000 });
      check("báo đã lưu", true);
      await shot(pg, `b-da-luu-${W}`);
      await pg.goto(`${BASE_URL()}${NH}/${tree.c11}`, { waitUntil: "networkidle", timeout: 120000 });
      await pg.getByText("Tự chọn câu hỏi", { exact: true }).first().click();
      await pg.waitForLoadState("networkidle");
      await pg.waitForTimeout(3500);
      const imgsBank = await pg.locator('img[alt="công thức (ảnh)"]').count();
      check(`mở lại ngân hàng: thấy ảnh công thức (${imgsBank})`, imgsBank >= 1);
      await shot(pg, `b-mo-lai-ngan-hang-${W}`);
    }
    await ctx.close();
  }
  check("không lỗi JS / console.error", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})();

function BASE_URL() { return process.env.BASE!; }
