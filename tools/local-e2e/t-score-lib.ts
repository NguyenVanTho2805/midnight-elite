// FE-099 — logic thuần của điểm chuẩn: kiểm dữ liệu, CSV/JSON, gom nhóm, so sánh chỉ khi cùng thang.
import { check, section, done } from "./h";
import {
  cleanSourceUrl, parseScoreNumber, parseScoreInput, parseCsv, parseImportText, formatScore, groupScores, scoreDelta,
  recentYears, filterGroups, scoreKey, METHOD_KEYS, sourceNameFromUrl, type PublicScore,
} from "@/lib/admissionScore";
import { SEED_SCORES } from "@/lib/admissionScoreSeed";

const NOW = new Date("2026-10-12T00:00:00Z");
const ok = { school: "ĐH A", major: "CNTT", year: 2025, method: "thpt", score: "28,5", scale: 30, sourceUrl: "https://example.edu.vn/a" };
const bad = (patch: Record<string, unknown>) => parseScoreInput({ ...ok, ...patch }, NOW);

section("Đường dẫn nguồn");
check("https/http hợp lệ được chuẩn hoá", cleanSourceUrl("https://example.edu.vn/a b") === "https://example.edu.vn/a%20b" && cleanSourceUrl(" http://x.vn/y ") === "http://x.vn/y");
check("javascript:, data:, ftp:, file: bị từ chối", ["javascript:alert(1)", "data:text/html,x", "ftp://a.vn/x", "file:///etc/passwd", "//evil.vn"].every(u => cleanSourceUrl(u) === null));
check("URL có tên/mật khẩu (https://tin-cay.vn@evil.vn) bị từ chối", cleanSourceUrl("https://tin-cay.vn@evil.vn/x") === null && cleanSourceUrl("https://u:p@a.vn/") === null);
check("host không có dấu chấm (localhost, mạng nội bộ) bị từ chối", cleanSourceUrl("http://localhost:3000/x") === null && cleanSourceUrl("http://intranet/x") === null);
check("rỗng / không phải chuỗi / quá 500 ký tự → null", cleanSourceUrl("") === null && cleanSourceUrl(null) === null && cleanSourceUrl(5) === null && cleanSourceUrl("https://a.vn/" + "x".repeat(500)) === null);
check("tên nguồn lấy từ tên miền, bỏ www.", sourceNameFromUrl("https://www.tuoitre.vn/a") === "tuoitre.vn");

section("Số điểm");
check("nhận 28,5 / 28.5 / 28 / số", parseScoreNumber("28,5") === 28.5 && parseScoreNumber("28.5") === 28.5 && parseScoreNumber("28") === 28 && parseScoreNumber(28.5) === 28.5);
check("từ chối chữ, âm, rỗng, NaN, 1e3, '28,5,1'", ["abc", "-1", "", "  ", "1e3", "28,5,1", "28.", ".5"].every(v => parseScoreNumber(v) === null) && parseScoreNumber(NaN) === null && parseScoreNumber(Infinity) === null && parseScoreNumber(undefined) === null);
check("định dạng hiển thị dùng dấu phẩy, bỏ số 0 thừa", formatScore(29.19) === "29,19" && formatScore(28.5) === "28,5" && formatScore(85) === "85" && formatScore(28.1 + 0.05) === "28,15");

section("Kiểm một dòng");
const good = parseScoreInput(ok, NOW);
check("dòng hợp lệ: điểm 28,5 → 28.5; tên nguồn mặc định = tên miền; chưa đối chiếu, công khai", good.ok && good.value.score === 28.5 && good.value.sourceName === "example.edu.vn" && good.value.verified === false && good.value.published === true && good.value.variant === "", good);
check("khoảng trắng thừa được gọn", parseScoreInput({ ...ok, school: "  ĐH   A  ", major: " CNTT\n" }, NOW).ok && (parseScoreInput({ ...ok, school: "  ĐH   A  " }, NOW) as any).value.school === "ĐH A");
const nfd = "Đại học Bách khoa".normalize("NFD"), nfc = "Đại học Bách khoa".normalize("NFC");
check("chữ có dấu dạng tổ hợp (NFD, hay gặp khi dán từ Mac/Excel) được chuẩn hoá về NFC → khoá khớp với bản gõ thường", nfd !== nfc && (bad({ school: nfd }) as any).value.school === nfc && scoreKey((bad({ school: nfd }) as any).value) === scoreKey((bad({ school: nfc }) as any).value));
check("thiếu trường / ngành → từ chối", !bad({ school: "" }).ok && !bad({ major: "   " }).ok && !parseScoreInput(null, NOW).ok && !parseScoreInput([], NOW).ok && !parseScoreInput("x", NOW).ok);
check("quá dài → từ chối (trường 120, ngành 150, chương trình 80, ghi chú 300)", !bad({ school: "a".repeat(121) }).ok && !bad({ major: "a".repeat(151) }).ok && !bad({ variant: "a".repeat(81) }).ok && !bad({ note: "a".repeat(301) }).ok && bad({ school: "a".repeat(120) }).ok);
check("năm: 2015..năm sau (2027 khi đang 2026); ngoài khoảng / không nguyên / chữ → từ chối; '2025' dạng chuỗi được", bad({ year: 2014 }).ok === false && bad({ year: 2028 }).ok === false && bad({ year: 2026 }).ok && bad({ year: 2027 }).ok && bad({ year: 2025.5 }).ok === false && bad({ year: "abc" }).ok === false && bad({ year: "2025" }).ok && bad({ year: undefined }).ok === false);
check("phương thức phải thuộc danh sách", METHOD_KEYS.every(m => bad({ method: m }).ok) && !bad({ method: "khong-co" }).ok && !bad({ method: "" }).ok);
check("thang: nguyên 1..2000; 0, âm, 30,5, chữ → từ chối", bad({ scale: 150 }).ok && bad({ scale: "1200" }).ok && !bad({ scale: 0 }).ok && !bad({ scale: 2001 }).ok && !bad({ scale: 30.5 }).ok && !bad({ scale: "x" }).ok);
check("điểm phải > 0 và không vượt thang (30,01/30 bị từ chối; đúng 30 được)", !bad({ score: "30,01" }).ok && bad({ score: "30" }).ok && !bad({ score: 0 }).ok && !bad({ score: -5 }).ok && !bad({ score: "" }).ok);
check("điểm tối đa 2 chữ số thập phân", !bad({ score: "28,123" }).ok && bad({ score: "28,12" }).ok);
check("KHÔNG nhận điểm không có nguồn / nguồn sai", !bad({ sourceUrl: "" }).ok && !bad({ sourceUrl: undefined }).ok && !bad({ sourceUrl: "javascript:alert(1)" }).ok && /nguồn/i.test((bad({ sourceUrl: "" }) as any).error));
check("verified/published: nhận 'có/không/x/true/false'; giá trị lạ → từ chối", (bad({ verified: "có" }) as any).value.verified === true && (bad({ published: "không" }) as any).value.published === false && (bad({ verified: "x" }) as any).value.verified === true && !bad({ verified: "maybe" }).ok && !bad({ published: 7 }).ok);
check("tên nguồn tối đa 80", !bad({ sourceName: "a".repeat(81) }).ok);

section("CSV");
check("CSV cơ bản + ngoặc kép chứa dấu phẩy và dấu nháy kép", JSON.stringify(parseCsv('a,b,c\n1,"x, y","say ""hi"""')) === JSON.stringify([["a", "b", "c"], ["1", "x, y", 'say "hi"']]));
check("dấu ; (Excel tiếng Việt) và Tab (dán từ Google Sheets) được tự nhận", JSON.stringify(parseCsv("a;b\n1;2")) === JSON.stringify([["a", "b"], ["1", "2"]]) && JSON.stringify(parseCsv("a\tb\n1\t2")) === JSON.stringify([["a", "b"], ["1", "2"]]));
check("BOM + CRLF + dòng trống cuối được bỏ qua", JSON.stringify(parseCsv("﻿a,b\r\n1,2\r\n\r\n")) === JSON.stringify([["a", "b"], ["1", "2"]]));
check("ô nhiều dòng trong ngoặc kép giữ nguyên xuống dòng", parseCsv('a,b\n"x\ny",2')[1][0] === "x\ny");

section("Nhập hàng loạt");
const head = "school,major,variant,year,method,score,scale,sourceUrl,sourceName,note,verified,published";
const csv = [head, "ĐH A,CNTT,,2025,thpt,28.5,30,https://a.edu.vn/x,A,,false,true", 'ĐH A,"Kinh tế, đối ngoại",Tiên tiến,2025,thpt,"27,5",30,https://a.edu.vn/y,,,x,'].join("\n");
const r1 = parseImportText(csv, NOW);
check("CSV hợp lệ 2 dòng: 0 lỗi; 'x' = đã đối chiếu; ô published trống = công khai; điểm '27,5' đọc đúng", r1.errors.length === 0 && r1.rows.length === 2 && r1.rows[1].verified === true && r1.rows[1].published === true && r1.rows[1].score === 27.5 && r1.rows[1].major === "Kinh tế, đối ngoại", r1);
const r2 = parseImportText([head, "ĐH A,CNTT,,2025,thpt,28.5,30,https://a.edu.vn/x,,,,", "ĐH B,Y,,2025,thpt,31,30,https://b.edu.vn/x,,,,", "ĐH C,Y,,2025,sai,20,30,https://c.edu.vn/x,,,,", "ĐH D,Y,,2025,thpt,20,30,javascript:x,,,,"].join("\n"), NOW);
check("báo lỗi ĐÚNG SỐ DÒNG của từng dòng hỏng (3, 4, 5), dòng tốt vẫn được đếm", r2.rows.length === 1 && JSON.stringify(r2.errors.map(e => e.line)) === "[3,4,5]" && /vượt thang/.test(r2.errors[0].error) && /Phương thức/.test(r2.errors[1].error) && /nguồn/.test(r2.errors[2].error), r2.errors);
const r3 = parseImportText([head, "ĐH A,CNTT,,2025,thpt,28.5,30,https://a.edu.vn/x,,,,", "đh a,cntt,,2025,thpt,28.6,30,https://a.edu.vn/z,,,,"].join("\n"), NOW);
check("hai dòng trùng khoá (không phân biệt hoa thường) → dòng sau báo trùng với dòng trước", r3.errors.length === 1 && r3.errors[0].line === 3 && /Trùng với dòng 2/.test(r3.errors[0].error), r3.errors);
check("thiếu cột bắt buộc / cột lạ → báo ở dòng tiêu đề, không nhập gì", parseImportText("school,major\nA,B", NOW).errors[0].line === 1 && /thiếu cột/.test(parseImportText("school,major\nA,B", NOW).errors[0].error) && /không nhận ra/.test(parseImportText(head + ",abc\nA", NOW).errors[0].error));
const r4 = parseImportText(JSON.stringify([{ ...ok, score: 28.5 }, { ...ok, major: "Y", score: 99 }]), NOW);
check("JSON: mảng 2 dòng, dòng 2 vượt thang → lỗi dòng 2", r4.rows.length === 1 && r4.errors.length === 1 && r4.errors[0].line === 2, r4);
check("JSON hỏng / không phải mảng / rỗng → lỗi rõ ràng", parseImportText("[{", NOW).errors.length === 1 && parseImportText('{"a":1}', NOW).errors[0].error.includes("mảng") && parseImportText("   ", NOW).errors.length === 1 && parseImportText("[]", NOW).errors.length === 1);
check("quá 500 dòng bị chặn", parseImportText(JSON.stringify(Array.from({ length: 501 }, (_, i) => ({ ...ok, year: 2020 + (i % 6), major: `M${i}` }))), NOW).errors[0].error.includes("500"));
check("nội dung quá 200.000 ký tự bị chặn", parseImportText("a".repeat(200_001), NOW).errors[0].error.includes("quá dài"));

section("Gom nhóm + so sánh");
const P = (o: Partial<PublicScore> & { year: number; score: number }): PublicScore => ({ id: `${o.year}-${o.score}-${o.scale ?? 30}-${o.method ?? "thpt"}`, school: "ĐH A", major: "CNTT", variant: "", method: "thpt", scale: 30, note: null, sourceUrl: "https://a.vn/x", sourceName: "A", verified: false, ...o });
const rows = [P({ year: 2024, score: 28.53 }), P({ year: 2025, score: 29.19 }), P({ year: 2025, score: 85.41, scale: 100, method: "tong-hop" }), P({ year: 2024, score: 84.16, scale: 90, method: "tong-hop" }), P({ year: 2025, school: "ĐH Ă", score: 20 }), P({ year: 2023, score: 27 })];
const groups = groupScores(rows);
check("gom theo (trường, ngành, chương trình, phương thức): 3 nhóm; năm sắp mới → cũ", groups.length === 3 && groups[0].entries.map(e => e.year).join() === "2025,2024,2023" && groups[0].method === "thpt");
check("trường sắp theo tiếng Việt (ĐH A trước ĐH Ă)", groups.map(g => g.school).join("|") === "ĐH A|ĐH A|ĐH Ă");
check("cùng thang, năm liền kề → chênh lệch 0,66 (không dính lỗi số thực)", scoreDelta(groups[0].entries[0], groups[0].entries[1]) === 0.66);
const hc = groups.find(g => g.method === "tong-hop")!;
check("KHÁC THANG (100 vs 90) → null, không so gượng", scoreDelta(hc.entries[0], hc.entries[1]) === null);
check("thiếu năm liền trước (2025 vs 2023) → null; không có năm trước → null", scoreDelta(P({ year: 2025, score: 29 }), P({ year: 2023, score: 27 })) === null && scoreDelta(P({ year: 2025, score: 29 }), undefined) === null);
check("giảm điểm cho số âm", scoreDelta(P({ year: 2025, score: 28 }), P({ year: 2024, score: 28.5 })) === -0.5);
check("recentYears: mới → cũ, tối đa n, không trùng", recentYears(rows, 2).join() === "2025,2024" && recentYears(rows).join() === "2025,2024,2023" && recentYears([]).length === 0);
check("lọc: theo từ khoá không phân biệt hoa thường, theo phương thức, kết hợp", filterGroups(groups, "cntt", "").length === 3 && filterGroups(groups, "", "tong-hop").length === 1 && filterGroups(groups, "ĂĂ", "").length === 0 && filterGroups(groups, "đh ă", "thpt").length === 1 && filterGroups(groups, "đh ă", "tong-hop").length === 0);
check("khoá dòng không phân biệt hoa thường", scoreKey({ school: "A", major: "B", variant: "", year: 2025, method: "thpt" }) === scoreKey({ school: "a", major: "b", variant: "", year: 2025, method: "thpt" }));

section("Dữ liệu khởi đầu (SEED_SCORES)");
check("có dữ liệu", SEED_SCORES.length >= 6);
check("MỌI dòng qua bộ kiểm như dữ liệu nhập tay (điểm ≤ thang, nguồn http(s) hợp lệ, phương thức hợp lệ)", SEED_SCORES.every(s => parseScoreInput(s, NOW).ok), SEED_SCORES.filter(s => !parseScoreInput(s, NOW).ok).map(s => s.major));
check("MỌI dòng có nguồn riêng + tên nguồn; KHÔNG dòng nào tự nhận 'đã đối chiếu' (chưa mở được trang chính thức của trường)", SEED_SCORES.every(s => cleanSourceUrl(s.sourceUrl) && s.sourceName.length > 0 && s.verified === false));
check("khoá không trùng nhau", new Set(SEED_SCORES.map(scoreKey)).size === SEED_SCORES.length);
check("không có thang điểm bịa: chỉ 30/90/100", SEED_SCORES.every(s => [30, 90, 100].includes(s.scale)));
const hcmut = SEED_SCORES.filter(s => s.major.includes("mã 106"));
check("Bách khoa TP.HCM 2024 (thang 90) và 2025 (thang 100) đều có, ghi chú nhắc không so trực tiếp", hcmut.length === 2 && new Set(hcmut.map(s => s.scale)).size === 2 && hcmut.some(s => /KHÔNG so/.test(s.note)));
done();
