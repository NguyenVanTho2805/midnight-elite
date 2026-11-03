// BU-03 P3 — API Kết quả đề: GET /api/tutor/de-thi/[id]/ket-qua (5 khối, KHÔNG tên học sinh) và /ket-qua/bang-diem (CÓ tên, chỉ gia sư chủ).
// Cần máy chủ dev (BASE) + DB RIÊNG; wipe() ở đầu bài. Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-exam-results.ts
// Số liệu dựng tay (xem mkResultsWorld trong bu03.ts): lượt nộp 4, học sinh 3, điểm 4 · 9 · 6 · 8 → TB 6,75 · trung vị 7 · cao 9 · thấp 4 · đạt 3/4; phân bố % [0,0,1,1,2];
// mã 101: 3 lượt TB 6,33; mã 102: 1 lượt TB 8; câu 1 gộp 4 lượt (3 đúng) xuyên hai mã; câu 2 sai hết → "cần xem lại".
// Ca phá bằng thiết kế (sửa mã → đúng ca đó đỏ): loadKetQua chọn cột name → ca "JSON không chứa tên" đỏ (có ĐỐI CHỨNG bang-diem phải chứa tên — để ca 'không chứa' không đậu giả);
//   bỏ kiểm IS_VARIANT → ca id mã con đỏ; tính cả lượt đang làm dở → attempts = 5; không gộp theo variantKey → câu 1 chỉ 3 lượt; chọn lượt sai (dau/cuoi/cao-nhat) → ca bảng điểm đỏ.
import { api, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { variantKey } from "@/lib/deThiVariants";
import { mkActors, mkDraft, mkResultsWorld, RES_NAMES, snap } from "./bu03";

const KQ = (id: string) => `/api/tutor/de-thi/${id}/ket-qua`, BD = (id: string, q = "") => `/api/tutor/de-thi/${id}/ket-qua/bang-diem${q}`;
const near = (x: unknown, y: number, tol = 0.011) => typeof x === "number" && Math.abs(x - y) <= tol;

(async () => {
  await wipe();
  const a = await mkActors();
  const { A, B } = a;
  const W = await mkResultsWorld(A, a.courseA.id);
  const emails = W.s.map(u => u.email);
  const ks = (q: (typeof W.rootQ)[number]) => variantKey({ type: q.type, text: q.text, options: q.options.map(o => ({ text: o.text, isCorrect: o.isCorrect })) });

  section("ket-qua: năm khối đúng số tính tay");
  const r = await api("GET", KQ(W.root), { as: A });
  const k = r.json;
  check("200 + đủ năm khối: basic, distribution, frequency, questions, variants", r.status === 200 && ["basic", "distribution", "frequency", "questions", "variants"].every(x => x in k), Object.keys(k ?? {}));
  check("Cache-Control: no-store", /no-store/.test(r.headers.get("cache-control") ?? ""));
  const b = k?.basic ?? {};
  check("cơ bản: 4 lượt ĐÃ NỘP (lượt đang làm dở của Delta không tính), 3 học sinh", b.attempts === 4 && b.students === 3, b);
  check("cơ bản: TB 6,75 · trung vị 7 · cao nhất 9 · thấp nhất 4 (thang 10)", near(b.avg, 6.75) && near(b.median, 7) && b.max === 9 && b.min === 4, b);
  check("cơ bản: tỉ lệ đạt (từ 5/10) = 3/4 = 0,75 (thang 0–1)", near(b.passRate, 0.75, 0.001), b.passRate);
  check("cơ bản: thời gian làm TB = (600+1200+900+300)/4 = 750 giây", near(b.avgDurationSec, 750, 1), b.avgDurationSec);
  check("phân bố 5 khoảng %: [0–<20, 20–<40, 40–<60, 60–<80, 80–100] = [0,0,1,1,2] (4→40%, 6→60%, 8 và 9 → 80%+)", JSON.stringify(k?.distribution?.map((x: any) => x.count)) === "[0,0,1,1,2]" && k.distribution.length === 5, k?.distribution);
  const fq = (s: number) => k?.frequency?.find((x: any) => near(x.score, s, 0.001))?.count;
  check("tần số bước 0,5: điểm 4 → 1, 6 → 1, 8 → 1, 9 → 1, điểm 5 → 0 hoặc không có; tổng = 4", fq(4) === 1 && fq(6) === 1 && fq(8) === 1 && fq(9) === 1 && !fq(5) && k.frequency.reduce((s: number, x: any) => s + x.count, 0) === 4, k?.frequency);
  const v = k?.variants ?? [];
  check("theo mã đề: 101 → 3 lượt TB 6,33; 102 → 1 lượt TB 8", v.length === 2 && v[0].code === 101 && v[0].attempts === 3 && near(v[0].avg, 6.33) && v[1].code === 102 && v[1].attempts === 1 && near(v[1].avg, 8), v);
  const q1 = k?.questions?.find((x: any) => x.variantKey === ks(W.rootQ[0])), q2 = k?.questions?.find((x: any) => x.variantKey === ks(W.rootQ[1]));
  check("từng câu: 5 câu (gộp theo variantKey, không nhân đôi theo mã đề)", k?.questions?.length === 5, k?.questions?.map((x: any) => x.order));
  check("câu 1: GỘP hai mã đề → 4 lượt trả lời, 3 đúng = 0,75, không cần xem lại", q1?.answered === 4 && near(q1.correctRate, 0.75, 0.001) && q1.flagged === false, q1);
  check("câu 2: 3 lượt, 0 đúng → correctRate 0 và flagged = true ('cần xem lại': đúng < 30% và ≥ 3 lượt)", q2?.answered === 3 && q2.correctRate === 0 && q2.flagged === true, q2);

  section("ket-qua: KHÔNG có tên học sinh (và đối chứng: bang-diem có)");
  {
    const leak = [...RES_NAMES, ...emails, "Alpha", "Gamma", ...W.s.map(u => u.id)].filter(x => r.text.includes(x));
    check("JSON ket-qua không chứa tên, email hay id của học sinh nào", leak.length === 0, leak);
    check("không có khoá studentName / name / email / userId trong JSON", !/"(studentName|name|email|userId)"/.test(r.text), r.text.slice(0, 200));
    const bd = await api("GET", BD(W.root), { as: A });
    check("ĐỐI CHỨNG: bang-diem CÓ tên (nên ca 'không chứa tên' ở trên có thể đỏ nếu lộ)", RES_NAMES.slice(0, 3).every(n => bd.text.includes(n)), bd.text.slice(0, 200));
    check("bang-diem không lộ email hay id người dùng", !emails.some(e => bd.text.includes(e)) && !W.s.some(u => bd.text.includes(u.id)));
    const bs = await api("GET", BD(W.root), { as: B });
    check("gia sư B xin bang-diem của đề A → 403 và phản hồi không chứa tên", bs.status === 403 && !RES_NAMES.some(n => bs.text.includes(n)), [bs.status, bs.text.slice(0, 120)]);
    const ks2 = await api("GET", KQ(W.root), { as: B });
    check("gia sư B xin ket-qua của đề A → 403", ks2.status === 403, ks2.status);
  }

  section("bang-diem: một dòng mỗi học sinh theo lựa chọn dau / cuoi / cao-nhat");
  {
    const rows = async (q = "") => (await api("GET", BD(W.root, q), { as: A })).json?.rows as any[];
    const def = await rows();
    check("mặc định = cao-nhat: 3 dòng (Delta đang làm dở không có dòng), xếp theo tên Alpha < Beta < Gamma", def?.length === 3 && def.map(x => x.studentName).join("|") === `${RES_NAMES[0]}|${RES_NAMES[1]}|${RES_NAMES[2]}`, def);
    check("cao-nhat: Alpha 9 (lượt cao hơn), Beta 6, Gamma 8", def?.map(x => x.score).join() === "9,6,8", def?.map(x => x.score));
    const dau = await rows("?chon=dau"), cuoi = await rows("?chon=cuoi"), cn = await rows("?chon=cao-nhat");
    check("dau: Alpha lấy lượt NỘP SỚM NHẤT = 4", dau?.find(x => x.studentName === RES_NAMES[0])?.score === 4, dau);
    check("cuoi: Alpha lấy lượt NỘP MUỘN NHẤT = 9", cuoi?.find(x => x.studentName === RES_NAMES[0])?.score === 9, cuoi);
    check("cao-nhat tường minh giống mặc định", JSON.stringify(cn) === JSON.stringify(def));
    check("mỗi học sinh đúng một dòng ở cả ba lựa chọn", [dau, cuoi, cn].every(x => x?.length === 3));
    const g = def?.find(x => x.studentName === RES_NAMES[2]);
    check("Gamma làm MÃ CON → variantNo 2; thời gian làm 300 giây", g?.variantNo === 2 && g.durationSec === 300, g);
    const be = def?.find(x => x.studentName === RES_NAMES[1]);
    check("Beta: số lần rời màn hình 3 (chỉ ĐỌC, KiN chỉ ghi nhận), thời gian 900 giây, có giờ nộp ISO", be?.tabSwitchCount === 3 && be.durationSec === 900 && !Number.isNaN(Date.parse(be.submittedAt)), be);
    const bad = await api("GET", BD(W.root, "?chon=tat-ca"), { as: A });
    check("chon lạ → 400 BAD_CHON", bad.status === 400 && bad.json?.code === "BAD_CHON", [bad.status, bad.json]);
    check("ket-qua/bang-diem là CHỈ ĐỌC: gọi nhiều lần DB không đổi", await (async () => { const s0 = await snap(); await rows(); await rows("?chon=dau"); await api("GET", KQ(W.root), { as: A }); return (await snap()) === s0; })());
  }

  section("id mã đề con → 400 IS_VARIANT; id không có → 404; đề chưa có lượt nộp → 200 rỗng");
  {
    for (const [label, path] of [["ket-qua", KQ(W.child)], ["bang-diem", BD(W.child)], ["xuat-xlsx", KQ(W.child) + "/xuat-xlsx"]] as const) {
      const x = await api("GET", path, { as: A });
      check(`${label} với id MÃ CON → 400 IS_VARIANT kèm variantOfId`, x.status === 400 && x.json?.code === "IS_VARIANT" && x.json?.variantOfId === W.root, [x.status, x.json]);
    }
    check("id không có → 404 (cả ket-qua và bang-diem)", (await api("GET", KQ("khong-co"), { as: A })).status === 404 && (await api("GET", BD("khong-co"), { as: A })).status === 404);
    const empty = await mkDraft(A, { n: 2, courseId: a.courseA.id });
    const e1 = await api("GET", KQ(empty), { as: A }), e2 = await api("GET", BD(empty), { as: A });
    check("đề chưa ai nộp → 200: 0 lượt, avg/median/max/min/passRate = null, phân bố toàn 0, không câu nào bị gắn cờ", e1.status === 200 && e1.json.basic.attempts === 0 && ["avg", "median", "max", "min", "passRate"].every(x => e1.json.basic[x] === null) && e1.json.distribution.every((d: any) => d.count === 0) && e1.json.questions.every((q: any) => !q.flagged), e1.json);
    check("đề chưa ai nộp → bang-diem 200 với rows = []", e2.status === 200 && Array.isArray(e2.json?.rows) && e2.json.rows.length === 0, e2.json);
  }

  section("Tổng điểm lệch giữa các mã được quy về thang đề gốc");
  {
    // mã con có tổng điểm khác gốc (20): lượt 10/20 ở mã con phải ra 5/10 (50%), không phải 10.
    await prisma.exam.update({ where: { id: W.child }, data: { totalPoints: 20 } });
    await prisma.examAttempt.update({ where: { id: W.attempts.s3 }, data: { score: 10, totalPoints: 20 } });
    const rr = await api("GET", BD(W.root), { as: A });
    const gm = rr.json?.rows?.find((x: any) => x.studentName === RES_NAMES[2]);
    check("Gamma 10/20 ở mã con (tổng 20) → hiện 5 trên thang 10 của đề gốc", near(gm?.score, 5), gm);
  }

  await done();
})().catch(e => { console.error(e); process.exit(1); });
