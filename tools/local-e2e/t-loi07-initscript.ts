// LOI-07: kiểm thay đổi toàn cục src/components/InitScript.tsx + app/layout.tsx — bốn script khởi tạo (chủ đề, thanh bên, vỏ, tên miền) vẫn CHẠY trước khi vẽ
// ở mọi vai, và không có cảnh báo hydrate / "script tag" trong console, kể cả trang 404 trong nhóm gia sư.
// Ca phá cố ý: bộ lọc cảnh báo phải bắt đúng câu React thật "Encountered a script tag while rendering React component" (kiểm ngay đầu bài).
const BAD_RE = /hydrat|script tag|did not match|Minified React/i;
import { BASE, mkUser, mkTutor, wipe, check, section, done } from "./h";
import { launch, ctxFor, closeAll } from "./ui";

(async () => {
  check("phá: bộ lọc bắt câu cảnh báo script tag thật, không bắt dòng log thường", BAD_RE.test("Encountered a script tag while rendering React component. Scripts inside React components are never executed") && !BAD_RE.test("GET /api/tutors 200"));
  await wipe();
  const S = await mkUser({ name: "Em Khởi Tạo" }), T = await mkTutor("Cô Khởi Tạo");
  await launch();
  const roles: [string, typeof S | null][] = [["khách", null], ["học sinh", S], ["gia sư", T]];
  for (const [name, u] of roles) {
    section(`Script khởi tạo — ${name}`);
    const c = await ctxFor(u, { width: 1280, height: 900, rail: "rong" });
    await c.addInitScript(`try{localStorage.setItem("kin.che-do","toi")}catch(e){}`);
    const p = await c.newPage();
    const bad: string[] = [];
    p.on("console", m => { if (m.type() === "error" || m.type() === "warning") { const t = m.text(); if (BAD_RE.test(t)) bad.push(t.slice(0, 200)); } });
    p.on("pageerror", e => bad.push("pageerror " + String(e).slice(0, 200)));
    for (const path of ["/", name === "gia sư" ? "/lop-cua-toi/x" : name === "học sinh" ? "/student/viec-cua-toi" : "/khoa-hoc"]) {
      await p.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 240000 });
      const early = await p.evaluate(`({ scripts: document.querySelectorAll("body > script:not([src])").length, rail: document.documentElement.getAttribute("data-kin-rail"), mode: document.documentElement.getAttribute("data-che-do") })`) as { scripts: number; rail: string | null; mode: string | null };
      await p.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
      await p.waitForTimeout(800);
      check(`${name} ${path}: có ≥ 4 thẻ script khởi tạo trong body, không có cảnh báo hydrate / script tag`, early.scripts >= 4 && bad.length === 0, { early, bad });
      // Script THẬT SỰ chạy trước khi vẽ: ở DOMContentLoaded, chế độ tối (đặt trong localStorage) và bề rộng thanh bên (rail "rong") đã nằm trên <html>.
      // Trang 404 trong nhóm gia sư: Next dựng lại cả tài liệu (<html id="__next_error__">) — đo cùng kết quả với layout CŨ trước LOI-07 (mode=null rail=null lúc đầu), nên chỉ kiểm
      // chế độ tối được áp sau khi tải xong (ThemeApplier); các trang còn lại phải có thuộc tính ngay ở DOMContentLoaded.
      if (path === "/lop-cua-toi/x") check(`${name} ${path} (404 dựng lại tài liệu, như trước LOI-07): chế độ tối được áp sau khi tải`, (await p.evaluate(`document.documentElement.getAttribute("data-che-do")`)) === "toi");
      else check(`${name} ${path}: ngay lúc DOMContentLoaded <html> đã có data-che-do="toi" và data-kin-rail="rong" (không nháy nền sáng)`, early.mode === "toi" && early.rail === "rong", early);
    }
    await c.close();
  }
  {
    // Ca phá cố ý: giá trị rác trong localStorage KHÔNG được đặt data-che-do — chứng minh ca trên đo đúng việc script chạy, không phải thuộc tính có sẵn.
    const c = await ctxFor(null, { width: 1280, height: 900, rail: "rong" });
    await c.addInitScript(`try{localStorage.setItem("kin.che-do","rac")}catch(e){}`);
    const p = await c.newPage();
    await p.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 240000 });
    check("phá: chế độ rác ⇒ <html> giữ mặc định 'sang', KHÔNG thành 'toi' (ca đo thật sự phân biệt được)", (await p.evaluate(`document.documentElement.getAttribute("data-che-do")`)) === "sang");
    await c.close();
  }
  await closeAll();
  await done();
})();
