// Nhóm ĐĂNG NHẬP (Đợt 2): trang /dang-nhap có nút Google là chính, báo lỗi theo mã, đăng nhập thử theo vai vẫn như cũ (T40).
// Máy chủ dev phải chạy với BCA_GOOGLE_CLIENT_ID + BCA_GOOGLE_CLIENT_SECRET GIẢ (vd. "gia.apps.googleusercontent.com" / "gia")
// và BCA_DEV_LOGIN=1. Không bao giờ mở Google thật: không theo chuyển hướng sang accounts.google.com.
import { test, chay, ok, bang, W, BASE, moTrang, khongTranNgang } from "./lib.mjs";

const N = "Đăng nhập";

for (const kich of [W.dt, W.mt]) {
  test(N, `Nút "Đăng nhập bằng Google" là nút chính, khu đăng nhập thử nằm dưới, không tràn ngang (${kich.width})`, async (t) => {
    const { page } = await t.trang(null, kich);
    await moTrang(page, "/dang-nhap");
    const nut = page.getByRole("link", { name: "Đăng nhập bằng Google" });
    await nut.waitFor();
    const hop = await nut.boundingBox();
    ok(hop && hop.height >= 48, `Nút Google thấp hơn 48px (${hop?.height})`);
    const thu = await page.getByRole("button", { name: "Chủ lớp" }).boundingBox();
    ok(thu && thu.y > hop.y + hop.height, "Khu đăng nhập thử phải nằm dưới nút Google");
    await page.getByRole("heading", { name: "Đăng nhập thử theo vai" }).waitFor();
    await khongTranNgang(page, "/dang-nhap");
    await t.chup(page, `dang-nhap-${kich.width}`);
  });
}

// Lưu ý: page.route không chặn được request sinh ra từ chuyển hướng 302 ⇒ không bấm thẳng (sẽ ra Google thật);
// gọi route bắt đầu bằng request của chính ngữ cảnh trình duyệt (chung cookie), không theo chuyển hướng.
test(N, "Nút Google trỏ /api/dang-nhap/google → 302 sang accounts.google.com với PKCE S256 + state; cookie tạm HttpOnly, chỉ đường dẫn callback", async (t) => {
  const { page, ctx } = await t.trang(null, W.dt);
  await moTrang(page, "/dang-nhap");
  bang(await page.getByRole("link", { name: "Đăng nhập bằng Google" }).getAttribute("href"), "/api/dang-nhap/google", "href nút Google");
  const r = await ctx.request.get("/api/dang-nhap/google", { maxRedirects: 0 });
  bang(r.status(), 302, "Mã trả về của route bắt đầu");
  const u = new URL(r.headers().location);
  bang(u.origin + u.pathname, "https://accounts.google.com/o/oauth2/v2/auth", "Địa chỉ Google");
  const q = u.searchParams;
  bang(q.get("code_challenge_method"), "S256", "code_challenge_method");
  bang(q.get("redirect_uri"), `${BASE}/api/dang-nhap/google/callback`, "redirect_uri");
  ok(q.get("state")?.length === 43 && q.get("nonce")?.length === 43, "state/nonce phải là 32 byte ngẫu nhiên");
  const c = (await ctx.cookies(`${BASE}/api/dang-nhap/google/callback`)).find((x) => x.name === "bca_google");
  ok(c && c.httpOnly && c.path === "/api/dang-nhap/google", "Cookie tạm bca_google phải HttpOnly, path callback");
  ok(!(await ctx.cookies(`${BASE}/`)).some((x) => x.name === "bca_google"), "Cookie tạm không được gửi cho trang khác");
});

test(N, "Google gọi về với state giả → quay lại /dang-nhap, báo hết hạn, không có phiên", async (t) => {
  const { page, ctx } = await t.trang(null, W.dt);
  await ctx.request.get("/api/dang-nhap/google", { maxRedirects: 0 });
  await moTrang(page, "/api/dang-nhap/google/callback?code=x&state=ke-tan-cong");
  bang(new URL(page.url()).pathname + new URL(page.url()).search, "/dang-nhap?loi=het_han", "Địa chỉ sau khi về");
  await page.locator("main [role=alert]").filter({ hasText: "Lượt đăng nhập đã hết hạn" }).waitFor();
  ok(!(await ctx.cookies(BASE)).some((x) => x.name === "bca_phien"), "Không được cấp cookie phiên");
});

test(N, "Mỗi mã lỗi hiện câu tiếng Việt dễ hiểu; mã lạ hiện câu chung, không in mã", async (t) => {
  const { page } = await t.trang(null, W.dt);
  const ca = {
    khong_co_tai_khoan: "Gmail vừa chọn chưa có trong lớp", huy: "Bạn đã huỷ đăng nhập Google", tai_khoan_khoa: "đã bị khoá",
    ho_so_an: "đang tạm ẩn", trung_gmail: "khớp với nhiều hồ sơ", chua_xac_minh: "chưa xác minh email", google_loi: "Chưa xác nhận được với Google",
    "<script>": "Đăng nhập chưa thành công",
  };
  for (const [ma, chu] of Object.entries(ca)) {
    await moTrang(page, `/dang-nhap?loi=${encodeURIComponent(ma)}`);
    const a = page.locator("main [role=alert]"); // Next có thêm vùng thông báo đổi trang role=alert
    await a.waitFor();
    const chuBao = await a.textContent();
    ok(chuBao.includes(chu), `loi=${ma}: không thấy "${chu}"`);
    ok(!chuBao.includes(ma), `loi=${ma}: in mã máy ra trang`);
  }
});

test(N, "Đã đăng nhập (thử, vai chủ) mở /dang-nhap → thấy tên + Vào lớp; Đăng xuất về lại nút Google", async (t) => {
  const { page } = await t.trang("chu", W.dt);
  await moTrang(page, "/dang-nhap");
  await page.getByText("Bạn đang đăng nhập là").waitFor();
  await page.getByRole("link", { name: "Vào lớp" }).click();
  await page.waitForURL(/\/quan-ly/);
  await moTrang(page, "/dang-nhap");
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await page.getByRole("link", { name: "Đăng nhập bằng Google" }).waitFor();
});

test(N, "Chủ: hồ sơ một em có 'Đăng xuất em khỏi mọi máy…' (hỏi lại) → phiên của em hết hiệu lực", async (t) => {
  const hs = await t.api("hs_thu");
  bang((await hs.get("/api/hs/toi")).status, 200, "Học sinh thử chưa vào được trước khi thu hồi");
  const ma = (await hs.get("/api/hs/toi")).json.hoc_sinh.ma_hs;
  const { page } = await t.trang("chu", W.mt);
  await moTrang(page, `/quan-ly/hoc-sinh/${ma}`);
  await t.chup(page, "ho-so-truoc-dang-xuat");
  await page.getByRole("button", { name: "Đăng xuất em khỏi mọi máy…" }).click();
  await page.getByRole("button", { name: "Đăng xuất em", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "khỏi mọi máy" }).waitFor();
  bang((await hs.get("/api/hs/toi")).status, 401, "Phiên học sinh vẫn còn sau khi chủ thu hồi");
});

await chay(N);
