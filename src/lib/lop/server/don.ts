// Chép từ bca/server/don.ts. Đơn đăng ký — chỉ chủ (phan-quyen.md Điều 3). T43: "Tạo hồ sơ từ đơn" và "Bỏ qua", mỗi việc có Hoàn tác 10 giây.
import { BcaTrangThaiDon as trang_thai_don } from "@/generated/prisma/enums";
import { congNgay, ngayVN } from "../ngay";
import { canChu, LoiDuLieu, type Nguoi } from "../quyen";
import { conHanHoanTac, conMo, hanThuChung, type GD, type Viec } from "../quy-tac";
import { catKhoangTrang, chuanHoaGmail, chuanHoaSdt, tenGiong } from "../chuan-hoa";
import { prisma as db } from "@/lib/prisma";
import type { Tx } from "./du-lieu";
import { napGD, napMon, soNgayHocThu } from "./du-lieu";
import { ghiNhatKy, khoaNhatKy } from "./nhat-ky";
import { apDung, traLai, type ThayDoi } from "./ghi-danh";
import { taoHoSoTx, type HoSoMoi } from "./hoc-sinh";

const TRANG_THAI_DON: string[] = Object.values(trang_thai_don);
const CHUA_XU_LY = ["moi", "cho_duyet"];

export async function danhSachDon(u: Nguoi, opt: { trangThai?: string } = {}) {
  canChu(u);
  if (opt.trangThai && !TRANG_THAI_DON.includes(opt.trangThai)) throw new LoiDuLieu(`trang_thai phải là một trong: ${TRANG_THAI_DON.join(", ")}`);
  const mons = new Map((await napMon()).map((m) => [m.id, m.ma]));
  const ds = await db.bcaDonDangKy.findMany({
    where: opt.trangThai ? { trang_thai: opt.trangThai as trang_thai_don } : {},
    orderBy: { thoi_gian: "desc" },
    include: { hoc_sinh: { select: { ma_hs: true } } },
  });
  return { don: ds.map(({ hoc_sinh, mon_ids, ...d }) => ({ ...d, mon: mon_ids.map((id) => mons.get(id)), ma_hs: hoc_sinh?.ma_hs ?? d.ma_hs_cu })) };
}

type Don = NonNullable<Awaited<ReturnType<typeof db.bcaDonDangKy.findUnique>>>;
/** Khoá dòng đơn tới hết transaction: hai lần xử lý cùng lúc ⇒ lần sau thấy đơn đã xử lý ⇒ 409. */
async function napDon(tx: Tx, id: number): Promise<Don> {
  await tx.$queryRaw`SELECT id FROM bca_don_dang_ky WHERE id = ${id} FOR UPDATE`;
  const d = await tx.bcaDonDangKy.findUnique({ where: { id } });
  if (!d) throw new LoiDuLieu("Không có đơn này", 404);
  return d;
}
/** Loại "Học thử" ⇒ thử; loại khác có chữ ("Chính thức") ⇒ thử kèm cờ muốn chính thức (T3). Loại trống ⇒ không coi là muốn chính thức. Cùng regex với chuyen-du-lieu.md 4.x. */
const muonChinhThuc = (d: Don) => {
  const l = (d.loai ?? "").normalize("NFC").trim();
  return !!l && !/th[uử]/i.test(l);
};

/**
 * Khoảng thử khi nhận đơn (T1, T2, T44, T46, ghi-danh.md 5.1–5.2), dùng chung cho xem trước và tạo thật.
 * `gds` = ghi danh của hồ sơ sẽ gắn ([] nếu tạo hồ sơ mới). `ly_do` khác null ⇒ cần chủ quyết (không tự cấp):
 * - em từng có ghi danh (thử hoặc chính thức) mà hôm nay không còn môn nào mở (T2, T46): `het_thu_dang_ky_lai` / `da_nghi_dang_ky_lai` (từng chính thức);
 * - 14 ngày tính từ ngày đăng ký đã hết: `don_qua_han`.
 * Ngày hết: em đang thử ⇒ hạn chung (5.2); không thì ngày đăng ký + 13 (T1/T44); nếu ngày đó đã qua (đơn quá hạn) thì 14 ngày từ hôm nay — đây là ngày chủ nhận được khi bấm "Cấp thử".
 */
function khoangThuDon(gds: GD[], dk: string, h: string, soNgay: number) {
  const tu = dk > h ? dk : h;
  const daTung = gds.filter((g) => !g.huy);
  const emCu = daTung.length > 0 && !daTung.some((g) => conMo(g, h));
  const den = hanThuChung(gds, h) ?? congNgay(dk, soNgay - 1);
  const ly_do = emCu ? (daTung.some((g) => g.loai === "chinh_thuc") ? "da_nghi_dang_ky_lai" : "het_thu_dang_ky_lai") : den < tu ? "don_qua_han" : null;
  return { tu, den: den < tu ? congNgay(h, soNgay - 1) : den, ly_do };
}

const hoSoTuDon = (d: Don): HoSoMoi => ({
  hoTen: d.ho_ten, ngayTao: ngayVN(d.thoi_gian), sdtHs: d.sdt_hs ?? undefined, sdtPh: d.sdt_ph ?? undefined, gmail: d.gmail ?? undefined,
  hoTenPh: d.ho_ten_ph ?? undefined, truong: d.truong ?? undefined, khoi: d.khoi ?? undefined, mucTieu: d.muc_tieu ?? undefined,
  nguon: d.nguon ?? "Đơn đăng ký", dongYVinhDanh: d.dong_y_vinh_danh,
});

/** ghi-danh.md 1.4: hồ sơ trùng Gmail hoặc SĐT HS/PH (kèm hồ sơ đơn đã gắn sẵn). Tên giống chỉ để chủ tham khảo — mọi ca trùng đều để chủ chọn. */
async function hoSoTrung(tx: Tx, d: Don, h: string, soNgay: number) {
  const gmail = chuanHoaGmail(d.gmail);
  const sdts = [chuanHoaSdt(d.sdt_hs), chuanHoaSdt(d.sdt_ph)].filter((x): x is string => !!x);
  const or = [...(gmail ? [{ gmail }] : []), ...(sdts.length ? [{ sdt_hs: { in: sdts } }, { sdt_ph: { in: sdts } }] : []), ...(d.hoc_sinh_id ? [{ id: d.hoc_sinh_id }] : [])];
  if (!or.length) return [];
  const rows = await tx.bcaHocSinh.findMany({ where: { OR: or }, select: { id: true, ma_hs: true, ho_ten: true, gmail: true, sdt_hs: true, sdt_ph: true, an_luc: true }, orderBy: { id: "asc" } });
  const gds = rows.length ? await napGD({ hoc_sinh_id: { in: rows.map((r) => r.id) } }, tx) : new Map();
  return rows.map((r) => ({
    ma_hs: r.ma_hs, ho_ten: r.ho_ten, an: !!r.an_luc, ten_giong: tenGiong(r.ho_ten, d.ho_ten),
    khop: [gmail && r.gmail === gmail && "gmail", sdts.some((s) => s === r.sdt_hs || s === r.sdt_ph) && "sdt", d.hoc_sinh_id === r.id && "don_da_gan"].filter((x): x is string => !!x),
    thu_du_kien: khoangThuDon(gds.get(r.id) ?? [], ngayVN(d.thoi_gian), h, soNgay), // nếu gắn đơn vào hồ sơ này
  }));
}

/**
 * Xem trước "Tạo hồ sơ từ đơn" (chỉ chủ, không ghi): hồ sơ điền sẵn, môn, cờ muốn chính thức, hồ sơ có thể trùng.
 * `thu_du_kien {tu, den, ly_do}` nếu tạo hồ sơ mới; mỗi hồ sơ trong `trung` có `thu_du_kien` riêng nếu gắn vào đó (em đang thử ⇒ hạn chung) — cùng hàm với lúc tạo thật.
 */
export async function xemTruocDon(u: Nguoi, id: number, luc = new Date()) {
  canChu(u);
  const d = await db.bcaDonDangKy.findUnique({ where: { id } });
  if (!d) throw new LoiDuLieu("Không có đơn này", 404);
  const h = ngayVN(luc), dk = ngayVN(d.thoi_gian);
  const [mons, SO_NGAY_HOC_THU] = await Promise.all([napMon(), soNgayHocThu()]);
  return {
    don_id: d.id, trang_thai: d.trang_thai, da_xu_ly: !CHUA_XU_LY.includes(d.trang_thai), ho_so: hoSoTuDon(d), mon: d.mon_ids.map((m) => mons.find((x) => x.id === m)?.ma),
    muon_chinh_thuc: muonChinhThuc(d), ngay_dang_ky: dk, thu_du_kien: khoangThuDon([], dk, h, SO_NGAY_HOC_THU), trung: await hoSoTrung(db, d, h, SO_NGAY_HOC_THU),
  };
}

const COT_DIEN = ["sdt_hs", "sdt_ph", "gmail", "truong", "khoi", "ho_ten_ph", "muc_tieu"] as const;
type Cot = (typeof COT_DIEN)[number];

/**
 * T43 — tạo hồ sơ từ đơn (hoặc gắn vào hồ sơ cũ `maHs`) và ghi danh thử theo T1–T3:
 * - khoảng thử theo `khoangThuDon` (T1, T44, 5.2): em còn môn mở (đang học / đang thử) ⇒ môn mới ghi danh thử bình thường; môn em đang học/đang thử ⇒ bỏ qua, báo trong `bo_qua`;
 * - đơn "Chính thức" ⇒ vẫn thử, trả `muon_chinh_thuc: true` để chủ bấm chuyển (T3, QĐ 16);
 * - trùng Gmail/SĐT mà chưa chọn ⇒ `ket_qua: "trung_ho_so"` + `goi_y`, không ghi gì (gửi lại kèm `maHs` hoặc `taoMoi: true`);
 * - gắn hồ sơ cũ chỉ điền ô trống; Gmail của đơn đã thuộc hồ sơ khác ⇒ không điền, trả `trung_gmail: "<mã hồ sơ>"`;
 * - em cũ không còn môn mở (T2, T46) hoặc đơn quá 14 ngày ⇒ `ket_qua: "can_chu_quyet"`, không ghi gì; chủ gửi lại `capThuMoi: true` (Cấp thử) ⇒
 *   hết ngày đăng ký + 13 nếu đơn còn trong 14 ngày, đơn quá hạn thì 14 ngày từ hôm nay.
 */
export async function taoHoSoTuDon(
  u: Nguoi, id: number, opt: { maHs?: string; taoMoi?: boolean; capThuMoi?: boolean; hoSo?: Partial<HoSoMoi> } = {}, luc = new Date(),
) {
  canChu(u);
  return db.$transaction(async (tx) => {
    const d = await napDon(tx, id);
    if (!CHUA_XU_LY.includes(d.trang_thai)) throw new LoiDuLieu("Đơn đã được xử lý", 409, "da_xu_ly");
    const muon_chinh_thuc = muonChinhThuc(d);
    const h = ngayVN(luc), dk = ngayVN(d.thoi_gian);
    const SO_NGAY_HOC_THU = await soNgayHocThu(tx);

    type HoSoCu = { id: number; ma_hs: string; an_luc: Date | null } & Record<Cot, string | null>;
    let cu: HoSoCu | null = null;
    if (opt.maHs) {
      cu = (await tx.bcaHocSinh.findUnique({ where: { ma_hs: opt.maHs }, select: { id: true, ma_hs: true, an_luc: true, ...Object.fromEntries(COT_DIEN.map((c) => [c, true])) } })) as HoSoCu | null;
      if (!cu) throw new LoiDuLieu(`Không có học sinh ${opt.maHs}`, 404);
      if (cu.an_luc) throw new LoiDuLieu(`Hồ sơ ${cu.ma_hs} đang ẩn — bỏ ẩn trước rồi gắn đơn`, 409, "ho_so_an");
    } else if (!opt.taoMoi) {
      const goi_y = await hoSoTrung(tx, d, h, SO_NGAY_HOC_THU);
      if (goi_y.length) return { ket_qua: "trung_ho_so" as const, goi_y, muon_chinh_thuc };
    }

    // Khoảng thử tính trước khi ghi để ca "chủ quyết" không ghi gì.
    const gds = cu ? ((await napGD({ hoc_sinh_id: cu.id }, tx)).get(cu.id) ?? []) : [];
    const { tu, den, ly_do } = khoangThuDon(gds, dk, h, SO_NGAY_HOC_THU);
    if (ly_do && !opt.capThuMoi) return { ket_qua: "can_chu_quyet" as const, ly_do, ma_hs: cu?.ma_hs ?? null, muon_chinh_thuc };

    let hs: { id: number; ma_hs: string }, canh_bao = {};
    const dien: Partial<Record<Cot, string>> = {}; // ô vừa điền + giá trị (hoàn tác chỉ trả về trống nếu ô còn đúng giá trị này)
    if (cu) {
      // Chỉ điền ô hồ sơ đang trống, không ghi đè (1.4).
      const tuDon: Record<Cot, string | null> = {
        sdt_hs: chuanHoaSdt(d.sdt_hs), sdt_ph: chuanHoaSdt(d.sdt_ph), gmail: chuanHoaGmail(d.gmail), truong: catKhoangTrang(d.truong), khoi: catKhoangTrang(d.khoi),
        ho_ten_ph: catKhoangTrang(d.ho_ten_ph), muc_tieu: catKhoangTrang(d.muc_tieu),
      };
      for (const c of COT_DIEN) if (tuDon[c] && !cu[c]) dien[c] = tuDon[c]!;
      const chuGmail = dien.gmail ? await tx.bcaHocSinh.findUnique({ where: { gmail: dien.gmail }, select: { ma_hs: true } }) : null;
      if (chuGmail) { delete dien.gmail; canh_bao = { trung_gmail: chuGmail.ma_hs }; } // Gmail là duy nhất: không điền, báo mã hồ sơ đang giữ
      // T47: ô đã có giá trị khác với đơn (vd SĐT phụ huynh) ⇒ giữ số cũ, báo cho chủ biết để xác minh.
      const khac = COT_DIEN.filter((c) => tuDon[c] && cu[c] && tuDon[c] !== cu[c] && (c === "sdt_ph" || c === "sdt_hs"));
      if (khac.length) canh_bao = { ...(canh_bao ?? {}), khac_ho_so: khac };
      if (Object.keys(dien).length) await tx.bcaHocSinh.update({ where: { id: cu.id }, data: dien });
      hs = cu;
    } else {
      const { id: hsId, ma_hs, ...cb } = await taoHoSoTx(tx, u, { ...hoSoTuDon(d), ...opt.hoSo }, luc);
      hs = { id: hsId, ma_hs };
      canh_bao = cb;
    }

    const mons = new Map((await napMon(tx)).map((m) => [m.id, m.ma]));
    const viec: Viec[] = [], bo_qua: { mon: string | undefined; ly_do: string }[] = [];
    for (const m of d.mon_ids) {
      const g = gds.find((g) => g.mon_id === m && conMo(g, tu));
      if (g) bo_qua.push({ mon: mons.get(m), ly_do: g.loai === "chinh_thuc" ? "dang_chinh_thuc" : "dang_thu" });
      else viec.push({ kieu: "tao", mon_id: m, loai: "thu", tu, den, ghi_chu: `Từ đơn ${d.ma_yeu_cau}${muon_chinh_thuc ? " — đơn Chính thức, muốn lên chính thức" : ""}` });
    }
    const thay_doi = await apDung(tx, u, hs.id, viec, "tao_ho_so_tu_don", null, luc);
    await tx.bcaDonDangKy.update({ where: { id }, data: { trang_thai: "da_nhan", hoc_sinh_id: hs.id } });
    const nk = await ghiNhatKy(u, "tao_ho_so_tu_don", "don_dang_ky", id, { trang_thai: d.trang_thai, hoc_sinh_id: d.hoc_sinh_id },
      { luc: luc.toISOString(), ma_hs: hs.ma_hs, ho_so_moi: !cu, dien, thay_doi }, tx);
    return {
      ket_qua: cu ? ("da_gan" as const) : ("da_tao" as const), nhatKyId: nk.id, ma_hs: hs.ma_hs, muon_chinh_thuc,
      thu: viec.length ? { tu, den } : null, mon: viec.map((v) => mons.get((v as { mon_id: number }).mon_id)), bo_qua, dien: Object.keys(dien), ...canh_bao,
    };
  });
}

/** T43 — bỏ qua đơn, lý do bắt buộc (lưu vào ghi_chu_xu_ly). */
export async function boQuaDon(u: Nguoi, id: number, lyDo: string, luc = new Date()) {
  canChu(u);
  const ly_do = lyDo?.trim();
  if (!ly_do) throw new LoiDuLieu("Cần ghi lý do bỏ qua đơn");
  if (ly_do.length > 500) throw new LoiDuLieu("Lý do tối đa 500 ký tự");
  return db.$transaction(async (tx) => {
    const d = await napDon(tx, id);
    if (!CHUA_XU_LY.includes(d.trang_thai)) throw new LoiDuLieu("Đơn đã được xử lý", 409, "da_xu_ly");
    await tx.bcaDonDangKy.update({ where: { id }, data: { trang_thai: "bo_qua", ghi_chu_xu_ly: ly_do } });
    const nk = await ghiNhatKy(u, "bo_qua_don", "don_dang_ky", id, { trang_thai: d.trang_thai, ghi_chu_xu_ly: d.ghi_chu_xu_ly }, { luc: luc.toISOString(), ly_do }, tx);
    return { don_id: id, trang_thai: "bo_qua", nhatKyId: nk.id };
  });
}

/**
 * Hoàn tác "Tạo hồ sơ từ đơn" hoặc "Bỏ qua": chỉ chủ, một lần, trong HAN_HOAN_TAC_MS; tất cả hoặc không.
 * Tạo hồ sơ: xoá ghi danh vừa tạo, trả ô vừa điền về trống, hồ sơ mới tạo thì xoá (mã không cấp lại — bo_dem), đơn về trạng thái cũ.
 * Đã có điểm danh / ghi danh đã bị sửa / đơn đã đổi ⇒ 409, không đổi gì.
 */
export async function hoanTacXuLyDon(u: Nguoi, id: number, nhatKyId: number, luc = new Date()) {
  canChu(u);
  return db.$transaction(async (tx) => {
    await khoaNhatKy(tx, nhatKyId);
    const nk = await tx.bcaNhatKy.findUnique({ where: { id: nhatKyId } });
    if (!nk || !["tao_ho_so_tu_don", "bo_qua_don"].includes(nk.hanh_dong) || nk.doi_tuong !== "don_dang_ky" || nk.doi_tuong_id !== String(id))
      throw new LoiDuLieu("Không có lần xử lý đơn này", 404);
    const sau = nk.sau as { luc: string; ma_hs?: string; ho_so_moi?: boolean; dien?: Partial<Record<Cot, string>>; thay_doi?: ThayDoi[] };
    const truoc = nk.truoc as { trang_thai: trang_thai_don; hoc_sinh_id?: number | null; ghi_chu_xu_ly?: string | null };
    if (!conHanHoanTac(sau.luc, luc)) throw new LoiDuLieu("Đã quá thời gian hoàn tác", 409, "het_gio");
    if (await tx.bcaNhatKy.findFirst({ where: { hanh_dong: "hoan_tac_xu_ly_don", doi_tuong: "nhat_ky", doi_tuong_id: String(nhatKyId) } }))
      throw new LoiDuLieu("Lần xử lý này đã được hoàn tác", 409, "da_hoan_tac");
    const d = await napDon(tx, id);
    const daSua = () => new LoiDuLieu("Đơn hoặc hồ sơ đã bị sửa sau lần xử lý này — không hoàn tác được", 409, "da_sua");

    if (nk.hanh_dong === "bo_qua_don") {
      if (d.trang_thai !== "bo_qua") throw daSua();
      await tx.bcaDonDangKy.update({ where: { id }, data: { trang_thai: truoc.trang_thai, ghi_chu_xu_ly: truoc.ghi_chu_xu_ly ?? null } });
    } else {
      const hs = await tx.bcaHocSinh.findUnique({ where: { ma_hs: sau.ma_hs! }, select: { id: true } });
      if (!hs || d.trang_thai !== "da_nhan" || d.hoc_sinh_id !== hs.id) throw daSua();
      const thayDoi = sau.thay_doi ?? [];
      const gdMoi = await tx.bcaGhiDanh.findMany({ where: { id: { in: thayDoi.map((t) => t.id) } } });
      const coDD = sau.ho_so_moi
        ? await tx.bcaDiemDanh.count({ where: { hoc_sinh_id: hs.id } })
        : (await Promise.all(gdMoi.map((g) => tx.bcaDiemDanh.count({ where: { hoc_sinh_id: hs.id, buoi: { mon_id: g.mon_id, ngay: { gte: g.tu_ngay, ...(g.den_ngay ? { lte: g.den_ngay } : {}) } } } })))).reduce((a, b) => a + b, 0);
      if (coDD) throw new LoiDuLieu(`Em đã có ${coDD} điểm danh từ lần nhận đơn này — không hoàn tác được`, 409, "co_diem_danh");
      if (!(await traLai(tx, u, thayDoi, "hoan_tac_tao_ho_so_tu_don"))) throw daSua();
      await tx.bcaDonDangKy.update({ where: { id }, data: { trang_thai: truoc.trang_thai, hoc_sinh_id: truoc.hoc_sinh_id ?? null } });
      if (sau.ho_so_moi) {
        const conLai = (await tx.bcaGhiDanh.count({ where: { hoc_sinh_id: hs.id } })) + (await tx.bcaDonDangKy.count({ where: { hoc_sinh_id: hs.id } }));
        if (conLai) throw daSua(); // đã có người ghi danh / gắn đơn khác vào hồ sơ mới trong lúc đó
        await tx.bcaHocSinh.delete({ where: { id: hs.id } });
      } else if (sau.dien && Object.keys(sau.dien).length) {
        const cot = Object.keys(sau.dien) as Cot[];
        await tx.$queryRaw`SELECT id FROM bca_hoc_sinh WHERE id = ${hs.id} FOR UPDATE`;
        const hien = (await tx.bcaHocSinh.findUniqueOrThrow({ where: { id: hs.id }, select: Object.fromEntries(cot.map((c) => [c, true])) })) as unknown as Record<Cot, string | null>;
        if (cot.some((c) => hien[c] !== sau.dien![c])) throw daSua(); // ô đã bị sửa sau khi điền ⇒ không ghi đè
        await tx.bcaHocSinh.update({ where: { id: hs.id }, data: Object.fromEntries(cot.map((c) => [c, null])) });
      }
    }
    await ghiNhatKy(u, "hoan_tac_xu_ly_don", "nhat_ky", nhatKyId, null, { don_id: id, hanh_dong: nk.hanh_dong }, tx);
    return { don_id: id, trang_thai: truoc.trang_thai };
  });
}
