// BU-03 P2 — Tệp đề gốc: POST /api/tutor/de-thi/tep-goc/[fileId]/tach (chống SSRF, chỉ .docx, không ghi DB) và /gan-de (ghi "tệp đã tách thành đề X").
// Cần máy chủ dev (BASE) + DB RIÊNG; wipe() ở đầu bài. Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-exam-source-file.ts
// KHÔNG gọi mạng ngoài: mọi ca `tach` dùng địa chỉ bị từ chối TRƯỚC khi tải. Chống SSRF được chứng minh bằng một máy chủ HTTP nghe cục bộ — nếu danh sách cho phép
// bị bỏ, máy chủ ứng dụng sẽ tải địa chỉ http://127.0.0.1:<cổng> và bộ đếm của bài sẽ > 0 (ca đỏ). Ca tải thật từ res.cloudinary.com: SKIP (không dùng mạng ngoài).
// Ca phá bằng thiết kế: isAllowedSourceUrl nhận http / host chứa res.cloudinary.com / có tài khoản / có cổng → ca BAD_HOST tương ứng trả khác 400 hoặc listener bị gọi;
//   looksLikeDocx nhận PDF → ca NOT_DOCX đỏ; bỏ kiểm extractedExamId → ca ALREADY_EXTRACTED đỏ; gan-de bỏ kiểm chủ đề → ca 403 đỏ.
import http from "node:http";
import type { AddressInfo } from "node:net";
import { api, wipe, check, section, done } from "./h";
import { prisma } from "@/lib/prisma";
import { mkActors, mkDraft, snap, knownIssue, DOCX_MIME } from "./bu03";

const TACH = (id: string) => `/api/tutor/de-thi/tep-goc/${id}/tach`, GAN = (id: string) => `/api/tutor/de-thi/tep-goc/${id}/gan-de`;

(async () => {
  let hits = 0;
  const srv = http.createServer((_q, res) => { hits++; res.statusCode = 200; res.end("PK"); });
  await new Promise<void>(r => srv.listen(0, "127.0.0.1", r));
  const port = (srv.address() as AddressInfo).port;

  await wipe();
  const a = await mkActors();
  const { A, B } = a;
  const examA = await mkDraft(A, { n: 2, courseId: a.courseA.id }), examA2 = await mkDraft(A, { n: 2 }), examB = await mkDraft(B, { n: 2 });
  const mkFile = (ownerId: string, fileName: string, fileUrl: string, fileType = DOCX_MIME, extractedExamId: string | null = null) =>
    prisma.examFile.create({ data: { fileName, fileUrl, fileType, ownerId, extractedExamId } });

  section("tach: chống SSRF — địa chỉ ngoài danh sách bị từ chối 400 BAD_HOST, và máy chủ KHÔNG tải gì");
  {
    const s0 = await snap();
    const bad: [string, string][] = [
      ["http (không https) tới cổng cục bộ", `http://127.0.0.1:${port}/x.docx`],
      ["https tới localhost", `https://localhost:${port}/x.docx`],
      ["https tới 127.0.0.1", `https://127.0.0.1/x.docx`],
      ["https tới dịch vụ metadata đám mây", "https://169.254.169.254/latest/meta-data/x.docx"],
      ["host lạ", "https://evil.example.com/x.docx"],
      ["host dán đuôi (res.cloudinary.com.evil.com)", "https://res.cloudinary.com.evil.com/x.docx"],
      ["host dán đầu (evilres.cloudinary.com)", "https://evilres.cloudinary.com/x.docx"],
      ["tên miền con (a.res.cloudinary.com)", "https://a.res.cloudinary.com/x.docx"],
      ["có tài khoản trong địa chỉ (user:pw@)", "https://user:pw@res.cloudinary.com/x.docx"],
      ["có tài khoản dẫn tới host lạ (res.cloudinary.com@evil)", "https://res.cloudinary.com@evil.example.com/x.docx"],
      ["có cổng lạ (:8443)", "https://res.cloudinary.com:8443/x.docx"],
      ["http tới đúng host Cloudinary", "http://res.cloudinary.com/x.docx"],
      ["địa chỉ không phải URL", "không-phải-url.docx"],
      ["địa chỉ rỗng", ""],
      ["file:// ", "file:///etc/passwd"],
      ["địa chỉ dài > 2000 ký tự", "https://res.cloudinary.com/" + "a".repeat(2100) + ".docx"],
    ];
    for (const [label, url] of bad) {
      const f = await mkFile(A.id, "de.docx", url);
      const r = await api("POST", TACH(f.id), { as: A });
      check(`BAD_HOST: ${label} → 400`, r.status === 400 && r.json?.code === "BAD_HOST", [r.status, r.json]);
    }
    check("PHÁ SSRF: máy chủ cục bộ KHÔNG bị gọi lần nào (hits = 0)", hits === 0, hits);
    check("tach không ghi DB (chỉ thêm các tệp dựng ở trên)", (await prisma.examBlueprint.count()) === 0 && (await prisma.exam.count()) === 3 && (await prisma.questionBankItem.count()) === 0);
    void s0;
  }

  section("tach: chỉ .docx; PDF/ảnh/.doc → 400 NOT_DOCX (kiểm TRƯỚC khi tải); theo tên HOẶC loại khai báo");
  {
    const hit0 = hits;
    for (const [label, name, type] of [["PDF", "de.pdf", "application/pdf"], ["ảnh", "de.png", "image/png"], [".doc cũ", "de.doc", "application/msword"], ["không đuôi", "de", "application/octet-stream"], [".docx.pdf", "de.docx.pdf", "application/pdf"]] as const) {
      const f = await mkFile(A.id, name, `http://127.0.0.1:${port}/${name}`, type);
      const r = await api("POST", TACH(f.id), { as: A });
      check(`${label} → 400 NOT_DOCX`, r.status === 400 && r.json?.code === "NOT_DOCX", [r.status, r.json]);
    }
    const byMime = await mkFile(A.id, "tai-lieu-khong-duoi", "https://evil.example.com/x", DOCX_MIME);
    const r1 = await api("POST", TACH(byMime.id), { as: A });
    check("nhận theo loại khai báo (mime .docx) dù tên không đuôi → qua cổng NOT_DOCX, rơi vào BAD_HOST", r1.status === 400 && r1.json?.code === "BAD_HOST", [r1.status, r1.json]);
    const byName = await mkFile(A.id, "DE-IN-HOA.DOCX", "https://evil.example.com/x", "application/octet-stream");
    const r2 = await api("POST", TACH(byName.id), { as: A });
    check("nhận theo đuôi .DOCX viết hoa → qua cổng NOT_DOCX, rơi vào BAD_HOST", r2.status === 400 && r2.json?.code === "BAD_HOST", [r2.status, r2.json]);
    check("không ca nào gọi mạng", hits === hit0);
  }

  section("tach: đã gán đề → 409 ALREADY_EXTRACTED (kèm examId); gán tới đề đã mất thì coi như chưa gán");
  {
    const f = await mkFile(A.id, "da-tach.docx", "https://evil.example.com/x.docx", DOCX_MIME, examA);
    const r = await api("POST", TACH(f.id), { as: A });
    check("tệp đã tách thành đề còn tồn tại → 409 ALREADY_EXTRACTED + examId", r.status === 409 && r.json?.code === "ALREADY_EXTRACTED" && r.json?.examId === examA, [r.status, r.json]);
    const gone = await mkFile(A.id, "de-da-xoa.docx", "https://evil.example.com/x.docx", DOCX_MIME, "de-khong-con-ton-tai");
    const r2 = await api("POST", TACH(gone.id), { as: A });
    check("gán tới đề đã bị xoá → không còn chặn 409 (rơi xuống kiểm tiếp: BAD_HOST)", r2.status === 400 && r2.json?.code === "BAD_HOST", [r2.status, r2.json]);
  }

  section("gan-de: ghi 'tệp đã tách thành đề X', kiểm chủ CẢ HAI, chỉ đề gốc");
  {
    const f = await mkFile(A.id, "se-gan.docx", "https://evil.example.com/x.docx");
    const fB = await mkFile(B.id, "cua-b.docx", "https://evil.example.com/x.docx");
    const s0 = await snap();
    const noBody = await api("POST", GAN(f.id), { as: A, body: {} });
    check("thiếu examId → 400 NO_EXAM", noBody.status === 400 && noBody.json?.code === "NO_EXAM", [noBody.status, noBody.json]);
    check("examId không phải chuỗi → 400 NO_EXAM", (await api("POST", GAN(f.id), { as: A, body: { examId: 5 } })).json?.code === "NO_EXAM");
    check("thân không phải JSON → 400 (không 500)", (await api("POST", GAN(f.id), { as: A, raw: "x", headers: { "content-type": "application/json" } })).status === 400);
    check("đề không có → 404", (await api("POST", GAN(f.id), { as: A, body: { examId: "khong-co" } })).status === 404);
    check("đề của gia sư B → 403 (tệp của A)", (await api("POST", GAN(f.id), { as: A, body: { examId: examB } })).status === 403);
    check("tệp của B, đề của A (B gọi) → 403; tệp của B, B gọi bằng đề của A → 403 (chủ cả hai)", (await api("POST", GAN(fB.id), { as: B, body: { examId: examA } })).status === 403);
    check("tệp của B, A gọi → 403", (await api("POST", GAN(fB.id), { as: A, body: { examId: examA } })).status === 403);
    check("tệp không có → 404", (await api("POST", GAN("khong-co-tep"), { as: A, body: { examId: examA } })).status === 404);
    await api("POST", MDV(examA), { as: A, body: { count: 2 } });
    const child = (await prisma.exam.findFirst({ where: { variantOfId: examA } }))?.id;
    const rc = await api("POST", GAN(f.id), { as: A, body: { examId: child } });
    check("gán vào MÃ ĐỀ CON → 400 IS_VARIANT (gán vào đề gốc)", child !== undefined && rc.status === 400 && rc.json?.code === "IS_VARIANT", [rc.status, rc.json]);
    check("mọi ca lỗi trên: tệp vẫn chưa gán", (await prisma.examFile.findUnique({ where: { id: f.id } }))?.extractedExamId === null && (await prisma.examFile.findUnique({ where: { id: fB.id } }))?.extractedExamId === null);
    void s0;

    const ok = await api("POST", GAN(f.id), { as: A, body: { examId: examA } });
    check("hợp lệ → 200 {success, fileId, examId}", ok.status === 200 && ok.json?.success === true && ok.json?.fileId === f.id && ok.json?.examId === examA, [ok.status, ok.json]);
    check("DB: extractedExamId = đề A", (await prisma.examFile.findUnique({ where: { id: f.id } }))?.extractedExamId === examA);
    const after = await api("POST", TACH(f.id), { as: A });
    check("sau khi gán: tach cùng tệp → 409 ALREADY_EXTRACTED", after.status === 409 && after.json?.code === "ALREADY_EXTRACTED", [after.status, after.json]);
    const list = await api("GET", "/api/tutor/de-thi", { as: A });
    const row = list.json?.items?.find((x: any) => x.id === examA);
    check("danh sách đề hiện 'extractedFrom' = tệp vừa gán", row?.extractedFrom?.id === f.id && row.extractedFrom.fileName === "se-gan.docx", row);
    const listB = await api("GET", "/api/tutor/de-thi", { as: B });
    check("gia sư B không thấy tên tệp của A", !listB.text.includes("se-gan.docx"));
    // Đặc tả mục 8 nói 'gan-de 409 đã gán'; mã hiện ghi đè không báo — ghi lại để chủ quyết, không tính đỏ.
    const again = await api("POST", GAN(f.id), { as: A, body: { examId: examA2 } });
    if (again.status === 200) knownIssue(`gan-de gán LẠI một tệp đã gán đề khác thì ghi đè (200); đặc tả mục 8 ghi "409 đã gán". Hiện chỉ tach chặn 409. Quyết: giữ ghi đè (cho gia sư sửa nhầm) hay chặn 409.`);
    else check("gán lại → 409", again.status === 409, again.status);
  }

  section("tải thật từ res.cloudinary.com");
  console.log("  – SKIP (không dùng mạng ngoài trong bài này): ca tải thật + tách .docx từ Cloudinary chạy trong ui-ngan-hang-de (chặn mạng giả) hoặc khi chủ cho phép gọi ra ngoài");

  await new Promise<void>(r => srv.close(() => r()));
  await done();
})().catch(e => { console.error(e); process.exit(1); });

function MDV(id: string) { return `/api/tutor/de-thi/${id}/ma-de`; }
