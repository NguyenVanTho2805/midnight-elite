// Học liệu — phần thuần src/lib/mediaLink.ts + mediaStorage.ts + lessonGuard.ts: nhận diện link, báo lỗi sớm, ghi chú theo mốc,
// xem trước tài liệu an toàn, link bài làm Azota, giới hạn tệp, che nội dung bài. Nhiều ca PHÁ CỐ Ý (link giả mạo máy chủ, scheme nguy hiểm...).
import { classifyMediaLink, checkLinkForSlot, checkLinkListForSlot, suggestLessonTypes, parseLinkList, serializeLinkList, firstSafeHttpsLink, firstPlayableVideo,
  parseDeadlineVn, formatStamp, parseStamp, extractNoteStamps, appendStampLine, planDocumentPreview, validateWorkLink, hostMatches, uploadIdOf, uploadLink, fileExtOf } from "@/lib/mediaLink";
import { resolveVideoUploadConfig, validateVideoUpload, validateDocumentFile, safeFileName, parseRangeHeader, formatMegabytes, DEFAULT_VIDEO_MAX_MB, DOCUMENT_MAX_BYTES, VIDEO_UPLOAD_NOTICE } from "@/lib/mediaStorage";
import { redactLesson, redactCourseTree, canWatchStoredMedia, LESSON_CONTENT_FIELDS } from "@/lib/lessonGuard";
import { check, section, done } from "./h";

const YT = "dQw4w9WgXcQ";

section("YouTube — mọi dạng link thật");
for (const [name, url] of [
  ["watch", `https://www.youtube.com/watch?v=${YT}`], ["không www", `https://youtube.com/watch?v=${YT}&feature=share`], ["di động", `https://m.youtube.com/watch?v=${YT}`],
  ["youtu.be", `https://youtu.be/${YT}?si=abc`], ["shorts", `https://www.youtube.com/shorts/${YT}`], ["embed", `https://www.youtube.com/embed/${YT}`],
  ["live", `https://www.youtube.com/live/${YT}`], ["nocookie", `https://www.youtube-nocookie.com/embed/${YT}`], ["thiếu https://", `youtube.com/watch?v=${YT}`],
  ["thừa khoảng trắng hai đầu", `  https://youtu.be/${YT}  `],
] as const) {
  const r = classifyMediaLink(url);
  check(`${name} → youtube, mã ${YT}`, r.ok && r.kind === "youtube" && r.id === YT && r.suggestedType === "record", r);
}
const yt = classifyMediaLink(`https://youtu.be/${YT}?t=90`);
check("nhúng DỰNG LẠI từ mã (youtube-nocookie), có mốc bắt đầu, KHÔNG chứa link gốc", yt.embedUrl === `https://www.youtube-nocookie.com/embed/${YT}?rel=0&modestbranding=1&start=90`, yt.embedUrl);
check("mốc kiểu 1m30s", classifyMediaLink(`https://youtu.be/${YT}?t=1m30s`).embedUrl?.endsWith("&start=90") === true);
check("thiếu https:// được chuẩn hoá thành https://", classifyMediaLink(`youtube.com/watch?v=${YT}`).url.startsWith("https://"));
check("YouTube có cảnh báo về Không công khai / Riêng tư", /Không công khai/.test(yt.warning ?? "") && /Riêng tư/.test(yt.warning ?? ""));

section("YouTube — PHÁ CỐ Ý");
for (const [name, url] of [
  ["danh sách phát", "https://www.youtube.com/playlist?list=PL123"], ["kênh", "https://www.youtube.com/@kenh"], ["thiếu mã", "https://www.youtube.com/watch"],
  ["mã sai độ dài", "https://www.youtube.com/watch?v=abc"], ["mã chứa ký tự cấm", "https://www.youtube.com/watch?v=<script>aaaa"], ["trang chủ", "https://youtu.be/"],
] as const) { const r = classifyMediaLink(url); check(`${name} → từ chối`, !r.ok && r.kind === "invalid" && !!r.error, r); }
check("trang chủ youtube.com cũng không phải video", !classifyMediaLink("https://www.youtube.com/").ok);
check("playlist có báo đúng lý do", /danh sách phát/.test(classifyMediaLink("https://www.youtube.com/playlist?list=PL123").error ?? "") || /MỘT video/.test(classifyMediaLink("https://www.youtube.com/watch?list=PL1").error ?? ""));

section("Giả mạo máy chủ & scheme nguy hiểm (PHÁ CỐ Ý)");
for (const [name, url] of [
  ["youtube.com.evil.example", `https://youtube.com.evil.example/watch?v=${YT}`], ["evilyoutube.com", `https://evilyoutube.com/watch?v=${YT}`],
  ["youtube.com nằm trong đường dẫn", `https://evil.example/youtube.com/watch?v=${YT}`], ["youtube.com nằm trong query", `https://evil.example/?u=https://youtu.be/${YT}`],
  ["user:pass@ giả youtube", `https://youtube.com@evil.example/watch?v=${YT}`], ["youtu.be.evil", `https://youtu.be.evil.example/${YT}`],
] as const) { const r = classifyMediaLink(url); check(`${name} → KHÔNG nhận là YouTube`, r.kind !== "youtube" && r.embedUrl === null, r); }
for (const [name, url] of [
  ["javascript:", "javascript:alert(1)"], ["data:", "data:text/html,<script>alert(1)</script>"], ["http thường", `http://youtu.be/${YT}`], ["file:", "file:///etc/passwd"],
  ["blob:", "blob:https://x.vn/uuid"], ["ftp:", "ftp://x.vn/a.mp4"], ["vbscript:", "vbscript:msgbox(1)"], ["có khoảng trắng giữa", "https://x.vn/a b"],
  ["toàn khoảng trắng", "    "], ["rỗng", ""], ["chỉ chữ", "xem video bài 1"], ["tên miền không có chấm", "https://localhost/a"],
] as const) { const r = classifyMediaLink(url); check(`${name} → từ chối`, !r.ok && r.embedUrl === null && !!r.error, r); }
check("null / undefined không ném lỗi", !classifyMediaLink(null).ok && !classifyMediaLink(undefined).ok);
check("link dài hơn 2000 ký tự bị từ chối", !classifyMediaLink("https://x.vn/" + "a".repeat(2100)).ok);
check("hostMatches theo dấu chấm", hostMatches("a.youtube.com", "youtube.com") && hostMatches("youtube.com", "youtube.com") && !hostMatches("evilyoutube.com", "youtube.com") && !hostMatches("youtube.com.evil.example", "youtube.com") && hostMatches("YOUTUBE.com.", "youtube.com"));

section("Vimeo / Drive / Zoom / Azota");
const vm = classifyMediaLink("https://vimeo.com/123456789");
check("Vimeo công khai", vm.ok && vm.kind === "vimeo" && vm.id === "123456789" && vm.embedUrl === "https://player.vimeo.com/video/123456789" && vm.vimeoHash === null, vm);
const vmh = classifyMediaLink("https://vimeo.com/123456789/abcdef1234");
check("Vimeo không công khai (có mã h) giữ mã h trong nhúng", vmh.vimeoHash === "abcdef1234" && vmh.embedUrl === "https://player.vimeo.com/video/123456789?h=abcdef1234", vmh);
check("Vimeo player.vimeo.com/video/ID?h=", classifyMediaLink("https://player.vimeo.com/video/123456789?h=abcdef1234").embedUrl === "https://player.vimeo.com/video/123456789?h=abcdef1234");
check("Vimeo trang chủ / mã không phải số → từ chối", !classifyMediaLink("https://vimeo.com/").ok && !classifyMediaLink("https://vimeo.com/channels/staffpicks").ok && !classifyMediaLink("https://notvimeo.com/123456789").ok === false);
check("Vimeo mã h chứa ký tự cấm bị bỏ, không lọt vào nhúng", !/h=/.test(classifyMediaLink("https://player.vimeo.com/video/123456789?h=\"><script>").embedUrl ?? ""));
const dv = classifyMediaLink("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing");
check("Drive file → nhúng /preview, có cảnh báo quyền chia sẻ", dv.ok && dv.kind === "drive" && dv.embedUrl === "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview" && /chia sẻ/.test(dv.warning ?? ""), dv);
check("Drive open?id= và uc?id=", classifyMediaLink("https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp").kind === "drive" && classifyMediaLink("https://drive.google.com/uc?id=1AbCdEfGhIjKlMnOp&export=download").kind === "drive");
check("Drive thư mục nhận là thư mục, không nhúng", classifyMediaLink("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp").kind === "drive_folder" && classifyMediaLink("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp").embedUrl === null);
check("Drive không có mã tệp → từ chối", !classifyMediaLink("https://drive.google.com/drive/my-drive").ok && !classifyMediaLink("https://drive.google.com/file/d/ab/view").ok);
check("Docs → nhúng /preview, loại bài tài liệu", classifyMediaLink("https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit?usp=sharing").embedUrl === "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/preview" && classifyMediaLink("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOp/edit").suggestedType === "document");
check("docs.google.com giả (docs.google.com.evil.example) không nhận", classifyMediaLink("https://docs.google.com.evil.example/document/d/1AbCdEfGhIjKlMnOp/edit").kind === "other");
check("Zoom phòng học → live", classifyMediaLink("https://us02web.zoom.us/j/84012345678?pwd=abc").kind === "zoom_live" && classifyMediaLink("https://zoom.us/j/84012345678").suggestedType === "live");
check("Zoom bản ghi → zoom_record, KHÔNG nhúng, có cảnh báo", classifyMediaLink("https://us02web.zoom.us/rec/share/abcDEF123").kind === "zoom_record" && classifyMediaLink("https://us02web.zoom.us/rec/share/abcDEF123").embedUrl === null);
check("Zoom trang chủ / lạ → từ chối", !classifyMediaLink("https://zoom.us/pricing").ok);
check("zoom.us.evil.example không phải Zoom", classifyMediaLink("https://zoom.us.evil.example/j/84012345678").kind === "other");
check("Azota (kể cả tên miền con) → quiz", classifyMediaLink("https://azota.vn/de-thi/abc").kind === "azota" && classifyMediaLink("https://app.azota.vn/x").suggestedType === "quiz" && classifyMediaLink("https://azota.vn.evil.example/x").kind === "other");
check("link lạ https → other, lưu được nhưng có cảnh báo, không nhúng", classifyMediaLink("https://example.org/bai-giang").kind === "other" && classifyMediaLink("https://example.org/bai-giang").embedUrl === null && !!classifyMediaLink("https://example.org/bai-giang").warning);

section("Video tải lên KiN (kin-media:)");
check("nhận kin-media:<mã> là upload", classifyMediaLink("kin-media:ck1abcdEFGH_12").kind === "upload" && uploadIdOf("kin-media:ck1abcdEFGH_12") === "ck1abcdEFGH_12" && uploadLink("ck1abcdEFGH_12") === "kin-media:ck1abcdEFGH_12");
check("mã giả (../, ngắn, ký tự lạ) bị từ chối", ["kin-media:../etc/passwd", "kin-media:ab", "kin-media:a b c d e f g h", "kin-media:", "kin-media:abcd/efgh1234"].every(u => !classifyMediaLink(u).ok));
check("upload không bao giờ lọt vào link mở tab ngoài", firstSafeHttpsLink("kin-media:ck1abcdEFGH_12") === null);

section("Theo Ô đang dán — báo lỗi sớm");
check("ô trống luôn hợp lệ", checkLinkForSlot("", "video").ok && checkLinkForSlot("   ", "azota").ok && checkLinkForSlot(null, "live").ok);
check("video: YouTube / Vimeo / Drive / upload hợp lệ", ["https://youtu.be/" + YT, "https://vimeo.com/123456789", "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view", "kin-media:ck1abcdEFGH_12"].every(u => checkLinkForSlot(u, "video").ok));
const nhamAz = checkLinkForSlot("https://azota.vn/de/abc", "video");
check("video: dán link Azota → báo dán vào ô Azota", !nhamAz.ok && nhamAz.moveTo === "azota" && /Azota/.test(nhamAz.error ?? ""), nhamAz);
check("video: dán Zoom phòng học → gợi ý ô Zoom", checkLinkForSlot("https://zoom.us/j/84012345678", "video").moveTo === "live");
check("video: thư mục Drive → từ chối", !checkLinkForSlot("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp", "video").ok);
check("video: Facebook / TikTok → từ chối, chỉ cách làm", ["https://www.facebook.com/watch/?v=1", "https://fb.watch/abc", "https://www.tiktok.com/@a/video/1"].every(u => { const r = checkLinkForSlot(u, "video"); return !r.ok && /YouTube/.test(r.error ?? ""); }));
check("video: trang lạ → từ chối", !checkLinkForSlot("https://example.org/a", "video").ok);
check("video: bản ghi Zoom hợp lệ, kèm cảnh báo", checkLinkForSlot("https://us02web.zoom.us/rec/share/abcDEF123", "video").ok && !!checkLinkForSlot("https://us02web.zoom.us/rec/share/abcDEF123", "video").warning);
check("live: nhận Zoom; bản ghi Zoom và YouTube bị trả về ô video", checkLinkForSlot("https://zoom.us/j/84012345678", "live").ok && checkLinkForSlot("https://zoom.us/rec/share/abcDEF123", "live").moveTo === "video" && checkLinkForSlot("https://youtu.be/" + YT, "live").moveTo === "video");
check("azota: nhận Azota; YouTube bị trả về ô video; link lạ chỉ cảnh báo", checkLinkForSlot("https://azota.vn/x", "azota").ok && checkLinkForSlot("https://youtu.be/" + YT, "azota").moveTo === "video" && checkLinkForSlot("https://example.org/x", "azota").ok && !!checkLinkForSlot("https://example.org/x", "azota").warning);
check("tài liệu: YouTube bị trả về ô video", checkLinkForSlot("https://youtu.be/" + YT, "document").moveTo === "video" && checkLinkForSlot("https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit", "document").ok);
check("danh sách: báo link thứ mấy hỏng", checkLinkListForSlot(["https://youtu.be/" + YT, "https://www.facebook.com/x"], "video").error?.startsWith("Link thứ 2:") === true);
check("danh sách một link hỏng không có tiền tố 'Link thứ'", !/^Link thứ/.test(checkLinkListForSlot(["https://www.facebook.com/x"], "video").error ?? ""));
check("danh sách trống/chỉ khoảng trắng hợp lệ; quá 20 link bị từ chối", checkLinkListForSlot(["", "  "], "video").ok && !checkLinkListForSlot(Array.from({ length: 25 }, (_, i) => `https://youtu.be/${YT}?i=${i}`), "video").ok);

section("Gợi ý loại bài");
check("video → record; Zoom → live; Azota → quiz; trống → document", JSON.stringify(suggestLessonTypes({ video: ["x"] })) === '["record"]' && JSON.stringify(suggestLessonTypes({ live: ["x"] })) === '["live"]' && JSON.stringify(suggestLessonTypes({ azota: ["x"] })) === '["quiz"]' && JSON.stringify(suggestLessonTypes({})) === '["document"]' && JSON.stringify(suggestLessonTypes({ video: [""], azota: [" "] })) === '["document"]');
check("nhiều ô → nhiều loại theo thứ tự", JSON.stringify(suggestLessonTypes({ video: ["a"], live: ["b"], azota: ["c"] })) === '["record","live","quiz"]');

section("Danh sách link trong MỘT cột chuỗi (lỗi 'Azota có 2 link làm hỏng href')");
check("chuỗi đơn", JSON.stringify(parseLinkList("https://azota.vn/a")) === '["https://azota.vn/a"]');
check("JSON mảng 2 link", JSON.stringify(parseLinkList('["https://azota.vn/a","https://azota.vn/b"]')) === '["https://azota.vn/a","https://azota.vn/b"]');
check("rỗng/null/khoảng trắng/[] → []", parseLinkList(null).length === 0 && parseLinkList("").length === 0 && parseLinkList("  ").length === 0 && parseLinkList("[]").length === 0);
check("JSON hỏng bắt đầu bằng [ → coi như chuỗi, không ném lỗi", parseLinkList("[hỏng").length === 1);
check("phần tử không phải chuỗi bị bỏ; có khoảng trắng được cắt", JSON.stringify(parseLinkList('[1,null," https://a.vn/x ",{"a":1}]')) === '["https://a.vn/x"]');
check("serialize: 0 → null, 1 → chuỗi, 2 → JSON; đi vòng đọc lại giống hệt", serializeLinkList(["", " "]) === null && serializeLinkList(["https://a.vn/1"]) === "https://a.vn/1" && JSON.stringify(parseLinkList(serializeLinkList(["https://a.vn/1", "https://a.vn/2"]))) === '["https://a.vn/1","https://a.vn/2"]');
check("firstSafeHttpsLink: lấy link đầu dùng được từ cột JSON 2 link (trước đây nhét cả chuỗi JSON vào href)", firstSafeHttpsLink('["https://azota.vn/a","https://azota.vn/b"]') === "https://azota.vn/a");
check("firstSafeHttpsLink: bỏ link độc, lấy link sau", firstSafeHttpsLink('["javascript:alert(1)","https://azota.vn/ok"]') === "https://azota.vn/ok" && firstSafeHttpsLink('["javascript:alert(1)"]') === null);
check("firstPlayableVideo: bỏ link hỏng, lấy YouTube", firstPlayableVideo(`["https://x","https://youtu.be/${YT}"]`)?.id === YT && firstPlayableVideo("nhảm") === null);

section("Hạn Azota — nhận đủ các kiểu lưu (lỗi toISO trả null)");
const d1 = parseDeadlineVn("2026-10-23T18:30");
check("datetime-local 18:30 giờ VN = 11:30 UTC", d1?.toISOString() === "2026-10-23T11:30:00.000Z", d1?.toISOString());
check("chỉ ngày → cuối ngày 23:59 giờ VN", parseDeadlineVn("2026-10-23")?.toISOString() === "2026-10-23T16:59:00.000Z");
check("23/10/2026 và 23/10/2026 18:30", parseDeadlineVn("23/10/2026")?.toISOString() === "2026-10-23T16:59:00.000Z" && parseDeadlineVn("23/10/2026 18:30")?.toISOString() === "2026-10-23T11:30:00.000Z");
check("ngày không có (31/02, tháng 13, giờ 25) và chữ → null", ["2026-02-31", "31/02/2026", "2026-13-01", "2026-10-23T25:00", "mai nộp", "", null].every(v => parseDeadlineVn(v as string) === null));
check("00:30 sáng giờ VN rơi vào ngày hôm trước theo UTC", parseDeadlineVn("2026-10-23T00:30")?.toISOString() === "2026-10-22T17:30:00.000Z");

section("Ghi chú theo mốc thời gian");
check("formatStamp", formatStamp(0) === "0:00" && formatStamp(75) === "1:15" && formatStamp(3600) === "1:00:00" && formatStamp(3725) === "1:02:05" && formatStamp(-5) === "0:00" && formatStamp(NaN) === "0:00" && formatStamp(59.9) === "0:59");
check("parseStamp", parseStamp("1:15") === 75 && parseStamp("1:02:05") === 3725 && parseStamp("0:00") === 0 && parseStamp("12:99") === null && parseStamp("1:75:00") === null && parseStamp("abc") === null && parseStamp("") === null && parseStamp("1:2") === null);
const note = "Mở đầu\n[0:45] Công thức Vi-ét\n[12:03] Ví dụ x²−5x+6=0\nkhông phải mốc [1:00]\n[1:02:05] Tổng kết";
const st = extractNoteStamps(note);
check("lấy đúng 3 mốc, đúng giây và nội dung, đúng dòng", st.length === 3 && st[0].seconds === 45 && st[0].text === "Công thức Vi-ét" && st[1].seconds === 723 && st[2].seconds === 3725 && st[1].line === 2, st);
check("mốc sai giờ phút ([99:99]) bị bỏ", extractNoteStamps("[1:99] a\n[xx:yy] b").length === 0 && extractNoteStamps(null).length === 0);
check("appendStampLine: ghi chú trống → không xuống dòng thừa; có chữ → xuống dòng", appendStampLine("", 75) === "[1:15] " && appendStampLine("Hay\n", 75) === "Hay\n[1:15] " && appendStampLine("Hay", 3725) === "Hay\n[1:02:05] ");
check("đi vòng: thêm mốc rồi đọc lại ra đúng giây", extractNoteStamps(appendStampLine("x", 723) + "ghi chú")[0]?.seconds === 723);

section("Xem trước tài liệu — chỉ nhúng nguồn tin cậy (MD-09)");
const cl = (p: string) => `https://res.cloudinary.com/demo/raw/upload/v1/${p}`;
const pdf = planDocumentPreview(cl("a.pdf"));
check("PDF Cloudinary → iframe, không sandbox (Chrome chặn PDF trong sandbox), cho tải", pdf.mode === "iframe" && pdf.src === cl("a.pdf") && pdf.sandbox === false && pdf.downloadHref === cl("a.pdf"), pdf);
check("ảnh Cloudinary → mode ảnh", planDocumentPreview("https://res.cloudinary.com/demo/image/upload/a.PNG").mode === "image");
check("txt Cloudinary → iframe có sandbox", planDocumentPreview(cl("ghi-chu.txt")).mode === "iframe" && planDocumentPreview(cl("ghi-chu.txt")).sandbox === true);
const off = planDocumentPreview(cl("de.docx"));
check("Word/Excel/PowerPoint Cloudinary → Office viewer với src đã mã hoá", off.mode === "iframe" && off.src === `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(cl("de.docx"))}`, off);
check("Google Docs → /preview, không có nút tải", planDocumentPreview("https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit").src === "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/preview" && planDocumentPreview("https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit").downloadHref === null);
check("Drive file → /preview", planDocumentPreview("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view").src === "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview");
check("Drive không có mã tệp → chỉ mở tab mới", planDocumentPreview("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp").mode === "external");
check("loại lạ trên Cloudinary (.zip) → chỉ mở/tải, không nhúng", planDocumentPreview(cl("a.zip")).mode === "external");
for (const [name, url] of [
  ["PDF máy lạ (XSS/nhúng nguồn lạ)", "https://evil.example/a.pdf"], ["Office máy lạ", "https://evil.example/a.docx"], ["ảnh máy lạ", "https://evil.example/a.png"],
  ["res.cloudinary.com.evil.example", "https://res.cloudinary.com.evil.example/a.pdf"], ["evil.example/res.cloudinary.com/a.pdf", "https://evil.example/res.cloudinary.com/a.pdf"],
] as const) { const p = planDocumentPreview(url); check(`${name} → KHÔNG nhúng`, p.mode === "external" && p.downloadHref === null, p); }
check("cloudinary giả bằng user@ (res.cloudinary.com@evil.example) → bị từ chối hẳn, không src", (() => { const p = planDocumentPreview("https://res.cloudinary.com@evil.example/a.pdf"); return p.mode === "none" && p.src === null && p.downloadHref === null; })());
for (const [name, url] of [
  ["javascript:", "javascript:alert(1)"], ["data:", "data:application/pdf;base64,AAAA"], ["http thường", "http://res.cloudinary.com/a.pdf"], ["file:", "file:///etc/passwd"],
  ["//host", "//evil.example/a.pdf"], ["/\\host", "/\\evil.example/a.pdf"], ["đường dẫn nội bộ lạ", "/admin/khoa-hoc"], ["/api/media thiếu hậu tố", "/api/media/abcdefgh1234"],
  ["/api/media có ../", "/api/media/../../etc/passwd/stream"], ["rỗng", ""], ["null", null as unknown as string],
] as const) { const p = planDocumentPreview(url); check(`${name} → không xem trước, không tải, không src`, p.mode === "none" && p.src === null && p.downloadHref === null && !!p.reason, p); }
check("/api/media/<mã>/stream hợp lệ → mở nội bộ", planDocumentPreview("/api/media/ck1abcdEFGH_12/stream").mode === "external" && planDocumentPreview("/api/media/ck1abcdEFGH_12/stream").src === "/api/media/ck1abcdEFGH_12/stream");
check("fileExtOf", fileExtOf("https://x.vn/a/b.PDF?x=1#y") === "pdf" && fileExtOf("https://x.vn/a/b") === null && fileExtOf("https://x.vn/a.verylongext") === null);

section("Link bài làm Azota — CHỈ link, không ảnh (trẻ dưới 16)");
check("azota.vn hợp lệ", validateWorkLink("https://azota.vn/ket-qua/abc123").ok && validateWorkLink("azota.vn/ket-qua/abc123").url === "https://azota.vn/ket-qua/abc123" && validateWorkLink("https://app.azota.vn/x").ok);
for (const [name, v] of [
  ["rỗng", ""], ["toàn khoảng trắng", "   "], ["ảnh jpg", "https://azota.vn/a.jpg"], ["ảnh png", "https://azota.vn/a.PNG"], ["ảnh heic", "https://azota.vn/a.heic"],
  ["Cloudinary ảnh bài làm", "https://res.cloudinary.com/demo/image/upload/bailam.jpg"], ["Google Drive ảnh", "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view"],
  ["giả azota.vn.evil.example", "https://azota.vn.evil.example/x"], ["azota.vn@evil.example", "https://azota.vn@evil.example/x"], ["evil.example/azota.vn", "https://evil.example/azota.vn"],
  ["javascript:", "javascript:alert(1)"], ["data: ảnh", "data:image/png;base64,AAAA"], ["http", "http://azota.vn/x"], ["quá dài", "https://azota.vn/" + "a".repeat(600)],
] as const) { const r = validateWorkLink(v); check(`${name} → từ chối`, !r.ok && r.url === null && !!r.error, r); }
check("lời từ chối ảnh nói rõ KiN không nhận ảnh", /không nhận ảnh/.test(validateWorkLink("https://azota.vn/a.jpg").error ?? "") && /không nhận ảnh/.test(validateWorkLink("https://res.cloudinary.com/x/a.jpg").error ?? ""));

section("Cấu hình tải video (cờ KIN_VIDEO_UPLOAD, mặc định theo môi trường)");
const MB = 1024 * 1024;
const dev = resolveVideoUploadConfig({});
check("máy cục bộ (không có NODE_ENV) → BẬT, đĩa cục bộ, 200 MB", dev.enabled && dev.driver === "local" && dev.maxBytes === 200 * MB && dev.reason === null && DEFAULT_VIDEO_MAX_MB === 200, dev);
check("NODE_ENV=development vẫn bật", resolveVideoUploadConfig({ NODE_ENV: "development" }).enabled);
const prod = resolveVideoUploadConfig({ NODE_ENV: "production" });
check("production không đặt cờ → TẮT, có lý do tiếng Việt", !prod.enabled && prod.driver === "none" && /dán link/.test(prod.reason ?? ""), prod);
check("production bật cờ nhưng thiếu Cloudinary → vẫn TẮT, nêu rõ thiếu biến nào", (() => { const r = resolveVideoUploadConfig({ NODE_ENV: "production", KIN_VIDEO_UPLOAD: "1" }); return !r.enabled && /CLOUDINARY_API_SECRET/.test(r.reason ?? ""); })());
const prodOn = resolveVideoUploadConfig({ NODE_ENV: "production", KIN_VIDEO_UPLOAD: "1", CLOUDINARY_CLOUD_NAME: "c", CLOUDINARY_API_KEY: "k", CLOUDINARY_API_SECRET: "s" });
check("production + cờ + đủ Cloudinary → BẬT bằng Cloudinary", prodOn.enabled && prodOn.driver === "cloudinary", prodOn);
check("production thiếu API_SECRET (chỉ 2/3 biến) → không coi là có Cloudinary", !resolveVideoUploadConfig({ NODE_ENV: "production", KIN_VIDEO_UPLOAD: "1", CLOUDINARY_CLOUD_NAME: "c", CLOUDINARY_API_KEY: "k" }).enabled);
check("máy cục bộ có đủ Cloudinary → dùng Cloudinary", resolveVideoUploadConfig({ CLOUDINARY_CLOUD_NAME: "c", CLOUDINARY_API_KEY: "k", CLOUDINARY_API_SECRET: "s" }).driver === "cloudinary");
check("KIN_VIDEO_UPLOAD=0 tắt cả ở máy cục bộ", !resolveVideoUploadConfig({ KIN_VIDEO_UPLOAD: "0" }).enabled && !resolveVideoUploadConfig({ KIN_VIDEO_UPLOAD: "false" }).enabled);
check("cờ giá trị lạ → dùng mặc định theo môi trường", resolveVideoUploadConfig({ KIN_VIDEO_UPLOAD: "có" }).enabled && !resolveVideoUploadConfig({ NODE_ENV: "production", KIN_VIDEO_UPLOAD: "có" }).enabled);
check("KIN_VIDEO_MAX_MB: đổi được; rác → 200; âm/0 → 200; quá lớn bị chặn ở trần 2000", resolveVideoUploadConfig({ KIN_VIDEO_MAX_MB: "50" }).maxBytes === 50 * MB && resolveVideoUploadConfig({ KIN_VIDEO_MAX_MB: "abc" }).maxBytes === 200 * MB && resolveVideoUploadConfig({ KIN_VIDEO_MAX_MB: "-5" }).maxBytes === 200 * MB && resolveVideoUploadConfig({ KIN_VIDEO_MAX_MB: "0" }).maxBytes === 200 * MB && resolveVideoUploadConfig({ KIN_VIDEO_MAX_MB: "99999" }).maxBytes === 2000 * MB && resolveVideoUploadConfig({ KIN_VIDEO_MAX_MB: "2000" }).maxBytes < 2 ** 31);

section("Kiểm tệp video trước khi tải (PHÁ CỐ Ý)");
const cfg = resolveVideoUploadConfig({});
check("mp4 100 MB hợp lệ; đúng 200 MB hợp lệ; 200 MB + 1 byte bị chặn", validateVideoUpload({ name: "bai1.mp4", size: 100 * MB, type: "video/mp4" }, cfg).ok && validateVideoUpload({ name: "b.mp4", size: 200 * MB, type: "video/mp4" }, cfg).ok && !validateVideoUpload({ name: "b.mp4", size: 200 * MB + 1, type: "video/mp4" }, cfg).ok);
check("lời chặn dung lượng nêu số MB và cách khác (YouTube)", (() => { const r = validateVideoUpload({ name: "b.mp4", size: 500 * MB }, cfg); return !r.ok && /500 MB/.test(r.error) && /200 MB/.test(r.error) && /YouTube/.test(r.error); })());
check(".mov .webm .m4v hợp lệ (kể cả MIME trống)", [["a.mov", ""], ["a.webm", "video/webm"], ["a.m4v", ""], ["A.MP4", "video/mp4"]].every(([n, t]) => validateVideoUpload({ name: n, size: MB, type: t }, cfg).ok));
check("đuôi lạ bị chặn: exe, html, svg, php, mkv, avi, không đuôi", ["a.exe", "a.html", "a.svg", "a.php", "a.mkv", "a.avi", "video", "a.mp4.exe", "a.mp4.html"].every(n => !validateVideoUpload({ name: n, size: MB }, cfg).ok));
check("đuôi .mp4 nhưng MIME không phải video (html) bị chặn", !validateVideoUpload({ name: "a.mp4", size: MB, type: "text/html" }, cfg).ok);
check("tệp rỗng / kích thước âm / NaN / thiếu tên bị chặn", [0, -1, NaN].every(s => !validateVideoUpload({ name: "a.mp4", size: s }, cfg).ok) && !validateVideoUpload({ name: "", size: MB }, cfg).ok && !validateVideoUpload({ name: "  ", size: MB }, cfg).ok);
check("cờ tắt → mọi video bị chặn, lý do là lý do của cờ", (() => { const r = validateVideoUpload({ name: "a.mp4", size: MB }, prod); return !r.ok && r.error === prod.reason; })());
check("đường dẫn trong tên tệp không đánh lừa đuôi: C:\\x\\a.mp4 hợp lệ, a.mp4/../b.exe không", validateVideoUpload({ name: "C:\\x\\a.mp4", size: MB }, cfg).ok && !validateVideoUpload({ name: "a.mp4/../b.exe", size: MB }, cfg).ok);

section("Kiểm tệp tài liệu (MD-08): giới hạn và loại báo trước");
check("pdf/docx/xlsx/pptx/txt/png/jpg/webp 1 MB hợp lệ", ["a.pdf", "a.docx", "a.xlsx", "a.pptx", "a.txt", "a.png", "a.JPG", "a.webp"].every(n => validateDocumentFile({ name: n, size: MB }).ok));
check("đúng 25 MB hợp lệ, hơn 1 byte bị chặn, lời chặn nêu tên tệp + số MB", validateDocumentFile({ name: "a.pdf", size: DOCUMENT_MAX_BYTES }).ok && (() => { const r = validateDocumentFile({ name: "Đề.pdf", size: DOCUMENT_MAX_BYTES + 1 }); return !r.ok && /Đề\.pdf/.test(r.error) && /25 MB/.test(r.error); })());
check("chặn exe, html, svg, js, zip, mp4, không đuôi, rỗng", ["a.exe", "a.html", "a.svg", "a.js", "a.zip", "a.mp4", "a", "a.pdf.exe"].every(n => !validateDocumentFile({ name: n, size: MB }).ok) && !validateDocumentFile({ name: "a.pdf", size: 0 }).ok);

section("Tên tệp an toàn / Range / định dạng MB");
check("safeFileName bỏ thư mục, ký tự lạ, dấu chấm đầu; giữ tiếng Việt", safeFileName("../../etc/passwd") === "passwd" && safeFileName("Định lý Vi-ét (bản 2).pdf") === "Định lý Vi-ét _bản 2_.pdf" && safeFileName(".htaccess") === "htaccess" && safeFileName("") === "tep" && safeFileName("///") === "tep" && safeFileName("a".repeat(300) + ".mp4").length === 120);
check("safeFileName chặn NUL và xuống dòng", !/[\0\n\r]/.test(safeFileName("a\0b\nc.mp4")));
check("Range bytes=0-99 / 100- / -50", JSON.stringify(parseRangeHeader("bytes=0-99", 1000)) === '{"start":0,"end":99}' && JSON.stringify(parseRangeHeader("bytes=900-", 1000)) === '{"start":900,"end":999}' && JSON.stringify(parseRangeHeader("bytes=-50", 1000)) === '{"start":950,"end":999}');
check("Range kẹp end vượt cuối tệp; không có header → null", JSON.stringify(parseRangeHeader("bytes=0-99999", 1000)) === '{"start":0,"end":999}' && parseRangeHeader(null, 1000) === null);
check("Range sai: ngược, vượt tệp, rác, nhiều đoạn, '-' trần, '-0' → invalid", ["bytes=50-10", "bytes=2000-", "bytes=abc", "bytes=0-1,5-9", "bytes=-", "bytes=-0", "items=0-1", "bytes=a-b"].every(h => parseRangeHeader(h, 1000) === "invalid"));
check("formatMegabytes", formatMegabytes(200 * MB) === "200 MB" && formatMegabytes(1.5 * MB) === "1,5 MB" && formatMegabytes(25 * MB) === "25 MB");
check("lời cảnh báo bản quyền/riêng tư có đủ 3 ý và câu xác nhận", VIDEO_UPLOAD_NOTICE.lines.length === 3 && /bản quyền/.test(VIDEO_UPLOAD_NOTICE.lines[0]) && /dưới 16/.test(VIDEO_UPLOAD_NOTICE.lines[1]) && /đã vào lớp/.test(VIDEO_UPLOAD_NOTICE.lines[2]) && /không có hình hay giọng học sinh/.test(VIDEO_UPLOAD_NOTICE.confirmLabel));

section("Che nội dung bài khỏi người chưa có quyền (MD-03)");
const L = (id: string, free: boolean) => ({ id, title: `Bài ${id}`, isFree: free, isLocked: !free, videoUrl: "https://youtu.be/" + YT, zoomUrl: "https://zoom.us/j/84012345678", azotaUrl: "https://azota.vn/x", azotaDeadline: "2026-10-23T18:30",
  documents: '[{"name":"a","url":"https://x.vn/a.pdf"}]', adminNote: "chỉ gia sư", order: 1 });
const course = { id: "c", name: "Lớp", sections: [{ id: "s", chapters: [{ id: "ch", lessons: [L("paid", false), L("free", true)] }] }] };
const red = redactCourseTree(course, false);
const paid = red.sections[0].chapters[0].lessons[0] as Record<string, unknown>;
const free = red.sections[0].chapters[0].lessons[1] as Record<string, unknown>;
check("bài trả phí: MỌI trường nội dung bị che", LESSON_CONTENT_FIELDS.every(k => k === "documents" ? paid[k] === "[]" : paid[k] === null), paid);
check("bài trả phí vẫn giữ tên, id, thứ tự (để khách thấy mục lục)", paid.title === "Bài paid" && paid.id === "paid" && paid.order === 1 && paid.isLocked === true);
check("bài MIỄN PHÍ giữ nguyên nội dung (học thử)", free.videoUrl === "https://youtu.be/" + YT && free.azotaUrl === "https://azota.vn/x" && (free.documents as string).includes("a.pdf"));
check("canSeeAll=true trả nguyên bản, không đụng gì", redactCourseTree(course, true) === course);
check("không sửa bản gốc (bất biến)", (course.sections[0].chapters[0].lessons[0] as Record<string, unknown>).videoUrl === "https://youtu.be/" + YT);
check("redactLesson không thêm trường lạ nếu bài không có trường đó", !("videoUrl" in redactLesson({ id: "x", isFree: false })));
const JSON_OUT = JSON.stringify(red);
check("chuỗi JSON trả cho khách của bài trả phí KHÔNG còn chứa link YouTube/Zoom/Azota/tên tài liệu", (JSON.stringify([paid])).indexOf("youtu.be") < 0 && JSON.stringify([paid]).indexOf("zoom.us") < 0 && JSON.stringify([paid]).indexOf("azota.vn") < 0 && JSON.stringify([paid]).indexOf("a.pdf") < 0 && JSON.stringify([paid]).indexOf("chỉ gia sư") < 0 && JSON_OUT.length > 0);

section("Ai được xem video lưu trên KiN");
const base = { userId: "u1", role: "student", adminRole: null, courseOwnerId: "gs1", enrollmentStatus: null as string | null, lessonIsFree: false };
check("học viên ghi danh active → xem được", canWatchStoredMedia({ ...base, enrollmentStatus: "active" }));
check("học viên suspended → xem lại được (như /context)", canWatchStoredMedia({ ...base, enrollmentStatus: "suspended" }));
check("chưa ghi danh, bài trả phí → KHÔNG", !canWatchStoredMedia({ ...base }));
check("pending_consent, bài trả phí → KHÔNG", !canWatchStoredMedia({ ...base, enrollmentStatus: "pending_consent" }));
check("chưa ghi danh, bài miễn phí → được", canWatchStoredMedia({ ...base, lessonIsFree: true }));
check("trạng thái lạ (removed/declined/rác) → KHÔNG", ["removed", "declined", "", "ACTIVE", "active "].every(s => !canWatchStoredMedia({ ...base, enrollmentStatus: s })));
check("gia sư chủ lớp → được; gia sư KHÁC → KHÔNG", canWatchStoredMedia({ ...base, role: "admin", adminRole: "teacher", userId: "gs1" }) && !canWatchStoredMedia({ ...base, role: "admin", adminRole: "teacher", userId: "gs2" }));
check("lớp không có chủ (ownerId null) → gia sư KHÔNG được", !canWatchStoredMedia({ ...base, role: "admin", adminRole: "teacher", userId: "gs1", courseOwnerId: null }));
check("quản trị cấp 1 / nội dung → được", canWatchStoredMedia({ ...base, role: "admin", adminRole: "admin_super" }) && canWatchStoredMedia({ ...base, role: "admin", adminRole: "admin_content" }));
check("role admin mà thiếu adminRole → KHÔNG", !canWatchStoredMedia({ ...base, role: "admin", adminRole: null }));

done();
