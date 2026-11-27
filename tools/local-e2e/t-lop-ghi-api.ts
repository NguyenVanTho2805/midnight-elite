// KiN lớp bước 6 — các route GHI của chủ lớp qua HTTP thật (máy chủ thử ở BASE): /api/lop/{hoc-sinh,gia-han,hom-nay/xong,don,giao-vien}/**.
// Cờ, phiên KiN → người của lớp, quyền TRƯỚC tham số, nhật ký "từ chối", và phân công giáo viên (không đụng bảng users).
// Chuyển từ test gốc của web lớp: api-quyen ("mọi thao tác chỉ chủ → 403"), vong-2 / vong-3 / vong-4 / vong-5 (phần route: xong, nghi-mon, an / bo-an, hoc-sinh POST / PATCH, gia-han số ngày sai,
// don tao-ho-so / bo-qua / hoan-tac, quyền trước tham số), tai-khoan (thêm GV, trùng Gmail, T49, đặt lại môn, khoá / mở khoá).
// KHÔNG chuyển (không còn áp dụng trong KiN): "chủ cuối cùng" (2 ca — vai chủ do admin_super của KiN quyết định, dòng chủ không khoá được ở đây), thu hồi phiên, Gmail gõ nhầm khi thêm GV, sửa tên GV
// (tài khoản do khu quản trị KiN quản lý). Luật ngày tháng với giờ cố định: t-lop-ghi-danh.ts.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-lop-ghi-api.ts   (dev server PHẢI đang chạy; bài tự nhận cờ: bật ⇒ chạy đủ, tắt ⇒ chỉ kiểm mọi route trả 404).
// Dữ liệu: nạp lại bca_* từ `bca_gia` trước và sau (lop-db.ts); tài khoản KiN thử tạo bằng upsert — không wipe(). Giờ là giờ THẬT của máy chủ nên không so ngày cụ thể.
import bcrypt from "bcryptjs";
import { api, check, section, done, type TUser } from "./h";
import { CHU, GV_ANH, buoiId, db, hsId, napLaiBca, nguoi } from "./lop-db";
import { manGiaoVien } from "@/lib/lop/server/giao-vien";

async function tk(email: string, name: string, role: "admin" | "student", adminRole?: TUser["adminRole"], them: { emailVerified?: boolean; banned?: boolean } = {}): Promise<TUser> {
  const data = { name, role, adminRole: adminRole ?? null, emailVerified: them.emailVerified ?? true, banned: them.banned ?? false };
  const u = await db.user.upsert({ where: { email }, update: data, create: { ...data, email, password: await bcrypt.hash("Passw0rd!", 4), tutorVerified: adminRole === "teacher" } });
  return { id: u.id, role, adminRole, email, name };
}
const J = (as: TUser | undefined, method: string, path: string, body?: unknown) => api(method, `/api/lop${path}`, { as, body });
const UUID_LA = "11111111-2222-4333-8444-555555555555";

async function main() {
  napLaiBca();
  const chu = await tk("chu-lop-api@kin.local", "Chủ lớp API", "admin", "admin_super");
  const gvAnh = await tk(GV_ANH, "GV Anh KiN", "admin", "teacher");
  const gvLa = await tk("gv-la-api@kin.local", "GV chưa có tài khoản lớp", "admin", "teacher");
  const nd = await tk("nd-lop-api@kin.local", "Quản trị nội dung", "admin", "admin_content");
  const hs = await tk("hs-lop-api@kin.local", "Học sinh", "student");
  const gvMoi = await tk("Gv.Moi.B6@kin.local", "Nguyễn Hoàng Bảo Ngọc Phương Anh", "admin", "teacher");
  const gvCxm = await tk("gv-cxm-b6@kin.local", "GV chưa xác minh", "admin", "teacher", { emailVerified: false });
  const gvCam = await tk("gv-cam-b6@kin.local", "GV bị khoá KiN", "admin", "teacher", { banned: true });
  const gvCham = await tk("gv.cham.b6@gmail.com", "GV trùng dạng gốc", "admin", "teacher");
  const gvHs = await tk("hs1@example.com", "GV trùng Gmail học sinh", "admin", "teacher");
  const don = (await db.bcaDonDangKy.findFirstOrThrow({ where: { ma_yeu_cau: "YC0041" } })).id;
  const idGvAnh = (await db.bcaNguoiDung.findUniqueOrThrow({ where: { gmail: GV_ANH } })).id;
  const DS: [string, string, unknown?][] = [
    ["POST", "/hoc-sinh", { hoTen: "Không được tạo" }], ["PATCH", "/hoc-sinh/HS0002", { ghiChu: "x" }], ["POST", "/hoc-sinh/HS0027/chuyen-chinh-thuc", { mon: ["toan"] }], ["POST", "/hoc-sinh/HS0027/chuyen-chinh-thuc/hoan-tac", { nhatKyId: 1 }],
    ["POST", "/hoc-sinh/HS0003/nghi-mon", { mon: "toan" }], ["POST", "/hoc-sinh/HS0024/ghi-danh", { mon: "toan", loai: "thu" }], ["POST", "/hoc-sinh/HS0034/an", {}], ["POST", "/hoc-sinh/HS0070/bo-an", {}],
    ["POST", "/gia-han", { maHs: ["HS0024"], soNgay: 3, lyDo: "x" }], ["POST", "/gia-han/hoan-tac", { nhatKyId: 1 }], ["POST", "/hom-nay/xong", { loai: "thu_sap_het", khoa: "HS0021" }], ["DELETE", "/hom-nay/xong?loai=thu_sap_het&khoa=HS0021"],
    ["GET", `/don/${don}/tao-ho-so`], ["POST", `/don/${don}/tao-ho-so`, {}], ["POST", `/don/${don}/bo-qua`, { lyDo: "x" }], ["POST", `/don/${don}/hoan-tac`, { nhatKyId: 1 }],
    ["POST", "/giao-vien", { userId: gvLa.id, mon: ["toan"] }], ["PATCH", `/giao-vien/${idGvAnh}`, { mon: ["toan"] }], ["POST", `/giao-vien/${idGvAnh}/khoa`, { khoa: true }],
  ];
  const dem = async () => [await db.bcaGhiDanh.count(), await db.bcaGhiDanh.count({ where: { OR: [{ nghi_luc: { not: null } }, { huy_luc: { not: null } }] } }), await db.bcaHocSinh.count(), await db.bcaHocSinh.count({ where: { an_luc: null } }),
    await db.bcaNguoiDung.count({ where: { khoa_luc: null } }), await db.bcaPhanCong.count(), await db.bcaViecXong.count(), await db.bcaDonDangKy.count({ where: { trang_thai: "cho_duyet" } })].join("/");
  const anhUsers = async () => JSON.stringify(await db.user.findMany({ orderBy: { id: "asc" }, select: { id: true, email: true, name: true, role: true, adminRole: true, emailVerified: true, banned: true, password: true } }));
  const truoc = await dem(), usersTruoc = await anhUsers();
  const tatCa = (u: TUser | undefined) => Promise.all(DS.map(([m, p, b]) => J(u, m, p, b).then((r) => r.status)));

  if ((await J(chu, "GET", `/don/${don}/tao-ho-so`)).status === 404) {
    section("Cờ LOP_ON TẮT (máy chủ đang chạy không có NEXT_PUBLIC_KIN_MO_LOP_ON=1)");
    const st = await tatCa(chu);
    check(`chủ lớp gọi cả ${DS.length} route bước 6 → đều 404, không ghi gì`, st.every((s) => s === 404) && (await dem()) === truoc, st);
    return;
  }

  section("Ai được vào (cờ bật) — chỉ chủ lớp");
  for (const [ten, u, ma] of [["chưa đăng nhập", undefined, 401], ["học sinh", hs, 403], ["quản trị nội dung", nd, 403], ["gia sư chưa có dòng bca_nguoi_dung", gvLa, 403], ["giáo viên Anh của lớp (thân hợp lệ)", gvAnh, 403]] as const) {
    const st = await tatCa(u);
    check(`${ten}: cả ${DS.length} route → ${ma}`, st.every((s) => s === ma), st);
  }
  check("các lượt bị chặn ở trên không ghi gì (ghi danh / hồ sơ / tài khoản lớp / phân công / việc xong / đơn)", (await dem()) === truoc, [truoc, await dem()]);
  {
    const tc0 = await db.bcaNhatKy.count({ where: { hanh_dong: "tu_choi", nguoi_dung_id: idGvAnh } });
    // Quyền TRƯỚC tham số (vong-5 P3-3): thân / id sai vẫn 403, không 400.
    const sai = await Promise.all([
      J(gvAnh, "POST", "/gia-han", { maHs: ["HS0036"], soNgay: -5, lyDo: "x" }), J(gvAnh, "POST", "/gia-han/hoan-tac", {}), J(gvAnh, "POST", "/hoc-sinh/HS0027/chuyen-chinh-thuc", { tuNgay: "2026-02-30" }),
      J(gvAnh, "POST", "/hoc-sinh/HS0034/an", { denNgay: "x" }), J(gvAnh, "GET", "/don/0x2/tao-ho-so"), J(gvAnh, "POST", "/don/0x2/bo-qua", {}), J(gvAnh, "POST", "/don/0x2/hoan-tac", {}),
      J(gvAnh, "POST", "/hom-nay/xong", { loai: "xoa_het" }), J(gvAnh, "PATCH", "/giao-vien/abc", { mon: "x" }), J(gvAnh, "POST", "/giao-vien/abc/khoa", {}), J(gvAnh, "POST", "/hoc-sinh", {}),
    ]);
    check("GV gọi 11 route chỉ-chủ với thân / id SAI → đều 403 (không 400)", sai.every((x) => x.status === 403), sai.map((x) => x.status));
    check("mỗi route bị chặn để lại nhật ký 'tu_choi' đứng tên GV đó (4.1)", (await db.bcaNhatKy.count({ where: { hanh_dong: "tu_choi", nguoi_dung_id: idGvAnh } })) > tc0);
  }

  section("Gia hạn thử + hoàn tác qua route");
  {
    const st = await Promise.all([-5, 9999, "abc", 0, 1.5].map((soNgay) => J(chu, "POST", "/gia-han", { maHs: ["HS0036"], soNgay, lyDo: "x" }).then((r) => r.status)));
    check("5 request GHI đầu tiên của chủ tới CÙNG LÚC (chưa có dòng bca_nguoi_dung): không cái nào 500, chỉ tạo đúng một dòng vai chủ", !st.includes(500) && (await db.bcaNguoiDung.count({ where: { gmail: chu.email } })) === 1, st);
    check("số ngày sai (−5, 9999, 'abc', 0, 1.5) → 400; thiếu cả soNgay lẫn denNgay → 400; ngày không có thật → 400", st.every((s) => s === 400) && (await J(chu, "POST", "/gia-han", { maHs: ["HS0036"], lyDo: "x" })).status === 400 && (await J(chu, "POST", "/gia-han", { maHs: ["HS0036"], denNgay: "2026-02-30", lyDo: "x" })).status === 400, st);
    const thieu = await J(chu, "POST", "/gia-han", { maHs: ["HS0024"], soNgay: 3 });
    check("thiếu lý do → 400 kèm câu 'Cần ghi lý do gia hạn'; chưa chọn em → 400", thieu.status === 400 && /lý do/.test(thieu.json?.error ?? "") && (await J(chu, "POST", "/gia-han", { maHs: [], soNgay: 3, lyDo: "x" })).status === 400, thieu.json);
    const id24 = await hsId("HS0024");
    const den0 = (await db.bcaGhiDanh.findMany({ where: { hoc_sinh_id: id24, loai: "thu" }, orderBy: { id: "asc" } })).map((g) => g.den_ngay?.toISOString());
    const r = await J(chu, "POST", "/gia-han", { maHs: ["HS0024"], soNgay: 3, lyDo: "Em bận thi" });
    const ndChu = await db.bcaNguoiDung.findUnique({ where: { gmail: chu.email } });
    const nk = r.json?.nhatKyId ? await db.bcaNhatKy.findUnique({ where: { id: r.json.nhatKyId } }) : null;
    const den1 = (await db.bcaGhiDanh.findMany({ where: { hoc_sinh_id: id24, loai: "thu" }, orderBy: { id: "asc" } })).map((g) => g.den_ngay?.toISOString());
    check("chủ gia hạn HS0024 +3 ngày → 200, ngày hết đổi trong CSDL, nhật ký đứng tên dòng bca_nguoi_dung vai chủ vừa tạo", r.status === 200 && r.json.ketQua?.[0]?.ma_hs === "HS0024" && JSON.stringify(den0) !== JSON.stringify(den1) && ndChu?.vai_tro === "chu" && nk?.nguoi_dung_id === ndChu.id, [r.status, r.json, den0, den1]);
    const khongThu = (await db.bcaHocSinh.findFirstOrThrow({ where: { an_luc: null, ghi_danh: { some: { loai: "chinh_thuc", den_ngay: null, huy_luc: null }, none: { loai: "thu" } } }, orderBy: { id: "asc" } })).ma_hs;
    const loi409 = await J(chu, "POST", "/gia-han", { maHs: ["HS0024", khongThu], soNgay: 3, lyDo: "x" });
    check(`nhóm có một em không học thử (${khongThu}) → 409, câu lỗi nêu mã em; em còn lại KHÔNG bị gia hạn`, loi409.status === 409 && (loi409.json?.error ?? "").includes(khongThu) && JSON.stringify((await db.bcaGhiDanh.findMany({ where: { hoc_sinh_id: id24, loai: "thu" }, orderBy: { id: "asc" } })).map((g) => g.den_ngay?.toISOString())) === JSON.stringify(den1), loi409.json);
    const ht = await J(chu, "POST", "/gia-han/hoan-tac", { nhatKyId: r.json.nhatKyId });
    check("hoàn tác → 200, ngày hết trở lại như cũ; lần hai → 409 da_hoan_tac; nhatKyId lạ → 404", ht.status === 200 && JSON.stringify((await db.bcaGhiDanh.findMany({ where: { hoc_sinh_id: id24, loai: "thu" }, orderBy: { id: "asc" } })).map((g) => g.den_ngay?.toISOString())) === JSON.stringify(den0)
      && (await J(chu, "POST", "/gia-han/hoan-tac", { nhatKyId: r.json.nhatKyId })).json?.ma === "da_hoan_tac" && (await J(chu, "POST", "/gia-han/hoan-tac", { nhatKyId: 99999999 })).status === 404, ht.json);
  }

  section("Chuyển chính thức, cho nghỉ, thêm môn, ẩn / bỏ ẩn qua route");
  {
    const ndChu = await db.bcaNguoiDung.findUniqueOrThrow({ where: { gmail: chu.email } });
    const ct = await J(chu, "POST", "/hoc-sinh/HS0027/chuyen-chinh-thuc", { mon: ["toan"] });
    const coCt = async () => db.bcaGhiDanh.count({ where: { hoc_sinh: { ma_hs: "HS0027" }, mon_id: 1, loai: "chinh_thuc", huy_luc: null } });
    check("chủ chuyển HS0027 Toán lên chính thức → 200 + nhatKyId, có dòng chính thức; KHÔNG trả đơn giá", ct.status === 200 && ct.json.nhatKyId > 0 && (await coCt()) === 1 && !("donGiaDuKien" in ct.json), ct.json);
    check("chưa chọn môn → 400; môn lạ → 404; em không có → 404", (await J(chu, "POST", "/hoc-sinh/HS0028/chuyen-chinh-thuc", { mon: [] })).status === 400 && (await J(chu, "POST", "/hoc-sinh/HS0028/chuyen-chinh-thuc", { mon: ["hoa"] })).status === 404 && (await J(chu, "POST", "/hoc-sinh/HS9999/chuyen-chinh-thuc", { mon: ["toan"] })).status === 404);
    check("hoàn tác: mã em không khớp lần chuyển → 404; đúng em → 200, dòng chính thức biến mất", (await J(chu, "POST", "/hoc-sinh/HS0032/chuyen-chinh-thuc/hoan-tac", { nhatKyId: ct.json.nhatKyId })).status === 404
      && (await J(chu, "POST", "/hoc-sinh/HS0027/chuyen-chinh-thuc/hoan-tac", { nhatKyId: ct.json.nhatKyId })).status === 200 && (await coCt()) === 0);
    const ng = await J(chu, "POST", "/hoc-sinh/HS0062/nghi-mon", { mon: ["toan", "anh"] });
    const g62 = await db.bcaGhiDanh.findMany({ where: { hoc_sinh: { ma_hs: "HS0062" } } });
    check("cho nghỉ cả hai môn em hết thử (HS0062) → 200, nghi_luc + nghi_boi = dòng của chủ; cho nghỉ lần hai → 409", ng.status === 200 && g62.length === 2 && g62.every((g) => g.nghi_luc && g.nghi_boi === ndChu.id) && (await J(chu, "POST", "/hoc-sinh/HS0062/nghi-mon", { mon: "toan" })).status === 409, ng.json);
    const id3 = await hsId("HS0003");
    const coMon = new Set((await db.bcaGhiDanh.findMany({ where: { hoc_sinh_id: id3 } })).map((g) => g.mon_id));
    const thieu = (await db.bcaMon.findMany({ orderBy: { thu_tu: "asc" } })).find((m) => !coMon.has(m.id));
    if (thieu) {
      const tm = await J(chu, "POST", "/hoc-sinh/HS0003/ghi-danh", { mon: thieu.ma, loai: "thu" });
      check(`thêm môn thử (${thieu.ma}) cho HS0003 → 200, có dòng thử mới do chủ tạo; thêm lần hai → 409`, tm.status === 200 && tm.json.thayDoi?.[0]?.kieu === "tao" && (await db.bcaGhiDanh.findFirst({ where: { hoc_sinh_id: id3, mon_id: thieu.id, loai: "thu" } }))?.tao_boi === ndChu.id && (await J(chu, "POST", "/hoc-sinh/HS0003/ghi-danh", { mon: thieu.ma, loai: "thu" })).status === 409, tm.json);
    } else check("HS0003 đã ghi danh đủ môn — bỏ ca thêm môn", true);
    const an = await J(chu, "POST", "/hoc-sinh/HS0034/an", {});
    const anLuc = (await db.bcaHocSinh.findUniqueOrThrow({ where: { ma_hs: "HS0034" } })).an_luc;
    const bo = await J(chu, "POST", "/hoc-sinh/HS0034/bo-an");
    check("ẩn HS0034 → 200 có an_luc; ẩn lần hai → 409; bỏ ẩn ngay → 200, khôi phục ghi danh, an_luc về null", an.status === 200 && !!anLuc && bo.status === 200 && bo.json.khoi_phuc_ghi_danh === true && (await db.bcaHocSinh.findUniqueOrThrow({ where: { ma_hs: "HS0034" } })).an_luc === null && (await J(chu, "POST", "/hoc-sinh/HS0034/bo-an")).status === 409, [an.status, bo.json]);
  }

  section("Hồ sơ: tạo tay, ghi chú, sửa thông tin qua route");
  {
    const r = await J(chu, "POST", "/hoc-sinh", { hoTen: "  Trần   Văn  Mới ", sdtHs: "+84 900 000 001", sdtPh: "0910000000", gmail: " Moi.Em@Gamil.com " });
    check("tạo hồ sơ tay → 200 mã HS0084, chuẩn hoá SĐT / Gmail, gợi ý Gmail gõ nhầm, cảnh báo trùng SĐT HS0001", r.status === 200 && r.json.ma_hs === "HS0084" && r.json.sdt_hs === "0900000001" && r.json.goi_y_gmail === "moi.em@gmail.com" && r.json.trung_sdt?.[0] === "HS0001"
      && (await db.bcaHocSinh.findUnique({ where: { ma_hs: "HS0084" } }))?.ho_ten === "Trần Văn Mới", r.json);
    check("trùng Gmail → 409 trung_gmail; thiếu tên → 400; thân không phải object → 400", (await J(chu, "POST", "/hoc-sinh", { hoTen: "Trùng", gmail: "HS1@example.com" })).json?.ma === "trung_gmail" && (await J(chu, "POST", "/hoc-sinh", { hoTen: "  " })).status === 400 && (await J(chu, "POST", "/hoc-sinh", [1])).status === 400);
    const gc = await J(chu, "PATCH", "/hoc-sinh/HS0002", { ghiChu: " Hay quên bài ", ghiChuRieng: "PH khó tính" });
    check("PATCH ghi chú → 200, cắt khoảng trắng, một nhật ký; {} → 400; mã lạ → 404", gc.status === 200 && gc.json.ghi_chu === "Hay quên bài" && gc.json.ghi_chu_rieng === "PH khó tính" && (await db.bcaNhatKy.count({ where: { hanh_dong: "sua_ghi_chu_hoc_sinh", doi_tuong_id: "HS0002" } })) === 1
      && (await J(chu, "PATCH", "/hoc-sinh/HS0002", {})).status === 400 && (await J(chu, "PATCH", "/hoc-sinh/HS9999", { ghiChu: "x" })).status === 404, gc.json);
    const sua = await J(chu, "PATCH", "/hoc-sinh/HS0002", { hoSo: { hoTen: "Nguyễn Hoàng Bảo Ngọc Phương Anh", truong: "", sdtPh: "0812 345 678", khongCo: "x" } });
    const h2 = await db.bcaHocSinh.findUniqueOrThrow({ where: { ma_hs: "HS0002" } });
    check("PATCH hoSo → 200: đổi tên, xoá trường, chuẩn hoá SĐT PH, ô lạ bị bỏ qua, ghi chú giữ nguyên", sua.status === 200 && h2.ho_ten === "Nguyễn Hoàng Bảo Ngọc Phương Anh" && h2.truong === null && h2.sdt_ph === "0812345678" && h2.ghi_chu === "Hay quên bài", [sua.json, h2.ho_ten]);
    check("hoSo: Gmail của hồ sơ khác → 409 trung_gmail; xoá họ tên → 400; hoSo rỗng → 400", (await J(chu, "PATCH", "/hoc-sinh/HS0002", { hoSo: { gmail: "hs1@example.com" } })).json?.ma === "trung_gmail" && (await J(chu, "PATCH", "/hoc-sinh/HS0002", { hoSo: { hoTen: "" } })).status === 400 && (await J(chu, "PATCH", "/hoc-sinh/HS0002", { hoSo: {} })).status === 400);
  }

  section("Việc xong ở Hôm nay (T33) qua route");
  {
    const x = await J(chu, "POST", "/hom-nay/xong", { loai: "thu_sap_het", khoa: "HS0021" });
    check("POST xong thu_sap_het → 200 có an_den; loại việc lạ → 400; thiếu khoá → 400", x.status === 200 && /^\d{4}-\d\d-\d\d$/.test(x.json.an_den) && (await db.bcaViecXong.count({ where: { loai: "thu_sap_het", khoa: "HS0021" } })) === 1
      && (await J(chu, "POST", "/hom-nay/xong", { loai: "xoa_het", khoa: "x" })).status === 400 && (await J(chu, "POST", "/hom-nay/xong", { loai: "het_thu" })).status === 400, x.json);
    check("DELETE (Hoàn tác) → 200, dòng biến mất; DELETE lần hai → 404", (await J(chu, "DELETE", "/hom-nay/xong?loai=thu_sap_het&khoa=HS0021")).status === 200 && (await db.bcaViecXong.count()) === 0 && (await J(chu, "DELETE", "/hom-nay/xong?loai=thu_sap_het&khoa=HS0021")).status === 404);
  }

  section("Đơn đăng ký qua route (T43)");
  {
    const xem = await J(chu, "GET", `/don/${don}/tao-ho-so`);
    check("GET xem trước đơn chờ của seed → 200: môn Toán, có khoảng thử, chưa xử lý; id 999999 → 404; id '0x2' → 400", xem.status === 200 && xem.json.mon?.[0] === "toan" && !!xem.json.thu_du_kien?.den && xem.json.da_xu_ly === false
      && (await J(chu, "GET", "/don/999999/tao-ho-so")).status === 404 && (await J(chu, "GET", "/don/0x2/tao-ho-so")).status === 400, xem.json);
    const thieu = await J(chu, "POST", `/don/${don}/bo-qua`, {});
    const bq = await J(chu, "POST", `/don/${don}/bo-qua`, { lyDo: "Không liên lạc được" });
    check("bỏ qua thiếu lý do → 400 kèm câu chỉ dẫn; có lý do → 200 bo_qua, lưu lý do; lần hai → 409 da_xu_ly", thieu.status === 400 && /lý do/.test(thieu.json?.error ?? "") && bq.status === 200 && bq.json.trang_thai === "bo_qua"
      && (await db.bcaDonDangKy.findUniqueOrThrow({ where: { id: don } })).ghi_chu_xu_ly === "Không liên lạc được" && (await J(chu, "POST", `/don/${don}/bo-qua`, { lyDo: "x" })).json?.ma === "da_xu_ly", [thieu.json, bq.json]);
    check("hoàn tác bỏ qua → 200, đơn về cho_duyet; hoàn tác lần hai → 409 da_hoan_tac", (await J(chu, "POST", `/don/${don}/hoan-tac`, { nhatKyId: bq.json.nhatKyId })).status === 200 && (await db.bcaDonDangKy.findUniqueOrThrow({ where: { id: don } })).trang_thai === "cho_duyet"
      && (await J(chu, "POST", `/don/${don}/hoan-tac`, { nhatKyId: bq.json.nhatKyId })).json?.ma === "da_hoan_tac");
    const soHs = await db.bcaHocSinh.count();
    const tao = await J(chu, "POST", `/don/${don}/tao-ho-so`, {});
    const moi = tao.json?.ma_hs ? await db.bcaHocSinh.findUnique({ where: { ma_hs: tao.json.ma_hs }, include: { ghi_danh: true } }) : null;
    check("tạo hồ sơ từ đơn → 200 da_tao: hồ sơ mới + một ghi danh THỬ Toán, đơn da_nhan gắn hồ sơ đó", tao.status === 200 && tao.json.ket_qua === "da_tao" && moi?.ghi_danh.length === 1 && moi.ghi_danh[0].loai === "thu" && moi.ghi_danh[0].mon_id === 1
      && (await db.bcaDonDangKy.findUniqueOrThrow({ where: { id: don } })).hoc_sinh_id === moi.id && (await db.bcaHocSinh.count()) === soHs + 1, tao.json);
    const ht = await J(chu, "POST", `/don/${don}/hoan-tac`, { nhatKyId: tao.json.nhatKyId });
    check("hoàn tác tạo hồ sơ → 200: hồ sơ + ghi danh bị xoá, đơn về cho_duyet không gắn hồ sơ", ht.status === 200 && (await db.bcaHocSinh.count()) === soHs && (await db.bcaDonDangKy.findUniqueOrThrow({ where: { id: don } })).hoc_sinh_id === null && (await db.bcaDonDangKy.findUniqueOrThrow({ where: { id: don } })).trang_thai === "cho_duyet", ht.json);
    const dTrung = await db.bcaDonDangKy.create({ data: { thoi_gian: new Date(), nguon: "Web", loai: "Học thử", ho_ten: "Nguyễn Minh Bình", gmail: " HS21@example.com", mon_ids: [3], ma_yeu_cau: "YC-B6-1", trang_thai: "cho_duyet", loi_du_lieu: [] } });
    const tr = await J(chu, "POST", `/don/${dTrung.id}/tao-ho-so`, {});
    check("đơn trùng Gmail HS0021 → 200 trung_ho_so + gợi ý, không ghi gì; gửi lại kèm maHs → da_gan", tr.status === 200 && tr.json.ket_qua === "trung_ho_so" && tr.json.goi_y?.[0]?.ma_hs === "HS0021" && (await db.bcaDonDangKy.findUniqueOrThrow({ where: { id: dTrung.id } })).trang_thai === "cho_duyet"
      && (await J(chu, "POST", `/don/${dTrung.id}/tao-ho-so`, { maHs: "HS0021" })).json?.ket_qua === "da_gan", tr.json);
    const dCu = await db.bcaDonDangKy.create({ data: { thoi_gian: new Date("2026-10-01T03:00:00Z"), nguon: "Web", loai: "Học thử", ho_ten: "Lê Thị Cũ", mon_ids: [1], ma_yeu_cau: "YC-B6-2", trang_thai: "cho_duyet", loi_du_lieu: [] } });
    const cq = await J(chu, "POST", `/don/${dCu.id}/tao-ho-so`, { taoMoi: true });
    check("đơn quá 14 ngày → can_chu_quyet don_qua_han, không ghi gì; gửi lại capThuMoi → da_tao", cq.json?.ket_qua === "can_chu_quyet" && cq.json.ly_do === "don_qua_han" && (await db.bcaDonDangKy.findUniqueOrThrow({ where: { id: dCu.id } })).trang_thai === "cho_duyet"
      && (await J(chu, "POST", `/don/${dCu.id}/tao-ho-so`, { taoMoi: true, capThuMoi: true })).json?.ket_qua === "da_tao", cq.json);
  }

  section("Phân công giáo viên (tai-khoan, đổi cho KiN: chọn giáo viên KiN đã có)");
  {
    const toan17 = await buoiId(1, "2026-11-17"), anh26 = await buoiId(4, "2026-11-26");
    const chuNd = await nguoi(chu.email);
    await db.bcaNguoiDung.create({ data: { gmail: "mo-coi-b6@bca.invalid", ten_hien_thi: "Dòng lớp chưa có tài khoản KiN", vai_tro: "giao_vien", phan_cong: { create: { mon_id: 2 } } } });
    const man0 = await manGiaoVien(chuNd);
    const tt = (email: string, m = man0) => m.giao_vien.find((g) => g.email === email);
    check("màn Giáo viên: GV Anh 'san_sang' có dòng lớp môn Anh; GV chưa xác minh 'chua_xac_minh'; GV bị khoá KiN 'bi_cam'; dòng lớp không có tài khoản KiN 'chua_co_tk' (môn Sử còn nguyên); chủ không nằm trong danh sách", tt(GV_ANH)?.trang_thai === "san_sang" && tt(GV_ANH)?.lop?.mon.join() === "anh"
      && tt(gvCxm.email)?.trang_thai === "chua_xac_minh" && tt(gvCxm.email)?.lop === null && tt(gvCam.email)?.trang_thai === "bi_cam" && tt("mo-coi-b6@bca.invalid")?.trang_thai === "chua_co_tk" && tt("mo-coi-b6@bca.invalid")?.userId === null && tt("mo-coi-b6@bca.invalid")?.lop?.mon.join() === "su"
      && !man0.giao_vien.some((g) => g.email === CHU || g.email === chu.email), man0.giao_vien.filter((g) => !g.email.endsWith("@test.local")).map((g) => [g.email, g.trang_thai, g.lop?.mon.join()]));
    check("GV mới chưa đưa vào lớp: xem buổi nào cũng 403", (await J(gvMoi, "GET", `/diem-danh/${toan17}`)).status === 403);
    const them = await J(chu, "POST", "/giao-vien", { userId: gvMoi.id, mon: ["toan"] });
    const dong = await db.bcaNguoiDung.findUnique({ where: { gmail: "gv.moi.b6@kin.local" }, include: { phan_cong: true } });
    const nkThem = dong ? await db.bcaNhatKy.findFirst({ where: { hanh_dong: "them_giao_vien", doi_tuong_id: dong.id } }) : null;
    check("chủ đưa GV mới vào lớp môn Toán → 200: dòng bca_nguoi_dung Gmail chữ thường, vai giáo viên, tên lấy từ KiN, 1 phân công, có nhật ký", them.status === 200 && dong?.vai_tro === "giao_vien" && dong.ten_hien_thi === gvMoi.name && dong.phan_cong.length === 1 && dong.phan_cong[0].mon_id === 1 && !!nkThem && (nkThem.sau as { mon?: string[] }).mon?.[0] === "toan", [them.json, dong]);
    check("GV đó đăng nhập KiN là vào được ngay và chỉ có môn được giao: buổi Toán 200, buổi Anh 403", (await J(gvMoi, "GET", `/diem-danh/${toan17}`)).status === 200 && (await J(gvMoi, "GET", `/diem-danh/${anh26}`)).status === 403);
    await db.bcaNguoiDung.create({ data: { gmail: "gvchamb6@gmail.com", ten_hien_thi: "Dòng cũ khác dấu chấm", vai_tro: "giao_vien" } });
    const st = [
      (await J(chu, "POST", "/giao-vien", { userId: gvMoi.id, mon: ["anh"] })).json?.ma, (await J(chu, "POST", "/giao-vien", { userId: gvCham.id, mon: [] })).json?.ma,
      (await J(chu, "POST", "/giao-vien", { userId: gvCxm.id, mon: ["toan"] })).json?.ma, (await J(chu, "POST", "/giao-vien", { userId: gvCam.id, mon: ["toan"] })).json?.ma,
    ];
    check("đã có trong lớp → 409 trung; Gmail trùng dạng gốc với dòng cũ (khác dấu chấm) → 409 trung; email chưa xác minh → 409 chua_xac_minh; tài khoản KiN bị khoá → 409 bi_cam", st.join() === "trung,trung,chua_xac_minh,bi_cam", st);
    const st2 = await Promise.all([hs.id, nd.id, chu.id, "khong-co", undefined].map((userId) => J(chu, "POST", "/giao-vien", { userId, mon: ["toan"] }).then((r) => `${r.status}${r.json?.ma ?? ""}`)));
    check("userId là học sinh / quản trị nội dung / chủ / không có / thiếu → 404 chua_co_tk (không tạo dòng lớp cho người không phải giáo viên KiN)", st2.every((s) => s === "404chua_co_tk"), st2);
    check("môn lạ → 400; mon không phải mảng → 400; không tạo dòng nào cho GV đó", (await J(chu, "POST", "/giao-vien", { userId: gvLa.id, mon: ["hoa"] })).status === 400 && (await J(chu, "POST", "/giao-vien", { userId: gvLa.id, mon: "toan" })).status === 400 && (await db.bcaNguoiDung.findUnique({ where: { gmail: gvLa.email } })) === null);
    const t49 = await J(chu, "POST", "/giao-vien", { userId: gvHs.id, mon: [] });
    check("Gmail đang ghi trên hồ sơ học sinh → vẫn thêm, trả mã hồ sơ để cảnh báo (T49)", t49.status === 200 && t49.json.trung_ho_so_hs?.[0] === "HS0001", t49.json);
    const doi = await J(chu, "PATCH", `/giao-vien/${dong!.id}`, { mon: ["anh"] });
    const nkPc = await db.bcaNhatKy.findFirst({ where: { hanh_dong: "phan_cong", doi_tuong_id: dong!.id }, orderBy: { id: "desc" } });
    check("đặt lại môn: bỏ Toán thêm Anh có hiệu lực ngay ở request kế tiếp; nhật ký phan_cong có trước / sau", doi.status === 200 && doi.json.mon.join() === "anh" && (await J(gvMoi, "GET", `/diem-danh/${toan17}`)).status === 403 && (await J(gvMoi, "GET", `/diem-danh/${anh26}`)).status === 200
      && (nkPc?.truoc as { mon?: string[] })?.mon?.join() === "toan" && (nkPc?.sau as { mon?: string[] })?.mon?.join() === "anh", [doi.json, nkPc]);
    const st3 = [
      (await J(chu, "PATCH", `/giao-vien/${chuNd.id}`, { mon: ["toan"] })).json?.ma, (await J(chu, "POST", `/giao-vien/${chuNd.id}/khoa`, { khoa: true })).json?.ma,
      (await J(chu, "PATCH", "/giao-vien/abc", { mon: [] })).status, (await J(chu, "PATCH", `/giao-vien/${UUID_LA}`, { mon: [] })).status, (await J(chu, "PATCH", `/giao-vien/${dong!.id}`, { mon: "anh" })).status, (await J(chu, "PATCH", `/giao-vien/${dong!.id}`, {})).status,
    ];
    check("dòng vai chủ: phân công / khoá → 409 la_chu (chủ do KiN quyết định); id không phải uuid → 404; uuid lạ → 404; mon không phải mảng / thiếu → 400", st3.join() === "la_chu,la_chu,404,404,400,400" && (await db.bcaNguoiDung.findUniqueOrThrow({ where: { id: chuNd.id } })).khoa_luc === null, st3);
    const k1 = await J(chu, "POST", `/giao-vien/${dong!.id}/khoa`, { khoa: true });
    const sauKhoa = (await J(gvMoi, "GET", `/diem-danh/${anh26}`)).status;
    const k2 = await J(chu, "POST", `/giao-vien/${dong!.id}/khoa`, { khoa: true });
    check("khoá GV → request kế tiếp của GV 403 ngay; khoá lần hai không lỗi và không thêm nhật ký", k1.status === 200 && sauKhoa === 403 && k2.status === 200 && (await db.bcaNhatKy.count({ where: { hanh_dong: "khoa_tai_khoan", doi_tuong_id: dong!.id } })) === 1, [k1.json, sauKhoa]);
    const man1 = await manGiaoVien(chuNd);
    check("màn Giáo viên sau khoá: dòng của GV đó khoa = true, môn Anh còn nguyên", tt(gvMoi.email, man1)?.lop?.khoa === true && tt(gvMoi.email, man1)?.lop?.mon.join() === "anh");
    check("mở khoá → GV vào lại được đúng môn Anh", (await J(chu, "POST", `/giao-vien/${dong!.id}/khoa`, { khoa: false })).status === 200 && (await J(gvMoi, "GET", `/diem-danh/${anh26}`)).status === 200 && (await J(gvMoi, "GET", `/diem-danh/${toan17}`)).status === 403);
  }
  check("suốt bài: KHÔNG dòng nào của bảng users bị đổi (email, tên, vai, xác minh, khoá, mật khẩu) và không thêm / bớt người dùng", (await anhUsers()) === usersTruoc);
}

main().catch((e) => { console.error(e); check("bài chạy hết không ném lỗi", false, String(e)); })
  .finally(() => { try { napLaiBca(); console.log("\n(đã nạp lại bca_* từ bca_gia)"); } catch (e) { console.error("KHÔNG nạp lại được bca_*:", e); } return done(); });
