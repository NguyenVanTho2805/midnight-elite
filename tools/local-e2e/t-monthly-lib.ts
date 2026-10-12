import { prevYearMonth, fmtScore, monthlyEffort, masteryForMonth, buildSubjectMetrics, suggestUnmetItems, sanitizeUnmetItems, renderReportText, EMPTY_UNMET_TEXT, type SubjectMonthMetrics } from "@/lib/monthlyReport";
import { check, section, done } from "./h";
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const d = (s: string) => new Date(`${s}T12:00:00+07:00`);
const MS = d("2026-09-01"), ME = d("2026-10-01"); // tháng 9/2026: [1/9, 1/10)
const sc = (score: number, day: string) => ({ score, takenAt: d(day) });

section("Tiện ích");
check("tháng trước (qua năm)", prevYearMonth("2026-10") === "2026-09" && prevYearMonth("2026-01") === "2025-12");
check("điểm in dấu phẩy, 1 chữ số", fmtScore(8.5) === "8,5" && fmtScore(7) === "7,0" && fmtScore(6.54) === "6,5" && fmtScore(8) === "8,0");

section("Nỗ lực (NV-186): làm tròn nguyên, tháng không giao bài thì = 10 × chuyên cần");
check("chuyên cần 100% + bài 100% = 10", monthlyEffort(1, { assigned: 4, onTime: 4 }) === 10);
check("0,9 và 50% → 10×(0,45+0,25)=7", monthlyEffort(0.9, { assigned: 4, onTime: 2 }) === 7);
check("không giao bài: chỉ chuyên cần (0,85 → 9 làm tròn)", monthlyEffort(0.85, { assigned: 0, onTime: 0 }) === 9);
check("chưa có buổi điểm danh → null (không ghi 0)", monthlyEffort(null, { assigned: 3, onTime: 3 }) === null);
check("chuyên cần 0 mà có đo → 0 (khác null)", monthlyEffort(0, { assigned: 0, onTime: 0 }) === 0);
check("kẹp trong 0..10", monthlyEffort(1.5, { assigned: 2, onTime: 5 }) === 10 && monthlyEffort(-1, { assigned: 2, onTime: -3 }) === 0);

section("Năng lực (NV-185): 3 bài gần nhất, nhãn theo đặc tả");
let m = masteryForMonth([], MS, ME, "8");
check("chưa có bài → 'Chưa đủ 3 bài', value null", m.code === "chua-du" && m.value === null && m.n === 0 && m.tone === "trung-tinh");
m = masteryForMonth([sc(9, "2026-09-05"), sc(7, "2026-09-12")], MS, ME, "8");
check("2 bài → 'Chưa đủ 3 bài' nhưng vẫn in các điểm đang có (cũ→mới) + trung bình tạm", m.code === "chua-du" && eq(m.scores, [9, 7]) && m.value === 8 && m.text === "Chưa đủ 3 bài");
m = masteryForMonth([sc(9, "2026-09-02"), sc(8, "2026-09-10"), sc(7, "2026-09-20")], MS, ME, "8");
check("TB đúng 8,0 → 'Đạt ngưỡng 8,0' (≥)", m.code === "dat" && m.value === 8 && m.text === "Đạt ngưỡng 8,0" && m.tone === "xong");
m = masteryForMonth([sc(9, "2026-09-02"), sc(7.9, "2026-09-10"), sc(7, "2026-09-20")], MS, ME, "8");
check("TB 7,97 dưới ngưỡng, trước tháng chưa có bài → 'Chưa đạt ngưỡng' (không phải 'tụt')", m.code === "chua-dat" && m.tone === "cho");
const prevGood = [sc(9, "2026-08-05"), sc(9, "2026-08-12"), sc(9, "2026-08-20")];
m = masteryForMonth([...prevGood, sc(7, "2026-09-05"), sc(6.5, "2026-09-15"), sc(6, "2026-09-25")], MS, ME, "8");
check("tháng trước TB 9 (đạt), tháng này TB 6,5 → 'Đang tụt · tháng 8 đã đạt'", m.code === "tut" && m.text === "Đang tụt · tháng 8 đã đạt" && m.value === 6.5 && eq(m.scores, [7, 6.5, 6]) && m.tone === "cho", m);
m = masteryForMonth([...prevGood, sc(7, "2026-09-05")], MS, ME, "8");
check("bài tháng trước vẫn được tính nếu nằm trong 3 bài gần nhất (2 bài 9 + 1 bài 7 = 8,3 → đạt)", m.code === "dat" && eq(m.scores, [9, 9, 7]));
m = masteryForMonth([sc(9, "2026-08-05"), sc(9, "2026-09-05"), sc(9, "2026-09-10"), sc(2, "2026-10-05")], MS, ME, "8");
check("bài làm SAU tháng báo cáo không tính", m.code === "dat" && m.scores.length === 3 && !m.scores.includes(2));
m = masteryForMonth([sc(1, "2026-07-01"), sc(9, "2026-08-05"), sc(9, "2026-09-05"), sc(9, "2026-09-10")], MS, ME, "8");
check("chỉ 3 bài gần nhất: bài cũ điểm thấp bị đẩy ra", m.code === "dat" && eq(m.scores, [9, 9, 9]));
check("năng lực KHÔNG BAO GIỜ có màu 'lỗi'", ["dat", "tut", "chua-dat", "chua-du"].length === 4 && ![masteryForMonth([], MS, ME, "8"), masteryForMonth([sc(1, "2026-09-01"), sc(1, "2026-09-02"), sc(1, "2026-09-03")], MS, ME, "8")].some(x => (x.tone as string) === "loi"));

section("Dòng gợi ý 'Điều chưa đạt' (NV-189)");
const subj = (name: string, hw: [number, number], att: number | null, scores: ReturnType<typeof sc>[]): SubjectMonthMetrics =>
  buildSubjectMetrics({ courseId: name, courseName: name, attendance: { attended: att ?? 0, total: att === null ? 0 : 10, ratio: att }, homework: { assigned: hw[0], onTime: hw[1] }, scores }, "2026-09", MS, ME);
const tut = subj("Toán", [4, 4], 1, [...prevGood, sc(7, "2026-09-05"), sc(6.5, "2026-09-15"), sc(6, "2026-09-25")]);
let u = suggestUnmetItems([tut], "2026-09");
check("1) môn đang tụt: kèm điểm ĐẦU và CUỐI của 3 bài gần nhất + tháng trước đã đạt", u.some(x => x.kind === "tut" && x.text.includes("từ 7,0 xuống 6,0") && x.text.includes("tháng 8 đã đạt")), u);
check("3) học chăm (Nỗ lực 10) mà chưa đạt → dòng nói về CÁCH DẠY", u.some(x => x.kind === "cach-day" && x.text.includes("Nỗ lực 10/10") && x.text.includes("cách dạy")), u);
check("không dòng nào quy lỗi cho học sinh ở loại 3", !u.find(x => x.kind === "cach-day")!.text.includes("em lười"));
u = suggestUnmetItems([subj("Lý", [10, 6], 0.8, [])], "2026-09");
check("2) bài về nhà 6/10 = 60% < 70% → có dòng", u.length === 1 && u[0].kind === "btvn" && u[0].text.includes("6/10 bài (60%)") && u[0].text.includes("70%"), u);
check("đúng 70% (7/10) → KHÔNG có dòng", suggestUnmetItems([subj("Lý", [10, 7], 0.8, [])], "2026-09").length === 0);
check("tháng không giao bài → không có dòng bài về nhà", suggestUnmetItems([subj("Lý", [0, 0], 1, [])], "2026-09").length === 0);
check("Nỗ lực 7 (dưới 8) mà chưa đạt → KHÔNG có dòng cách dạy", !suggestUnmetItems([subj("Hoá", [0, 0], 0.7, [sc(5, "2026-09-02"), sc(5, "2026-09-12"), sc(5, "2026-09-22")])], "2026-09").some(x => x.kind === "cach-day"));
check("chưa đủ 3 bài thì không kết luận (không có dòng tụt / cách dạy)", suggestUnmetItems([subj("Sử", [0, 0], 1, [sc(3, "2026-09-02")])], "2026-09").length === 0);
check("môn đạt ngưỡng + bài đầy đủ → rỗng", suggestUnmetItems([subj("Anh", [3, 3], 1, [sc(9, "2026-09-02"), sc(9, "2026-09-12"), sc(9, "2026-09-22")])], "2026-09").length === 0);
u = suggestUnmetItems([], "2026-09", [{ dateKey: "2026-09-17", courseName: "Toán", action: "doi" }, { dateKey: "2026-09-24", courseName: "Toán", action: "huy" }]);
check("4) buổi gia sư dời/huỷ: ghi rõ lỗi sắp xếp của gia sư", u.length === 2 && u[0].text.includes("17/09") && u[0].text.includes("dời") && u[1].text.includes("huỷ") && u.every(x => x.text.includes("lỗi sắp xếp của gia sư")), u);

section("Làm sạch danh sách gia sư sửa");
let sn = sanitizeUnmetItems([{ text: "  Toán   tụt  ", kind: "tut" }, { text: "   " }, { text: "Dòng gia sư tự viết" }, { text: "x", kind: "bậy" }]);
check("cắt khoảng trắng, bỏ dòng trống, kind lạ → 'tu-viet'", sn.ok && eq(sn.items, [{ text: "Toán tụt", kind: "tut" }, { text: "Dòng gia sư tự viết", kind: "tu-viet" }, { text: "x", kind: "tu-viet" }]), sn);
check("không phải mảng / phần tử không phải object / thiếu chữ → lỗi", !sanitizeUnmetItems("x").ok && !sanitizeUnmetItems([5]).ok && !sanitizeUnmetItems([{ kind: "tut" }]).ok && !sanitizeUnmetItems([null]).ok);
check("quá dài (>300) → lỗi; đúng 300 → ok", !sanitizeUnmetItems([{ text: "a".repeat(301) }]).ok && sanitizeUnmetItems([{ text: "a".repeat(300) }]).ok);
check("quá 12 dòng → lỗi; 12 dòng → ok; rỗng → ok", !sanitizeUnmetItems(Array.from({ length: 13 }, (_, i) => ({ text: `d${i}` }))).ok && sanitizeUnmetItems(Array.from({ length: 12 }, (_, i) => ({ text: `d${i}` }))).ok && eq((sanitizeUnmetItems([]) as any).items, []));

section("Văn bản gửi phụ huynh: mục cố định, hai thanh riêng, không xếp hạng");
const txt = renderReportText({ studentName: "Minh Anh", parentName: "Hoa", yearMonth: "2026-09", subjects: [tut], unmet: u.slice(0, 1), tutorName: "Cô Lan" });
check("luôn có mục 'Điều chưa đạt tháng này'", txt.includes("Điều chưa đạt tháng này:"));
check("có dòng chưa đạt thì liệt kê từng dòng sau dấu gạch", txt.includes(`- ${u[0].text}`) && !txt.includes(EMPTY_UNMET_TEXT));
const empty = renderReportText({ studentName: "Minh Anh", yearMonth: "2026-09", subjects: [], unmet: [] });
check("rỗng → đúng câu cố định 'Tháng này không có mục nào chưa đạt.'", empty.endsWith(EMPTY_UNMET_TEXT) && EMPTY_UNMET_TEXT === "Tháng này không có mục nào chưa đạt.");
check("Nỗ lực và Năng lực là HAI dòng riêng, không có điểm gộp, không thứ hạng", /- Nỗ lực: 10\/10/.test(txt) && /- Năng lực: 6,5\/10 \(7,0 · 6,5 · 6,0\) — Đang tụt · tháng 8 đã đạt/.test(txt) && !/hạng|xếp hạng|tổng điểm|điểm gộp/i.test(txt), txt);
check("xưng hô + tên gia sư", txt.startsWith("Kính gửi anh/chị Hoa,") && txt.endsWith("Cô Lan") && empty.startsWith("Kính gửi anh/chị,"));
check("chưa có buổi/bài: nói rõ 'chưa có', không ghi 0", /chưa có buổi điểm danh/.test(renderReportText({ studentName: "A", yearMonth: "2026-09", subjects: [subj("Sử", [0, 0], null, [])], unmet: [] })) && /Nỗ lực: chưa đo được/.test(renderReportText({ studentName: "A", yearMonth: "2026-09", subjects: [subj("Sử", [0, 0], null, [])], unmet: [] })) && /chưa có bài kiểm tra/.test(renderReportText({ studentName: "A", yearMonth: "2026-09", subjects: [subj("Sử", [0, 0], null, [])], unmet: [] })));
done();
