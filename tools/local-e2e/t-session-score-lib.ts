// BU-11 điểm 0-10 + % BTVN từng em mỗi buổi, HS-12 gia đình dùng chung liên hệ: kiểm dữ liệu vào. Hàm THUẦN, không cần máy chủ.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-session-score-lib.ts
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { PCT_MAX, SCORE_MAX, SCORE_ROWS_MAX, parsePct, parseScore, parseScoreRows, pctChip, scoreText } from "@/lib/sessionScore";
import { FAMILIES_MAX, parseFamily } from "@/lib/familyGroup";
import { check, section, done } from "./h";

const ok = (r: { ok: boolean }) => r.ok;
const val = (r: { ok: true; value: number | null } | { ok: false }) => (r.ok ? r.value : "LỖI");

(async () => {
  section("Điểm 0 đến 10, bước 0,25");
  check("đủ mốc: 0, 10, 7, 7.5, 8.25, '7,5' (dấu phẩy Việt Nam), '8.75'", [0, 10, 7, 7.5, 8.25, "7,5", "8.75"].every(v => ok(parseScore(v))) && val(parseScore("7,5")) === 7.5);
  check("trống / null → để trống (xoá điểm)", val(parseScore("")) === null && val(parseScore(null)) === null && val(parseScore(undefined)) === null);
  check(`ngoài khoảng: -0.25, ${SCORE_MAX + 0.25}, 11, -1 → lỗi`, [-0.25, SCORE_MAX + 0.25, 11, -1].every(v => !ok(parseScore(v))));
  check("không đúng bước 0,25: 7.3, 7.1, 9.99 → lỗi", [7.3, 7.1, 9.99].every(v => !ok(parseScore(v))));
  check("không phải số: 'abc', NaN, Infinity, {}, [] → lỗi", ["abc", NaN, Infinity, {}, [], true].every(v => !ok(parseScore(v))));

  section("% hoàn thành BTVN");
  check("0, 100, '80', '80%' → hợp lệ", [0, PCT_MAX, "80", "80%", " 55 "].every(v => ok(parsePct(v))) && val(parsePct("80%")) === 80);
  check("101, -1, 80.5, 'x' → lỗi; trống → null", [101, -1, 80.5, "x", "1e2x"].every(v => !ok(parsePct(v))) && val(parsePct("")) === null);

  section("Danh sách điểm gửi lên");
  const r1 = parseScoreRows([{ userId: "u1", score: "7,5", homeworkPct: "80" }, { userId: "u2", score: null, homeworkPct: 40 }, { userId: "u3", score: "", homeworkPct: "" }]);
  check("đọc đúng, giữ cả dòng để xoá điểm (cả hai trống)", r1.errors.length === 0 && r1.rows.length === 3 && r1.rows[0].score === 7.5 && r1.rows[0].homeworkPct === 80 && r1.rows[2].score === null && r1.rows[2].homeworkPct === null);
  check("một giá trị sai → có lỗi nêu quy tắc, dòng sai không lọt", (() => { const r = parseScoreRows([{ userId: "u1", score: 11 }, { userId: "u2", score: 5 }]); return r.errors.length === 1 && r.errors[0].includes("0 đến 10") && r.rows.length === 1; })());
  check("BTVN sai → lỗi nêu 0 đến 100", parseScoreRows([{ userId: "u1", homeworkPct: 150 }]).errors[0].includes("0 đến 100"));
  check("một em hai lần → lỗi", parseScoreRows([{ userId: "u1", score: 1 }, { userId: "u1", score: 2 }]).errors.length === 1);
  check("không phải mảng / thiếu userId / rác → không ném lỗi", parseScoreRows("x").errors.length === 1 && parseScoreRows([null, 3, {}, { userId: 5 }]).rows.length === 0);
  check(`quá ${SCORE_ROWS_MAX} em → từ chối`, parseScoreRows(Array.from({ length: SCORE_ROWS_MAX + 1 }, (_, i) => ({ userId: `u${i}`, score: 1 }))).errors.length === 1);

  section("Chữ hiển thị");
  check("chip % luôn có chữ + mức: ≥80 xong, 50-79 chờ, <50 lỗi", pctChip(80).tone === "xong" && pctChip(79).tone === "cho" && pctChip(50).tone === "cho" && pctChip(49).tone === "loi" && pctChip(100).text === "Hoàn thành BTVN 100%");
  check("điểm kiểu Việt Nam: 7,5", scoreText(7.5) === "7,5" && scoreText(10) === "10");

  section("Gia đình dùng chung liên hệ (HS-12)");
  check("tạo: nhãn bắt buộc, chuẩn hoá SĐT, tên phụ huynh", (() => { const r = parseFamily({ label: "Gia đình Minh Anh", guardianName: "Chị Hoa", guardianPhone: "0912 345 678" }, false); return !r.error && r.data.guardianPhone === "0912345678" && r.data.label === "Gia đình Minh Anh"; })());
  check("thiếu nhãn → lỗi; nhãn quá 40 → lỗi", !!parseFamily({}, false).error && !!parseFamily({ label: "x".repeat(41) }, false).error && !parseFamily({ label: "x".repeat(40) }, false).error);
  check("SĐT sai → lỗi nêu 10 chữ số; để trống = xoá", parseFamily({ label: "a", guardianPhone: "09" }, false).error?.includes("10 chữ số") === true && parseFamily({ label: "a", guardianPhone: "" }, false).data.guardianPhone === null);
  check("sửa (partial) chỉ kiểm trường có mặt", Object.keys(parseFamily({ guardianName: "A" }, true).data).join() === "guardianName" && !parseFamily({ guardianName: "A" }, true).error);
  check("không nhận body rỗng / null", !!parseFamily(null, false).error);
  check("trần số gia đình có giá trị", FAMILIES_MAX >= 50);

  section("Quét tĩnh: điểm từng buổi KHÔNG lọt ra ngoài đường của gia sư / phụ huynh");
  const walk = (d: string, out: string[] = []) => { for (const n of readdirSync(join(process.cwd(), d))) { const p = join(d, n); if (statSync(join(process.cwd(), p)).isDirectory()) { if (n !== "generated") walk(p, out); } else if (/\.tsx?$/.test(p)) out.push(p); } return out; };
  const users = walk("src").filter(f => /sessionStudentScore|SessionStudentScore/.test(readFileSync(join(process.cwd(), f), "utf8")));
  const ALLOWED = new Set(["src/lib/sessionScoreServer.ts", "src/app/api/attendance-sessions/[id]/diem/route.ts", "src/app/api/tutor/ho-so/[id]/route.ts"]);
  check("chỉ 3 tệp được đụng bảng điểm: tải cho phụ huynh, API gia sư chủ lớp, xoá cùng hồ sơ", users.every(f => ALLOWED.has(f)) && users.length === ALLOWED.size, users);
  const pageSrc = readFileSync(join(process.cwd(), "src/lib/sessionScoreServer.ts"), "utf8");
  check("tải cho phụ huynh lọc theo đồng ý LÚC ĐỌC (scoreConsentFor) và theo đúng một em (userId: studentId)", /scoreConsentFor\(t, \[studentId\]\)/.test(pageSrc) && /userId: studentId/.test(pageSrc));
  const stuFiles = walk("src/app/(student)").concat(walk("src/app/api/student"), walk("src/app/api/users"));
  check("không có trang / API của học sinh nào nhắc tới điểm từng buổi", stuFiles.every(f => !/sessionStudentScore|loadPartyScores|SessionScores/.test(readFileSync(join(process.cwd(), f), "utf8"))));

  await done();
})();
