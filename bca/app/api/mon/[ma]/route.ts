import { docJson, ngayHopLe, route, soNguyen } from "@/server/api";
import { doiLichMon } from "@/server/buoi-hoc";

/** { thu?: [1..7], gio?: "HH:MM", soPhut?, tuNgay?: "YYYY-MM-DD" } — chỉ chủ. Đổi lịch môn theo T8. */
export const PATCH = route<{ ma: string }>(async (u, req, p) => {
  const b = await docJson(req);
  return doiLichMon(u, p.ma, {
    thu: Array.isArray(b.thu) ? b.thu.map((x) => soNguyen(x, "thu")) : undefined,
    gio: b.gio === undefined ? undefined : String(b.gio),
    soPhut: b.soPhut === undefined ? undefined : soNguyen(b.soPhut, "soPhut"),
    tuNgay: b.tuNgay ? ngayHopLe(b.tuNgay, "tuNgay") : undefined,
  });
});
