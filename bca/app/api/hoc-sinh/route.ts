import { docJson, ngayHopLe, route } from "@/server/api";
import { danhSachHocSinh, taoHocSinh } from "@/server/hoc-sinh";

export const GET = route((u, req) => danhSachHocSinh(u, { coAn: new URL(req.url).searchParams.get("an") === "1" }));

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
