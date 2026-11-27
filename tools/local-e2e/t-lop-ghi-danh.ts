// KiN lớp bước 6 — ghi danh, hồ sơ, đơn đăng ký, việc xong ở mức HÀM MÁY CHỦ (src/lib/lop/server/{ghi-danh,hoc-sinh,don,hom-nay}.ts) với giờ cố định, trên DB cục bộ của worktree.
// Chuyển từ test gốc của web lớp: nghiep-vu-db ("Ghi danh — chỉ chủ"), vong-2 (T33 việc xong, T34 nghi_luc, hoàn tác chuyển chính thức, tạo hồ sơ tay, ẩn hồ sơ),
// vong-3 (P2-2 hạn hoàn tác, P2-3 gia hạn bỏ qua môn đã nghỉ, sửa ghi chú hồ sơ), vong-4 (mục 21 / T43 đơn, mục 22 lọc ngày hết thử), vong-5 (T46, xem trước, gắn hồ sơ).
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-lop-ghi-danh.ts   (cần cầu nối DB — .local-dev/wt-up.sh tự bật; KHÔNG cần dev server).
// Dữ liệu: bài tự nạp lại bca_* từ `bca_gia` trước mỗi nhóm (như mỗi tệp test gốc tự seed) và sau khi chạy (lop-db.ts) — không wipe(), không đụng bảng KiN.
// KHÔNG chuyển: đơn giá dự kiến 65/55 nghìn khi chuyển chính thức (học phí — README mục 6.4; chỉ giữ soMonChinhThuc), thu hồi phiên học sinh (phiên là của KiN), đổi lịch môn.
// Phần quyền qua HTTP, phân công giáo viên: t-lop-ghi-api.ts.
import { check, section, done } from "./h";
import { CHU, GV_ANH, buoiId, db, giay, hsId, loi, napLaiBca, nguoi } from "./lop-db";
import { d2s, lucVN, s2d } from "@/lib/lop/ngay";
import { LoiQuyen } from "@/lib/lop/quyen";
import { tenGiong } from "@/lib/lop/chuan-hoa";
import { anHocSinh, boAnHocSinh, chuyenChinhThuc, giaHanThu, hoanTacChuyenChinhThuc, hoanTacGiaHan, nghiMon, themMon } from "@/lib/lop/server/ghi-danh";
import { chiTietHocSinh, danhSachHocSinh, suaGhiChuHocSinh, suaHoSoHocSinh, taoHocSinh } from "@/lib/lop/server/hoc-sinh";
import { boQuaDon, hoanTacXuLyDon, taoHoSoTuDon, xemTruocDon } from "@/lib/lop/server/don";
import { boDanhDauXong, danhDauXong, homNay } from "@/lib/lop/server/hom-nay";

const T22 = lucVN("2026-11-26", "22:00");
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** a chứa mọi khoá của b với đúng giá trị (như toMatchObject, một tầng + lồng). */
const khop = (a: unknown, b: unknown): boolean =>
  b !== null && typeof b === "object" ? a !== null && typeof a === "object" && Object.entries(b).every(([k, v]) => khop((a as Record<string, unknown>)[k], v)) : a === b;
const dong = async (ma: string, mon?: number) =>
  (await db.bcaGhiDanh.findMany({ where: { hoc_sinh: { ma_hs: ma }, ...(mon ? { mon_id: mon } : {}) }, orderBy: { id: "asc" } }))
    .map((g) => `${g.mon_id}:${g.loai}:${d2s(g.tu_ngay)}→${g.den_ngay ? d2s(g.den_ngay) : "…"}${g.huy_luc ? ":huy" : ""}${g.nghi_luc ? ":nghi" : ""}`);
let soYc = 900, soGd = 0;
const taoDon = (v: { ngay?: string; loai?: string; ho_ten?: string; gmail?: string; sdt_hs?: string; sdt_ph?: string; mon?: number[] }) =>
  db.bcaDonDangKy.create({
    data: {
      thoi_gian: lucVN(v.ngay ?? "2026-11-26", "20:00"), nguon: "Web", loai: v.loai ?? "Học thử", ho_ten: v.ho_ten ?? "Người Thử Mới", gmail: v.gmail, sdt_hs: v.sdt_hs, sdt_ph: v.sdt_ph,
      mon_ids: v.mon ?? [1], ma_yeu_cau: `YC${++soYc}`, trang_thai: "cho_duyet", loi_du_lieu: [],
    },
  });
async function taoHs(maHs: string, gds: [number, "thu" | "chinh_thuc", string, string | null][]) {
  const hs = await db.bcaHocSinh.create({ data: { ma_hs: maHs, ho_ten: `Em ${maHs}`, ngay_tao: s2d("2026-10-01") } });
  for (const [mon_id, loai, tu, den] of gds)
    await db.bcaGhiDanh.create({ data: { ma_gd: `GD9${String(++soGd).padStart(4, "0")}`, hoc_sinh_id: hs.id, mon_id, loai, tu_ngay: s2d(tu), den_ngay: den ? s2d(den) : null } });
  return hs;
}

async function main() {
  napLaiBca();
  let chu = await nguoi(CHU), gvAnh = await nguoi(GV_ANH);

  section("Ghi danh — chỉ chủ (nghiep-vu-db)");
  {
    const r = await giaHanThu(chu, ["HS0021", "HS0065"], { soNgay: 7 }, "Em bận thi (giả)", T22);
    check("gia hạn 2 em +7 ngày (T29): em còn hạn dời tới 05/12, em đã hết được đoạn mới tới 02/12", eq(r.ketQua, [{ ma_hs: "HS0021", den_moi: "2026-12-05", doan_moi: false }, { ma_hs: "HS0065", den_moi: "2026-12-02", doan_moi: true }]), r.ketQua);
    check("CSDL: HS0021 Sử 15/11→05/12; HS0065 Toán thêm đoạn 26/11→02/12", eq(await dong("HS0021", 2), ["2:thu:2026-11-15→2026-12-05"]) && eq(await dong("HS0065", 1), ["1:thu:2026-11-05→2026-11-18", "1:thu:2026-11-26→2026-12-02"]), [await dong("HS0021", 2), await dong("HS0065", 1)]);
    const nk = await db.bcaNhatKy.findUniqueOrThrow({ where: { id: r.nhatKyId } });
    check("nhật ký nhóm gia hạn: đúng người (bca_nguoi_dung.id), vai chủ, có lý do", nk.nguoi_dung_id === chu.id && nk.vai_tro === "chu" && (nk.sau as { ly_do?: string }).ly_do === "Em bận thi (giả)", nk);
    check("hoàn tác sau 3 giây trả đủ 4 dòng", eq(await hoanTacGiaHan(chu, r.nhatKyId, giay(T22, 3)), { traLai: 4, boQua: 0 }));
    check("sau hoàn tác: HS0021 về 28/11, HS0065 còn một đoạn", eq(await dong("HS0021", 2), ["2:thu:2026-11-15→2026-11-28"]) && (await dong("HS0065", 1)).length === 1);
    check("hoàn tác lần hai → 409 da_hoan_tac", (await loi(() => hoanTacGiaHan(chu, r.nhatKyId, giay(T22, 4))))?.ma === "da_hoan_tac");
    check("gia hạn thiếu lý do → 400 'lý do'", /lý do/.test((await loi(() => giaHanThu(chu, ["HS0021"], { soNgay: 3 }, " ", T22)))?.message ?? ""));
    const cam = await Promise.all([
      loi(() => giaHanThu(gvAnh, ["HS0022"], { soNgay: 3 }, "x", T22)), loi(() => chuyenChinhThuc(gvAnh, "HS0022", ["anh"], {}, T22)),
      loi(() => themMon(gvAnh, "HS0022", "toan", "thu", undefined, T22)), loi(() => nghiMon(gvAnh, "HS0022", "anh", undefined, T22)),
    ]);
    check("GV không được gia hạn / chuyển chính thức / thêm môn / cho nghỉ (QĐ 16) → LoiQuyen cả bốn", cam.every((e) => e instanceof LoiQuyen), cam.map((e) => e?.message));
    const ct = await chuyenChinhThuc(chu, "HS0022", ["anh"], {}, T22);
    check("chuyển chính thức mặc định = ngày sau hết thử (29/11 → 30/11), 1 môn; KHÔNG trả đơn giá (mục 6.4)", ct.soMonChinhThuc === 1 && !("donGiaDuKien" in ct) && eq(await dong("HS0022", 4), ["4:thu:2026-11-16→2026-11-29", "4:chinh_thuc:2026-11-30→…"]), [ct, await dong("HS0022", 4)]);
    const ct2 = await chuyenChinhThuc(chu, "HS0023", ["toan", "anh"], { tuNgay: "2026-11-26" }, T22);
    const gCt = await db.bcaGhiDanh.findFirstOrThrow({ where: { hoc_sinh_id: await hsId("HS0023"), mon_id: 1, loai: "chinh_thuc" } });
    check("lên sớm từ 26/11 cả Toán + Anh: thử cắt còn 25/11, 2 môn, ghi chú 'Lên chính thức sớm từ 26/11'", ct2.soMonChinhThuc === 2 && eq(await dong("HS0023", 1), ["1:thu:2026-11-17→2026-11-25", "1:chinh_thuc:2026-11-26→…"]) && gCt.ghi_chu === "Lên chính thức sớm từ 26/11" && gCt.tao_boi === chu.id, [await dong("HS0023", 1), gCt.ghi_chu]);
    const dem = (await db.bcaBoDem.findUniqueOrThrow({ where: { khoa: "gd" } })).gia_tri;
    const tm = await themMon(chu, "HS0024", "toan", "thu", undefined, T22) as { thayDoi: { kieu: string; ma_gd: string; den_moi: string }[] };
    check("thêm môn thử theo cửa sổ chung (hết 01/12); mã GD mới tăng từ bộ đếm", khop(tm.thayDoi[0], { kieu: "tao", ma_gd: `GD${String(dem + 1).padStart(5, "0")}`, den_moi: "2026-12-01" }), tm.thayDoi);
    const ng = await nghiMon(chu, "HS0002", "anh", undefined, lucVN("2026-11-26", "21:00"));
    check("cho nghỉ trước 22:00 → hết hôm qua (25/11)", ng.denNgay === "2026-11-25" && eq(await dong("HS0002", 4), ["4:chinh_thuc:2026-06-30→2026-11-25:nghi"]), [ng.denNgay, await dong("HS0002", 4)]);
    const c2 = await chiTietHocSinh(chu, "HS0002", T22);
    check("hồ sơ HS0002: tình trạng 'Thử đến 03/12'; lịch sử Anh có dòng nghi_mon đứng tên chủ", c2.tinh_trang === "Thử đến 03/12" && khop(c2.mon.find((m) => m.ma === "anh")?.lich_su.at(-1), { ai: "Chủ lớp (thử)", hanh_dong: "nghi_mon" }), [c2.tinh_trang, c2.mon.find((m) => m.ma === "anh")?.lich_su.at(-1)]);
    check("CSDL chặn chồng ngày cùng em cùng môn (EXCLUDE)", (await loi(async () => db.bcaGhiDanh.create({ data: { ma_gd: "GD99999", hoc_sinh_id: await hsId("HS0003"), mon_id: 1, loai: "thu", tu_ngay: s2d("2026-12-01"), den_ngay: s2d("2026-12-10") } }))) !== null);
  }

  napLaiBca(); chu = await nguoi(CHU); gvAnh = await nguoi(GV_ANH);
  section("T33 — đánh dấu xong ở màn Hôm nay (vong-2)");
  {
    const coViec = async (luc: Date, loai: string, khoa: string) => (await homNay(chu, luc)).viec.some((v) => v.loai === loai && v.khoa === khoa);
    const v = (await homNay(chu, T22)).viec.find((x) => x.loai === "thu_sap_het" && x.ngay === "2026-11-28")!;
    const r = await danhDauXong(chu, "thu_sap_het", v.khoa, T22);
    const sau = await homNay(chu, T22);
    check("thử sắp hết: ẩn 3 ngày (tới 28/11), còn 7 việc, thẻ số vẫn đếm 8", r.an_den === "2026-11-28" && sau.viec.filter((x) => x.loai === "thu_sap_het").length === 7 && sau.so_viec_da_an === 1 && sau.the_so?.thu_het_3_ngay === 8, [r, sau.so_viec_da_an, sau.the_so]);
    check("28/11 21:00 vẫn ẩn; bỏ đánh dấu thì hiện lại; bỏ lần hai → 404", !(await coViec(lucVN("2026-11-28", "21:00"), "thu_sap_het", v.khoa)) && !!(await boDanhDauXong(chu, "thu_sap_het", v.khoa)) && (await coViec(T22, "thu_sap_het", v.khoa)) && (await loi(() => boDanhDauXong(chu, "thu_sap_het", v.khoa)))?.status === 404);
    const b = await danhDauXong(chu, "buoi_chua_diem_danh", "anh", T22);
    check("buổi chưa điểm danh: ẩn đến hết hôm nay, sáng 27/11 hiện lại", b.an_den === "2026-11-26" && !(await coViec(T22, "buoi_chua_diem_danh", "anh")) && (await coViec(lucVN("2026-11-27", "09:00"), "buoi_chua_diem_danh", "anh")));
    const trc = await db.bcaViecXong.count();
    check("GV không đánh dấu / bỏ đánh dấu được (LoiQuyen, không ghi gì); loại việc lạ → 400", (await loi(() => danhDauXong(gvAnh, "buoi_chua_diem_danh", "anh", T22))) instanceof LoiQuyen && (await loi(() => boDanhDauXong(gvAnh, "buoi_chua_diem_danh", "anh"))) instanceof LoiQuyen
      && (await db.bcaViecXong.count()) === trc && (await loi(() => danhDauXong(chu, "xoa_het", "x", T22)))?.status === 400);
  }

  section("T34 — cột nghi_luc (vong-2)");
  {
    const hs = await hsId("HS0061");
    await db.bcaGhiDanh.updateMany({ where: { hoc_sinh_id: hs }, data: { ghi_chu: "Cho nghỉ đến hết 14/11" } });
    check("ghi chú 'Cho nghỉ…' không còn tác dụng: em vẫn ở việc 'Hết thử – hỏi em'", (await homNay(chu, T22)).viec.some((x) => x.loai === "het_thu" && x.khoa === "HS0061"));
    await db.bcaGhiDanh.updateMany({ where: { hoc_sinh_id: hs }, data: { ghi_chu: null } });
    await nghiMon(chu, "HS0062", ["toan", "anh"], undefined, T22);
    const gds = await db.bcaGhiDanh.findMany({ where: { hoc_sinh: { ma_hs: "HS0062" } } });
    check("cho nghỉ cả hai môn em hết thử → nghi_luc + nghi_boi = chủ, ngày giữ 15/11", gds.length === 2 && gds.every((g) => g.nghi_boi === chu.id && g.ghi_chu === null && g.nghi_luc && d2s(g.den_ngay!) === "2026-11-15"), gds);
    check("hết việc 'Hết thử – hỏi em'; tình trạng 'Đã nghỉ'; cho nghỉ lần hai → 409", !(await homNay(chu, T22)).viec.some((x) => x.loai === "het_thu" && x.khoa === "HS0062") && (await chiTietHocSinh(chu, "HS0062", T22)).tinh_trang === "Đã nghỉ"
      && (await loi(() => nghiMon(chu, "HS0062", "toan", undefined, T22))) !== null);
    await nghiMon(chu, "HS0003", "toan", undefined, lucVN("2026-11-26", "22:30"));
    const g = await db.bcaGhiDanh.findFirstOrThrow({ where: { hoc_sinh: { ma_hs: "HS0003" }, mon_id: 1, loai: "chinh_thuc" } });
    check("cho nghỉ em đang học lúc 22:30 → cắt hết hôm nay (26/11), có nghi_luc", d2s(g.den_ngay!) === "2026-11-26" && !!g.nghi_luc);
  }

  section("Hoàn tác chuyển chính thức — chỉ chủ, một lần, trong hạn (vong-2)");
  {
    const truoc = await dong("HS0027");
    const r = await chuyenChinhThuc(chu, "HS0027", ["toan", "anh"], { tuNgay: "2026-11-26" }, T22);
    const doi = !eq(await dong("HS0027"), truoc);
    check("HS0027 thử Toán + Anh lên chính thức từ 26/11 (2 môn); hoàn tác sau 3 giây trả đúng như cũ", r.soMonChinhThuc === 2 && doi && eq(await hoanTacChuyenChinhThuc(chu, "HS0027", r.nhatKyId, giay(T22, 3)), { traLai: 4 }) && eq(await dong("HS0027"), truoc), await dong("HS0027"));
    check("hoàn tác lần hai → 409 da_hoan_tac", (await loi(() => hoanTacChuyenChinhThuc(chu, "HS0027", r.nhatKyId, giay(T22, 4))))?.ma === "da_hoan_tac");
    const t28 = await dong("HS0028");
    const r28 = await chuyenChinhThuc(chu, "HS0028", ["su"], { nghiMonThuConLai: true }, T22);
    const soNghi = (await dong("HS0028")).filter((x) => x.endsWith(":nghi")).length;
    await hoanTacChuyenChinhThuc(chu, "HS0028", r28.nhatKyId, giay(T22, 2));
    check("kèm 'cho nghỉ các môn thử còn lại' (2 môn nghỉ): hoàn tác bỏ cả nghi_luc", soNghi === 2 && eq(await dong("HS0028"), t28), [soNghi, await dong("HS0028")]);
    const r29 = await chuyenChinhThuc(chu, "HS0029", ["toan"], {}, T22);
    const s29 = await dong("HS0029");
    const r30 = await chuyenChinhThuc(chu, "HS0030", ["anh"], {}, T22);
    await nghiMon(chu, "HS0030", "anh", undefined, giay(T22, 1));
    check("quá hạn (11 giây) → 409 het_gio; đã có thay đổi sau → 409 da_sua; không đổi gì", (await loi(() => hoanTacChuyenChinhThuc(chu, "HS0029", r29.nhatKyId, giay(T22, 11))))?.ma === "het_gio"
      && (await loi(() => hoanTacChuyenChinhThuc(chu, "HS0030", r30.nhatKyId, giay(T22, 2))))?.ma === "da_sua" && eq(await dong("HS0029"), s29));
    const r31 = await chuyenChinhThuc(chu, "HS0031", ["anh"], {}, T22);
    check("GV hoàn tác → LoiQuyen; mã em không khớp lần chuyển → 404; chủ đúng em → được", (await loi(() => hoanTacChuyenChinhThuc(gvAnh, "HS0031", r31.nhatKyId, giay(T22, 1)))) instanceof LoiQuyen
      && (await loi(() => hoanTacChuyenChinhThuc(chu, "HS0032", r31.nhatKyId, giay(T22, 1))))?.status === 404 && (await hoanTacChuyenChinhThuc(chu, "HS0031", r31.nhatKyId, giay(T22, 2))).traLai > 0);
  }

  section("Tạo hồ sơ tay + ẩn hồ sơ (vong-2)");
  {
    const r = await taoHocSinh(chu, { hoTen: "  Trần   Văn  Mới ", sdtHs: "+84 900 000 001", sdtPh: "0910000000", gmail: " Moi.Em@Gamil.com " }, T22);
    const hs = await db.bcaHocSinh.findUniqueOrThrow({ where: { ma_hs: "HS0084" } });
    check("mã mới HS0084, lứa L2 theo ngày tạo, chuẩn hoá SĐT / Gmail, gợi ý Gmail gõ nhầm, cảnh báo trùng SĐT HS0001", khop(r, { ma_hs: "HS0084", lua: "L2", sdt_hs: "0900000001", goi_y_gmail: "moi.em@gmail.com", trung_sdt: ["HS0001"] })
      && khop(hs, { ho_ten: "Trần Văn Mới", gmail: "moi.em@gamil.com", nguon: "Chủ thêm tay" }) && d2s(hs.ngay_tao) === "2026-11-26", r);
    check("ngày tạo 30/09 → HS0085 lứa L1", khop(await taoHocSinh(chu, { hoTen: "Em lứa 1", ngayTao: "2026-09-30" }, T22), { ma_hs: "HS0085", lua: "L1" }));
    const n = await db.bcaHocSinh.count();
    check("trùng Gmail → 409 trung_gmail; thiếu tên → 400; GV → LoiQuyen; không tạo gì", (await loi(() => taoHocSinh(chu, { hoTen: "Trùng", gmail: "HS1@example.com" }, T22)))?.ma === "trung_gmail" && (await loi(() => taoHocSinh(chu, { hoTen: "  " }, T22)))?.status === 400
      && (await loi(() => taoHocSinh(gvAnh, { hoTen: "GV tạo" }, T22))) instanceof LoiQuyen && (await db.bcaHocSinh.count()) === n);
    const pair = await Promise.allSettled([taoHocSinh(chu, { hoTen: "Cùng lúc A", gmail: "cung.luc@example.com" }, T22), taoHocSinh(chu, { hoTen: "Cùng lúc B", gmail: "cung.luc@example.com" }, T22)]);
    check("hai lần tạo hồ sơ cùng Gmail cùng lúc → đúng một lần được (vong-3 P3-12)", pair.filter((x) => x.status === "fulfilled").length === 1, pair.map((x) => x.status));

    const truoc = await dong("HS0033");
    const an = await anHocSinh(chu, "HS0033", undefined, lucVN("2026-11-26", "21:00"));
    check("ẩn lúc 21:00 → mọi môn còn mở hết 25/11 + nghi_luc", an.denNgay === "2026-11-25" && eq(await dong("HS0033"), truoc.map((x) => x.replace(/→.*$/, "→2026-11-25:nghi"))), await dong("HS0033"));
    check("biến khỏi danh sách và Hôm nay; ẩn lần hai → 409", !(await danhSachHocSinh(chu, {}, T22)).hoc_sinh.some((h) => h.ma_hs === "HS0033") && !JSON.stringify((await homNay(chu, T22)).viec).includes("HS0033") && (await loi(() => anHocSinh(chu, "HS0033", undefined, T22)))?.status === 409);
    check("bỏ ẩn trong ngày → khôi phục ghi danh như cũ", (await boAnHocSinh(chu, "HS0033", lucVN("2026-11-26", "21:05"))).khoi_phuc_ghi_danh === true && eq(await dong("HS0033"), truoc));
    await anHocSinh(chu, "HS0034", undefined, T22);
    const s34 = await dong("HS0034");
    check("bỏ ẩn sang hôm sau → chỉ hiện lại hồ sơ, ghi danh vẫn dừng", (await boAnHocSinh(chu, "HS0034", lucVN("2026-11-27", "22:00"))).khoi_phuc_ghi_danh === false && eq(await dong("HS0034"), s34) && (await db.bcaHocSinh.findUniqueOrThrow({ where: { ma_hs: "HS0034" } })).an_luc === null);
    check("GV ẩn / bỏ ẩn → LoiQuyen", (await loi(() => anHocSinh(gvAnh, "HS0035", undefined, T22))) instanceof LoiQuyen && (await loi(() => boAnHocSinh(gvAnh, "HS0070", T22))) instanceof LoiQuyen);
  }

  section("Ghi chú + sửa hồ sơ (vong-3 mục 2; sửa hồ sơ là phần mới của KiN)");
  {
    const r = await suaGhiChuHocSinh(chu, "HS0002", { ghiChu: " Hay quên bài ", ghiChuRieng: "PH khó tính" });
    check("sửa ghi chú: cắt khoảng trắng, có đúng một nhật ký", khop(r, { ghi_chu: "Hay quên bài", ghi_chu_rieng: "PH khó tính" }) && (await db.bcaNhatKy.count({ where: { hanh_dong: "sua_ghi_chu_hoc_sinh", doi_tuong_id: "HS0002" } })) === 1);
    check("GV → LoiQuyen và không đổi; mã lạ → 404; không có gì để lưu → 400; quá 2.000 ký tự → 400", (await loi(() => suaGhiChuHocSinh(gvAnh, "HS0002", { ghiChuRieng: "đổi" }))) instanceof LoiQuyen && (await db.bcaHocSinh.findUniqueOrThrow({ where: { ma_hs: "HS0002" } })).ghi_chu_rieng === "PH khó tính"
      && (await loi(() => suaGhiChuHocSinh(chu, "HS9999", { ghiChu: "x" })))?.status === 404 && (await loi(() => suaGhiChuHocSinh(chu, "HS0002", {})))?.status === 400 && (await loi(() => suaGhiChuHocSinh(chu, "HS0002", { ghiChu: "x".repeat(2001) })))?.status === 400);
    const s = await suaHoSoHocSinh(chu, "HS0002", { hoTen: "  Nguyễn Hoàng   Bảo Ngọc Phương Anh ", sdtPh: "+84 812 345 678", truong: "" });
    const hs = await db.bcaHocSinh.findUniqueOrThrow({ where: { ma_hs: "HS0002" } });
    const nk = await db.bcaNhatKy.findFirstOrThrow({ where: { hanh_dong: "sua_ho_so_hoc_sinh", doi_tuong_id: "HS0002" } });
    check("sửa hồ sơ: chuẩn hoá tên / SĐT, chuỗi rỗng xoá ô, ô không gửi giữ nguyên, nhật ký có trước / sau", hs.ho_ten === "Nguyễn Hoàng Bảo Ngọc Phương Anh" && hs.sdt_ph === "0812345678" && hs.truong === null && hs.sdt_hs === "0910000001" && s.ma_hs === "HS0002"
      && nk.nguoi_dung_id === chu.id && "ho_ten" in (nk.truoc as object) && (nk.sau as { sdt_ph?: string }).sdt_ph === "0812345678", [hs.ho_ten, hs.sdt_ph, hs.truong, nk.truoc]);
    check("Gmail đã thuộc hồ sơ khác → 409 trung_gmail; Gmail gõ nhầm đuôi → 400; xoá họ tên → 400; GV → LoiQuyen; không ô nào → 400", (await loi(() => suaHoSoHocSinh(chu, "HS0002", { gmail: "HS1@example.com" })))?.ma === "trung_gmail"
      && (await loi(() => suaHoSoHocSinh(chu, "HS0002", { gmail: "a@gamil.com" })))?.status === 400 && (await loi(() => suaHoSoHocSinh(chu, "HS0002", { hoTen: " " })))?.status === 400
      && (await loi(() => suaHoSoHocSinh(gvAnh, "HS0002", { hoTen: "x" }))) instanceof LoiQuyen && (await loi(() => suaHoSoHocSinh(chu, "HS0002", {})))?.status === 400 && (await db.bcaHocSinh.findUniqueOrThrow({ where: { ma_hs: "HS0002" } })).gmail === hs.gmail);
  }

  napLaiBca(); chu = await nguoi(CHU); gvAnh = await nguoi(GV_ANH);
  section("Hạn hoàn tác 10 giây + gia hạn bỏ qua môn đã nghỉ (vong-3 P2-2, P2-3; vong-4 mục 22)");
  {
    const viec = (await homNay(chu, T22)).viec;
    const nhom = (loai: string, ngay: string) => viec.filter((v) => v.loai === loai && v.ngay === ngay).map((v) => v.ma_hs).sort();
    const khopNhom = await Promise.all([["thu_sap_het", "2026-11-28"], ["thu_sap_het", "2026-11-29"], ["het_thu", "2026-11-15"]].map(async ([l, n]) => { const ds = (await danhSachHocSinh(chu, { hetNgay: n }, T22)).hoc_sinh.map((x) => x.ma_hs).sort(); return ds.length > 0 && eq(ds, nhom(l, n)); }));
    check("danh sách lọc het_ngay khớp đúng nhóm việc ở Hôm nay (28/11, 29/11 sắp hết; 15/11 hết thử)", khopNhom.every(Boolean), khopNhom);
    const gh = await giaHanThu(chu, ["HS0024"], { soNgay: 3 }, "quá hạn", T22);
    const t24 = await dong("HS0024", 4);
    check("hoàn tác gia hạn sau 11 giây → 409 het_gio, ghi danh giữ nguyên", (await loi(() => hoanTacGiaHan(chu, gh.nhatKyId, giay(T22, 11))))?.ma === "het_gio" && eq(await dong("HS0024", 4), t24));
    const gh21 = await giaHanThu(chu, ["HS0021"], { soNgay: 7 }, "có điểm danh", T22);
    const s21 = await dong("HS0021", 1);
    await db.bcaDiemDanh.create({ data: { buoi_id: await buoiId(1, "2026-12-01"), hoc_sinh_id: await hsId("HS0021"), trang_thai: "co", ghi_luc: T22 } });
    check("hoàn tác gia hạn mà đoạn sắp bị cắt đã có điểm danh → 409 co_diem_danh, không đổi gì", (await loi(() => hoanTacGiaHan(chu, gh21.nhatKyId, giay(T22, 3))))?.ma === "co_diem_danh" && eq(await dong("HS0021", 1), s21));
    const gh26 = await giaHanThu(chu, ["HS0026"], { soNgay: 3 }, "đồng thời", T22);
    const hai = await Promise.allSettled([hoanTacGiaHan(chu, gh26.nhatKyId, giay(T22, 2)), hoanTacGiaHan(chu, gh26.nhatKyId, giay(T22, 2))]);
    const st = (r: PromiseSettledResult<unknown>[]) => r.map((x) => (x.status === "rejected" ? (x.reason as { status?: number }).status : 200)).sort();
    const ct = await chuyenChinhThuc(chu, "HS0027", ["anh"], {}, T22);
    const hai2 = await Promise.allSettled([hoanTacChuyenChinhThuc(chu, "HS0027", ct.nhatKyId, giay(T22, 2)), hoanTacChuyenChinhThuc(chu, "HS0027", ct.nhatKyId, giay(T22, 2))]);
    check("hai lần hoàn tác cùng lúc (gia hạn, chuyển chính thức) → một lần chạy, lần kia 409", eq(st(hai), [200, 409]) && eq(st(hai2), [200, 409]), [st(hai), st(hai2)]);
    await nghiMon(chu, "HS0035", "anh", undefined, lucVN("2026-11-26", "22:30"));
    const r35 = await giaHanThu(chu, ["HS0035"], { soNgay: 7 }, "chỉ Toán", lucVN("2026-11-26", "22:31"));
    check("HS0035: 22:30 cho nghỉ Anh (hết 26/11) → gia hạn +7 chỉ dời Toán tới 08/12", eq(r35.ketQua, [{ ma_hs: "HS0035", den_moi: "2026-12-08", doan_moi: false }]) && eq(await dong("HS0035", 1), ["1:thu:2026-11-18→2026-12-08"]) && eq(await dong("HS0035", 4), ["4:thu:2026-11-18→2026-11-26:nghi"]), [await dong("HS0035", 1), await dong("HS0035", 4)]);
    await nghiMon(chu, "HS0062", "anh", undefined, T22);
    await giaHanThu(chu, ["HS0062"], { soNgay: 7 }, "chỉ Toán", T22);
    check("HS0062 hết thử 15/11, chủ cho nghỉ Anh → gia hạn tạo đoạn mới chỉ Toán", eq(await dong("HS0062", 1), ["1:thu:2026-11-02→2026-11-15", "1:thu:2026-11-26→2026-12-02"]) && eq(await dong("HS0062", 4), ["4:thu:2026-11-02→2026-11-15:nghi"]));
    check("ngày hết mới không sau ngày hết hiện tại → 409 (LoiQuyTac); số ngày −5 / 9999 / 0 / 1.5 / thiếu cả hai → 400", (await loi(() => giaHanThu(chu, ["HS0036"], { denNgay: "2026-11-26" }, "x", T22)))?.constructor.name === "LoiQuyTac"
      && (await Promise.all([-5, 9999, 0, 1.5, undefined].map((soNgay) => loi(() => giaHanThu(chu, ["HS0036"], { soNgay }, "x", T22))))).every((e) => e?.status === 400));
  }

  napLaiBca(); chu = await nguoi(CHU); gvAnh = await nguoi(GV_ANH);
  section("T43 — tạo hồ sơ từ đơn, bỏ qua, hoàn tác (vong-4 mục 21)");
  {
    const id = (await db.bcaDonDangKy.findFirstOrThrow({ where: { ma_yeu_cau: "YC0041" } })).id;
    const coViecDon = async (i: number) => (await homNay(chu, T22)).viec.some((v) => v.loai === "don_cho_duyet" && v.khoa === String(i));
    const co0 = await coViecDon(id);
    check("xem trước đơn chờ của seed (25/11, Toán): thử 26/11 → 08/12, không trùng, không ghi gì", co0 && khop(await xemTruocDon(chu, id, T22), { ngay_dang_ky: "2026-11-25", thu_du_kien: { tu: "2026-11-26", den: "2026-12-08" }, muon_chinh_thuc: false, mon: ["toan"] }) && (await xemTruocDon(chu, id, T22)).trung.length === 0);
    const r = await taoHoSoTuDon(chu, id, {}, T22) as { nhatKyId: number };
    check("tạo HS0084, thử Toán 26/11 → 08/12 (= 25/11 + 13); đơn da_nhan; hết khỏi Hôm nay; tạo lần hai → 409 da_xu_ly", khop(r, { ket_qua: "da_tao", ma_hs: "HS0084", thu: { tu: "2026-11-26", den: "2026-12-08" }, mon: ["toan"], muon_chinh_thuc: false }) && eq(await dong("HS0084"), ["1:thu:2026-11-26→2026-12-08"])
      && (await db.bcaDonDangKy.findUniqueOrThrow({ where: { id } })).trang_thai === "da_nhan" && !(await coViecDon(id)) && (await loi(() => taoHoSoTuDon(chu, id, {}, T22)))?.ma === "da_xu_ly", r);
    await hoanTacXuLyDon(chu, id, r.nhatKyId, giay(T22, 8));
    check("hoàn tác sau 8 giây: hồ sơ HS0084 bị xoá, đơn về cho_duyet không gắn hồ sơ, việc hiện lại; hoàn tác lần hai → da_hoan_tac", (await db.bcaHocSinh.findUnique({ where: { ma_hs: "HS0084" } })) === null && khop(await db.bcaDonDangKy.findUniqueOrThrow({ where: { id } }), { trang_thai: "cho_duyet", hoc_sinh_id: null })
      && (await coViecDon(id)) && (await loi(() => hoanTacXuLyDon(chu, id, r.nhatKyId, giay(T22, 9))))?.ma === "da_hoan_tac");
    check("tạo lại: mã mới HS0085 (mã đã cấp không cấp lại)", khop(await taoHoSoTuDon(chu, id, {}, T22), { ket_qua: "da_tao", ma_hs: "HS0085" }));

    const d = await taoDon({ ho_ten: "Nguyễn Minh Bình", gmail: " HS21@example.com", mon: [1, 3] });
    const soHs = await db.bcaHocSinh.count();
    const tr = await taoHoSoTuDon(chu, d.id, {}, T22);
    check("trùng Gmail → trung_ho_so + gợi ý HS0021, không ghi gì", khop(tr, { ket_qua: "trung_ho_so", goi_y: { 0: { ma_hs: "HS0021", an: false } } }) && (await db.bcaHocSinh.count()) === soHs && (await db.bcaDonDangKy.findUniqueOrThrow({ where: { id: d.id } })).trang_thai === "cho_duyet", tr);
    const g = await taoHoSoTuDon(chu, d.id, { maHs: "HS0021" }, T22);
    check("gắn vào HS0021 đang thử: Địa hết cùng hạn chung 28/11 (5.2), Toán đang thử bỏ qua", khop(g, { ket_qua: "da_gan", ma_hs: "HS0021", thu: { tu: "2026-11-26", den: "2026-11-28" }, mon: { 0: "dia" }, bo_qua: { 0: { mon: "toan", ly_do: "dang_thu" } } }) && (await dong("HS0021")).at(-1) === "3:thu:2026-11-26→2026-11-28", g);
    const d2 = await taoDon({ gmail: "hs2@example.com", sdt_hs: "0911111111", sdt_ph: "+84 812 345 678", mon: [4] });
    const g2 = await taoHoSoTuDon(chu, d2.id, { maHs: "HS0002" }, T22) as { nhatKyId: number };
    const h2 = await db.bcaHocSinh.findUniqueOrThrow({ where: { ma_hs: "HS0002" } });
    await hoanTacXuLyDon(chu, d2.id, g2.nhatKyId, giay(T22, 3));
    check("gắn hồ sơ cũ chỉ điền ô trống (SĐT PH), không ghi đè SĐT HS; hoàn tác trả ô về trống", khop(g2, { ket_qua: "da_gan", dien: { 0: "sdt_ph" }, bo_qua: { 0: { mon: "anh", ly_do: "dang_chinh_thuc" } } }) && h2.sdt_ph === "0812345678" && h2.sdt_hs === "0910000001" && (await db.bcaHocSinh.findUniqueOrThrow({ where: { ma_hs: "HS0002" } })).sdt_ph === null, g2);
    const d61 = await taoDon({ gmail: "hs61@example.com", mon: [1] });
    const t61 = await dong("HS0061");
    check("T2: em hết thử (HS0061) đăng ký lại → can_chu_quyet het_thu_dang_ky_lai, không ghi gì", eq(await taoHoSoTuDon(chu, d61.id, { maHs: "HS0061" }, T22), { ket_qua: "can_chu_quyet", ly_do: "het_thu_dang_ky_lai", ma_hs: "HS0061", muon_chinh_thuc: false }) && eq(await dong("HS0061"), t61));
    check("chủ bấm Cấp thử → thử 14 ngày từ hôm nay (26/11 → 09/12)", khop(await taoHoSoTuDon(chu, d61.id, { maHs: "HS0061", capThuMoi: true }, T22), { ket_qua: "da_gan", thu: { tu: "2026-11-26", den: "2026-12-09" } }));
    const dct = await taoDon({ loai: "Chính thức", ho_ten: "Trần Văn Mới", mon: [2, 4] });
    const rct = await taoHoSoTuDon(chu, dct.id, {}, T22) as { ma_hs: string };
    const dcu = await taoDon({ ngay: "2026-11-01", ho_ten: "Lê Thị Cũ" });
    check("T3: đơn Chính thức của em chưa từng thử → ghi danh THỬ + muon_chinh_thuc; đơn quá 14 ngày → can_chu_quyet don_qua_han", khop(rct, { ket_qua: "da_tao", muon_chinh_thuc: true, thu: { tu: "2026-11-26", den: "2026-12-09" }, mon: { 0: "su", 1: "anh" } }) && (await dong(rct.ma_hs)).every((x) => x.includes(":thu:"))
      && khop(await taoHoSoTuDon(chu, dcu.id, {}, T22), { ket_qua: "can_chu_quyet", ly_do: "don_qua_han" }));
    const dbq = await taoDon({ ho_ten: "Đơn Bỏ Qua" });
    const thieu = await loi(() => boQuaDon(chu, dbq.id, "  ", T22));
    const bq = await boQuaDon(chu, dbq.id, "Gửi trùng", T22);
    check("bỏ qua: thiếu lý do → 400; có lý do → bo_qua + lưu lý do, hết khỏi Hôm nay; lần hai → da_xu_ly", thieu?.status === 400 && khop(await db.bcaDonDangKy.findUniqueOrThrow({ where: { id: dbq.id } }), { trang_thai: "bo_qua", ghi_chu_xu_ly: "Gửi trùng" }) && !(await coViecDon(dbq.id)) && (await loi(() => boQuaDon(chu, dbq.id, "lần hai", T22)))?.ma === "da_xu_ly");
    const hg = await loi(() => hoanTacXuLyDon(chu, dbq.id, bq.nhatKyId, giay(T22, 11)));
    await hoanTacXuLyDon(chu, dbq.id, bq.nhatKyId, giay(T22, 4));
    check("hoàn tác bỏ qua: quá 10 giây → het_gio; trong hạn → về cho_duyet, xoá lý do, việc hiện lại", hg?.ma === "het_gio" && khop(await db.bcaDonDangKy.findUniqueOrThrow({ where: { id: dbq.id } }), { trang_thai: "cho_duyet", ghi_chu_xu_ly: null }) && (await coViecDon(dbq.id)));
    const ddd = await taoDon({ ho_ten: "Phạm Có Điểm", mon: [4] });
    const rdd = await taoHoSoTuDon(chu, ddd.id, {}, T22) as { ma_hs: string; nhatKyId: number };
    const hdd = await db.bcaHocSinh.findUniqueOrThrow({ where: { ma_hs: rdd.ma_hs } });
    await db.bcaDiemDanh.create({ data: { buoi_id: await buoiId(4, "2026-11-26"), hoc_sinh_id: hdd.id, trang_thai: "co", ghi_luc: T22 } });
    check("hoàn tác tạo hồ sơ khi em đã có điểm danh → 409 co_diem_danh, hồ sơ còn nguyên", (await loi(() => hoanTacXuLyDon(chu, ddd.id, rdd.nhatKyId, giay(T22, 5))))?.ma === "co_diem_danh" && (await db.bcaHocSinh.findUnique({ where: { id: hdd.id } })) !== null);
    const dgv = await taoDon({ ho_ten: "Đơn GV gọi" });
    const cam = await Promise.all([loi(() => xemTruocDon(gvAnh, dgv.id, T22)), loi(() => taoHoSoTuDon(gvAnh, dgv.id, {}, T22)), loi(() => boQuaDon(gvAnh, dgv.id, "x", T22)), loi(() => hoanTacXuLyDon(gvAnh, dgv.id, 1, T22))]);
    check("GV xem trước / tạo hồ sơ / bỏ qua / hoàn tác → LoiQuyen cả bốn, đơn còn cho_duyet; đơn không có → 404", cam.every((e) => e instanceof LoiQuyen) && (await db.bcaDonDangKy.findUniqueOrThrow({ where: { id: dgv.id } })).trang_thai === "cho_duyet" && (await loi(() => xemTruocDon(chu, 999999, T22)))?.status === 404);
    check("tạo mới kèm họ tên sửa tay (taoMoi + hoSo)", khop(await taoHoSoTuDon(chu, dgv.id, { taoMoi: true, hoSo: { hoTen: "Tên Sửa Tay" } }, T22), { ket_qua: "da_tao" }) && (await db.bcaHocSinh.count({ where: { ho_ten: "Tên Sửa Tay" } })) === 1);
    check("tenGiong (ghi-danh.md 1.4)", tenGiong("Nguyễn Minh  An", "nguyen minh an") && !tenGiong("Lê Thị An", "Lê Văn Bình") && tenGiong("Trần Gia Bảo", "Gia Bảo") && !tenGiong("Trần Bảo", "Lê Bảo"));
  }

  napLaiBca(); chu = await nguoi(CHU); soYc = 5000;
  section("T46, xem trước, gắn hồ sơ (vong-5)");
  {
    await taoHs("HS9001", [[4, "thu", "2026-11-01", "2026-11-14"], [4, "chinh_thuc", "2026-11-15", null]]);
    const r1 = await taoHoSoTuDon(chu, (await taoDon({ mon: [1, 4] })).id, { maHs: "HS9001" }, T22);
    check("em đang học Chính thức Anh gửi đơn Toán + Anh → da_gan: thử Toán 26/11–09/12, Anh bỏ qua dang_chinh_thuc", khop(r1, { ket_qua: "da_gan", thu: { tu: "2026-11-26", den: "2026-12-09" }, mon: { 0: "toan" }, bo_qua: { 0: { mon: "anh", ly_do: "dang_chinh_thuc" } } }) && (await dong("HS9001")).at(-1) === "1:thu:2026-11-26→2026-12-09", r1);
    await taoHs("HS9002", [[2, "chinh_thuc", "2026-11-16", null]]);
    check("em đang học, đơn gửi 20/11 nhận muộn 26/11 → thử từ hôm nay, hết 03/12 (= 20/11 + 13, T44)", khop(await taoHoSoTuDon(chu, (await taoDon({ ngay: "2026-11-20", mon: [3] })).id, { maHs: "HS9002" }, T22), { ket_qua: "da_gan", thu: { tu: "2026-11-26", den: "2026-12-03" }, mon: { 0: "dia" } }));
    await taoHs("HS9003", [[2, "chinh_thuc", "2026-10-01", "2026-11-10"]]);
    const d3 = await taoDon({ ngay: "2026-11-20", mon: [1] }), t3 = await dong("HS9003");
    check("em đã nghỉ hết (từng Chính thức) → can_chu_quyet da_nghi_dang_ky_lai, không ghi gì, đơn còn cho_duyet", eq(await taoHoSoTuDon(chu, d3.id, { maHs: "HS9003" }, T22), { ket_qua: "can_chu_quyet", ly_do: "da_nghi_dang_ky_lai", ma_hs: "HS9003", muon_chinh_thuc: false }) && eq(await dong("HS9003"), t3) && (await db.bcaDonDangKy.findUniqueOrThrow({ where: { id: d3.id } })).trang_thai === "cho_duyet");
    check("Cấp thử với đơn còn trong 14 ngày → hết theo T44 (03/12)", khop(await taoHoSoTuDon(chu, d3.id, { maHs: "HS9003", capThuMoi: true }, T22), { ket_qua: "da_gan", thu: { tu: "2026-11-26", den: "2026-12-03" } }));
    await taoHs("HS9004", [[1, "thu", "2026-10-20", "2026-11-02"]]);
    const d4 = await taoDon({ ngay: "2026-11-01", mon: [1] });
    check("em từng thử đã hết → het_thu_dang_ky_lai; Cấp thử với đơn quá hạn (01/11) → 14 ngày từ hôm nay 26/11–09/12", khop(await taoHoSoTuDon(chu, d4.id, { maHs: "HS9004" }, T22), { ket_qua: "can_chu_quyet", ly_do: "het_thu_dang_ky_lai" })
      && khop(await taoHoSoTuDon(chu, d4.id, { maHs: "HS9004", capThuMoi: true }, T22), { ket_qua: "da_gan", thu: { tu: "2026-11-26", den: "2026-12-09" } }));
    const dTrong = await taoDon({ loai: "  " });
    check("loại đơn trống → muon_chinh_thuc false (xem trước và tạo)", (await xemTruocDon(chu, dTrong.id, T22)).muon_chinh_thuc === false && khop(await taoHoSoTuDon(chu, dTrong.id, { taoMoi: true }, T22), { ket_qua: "da_tao", muon_chinh_thuc: false }));
    const d21 = await taoDon({ gmail: "hs21@example.com", mon: [3] });
    const x = await xemTruocDon(chu, d21.id, T22);
    check("xem trước trùng Gmail HS0021 đang thử: hồ sơ đó hạn chung 28/11, hồ sơ mới 26/11–09/12; khớp lúc gắn thật", eq(x.thu_du_kien, { tu: "2026-11-26", den: "2026-12-09", ly_do: null }) && khop(x.trung, { 0: { ma_hs: "HS0021", thu_du_kien: { tu: "2026-11-26", den: "2026-11-28", ly_do: null } } })
      && khop(await taoHoSoTuDon(chu, d21.id, { maHs: "HS0021" }, T22), { ket_qua: "da_gan", thu: { tu: "2026-11-26", den: "2026-11-28" } }), x);
    const h5 = await taoHs("HS9005", [[2, "chinh_thuc", "2026-10-01", "2026-11-10"]]);
    const d5 = await taoDon({ mon: [1] });
    await db.bcaDonDangKy.update({ where: { id: d5.id }, data: { hoc_sinh_id: h5.id } });
    check("xem trước em đã nghỉ hết → thu_du_kien.ly_do da_nghi_dang_ky_lai, khớp 'don_da_gan'", khop((await xemTruocDon(chu, d5.id, T22)).trung, { 0: { ma_hs: "HS9005", khop: { 0: "don_da_gan" }, thu_du_kien: { ly_do: "da_nghi_dang_ky_lai" } } }));
    await taoHs("HS9006", [[4, "chinh_thuc", "2026-11-16", null]]);
    const r6 = await taoHoSoTuDon(chu, (await taoDon({ gmail: "HS21@example.com", sdt_ph: "0987654321", mon: [1] })).id, { maHs: "HS9006" }, T22);
    check("Gmail của đơn thuộc HS0021 → không điền gmail, trả trung_gmail HS0021; ô khác vẫn điền", khop(r6, { ket_qua: "da_gan", trung_gmail: "HS0021", dien: { 0: "sdt_ph" } }) && khop(await db.bcaHocSinh.findUniqueOrThrow({ where: { ma_hs: "HS9006" } }), { gmail: null, sdt_ph: "0987654321" }), r6);
    await taoHs("HS9007", [[4, "chinh_thuc", "2026-11-16", null]]);
    const d7 = await taoDon({ sdt_ph: "0901234567", mon: [1] });
    const r7 = await taoHoSoTuDon(chu, d7.id, { maHs: "HS9007" }, T22) as { nhatKyId: number; dien: string[] };
    await db.bcaHocSinh.update({ where: { ma_hs: "HS9007" }, data: { sdt_ph: "0911222333" } });
    const e7 = await loi(() => hoanTacXuLyDon(chu, d7.id, r7.nhatKyId, giay(T22, 3)));
    check("ô vừa điền bị sửa trước khi hoàn tác → 409 da_sua, giữ giá trị mới, ghi danh và đơn giữ nguyên", eq(r7.dien, ["sdt_ph"]) && e7?.ma === "da_sua" && (await db.bcaHocSinh.findUniqueOrThrow({ where: { ma_hs: "HS9007" } })).sdt_ph === "0911222333" && (await dong("HS9007")).length === 2 && (await db.bcaDonDangKy.findUniqueOrThrow({ where: { id: d7.id } })).trang_thai === "da_nhan");
    await db.bcaHocSinh.update({ where: { ma_hs: "HS9007" }, data: { sdt_ph: "0901234567" } });
    await hoanTacXuLyDon(chu, d7.id, r7.nhatKyId, giay(T22, 4));
    check("ô trở lại đúng giá trị đã điền ⇒ hoàn tác được: ô về trống, ghi danh mới bị xoá", (await db.bcaHocSinh.findUniqueOrThrow({ where: { ma_hs: "HS9007" } })).sdt_ph === null && (await dong("HS9007")).length === 1);
  }
}

main().catch((e) => { console.error(e); check("bài chạy hết không ném lỗi", false, String(e)); })
  .finally(() => { try { napLaiBca(); console.log("\n(đã nạp lại bca_* từ bca_gia)"); } catch (e) { console.error("KHÔNG nạp lại được bca_*:", e); } return done(); });
