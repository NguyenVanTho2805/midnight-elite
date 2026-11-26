import { canQuanLy } from "@/lib/quyen";
import { docJson, ngayHopLe, route } from "@/server/api";
import { danhSachHocSinh, taoHocSinh } from "@/server/hoc-sinh";

/** ?an=1 (chủ: gồm hồ sơ ẩn) · ?het_ngay=YYYY-MM-DD (chỉ em hết thử đúng ngày đó — nhóm ở Hôm nay). */
export const GET = route((u, req) => {
  canQuanLy(u); // quyền trước tham số: học sinh luôn 403, không 400
  const q = new URL(req.url).searchParams;
  const het = q.get("het_ngay");
  return danhSachHocSinh(u, { coAn: q.get("an") === "1", hetNgay: het ? ngayHopLe(het, "het_ngay") : undefined });
});

/** Chủ tạo hồ sơ tay: { hoTen, ngayTao?, sdtHs?, sdtPh?, gmail?, hoTenPh?, truong?, khoi?, mucTieu?, nguon?, usernameAzota?, ghiChu?, ghiChuRieng?, dongYVinhDanh? }. */
export const POST = route(async (u, req) => {
  const b = await docJson(req);
  const s = (k: string) => (b[k] === undefined || b[k] === null ? undefined : String(b[k]));
  return taoHocSinh(u, {
    hoTen: s("hoTen") ?? "", ngayTao: b.ngayTao ? ngayHopLe(b.ngayTao, "ngayTao") : undefined, sdtHs: s("sdtHs"), sdtPh: s("sdtPh"), gmail: s("gmail"),
    hoTenPh: s("hoTenPh"), truong: s("truong"), khoi: s("khoi"), mucTieu: s("mucTieu"), nguon: s("nguon"), usernameAzota: s("usernameAzota"),
    ghiChu: s("ghiChu"), ghiChuRieng: s("ghiChuRieng"), dongYVinhDanh: b.dongYVinhDanh === true,
  });
});
