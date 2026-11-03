// BU-02 — giaoTrinh.ts (THUẦN) + các hàm thuần đi kèm: cấu hình tải tài liệu, kiểm documents JSON, dựng chuỗi Cloudinary riêng tư, parseLessonDocuments(allowKinFiles).
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-giao-trinh-lib.ts   (không cần máy chủ, không cần DB thật)
// Ca phá cố ý: link độc (javascript:, data:, http://, youtube.com.evil.example) không được đổi cột; 21 link video / 31 tài liệu bị từ chối; tên 300 ký tự bị cắt;
// tệp .exe/.mp4 khi cờ video tắt; tệp vượt hạn mức; mã tệp KiN lạ trong documents; trùng URL; lessonTypeFor khớp từng ca với deriveTypes+serializeTypes của trang quản trị cũ.
// Mutation tự thử: đổi MAX_LINKS_PER_SLOT thành 21 ⇒ ca "21 link" đỏ; bỏ nhánh isSocialVideoHost trong routeInput ⇒ ca Facebook đỏ; itemKey đổi sang phụ thuộc vị trí ⇒ ca "đổi thứ tự" đỏ.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PROTECTED_LESSON_FIELDS } from "@/lib/mediaAccess";
import { deriveItems, itemKey, routeInput, placeItem, removeItem, lessonTypeFor, mergeLibrary, docTypeOf, storedDocType, kinFileIdOf, kinFileLink, MAX_LINKS_PER_SLOT, MAX_ITEM_NAME, type GtConfig, type LessonRow } from "@/lib/giaoTrinh";
import { resolveDocumentUploadConfig, resolveVideoUploadConfig, validateDocumentFile, DOCUMENT_MAX_BYTES, DOCUMENT_QUOTA_BYTES, DOCUMENT_MIME_BY_EXT, MAX_DOCUMENTS_PER_LESSON } from "@/lib/mediaStorage";
import { cloudinaryDocPublicId, cloudinaryDocUploadInit, cloudinarySignedRawUrl, signCloudinaryParams } from "@/lib/mediaStorageServer";
import { validateDocumentsJson, documentFileIds } from "@/lib/lessonMediaServer";
import { parseLessonDocuments } from "@/lib/library";
import { check, section, done } from "./h";

const MB = 1024 * 1024;
const YT = "dQw4w9WgXcQ";
const KIN = "ck1abcdEFGH_12";               // mã tệp KiN giả
const KIN2 = "ck2zzzzZZZZ_99";

const cfgLocal = (over: Partial<GtConfig["document"]> = {}, vid = true): GtConfig => {
  const v = resolveVideoUploadConfig(vid ? {} : { NODE_ENV: "production" });
  const d = resolveDocumentUploadConfig({});
  return { video: { enabled: v.enabled, reason: v.reason, maxBytes: v.maxBytes }, document: { enabled: d.enabled, reason: d.reason, maxBytes: d.maxBytes, quotaBytes: d.quotaBytes, usedBytes: 0, exts: d.exts, ...over } };
};
const cfgProd = (): GtConfig => {
  const v = resolveVideoUploadConfig({ NODE_ENV: "production" }), d = resolveDocumentUploadConfig({ NODE_ENV: "production" });
  return { video: { enabled: v.enabled, reason: v.reason, maxBytes: v.maxBytes }, document: { enabled: d.enabled, reason: d.reason, maxBytes: d.maxBytes, quotaBytes: d.quotaBytes, usedBytes: 0, exts: d.exts } };
};

// ─── deriveItems ────────────────────────────────────────────────────────────
section("deriveItems — bài có đủ video 2 link (JSON), Zoom, Azota+hạn, 3 tài liệu");
const full: LessonRow = {
  id: "l1", title: "Bài 1", type: '["record","live","quiz"]',
  videoUrl: JSON.stringify([`https://youtu.be/${YT}`, "https://vimeo.com/123456789"]),
  zoomUrl: "https://zoom.us/j/84012345678", azotaUrl: "https://azota.vn/de/abc", azotaDeadline: "2026-11-05T20:00",
  documents: JSON.stringify([
    { name: "De-cuong.pdf", url: "https://cdn.example.vn/de-cuong.pdf", type: "pdf" },
    { name: "Bang-diem.xlsx", url: kinFileLink(KIN), type: "xls" },
    { name: "Cũ.pdf", url: "https://res.cloudinary.com/demo/raw/upload/cu.pdf", type: "pdf" },
  ]),
};
const items = deriveItems(full, { assignments: 2 });
const cnt = (k: string) => items.filter(i => i.kind === k).length;
check("tổng 8 mục: 2 video, 1 live, 1 Azota, 3 tài liệu, 1 mục đếm bài tập", items.length === 8 && cnt("video") === 2 && cnt("live") === 1 && cnt("assignment") === 2 && cnt("document") === 3, items.map(i => i.kind));
check("video 1 là YouTube, ô video, lưu dạng link; video 2 là Vimeo", items[0].label === "YouTube" && items[0].slot === "video" && items[0].storage === "link" && items[1].label === "Vimeo");
check("Zoom ở ô live, nhãn 'Phòng Zoom'", items.find(i => i.kind === "live")?.label === "Phòng Zoom" && items.find(i => i.kind === "live")?.slot === "live");
check("Azota ở ô azota kind assignment, có url", items.find(i => i.slot === "azota")?.kind === "assignment" && items.find(i => i.slot === "azota")?.label === "Azota");
const docs = items.filter(i => i.kind === "document");
check("tài liệu: link ngoài / Tệp trên KiN (storage kin) / Tệp cũ công khai (cloudinary_cu)", docs[0].storage === "link" && docs[1].storage === "kin" && docs[1].label === "Tệp trên KiN" && docs[2].storage === "cloudinary_cu" && /công khai/.test(docs[2].label));
check("mục đếm Bài tập tự nộp: url null, count 2, không có ô, khoá cố định", (() => { const c = items.find(i => i.key === "assignment:count"); return !!c && c.url === null && c.count === 2 && c.slot === null; })());
check("không có assignments ⇒ không có mục đếm", !deriveItems(full).some(i => i.key === "assignment:count") && !deriveItems(full, { assignments: 0 }).some(i => i.key === "assignment:count"));
check("mọi khoá mục là duy nhất trong một bài", new Set(items.map(i => i.key)).size === items.length);
check("không mục nào broken ở bài sạch", items.every(i => !i.broken));

section("deriveItems — dữ liệu cũ HỎNG vẫn hiện, gắn nhãn, không ném");
const broken = deriveItems({ videoUrl: JSON.stringify(["javascript:alert(1)", `https://youtu.be/${YT}`, "http://khong-an-toan.vn/a"]), zoomUrl: "xem zoom", documents: "[{hỏng", azotaUrl: "https://www.facebook.com/x" });
check("2 video hỏng đánh dấu broken, kèm lý do; video tốt giữ nguyên", broken.filter(i => i.slot === "video" && i.broken).length === 2 && broken.find(i => i.label === "YouTube")?.broken === false && broken.filter(i => i.broken).every(i => !!i.warning));
check("zoomUrl là chữ thường ⇒ hiện, broken", broken.some(i => i.slot === "live" && i.broken));
check("documents JSON hỏng ⇒ không ném, không mục tài liệu", !broken.some(i => i.kind === "document"));
check("link hợp lệ nhưng nằm SAI Ô (Facebook ở ô Azota) ⇒ hiện, không broken, có cảnh báo", (() => { const a = broken.find(i => i.slot === "azota"); return !!a && !a.broken; })());
check("mọi dạng cột bậy không ném: null, undefined, '', '[]', 'null', '{}', số", [null, undefined, "", "[]", "null", "{}", "123", "[1,2]", "[null]"].every(v => { try { deriveItems({ videoUrl: v as string, zoomUrl: v as string, azotaUrl: v as string, documents: v as string }); return true; } catch { return false; } }));
check("tài liệu thiếu tên ⇒ lấy địa chỉ làm tên; tên 400 ký tự ⇒ cắt", (() => { const d = deriveItems({ documents: JSON.stringify([{ url: "https://x.vn/a.pdf" }, { name: "n".repeat(400), url: "https://x.vn/b.pdf" }]) }); return d[0].name === "https://x.vn/a.pdf" && d[1].name.length === MAX_ITEM_NAME; })());
check("tài liệu có đường dẫn mã tệp KiN sai dạng ⇒ coi là hỏng (không thành 'Tệp trên KiN')", (() => { const d = deriveItems({ documents: JSON.stringify([{ name: "x", url: "/api/media/ab/file" }, { name: "y", url: "/etc/passwd" }]) }); return d.every(i => i.broken && i.storage !== "kin"); })());

// ─── itemKey ────────────────────────────────────────────────────────────────
section("itemKey — ổn định, không phụ thuộc thứ tự");
check("vectơ SHA-1 chuẩn: sha1('abc') = a9993e36…", itemKey("video", "abc") === "video:a9993e3647");
check("khớp node:crypto với 30 chuỗi (ASCII, tiếng Việt, rất dài, đúng ranh giới 55/56/64 byte)", (() => {
  const samples = ["", "a", "x".repeat(55), "x".repeat(56), "x".repeat(63), "x".repeat(64), "x".repeat(65), "x".repeat(1000), "Đề cương ôn tập ✓", "https://youtu.be/dQw4w9WgXcQ?t=90", ...Array.from({ length: 20 }, (_, i) => `https://example.vn/${i}/` + "ế".repeat(i * 7))];
  return samples.every(s => itemKey("document", s).slice(9) === createHash("sha1").update(s.trim()).digest("hex").slice(0, 10));
})());
check("cùng url khác ô ⇒ khoá khác (video:… ≠ document:…)", itemKey("video", "https://a.vn/x") !== itemKey("document", "https://a.vn/x"));
check("đổi thứ tự link trong cột ⇒ tập khoá y hệt", (() => {
  const a = deriveItems({ videoUrl: JSON.stringify([`https://youtu.be/${YT}`, "https://vimeo.com/123456789"]) }).map(i => i.key).sort().join();
  const b = deriveItems({ videoUrl: JSON.stringify(["https://vimeo.com/123456789", `https://youtu.be/${YT}`]) }).map(i => i.key).sort().join();
  return a === b;
})());
check("khoá của mục tính từ deriveItems = itemKey(ô, url đã chuẩn hoá)", deriveItems({ videoUrl: `https://youtu.be/${YT}` })[0].key === itemKey("video", `https://youtu.be/${YT}`));
check("khoảng trắng hai đầu không đổi khoá", itemKey("video", "  https://a.vn/x ") === itemKey("video", "https://a.vn/x"));

// ─── placeItem ──────────────────────────────────────────────────────────────
section("placeItem — thêm, trùng, giới hạn, cắt tên");
const empty: LessonRow = { id: "l", title: "B", type: "document", videoUrl: null, zoomUrl: null, azotaUrl: null, documents: "[]" };
const p1 = placeItem(empty, { slot: "video", url: `https://youtu.be/${YT}` });
check("thêm YouTube vào bài trống: patch videoUrl = chuỗi đơn, type = record, mục đúng khoá", p1.ok && !p1.duplicate && p1.patch.videoUrl === `https://youtu.be/${YT}` && p1.patch.type === "record" && p1.item.key === itemKey("video", `https://youtu.be/${YT}`), p1);
const afterP1 = { ...empty, ...(p1.ok ? p1.patch : {}) };
const p2 = placeItem(afterP1, { slot: "video", url: "https://vimeo.com/123456789" });
check("link thứ 2 ⇒ cột thành JSON mảng 2 link", p2.ok && JSON.parse(p2.patch.videoUrl as string).length === 2);
const dup = placeItem(afterP1, { slot: "video", url: `youtube.com/watch?v=${YT}`.replace("youtube.com/watch?v=" + YT, `https://youtu.be/${YT}`) });
check("trùng URL ⇒ duplicate:true, patch RỖNG (không đổi gì)", dup.ok && dup.duplicate && Object.keys(dup.patch).length === 0);
check("trùng sau khi chuẩn hoá (thiếu https://, khoảng trắng) vẫn là trùng", (() => { const d = placeItem(afterP1, { slot: "video", url: `  youtu.be/${YT}  ` }); return d.ok && d.duplicate; })());
const v20 = JSON.stringify(Array.from({ length: MAX_LINKS_PER_SLOT }, (_, i) => `https://youtu.be/${String(i).padStart(11, "x")}`));
check("đủ 20 link rồi thêm link THỨ 21 ⇒ lỗi 'Tối đa 20', không đổi gì", (() => { const r = placeItem({ ...empty, videoUrl: v20 }, { slot: "video", url: `https://youtu.be/${YT}` }); return !r.ok && /Tối đa 20/.test(r.error); })());
check("đang có 20 link, thêm trùng ⇒ vẫn là duplicate (không báo vượt)", (() => { const r = placeItem({ ...empty, videoUrl: v20 }, { slot: "video", url: "https://youtu.be/xxxxxxxxxx0" }); return r.ok && r.duplicate; })());
const d30 = JSON.stringify(Array.from({ length: MAX_DOCUMENTS_PER_LESSON }, (_, i) => ({ name: `t${i}`, url: `https://x.vn/${i}.pdf`, type: "pdf" })));
check("30 tài liệu rồi thêm tài liệu THỨ 31 ⇒ lỗi, cột không đổi", (() => { const r = placeItem({ ...empty, documents: d30 }, { slot: "document", url: "https://x.vn/moi.pdf" }); return !r.ok && /tối đa 30/.test(r.error); })());
const long = placeItem(empty, { slot: "document", url: "https://x.vn/a.pdf", name: "N".repeat(300) });
check("tên 300 ký tự ⇒ CẮT còn 200, không lỗi", long.ok && JSON.parse(long.patch.documents as string)[0].name.length === 200 && long.item.name.length === 200);
check("tài liệu không tên ⇒ lấy tên tệp từ đường dẫn (giải mã %)", (() => { const r = placeItem(empty, { slot: "document", url: "https://x.vn/thu-muc/B%C3%A0i%20t%E1%BA%ADp.pdf" }); return r.ok && JSON.parse(r.patch.documents as string)[0].name === "Bài tập.pdf"; })());
check("tài liệu lưu `type` ≤10 ký tự theo đuôi (pdf, doc, xls, ppt, img, txt, file)", (() => {
  const t = (url: string, name: string) => { const r = placeItem(empty, { slot: "document", url, name }); return r.ok ? JSON.parse(r.patch.documents as string)[0].type : "?"; };
  return t("https://x.vn/a.pdf", "a.pdf") === "pdf" && t("https://x.vn/a.docx", "a.docx") === "doc" && t("https://x.vn/a.xlsx", "a.xlsx") === "xls" && t("https://x.vn/a.pptx", "a.pptx") === "ppt" && t("https://x.vn/a.png", "a.png") === "img" && t("https://x.vn/a", "Trang web") === "file";
})());
check("tệp KiN: ghi đúng đường dẫn /api/media/<mã>/file, không đi qua bộ kiểm link", (() => { const r = placeItem(empty, { slot: "document", url: kinFileLink(KIN), name: "De.pdf" }); return r.ok && JSON.parse(r.patch.documents as string)[0].url === kinFileLink(KIN) && r.item.storage === "kin"; })());
check("thêm tài liệu KHÔNG đổi các cột khác (patch chỉ có documents)", (() => { const r = placeItem(empty, { slot: "document", url: "https://x.vn/a.pdf" }); return r.ok && Object.keys(r.patch).join() === "documents"; })());
check("thêm Zoom vào bài có video: type = ['record','live']", (() => { const r = placeItem({ ...empty, videoUrl: `https://youtu.be/${YT}`, type: "record" }, { slot: "live", url: "https://zoom.us/j/84012345678" }); return r.ok && r.patch.type === '["record","live"]'; })());

section("placeItem — link ĐỘC / sai ô / hỏng: lỗi và KHÔNG đổi cột");
const poison: [string, string, "video" | "live" | "azota" | "document"][] = [
  ["javascript:", "javascript:alert(1)", "video"], ["javascript: ở ô tài liệu", "javascript:alert(1)", "document"], ["data:", "data:text/html,<script>alert(1)</script>", "document"],
  ["http://", "http://youtu.be/dQw4w9WgXcQ", "video"], ["youtube.com.evil.example", "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ", "video"],
  ["2100 ký tự", "https://x.vn/" + "a".repeat(2100), "document"], ["có khoảng trắng", "https://x.vn/a b", "document"], ["file:", "file:///etc/passwd", "document"],
  [".exe ở ô tài liệu", "https://x.vn/setup.exe", "document"], ["mp4 trực tiếp ở ô video", "https://x.vn/a.mp4", "video"], ["Facebook ở ô video", "https://www.facebook.com/watch/?v=1", "video"],
  ["đường dẫn nội bộ lạ ở ô tài liệu", "/etc/passwd", "document"], ["//host ở ô tài liệu", "//evil.example/a.pdf", "document"], ["mã tệp KiN quá ngắn", "/api/media/ab/file", "document"],
  ["rỗng", "   ", "document"],
];
for (const [name, url, slot] of poison) {
  const r = placeItem(empty, { slot, url });
  check(`${name} ⇒ từ chối`, !r.ok && !!r.error, r);
}
check("dán YouTube vào ô tài liệu / Azota vào ô video / Zoom vào ô Azota ⇒ lỗi kèm moveTo", (() => {
  const a = placeItem(empty, { slot: "document", url: `https://youtu.be/${YT}` });
  const b = placeItem(empty, { slot: "video", url: "https://azota.vn/de/x" });
  const c = placeItem(empty, { slot: "azota", url: "https://zoom.us/j/84012345678" });
  return !a.ok && a.moveTo === "video" && !b.ok && b.moveTo === "azota" && !c.ok && c.moveTo === "live";
})());

section("removeItem — gỡ theo khoá, hai lần không lỗi");
const two = { ...empty, videoUrl: JSON.stringify([`https://youtu.be/${YT}`, "https://vimeo.com/123456789"]), type: "record", documents: JSON.stringify([{ name: "a", url: "https://x.vn/a.pdf", type: "pdf" }, { name: "k", url: kinFileLink(KIN), type: "pdf" }]) };
const rk = itemKey("video", `https://youtu.be/${YT}`);
const rem = removeItem(two, rk);
check("gỡ 1 trong 2 video ⇒ cột còn chuỗi đơn Vimeo", rem.removed && rem.patch.videoUrl === "https://vimeo.com/123456789");
const rem2 = removeItem({ ...two, ...rem.patch }, rk);
check("gỡ lần 2 cùng khoá ⇒ removed:false, patch rỗng, không ném", !rem2.removed && Object.keys(rem2.patch).length === 0);
check("gỡ video cuối ⇒ cột null và type quay về 'document'", (() => { const r = removeItem({ ...empty, videoUrl: `https://youtu.be/${YT}`, type: "record" }, rk); return r.removed && r.patch.videoUrl === null && r.patch.type === "document"; })());
check("gỡ tài liệu KiN theo khoá ⇒ còn tài liệu kia; tệp KiN KHÔNG bị đụng (chỉ cột documents)", (() => { const r = removeItem(two, itemKey("document", kinFileLink(KIN))); return r.removed && Object.keys(r.patch).join() === "documents" && JSON.parse(r.patch.documents as string).length === 1; })());
check("khoá lạ / rỗng / khoá của ô khác ⇒ không gỡ gì", !removeItem(two, "video:0000000000").removed && !removeItem(two, "").removed && !removeItem(two, itemKey("document", `https://youtu.be/${YT}`)).removed);

// ─── routeInput ─────────────────────────────────────────────────────────────
section("routeInput — 25 đầu vào (link / tệp / rỗng / độc / cờ video)");
const L = cfgLocal(), P = cfgProd();
const T = (text: string, cfg = L) => routeInput({ text }, cfg);
const F = (name: string, size: number, type = "", cfg = L) => routeInput({ file: { name, size, type } }, cfg);
const r1 = T(`https://youtu.be/${YT}`);
check("1. YouTube ⇒ video / ô video / via link", r1.ok && r1.kind === "video" && r1.slot === "video" && r1.via === "link" && r1.label === "YouTube");
const r2 = T("https://zoom.us/j/84012345678");
check("2. Zoom phòng ⇒ live", r2.ok && r2.kind === "live" && r2.slot === "live");
check("3. Meet ⇒ live", (() => { const r = T("https://meet.google.com/abc-defg-hij"); return r.ok && r.kind === "live"; })());
check("4. Azota ⇒ assignment / ô azota", (() => { const r = T("https://azota.vn/de/abc"); return r.ok && r.kind === "assignment" && r.slot === "azota"; })());
check("5. Google Form ⇒ ô azota kèm cảnh báo", (() => { const r = T("https://docs.google.com/forms/d/e/1FAIpQLSdAbCd/viewform"); return r.ok && r.slot === "azota" && /không phải Azota/.test(r.warning ?? ""); })());
check("6. PDF trực tiếp ⇒ tài liệu, gợi ý tên từ đường dẫn", (() => { const r = T("https://cdn.example.vn/de-cuong.pdf"); return r.ok && r.kind === "document" && r.suggestedName === "de-cuong.pdf"; })());
check("7. Google Docs ⇒ tài liệu", (() => { const r = T("https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit"); return r.ok && r.slot === "document"; })());
check("8. thiếu https:// (youtu.be/…) vẫn nhận", T(`youtu.be/${YT}`).ok);
check("9. trang web lạ ⇒ tài liệu + cảnh báo tab mới", (() => { const r = T("https://example.vn/trang"); return r.ok && r.slot === "document" && /tab mới/.test(r.warning ?? ""); })());
check("10. tệp KiN dùng lại từ Thư viện (/api/media/<mã>/file) ⇒ tài liệu / Tệp trên KiN", (() => { const r = T(kinFileLink(KIN)); return r.ok && r.slot === "document" && r.label === "Tệp trên KiN"; })());
check("11. rỗng ⇒ lỗi 'Chưa dán link'", (() => { const r = T(""); return !r.ok && /Chưa dán/.test(r.error); })());
check("12. toàn khoảng trắng ⇒ lỗi", !T("    ").ok);
check("13. javascript: ⇒ lỗi", !T("javascript:alert(1)").ok);
check("14. data: ⇒ lỗi", !T("data:text/html;base64,AAAA").ok);
check("15. http:// ⇒ lỗi nói rõ https", (() => { const r = T("http://youtu.be/dQw4w9WgXcQ"); return !r.ok && /https/.test(r.error); })());
check("16. youtube.com.evil.example ⇒ KHÔNG thành video (ra tài liệu 'trang lạ', không bao giờ nhúng)", (() => { const r = T(`https://youtube.com.evil.example/watch?v=${YT}`); return !r.ok || r.slot === "document"; })());
check("17. Facebook ⇒ lỗi 'đưa video lên YouTube'", (() => { const r = T("https://www.facebook.com/watch/?v=1"); return !r.ok && /YouTube/.test(r.error); })());
check("18. link .mp4 trực tiếp ⇒ lỗi", !T("https://x.vn/a.mp4").ok);
check("19. link .exe ⇒ lỗi", !T("https://x.vn/a.exe").ok);
check("20. nhiều link dính nhau (có khoảng trắng) ⇒ lỗi", (() => { const r = T(`https://youtu.be/${YT} https://youtu.be/${YT}`); return !r.ok && /khoảng trắng/.test(r.error); })());
check("21. đường dẫn nội bộ lạ (/admin) ⇒ lỗi", !T("/admin/khoa-hoc").ok && !T("/api/media/ck1abcdEFGH_12/stream").ok);
check("22. playlist YouTube ⇒ lỗi", !T("https://www.youtube.com/playlist?list=PL123").ok);
check("23. quá 2000 ký tự ⇒ lỗi", !T("https://x.vn/" + "a".repeat(2100)).ok);
check("24. input null / không có text ⇒ lỗi, không ném", (() => { try { return !routeInput({ text: undefined as unknown as string }, L).ok; } catch { return false; } })());
check("25. link ô sai: Azota ⇒ không bị moveTo (tự định tuyến ô đúng, không cần người dùng chuyển)", (() => { const r = T("https://azota.vn/de/x"); return r.ok && r.slot === "azota"; })());

section("routeInput — TỆP: tài liệu, video khi cờ tắt/bật, hạn mức");
check("PDF 1 MB ⇒ ok, via document_file, gợi ý tên", (() => { const r = F("De cuong.pdf", MB, "application/pdf"); return r.ok && r.via === "document_file" && r.kind === "document" && r.suggestedName === "De cuong.pdf" && r.label === "PDF"; })());
check("docx/xlsx/pptx/png/jpg/webp/txt đều ok", ["a.docx", "a.xlsx", "a.pptx", "a.png", "a.jpg", "a.webp", "a.txt"].every(n => F(n, MB).ok));
check("đúng 25 MB ok; 25 MB + 1 byte ⇒ lỗi nêu số MB và tên tệp", F("a.pdf", DOCUMENT_MAX_BYTES).ok && (() => { const r = F("Đề.pdf", DOCUMENT_MAX_BYTES + 1); return !r.ok && /Đề\.pdf/.test(r.error) && /25 MB/.test(r.error); })());
check(".exe / .html / .svg / .zip / .js ⇒ 'không nhận loại tệp này'", ["a.exe", "a.html", "a.svg", "a.zip", "a.js", "a.bat", "a.7z"].every(n => { const r = F(n, MB); return !r.ok && /không nhận loại tệp này/.test(r.error); }));
check("đuôi lạ (.abc), không đuôi, tệp rỗng ⇒ lỗi", !F("a.abc", MB).ok && !F("README", MB).ok && !F("a.pdf", 0).ok);
check("PDF mà MIME khai image/png ⇒ lỗi (họ MIME sai đuôi)", !F("a.pdf", MB, "image/png").ok);
check("MIME trống hoặc application/octet-stream ⇒ không từ chối oan", F("a.pdf", MB, "").ok && F("a.pdf", MB, "application/octet-stream").ok);
check("vượt hạn mức kho (đã dùng 499 MB + 2 MB) ⇒ lỗi nêu hạn mức", (() => { const r = routeInput({ file: { name: "a.pdf", size: 2 * MB } }, cfgLocal({ usedBytes: 499 * MB })); return !r.ok && /đầy/.test(r.error); })());
check("cờ document tắt (production thiếu Cloudinary) ⇒ lỗi + gợi ý dán link Drive, không rơi về cách khác", (() => { const r = F("a.pdf", MB, "", P); return !r.ok && /Drive/.test(r.error); })());
check("video .mp4 khi cờ video TẮT (production) ⇒ lỗi 'chưa bật', nói dán YouTube", (() => { const r = F("bai1.mp4", 10 * MB, "video/mp4", P); return !r.ok && /chưa bật/.test(r.error) && /YouTube/.test(r.error); })());
check("video .mov/.webm/.m4v khi cờ tắt ⇒ lỗi hết", ["a.mov", "a.webm", "a.m4v"].every(n => !F(n, MB, "", P).ok));
check("video .mp4 khi cờ BẬT (máy cục bộ) ⇒ ok, via video_file, ô video", (() => { const r = F("bai1.mp4", 10 * MB, "video/mp4", L); return r.ok && r.via === "video_file" && r.slot === "video" && r.kind === "video"; })());
check("video 200 MB + 1 byte khi cờ bật ⇒ lỗi dung lượng", !F("b.mp4", 200 * MB + 1, "video/mp4", L).ok);
check("tệp .mp4 với MIME text/html (giả video) khi cờ bật ⇒ lỗi", !F("b.mp4", MB, "text/html", L).ok);
check("đuôi kép a.pdf.exe ⇒ lỗi; a.exe.pdf ⇒ ok theo đuôi cuối (nội dung do A2 kiểm)", !F("a.pdf.exe", MB).ok && F("a.exe.pdf", MB).ok);
check("tên tệp có đường dẫn (C:\\x\\a.pdf) lấy đúng đuôi", F("C:\\x\\a.pdf", MB).ok);

// ─── lessonTypeFor: bảng vàng với deriveTypes+serializeTypes của trang quản trị cũ ───
section("lessonTypeFor = deriveTypes + serializeTypes của trang admin (bảng vàng 8 tổ hợp + biến thể)");
// BẢN SAO NGUYÊN VĂN logic ở src/app/(admin)/admin/khoa-hoc/[id]/page.tsx:96-142 (parseUrls + deriveTypes + serializeTypes). Sửa trang đó thì phải sửa bản sao này.
function parseUrls(raw: string | null | undefined): string[] { if (!raw) return [""]; try { const p = JSON.parse(raw); if (Array.isArray(p) && p.length) return p as string[]; } catch { /* chuỗi thường */ } return [raw]; }
function deriveTypes(v: string[], z: string[], a: string[]): string[] { const t: string[] = []; if (v.some(u => u.trim())) t.push("record"); if (z.some(u => u.trim())) t.push("live"); if (a.some(u => u.trim())) t.push("quiz"); return t.length ? t : ["document"]; }
function serializeTypes(t: string[]): string { return t.length === 1 ? t[0] : JSON.stringify(t); }
const oldWay = (l: LessonRow) => serializeTypes(deriveTypes(parseUrls(l.videoUrl), parseUrls(l.zoomUrl), parseUrls(l.azotaUrl)));
const V = `https://youtu.be/${YT}`, Z = "https://zoom.us/j/84012345678", A = "https://azota.vn/de/x";
let n = 0;
for (let mask = 0; mask < 8; mask++) {
  const l: LessonRow = { videoUrl: mask & 1 ? V : null, zoomUrl: mask & 2 ? Z : null, azotaUrl: mask & 4 ? A : null };
  const want = oldWay(l), got = lessonTypeFor(l);
  n++; check(`tổ hợp ${mask.toString(2).padStart(3, "0")} (video${mask & 1 ? "✓" : "·"} live${mask & 2 ? "✓" : "·"} azota${mask & 4 ? "✓" : "·"}) ⇒ ${got}`, got === want, { got, want });
}
check("đã đủ 8 tổ hợp", n === 8);
const variants: LessonRow[] = [
  { videoUrl: JSON.stringify([V, "https://vimeo.com/123456789"]) }, { videoUrl: "" , zoomUrl: "  " }, { videoUrl: undefined }, { azotaUrl: JSON.stringify([A, A + "2"]), zoomUrl: Z },
  { videoUrl: JSON.stringify(["", V]) }, { videoUrl: JSON.stringify(["", " "]) },
];
for (const [i, l] of variants.entries()) {
  const want = oldWay(l), got = lessonTypeFor(l);
  check(`biến thể ${i + 1} (nhiều link / rỗng / khoảng trắng) khớp bản cũ`, got === want, { got, want });
}
check("ca lệch DUY NHẤT đã biết: cột là chuỗi '[]' (trang cũ coi là có video, bản mới coi là rỗng; không bao giờ do KiN sinh ra)", oldWay({ videoUrl: "[]" }) === "record" && lessonTypeFor({ videoUrl: "[]" }) === "document");

// ─── mergeLibrary ───────────────────────────────────────────────────────────
section("mergeLibrary — gộp trùng URL, nhóm chưa gắn");
const shared = "https://cdn.example.vn/chung.pdf";
const lib = mergeLibrary({
  lessons: [
    { courseId: "c1", courseName: "Toán 9A", lessonId: "l1", lessonTitle: "Bài 1", documents: JSON.stringify([{ name: "Chung.pdf", url: shared, type: "pdf" }, { name: "Riêng.docx", url: kinFileLink(KIN), type: "doc" }]) },
    { courseId: "c2", courseName: "Toán 9B", lessonId: "l2", lessonTitle: "Bài 7", documents: JSON.stringify([{ name: "chung (bản 2).pdf", url: shared, type: "pdf" }]) },
    { courseId: "c2", courseName: "Toán 9B", lessonId: "l3", lessonTitle: "Bài 8", documents: JSON.stringify([{ name: "Chung.pdf", url: shared }, { name: "Chung.pdf", url: shared }]) },
    { courseId: "c3", courseName: "Hỏng", lessonId: "l4", lessonTitle: "Bài 9", documents: "[{hỏng" },
  ],
  assets: [{ id: KIN, name: "Riêng.docx", bytes: 2048 }, { id: KIN2, name: "Chưa-gắn.pdf", bytes: 5 * MB }],
  examFiles: [{ id: "e1", name: "De-goc.pdf" }],
});
const sh = lib.items.find(i => i.url === shared)!;
check("hai tài liệu cùng URL ở 3 bài ⇒ MỘT mục, 'dùng ở 3 bài' (mỗi bài đếm một lần dù lặp 2 lần trong bài)", lib.items.length === 2 && sh.usedIn.length === 3 && new Set(sh.usedIn.map(u => u.lessonId)).size === 3, lib.items.map(i => [i.url, i.usedIn.length]));
check("usedIn mang tên lớp + tên bài (không có dữ liệu học sinh)", sh.usedIn.some(u => u.courseName === "Toán 9B" && u.lessonTitle === "Bài 7") && !JSON.stringify(lib).match(/email|userId|studentId/i));
check("tên mục lấy theo lần xuất hiện ĐẦU; nhãn lưu trữ link ngoài", sh.name === "Chung.pdf" && sh.storage === "link" && sh.docType === "pdf");
check("tệp KiN đã có bài tham chiếu ⇒ KHÔNG nằm ở nhóm 'chưa gắn'; tệp chưa ai dùng ⇒ nằm ở đó", lib.unattached.length === 1 && lib.unattached[0].id === KIN2 && lib.unattached[0].link === kinFileLink(KIN2) && lib.unattached[0].bytes === 5 * MB);
check("đề gốc đi theo nguyên vẹn; documents hỏng không làm vỡ", lib.examFiles.length === 1 && lib.examFiles[0].id === "e1");
check("rỗng hết ⇒ ba nhóm rỗng, không ném", (() => { const e = mergeLibrary({ lessons: [], assets: [] }); return e.items.length === 0 && e.unattached.length === 0 && e.examFiles.length === 0; })());
check("asset bytes null (đang tải dở) ⇒ 0", mergeLibrary({ lessons: [], assets: [{ id: KIN, name: "x.pdf", bytes: null }] }).unattached[0].bytes === 0);

// ─── tiện ích nhỏ ───────────────────────────────────────────────────────────
section("docTypeOf / storedDocType / kinFileIdOf");
check("docTypeOf: tên trước, đường dẫn sau, Google Docs, gợi ý", docTypeOf("a.docx", null) === "word" && docTypeOf("Trang", "https://x.vn/a.pdf") === "pdf" && docTypeOf("x", "https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOp/edit") === "sheet" && docTypeOf("x", "https://x.vn/a", "ppt") === "slide" && docTypeOf("x", "https://x.vn/a") === "file");
check("storedDocType ≤ 10 ký tự", (["pdf", "word", "sheet", "slide", "image", "text", "file"] as const).every(t => storedDocType(t).length <= 10));
check("kinFileIdOf chỉ nhận đúng dạng; cắt khoảng trắng; từ chối stream/ngắn/../", kinFileIdOf(kinFileLink(KIN)) === KIN && kinFileIdOf(` ${kinFileLink(KIN)} `) === KIN && kinFileIdOf("/api/media/ck1abcdEFGH_12/stream") === null && kinFileIdOf("/api/media/ab/file") === null && kinFileIdOf("/api/media/../x/file") === null && kinFileIdOf(null) === null);

// ─── cấu hình tải tài liệu, MIME, hạn mức ───────────────────────────────────
section("resolveDocumentUploadConfig — độc lập với cờ video (Q1)");
const dProd = resolveDocumentUploadConfig({ NODE_ENV: "production" });
check("production thiếu Cloudinary ⇒ TẮT, driver none, lý do bảo dán link Drive", !dProd.enabled && dProd.driver === "none" && /Drive/.test(dProd.reason ?? ""), dProd);
check("production thiếu 1/3 biến ⇒ vẫn TẮT", !resolveDocumentUploadConfig({ NODE_ENV: "production", CLOUDINARY_CLOUD_NAME: "c", CLOUDINARY_API_KEY: "k" }).enabled);
check("production đủ ba biến ⇒ BẬT bằng Cloudinary, 25 MB, hạn mức 500 MB", (() => { const c = resolveDocumentUploadConfig({ NODE_ENV: "production", CLOUDINARY_CLOUD_NAME: "c", CLOUDINARY_API_KEY: "k", CLOUDINARY_API_SECRET: "s" }); return c.enabled && c.driver === "cloudinary" && c.maxBytes === 25 * MB && c.quotaBytes === 500 * MB && DOCUMENT_QUOTA_BYTES === 500 * MB; })());
check("máy cục bộ ⇒ BẬT bằng đĩa; có đủ Cloudinary ⇒ dùng Cloudinary", resolveDocumentUploadConfig({}).driver === "local" && resolveDocumentUploadConfig({ CLOUDINARY_CLOUD_NAME: "c", CLOUDINARY_API_KEY: "k", CLOUDINARY_API_SECRET: "s" }).driver === "cloudinary");
check("cờ KIN_VIDEO_UPLOAD không ảnh hưởng tài liệu (đặt 0 mà tài liệu vẫn bật ở máy cục bộ)", resolveDocumentUploadConfig({ KIN_VIDEO_UPLOAD: "0" }).enabled);
check("và ngược lại: cờ video giữ nguyên (production không đặt ⇒ tắt; cục bộ ⇒ bật)", !resolveVideoUploadConfig({ NODE_ENV: "production" }).enabled && resolveVideoUploadConfig({}).enabled);
check("danh sách đuôi không có svg/html/zip/exe", !dProd.exts.some(e => ["svg", "html", "zip", "exe", "js"].includes(e)) && dProd.exts.length === 12);

section("validateDocumentFile — họ MIME (V3: không tin MIME, nhưng MIME sai họ ⇒ chặn sớm)");
const okFam: [string, string][] = [["a.pdf", "application/pdf"], ["a.docx", DOCUMENT_MIME_BY_EXT.docx], ["a.xlsx", DOCUMENT_MIME_BY_EXT.xlsx], ["a.pptx", DOCUMENT_MIME_BY_EXT.pptx], ["a.doc", "application/msword"], ["a.xls", "application/vnd.ms-excel"], ["a.ppt", "application/vnd.ms-powerpoint"], ["a.txt", "text/plain"], ["a.txt", "text/plain; charset=utf-8"], ["a.png", "image/png"], ["a.jpg", "image/jpeg"], ["a.jpeg", "image/jpeg"], ["a.webp", "image/webp"], ["a.PDF", "APPLICATION/PDF"]];
for (const [n2, t] of okFam) check(`${n2} + ${t} ⇒ ok`, validateDocumentFile({ name: n2, size: MB, type: t }).ok);
const badFam: [string, string][] = [["a.pdf", "image/png"], ["a.pdf", "text/html"], ["a.docx", "application/pdf"], ["a.png", "image/jpeg"], ["a.txt", "text/html"], ["a.jpg", "application/x-msdownload"], ["a.pdf", "application/zip"]];
for (const [n2, t] of badFam) check(`${n2} + ${t} ⇒ chặn`, !validateDocumentFile({ name: n2, size: MB, type: t }).ok);
check("không truyền loại (gọi cũ validateDocumentFile({name,size})) vẫn ok; maxBytes nhỏ hơn 25 MB được tôn trọng, lớn hơn thì vẫn trần 25 MB", validateDocumentFile({ name: "a.pdf", size: MB }).ok && !validateDocumentFile({ name: "a.pdf", size: 2 * MB }, MB).ok && !validateDocumentFile({ name: "a.pdf", size: 26 * MB }, 100 * MB).ok);

// ─── Cloudinary riêng tư (chuỗi dựng; chưa chạy thật, xem ghi chú tut-test) ───
section("Cloudinary tài liệu — raw + authenticated, public_id do máy chủ quyết, chữ ký đúng thuật toán");
const env = { cloud: "kin-demo", apiKey: "123", apiSecret: "s3cret" };
check("public_id = kin-docs/<lớp đã làm sạch>/<mã>.<đuôi thường>", cloudinaryDocPublicId("lop/../x y", "ck1abc", "PDF") === "kin-docs/lop____x_y/ck1abc.pdf", cloudinaryDocPublicId("lop/../x y", "ck1abc", "PDF"));
const init = cloudinaryDocUploadInit(env, "kin-docs/lop1/ck1abc.pdf", 1700000000);
const expectSig = createHash("sha1").update("overwrite=false&public_id=kin-docs/lop1/ck1abc.pdf&timestamp=1700000000&type=authenticated" + env.apiSecret).digest("hex");
check("POST tới /raw/upload (không phải /video), type=authenticated, KHÔNG có upload_preset (không ký)", init.method === "POST" && init.url === "https://api.cloudinary.com/v1_1/kin-demo/raw/upload" && init.fields.type === "authenticated" && !("upload_preset" in init.fields));
check("chữ ký = sha1('overwrite=false&public_id=…&timestamp=…&type=authenticated' + secret); có api_key, không lộ secret", init.fields.signature === expectSig && init.fields.api_key === "123" && !JSON.stringify(init).includes("s3cret"), init);
check("signCloudinaryParams bỏ file/api_key/resource_type và tham số rỗng", signCloudinaryParams({ a: "1", file: "x", api_key: "k", resource_type: "raw", empty: "" }, "S") === createHash("sha1").update("a=1" + "S").digest("hex"));
const signed = cloudinarySignedRawUrl(env, "kin-docs/lop1/ck1abc.pdf");
const sig8 = createHash("sha1").update("kin-docs/lop1/ck1abc.pdf" + env.apiSecret).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").slice(0, 8);
check("địa chỉ phát: /raw/authenticated/s--<8 ký tự>--/<public_id> (đuôi nằm trong public_id)", signed === `https://res.cloudinary.com/kin-demo/raw/authenticated/s--${sig8}--/kin-docs/lop1/ck1abc.pdf` && !signed.includes("s3cret"), signed);
check("đổi secret ⇒ chữ ký đổi (không thể giả chữ ký khi không có secret)", cloudinarySignedRawUrl({ ...env, apiSecret: "khac" }, "kin-docs/lop1/ck1abc.pdf") !== signed);

// ─── validateDocumentsJson (V8 phần thuần) + documentFileIds + parseLessonDocuments(D4) ───
section("validateDocumentsJson — tên ≤200, type ≤10, trùng URL, mã tệp KiN");
const dj = (arr: unknown) => validateDocumentsJson(JSON.stringify(arr));
check("mảng sạch (link, Google Docs, tệp KiN) ⇒ null", dj([{ name: "a", url: "https://x.vn/a.pdf", type: "pdf" }, { name: "g", url: "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit" }, { name: "k", url: kinFileLink(KIN) }]) === null);
check("tên đúng 200 ký tự ok; 201 ký tự ⇒ lỗi", dj([{ name: "n".repeat(200), url: "https://x.vn/a.pdf" }]) === null && /dài quá 200/.test(dj([{ name: "n".repeat(201), url: "https://x.vn/a.pdf" }]) ?? ""));
check("type đúng 10 ký tự ok; 11 ký tự ⇒ lỗi; type không phải chuỗi ⇒ lỗi", dj([{ name: "a", url: "https://x.vn/a.pdf", type: "x".repeat(10) }]) === null && !!dj([{ name: "a", url: "https://x.vn/a.pdf", type: "x".repeat(11) }]) && !!dj([{ name: "a", url: "https://x.vn/a.pdf", type: 5 }]));
check("trùng URL ⇒ lỗi nêu 'trùng'", /trùng/.test(dj([{ name: "a", url: "https://x.vn/a.pdf" }, { name: "b", url: "https://x.vn/a.pdf" }]) ?? "") && /trùng/.test(dj([{ name: "a", url: kinFileLink(KIN) }, { name: "b", url: kinFileLink(KIN) }]) ?? ""));
check("31 tài liệu ⇒ lỗi; đúng 30 ⇒ ok", !!dj(Array.from({ length: 31 }, (_, i) => ({ name: "t", url: `https://x.vn/${i}.pdf` }))) && dj(Array.from({ length: 30 }, (_, i) => ({ name: "t", url: `https://x.vn/${i}.pdf` }))) === null);
check("link độc trong documents (javascript:, http://, .exe, kin-media:, đường dẫn lạ) ⇒ lỗi", ["javascript:alert(1)", "http://x.vn/a.pdf", "https://x.vn/setup.exe", "kin-media:ck1abcdEFGH_12", "/etc/passwd", "/api/media/ab/file", "//evil.example/a.pdf"].every(u => !!dj([{ name: "a", url: u }])));
check("thiếu url ⇒ lỗi; JSON hỏng / không phải mảng ⇒ lỗi; không phải chuỗi ⇒ null (không kiểm)", !!dj([{ name: "a" }]) && !!validateDocumentsJson("{hỏng") && !!validateDocumentsJson('{"a":1}') && validateDocumentsJson(123) === null && validateDocumentsJson(undefined) === null);
check("documentFileIds: lấy đúng mã tệp KiN, bỏ trùng, bỏ link ngoài, không ném khi JSON hỏng", (() => {
  const ids = documentFileIds(JSON.stringify([{ url: kinFileLink(KIN) }, { url: kinFileLink(KIN) }, { url: "https://x.vn/a.pdf" }, { url: kinFileLink(KIN2) }, { url: "/api/media/ck1abcdEFGH_12/stream" }, null, 5]));
  return ids.length === 2 && ids.includes(KIN) && ids.includes(KIN2) && documentFileIds("{hỏng").length === 0 && documentFileIds(null).length === 0;
})());

section("parseLessonDocuments — D4: tệp KiN chỉ khi bật tuỳ chọn (mặc định TẮT cho kho công khai)");
const mixed = JSON.stringify([{ name: "Ngoài", url: "https://x.vn/a.pdf" }, { name: "KiN", url: kinFileLink(KIN) }, { name: "Lạ", url: "/etc/passwd" }, { name: "Stream", url: "/api/media/ck1abcdEFGH_12/stream" }]);
check("mặc định: chỉ http(s) — tệp KiN KHÔNG lọt vào kho công khai cho khách", parseLessonDocuments(mixed).map(d => d.name).join() === "Ngoài");
check("allowKinFiles:true: thêm tệp KiN (đúng dạng /file), vẫn bỏ /etc/passwd và /stream", parseLessonDocuments(mixed, { allowKinFiles: true }).map(d => d.name).join() === "Ngoài,KiN");
check("allowKinFiles không mở cửa cho đường dẫn lạ, //host, javascript:", parseLessonDocuments(JSON.stringify([{ name: "a", url: "//evil.example/x" }, { name: "b", url: "javascript:alert(1)" }, { name: "c", url: "/api/media/ab/file" }]), { allowKinFiles: true }).length === 0);
check("dạng cũ 'nhãn|url' cũng chỉ nhận tệp KiN khi bật tuỳ chọn", parseLessonDocuments(`KiN|${kinFileLink(KIN)}`).length === 0 && parseLessonDocuments(`KiN|${kinFileLink(KIN)}`, { allowKinFiles: true }).length === 1);

section("XemNhuHocSinh — bản sao redact cho người ngoài lớp khớp PROTECTED_LESSON_FIELDS (component client không được import mediaAccess)");
{
  const src = readFileSync("src/components/tutor/giao-trinh/XemNhuHocSinh.tsx", "utf8");
  const m = src.match(/OUTSIDER_REDACTED_FIELDS = \[([^\]]*)\]/);
  const have = (m?.[1] ?? "").split(",").map(x => x.trim().replace(/"/g, "")).filter(Boolean).sort().join(",");
  check("danh sách trường khoá khớp mediaAccess.PROTECTED_LESSON_FIELDS", have === [...PROTECTED_LESSON_FIELDS].sort().join(","), have);
  check("component client KHÔNG import @/lib/mediaAccess (kéo prisma vào gói trình duyệt)", !/from "@\/lib\/mediaAccess"/.test(src));
}

done();
