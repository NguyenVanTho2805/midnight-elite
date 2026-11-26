// Chuyển dữ liệu từ bản xuất .xlsx của Google Sheet (docs/bca/nghiep-vu/chuyen-du-lieu.md).
//   npx tsx scripts/chuyen-tu-sheet.ts <tệp.xlsx> [--ngay-chot=YYYY-MM-DD] [--apply] [--ghi-de-du-lieu-web]
// Mặc định XEM TRƯỚC: chạy hết trong một transaction rồi rollback, chỉ in số đếm và số dòng sheet.
// --apply mới ghi (kèm một dòng nhat_ky "chuyen_that"). Lặp lại an toàn (upsert theo mã HS, mã GD, (môn, giờ bắt đầu), (buổi, em), mã yêu cầu)
// CHỈ KHI web chưa vận hành: đã có nhật ký do người dùng, ghi danh tạo trên web hoặc điểm danh nguồn web ⇒ --apply bị chặn,
// muốn chạy tiếp phải thêm --ghi-de-du-lieu-web (chủ quyết). Lệch bất kỳ số đối soát nào ⇒ rollback.
// DB không phải cục bộ (kể cả xem trước) cần BCA_CHO_PHEP_CHUYEN_THAT=1.
// KHÔNG in tên, SĐT, Gmail hay nội dung ô. KHÔNG commit tệp xlsx. KHÔNG bao giờ ghi khoá cai_dat DU_LIEU_GIA (xoá nó khi --apply).
// Tạm chọn đang áp: T18 (dựng lại hồ sơ mất từ đơn), T19 (không chuyển __DaXoa), T20 (buổi chưa tick mà có dấu ⇒ đã điểm danh),
// T34 (sheet ghi "Đã nghỉ" mà theo ghi danh là "Hết thử – hỏi em" ⇒ chủ đã bấm nghỉ ⇒ nghi_luc; không đọc chữ trong ghi chú).
import ExcelJS from "exceljs";
import { chuanHoaGmail, chuanHoaSdt, catKhoangTrang, gmailHopLe, sdtHopLe } from "../lib/chuan-hoa";
import { d2s, lucVN, ngayVN, s2d } from "../lib/ngay";
import { hetThu, hieuLuc, oMon, tinhTrang, type GD } from "../lib/quy-tac";
import type { PrismaClient } from "../generated/prisma/client";

type Cell = ExcelJS.CellValue;
const MON_MA: Record<string, string> = { Toán: "toan", Sử: "su", Địa: "dia", Anh: "anh" };
const TT_DON: Record<string, "moi" | "cho_duyet" | "da_nhan" | "trung" | "bo_qua" | "lead_cu"> = {
  Mới: "moi", "Chờ duyệt": "cho_duyet", "Đã nhận": "da_nhan", Trùng: "trung", "Bỏ qua": "bo_qua", "Lead cũ": "lead_cu",
};
const DAU_DU_LIEU_GIA = "DU_LIEU_GIA"; // = server/dang-nhap-thu.ts (T40)
const BO_CAI_DAT = new Set([DAU_DU_LIEU_GIA, "STK", "SDT_GS", "EMAIL_GIAO_VIEN", "TU_NHAN_HOC_THU", "TU_NHAN_TOI_DA_NGAY", "ID_FILE_V7", "LINK_LANDING", "GIO_MEET", "SO_PHUT"]);

class Dung extends Error {}
const ROLLBACK = Symbol("rollback");

// ── Đọc ô ──
const chu = (v: Cell): string | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "object" && !(v instanceof Date)) {
    const o = v as { text?: unknown; result?: unknown; richText?: { text: string }[] };
    if (o.richText) return catKhoangTrang(o.richText.map((x) => x.text).join(""));
    return catKhoangTrang(o.text ?? o.result ?? null);
  }
  return catKhoangTrang(v instanceof Date ? d2s(v) : v);
};
/** Ô ngày: chỉ lấy phần ngày (sheet ghi kèm 12:00), hỗ trợ dd/MM/yyyy và yyyy-MM-dd. */
const ngay = (v: Cell): string | null => {
  if (v instanceof Date) return d2s(v);
  const s = chu(v);
  if (!s) return null;
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = s.match(/^\d{4}-\d{2}-\d{2}/);
  if (m) return m[0];
  throw new Dung("Có ô ngày không đọc được (dd/MM/yyyy hoặc yyyy-MM-dd)"); // không in nội dung ô
};
const bool = (v: Cell) => v === true || /^(true|có|x|✓)$/i.test(chu(v) ?? "");

function bang(ws: ExcelJS.Worksheet) {
  const head = (ws.getRow(1).values as Cell[]).map((x) => chu(x) ?? "");
  const rows: { so: number; g: (ten: string) => Cell }[] = [];
  ws.eachRow((row, so) => {
    if (so === 1) return;
    const vals = row.values as Cell[];
    if (!vals.some((x) => chu(x))) return; // dòng trống: bỏ qua, không báo
    rows.push({ so, g: (ten) => { const i = head.indexOf(ten); if (i < 0) throw new Dung(`Thiếu cột "${ten}" ở tab ${ws.name}`); return row.getCell(i).value; } });
  });
  return rows;
}
const tab = (wb: ExcelJS.Workbook, ten: string) => {
  const ws = wb.worksheets.find((w) => w.name.replace(/^\S+\s/, "") === ten || w.name === ten);
  if (!ws) throw new Dung(`Không thấy tab "${ten}"`);
  return ws;
};

export async function chuyen(db: PrismaClient, tep: string, opt: { apply: boolean; ngayChot: string; ghiDeDuLieuWeb?: boolean }) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(tep);
  const luc = new Date();
  const loi: string[] = [];
  const bao: Record<string, unknown> = {};

  // ── Đọc sheet vào bộ nhớ ──
  const lua = bang(tab(wb, "Lứa")).map((r) => ({ ma: chu(r.g("Mã lứa"))!, ten: chu(r.g("Tên lứa"))!, tu: ngay(r.g("Nhận từ ngày"))!, den: ngay(r.g("Đến ngày")), ghi_chu: chu(r.g("Ghi chú")) }));

  const cd = tab(wb, "Cài đặt");
  const caiDat: { khoa: string; gia_tri: unknown }[] = [];
  const mon: { id: number; ma: string; ten_ngan: string; ten_day_du: string; thu: number[]; gio_bat_dau: string; so_phut: number; thu_tu: number; link_meet: string | null; link_zalo: string | null; ten_lop_azota: string | null; si_so_toi_da: number }[] = [];
  cd.eachRow((row, so) => {
    if (so === 1) return;
    const k = chu(row.getCell(1).value);
    if (k && !BO_CAI_DAT.has(k)) {
      let v: unknown = chu(row.getCell(2).value);
      if (k === "NGAY_BAT_DAU_TINH_PHI") v = ngay(row.getCell(2).value);
      else if (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v)) v = Number(v);
      caiDat.push({ khoa: k, gia_tri: v });
    }
    const ten = chu(row.getCell(5).value);
    if (ten && MON_MA[ten]) {
      const thu = [...new Set(String(chu(row.getCell(7).value) ?? "").split(/[,\s]+/).filter(Boolean).map((x) => (Number(x) === 1 || Number(x) === 8 ? 7 : Number(x) - 1)))];
      if (!thu.length || thu.some((t) => !(t >= 1 && t <= 7))) throw new Dung(`Lịch môn ${ten} không hợp lệ (dòng ${so})`);
      mon.push({
        id: mon.length + 1, ma: MON_MA[ten], ten_ngan: ten, ten_day_du: chu(row.getCell(6).value) ?? ten, thu: thu.sort(), gio_bat_dau: chu(row.getCell(8).value) ?? "22:15",
        so_phut: Number(row.getCell(9).value) || 90, thu_tu: mon.length + 1, link_meet: chu(row.getCell(11).value), link_zalo: chu(row.getCell(12).value),
        ten_lop_azota: chu(row.getCell(13).value), si_so_toi_da: Number(row.getCell(14).value) || 0,
      });
    }
  });
  if (!caiDat.some((c) => c.khoa === "TU_XOA_HS_NGHI")) caiDat.push({ khoa: "TU_XOA_HS_NGHI", gia_tri: "Không" });
  const monId = (ten: string | null, so: number, tabTen: string) => {
    const m = mon.find((x) => x.ten_ngan === ten || x.ten_day_du === ten);
    if (!m) throw new Dung(`Tên môn lạ ở ${tabTen} dòng ${so}`);
    return m.id;
  };

  const hsRows = bang(tab(wb, "Học sinh"));
  const hs = hsRows.map((r) => {
    const ma = chu(r.g("Mã HS"));
    if (!ma) { loi.push(`Học sinh dòng ${r.so}: thiếu Mã HS`); return null; }
    const ho_ten = chu(r.g("Họ tên"))!;
    return {
      so: r.so, ma_hs: ma, ho_ten, lua: chu(r.g("Lứa")), sdt_hs: chuanHoaSdt(r.g("SĐT HS")), sdt_ph: chuanHoaSdt(r.g("SĐT PH")), gmail: chuanHoaGmail(chu(r.g("Gmail"))),
      truong: chu(r.g("Trường")), khoi: chu(r.g("Khối")), ho_ten_ph: chu(r.g("Họ tên PH")), muc_tieu: chu(r.g("Mục tiêu")), nguon: chu(r.g("Nguồn")),
      username_azota: chu(r.g("Username Azota")), dong_y_vinh_danh: bool(r.g("Đồng ý vinh danh")), da_nhan_chao: bool(r.g("Đã nhắn chào")),
      ghi_chu: chu(r.g("Ghi chú")), ghi_chu_rieng: chu(r.g("Note")), ngay_tao: ngay(r.g("Ngày tạo"))!, so_du_dau_ky: Math.round(Number(r.g("Số dư đầu kỳ")) || 0),
      an: bool(r.g("Nghỉ/ẩn")), tinh_trang: chu(r.g("Tình trạng")), o: Object.fromEntries(["Toán", "Sử", "Địa", "Anh"].map((m) => [m, chu(r.g(m))])), chu_thuong: /^\p{Ll}/u.test(ho_ten),
    };
  }).filter((x) => x !== null);
  trung(hs.map((x) => x.ma_hs), "Mã HS");
  trung(hs.map((x) => x.gmail).filter(Boolean) as string[], "Gmail");
  trung(hs.map((x) => x.username_azota).filter(Boolean) as string[], "Username Azota");

  const gdRows = bang(tab(wb, "Ghi danh"));
  const gd = gdRows.map((r) => {
    const tu = ngay(r.g("Từ ngày")), den = ngay(r.g("Học đến hết ngày"));
    if (!tu) throw new Dung(`Ghi danh dòng ${r.so}: thiếu Từ ngày`);
    const loai = /th[uử]/i.test(chu(r.g("Loại")) ?? "") ? ("thu" as const) : ("chinh_thuc" as const);
    if (loai === "thu" && !den) throw new Dung(`Ghi danh dòng ${r.so}: Thử mà không có ngày hết`);
    return {
      so: r.so, ma_gd: chu(r.g("Mã GD"))!, ma_hs: chu(r.g("Mã HS"))!, ho_ten: chu(r.g("Họ tên")), mon_id: monId(chu(r.g("Môn")), r.so, "Ghi danh"), loai, tu, den,
      huy: !!den && den < tu, mien_phi: bool(r.g("Miễn phí")), don_gia_rieng: Number(r.g("Đơn giá riêng")) || null, ghi_chu: chu(r.g("Ghi chú")),
    };
  });
  trung(gd.map((x) => x.ma_gd), "Mã GD");

  const donRows = bang(tab(wb, "Đăng ký"));
  const don = donRows.map((r) => {
    const t = r.g("Thời gian");
    if (!(t instanceof Date)) throw new Dung(`Đăng ký dòng ${r.so}: Thời gian không phải ngày giờ`);
    const loiDon: string[] = [];
    let ho_ten_ph = chu(r.g("Họ tên PH"));
    if (typeof r.g("Họ tên PH") === "number" || /^\d+$/.test(ho_ten_ph ?? "")) loiDon.push("ho_ten_ph_la_so");
    const sdt = chuanHoaSdt(r.g("SĐT HS"));
    if (sdt && !sdtHopLe(sdt)) loiDon.push("sdt_hs_sai");
    let khoi = chu(r.g("Khối"));
    if (khoi && /^\d+$/.test(khoi)) khoi = `Khối ${khoi}`;
    return {
      so: r.so,
      // Ô thời gian là giờ đồng hồ Việt Nam (exceljs đọc như UTC) ⇒ trừ 7 giờ ra thời điểm thật.
      thoi_gian: new Date(t.getTime() - 7 * 3600_000), nguon: chu(r.g("Nguồn")), loai: chu(r.g("Loại")), ho_ten: chu(r.g("Họ tên")) ?? "(trống)", sdt_hs: sdt,
      gmail: chuanHoaGmail(chu(r.g("Gmail"))), truong: chu(r.g("Trường")), khoi, ho_ten_ph, sdt_ph: chuanHoaSdt(r.g("SĐT PH")),
      mon_ids: (chu(r.g("Môn")) ?? "").split(",").map((x) => x.trim()).filter(Boolean).map((m) => monId(m, r.so, "Đăng ký")),
      muc_tieu: chu(r.g("Mục tiêu")), biet_qua: chu(r.g("Biết qua")), da_hoc_thu: chu(r.g("Đã học thử")), dong_y: chu(r.g("Đồng ý")), dong_y_vinh_danh: bool(r.g("Đồng ý vinh danh")),
      ma_yeu_cau: chu(r.g("Mã yêu cầu"))!, trang_thai: TT_DON[chu(r.g("Trạng thái")) ?? "Mới"] ?? "moi", ma_hs: chu(r.g("Mã HS")), ghi_chu_xu_ly: chu(r.g("Ghi chú xử lý")), loi_du_lieu: loiDon,
    };
  });
  trung(don.map((x) => x.ma_yeu_cau), "Mã yêu cầu");

  // T18: ghi danh trỏ mã HS không có hồ sơ ⇒ dựng lại hồ sơ từ đơn (giữ mã cũ).
  const coHs = new Set(hs.map((x) => x.ma_hs));
  const mo = [...new Set(gd.filter((g) => !coHs.has(g.ma_hs)).map((g) => g.ma_hs))];
  const dungLai: string[] = [];
  const choNghi: string[] = [];
  for (const ma of mo) {
    const d = don.filter((x) => x.ma_hs === ma).sort((a, b) => a.thoi_gian.getTime() - b.thoi_gian.getTime())[0];
    const gds = gd.filter((g) => g.ma_hs === ma);
    const ngayTao = gds.map((g) => g.tu).sort()[0];
    const l = lua.find((x) => x.tu <= ngayTao && (!x.den || ngayTao <= x.den));
    hs.push({
      so: 0, ma_hs: ma, ho_ten: d?.ho_ten ?? gds[0].ho_ten ?? ma, lua: l?.ma ?? null, sdt_hs: d?.sdt_hs ?? null, sdt_ph: d?.sdt_ph ?? null, gmail: d?.gmail ?? null,
      truong: d?.truong ?? null, khoi: d?.khoi ?? null, ho_ten_ph: d && !d.loi_du_lieu.includes("ho_ten_ph_la_so") ? d.ho_ten_ph : null, muc_tieu: d?.muc_tieu ?? null,
      nguon: "Dựng lại từ đơn (T18)", username_azota: null, dong_y_vinh_danh: d?.dong_y_vinh_danh ?? false, da_nhan_chao: false, ghi_chu: null,
      ghi_chu_rieng: `Hồ sơ dựng lại khi chuyển dữ liệu: mất dòng ở tab Học sinh, ${gds.length} ghi danh (T18)`, ngay_tao: ngayTao, so_du_dau_ky: 0, an: false, tinh_trang: null, o: {}, chu_thuong: false,
    });
    dungLai.push(`${ma} (${gds.length} ghi danh, ${d ? `đơn dòng ${d.so}` : "không có đơn"})`);
  }
  trung(hs.map((x) => x.gmail).filter(Boolean) as string[], "Gmail (sau khi dựng lại)");

  // Chồng ngày (CSDL cũng chặn) — dừng cả lần chuyển
  for (const a of gd) for (const b of gd)
    if (a.so < b.so && a.ma_hs === b.ma_hs && a.mon_id === b.mon_id && !a.huy && !b.huy && a.tu <= (b.den ?? "9999") && b.tu <= (a.den ?? "9999"))
      throw new Dung(`Ghi danh chồng ngày: dòng ${a.so} và ${b.so}`);

  const buoiRows = bang(tab(wb, "Buổi học"));
  const buoi = buoiRows.map((r) => {
    const n = ngay(r.g("Ngày"))!;
    const id = monId(chu(r.g("Môn")), r.so, "Buổi học");
    const m = mon.find((x) => x.id === id)!;
    const tt = chu(r.g("Trạng thái")) ?? "Có học";
    if (tt === "Học bù") loi.push(`Buổi dòng ${r.so}: học bù không có giờ ⇒ dùng ${m.gio_bat_dau}, chủ kiểm tra lại`);
    const link = chu(r.g("Link record"));
    return {
      so: r.so, mon_id: id, ngay: n, bat_dau_luc: lucVN(n, m.gio_bat_dau), so_phut: m.so_phut, loai: tt === "Học bù" ? ("hoc_bu" as const) : ("theo_lich" as const),
      trang_thai: tt === "Nghỉ" ? ("huy" as const) : ("binh_thuong" as const), ly_do_huy: tt === "Nghỉ" ? "chuyển từ sheet" : null,
      tick: bool(r.g("Đã điểm danh")), noi_dung: chu(r.g("Nội dung buổi")), link_record: link ? (/^https:\/\//.test(link) ? link : `https://${link.replace(/^http:\/\//, "")}`) : null, ghi_chu: chu(r.g("Ghi chú")),
    };
  });

  // Dấu điểm danh: __DiemDanh rồi ma trận (ma trận thắng nếu khác)
  const dau = new Map<string, "vang" | "phep">();
  const kyHieu = (s: string | null, noi: string) => {
    if (!s || s === "—" || s === "–" || s === "-") return null;
    if (/^v$/i.test(s)) return "vang" as const;
    if (/^p$/i.test(s)) return "phep" as const;
    loi.push(`Ký hiệu điểm danh lạ ở ${noi}`);
    return null;
  };
  for (const r of bang(tab(wb, "__DiemDanh"))) {
    const k = kyHieu(chu(r.g("Ký hiệu")), `__DiemDanh dòng ${r.so}`);
    if (k) dau.set(`${ngay(r.g("Ngày"))}|${monId(chu(r.g("Môn")), r.so, "__DiemDanh")}|${chu(r.g("Mã HS"))}`, k);
  }
  const mt = tab(wb, "Điểm danh");
  let khoiMon: number | null = null, cotNgay: { c: number; ngay: string }[] = [];
  const hangMaTran = new Map<number, Set<string>>(); // môn → mã HS có dòng trong ma trận
  let dauMaTran = 0;
  mt.eachRow((row, so) => {
    const a = chu(row.getCell(1).value), b = chu(row.getCell(2).value);
    if (a === "Mã HS") {
      cotNgay = [];
      for (let c = 4; row.getCell(c).value instanceof Date; c++) cotNgay.push({ c, ngay: d2s(row.getCell(c).value as Date) });
      return;
    }
    if (b && MON_MA[b] && a && a !== "Mã HS" && !/^HS\d+/.test(a)) { khoiMon = monId(b, so, "ma trận"); cotNgay = []; return; }
    if (a && /^HS\d{4,}$/.test(a) && khoiMon && cotNgay.length) {
      (hangMaTran.get(khoiMon) ?? hangMaTran.set(khoiMon, new Set()).get(khoiMon)!).add(a);
      for (const { c, ngay: n } of cotNgay) {
        const k = kyHieu(chu(row.getCell(c).value), `ma trận dòng ${so} cột ${c}`);
        if (!k) continue;
        const key = `${n}|${khoiMon}|${a}`;
        if (dau.get(key) !== k) dauMaTran++;
        dau.set(key, k);
      }
    }
  });

  // Danh sách em từng buổi (diem-danh.md Điều 2) + tạo bản ghi (chuyen-du-lieu.md 4.4)
  const gdTheoHs = new Map<string, GD[]>();
  for (const g of gd) gdTheoHs.set(g.ma_hs, [...(gdTheoHs.get(g.ma_hs) ?? []), { mon_id: g.mon_id, loai: g.loai, tu: g.tu, den: g.den, huy: g.huy }]);
  const anHs = new Set(hs.filter((x) => x.an).map((x) => x.ma_hs));
  const maDungLai = new Set(mo);
  const dsBuoi = (b: (typeof buoi)[number]) =>
    b.trang_thai === "huy" ? [] : hs.filter((x) => !anHs.has(x.ma_hs) && (gdTheoHs.get(x.ma_hs) ?? []).some((g) => g.mon_id === b.mon_id && hieuLuc(g, b.ngay))).map((x) => x.ma_hs);
  const diem: { buoi: (typeof buoi)[number]; ma_hs: string; trang_thai: "co" | "phep" | "vang" }[] = [];
  const t20: string[] = [];
  const bangBuoi: { buoi: string; ds: number; co: number; phep: number; vang: number; tick: boolean }[] = [];
  const dauDaDung = new Set<string>();
  for (const b of buoi) {
    const ds = dsBuoi(b);
    const coDau = ds.some((m) => dau.has(`${b.ngay}|${b.mon_id}|${m}`));
    if (!b.tick && !coDau) continue;
    if (!b.tick) t20.push(`${mon.find((m) => m.id === b.mon_id)!.ten_ngan} ${b.ngay} (dòng ${b.so})`);
    const dem = { co: 0, phep: 0, vang: 0 };
    for (const m of ds) {
      const key = `${b.ngay}|${b.mon_id}|${m}`;
      if (maDungLai.has(m) && !dau.has(key)) continue; // T18: em dựng lại để "thiếu 1 em", chủ tự quyết
      const tt = dau.get(key) ?? "co";
      dauDaDung.add(key);
      diem.push({ buoi: b, ma_hs: m, trang_thai: tt });
      dem[tt]++;
    }
    bangBuoi.push({ buoi: `${mon.find((m) => m.id === b.mon_id)!.ten_ngan} ${b.ngay}`, ds: ds.length, ...dem, tick: b.tick });
  }
  for (const k of dau.keys()) if (!dauDaDung.has(k)) loi.push(`Dấu điểm danh của em/buổi không còn trong danh sách: ${k.split("|").slice(0, 2).join(" môn ")}`);

  // ── Ghi trong một transaction ──
  try {
    await db.$transaction(async (tx) => {
      // Web đã vận hành? (P2-4) — chặn --apply ghi đè lên dữ liệu người dùng đã nhập trên web.
      const web = {
        nhat_ky_nguoi_dung: await tx.nhat_ky.count({ where: { OR: [{ nguoi_dung_id: { not: null } }, { vai_tro: { startsWith: "hoc_sinh" } }], hanh_dong: { notIn: [...HANH_DONG_KHONG_TINH] } } }),
        ghi_danh_tao_tren_web: await tx.ghi_danh.count({ where: { tao_boi: { not: null } } }),
        diem_danh_web: await tx.diem_danh.count({ where: { nguon: "web" } }),
      };
      const lanTruoc = await tx.nhat_ky.findFirst({ where: { hanh_dong: "chuyen_that" }, orderBy: { id: "desc" }, select: { luc: true } });
      bao.web_da_van_hanh = web;
      bao.lan_chuyen_that_truoc = lanTruoc?.luc.toISOString() ?? null;
      if (opt.apply && Object.values(web).some((n) => n > 0) && !opt.ghiDeDuLieuWeb)
        throw new Dung(
          `Web đã vận hành (${web.nhat_ky_nguoi_dung} nhật ký người dùng, ${web.ghi_danh_tao_tren_web} ghi danh tạo trên web, ${web.diem_danh_web} điểm danh web` +
            `${lanTruoc ? `; lần chuyển thật trước ${lanTruoc.luc.toISOString()}` : ""}) — từ chối --apply. Chỉ khi chủ quyết ghi đè: thêm --ghi-de-du-lieu-web.`,
        );
      for (const l of lua) await tx.lua.upsert({ where: { ma: l.ma }, create: { ma: l.ma, ten: l.ten, tu_ngay: s2d(l.tu), den_ngay: l.den ? s2d(l.den) : null, ghi_chu: l.ghi_chu }, update: { ten: l.ten, tu_ngay: s2d(l.tu), den_ngay: l.den ? s2d(l.den) : null, ghi_chu: l.ghi_chu } });
      for (const m of mon) await tx.mon.upsert({ where: { id: m.id }, create: m, update: m });
      for (const c of caiDat) await tx.cai_dat.upsert({ where: { khoa: c.khoa }, create: { khoa: c.khoa, gia_tri: c.gia_tri as never }, update: { gia_tri: c.gia_tri as never } });
      const luaId = new Map((await tx.lua.findMany()).map((l) => [l.ma, l.id]));
      for (const x of hs) {
        const data = {
          ho_ten: x.ho_ten, lua_id: x.lua ? (luaId.get(x.lua) ?? null) : null, sdt_hs: x.sdt_hs, sdt_ph: x.sdt_ph, gmail: x.gmail, truong: x.truong, khoi: x.khoi, ho_ten_ph: x.ho_ten_ph,
          muc_tieu: x.muc_tieu, nguon: x.nguon, username_azota: x.username_azota, dong_y_vinh_danh: x.dong_y_vinh_danh, da_nhan_chao: x.da_nhan_chao, ghi_chu: x.ghi_chu,
          ghi_chu_rieng: x.ghi_chu_rieng, ngay_tao: s2d(x.ngay_tao), so_du_dau_ky: x.so_du_dau_ky,
        };
        const cu = await tx.hoc_sinh.findUnique({ where: { ma_hs: x.ma_hs }, select: { an_luc: true } });
        const an_luc = x.an ? (cu?.an_luc ?? luc) : null;
        await tx.hoc_sinh.upsert({ where: { ma_hs: x.ma_hs }, create: { ma_hs: x.ma_hs, ...data, an_luc }, update: { ...data, an_luc } });
      }
      const hsId = new Map((await tx.hoc_sinh.findMany({ select: { id: true, ma_hs: true } })).map((x) => [x.ma_hs, x.id]));
      for (const g of gd) {
        const data = { hoc_sinh_id: hsId.get(g.ma_hs)!, mon_id: g.mon_id, loai: g.loai, tu_ngay: s2d(g.tu), den_ngay: g.den ? s2d(g.den) : null, mien_phi: g.mien_phi, don_gia_rieng: g.don_gia_rieng, ghi_chu: g.ghi_chu };
        const cu = await tx.ghi_danh.findUnique({ where: { ma_gd: g.ma_gd }, select: { huy_luc: true } });
        const huy_luc = g.huy ? (cu?.huy_luc ?? luc) : null;
        await tx.ghi_danh.upsert({ where: { ma_gd: g.ma_gd }, create: { ma_gd: g.ma_gd, ...data, huy_luc }, update: { ...data, huy_luc } });
      }
      // T34: chủ đã bấm nghỉ trên sheet ⇒ đánh nghi_luc lên các dòng thử cuối (giữ nghi_luc cũ khi chạy lại).
      for (const x of hs.filter((x) => /^Đã nghỉ/i.test(x.tinh_trang ?? ""))) {
        const rows = await tx.ghi_danh.findMany({ where: { hoc_sinh_id: hsId.get(x.ma_hs)! } });
        const het = hetThu(rows.map(gdCua), opt.ngayChot);
        if (!het) continue;
        await tx.ghi_danh.updateMany({ where: { id: { in: rows.filter((g) => !g.huy_luc && !g.nghi_luc && g.den_ngay && d2s(g.den_ngay) === het).map((g) => g.id) } }, data: { nghi_luc: luc } });
        choNghi.push(x.ma_hs);
      }
      const so = (s: string) => Number(s.replace(/\D/g, "")) || 0;
      const maxHs = Math.max(...hs.map((x) => so(x.ma_hs)), ...don.map((d) => so(d.ma_hs ?? "")), ...(await daXoa(wb, "HS")));
      const maxGd = Math.max(...gd.map((g) => so(g.ma_gd)), ...(await daXoa(wb, "GD")));
      for (const [khoa, v] of [["hs", maxHs], ["gd", maxGd]] as const) {
        const cu = await tx.bo_dem.findUnique({ where: { khoa } });
        await tx.bo_dem.upsert({ where: { khoa }, create: { khoa, gia_tri: v }, update: { gia_tri: Math.max(v, cu?.gia_tri ?? 0) } });
      }
      for (const b of buoi) {
        const data = { ngay: s2d(b.ngay), so_phut: b.so_phut, loai: b.loai, trang_thai: b.trang_thai, ly_do_huy: b.ly_do_huy, noi_dung: b.noi_dung, link_record: b.link_record, ghi_chu: b.ghi_chu };
        await tx.buoi_hoc.upsert({ where: { mon_id_bat_dau_luc: { mon_id: b.mon_id, bat_dau_luc: b.bat_dau_luc } }, create: { mon_id: b.mon_id, bat_dau_luc: b.bat_dau_luc, ...data }, update: data });
      }
      const buoiId = new Map((await tx.buoi_hoc.findMany({ select: { id: true, mon_id: true, bat_dau_luc: true } })).map((b) => [`${b.mon_id}|${b.bat_dau_luc.toISOString()}`, b.id]));
      const idCua = (b: (typeof buoi)[number]) => buoiId.get(`${b.mon_id}|${b.bat_dau_luc.toISOString()}`)!;
      for (const d of diem) {
        const k = { buoi_id: idCua(d.buoi), hoc_sinh_id: hsId.get(d.ma_hs)! };
        const ghi_luc = lucVN(d.buoi.ngay, "23:45"); // sheet không lưu giờ điểm danh thật
        await tx.diem_danh.upsert({ where: { buoi_id_hoc_sinh_id: k }, create: { ...k, trang_thai: d.trang_thai, ghi_luc, nguon: "sheet" }, update: { trang_thai: d.trang_thai } });
      }
      // da_diem_danh_luc: chỉ khi mọi em trong danh sách đều có bản ghi (4.4 bước 5)
      let daXong = 0;
      for (const b of buoi) {
        const ds = dsBuoi(b);
        const co = new Set(diem.filter((d) => d.buoi === b).map((d) => d.ma_hs));
        const xong = ds.length > 0 && ds.every((m) => co.has(m));
        if (xong) daXong++;
        await tx.buoi_hoc.update({ where: { id: idCua(b) }, data: { da_diem_danh_luc: xong ? lucVN(b.ngay, "23:45") : null } });
      }
      for (const d of don) {
        const data = {
          thoi_gian: d.thoi_gian, nguon: d.nguon, loai: d.loai, ho_ten: d.ho_ten, sdt_hs: d.sdt_hs, gmail: d.gmail, truong: d.truong, khoi: d.khoi, ho_ten_ph: d.ho_ten_ph, sdt_ph: d.sdt_ph,
          mon_ids: d.mon_ids, muc_tieu: d.muc_tieu, biet_qua: d.biet_qua, da_hoc_thu: d.da_hoc_thu, dong_y: d.dong_y, dong_y_vinh_danh: d.dong_y_vinh_danh, trang_thai: d.trang_thai,
          hoc_sinh_id: d.ma_hs ? (hsId.get(d.ma_hs) ?? null) : null, ma_hs_cu: d.ma_hs && !hsId.has(d.ma_hs) ? d.ma_hs : null, ghi_chu_xu_ly: d.ghi_chu_xu_ly, loi_du_lieu: d.loi_du_lieu,
        };
        await tx.don_dang_ky.upsert({ where: { ma_yeu_cau: d.ma_yeu_cau }, create: { ma_yeu_cau: d.ma_yeu_cau, ...data }, update: data });
      }

      // ── Đối soát (6.3) — lệch thì rollback ──
      const dd = await tx.diem_danh.groupBy({ by: ["trang_thai"], _count: true });
      const buoiTheoMon = await tx.buoi_hoc.groupBy({ by: ["mon_id"], _count: true });
      const h = opt.ngayChot;
      const gdDb = await tx.ghi_danh.findMany();
      const gdMap = new Map<number, GD[]>();
      for (const g of gdDb) gdMap.set(g.hoc_sinh_id, [...(gdMap.get(g.hoc_sinh_id) ?? []), gdCua(g)]);
      const CHU_O = { hoc: "Học", thu: "Thử", nghi: "Nghỉ" } as const;
      let lechO = 0, soO = 0;
      for (const x of hs.filter((x) => x.so > 0)) for (const m of mon) {
        const o = oMon(gdMap.get(hsId.get(x.ma_hs)!) ?? [], m.id, h);
        const sheet = x.o[m.ten_ngan] ?? null;
        soO++;
        if ((o ? CHU_O[o] : null) !== (sheet && !["—", "–", "-"].includes(sheet) ? sheet : null)) lechO++;
      }
      const tinh: Record<string, number> = {};
      for (const x of hs) { const t = tinhTrang(gdMap.get(hsId.get(x.ma_hs)!) ?? [], h).replace(/^Thử → CT.*/, "Thử → CT"); tinh[t] = (tinh[t] ?? 0) + 1; }
      // Sĩ số tháng ma trận theo môn so với số dòng của khối môn
      const thangMT = [...dau.keys()].map((k) => k.slice(0, 7))[0] ?? buoi.find((b) => b.tick)?.ngay.slice(0, 7);
      const siSoThang = mon.map((m) => {
        const bs = buoi.filter((b) => b.mon_id === m.id && b.ngay.startsWith(thangMT ?? "") && b.trang_thai !== "huy");
        const em = new Set(bs.flatMap((b) => dsBuoi(b)).filter((ma) => !maDungLai.has(ma)));
        return { mon: m.ten_ngan, tinh: em.size, ma_tran: hangMaTran.get(m.id)?.size ?? 0 };
      });

      Object.assign(bao, {
        che_do: opt.apply ? "GHI THẬT (--apply)" : "XEM TRƯỚC (rollback)",
        ngay_chot: h,
        so_dong: {
          lua: await tx.lua.count(), mon: await tx.mon.count(), cai_dat: await tx.cai_dat.count(), hoc_sinh: await tx.hoc_sinh.count(), ghi_danh: await tx.ghi_danh.count(),
          ghi_danh_thu: gdDb.filter((g) => g.loai === "thu").length, ghi_danh_chinh_thuc: gdDb.filter((g) => g.loai === "chinh_thuc").length,
          buoi_hoc: await tx.buoi_hoc.count(), buoi_theo_mon: Object.fromEntries(buoiTheoMon.map((b) => [mon.find((m) => m.id === b.mon_id)!.ten_ngan, b._count])),
          diem_danh: await tx.diem_danh.count(), diem_danh_theo_trang_thai: Object.fromEntries(dd.map((d) => [d.trang_thai, d._count])),
          don_dang_ky: await tx.don_dang_ky.count(), don_khong_con_ho_so: don.filter((d) => d.ma_hs && !hsId.has(d.ma_hs)).length,
          ma_hs_khong_con_ho_so: new Set(don.filter((d) => d.ma_hs && !hsId.has(d.ma_hs)).map((d) => d.ma_hs)).size,
          bo_dem: Object.fromEntries((await tx.bo_dem.findMany()).map((b) => [b.khoa, b.gia_tri])),
        },
        diem_danh_theo_buoi: bangBuoi,
        buoi_da_diem_danh_xong: daXong,
        dau_ma_tran_chua_luu: dauMaTran,
        t18_dung_lai_ho_so: dungLai,
        t34_chu_da_cho_nghi: choNghi,
        t20_buoi_chua_tick_co_dau: t20,
        doi_soat_o_mon: `${lechO}/${soO} ô lệch`,
        tinh_trang: tinh,
        si_so_thang_ma_tran: siSoThang,
        ten_bat_dau_chu_thuong: hs.filter((x) => x.chu_thuong).map((x) => `dòng ${x.so}`),
        gmail_can_xem: hs.filter((x) => !gmailHopLe(x.gmail)).map((x) => x.ma_hs),
        loi,
      });
      // Đối soát số dòng: CSDL sau khi ghi phải đúng bằng số đọc từ sheet (dòng thừa/thiếu/gộp nhầm đều là lệch).
      const doiSoat = {
        lua: [lua.length, await tx.lua.count()], mon: [mon.length, await tx.mon.count()], hoc_sinh: [hs.length, await tx.hoc_sinh.count()],
        ghi_danh: [gd.length, gdDb.length], buoi_hoc: [buoi.length, await tx.buoi_hoc.count()], diem_danh: [diem.length, await tx.diem_danh.count()],
        don_dang_ky: [don.length, await tx.don_dang_ky.count()],
      };
      const lechDong = Object.entries(doiSoat).filter(([, [a, b]]) => a !== b).map(([k, [a, b]]) => `${k} sheet ${a} ≠ CSDL ${b}`);
      // Phân bố tình trạng (chỉ hồ sơ có dòng ở tab Học sinh) so với cột Tình trạng của sheet.
      const gom = (ds: string[]) => ds.reduce<Record<string, number>>((m, t) => ({ ...m, [t]: (m[t] ?? 0) + 1 }), {});
      const rut = (t: string) => t.replace(/^Thử → CT.*/, "Thử → CT");
      const tuSheet = hs.filter((x) => x.so > 0);
      const ttSheet = gom(tuSheet.map((x) => rut(x.tinh_trang ?? "(trống)")));
      const ttTinh = gom(tuSheet.map((x) => rut(tinhTrang(gdMap.get(hsId.get(x.ma_hs)!) ?? [], h))));
      const lechTT = [...new Set([...Object.keys(ttSheet), ...Object.keys(ttTinh)])].filter((k) => ttSheet[k] !== ttTinh[k]);
      Object.assign(bao, { doi_soat_so_dong: Object.fromEntries(Object.entries(doiSoat).map(([k, [a, b]]) => [k, { sheet: a, csdl: b }])), tinh_trang_sheet: ttSheet });
      const lech = [
        ...lechDong,
        lechTT.length && `phân bố tình trạng (${lechTT.map((k) => `${k}: sheet ${ttSheet[k] ?? 0} ≠ tính ${ttTinh[k] ?? 0}`).join("; ")})`,
        lechO > 0 && "ô môn",
        siSoThang.some((s) => s.tinh !== s.ma_tran) && "sĩ số tháng ma trận",
      ].filter(Boolean);
      if (lech.length) { bao.ket_qua = `LỆCH: ${lech.join(", ")} ⇒ rollback`; throw ROLLBACK; }
      bao.ket_qua = opt.apply ? "ĐÃ GHI" : "KHỚP (đã rollback vì đang xem trước)";
      if (!opt.apply) throw ROLLBACK;
      await tx.cai_dat.deleteMany({ where: { khoa: DAU_DU_LIEU_GIA } }); // DB đã có dữ liệu thật ⇒ tắt đăng nhập thử trên preview (T40)
      const nk = await tx.nhat_ky.create({
        data: { vai_tro: "he_thong", hanh_dong: "chuyen_that", doi_tuong: "he_thong", sau: { ngay_chot: h, ghi_de_du_lieu_web: !!opt.ghiDeDuLieuWeb, web_da_van_hanh: web, doi_soat: doiSoat } },
      });
      bao.nhat_ky_chuyen_that = nk.id;
    }, { timeout: 300_000, maxWait: 30_000 });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
  return bao;

  function trung(ds: string[], ten: string) {
    const thay = new Set<string>();
    for (const x of ds) { if (thay.has(x)) throw new Dung(`Trùng ${ten} — dừng cả lần chuyển`); thay.add(x); }
  }
}

function gdCua(g: { mon_id: number; loai: GD["loai"]; tu_ngay: Date; den_ngay: Date | null; huy_luc: Date | null; nghi_luc: Date | null }): GD {
  return { mon_id: g.mon_id, loai: g.loai, tu: d2s(g.tu_ngay), den: g.den_ngay ? d2s(g.den_ngay) : null, huy: !!g.huy_luc, nghi: !!g.nghi_luc };
}

/** Số mã lớn nhất trong __DaXoa (chỉ đọc số, không chuyển dữ liệu — T19). */
async function daXoa(wb: ExcelJS.Workbook, tienTo: "HS" | "GD") {
  const ws = wb.worksheets.find((w) => w.name === "__DaXoa");
  const ra: number[] = [];
  ws?.eachRow((row) => (row.values as Cell[]).forEach((v) => {
    for (const m of String(chu(v) ?? "").matchAll(new RegExp(`${tienTo}(\\d{4,})`, "g"))) ra.push(Number(m[1]));
  }));
  return ra;
}

// ── Chạy trực tiếp ──
/**
 * Nhật ký KHÔNG tính là "web đã vận hành": việc tài khoản (T55 — chủ thêm GV, sửa, khoá, đăng xuất mọi máy) và "từ chối"
 * không đụng dữ liệu lớp, nên chủ làm trước khi chuyển dữ liệu thật vẫn chạy được --apply.
 */
export const HANH_DONG_KHONG_TINH = ["them_giao_vien", "sua_nguoi_dung", "phan_cong", "khoa_tai_khoan", "mo_khoa_tai_khoan", "thu_hoi_phien", "tu_choi"] as const;

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const tep = args.find((a) => !a.startsWith("--"));
  const apply = args.includes("--apply");
  const ghiDeDuLieuWeb = args.includes("--ghi-de-du-lieu-web");
  const ngayChot = args.find((a) => a.startsWith("--ngay-chot="))?.split("=")[1] ?? ngayVN(new Date());
  if (!tep) {
    console.error("Cách dùng: npx tsx scripts/chuyen-tu-sheet.ts <tệp.xlsx> [--ngay-chot=YYYY-MM-DD] [--apply] [--ghi-de-du-lieu-web]");
    process.exit(1);
  }
  const url = process.env.BCA_DATABASE_URL ?? "";
  const host = (() => { try { return new URL(url).hostname; } catch { return ""; } })();
  if (!["localhost", "127.0.0.1"].includes(host) && process.env.BCA_CHO_PHEP_CHUYEN_THAT !== "1") {
    console.error("Từ chối chạy lên DB không phải cục bộ (kể cả xem trước). Chỉ khi chủ quyết (T21): đặt BCA_CHO_PHEP_CHUYEN_THAT=1.");
    process.exit(1);
  }
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { PrismaClient } = await import("../generated/prisma/client");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    console.log(JSON.stringify(await chuyen(db, tep, { apply, ngayChot, ghiDeDuLieuWeb }), null, 2));
  } catch (e) {
    if (e instanceof Dung) { console.error("DỪNG:", e.message); process.exitCode = 2; } else throw e;
  } finally {
    await db.$disconnect();
  }
}
