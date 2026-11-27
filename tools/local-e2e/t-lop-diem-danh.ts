// KiN lớp bước 5 — điểm danh + buổi học ở mức HÀM MÁY CHỦ (src/lib/lop/server/{diem-danh,buoi-hoc}.ts) với giờ cố định, trên DB cục bộ của worktree.
// Chuyển từ test gốc của web lớp: bca/tests/nghiep-vu-db.test.ts ("Điểm danh", "Buổi học"), vong-2 ("Xoá buổi chưa có dữ liệu"), vong-4 (mục 20 / T42), api-quyen (danh sách buổi + ma trận theo vai).
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-lop-diem-danh.ts   (cần cầu nối DB cổng 443 — .local-dev/wt-up.sh tự bật; KHÔNG cần dev server).
// Dữ liệu: bài tự nạp lại bca_* từ `bca_gia` trước và sau khi chạy (tools/local-e2e/lop-db.ts) — không wipe(), không đụng bảng KiN.
// KHÔNG chuyển: "sinh buổi tháng lặp lại an toàn" (sinhBuoiThang chưa chép), phần học sinh không thấy ghi chú (khu học sinh — bước 7), đổi lịch môn.
// Ca phá cố ý (đã chạy 27/11/2026, phá → đỏ đúng ca → trả lại): bỏ `kiemGhi` trong datDiemDanh → 3 ca "chua_mo / 48 giờ" đỏ; bỏ `canMon` trong napBuoi → 2 ca "GV môn khác" đỏ;
// hoanTacTatCa bỏ điều kiện `ghi_luc: lucDanh` → ca "hoàn tác không đụng em đã sửa tay" đỏ; xoaBuoi bỏ kiểm `bat_dau_luc <= luc` → 2 ca "da_qua" đỏ.
import { check, section, done } from "./h";
import { CHU, GV_ANH, GV_TOAN, buoiId, db, giay, hsId, loi, napLaiBca, nguoi } from "./lop-db";
import { lucVN } from "@/lib/lop/ngay";
import { LoiQuyen } from "@/lib/lop/quyen";
import { chiTietDiemDanh, danhTatCaCoMat, datDiemDanh, hoanTacTatCa, maTranThang } from "@/lib/lop/server/diem-danh";
import { boHuyBuoi, danhSachBuoi, hoanTacXoaBuoi, huyBuoi, sinhBuoiConThieu, suaNoiDungBuoi, themHocBu, xemTruocBuoiConThieu, xoaBuoi } from "@/lib/lop/server/buoi-hoc";
import { homNay } from "@/lib/lop/server/hom-nay";

const T22 = lucVN("2026-11-26", "22:00");
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function main() {
  napLaiBca();
  const [chu, gvAnh, gvToan] = await Promise.all([nguoi(CHU), nguoi(GV_ANH), nguoi(GV_TOAN)]);

  section("Điểm danh (diem-danh.md)");
  {
    const id = await buoiId(4, "2026-11-26"), luc = lucVN("2026-11-26", "22:20");
    const ct = await chiTietDiemDanh(gvAnh, id, luc);
    check("buổi Anh 26/11 lúc 22:20: 43 em, đang mở ghi", ct.em.length === 43 && ct.trang_thai_ghi === "mo", [ct.em.length, ct.trang_thai_ghi]);
    const [a, b] = ct.em;
    await datDiemDanh(gvAnh, id, a.hoc_sinh_id, { trangThai: "vang" }, luc);
    await datDiemDanh(gvAnh, id, b.hoc_sinh_id, { trangThai: "vang" }, luc);
    const lucDanh = lucVN("2026-11-26", "22:21");
    const r = await danhTatCaCoMat(gvAnh, id, {}, lucDanh);
    check("chọn Vắng 2 em rồi 'đánh tất cả' → đặt Có cho 41 em còn lại, buổi xong", r.ids.length === 41 && eq(r.tien_do, { si_so: 43, da_diem: 43, xong: true }), r.tien_do);
    check("đếm: 41 Có + 2 Vắng, không còn em chưa điểm", eq((await chiTietDiemDanh(gvAnh, id, luc)).dem, { chua_diem: 0, co: 41, phep: 0, vang: 2 }));
    check("buổi đủ ⇒ da_diem_danh_luc được đặt", (await db.bcaBuoiHoc.findUniqueOrThrow({ where: { id } })).da_diem_danh_luc !== null);
    const dd = await db.bcaDiemDanh.findFirstOrThrow({ where: { buoi_id: id, hoc_sinh_id: r.ids[0] } });
    check("ghi_boi là bca_nguoi_dung.id của GV (uuid), nguồn web", dd.ghi_boi === gvAnh.id && dd.nguon === "web", dd);
    // Một em bị sửa tay sau "đánh tất cả" → hoàn tác không đụng em đó
    await datDiemDanh(gvAnh, id, r.ids[0], { trangThai: "phep" }, giay(lucDanh, 3));
    check("hoàn tác lần đánh của NGƯỜI KHÁC → 404", (await loi(async () => hoanTacTatCa(chu, id, r.luc, giay(lucDanh, 4))))?.status === 404);
    const h = await hoanTacTatCa(gvAnh, id, r.luc, giay(lucDanh, 5));
    check("hoàn tác trong hạn: trả 40 em về chưa điểm, không đụng em đã sửa tay", h.so_tra_lai === 40, h);
    check("hoàn tác lần hai → 409 da_hoan_tac", (await loi(async () => hoanTacTatCa(gvAnh, id, r.luc, giay(lucDanh, 6))))?.ma === "da_hoan_tac");
    check("sau hoàn tác: 40 chưa điểm · 1 Phép · 2 Vắng", eq((await chiTietDiemDanh(gvAnh, id, luc)).dem, { chua_diem: 40, co: 0, phep: 1, vang: 2 }));
    check("không còn đủ ⇒ da_diem_danh_luc bị bỏ", (await db.bcaBuoiHoc.findUniqueOrThrow({ where: { id } })).da_diem_danh_luc === null);
    // Hoàn tác quá hạn 10 giây (theo nhật ký máy chủ)
    const r2 = await danhTatCaCoMat(gvAnh, id, {}, lucVN("2026-11-26", "22:25"));
    check("hoàn tác quá 10 giây → 409 het_gio, điểm danh giữ nguyên", (await loi(async () => hoanTacTatCa(gvAnh, id, r2.luc, giay(lucVN("2026-11-26", "22:25"), 11))))?.ma === "het_gio" && (await db.bcaDiemDanh.count({ where: { buoi_id: id } })) === 43);
  }
  {
    const id = await buoiId(4, "2026-11-26");
    const nd2 = await db.bcaNguoiDung.create({ data: { gmail: "gv2.anh@bca.invalid", ten_hien_thi: "GV Anh 2", vai_tro: "giao_vien", phan_cong: { create: { mon_id: 4 } } } });
    const gv2 = await nguoi(nd2.gmail);
    const em = (await chiTietDiemDanh(gvAnh, id, T22)).em[5];
    await datDiemDanh(gvAnh, id, em.hoc_sinh_id, { trangThai: "vang" }, lucVN("2026-11-26", "22:30"));
    await datDiemDanh(gv2, id, em.hoc_sinh_id, { trangThai: "phep", ghiChu: "Ốm, đã báo Zalo" }, lucVN("2026-11-26", "22:41"));
    const sau = (await chiTietDiemDanh(chu, id, T22)).em.find((e) => e.hoc_sinh_id === em.hoc_sinh_id)!;
    check("hai GV cùng môn sửa một ô: bản sau thắng, ghi tên người sửa cuối + ghi chú (2.3, T25)", sau.trang_thai === "phep" && sau.ghi_boi === "GV Anh 2" && sau.ghi_chu === "Ốm, đã báo Zalo", sau);
    const nk = await db.bcaNhatKy.findMany({ where: { doi_tuong: "diem_danh", doi_tuong_id: `${id}:${em.hoc_sinh_id}` }, orderBy: { id: "desc" }, take: 2 });
    check("nhật ký giữ cả hai lần, có trước/sau và đúng người", nk.length === 2 && nk[0].nguoi_dung_id === gv2.id && nk[1].nguoi_dung_id === gvAnh.id && (nk[0].truoc as { trang_thai?: string })?.trang_thai === "vang" && (nk[0].sau as { trang_thai?: string })?.trang_thai === "phep", nk);
    const em7 = (await chiTietDiemDanh(gvAnh, id, T22)).em[7].hoc_sinh_id;
    check("về chưa điểm (trangThai null) xoá bản ghi, buổi hết đủ", (await datDiemDanh(gvAnh, id, em7, { trangThai: null }, lucVN("2026-11-26", "22:42"))).tien_do.xong === false && (await db.bcaDiemDanh.count({ where: { buoi_id: id, hoc_sinh_id: em7 } })) === 0);
    check("ghi chú khi em chưa điểm → 409 chua_diem; trạng thái lạ → 400; ghi chú > 500 ký tự → 400", (await loi(async () => datDiemDanh(gvAnh, id, em7, { ghiChu: "x" }, lucVN("2026-11-26", "22:42"))))?.ma === "chua_diem"
      && (await loi(async () => datDiemDanh(gvAnh, id, em.hoc_sinh_id, { trangThai: "muon" as "co" }, T22)))?.status === 400 && (await loi(async () => datDiemDanh(gvAnh, id, em.hoc_sinh_id, { ghiChu: "x".repeat(501) }, T22)))?.status === 400);
  }
  {
    const anh = await buoiId(4, "2026-11-26");
    const em = (await chiTietDiemDanh(gvAnh, anh, T22)).em[0].hoc_sinh_id;
    check("chưa tới 21:45 → 409 chua_mo", (await loi(async () => datDiemDanh(gvAnh, anh, em, { trangThai: "co" }, lucVN("2026-11-26", "21:40"))))?.ma === "chua_mo");
    check("đúng 21:45 thì ghi được (mở từ 30 phút trước giờ học)", (await loi(async () => datDiemDanh(gvAnh, anh, em, { trangThai: "vang" }, lucVN("2026-11-26", "21:45")))) === null);
    const toan = await buoiId(1, "2026-11-17"), hs1 = await hsId("HS0001");
    const truoc = await db.bcaDiemDanh.findUnique({ where: { buoi_id_hoc_sinh_id: { buoi_id: toan, hoc_sinh_id: hs1 } } });
    check("buổi quá 48 giờ, không xác nhận → 409 can_xac_nhan_48h, bản ghi KHÔNG đổi", (await loi(async () => datDiemDanh(gvToan, toan, hs1, { trangThai: "vang" }, T22)))?.ma === "can_xac_nhan_48h"
      && eq(await db.bcaDiemDanh.findUnique({ where: { buoi_id_hoc_sinh_id: { buoi_id: toan, hoc_sinh_id: hs1 } } }), truoc));
    check("'đánh tất cả' buổi quá 48 giờ không xác nhận → cũng 409 can_xac_nhan_48h", (await loi(async () => danhTatCaCoMat(gvToan, toan, {}, T22)))?.ma === "can_xac_nhan_48h");
    await datDiemDanh(gvToan, toan, hs1, { trangThai: "vang", xacNhan: true }, T22);
    const nk = await db.bcaNhatKy.findFirst({ where: { doi_tuong_id: `${toan}:${hs1}` }, orderBy: { id: "desc" } });
    check("có xác nhận → ghi được, nhật ký đánh dấu qua_48h_xac_nhan", (nk?.sau as { trang_thai?: string; qua_48h_xac_nhan?: boolean })?.trang_thai === "vang" && (nk?.sau as { qua_48h_xac_nhan?: boolean })?.qua_48h_xac_nhan === true, nk?.sau);
    check("đúng 48 giờ sau giờ học chưa cần xác nhận; quá 1 phút thì cần", (await chiTietDiemDanh(gvToan, toan, lucVN("2026-11-19", "22:15"))).trang_thai_ghi === "mo" && (await chiTietDiemDanh(gvToan, toan, lucVN("2026-11-19", "22:16"))).trang_thai_ghi === "qua_48h");
    const ddTruoc = await db.bcaDiemDanh.count();
    check("GV môn khác ghi (kể cả có xác nhận) → LoiQuyen, không ghi gì", (await loi(async () => datDiemDanh(gvAnh, toan, hs1, { trangThai: "co", xacNhan: true }, T22))) instanceof LoiQuyen && (await db.bcaDiemDanh.count()) === ddTruoc);
    check("GV môn khác XEM buổi / đánh tất cả / hoàn tác → LoiQuyen", (await loi(async () => chiTietDiemDanh(gvAnh, toan, T22))) instanceof LoiQuyen && (await loi(async () => danhTatCaCoMat(gvAnh, toan, { xacNhan: true }, T22))) instanceof LoiQuyen && (await loi(async () => hoanTacTatCa(gvAnh, toan, T22.toISOString(), T22))) instanceof LoiQuyen);
    check("em không có tên trong buổi → 409 khong_trong_buoi", (await loi(async () => datDiemDanh(gvAnh, anh, hs1, { trangThai: "co" }, T22)))?.ma === "khong_trong_buoi");
    check("buổi không tồn tại → 404; buổi đã huỷ → 409 buoi_huy", (await loi(async () => chiTietDiemDanh(chu, 999999, T22)))?.status === 404 && (await loi(async () => datDiemDanh(chu, await buoiId(2, "2026-12-09"), hs1, { trangThai: "co" }, lucVN("2026-12-09", "22:20"))))?.ma === "buoi_huy");
  }
  {
    const m = await maTranThang(chu, "su", "2026-11", T22);
    check("ma trận Sử tháng 11: 4 buổi 18, 22, 25, 29/11", eq(m.buoi.map((b) => b.ngay), ["2026-11-18", "2026-11-22", "2026-11-25", "2026-11-29"]), m.buoi.map((b) => b.ngay));
    const h = m.hang.find((x) => x.ma_hs === "HS0021");
    check("HS0021 vắng 3, hết thử 28/11 nên 29/11 là \"-\" → có mặt 0/3, chuỗi 0, loại thử", !!h && eq(h.o, ["vang", "vang", "vang", "-"]) && h.co_mat === "0/3" && h.chuoi === 0 && h.loai === "thu", h);
    check("ma trận: GV môn khác → LoiQuyen; môn lạ → 404; tháng sai dạng → 400", (await loi(async () => maTranThang(gvAnh, "su", "2026-11", T22))) instanceof LoiQuyen && (await loi(async () => maTranThang(chu, "ly", "2026-11", T22)))?.status === 404 && (await loi(async () => maTranThang(chu, "su", "2026-13", T22)))?.status === 400);
    const r = await danhSachBuoi(gvAnh, { thang: "2026-11" });
    check("danh sách buổi của GV Anh tháng 11: đúng 5 buổi, toàn môn Anh; lọc môn Toán → LoiQuyen", r.buoi.length === 5 && r.buoi.every((b) => b.mon.ma === "anh") && (await loi(async () => danhSachBuoi(gvAnh, { thang: "2026-11", mon: "toan" }))) instanceof LoiQuyen, r.buoi.length);
    check("ma trận môn mình của GV Anh mở được", (await maTranThang(gvAnh, "anh", "2026-11", T22)).mon.ma === "anh");
  }

  section("Buổi học (buoi-hoc.md)");
  {
    const id = await buoiId(1, "2026-11-21");
    check("huỷ buổi không lý do → bị chặn", /lý do/.test((await loi(async () => huyBuoi(chu, id, "")))?.message ?? ""));
    check("huỷ buổi đã có điểm danh → 409 can_xac_nhan", (await loi(async () => huyBuoi(chu, id, "GV ốm")))?.ma === "can_xac_nhan");
    check("xác nhận → huỷ được, điểm danh vẫn giữ", (await huyBuoi(chu, id, "GV ốm", true)).trang_thai === "huy" && (await db.bcaDiemDanh.count({ where: { buoi_id: id } })) === 28);
    check("buổi đã huỷ không còn trong việc 'chưa điểm danh' của Hôm nay", !(await homNay(chu, T22)).viec.some((v) => v.loai === "buoi_chua_diem_danh" && (v.buoi as { id: number }[]).some((b) => b.id === id)));
    check("huỷ lần hai → 409; bỏ huỷ được; bỏ huỷ buổi không huỷ → 409", (await loi(async () => huyBuoi(chu, id, "x", true)))?.status === 409 && (await boHuyBuoi(chu, id)).trang_thai === "binh_thuong" && (await loi(async () => boHuyBuoi(chu, id)))?.status === 409);
    check("GV huỷ / bỏ huỷ / học bù → LoiQuyen (chỉ chủ, T9)", (await loi(async () => huyBuoi(gvToan, id, "x", true))) instanceof LoiQuyen && (await loi(async () => boHuyBuoi(gvToan, id))) instanceof LoiQuyen && (await loi(async () => themHocBu(gvToan, { mon: "toan", ngay: "2026-12-06" }))) instanceof LoiQuyen);
    const r = await themHocBu(chu, { mon: "su", ngay: "2026-11-30" });
    check("học bù Sử 30/11 22:15 trùng giờ Anh → cảnh báo kèm số em học cả hai môn, không chặn", r.canh_bao.length === 1 && /^Trùng giờ Anh 22:15, \d+ em học cả hai môn$/.test(r.canh_bao[0]), r.canh_bao);
    check("thêm lại đúng giờ đó → 409; giờ sai dạng → 400", (await loi(async () => themHocBu(chu, { mon: "su", ngay: "2026-11-30" })))?.status === 409 && (await loi(async () => themHocBu(chu, { mon: "su", ngay: "2026-12-01", gio: "25:00" })))?.status === 400);
    const s = await suaNoiDungBuoi(gvAnh, await buoiId(4, "2026-11-19"), { noiDung: "Unit 5", linkRecord: "drive.google.com/abc" });
    check("GV sửa nội dung / record buổi môn mình: link được chuẩn hoá https; buổi môn khác → LoiQuyen", s.link_record === "https://drive.google.com/abc" && s.noi_dung === "Unit 5" && (await loi(async () => suaNoiDungBuoi(gvAnh, await buoiId(1, "2026-11-17"), { noiDung: "x" }))) instanceof LoiQuyen, s);
    const nkTruoc = await db.bcaNhatKy.count({ where: { hanh_dong: "sua_noi_dung_buoi" } });
    check("sửa không có trường nào → 400, không ghi nhật ký; link không phải địa chỉ web → 400 link_sai", (await loi(async () => suaNoiDungBuoi(chu, await buoiId(4, "2026-12-10"), {})))?.status === 400 && (await loi(async () => suaNoiDungBuoi(chu, await buoiId(4, "2026-12-10"), { linkRecord: "không phải link" })))?.ma === "link_sai" && (await db.bcaNhatKy.count({ where: { hanh_dong: "sua_noi_dung_buoi" } })) === nkTruoc);
  }

  section("Xoá buổi tương lai, hoàn tác 10 giây (T42, buoi-hoc.md 6.3)");
  {
    const id = await buoiId(1, "2026-12-01");
    const r = await xoaBuoi(chu, id, T22);
    check("buổi Toán 01/12 trống → xoá được, trả nhatKyId, có nhật ký xoa_buoi", r.da_xoa === true && (await db.bcaBuoiHoc.findUnique({ where: { id } })) === null && (await db.bcaNhatKy.count({ where: { hanh_dong: "xoa_buoi", doi_tuong_id: String(id) } })) === 1, r);
    check("hoàn tác trong 10 giây → dựng lại đúng id", eq(await hoanTacXoaBuoi(chu, id, r.nhatKyId, giay(T22, 9)), { id, khoi_phuc: true }));
    const b = await db.bcaBuoiHoc.findUniqueOrThrow({ where: { id } });
    check("buổi dựng lại đúng môn, giờ, số phút, loại, trạng thái", eq([b.mon_id, b.bat_dau_luc.toISOString(), b.so_phut, b.loai, b.trang_thai], [1, lucVN("2026-12-01", "22:15").toISOString(), 90, "theo_lich", "binh_thuong"]), b);
    check("hoàn tác lần hai → 409 da_hoan_tac", (await loi(async () => hoanTacXoaBuoi(chu, id, r.nhatKyId, giay(T22, 9))))?.ma === "da_hoan_tac");

    const a = await buoiId(4, "2026-12-03");
    check("GV xoá buổi môn mình → LoiQuyen, buổi còn nguyên", (await loi(async () => xoaBuoi(gvAnh, a, T22))) instanceof LoiQuyen && (await db.bcaBuoiHoc.findUnique({ where: { id: a } })) !== null);
    const { nhatKyId } = await xoaBuoi(chu, a, T22);
    check("hoàn tác quá 10 giây → 409 het_gio", (await loi(async () => hoanTacXoaBuoi(chu, a, nhatKyId, giay(T22, 11))))?.ma === "het_gio");
    check("nhật ký không khớp id buổi → 404; GV hoàn tác → LoiQuyen; buổi vẫn đã xoá", (await loi(async () => hoanTacXoaBuoi(chu, a + 1, nhatKyId, giay(T22, 1))))?.status === 404 && (await loi(async () => hoanTacXoaBuoi(gvAnh, a, nhatKyId, giay(T22, 1)))) instanceof LoiQuyen && (await db.bcaBuoiHoc.findUnique({ where: { id: a } })) === null);

    check("buổi có điểm danh (Toán 17/11) → 409 co_du_lieu", (await loi(async () => xoaBuoi(chu, await buoiId(1, "2026-11-17"), T22)))?.ma === "co_du_lieu");
    const huy = await loi(async () => xoaBuoi(chu, await buoiId(2, "2026-12-09"), T22));
    check("buổi đã huỷ có buổi bù (Sử 09/12) → 409 co_du_lieu, nêu rõ da_huy + co_buoi_bu", huy?.ma === "co_du_lieu" && /da_huy, co_buoi_bu/.test(huy.message), huy?.message);
    check("buổi đã qua chưa có dữ liệu (Toán 24/11) → 409 da_qua", (await loi(async () => xoaBuoi(chu, await buoiId(1, "2026-11-24"), T22)))?.ma === "da_qua");
    // Buổi Anh 26/11 đã có điểm danh từ các ca trên ⇒ dùng buổi Địa 27/11 cho mốc "đúng giờ bắt đầu".
    const dia = await buoiId(3, "2026-11-27");
    check("buổi tối nay: sau giờ bắt đầu → da_qua (còn nguyên); trước giờ → xoá được rồi hoàn tác", (await loi(async () => xoaBuoi(chu, dia, lucVN("2026-11-27", "22:20"))))?.ma === "da_qua" && (await db.bcaBuoiHoc.findUnique({ where: { id: dia } })) !== null);
    const x = await xoaBuoi(chu, dia, lucVN("2026-11-27", "22:00"));
    await hoanTacXoaBuoi(chu, dia, x.nhatKyId, giay(lucVN("2026-11-27", "22:00"), 2));
    check("xoá buổi không tồn tại → 404", (await loi(async () => xoaBuoi(chu, a, T22)))?.status === 404);
  }

  section("Sinh buổi còn thiếu (T42)");
  {
    await xoaBuoi(chu, await buoiId(1, "2026-12-01"), T22); // xoá thật (không hoàn tác) ⇒ thiếu; Anh 03/12 đã xoá ở trên
    await db.bcaBuoiHoc.update({ where: { id: await buoiId(4, "2026-12-07") }, data: { bat_dau_luc: lucVN("2026-12-07", "21:00") } }); // dời giờ ⇒ vẫn tính là có
    const truoc = await db.bcaBuoiHoc.count();
    const xem = await xemTruocBuoiConThieu(chu, "2026-12", T22);
    check("xem trước tháng 12: thiếu đúng Toán 01/12 + Anh 03/12; Sử 09/12 đã huỷ và Anh 07/12 dời giờ KHÔNG sinh lại", xem.se_tao === 2 && xem.bo_qua_da_qua === 0 && eq(xem.buoi, [{ mon: "toan", ngay: "2026-12-01", gio: "22:15" }, { mon: "anh", ngay: "2026-12-03", gio: "22:15" }]), xem);
    check("xem trước không ghi gì", (await db.bcaBuoiHoc.count()) === truoc);
    check("sinh: tạo đúng 2 buổi, có nhật ký", (await sinhBuoiConThieu(chu, "2026-12", T22)).tao_moi === 2 && (await db.bcaBuoiHoc.count()) === truoc + 2 && (await db.bcaNhatKy.count({ where: { hanh_dong: "sinh_buoi_con_thieu" } })) === 1);
    check("không sinh buổi thứ hai cho ngày đã dời giờ; chạy lại = 0", (await db.bcaBuoiHoc.findUnique({ where: { mon_id_bat_dau_luc: { mon_id: 4, bat_dau_luc: lucVN("2026-12-07", "22:15") } } })) === null && (await sinhBuoiConThieu(chu, "2026-12", T22)).tao_moi === 0);
    await db.bcaBuoiHoc.delete({ where: { id: await buoiId(1, "2026-11-24") } });
    const t11 = await xemTruocBuoiConThieu(chu, "2026-11", T22);
    check("tháng 11: ngày thiếu đã qua không sinh lại (bo_qua_da_qua = 1)", t11.se_tao === 0 && t11.bo_qua_da_qua === 1, t11);
    check("GV xem trước / sinh buổi còn thiếu → LoiQuyen; tháng sai dạng → 400", (await loi(async () => xemTruocBuoiConThieu(gvAnh, "2026-12", T22))) instanceof LoiQuyen && (await loi(async () => sinhBuoiConThieu(gvAnh, "2026-12", T22))) instanceof LoiQuyen && (await loi(async () => xemTruocBuoiConThieu(chu, "2026-13", T22)))?.status === 400);
  }
}

main().catch((e) => { console.error(e); check("bài chạy hết không ném lỗi", false, String(e)); })
  .finally(() => { try { napLaiBca(); console.log("\n(đã nạp lại bca_* từ bca_gia)"); } catch (e) { console.error("KHÔNG nạp lại được bca_*:", e); } return done(); });
