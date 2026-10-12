import { api, mkUser, mkTutor, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { readPreferences, applyPreferencesPatch, visibleTutorModules, reminderChannels, TUTOR_MODULES } from "@/lib/userPreferences";

const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  await wipe();

  section("Lib: đọc khoan dung");
  check("null/chuỗi/mảng → {}", eq(readPreferences(null), {}) && eq(readPreferences("x"), {}) && eq(readPreferences([1]), {}));
  check("bỏ khoá lạ và giá trị hỏng", eq(readPreferences({ modules: ["lop", "zzz", "lop", "hop-viec"], theme: "hong", mode: "toi", evil: 1 }), { modules: ["hop-viec", "lop"], mode: "toi" }));
  check("reminders thiếu trường → mặc định bật", eq(readPreferences({ reminders: { parent: false } }).reminders, { parent: false, student: true }));

  section("Lib: chế độ gọn mặc định");
  check("chưa chọn gì → chỉ Lịch + Học phí", eq(visibleTutorModules({}).map(m => m.key), ["lich", "hoc-phi"]));
  check("bật Lớp + Hộp việc → đúng thứ tự thanh bên", eq(visibleTutorModules({ modules: ["lop", "hop-viec"] }).map(m => m.key), ["hop-viec", "lich", "lop", "hoc-phi"]));
  check("bật hết → đủ 6 module", visibleTutorModules({ modules: ["hop-viec", "lop", "bai-kt", "thu-vien"] }).length === TUTOR_MODULES.length);
  check("nhắc lịch mặc định bật cả hai bên", eq(reminderChannels({}), { parent: true, student: true }) && eq(reminderChannels({ reminders: { parent: true, student: false } }), { parent: true, student: false }));

  section("Lib: bản vá nghiêm");
  const r1 = applyPreferencesPatch({}, { modules: ["lich", "lop", "hoc-phi"] });
  check("lich/hoc-phi trong modules được bỏ qua (luôn bật)", r1.ok && eq(r1.value.modules, ["lop"]));
  check("module lạ bị từ chối", !applyPreferencesPatch({}, { modules: ["lop", "abc"] }).ok);
  check("khoá lạ bị từ chối", !applyPreferencesPatch({}, { role: "admin" }).ok);
  check("sai kiểu bị từ chối", !applyPreferencesPatch({}, { theme: 5 }).ok && !applyPreferencesPatch({}, { reminders: { parent: "yes" } }).ok && !applyPreferencesPatch({}, [] as unknown).ok && !applyPreferencesPatch({}, null).ok);
  check("reminders gộp từng phần", eq((applyPreferencesPatch({ reminders: { parent: true, student: true } }, { reminders: { student: false } }) as any).value.reminders, { parent: true, student: false }));
  check("null xoá khoá", eq((applyPreferencesPatch({ theme: "man", mode: "toi" }, { theme: null }) as any).value, { mode: "toi" }));
  check("vá dở không ghi: 1 khoá sai thì cả bản vá hỏng", !applyPreferencesPatch({ theme: "man" }, { mode: "toi", theme: "xxx" }).ok);

  section("API /api/users/me/preferences");
  const u = await mkUser({ name: "Em Học" });
  const tutor = await mkTutor("Cô Lan");
  check("chưa đăng nhập → 401", (await api("GET", "/api/users/me/preferences")).status === 401 && (await api("PUT", "/api/users/me/preferences", { body: {} })).status === 401);
  let r = await api("GET", "/api/users/me/preferences", { as: tutor });
  check("tài khoản mới: preferences rỗng", r.status === 200 && eq(r.json.preferences, {}), r.json);
  r = await api("PUT", "/api/users/me/preferences", { as: tutor, body: { modules: ["lop", "hop-viec"] } });
  check("bật Lớp + Hộp việc", r.status === 200 && eq(r.json.preferences.modules, ["hop-viec", "lop"]), r.json);
  r = await api("PUT", "/api/users/me/preferences", { as: tutor, body: { theme: "ca-phe", mode: "toi" } });
  check("đổi chủ đề không làm mất module đã bật", r.status === 200 && eq(r.json.preferences, { modules: ["hop-viec", "lop"], theme: "ca-phe", mode: "toi" }), r.json);
  r = await api("GET", "/api/users/me/preferences", { as: tutor });
  check("đọc lại đúng (lưu theo tài khoản, không theo máy)", eq(r.json.preferences, { modules: ["hop-viec", "lop"], theme: "ca-phe", mode: "toi" }));
  check("tài khoản khác không bị ảnh hưởng", eq((await api("GET", "/api/users/me/preferences", { as: u })).json.preferences, {}));
  r = await api("PUT", "/api/users/me/preferences", { as: tutor, body: { modules: ["abc"] } });
  check("module lạ → 400 + không ghi", r.status === 400 && eq((await api("GET", "/api/users/me/preferences", { as: tutor })).json.preferences.modules, ["hop-viec", "lop"]), r.json);
  r = await api("PUT", "/api/users/me/preferences", { as: tutor, body: { role: "admin_super" } });
  check("không nhét được khoá ngoài danh sách (vd role)", r.status === 400);
  r = await api("PUT", "/api/users/me/preferences", { as: tutor, raw: "{không phải json", headers: { "content-type": "application/json" } });
  check("JSON hỏng → 400", r.status === 400);
  r = await api("PUT", "/api/users/me/preferences", { as: tutor, body: { modules: null } });
  check("modules:null → về chế độ gọn", r.status === 200 && r.json.preferences.modules === undefined && r.json.preferences.theme === "ca-phe", r.json);

  section("Hai tab ghi cùng lúc không đè nhau");
  await Promise.all([
    api("PUT", "/api/users/me/preferences", { as: u, body: { theme: "man" } }),
    api("PUT", "/api/users/me/preferences", { as: u, body: { modules: ["bai-kt"] } }),
    api("PUT", "/api/users/me/preferences", { as: u, body: { reminders: { parent: false } } }),
    api("PUT", "/api/users/me/preferences", { as: u, body: { mode: "sang" } }),
  ]);
  const fin = (await api("GET", "/api/users/me/preferences", { as: u })).json.preferences;
  check("đủ cả 4 thay đổi", fin.theme === "man" && eq(fin.modules, ["bai-kt"]) && fin.reminders?.parent === false && fin.mode === "sang", fin);
  const raw = await prisma.user.findUnique({ where: { id: u.id }, select: { preferences: true } });
  check("DB lưu JSON đúng", typeof raw?.preferences === "object");

  await done();
})().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
