// SCL-H (21/11/2026) — đo hiệu năng vỏ học sinh TRƯỚC/SAU, cùng một cách trên máy dev (số dev chỉ để so sánh tương đối, không phải số production).
//   1) HTML máy chủ trả cho /student/viec-cua-toi: có sẵn nội dung vỏ (tên module) hay chỉ khung "Đang tải"; số thẻ preload phông + tổng KB phông preload.
//   2) Trình duyệt mở /student/viec-cua-toi: số lần gọi /api/auth/me, /api/student/viec-cua-toi, /api/schedule; ms tới khi thấy tiêu đề.
//   3) loadStudentScheduleEvents với 2.000 đề của lớp khác + 5 đề của lớp em: ms (trung bình 5 lần, sau 1 lần làm nóng).
//   4) Hồ sơ: KB của /api/courses (cách cũ) và /api/student/lop (cách mới).
// XOÁ SẠCH DB thử (wipe). Cần máy chủ dev. Chạy: source tools/local-e2e/env.sh && TZ=Asia/Ho_Chi_Minh npx tsx tools/local-e2e/measure-scl-h.ts
import { BASE, mkTutor, mkUser, mkCourse, wipe, cookieFor } from "./h";
import { launch, ctxFor, closeAll } from "./ui";
import { prisma } from "@/lib/prisma";
import { loadStudentScheduleEvents } from "@/lib/studentSchedule";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Đo");
  const S = await mkUser({ name: "Học sinh đo" });
  const A = await mkCourse(T.id, { name: "Lớp đo" }), B = await mkCourse(T.id, { name: "Lớp khác" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: A.id, status: "active" } });
  const d = new Date(Date.now() + 3 * 86_400_000);
  const date = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
  const ex = (i: number, courseId: string) => ({ id: `m-${courseId}-${i}`, code: `m-${courseId}-${i}`, title: `Đề ${i}`, category: "Toán", date, time: "08:00", duration: "45", questions: 10, status: "available", createdAt: "2020", courseId });
  await prisma.exam.createMany({ data: [...Array.from({ length: 2000 }, (_, i) => ex(i, B.id)), ...Array.from({ length: 5 }, (_, i) => ex(i, A.id))] });

  // 3) truy vấn lịch
  await loadStudentScheduleEvents(S.id);
  const runs: number[] = [];
  let n = 0;
  for (let i = 0; i < 5; i++) { const t0 = performance.now(); n = (await loadStudentScheduleEvents(S.id)).length; runs.push(performance.now() - t0); }
  console.log(`lịch: ${n} sự kiện · ${(runs.reduce((a, b) => a + b, 0) / runs.length).toFixed(0)} ms trung bình (5 lần)`);

  // 1) HTML máy chủ
  const cookie = await cookieFor(S);
  const res = await fetch(`${BASE}/student/viec-cua-toi`, { headers: { cookie } });
  const html = await res.text();
  // Next gửi preload phông qua header HTTP `Link` (không phải thẻ <link> trong HTML).
  const preloads = (res.headers.get("link") ?? "").split(/,(?=\s*<)/).filter(l => /as="?font/.test(l)).map(l => /<([^>]+)>/.exec(l)?.[1]).filter((h): h is string => !!h);
  let fontBytes = 0;
  for (const h of preloads) fontBytes += (await (await fetch(new URL(h, BASE))).arrayBuffer()).byteLength;
  console.log(`HTML: ${(html.length / 1024).toFixed(0)} KB · có tên module "Lớp của tôi": ${html.includes("Lớp của tôi")} · preload phông: ${preloads.length} thẻ, ${(fontBytes / 1024).toFixed(0)} KB`);

  // 2) trình duyệt
  await launch();
  const ctx = await ctxFor(S);
  const pg = await ctx.newPage();
  const count: Record<string, number> = {};
  pg.on("request", r => { const p = new URL(r.url()).pathname; if (p.startsWith("/api/")) count[p] = (count[p] ?? 0) + 1; });
  await pg.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "networkidle", timeout: 120000 }); // làm nóng (biên dịch)
  for (const k of Object.keys(count)) delete count[k];
  const t0 = Date.now();
  await pg.goto(`${BASE}/student/viec-cua-toi`, { waitUntil: "commit" });
  await pg.getByRole("heading", { level: 1, name: "Việc của tôi" }).waitFor({ timeout: 90000 });
  const tHead = Date.now() - t0;
  await pg.waitForLoadState("networkidle");
  console.log(`trình duyệt: tiêu đề sau ${tHead} ms · gọi API: ${JSON.stringify(count)}`);

  // 4) hồ sơ
  const kb = async (p: string) => ((await (await fetch(`${BASE}${p}`, { headers: { cookie } })).text()).length / 1024).toFixed(1);
  console.log(`hồ sơ: /api/courses ${await kb("/api/courses")} KB · /api/student/lop ${await kb("/api/student/lop")} KB`);
  await closeAll();
  await prisma.$disconnect();
})().catch(async e => { console.error(e); await closeAll().catch(() => {}); process.exit(1); });
