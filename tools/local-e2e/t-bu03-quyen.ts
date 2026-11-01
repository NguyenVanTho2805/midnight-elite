// BU-03 — MA TRẬN QUYỀN cho MỌI route mới dưới /api/tutor/ngan-hang/** và /api/tutor/de-thi/** (+ phát hành quiz đã sửa), cô lập giữa hai gia sư, cổng trang, đường cũ 307.
// Cần máy chủ dev (BASE) + DB RIÊNG; wipe() ở đầu bài. Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-bu03-quyen.ts
// Luật (đặc tả mục 8): khách 401 · học sinh 403 · gia sư CHỜ DUYỆT 403 · admin_super/admin_content 403 · gia sư B trên tài nguyên của A 403 · id không có 404.
// Ca phá bằng thiết kế: mọi ca dùng id THẬT và thân HỢP LỆ (nên 401/403 không đậu giả vì 404/400); sau cả loạt ca bị từ chối, snap() của DB phải KHÔNG đổi
// (route thiếu requireTutor() hoặc thiếu kiểm chủ sẽ ghi/xoá → snap đổi → đỏ). Ca 404 chạy bằng gia sư A (đã qua cổng) nên chỉ đậu khi id thật sự không có.
// Lỗ có sẵn GET /api/exams/[id] (lộ metadata đề NHÁP cho mọi tài khoản quản trị, gồm gia sư khác) được ghi lại ở cuối, nhãn KNOWN-ISSUE, KHÔNG làm đỏ.
import { api, cookieFor, BASE, wipe, check, section, done, type TUser } from "./h";
import { prisma } from "@/lib/prisma";
import { TUTOR_PENDING_PATH } from "@/lib/tutorGate";
import { mkActors, mkTree, mkBank, mkDraft, mkPublished, mkDocx, uploadDocx, roleMatrix, snap, knownIssue, DOCX_MIME, azotaDocx } from "./bu03";

type Res = { status: number; json: any; text: string };
interface Route { name: string; call: (as: TUser | undefined) => Promise<Res>; cross?: (as: TUser | undefined) => Promise<Res>; missing?: (as: TUser | undefined) => Promise<Res> }

(async () => {
  await wipe();
  const a = await mkActors();
  const { A, B, S, P, courseA } = a;
  const tree = await mkTree();
  const itemA = await mkBank({ ownerId: A.id, categoryId: tree.c11, difficulty: "NB", status: "approved" });
  const draftA = await mkBank({ ownerId: A.id, categoryId: tree.c11, difficulty: "NB", status: "draft" });
  const examA = await mkDraft(A, { n: 4, courseId: courseA.id });
  const pubA = await mkPublished(A, courseA.id, { n: 3, title: "Đề đã phát hành của A" });
  const mk2 = await api("POST", `/api/tutor/de-thi/${examA}/ma-de`, { as: A, body: { count: 2 } });
  check("dựng: đề nháp có mã đề con", mk2.status === 201, mk2.text.slice(0, 200));
  const child = (await prisma.exam.findFirst({ where: { variantOfId: examA }, select: { id: true } }))!.id;
  const bp = await api("POST", "/api/tutor/de-thi/ma-tran", { as: A, body: { name: "Ma trận của A", rows: [{ categoryId: tree.c11, difficulty: "NB", count: 1 }] } });
  const bpA = bp.json?.id as string;
  check("dựng: ma trận của A", bp.status === 201 && !!bpA, bp.text.slice(0, 200));
  const fileA = await prisma.examFile.create({ data: { fileName: "de-a.docx", fileUrl: "https://res.cloudinary.com/demo/raw/upload/de-a.docx", fileType: DOCX_MIME, ownerId: A.id } });
  const fileB = await prisma.examFile.create({ data: { fileName: "de-b.docx", fileUrl: "https://res.cloudinary.com/demo/raw/upload/de-b.docx", fileType: DOCX_MIME, ownerId: B.id } });
  const rows = [{ categoryId: tree.c11, difficulty: "NB", count: 1 }];
  const docx = await azotaDocx(1);
  const NOPE = "khong-co-id-nay";

  const R = (n: string, method: string, path: string, body?: unknown, extra: Partial<Route> = {}): Route => ({
    name: n, call: as => api(method, path, { as, ...(body !== undefined ? { body } : {}) }), ...extra,
  });
  const routes: Route[] = [
    R("GET  ngan-hang/thong-ke", "GET", `/api/tutor/ngan-hang/thong-ke?root=${tree.c11}&scope=all`),
    { name: "POST ngan-hang/nhap-word", call: as => uploadDocx("/api/tutor/ngan-hang/nhap-word", as, docx) },
    R("POST ngan-hang/luu-nhieu", "POST", "/api/tutor/ngan-hang/luu-nhieu", { categoryId: tree.c11, defaultDifficulty: "NB", items: [{ type: "MC", text: "Câu ma trận quyền", points: 1, options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: false }] }] }),
    R("GET  de-thi", "GET", "/api/tutor/de-thi"),
    R("GET  de-thi/ma-tran", "GET", "/api/tutor/de-thi/ma-tran"),
    R("POST de-thi/ma-tran", "POST", "/api/tutor/de-thi/ma-tran", { name: "Ma trận thử quyền", rows }),
    R("GET  de-thi/ma-tran/[id]", "GET", `/api/tutor/de-thi/ma-tran/${bpA}`, undefined, { cross: as => api("GET", `/api/tutor/de-thi/ma-tran/${bpA}`, { as }), missing: as => api("GET", `/api/tutor/de-thi/ma-tran/${NOPE}`, { as }) }),
    R("PUT  de-thi/ma-tran/[id]", "PUT", `/api/tutor/de-thi/ma-tran/${bpA}`, { name: "Bị sửa trái phép", rows }, { missing: as => api("PUT", `/api/tutor/de-thi/ma-tran/${NOPE}`, { as, body: { name: "x", rows } }) }),
    R("DELETE de-thi/ma-tran/[id]", "DELETE", `/api/tutor/de-thi/ma-tran/${bpA}`, undefined, { missing: as => api("DELETE", `/api/tutor/de-thi/ma-tran/${NOPE}`, { as }) }),
    R("POST de-thi/ma-tran/rut", "POST", "/api/tutor/de-thi/ma-tran/rut", { rows, seed: "s" }),
    R("POST de-thi/ma-tran/doi-cau", "POST", "/api/tutor/de-thi/ma-tran/doi-cau", { rows, rowIndex: 0, itemId: itemA.id, current: [itemA.id], seed: "s" }),
    R("POST de-thi/tao-tu-ma-tran", "POST", "/api/tutor/de-thi/tao-tu-ma-tran", { title: "Đề thử quyền", itemIds: [itemA.id] }),
    R("GET  de-thi/[id]/ma-de", "GET", `/api/tutor/de-thi/${examA}/ma-de`, undefined, { missing: as => api("GET", `/api/tutor/de-thi/${NOPE}/ma-de`, { as }) }),
    R("POST de-thi/[id]/ma-de", "POST", `/api/tutor/de-thi/${examA}/ma-de`, { count: 3 }, { missing: as => api("POST", `/api/tutor/de-thi/${NOPE}/ma-de`, { as, body: { count: 3 } }) }),
    R("GET  de-thi/[id]/giao", "GET", `/api/tutor/de-thi/${examA}/giao`, undefined, { missing: as => api("GET", `/api/tutor/de-thi/${NOPE}/giao`, { as }) }),
    R("PATCH de-thi/[id]/giao", "PATCH", `/api/tutor/de-thi/${examA}/giao`, { mode: "practice" }, { missing: as => api("PATCH", `/api/tutor/de-thi/${NOPE}/giao`, { as, body: { mode: "practice" } }) }),
    R("POST de-thi/[id]/giao (đóng/mở)", "POST", `/api/tutor/de-thi/${pubA}/giao`, { action: "close" }, { missing: as => api("POST", `/api/tutor/de-thi/${NOPE}/giao`, { as, body: { action: "close" } }) }),
    R("GET  de-thi/[id]/ket-qua", "GET", `/api/tutor/de-thi/${pubA}/ket-qua`, undefined, { missing: as => api("GET", `/api/tutor/de-thi/${NOPE}/ket-qua`, { as }) }),
    R("GET  de-thi/[id]/ket-qua/bang-diem", "GET", `/api/tutor/de-thi/${pubA}/ket-qua/bang-diem`, undefined, { missing: as => api("GET", `/api/tutor/de-thi/${NOPE}/ket-qua/bang-diem`, { as }) }),
    R("GET  de-thi/[id]/ket-qua/xuat-xlsx", "GET", `/api/tutor/de-thi/${pubA}/ket-qua/xuat-xlsx`, undefined, { missing: as => api("GET", `/api/tutor/de-thi/${NOPE}/ket-qua/xuat-xlsx`, { as }) }),
    R("POST de-thi/tep-goc/[fileId]/tach", "POST", `/api/tutor/de-thi/tep-goc/${fileA.id}/tach`, undefined, { missing: as => api("POST", `/api/tutor/de-thi/tep-goc/${NOPE}/tach`, { as }) }),
    R("POST de-thi/tep-goc/[fileId]/gan-de", "POST", `/api/tutor/de-thi/tep-goc/${fileA.id}/gan-de`, { examId: examA }, { missing: as => api("POST", `/api/tutor/de-thi/tep-goc/${NOPE}/gan-de`, { as, body: { examId: examA } }) }),
    R("POST quiz/[id]/publish (đã sửa ở BU-03)", "POST", `/api/tutor/quiz/${examA}/publish`, undefined, { missing: as => api("POST", `/api/tutor/quiz/${NOPE}/publish`, { as }) }),
  ];
  // Các route theo id tài nguyên của A: B phải 403 (cross mặc định = chính call nhưng bằng B).
  const byId = /\[id\]|\[fileId\]/;

  const s0 = await snap();
  for (const r of routes) {
    section(`${r.name}`);
    await roleMatrix(r.name, a, r.call);
  }
  check("sau MỌI ca bị từ chối theo vai: DB không đổi một chữ (không ghi, không xoá, không đổi chế độ, không gán tệp)", (await snap()) === s0);

  section("Gia sư B trên tài nguyên của A → 403; id không có → 404; tài nguyên của A còn nguyên");
  for (const r of routes.filter(x => byId.test(x.name))) {
    const rb = await (r.cross ?? r.call)(B);
    check(`${r.name}: gia sư B trên tài nguyên của A → 403`, rb.status === 403, [rb.status, rb.text.slice(0, 160)]);
    if (r.missing) {
      const m = await r.missing(A);
      check(`${r.name}: id không có → 404`, m.status === 404, [m.status, m.text.slice(0, 160)]);
    }
  }
  check("B không sửa/xoá/đổi được gì của A (DB y nguyên)", (await snap()) === s0);

  section("Quyền theo thân yêu cầu: lớp, ma trận, câu ngân hàng của người khác");
  {
    const t = (body: Record<string, unknown>, as = B) => api("POST", "/api/tutor/de-thi/tao-tu-ma-tran", { as, body: { title: "Đề thử", itemIds: [itemA.id], ...body } });
    const s1 = await snap();
    const lop = await t({ courseId: courseA.id });
    check("tao-tu-ma-tran: lớp của gia sư khác → 403 NOT_YOUR_CLASS", lop.status === 403 && lop.json?.code === "NOT_YOUR_CLASS", [lop.status, lop.json]);
    const lop404 = await t({ courseId: NOPE });
    check("tao-tu-ma-tran: lớp không có → 404", lop404.status === 404, lop404.status);
    const bpx = await t({ blueprintId: bpA });
    check("tao-tu-ma-tran: ma trận của người khác → 403", bpx.status === 403, [bpx.status, bpx.json]);
    const bp404 = await t({ blueprintId: NOPE });
    check("tao-tu-ma-tran: ma trận không có → 404", bp404.status === 404, bp404.status);
    const dr = await t({ itemIds: [draftA.id] });
    check("tao-tu-ma-tran: câu NHÁP của A → 403 ITEM_NOT_VISIBLE (kho B không thấy)", dr.status === 403 && dr.json?.code === "ITEM_NOT_VISIBLE", [dr.status, dr.json]);
    const nf = await t({ itemIds: [NOPE] });
    check("tao-tu-ma-tran: câu không còn → 404 ITEM_NOT_FOUND", nf.status === 404 && nf.json?.code === "ITEM_NOT_FOUND", [nf.status, nf.json]);
    const ok = await t({ itemIds: [itemA.id] });
    check("ĐỐI CHỨNG: câu ĐÃ DUYỆT của A thì B dùng được (201) — để các ca 403 ở trên không đậu giả", ok.status === 201, [ok.status, ok.json]);
    check("các ca bị từ chối trên không tạo đề nào (chỉ ca đối chứng tạo 1)", (await prisma.exam.count()) === (JSON.parse(s1).exam as number) + 1);
    const gan = await api("POST", `/api/tutor/de-thi/tep-goc/${fileB.id}/gan-de`, { as: B, body: { examId: examA } });
    check("gan-de: tệp của B nhưng ĐỀ của A → 403 (kiểm chủ CẢ HAI)", gan.status === 403, [gan.status, gan.json]);
    const gan2 = await api("POST", `/api/tutor/de-thi/tep-goc/${fileA.id}/gan-de`, { as: A, body: { examId: NOPE } });
    check("gan-de: đề không có → 404", gan2.status === 404, gan2.status);
    check("hai ca gan-de trên không ghi extractedExamId", (await prisma.examFile.findMany({ select: { extractedExamId: true } })).every(f => f.extractedExamId === null));
  }

  section("Danh sách chỉ của mình: B không thấy đề, ma trận, tệp của A");
  {
    const l = await api("GET", "/api/tutor/de-thi", { as: B });
    check("GET de-thi (B): không chứa đề của A", l.status === 200 && Array.isArray(l.json?.items) && !l.text.includes(examA) && !l.text.includes(pubA), l.text.slice(0, 200));
    const lA = await api("GET", "/api/tutor/de-thi", { as: A });
    check("ĐỐI CHỨNG GET de-thi (A): thấy đề của mình, mã đề con gộp (không nằm riêng trong danh sách)", lA.json?.items?.some((x: any) => x.id === examA) && !lA.text.includes(child), lA.text.slice(0, 200));
    const lop = await api("GET", `/api/tutor/de-thi?lop=${courseA.id}`, { as: B });
    check("lọc ?lop= bằng lớp của A (B gọi) → không lộ đề nào", lop.status === 200 && (lop.json?.items ?? []).length === 0, lop.text.slice(0, 200));
    const m = await api("GET", "/api/tutor/de-thi/ma-tran", { as: B });
    check("GET ma-tran (B): không chứa ma trận của A", m.status === 200 && !m.text.includes(bpA) && !m.text.includes("Ma trận của A"), m.text.slice(0, 200));
    const picker = await api("GET", "/api/tutor/quiz", { as: A });
    check("GET /api/tutor/quiz (bộ chọn đề): không liệt kê mã đề con", picker.status === 200 && !picker.text.includes(child) && picker.text.includes(examA), picker.text.slice(0, 200));
  }

  section("Cổng trang (HTML): khách, học sinh, gia sư chờ duyệt, gia sư — không tải nội dung gia sư cho người không được");
  {
    const pages = ["/lop-cua-toi/de-thi/ngan-hang-cau-hoi", "/lop-cua-toi/de-thi/ma-tran", `/lop-cua-toi/de-thi/${examA}/giao`, `/lop-cua-toi/de-thi/${examA}/ket-qua`, `/lop-cua-toi/de-thi/${examA}/ma-de`, "/lop-cua-toi/de-thi/ngan-hang-cau-hoi/nhap-word"];
    const get = async (path: string, u?: TUser) => {
      const res = await fetch(BASE + path, { redirect: "manual", headers: u ? { cookie: await cookieFor(u) } : {} });
      await res.arrayBuffer();
      return { status: res.status, loc: res.headers.get("location") ?? "" };
    };
    const isRedirect = (n: number) => [301, 302, 303, 307, 308].includes(n);
    for (const p of pages) {
      const g = await get(p), st = await get(p, S), pe = await get(p, P), t = await get(p, A);
      check(`${p}: khách → chuyển hướng (không 200)`, isRedirect(g.status), g);
      check(`${p}: học sinh → chuyển hướng, không nằm lại trang gia sư`, isRedirect(st.status) && !st.loc.includes("/de-thi"), st);
      check(`${p}: gia sư chờ duyệt → ${TUTOR_PENDING_PATH}`, isRedirect(pe.status) && pe.loc.includes(TUTOR_PENDING_PATH), pe);
      check(`${p}: ĐỐI CHỨNG gia sư đã duyệt → 200 (không bị đá đi)`, t.status === 200, t);
    }
  }

  section("Đường cũ → 307 sang đường mới, không vòng lặp");
  {
    const hop = async (path: string) => {
      const res = await fetch(BASE + path, { redirect: "manual", headers: { cookie: await cookieFor(A) } });
      await res.arrayBuffer();
      return { status: res.status, loc: new URL(res.headers.get("location") ?? "x:", BASE).pathname };
    };
    const cases: [string, string][] = [
      [`/lop-cua-toi/bai-tap/quiz/${examA}`, `/lop-cua-toi/de-thi/${examA}`],
      [`/lop-cua-toi/bai-tap/quiz/${examA}/phien-ban`, `/lop-cua-toi/de-thi/${examA}/phien-ban`],
      ["/lop-cua-toi/bai-tap/quiz/moi", "/lop-cua-toi/de-thi/tao-moi"],
      ["/lop-cua-toi/bai-tap/nhap-de", "/lop-cua-toi/de-thi/tao-moi"],
      [`/lop-cua-toi/bai-tap/de/${examA}`, `/lop-cua-toi/de-thi/${examA}/cham`],
    ];
    for (const [from, to] of cases) {
      const h1 = await hop(from);
      check(`${from} → 307 ${to}`, h1.status === 307 && h1.loc === to, h1);
      const h2 = await hop(to);
      check(`  đích ${to} không chuyển tiếp nữa (200, không vòng lặp)`, h2.status === 200, h2);
    }
    const stu = await fetch(BASE + `/lop-cua-toi/bai-tap/quiz/${examA}`, { redirect: "manual", headers: { cookie: await cookieFor(S) } });
    await stu.arrayBuffer();
    check("đường cũ với học sinh: cổng gia sư chạy TRƯỚC khi chuyển (không dẫn học sinh sang /de-thi)", !(stu.headers.get("location") ?? "").includes("/de-thi"), stu.headers.get("location"));
  }

  section("KNOWN-ISSUE (có sẵn): GET /api/exams/[id] với đề NHÁP — chỉ ghi lại, không làm đỏ");
  {
    const secret = "mat-khau-bi-mat-123";
    const pw = await api("PATCH", `/api/tutor/de-thi/${examA}/giao`, { as: A, body: { password: secret } });
    check("dựng: đặt mật khẩu cho đề nháp của A", pw.status === 200, pw.text.slice(0, 160));
    const hash = (await prisma.exam.findUnique({ where: { id: examA }, select: { passwordHash: true } }))?.passwordHash ?? "";
    check("dựng: DB có passwordHash (không phải chữ thô)", hash.length > 20 && hash !== secret);
    const g = await api("GET", `/api/exams/${examA}`);
    check("khách → 401", g.status === 401, g.status);
    const st = await api("GET", `/api/exams/${examA}`, { as: S });
    check("học sinh → 404 (bản nháp không tới học sinh)", st.status === 404, st.status);
    const rb = await api("GET", `/api/exams/${examA}`, { as: B });
    check("gia sư B đọc đề nháp của A: KHÔNG bao giờ lộ mật khẩu thô, passwordHash hay giá trị băm (kiểm cứng, tính đỏ)", !rb.text.includes(secret) && !rb.text.includes("passwordHash") && (!hash || !rb.text.includes(hash)), rb.text.slice(0, 300));
    const rs = await api("GET", `/api/exams/${examA}`, { as: a.SUP });
    check("ĐỐI CHỨNG: quản trị cấp 1 đọc được đề nháp (đúng thiết kế) và cũng không lộ băm", rs.status === 200 && !rs.text.includes(hash), rs.status);
    if (rb.status === 200) knownIssue(`gia sư B đọc được metadata đề NHÁP của gia sư A qua GET /api/exams/${"<id>"} (200, có title/ngày/lớp). Lỗ có sẵn ở src/app/api/exams/[id]/route.ts: chỉ chặn role!=admin, không kiểm ownerId. Khuyến nghị: nháp → 404 cho gia sư không phải chủ.`);
    else check("đã vá: gia sư B không đọc được nháp của A (404/403)", rb.status === 404 || rb.status === 403, rb.status);
  }

  void mkDocx;
  await done();
})().catch(e => { console.error(e); process.exit(1); });
