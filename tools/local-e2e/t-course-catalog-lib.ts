// CAT-02 — quy tắc thuần: lọc, facet, slug danh mục, kế hoạch hàng loạt, kiểm thứ tự (src/lib/courseCatalogAdmin.ts).
import { check, section, done } from "./h";
import {
  buildFacets, categorySlug, filterRows, planBulk, validateOrderIds, validateCategoryName, normalizeBulkIds,
  type CatalogRow, type BulkRowIn,
} from "@/lib/courseCatalogAdmin";

const row = (o: Partial<CatalogRow> & { id: string }): CatalogRow => ({
  adminId: 1, name: o.id, adminName: o.id, category: "Toán", tutor: { id: null, name: "Trung tâm" }, status: true, classStatus: "open",
  enrolled: 0, capacity: null, price: 100000, createdAt: "2026-10-01", ...o,
});
const rows: CatalogRow[] = [
  row({ id: "toan-9", name: "Toán 9 nâng cao", category: "Toán", tutor: { id: "t1", name: "Cô Lan" } }),
  row({ id: "ly-9", name: "Lý 9", category: "Lý", tutor: { id: "t2", name: "Thầy Hùng" }, status: false, price: 0 }),
  row({ id: "hsa-free", name: "HSA thử", category: "ĐGNL HSA", classStatus: "closed", price: 0 }),
];

section("filterRows");
check("tìm 'toan' khớp 'Toán' (bỏ dấu, không phân biệt hoa/thường)", filterRows(rows, { q: "TOAN" }).map(r => r.id).join() === "toan-9");
check("tìm khớp slug 'hsa-free'", filterRows(rows, { q: "hsa-free" }).length === 1);
check("tìm 'đgnl' khớp dù gõ không dấu 'dgnl' (danh mục không nằm trong tìm tên, chỉ lọc riêng)", filterRows(rows, { q: "dgnl" }).length === 0 && filterRows(rows, { category: "ĐGNL HSA" }).length === 1);
check("ba bộ lọc kết hợp là GIAO", filterRows(rows, { category: "Lý", visibility: "hidden", fee: "free" }).length === 1 && filterRows(rows, { category: "Lý", visibility: "shown" }).length === 0);
check("giá 0 = Miễn phí, giá >0 = Có phí", filterRows(rows, { fee: "free" }).length === 2 && filterRows(rows, { fee: "paid" }).length === 1);
check("lọc gia sư theo id và 'center'", filterRows(rows, { tutor: "t1" }).length === 1 && filterRows(rows, { tutor: "center" }).map(r => r.id).join() === "hsa-free");
check("lọc trạng thái lớp", filterRows(rows, { classStatus: "closed" }).length === 1);
check("bộ lọc rỗng trả đủ hàng, không đổi mảng gốc", filterRows(rows, {}).length === 3 && rows.length === 3);

section("buildFacets");
const f = buildFacets(rows);
check("shown + hidden = số hàng", f.shown + f.hidden === rows.length && f.shown === 2 && f.hidden === 1);
check("tổng đếm danh mục = số hàng; tên danh mục có trong hàng", f.categories.reduce((s, c) => s + c.count, 0) === 3 && f.categories.length === 3);
check("danh mục rỗng KHÔNG xuất hiện; không có hàng thì facet rỗng", buildFacets([]).categories.length === 0 && buildFacets([]).tutors.length === 0);
check("gia sư id null gọi là 'Trung tâm'", f.tutors.some(t => t.id === null && t.name === "Trung tâm"));

section("categorySlug / validateCategoryName");
check("'ĐGNL HSA' → dgnl-hsa", categorySlug("ĐGNL HSA") === "dgnl-hsa", categorySlug("ĐGNL HSA"));
check("hai tên chỉ khác dấu/hoa thường cho CÙNG slug", categorySlug("Toán Học") === categorySlug("toan hoc") && categorySlug("dgnl hsa") === categorySlug("ĐGNL HSA"));
check("chuỗi toàn ký tự lạ → slug rỗng và validate từ chối", categorySlug("★★★") === "" && !validateCategoryName("★★★").ok);
check("tên rỗng / 61 ký tự / có \\u0000 → từ chối", !validateCategoryName("   ").ok && !validateCategoryName("a".repeat(61)).ok && !validateCategoryName("abc\u0000d").ok && validateCategoryName("a".repeat(60)).ok);
check("tên hợp lệ được cắt khoảng trắng", (() => { const v = validateCategoryName("  Văn   10 "); return v.ok && v.name === "Văn 10" && v.slug === "van-10"; })());
check("không phải chuỗi → từ chối", !validateCategoryName(42).ok && !validateCategoryName(null).ok);

section("planBulk");
const found: BulkRowIn[] = [
  { id: "a", ownerId: "t1", status: true, category: "Toán" },
  { id: "b", ownerId: "t2", status: true, category: "Toán" },
  { id: "c", ownerId: null, status: false, category: "Lý" },
];
const tutor = { adminRole: "teacher" as const, userId: "t1" };
let p = planBulk(["a", "b", "c", "zzz"], found, { action: "set_status", status: false }, tutor);
check("[phá] gia sư chọn lô lẫn: khoá người khác/trung tâm vào skipped:not_owner, khoá của mình vào updated",
  p.ok && p.updated.map(u => u.id).join() === "a" && p.skipped.filter(s => s.reason === "not_owner").map(s => s.id).sort().join() === "b,c", p);
check("mã không tồn tại → not_found", p.ok && p.skipped.some(s => s.id === "zzz" && s.reason === "not_found"));
check("updated mang prev đủ để hoàn tác", p.ok && p.updated[0].prev.status === true && p.updated[0].prev.category === "Toán");
const sa = { adminRole: "admin_super" as const, userId: "s" };
p = planBulk(["a", "c"], found, { action: "set_status", status: false }, sa);
check("khoá đã đúng trạng thái → no_change; quản trị sửa được khoá người khác", p.ok && p.updated.map(u => u.id).join() === "a" && p.skipped.some(s => s.id === "c" && s.reason === "no_change"), p);
check("[phá] 101 mã bị từ chối (400); 0 mã bị từ chối",
  (() => { const r = planBulk(Array.from({ length: 101 }, (_, i) => `x${i}`), found, { action: "set_status", status: true }, sa); return !r.ok && r.status === 400; })()
  && !planBulk([], found, { action: "set_status", status: true }, sa).ok);
check("đúng 100 mã được nhận", planBulk(Array.from({ length: 100 }, (_, i) => `x${i}`), found, { action: "set_status", status: true }, sa).ok);
check("[phá] gia sư + set_category → 403 cả lô", (() => { const r = planBulk(["a"], found, { action: "set_category", category: "Lý" }, tutor); return !r.ok && r.status === 403; })());
check("set_category quản trị: đổi sang danh mục khác, cùng danh mục → no_change", (() => {
  const r = planBulk(["a", "c"], found, { action: "set_category", category: "Lý" }, sa);
  return r.ok && r.updated.map(u => u.id).join() === "a" && r.skipped[0].reason === "no_change";
})());
check("[phá] action lạ / category rỗng / status không phải boolean → 400",
  [planBulk(["a"], found, { action: "set_price" } as never, sa), planBulk(["a"], found, { action: "set_category", category: " " }, sa), planBulk(["a"], found, { action: "set_status", status: "no" } as never, sa)].every(r => !r.ok && r.status === 400));
check("mã trùng được gộp, không đếm hai lần", (() => { const r = planBulk(["a", "a"], found, { action: "set_status", status: false }, sa); return r.ok && r.updated.length === 1; })());
check("normalizeBulkIds từ chối phần tử không phải chuỗi", !normalizeBulkIds(["a", 5]).ok && !normalizeBulkIds("a").ok);

section("validateOrderIds");
const cur = ["c1", "c2", "c3"];
check("đúng tập, đổi thứ tự → hợp lệ", validateOrderIds(["c3", "c1", "c2"], cur).ok);
check("[phá] thiếu một id → 409", (() => { const r = validateOrderIds(["c1", "c2"], cur); return !r.ok && r.status === 409; })());
check("[phá] thừa id lạ → 409", (() => { const r = validateOrderIds(["c1", "c2", "c3", "c9"], cur); return !r.ok && r.status === 409; })());
check("[phá] đổi một id sang id lạ (cùng độ dài) → 409", (() => { const r = validateOrderIds(["c1", "c2", "c9"], cur); return !r.ok && r.status === 409; })());
check("[phá] trùng id → 400", (() => { const r = validateOrderIds(["c1", "c1", "c2"], cur); return !r.ok && r.status === 400; })());
check("không phải mảng chuỗi → 400", !validateOrderIds("c1", cur).ok && !validateOrderIds([1, 2, 3], cur).ok);
check("danh sách rỗng khớp tập rỗng", validateOrderIds([], []).ok);

done();
