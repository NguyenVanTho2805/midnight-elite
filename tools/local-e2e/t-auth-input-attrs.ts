// Ô email / mật khẩu của đăng ký – đăng nhập – quên mật khẩu – đặt lại: bàn phím điện thoại KHÔNG được tự viết hoa, tự sửa chữ, tự thêm dấu cách (01/11/2026).
//
// Lỗi gốc: nút "Hiện" đổi ô mật khẩu từ type="password" sang type="text". Ô text trên iPhone / Android mặc định viết hoa chữ đầu và tự sửa chữ.
// Người đăng ký bấm "Hiện", gõ `uyen2005`, máy lưu `Uyen2005` (ô "nhập lại" cũng bị viết hoa y hệt nên vẫn khớp). Lúc đăng nhập mật khẩu đang ẩn,
// gõ đúng `uyen2005` → "Email hoặc mật khẩu không đúng" dù người dùng thề là không sai.
//
// Bài này thuần (không DB, không máy chủ): (1) KinInput tự gắn ba thuộc tính cho ô mật khẩu / email / tài khoản, kể cả lúc đang ở type="text"; ô tên vẫn để
// bàn phím viết hoa; người gọi vẫn ghi đè được. (2) Mọi <input> thô trên 4 trang auth thuộc loại nhạy cảm phải có cùng ba thuộc tính (NO_AUTOFIX).
// Kiểm trên trình duyệt thật: ui-auth-input-attrs.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KinInput } from "@/components/kin/Input";
import { NO_AUTOFIX } from "@/components/kin/noAutofix";
import { check, section, done } from "./h";

const html = (props: Record<string, unknown>) => renderToStaticMarkup(createElement(KinInput, { label: "x", ...props }));
const has = (s: string, attr: "autocapitalize" | "autocorrect" | "spellcheck", val: string) => new RegExp(`${attr}="${val}"`, "i").test(s);
const protectedHtml = (s: string) => has(s, "autocapitalize", "off") && has(s, "autocorrect", "off") && has(s, "spellcheck", "false");

section("Hằng số dùng chung");
check("NO_AUTOFIX = tắt viết hoa, tắt tự sửa, tắt gạch chân chính tả", NO_AUTOFIX.autoCapitalize === "off" && NO_AUTOFIX.autoCorrect === "off" && NO_AUTOFIX.spellCheck === false, NO_AUTOFIX);

section("KinInput: ô mật khẩu — kể cả lúc nút 'Hiện' đã đổi sang type=\"text\"");
check("type=password", protectedHtml(html({ type: "password" })), html({ type: "password" }));
check("type=text + autoComplete=new-password (đăng ký / đặt lại khi bấm Hiện)", protectedHtml(html({ type: "text", autoComplete: "new-password" })), html({ type: "text", autoComplete: "new-password" }));
check("type=text + autoComplete=current-password (đăng nhập khi bấm Hiện)", protectedHtml(html({ type: "text", autoComplete: "current-password" })), html({ type: "text", autoComplete: "current-password" }));

section("KinInput: ô email / tài khoản");
check("type=email", protectedHtml(html({ type: "email", autoComplete: "email" })), html({ type: "email", autoComplete: "email" }));
check("type=text + autoComplete=username (đăng nhập khi cho gõ cả số điện thoại)", protectedHtml(html({ type: "text", autoComplete: "username" })), html({ type: "text", autoComplete: "username" }));

section("KinInput: ô khác KHÔNG bị tắt viết hoa (tên người vẫn được viết hoa chữ đầu)");
const nameHtml = html({ type: "text", autoComplete: "name" });
check("ô Họ và tên không có autocapitalize=off", !has(nameHtml, "autocapitalize", "off"), nameHtml);
check("ô Họ và tên không có spellcheck=false", !has(nameHtml, "spellcheck", "false"), nameHtml);
check("ô không khai gì (type mặc định) cũng không bị tắt", !has(html({}), "autocapitalize", "off"));

section("KinInput: nơi gọi vẫn ghi đè được");
const over = html({ type: "password", autoCapitalize: "words" });
check("autoCapitalize ghi đè được (không bị mặc định đè lại)", has(over, "autocapitalize", "words") && !has(over, "autocapitalize", "off"), over);

section("<input> thô trên 4 trang auth: loại nhạy cảm phải mang NO_AUTOFIX");
const PAGES = [
  "src/app/(guest)/dang-ky/page.tsx",
  "src/app/(guest)/dang-nhap/page.tsx",
  "src/app/(guest)/quen-mat-khau/page.tsx",
  "src/app/(guest)/dat-lai-mat-khau/page.tsx",
];
const SENSITIVE = /new-password|current-password|type="password"|"password"|type="email"|"email"|username/;
let rawSensitive = 0;
for (const f of PAGES) {
  const src = readFileSync(f, "utf8");
  const tags = src.match(/<input\b[\s\S]*?\/>/g) ?? [];
  const bad: string[] = [];
  for (const tag of tags) {
    if (!SENSITIVE.test(tag)) continue; // checkbox, ô tên, ô trường...
    rawSensitive++;
    const ok = /\{\.\.\.NO_AUTOFIX\}/.test(tag)
      || (/autoCapitalize="off"/.test(tag) && /autoCorrect="off"/.test(tag) && /spellCheck=\{false\}/.test(tag));
    if (!ok) bad.push((tag.match(/id="([^"]+)"/)?.[1] ?? tag.slice(0, 60)).trim());
  }
  check(`${f.replace("src/app/(guest)/", "")}: mọi <input> nhạy cảm đều có NO_AUTOFIX`, bad.length === 0, bad);
}
check("quét thấy đủ ô thô nhạy cảm (dat-lai 2 + quen-mat-khau 1 + dang-nhap 1 = 4) — nếu 0 là bộ quét hỏng", rawSensitive === 4, rawSensitive);

done();
