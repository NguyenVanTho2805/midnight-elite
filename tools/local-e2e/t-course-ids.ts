// Mã lớp không được trùng tên một trang cố định: /lop-cua-toi/lich sẽ che lớp có mã "lich" (trang động [courseId] thua trang tĩnh).
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { api, mkSuper, mkTutor, wipe, check, section, done } from "./h";
import { RESERVED_COURSE_IDS, isReservedCourseId } from "@/lib/courseIds";

(async () => {
  section("Danh sách giữ chỗ khớp các trang cố định thật");
  const dir = join(process.cwd(), "src/app/lop-cua-toi");
  const statics: string[] = [];
  const scan = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (!statSync(p).isDirectory()) continue; if (/^\(.*\)$/.test(n)) scan(p); else if (!/^\[/.test(n)) { statics.push(n); } } };
  scan(dir);
  const missing = statics.filter(n => !RESERVED_COURSE_IDS.includes(n));
  check(`mọi đoạn cố định dưới /lop-cua-toi (${statics.join(", ")}) đều nằm trong danh sách giữ chỗ`, missing.length === 0, missing);
  check("danh sách giữ chỗ không chứa mã thừa không ứng với trang nào", RESERVED_COURSE_IDS.every(r => statics.includes(r)), RESERVED_COURSE_IDS.filter(r => !statics.includes(r)));
  check("isReservedCourseId: không phân biệt hoa thường/khoảng trắng; mã thường thì không", isReservedCourseId(" LICH ") && isReservedCourseId("hoc-phi") && !isReservedCourseId("toan-9") && !isReservedCourseId(undefined) && !isReservedCourseId(5));

  await wipe();
  section("API tạo lớp từ chối mã trùng trang cố định");
  const SA = await mkSuper("Quản trị"), T = await mkTutor("Cô Lan");
  const base = { name: "Lớp thử", adminName: "Lớp thử", shortTitle: "Lớp thử", category: "toan", instructor: "Cô Lan", teacherAvatar: "L", openDate: "01/01/2030", types: [], bg: "#fff", price: 0 };
  for (const id of ["lich", "lop", "hoc-phi", "tong-quan"]) {
    const r = await api("POST", "/api/courses", { as: SA, body: { ...base, id } });
    check(`tạo lớp mã "${id}" → 400 kèm lời giải thích`, r.status === 400 && /trùng tên một trang/.test(r.json?.error ?? ""), r);
  }
  const ok = await api("POST", "/api/courses", { as: T, body: { ...base, id: "toan-9-nang-cao" } });
  check("mã thường vẫn tạo được (201)", ok.status === 201 && ok.json?.id === "toan-9-nang-cao", ok);
  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
