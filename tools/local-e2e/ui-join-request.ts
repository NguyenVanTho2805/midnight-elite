// BU-01 — vào lớp theo duyệt, trên trình duyệt thật (1280 + 390, có chụp ảnh).
// Luồng: khách bấm "Xin vào lớp" → sang đăng nhập; học sinh bấm → màn nhập mã với mã RIÊNG → "Gửi yêu cầu" → màn chờ duyệt (có Huỷ);
// gia sư mở tab Học sinh thấy "Chờ duyệt · n" → Duyệt bằng biểu mẫu 303 về đúng tab + thông báo; em F5 thấy lớp, thẻ "Đang chờ duyệt" biến mất.
// Từ chối kèm lời nhắn → em thấy lời nhắn; lớp miễn phí + "Vào ngay" → vào thẳng; wizard đúng thứ tự bước, "Miễn phí" ẩn mục học phí, "Vào ngay" khoá khi có học phí.
// 390px: không tràn ngang, nút >= 44px. Ba trạng thái: rỗng / lỗi giả lập 500 / đang tải. Cần Postgres + Next dev (xem README). Phần thuần: t-join-request-lib.ts.
import { BASE, mkUser, mkTutor, mkCourse, api, wipe, check, eventually, section, done } from "./h";
import { launch, ctxFor, shot, closeAll, type Page } from "./ui";
import { prisma } from "@/lib/prisma";

const FREE_TAG = "Miễn phí";

// Cỡ nút trên điện thoại: mọi button / summary / link-dạng-nút đang hiện phải cao >= 44px (ô chọn tick và radio không tính: nhãn bao ngoài mới là vùng bấm).
async function mobileReport(page: Page) {
  // Chuỗi mã (không phải hàm): tsx/esbuild chèn __name() vào hàm có tên, trình duyệt không có hàm đó.
  // Ẩn lớp phủ dev của Next / công cụ chú thích: nút của chúng không phải nút của trang. Nút × của KinToast dùng chung (có sẵn, không thuộc BU-01) cũng loại.
  await page.addStyleTag({ content: "nextjs-portal, [data-nextjs-toast], [data-agentation-root] { display: none !important; }" });
  return page.evaluate(`(() => {
    var vis = function (e) { var r = e.getBoundingClientRect(); var st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none"; };
    var small = Array.prototype.slice.call(document.querySelectorAll('button, summary, a[class*="kin-cham-toi-thieu"]'))
      .filter(function (e) { return vis(e) && !e.closest('[data-kin-toast],nextjs-portal,[data-nextjs-toast],[data-agentation-root]') && !/ sao$/.test(e.getAttribute('aria-label') || '') && !e.disabled && e.getBoundingClientRect().height < 43.5; })
      .map(function (e) { return e.tagName + ":" + (e.textContent || "").trim().slice(0, 30) + ":" + Math.round(e.getBoundingClientRect().height); });
    return { overflow: document.documentElement.scrollWidth > window.innerWidth + 1, small: small };
  })()`) as Promise<{ overflow: boolean; small: string[] }>;
}

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan");
  const S1 = await mkUser({ name: "Em Mai" });
  const S2 = await mkUser({ name: "Em Nam" });
  const S3 = await mkUser({ name: "Em Hoa" });
  const EMPTY = await mkUser({ name: "Em Moi" });
  const APPLICANT = await mkUser({ name: "Nguoi Nop Don" });
  await prisma.user.update({ where: { id: APPLICANT.id }, data: { tutorAppliedAt: new Date() } });

  const A = await mkCourse(T.id, { name: "Toán 9 Cô duyệt" });
  await prisma.course.update({ where: { id: A.id }, data: { joinPolicy: "approve" } });
  const B = await mkCourse(T.id, { name: "Tin học miễn phí" });
  await prisma.course.update({ where: { id: B.id }, data: { joinPolicy: "open", tag: FREE_TAG } });
  const C = await mkCourse(T.id, { name: "Văn chỉ mã" });          // joinPolicy null = chỉ mã mời

  await launch();
  const errors: string[] = [];
  // 'Encountered a script tag': <script> chủ đề trong src/app/layout.tsx:81 (có sẵn trên main, không thuộc BU-01) — nợ riêng, lọc có chủ đích.
  const watch = (p: Page) => { p.on("pageerror", e => errors.push(String(e))); p.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon|Encountered a script tag/i.test(m.text())) errors.push(m.text()); }); };

  // ───────── Khách
  section("Khách bấm Xin vào lớp → sang đăng nhập có redirect");
  const guest = await (await ctxFor(null)).newPage(); watch(guest);
  await guest.goto(`${BASE}/khoa-hoc/${A.id}`, { waitUntil: "networkidle", timeout: 120000 });
  const xin = guest.getByRole("button", { name: "Xin vào lớp" });
  await xin.waitFor({ timeout: 60000 });
  check("lớp Cô duyệt: có nút 'Xin vào lớp' và chữ 'Gia sư duyệt trước'", await xin.isVisible() && await guest.getByText("Gia sư duyệt trước khi vào lớp").isVisible());
  await shot(guest, "bu01-khach-xin-vao-lop-1280");
  await Promise.all([guest.waitForURL(/\/dang-nhap/, { timeout: 60000 }), xin.click()]);
  check("sang trang đăng nhập, redirect trỏ về đúng trang lớp", decodeURIComponent(guest.url()).includes(`/khoa-hoc/${A.id}`), guest.url());
  check("không tạo yêu cầu / mã cá nhân nào cho khách", (await prisma.classJoinRequest.count()) === 0 && (await prisma.classInvite.count({ where: { kind: "personal" } })) === 0);

  section("Lớp 'chỉ mã mời' không có nút xin; hiện lối nhập mã");
  await guest.goto(`${BASE}/khoa-hoc/${C.id}`, { waitUntil: "networkidle" });
  check("không có nút Xin vào lớp / Vào lớp miễn phí; có link Nhập mã lớp", (await guest.getByRole("button", { name: /Xin vào lớp|Vào lớp miễn phí/ }).count()) === 0 && await guest.getByRole("link", { name: "Nhập mã lớp" }).isVisible());

  // ───────── Học sinh xin vào lớp
  section("Học sinh bấm Xin vào lớp → màn nhập mã với mã riêng → Gửi yêu cầu → chờ duyệt");
  const sCtx = await ctxFor(S1);
  const sp = await sCtx.newPage(); watch(sp);
  await sp.goto(`${BASE}/khoa-hoc/${A.id}`, { waitUntil: "networkidle", timeout: 120000 });
  await Promise.all([sp.waitForURL(/\/student\/nhap-ma-lop\?code=/, { timeout: 60000 }), sp.getByRole("button", { name: "Xin vào lớp" }).click()]);
  const send = sp.getByRole("button", { name: "Gửi yêu cầu vào lớp" });
  await send.waitFor({ timeout: 60000 });
  check("đã có đúng 1 mã cá nhân gắn em Mai (chưa có yêu cầu nào)", (await prisma.classInvite.count({ where: { courseId: A.id, kind: "personal", boundUserId: S1.id } })) === 1 && (await prisma.classJoinRequest.count()) === 0);
  check("thẻ xem trước ghi 'Bạn sắp xin vào lớp'", await sp.getByText("Bạn sắp xin vào lớp").isVisible());
  await send.click();
  await sp.getByText("Đã gửi yêu cầu — chờ gia sư duyệt").waitFor({ timeout: 60000 });
  check("màn chờ duyệt: có 'Huỷ yêu cầu', dòng 'chưa xem được nội dung lớp', mã riêng", await sp.getByRole("button", { name: "Huỷ yêu cầu" }).isVisible()
    && await sp.getByText(/chưa xem được nội dung lớp/).isVisible() && await sp.getByText("Mã này chỉ dùng được ở tài khoản của bạn.").isVisible());
  const personal = await prisma.classInvite.findFirst({ where: { courseId: A.id, boundUserId: S1.id } });
  await eventually("mã riêng trên màn hình đúng mã trong DB", async () => (await sp.locator("[data-personal-code]").innerText()).trim() === personal?.code);
  check("DB: yêu cầu pending, chưa có Enrollment", (await prisma.classJoinRequest.count({ where: { courseId: A.id, userId: S1.id, status: "pending" } })) === 1 && (await prisma.enrollment.count({ where: { courseId: A.id, userId: S1.id } })) === 0);
  await shot(sp, "bu01-hs-cho-duyet-1280");

  section("Lớp của tôi: khối Đang chờ duyệt");
  await sp.goto(`${BASE}/student/hoc-tap`, { waitUntil: "networkidle" });
  await sp.locator("[data-pending-join]").waitFor({ timeout: 60000 });
  check("hiện tên lớp + 'Chờ gia sư duyệt' + 'Huỷ yêu cầu'", await sp.locator("[data-pending-join]").innerText().then(t => t.includes("Toán 9 Cô duyệt") && t.includes("Chờ gia sư duyệt") && t.includes("Huỷ yêu cầu")));

  // ───────── Gia sư duyệt
  section("Gia sư duyệt bằng biểu mẫu → 303 về đúng tab + thông báo");
  const tCtx = await ctxFor(T);
  const tp = await tCtx.newPage(); watch(tp);
  await tp.goto(`${BASE}/lop-cua-toi/quan-lop/${A.id}/hoc-vien?muc=xin-vao`, { waitUntil: "networkidle", timeout: 120000 }); // GS-LOP-GON: hàng chờ duyệt là mục 'Xin vào lớp' của tab Học sinh
  await tp.getByRole("heading", { name: "Chờ duyệt · 1" }).waitFor({ timeout: 60000 });
  check("thấy 'Chờ duyệt · 1', tên Em Mai, nhãn mục 'Xin vào lớp (1)'", await tp.getByText("Em Mai").first().isVisible() && await tp.getByRole("navigation", { name: "Mục của Học sinh" }).getByRole("link", { name: "Xin vào lớp (1)" }).isVisible());
  await shot(tp, "bu01-gs-cho-duyet-1280");
  await Promise.all([tp.waitForURL(/duyet=ok/, { timeout: 60000 }), tp.getByRole("button", { name: "Duyệt Em Mai", exact: true }).click()]);
  check("303 về đúng lớp + tab Học sinh, mục Xin vào lớp + duyet=ok", tp.url().includes(`/lop-cua-toi/quan-lop/${A.id}/hoc-vien`) && tp.url().includes("muc=xin-vao"), tp.url());
  await tp.getByText("Đã duyệt, bạn ấy đã vào lớp.").waitFor({ timeout: 60000 });
  check("thông báo hiện, tab Học sinh đang mở, em Mai nay nằm trong danh sách lớp (nhãn 'Học sinh' sáng, nút danh bạ 1 em)", (await tp.getByRole("navigation", { name: /^Trang của/ }).locator("[aria-current=page]").innerText()).trim() === "Học sinh" && await tp.getByRole("navigation", { name: "Mục của Học sinh" }).getByRole("link", { name: "Danh bạ" }).isVisible());
  await shot(tp, "bu01-gs-da-duyet-1280");
  check("DB: Enrollment active + yêu cầu approved", (await prisma.enrollment.count({ where: { courseId: A.id, userId: S1.id, status: "active" } })) === 1
    && (await prisma.classJoinRequest.count({ where: { courseId: A.id, userId: S1.id, status: "approved" } })) === 1);

  section("Học sinh F5 thấy lớp; thẻ Đang chờ duyệt biến mất");
  await sp.goto(`${BASE}/student/hoc-tap?course=${A.id}`, { waitUntil: "networkidle" });
  await sp.getByRole("heading", { name: "Lớp của tôi" }).waitFor({ timeout: 60000 });
  await eventually("thấy tên lớp, không còn khối Đang chờ duyệt", async () => (await sp.getByText(/Toán 9 Cô duyệt/).count()) > 0 && (await sp.locator("[data-pending-join]").count()) === 0);

  // ───────── Từ chối kèm lời nhắn
  section("Từ chối kèm lời nhắn → em thấy lời nhắn, chưa gửi lại được ngay");
  const s2 = await (await ctxFor(S2)).newPage(); watch(s2);
  const seed = await api("POST", `/api/courses/${A.id}/join`, { as: S2 });
  check("POST /join (học sinh) → 303 sang nhap-ma-lop?code=", seed.status === 303 && (seed.headers.get("location") ?? "").includes("/student/nhap-ma-lop?code="), seed.headers.get("location"));
  const code2 = new URL(seed.headers.get("location") ?? "", BASE).searchParams.get("code") ?? "";
  await s2.goto(`${BASE}/student/nhap-ma-lop?code=${code2}`, { waitUntil: "networkidle", timeout: 120000 });
  await s2.getByRole("button", { name: "Gửi yêu cầu vào lớp" }).click();
  await s2.getByText("Đã gửi yêu cầu — chờ gia sư duyệt").waitFor({ timeout: 60000 });
  await tp.goto(`${BASE}/lop-cua-toi/quan-lop/${A.id}/hoc-vien?muc=xin-vao`, { waitUntil: "networkidle" });
  await tp.locator("summary", { hasText: "Từ chối" }).first().click();
  await tp.getByLabel(/Lời nhắn cho bạn/).first().fill("Cô chưa xếp được chỗ, em thử lại tuần sau nhé.");
  await Promise.all([tp.waitForURL(/duyet=tuchoi/, { timeout: 60000 }), tp.getByRole("button", { name: "Xác nhận từ chối" }).first().click()]);
  await tp.getByText("Đã từ chối.").waitFor({ timeout: 60000 });
  check("gia sư thấy 'Đã từ chối.' ở đúng tab (Học sinh, mục Xin vào lớp)", tp.url().includes("/hoc-vien") && tp.url().includes("muc=xin-vao"));
  await s2.goto(`${BASE}/student/nhap-ma-lop?code=${code2}`, { waitUntil: "networkidle" });
  await s2.locator("[data-join-rejected]").waitFor({ timeout: 60000 });
  const rej = await s2.locator("[data-join-rejected]").innerText();
  check("em thấy 'Gia sư chưa duyệt yêu cầu', lời nhắn, và 'Có thể gửi lại sau'", rej.includes("Gia sư chưa duyệt yêu cầu") && rej.includes("em thử lại tuần sau") && rej.includes("Có thể gửi lại sau"), rej);
  check("nút gửi lại đang khoá (trong 24 giờ)", await s2.getByRole("button", { name: "Gửi lại yêu cầu" }).isDisabled());
  await shot(s2, "bu01-hs-bi-tu-choi-1280");

  // ───────── Lớp miễn phí + Vào ngay
  section("Lớp miễn phí + Vào ngay → 'Vào lớp miễn phí' vào thẳng");
  const sb = await (await ctxFor(S3)).newPage(); watch(sb);
  await sb.goto(`${BASE}/khoa-hoc/${B.id}`, { waitUntil: "networkidle", timeout: 120000 });
  const vao = sb.getByRole("button", { name: "Vào lớp miễn phí" });
  await vao.waitFor({ timeout: 60000 });
  check("giá hiện 'Miễn phí', không hiện '0đ'", await sb.getByText("Miễn phí", { exact: true }).first().isVisible() && (await sb.getByText(/^0đ$/).count()) === 0);
  await shot(sb, "bu01-lop-mien-phi-1280");
  await Promise.all([sb.waitForURL(/\/student\/hoc-tap/, { timeout: 60000 }), vao.click()]);
  check("có Enrollment active, không tạo yêu cầu", (await prisma.enrollment.count({ where: { courseId: B.id, userId: S3.id, status: "active" } })) === 1 && (await prisma.classJoinRequest.count({ where: { courseId: B.id } })) === 0);

  section("Xem trước mã của lớp miễn phí: không có dòng học phí");
  const inv = await api("POST", `/api/courses/${B.id}/invites`, { as: T, body: {} });
  const sFree = await (await ctxFor(EMPTY)).newPage(); watch(sFree);
  await sFree.goto(`${BASE}/student/nhap-ma-lop?code=${inv.json.code}`, { waitUntil: "networkidle", timeout: 120000 });
  await sFree.getByText("Bạn sắp vào lớp").waitFor({ timeout: 60000 });
  const prev = await sFree.locator("section[aria-label='Xem trước lớp']").innerText();
  check("ghi 'Học phí Miễn phí'; không có 'học phí tính theo tháng'", /Học phí\s*Miễn phí/.test(prev) && (await sFree.getByText(/học phí tính theo tháng/).count()) === 0, prev);

  // ───────── Wizard
  section("Wizard tạo lớp: đúng thứ tự bước; Miễn phí ẩn mục học phí; Vào ngay khoá khi có học phí");
  const wz = await (await ctxFor(T)).newPage(); watch(wz);
  await wz.goto(`${BASE}/lop-cua-toi/lop/tao`, { waitUntil: "networkidle", timeout: 120000 });
  await wz.getByRole("list", { name: "Các bước tạo lớp" }).waitFor({ timeout: 60000 });
  const steps = (await wz.locator("[data-wizard-step]").allInnerTexts()).map(t => t.replace(/^\d\s*/, "").replace(/\s*\(.*\)$/, "").trim());
  check("3 bước: Thông tin → Lịch học → Cách vào lớp", JSON.stringify(steps) === JSON.stringify(["Thông tin", "Lịch học", "Cách vào lớp"]), steps);
  await wz.getByLabel(/Tên lớp/).fill("Lớp thử wizard");
  check("mặc định 'Có học phí': thấy mục 'Cách tính học phí'", await wz.getByRole("heading", { name: "Cách tính học phí" }).isVisible());
  const donGia = wz.getByLabel(/^Đơn giá/); if (await donGia.count()) await donGia.fill("120000");
  await wz.getByRole("button", { name: "Tiếp tục" }).click();
  // TUT-lich-keo-tha: bước Lịch học bắt buộc có khung giờ.
  await wz.getByRole("button", { name: "Thêm khung giờ" }).click();
  await wz.locator("[data-block-panel] select").first().selectOption("2");
  await wz.getByRole("button", { name: "Lưu khung giờ" }).click();
  await wz.locator("[data-block-panel]").waitFor({ state: "detached", timeout: 10000 });
  await wz.getByRole("button", { name: "Tiếp tục" }).click();
  const openCard = wz.locator("[data-policy='open'] input");
  check("bước 3, có học phí: thẻ 'Vào ngay' bị khoá; 'Cô duyệt' chọn sẵn", await openCard.isDisabled() && await wz.locator("[data-policy='approve'] input").isChecked());
  await wz.getByRole("button", { name: "Quay lại" }).click();
  await wz.getByRole("button", { name: "Quay lại" }).click();
  await wz.getByLabel("Miễn phí", { exact: false }).first().check();
  check("chọn Miễn phí: mục 'Cách tính học phí' biến mất", (await wz.getByRole("heading", { name: "Cách tính học phí" }).count()) === 0);
  await wz.getByRole("button", { name: "Tiếp tục" }).click();
  await wz.getByRole("button", { name: "Tiếp tục" }).click();
  check("miễn phí: 'Vào ngay' mở; mục gập 'Thêm sẵn em đã học lớp khác' còn đó", !(await openCard.isDisabled()) && await wz.locator("[data-wizard-students]").isVisible());
  await openCard.check();
  await shot(wz, "bu01-wizard-buoc3-1280");
  await Promise.all([wz.waitForURL(/\/lop-cua-toi\/quan-lop\/[^/]+\/hoc-vien\?.*moi=1/, { timeout: 90000 }), wz.getByRole("button", { name: /^Tạo lớp/ }).click()]);
  const made = await prisma.course.findFirst({ where: { name: "Lớp thử wizard" } });
  check("DB: joinPolicy open, tag 'Miễn phí', không có đơn giá học phí", made?.joinPolicy === "open" && made?.tag === FREE_TAG && (await prisma.courseFeeRate.count({ where: { courseId: made?.id } })) === 0, { j: made?.joinPolicy, t: made?.tag });

  // ───────── Gia sư chờ duyệt không vào được
  section("Người nộp đơn gia sư (vẫn là học sinh) không mở được trang lớp / không gửi được yêu cầu");
  const ap = await (await ctxFor(APPLICANT)).newPage(); watch(ap);
  const respAp = await ap.goto(`${BASE}/lop-cua-toi/${A.id}?tab=hoc-sinh`, { waitUntil: "domcontentloaded", timeout: 120000 });
  check("không thấy khối Chờ duyệt / tên học sinh", (await ap.getByText(/Chờ duyệt ·/).count()) === 0 && (await ap.getByText("Em Nam").count()) === 0, respAp?.status());
  const apJoin = await api("POST", `/api/courses/${A.id}/join`, { as: APPLICANT });
  check("POST /join của người nộp đơn → 403, không tạo yêu cầu", apJoin.status === 403 && (await prisma.classJoinRequest.count({ where: { userId: APPLICANT.id } })) === 0, apJoin.status);

  // ───────── Ba trạng thái
  section("Trạng thái rỗng / lỗi giả lập / đang tải");
  const emptyCtx = await ctxFor(EMPTY); const ep = await emptyCtx.newPage(); watch(ep);
  await ep.goto(`${BASE}/student/hoc-tap`, { waitUntil: "networkidle", timeout: 120000 });
  await ep.getByText("Bạn chưa vào lớp nào").waitFor({ timeout: 60000 });
  check("RỖNG: không yêu cầu chờ → không có khối Đang chờ duyệt", (await ep.locator("[data-pending-join]").count()) === 0);
  await emptyCtx.route("**/api/invites/my-requests", r => void r.fulfill({ status: 500, contentType: "application/json", body: "{}" }));
  await ep.reload({ waitUntil: "networkidle" });
  await ep.getByText("Không tải được các yêu cầu vào lớp của bạn.").waitFor({ timeout: 60000 });
  check("LỖI 500: báo rõ + nút Thử lại; danh sách lớp không bị che", await ep.getByRole("button", { name: "Thử lại" }).isVisible() && await ep.getByText("Bạn chưa vào lớp nào").isVisible());
  const slowCtx = await ctxFor(EMPTY); const lp = await slowCtx.newPage(); watch(lp);
  await slowCtx.route("**/api/invites/by-code/**", async r => { await new Promise(res => setTimeout(res, 2500)); await r.continue(); });
  await lp.goto(`${BASE}/student/nhap-ma-lop?code=${inv.json.code}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  check("ĐANG TẢI: khung xương 'Đang kiểm tra mã' hiện trong lúc chờ", await lp.getByLabel("Đang kiểm tra mã").waitFor({ timeout: 20000 }).then(() => true, () => false));

  // ───────── 390px
  section("390px: không tràn ngang, nút >= 44px");
  const m = async (u: Parameters<typeof ctxFor>[0], path: string, name: string, ready: (p: Page) => Promise<unknown>) => {
    const c = await ctxFor(u, { width: 390, height: 844 }); const p = await c.newPage(); watch(p);
    await p.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
    await ready(p);
    const r = await mobileReport(p);
    check(`${name}: không tràn ngang`, !r.overflow);
    check(`${name}: nút >= 44px`, r.small.length === 0, r.small);
    await shot(p, `bu01-${name}-390`);
    await c.close();
  };
  // Dữ liệu cho màn 390: một em đang chờ ở lớp A để có hàng chờ + màn chờ duyệt
  const seed3 = await api("POST", `/api/courses/${A.id}/join`, { as: S3 });
  const code3 = new URL(seed3.headers.get("location") ?? "", BASE).searchParams.get("code") ?? "";
  const c3 = await ctxFor(S3, { width: 390, height: 844 }); const p3 = await c3.newPage(); watch(p3);
  await p3.goto(`${BASE}/student/nhap-ma-lop?code=${code3}`, { waitUntil: "networkidle", timeout: 120000 });
  await p3.getByRole("button", { name: "Gửi yêu cầu vào lớp" }).click();
  await p3.getByText("Đã gửi yêu cầu — chờ gia sư duyệt").waitFor({ timeout: 60000 });
  const r3 = await mobileReport(p3);
  check("hs-cho-duyet: không tràn ngang, nút >= 44px", !r3.overflow && r3.small.length === 0, r3);
  await shot(p3, "bu01-hs-cho-duyet-390");
  await c3.close();
  await m(T, `/lop-cua-toi/quan-lop/${A.id}/hoc-vien?muc=xin-vao`, "gs-cho-duyet", p => p.getByRole("heading", { name: "Chờ duyệt · 1" }).waitFor({ timeout: 60000 }));
  await m(T, `/lop-cua-toi/${A.id}?tab=ma-moi`, "gs-cach-vao-lop", p => p.locator("[data-join-policy-box]").waitFor({ timeout: 60000 }));
  await m(T, "/lop-cua-toi/lop/tao", "wizard", p => p.getByLabel(/Tên lớp/).waitFor({ timeout: 60000 }));
  await m(S2, `/student/nhap-ma-lop?code=${code2}`, "hs-bi-tu-choi", p => p.locator("[data-join-rejected]").waitFor({ timeout: 60000 }));
  await m(null, `/khoa-hoc/${A.id}`, "khach-lop-cong-khai", p => p.getByRole("button", { name: "Xin vào lớp" }).waitFor({ timeout: 60000 }));

  check("không có lỗi trình duyệt (pageerror / console.error)", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})().catch(e => { console.error(e); process.exit(1); });
