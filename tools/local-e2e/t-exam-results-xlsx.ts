// BU-03 P3 — Tải Excel kết quả: GET /api/tutor/de-thi/[id]/ket-qua/xuat-xlsx?chon=dau|cuoi|cao-nhat. Cần máy chủ dev (BASE) + DB RIÊNG; wipe() ở đầu bài.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-exam-results-xlsx.ts
// Mở tệp BẰNG exceljs (đọc lại như Excel sẽ đọc) và kiểm: ba sheet đúng tên, hàng đúng số tay tính, KHÔNG có ô công thức, ô bắt đầu = + - @ bị đệm dấu nháy đơn,
// tên tệp chỉ ASCII, chỉ gia sư chủ đề tải được (có tên học sinh), ?chon= đổi đúng lượt.
// Ca phá bằng thiết kế (sửa mã → đúng ca đó đỏ): safeCell bỏ đệm nháy → ca "=HYPERLINK" thành ô công thức (đỏ); ghi ô dạng {formula} → ca "không công thức" đỏ;
//   tên tệp dùng tiêu đề đề thi (có dấu) → ca ASCII đỏ; loadXlsx không kiểm chủ → ca gia sư B đỏ; chon không đọc → ca dau/cuoi đỏ.
import { cookieFor, BASE, api, wipe, check, section, done, type TUser } from "./h";
import { prisma } from "@/lib/prisma";
import { mkActors, mkDraft, mkResultsWorld, RES_NAMES } from "./bu03";

const X = (id: string, q = "") => `/api/tutor/de-thi/${id}/ket-qua/xuat-xlsx${q}`;
type Cell = string | number | null | { formula?: string; result?: unknown; richText?: unknown; text?: string; hyperlink?: string };

async function download(path: string, as?: TUser) {
  const res = await fetch(BASE + path, { redirect: "manual", headers: as ? { cookie: await cookieFor(as) } : {} });
  const bytes = Buffer.from(await res.arrayBuffer());
  return { status: res.status, bytes, headers: res.headers, text: bytes.subarray(0, 300).toString("utf8") };
}
async function open(bytes: Buffer) {
  const mod = await import("exceljs");
  const { Workbook } = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb = new Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  return wb;
}
const grid = (ws: any): Cell[][] => { const out: Cell[][] = []; ws.eachRow({ includeEmpty: true }, (row: any) => { const r: Cell[] = []; row.eachCell({ includeEmpty: true }, (c: any, i: number) => { r[i - 1] = c.value as Cell; }); out.push(r); }); return out; };
const isFormula = (v: Cell) => typeof v === "object" && v !== null && ("formula" in v || "sharedFormula" in (v as object));
const flat = (ws: any) => grid(ws).flat();

(async () => {
  await wipe();
  const a = await mkActors();
  const { A, B } = a;
  const W = await mkResultsWorld(A, a.courseA.id);

  section("Tải tệp: kiểu nội dung, tên tệp ASCII, đúng định dạng xlsx");
  const d = await download(X(W.root), A);
  check("200 + Content-Type spreadsheetml", d.status === 200 && /spreadsheetml\.sheet/.test(d.headers.get("content-type") ?? ""), [d.status, d.headers.get("content-type"), d.text.slice(0, 120)]);
  const cd = d.headers.get("content-disposition") ?? "";
  check("Content-Disposition: attachment; filename chỉ ASCII dạng ket-qua-<id8>-<yyyymmdd>.xlsx (tiêu đề đề có dấu tiếng Việt không lọt vào tên tệp)", /^attachment; filename="ket-qua-[A-Za-z0-9]{1,8}-\d{8}\.xlsx"$/.test(cd) && /^[\x20-\x7e]+$/.test(cd), cd);
  check("Cache-Control: no-store", /no-store/.test(d.headers.get("cache-control") ?? ""));
  check("tệp là zip hợp lệ (bắt đầu 'PK')", d.bytes.length > 1000 && d.bytes[0] === 0x50 && d.bytes[1] === 0x4b, d.bytes.length);
  const wb = await open(d.bytes);

  section("Ba sheet đúng tên, hàng đúng số tay tính");
  {
    check("sheet: Tổng quan · Bảng điểm · Theo câu", JSON.stringify(wb.worksheets.map(w => w.name)) === JSON.stringify(["Tổng quan", "Bảng điểm", "Theo câu"]), wb.worksheets.map(w => w.name));
    const ov = grid(wb.getWorksheet("Tổng quan")), find = (label: string) => ov.find(r => r[0] === label);
    check("Tổng quan: tiêu đề đề ở dòng 1", ov[0]?.[0] === "Kết quả đề" && ov[0][1] === "Đề kết quả BU-03", ov[0]);
    check("Tổng quan: 4 lượt đã nộp, 3 học sinh (số, không phải chữ)", find("Số lượt đã nộp")?.[1] === 4 && find("Số học sinh")?.[1] === 3, [find("Số lượt đã nộp"), find("Số học sinh")]);
    check("Tổng quan: TB 6,75 · trung vị 7 · cao nhất 9 · thấp nhất 4 · tỉ lệ đạt 75 (%)", Math.abs(Number(find("Điểm trung bình (thang 10)")?.[1]) - 6.75) < 0.011 && Number(find("Trung vị")?.[1]) === 7 && find("Cao nhất")?.[1] === 9 && find("Thấp nhất")?.[1] === 4 && Math.abs(Number(find("Tỉ lệ đạt (từ 5/10, %)")?.[1]) - 75) < 0.11, ov.slice(2, 10));
    check("Tổng quan: thời gian làm TB '12 phút 30 giây' (750 giây)", find("Thời gian làm trung bình")?.[1] === "12 phút 30 giây", find("Thời gian làm trung bình"));
    const dist = ov.filter(r => typeof r[0] === "string" && /^\d+–<?\d+%$/.test(r[0] as string));
    check("Tổng quan: phân bố 5 dòng [0,0,1,1,2]", dist.length === 5 && dist.map(r => r[1]).join() === "0,0,1,1,2", dist);
    const code = (c: number) => ov.find(r => r[0] === c);
    check("Tổng quan: bảng mã đề — 101: 3 lượt, 102: 1 lượt", code(101)?.[1] === 3 && code(102)?.[1] === 1, [code(101), code(102)]);

    const sc = grid(wb.getWorksheet("Bảng điểm"));
    check("Bảng điểm: dòng 1 là tiêu đề 'Bảng điểm — …', dòng 2 là tiêu đề cột", String(sc[0]?.[0]).startsWith("Bảng điểm —") && sc[1]?.join("|") === "STT|Học sinh|Điểm (thang 10)|Nộp lúc|Thời gian làm|Mã đề|Lần rời màn hình", [sc[0], sc[1]]);
    const body = sc.slice(2);
    check("Bảng điểm: 3 học sinh, STT 1..3, xếp theo tên, điểm là SỐ 9 · 6 · 8 (cao nhất mỗi người)", body.length === 3 && body.map(r => r[0]).join() === "1,2,3" && body.map(r => r[1]).join("|") === RES_NAMES.slice(0, 3).join("|") && body.map(r => r[2]).join() === "9,6,8" && body.every(r => typeof r[2] === "number"), body);
    check("Bảng điểm: Gamma ở mã 102, Beta rời màn hình 3 lần, thời gian '5 phút 0 giây'", body[2]?.[5] === 102 && body[1]?.[6] === 3 && body[2]?.[4] === "5 phút 0 giây", body);
    check("Bảng điểm: giờ nộp theo GIỜ VN dd/MM/yyyy HH:mm — lượt cao nhất của Alpha nộp 12:20 UTC = 19:20 VN", body[0]?.[3] === "01/10/2026 19:20", body[0]);

    const qs = grid(wb.getWorksheet("Theo câu"));
    check("Theo câu: tiêu đề cột + 5 câu; câu 2 'Cần xem lại' = Có, câu 1 để trống", qs[0]?.join("|") === "Câu|Khoá câu|Tỉ lệ đúng (%)|Số lượt trả lời|Cần xem lại" && qs.length === 6 && qs.slice(1).filter(r => r[4] === "Có").length === 1, qs);
  }

  section("KHÔNG ô công thức nào; ô bắt đầu = + - @ bị đệm dấu nháy (tên học sinh / tên đề là dữ liệu tự nhập)");
  {
    check("tệp bình thường: không có ô nào là công thức", wb.worksheets.every(w => flat(w).every(v => !isFormula(v))));
    const evil = ['=HYPERLINK("http://evil.example","bam vao")', "+cmd|' /C calc'!A0", "@SUM(1+1)", "-2+3", "=SUM(1+1)"];
    await prisma.user.update({ where: { id: W.s[0].id }, data: { name: evil[0] } });
    await prisma.user.update({ where: { id: W.s[1].id }, data: { name: evil[1] } });
    await prisma.user.update({ where: { id: W.s[2].id }, data: { name: evil[2] } });
    await prisma.exam.update({ where: { id: W.root }, data: { title: evil[4] } });
    const d2 = await download(X(W.root), A);
    const w2 = await open(d2.bytes);
    const all = w2.worksheets.flatMap(w => flat(w));
    check("không ô công thức nào dù tên/tiêu đề là '=HYPERLINK(...)', '+cmd…', '@SUM…', '=SUM…'", d2.status === 200 && all.every(v => !isFormula(v)), all.filter(isFormula).slice(0, 3));
    const sc = grid(w2.getWorksheet("Bảng điểm")).slice(2).map(r => r[1]);
    check("tên bắt đầu '=' / '+' / '@' được ĐỆM nháy đơn: hiện đúng chữ gốc sau dấu nháy, không thực thi", sc.includes("'" + evil[0]) && sc.includes("'" + evil[1]) && sc.includes("'" + evil[2]), sc);
    check("tiêu đề đề bắt đầu '=' cũng được đệm", grid(w2.getWorksheet("Tổng quan"))[0]?.[1] === "'" + evil[4], grid(w2.getWorksheet("Tổng quan"))[0]);
    check("ĐỐI CHỨNG: chữ bình thường KHÔNG bị đệm nháy (Đề kết quả… đã đổi thành tên '=…', nên kiểm một ô tĩnh 'Số lượt đã nộp')", grid(w2.getWorksheet("Tổng quan")).some(r => r[0] === "Số lượt đã nộp"));
    check("tên tệp vẫn ASCII dù tiêu đề đề đổi", /^attachment; filename="[\x20-\x7e]+"$/.test(d2.headers.get("content-disposition") ?? ""));
    await prisma.user.update({ where: { id: W.s[0].id }, data: { name: RES_NAMES[0] } });
    await prisma.user.update({ where: { id: W.s[1].id }, data: { name: RES_NAMES[1] } });
    await prisma.user.update({ where: { id: W.s[2].id }, data: { name: RES_NAMES[2] } });
    await prisma.exam.update({ where: { id: W.root }, data: { title: "Đề kết quả BU-03" } });
  }

  section("?chon= đổi đúng lượt; chon lạ → 400");
  {
    const row0 = async (q: string) => { const w = await open((await download(X(W.root, q), A)).bytes); return grid(w.getWorksheet("Bảng điểm")).slice(2).find(r => r[1] === RES_NAMES[0]); };
    check("dau → điểm 4 · cuoi → 9 · cao-nhat → 9 (Alpha)", (await row0("?chon=dau"))?.[2] === 4 && (await row0("?chon=cuoi"))?.[2] === 9 && (await row0("?chon=cao-nhat"))?.[2] === 9);
    const t = grid((await open((await download(X(W.root, "?chon=dau"), A)).bytes)).getWorksheet("Bảng điểm"));
    check("tiêu đề Bảng điểm nói rõ lựa chọn (khác nhau giữa dau và cao-nhat)", String(t[0]?.[0]) !== String(grid((await open((await download(X(W.root, "?chon=cao-nhat"), A)).bytes)).getWorksheet("Bảng điểm"))[0]?.[0]), t[0]);
    const bad = await api("GET", X(W.root, "?chon=hack"), { as: A });
    check("chon lạ → 400 BAD_CHON (JSON, không phải tệp)", bad.status === 400 && bad.json?.code === "BAD_CHON", [bad.status, bad.json]);
  }

  section("Chỉ gia sư chủ đề tải được (Excel có TÊN học sinh)");
  {
    const dB = await download(X(W.root), B);
    check("gia sư B → 403, không phải tệp, không chứa tên học sinh", dB.status === 403 && !/spreadsheetml/.test(dB.headers.get("content-type") ?? "") && !RES_NAMES.some(n => dB.bytes.toString("utf8").includes(n)), [dB.status, dB.headers.get("content-type")]);
    const dS = await download(X(W.root), a.S), dG = await download(X(W.root)), dP = await download(X(W.root), a.P), dAd = await download(X(W.root), a.SUP);
    check("học sinh 403 · khách 401 · gia sư chờ duyệt 403 · quản trị cấp 1 403", dS.status === 403 && dG.status === 401 && dP.status === 403 && dAd.status === 403, [dS.status, dG.status, dP.status, dAd.status]);
    check("đề không có → 404", (await download(X("khong-co"), A)).status === 404);
  }

  section("Đề chưa ai nộp: vẫn trả tệp, bảng rỗng");
  {
    const empty = await mkDraft(A, { n: 2, courseId: a.courseA.id });
    const de = await download(X(empty), A);
    const we = de.status === 200 ? await open(de.bytes) : null;
    check("200 và mở được; Bảng điểm chỉ còn 2 dòng tiêu đề; Tổng quan có 0 lượt", !!we && grid(we.getWorksheet("Bảng điểm")).length === 2 && grid(we.getWorksheet("Tổng quan")).find(r => r[0] === "Số lượt đã nộp")?.[1] === 0, [de.status, de.text.slice(0, 100)]);
    check("ô trống (không có số liệu) là chuỗi rỗng/ô trống, không phải 'NaN' hay 'null' chữ", !!we && we.worksheets.every(w => flat(w).every(v => v !== "NaN" && v !== "null" && v !== "undefined")));
  }

  await done();
})().catch(e => { console.error(e); process.exit(1); });
