// BU-03 P3 — trình duyệt thật: Giao đề (/lop-cua-toi/de-thi/[id]/giao) và Kết quả (/lop-cua-toi/de-thi/[id]/ket-qua), lối vào "Giao đề / Kết quả", liên kết quay lại của Chấm quiz.
// 1600px và 390px; không tràn ngang; nút ≥ 44px (loại nextjs-portal và KinToast); ba trạng thái (tải / lỗi / rỗng) bằng chặn mạng; không hộp thoại gốc;
// mật khẩu không bao giờ lộ trong DOM hay JSON; học sinh bị chặn; khách về đăng nhập; tên học sinh chỉ ở khối bảng điểm.
// CHƯA CHẠY lần nào (viết khi không được bật máy chủ, và API P3 do tut-code viết song song) — chạy lần đầu có thể cần chỉnh bộ chọn.
import { BASE, mkTutor, mkUser, mkCourse, api, wipe, check, section, done } from "./h";
import { launch, ctxFor, shot, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { AUDIENCE_LINK_READY } from "@/lib/deThiAssign";

const SECRET = "Mk-BiMat-9137";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Cô Khác");
  const S = await mkUser({ name: "Em An" });
  const S2 = await mkUser({ name: "Em Bình" });
  const course = await mkCourse(T.id, { name: "Toán 12 (giao đề)" });

  const base = { category: "Quiz", date: "01/01/2030", time: "19:00", duration: "15 phút", status: "upcoming", createdAt: "x", courseId: course.id, active: false, isDraft: true, questions: 1, totalPoints: 10 };
  const mkExam = async (id: string, title: string, ownerId: string, extra: Record<string, unknown> = {}, qText = "Câu 1 của đề") => {
    await prisma.exam.create({ data: { ...base, id, code: id.toUpperCase(), title, ownerId, ...extra } });
    await prisma.examQuestion.create({ data: { id: `${id}-q1`, examId: id, order: 1, type: "MC", text: qText, points: 10, options: { create: ["A", "B", "C", "D"].map((t, k) => ({ id: `${id}-o${k}`, order: k, text: `Đáp án ${t}`, isCorrect: k === 0 })) } } });
  };
  await mkExam("gd-draft", "Đề nháp để giao", T.id);
  await mkExam("gd-formula", "Đề còn công thức chưa gõ", T.id, {}, "Tính ⟦công thức⟧ bằng bao nhiêu?");
  await mkExam("gd-pub", "Đề đã có lượt làm", T.id, { isDraft: false, active: true, status: "available", date: "01/01/2020" });
  await mkExam("gd-nopub", "Đề đã phát hành chưa ai làm", T.id, { isDraft: false, active: true, status: "available", date: "01/01/2020" });
  await mkExam("gd-other", "Đề bí mật của cô khác", T2.id);
  const att = async (userId: string, score: number, optIdx: number) => {
    const a = await prisma.examAttempt.create({ data: { userId, examId: "gd-pub", expiresAt: new Date(Date.now() + 3600_000), submittedAt: new Date(), status: "submitted", score, totalPoints: 10 } });
    await prisma.examAnswer.create({ data: { attemptId: a.id, questionId: "gd-pub-q1", optionId: `gd-pub-o${optIdx}` } });
  };
  await att(S.id, 10, 0); await att(S2.id, 0, 1);

  await launch();
  const errors: string[] = [];
  const watch = (p: any) => {
    p.on("pageerror", (e: unknown) => errors.push(String(e)));
    // React 19 báo console.error về thẻ <script> chủ đề trong src/app/layout.tsx — lành tính, bỏ qua.
    p.on("console", (m: any) => { if (m.type() === "error" && !/Failed to load resource|favicon|Encountered a script tag while rendering React component/i.test(m.text())) errors.push(m.text()); });
  };
  const noOverflow = (p: any) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  const smallTargets = (p: any) => p.evaluate(() => [...document.querySelectorAll<HTMLElement>("main button, main a[class*='min-h'], main summary, [data-kin-page] button")]
    .filter(b => b.offsetParent && b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().height < 43.5
      && !b.closest("[role=tablist]") && !b.closest("[data-feedback-toolbar]") && !b.closest("nextjs-portal") && !b.closest("[data-kin-toast]") && !b.closest("[role=status]"))
    .map(b => (b.textContent || b.getAttribute("aria-label") || "").trim().slice(0, 30)));
  let nativeDialogs = 0;
  const goto = (pg: any, path: string) => pg.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
  const DT = "/lop-cua-toi/de-thi";
  const toastOk = (p: any, re: RegExp) => p.getByText(re).first().waitFor({ timeout: 30000 }).then(() => true, () => false);

  const tctx = await ctxFor(T, { width: 1600, height: 1000 });
  const p = await tctx.newPage(); watch(p); p.on("dialog", d => { nativeDialogs++; d.dismiss(); });

  section("Giao đề: bốn nhóm + chế độ, mặc định theo chế độ");
  await goto(p, `${DT}/gd-draft/giao`);
  await p.getByRole("form", { name: "Cấu hình giao đề" }).waitFor({ timeout: 30000 });
  for (const g of ["che-do", "doi-tuong", "thoi-gian", "truy-cap", "hien-thi"]) check(`có nhóm ${g}`, (await p.locator(`[data-giao-nhom=${g}]`).count()) === 1);
  check("KHÔNG có ô giá / cho khách", (await p.locator("input[name*=price i], input[name*=guest i], input[id*=gia i]").count()) === 0);
  await p.getByRole("radio", { name: /^Kiểm tra/ }).check();
  check("Kiểm tra: số lần = 1 (không bật 'không giới hạn')", !(await p.getByLabel(/Không giới hạn số lần/).isChecked()) && (await p.getByLabel(/Mỗi học sinh làm tối đa/).inputValue()) === "1");
  check("Kiểm tra: đáp án chỉ khi hết giờ", await p.getByRole("radio", { name: /Xem khi hết giờ làm bài/ }).isChecked());
  check("Kiểm tra: ẩn đáp án đúng ở câu sai", await p.getByLabel(/Không hiện đáp án đúng ở câu học sinh làm sai/).isChecked());
  check("Kiểm tra thiếu giờ → liệt kê lý do chặn phát hành + nút Phát hành khoá", (await p.locator("[data-giao-chan]").getByText(/ngày, giờ mở và thời lượng/).count()) >= 1 && await p.getByRole("button", { name: "Phát hành", exact: true }).isDisabled());
  await p.getByRole("radio", { name: /^Luyện tập/ }).check();
  check("Luyện tập: không giới hạn lần", await p.getByLabel(/Không giới hạn số lần/).isChecked());
  check("Luyện tập: xem ngay sau khi nộp", await p.getByRole("radio", { name: /Xem ngay sau khi nộp/ }).isChecked());
  check("ghi rõ giám sát chỉ ghi nhận, không phạt, không tự nộp", (await p.getByText(/Không phạt, không tự nộp/).count()) >= 1);
  const link = p.locator("input[name=aud][value=link]");
  if (!AUDIENCE_LINK_READY) {
    check("Giao theo link: hiện nhưng khoá, kèm lý do", await link.isDisabled() && (await p.getByText(/Chưa dùng được/).count()) >= 1);
  } else {
    check("Giao theo link: mở (cờ AUDIENCE_LINK_READY=true)", await link.isEnabled());
  }
  check("thanh bên: có mục đang chọn (visible)", (await p.locator("[aria-current=page]:visible").count()) >= 1);
  check("1600px: không tràn ngang, nút ≥ 44px", await noOverflow(p) && (await smallTargets(p)).length === 0, await smallTargets(p));
  await shot(p, "giao-de-1600");

  section("Giao đề: lưu cấu hình kiểm tra; mật khẩu không bao giờ hiện lại");
  await p.getByRole("radio", { name: /^Kiểm tra/ }).check();
  await p.locator("#gd-lop").selectOption(course.id);
  await p.fill("#gd-ngay", "2030-01-15"); await p.fill("#gd-gio", "19:30"); await p.fill("#gd-tl", "45");
  await p.fill("#gd-mk", SECRET);
  await p.getByRole("button", { name: "Lưu cấu hình" }).click();
  check("lưu xong có thông báo", await toastOk(p, /Đã lưu cấu hình giao đề/));
  check("sau lưu: ô mật khẩu rỗng, hiện 'Đã đặt'", (await p.inputValue("#gd-mk")) === "" && (await p.getByText("Đã đặt", { exact: true }).count()) >= 1);
  check("mật khẩu KHÔNG xuất hiện trong DOM", !(await p.content()).includes(SECRET));
  const gj = await p.request.get(`${BASE}/api/tutor/de-thi/gd-draft/giao`);
  const gtext = await gj.text();
  check("GET giao: có hasPassword=true, không có mật khẩu / mã băm", gj.status() === 200 && /"hasPassword":\s*true/.test(gtext) && !gtext.includes(SECRET) && !/passwordHash|\$2[aby]\$|pbkdf|scrypt/i.test(gtext), gtext.slice(0, 200));
  await goto(p, `${DT}/gd-draft/giao`);
  await p.getByRole("form", { name: "Cấu hình giao đề" }).waitFor({ timeout: 30000 });
  check("tải lại: cấu hình giữ nguyên (Kiểm tra, 45 phút), mật khẩu vẫn không hiện", await p.getByRole("radio", { name: /^Kiểm tra/ }).isChecked() && (await p.inputValue("#gd-tl")) === "45" && !(await p.content()).includes(SECRET));
  await p.getByRole("button", { name: "Xoá mật khẩu" }).click();
  await p.getByRole("dialog", { name: "Xoá mật khẩu?" }).getByRole("button", { name: "Xoá mật khẩu" }).click();
  check("xoá mật khẩu: toast + trạng thái 'Chưa đặt'", await toastOk(p, /Đã xoá mật khẩu/) && (await p.getByText("Chưa đặt", { exact: true }).count()) >= 1);

  section("Giao đề: chặn phát hành kèm lý do (công thức)");
  await goto(p, `${DT}/gd-formula/giao`);
  await p.getByRole("form", { name: "Cấu hình giao đề" }).waitFor({ timeout: 30000 });
  check("đề còn ⟦công thức⟧: nêu lý do + khoá Phát hành", (await p.locator("[data-giao-chan]").getByText(/công thức/).count()) >= 1 && await p.getByRole("button", { name: "Phát hành", exact: true }).isDisabled());

  section("Giao đề: đã có lượt làm → khoá chế độ / lớp / thời lượng; Đóng / Mở lại");
  await goto(p, `${DT}/gd-pub/giao`);
  await p.getByRole("form", { name: "Cấu hình giao đề" }).waitFor({ timeout: 30000 });
  check("nêu rõ đã có học sinh làm bài", (await p.getByText(/Đã có học sinh làm bài/).count()) >= 1);
  check("chế độ bị khoá", await p.getByRole("radio", { name: /^Kiểm tra/ }).isDisabled() && await p.getByRole("radio", { name: /^Luyện tập/ }).isDisabled());
  check("lớp và thời lượng bị khoá", await p.locator("#gd-lop").isDisabled() && await p.locator("#gd-tl").isDisabled());
  check("phần còn lại vẫn sửa được (hiển thị đáp án)", await p.getByRole("radio", { name: /Không cho xem/ }).isEnabled());
  await p.getByRole("button", { name: "Đóng đề" }).click();
  await p.getByRole("dialog", { name: "Đóng đề này?" }).getByRole("button", { name: "Đóng đề" }).click();
  check("Đóng đề: toast + nút đổi thành 'Mở lại đề'", await toastOk(p, /Đã đóng đề/) && await p.getByRole("button", { name: "Mở lại đề" }).isVisible());
  await p.getByRole("button", { name: "Mở lại đề" }).click();
  check("Mở lại đề: toast", await toastOk(p, /Đã mở lại đề/));
  check("đề đã phát hành có lối sang Kết quả", (await p.getByRole("link", { name: /Xem kết quả/ }).count()) >= 1);
  check("Giao đề (đã khoá) 1600px: không tràn ngang, nút ≥ 44px", await noOverflow(p) && (await smallTargets(p)).length === 0, await smallTargets(p));
  await shot(p, "giao-de-khoa-1600");

  section("Giao đề: ba trạng thái (tải / lỗi / không có quyền / không có)");
  await p.route("**/api/tutor/de-thi/gd-draft/giao", async r => { if (r.request().method() !== "GET") return r.continue(); await new Promise(res => setTimeout(res, 1500)); await r.continue(); });
  await p.goto(`${BASE}${DT}/gd-draft/giao`, { waitUntil: "domcontentloaded" });
  check("đang tải: có vùng aria-busy", await p.locator("[aria-busy=true]").first().waitFor({ timeout: 5000 }).then(() => true, () => false));
  await p.unroute("**/api/tutor/de-thi/gd-draft/giao");
  await p.route("**/api/tutor/de-thi/gd-draft/giao", r => r.request().method() === "GET" ? r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Lỗi giả lập" }) }) : r.continue());
  await goto(p, `${DT}/gd-draft/giao`);
  check("lỗi: có nút 'Thử lại'", await p.getByRole("button", { name: /Thử lại/ }).first().isVisible());
  await p.unroute("**/api/tutor/de-thi/gd-draft/giao");
  await p.getByRole("button", { name: /Thử lại/ }).first().click();
  check("bấm 'Thử lại' sau khi mạng ổn: form hiện", await p.getByRole("form", { name: "Cấu hình giao đề" }).waitFor({ timeout: 30000 }).then(() => true, () => false));
  await goto(p, `${DT}/khong-co-de-nay/giao`);
  check("đề không có: lời giải thích + lối về Đề thi", await p.getByText(/Không mở được màn giao đề/).first().waitFor({ timeout: 30000 }).then(() => true, () => false) && (await p.getByRole("link", { name: /Về Đề thi/ }).count()) >= 1);
  await goto(p, `${DT}/gd-other/giao`);
  check("đề của gia sư khác: báo không phải của cô, không lộ tên đề", await p.getByText(/không phải của cô/).first().waitFor({ timeout: 30000 }).then(() => true, () => false) && (await p.getByText("Đề bí mật của cô khác").count()) === 0);

  section("Kết quả: 5 khối, tên học sinh chỉ ở bảng điểm");
  await goto(p, `${DT}/gd-pub/ket-qua`);
  await p.locator("[data-ket-qua-khoi=co-ban]").waitFor({ timeout: 30000 });
  for (const k of ["co-ban", "pho-diem", "tan-so", "theo-cau"]) check(`khối ${k}`, (await p.locator(`[data-ket-qua-khoi=${k}]`).count()) === 1);
  check("khối bảng điểm", (await p.locator("[data-ket-qua-bang-diem]").count()) === 1);
  check("phổ điểm có đúng 5 khoảng", (await p.locator("[data-ket-qua-pho-diem] li").count()) === 5);
  check("tần số điểm là SVG có aria-label", (await p.locator("[data-ket-qua-tan-so] svg[role=img][aria-label]").count()) === 1);
  const namesAll = await p.locator("main").getByText(/Em An|Em Bình/).count();
  const namesInTable = await p.locator("[data-ket-qua-bang-diem]").getByText(/Em An|Em Bình/).count();
  check("tên học sinh CHỈ xuất hiện trong khối bảng điểm", namesInTable >= 2 && namesAll === namesInTable, { namesAll, namesInTable });
  check("tiêu đề tab không có tên học sinh", !/Em An|Em Bình/.test(await p.title()));
  check("tên đề (không phải tên học sinh) ở tiêu đề trang", (await p.getByText(/Kết quả · Đề đã có lượt làm/).count()) >= 1);
  const [resp] = await Promise.all([p.waitForResponse(r => /bang-diem\?chon=dau/.test(r.url()), { timeout: 30000 }), p.locator("#kq-chon").selectOption("dau")]);
  check("đổi 'Lần làm đầu tiên' gọi lại bảng điểm", resp.status() === 200);
  const xl = await p.locator("[data-ket-qua-xlsx]").getAttribute("href");
  check("nút Xuất Excel trỏ đúng đường tải, đúng lựa chọn", !!xl && /\/ket-qua\/xuat-xlsx\?chon=dau$/.test(xl), xl);
  if (xl) {
    const x = await tctx.request.get(`${BASE}${xl}`);
    check("tải Excel: 200, attachment, tên ASCII ket-qua-…xlsx", x.status() === 200 && /attachment/i.test(x.headers()["content-disposition"] ?? "") && /ket-qua-[A-Za-z0-9]+-\d{8}\.xlsx/.test(x.headers()["content-disposition"] ?? ""), [x.status(), x.headers()["content-disposition"]]);
  }
  check("thanh bên: có mục đang chọn (visible)", (await p.locator("[aria-current=page]:visible").count()) >= 1);
  check("Kết quả 1600px: không tràn ngang, nút ≥ 44px", await noOverflow(p) && (await smallTargets(p)).length === 0, await smallTargets(p));
  await shot(p, "ket-qua-1600");

  section("Kết quả: ba trạng thái");
  await goto(p, `${DT}/gd-nopub/ket-qua`);
  check("rỗng: 'Chưa có bài nộp' + lối về Giao đề", await p.getByText("Chưa có bài nộp", { exact: true }).first().waitFor({ timeout: 30000 }).then(() => true, () => false) && (await p.getByRole("link", { name: /Về màn Giao đề/ }).count()) >= 1);
  check("rỗng: không tràn ngang", await noOverflow(p));
  await shot(p, "ket-qua-rong-1600");
  await p.route("**/api/tutor/de-thi/gd-pub/ket-qua", async r => { await new Promise(res => setTimeout(res, 1500)); await r.continue(); });
  await p.goto(`${BASE}${DT}/gd-pub/ket-qua`, { waitUntil: "domcontentloaded" });
  check("đang tải: có vùng aria-busy", await p.locator("[aria-busy=true]").first().waitFor({ timeout: 5000 }).then(() => true, () => false));
  await p.unroute("**/api/tutor/de-thi/gd-pub/ket-qua");
  await p.route("**/api/tutor/de-thi/gd-pub/ket-qua", r => r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Lỗi giả lập" }) }));
  await goto(p, `${DT}/gd-pub/ket-qua`);
  check("lỗi: có nút 'Thử lại'", await p.getByRole("button", { name: /Thử lại/ }).first().isVisible());
  await p.unroute("**/api/tutor/de-thi/gd-pub/ket-qua");
  await goto(p, `${DT}/gd-other/ket-qua`);
  check("kết quả đề của gia sư khác: không phải của cô", await p.getByText(/không phải của cô/).first().waitFor({ timeout: 30000 }).then(() => true, () => false));

  section("Lối vào Giao đề / Kết quả, liên kết quay lại");
  await goto(p, `${DT}/gd-pub`);
  await p.getByRole("link", { name: /Giao đề/ }).first().waitFor({ timeout: 30000 });
  check("QuizEditor (đề đã phát hành) có 'Giao đề' và 'Kết quả'", (await p.getByRole("link", { name: /^Kết quả$/ }).count()) >= 1 && (await p.getByRole("link", { name: /Giao đề/ }).count()) >= 1);
  await goto(p, DT);
  await p.locator("[data-de-thi=gd-pub]").waitFor({ timeout: 30000 });
  const row = p.locator("[data-de-thi=gd-pub]");
  check("Danh sách đề: hàng đề đã phát hành có 'Giao đề' và 'Kết quả'", (await row.getByRole("link", { name: "Giao đề" }).count()) === 1 && (await row.getByRole("link", { name: "Kết quả" }).count()) === 1);
  check("Danh sách đề: đề nháp có 'Giao đề' nhưng chưa có 'Kết quả'", (await p.locator("[data-de-thi=gd-draft]").getByRole("link", { name: "Giao đề" }).count()) === 1 && (await p.locator("[data-de-thi=gd-draft]").getByRole("link", { name: "Kết quả" }).count()) === 0);
  await row.getByRole("link", { name: "Kết quả" }).click();
  await p.waitForURL(/\/gd-pub\/ket-qua/, { timeout: 30000 });
  check("bấm 'Kết quả' không 404", (await p.getByText(/404|not found/i).count()) === 0);
  await goto(p, `${DT}/gd-pub/cham`);
  const backLink = p.getByRole("link", { name: /Đề thi/ }).first();
  await backLink.waitFor({ timeout: 30000 });
  check("Chấm quiz: liên kết quay lại là 'Đề thi', không còn '‹ Bài tập'", (await backLink.getAttribute("href"))?.includes("/lop-cua-toi/de-thi") === true && (await p.getByText("‹ Bài tập").count()) === 0);

  section("Quyền: học sinh, gia sư khác, khách (trang và API)");
  const sctx = await ctxFor(S, { width: 1600, height: 900 });
  const sp = await sctx.newPage(); watch(sp);
  for (const path of [`${DT}/gd-pub/giao`, `${DT}/gd-pub/ket-qua`]) {
    await sp.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
    check(`học sinh không ở lại ${path.split("/").pop()}`, !sp.url().includes("/lop-cua-toi/de-thi"), sp.url());
  }
  const gctx = await ctxFor(null, { width: 1600, height: 900 });
  const gp = await gctx.newPage();
  for (const path of [`${DT}/gd-pub/giao`, `${DT}/gd-pub/ket-qua`]) {
    await gp.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
    check(`khách bị đưa tới đăng nhập (${path.split("/").pop()})`, /dang-nhap|login/i.test(gp.url()), gp.url());
  }
  for (const path of ["/api/tutor/de-thi/gd-pub/giao", "/api/tutor/de-thi/gd-pub/ket-qua", "/api/tutor/de-thi/gd-pub/ket-qua/bang-diem?chon=dau", "/api/tutor/de-thi/gd-pub/ket-qua/xuat-xlsx?chon=dau"]) {
    check(`khách 401 ${path}`, (await api("GET", path)).status === 401);
    check(`học sinh 403 ${path}`, (await api("GET", path, { as: S })).status === 403);
    check(`gia sư khác 403 ${path}`, (await api("GET", path, { as: T2 })).status === 403);
  }
  check("học sinh không PATCH được giao", (await api("PATCH", "/api/tutor/de-thi/gd-pub/giao", { as: S, body: { maxAttempts: 5 } })).status === 403);
  check("PATCH có price → 400 FORBIDDEN_FIELD", (await api("PATCH", "/api/tutor/de-thi/gd-draft/giao", { as: T, body: { price: 1000 } })).json?.code === "FORBIDDEN_FIELD");

  section("Điện thoại 390px");
  const mctx = await ctxFor(T, { width: 390, height: 844 });
  const mp = await mctx.newPage(); watch(mp);
  for (const [name, path] of [["giao-nhap", `${DT}/gd-draft/giao`], ["giao-khoa", `${DT}/gd-pub/giao`], ["ket-qua", `${DT}/gd-pub/ket-qua`], ["ket-qua-rong", `${DT}/gd-nopub/ket-qua`], ["de-thi", DT]] as const) {
    await goto(mp, path);
    await mp.waitForTimeout(800);
    check(`390px ${name}: không tràn ngang`, await noOverflow(mp));
    const small = await smallTargets(mp);
    check(`390px ${name}: nút cao ≥ 44px`, small.length === 0, small);
    await shot(mp, `giao-ket-qua-${name}-390`);
  }
  await goto(mp, `${DT}/gd-draft/giao`);
  await mp.getByRole("button", { name: "Lưu cấu hình" }).waitFor({ timeout: 30000 });
  const bar = await mp.locator("[data-giao-thanh-hanh-dong]").boundingBox();
  check("390px: thanh hành động (Lưu / Phát hành) nằm trong khung nhìn", !!bar && bar.y + bar.height <= 845 && bar.y >= 0, bar);
  await mp.locator("[data-giao-nhom=truy-cap] summary").click();
  check("390px: nhóm gập được", (await mp.locator("[data-giao-nhom=truy-cap]").getAttribute("open")) === null);

  check("không dùng hộp thoại gốc (confirm/alert)", nativeDialogs === 0, nativeDialogs);
  check("không lỗi JS / console.error trong toàn bài", errors.length === 0, errors.slice(0, 5));
  await closeAll();
  await done();
})();
