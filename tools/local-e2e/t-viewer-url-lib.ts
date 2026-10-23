// MD-09 — /xem-tai-lieu chỉ nhận địa chỉ tin cậy (src/lib/viewerUrl.ts). Thuần, không DB. Ca phá cố ý: mọi cách lách phải bị CHẶN.
import { check, section, done } from "./h";
import { checkViewerUrl, VIEWER_URL_ERRORS } from "@/lib/viewerUrl";

const CLOUD = "kin-demo";
const ok = (u: unknown, cloud: string | null | undefined = CLOUD) => checkViewerUrl(u as string, { cloudName: cloud });
const rejected = (u: unknown, cloud: string | null | undefined = CLOUD) => { const r = ok(u, cloud); return !r.ok && r.error === VIEWER_URL_ERRORS.rejected; };

section("Được nhận");
check("Cloudinary CỦA KiN → kind cloudinary", (() => { const r = ok(`https://res.cloudinary.com/${CLOUD}/raw/upload/v1/a.pdf`); return r.ok && r.kind === "cloudinary"; })());
check("đường dẫn nội bộ → kind internal", (() => { const r = ok("/api/files/abc.pdf?x=1"); return r.ok && r.kind === "internal"; })());
check("Google Docs / Sheets / Slides → google", ["document", "spreadsheets", "presentation"].every(k => { const r = ok(`https://docs.google.com/${k}/d/ABC123/edit?usp=sharing`); return r.ok && r.kind === "google"; }));
check("Google Drive file → google", (() => { const r = ok("https://drive.google.com/file/d/ABC123/view"); return r.ok && r.kind === "google"; })());
check("khoảng trắng đầu/cuối được cắt", ok(`  https://res.cloudinary.com/${CLOUD}/a.pdf  `).ok);

section("Thiếu / rỗng");
check("rỗng, null, undefined, chỉ khoảng trắng → thông báo 'Thiếu đường dẫn'", ["", null, undefined, "   "].every(v => { const r = ok(v); return !r.ok && r.error === VIEWER_URL_ERRORS.missing; }));
check("thông báo là tiếng Việt, có hướng dẫn", VIEWER_URL_ERRORS.rejected.includes("KiN") && /[ăâđêôơư]/i.test(VIEWER_URL_ERRORS.rejected));

section("Ca phá cố ý — phải CHẶN");
check("javascript: (mọi kiểu viết)", ["javascript:alert(1)", "JaVaScRiPt:alert(1)", " javascript:alert(1)", "java\tscript:alert(1)", "java\nscript:alert(1)", "\u0001javascript:alert(1)"].every(u => rejected(u)));
check("data:, file:, blob:, vbscript:, ftp:", ["data:text/html,<script>1</script>", "file:///etc/passwd", "blob:https://x/1", "vbscript:x", "ftp://res.cloudinary.com/" + CLOUD + "/a"].every(u => rejected(u)));
check("http (không phải https) tới Cloudinary KiN", rejected(`http://res.cloudinary.com/${CLOUD}/a.pdf`));
check("host lạ https", ["https://evil.example/a.pdf", "https://example.com", "https://169.254.169.254/latest/meta-data", "https://localhost/a", "https://127.0.0.1/a", "https://[::1]/a"].every(u => rejected(u)));
check("proxy mở //host và \\\\host", ["//evil.example/a.pdf", "///evil.example/a", "/\\evil.example/a", "\\\\evil.example\\a", "/\\/evil.example"].every(u => rejected(u)));
check("lừa tên miền: res.cloudinary.com.evil.example, evilres.cloudinary.com, @", [`https://res.cloudinary.com.evil.example/${CLOUD}/a`, `https://evilres.cloudinary.com/${CLOUD}/a`, `https://res.cloudinary.com@evil.example/${CLOUD}/a`, `https://evil.example@res.cloudinary.com/${CLOUD}/a`, `https://user:pw@res.cloudinary.com/${CLOUD}/a`].every(u => rejected(u)));
check("port lạ bị chặn; :443 là cổng mặc định của https nên cùng một nơi (chấp nhận, vô hại)", [`https://res.cloudinary.com:8443/${CLOUD}/a`, `https://res.cloudinary.com:80/${CLOUD}/a`].every(u => rejected(u)) && ok(`https://res.cloudinary.com:443/${CLOUD}/a`).ok);
check("Cloudinary của NGƯỜI KHÁC (khác tên kho)", [`https://res.cloudinary.com/nguoi-khac/raw/upload/a.pdf`, `https://res.cloudinary.com/${CLOUD}x/a.pdf`, `https://res.cloudinary.com/${CLOUD}`, `https://res.cloudinary.com/x/${CLOUD}/a`].every(u => rejected(u)));
check("chưa cấu hình tên kho → ĐÓNG (không nhận Cloudinary nào)", [undefined, null, "", "  ", "your_cloud_name"].every(c => rejected(`https://res.cloudinary.com/${c ?? "x"}/a.pdf`, c)));
check("Google: host đúng nhưng đường dẫn không phải tài liệu (tìm kiếm, chuyển hướng)", ["https://docs.google.com/url?q=https://evil.example", "https://docs.google.com/", "https://drive.google.com/open?id=1", "https://drive.google.com/uc?export=download&id=1", "https://docs.google.com/forms/d/1/edit"].every(u => rejected(u)));
check("Google: tên miền lừa", ["https://docs.google.com.evil.example/document/d/1", "https://evildocs.google.com/document/d/1", "https://google.com/document/d/1", "https://docs.google.com@evil.example/document/d/1"].every(u => rejected(u)));
check("nội bộ: không có dấu / đứng đầu thì không phải nội bộ", ["api/files/a", "./a", "../a", "?a=1", "#x"].every(u => rejected(u)));
check("khoảng trắng / ký tự điều khiển / dấu gạch ngược / null byte bên trong", [`https://res.cloudinary.com/${CLOUD}/a b.pdf`, `https://res.cloudinary.com/${CLOUD}/a\u0000.pdf`, `https://res.cloudinary.com/${CLOUD}/a\\b`, "/a b", "/a\tb"].every(u => rejected(u)));
check("quá dài (>2048)", rejected(`https://res.cloudinary.com/${CLOUD}/` + "a".repeat(2100)) && rejected("/" + "a".repeat(2100)));
check("không phải chuỗi (số, mảng, đối tượng) → không ném lỗi, bị chặn", [123, ["https://docs.google.com/document/d/1"], { a: 1 }].every(u => { try { return !ok(u).ok; } catch { return false; } }));
check("kết quả OK trả đúng chuỗi đã cắt, không đổi dạng", (() => { const u = `https://res.cloudinary.com/${CLOUD}/raw/upload/v1/Bài%201.docx`; const r = ok(u); return r.ok && r.url === u; })());

done();
