// BU-03 P1 — cây ngân hàng câu hỏi: nhãn tầng, gộp con, bảng chương × mức (src/lib/deThiTree.ts). THUẦN: không DB.
// Chạy: DATABASE_URL=postgresql://x:y@localhost:5432/z npx tsx tools/local-e2e/t-deThi-tree-lib.ts
// Ca phá cố ý (sửa mã → ca đỏ):
//   - levelLabel trả "Chương" cho depth 1 → ca nhãn tầng đỏ;
//   - rollup bỏ cộng con vào cha (bỏ addCounts) → ca "sub = own + con" đỏ;
//   - bỏ `seen` trong orderedTree → ca "vòng parentId" treo/đếm đôi;
//   - tính độ sâu từ nút đang xem thay vì từ gốc thật → ca "đổi root vẫn giữ nhãn tầng thật" đỏ;
//   - chapterIdsOf luôn lấy tầng 2 → ca "ngân hàng cũ 2 tầng" đỏ.
import { check, section, done } from "./h";
import { chapterIdsOf, emptyCounts, levelLabel, rollupChapterLevel, subtreeIds, type CountRow, type TreeCat } from "@/lib/deThiTree";

const c = (id: string, parentId: string | null, name = id, sortOrder = 0): TreeCat => ({ id, parentId, name, sortOrder });
const row = (categoryId: string, difficulty: string | null, n: number): CountRow => ({ categoryId, difficulty, n });

(async () => {
  section("Nhãn tầng");
  check("0=Môn · 1=Lớp · 2=Chương · 3=Yêu cầu cần đạt · ≥4=Mục con", [0, 1, 2, 3, 4, 9].map(levelLabel).join("|") === "Môn|Lớp|Chương|Yêu cầu cần đạt|Mục con|Mục con");
  check("PHÁ: số âm / lẻ / NaN không ném, gọi là Mục con", levelLabel(-1) === "Mục con" && levelLabel(1.5) === "Mục con" && levelLabel(NaN) === "Mục con");

  // Môn → Lớp 9 → Chương (hàm số, hình học) → YCCĐ → mục con
  const cats = [
    c("toan", null, "Toán"), c("l9", "toan", "Lớp 9"), c("l10", "toan", "Lớp 10", 1),
    c("hs", "l9", "Hàm số"), c("hh", "l9", "Hình học", 1),
    c("y1", "hs", "Nhận biết hàm bậc nhất"), c("y2", "hs", "Đồ thị", 1), c("m1", "y1", "Chi tiết", 0),
    c("td", "l10", "Tập hợp"),
  ];
  const rows = [row("hs", "NB", 2), row("y1", "NB", 3), row("y1", "TH", 1), row("y2", "VDC", 4), row("y2", null, 2), row("y2", "xyz", 1), row("m1", "VD", 5), row("hh", "TH", 6), row("td", "NB", 7), row("khong-co", "NB", 99), row("hs", "NB", 0), row("hs", "NB", -3)];
  const full = rollupChapterLevel(cats, rows);
  const N = (id: string) => full.nodes.find(n => n.id === id)!;
  section("Gộp con (own / sub)");
  check("thứ tự duyệt trước, anh em theo sortOrder rồi tên: Toán, Lớp 9, Hàm số, YCCĐ1(+Chi tiết), Đồ thị, Hình học, Lớp 10, Tập hợp", full.nodes.map(n => n.id).join(",") === "toan,l9,hs,y1,m1,y2,hh,l10,td", full.nodes.map(n => n.id));
  check("độ sâu và nhãn: Toán 0 Môn · Lớp 9 1 Lớp · Hàm số 2 Chương · y1 3 YCCĐ · m1 4 Mục con", [N("toan"), N("l9"), N("hs"), N("y1"), N("m1")].map(n => `${n.depth}:${n.label}`).join("|") === "0:Môn|1:Lớp|2:Chương|3:Yêu cầu cần đạt|4:Mục con");
  check("own = đúng nút: hs own NB=2 (dòng 0 và âm bị bỏ), y1 own NB3 TH1", N("hs").own.NB === 2 && N("hs").own.total === 2 && N("y1").own.NB === 3 && N("y1").own.TH === 1 && N("y1").own.total === 4, [N("hs").own, N("y1").own]);
  check("sub = own + cả cây con: y1 sub = 4 + m1(VD 5) = 9", N("y1").sub.total === 9 && N("y1").sub.VD === 5 && N("y1").sub.NB === 3);
  check("PHÁ: hs sub = 2 + y1(9) + y2(7) = 18; mức NB 5 · TH 1 · VD 5 · VDC 4 · chưa gắn 3", (() => { const s = N("hs").sub; return s.total === 18 && s.NB === 5 && s.TH === 1 && s.VD === 5 && s.VDC === 4 && s.none === 3; })(), N("hs").sub);
  check("mức lạ ('xyz') và null cùng vào 'chưa gắn mức'", N("y2").own.none === 3 && N("y2").own.VDC === 4 && N("y2").own.total === 7);
  check("gốc: tổng sub = tổng mọi own hợp lệ (2+4+7+5+6+7 = 31); dòng của đầu mục lạ (99) KHÔNG lọt vào", N("toan").sub.total === 31 && full.nodes.reduce((s, n) => s + n.own.total, 0) === 31, N("toan").sub);
  check("mọi nút: total = NB+TH+VD+VDC+none (không lệch)", full.nodes.every(n => [n.own, n.sub].every(k => k.total === k.NB + k.TH + k.VD + k.VDC + k.none)));
  check("không trả nội dung/tên người: nút chỉ có id, parentId, name, depth, label, own, sub", full.nodes.every(n => Object.keys(n).sort().join() === "depth,id,label,name,own,parentId,sub"));

  section("Bảng chương × yêu cầu cần đạt");
  check("có nút tầng 2 → chương = các nút tầng 2 (Hàm số, Hình học, Tập hợp), theo thứ tự cây", full.chapterMatrix.map(m => m.chapterId).join() === "hs,hh,td", full.chapterMatrix.map(m => m.chapterId));
  const hs = full.chapterMatrix[0];
  check("chương Hàm số: counts = sub (18), yccd = hai con trực tiếp (y1 sub 9, y2 sub 7)", hs.counts.total === 18 && hs.yccd.map(y => `${y.id}:${y.counts.total}`).join() === "y1:9,y2:7", hs);
  check("chương không có con → yccd rỗng nhưng vẫn có dòng và số đếm (Hình học = 6)", full.chapterMatrix[1].yccd.length === 0 && full.chapterMatrix[1].counts.total === 6);

  section("Phạm vi root");
  const l9 = rollupChapterLevel(cats, rows, "l9");
  check("root=Lớp 9: chỉ nhánh con; nhãn tầng VẪN tính từ gốc thật (Lớp 9 = Lớp, Hàm số = Chương)", l9.nodes.map(n => n.id).join() === "l9,hs,y1,m1,y2,hh" && l9.nodes[0].label === "Lớp" && l9.nodes[1].label === "Chương", l9.nodes.map(n => `${n.id}:${n.label}`));
  check("root=Lớp 9: nút gốc phạm vi có parentId=null (phản hồi tự đủ), sub = 24 (không lẫn Lớp 10)", l9.nodes[0].parentId === null && l9.nodes[0].sub.total === 24, l9.nodes[0]);
  check("root=Lớp 9: chương = Hàm số, Hình học", l9.chapterMatrix.map(m => m.chapterId).join() === "hs,hh");
  check("root không tồn tại → không có nút nào (route trả 404 trước đó)", rollupChapterLevel(cats, rows, "nope").nodes.length === 0);
  check("subtreeIds: l9 và mọi con cháu", subtreeIds(cats, "l9").sort().join() === ["hh", "hs", "l9", "m1", "y1", "y2"].join() && subtreeIds(cats, "nope").length === 0);

  section("Ngân hàng cũ 2 tầng và dữ liệu hỏng");
  const old = rollupChapterLevel([c("bank", null, "Ngân hàng"), c("ch1", "bank", "Chương 1"), c("ch2", "bank", "Chương 2", 1)], [row("ch1", "NB", 3), row("ch2", "TH", 2), row("bank", "VD", 1)]);
  check("không có tầng 2 → chương = nút con trực tiếp của gốc", old.chapterMatrix.map(m => m.chapterId).join() === "ch1,ch2" && old.chapterMatrix[0].counts.total === 3, old.chapterMatrix);
  check("câu gắn thẳng vào gốc cũ vẫn tính trong sub của gốc (6) nhưng không thuộc chương nào", old.nodes[0].sub.total === 6 && old.nodes[0].own.total === 1);
  const rootOld = rollupChapterLevel([c("bank", null), c("ch1", "bank")], [row("ch1", "NB", 1)], "bank");
  check("PHÁ: root là gốc + chỉ có tầng 1 → chương = con trực tiếp (không rơi vào rỗng)", chapterIdsOf(rootOld.nodes, "bank").join() === "ch1");
  const cyc = rollupChapterLevel([c("a", "b"), c("b", "a"), c("x", null)], [row("a", "NB", 1), row("b", "TH", 2), row("x", "VD", 4)]);
  check("PHÁ: vòng parentId (a↔b) không treo, mọi nút vẫn hiện đúng một lần, không đếm đôi", cyc.nodes.length === 3 && new Set(cyc.nodes.map(n => n.id)).size === 3 && cyc.nodes.reduce((s, n) => s + n.own.total, 0) === 7, cyc.nodes.map(n => `${n.id}:${n.sub.total}`));
  check("cha không tồn tại (mồ côi) → coi là gốc, depth 0", rollupChapterLevel([c("o", "ghost")], []).nodes[0].depth === 0);
  check("tự trỏ chính mình (parentId = id) không treo", rollupChapterLevel([c("s", "s")], [row("s", "NB", 2)]).nodes[0].sub.total === 2);
  check("cây rỗng → rỗng, không ném", (() => { const e = rollupChapterLevel([], []); return e.nodes.length === 0 && e.chapterMatrix.length === 0; })());
  check("emptyCounts mới mỗi lần (không dùng chung tham chiếu)", emptyCounts() !== emptyCounts() && emptyCounts().total === 0);

  await done();
})();
