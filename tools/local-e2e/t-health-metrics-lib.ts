// ĐX-04 (NC1-054) — số đo sức khoẻ sản phẩm: công thức thuần (src/lib/healthMetrics.ts) từ dòng giả lập + quét tĩnh API / trang / menu.
// Không cần DB hay máy chủ. Chạy: DATABASE_URL=postgresql://x:x@localhost/x npx tsx tools/local-e2e/t-health-metrics-lib.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MIN_SAMPLE, METRIC_DEFS, METRIC_ORDER, ON_TIME_AFTER_DATE_MS, PAY_WINDOW_DAYS,
  adoptionMetrics, bankMetrics, classifyTx, firstTutorMark, insufficientText, invoiceMetrics, percentOf, ratio, ratioText, sampleText, timelinessMetric,
  type InvoiceRow, type MarkRecord, type SessionRow, type TxRow,
} from "@/lib/healthMetrics";
import { ADMIN_MODULES, matchSub, visibleModules } from "@/lib/adminNav";
import { check, section, done } from "./h";

const DAY = 86_400_000, HOUR = 3_600_000;
const NOW = new Date("2026-10-21T05:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

(async () => {
  section("Tỉ lệ và ngưỡng mẫu");
  check("MIN_SAMPLE = 10", MIN_SAMPLE === 10);
  const r9 = ratio(9, 9), r10 = ratio(10, 10), r0 = ratio(0, 0), r50 = ratio(5, 10);
  check("9 mẫu: chưa đủ, KHÔNG có tỉ lệ (kể cả 9/9)", !r9.enough && r9.rate === null && ratioText(r9) === "—", r9);
  check("10 mẫu: đủ; 0 mẫu: không chia cho 0", r10.enough && r10.rate === 1 && !r0.enough && r0.rate === null && r50.rate === 0.5);
  check("phần trăm không làm tròn lên 100% khi còn thiếu 1 ca (995/1000 → 99%), 100% chỉ khi đủ cả", percentOf(ratio(995, 1000)) === 99 && percentOf(ratio(1000, 1000)) === 100 && ratioText(ratio(1000, 1000)) === "100%");
  check("có ca nhưng làm tròn ra 0 thì hiện 1%, không ca nào thì 0%", percentOf(ratio(1, 1000)) === 1 && percentOf(ratio(0, 10)) === 0);
  check("câu mẫu số và câu 'chưa đủ'", sampleText(ratio(288, 400), "phiếu đã gửi") === "288 / 400 phiếu đã gửi" && /cần từ 10 mới hiện phần trăm/.test(insufficientText(ratio(6, 6), "phiếu")) && /^6 phiếu/.test(insufficientText(ratio(6, 6), "phiếu")));

  section("Phiếu học phí — chỉ số 1, 2, 3");
  const inv = (o: Partial<InvoiceRow> & { sentAt: Date | null }): InvoiceRow => ({ tutorId: "t", status: "sent", zaloOpenedAt: null, parentViewedAt: null, paidAt: null, hasViewLink: false, ...o });
  const at = ago(5 * DAY);
  // 20 phiếu trong khoảng: 12 mở Zalo chat riêng (có link), 3 mở Zalo nhóm (không link), 5 chưa mở; 6 trong 12 phiếu có link đã được phụ huynh xem
  const big: InvoiceRow[] = [];
  for (let i = 0; i < 12; i++) big.push(inv({ sentAt: at, zaloOpenedAt: at, hasViewLink: true, parentViewedAt: i < 6 ? at : null }));
  for (let i = 0; i < 3; i++) big.push(inv({ sentAt: at, zaloOpenedAt: at, hasViewLink: false }));
  for (let i = 0; i < 5; i++) big.push(inv({ sentAt: at }));
  // nhiễu phải bị loại: huỷ, nháp chưa gửi, gửi ngoài khoảng, phụ huynh "xem" nhưng gia sư chưa mở Zalo
  big.push(inv({ sentAt: at, status: "cancelled", zaloOpenedAt: at, hasViewLink: true, parentViewedAt: at }));
  big.push(inv({ sentAt: null, status: "draft" }));
  big.push(inv({ sentAt: ago(31 * DAY), zaloOpenedAt: ago(31 * DAY), hasViewLink: true, parentViewedAt: ago(30 * DAY) }));
  const m = invoiceMetrics(big, NOW, 30);
  check("chỉ số 1: 15/20 phiếu đã mở Zalo (loại phiếu huỷ, nháp, ngoài khoảng)", m.sent === 20 && m.zaloOpened.n === 15 && m.zaloOpened.d === 20 && m.zaloOpened.enough && m.zaloOpened.rate === 0.75, m.zaloOpened);
  check("chỉ số 2: mẫu số CHỈ gồm phiếu đã mở Zalo CÓ link riêng (12), gửi nhóm Zalo không bị tính là 'phụ huynh chưa xem'", m.parentViewed.d === 12 && m.parentViewed.n === 6 && m.parentViewed.rate === 0.5, m.parentViewed);
  const small = invoiceMetrics(big.slice(0, 6).concat(big.slice(15, 17)), NOW, 30);
  check("ít phiếu: chỉ số 1 và 2 'chưa đủ dữ liệu', không có tỉ lệ", !small.zaloOpened.enough && small.zaloOpened.rate === null && !small.parentViewed.enough && small.parentViewed.rate === null, [small.zaloOpened, small.parentViewed]);
  const edge = invoiceMetrics([inv({ sentAt: ago(30 * DAY), zaloOpenedAt: NOW }), inv({ sentAt: ago(30 * DAY + 1000), zaloOpenedAt: NOW }), inv({ sentAt: new Date(NOW.getTime() + 1000) })], NOW, 30);
  check("ranh giới khoảng: đúng 30 ngày trước thì tính, quá 1 giây thì không, phiếu ở tương lai không tính", edge.sent === 1, edge.sent);

  // Chỉ số 3: lứa phiếu đã gửi đủ 14 ngày = sentAt ∈ [now-30d-14d, now-14d]
  const D14 = PAY_WINDOW_DAYS * DAY;
  const sentAtOf = (ms: number) => ago(ms);
  const coh: InvoiceRow[] = [];
  const s1 = sentAtOf(20 * DAY);
  for (let i = 0; i < 5; i++) coh.push(inv({ sentAt: s1, status: "paid", paidAt: new Date(s1.getTime() + 3 * DAY) }));     // đóng sớm
  coh.push(inv({ sentAt: s1, status: "paid", paidAt: new Date(s1.getTime() + D14) }));                                     // đúng 14 ngày: kịp
  coh.push(inv({ sentAt: s1, status: "paid", paidAt: new Date(s1.getTime() + D14 + 1000) }));                              // trễ 1 giây: không kịp
  for (let i = 0; i < 3; i++) coh.push(inv({ sentAt: s1, status: "sent" }));                                              // chưa đóng
  coh.push(inv({ sentAt: s1, status: "partial", paidAt: null }));                                                         // đóng một phần: chưa phải đóng đủ
  // nhiễu: huỷ (dù có paidAt), chưa đủ 14 ngày, quá cũ — đều ngoài lứa
  coh.push(inv({ sentAt: s1, status: "cancelled", paidAt: new Date(s1.getTime() + DAY) }));
  coh.push(inv({ sentAt: sentAtOf(13 * DAY), status: "paid", paidAt: sentAtOf(12 * DAY) }));
  coh.push(inv({ sentAt: sentAtOf(45 * DAY), status: "paid", paidAt: sentAtOf(44 * DAY) }));
  const c = invoiceMetrics(coh, NOW, 30);
  check("chỉ số 3: 6/11 đóng đủ trong 14 ngày (đúng hạn 14 ngày tính là kịp, trễ 1 giây thì không)", c.paidIn14.n === 6 && c.paidIn14.d === 11 && c.paidIn14.enough, c.paidIn14);
  check("chỉ số 3 không tính phiếu huỷ, phiếu mới gửi chưa đủ 14 ngày, phiếu quá cũ", c.paidIn14.d === 11);
  const bnd = invoiceMetrics([
    inv({ sentAt: ago(14 * DAY) }), inv({ sentAt: new Date(ago(14 * DAY).getTime() + 1000) }),
    inv({ sentAt: ago(44 * DAY) }), inv({ sentAt: new Date(ago(44 * DAY).getTime() - 1000) }),
  ], NOW, 30);
  check("ranh giới lứa phiếu: [now-44d, now-14d] gồm hai mép, ngoài 1 giây thì loại", bnd.paidIn14.d === 2, bnd.paidIn14);
  check("lứa phiếu ghi rõ khoảng ngày đã dùng", bnd.paidCohort.from.getTime() === ago(44 * DAY).getTime() && bnd.paidCohort.to.getTime() === ago(14 * DAY).getTime());

  section("Khoản tiền vào — chỉ số 4");
  const tx = (provider: string, status: string): TxRow => ({ provider, status, occurredAt: ago(DAY) });
  const rows: TxRow[] = [
    tx("manual", "resolved"), tx("manual", "resolved"),
    ...Array.from({ length: 6 }, () => tx("sepay", "matched")), ...Array.from({ length: 3 }, () => tx("sepay", "pending")),
    tx("sepay", "resolved"), tx("sepay", "resolved"), tx("sepay", "ignored"), tx("sepay", "la-gi-do"),
  ];
  const b = bankMetrics(rows, ago(6 * DAY + 12 * HOUR), NOW);
  check("phân loại: 6 tự gạch · 3 chờ · 2 ghi tay · 2 đã xử lý · 1 bỏ qua · 1 lạ, tổng 15", b.auto === 6 && b.pending === 3 && b.manual === 2 && b.resolved === 2 && b.ignored === 1 && b.other === 1 && b.total === 15, b);
  check("tỉ lệ tự gạch tính trên khoản qua SePay (13), KHÔNG tính tiền mặt ghi tay", b.autoRate.d === 13 && b.autoRate.n === 6 && b.autoRate.enough, b.autoRate);
  check("ghi tay xét trước: dù status là pending/matched vẫn là 'ghi tay'", classifyTx({ provider: "manual", status: "pending" }) === "manual" && classifyTx({ provider: "manual", status: "matched" }) === "manual");
  check("tuổi khoản chờ lâu nhất: 6,5 ngày → 6 (tròn xuống); chưa tới 1 ngày → 0; không có → null", b.oldestPendingDays === 6 && bankMetrics([], ago(0.4 * DAY), NOW).oldestPendingDays === 0 && bankMetrics([], null, NOW).oldestPendingDays === null);
  const bs = bankMetrics(rows.slice(0, 8), null, NOW);
  check("ít khoản SePay (<10): tỉ lệ tự gạch chưa đủ dữ liệu, nhưng vẫn có số đếm", !bs.autoRate.enough && bs.autoRate.rate === null && bs.total === 8 && bs.auto === 6);

  section("Điểm danh kịp thời — chỉ số 5");
  const D = new Date("2026-09-10T00:00:00Z"); // ngày buổi (00:00 UTC của ngày VN)
  const rec = (status: string, createdAt: Date): MarkRecord => ({ status, createdAt });
  const off = (ms: number) => new Date(D.getTime() + ms);
  check("hạn kịp thời = hết ngày VN hôm sau = date + 41 giờ", ON_TIME_AFTER_DATE_MS === 41 * HOUR && new Date(D.getTime() + ON_TIME_AFTER_DATE_MS).toISOString() === "2026-09-11T17:00:00.000Z");
  check("bản ghi 'Có phép' tự sinh KHÔNG phải lúc gia sư điểm danh", firstTutorMark([rec("excused", off(-5 * DAY))]) === null);
  check("'Có phép' cũng không tính dù do gia sư xử lý sau: không phải trạng thái gia sư chọn khi điểm danh", firstTutorMark([rec("excused", off(2 * DAY))]) === null);
  check("lấy bản ghi gia sư chọn SỚM nhất, bỏ qua bản tự sinh sớm hơn", firstTutorMark([rec("excused", off(-5 * DAY)), rec("present", off(60 * HOUR)), rec("absent", off(30 * HOUR))])?.getTime() === off(30 * HOUR).getTime());
  const sess = (records: MarkRecord[]): SessionRow => ({ date: D, records });
  const rowsT: SessionRow[] = [];
  for (let i = 0; i < 8; i++) rowsT.push(sess([rec("present", off(10 * HOUR))]));                         // trong ngày
  rowsT.push(sess([rec("present", off(41 * HOUR))]));                                                      // đúng hạn
  rowsT.push(sess([rec("late", off(41 * HOUR + 1))]));                                                      // trễ 1 ms
  rowsT.push(sess([rec("excused", off(-5 * DAY)), rec("present", off(60 * HOUR))]));                   // tự sinh sớm + điểm danh trễ
  rowsT.push(sess([rec("present", off(-1 * DAY))]));                                                         // điểm danh trước buổi
  rowsT.push(sess([rec("excused", off(-5 * DAY))]));                                                          // chỉ có tự sinh → không đo
  rowsT.push(sess([]));                                                                                              // phiên rỗng → không đo
  const t = timelinessMetric(rowsT);
  check("kịp thời: 10/12 đo được (8 trong ngày + đúng hạn 41h + điểm danh trước buổi); trễ 1 ms và điểm danh trễ sau bản tự sinh là không kịp", t.n === 10 && t.d === 12 && t.enough, t);
  check("buổi chỉ có 'Có phép' tự sinh và phiên rỗng: không vào mẫu số, được đếm riêng là 'không đo'", t.unmeasured === 2 && t.d === 12);
  const ts = timelinessMetric(rowsT.slice(0, 5));
  check("ít buổi: chưa đủ dữ liệu", !ts.enough && ts.rate === null && ts.d === 5);

  section("Gia sư đang dùng — chỉ số 6");
  const a = adoptionMetrics(["a", "b", "c"], ["a", "a", "x", null], ["b", "c", "c", "y", null]);
  check("giao với tập gia sư đã duyệt: người lạ (x, y) và lớp không chủ (null) không làm tử số vượt mẫu số", a.tutors === 3 && a.teaching === 1 && a.invoicing === 2, a);
  check("đếm theo gia sư, không theo số buổi/phiếu (a hai buổi vẫn là 1)", adoptionMetrics(["a"], ["a", "a", "a"], ["a", "a"]).teaching === 1);
  check("tử số luôn ≤ mẫu số", (() => { const r = adoptionMetrics(["a", "b"], ["a", "b", "c"], ["a", "b", "c", "d"]); return r.teaching <= r.tutors && r.invoicing <= r.tutors; })());

  section("Định nghĩa hiện trên màn");
  check("đủ sáu chỉ số, không trùng, mỗi chỉ số có tên + định nghĩa + mẫu số", METRIC_ORDER.length === 6 && new Set(METRIC_ORDER).size === 6 && METRIC_ORDER.every(k => { const d = METRIC_DEFS[k]; return d.key === k && d.title.length > 3 && d.definition.length > 30 && d.denominator.length > 5; }));
  check("định nghĩa nói thật giới hạn: 'đã mở Zalo' không phải 'đã gửi'; điểm danh chỉ đo buổi đã có", /không biết tin có thật sự được gửi/.test(METRIC_DEFS.zaloOpened.definition) && /Chỉ đo các buổi ĐÃ có điểm danh/.test(METRIC_DEFS.timely.definition));
  const sample = JSON.stringify({ m, c, b, t, a });
  check("kết quả chỉ có số và ngày: không có khoá tên / email / điện thoại / nội dung", !/"(name|email|phone|parentName|content|studentId)"/.test(sample));

  section("Quét tĩnh: API, trang, menu");
  const root = join(__dirname, "..", "..");
  const read = (p: string) => readFileSync(join(root, p), "utf8");
  const api = read("src/app/api/admin/health-metrics/route.ts"), srv = read("src/lib/healthMetricsServer.ts"), page = read("src/app/(admin)/admin/so-do/page.tsx");
  check("API: chỉ quản lý trung tâm (requireCenterAdmin chạy TRƯỚC khi đọc dữ liệu), no-store, days kiểm 1–365 mặc định 30",
    /requireCenterAdmin\(\)/.test(api) && api.indexOf("requireCenterAdmin()") < api.indexOf("loadHealthMetrics(") && /no-store/.test(api) && /n >= 1 && n <= 365/.test(api) && /: 30/.test(api));
  check("truy vấn KHÔNG đọc tên / email / số điện thoại / nội dung / số tiền", !/\b(name|email|phone|parentPhone|parentName|content|amount|amountDue|bio)\s*:\s*true/.test(srv), srv.match(/\b(name|email|phone|content|amount)\s*:\s*true/));
  check("truy vấn tái dùng định nghĩa 'buổi đã dạy' của ĐX-00 và bộ lọc gia sư công khai", /taughtSessionWhere\(now\)/.test(srv) && /tutorVerified: true, banned: false, profileLockedAt: null/.test(srv));
  check("trang: PermissionGuard MANAGE_TUTORS, vẽ đủ sáu chỉ số theo METRIC_ORDER, có 'Chưa đủ dữ liệu' và 'Mẫu số:'",
    /PermissionGuard required=\{PERMISSIONS\.MANAGE_TUTORS\}/.test(page) && /METRIC_ORDER\.map/.test(page) && /Chưa đủ dữ liệu/.test(page) && /Mẫu số:/.test(page) && /METRIC_DEFS\[k\]/.test(page));
  check("trang: chọn 7 / 30 / 90 ngày, có trạng thái đang tải và lỗi + Thử lại", /\[7, 30, 90\]/.test(page) && /aria-busy="true"/.test(page) && /role="alert"/.test(page) && /Thử lại/.test(page));
  check("trang không viết số tự nghĩ: mọi số lấy từ dữ liệu API (không có chuỗi phần trăm cố định)", !/\b\d{1,3}%/.test(page.replace(/{ratioText[^}]*}/g, "")));
  const baoCao = ADMIN_MODULES.find(x => x.key === "bao-cao");
  const sub = baoCao?.subs.find(s => s.href === "/admin/so-do");
  check("menu: 'Số đo sản phẩm' nằm trong module Báo cáo, cùng quyền với Phễu gia sư", !!sub && sub.label === "Số đo sản phẩm" && sub.permission === baoCao?.subs.find(s => s.href === "/admin/pheu")?.permission);
  check("matchSub nhận /admin/so-do là module Báo cáo", matchSub("/admin/so-do")?.moduleKey === "bao-cao");
  const hrefs = (r: "admin_super" | "admin_content" | "teacher") => visibleModules(r).flatMap(x => x.subs.map(s => s.href));
  check("quản lý trung tâm thấy trang, gia sư thì không", hrefs("admin_super").includes("/admin/so-do") && hrefs("admin_content").includes("/admin/so-do") && !hrefs("teacher").includes("/admin/so-do"));

  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
