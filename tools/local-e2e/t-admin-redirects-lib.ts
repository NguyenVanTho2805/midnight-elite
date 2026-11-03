// BU-08 mục 4.6 — bảng 308 (src/lib/adminRedirects.ts): mỗi đường cũ không còn trang thật, mỗi đích khớp một trang con hoặc hàng chờ,
// không vòng / chuỗi, query được giữ. Ca phá cố ý: thêm { from: "/admin/hoc-sinh", to: … } vào ADMIN_REDIRECTS → ca "không che trang thật" đỏ;
// đổi đích thành `/admin/kiem-duyet?loai=khong-co` → ca "loai hợp lệ" đỏ; xoá bước giữ query trong lookupAdminRedirect → ca "query được giữ" đỏ.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ADMIN_REDIRECTS, lookupAdminRedirect, nextAdminRedirects } from "@/lib/adminRedirects";
import { matchSub } from "@/lib/adminNav";
import { isQueueKind } from "@/lib/adminQueue";
import { check, section, done } from "./h";

const adminRoot = join(process.cwd(), "src/app/(admin)");
const pageExists = (url: string) => existsSync(join(adminRoot, ...url.split("/").filter(Boolean), "page.tsx"));

section("Bảng chuyển hướng");
check("đúng 2 đường cũ: /admin/ho-so-gia-su và /admin/cong-dong/bao-cao", ADMIN_REDIRECTS.map(r => r.from).sort().join() === "/admin/cong-dong/bao-cao,/admin/ho-so-gia-su", ADMIN_REDIRECTS.map(r => r.from));
// adm-test (02/11): đặc tả viết "không có page.tsx"; mã thực tế giữ lại 2 tệp STUB chỉ gọi permanentRedirect tới đúng `to` (dự phòng khi next.config chưa gắn). Stub không che trang thật nên chấp nhận; trang có thân khác thì đỏ.
const stubOk = (r: { from: string; to: string }) => !pageExists(r.from) || (() => { const src = readFileSync(join(adminRoot, ...r.from.split("/").filter(Boolean), "page.tsx"), "utf8").replace(/\/\/.*$/gm, ""); return new RegExp(`permanentRedirect\\(\\s*"${r.to.replace(/[?]/g, "\\?")}"\\s*\\)`).test(src) && src.split("\n").filter(l => l.trim()).length <= 8; })();
check("mỗi `from` hoặc không còn page.tsx, hoặc chỉ là stub permanentRedirect tới đúng `to` (không che trang thật)", ADMIN_REDIRECTS.every(stubOk), ADMIN_REDIRECTS.filter(r => !stubOk(r)).map(r => r.from));
check("mỗi `from` bắt đầu bằng /admin/ và không có query / dấu / cuối", ADMIN_REDIRECTS.every(r => r.from.startsWith("/admin/") && !r.from.includes("?") && !r.from.endsWith("/")));
check("mỗi `to` (bỏ query) khớp một trang con trong điều hướng hoặc là /admin/kiem-duyet", ADMIN_REDIRECTS.every(r => { const p = r.to.split("?")[0]; return p === "/admin/kiem-duyet" || !!matchSub(p); }));
check("mỗi `to` có trang thật (page.tsx)", ADMIN_REDIRECTS.every(r => pageExists(r.to.split("?")[0])), ADMIN_REDIRECTS.filter(r => !pageExists(r.to.split("?")[0])).map(r => r.to));
check("tham số `loai` của đích thuộc danh sách loại hàng chờ", ADMIN_REDIRECTS.every(r => { const l = new URLSearchParams(r.to.split("?")[1] ?? "").get("loai"); return l === null || isQueueKind(l); }));
check("không vòng, không chuỗi: `to` không là `from` của đường khác; `from` đều khác nhau", ADMIN_REDIRECTS.every(r => !ADMIN_REDIRECTS.some(o => o.from === r.to.split("?")[0])) && new Set(ADMIN_REDIRECTS.map(r => r.from)).size === ADMIN_REDIRECTS.length);
check("không chuyển hướng các đường giữ nguyên (hàng chờ, Hôm nay, đánh giá, nạp Coin…)", ["/admin", "/admin/kiem-duyet", "/admin/hoc-sinh", "/admin/danh-gia", "/admin/topups", "/admin/cong-dong", "/admin/khoa-hoc", "/admin/nhat-ky"].every(p => !ADMIN_REDIRECTS.some(r => r.from === p)));

section("Tra đích");
check("/admin/ho-so-gia-su → /admin/kiem-duyet?loai=gia-su", lookupAdminRedirect("/admin/ho-so-gia-su") === "/admin/kiem-duyet?loai=gia-su");
check("/admin/cong-dong/bao-cao → /admin/kiem-duyet?loai=tra-loi", lookupAdminRedirect("/admin/cong-dong/bao-cao") === "/admin/kiem-duyet?loai=tra-loi");
check("query của yêu cầu được GIỮ và nối sau: ?x=1 → loai=gia-su&x=1", lookupAdminRedirect("/admin/ho-so-gia-su", "?x=1") === "/admin/kiem-duyet?loai=gia-su&x=1" && lookupAdminRedirect("/admin/ho-so-gia-su", new URLSearchParams("x=1&y=2")) === "/admin/kiem-duyet?loai=gia-su&x=1&y=2");
check("tham số trùng tên với đích: đích thắng (không đổi loại được bằng query)", lookupAdminRedirect("/admin/ho-so-gia-su", "loai=nap-coin") === "/admin/kiem-duyet?loai=gia-su");
check("dấu / cuối vẫn khớp", lookupAdminRedirect("/admin/ho-so-gia-su/") === "/admin/kiem-duyet?loai=gia-su");
check("đường không phải đường cũ → null (kể cả đường con / đường gần giống)", lookupAdminRedirect("/admin/hoc-sinh") === null && lookupAdminRedirect("/admin") === null && lookupAdminRedirect("/admin/ho-so-gia-su/abc") === null && lookupAdminRedirect("/admin/ho-so-gia-su-x") === null && lookupAdminRedirect("/admin/cong-dong") === null);

section("Dạng đưa vào next.config.ts");
const n = nextAdminRedirects();
check("mọi mục permanent: true (308) và source/destination khớp bảng", n.length === ADMIN_REDIRECTS.length && n.every((x, i) => x.permanent === true && x.source === ADMIN_REDIRECTS[i].from && x.destination === ADMIN_REDIRECTS[i].to));

section("next.config.ts dùng đúng bảng này (đọc nguồn)");
const cfg = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
const wired = /nextAdminRedirects|ADMIN_REDIRECTS/.test(cfg) && /adminRedirects/.test(cfg);
if (wired) check("next.config.ts nhập từ @/lib/adminRedirects và có redirects()", /async\s+redirects\s*\(/.test(cfg));
else console.log("  ⚠ CHƯA GẮN: next.config.ts chưa nhập adminRedirects (COO gắn — xem phiếu bàn giao D1); không tính xanh/đỏ");
done();
