// KiN lớp bước 7 — khu HỌC SINH qua HTTP thật (máy chủ thử ở BASE): /api/lop/hs/{toi,buoi/[id]}, trang /student/lop-on, mục menu "Lớp ôn" của vỏ học sinh và vỏ gia sư.
// Chuyển từ test gốc của web lớp: bca/tests/khu-hoc-sinh.test.ts ("/api/hs/toi — quyền": GV → 403, không cookie → 401) + thêm của KiN: em A không đọc được dữ liệu em B,
// học sinh gọi route của chủ → 403, hồ sơ ẩn / đổi Gmail ⇒ mất quyền ngay ở request kế tiếp, mở trang lần đầu ⇒ nối userId, HTML không lộ SĐT phụ huynh / ghi chú nội bộ / mã máy.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-lop-hoc-sinh-khu-api.ts   (dev server PHẢI đang chạy; bài tự nhận cờ: bật ⇒ chạy đủ, tắt ⇒ route 404, trang không mở, menu không hiện, không nối).
// Dữ liệu: nạp lại bca_* từ `bca_gia` trước và sau (lop-db.ts); tài khoản KiN thử tạo bằng upsert — không wipe(). Giờ là giờ THẬT của máy chủ nên không so ngày cụ thể.
// Ca phá cố ý (đã chạy 27/11/2026, phá → đỏ → trả lại): routeHs bỏ `u?.vai === "hoc_sinh"` (nhận mọi người của lớp) → ca "chủ / GV → 403" đỏ; buoiCuaToi bỏ kiểm loaiVaoNgay → ca "A mở buổi của B" đỏ;
// StudentShell bỏ điều kiện `lopOn` → ca "học sinh không có hồ sơ: không có mục Lớp ôn" đỏ.
import bcrypt from "bcryptjs";
import { api, check, section, done, type TUser } from "./h";
import { GV_ANH, buoiId, db, napLaiBca } from "./lop-db";

async function tk(email: string, name: string, role: "admin" | "student", adminRole?: TUser["adminRole"]): Promise<TUser> {
  const data = { name, role, adminRole: adminRole ?? null, emailVerified: true, banned: false };
  const u = await db.user.upsert({ where: { email }, update: data, create: { ...data, email, password: await bcrypt.hash("Passw0rd!", 4), tutorVerified: adminRole === "teacher" } });
  return { id: u.id, role, adminRole, email, name };
}
const J = (as: TUser | undefined, method: string, path: string, body?: unknown) => api(method, `/api/lop${path}`, { as, body });
const trang = async (as: TUser, path: string) => (await api("GET", path, { as })).text;
const MUC_HS = 'href="/student/lop-on"', MUC_GV = 'href="/lop-cua-toi/lop-on"';
const userIdCua = async (ma: string) => (await db.bcaHocSinh.findUniqueOrThrow({ where: { ma_hs: ma }, select: { userId: true } })).userId;

async function main() {
  napLaiBca();
  const chu = await tk("chu-lop-api@kin.local", "Chủ lớp API", "admin", "admin_super");
  const gvAnh = await tk(GV_ANH, "GV Anh KiN", "admin", "teacher");
  const gvLa = await tk("gv-la-api@kin.local", "GV chưa có tài khoản lớp", "admin", "teacher");
  const hsLa = await tk("hs-lop-api@kin.local", "Học sinh", "student");
  const a = await tk("hs-a-b7@kin.local", "Em A (HS0021)", "student"), b = await tk("hs-b-b7@kin.local", "Em B (HS0024)", "student"), c = await tk("hs-c-b7@kin.local", "Em C (HS0034)", "student");
  // A, B: nối sẵn (như sau lần mở đầu). C: chỉ đặt Gmail hồ sơ trùng email tài khoản — để kiểm việc nối khi mở trang.
  await db.bcaHocSinh.update({ where: { ma_hs: "HS0021" }, data: { userId: a.id } });
  await db.bcaHocSinh.update({ where: { ma_hs: "HS0024" }, data: { userId: b.id, sdt_ph: "0987650024", ghi_chu: "GHI-CHU-NOI-BO-B7", ghi_chu_rieng: "GHI-CHU-RIENG-B7" } });
  await db.bcaHocSinh.update({ where: { ma_hs: "HS0034" }, data: { gmail: c.email, sdt_ph: "0987650034", ghi_chu_rieng: "GHI-CHU-RIENG-B7" } });
  const anh26 = await buoiId(4, "2026-11-26"), su25 = await buoiId(2, "2026-11-25");
  await db.bcaDiemDanh.updateMany({ where: { buoi_id: anh26 }, data: { ghi_chu: "GHI-CHU-DIEM-DANH-B7" } });

  if ((await J(a, "GET", "/hs/toi")).status === 404) {
    section("Cờ LOP_ON TẮT (máy chủ đang chạy không có NEXT_PUBLIC_KIN_MO_LOP_ON=1)");
    const st = [(await J(a, "GET", "/hs/toi")).status, (await J(a, "GET", `/hs/buoi/${su25}`)).status, (await J(undefined, "GET", "/hs/toi")).status];
    check("em đã nối gọi /hs/toi, /hs/buoi/<id>; khách gọi /hs/toi → đều 404", st.every((s) => s === 404), st);
    const html = await trang(a, "/student/lop-on");
    check("trang /student/lop-on không mở: không có thẻ Tối nay, không tên môn / hồ sơ", !html.includes('id="toi-nay"') && !html.includes("HS0021") && !html.includes("Môn của em"));
    check("vỏ học sinh KHÔNG có mục Lớp ôn (em đã nối); vỏ gia sư KHÔNG có mục Lớp ôn (GV của lớp)", !(await trang(a, "/student/diem")).includes(MUC_HS) && !(await trang(gvAnh, "/lop-cua-toi/lop")).includes(MUC_GV));
    await trang(c, "/student/lop-on"); await trang(c, "/student/diem");
    check("mở vỏ / trang khi cờ tắt KHÔNG nối hồ sơ (HS0034 vẫn chưa có userId)", (await userIdCua("HS0034")) === null);
    return;
  }

  section("Ai được gọi route học sinh (cờ bật)");
  for (const [ten, u, ma] of [["chưa đăng nhập", undefined, 401], ["giáo viên của lớp", gvAnh, 403], ["chủ lớp", chu, 403], ["gia sư không thuộc lớp", gvLa, 403], ["học sinh KiN không có hồ sơ lớp", hsLa, 403]] as const) {
    const st = [(await J(u, "GET", "/hs/toi")).status, (await J(u, "GET", `/hs/buoi/${su25}`)).status];
    check(`${ten}: /hs/toi và /hs/buoi/<id> → ${ma}`, st.every((s) => s === ma), st);
  }

  section("Mỗi em chỉ thấy dữ liệu của mình");
  {
    const ra = await J(a, "GET", "/hs/toi"), rb = await J(b, "GET", "/hs/toi");
    check("A → hồ sơ HS0021 (Toán + Sử); B → hồ sơ HS0024 (Sử + Địa + Anh)", ra.status === 200 && ra.json.hoc_sinh.ma_hs === "HS0021" && ra.json.mon.map((m: { ma: string }) => m.ma).join() === "toan,su" && rb.json.hoc_sinh.ma_hs === "HS0024" && rb.json.mon.map((m: { ma: string }) => m.ma).join() === "su,dia,anh", [ra.json?.hoc_sinh, rb.json?.hoc_sinh]);
    check("route không nhận id học sinh: A thêm ?hocSinhId / ?maHs của B vẫn chỉ ra hồ sơ của A", (await J(a, "GET", "/hs/toi?hocSinhId=24&maHs=HS0024&id=24")).json.hoc_sinh.ma_hs === "HS0021");
    check("JSON của B không có SĐT phụ huynh, ghi chú nội bộ, ghi chú riêng, ghi chú điểm danh, Gmail, tiền", !/0987650024|GHI-CHU|@|sdt|ghi_chu|so_du|don_gia/.test(rb.text), rb.text.slice(0, 200));
    const tc0 = await db.bcaNhatKy.count({ where: { hanh_dong: "tu_choi", vai_tro: { startsWith: "hoc_sinh:" } } });
    const xa = await J(a, "GET", `/hs/buoi/${anh26}`), xb = await J(b, "GET", `/hs/buoi/${anh26}`);
    check("buổi Anh 26/11 (lớp của B, không phải của A): A → 403, B → 200", xa.status === 403 && xb.status === 200 && xb.json.id === anh26, [xa.status, xa.json, xb.status]);
    check("…B đọc buổi của mình cũng không thấy ghi chú điểm danh", !xb.text.includes("GHI-CHU"));
    check("…lần bị chặn của A để lại nhật ký 'tu_choi' đứng tên học sinh", (await db.bcaNhatKy.count({ where: { hanh_dong: "tu_choi", vai_tro: { startsWith: "hoc_sinh:" } } })) === tc0 + 1);
    const la = [(await J(a, "GET", "/hs/buoi/99999999")).status, (await J(a, "GET", "/hs/buoi/abc")).status, (await J(a, "GET", "/hs/buoi/0x2")).status, (await J(a, "GET", "/hs/buoi/99999999999")).status];
    check("id buổi không tồn tại → 403 (không lộ có / không); id không phải số / vượt int → 400, không 500", la.join() === "403,400,400,400", la);
  }

  section("Học sinh gọi route của chủ lớp / giáo viên → 403, không ghi gì");
  {
    const dem = async () => [await db.bcaGhiDanh.count(), await db.bcaDiemDanh.count(), await db.bcaHocSinh.count({ where: { an_luc: null } })].join("/");
    const truoc = await dem();
    const st = await Promise.all(([["GET", `/diem-danh/${anh26}`], ["PUT", `/diem-danh/${anh26}`, { hocSinhId: 21, trangThai: "co" }], ["GET", "/buoi-hoc/con-thieu?thang=2026-12"], ["PATCH", "/hoc-sinh/HS0024", { ghiChu: "x" }], ["PATCH", "/hoc-sinh/HS0021", { gmail: "x@y.z" }],
      ["POST", "/gia-han", { maHs: ["HS0021"], soNgay: 14, lyDo: "tự gia hạn" }], ["POST", "/hoc-sinh/HS0021/chuyen-chinh-thuc", { mon: ["toan"] }], ["POST", "/hoc-sinh/HS0024/an", {}], ["POST", "/giao-vien", { userId: a.id, mon: ["toan"] }]] as [string, string, unknown?][])
      .map(([m, p, body]) => J(a, m, p, body).then((r) => r.status)));
    check("A gọi 9 route quản lý (điểm danh, buổi, sửa hồ sơ mình / em khác, tự gia hạn, lên chính thức, ẩn em khác, thêm giáo viên) → đều 403", st.every((s) => s === 403), st);
    check("…không dòng ghi danh / điểm danh / hồ sơ nào đổi", (await dem()) === truoc, [truoc, await dem()]);
  }

  section("Trang /student/lop-on và menu");
  {
    const html = await trang(b, "/student/lop-on");
    check("B mở trang: có thẻ Tối nay, Môn của em, tên em; có mục menu Lớp ôn", html.includes('id="toi-nay"') && html.includes("Môn của em") && html.includes("Phạm Phương Oanh") && html.includes(MUC_HS));
    check("…HTML không lộ SĐT phụ huynh, ghi chú nội bộ / riêng / điểm danh, dữ liệu em khác (HS0021, tên em A)", !/0987650024|0987 650 024|GHI-CHU|HS0021|Nguyễn Minh Linh/.test(html));
    check("…HTML không có mã máy trong chữ hiển thị (chinh_thuc, hoc_bu, binh_thuong, het_thu, dang_thu, giá trị điểm danh thô)", !/chinh_thuc|hoc_bu|binh_thuong|het_thu|dang_thu|da_nghi|theo_lich|"(co|vang|phep)"/.test(html)); // không soát "thu": vỏ KiN có sẵn chuỗi đó (trạng thái thanh bên)
    check("vỏ học sinh: em có hồ sơ thấy mục Lớp ôn ở trang khác; học sinh KiN không có hồ sơ thì KHÔNG", (await trang(a, "/student/diem")).includes(MUC_HS) && !(await trang(hsLa, "/student/diem")).includes(MUC_HS));
    const khong = await trang(hsLa, "/student/lop-on");
    check("học sinh không có hồ sơ mở thẳng trang: câu hướng dẫn, không dữ liệu lớp", khong.includes("chưa có hồ sơ lớp ôn") && !khong.includes('id="toi-nay"') && !khong.includes("Môn của em"));
    check("vỏ gia sư: giáo viên có dòng lớp còn hoạt động thấy mục Lớp ôn; gia sư không thuộc lớp thì KHÔNG", (await trang(gvAnh, "/lop-cua-toi/lop")).includes(MUC_GV) && !(await trang(gvLa, "/lop-cua-toi/lop")).includes(MUC_GV));
    await db.bcaNguoiDung.update({ where: { gmail: GV_ANH }, data: { khoa_luc: new Date() } });
    check("…giáo viên bị khoá dòng lớp ⇒ mục Lớp ôn biến mất", !(await trang(gvAnh, "/lop-cua-toi/lop")).includes(MUC_GV));
    await db.bcaNguoiDung.update({ where: { gmail: GV_ANH }, data: { khoa_luc: null } });
  }

  section("Nối hồ sơ khi mở lần đầu; mất quyền ngay khi hồ sơ ẩn / chủ đổi Gmail");
  {
    check("C chưa nối: /hs/toi → 403 (API không tự nối)", (await J(c, "GET", "/hs/toi")).status === 403 && (await userIdCua("HS0034")) === null);
    const html = await trang(c, "/student/lop-on");
    const nk = await db.bcaNhatKy.count({ where: { hanh_dong: "noi_tai_khoan_kin", doi_tuong_id: "HS0034" } });
    check("C mở /student/lop-on lần đầu (email đã xác minh, khớp đúng một hồ sơ) ⇒ ghi userId + 1 dòng nhật ký, thấy lớp của mình", (await userIdCua("HS0034")) === c.id && nk === 1 && html.includes("Phạm Phương Linh") && !/0987650034|GHI-CHU/.test(html), nk);
    check("…sau đó /hs/toi của C → 200 đúng hồ sơ HS0034", (await J(c, "GET", "/hs/toi")).json?.hoc_sinh?.ma_hs === "HS0034");
    const users = await db.user.findUniqueOrThrow({ where: { id: c.id }, select: { email: true, role: true, emailVerified: true } });
    check("…bảng users của C không đổi", users.email === c.email && users.role === "student" && users.emailVerified);

    await db.bcaHocSinh.update({ where: { ma_hs: "HS0021" }, data: { an_luc: new Date() } });
    check("hồ sơ A bị ẩn (T41) ⇒ request kế tiếp của A 403, menu mất", (await J(a, "GET", "/hs/toi")).status === 403 && !(await trang(a, "/student/diem")).includes(MUC_HS));
    await db.bcaHocSinh.update({ where: { ma_hs: "HS0021" }, data: { an_luc: null } });
    const doi = await J(chu, "PATCH", "/hoc-sinh/HS0024", { hoSo: { gmail: "moi-b7@kin.local" } });
    check("chủ đổi Gmail hồ sơ B qua route ⇒ gỡ userId, request kế tiếp của B 403", doi.status === 200 && (await userIdCua("HS0024")) === null && (await J(b, "GET", "/hs/toi")).status === 403, [doi.status, doi.json]);
    check("…A (không liên quan) vẫn vào bình thường", (await J(a, "GET", "/hs/toi")).status === 200);
  }
}

main().catch((e) => { console.error(e); check("bài chạy hết không ném lỗi", false, String(e)); })
  .finally(() => { try { napLaiBca(); console.log("\n(đã nạp lại bca_* từ bca_gia)"); } catch (e) { console.error("KHÔNG nạp lại được bca_*:", e); } return done(); });
