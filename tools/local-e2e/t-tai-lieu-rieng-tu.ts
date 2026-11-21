// SCL-D (P2-5, P2-6) — quyền tài liệu RIÊNG TƯ, máy chủ + DB thật:
//   1. Gia sư tải một PDF lên (init → PUT → complete), gắn vào bài qua PUT /api/lessons/<id>: học sinh của lớp 200; học sinh NGOÀI lớp 403; gia sư khác 403; khách 401.
//      Gỡ tệp khỏi bài ⇒ học sinh của lớp cũng 403 (không còn bài tham chiếu).
//   2. POST /api/tutor/thu-vien/rieng-tu ("Chuyển sang riêng tư"): khách 401, học sinh 403, rỗng 400; link không phải tệp cũ công khai ⇒ từ chối từng mục;
//      gia sư khác gửi link tệp cũ của lớp người ta ⇒ "Không thấy…", bài KHÔNG đổi; chủ lớp với tệp cũ không tải được ⇒ báo lỗi, bài không đổi, không để FileAsset mồ côi.
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-tai-lieu-rieng-tu.ts (máy chủ ở BASE, kho cục bộ của máy dev).
import { api, mkTutor, mkUser, mkCourse, wipe, check, section, done, type TUser } from "./h";
import { prisma } from "@/lib/prisma";

const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
const CU = "https://res.cloudinary.com/kin-scl-d-khong-co/raw/upload/v1/khong-co-that.pdf";

(async () => {
  await wipe();
  const T = await mkTutor("Cô Lan"), T2 = await mkTutor("Thầy Nam");
  const S = await mkUser({ name: "Em Trong Lớp" }), SX = await mkUser({ name: "Em Ngoài Lớp" });
  const C = await mkCourse(T.id, { name: "Toán 9 riêng tư" });
  await prisma.enrollment.create({ data: { userId: S.id, courseId: C.id, status: "active" } });
  await prisma.section.create({ data: { id: "s-rt", title: "Phần 1", order: 1, courseId: C.id } });
  await prisma.chapter.create({ data: { id: "c-rt", title: "Chương 1", order: 1, sectionId: "s-rt" } });
  await prisma.lesson.create({ data: { id: "l-rt", code: "l-rt", title: "Bài riêng tư", type: "document", order: 1, chapterId: "c-rt", isLocked: true, isFree: false, status: "published", documents: "[]" } });
  await prisma.lesson.create({ data: { id: "l-cu", code: "l-cu", title: "Bài có tệp cũ", type: "document", order: 2, chapterId: "c-rt", isLocked: true, isFree: false, status: "published",
    documents: JSON.stringify([{ name: "Đề cương cũ.pdf", url: CU, type: "pdf" }]) } });

  section("1. Tài liệu mới tải lên là riêng tư: chỉ người trong lớp mở được");
  const init = await api("POST", "/api/media/document/init", { as: T, body: { courseId: C.id, fileName: "de-cuong.pdf", size: PDF.length, mimeType: "application/pdf", confirmedNotice: true } });
  check("gia sư chủ lớp xin tải lên → 200, có link /api/media/<mã>/file", init.status === 200 && /^\/api\/media\/[A-Za-z0-9_-]+\/file$/.test(init.json?.link ?? ""), init.json);
  const put = await api("PUT", `/api/media/upload/${init.json.assetId}`, { as: T, raw: PDF });
  const comp = await api("POST", "/api/media/document/complete", { as: T, body: { assetId: init.json.assetId } });
  check("gửi byte + chốt → tệp ready", put.status < 300 && comp.status === 200, { put: put.status, comp: comp.json });
  const link: string = init.json.link;
  const save = await api("PUT", "/api/lessons/l-rt", { as: T, body: { documents: JSON.stringify([{ name: "de-cuong.pdf", url: link, type: "pdf" }]) } });
  check("gắn tệp vào bài (PUT bài) → 200", save.status === 200, save.json);
  const asset = await prisma.fileAsset.findUnique({ where: { id: init.json.assetId } });
  check("FileAsset lưu ở kho riêng (driver local/cloudinary, không phải URL công khai)", !!asset && asset.status === "ready" && (asset.driver === "local" || asset.driver === "cloudinary") && !/^https?:/.test(asset.storageKey), asset);

  const get = (as?: TUser) => api("GET", link, { as });
  const inClass = await get(S), outside = await get(SX), other = await get(T2), guest = await get(undefined), owner = await get(T);
  check("học sinh của lớp → 200, đúng nội dung PDF", inClass.status === 200 && inClass.text.startsWith("%PDF-"), inClass.status);
  check("học sinh NGOÀI lớp → 403", outside.status === 403, outside.status);
  check("gia sư lớp khác → 403", other.status === 403, other.status);
  check("khách chưa đăng nhập → 401", guest.status === 401, guest.status);
  check("chủ tệp → 200", owner.status === 200, owner.status);
  check("không cho bộ nhớ đệm công khai (private, no-store)", /private/.test(inClass.headers.get("cache-control") ?? "") && /no-store/.test(inClass.headers.get("cache-control") ?? ""));
  // Bài CŨ còn isFree=true (gia sư không còn ô tắt): tài liệu vẫn chỉ cho thành viên lớp.
  await prisma.lesson.update({ where: { id: "l-rt" }, data: { isFree: true } });
  check("bài học thử (isFree) ⇒ học sinh NGOÀI lớp vẫn 403", (await get(SX)).status === 403);
  check("bài học thử (isFree) ⇒ học sinh của lớp vẫn 200", (await get(S)).status === 200);
  await prisma.lesson.update({ where: { id: "l-rt" }, data: { isFree: false } });
  await api("PUT", "/api/lessons/l-rt", { as: T, body: { documents: "[]" } });
  check("gỡ tệp khỏi bài ⇒ học sinh của lớp cũng 403", (await get(S)).status === 403);

  section("2. Chuyển sang riêng tư (POST /api/tutor/thu-vien/rieng-tu)");
  const EP = "/api/tutor/thu-vien/rieng-tu";
  check("khách → 401", (await api("POST", EP, { body: { urls: [CU] } })).status === 401);
  check("học sinh → 403", (await api("POST", EP, { as: S, body: { urls: [CU] } })).status === 403);
  check("không có link nào → 400", (await api("POST", EP, { as: T, body: { urls: [] } })).status === 400);
  const bad = await api("POST", EP, { as: T, body: { urls: ["https://drive.google.com/file/d/abc/view", "https://res.cloudinary.com.evil.example/x.pdf"] } });
  check("link không phải tệp cũ công khai (Drive, máy giả mạo) ⇒ từ chối từng mục, không chuyển gì", bad.status === 200 && bad.json?.moved === 0 && bad.json?.results?.every((r: { ok: boolean }) => !r.ok), bad.json);
  const nAssets = await prisma.fileAsset.count();
  const steal = await api("POST", EP, { as: T2, body: { urls: [CU] } });
  check("gia sư khác gửi link tệp cũ của lớp người ta ⇒ 'Không thấy…', không tải", steal.json?.moved === 0 && /Không thấy/.test(steal.json?.results?.[0]?.error ?? ""), steal.json);
  const own = await api("POST", EP, { as: T, body: { urls: [CU] } });
  const l = await prisma.lesson.findUnique({ where: { id: "l-cu" } });
  check("chủ lớp, tệp cũ không tải được ⇒ báo lỗi bằng chữ, KHÔNG đổi link trong bài", own.status === 200 && own.json?.moved === 0 && !!own.json?.results?.[0]?.error && (l?.documents ?? "").includes(CU), { json: own.json, docs: l?.documents });
  check("không để FileAsset mồ côi khi chuyển hỏng", (await prisma.fileAsset.count()) === nAssets);
  await done();
})().catch(async e => { console.error(e); process.exitCode = 1; await done(); });
