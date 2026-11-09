// BU-HS-NOP-TEP — cron dọn tệp nộp bài hết hạn: CHỨNG MINH chỉ xoá đúng tệp quá hạn. Cần DB test (có bảng submission_files: `prisma db push`), KHÔNG cần Cloudinary:
// kho là đĩa cục bộ (driver "local", thư mục KIN_MEDIA_DIR), lỗi xoá kho / lỗi DB được TIÊM qua tham số `deps` của runNopTepExpiry (bộ giả chỉ nằm ở đây, không có trong src/).
// Phần HTTP (xác thực cron) cần máy chủ thử ở BASE với CRON_SECRET giống bài test; thiếu CRON_SECRET thì phần đó bị bỏ qua và nói rõ.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-nop-tep-het-han.ts     (CẢNH BÁO: gọi wipe() — chỉ dùng DB test)
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { prisma } from "@/lib/prisma";
import { localPathFor } from "@/lib/mediaStorageServer";
import { checkCronAuth } from "@/lib/cronAuth";
import { CRON_JOBS, cronSettingKey } from "@/lib/adminOps";
import { NOP_TEP_MIME_BY_EXT, isNopTepExpired, nopTepExpiresAt } from "@/lib/nopTep";
import { cloudinaryNopTepPublicId } from "@/lib/nopTepServer";
import { runNopTepExpiry } from "@/lib/nopTepExpiryServer";
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done, BASE } from "./h";

const DAY = 86_400_000, HR = 3_600_000;
const NOW = new Date();
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const stamp = Date.now().toString(36);
let seq = 0;
const SECRET = process.env.CRON_SECRET ?? "";

(async () => {
  await wipe();
  const T = await mkTutor("Gia sư A");
  const S = await mkUser({ name: "Nguyễn Văn Bé" }), S2 = await mkUser({ name: "Học sinh hai" }), S3 = await mkUser({ name: "Học sinh ba" });
  const C = await mkCourse(T.id, { name: "Lớp cron" });
  const sec = await prisma.section.create({ data: { id: `sec-${stamp}`, title: "Phần 1", order: 1, courseId: C.id } });
  const ch = await prisma.chapter.create({ data: { id: `ch-${stamp}`, title: "Chương 1", order: 1, sectionId: sec.id } });
  const mkAsg = async (n: number) => {
    const l = await prisma.lesson.create({ data: { id: `les-${stamp}-${n}`, code: `B${n}`, title: `Bài ${n}`, type: "record", order: n, chapterId: ch.id, isLocked: false, isFree: false } as never });
    return prisma.assignment.create({ data: { id: `asg-${stamp}-${n}`, lessonId: l.id, title: `Bài tập ${n}`, mode: "file", maxPoints: 10, ownerId: T.id } });
  };
  const A1 = await mkAsg(1), A2 = await mkAsg(2), A3 = await mkAsg(3);

  // Bài nộp có điểm + nhận xét (không được đổi dù tệp bị xoá).
  const subGraded = await prisma.assignmentSubmission.create({ data: { assignmentId: A1.id, userId: S.id, kind: "tep", fileUrl: "/api/media/nop-bai/tf-61d-aaaa", fileName: "Nguyen Van Be - Toan.docx", score: 8.5, comment: "Làm tốt, chú ý bước 3.", gradedAt: ago(10 * DAY), gradedBy: T.id, submittedAt: ago(62 * DAY) } });
  const subOther = await prisma.assignmentSubmission.create({ data: { assignmentId: A2.id, userId: S2.id, kind: "tep", fileUrl: "/api/media/nop-bai/tf-other-aaa", fileName: "hs2.docx", score: 6, comment: "ok", gradedAt: ago(5 * DAY), gradedBy: T.id, submittedAt: ago(70 * DAY) } });
  // Bài nộp CŨ (kind "file", URL Cloudinary công khai, không có SubmissionFile): cron không bao giờ được đụng.
  const subOld = await prisma.assignmentSubmission.create({ data: { assignmentId: A3.id, userId: S3.id, kind: "file", fileUrl: "https://res.cloudinary.com/x/raw/upload/assignments/submissions/cu.pdf", fileName: "cu.pdf", score: 7, comment: "cũ", gradedAt: ago(100 * DAY), gradedBy: T.id, submittedAt: ago(200 * DAY) } });

  type Spec = { id: string; asg: typeof A1; user: typeof S; status: string; createdAt: Date; submissionId: string | null; deletedAt?: Date | null; disk?: boolean };
  const keyOf = (s: Spec) => cloudinaryNopTepPublicId(C.id, s.asg.id, s.id, "docx");
  const docxBytes = Buffer.from("PK-giả-lập-nội-dung-bài-làm");
  async function seed(specs: Spec[]) {
    for (const s of specs) {
      await prisma.submissionFile.create({
        data: {
          id: s.id, kind: "student", assignmentId: s.asg.id, submissionId: s.submissionId, studentUserId: s.user.id, ownerUserId: s.user.id, courseId: C.id, driver: "local",
          storageKey: keyOf(s), originalName: "Nguyen Van Be - Toan.docx", ext: "docx", mimeType: NOP_TEP_MIME_BY_EXT.docx, sizeBytes: docxBytes.length, status: s.status,
          createdAt: s.createdAt, expiresAt: nopTepExpiresAt(s.createdAt), readyAt: s.status === "pending" ? null : s.createdAt, deletedAt: s.deletedAt ?? null,
          removedAt: s.status === "removed" ? ago(DAY) : null, expiredAt: s.status === "expired" ? ago(DAY) : null,
        },
      });
      if (s.disk !== false) { const p = localPathFor(keyOf(s)); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, docxBytes); }
    }
  }
  const onDisk = (s: Spec) => existsSync(localPathFor(keyOf(s)));
  const snap = async () => JSON.stringify(await prisma.submissionFile.findMany({ orderBy: { id: "asc" } }));
  const subSnap = async () => JSON.stringify(await prisma.assignmentSubmission.findMany({ orderBy: { id: "asc" } }));
  const row = (id: string) => prisma.submissionFile.findUnique({ where: { id } });

  const sp = {
    r59: { id: `tf-59d-${stamp}`, asg: A1, user: S, status: "ready", createdAt: ago(59 * DAY), submissionId: subGraded.id },
    r599: { id: `tf-59.9d-${stamp}`, asg: A1, user: S, status: "ready", createdAt: ago(59.9 * DAY), submissionId: subGraded.id },
    r601: { id: `tf-60.1d-${stamp}`, asg: A1, user: S, status: "ready", createdAt: ago(60.1 * DAY), submissionId: subGraded.id },
    r61: { id: `tf-61d-${stamp}`, asg: A1, user: S, status: "ready", createdAt: ago(61 * DAY), submissionId: subGraded.id },
    rDone: { id: `tf-done-${stamp}`, asg: A1, user: S, status: "expired", createdAt: ago(90 * DAY), submissionId: subGraded.id, deletedAt: ago(5 * DAY) },
    rOther: { id: `tf-other-${stamp}`, asg: A2, user: S2, status: "ready", createdAt: ago(61 * DAY), submissionId: subOther.id },
    rPend25: { id: `tf-pend25-${stamp}`, asg: A1, user: S, status: "pending", createdAt: ago(25 * HR), submissionId: null },
    rPend1: { id: `tf-pend1-${stamp}`, asg: A1, user: S, status: "pending", createdAt: ago(1 * HR), submissionId: null },
    rRemoved: { id: `tf-removed-${stamp}`, asg: A1, user: S, status: "removed", createdAt: ago(2 * DAY), submissionId: subGraded.id },
  } satisfies Record<string, Spec>;
  const all = Object.values(sp) as Spec[];
  await seed(all);
  const dueIds = [sp.r601.id, sp.r61.id, sp.rOther.id];

  section("Dữ liệu thử: hàm thuần đồng ý với cách dựng");
  check("59 / 59,9 ngày chưa hết hạn; 60,1 / 61 ngày hết hạn (hàm thuần)", [sp.r59, sp.r599].every(s => !isNopTepExpired({ deletedAt: null, expiresAt: nopTepExpiresAt(s.createdAt) }, NOW)) && [sp.r601, sp.r61].every(s => isNopTepExpired({ deletedAt: null, expiresAt: nopTepExpiresAt(s.createdAt) }, NOW)));

  section("Chạy KHÔ: liệt kê đúng, KHÔNG chạm gì");
  const beforeFiles = await snap(), beforeSubs = await subSnap();
  const logs: string[] = []; const origInfo = console.info; console.info = (...a: unknown[]) => { logs.push(a.map(String).join(" ")); };
  const dry = await runNopTepExpiry({ now: NOW, dryRun: true });
  console.info = origInfo;
  check("dryRun=true, job đúng tên", dry.dryRun === true && dry.job === "het-han-tep-nop-bai");
  check("tập 'hết hạn' liệt kê ĐÚNG: 60,1 + 61 + bài khác (59, 59,9, đã xoá KHÔNG có mặt)", dry.sets.expired.ids.slice().sort().join() === dueIds.slice().sort().join() && dry.sets.expired.found === 3, dry.sets.expired);
  check("tập 'tải dở' = pending 25 giờ (pending 1 giờ KHÔNG)", dry.sets.pending.ids.join() === sp.rPend25.id && dry.sets.pending.found === 1, dry.sets.pending);
  check("tập 'bỏ đi nhưng kho còn' = removed chưa xoá kho", dry.sets.removed.ids.join() === sp.rRemoved.id && dry.sets.removed.found === 1, dry.sets.removed);
  check("khô: deleted = 0 / failed = 0 ở cả ba tập", (["expired", "pending", "removed"] as const).every(k => dry.sets[k].deleted === 0 && dry.sets[k].failed === 0));
  check("KHÔNG tệp nào trên đĩa bị xoá (cả chín tệp còn nguyên)", all.every(onDisk));
  check("KHÔNG hàng nào đổi: ảnh chụp toàn bảng submission_files trước = sau", (await snap()) === beforeFiles);
  check("AssignmentSubmission nguyên vẹn (cả bài chấm lẫn bài cũ kind=file)", (await subSnap()) === beforeSubs);
  const logLine = logs.find(l => l.includes("het-han-tep-nop-bai")) ?? "";
  check("log: MỘT dòng JSON hợp lệ có job/dryRun/at/sets/partial", (() => { try { const j = JSON.parse(logLine); return j.job === "het-han-tep-nop-bai" && j.dryRun === true && typeof j.at === "string" && !!j.sets && typeof j.partial === "boolean"; } catch { return false; } })(), logLine.slice(0, 200));
  check("log + phản hồi KHÔNG chứa tên tệp, tên học sinh, id học sinh", ![logLine, JSON.stringify(dry)].some(t => /Nguyen|Nguyễn|Văn Bé|Toan|Học sinh/.test(t) || t.includes(S.id) || t.includes(S2.id) || t.includes(S3.id)));

  section("Giới hạn thời gian: hết ngân sách ⇒ partial, không chạm gì");
  const none = await runNopTepExpiry({ now: NOW, dryRun: false, budgetMs: -1 });
  check("budget âm: partial=true, deleted=0, mọi tệp còn, bảng không đổi", none.partial && (["expired", "pending", "removed"] as const).every(k => none.sets[k].deleted === 0) && all.every(onDisk) && (await snap()) === beforeFiles);

  section("Lỗi giữa chừng 1: xoá kho THẤT BẠI ⇒ hàng KHÔNG đổi sang expired");
  const failDelete = await runNopTepExpiry({ now: NOW, dryRun: false, deps: { deleteStored: async () => false } });
  check("failed ≥ 5 (mọi hàng đến hạn), deleted = 0", failDelete.sets.expired.failed === 3 && failDelete.sets.pending.failed === 1 && failDelete.sets.removed.failed === 1 && (["expired", "pending", "removed"] as const).every(k => failDelete.sets[k].deleted === 0), failDelete.sets);
  check("hàng giữ nguyên (ready / pending / removed, deletedAt null) và tệp còn trên đĩa", (await snap()) === beforeFiles && all.every(onDisk));

  section("Lỗi giữa chừng 2: DB lỗi SAU khi đã xoá kho ⇒ lần sau hội tụ");
  const failDb = await runNopTepExpiry({ now: NOW, dryRun: false, deps: { markDone: async () => { throw new Error("DB sập giữa chừng"); } } });
  check("kho đã xoá nhưng hàng chưa đổi: failed đếm đủ, deleted = 0", failDb.sets.expired.failed === 3 && failDb.sets.expired.deleted === 0, failDb.sets.expired);
  check("tệp của ba hàng đến hạn + pending 25 giờ + removed ĐÃ mất trên đĩa; hàng vẫn 'ready' (chưa expired)", ![sp.r601, sp.r61, sp.rOther, sp.rPend25, sp.rRemoved].some(onDisk) && (await row(sp.r61.id))?.status === "ready" && (await row(sp.r61.id))?.deletedAt === null);
  check("tệp còn hạn (59, 59,9, pending 1 giờ, đã xoá) VẪN còn trên đĩa", [sp.r59, sp.r599, sp.rPend1, sp.rDone].every(onDisk));

  section("Chạy THẬT (xoa=1 ⇒ dryRun=false): chỉ ba tập, hội tụ sau lỗi DB");
  const real = await runNopTepExpiry({ now: NOW, dryRun: false });
  check("deleted: hết hạn 3, tải dở 1, removed 1; failed 0; partial=false", real.sets.expired.deleted === 3 && real.sets.pending.deleted === 1 && real.sets.removed.deleted === 1 && (["expired", "pending", "removed"] as const).every(k => real.sets[k].failed === 0) && !real.partial && !real.dryRun, real.sets);
  for (const s of [sp.r601, sp.r61, sp.rOther]) { const r = await row(s.id); check(`hết hạn → status expired, expiredAt + deletedAt đặt, tệp mất (${s.id.slice(3, 10)})`, r?.status === "expired" && !!r.expiredAt && !!r.deletedAt && !onDisk(s), r); }
  { const r = await row(sp.rPend25.id); check("tải dở 25 giờ → expired, tệp mất", r?.status === "expired" && !!r.deletedAt && !onDisk(sp.rPend25), r); }
  { const r = await row(sp.rRemoved.id); check("removed → giữ status removed, deletedAt đặt, tệp mất", r?.status === "removed" && !!r.deletedAt && !onDisk(sp.rRemoved), r); }
  for (const s of [sp.r59, sp.r599, sp.rPend1, sp.rDone]) {
    const b = JSON.parse(beforeFiles).find((x: { id: string }) => x.id === s.id); const a = JSON.parse(JSON.stringify(await row(s.id)));
    check(`CÒN NGUYÊN: ${s.id.slice(3, 12)} (hàng không đổi một trường nào, tệp còn)`, JSON.stringify(a) === JSON.stringify(b) && onDisk(s), [a?.status, a?.deletedAt]);
  }
  check("không hàng SubmissionFile nào bị xoá (đủ 9 hàng)", (await prisma.submissionFile.count()) === all.length);
  check("AssignmentSubmission bất biến: score/comment/gradedAt/gradedBy/fileUrl/fileName/submittedAt/kind của cả ba bài", (await subSnap()) === beforeSubs);
  { const a = await prisma.assignmentSubmission.findUnique({ where: { id: subGraded.id } }); check("bài bị xoá tệp vẫn giữ điểm 8,5 + nhận xét + người chấm", a?.score === 8.5 && a.comment === "Làm tốt, chú ý bước 3." && a.gradedBy === T.id && !!a.gradedAt && a.fileUrl.includes("/api/media/nop-bai/")); }
  { const a = await prisma.assignmentSubmission.findUnique({ where: { id: subOld.id } }); check("bài nộp CŨ kind=file (không có SubmissionFile) không bị đụng", a?.kind === "file" && a.fileUrl.startsWith("https://res.cloudinary.com/") && a.score === 7); }
  const real2 = await runNopTepExpiry({ now: NOW, dryRun: false });
  check("chạy lần hai ⇒ deleted = 0, found = 0 ở cả ba tập (idempotent)", (["expired", "pending", "removed"] as const).every(k => real2.sets[k].deleted === 0 && real2.sets[k].found === 0), real2.sets);

  section("Hàng chạy tiếp sau lỗi: tệp đã mất khỏi kho + DB lỗi ⇒ lần sau vẫn cập nhật");
  const rF: Spec = { id: `tf-conv-${stamp}`, asg: A1, user: S, status: "ready", createdAt: ago(70 * DAY), submissionId: subGraded.id };
  await seed([rF]);
  const f1 = await runNopTepExpiry({ now: NOW, dryRun: false, deps: { deleteStored: async () => false } });
  check("lỗi xoá kho: failed 1, hàng còn ready, tệp còn", f1.sets.expired.failed === 1 && (await row(rF.id))?.status === "ready" && onDisk(rF), f1.sets.expired);
  const f2 = await runNopTepExpiry({ now: NOW, dryRun: false });
  check("hết lỗi ⇒ xoá được: expired + tệp mất", f2.sets.expired.deleted === 1 && (await row(rF.id))?.status === "expired" && !onDisk(rF), f2.sets.expired);

  section("Giới hạn mỗi lần: 250 hàng quá hạn");
  const bulk = Array.from({ length: 250 }, (_, i) => ({
    id: `tf-bulk-${stamp}-${String(i).padStart(3, "0")}`, kind: "student", assignmentId: A1.id, submissionId: null as string | null, studentUserId: S.id, ownerUserId: S.id, courseId: C.id, driver: "local",
    storageKey: `kin-nop-bai/${C.id}/${A1.id}/bulk-${stamp}-${i}.docx`, originalName: "x.docx", ext: "docx", mimeType: NOP_TEP_MIME_BY_EXT.docx, sizeBytes: 10, status: "ready",
    createdAt: ago(61 * DAY + i * 1000), expiresAt: nopTepExpiresAt(ago(61 * DAY + i * 1000)), readyAt: ago(61 * DAY),
  }));
  await prisma.submissionFile.createMany({ data: bulk });
  const b1 = await runNopTepExpiry({ now: NOW, dryRun: false });
  check("lần 1: found 250, xử lý đúng 100, partial=true", b1.sets.expired.found === 250 && b1.sets.expired.deleted === 100 && b1.partial === true, [b1.sets.expired.found, b1.sets.expired.deleted, b1.partial]);
  const b2 = await runNopTepExpiry({ now: NOW, dryRun: false });
  check("lần 2: tiếp 100, partial=true; không hàng nào xử lý hai lần (hai danh sách id rời nhau)", b2.sets.expired.deleted === 100 && b2.partial === true && !b2.sets.expired.ids.some(id => b1.sets.expired.ids.includes(id)), [b2.sets.expired.found, b2.sets.expired.deleted]);
  const b3 = await runNopTepExpiry({ now: NOW, dryRun: false });
  check("lần 3: nốt 50, partial=false", b3.sets.expired.deleted === 50 && b3.partial === false, [b3.sets.expired.found, b3.sets.expired.deleted, b3.partial]);
  const union = new Set([...b1.sets.expired.ids, ...b2.sets.expired.ids, ...b3.sets.expired.ids]);
  check("hợp ba lần = đủ 250 hàng, không bỏ sót; cả 250 đều expired, không ai bị xoá hàng", union.size === 250 && (await prisma.submissionFile.count({ where: { id: { startsWith: `tf-bulk-${stamp}` }, status: "expired", deletedAt: { not: null } } })) === 250);

  section("Xác thực cron (thuần) và khớp quản trị");
  check("checkCronAuth: không khoá ⇒ 503; khoá ngắn ⇒ 503; sai ⇒ 401; đúng ⇒ ok", (() => { const s = "x".repeat(20); return (checkCronAuth(undefined, `Bearer ${s}`) as { status?: number }).status === 503 && (checkCronAuth("ngan", "Bearer ngan") as { status?: number }).status === 503 && (checkCronAuth(s, "Bearer sai") as { status?: number }).status === 401 && (checkCronAuth(s, null) as { status?: number }).status === 401 && checkCronAuth(s, `Bearer ${s}`).ok; })());
  const job = CRON_JOBS.find(j => j.key === "het-han-tep-nop-bai");
  check("CRON_JOBS có het-han-tep-nop-bai: đường dẫn, 'Mỗi ngày 01:30 giờ VN', khoá SettingKV riêng", !!job && job.path === "/api/cron/het-han-tep-nop-bai" && job.schedule === "Mỗi ngày 01:30 giờ VN" && job.maxGapHours === 36 && cronSettingKey("het-han-tep-nop-bai") === "cron.het-han-tep-nop-bai.lastCall");

  section("Xác thực cron qua HTTP (cần máy chủ thử + CRON_SECRET)");
  if (SECRET.length < 16) { console.log("  (bỏ qua: không có CRON_SECRET ≥ 16 ký tự trong môi trường bài test)"); }
  else {
    const guard = await prisma.submissionFile.create({ data: { ...bulk[0], id: `tf-guard-${stamp}`, storageKey: `kin-nop-bai/${C.id}/${A1.id}/guard-${stamp}.docx`, status: "ready", createdAt: ago(61 * DAY), expiresAt: nopTepExpiresAt(ago(61 * DAY)), deletedAt: null } });
    const gs: Spec = { id: guard.id, asg: A1, user: S, status: "ready", createdAt: ago(61 * DAY), submissionId: null };
    mkdirSync(dirname(localPathFor(guard.storageKey)), { recursive: true }); writeFileSync(localPathFor(guard.storageKey), docxBytes);
    const none401 = await api("GET", "/api/cron/het-han-tep-nop-bai?xoa=1");
    const wrong = await api("GET", "/api/cron/het-han-tep-nop-bai?xoa=1", { headers: { authorization: "Bearer sai-khoa-sai-khoa-sai-khoa" } });
    check("không Authorization ⇒ 401; CRON_SECRET sai ⇒ 401", none401.status === 401 && wrong.status === 401, [none401.status, wrong.status]);
    check("401 thì KHÔNG xoá gì (hàng còn ready, tệp còn trên đĩa)", (await row(guard.id))?.status === "ready" && onDisk(gs));
    const dryHttp = await fetch(BASE + "/api/cron/het-han-tep-nop-bai", { headers: { authorization: `Bearer ${SECRET}` } });
    const dj = await dryHttp.json() as { dryRun?: boolean; sets?: { expired: { ids: string[] } } };
    check("GET không ?xoa=1 ⇒ 200, dryRun=true (chạy khô mặc định), liệt kê hàng đến hạn, không xoá", dryHttp.status === 200 && dj.dryRun === true && !!dj.sets?.expired.ids.includes(guard.id) && (await row(guard.id))?.status === "ready" && dryHttp.headers.get("cache-control") === "no-store", [dryHttp.status, dj.dryRun]);
    check("lần gọi được ghi cho trang Triển khai (SettingKV cron.het-han-tep-nop-bai.lastCall)", !!(await prisma.settingKV.findUnique({ where: { key: cronSettingKey("het-han-tep-nop-bai") } })));
    const realHttp = await fetch(BASE + "/api/cron/het-han-tep-nop-bai?xoa=1", { headers: { authorization: `Bearer ${SECRET}` } });
    const rj = await realHttp.json() as { dryRun?: boolean };
    check("?xoa=1 ⇒ dryRun=false và hàng đến hạn chuyển expired", realHttp.status === 200 && rj.dryRun === false && (await row(guard.id))?.status === "expired", [realHttp.status, rj.dryRun]);
  }

  done();
})().catch(e => { console.error(e); process.exit(1); });
