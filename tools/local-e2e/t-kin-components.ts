// Bộ component KiN — kiểm tra tĩnh trên mã nguồn (không cần máy chủ): xuất đủ component, không còn nút đỏ viết tay,
// không còn chữ nhỏ hơn 11,1px (sàn cỡ chữ của Figma), không còn window.confirm ở màn gia sư, token bóng/lớp phủ đủ ở cả hai nơi khai báo.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { check, section, done } from "./h";
import { kinRequiredCheckValue, kinUncontrolledAdjust } from "@/components/kin/KinSelect";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");
const walk = (d: string, out: string[] = []) => { for (const n of readdirSync(join(ROOT, d))) { const p = join(d, n); if (statSync(join(ROOT, p)).isDirectory()) walk(p, out); else out.push(p); } return out; };
const src = walk("src").filter(p => /\.(tsx?|css)$/.test(p));

(async () => {
  section("Xuất component");
  const idx = read("src/components/kin/index.ts");
  for (const n of ["KinButton", "kinButtonClass", "KinStatus", "KinTabs", "KinTabInner", "KIN_TAB_BOX", "KinToast", "KinConfirm"]) check(`index.ts xuất ${n}`, new RegExp(`\\b${n}\\b`).test(idx));
  // 31/10/2026 (BU-00 sửa sau test): lớp CSS + kinButtonClass() tách sang buttonClass.ts (module thuần, không "use client") để trang máy chủ gọi được;
  // Button.tsx chỉ còn component. Kiểm kiểu nút / chạm 44px / focus trên CẢ HAI tệp.
  const btn = read("src/components/kin/Button.tsx") + "\n" + read("src/components/kin/buttonClass.ts");
  for (const v of ["primary", "secondary", "ghost", "danger", "danger-solid"]) check(`KinButton có kiểu "${v}"`, new RegExp(`["']?${v}["']?\\s*[:|,]|"${v}"`).test(btn));
  check("KinButton không còn vòng xoay (Figma: dùng chữ, không spinner)", !/animate-spin/.test(btn));
  const site0 = read("src/app/kin-site.css");
  check("KinButton: chạm tối thiểu 44px, vòng focus 2px; Tắt màu đặc (SCL5, không mờ opacity) / focus offset 0 / con trỏ chờ đặt trong kin-site.css (thắng quy tắc chung không-layer)", /--kin-cham-toi-thieu/.test(btn) && /focus-visible:outline-2/.test(btn) && /\[data-kin-nut\]:disabled:not\(\[aria-busy="true"\]\)\s*\{\s*opacity:\s*1;\s*background:\s*var\(--kin-nen-bang\);\s*color:\s*var\(--kin-chu-phu\)/.test(site0) && /\[data-kin-nut\]:focus-visible\s*\{\s*outline-offset:\s*0/.test(site0) && /\[data-kin-nut\]\[aria-busy="true"\]:disabled\s*\{\s*cursor:\s*progress/.test(site0));
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
  // BU-08: KiemDuyet.tsx nay chỉ re-export; khung xác nhận nội dòng nằm ở queue/QueuePanel.tsx (+ HangCho.tsx dựng bảng).
  const qp = read("src/components/admin/queue/QueuePanel.tsx"), hc = read("src/components/admin/HangCho.tsx");
  check("Admin Hàng chờ: khung xác nhận nội dòng dùng KinButton, 'danger' từ hàng chờ được chuyển thành nút đỏ (queue/QueuePanel.tsx, HangCho.tsx)", /KinButton/.test(qp) && /danger-solid/.test(qp) && /KinButton/.test(hc));
  // 24/10/2026 (QT-02): quan-tri-vien/page.tsx bỏ tab "Hồ sơ gia sư chờ duyệt" (duyệt gia sư chỉ còn một cửa: hàng chờ kiểm duyệt) nên không còn KinTabs; thay bằng ô kiểm không tự viết role="tab".
  check("quan-tri-vien/page.tsx: không tự viết role=\"tab\"", !/role="tab"/.test(read("src/app/(admin)/admin/quan-tri-vien/page.tsx")));
  for (const f of ["src/app/lop-cua-toi/(tutor)/hoc-phi/HocPhiClient.tsx", "src/app/lop-cua-toi/(tutor)/ke-hoach-buoi/[id]/KeHoachEditorClient.tsx"])
    check(`${f.split("/").slice(-2).join("/")}: tab dùng KinTabs (không tự viết role="tab")`, /KinTabs/.test(read(f)) && !/role="tab"/.test(read(f)));
  check("ToastProvider hiển thị bằng KinToast, có toast.warn + dòng phụ", /KinToast/.test(read("src/components/kin/ToastProvider.tsx")) && /warn:/.test(read("src/components/kin/ToastProvider.tsx")) && /detail/.test(read("src/components/kin/ToastProvider.tsx")));
  // SCL-F2 (P2-29): một hệ toast, một hệ hộp xác nhận — src/components/ui/* (ConfirmModal, Toast cũ…) đã xoá; AdminToast chỉ còn là lớp chuyển sang useToast.
  check("src/components/ui/ không còn (ConfirmModal, Toast cũ đã gỡ)", !existsSync(join(ROOT, "src/components/ui")));
  check("AdminToast không tự vẽ toast riêng, đi qua useToast (KinToast)", /useToast/.test(read("src/components/AdminToast.tsx")) && !/fixed top-4/.test(read("src/components/AdminToast.tsx")));
  check("tutor Badge dùng KinStatus", /KinStatus/.test(read("src/components/tutor/shared.tsx")));
  for (const f of ["src/components/tutor/ClassInvites.tsx", "src/app/lop-cua-toi/(tutor)/kiem-duyet/KiemDuyetClient.tsx", "src/app/lop-cua-toi/(tutor)/ke-hoach-buoi/[id]/KeHoachEditorClient.tsx"])
    check(`${f.split("/").pop()}: xác nhận việc không hoàn tác bằng KinConfirm nguy hiểm, không window.confirm`, /<KinConfirm/.test(read(f)) && /tone="nguy-hiem"/.test(read(f)) && !/window\.confirm|[^.\w]confirm\(/.test(read(f)));

  // LOI-07: `confirm(` trần chỉ là hộp thoại trình duyệt khi tệp KHÔNG tự khai báo hàm tên `confirm` (SignupCodeForm có `async function confirm()` = gửi mã xác thực email).
  const usesBrowserConfirm = (text: string): boolean => {
    const t = text.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    if (/window\.confirm|globalThis\.confirm/.test(t)) return true;
    const localDecl = /(?:\bfunction\s+confirm\s*\(|\b(?:const|let|var)\s+confirm\s*=)/.test(t);
    return !localDecl && /(^|[^.\w])confirm\(/m.test(t);
  };
  check("phá: confirm() trần không có hàm cùng tên trong tệp → bị bắt", usesBrowserConfirm(`function X() { if (confirm("Xoá?")) del(); }`));
  check("phá: window.confirm vẫn bị bắt kể cả khi tệp có hàm tên confirm", usesBrowserConfirm(`async function confirm() {} \n if (window.confirm("x")) go();`));
  check("hàm tự khai báo tên confirm (gửi mã) không bị coi là hộp thoại trình duyệt", !usesBrowserConfirm(`async function confirm(v = c) { await post(); } \n onComplete={v => { void confirm(v); }}`));
  const raw = src.filter(f => /\.tsx?$/.test(f) && !f.includes("/generated/")).filter(f => usesBrowserConfirm(read(f)));
  check("toàn bộ mã nguồn không còn window.confirm / confirm() — mọi hỏi lại đi qua KinConfirm", raw.length === 0, raw);
  check("useKinConfirm được xuất ở index.ts và trả { ask, dialog }", /useKinConfirm/.test(idx) && /dialog/.test(read("src/components/kin/useConfirm.tsx")) && /Promise<boolean>/.test(read("src/components/kin/useConfirm.tsx")));
  // LOI-07: từ BU-HS-NOP-TEP (9f91b824) khối nộp bài của trang bài học là <NopTepBox>, câu hỏi "Nộp lại bài đã chấm?" chuyển theo vào đó
  // (trang bài học không còn hỏi gì). Kiểm câu hỏi ở chỗ nó đang sống, và trang bài học thật sự dùng NopTepBox.
  const ntb = read("src/components/student/nop-tep/NopTepBox.tsx");
  check("NopTepBox: hỏi lại bằng useKinConfirm trước khi nộp lại bài đã chấm (đúng một {dialog} cho mỗi hook)", /ask\(\{\s*title:\s*"Nộp lại bài đã chấm\?"/.test(ntb) && (ntb.match(/useKinConfirm\(\)/g) ?? []).length === (ntb.match(/\{dialog\}/g) ?? []).length, { hooks: (ntb.match(/useKinConfirm\(\)/g) ?? []).length, dialogs: (ntb.match(/\{dialog\}/g) ?? []).length });
  check("student/bai-giang/[lessonId]: phần nộp bài dùng <NopTepBox>", /<NopTepBox\b/.test(read("src/app/(student)/student/bai-giang/[lessonId]/page.tsx")));
  for (const f of ["src/app/(admin)/admin/thi-thu/page.tsx", "src/app/(admin)/admin/thi-thu/ngan-hang-de-thi/page.tsx"]) { // SCL-F2: admin/khoa-hoc/[id] bỏ phần soạn (không còn hỏi xoá)
    const t = read(f), asks = (t.match(/await ask\(/g) ?? []).length, dialogs = (t.match(/\{dialog\}/g) ?? []).length, hooks = (t.match(/useKinConfirm\(\)/g) ?? []).length;
    check(`${f.split("/").slice(-2).join("/")}: dùng useKinConfirm (${asks} lần hỏi, ${hooks} hook, ${dialogs} hộp) — mỗi thành phần có hook thì có đúng một {dialog}`, asks >= 1 && hooks >= 1 && hooks === dialogs, { asks, hooks, dialogs });
  }
  // BU-08: danh-gia dùng xác nhận NỘI DÒNG (confirmId) thay cho useKinConfirm/hộp thoại — kiểm đúng điều đó, và không có window.confirm.
  const dg = read("src/app/(admin)/admin/danh-gia/page.tsx");
  check("danh-gia/page.tsx: xác nhận xoá nội dòng (confirmId), không useKinConfirm, không window.confirm", /confirmId/.test(dg) && !/useKinConfirm|window\.confirm|[^.\w]confirm\(/.test(dg));

  section("Sàn cỡ chữ 11,1px (--kin-co-caption)");
  const small: string[] = [];
  for (const p of tsx) {
    read(p).split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) if (parseFloat(m[1]) < 11.1) small.push(`${p}:${i + 1} text-[${m[1]}px]`);
      for (const m of line.matchAll(/fontSize:\s*"?(\d+(?:\.\d+)?)(?:px)?"?/g)) if (parseFloat(m[1]) < 11.1 && parseFloat(m[1]) > 0 && !/lineHeight|opacity|zIndex/.test(line.slice(Math.max(0, (m.index ?? 0) - 12), m.index))) small.push(`${p}:${i + 1} fontSize ${m[1]}`);
    });
  }
  check("không còn chữ nhỏ hơn 11,1px trong .tsx", small.length === 0, small.slice(0, 8));

  // LOI-02 (11/11/2026) mục 2.G: ô chọn KinSelect thay <select> gốc ở màn gia sư (Học sinh, panel bài, Cài đặt lớp).
  section("KinSelect (LOI-02)");
  const ks = read("src/components/kin/KinSelect.tsx");
  check("KinSelect: nút role=combobox + aria-haspopup=listbox + aria-expanded + aria-controls + aria-activedescendant",
    /role="combobox"/.test(ks) && /aria-haspopup="listbox"/.test(ks) && /aria-expanded=\{open\}/.test(ks) && /aria-controls=\{listId\}/.test(ks) && /aria-activedescendant=/.test(ks));
  check("KinSelect: danh sách role=listbox, mục role=option có aria-selected / aria-disabled", /role="listbox"/.test(ks) && /role="option"/.test(ks) && /aria-selected=\{on\}/.test(ks) && /aria-disabled=/.test(ks));
  check("KinSelect: bàn phím ↑ ↓ Home End Enter Esc Tab + gõ chữ (so không dấu)",
    ["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Escape", "Tab"].every(k => ks.includes(`"${k}"`)) && /typeahead\(/.test(ks) && /normalize\("NFD"\)/.test(ks));
  check("KinSelect: ô tìm khi > 8 lựa chọn (ngưỡng 9) + chữ \"Không có lựa chọn khớp\"", /KIN_SELECT_SEARCH_MIN = 9/.test(ks) && /options\.length >= KIN_SELECT_SEARCH_MIN/.test(ks) && ks.includes("Không có lựa chọn khớp"));
  check("KinSelect: nút và mỗi mục cao ≥ 44px (--kin-cham-toi-thieu), danh sách max-height min(320px, 50vh), không rộng quá khung nhìn",
    (ks.match(/min-h-\[var\(--kin-cham-toi-thieu\)\]/g) ?? []).length >= 3 && ks.includes('maxHeight: "min(320px, 50vh)"') && ks.includes("max-w-[calc(100vw-2rem)]"));
  check("KinSelect: bấm ngoài đóng; `name` ⇒ input hidden; tắt ⇒ mờ 45%", /addEventListener\("mousedown"/.test(ks) && /type="hidden" name=\{name\}/.test(ks) && /disabled:opacity-45/.test(ks));
  check("KinSelect: không mã hex, không rgba viết tay", !/#[0-9a-fA-F]{3,8}\b/.test(ks.replace(/#\$\{|`#/g, "")) && !/rgba?\(/.test(ks));
  check("KinSelect: tên nút = nhãn + giá trị đang chọn (aria-labelledby gồm id nhãn và id span giá trị; chỉ aria-label ⇒ span ẩn mang nhãn)",
    /id=\{valueId\}/.test(ks) && /aria-labelledby=\{nameId \? `\$\{nameId\} \$\{valueId\}` : undefined\}/.test(ks) && /<span id=\{labelId\} hidden>\{labelText\}<\/span>/.test(ks) && /const labelText = ariaLabel \?\? wrapLabel/.test(ks)
    && !/aria-label=\{aria\["aria-label"\]\}/.test(ks));
  check("TabCaiDat.tsx: hai KinSelect (môn, khối — SCL-F2) nối nhãn bằng aria-labelledby (để đọc cả giá trị)", /aria-labelledby="class-category-nhan"/.test(read("src/components/tutor/quan-lop/TabCaiDat.tsx")) && /aria-labelledby="class-grade-nhan"/.test(read("src/components/tutor/quan-lop/TabCaiDat.tsx")));
  check("KinSelect không xuất qua kin/index.ts (import thẳng tệp — tệp chung không đổi)", !/KinSelect/.test(idx));
  for (const f of ["src/components/tutor/HocSinh.tsx", "src/components/tutor/quan-lop/AssignmentEditor.tsx", "src/components/tutor/quan-lop/TabCaiDat.tsx", "src/components/tutor/quan-lop/TabChuongBai.tsx"]) {
    const t = read(f).replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\/.*$/gm, ""); // bỏ chú thích
    check(`${f.split("/").pop()}: dùng KinSelect, không còn <select> gốc`, /<KinSelect\b/.test(t) && !/<select\b/.test(t));
  }
  check("HocSinh.tsx: KinSelect không bọc trong <label> (nối bằng aria-labelledby)", !/<label[^>]*>\s*<span[^>]*>[^<]*<\/span>\s*<KinSelect/.test(read("src/components/tutor/HocSinh.tsx")) && /aria-labelledby="hs-loc-lop"/.test(read("src/components/tutor/HocSinh.tsx")));

  // LOI-06 (11/11/2026): KinSelect thay <select> gốc ở MỌI vai. Ngoại lệ có lý do (ghi trong docs/kin/tien-do-dang-do.md mục LOI-06):
  //  - src/app/(admin)/admin/khoa-hoc/[id]/page.tsx, src/app/(admin)/admin/thi-thu/** — phòng Quản trị giữ (phiếu LOI-06 cấm sửa);
  //  - src/components/tutor/tim-gia-su/{BoLoc,TimGiaSu}.tsx — trang /giang-vien, phòng LOI-05 đang làm song song (phiếu LOI-06 cấm sửa).
  section("KinSelect (LOI-06) · không còn <select> gốc ngoài chỗ được miễn");
  const EXEMPT = [/^src\/app\/\(admin\)\/admin\/khoa-hoc\/\[id\]\/page\.tsx$/, /^src\/app\/\(admin\)\/admin\/thi-thu\//, /^src\/components\/tutor\/tim-gia-su\/(BoLoc|TimGiaSu)\.tsx$/];
  const stripComments = (t: string) => t.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:"'`])\/\/[^\n"'`]*$/gm, "$1");
  const hasNativeSelect = (t: string) => /<select[\s>]/.test(stripComments(t));
  check("bộ quét: PHÁ — chuỗi có <select> thật bị bắt; chỉ có trong chú thích thì không", hasNativeSelect('<div><select value={a}>') && hasNativeSelect("x\n  <select\n id=\"a\">") && !hasNativeSelect("// thay <select> gốc\n{/* <select> cũ */}") && !hasNativeSelect("<KinSelect value={a}>"));
  const leftover = tsx.filter(p => hasNativeSelect(read(p)) && !EXEMPT.some(r => r.test(p)));
  check("không còn <select> gốc trong src ngoài 3 nhóm được miễn", leftover.length === 0, leftover);
  const exemptLeft = tsx.filter(p => EXEMPT.some(r => r.test(p))).map(p => `${p}: ${(stripComments(read(p)).match(/<select[\s>]/g) ?? []).length}`).filter(x => !x.endsWith(": 0"));
  console.log("   (còn <select> ở chỗ được miễn) " + exemptLeft.join(" · "));
  const users = tsx.filter(p => /<KinSelect\b/.test(read(p)));
  check("≥ 60 tệp dùng KinSelect (LOI-02 4 tệp + LOI-06)", users.length >= 60, users.length);
  check("mọi tệp dùng KinSelect đều import thẳng tệp (không qua kin/index.ts)", users.every(p => p === "src/components/kin/KinSelect.tsx" || /from "@\/components\/kin\/KinSelect"/.test(read(p))), users.filter(p => !/from "@\/components\/kin\/KinSelect"/.test(read(p))));
  // Màn học phí (cờ TIỀN = không): chỉ đổi giao diện — lựa chọn vẫn mang đúng giá trị cũ, onChange đẩy nguyên chuỗi ra (không Number(), không đổi định dạng).
  const inv = read("src/app/lop-cua-toi/(tutor)/hoc-phi/InvoicesTab.tsx"), pay = read("src/app/lop-cua-toi/(tutor)/hoc-phi/PayoutTab.tsx"), stu = read("src/app/(student)/student/hoc-phi/page.tsx");
  check("học phí: tháng (gia sư) = <option value={m}> + onChange={v => setYearMonth(v)}; ngân hàng = value={b.bin} + OTHER; tháng (học sinh) = value: m",
    /<option key=\{m\} value=\{m\}>\{monthLabel\(m\)\}<\/option>/.test(inv) && /onChange=\{v => setYearMonth\(v\)\}/.test(inv)
    && /<option key=\{b\.bin\} value=\{b\.bin\}>\{b\.name\}<\/option>/.test(pay) && /<option value=\{OTHER\}>/.test(pay) && /onChange=\{v => setBank\(v\)\}/.test(pay)
    && /options=\{months\.map\(m => \(\{ value: m, label: monthLabel\(m\) \}\)\)\}/.test(stu) && /onChange=\{setYearMonth\}/.test(stu));

  section("KinSelect (LOI-06) · tính năng mới (dựng HTML ở máy chủ + hàm thuần)");
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const KS = await import("@/components/kin/KinSelect");
  const h = React.createElement;
  const opts = KS.kinOptionsFromChildren([
    h("option", { key: 1, value: "" }, "Chưa chọn"),
    h(React.Fragment, { key: 2 }, h("option", { value: 7 }, 7, " ngày"), h("option", { value: "x", disabled: true }, "Tắt")),
    h("optgroup", { key: 3, label: "Gắn vào mục có sẵn" }, h("option", { value: "l1" }, "Bài A", " · ", "Nháp"), h("option", { value: "l2" }, "Bài B")),
    h("optgroup", { key: 4, label: "Nhóm tắt", disabled: true }, h("option", { value: "z" }, "Z")),
    "rác", null, false,
  ]);
  check("children: <option> trong mảng / Fragment / <optgroup> đọc đủ 7 mục, đúng thứ tự", opts.map(o => o.value).join() === ",7,x,l1,l2,z", opts);
  check("children: giá trị số → chuỗi ('7'), nhãn ghép nhiều mảnh chữ ('7 ngày', 'Bài A · Nháp')", opts[1].value === "7" && opts[1].label === "7 ngày" && opts[3].label === "Bài A · Nháp");
  check("children: <optgroup label> → group; <option disabled> và <optgroup disabled> → disabled", opts[3].group === "Gắn vào mục có sẵn" && opts[4].group === "Gắn vào mục có sẵn" && opts[0].group === undefined && opts[2].disabled === true && opts[5].disabled === true && !opts[1].disabled);
  check("children: <option> không có value → giá trị = chữ (như trình duyệt)", KS.kinOptionsFromChildren(h("option", null, "6.5"))[0].value === "6.5");
  const html = (p: Record<string, unknown>, ...kids: unknown[]) => renderToStaticMarkup(h(KS.KinSelect, p as never, ...(kids as never[])));
  const ab = [h("option", { key: "a", value: "a" }, "Táo"), h("option", { key: "b", value: "b" }, "Bưởi")];
  const m1 = html({ name: "sessionId", defaultValue: "b" }, ...ab);
  check("name + defaultValue: input ẩn name=sessionId value=b (gửi form POST + 303), nút hiện 'Bưởi', data-value=b", /<input type="hidden" name="sessionId" value="b"\/>/.test(m1) && />Bưởi<\/span>/.test(m1) && /data-value="b"/.test(m1));
  const m2 = html({ name: "x" }, ...ab);
  check("không value, không defaultValue: như <select> — lấy mục đầu còn chọn được ('a')", /name="x" value="a"/.test(m2));
  const m3 = html({ name: "x", value: "a", disabled: true }, ...ab);
  check("PHÁ: disabled ⇒ input ẩn cũng disabled (như <select disabled> không gửi giá trị) + nút disabled", /<input type="hidden"(?=[^>]*\bdisabled="")(?=[^>]*name="x")[^>]*value="a"/.test(m3) && /<button[^>]*disabled=""/.test(m3) && !/<input type="hidden"[^>]*disabled=""/.test(html({ name: "x", value: "a" }, ...ab)));
  const m4 = html({ name: "x", value: "", required: true, options: [{ value: "", label: "Chọn…" }, { value: "a", label: "Táo" }] });
  check("required: aria-required trên nút + ô kiểm hợp lệ required (không name, không nhận tiêu điểm) mang giá trị rỗng ⇒ trình duyệt chặn gửi",
    /<button[^>]*aria-required="true"/.test(m4) && /<input tabindex="-1"(?=[^>]*aria-hidden="true")(?=[^>]*required="")[^>]*value=""/.test(m4) && !/<input tabindex="-1"[^>]*name=/.test(m4));
  check("PHÁ: không required ⇒ không có ô kiểm hợp lệ, không aria-required", !/aria-required/.test(m1) && !/required=""/.test(m1));
  const m5 = html({ id: "dk-city", value: "a", "aria-invalid": true, "aria-describedby": "dk-city-err", "data-testid": "o", title: "Gợi ý" }, ...ab);
  check("aria-invalid / aria-describedby / data-* / title gắn lên nút; viền lỗi bằng token --kin-tt-chu-loi",
    /<button[^>]*id="dk-city"[^>]*aria-invalid="true"[^>]*aria-describedby="dk-city-err"/.test(m5) && /<button[^>]*data-testid="o"/.test(m5) && /<button[^>]*title="Gợi ý"/.test(m5) && /border-\[var\(--kin-tt-chu-loi\)\]/.test(m5));
  check("ks: danh sách mở là position fixed (không bị khung cuộn / panel cắt), có lật lên khi thiếu chỗ, bù tổ tiên transform, bám khi cuộn",
    /className="fixed z-\[60\]/.test(ks) && /const up = below < /.test(ks) && /function fixedContainer/.test(ks) && /addEventListener\("scroll", onMove, true\)/.test(ks));
  check("ks: bọc trong <label> — bấm mục preventDefault (nhãn không bấm lại vào nút); onBlur chỉ khi tiêu điểm rời hẳn ô", /e\.preventDefault\(\) \/\* nằm trong <label>: không để nhãn bấm lại vào nút \*\//.test(ks) && /if \(!wrap\.current\?\.contains\(e\.relatedTarget/.test(ks));
  check("ks: nhóm (optgroup) dựng role=\"group\" có nhãn trong listbox", /role="group" aria-labelledby=\{`\$\{baseId\}-g-\$\{bi\}`\}/.test(ks));

  section("Token bóng / lớp phủ");
  const site = read("src/app/kin-site.css");
  const derived = site.slice(site.indexOf(':root, [data-vung="sang"] {'));
  for (const t of ["--kin-bong-toast", "--kin-bong-hop", "--kin-phu-hop"]) check(`${t} khai báo trong khối :root, [data-vung="sang"]`, derived.includes(`${t}:`));
  check("Toast/Confirm dùng token, không còn rgba viết tay trong component", !/rgba?\(/.test(read("src/components/kin/Toast.tsx")) && !/rgba?\(/.test(read("src/components/kin/Confirm.tsx")));

  // P2 13/11 → sửa 16/11: hai ca KinSelect lệch so với <select> gốc.
  section("KinSelect · P2 16/11 (danh sách đổi sau khi mount; giá trị không khớp lựa chọn)");
  const A = [{ value: "a", label: "A" }, { value: "b", label: "B" }];
  const B = [{ value: "x", label: "X", disabled: true }, { value: "y", label: "Y" }];
  check("ks1. giá trị còn trong danh sách ⇒ không đổi, đánh dấu đã khớp", JSON.stringify(kinUncontrolledAdjust(A, "b", false)) === JSON.stringify({ seenOk: true }));
  check("ks2. đã từng khớp, danh sách đổi mất giá trị ⇒ chọn lựa chọn DÙNG ĐƯỢC đầu tiên (bỏ mục disabled)", kinUncontrolledAdjust(B, "a", true).next === "y");
  check("ks3. defaultValue cố ý không khớp (rỗng + placeholder), chưa từng khớp ⇒ giữ nguyên", kinUncontrolledAdjust(A, "", false).next === undefined);
  check("ks4. danh sách đang rỗng (chờ tải) ⇒ không đổi", kinUncontrolledAdjust([], "a", true).next === undefined);
  check("ks5. ô kiểm required: giá trị không khớp lựa chọn ⇒ rỗng (chưa chọn); khớp ⇒ giữ", kinRequiredCheckValue(A, "z") === "" && kinRequiredCheckValue(A, "a") === "a");
  check("ks6. KinSelect dùng đúng hai hàm này (không chỉ khai báo)", /kinUncontrolledAdjust\(options, inner, innerSeenOk\)/.test(ks) && /value=\{kinRequiredCheckValue\(options, value\)\}/.test(ks));

  // SCL-G-0 (21/11/2026): nền giao diện theo docs/kin/thiet-ke/scl/QUYET-DINH-GIAO-DIEN.md §3.1–3.3, 3.6, 3.7 + phần I (tiếp cận).
  section("SCL-G-0 · token mới (tương phản tính theo WCAG)");
  const tokCss = read("src/app/kin-tokens.css");
  const hex = (t: string) => [1, 3, 5].map(i => parseInt(t.slice(i, i + 2), 16));
  const lumi = (c: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; const [r, g, b] = c.map(f); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a: number[], b: number[]) => { const [x, y] = [lumi(a), lumi(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const tint = (c: number[], bg: number[], p: number) => c.map((v, i) => Math.round(v * p + bg[i] * (1 - p))); // = color-mix(in srgb, c p%, bg) của --kin-tt-nen-loi
  const vals = (name: string) => [...tokCss.matchAll(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`, "g"))].map(m => m[1]);
  const dam = vals("--kin-tt-chu-loi-dam"), loiTok = vals("--kin-tt-chu-loi");
  check("--kin-tt-chu-loi-dam khai ở sáng + tối (data-che-do) + tối (theo máy)", dam.length === 3, dam);
  const W = hex("#ffffff"), D = hex("#0b0e14");
  const sangOk = contrast(hex(dam[0]), W) >= 4.5 && contrast(hex(dam[0]), tint(hex(loiTok[0]), W, 0.09)) >= 4.5;
  const toiOk = dam.slice(1).every(d => contrast(hex(d), D) >= 4.5 && contrast(hex(d), tint(hex(loiTok[1]), D, 0.09)) >= 4.5);
  check(`"Quá hạn" ≥ 4,5:1 trên nền trắng và trên --kin-tt-nen-loi, cả sáng lẫn tối (sáng ${contrast(hex(dam[0]), W).toFixed(2)} / ${contrast(hex(dam[0]), tint(hex(loiTok[0]), W, 0.09)).toFixed(2)})`, sangOk && toiOk);
  check("PHÁ: --kin-tt-chu-loi cũ (#dc2626) trên --kin-tt-nen-loi trượt 4,5:1 — lý do có token mới", contrast(hex("#dc2626"), tint(hex("#dc2626"), W, 0.09)) < 4.5);
  check("--kin-cao-thanh-duoi: 64px", /--kin-cao-thanh-duoi:\s*64px/.test(tokCss));
  check("vùng sáng khoá cho khách (kin-site.css) cũng có --kin-tt-chu-loi-dam", /\[data-vung="sang"\] \{[\s\S]*?--kin-tt-chu-loi-dam: #b91c1c;/.test(read("src/app/kin-site.css")));

  section("SCL-G-0 · KinStatus có HÌNH + chữ, tone Quá hạn, nhãn điểm dùng chung");
  const St = await import("@/components/kin/Status");
  const st = (p: Record<string, unknown>) => renderToStaticMarkup(h(St.KinStatus, p as never, "x"));
  const shapes = (["xong", "cho", "loi", "mo", "qua-han"] as const).map(t => (st({ tone: t }).match(/data-kin-hinh="([^"]+)"/) ?? [])[1]);
  check("mỗi tone một hình mặc định khác nhau (kin / nua / loi / chua / qua-han)", shapes.join() === "kin,nua,loi,chua,qua-han", shapes);
  check("hình aria-hidden, không còn chấm 7px", /<svg[^>]*aria-hidden="true"/.test(st({ tone: "xong" })) && !/w-\[7px\]/.test(read("src/components/kin/Status.tsx")));
  check("Quá hạn: chữ + hình --kin-tt-chu-loi-dam, chữ đậm; Chưa nộp (mo): chữ --kin-chu-phu", /color:var\(--kin-tt-chu-loi-dam\)/.test(st({ tone: "qua-han" })) && /font-semibold/.test(st({ tone: "qua-han" })) && /color:var\(--kin-chu-phu\)/.test(st({ tone: "mo" })));
  check("đỏ chỉ ở loi / qua-han: xong, cho, mo không dùng token đỏ", (["xong", "cho", "mo"] as const).every(t => !/--kin-tt-chu-loi/.test(st({ tone: t }))));
  check("shape ghi đè hình (cho + ba-phan-tu = chờ duyệt)", /data-kin-hinh="ba-phan-tu"/.test(st({ tone: "cho", shape: "ba-phan-tu" })));
  const labels = Object.values(St.GRADE_STATUS).map(g => g.label).join("|");
  check("nhãn dùng chung: Chưa nộp / Quá hạn / Chờ chấm / Chờ duyệt / Đã nộp / Đã chấm", labels === "Chưa nộp|Quá hạn|Chờ chấm|Chờ duyệt|Đã nộp|Đã chấm", labels);
  const gs = renderToStaticMarkup(h(St.KinGradeStatus, { state: "cho-duyet" }));
  check("KinGradeStatus: chờ duyệt = tone cho + hình 3/4 + chữ chung; children thay chữ", /data-kin-status="cho"/.test(gs) && /data-kin-hinh="ba-phan-tu"/.test(gs) && />Chờ duyệt<\/span>$/.test(gs) && /Chờ duyệt · 7,5/.test(renderToStaticMarkup(h(St.KinGradeStatus, { state: "cho-duyet" }, "Chờ duyệt · 7,5"))));
  check("index.ts xuất KinGradeStatus, GRADE_STATUS, KinStatusIcon, KinDialog", ["KinGradeStatus", "GRADE_STATUS", "KinStatusIcon", "KinDialog"].every(n => new RegExp(`\\b${n}\\b`).test(idx)));

  section("SCL-G-0 · KinListRow: tiêu đề xuống dòng, cột phải, hàng đang chọn");
  const LR = await import("@/components/kin/ListRow");
  const row = (p: Record<string, unknown>) => renderToStaticMarkup(h(LR.KinListRow, { title: "Tiêu đề", ...p } as never));
  const lrSrc = read("src/components/kin/ListRow.tsx").replace(/^\/\/.*$/gm, "");
  check("tiêu đề không truncate / line-clamp / ellipsis, có overflow-wrap:anywhere", !/truncate|line-clamp|ellipsis/.test(lrSrc) && /data-kin-list-title[^>]*\[overflow-wrap:anywhere\]/.test(row({})));
  check("aside dựng cột phải (data-kin-list-aside, chữ 14px --kin-chu-phu)", /data-kin-list-aside[^>]*--kin-chu-phu/.test(row({ aside: "Nộp 4/12" })) && />Nộp 4\/12</.test(row({ aside: "Nộp 4/12" })) && !/data-kin-list-aside/.test(row({})));
  check("current ⇒ aria-current + nền --kin-nen-dang-chon; không current ⇒ không có", /aria-current="true"/.test(row({ current: true })) && /--kin-nen-dang-chon/.test(row({ current: true })) && !/aria-current/.test(row({})));
  check("size lg: hàng 56px, tiêu đề 16px, dòng phụ --kin-chu-phu", /min-h-14/.test(row({ size: "lg", sub: "s" })) && /--kin-co-body/.test(row({ size: "lg" })) && /--kin-chu-phu/.test(row({ size: "lg", sub: "s" })));

  section("SCL-G-0 · tiếp cận chung (phần I)");
  const dlg = read("src/components/kin/Dialog.tsx");
  check("KinDialog: role=dialog + aria-modal + aria-labelledby + useModalDialog (Escape, giữ tiêu điểm) + nút Đóng có chữ", /role="dialog"/.test(dlg) && /aria-modal="true"/.test(dlg) && /aria-labelledby=\{titleId\}/.test(dlg) && /useModalDialog\(open, boxRef, onClose\)/.test(dlg) && />Đóng</.test(dlg));
  const siteCss = read("src/app/kin-site.css");
  check("chuyển động hộp thoại chỉ opacity/transform, tắt dưới prefers-reduced-motion", /@keyframes kin-hop-vao \{ from \{ opacity: 0; transform: translateY\(8px\); \}/.test(siteCss) && /prefers-reduced-motion: reduce\) \{ \.kin-hop-vao \{ animation: none; \}/.test(siteCss));
  check("ô nhập điện thoại 16px (max-width: 767px) cho input/select/textarea, chừa ô mã CodeBoxes", /@media \(max-width: 767px\) \{\s*input:not\(\[type="checkbox"\][\s\S]*?select:not\(\.kin-code-cell[\s\S]*?textarea:not\(\.kin-code-cell[\s\S]*?\{ font-size: 16px; \}/.test(siteCss));
  for (const f of ["src/components/student/StudentShell.tsx", "src/components/tutor/TutorShell.tsx", "src/components/admin/AdminShell.tsx"]) {
    const t = read(f), links = (t.match(/<KinSkipLink \/>/g) ?? []).length, targets = (t.match(/<KinSkipTarget \/>/g) ?? []).length;
    check(`${f.split("/").pop()}: "Bỏ qua tới nội dung" là con đầu của vỏ, đích ngay trước nội dung (${links} vỏ)`, links >= 1 && links === targets && /md:flex[^"]*"[^>]*>\s*<KinSkipLink \/>/.test(t));
  }
  check("SkipLink: chữ 'Bỏ qua tới nội dung', tìm đích trong CÙNG vỏ (Next 16 giữ trang ẩn ⇒ id có thể trùng)", /Bỏ qua tới nội dung/.test(read("src/components/kin/shell/SkipLink.tsx")) && /parentElement\?\.querySelector<HTMLElement>\("\[data-kin-noi-dung\]"\)/.test(read("src/components/kin/shell/SkipLink.tsx")));

  await done();
})();
