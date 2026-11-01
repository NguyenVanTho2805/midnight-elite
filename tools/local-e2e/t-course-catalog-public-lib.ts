// CAT-01 — quy tắc thuần của trang /khoa-hoc công khai (src/lib/courseCatalogPublic.ts). Không cần máy chủ.
import { check, section, done } from "./h";
import {
  seatState, seatLabel, seatTone, hasSeat, priceView, parseCatalogParams, buildCatalogQuery, filterCatalog, sortCatalog,
  catalogChips, orderCategoryNames, toPublicCard, isFiltered, DEFAULT_FILTERS, type PublicCard,
} from "@/lib/courseCatalogPublic";

section("seatState");
check("classStatus closed thắng mọi thứ", seatState(10, 0, "closed").state === "closed" && seatState(null, 0, "closed").state === "closed");
check("paused", seatState(10, 3, "paused").state === "paused");
check("capacity null = không giới hạn", seatState(null, 999, "open").state === "unlimited" && seatState(undefined, 0, "open").state === "unlimited");
check("đúng bằng capacity = đầy, left 0", JSON.stringify(seatState(5, 5, "open")) === JSON.stringify({ state: "full", left: 0 }));
check("đang học > capacity vẫn là đầy (không âm)", seatState(5, 9, "open").left === 0 && seatState(5, 9, "open").state === "full");
check("capacity 0 = đầy", seatState(0, 0, "open").state === "full");
check("còn đúng 5 = low; còn 6 = open", seatState(10, 5, "open").state === "low" && seatState(10, 4, "open").state === "open" && seatState(10, 4, "open").left === 6);
check("chữ", seatLabel(seatState(10, 4, "open")) === "Còn 6 chỗ" && seatLabel(seatState(10, 9, "open")) === "Chỉ còn 1 chỗ" && seatLabel(seatState(5, 5, "open")) === "Đã đầy" && seatLabel(seatState(null, 0, "closed")) === "Đã đóng nhận học viên");
check("tông: đầy = loi, low = cho, mở = xong, đóng = mo", seatTone(seatState(5, 5, "open")) === "loi" && seatTone(seatState(10, 9, "open")) === "cho" && seatTone(seatState(null, 0, "open")) === "xong" && seatTone(seatState(null, 0, "closed")) === "mo");
check("hasSeat: chỉ unlimited/open/low", hasSeat(seatState(null, 0, "open")) && hasSeat(seatState(10, 9, "open")) && !hasSeat(seatState(5, 5, "open")) && !hasSeat(seatState(null, 0, "paused")));

section("priceView (chỉ trình bày)");
check("giá 0 = free", priceView(0, null).free && !priceView(1, null).free);
check("giảm giá làm tròn: 700k/1tr = 30%", priceView(700000, 1000000).discountPct === 30 && priceView(700000, 1000000).original === 1000000);
check("giá gốc null / bằng / thấp hơn giá bán → không giảm", priceView(500, null).discountPct === 0 && priceView(500, 500).original === null && priceView(500, 400).discountPct === 0);
check("giá không bị đổi", priceView(1234567, 2000000).price === 1234567);

section("parseCatalogParams / buildCatalogQuery");
check("category", parseCatalogParams({ category: "ĐGNL HSA" }).category === "ĐGNL HSA");
check("kythi là bí danh; category thắng", parseCatalogParams({ kythi: "TSA Bách Khoa" }).category === "TSA Bách Khoa" && parseCatalogParams({ category: "BCA", kythi: "ĐGNL HCM" }).category === "BCA");
check("'Tất cả' và rỗng = không lọc", parseCatalogParams({ category: "Tất cả" }).category === "" && parseCatalogParams({}).category === "");
check("giá trị lạ về mặc định", parseCatalogParams({ gia: "xyz", sx: "bậy", concho: "yes" }).fee === "" && parseCatalogParams({ gia: "xyz", sx: "bậy" }).sort === "moi" && !parseCatalogParams({ concho: "yes" }).seat);
check("mảng lặp lấy phần tử đầu, cắt khoảng trắng", parseCatalogParams({ category: ["BCA", "x"], q: "  toán " }).category === "BCA" && parseCatalogParams({ q: "  toán " }).q === "toán");
check("chuỗi quá dài bị cắt 80", parseCatalogParams({ q: "a".repeat(500) }).q.length === 80);
const full = { category: "ĐGNL HSA", q: "toán 9", fee: "free" as const, seat: true, sort: "gia-tang" as const };
const qs = buildCatalogQuery(full);
check("khứ hồi qua URL (dấu, khoảng trắng)", JSON.stringify(parseCatalogParams(Object.fromEntries(new URLSearchParams(qs)))) === JSON.stringify(full), qs);
check("mặc định → chuỗi rỗng; luôn ghi category, không ghi kythi", buildCatalogQuery(DEFAULT_FILTERS) === "" && buildCatalogQuery({ ...DEFAULT_FILTERS, category: "BCA" }) === "category=BCA" && !qs.includes("kythi"));
check("isFiltered: sx không tính là lọc", !isFiltered({ ...DEFAULT_FILTERS, sort: "gia-giam" }) && isFiltered({ ...DEFAULT_FILTERS, seat: true }));

const card = (o: Partial<PublicCard> & { slug: string }): PublicCard => ({
  title: o.slug, category: "ĐGNL HSA", teacher: "Cô Lan", teacherAvatar: "L", lessons: 10, hours: 5, price: 100000, originalPrice: null, tag: null, tagColor: null,
  seat: seatState(null, 0, "open"), ...o,
});
const cards = [
  card({ slug: "a", title: "Toán 9 nâng cao", price: 900000 }),
  card({ slug: "b", title: "Lý 9", category: "ĐGNL HCM", teacher: "Thầy Hùng", price: 0 }),
  card({ slug: "c", title: "HSA thử", price: 300000, seat: seatState(5, 5, "open") }),
  card({ slug: "d", title: "Văn", category: "BCA", price: 0, seat: seatState(null, 0, "closed") }),
];

section("filterCatalog / sortCatalog");
const ids = (xs: PublicCard[]) => xs.map(c => c.slug).join();
check("lọc theo TÊN danh mục", ids(filterCatalog(cards, { ...DEFAULT_FILTERS, category: "ĐGNL HCM" })) === "b");
check("tìm bỏ dấu, không hoa thường, khớp tên khoá và gia sư", ids(filterCatalog(cards, { ...DEFAULT_FILTERS, q: "TOAN" })) === "a" && ids(filterCatalog(cards, { ...DEFAULT_FILTERS, q: "thay hung" })) === "b");
check("miễn phí / có phí", ids(filterCatalog(cards, { ...DEFAULT_FILTERS, fee: "free" })) === "b,d" && ids(filterCatalog(cards, { ...DEFAULT_FILTERS, fee: "paid" })) === "a,c");
check("Chỉ lớp còn chỗ loại đầy và đóng", ids(filterCatalog(cards, { ...DEFAULT_FILTERS, seat: true })) === "a,b");
check("các bộ lọc là GIAO", ids(filterCatalog(cards, { ...DEFAULT_FILTERS, fee: "free", seat: true, category: "ĐGNL HCM" })) === "b" && filterCatalog(cards, { ...DEFAULT_FILTERS, fee: "free", category: "ĐGNL HSA" }).length === 0);
check("danh mục lạ → rỗng, không lỗi", filterCatalog(cards, { ...DEFAULT_FILTERS, category: "Không có" }).length === 0);
check("sắp 'moi' giữ thứ tự; giá tăng/giảm ổn định; không đổi mảng gốc", ids(sortCatalog(cards, "moi")) === "a,b,c,d" && ids(sortCatalog(cards, "gia-tang")) === "b,d,c,a" && ids(sortCatalog(cards, "gia-giam")) === "a,c,b,d" && ids(cards) === "a,b,c,d");

section("danh mục theo thứ tự quản trị");
const ordered = orderCategoryNames([{ name: "BCA", sortOrder: 1 }, { name: "ĐGNL HSA", sortOrder: 2 }, { name: "Trống", sortOrder: 3 }], ["ĐGNL HCM", "ĐGNL HSA", "Anh"]);
check("sortOrder trước, tên chưa có dòng xếp cuối theo chữ cái", ordered.join("|") === "BCA|ĐGNL HSA|Trống|Anh|ĐGNL HCM", ordered.join("|"));
const chips = catalogChips(ordered, cards, "");
check("chip bỏ danh mục rỗng (Trống, Anh), giữ thứ tự, đếm đúng", chips.map(c => `${c.name}:${c.count}`).join("|") === "BCA:1|ĐGNL HSA:2|ĐGNL HCM:1", chips.map(c => c.name).join("|"));
check("danh mục đang chọn mà rỗng/lạ vẫn có chip (để gỡ)", catalogChips(ordered, cards, "Trống").some(c => c.name === "Trống" && c.count === 0) && catalogChips(ordered, cards, "Lạ").some(c => c.name === "Lạ"));

section("ca phá: thẻ công khai không chứa dữ liệu nội bộ");
const dbRow = {
  id: "hsa-1", name: "HSA 1", category: "ĐGNL HSA", instructor: "Cô Lan", teacherAvatar: "L", lessons: 3, hours: 2, price: 100, originalPrice: null,
  tag: null, tagColor: null, capacity: 20, classStatus: "open",
  zaloGroupLink: "https://zalo.me/g/bi-mat", zaloGroupUrl: "https://zalo.me/g/bi-mat2", classJoinUrl: "https://meet.example/bi-mat", ownerId: "u1", adminName: "nội bộ",
} as Parameters<typeof toPublicCard>[0];
const pub = JSON.stringify(toPublicCard(dbRow, 7));
check("không có capacity / enrolled / link / chủ lớp / tên nội bộ", !/capacity|enrolled|zalo|classJoin|meet\.example|bi-mat|ownerId|adminName|nội bộ/.test(pub), pub);
check("chỉ còn trạng thái chỗ đã tính (20-7=13 → open, left 13)", JSON.parse(pub).seat.left === 13 && JSON.parse(pub).seat.state === "open");

done();
