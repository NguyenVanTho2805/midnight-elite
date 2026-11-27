import { canChu } from "@/lib/lop/quyen";
import { docJson, ngayHopLe, route } from "@/lib/lop/server/api";
import { taoHocSinh } from "@/lib/lop/server/hoc-sinh";

/** Chủ tạo hồ sơ tay: { hoTen, ngayTao?, sdtHs?, sdtPh?, gmail?, hoTenPh?, truong?, khoi?, mucTieu?, nguon?, usernameAzota?, ghiChu?, ghiChuRieng?, dongYVinhDanh? }. */
export const POST = route(async (u, req) => {
  canChu(u); // quyền trước tham số
  const b = await docJson(req);
  const s = (k: string) => (b[k] === undefined || b[k] === null ? undefined : String(b[k]));
  return taoHocSinh(u, {
    hoTen: s("hoTen") ?? "", ngayTao: b.ngayTao ? ngayHopLe(b.ngayTao, "ngayTao") : undefined, sdtHs: s("sdtHs"), sdtPh: s("sdtPh"), gmail: s("gmail"),
    hoTenPh: s("hoTenPh"), truong: s("truong"), khoi: s("khoi"), mucTieu: s("mucTieu"), nguon: s("nguon"), usernameAzota: s("usernameAzota"),
    ghiChu: s("ghiChu"), ghiChuRieng: s("ghiChuRieng"), dongYVinhDanh: b.dongYVinhDanh === true,
  });
});
