// LOI-03 — hàm thuần của "Lớp của tôi" + phiếu "Hôm nay có lớp" (src/lib/studentLop.ts). Thuần, không DB, không máy chủ.
// Chạy HAI lần, kết quả phải giống hệt (ngày giờ VN không được phụ thuộc TZ máy):
//   source tools/local-e2e/env.sh && TZ=UTC npx tsx tools/local-e2e/t-loi03-lib.ts
//   source tools/local-e2e/env.sh && TZ=America/Los_Angeles npx tsx tools/local-e2e/t-loi03-lib.ts
//
// CA PHÁ CỐ Ý (người viết đã thử từng ca trên một BẢN SAO của studentLop.ts, mỗi ca làm bài ĐỎ, rồi bỏ bản sao — src/ không bị sửa):
//   (1) chiaHomNay/vnTimeHHmm dùng getFullYear/getMonth/getDate/getHours (giờ máy) thay cho cộng 7 giờ  ⇒ ca "00:30 VN 12/11" đỏ dưới TZ=UTC
//       (và ca "23:30 VN" đỏ dưới TZ=America/Los_Angeles).
//   (2) lopProgress đếm mọi id trong `completed` (completed.size)                                         ⇒ ca "id ngoài lớp" đỏ.
//   (3) lopProgress dùng Math.round thay Math.floor                                                        ⇒ ca 199/200 đỏ.
//   (4) hocTiep bỏ `watching`                                                                              ⇒ ca "dang-xem" đỏ.
//   (5) chiaHomNay biên `dateKey <= lastKey` thành `<`                                                     ⇒ ca "18/11 23:59 VN" đỏ.
//   (6) orderedLessonIds dùng `status !== "draft"`                                                        ⇒ ca "hidden / null / Published" đỏ.
import { check, section, done } from "./h";
import {
  orderedLessonIds, lopProgress, hocTiep, hocTiepLabel, HOC_TIEP_LABEL, lopTrangThai, LOP_TRANG_THAI_LABEL, locLop, demLoc, giaSuLabel,
  vnTimeHHmm, vnDayTitle, vnDayLong, vnWindow, chiaHomNay, lessonMetaParts, contentSummary, chapterNo, docLinks, azotaLinks,
  type TreeSection,
} from "@/lib/studentLop";

console.log(`TZ=${process.env.TZ ?? "(máy)"} · getTimezoneOffset=${new Date("2026-11-11T12:00:00Z").getTimezoneOffset()}`);
const S = (ids: string[]) => new Set(ids);
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

section("orderedLessonIds — chỉ bài Đã đăng, đúng thứ tự phần → chương → bài");
{
  const tree: TreeSection[] = [
    { id: "s1", chapters: [
      { id: "c1", title: "Chương 1", lessons: [{ id: "a", title: "A", status: "published" }, { id: "nhap", title: "N", status: "draft" }, { id: "b", title: "B", status: "published" }] },
      { id: "c2", title: "Chương 2", lessons: [{ id: "an", title: "H", status: "hidden" }, { id: "rong", title: "R", status: null }, { id: "hoa", title: "P", status: "Published" }, { id: "c", title: "C", status: "published" }] },
    ] },
    { id: "s2", chapters: [{ id: "c3", title: "Chương 3", lessons: [{ id: "khong", title: "U" }, { id: "d", title: "D", status: "published" }] }] },
  ];
  const ids = orderedLessonIds(tree);
  check("giữ đúng a, b, c, d theo thứ tự", eq(ids, ["a", "b", "c", "d"]), ids);
  check("bỏ draft", !ids.includes("nhap"));
  check("bỏ hidden / null / \"Published\" (sai hoa) / thiếu status — ĐÓNG KHI LẠ", ["an", "rong", "hoa", "khong"].every(x => !ids.includes(x)), ids);
  check("cây rỗng ⇒ []", eq(orderedLessonIds([]), []));
}

section("lopProgress — x/y/% chỉ trong lớp");
{
  check("id ngoài lớp không đếm (1/3 ⇒ 33%)", eq(lopProgress(["a", "b", "c"], S(["a", "x", "y", "z"])), { done: 1, total: 3, pct: 33 }), lopProgress(["a", "b", "c"], S(["a", "x", "y", "z"])));
  check("0 bài ⇒ 0/0/0%", eq(lopProgress([], S(["a"])), { done: 0, total: 0, pct: 0 }));
  const ids200 = Array.from({ length: 200 }, (_, i) => `l${i}`);
  const p199 = lopProgress(ids200, S(ids200.slice(0, 199)));
  check("199/200 ⇒ 99% (không làm tròn lên 100)", p199.pct === 99 && p199.done === 199 && p199.total === 200, p199);
  check("200/200 ⇒ 100%", lopProgress(ids200, S(ids200)).pct === 100);
  const over = lopProgress(["a", "b"], S(["a", "b", "c", "d", "e"]));
  check("completed nhiều hơn lớp ⇒ done ≤ total, pct ≤ 100", over.done === 2 && over.total === 2 && over.pct === 100, over);
  check("1/3 ⇒ 33, 2/3 ⇒ 66 (floor)", lopProgress(["a", "b", "c"], S(["a", "b"])).pct === 66);
}

section("hocTiep — bài dở theo thứ tự giáo trình, không bịa 'gần nhất'");
{
  const ids = ["b1", "b2", "b3", "b4"];
  const r1 = hocTiep(ids, S([]), S(["b3"]));
  check("bài 3 đang xem dở, bài 1-2 chưa học ⇒ b3 'dang-xem'", r1.lessonId === "b3" && r1.reason === "dang-xem", r1);
  const r1b = hocTiep(ids, S(["b3"]), S(["b3", "b4"]));
  check("bài xem dở nhưng đã xong thì không tính ⇒ b4 'dang-xem'", r1b.lessonId === "b4" && r1b.reason === "dang-xem", r1b);
  const r2 = hocTiep(ids, S(["b1"]), S([]));
  check("không xem dở ⇒ bài chưa xong đầu tiên 'chua-hoc'", r2.lessonId === "b2" && r2.reason === "chua-hoc", r2);
  const r3 = hocTiep(ids, S(ids), S([]));
  check("xong hết ⇒ bài đầu 'on-lai'", r3.lessonId === "b1" && r3.reason === "on-lai", r3);
  const r4 = hocTiep([], S([]), S([]));
  check("rỗng ⇒ null 'trong'", r4.lessonId === null && r4.reason === "trong", r4);
  const r5 = hocTiep(ids, S([]), S(["b2"]), S(["b1", "b2"]));
  check("bài khoá bị bỏ qua (b2 xem dở nhưng khoá ⇒ b3 'chua-hoc')", r5.lessonId === "b3" && r5.reason === "chua-hoc", r5);
  check("tiến độ bài ngoài lớp không làm 'Học tiếp' trỏ ra ngoài", hocTiep(ids, S([]), S(["ngoai"])).lessonId === "b1");
  check("nhãn: Học tiếp / Bắt đầu học / Xem lại / Vào lớp",
    hocTiepLabel("dang-xem", 0) === "Học tiếp →" && hocTiepLabel("chua-hoc", 0) === "Bắt đầu học →" && hocTiepLabel("chua-hoc", 2) === "Học tiếp →"
    && hocTiepLabel("on-lai", 4) === "Xem lại →" && hocTiepLabel("trong", 0) === "Vào lớp" && HOC_TIEP_LABEL["on-lai"] === "Xem lại →");
}

section("Trạng thái lớp + lọc");
{
  check("lopTrangThai: 0/0 ⇒ dang-hoc; 3/4 ⇒ dang-hoc; 4/4 ⇒ hoan-thanh",
    lopTrangThai({ done: 0, total: 0 }) === "dang-hoc" && lopTrangThai({ done: 3, total: 4 }) === "dang-hoc" && lopTrangThai({ done: 4, total: 4 }) === "hoan-thanh");
  check("nhãn chữ", LOP_TRANG_THAI_LABEL["dang-hoc"] === "Đang học" && LOP_TRANG_THAI_LABEL["hoan-thanh"] === "Hoàn thành");
  const rows = [{ id: "1", trangThai: "dang-hoc" as const }, { id: "2", trangThai: "hoan-thanh" as const }, { id: "3", trangThai: "dang-hoc" as const }];
  check("locLop tat-ca giữ thứ tự, không trả cùng mảng", eq(locLop(rows, "tat-ca").map(r => r.id), ["1", "2", "3"]) && locLop(rows, "tat-ca") !== rows);
  check("locLop dang-hoc / hoan-thanh", eq(locLop(rows, "dang-hoc").map(r => r.id), ["1", "3"]) && eq(locLop(rows, "hoan-thanh").map(r => r.id), ["2"]));
  check("demLoc", eq(demLoc(rows), { "tat-ca": 3, "dang-hoc": 2, "hoan-thanh": 1 }));
  check("giaSuLabel: 'KiN' / 'kin ' / rỗng / null ⇒ ''; 'Cô Lan' ⇒ 'Gia sư: Cô Lan'",
    giaSuLabel("KiN") === "" && giaSuLabel(" kin ") === "" && giaSuLabel("") === "" && giaSuLabel(null) === "" && giaSuLabel(undefined) === "" && giaSuLabel(" Cô Lan ") === "Gia sư: Cô Lan");
}

section("Giờ VN — không phụ thuộc TZ máy");
{
  check("vnTimeHHmm 12:30Z ⇒ 19:30; 16:30Z ⇒ 23:30; 17:30Z ⇒ 00:30",
    vnTimeHHmm(new Date("2026-11-11T12:30:00Z")) === "19:30" && vnTimeHHmm(new Date("2026-11-11T16:30:00Z")) === "23:30" && vnTimeHHmm(new Date("2026-11-11T17:30:00Z")) === "00:30");
  check("vnDayTitle: Hôm nay / Ngày mai / T7, 14/11 / CN, 15/11",
    vnDayTitle("2026-11-11", "2026-11-11") === "Hôm nay" && vnDayTitle("2026-11-12", "2026-11-11") === "Ngày mai"
    && vnDayTitle("2026-11-14", "2026-11-11") === "T7, 14/11" && vnDayTitle("2026-11-15", "2026-11-11") === "CN, 15/11",
    [vnDayTitle("2026-11-14", "2026-11-11"), vnDayTitle("2026-11-15", "2026-11-11")]);
  check("vnDayTitle qua năm: 31/12 → 01/01 là 'Ngày mai'", vnDayTitle("2027-01-01", "2026-12-31") === "Ngày mai");
  check("vnDayTitle dateKey hỏng ⇒ ''", vnDayTitle("x", "2026-11-11") === "" && vnDayTitle("2026-02-31", "2026-11-11") === "");
  check("vnDayLong 11/11/2026 ⇒ 'Thứ Tư, 11/11'", vnDayLong("2026-11-11") === "Thứ Tư, 11/11", vnDayLong("2026-11-11"));
  const w = vnWindow(new Date("2026-11-11T05:00:00Z"));
  check("vnWindow(11/11 VN): from 2026-11-10T17:00Z, until 2026-11-18T17:00Z",
    w.todayKey === "2026-11-11" && w.from.toISOString() === "2026-11-10T17:00:00.000Z" && w.until.toISOString() === "2026-11-18T17:00:00.000Z",
    { k: w.todayKey, f: w.from.toISOString(), u: w.until.toISOString() });
  const w2 = vnWindow(new Date("2026-11-11T17:15:00Z"));
  check("vnWindow lúc 00:15 VN 12/11 ⇒ todayKey 2026-11-12, from 2026-11-11T17:00Z", w2.todayKey === "2026-11-12" && w2.from.toISOString() === "2026-11-11T17:00:00.000Z");
}

section("chiaHomNay — ranh giới ngày VN (23:30 và 00:30)");
{
  const L2330 = { lessonId: "L2330", scheduledAt: new Date("2026-11-11T16:30:00Z") as Date | null }; // 23:30 VN 11/11
  const L0030 = { lessonId: "L0030", scheduledAt: new Date("2026-11-11T17:30:00Z") as Date | null }; // 00:30 VN 12/11 (cùng ngày UTC!)
  const a = chiaHomNay([L0030, L2330], new Date("2026-11-11T16:45:00Z")); // 23:45 VN 11/11
  check("23:45 VN: todayKey 2026-11-11", a.todayKey === "2026-11-11", a.todayKey);
  check("bài 23:30 VN ⇒ today, past=true, time '23:30'", a.today.length === 1 && a.today[0].lessonId === "L2330" && a.today[0].past === true && a.today[0].time === "23:30" && a.today[0].dateKey === "2026-11-11", a.today);
  check("bài 00:30 VN 12/11 ⇒ upcoming 'Ngày mai', KHÔNG today", a.upcoming.length === 1 && a.upcoming[0].lessonId === "L0030" && a.upcoming[0].dateKey === "2026-11-12"
    && vnDayTitle(a.upcoming[0].dateKey, a.todayKey) === "Ngày mai" && a.upcoming[0].time === "00:30" && a.upcoming[0].past === false, a.upcoming);
  const b = chiaHomNay([L2330, L0030], new Date("2026-11-11T17:15:00Z")); // 00:15 VN 12/11
  check("00:15 VN 12/11: bài 23:30 VN 11/11 ⇒ bỏ (hôm qua)", !b.today.some(x => x.lessonId === "L2330") && !b.upcoming.some(x => x.lessonId === "L2330"), b);
  check("00:15 VN 12/11: bài 00:30 ⇒ today, past=false", b.today.length === 1 && b.today[0].lessonId === "L0030" && b.today[0].past === false, b.today);

  const now = new Date("2026-11-11T05:00:00Z"); // 12:00 VN 11/11
  const e1 = { lessonId: "E1", scheduledAt: new Date("2026-11-18T16:59:00Z") as Date | null }; // 23:59 VN 18/11
  const e2 = { lessonId: "E2", scheduledAt: new Date("2026-11-18T17:00:00Z") as Date | null }; // 00:00 VN 19/11
  const c = chiaHomNay([e1, e2], now);
  check("biên 7 ngày: 18/11 23:59 VN ⇒ upcoming", c.upcoming.some(x => x.lessonId === "E1"), c.upcoming);
  check("biên 7 ngày: 19/11 00:00 VN ⇒ bỏ", !c.upcoming.some(x => x.lessonId === "E2") && !c.today.some(x => x.lessonId === "E2"));
  check("days=0 ⇒ không có upcoming", chiaHomNay([e1, L0030], new Date("2026-11-11T05:00:00Z"), 0).upcoming.length === 0);

  const before = [
    { lessonId: "z", scheduledAt: new Date("2026-11-11T12:30:00Z") as Date | null },
    { lessonId: "null", scheduledAt: null },
    { lessonId: "hong", scheduledAt: new Date("x") },
    { lessonId: "a", scheduledAt: new Date("2026-11-11T12:30:00Z") as Date | null },
    { lessonId: "som", scheduledAt: new Date("2026-11-11T01:00:00Z") as Date | null },
    { lessonId: "homqua", scheduledAt: new Date("2026-11-10T12:00:00Z") as Date | null },
  ];
  const snapshot = JSON.stringify(before);
  const order = before.map(x => x.lessonId).join(",");
  let threw = false;
  let d: ReturnType<typeof chiaHomNay<(typeof before)[number]>> | null = null;
  try { d = chiaHomNay(before, now); } catch { threw = true; }
  check("null / Invalid Date ⇒ bỏ, không ném", !threw && d !== null && ![...d.today, ...d.upcoming].some(x => x.lessonId === "null" || x.lessonId === "hong"), d);
  check("bài hôm qua ⇒ bỏ", d !== null && ![...d.today, ...d.upcoming].some(x => x.lessonId === "homqua"));
  check("sắp theo giờ, hoà giờ ⇒ theo lessonId (som, a, z)", d !== null && eq(d.today.map(x => x.lessonId), ["som", "a", "z"]), d?.today.map(x => x.lessonId));
  check("past: 08:00 VN đã qua lúc 12:00 VN; 19:30 VN chưa qua", d !== null && d.today[0].past === true && d.today[1].past === false);
  check("mảng gốc không đổi (thứ tự + nội dung, không thêm khoá)", JSON.stringify(before) === snapshot && before.map(x => x.lessonId).join(",") === order && !("dateKey" in before[0]));
}

section("lessonMetaParts — chỉ dữ liệu thật, không 'lượt xem'");
{
  const T = "2026-11-11";
  const doc1 = JSON.stringify([{ name: "Đề cương.pdf", url: "https://res.cloudinary.com/kin/raw/upload/a.pdf" }]);
  const doc2 = JSON.stringify([{ name: "A.pdf", url: "https://x.example/a.pdf" }, { name: "B", url: "/api/media/abcdefgh12/file" }]);
  check("'1 tài liệu'", eq(lessonMetaParts({ documents: doc1 }, T), ["1 tài liệu"]), lessonMetaParts({ documents: doc1 }, T));
  check("'2 tài liệu' (kể cả tệp KiN /api/media/…/file)", eq(lessonMetaParts({ documents: doc2 }, T), ["2 tài liệu"]));
  check("JSON hỏng ⇒ không có mục tài liệu", eq(lessonMetaParts({ documents: "[{bad json" }, T), []));
  check("javascript: không đếm", eq(lessonMetaParts({ documents: JSON.stringify([{ name: "x", url: "javascript:alert(1)" }]) }, T), []));
  check("azota hỏng ⇒ không 'Có bài tập'", eq(lessonMetaParts({ azotaUrl: "javascript:alert(1)" }, T), []) && eq(lessonMetaParts({ azotaUrl: "hỏng link" }, T), []) && eq(lessonMetaParts({ azotaUrl: "   " }, T), []));
  check("azota hợp lệ ⇒ 'Có bài tập'", eq(lessonMetaParts({ azotaUrl: "https://azota.vn/de-thi/abc123" }, T), ["Có bài tập"]));
  check("assignmentCount > 0 ⇒ 'Có bài tập'; 0 ⇒ không", eq(lessonMetaParts({ assignmentCount: 2 }, T), ["Có bài tập"]) && eq(lessonMetaParts({ assignmentCount: 0 }, T), []));
  const full = lessonMetaParts({ documents: doc1, azotaUrl: "https://azota.vn/de-thi/abc123", assignmentCount: 1, scheduledAt: "2026-11-11T12:30:00.000Z" }, T);
  check("đủ ba mục: '1 tài liệu · Có bài tập · Học Hôm nay · 19:30'", full.join(" · ") === "1 tài liệu · Có bài tập · Học Hôm nay · 19:30", full);
  check("scheduledAt là Date cũng nhận; ngày khác ⇒ 'Học T7, 14/11 · 19:30'", eq(lessonMetaParts({ scheduledAt: new Date("2026-11-14T12:30:00Z") }, T), ["Học T7, 14/11 · 19:30"]));
  check("scheduledAt hỏng / rỗng / null ⇒ bỏ, không ném", eq(lessonMetaParts({ scheduledAt: "x" }, T), []) && eq(lessonMetaParts({ scheduledAt: "" }, T), []) && eq(lessonMetaParts({ scheduledAt: null }, T), []) && eq(lessonMetaParts({ scheduledAt: new Date("x") }, T), []));
  check("không bao giờ có chữ 'lượt xem'", ![full, lessonMetaParts({}, T)].flat().some(s => /lượt xem/i.test(s)));
}

section("contentSummary + chapterNo");
{
  const tree: TreeSection[] = [{ id: "s", chapters: [
    { id: "ngam", title: "", isImplicit: true, lessons: [{ id: "1", title: "1", status: "published" }] },
    { id: "c1", title: "C1", lessons: [{ id: "2", title: "2", status: "published" }, { id: "3", title: "3", status: "draft" }] },
    { id: "c2", title: "C2", lessons: [{ id: "4", title: "4", status: "published" }, { id: "5", title: "5", status: "published" }] },
    { id: "c3", title: "Chỉ có nháp", lessons: [{ id: "6", title: "6", status: "hidden" }] },
  ] }];
  check("chương ngầm + chương chỉ có nháp không đếm; bài nháp không đếm ⇒ '2 chương · 4 bài'", contentSummary(tree) === "Nội dung lớp: 2 chương · 4 bài", contentSummary(tree));
  check("0 chương (chỉ chương ngầm) ⇒ 'Nội dung lớp: 2 bài'", contentSummary([{ id: "s", chapters: [{ id: "n", title: "", isImplicit: true, lessons: [{ id: "a", title: "a", status: "published" }, { id: "b", title: "b", status: "published" }] }] }]) === "Nội dung lớp: 2 bài");
  check("0 bài ⇒ 'Lớp chưa có bài học'", contentSummary([]) === "Lớp chưa có bài học" && contentSummary([{ id: "s", chapters: [{ id: "c", title: "C", lessons: [{ id: "x", title: "x", status: "draft" }] }] }]) === "Lớp chưa có bài học");
  check("chapterNo 0 ⇒ '01', 9 ⇒ '10', 99 ⇒ '100'", chapterNo(0) === "01" && chapterNo(9) === "10" && chapterNo(99) === "100");
}

section("docLinks / azotaLinks — cho phiếu");
{
  const many = JSON.stringify(Array.from({ length: 8 }, (_, i) => ({ name: `T${i}.pdf`, url: `https://x.example/${i}.pdf` })));
  const dl = docLinks(many);
  check("tối đa 5 tài liệu, href là /xem-tai-lieu?url=…&name=…", dl.length === 5 && dl.every(d => d.href.startsWith("/xem-tai-lieu?url=") && d.href.includes("&name=")) && dl[0].name === "T0.pdf", dl[0]);
  check("docLinks rỗng/hỏng/javascript ⇒ []", eq(docLinks(null), []) && eq(docLinks("[oops"), []) && eq(docLinks(JSON.stringify([{ name: "x", url: "javascript:1" }])), []));
  const az = azotaLinks(JSON.stringify(["https://azota.vn/a", "javascript:alert(1)", "https://azota.vn/b", "https://azota.vn/c", "https://azota.vn/d"]));
  check("azota: bỏ link hỏng, tối đa 3, nhãn 'Bài Azota' / 'Bài Azota 2' / 'Bài Azota 3'", eq(az.map(a => a.label), ["Bài Azota", "Bài Azota 2", "Bài Azota 3"]) && eq(az.map(a => a.url), ["https://azota.vn/a", "https://azota.vn/b", "https://azota.vn/c"]), az);
  check("azota một chuỗi đơn ⇒ một link", eq(azotaLinks("https://azota.vn/de-thi/abc123"), [{ label: "Bài Azota", url: "https://azota.vn/de-thi/abc123" }]));
  check("azota rỗng/null ⇒ []", eq(azotaLinks(null), []) && eq(azotaLinks(""), []));
}

void done();
