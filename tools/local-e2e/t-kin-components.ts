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
  // 31/10/2026 (BU-00 sửa sau test): lớp CSS + kinButtonClass() tách sang buttonClass.ts (module thuần, không "use client") để trang máy chủ gọi được;
  // Button.tsx chỉ còn component. Kiểm kiểu nút / chạm 44px / focus trên CẢ HAI tệp.
  const btn = read("src/components/kin/Button.tsx") + "\n" + read("src/components/kin/buttonClass.ts");
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
  // BU-08: KiemDuyet.tsx nay chỉ re-export; khung xác nhận nội dòng nằm ở queue/QueuePanel.tsx (+ HangCho.tsx dựng bảng).
  const qp = read("src/components/admin/queue/QueuePanel.tsx"), hc = read("src/components/admin/HangCho.tsx");
  check("Admin Hàng chờ: khung xác nhận nội dòng dùng KinButton, 'danger' từ hàng chờ được chuyển thành nút đỏ (queue/QueuePanel.tsx, HangCho.tsx)", /KinButton/.test(qp) && /danger-solid/.test(qp) && /KinButton/.test(hc));
  // 24/10/2026 (QT-02): quan-tri-vien/page.tsx bỏ tab "Hồ sơ gia sư chờ duyệt" (duyệt gia sư chỉ còn một cửa: hàng chờ kiểm duyệt) nên không còn KinTabs; thay bằng ô kiểm không tự viết role="tab".
  check("quan-tri-vien/page.tsx: không tự viết role=\"tab\"", !/role="tab"/.test(read("src/app/(admin)/admin/quan-tri-vien/page.tsx")));
  for (const f of ["src/app/lop-cua-toi/(tutor)/hoc-phi/HocPhiClient.tsx", "src/app/lop-cua-toi/(tutor)/ke-hoach-buoi/[id]/KeHoachEditorClient.tsx"])
    check(`${f.split("/").slice(-2).join("/")}: tab dùng KinTabs (không tự viết role="tab")`, /KinTabs/.test(read(f)) && !/role="tab"/.test(read(f)));
  check("ToastProvider hiển thị bằng KinToast, có toast.warn + dòng phụ", /KinToast/.test(read("src/components/ui/Toast.tsx")) && /warn:/.test(read("src/components/ui/Toast.tsx")) && /detail/.test(read("src/components/ui/Toast.tsx")));
  check("ConfirmModal cũ chỉ còn là lớp bọc KinConfirm", /KinConfirm/.test(read("src/components/ui/ConfirmModal.tsx")) && !/fixed inset-0/.test(read("src/components/ui/ConfirmModal.tsx")));
  check("tutor Badge dùng KinStatus", /KinStatus/.test(read("src/components/tutor/shared.tsx")));
  for (const f of ["src/components/tutor/ClassInvites.tsx", "src/app/lop-cua-toi/(tutor)/kiem-duyet/KiemDuyetClient.tsx", "src/app/lop-cua-toi/(tutor)/ke-hoach-buoi/[id]/KeHoachEditorClient.tsx"])
    check(`${f.split("/").pop()}: xác nhận việc không hoàn tác bằng KinConfirm nguy hiểm, không window.confirm`, /<KinConfirm/.test(read(f)) && /tone="nguy-hiem"/.test(read(f)) && !/window\.confirm|[^.\w]confirm\(/.test(read(f)));

  const raw = src.filter(f => /\.tsx?$/.test(f) && !f.includes("/generated/")).filter(f => /window\.confirm|(^|[^.\w])confirm\(/.test(read(f).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")));
  check("toàn bộ mã nguồn không còn window.confirm / confirm() — mọi hỏi lại đi qua KinConfirm", raw.length === 0, raw);
  check("useKinConfirm được xuất ở index.ts và trả { ask, dialog }", /useKinConfirm/.test(idx) && /dialog/.test(read("src/components/kin/useConfirm.tsx")) && /Promise<boolean>/.test(read("src/components/kin/useConfirm.tsx")));
  for (const f of ["src/app/(student)/student/bai-giang/[lessonId]/page.tsx", "src/app/(admin)/admin/thi-thu/page.tsx", "src/app/(admin)/admin/thi-thu/ngan-hang-de-thi/page.tsx", "src/app/(admin)/admin/khoa-hoc/[id]/page.tsx"]) {
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
  check("TabCaiDat.tsx: hai KinSelect nối nhãn bằng aria-labelledby (để đọc cả giá trị)", /aria-labelledby="class-category-nhan"/.test(read("src/components/tutor/quan-lop/TabCaiDat.tsx")) && /aria-labelledby="class-status-nhan"/.test(read("src/components/tutor/quan-lop/TabCaiDat.tsx")));
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

  await done();
})();
