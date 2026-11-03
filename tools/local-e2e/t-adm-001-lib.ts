// ADM-001 (phần THUẦN, không DB, không mạng) — nhãn nhật ký kiểm toán không bao giờ thiếu lại.
// 1. Mọi mã ADM-001 tạo mới (7.1) và 12 mã bắt buộc của api/admin/** (7.2) có nhãn thật, xuất hiện trong ô lọc.
// 2. Quét nguồn (như t-no-hex): mọi literal action trong lời gọi logAction( trên src/** là tập con khoá của ACTION_LABEL. Danh sách ngoại lệ RỖNG.
// 3. Tương tự cho resourceType (tham số thứ ba, PascalCase) với RESOURCE_LABEL.
// 4. AUDIT_ACTION_OPTIONS không trùng value; nhãn không rỗng, không chứa "." hay "_".
// 5. Ca phá cố ý: mã không có nhãn phải rơi về chuỗi dự phòng "res · ev" — chứng minh bài phân biệt được nhãn thật và dự phòng.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { check, section, done } from "./h";
import { AUDIT_ACTION_OPTIONS, auditActionLabel, auditResourceLabel } from "@/lib/adminOps";

const ROOT = join(process.cwd(), "src");
const EXT = /\.(tsx|ts)$/;
const files: string[] = [];
const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) { if (n !== "generated") walk(p); } else if (EXT.test(n)) files.push(p); } };
walk(ROOT);
const rel = (p: string) => relative(process.cwd(), p).replaceAll("\\", "/");

const KNOWN = new Set(AUDIT_ACTION_OPTIONS.map(o => o.value));
// Chuỗi dự phòng của auditActionLabel: "a_b.c_d" → "a b · c d".
const fallback = (a: string) => { const [res, ev] = a.split("."); return ev ? `${res.replace(/_/g, " ")} · ${ev.replace(/[._]/g, " ")}` : a; };
const hasRealLabel = (a: string) => KNOWN.has(a) && auditActionLabel(a) !== fallback(a) && auditActionLabel(a) !== a;

section("1. Mã ADM-001 (7.1) và 12 mã bắt buộc api/admin/** (7.2) có nhãn thật");
const NEW_71 = ["article.create", "article.update", "article.publish", "article.unpublish", "article.delete", "student.hide", "student.restore"];
const REQUIRED_72 = [
  "admission_score.create", "admission_score.update", "admission_score.delete", "admission_score.import", "admission_score.seed",
  "admission_formula.create", "admission_formula.update", "admission_formula.delete",
  "library_video.create", "library_video.update", "library_video.delete", "pro_payment.resolve",
];
for (const a of [...NEW_71, ...REQUIRED_72]) check(`${a} → nhãn thật, có trong ô lọc`, hasRealLabel(a), auditActionLabel(a));
check("nhãn đúng chữ đặc tả: article.publish = 'Đăng bài viết', student.hide = 'Ẩn học sinh'", auditActionLabel("article.publish") === "Đăng bài viết" && auditActionLabel("student.hide") === "Ẩn học sinh" && auditActionLabel("student.restore") === "Khôi phục học sinh đã ẩn");

section("2. Quét nguồn: mọi literal action của logAction( có nhãn (ngoại lệ RỖNG)");
// Với mỗi lời gọi logAction( lấy đoạn tới dấu "," thứ ba ở cấp ngoài cùng (actorId, action, resourceType) — đủ cho cả lời gọi nhiều dòng và dạng ba ngôi.
function callHead(src: string, from: number): string {
  let depth = 0, commas = 0, i = from;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") { if (depth === 0) break; depth--; }
    else if (c === "," && depth === 0 && ++commas === 3) break;
  }
  return src.slice(from, i);
}
const ACTION_LIT = /"([a-z_]+(?:\.[a-z_]+)+)"/g;
const RESOURCE_LIT = /"([A-Z][A-Za-z]+)"/g;
const actionHits = new Map<string, string[]>(), resourceHits = new Map<string, string[]>();
let calls = 0;
for (const p of files) {
  const f = rel(p);
  if (f === "src/lib/auditLog.ts") continue; // nơi ĐỊNH NGHĨA logAction
  const src = readFileSync(p, "utf8");
  const re = /\blogAction\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    calls++;
    const head = callHead(src, m.index + m[0].length);
    for (const a of head.matchAll(ACTION_LIT)) (actionHits.get(a[1]) ?? actionHits.set(a[1], []).get(a[1])!).push(f);
    for (const r of head.matchAll(RESOURCE_LIT)) (resourceHits.get(r[1]) ?? resourceHits.set(r[1], []).get(r[1])!).push(f);
  }
}
check(`quét được ≥ 100 lời gọi logAction( trong ${files.length} tệp (bài quét có bắt được gì)`, calls >= 100, calls);
check("bắt được cả lời gọi dạng ba ngôi (course_fee.set_rate / set_student_rate, enrollment.mark_left / mark_back)", ["course_fee.set_rate", "course_fee.set_student_rate", "enrollment.mark_left", "enrollment.mark_back"].every(a => actionHits.has(a)));
const missingActions = [...actionHits.keys()].filter(a => !hasRealLabel(a)).sort();
check(`${actionHits.size} mã action được ghi đều có nhãn trong ACTION_LABEL — thiếu: ${missingActions.length}`, missingActions.length === 0, missingActions.map(a => `${a} (${actionHits.get(a)![0]})`).slice(0, 12));

section("3. Quét nguồn: mọi resourceType được ghi có nhãn trong RESOURCE_LABEL");
const missingResources = [...resourceHits.keys()].filter(r => auditResourceLabel(r) === r).sort();
check(`${resourceHits.size} resourceType được ghi đều có nhãn — thiếu: ${missingResources.length}`, missingResources.length === 0, missingResources.map(r => `${r} (${resourceHits.get(r)![0]})`));
check("Article và TuitionInvoice có nhãn; Invoice cũ vẫn giữ", auditResourceLabel("Article") === "Bài viết" && auditResourceLabel("TuitionInvoice") === "Phiếu học phí" && auditResourceLabel("Invoice") === "Phiếu học phí");

section("4. AUDIT_ACTION_OPTIONS sạch");
check("không có value trùng", new Set(AUDIT_ACTION_OPTIONS.map(o => o.value)).size === AUDIT_ACTION_OPTIONS.length);
const badLabel = AUDIT_ACTION_OPTIONS.filter(o => !o.label.trim() || /[._]/.test(o.label));
check("mọi label khác rỗng, không chứa '.' hay '_' (không phải chữ máy)", badLabel.length === 0, badLabel);
check("đã sắp theo chữ tiếng Việt", AUDIT_ACTION_OPTIONS.every((o, i, arr) => i === 0 || arr[i - 1].label.localeCompare(o.label, "vi") <= 0));
check("có ≥ 60 + 7 khoá mới so với 46 khoá ban đầu (≥ 113)", AUDIT_ACTION_OPTIONS.length >= 113, AUDIT_ACTION_OPTIONS.length);

section("5. Ca phá cố ý: mã không có nhãn rơi về chuỗi dự phòng");
check("auditActionLabel('article.nonexistent') === 'article · nonexistent' (dự phòng, KHÔNG phải nhãn thật)", auditActionLabel("article.nonexistent") === "article · nonexistent" && !hasRealLabel("article.nonexistent"), auditActionLabel("article.nonexistent"));
check("mã không có dấu chấm trả nguyên chuỗi", auditActionLabel("khong_co_cham") === "khong_co_cham");
check("resourceType lạ trả nguyên chuỗi", auditResourceLabel("KhongCo") === "KhongCo");

done();
