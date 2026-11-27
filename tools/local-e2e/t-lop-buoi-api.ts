// KiN lớp bước 5 — các route /api/lop/* qua HTTP thật (máy chủ thử ở BASE): cờ, phiên KiN → người của lớp, quyền trước tham số, nhật ký "từ chối", danh tính người ghi.
// Chuyển từ test gốc của web lớp: bca/tests/api-quyen.test.ts (GV môn khác, thao tác chỉ chủ, sửa nội dung), vong-2 / vong-4 (route DELETE + hoan-tac-xoa, con-thieu, id '0x2', PATCH rỗng).
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-lop-buoi-api.ts   (dev server PHẢI đang chạy; bài tự nhận cờ: bật ⇒ chạy đủ, tắt ⇒ chỉ kiểm mọi route trả 404).
// Dữ liệu: nạp lại bca_* từ `bca_gia` trước và sau (lop-db.ts), tài khoản KiN thử tạo bằng upsert — không wipe(). Giờ là giờ THẬT của máy chủ nên mọi lần ghi gửi kèm xacNhan
// (buổi Anh 26/11 của dữ liệu giả sẽ quá 48 giờ kể từ 28/11/2026); luật 48 giờ / chưa mở với giờ cố định nằm ở t-lop-diem-danh.
// Ca phá cố ý (đã chạy 27/11/2026, phá → đỏ → trả lại): api.ts bỏ `if (!LOP_ON)` rồi chạy với máy chủ cờ tắt → bài đỏ (route trả 403 thay vì 404 — còn lớp chặn thứ hai là nguoiLopBca);
// route DELETE bỏ `canChu(u)` trước soNguyen → ca "GV gọi 7 thao tác chỉ-chủ" đỏ (400 thay vì 403); nguoiLopBca không tạo dòng chủ khi ghi → 4 ca "danh tính người ghi" đỏ.
import bcrypt from "bcryptjs";
import { api, check, section, done, type TUser } from "./h";
import { GV_ANH, buoiId, db, hsId, napLaiBca } from "./lop-db";
import { lucVN, s2d } from "@/lib/lop/ngay";

async function tk(email: string, name: string, role: "admin" | "student", adminRole?: TUser["adminRole"], emailVerified = true): Promise<TUser> {
  const data = { name, role, adminRole: adminRole ?? null, emailVerified, banned: false };
  const u = await db.user.upsert({ where: { email }, update: data, create: { ...data, email, password: await bcrypt.hash("Passw0rd!", 4), tutorVerified: adminRole === "teacher" } });
  return { id: u.id, role, adminRole, email, name };
}
const J = (as: TUser | undefined, method: string, path: string, body?: unknown) => api(method, `/api/lop${path}`, { as, body });

async function main() {
  napLaiBca();
  const chu = await tk("chu-lop-api@kin.local", "Chủ lớp API", "admin", "admin_super");
  const chuChuaXM = await tk("chu-chua-xm@kin.local", "Chủ chưa xác minh", "admin", "admin_super", false);
  const gvAnh = await tk(GV_ANH, "GV Anh KiN", "admin", "teacher");
  const gvLa = await tk("gv-la-api@kin.local", "GV chưa có tài khoản lớp", "admin", "teacher");
  const nd = await tk("nd-lop-api@kin.local", "Quản trị nội dung", "admin", "admin_content");
  const hs = await tk("hs-lop-api@kin.local", "Học sinh", "student");
  const anh26 = await buoiId(4, "2026-11-26"), toan17 = await buoiId(1, "2026-11-17"), anh19 = await buoiId(4, "2026-11-19"), anh1210 = await buoiId(4, "2026-12-10");
  const DS: [string, string, unknown?][] = [
    ["GET", `/diem-danh/${anh26}`], ["PUT", `/diem-danh/${anh26}`, { hocSinhId: 1, trangThai: "co" }], ["POST", `/diem-danh/${anh26}/tat-ca`, {}], ["POST", `/diem-danh/${anh26}/hoan-tac`, { luc: "x" }],
    ["PATCH", `/buoi-hoc/${anh26}`, { noiDung: "x" }], ["DELETE", `/buoi-hoc/${anh26}`], ["POST", `/buoi-hoc/${anh26}/huy`, { lyDo: "x" }], ["POST", `/buoi-hoc/${anh26}/bo-huy`], ["POST", `/buoi-hoc/${anh26}/hoan-tac-xoa`, { nhatKyId: 1 }],
    ["POST", "/buoi-hoc/hoc-bu", { mon: "anh", ngay: "2026-12-05" }], ["GET", "/buoi-hoc/con-thieu?thang=2026-12"], ["POST", "/buoi-hoc/con-thieu", { thang: "2026-12" }],
  ];
  const dem = async () => [await db.bcaDiemDanh.count(), await db.bcaBuoiHoc.count(), await db.bcaNguoiDung.count()].join("/");
  const truoc = await dem();

  if ((await J(chu, "GET", `/diem-danh/${anh26}`)).status === 404) {
    section("Cờ LOP_ON TẮT (máy chủ đang chạy không có NEXT_PUBLIC_KIN_MO_LOP_ON=1)");
    const st = await Promise.all(DS.map(([m, p, b]) => J(chu, m, p, b).then((r) => r.status)));
    check("chủ lớp gọi cả 12 route → đều 404, không ghi gì", st.every((s) => s === 404) && (await dem()) === truoc, st);
    return;
  }

  section("Ai được vào (cờ bật)");
  for (const [ten, u, ma] of [["chưa đăng nhập", undefined, 401], ["học sinh", hs, 403], ["quản trị nội dung", nd, 403], ["gia sư chưa có dòng bca_nguoi_dung", gvLa, 403]] as const) {
    const st = await Promise.all(DS.map(([m, p, b]) => J(u, m, p, b).then((r) => r.status)));
    check(`${ten}: cả 12 route → ${ma}`, st.every((s) => s === ma), st);
  }
  check("các lượt bị chặn ở trên không ghi gì (điểm danh / buổi / tài khoản lớp)", (await dem()) === truoc, [truoc, await dem()]);
  const ghiCxm = await J(chuChuaXM, "PUT", `/diem-danh/${anh26}`, { hocSinhId: 1, trangThai: "co", xacNhan: true });
  check("chủ lớp CHƯA xác minh email: không tạo được dòng bca_nguoi_dung ⇒ ghi bị 403, không ghi gì", ghiCxm.status === 403 && (await dem()) === truoc, ghiCxm.status);

  section("Danh tính người ghi: chủ lớp chưa có dòng bca_nguoi_dung");
  const ct = await J(chu, "GET", `/diem-danh/${anh26}`);
  check("chủ GET buổi Anh 26/11 → 200, 43 em; request ĐỌC không tạo dòng tài khoản lớp", ct.status === 200 && ct.json.em.length === 43 && (await db.bcaNguoiDung.count()) === 3, ct.status);
  const em = ct.json.em.map((e: { hoc_sinh_id: number }) => e.hoc_sinh_id) as number[];
  const g1 = await J(chu, "PUT", `/diem-danh/${anh26}`, { hocSinhId: em[0], trangThai: "vang", xacNhan: true });
  const ndChu = await db.bcaNguoiDung.findUnique({ where: { gmail: chu.email } });
  check("chủ PUT lần đầu → 200 và có đúng một dòng bca_nguoi_dung vai chủ, tên lấy từ người dùng KiN", g1.status === 200 && ndChu?.vai_tro === "chu" && ndChu.ten_hien_thi === chu.name, [g1.status, g1.json, ndChu]);
  const dd = await db.bcaDiemDanh.findUnique({ where: { buoi_id_hoc_sinh_id: { buoi_id: anh26, hoc_sinh_id: em[0] } } });
  const nk = await db.bcaNhatKy.findFirst({ where: { doi_tuong: "diem_danh", doi_tuong_id: `${anh26}:${em[0]}` }, orderBy: { id: "desc" } });
  check("bản ghi điểm danh: vang, ghi_boi = id dòng đó; nhật ký: đúng người, vai chu", dd?.trang_thai === "vang" && dd.ghi_boi === ndChu?.id && nk?.nguoi_dung_id === ndChu?.id && nk?.vai_tro === "chu", [dd, nk]);
  await J(chu, "PUT", `/diem-danh/${anh26}`, { hocSinhId: em[1], trangThai: "phep", xacNhan: true });
  check("ghi lần hai không tạo thêm dòng tài khoản", (await db.bcaNguoiDung.count()) === 4);

  section("Đánh tất cả có mặt + hoàn tác qua route");
  const tc = await J(chu, "POST", `/diem-danh/${anh26}/tat-ca`, { xacNhan: true });
  check("POST tat-ca → 200, đặt Có cho 41 em chưa điểm, buổi xong", tc.status === 200 && tc.json.ids.length === 41 && tc.json.tien_do.xong === true, tc.json?.tien_do);
  check("hoàn tác bằng `luc` của người khác (GV Anh) → 404", (await J(gvAnh, "POST", `/diem-danh/${anh26}/hoan-tac`, { luc: tc.json.luc })).status === 404);
  const ht = await J(chu, "POST", `/diem-danh/${anh26}/hoan-tac`, { luc: tc.json.luc });
  check("POST hoan-tac → 200, trả 41 em về chưa điểm; 2 em điểm tay còn nguyên", ht.status === 200 && ht.json.so_tra_lai === 41 && (await db.bcaDiemDanh.count({ where: { buoi_id: anh26 } })) === 2, ht.json);
  check("hoàn tác lần hai → 409 da_hoan_tac; thiếu luc → 400", (await J(chu, "POST", `/diem-danh/${anh26}/hoan-tac`, { luc: tc.json.luc })).json?.ma === "da_hoan_tac" && (await J(chu, "POST", `/diem-danh/${anh26}/hoan-tac`, {})).status === 400);

  section("Giáo viên: chỉ môn được phân công (api-quyen)");
  {
    const tc0 = await db.bcaNhatKy.count({ where: { hanh_dong: "tu_choi" } }), dd0 = await db.bcaDiemDanh.count(), hs1 = await hsId("HS0001");
    const st = [
      (await J(gvAnh, "GET", `/diem-danh/${toan17}`)).status,
      (await J(gvAnh, "PUT", `/diem-danh/${toan17}`, { hocSinhId: hs1, trangThai: null, xacNhan: true })).status,
      (await J(gvAnh, "POST", `/diem-danh/${toan17}/tat-ca`, { xacNhan: true })).status,
    ];
    const gvNd = await db.bcaNguoiDung.findUniqueOrThrow({ where: { gmail: GV_ANH } });
    const tuChoi = await db.bcaNhatKy.findMany({ where: { hanh_dong: "tu_choi" }, orderBy: { id: "desc" }, take: 3 });
    check("GV Anh xem / ghi / đánh tất cả buổi Toán → 403 cả ba, không ghi điểm danh", st.every((s) => s === 403) && (await db.bcaDiemDanh.count()) === dd0, st);
    check("mỗi lần bị chặn có một dòng nhật ký 'tu_choi' đứng tên GV đó (4.1)", (await db.bcaNhatKy.count({ where: { hanh_dong: "tu_choi" } })) === tc0 + 3 && tuChoi.every((x) => x.nguoi_dung_id === gvNd.id && x.vai_tro === "giao_vien"), tuChoi.map((x) => x.doi_tuong_id));
    const g = await J(gvAnh, "PUT", `/diem-danh/${anh26}`, { hocSinhId: em[2], trangThai: "co", xacNhan: true });
    check("GV Anh ghi buổi Anh → 200, ghi_boi là dòng của GV", g.status === 200 && (await db.bcaDiemDanh.findUnique({ where: { buoi_id_hoc_sinh_id: { buoi_id: anh26, hoc_sinh_id: em[2] } } }))?.ghi_boi === gvNd.id, g.json);
    const r = await J(gvAnh, "PATCH", `/buoi-hoc/${anh19}`, { noiDung: "Unit 5", linkRecord: "drive.google.com/abc" });
    check("GV Anh sửa nội dung / record buổi Anh → 200, link chuẩn hoá; buổi Toán → 403", r.status === 200 && r.json.link_record === "https://drive.google.com/abc" && (await J(gvAnh, "PATCH", `/buoi-hoc/${toan17}`, { noiDung: "x" })).status === 403, r.json);
    // Quyền TRƯỚC tham số: thân sai / id sai vẫn 403, không 400.
    const chiChu = await Promise.all([
      J(gvAnh, "DELETE", "/buoi-hoc/0x2"), J(gvAnh, "POST", `/buoi-hoc/${anh1210}/huy`, {}), J(gvAnh, "POST", "/buoi-hoc/0x2/bo-huy"), J(gvAnh, "POST", `/buoi-hoc/${anh1210}/hoan-tac-xoa`, {}),
      J(gvAnh, "POST", "/buoi-hoc/hoc-bu", { mon: "anh", ngay: "2026-02-30" }), J(gvAnh, "GET", "/buoi-hoc/con-thieu?thang=2026-13"), J(gvAnh, "POST", "/buoi-hoc/con-thieu", { thang: "x" }),
    ]);
    check("GV gọi 7 thao tác chỉ-chủ (kể cả thân / id sai) → đều 403; buổi Anh 10/12 còn nguyên", chiChu.every((x) => x.status === 403) && (await db.bcaBuoiHoc.findUnique({ where: { id: anh1210 } }))?.trang_thai === "binh_thuong", chiChu.map((x) => x.status));
  }

  section("Chủ lớp: đầu vào và xoá buổi qua route");
  check("id buổi '0x2' → 400 (GET điểm danh, PATCH, DELETE)", (await J(chu, "GET", "/diem-danh/0x2")).status === 400 && (await J(chu, "PATCH", "/buoi-hoc/0x2", { noiDung: "x" })).status === 400 && (await J(chu, "DELETE", "/buoi-hoc/0x2")).status === 400);
  const sua0 = await db.bcaNhatKy.count({ where: { hanh_dong: "sua_noi_dung_buoi" } });
  check("PATCH không có trường hợp lệ ({} / {foo}) → 400, không ghi nhật ký; thân không phải JSON → 400", (await J(chu, "PATCH", `/buoi-hoc/${anh1210}`, {})).status === 400 && (await J(chu, "PATCH", `/buoi-hoc/${anh1210}`, { foo: 1 })).status === 400
    && (await api("PATCH", `/api/lop/buoi-hoc/${anh1210}`, { as: chu, raw: "không phải json", headers: { "content-type": "application/json" } })).status === 400 && (await db.bcaNhatKy.count({ where: { hanh_dong: "sua_noi_dung_buoi" } })) === sua0);
  check("PUT điểm danh: hocSinhId thiếu → 400; trạng thái lạ → 400; em không có tên trong buổi → 409 khong_trong_buoi", (await J(chu, "PUT", `/diem-danh/${anh26}`, { trangThai: "co" })).status === 400 && (await J(chu, "PUT", `/diem-danh/${anh26}`, { hocSinhId: em[3], trangThai: "muon", xacNhan: true })).status === 400
    && (await J(chu, "PUT", `/diem-danh/${anh26}`, { hocSinhId: await hsId("HS0001"), trangThai: "co", xacNhan: true })).json?.ma === "khong_trong_buoi");
  check("con-thieu: tháng sai → 400; tháng 01/2030 → 200", (await J(chu, "GET", "/buoi-hoc/con-thieu?thang=2026-13")).status === 400 && (await J(chu, "GET", "/buoi-hoc/con-thieu?thang=2030-01")).status === 200);
  check("huỷ buổi đã có điểm danh không xác nhận → 409 can_xac_nhan; thiếu lý do → 400", (await J(chu, "POST", `/buoi-hoc/${toan17}/huy`, { lyDo: "GV ốm" })).json?.ma === "can_xac_nhan" && (await J(chu, "POST", `/buoi-hoc/${toan17}/huy`, {})).status === 400);
  const b = await db.bcaBuoiHoc.create({ data: { mon_id: 4, ngay: s2d("2030-01-07"), bat_dau_luc: lucVN("2030-01-07", "22:15"), so_phut: 90 } });
  const x = await J(chu, "DELETE", `/buoi-hoc/${b.id}`);
  check("DELETE buổi 2030 → 200 + nhatKyId, buổi biến mất", x.status === 200 && x.json.da_xoa === true && (await db.bcaBuoiHoc.findUnique({ where: { id: b.id } })) === null, x.json);
  const h = await J(chu, "POST", `/buoi-hoc/${b.id}/hoan-tac-xoa`, { nhatKyId: x.json.nhatKyId });
  check("POST hoan-tac-xoa → 200, buổi trở lại đúng id; lần hai → 409 da_hoan_tac", h.status === 200 && (await db.bcaBuoiHoc.findUnique({ where: { id: b.id } })) !== null && (await J(chu, "POST", `/buoi-hoc/${b.id}/hoan-tac-xoa`, { nhatKyId: x.json.nhatKyId })).json?.ma === "da_hoan_tac", h.json);
  check("xoá buổi có điểm danh → 409 co_du_lieu; buổi đã qua trống (Toán 24/11) → 409 da_qua", (await J(chu, "DELETE", `/buoi-hoc/${toan17}`)).json?.ma === "co_du_lieu" && (await J(chu, "DELETE", `/buoi-hoc/${await buoiId(1, "2026-11-24")}`)).json?.ma === "da_qua");
}

main().catch((e) => { console.error(e); check("bài chạy hết không ném lỗi", false, String(e)); })
  .finally(() => { try { napLaiBca(); console.log("\n(đã nạp lại bca_* từ bca_gia)"); } catch (e) { console.error("KHÔNG nạp lại được bca_*:", e); } return done(); });
