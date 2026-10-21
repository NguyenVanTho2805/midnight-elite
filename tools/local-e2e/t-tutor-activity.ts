// ĐX-05 (NC1-063) — "có dạy trong 30 ngày qua" + số buổi đã dạy + thứ tự mặc định, với dữ liệu thật.
// Điều quan trọng nhất: cùng một gia sư phải ra CÙNG số ở danh sách (/api/tutors) và hồ sơ (/api/tutors/[id]).
// Cần Postgres + Next dev (xem README). Phần thuần đã có ở t-tutor-activity-lib.ts.
import { BASE, mkTutor, mkCourse, mkAttendanceSession, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { vnDateKeyOf } from "@/lib/classSessions";

const DAY = 86_400_000;
const dateOf = (daysAgo: number) => new Date(`${vnDateKeyOf(new Date(Date.now() - daysAgo * DAY))}T00:00:00Z`);
const get = async (path: string) => { const r = await fetch(BASE + path); return { status: r.status, json: await r.json() as any }; };

(async () => {
  await wipe();
  // Tên chọn sao cho thứ tự theo tên (tiếng Việt) là: An · Bình · Chi · Dũng · Em · Giang · Hà
  const A = await mkTutor("An Hoạt Động"), B = await mkTutor("Bình Cũ"), C = await mkTutor("Chi Mới Vào"), D = await mkTutor("Dũng Chỉ Có Phép"),
    E = await mkTutor("Em Lớp Đã Tắt"), F = await mkTutor("Giang Buổi Tương Lai"), G = await mkTutor("Hà Sát Mốc");
  const cA = await mkCourse(A.id, { name: "Toán A" }), cB = await mkCourse(B.id), cC = await mkCourse(C.id), cD = await mkCourse(D.id), cE = await mkCourse(E.id), cF = await mkCourse(F.id);
  const cG1 = await mkCourse(G.id, { name: "G đúng mốc" });

  // A: 3 buổi trong 30 ngày qua (5, 12, 29 ngày trước) + 2 buổi cũ (60, 90 ngày) → 5 buổi, đang hoạt động
  for (const n of [5, 12, 29, 60, 90]) await mkAttendanceSession(cA.id, A.id, dateOf(n));
  // B: chỉ có buổi cũ (45 và 60 ngày trước) → 2 buổi, KHÔNG hoạt động gần đây
  for (const n of [45, 60]) await mkAttendanceSession(cB.id, B.id, dateOf(n));
  // C: chưa có buổi nào
  void cC;
  // D: buổi gần đây nhưng chỉ có "có phép" (không phải buổi đã dạy) và một phiên rỗng
  await mkAttendanceSession(cD.id, D.id, dateOf(3), ["excused"]);
  await mkAttendanceSession(cD.id, D.id, dateOf(4), []);
  // E: có buổi gần đây nhưng lớp đã tắt (status = false) → hồ sơ không tính lớp tắt
  await mkAttendanceSession(cE.id, E.id, dateOf(2));
  await prisma.course.update({ where: { id: cE.id }, data: { status: false } });
  // F: chỉ có buổi ở TƯƠNG LAI (ngày mai) → chưa dạy
  await mkAttendanceSession(cF.id, F.id, dateOf(-1));
  // G: hai lớp, một buổi đúng ngày mốc (30 ngày trước, còn tính) ở lớp 1; lớp 2 chỉ có buổi 31 ngày trước (ra ngoài cửa sổ)
  const cG2 = await mkCourse(G.id, { name: "G ngoài mốc" });
  await mkAttendanceSession(cG1.id, G.id, dateOf(30));
  await mkAttendanceSession(cG2.id, G.id, dateOf(31));

  section("Hồ sơ chi tiết /api/tutors/[id]");
  const st = async (t: { id: string }) => (await get(`/api/tutors/${t.id}`)).json.stats;
  const sa = await st(A), sb = await st(B), sc = await st(C), sd = await st(D), se = await st(E), sf = await st(F), sg = await st(G);
  check("A: 5 buổi đã dạy, có dạy trong 30 ngày qua", sa.sessionsTaught === 5 && sa.recentlyActive === true, sa);
  check("B: 2 buổi nhưng đều cũ → KHÔNG hoạt động gần đây", sb.sessionsTaught === 2 && sb.recentlyActive === false, sb);
  check("C: chưa có buổi nào → 0 và không hoạt động", sc.sessionsTaught === 0 && sc.recentlyActive === false, sc);
  check("D: buổi chỉ có 'có phép' và phiên rỗng KHÔNG phải buổi đã dạy → 0, không hoạt động", sd.sessionsTaught === 0 && sd.recentlyActive === false, sd);
  check("E: lớp đã tắt không tính (cả số buổi lẫn hoạt động)", se.sessionsTaught === 0 && se.recentlyActive === false, se);
  check("F: buổi ở tương lai chưa tính", sf.sessionsTaught === 0 && sf.recentlyActive === false, sf);
  check("G: đúng ngày mốc (30 ngày trước) vẫn tính; buổi 31 ngày trước thì ra ngoài cửa sổ nhưng vẫn là buổi đã dạy", sg.recentlyActive === true && sg.sessionsTaught === 2, sg);

  section("Danh sách /api/tutors — cùng số với hồ sơ");
  const def = await get("/api/tutors");
  check("200 và đủ 7 gia sư", def.status === 200 && def.json.items.length === 7, def.json.items?.length);
  const row = (n: string) => def.json.items.find((x: any) => x.name === n);
  check("mỗi gia sư: sessionsTaught và recentlyActive Ở DANH SÁCH = Ở HỒ SƠ (không bao giờ lệch)",
    [[A, sa], [B, sb], [C, sc], [D, sd], [E, se], [F, sf], [G, sg]].every(([t, s]: any) => { const r = def.json.items.find((x: any) => x.id === t.id); return r.sessionsTaught === s.sessionsTaught && r.recentlyActive === s.recentlyActive; }));
  check("danh sách không lộ thêm trường nhạy cảm (không email, không số điện thoại)", !/email|phone/i.test(JSON.stringify(def.json.items[0])));

  section("Thứ tự mặc định");
  const order = (j: any) => j.items.map((x: any) => x.name.split(" ")[0]).join(",");
  // đang hoạt động trước: A (5 buổi) rồi G (2 buổi) ; không hoạt động: B (2 buổi) rồi các gia sư 0 buổi theo tên
  check("mặc định: gia sư đang hoạt động trước (A, G), rồi theo số buổi (B), rồi theo tên (C, D, E, F)", order(def.json) === "An,Hà,Bình,Chi,Dũng,Em,Giang", order(def.json));
  check("sort thiếu / sai giá trị → cùng thứ tự mặc định", order((await get("/api/tutors?sort=")).json) === order(def.json) && order((await get("/api/tutors?sort=ngau-nhien")).json) === order(def.json));
  check("sort=active tường minh = mặc định", order((await get("/api/tutors?sort=active")).json) === order(def.json));
  check("sort=rating: chưa ai có đánh giá nên xếp theo tên", order((await get("/api/tutors?sort=rating")).json) === "An,Bình,Chi,Dũng,Em,Giang,Hà", order((await get("/api/tutors?sort=rating")).json));
  check("sort=classes: Hà có 2 lớp nên lên đầu, còn lại theo tên", order((await get("/api/tutors?sort=classes")).json).startsWith("Hà,"), order((await get("/api/tutors?sort=classes")).json));
  check("lọc theo môn vẫn dùng được cùng sắp xếp mặc định", (await get("/api/tutors?subject=khong-co-mon")).json.items.length === 0);

  section("Gia sư chưa duyệt / bị khoá vẫn không lộ");
  await prisma.user.update({ where: { id: A.id }, data: { profileLockedAt: new Date() } });
  check("hồ sơ bị khoá: biến khỏi danh sách và hồ sơ trả 404 (không đổi so với trước)", (await get("/api/tutors")).json.items.every((x: any) => x.id !== A.id) && (await get(`/api/tutors/${A.id}`)).status === 404);

  done();
})().catch(e => { console.error("CRASH", e); process.exit(1); });
