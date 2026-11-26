// Đợt 2 — đăng nhập Google (BCA-D2-DN). Google GIẢ LẬP hoàn toàn: fetch bị thay, không gọi Google thật.
// Khoá RSA tự sinh trong test đóng vai JWKS của Google; id_token ký bằng khoá đó.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from "jose";
import { gmailGoc } from "@/lib/chuan-hoa";
import { _datLaiJwks, GOOGLE_JWKS, GOOGLE_TOKEN, pkceChallenge } from "@/server/google";
import { docTam, kyPhien, kyTam, TEN_COOKIE } from "@/server/token";
import { nguoiTuToken } from "@/server/phien";
import { themNguoiDung } from "@/scripts/them-nguoi-dung";
import * as batDauR from "@/app/api/dang-nhap/google/route";
import * as callbackR from "@/app/api/dang-nhap/google/callback/route";
import * as thuHoiHsR from "@/app/api/hoc-sinh/[maHs]/thu-hoi-phien/route";
import * as hsToi from "@/app/api/hs/toi/route";
import * as toi from "@/app/api/toi/route";
import { CHU, GV_ANH, GV_TOAN, cookieHs, cookieNd, db, goi, napSeed } from "./chung";

const CLIENT_ID = "test-client.apps.googleusercontent.com";
const ENV = ["BCA_GOOGLE_CLIENT_ID", "BCA_GOOGLE_CLIENT_SECRET", "BCA_APP_URL"] as const;
const goc = Object.fromEntries(ENV.map((k) => [k, process.env[k]]));

let khoaGoogle: CryptoKey, khoaLa: CryptoKey;
let goiToken: URLSearchParams[] = [];
let traToken: () => Response | Promise<Response>;
const fetchGoc = globalThis.fetch;

type Claim = Record<string, unknown>;
async function idToken(claim: Claim, opt: { khoa?: CryptoKey; het?: string | number } = {}) {
  const { iss = "https://accounts.google.com", aud = CLIENT_ID, ...rest } = claim;
  return new SignJWT({ email_verified: true, ...rest })
    .setProtectedHeader({ alg: "RS256", kid: "khoa-test" })
    .setIssuer(String(iss)).setAudience(aud as string).setSubject("1234567890").setIssuedAt()
    .setExpirationTime(opt.het ?? "1h")
    .sign(opt.khoa ?? khoaGoogle);
}
const traIdToken = (claim: Claim, opt?: Parameters<typeof idToken>[1]) => {
  traToken = async () => Response.json({ id_token: await idToken(claim, opt), access_token: "x", token_type: "Bearer" });
};

beforeAll(async () => {
  await napSeed();
  const k = await generateKeyPair("RS256");
  khoaGoogle = k.privateKey;
  khoaLa = (await generateKeyPair("RS256")).privateKey;
  const jwk = { ...(await exportJWK(k.publicKey)), kid: "khoa-test", alg: "RS256", use: "sig" };
  vi.stubGlobal("fetch", async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url instanceof Request ? url.url : url);
    if (u === GOOGLE_JWKS) return Response.json({ keys: [jwk] });
    if (u === GOOGLE_TOKEN) {
      goiToken.push(new URLSearchParams(String(init?.body)));
      return traToken();
    }
    throw new Error(`Test không cho gọi mạng thật: ${u}`);
  });
  _datLaiJwks();
});
afterAll(() => {
  vi.unstubAllGlobals();
  expect(globalThis.fetch).toBe(fetchGoc);
});
beforeEach(() => {
  process.env.BCA_GOOGLE_CLIENT_ID = CLIENT_ID;
  process.env.BCA_GOOGLE_CLIENT_SECRET = "bi-mat-client-chi-de-test";
  delete process.env.BCA_APP_URL;
  goiToken = [];
  traToken = () => new Response("chưa đặt", { status: 500 });
});
afterEach(() => {
  for (const k of ENV) if (goc[k] === undefined) delete process.env[k]; else process.env[k] = goc[k];
});

/** Bấm nút: gọi route bắt đầu, lấy state/nonce/verifier từ cookie tạm (giải mã như máy chủ). */
async function batDau(url = "http://localhost/api/dang-nhap/google") {
  const r = await batDauR.GET(new Request(url));
  const sc = r.headers.getSetCookie();
  const giaTri = sc[0]?.split(";")[0].split("=").slice(1).join("=");
  const tam = await docTam("google", giaTri);
  return { r, sc, cookie: `bca_google=${giaTri}`, tam: tam as { state: string; nonce: string; verifier: string; redirect: string } };
}
async function veTu(q: Record<string, string>, cookie?: string) {
  const r = await callbackR.GET(new Request(`http://localhost/api/dang-nhap/google/callback?${new URLSearchParams(q)}`, { headers: cookie ? { cookie } : {} }));
  const sc = r.headers.getSetCookie();
  const phien = sc.find((c) => c.startsWith(`${TEN_COOKIE}=`) && !c.includes("Max-Age=0"));
  return { status: r.status, location: r.headers.get("location"), sc, phien: phien?.split(";")[0] };
}
/** Trọn luồng: bắt đầu → Google trả code → callback. */
async function dangNhap(claim: Claim | ((nonce: string) => Claim), opt?: Parameters<typeof idToken>[1]) {
  const b = await batDau();
  traIdToken(typeof claim === "function" ? claim(b.tam.nonce) : { nonce: b.tam.nonce, ...claim }, opt);
  return veTu({ code: "ma-code-gia", state: b.tam.state }, b.cookie);
}

describe("Thuần — Gmail dạng gốc (T48), PKCE", () => {
  it("gmail.com / googlemail.com bỏ dấu chấm và +…; địa chỉ khác chỉ chữ thường", () => {
    expect(gmailGoc(" Nguyen.Van.A@Gmail.com ")).toBe("nguyenvana@gmail.com");
    expect(gmailGoc("nguyenvana+bca@googlemail.com")).toBe("nguyenvana@gmail.com");
    expect(gmailGoc("Thu.Huong@truong.edu.vn")).toBe("thu.huong@truong.edu.vn");
    expect(gmailGoc("a+b@truong.edu.vn")).toBe("a+b@truong.edu.vn");
    expect(gmailGoc("")).toBeNull();
  });
  it("code_challenge S256 khớp ví dụ RFC 7636 phụ lục B", async () => {
    expect(await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("GET /api/dang-nhap/google — bắt đầu", () => {
  it("thiếu BCA_GOOGLE_CLIENT_ID hoặc SECRET → 303 về /dang-nhap?loi=chua_cau_hinh, không sập, không cookie", async () => {
    delete process.env.BCA_GOOGLE_CLIENT_SECRET;
    const r = await batDauR.GET(new Request("http://localhost/api/dang-nhap/google"));
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe("/dang-nhap?loi=chua_cau_hinh");
    expect(r.headers.getSetCookie()).toEqual([]);
    process.env.BCA_GOOGLE_CLIENT_SECRET = "x";
    process.env.BCA_GOOGLE_CLIENT_ID = "   ";
    expect((await batDauR.GET(new Request("http://localhost/api/dang-nhap/google"))).headers.get("location")).toBe("/dang-nhap?loi=chua_cau_hinh");
  });
  it("đủ biến → 302 sang Google với code + PKCE S256 + state + nonce + scope openid email; cookie tạm HttpOnly, 10 phút, chỉ đường dẫn callback", async () => {
    const { r, sc, tam } = await batDau();
    expect(r.status).toBe(302);
    const u = new URL(r.headers.get("location")!);
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const q = u.searchParams;
    expect(Object.fromEntries(q)).toMatchObject({ response_type: "code", client_id: CLIENT_ID, scope: "openid email", code_challenge_method: "S256", redirect_uri: "http://localhost/api/dang-nhap/google/callback" });
    expect(q.get("state")).toBe(tam.state);
    expect(q.get("nonce")).toBe(tam.nonce);
    expect(q.get("code_challenge")).toBe(await pkceChallenge(tam.verifier));
    expect(q.has("client_secret")).toBe(false);
    expect(tam.state).toMatch(/^[\w-]{43}$/);
    expect(new Set([tam.state, tam.nonce, tam.verifier]).size).toBe(3);
    expect(sc).toHaveLength(1);
    expect(sc[0]).toMatch(/^bca_google=.+; Path=\/api\/dang-nhap\/google; Max-Age=600; HttpOnly; SameSite=Lax/);
    expect(r.headers.get("cache-control")).toBe("no-store");
    // hai lần bấm ⇒ state khác nhau
    expect((await batDau()).tam.state).not.toBe(tam.state);
  });
  it("BCA_APP_URL (bỏ / cuối) thay cho gốc của request trong redirect_uri", async () => {
    process.env.BCA_APP_URL = "https://bca.example.vn/";
    const { r, tam } = await batDau("http://noi-bo:3000/api/dang-nhap/google");
    expect(new URL(r.headers.get("location")!).searchParams.get("redirect_uri")).toBe("https://bca.example.vn/api/dang-nhap/google/callback");
    expect(tam.redirect).toBe("https://bca.example.vn/api/dang-nhap/google/callback");
  });
});

describe("GET /api/dang-nhap/google/callback — đăng nhập đúng", () => {
  it("chủ lớp: đổi code kèm code_verifier + redirect_uri + client_secret; 303 về /, cookie phiên như cũ, xoá cookie tạm", async () => {
    const b = await batDau();
    traIdToken({ nonce: b.tam.nonce, email: CHU });
    const v = await veTu({ code: "ma-code-gia", state: b.tam.state }, b.cookie);
    expect(v).toMatchObject({ status: 303, location: "/" });
    expect(goiToken).toHaveLength(1);
    expect(Object.fromEntries(goiToken[0])).toEqual({
      code: "ma-code-gia", client_id: CLIENT_ID, client_secret: "bi-mat-client-chi-de-test",
      redirect_uri: "http://localhost/api/dang-nhap/google/callback", grant_type: "authorization_code", code_verifier: b.tam.verifier,
    });
    expect(v.sc.some((c) => /^bca_google=; Path=\/api\/dang-nhap\/google; Max-Age=0/.test(c))).toBe(true);
    expect(v.sc.find((c) => c.startsWith("bca_phien="))).toMatch(/Max-Age=2592000; HttpOnly; SameSite=Lax/);
    expect((await goi(toi.GET, { cookie: v.phien })).json).toMatchObject({ vai: "chu" });
  });
  it("giáo viên: vào đúng vai + môn; email Google viết hoa vẫn khớp", async () => {
    const v = await dangNhap({ email: GV_TOAN.toUpperCase() });
    expect(v.location).toBe("/");
    const u = await nguoiTuToken(v.phien!.split("=")[1]);
    expect(u).toMatchObject({ vai: "giao_vien" });
    expect(u && u.vai === "giao_vien" && u.monIds).toEqual([1]);
  });
  it("học sinh: khớp Gmail trên hồ sơ (dạng gốc: chấm, chữ hoa, googlemail) → phiên học sinh đọc được /api/hs/toi", async () => {
    await db.hoc_sinh.update({ where: { ma_hs: "HS0002" }, data: { gmail: "tran.thi.b@gmail.com" } });
    const v = await dangNhap({ email: "TranThiB@googlemail.com" });
    expect(v.location).toBe("/");
    const hs = await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: "HS0002" } });
    expect(await nguoiTuToken(v.phien!.split("=")[1])).toMatchObject({ vai: "hoc_sinh", hocSinhId: hs.id });
    expect((await goi(hsToi.GET, { cookie: v.phien })).status).toBe(200);
  });
  it('email_verified dạng chuỗi "true" vẫn nhận; iss "accounts.google.com" (không https) vẫn nhận', async () => {
    expect((await dangNhap({ email: GV_ANH, email_verified: "true", iss: "accounts.google.com" })).location).toBe("/");
  });
  it("T49: Gmail vừa là GV vừa ghi trên hồ sơ học sinh → vào vai GV", async () => {
    await db.hoc_sinh.update({ where: { ma_hs: "HS0003" }, data: { gmail: GV_ANH } });
    const v = await dangNhap({ email: GV_ANH });
    expect(await nguoiTuToken(v.phien!.split("=")[1])).toMatchObject({ vai: "giao_vien" });
    await db.hoc_sinh.update({ where: { ma_hs: "HS0003" }, data: { gmail: "hs3@example.com" } });
  });
});

describe("Callback — từ chối (không cấp phiên)", () => {
  const tuChoi = (v: Awaited<ReturnType<typeof veTu>>, ma: string) => {
    expect(v).toMatchObject({ status: 303, location: `/dang-nhap?loi=${ma}` });
    expect(v.phien).toBeUndefined();
    expect(v.sc.some((c) => c.startsWith("bca_google=;") && c.includes("Max-Age=0"))).toBe(true);
  };
  it("Gmail không có trong hệ thống → khong_co_tai_khoan, KHÔNG tự tạo tài khoản/hồ sơ, không ghi nhật ký", async () => {
    const [nd, hs, nk] = await Promise.all([db.nguoi_dung.count(), db.hoc_sinh.count(), db.nhat_ky.count()]);
    tuChoi(await dangNhap({ email: "nguoi.la@gmail.com" }), "khong_co_tai_khoan");
    expect([await db.nguoi_dung.count(), await db.hoc_sinh.count(), await db.nhat_ky.count()]).toEqual([nd, hs, nk]);
  });
  it("email_verified false hoặc thiếu → chua_xac_minh", async () => {
    tuChoi(await dangNhap({ email: CHU, email_verified: false }), "chua_xac_minh");
    tuChoi(await dangNhap((nonce) => ({ nonce, email: CHU, email_verified: undefined })), "chua_xac_minh");
  });
  it("id_token thiếu email → chua_xac_minh", async () => {
    tuChoi(await dangNhap({}), "chua_xac_minh");
  });
  it("nonce sai / aud khác / iss lạ / hết hạn / ký bằng khoá lạ → google_loi", async () => {
    tuChoi(await dangNhap((_n) => ({ nonce: "nonce-khac", email: CHU })), "google_loi");
    tuChoi(await dangNhap({ email: CHU, aud: "client-khac.apps.googleusercontent.com" }), "google_loi");
    tuChoi(await dangNhap({ email: CHU, iss: "https://evil.example.com" }), "google_loi");
    tuChoi(await dangNhap({ email: CHU }, { het: Math.floor(Date.now() / 1000) - 3600 }), "google_loi");
    tuChoi(await dangNhap({ email: CHU }, { khoa: khoaLa }), "google_loi");
  });
  it("id_token ký HS256 bằng client_secret (giả mạo đổi thuật toán) → google_loi", async () => {
    const b = await batDau();
    const gia = await new SignJWT({ email: CHU, email_verified: true, nonce: b.tam.nonce }).setProtectedHeader({ alg: "HS256" })
      .setIssuer("https://accounts.google.com").setAudience(CLIENT_ID).setExpirationTime("1h").sign(new TextEncoder().encode("bi-mat-client-chi-de-test"));
    traToken = () => Response.json({ id_token: gia });
    tuChoi(await veTu({ code: "c", state: b.tam.state }, b.cookie), "google_loi");
  });
  it("máy chủ token của Google trả 400 / không có id_token / lỗi mạng → google_loi", async () => {
    for (const tra of [() => Response.json({ error: "invalid_grant" }, { status: 400 }), () => Response.json({ access_token: "x" }), () => Promise.reject(new TypeError("fetch failed"))]) {
      const b = await batDau();
      traToken = tra;
      tuChoi(await veTu({ code: "c", state: b.tam.state }, b.cookie), "google_loi");
    }
  });
  it("state sai / thiếu / không có cookie tạm / cookie bị sửa / cookie hết hạn / dùng cookie phiên làm cookie tạm → het_han, KHÔNG gọi Google", async () => {
    const b = await batDau();
    traIdToken({ nonce: b.tam.nonce, email: CHU });
    tuChoi(await veTu({ code: "c", state: "state-ke-tan-cong" }, b.cookie), "het_han");
    tuChoi(await veTu({ code: "c" }, b.cookie), "het_han");
    tuChoi(await veTu({ code: "c", state: b.tam.state }), "het_han");
    tuChoi(await veTu({ code: "c", state: b.tam.state }, b.cookie.slice(0, -3) + "abc"), "het_han");
    const cu = await kyTam("google", { state: "s1", nonce: "n", verifier: "v", redirect: "r" }, -1);
    tuChoi(await veTu({ code: "c", state: "s1" }, `bca_google=${cu}`), "het_han");
    const phien = await kyPhien({ sub: "x", vai: "nd", bd: 1 });
    tuChoi(await veTu({ code: "c", state: "x" }, `bca_google=${phien}`), "het_han");
    expect(goiToken).toHaveLength(0);
  });
  it("người dùng bấm Huỷ ở Google (error=access_denied, state đúng) → huy; thiếu code → google_loi", async () => {
    let b = await batDau();
    tuChoi(await veTu({ error: "access_denied", state: b.tam.state }, b.cookie), "huy");
    b = await batDau();
    tuChoi(await veTu({ state: b.tam.state }, b.cookie), "google_loi");
    expect(goiToken).toHaveLength(0);
  });
  it("thiếu biến lúc Google gọi về → chua_cau_hinh", async () => {
    const b = await batDau();
    delete process.env.BCA_GOOGLE_CLIENT_ID;
    tuChoi(await veTu({ code: "c", state: b.tam.state }, b.cookie), "chua_cau_hinh");
  });
  it("tài khoản GV bị khoá → tai_khoan_khoa (không rơi xuống tìm hồ sơ học sinh)", async () => {
    await db.nguoi_dung.update({ where: { gmail: GV_ANH }, data: { khoa_luc: new Date() } });
    await db.hoc_sinh.update({ where: { ma_hs: "HS0004" }, data: { gmail: GV_ANH } });
    tuChoi(await dangNhap({ email: GV_ANH }), "tai_khoan_khoa");
    await db.nguoi_dung.update({ where: { gmail: GV_ANH }, data: { khoa_luc: null } });
    await db.hoc_sinh.update({ where: { ma_hs: "HS0004" }, data: { gmail: "hs4@example.com" } });
  });
  it("hồ sơ học sinh đang ẩn (HS0070) → ho_so_an", async () => {
    const hs = await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: "HS0070" } });
    expect(hs.an_luc).not.toBeNull();
    tuChoi(await dangNhap({ email: hs.gmail }), "ho_so_an");
  });
  it("T48: hai hồ sơ cùng một hộp Gmail (khác dấu chấm) → trung_gmail, không đoán", async () => {
    await db.hoc_sinh.update({ where: { ma_hs: "HS0005" }, data: { gmail: "le.van.c@gmail.com" } });
    await db.hoc_sinh.update({ where: { ma_hs: "HS0006" }, data: { gmail: "levanc@gmail.com" } });
    tuChoi(await dangNhap({ email: "levanc@gmail.com" }), "trung_gmail");
    await db.hoc_sinh.update({ where: { ma_hs: "HS0005" }, data: { gmail: "hs5@example.com" } });
    await db.hoc_sinh.update({ where: { ma_hs: "HS0006" }, data: { gmail: "hs6@example.com" } });
  });
  it("địa chỉ không phải gmail.com so đúng nguyên văn (không bỏ dấu chấm)", async () => {
    await db.hoc_sinh.update({ where: { ma_hs: "HS0009" }, data: { gmail: "a.b@truong.edu.vn" } });
    tuChoi(await dangNhap({ email: "ab@truong.edu.vn" }), "khong_co_tai_khoan");
    expect((await dangNhap({ email: "A.B@truong.edu.vn" })).location).toBe("/");
    await db.hoc_sinh.update({ where: { ma_hs: "HS0009" }, data: { gmail: "hs9@example.com" } });
  });
});

describe("T41 — khoá phiên học sinh", () => {
  it("chủ bấm Đăng xuất em khỏi mọi máy → phiên cũ 401 ngay; đăng nhập Google lại thì vào được; có nhật ký", async () => {
    const cu = await cookieHs("HS0010");
    expect((await goi(hsToi.GET, { cookie: cu })).status).toBe(200);
    const r = await goi(thuHoiHsR.POST, { cookie: await cookieNd(CHU), method: "POST", params: { maHs: "HS0010" } });
    expect(r).toMatchObject({ status: 200, json: { ok: true, ma_hs: "HS0010" } });
    expect((await goi(hsToi.GET, { cookie: cu })).status).toBe(401);
    expect(await db.nhat_ky.count({ where: { hanh_dong: "thu_hoi_phien_hoc_sinh", doi_tuong_id: "HS0010" } })).toBe(1);
    const hs = await db.hoc_sinh.findUniqueOrThrow({ where: { ma_hs: "HS0010" } });
    await new Promise((ok) => setTimeout(ok, 1100)); // phiên mới phải bắt đầu SAU mốc thu hồi (đơn vị giây)
    const v = await dangNhap({ email: hs.gmail });
    expect((await goi(hsToi.GET, { cookie: v.phien })).status).toBe(200);
  });
  it("GV / học sinh gọi thu hồi phiên học sinh → 403; mã không có → 404", async () => {
    expect((await goi(thuHoiHsR.POST, { cookie: await cookieNd(GV_TOAN), method: "POST", params: { maHs: "HS0011" } })).status).toBe(403);
    expect((await goi(thuHoiHsR.POST, { cookie: await cookieHs("HS0011"), method: "POST", params: { maHs: "HS0011" } })).status).toBe(403);
    expect((await goi(thuHoiHsR.POST, { cookie: await cookieNd(CHU), method: "POST", params: { maHs: "HS9999" } })).status).toBe(404);
  });
  it("hồ sơ bị ẩn → phiên học sinh đang mở hết hiệu lực ngay (401)", async () => {
    const c = await cookieHs("HS0012");
    expect((await goi(hsToi.GET, { cookie: c })).status).toBe(200);
    await db.hoc_sinh.update({ where: { ma_hs: "HS0012" }, data: { an_luc: new Date() } });
    expect((await goi(hsToi.GET, { cookie: c })).status).toBe(401);
    await db.hoc_sinh.update({ where: { ma_hs: "HS0012" }, data: { an_luc: null } });
  });
  it("sub học sinh hỏng (không phải số / vượt int4) → null, không 500", async () => {
    for (const sub of ["abc", "99999999999", "1.5", "-1"]) expect(await nguoiTuToken(await kyPhien({ sub, vai: "hs", bd: 1 }))).toBeNull();
  });
});

describe("scripts/them-nguoi-dung — tạo tài khoản chủ đầu tiên / thêm GV (T50)", () => {
  it("tạo chủ mới rồi đăng nhập Google được; chạy lại an toàn; thêm GV kèm môn; không mở khoá", async () => {
    const r = await themNguoiDung(db as never, { gmail: " Chu.Lop.Moi@Gmail.com ", ten: "Chủ lớp mới", vai: "chu", mon: [] });
    expect(r).toMatchObject({ ket_qua: "da_tao", vai: "chu" });
    expect((await db.nguoi_dung.findUniqueOrThrow({ where: { id: r.id } })).gmail).toBe("chu.lop.moi@gmail.com");
    expect(await db.nhat_ky.findFirst({ where: { hanh_dong: "them_nguoi_dung", doi_tuong_id: r.id } })).toMatchObject({ vai_tro: "he_thong", nguoi_dung_id: null });
    const v = await dangNhap({ email: "chulopmoi@gmail.com" });
    expect((await goi(toi.GET, { cookie: v.phien })).json).toMatchObject({ vai: "chu" });

    const g1 = await themNguoiDung(db as never, { gmail: "co.hoa@gmail.com", ten: "Cô Hoa", vai: "giao_vien", mon: ["toan"] });
    const g2 = await themNguoiDung(db as never, { gmail: "co.hoa@gmail.com", ten: "Cô Hoa", vai: "giao_vien", mon: ["toan", "su"] });
    expect(g2).toMatchObject({ ket_qua: "da_cap_nhat", id: g1.id, them_mon: ["su"] });
    expect(await db.phan_cong.count({ where: { nguoi_dung_id: g1.id } })).toBe(2);
    await db.nguoi_dung.update({ where: { id: g1.id }, data: { khoa_luc: new Date() } });
    expect(await themNguoiDung(db as never, { gmail: "co.hoa@gmail.com", ten: "Cô Hoa", vai: "giao_vien", mon: [] })).toMatchObject({ dang_khoa: true });
  });
  it("đầu vào sai → lỗi rõ, không ghi gì", async () => {
    const n = await db.nguoi_dung.count();
    await expect(themNguoiDung(db as never, { gmail: "sai@gamil.com", ten: "X", vai: "chu", mon: [] })).rejects.toThrow("Gmail không hợp lệ");
    await expect(themNguoiDung(db as never, { gmail: "x@gmail.com", ten: " ", vai: "chu", mon: [] })).rejects.toThrow("--ten");
    await expect(themNguoiDung(db as never, { gmail: "x@gmail.com", ten: "X", vai: "admin" as never, mon: [] })).rejects.toThrow("--vai");
    await expect(themNguoiDung(db as never, { gmail: "x@gmail.com", ten: "X", vai: "giao_vien", mon: ["hoa"] })).rejects.toThrow("Không có môn: hoa");
    await expect(themNguoiDung(db as never, { gmail: "x@gmail.com", ten: "X", vai: "chu", mon: ["toan"] })).rejects.toThrow("--mon");
    expect(await db.nguoi_dung.count()).toBe(n);
  });
});
