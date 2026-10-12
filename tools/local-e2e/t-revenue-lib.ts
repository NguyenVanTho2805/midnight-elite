import { vnMonthKey, vnDateKey, parseDateRange, rangeWhere, csvCell, toCsv, presetRange, allocateByWeights } from "@/lib/revenue";
import { check, section, done } from "./h";

section("vnMonthKey — ranh giới tháng theo giờ VN (UTC+7)");
check("30/09 20:00 UTC = 03:00 01/10 VN → 2026-10", vnMonthKey(new Date("2026-09-30T20:00:00Z")) === "2026-10");
check("30/09 16:59 UTC = 23:59 30/09 VN → 2026-09", vnMonthKey(new Date("2026-09-30T16:59:59Z")) === "2026-09");
check("31/12 17:00 UTC = 00:00 01/01 VN → năm mới", vnMonthKey(new Date("2026-12-31T17:00:00Z")) === "2027-01");
check("vnDateKey", vnDateKey(new Date("2026-09-30T20:00:00Z")) === "2026-10-01");

section("parseDateRange");
const ok = parseDateRange(new URLSearchParams("from=2026-10-01&to=2026-10-31")) as any;
check("hợp lệ: from = 00:00 VN = 17:00 UTC hôm trước", ok.from.toISOString() === "2026-09-30T17:00:00.000Z", ok);
check("to gồm cả ngày cuối: toExclusive = 00:00 VN ngày 01/11", ok.toExclusive.toISOString() === "2026-10-31T17:00:00.000Z", ok);
check("không truyền gì → null/null", JSON.stringify(parseDateRange(new URLSearchParams(""))) === JSON.stringify({ from: null, toExclusive: null }));
check("ngày không tồn tại 2026-02-31 → lỗi", "error" in (parseDateRange(new URLSearchParams("from=2026-02-31")) as any));
check("định dạng sai → lỗi", "error" in (parseDateRange(new URLSearchParams("from=01/10/2026")) as any));
check("from > to → lỗi", "error" in (parseDateRange(new URLSearchParams("from=2026-10-05&to=2026-10-01")) as any));
check("from = to hợp lệ (1 ngày)", !("error" in (parseDateRange(new URLSearchParams("from=2026-10-05&to=2026-10-05")) as any)));
check("rangeWhere rỗng → undefined", rangeWhere({ from: null, toExclusive: null }) === undefined);

section("presetRange (giờ VN)");
const now = new Date("2026-10-11T06:15:00Z"); // 13:15 ngày 11/10 giờ VN
check("tháng này: 2026-10-01 → 2026-10-11", JSON.stringify(presetRange("month", now)) === JSON.stringify({ from: "2026-10-01", to: "2026-10-11" }), presetRange("month", now));
check("30 ngày gồm hôm nay: 2026-09-12 → 2026-10-11", JSON.stringify(presetRange("30d", now)) === JSON.stringify({ from: "2026-09-12", to: "2026-10-11" }), presetRange("30d", now));
check("tất cả: rỗng", JSON.stringify(presetRange("all", now)) === JSON.stringify({ from: "", to: "" }));
const late = new Date("2026-09-30T20:30:00Z"); // đã sang 01/10 ở VN
check("23h+ UTC cuối tháng vẫn tính tháng mới theo VN", presetRange("month", late).from === "2026-10-01" && presetRange("month", late).to === "2026-10-01", presetRange("month", late));

section("allocateByWeights — chia tiền không lệch đồng");
check("720k theo 480k:240k = 480k + 240k", JSON.stringify(allocateByWeights(720000, [480000, 240000])) === "[480000,240000]");
check("100 chia 3 phần đều: tổng đúng 100", allocateByWeights(100, [1, 1, 1]).reduce((a, b) => a + b, 0) === 100 && allocateByWeights(100, [1, 1, 1]).join() === "34,33,33", allocateByWeights(100, [1, 1, 1]));
check("trả một phần 300k của phiếu 720k (480k/240k) → 200k + 100k", allocateByWeights(300000, [480000, 240000]).join() === "200000,100000");
const bad = [[7, [1, 2, 4]], [1, [1, 1]], [999_999, [333, 333, 334]], [0, [5, 5]], [13, [0, 0, 0]], [50_000, [0, 100]]] as const;
check("mọi ca: tổng các phần = total, không phần âm", bad.every(([t, w]) => { const r = allocateByWeights(t, [...w]); return r.reduce((a, b) => a + b, 0) === t && r.every(x => x >= 0 && Number.isInteger(x)); }), bad.map(([t, w]) => allocateByWeights(t, [...w])));
check("trọng số 0 hết → chia đều; có một trọng số dương → dồn hết vào đó", allocateByWeights(13, [0, 0, 0]).join() === "5,4,4" && allocateByWeights(50000, [0, 100]).join() === "0,50000");
check("mảng rỗng → rỗng", allocateByWeights(10, []).length === 0);

section("csvCell — RFC4180 + chống công thức");
check("chữ thường giữ nguyên", csvCell("Nguyễn Văn A") === "Nguyễn Văn A");
check("có dấu phẩy → bọc nháy kép", csvCell("A, B") === '"A, B"');
check("nháy kép được nhân đôi", csvCell('Say "hi"') === '"Say ""hi"""');
check("xuống dòng → bọc nháy", csvCell("a\nb") === '"a\nb"');
check("=HYPERLINK bị vô hiệu bằng nháy đơn", csvCell('=HYPERLINK("http://x")') === `"'=HYPERLINK(""http://x"")"`, csvCell('=HYPERLINK("http://x")'));
check("+cmd, -cmd, @SUM bị vô hiệu", csvCell("+1+1") === "'+1+1" && csvCell("-2") === "'-2" && csvCell("@SUM(A1)") === "'@SUM(A1)");
check("số giữ nguyên số (âm cũng không thêm nháy)", csvCell(-1200) === "-1200" && csvCell(300000) === "300000");
check("null/undefined → rỗng", csvCell(null) === "" && csvCell(undefined) === "");
const csv = toCsv([["Tên", "Tiền"], ["Lan", 300000]]);
check("toCsv có BOM + CRLF", csv.startsWith("﻿") && csv.includes("\r\n") && csv.endsWith("\r\n"));
done();
