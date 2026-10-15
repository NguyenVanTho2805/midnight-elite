// Thư viện — phần thuần src/lib/library.ts: đọc tài liệu bài học (JSON thật + dạng cũ), loại tệp, thời lượng, nhãn xem, trạng thái bài nộp.
import { parseLessonDocuments, docKind, viewerHref, parseDurationSeconds, watchLabel, assignmentStatus, tutorAssignmentSummary, scoreText, shortDate } from "@/lib/library";
import { check, section, done } from "./h";

section("parseLessonDocuments — dạng JSON thật (admin lưu `[{name,url,type}]`)");
const json = JSON.stringify([{ name: "Phiếu bài tập Vi-ét.pdf", url: "https://res.cloudinary.com/x/raw/upload/a1.pdf", type: "pdf" }, { name: "Tóm tắt", url: "https://docs.google.com/document/d/abc/edit", type: "doc" }]);
const a = parseLessonDocuments(json);
check("đọc đủ 2 tài liệu, giữ tên + địa chỉ + loại", a.length === 2 && a[0].name === "Phiếu bài tập Vi-ét.pdf" && a[0].url.endsWith("a1.pdf") && a[0].type === "pdf" && a[1].name === "Tóm tắt", a);
check("mặc định của cột là '[]' → rỗng", parseLessonDocuments("[]").length === 0);
check("thiếu tên → dùng địa chỉ làm tên", parseLessonDocuments(JSON.stringify([{ url: "https://x.vn/f.pdf" }]))[0]?.name === "https://x.vn/f.pdf");
check("bỏ mục không có địa chỉ / địa chỉ không phải http(s) (javascript:, data:, đường dẫn tương đối, //host)", parseLessonDocuments(JSON.stringify([{ name: "a" }, { name: "b", url: "javascript:alert(1)" }, { name: "c", url: "data:text/html,x" }, { name: "d", url: "/etc/passwd" }, { name: "e", url: "//evil.example/x" }, { name: "ok", url: "http://ok.vn/x" }])).map(d => d.name).join(",") === "ok");
check("JSON hỏng / không phải mảng → rỗng, không ném lỗi", parseLessonDocuments("[{bad").length === 0 && parseLessonDocuments('{"url":"https://x.vn"}').length === 0 && parseLessonDocuments("[1,2,null]").length === 0);
check("null / undefined / rỗng / toàn khoảng trắng → rỗng", [null, undefined, "", "   ", "\n"].every(v => parseLessonDocuments(v as any).length === 0));
check("tối đa 50 tài liệu", parseLessonDocuments(JSON.stringify(Array.from({ length: 80 }, (_, i) => ({ name: `f${i}`, url: `https://x.vn/${i}` })))).length === 50);

section("parseLessonDocuments — dạng cũ 'nhãn|url' mỗi dòng (không mất dữ liệu cũ)");
const legacy = parseLessonDocuments("Đề số 1|https://x.vn/de1.pdf\nhttp://x.vn/khong-co-nhan\n|https://x.vn/chi-url.pdf\nrác không có url\nTrang|ftp://x.vn/sai");
check("đọc dòng có nhãn; thiếu nhãn thì lấy địa chỉ; bỏ dòng rác và ftp", legacy.map(d => d.name).join("|") === "Đề số 1|https://x.vn/chi-url.pdf" && legacy.length === 2, legacy);

section("docKind — nhãn loại tệp");
check("theo `type` đã lưu", docKind({ name: "x", url: "https://x.vn/a", type: "pdf" }) === "PDF" && docKind({ name: "x", url: "https://x.vn/a", type: "docx" }) === "DOC" && docKind({ name: "x", url: "https://x.vn/a", type: "xlsx" }) === "XLS" && docKind({ name: "x", url: "https://x.vn/a", type: "pptx" }) === "PPT");
check("theo đuôi tên tệp khi không có type", docKind({ name: "De.PDF", url: "https://x.vn/a" }) === "PDF" && docKind({ name: "bang.xlsx", url: "https://x.vn/a" }) === "XLS" && docKind({ name: "bai.docx", url: "https://x.vn/a" }) === "DOC" && docKind({ name: "s.pptx", url: "https://x.vn/a" }) === "PPT");
check("theo địa chỉ Google Docs / Sheets / Slides", docKind({ name: "x", url: "https://docs.google.com/document/d/1/edit" }) === "DOC" && docKind({ name: "x", url: "https://docs.google.com/spreadsheets/d/1" }) === "XLS" && docKind({ name: "x", url: "https://docs.google.com/presentation/d/1" }) === "PPT");
check("không nhận ra → FILE", docKind({ name: "ảnh.png", url: "https://x.vn/a.png" }) === "FILE" && docKind({ name: "x", url: "https://x.vn/a" }) === "FILE");

section("viewerHref");
check("mã hoá địa chỉ và tên (có dấu, có &)", viewerHref("Đề & đáp án.pdf", "https://x.vn/a?b=1&c=2") === "/xem-tai-lieu?url=https%3A%2F%2Fx.vn%2Fa%3Fb%3D1%26c%3D2&name=%C4%90%E1%BB%81%20%26%20%C4%91%C3%A1p%20%C3%A1n.pdf");

section("parseDurationSeconds");
for (const [raw, sec] of [["1:52:04", 6724], ["52:04", 3124], ["0:45", 45], ["45 phút", 2700], ["45 phut", 2700], ["45p", 2700], ["1 giờ 52 phút", 6720], ["2h", 7200], ["90", 5400]] as const)
  check(`${JSON.stringify(raw)} → ${sec}s`, parseDurationSeconds(raw) === sec, parseDurationSeconds(raw));
check("không hiểu / rỗng / null → null", parseDurationSeconds("khoảng một lúc") === null && parseDurationSeconds("") === null && parseDurationSeconds(null) === null && parseDurationSeconds(undefined) === null);

section("watchLabel — nhãn xem video");
check("chưa có tiến độ → 'Chưa xem' (trung tính)", eq(watchLabel(null, 3000), { label: "Chưa xem", tone: "mo" }) && eq(watchLabel(0, 3000), { label: "Chưa xem", tone: "mo" }) && eq(watchLabel(undefined, null), { label: "Chưa xem", tone: "mo" }));
check("xem dở → 'Đã xem N phút' (vàng), làm tròn, tối thiểu 1 phút", eq(watchLabel(2280, 6724), { label: "Đã xem 38 phút", tone: "cho" }) && eq(watchLabel(20, 6724), { label: "Đã xem 1 phút", tone: "cho" }));
check("từ 90% thời lượng → 'Đã xem xong' (xanh)", eq(watchLabel(6100, 6724), { label: "Đã xem xong", tone: "xong" }) && eq(watchLabel(6724, 6724), { label: "Đã xem xong", tone: "xong" }));
check("không biết thời lượng thì không bao giờ báo 'xong'", eq(watchLabel(99999, null), { label: "Đã xem 1667 phút", tone: "cho" }));
function eq(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b); }

section("assignmentStatus — trạng thái bài tập của học viên");
const now = new Date("2026-10-14T05:00:00Z");
const past = new Date("2026-10-10T05:00:00Z"), future = new Date("2026-10-20T05:00:00Z");
check("chưa nộp, còn hạn → 'Chưa nộp · hạn dd/mm' (vàng)", eq(assignmentStatus({ dueDate: future, maxPoints: 25 }, null, now), { label: "Chưa nộp · hạn 20/10", tone: "cho" }), assignmentStatus({ dueDate: future, maxPoints: 25 }, null, now));
check("chưa nộp, quá hạn → 'Quá hạn · chưa nộp' (đỏ)", eq(assignmentStatus({ dueDate: past, maxPoints: 25 }, null, now), { label: "Quá hạn · chưa nộp", tone: "loi" }));
check("chưa nộp, không hạn → 'Chưa nộp' (trung tính)", eq(assignmentStatus({ dueDate: null, maxPoints: 10 }, null, now), { label: "Chưa nộp", tone: "mo" }));
check("đã nộp, chưa chấm → 'Đã nộp · chờ chấm'", eq(assignmentStatus({ dueDate: past, maxPoints: 25 }, { score: null, gradedAt: null }, now), { label: "Đã nộp · chờ chấm", tone: "cho" }));
check("đã chấm → 'Đã chấm · 18,4/25' (dấu phẩy kiểu Việt)", eq(assignmentStatus({ dueDate: past, maxPoints: 25 }, { score: 18.4, gradedAt: now }, now), { label: "Đã chấm · 18,4/25", tone: "xong" }));
check("đã chấm 0 điểm vẫn là 'đã chấm' (không nhầm 0 với chưa chấm)", eq(assignmentStatus({ dueDate: past, maxPoints: 10 }, { score: 0, gradedAt: now }, now), { label: "Đã chấm · 0/10", tone: "xong" }));
check("có điểm nhưng thiếu ngày chấm → coi là chờ chấm (không tin dữ liệu nửa vời)", eq(assignmentStatus({ dueDate: past, maxPoints: 10 }, { score: 7, gradedAt: null }, now), { label: "Đã nộp · chờ chấm", tone: "cho" }));
check("scoreText làm tròn 1 chữ số, bỏ '.0'", scoreText(18.44) === "18,4" && scoreText(25) === "25" && scoreText(7.96) === "8" && scoreText(0) === "0");
check("shortDate theo giờ Việt Nam (23:30 UTC đã sang ngày hôm sau)", shortDate(new Date("2026-10-14T23:30:00Z")) === "15/10" && shortDate(new Date("2026-10-14T16:59:00Z")) === "14/10");

section("tutorAssignmentSummary");
check("chưa ai nộp / còn chờ chấm / chấm hết", eq(tutorAssignmentSummary(0, 0), { label: "Chưa có bài nộp", tone: "mo" }) && eq(tutorAssignmentSummary(5, 2), { label: "5 bài nộp · 2 chờ chấm", tone: "cho" }) && eq(tutorAssignmentSummary(5, 0), { label: "5 bài nộp · đã chấm hết", tone: "xong" }));

done();
