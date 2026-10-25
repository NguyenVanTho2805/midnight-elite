// Bộ component KiN — kiểm tra tĩnh trên mã nguồn (không cần máy chủ): xuất đủ component, không còn nút đỏ viết tay,
// không còn chữ nhỏ hơn 11,1px (sàn cỡ chữ của Figma), không còn window.confirm ở màn gia sư, token bóng/lớp phủ đủ ở cả hai nơi khai báo.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { check, section, done } from "./h";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");
const walk = (d: string, out: string[] = []) => { for (const n of readdirSync(join(ROOT, d))) { const p = join(d, n); if (statSync(join(ROOT, p)).isDirectory()) walk(p, out); else out.push(p); } return out; };
const src = walk("src").filter(p => /\.(tsx?|css)$/.test(p));

(async () => {
  section("Xuất component");
  const idx = read("src/components/kin/index.ts");
  for (const n of ["KinButton", "kinButtonClass", "KinStatus", "KinTabs", "KinTabInner", "KIN_TAB_BOX", "KinToast", "KinConfirm"]) check(`index.ts xuất ${n}`, new RegExp(`\\b${n}\\b`).test(idx));
  const btn = read("src/components/kin/Button.tsx");
  for (const v of ["primary", "secondary", "ghost", "danger", "danger-solid"]) check(`KinButton có kiểu "${v}"`, new RegExp(`["']?${v}["']?\\s*[:|,]|"${v}"`).test(btn));
  check("KinButton không còn vòng xoay (Figma: dùng chữ, không spinner)", !/animate-spin/.test(btn));
  const site0 = read("src/app/kin-site.css");
  check("KinButton: chạm tối thiểu 44px, vòng focus 2px; Tắt mờ 45% / focus offset 0 / con trỏ chờ đặt trong kin-site.css (thắng quy tắc chung không-layer)", /--kin-cham-toi-thieu/.test(btn) && /focus-visible:outline-2/.test(btn) && /\[data-kin-nut\]:disabled\s*\{\s*opacity:\s*0\.45/.test(site0) && /\[data-kin-nut\]:focus-visible\s*\{\s*outline-offset:\s*0/.test(site0) && /\[data-kin-nut\]\[aria-busy="true"\]:disabled\s*\{\s*cursor:\s*progress/.test(site0));
  check("globals.css: vòng focus chung không còn ép border-radius 4px", !/:focus-visible\s*\{[^}]*border-radius/.test(read("src/app/globals.css")));
  check("KinButton không đặt type mặc định (giữ hành vi cũ trong <form>)", !/type\s*=\s*"button"/.test(btn.split("forwardRef")[1] ?? ""));

  section("Không còn mã viết tay thay cho component");
  const tsx = src.filter(p => p.endsWith(".tsx"));
  const hackRed = tsx.filter(p => /<KinButton[^>]*style=\{\{[^}]*--kin-tt-chu-loi/.test(read(p)));
  check("không còn KinButton tô đỏ bằng style inline (dùng variant danger / danger-solid)", hackRed.length === 0, hackRed);
  const outlook = read("src/components/kin/shell/Outlook.tsx");
  check("Outlook: nút lệnh dùng KinButton/kinButtonClass, thẻ trạng thái dùng KinStatus (không còn BTN/DOT/TEXT riêng)", /KinButton/.test(outlook) && /kinButtonClass/.test(outlook) && /KinStatus/.test(outlook) && !/const BTN\b|const DOT\b|const TEXT\b/.test(outlook));
  check("Outlook: Command có kiểu 'danger'", /kind: "primary" \| "secondary" \| "danger"/.test(outlook));
  check("AdminShell: tab trang con dùng KIN_TAB_BOX + KinTabInner", /KIN_TAB_BOX/.test(read("src/components/admin/AdminShell.tsx")) && /KinTabInner/.test(read("src/components/admin/AdminShell.tsx")));
  check("Admin Kiểm duyệt: khung hỏi lại dùng KinButton, 'danger' từ hàng chờ được chuyển thành nút đỏ", /KinButton/.test(read("src/components/admin/KiemDuyet.tsx")) && /danger-solid/.test(read("src/components/admin/KiemDuyet.tsx")));
  // 24/10/2026 (QT-02): quan-tri-vien/page.tsx bỏ tab "Hồ sơ gia sư chờ duyệt" (duyệt gia sư chỉ còn một cửa: hàng chờ kiểm duyệt) nên không còn KinTabs; thay bằng ô kiểm không tự viết role="tab".
  check("quan-tri-vien/page.tsx: không tự viết role=\"tab\"", !/role="tab"/.test(read("src/app/(admin)/admin/quan-tri-vien/page.tsx")));
  for (const f of ["src/components/admin/TutorApplicationsPanel.tsx", "src/app/lop-cua-toi/(tutor)/hoc-phi/HocPhiClient.tsx", "src/app/lop-cua-toi/(tutor)/ke-hoach-buoi/[id]/KeHoachEditorClient.tsx"])
    check(`${f.split("/").slice(-2).join("/")}: tab dùng KinTabs (không tự viết role="tab")`, /KinTabs/.test(read(f)) && !/role="tab"/.test(read(f)));
  check("ToastProvider hiển thị bằng KinToast, có toast.warn + dòng phụ", /KinToast/.test(read("src/components/ui/Toast.tsx")) && /warn:/.test(read("src/components/ui/Toast.tsx")) && /detail/.test(read("src/components/ui/Toast.tsx")));
  check("ConfirmModal cũ chỉ còn là lớp bọc KinConfirm", /KinConfirm/.test(read("src/components/ui/ConfirmModal.tsx")) && !/fixed inset-0/.test(read("src/components/ui/ConfirmModal.tsx")));
  check("tutor Badge dùng KinStatus", /KinStatus/.test(read("src/components/tutor/shared.tsx")));
  for (const f of ["src/components/tutor/ClassInvites.tsx", "src/app/lop-cua-toi/(tutor)/kiem-duyet/KiemDuyetClient.tsx", "src/app/lop-cua-toi/(tutor)/ke-hoach-buoi/[id]/KeHoachEditorClient.tsx"])
    check(`${f.split("/").pop()}: xác nhận việc không hoàn tác bằng KinConfirm nguy hiểm, không window.confirm`, /<KinConfirm/.test(read(f)) && /tone="nguy-hiem"/.test(read(f)) && !/window\.confirm|[^.\w]confirm\(/.test(read(f)));

  const raw = src.filter(f => /\.tsx?$/.test(f) && !f.includes("/generated/")).filter(f => /window\.confirm|(^|[^.\w])confirm\(/.test(read(f).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")));
  check("toàn bộ mã nguồn không còn window.confirm / confirm() — mọi hỏi lại đi qua KinConfirm", raw.length === 0, raw);
  check("useKinConfirm được xuất ở index.ts và trả { ask, dialog }", /useKinConfirm/.test(idx) && /dialog/.test(read("src/components/kin/useConfirm.tsx")) && /Promise<boolean>/.test(read("src/components/kin/useConfirm.tsx")));
  for (const f of ["src/app/(student)/student/bai-giang/[lessonId]/page.tsx", "src/app/(admin)/admin/thi-thu/page.tsx", "src/app/(admin)/admin/thi-thu/ngan-hang-de-thi/page.tsx", "src/app/(admin)/admin/khoa-hoc/[id]/page.tsx", "src/app/(admin)/admin/danh-gia/page.tsx"]) {
    const t = read(f), asks = (t.match(/await ask\(/g) ?? []).length, dialogs = (t.match(/\{dialog\}/g) ?? []).length, hooks = (t.match(/useKinConfirm\(\)/g) ?? []).length;
    check(`${f.split("/").slice(-2).join("/")}: dùng useKinConfirm (${asks} lần hỏi, ${hooks} hook, ${dialogs} hộp) — mỗi thành phần có hook thì có đúng một {dialog}`, asks >= 1 && hooks >= 1 && hooks === dialogs, { asks, hooks, dialogs });
  }

  section("Sàn cỡ chữ 11,1px (--kin-co-caption)");
  const small: string[] = [];
  for (const p of tsx) {
    read(p).split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) if (parseFloat(m[1]) < 11.1) small.push(`${p}:${i + 1} text-[${m[1]}px]`);
      for (const m of line.matchAll(/fontSize:\s*"?(\d+(?:\.\d+)?)(?:px)?"?/g)) if (parseFloat(m[1]) < 11.1 && parseFloat(m[1]) > 0 && !/lineHeight|opacity|zIndex/.test(line.slice(Math.max(0, (m.index ?? 0) - 12), m.index))) small.push(`${p}:${i + 1} fontSize ${m[1]}`);
    });
  }
  check("không còn chữ nhỏ hơn 11,1px trong .tsx", small.length === 0, small.slice(0, 8));

  section("Token bóng / lớp phủ");
  const site = read("src/app/kin-site.css");
  const derived = site.slice(site.indexOf(':root, [data-vung="sang"] {'));
  for (const t of ["--kin-bong-toast", "--kin-bong-hop", "--kin-phu-hop"]) check(`${t} khai báo trong khối :root, [data-vung="sang"]`, derived.includes(`${t}:`));
  check("Toast/Confirm dùng token, không còn rgba viết tay trong component", !/rgba?\(/.test(read("src/components/kin/Toast.tsx")) && !/rgba?\(/.test(read("src/components/kin/Confirm.tsx")));

  await done();
})();
