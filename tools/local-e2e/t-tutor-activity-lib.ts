// ĐX-05 (NC1-063) — "có dạy trong 30 ngày qua" và thứ tự danh sách gia sư: phần thuần (src/lib/tutorActivity.ts) + quét tĩnh API / thẻ / hồ sơ.
// Không cần DB hay máy chủ. Chạy: DATABASE_URL=postgresql://x:x@localhost/x npx tsx tools/local-e2e/t-tutor-activity-lib.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_TUTOR_SORT, RECENT_ACTIVE_DAYS, TUTOR_SORTS, isRecentlyActive, parseTutorSort, recentActiveSince, recentTaughtSessionWhere, sortTutors,
  type SortableTutor,
} from "@/lib/tutorActivity";
import { check, section, done } from "./h";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const NOW = new Date("2026-10-21T05:00:00Z"); // 12:00 ngày 21/10 giờ VN

(async () => {
  section("Cửa sổ 30 ngày (giờ Việt Nam)");
  check("RECENT_ACTIVE_DAYS = 30", RECENT_ACTIVE_DAYS === 30);
  check("mốc dưới = 00:00 UTC của ngày VN lùi 30 ngày (21/10 → 21/09)", recentActiveSince(NOW).toISOString() === "2026-09-21T00:00:00.000Z");
  check("đúng ngày mốc và hôm nay thì tính; trước mốc 1 ngày thì không", isRecentlyActive(d("2026-09-21"), NOW) && isRecentlyActive(d("2026-10-21"), NOW) && !isRecentlyActive(d("2026-09-20"), NOW));
  check("buổi ở tương lai (mai) không tính, không có buổi nào thì không", !isRecentlyActive(d("2026-10-22"), NOW) && !isRecentlyActive(null, NOW) && !isRecentlyActive(undefined, NOW));
  const LATE = new Date("2026-10-21T18:00:00Z"); // 01:00 ngày 22/10 giờ VN: ngày VN đã sang hôm sau, ngày UTC thì chưa
  check("sát nửa đêm: lấy ngày VN, không lấy ngày UTC (22/10 là HÔM NAY; 21/09 đã ra khỏi cửa sổ)", isRecentlyActive(d("2026-10-22"), LATE) && !isRecentlyActive(d("2026-09-21"), LATE) && isRecentlyActive(d("2026-09-22"), LATE));

  section("Điều kiện Prisma cho buổi đã dạy trong 30 ngày qua");
  const w = recentTaughtSessionWhere(NOW) as { date: { lte: Date; gte: Date }; records: { some: { status: { in: string[] } } } };
  check("giữ định nghĩa ĐX-00: ngày ≤ hôm nay (giờ VN) và có em có mặt / muộn", w.date.lte.toISOString() === "2026-10-21T00:00:00.000Z" && JSON.stringify(w.records.some.status.in) === JSON.stringify(["present", "late"]), w);
  check("cộng thêm mốc dưới 30 ngày mà KHÔNG làm mất mốc trên (spread không đè nhau)", w.date.gte.toISOString() === "2026-09-21T00:00:00.000Z" && Object.keys(w.date).sort().join() === "gte,lte", w.date);

  section("Thứ tự danh sách /giang-vien");
  const T = (name: string, o: Partial<SortableTutor> = {}): SortableTutor => ({ name, classCount: 1, studentCount: 5, sessionsTaught: 10, recentlyActive: false, rating: { avg: null }, ...o });
  const list: SortableTutor[] = [
    T("Phạm Thu Hà", { recentlyActive: false, sessionsTaught: 400, rating: { avg: 4.9 }, studentCount: 30, classCount: 2 }),
    T("Lê Minh Quân", { recentlyActive: true, sessionsTaught: 20, rating: { avg: 4.0 }, studentCount: 8, classCount: 1 }),
    T("Nguyễn Phúc Thanh", { recentlyActive: true, sessionsTaught: 126, rating: { avg: 4.5 }, studentCount: 14, classCount: 4 }),
    T("Ân Hoàng", { recentlyActive: true, sessionsTaught: 126, rating: { avg: 4.5 }, studentCount: 14, classCount: 4 }),
    T("Đặng Gia Hân", { recentlyActive: true, sessionsTaught: 126, rating: { avg: null }, studentCount: 3, classCount: 6 }),
    T("Bùi Kiệt", { recentlyActive: false, sessionsTaught: 0, rating: { avg: null }, studentCount: 0, classCount: 0 }),
  ];
  const names = (a: SortableTutor[]) => a.map(x => x.name).join(" | ");
  const active = sortTutors(list, "active");
  check("mặc định 'active': đang hoạt động lên trước; trong nhóm: nhiều buổi → đánh giá cao (có đánh giá hơn chưa có) → tên",
    names(active) === "Ân Hoàng | Nguyễn Phúc Thanh | Đặng Gia Hân | Lê Minh Quân | Phạm Thu Hà | Bùi Kiệt", names(active));
  check("gia sư chưa dạy gần đây VẪN hiện (chỉ nằm dưới), danh sách không mất ai", active.length === list.length && new Set(active.map(x => x.name)).size === list.length);
  check("gia sư dạy nhiều buổi nhưng không hoạt động gần đây KHÔNG vượt gia sư đang hoạt động ít buổi hơn", active.findIndex(x => x.name === "Phạm Thu Hà") > active.findIndex(x => x.name === "Lê Minh Quân"));
  check("'rating': đánh giá cao trước, chưa có đánh giá xuống cuối, hoà thì theo tên", names(sortTutors(list, "rating")) === "Phạm Thu Hà | Ân Hoàng | Nguyễn Phúc Thanh | Lê Minh Quân | Bùi Kiệt | Đặng Gia Hân", names(sortTutors(list, "rating")));
  check("'students': nhiều học viên trước, hoà theo tên", names(sortTutors(list, "students")) === "Phạm Thu Hà | Ân Hoàng | Nguyễn Phúc Thanh | Lê Minh Quân | Đặng Gia Hân | Bùi Kiệt", names(sortTutors(list, "students")));
  check("'classes': nhiều lớp trước, hoà theo tên", names(sortTutors(list, "classes")) === "Đặng Gia Hân | Ân Hoàng | Nguyễn Phúc Thanh | Phạm Thu Hà | Lê Minh Quân | Bùi Kiệt", names(sortTutors(list, "classes")));
  const shuffled = [list[3], list[5], list[1], list[0], list[4], list[2]];
  check("xác định: xáo thứ tự đầu vào, kết quả không đổi (mọi kiểu sắp)", TUTOR_SORTS.every(s => names(sortTutors(shuffled, s)) === names(sortTutors(list, s))));
  const before = names(list); sortTutors(list, "active");
  check("không sửa mảng đầu vào", names(list) === before);

  section("Tham số sort");
  check("mặc định là 'active'", DEFAULT_TUTOR_SORT === "active" && parseTutorSort(null) === "active" && parseTutorSort(undefined) === "active" && parseTutorSort("") === "active");
  check("giá trị hợp lệ giữ nguyên; giá trị lạ về mặc định (không còn rơi về 'rating')", TUTOR_SORTS.every(s => parseTutorSort(s) === s) && parseTutorSort("ngau-nhien") === "active" && parseTutorSort("RATING") === "active");

  section("Quét tĩnh: API và giao diện công khai");
  const root = join(__dirname, "..", "..");
  const read = (p: string) => readFileSync(join(root, p), "utf8");
  const apiId = read("src/app/api/tutors/[id]/route.ts"), apiList = read("src/app/api/tutors/route.ts");
  const card = read("src/components/tutor/TutorCard.tsx"), head = read("src/components/tutor/TutorProfileHeader.tsx"), prev = read("src/components/tutor/PublicProfilePreview.tsx");
  const mentor = read("src/app/(guest)/mentor/[id]/page.tsx"), list2 = read("src/app/(guest)/giang-vien/page.tsx");
  check("hồ sơ chi tiết: trả stats.recentlyActive từ định nghĩa chung recentTaughtSessionWhere", /recentTaughtSessionWhere\(\)/.test(apiId) && /recentlyActive: recentSession !== null/.test(apiId));
  check("danh sách: trả sessionsTaught + recentlyActive, chỉ tính lớp đang bật (khớp hồ sơ chi tiết), dùng taughtSessionWhere và sortTutors", /sessionsTaught: sessionsTaught\.get\(t\.id\)/.test(apiList) && /recentlyActive: recentOwners\.has\(t\.id\)/.test(apiList) && /status: true/.test(apiList) && /taughtSessionWhere\(\)/.test(apiList) && /recentTaughtSessionWhere\(\)/.test(apiList) && /sortTutors\(items, sort\)/.test(apiList) && /parseTutorSort\(/.test(apiList));
  check("danh sách không còn tự sắp bằng if/else trong route (đã chuyển sang hàm thuần có test)", !/items\.sort\(/.test(apiList));
  check("thẻ + đầu hồ sơ + bản xem trước đều ghi 'Có dạy trong 30 ngày qua'", [card, head, prev].every(s => /Có dạy trong 30 ngày qua/.test(s)));
  check("trang danh sách: mặc định 'active' và có lựa chọn 'Hoạt động gần đây'", /useState<SortKey>\("active"\)/.test(list2) && /value="active">Hoạt động gần đây/.test(list2));
  check("Q3: KHÔNG hiện 'đúng hạn %' và KHÔNG còn vế 'phụ huynh xác nhận' ở thẻ, đầu hồ sơ, hồ sơ công khai, danh sách", ![card, head, mentor, list2].some(s => /đúng hạn|phụ huynh xác nhận|buổi[^"'`]{0,30}xác nhận|% buổi/i.test(s)));
  check("không gắn chữ 'đã xác minh' cho số buổi / hoạt động (đó là số gia sư tự ghi)", !/xác minh[^"'`\n]{0,40}(buổi|hoạt động)/.test(card + head));

  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
