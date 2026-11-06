// 2A (quyết định của Thọ 04/11/2026) (API + DB thật + hàm thuần) — GET /api/enrollments tách lớp ĐANG HỌC và lớp CHỜ PHỤ HUYNH ĐỒNG Ý.
//   courseIds                : chỉ hồ sơ status = active (như cũ — mọi nơi dùng nó để mở quyền học vẫn đúng).
//   pendingConsentCourseIds  : hồ sơ status = pending_consent CỦA CHÍNH NGƯỜI GỌI (thẻ lớp hiện nhãn thay cho nút theo dõi).
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-enrollments-pending-api.ts
//
// CA PHÁ CỐ Ý (mỗi lần một thứ rồi hoàn lại):
//   - enrollment.ts splitEnrollmentIds: cho `pending_consent` vào `courseIds` (đổi điều kiện nhánh) → ca "courseIds chỉ có lớp đang học" và ca thuần đỏ.
//   - enrollments/route.ts: bỏ `userId: session.userId` khỏi where → ca "chỉ hồ sơ của chính người gọi" đỏ.
//   - enrollments/route.ts: bỏ `PENDING_CONSENT` khỏi `status: { in: … }` → ca "lớp chờ phụ huynh có trong pendingConsentCourseIds" đỏ.
//   - enrollments/route.ts: bỏ `filter(active)` ở nhánh ?detail=1 → ca "detail: courses không có lớp chờ phụ huynh" đỏ.
import { prisma } from "@/lib/prisma";
import { api, mkUser, mkTutor, mkCourse, wipe, check, section, done } from "./h";
import { splitEnrollmentIds } from "@/lib/enrollment";

async function main() {
  section("Hàm thuần splitEnrollmentIds");
  const rows = [
    { courseId: "a", status: "active" }, { courseId: "b", status: "pending_consent" }, { courseId: "c", status: "suspended" },
    { courseId: "d", status: "active" }, { courseId: "e", status: "pending_consent" }, { courseId: "f", status: "khong-biet" }, { courseId: "a", status: "active" },
  ];
  const sp = splitEnrollmentIds(rows);
  check("đang học = a, d (đúng thứ tự, không trùng)", sp.courseIds.join() === "a,d", sp.courseIds);
  check("chờ phụ huynh = b, e", sp.pendingConsentCourseIds.join() === "b,e", sp.pendingConsentCourseIds);
  check("đã nghỉ (c) chỉ vào suspendedCourseIds; trạng thái lạ (f) không vào danh sách nào", sp.suspendedCourseIds.join() === "c" && ![...sp.courseIds, ...sp.pendingConsentCourseIds, ...sp.suspendedCourseIds].includes("f") && ![...sp.courseIds, ...sp.pendingConsentCourseIds].includes("c"), sp);
  const none = splitEnrollmentIds([]);
  check("rỗng → ba mảng rỗng", none.courseIds.length === 0 && none.pendingConsentCourseIds.length === 0 && none.suspendedCourseIds.length === 0);
  check("không lớp nào nằm ở cả hai danh sách", sp.courseIds.every(x => !sp.pendingConsentCourseIds.includes(x)));

  await wipe();
  const T = await mkTutor("Cô Lan");
  const [A, B, C, D] = [await mkCourse(T.id, { name: "Toán 9" }), await mkCourse(T.id, { name: "Lý 10" }), await mkCourse(T.id, { name: "Hoá 11" }), await mkCourse(T.id, { name: "Anh 12" })];
  const S = await mkUser({ name: "Em Một" }), O = await mkUser({ name: "Em Khác" });
  const enroll = (u: { id: string }, c: { id: string }, status: string, ms: number) => prisma.enrollment.create({ data: { userId: u.id, courseId: c.id, status, createdAt: new Date(Date.now() - ms) } });
  await enroll(S, A, "active", 4000); await enroll(S, B, "pending_consent", 3000); await enroll(S, C, "suspended", 2000);
  await enroll(O, D, "pending_consent", 1000);   // hồ sơ của NGƯỜI KHÁC: không được lộ

  section("API: học sinh có đủ ba loại hồ sơ");
  const r = await api("GET", "/api/enrollments", { as: S });
  check("200", r.status === 200, r.status);
  check("courseIds chỉ có lớp ĐANG HỌC (A)", JSON.stringify(r.json?.courseIds) === JSON.stringify([A.id]), r.json);
  check("pendingConsentCourseIds có lớp chờ phụ huynh (B)", JSON.stringify(r.json?.pendingConsentCourseIds) === JSON.stringify([B.id]), r.json);
  check("NO-0511: lớp đã nghỉ (C) CHỈ có trong suspendedCourseIds", JSON.stringify(r.json?.suspendedCourseIds) === JSON.stringify([C.id]) && !r.json?.courseIds.includes(C.id) && !r.json?.pendingConsentCourseIds.includes(C.id), r.json);
  check("không lộ hồ sơ của người khác (D)", !JSON.stringify(r.json).includes(D.id));
  check("chỉ có đúng 3 khoá", Object.keys(r.json ?? {}).sort().join() === "courseIds,pendingConsentCourseIds,suspendedCourseIds", Object.keys(r.json ?? {}));

  section("API: ?detail=1 (danh mục 'Lớp của tôi')");
  const d = await api("GET", "/api/enrollments?detail=1", { as: S });
  check("courseIds vẫn chỉ lớp đang học, có pendingConsentCourseIds", JSON.stringify(d.json?.courseIds) === JSON.stringify([A.id]) && JSON.stringify(d.json?.pendingConsentCourseIds) === JSON.stringify([B.id]), d.json);
  check("courses chỉ có lớp đang học (A), KHÔNG có lớp chờ phụ huynh (B)", d.json?.courses?.length === 1 && d.json.courses[0].id === A.id && !JSON.stringify(d.json.courses).includes(B.id), d.json?.courses);

  section("API: người khác và khách");
  const o = await api("GET", "/api/enrollments", { as: O });
  check("em khác: courseIds rỗng, pending chỉ lớp D, không thấy lớp đã nghỉ của S", o.json?.courseIds.length === 0 && o.json?.suspendedCourseIds?.length === 0 && JSON.stringify(o.json?.pendingConsentCourseIds) === JSON.stringify([D.id]), o.json);
  const g = await api("GET", "/api/enrollments");
  check("khách: 200 với ba mảng rỗng (không lộ gì)", g.status === 200 && g.json?.courseIds?.length === 0 && g.json?.pendingConsentCourseIds?.length === 0 && g.json?.suspendedCourseIds?.length === 0, g.json);
  const gd = await api("GET", "/api/enrollments?detail=1");
  check("khách ?detail=1: cũng hai mảng rỗng", gd.status === 200 && gd.json?.courseIds?.length === 0 && gd.json?.pendingConsentCourseIds?.length === 0, gd.json);
  const bad = await api("GET", "/api/enrollments", { headers: { cookie: "midnight_session=khong-phai-phien-that" } });
  check("cookie phiên rác = khách", bad.status === 200 && bad.json?.pendingConsentCourseIds?.length === 0, bad.json);

  section("NO-0511: hồ sơ đã nghỉ vẫn bị từ chối theo dõi (nhãn thay nút chỉ là giao diện)");
  const fs = await api("POST", `/api/followed-courses/${C.id}`, { as: S });
  check("POST theo dõi lớp C (đã nghỉ) → 409", fs.status === 409, fs.status);

  section("Theo dõi lớp: hồ sơ chờ phụ huynh vẫn bị từ chối (không đổi hành vi máy chủ)");
  const f = await api("POST", `/api/followed-courses/${B.id}`, { as: S });
  check("POST theo dõi lớp B (chờ phụ huynh) → 409", f.status === 409, f.status);
  const f2 = await api("POST", `/api/followed-courses/${D.id}`, { as: S });
  check("POST theo dõi lớp D (em chưa vào) → 200", f2.status === 200, f2.status);
  done();
}
main().catch(e => { console.error("TEST CRASH", e); process.exit(1); });
