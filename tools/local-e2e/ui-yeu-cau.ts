// KH-04 / PH-07 bằng trình duyệt thật: khách gửi "Yêu cầu tìm gia sư" từ hồ sơ gia sư (hộp đồng ý không tích sẵn, chống gửi quá nhanh), trang theo dõi + rút,
// gia sư xem / tiếp nhận (đồng ý của khách được sao sang) / từ chối, 390px, gia sư ẩn hồ sơ thì khách không gửi được.
// Chạy (máy chủ dev bật): source tools/local-e2e/env.sh && npx tsx tools/local-e2e/ui-yeu-cau.ts
import { BASE, mkCourse, mkTutor, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), H = await mkTutor("Cô Ẩn");
  await prisma.user.update({ where: { id: T.id }, data: { tutorVerified: true, preferences: { modules: ["hop-viec", "lop", "bai-kt", "thu-vien"] } } });
  await prisma.user.update({ where: { id: H.id }, data: { tutorVerified: true, preferences: { profile: { hidden: true } } } });
  await mkCourse(T.id, { name: "Toán 9" });
  const errors: string[] = [];
  const watch = (p: any) => { p.on("pageerror", (e: unknown) => errors.push(String(e))); p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|net::ERR|status of [45]/i.test(m.text())) errors.push(m.text()); }); };
  await launch();
  const guestCtx = await ctxFor(null, { width: 1280, height: 900 });
  await guestCtx.setExtraHTTPHeaders({ "x-forwarded-proto": "http", "x-forwarded-for": `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` }); // IP giả mới mỗi lần chạy: hạn 5 yêu cầu/giờ/IP nằm trong bộ nhớ máy chủ // /mentor/[id] tự gọi lại API của chính nó theo https nếu thiếu header này
  const g = await guestCtx.newPage(); watch(g);

  section("Khách: từ hồ sơ gia sư tới biểu mẫu");
  await g.goto(`${BASE}/mentor/${T.id}`, { waitUntil: "networkidle", timeout: 120000 });
  const lnk = g.getByRole("link", { name: "Gửi yêu cầu tìm gia sư" });
  await lnk.waitFor({ timeout: 90000 });
  check("hồ sơ có nút phụ 'Gửi yêu cầu tìm gia sư' → /mentor/<id>/yeu-cau (nút chính 'Đăng ký học' giữ nguyên)", await lnk.getAttribute("href") === `/mentor/${T.id}/yeu-cau` && await g.getByRole("link", { name: /Đăng ký học với/ }).isVisible());
  await lnk.click();
  await g.getByRole("heading", { name: "Gửi yêu cầu cho Cô Lan", level: 1 }).waitFor({ timeout: 90000 });
  const submit = g.locator("[data-request-submit]");
  const accept = g.locator("[data-request-accept]");
  check("hộp đồng ý KHÔNG tích sẵn; chưa chọn vai nên chưa có nội dung đồng ý; nút Gửi khoá", !(await accept.isChecked()) && await submit.isDisabled() && /Chọn anh\/chị là phụ huynh/.test(await g.locator("[data-request-consent]").innerText()));
  check("form nói rõ KHÔNG cần tên / ngày sinh / trường của con; không có ô nhập tên con", await g.getByText(/Không cần tên, ngày sinh hay trường của con/).isVisible() && await g.getByLabel(/tên (em|con|bé)/i).count() === 0 && await g.getByLabel(/ngày sinh/i).count() === 0);
  check("ô bẫy 'website' có trong DOM nhưng người thật không thấy và không tab tới được", await g.locator("input[name=website]").count() === 1 && ((await g.locator("input[name=website]").boundingBox())?.x ?? 0) < -1000 && await g.locator("input[name=website]").getAttribute("tabindex") === "-1" && await g.locator("input[name=website]").evaluate(e => !!e.closest("[aria-hidden=true]")));
  await g.getByLabel("Phụ huynh / người giám hộ").check();
  check("chọn vai → hiện chữ đồng ý đúng vai, nêu 'KiN không kiểm tra', 'không phải KiN đã xác minh', 'rút lại'", /Tôi là phụ huynh \/ người giám hộ/.test(await g.locator("[data-request-consent]").innerText()) && /KiN không kiểm tra/.test(await g.locator("[data-request-consent]").innerText()) && /rút lại/.test(await g.locator("[data-request-consent]").innerText()));
  await g.getByLabel("Người học (đủ 16 tuổi)").check();
  check("đổi sang người học → chữ đồng ý đổi theo ('đã đủ 16 tuổi')", /đã đủ 16 tuổi/.test(await g.locator("[data-request-consent]").innerText()));
  await g.getByLabel("Phụ huynh / người giám hộ").check();
  check("vẫn chưa tích → khoá", await submit.isDisabled());
  await g.getByLabel("Cấp học", { exact: true }).selectOption("thcs");
  await g.getByLabel(/Hình thức học/).selectOption("online");
  await g.getByLabel("Khung giờ có thể học").fill("tối thứ 3, 5");
  await g.getByLabel("Tên anh/chị (không bắt buộc)").fill("Chị Hoa");
  await g.getByLabel(/Số Zalo/).fill("0912345678");
  await accept.check();
  await g.getByRole("button", { name: "Gửi yêu cầu" }).click().catch(() => {});
  check("gửi NGAY (chưa tới 3 giây từ lúc mở trang) / thiếu môn → không lưu", await prisma.tutorRequest.count() === 0);
  await g.getByText(/Nhập môn cần học|Bạn gửi nhanh quá/).first().waitFor({ timeout: 15000 });
  check("báo lỗi ngay cạnh ô thiếu (môn) hoặc nhắc gửi nhanh quá, chưa lưu gì", true);
  await g.getByLabel(/Môn cần học/).fill("Toán 9");
  await g.waitForTimeout(3200);
  await submit.click();
  await g.locator("[data-sent]").waitFor({ timeout: 30000 });
  const req = await prisma.tutorRequest.findFirst({ where: { targetTutorId: T.id } });
  check("gửi xong: đã lưu, đúng gia sư, đúng thông tin; dòng đồng ý 'guest_form' bên guardian", !!req && req.contactPhone === "0912345678" && req.subject === "Toán 9" && req.slots === "tối thứ 3, 5" && (await prisma.consentRecord.count({ where: { subjectId: req.id, method: "guest_form", party: "guardian" } })) === 1);
  const trackLink = await g.locator("[data-track-link]").innerText();
  check("hiện link theo dõi (cùng gốc trang) + nút 'Chép link theo dõi' + lời nói rõ KiN chưa biết gia sư có nhận", trackLink.endsWith(`/yeu-cau/${req!.trackToken}`) && await g.getByRole("button", { name: /Chép link theo dõi/ }).isVisible() && await g.getByText(/KiN chưa biết gia sư có nhận hay không/).isVisible());
  await shot(g, "yeu-cau-da-gui");

  section("Khách: trang theo dõi (PH-07) và rút yêu cầu");
  await g.getByRole("link", { name: "Mở trang theo dõi" }).click();
  await g.locator("[data-track-status]").waitFor({ timeout: 90000 });
  const body = await g.locator("body").innerText();
  check("trạng thái 'Đang chờ gia sư xem' (có chữ), tóm tắt đúng, tên gia sư là liên kết tới hồ sơ", /Đang chờ gia sư xem/.test(await g.locator("[data-track-status]").innerText()) && body.includes("THCS") && body.includes("Toán 9") && body.includes("tối thứ 3, 5") && await g.getByRole("link", { name: "Cô Lan" }).first().getAttribute("href") === `/mentor/${T.id}`);
  check("trang KHÔNG hiện số điện thoại / tên liên hệ của khách", !body.includes("0912345678") && !body.includes("Chị Hoa"));
  check("nói rõ không chuyển khoản trước buổi học thử, KiN không thu phí kết nối", /Không chuyển khoản trước buổi học thử/.test(body) && /không thu phí kết nối/.test(body));
  await g.reload({ waitUntil: "networkidle" });
  await g.locator("[data-withdraw]").click();
  await g.getByRole("dialog").getByRole("button", { name: "Rút yêu cầu" }).click();
  await g.getByText("Đã rút yêu cầu và xoá số liên hệ.").waitFor({ timeout: 30000 });
  await g.locator("[data-track-status]").getByText("Yêu cầu đã đóng").waitFor({ timeout: 30000 }); // đợi tải lại sau khi rút
  const afterW = await prisma.tutorRequest.findUnique({ where: { id: req!.id } });
  check("rút → closed, số liên hệ xoá sạch khỏi DB; nút Rút biến mất; trang nói 'Yêu cầu đã đóng'", afterW?.status === "closed" && afterW.contactPhone === "" && await g.locator("[data-withdraw]").count() === 0 && await g.locator("[data-track-status]").getByText("Yêu cầu đã đóng").isVisible());
  await g.goto(`${BASE}/yeu-cau/${"0".repeat(32)}`, { waitUntil: "networkidle", timeout: 120000 });
  check("mã sai: 'Không tìm thấy yêu cầu' kèm lối đi tiếp (xem gia sư)", await g.getByText("Không tìm thấy yêu cầu").isVisible() && await g.getByRole("link", { name: "Xem danh sách gia sư" }).isVisible());
  await g.goto(`${BASE}/mentor/${H.id}/yeu-cau`, { waitUntil: "networkidle", timeout: 120000 });
  check("gia sư đang ẨN hồ sơ: khách không gửi được — báo 'Không tìm thấy gia sư' + lối đi tiếp", await g.getByRole("heading", { name: "Không tìm thấy gia sư" }).isVisible() && await g.locator("[data-request-submit]").count() === 0);

  section("Gia sư: nhận yêu cầu mới");
  const mk = async (o: Record<string, unknown> = {}) => (await fetch(`${BASE}/api/yeu-cau`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": `10.99.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` }, body: JSON.stringify({ targetTutorId: T.id, level: "tieu-hoc", subject: "Tiếng Anh", slots: "cuối tuần", contactName: "Anh Nam", contactPhone: `09${String(20_000_000 + Math.floor(Math.random() * 9_000_000))}`, role: "guardian", consent: { accepted: true }, startedAt: Date.now() - 20_000, website: "", ...o }) })).json() as Promise<{ trackToken: string }>;
  const q1 = await mk(), q2 = await mk({ subject: "Văn 8", contactName: "Chị Mai" });
  const tp = await (await ctxFor(T, { width: 1280, height: 900 })).newPage(); watch(tp);
  await tp.goto(`${BASE}/lop-cua-toi/hoc-sinh`, { waitUntil: "networkidle", timeout: 120000 });
  const reqLink = tp.getByRole("link", { name: /^Yêu cầu tìm gia sư/ });
  await reqLink.waitFor({ timeout: 90000 });
  await tp.getByText(/Yêu cầu tìm gia sư · \d+ mới/).waitFor({ timeout: 30000 });
  check("trang Học sinh có nút 'Yêu cầu tìm gia sư · 2 mới' → /lop-cua-toi/yeu-cau", /· 2 mới/.test(await reqLink.innerText()) && await reqLink.getAttribute("href") === "/lop-cua-toi/yeu-cau");
  await reqLink.click();
  await tp.getByRole("heading", { name: "Yêu cầu tìm gia sư", level: 1 }).waitFor({ timeout: 90000 });
  await tp.locator("[data-yeu-cau]").first().waitFor({ timeout: 30000 });
  check("3 yêu cầu (1 khách đã rút + 2 mới): chỉ 2 yêu cầu MỚI còn số Zalo bấm gọi được + liên kết Mở Zalo; chưa tạo hồ sơ nào", await tp.locator("[data-yeu-cau]").count() === 3 && await tp.getByRole("link", { name: /^09\d{8}$/ }).count() === 2 && await tp.getByRole("link", { name: "Mở Zalo" }).count() === 2 && await prisma.studentProfile.count() === 0);
  const card = tp.locator("[data-yeu-cau]", { hasText: "Tiếng Anh" });
  await card.locator("[data-open-accept]").click();
  const acc = card.locator("[data-accept]");
  const go = acc.locator("[data-accept-go]");
  check("form tiếp nhận: nhập TÊN EM (biểu mẫu khách không thu tên trẻ); nút khoá khi chưa đủ", await go.isDisabled() && await acc.getByLabel(/Tên em/).isVisible());
  await acc.getByLabel(/Tên em/).fill("Bé Tiếp Nhận Giao Diện");
  await acc.getByLabel("Từ 7 đến 15 tuổi").check();
  check("em 7-15 tuổi: hộp đồng ý CHỈ còn bên 'Em' (phụ huynh đã bấm ở biểu mẫu), không tích sẵn", await acc.locator("[data-consent-party]").count() === 1 && await acc.locator("[data-consent-party=child]").count() === 1 && await go.isDisabled());
  await acc.locator("[data-consent-party=child]").check();
  check("tích xong → mở khoá", await go.isEnabled());
  await acc.getByLabel("Lớp", { exact: true }).selectOption({ label: "Toán 9" });
  await go.click();
  await tp.getByText("Đã tiếp nhận. Hồ sơ của em nằm ở trang Học sinh.").waitFor({ timeout: 30000 });
  const prof = await prisma.studentProfile.findFirst({ where: { name: "Bé Tiếp Nhận Giao Diện" } });
  const pcs = await prisma.consentRecord.findMany({ where: { subjectId: prof?.id ?? "x" } });
  check("hồ sơ chờ xếp lớp, đã gắn lớp; đồng ý: guardian (từ biểu mẫu) + child (gia sư xác nhận)", prof?.status === "waitlist" && !!prof.courseId && pcs.map(c => `${c.party}:${c.method}`).sort().join() === "child:tutor_attestation,guardian:guest_form");
  const done1 = tp.locator("[data-yeu-cau]", { hasText: "Tiếng Anh" });
  await done1.getByRole("link", { name: "Mở hồ sơ của em" }).waitFor({ timeout: 30000 });
  check("thẻ yêu cầu chuyển 'Đã nhận', hết số liên hệ, có liên kết mở hồ sơ", (await done1.innerText()).includes("Đã nhận") && !(await done1.innerText()).match(/09\d{8}/) && await done1.getByRole("link", { name: "Mở hồ sơ của em" }).getAttribute("href") === `/lop-cua-toi/hoc-sinh/${prof!.id}`);
  const t1 = await (await fetch(`${BASE}/api/yeu-cau/${q1.trackToken}`)).json();
  check("khách của yêu cầu đó thấy 'Gia sư đã nhận yêu cầu'", t1.status === "accepted");
  await tp.locator("[data-yeu-cau]", { hasText: "Văn 8" }).locator("[data-decline]").click();
  await tp.getByRole("dialog").getByRole("button", { name: "Từ chối" }).click();
  await tp.getByText("Đã từ chối yêu cầu.").waitFor({ timeout: 30000 });
  await tp.locator("[data-yeu-cau]", { hasText: "Văn 8" }).getByText("Đã từ chối").waitFor({ timeout: 30000 }); // đợi tải lại sau khi từ chối
  const q2row = await prisma.tutorRequest.findFirst({ where: { trackToken: q2.trackToken } });
  check("từ chối → declined, số liên hệ xoá khỏi DB, thẻ ghi 'Đã từ chối'", q2row?.status === "declined" && q2row.contactPhone === "" && (await tp.locator("[data-yeu-cau]", { hasText: "Văn 8" }).innerText()).includes("Đã từ chối"));

  section("Điện thoại 390px");
  const q3 = await mk({ subject: "Hoá 10" });
  const mg = await guestCtx.newPage(); watch(mg);
  await mg.setViewportSize({ width: 390, height: 800 });
  const scan = async (p: any, name: string) => {
    await p.waitForTimeout(700);
    const over = await p.evaluate(`document.documentElement.scrollWidth <= window.innerWidth`) as boolean;
    const small = await p.evaluate(`[...document.querySelectorAll('main a, main button, main select, main input:not([type=checkbox]):not([type=radio]):not([name=website]), a[href^="/mentor"], a[href^="/yeu-cau"], [data-sent] a, [data-sent] button')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 43.5 && !e.closest('nav') && !e.closest('header') && !e.closest('footer')).map(e => (e.textContent||e.getAttribute('aria-label')||'').trim().slice(0,30) + ':' + Math.round(e.getBoundingClientRect().height))`) as string[];
    check(`390px ${name}: không tràn ngang, nút / ô ≥ 44px`, over && small.length === 0, small);
  };
  await mg.goto(`${BASE}/mentor/${T.id}/yeu-cau`, { waitUntil: "networkidle", timeout: 120000 }); await mg.locator("h1").waitFor({ timeout: 90000 }); await scan(mg, "biểu mẫu");
  await mg.goto(`${BASE}/yeu-cau/${q3.trackToken}`, { waitUntil: "networkidle", timeout: 120000 }); await mg.locator("[data-track-status]").waitFor({ timeout: 90000 }); await scan(mg, "trang theo dõi");
  const mt = await (await ctxFor(T, { width: 390, height: 800 })).newPage(); watch(mt);
  await mt.goto(`${BASE}/lop-cua-toi/yeu-cau`, { waitUntil: "networkidle", timeout: 120000 }); await mt.locator("[data-yeu-cau]").first().waitFor({ timeout: 90000 }); await scan(mt, "trang gia sư");
  await mt.locator("[data-open-accept]").first().click(); await scan(mt, "gia sư mở form tiếp nhận");
  check("không lỗi trang / console", errors.length === 0, errors.slice(0, 4));
  await closeAll();
  done();
})().catch(async e => { console.error("TEST CRASH", e); await closeAll().catch(() => {}); process.exit(1); });
