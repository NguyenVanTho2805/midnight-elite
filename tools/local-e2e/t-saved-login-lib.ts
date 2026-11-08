// Tự động đăng nhập bằng thông tin trình duyệt đã lưu — phần thuần src/lib/savedLogin.ts, chạy với trình duyệt GIẢ (không cần máy chủ/DB).
// Phủ: nhận biết trình duyệt có / không có PasswordCredential; chỉ xin lại ÂM THẦM (mediation "silent"), không bao giờ hiện hộp chọn; chỉ nhận đúng loại "password" có
// id + mật khẩu; mọi lỗi của API bị nuốt (không ném, không treo); rememberLogin chỉ lưu khi đủ dữ liệu; forgetSilentAccess gọi preventSilentAccess.
import { AUTO_NOT_ALLOWED, forgetSilentAccess, readSavedLogin, rememberLogin, savedLoginSupported, type CredentialEnv } from "@/lib/savedLogin";
import { check, section, done } from "./h";

class FakePasswordCredential { type = "password"; constructor(public data: { id: string; password: string; name?: string }) {} }
type Calls = { get: unknown[]; store: unknown[]; prevent: number };
function fakeEnv(o: { cred?: unknown; getThrows?: boolean; storeThrows?: boolean; preventThrows?: boolean; noPasswordCredential?: boolean; noCredentials?: boolean; noStore?: boolean; noPrevent?: boolean } = {}) {
  const calls: Calls = { get: [], store: [], prevent: 0 };
  const credentials = {
    get: async (opt: unknown) => { calls.get.push(opt); if (o.getThrows) throw new Error("NotAllowedError"); return o.cred ?? null; },
    ...(o.noStore ? {} : { store: async (c: unknown) => { calls.store.push(c); if (o.storeThrows) throw new Error("SecurityError"); } }),
    ...(o.noPrevent ? {} : { preventSilentAccess: async () => { calls.prevent++; if (o.preventThrows) throw new Error("x"); } }),
  };
  const env: CredentialEnv = {
    navigator: o.noCredentials ? {} : { credentials },
    ...(o.noPasswordCredential ? {} : { PasswordCredential: FakePasswordCredential as unknown as CredentialEnv["PasswordCredential"] }),
  };
  return { env, calls };
}

(async () => {
  section("Nhận biết trình duyệt");
  check("có PasswordCredential + credentials.get → hỗ trợ", savedLoginSupported(fakeEnv().env));
  check("thiếu PasswordCredential (Firefox/Safari) → không hỗ trợ", !savedLoginSupported(fakeEnv({ noPasswordCredential: true }).env));
  check("thiếu navigator.credentials → không hỗ trợ", !savedLoginSupported(fakeEnv({ noCredentials: true }).env));
  check("môi trường rỗng (máy chủ vẽ trang) → không hỗ trợ, không ném", savedLoginSupported({}) === false);

  section("readSavedLogin: chỉ xin ÂM THẦM");
  const ok = fakeEnv({ cred: { type: "password", id: "an@test.local", password: "Passw0rd!" } });
  const r1 = await readSavedLogin(ok.env);
  check("trả đúng id + mật khẩu đã lưu", r1?.id === "an@test.local" && r1?.password === "Passw0rd!", r1);
  const opt = ok.calls.get[0] as { password?: boolean; mediation?: string };
  check("gọi get với password:true và mediation 'silent' (không hiện hộp chọn tài khoản)", ok.calls.get.length === 1 && opt.password === true && opt.mediation === "silent", ok.calls.get);
  check("không có gì được lưu → null", (await readSavedLogin(fakeEnv().env)) === null);
  check("trình duyệt từ chối (NotAllowedError) → null, không ném", (await readSavedLogin(fakeEnv({ getThrows: true }).env)) === null);
  check("trình duyệt không hỗ trợ → null và KHÔNG gọi get", (await readSavedLogin(fakeEnv({ noPasswordCredential: true }).env)) === null);
  check("loại khác password (federated) → null", (await readSavedLogin(fakeEnv({ cred: { type: "federated", id: "a", provider: "https://accounts.google.com" } }).env)) === null);
  check("thiếu mật khẩu hoặc mật khẩu rỗng → null", (await readSavedLogin(fakeEnv({ cred: { type: "password", id: "a@b.c" } }).env)) === null && (await readSavedLogin(fakeEnv({ cred: { type: "password", id: "a@b.c", password: "" } }).env)) === null);
  check("id rỗng/toàn khoảng trắng → null", (await readSavedLogin(fakeEnv({ cred: { type: "password", id: "   ", password: "x" } }).env)) === null);
  check("id/mật khẩu không phải chuỗi → null", (await readSavedLogin(fakeEnv({ cred: { type: "password", id: 123, password: { x: 1 } } }).env)) === null);

  section("rememberLogin: nhờ trình duyệt lưu");
  const s1 = fakeEnv();
  await rememberLogin("an@test.local", "Passw0rd!", s1.env);
  const stored = s1.calls.store[0] as FakePasswordCredential | undefined;
  check("lưu đúng một PasswordCredential với id + mật khẩu vừa nhập", s1.calls.store.length === 1 && stored instanceof FakePasswordCredential && stored.data.id === "an@test.local" && stored.data.password === "Passw0rd!", s1.calls.store);
  const s2 = fakeEnv();
  await rememberLogin("", "Passw0rd!", s2.env); await rememberLogin("a@b.c", "", s2.env); await rememberLogin("  ", "x", s2.env);
  check("thiếu id hoặc mật khẩu → không lưu gì", s2.calls.store.length === 0, s2.calls.store);
  check("trình duyệt từ chối lưu → không ném", await rememberLogin("a@b.c", "x", fakeEnv({ storeThrows: true }).env).then(() => true, () => false));
  check("trình duyệt không hỗ trợ / thiếu store → không ném, không lưu", await Promise.all([
    rememberLogin("a@b.c", "x", fakeEnv({ noPasswordCredential: true }).env), rememberLogin("a@b.c", "x", fakeEnv({ noStore: true }).env), rememberLogin("a@b.c", "x", {}),
  ]).then(() => true, () => false));

  section("forgetSilentAccess: đăng xuất có chủ ý");
  const f1 = fakeEnv();
  await forgetSilentAccess(f1.env);
  check("gọi preventSilentAccess đúng một lần", f1.calls.prevent === 1);
  check("preventSilentAccess ném lỗi → nuốt", await forgetSilentAccess(fakeEnv({ preventThrows: true }).env).then(() => true, () => false));
  check("không có preventSilentAccess / môi trường rỗng → không ném", await Promise.all([forgetSilentAccess(fakeEnv({ noPrevent: true }).env), forgetSilentAccess({})]).then(() => true, () => false));

  section("Hằng số dùng chung với máy chủ");
  check("mã từ chối của quản trị là 'auto_not_allowed'", AUTO_NOT_ALLOWED === "auto_not_allowed");
  done();
})();
