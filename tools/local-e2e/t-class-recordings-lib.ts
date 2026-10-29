// MD-02 / MD-17 / BC-03 / MD-11 — phần thuần src/lib/classRecordings.ts: bộ kiểm link bản ghi (4 nguồn, PHÁ CỐ Ý: giả mạo máy chủ, scheme nguy hiểm, video tải lên,
// Azota, danh sách nhiều link), gom bản ghi theo buổi, bảng ai đã xem, đếm tiến độ học liệu cho báo cáo tháng, và chữ trong báo cáo / cam kết bản quyền.
import { checkRecordingLink, cleanRecordingTitle, groupRecordingsBySession, groupRecordingsByMonth, UNATTACHED_KEY, buildWatchTable, summariseMediaProgress, mediaProgressLine,
  COPYRIGHT_PLEDGE_LABEL, COPYRIGHT_NOTICE, RECORDING_TITLE_MAX } from "@/lib/classRecordings";
import { renderReportText, type SubjectMonthMetrics } from "@/lib/monthlyReport";
import { check, section, done } from "./h";

const YT = "dQw4w9WgXcQ";
section("Link bản ghi — 4 nguồn được nhận");
for (const [name, url, kind] of [
  ["YouTube", `https://youtu.be/${YT}`, "youtube"], ["Vimeo", "https://vimeo.com/76979871", "vimeo"],
  ["Drive", "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view", "drive"], ["Zoom cloud", "https://us02web.zoom.us/rec/share/abc123", "zoom_record"],
] as const) { const r = checkRecordingLink(url); check(`${name} → nhận, loại ${kind}`, r.ok && r.kind === kind && r.url.startsWith("https://"), r); }
check("thiếu https:// được chuẩn hoá", checkRecordingLink(`youtu.be/${YT}`).url.startsWith("https://"));
check("YouTube có cảnh báo Không công khai / Riêng tư", /Không công khai/.test(checkRecordingLink(`https://youtu.be/${YT}`).warning ?? ""));

section("Link bản ghi — PHÁ CỐ Ý (phải bị từ chối, có lý do bằng tiếng Việt)");
for (const [name, url] of [
  ["rỗng", ""], ["khoảng trắng", "   "], ["http thường", `http://youtu.be/${YT}`], ["javascript:", "javascript:alert(1)"], ["data:", "data:text/html,<b>x</b>"], ["file:", "file:///etc/passwd"],
  ["giả youtube", `https://youtube.com.evil.example/watch?v=${YT}`], ["user:pass@", `https://youtube.com@evil.example/watch?v=${YT}`],
  ["link lạ", "https://evil.example/video.mp4"], ["Facebook", "https://www.facebook.com/watch/?v=1"], ["Azota", "https://azota.vn/de-thi/abc"],
  ["phòng Zoom (không phải bản ghi)", "https://zoom.us/j/12345678"], ["thư mục Drive", "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp"],
  ["Google Docs", "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit"], ["video tải lên KiN", "kin-media:abcdefgh12345"],
  ["danh sách phát", "https://www.youtube.com/playlist?list=PL123"],
] as const) { const r = checkRecordingLink(url); check(`${name} → từ chối`, !r.ok && !!r.error && r.kind === null && r.url === "", r); }
check("hai link một lần → từ chối", !checkRecordingLink(`https://youtu.be/${YT}\nhttps://vimeo.com/76979871`).ok);
check("mảng JSON hai link → từ chối", !checkRecordingLink(JSON.stringify([`https://youtu.be/${YT}`, "https://vimeo.com/76979871"])).ok);
check("lý do từ chối video tải lên nói rõ 'chưa nhận'", /chưa nhận/.test(checkRecordingLink("kin-media:abcdefgh12345").error ?? ""));

section("Tên bản ghi");
check("cắt khoảng trắng, gộp dấu cách, bỏ ký tự điều khiển", (() => { const r = cleanRecordingTitle("  Buổi\t16/10 \n Vi-ét "); return r.ok && r.title === "Buổi 16/10 Vi-ét"; })());
check("rỗng / chỉ khoảng trắng / không phải chuỗi → lỗi", !cleanRecordingTitle("").ok && !cleanRecordingTitle("   ").ok && !cleanRecordingTitle(null).ok && !cleanRecordingTitle(5).ok);
check(`đúng ${RECORDING_TITLE_MAX} ký tự → được; ${RECORDING_TITLE_MAX + 1} → lỗi`, cleanRecordingTitle("a".repeat(RECORDING_TITLE_MAX)).ok && !cleanRecordingTitle("a".repeat(RECORDING_TITLE_MAX + 1)).ok);

section("Gom bản ghi theo buổi");
const d = (s: string) => new Date(s);
const sessions = [{ id: "s1", dateKey: "2026-10-09" }, { id: "s3", dateKey: "2026-10-23" }, { id: "s2", dateKey: "2026-10-16" }];
const recs = [
  { id: "r1", title: "A", url: "u", kind: "youtube", sessionId: "s2", createdAt: d("2026-10-17T01:00:00Z") },
  { id: "r2", title: "B", url: "u", kind: "youtube", sessionId: "s2", createdAt: d("2026-10-18T01:00:00Z") },
  { id: "r3", title: "C", url: "u", kind: "drive", sessionId: null, createdAt: d("2026-10-19T01:00:00Z") },
  { id: "r4", title: "D", url: "u", kind: "vimeo", sessionId: "da-xoa", createdAt: d("2026-10-20T01:00:00Z") },
];
const g = groupRecordingsBySession(recs, sessions);
check("buổi mới nhất trước", g.bySession.map(x => x.session.id).join() === "s3,s2,s1");
check("bản ghi nằm đúng buổi, mới nhất trước", g.bySession[1].recordings.map(r => r.id).join() === "r2,r1" && g.bySession[0].recordings.length === 0);
check("bản ghi chưa gắn HOẶC gắn vào buổi đã xoá → vào 'chưa gắn', không biến mất", g.unattached.map(r => r.id).join() === "r4,r3");
check("tổng không mất, không trùng bản ghi nào", g.bySession.flatMap(x => x.recordings).length + g.unattached.length === recs.length);

section("NC2-042 — gom bản ghi theo THÁNG (thu gọn được)");
const gm = groupRecordingsByMonth(g);
check("buổi 16/10 có bản ghi → nhóm 'Tháng 10/2026', hai bản ghi mới nhất trước, kèm khoá ngày buổi", gm[0].key === "2026-10" && gm[0].label === "Tháng 10/2026" && gm[0].items.map(x => x.rec.id).join() === "r2,r1" && gm[0].items.every(x => x.sessionDateKey === "2026-10-16"));
check("buổi KHÔNG có bản ghi (09/10, 23/10) không tạo nhóm rỗng", gm.every(x => x.items.length > 0));
check("bản ghi chưa gắn / buổi đã xoá → nhóm cuối 'Chưa gắn buổi', sessionDateKey null", gm[gm.length - 1].key === UNATTACHED_KEY && gm[gm.length - 1].label === "Chưa gắn buổi" && gm[gm.length - 1].items.map(x => x.rec.id).join() === "r4,r3" && gm[gm.length - 1].items.every(x => x.sessionDateKey === null));
check("tổng không mất, không trùng bản ghi nào", gm.flatMap(x => x.items).length === recs.length && new Set(gm.flatMap(x => x.items.map(i => i.rec.id))).size === recs.length);
const multi = groupRecordingsBySession(
  [{ id: "a", title: "A", url: "u", kind: "youtube", sessionId: "n1", createdAt: d("2026-11-03T01:00:00Z") }, { id: "b", title: "B", url: "u", kind: "youtube", sessionId: "o1", createdAt: d("2026-10-03T01:00:00Z") }, { id: "c", title: "C", url: "u", kind: "youtube", sessionId: "o2", createdAt: d("2026-10-10T01:00:00Z") }],
  [{ id: "o1", dateKey: "2026-10-02" }, { id: "n1", dateKey: "2026-11-02" }, { id: "o2", dateKey: "2026-10-09" }, { id: "y1", dateKey: "2025-12-31" }],
);
const mm = groupRecordingsByMonth(multi);
check("nhiều tháng: tháng mới nhất trước, buổi mới nhất trước trong tháng", mm.map(x => x.key).join() === "2026-11,2026-10" && mm[1].items.map(x => x.rec.id).join() === "c,b" && mm[1].label === "Tháng 10/2026");
check("không có bản ghi nào → không có nhóm nào (không ném lỗi)", groupRecordingsByMonth(groupRecordingsBySession([], sessions)).length === 0);
check("không đổi dữ liệu đầu vào", g.bySession.length === 3 && g.unattached.length === 2 && g.bySession[1].recordings.length === 2);

section("MD-17 — bảng ai đã xem");
const lessons = [{ id: "L1", title: "Bài 1", hasVideo: true }, { id: "L2", title: "Bài 2 (không video)", hasVideo: false }, { id: "L3", title: "Bài 3", hasVideo: true }];
const stu = [{ id: "u1", name: "An" }, { id: "u2", name: "Bình" }, { id: "u3", name: "Chi" }];
const prog = [
  { userId: "u1", lessonId: "L1", completed: true, watchedSeconds: 600 }, { userId: "u1", lessonId: "L3", completed: false, watchedSeconds: 40 },
  { userId: "u2", lessonId: "L1", completed: false, watchedSeconds: 0 }, { userId: "u2", lessonId: "L2", completed: true, watchedSeconds: 1 },
  { userId: "u9", lessonId: "L1", completed: true, watchedSeconds: 5 }, // em KHÔNG thuộc lớp: không được lọt vào số
];
const w = buildWatchTable(lessons, stu, prog);
check("chỉ bài có video", w.videoCount === 2 && w.lessons.map(l => l.id).join() === "L1,L3");
check("trạng thái từng em: xong / đang xem / chưa", w.students[0].cells.L1 === "xong" && w.students[0].cells.L3 === "dang-xem" && w.students[1].cells.L1 === "chua" && w.students[2].cells.L1 === "chua");
check("hàng có giây = 0 và chưa xong → 'chưa', không phải 'đang xem'", w.students[1].cells.L1 === "chua");
check("bài không video KHÔNG có cột, dù em có tiến độ ở bài đó", !("L2" in w.students[1].cells));
check("số tổng theo bài khớp từng ô", w.lessons[0].xong === 1 && w.lessons[0].dangXem === 0 && w.lessons[0].chua === 2 && w.lessons[1].dangXem === 1);
check("số tổng không đếm em ngoài lớp (u9)", w.lessons[0].xong + w.lessons[0].dangXem + w.lessons[0].chua === stu.length);
check("đếm video xong của từng em", w.students.map(s => s.xong).join() === "1,0,0");
check("lớp không có video → bảng rỗng, không lỗi", buildWatchTable([{ id: "x", title: "x", hasVideo: false }], stu, prog).videoCount === 0);

section("BC-03 — tiến độ học liệu vào báo cáo tháng");
const ml = [{ id: "a", hasVideo: true, hasAzota: false }, { id: "b", hasVideo: true, hasAzota: true }, { id: "c", hasVideo: false, hasAzota: true }, { id: "d", hasVideo: false, hasAzota: false }];
const mp = summariseMediaProgress(ml, new Set(["a", "c", "zzz"]), new Set(["b"]));
check("đếm đúng: 2 video, xem 1; 2 bài Azota, chưa báo 1", mp.videosTotal === 2 && mp.videosWatched === 1 && mp.azotaTotal === 2 && mp.azotaPending === 1, mp);
check("'xem' ở bài không có video không được tính (c)", summariseMediaProgress(ml, new Set(["c"]), new Set()).videosWatched === 0);
check("dòng chữ nói đúng số", mediaProgressLine(mp) === "đã xem 1/2 video bài giảng; 1/2 bài Azota chưa báo đã làm", mediaProgressLine(mp));
check("làm hết Azota → câu khác, không 0/N", /đã báo làm hết/.test(mediaProgressLine(summariseMediaProgress(ml, new Set(), new Set(["b", "c"]))) ?? ""));
check("không có video lẫn Azota → KHÔNG in dòng nào (không 0/0)", mediaProgressLine(summariseMediaProgress([{ id: "d", hasVideo: false, hasAzota: false }], new Set(), new Set())) === null && mediaProgressLine(undefined) === null);
check("chữ không khẳng định điều KiN không biết ('đã làm' chỉ là 'đã báo')", !/đã làm bài|điểm/.test(mediaProgressLine(mp) ?? ""));
const subj: SubjectMonthMetrics = {
  courseId: "c1", courseName: "Toán 9", attendance: { sessions: 4, ratio: 1 }, homework: { assigned: 0, onTime: 0, ratio: null }, effort: 9,
  mastery: { value: null, scores: [], tone: "neutral", text: "Chưa đủ dữ liệu", code: "chua-du" } as never,
};
const withMedia = renderReportText({ studentName: "An", yearMonth: "2026-10", subjects: [{ ...subj, media: mp }], unmet: [] });
const without = renderReportText({ studentName: "An", yearMonth: "2026-10", subjects: [subj], unmet: [] });
check("báo cáo có dòng 'Học liệu trên KiN' khi có số", /- Học liệu trên KiN \(tính đến lúc lập báo cáo\): đã xem 1\/2 video/.test(withMedia), withMedia);
check("báo cáo/ảnh chụp ĐÃ DUYỆT từ trước (không có trường media) in y như cũ — không dòng thừa", !/Học liệu/.test(without));
check("hai bản chỉ khác nhau đúng một dòng", withMedia.split("\n").length === without.split("\n").length + 1);

section("MD-11 — chữ cam kết bản quyền (cần luật sư duyệt)");
check("chữ cam kết nói quyền chia sẻ + hình/giọng học sinh", /quyền chia sẻ/.test(COPYRIGHT_PLEDGE_LABEL) && /học sinh/.test(COPYRIGHT_PLEDGE_LABEL));
check("thông báo nói rõ KiN chỉ lưu link, không kiểm bản quyền thay", /chỉ lưu đường link/.test(COPYRIGHT_NOTICE) && /không kiểm tra bản quyền/.test(COPYRIGHT_NOTICE));
check("không có chữ 'đã xác minh' / 'đúng luật' / 'hợp pháp'", !/đã xác minh|đúng luật|hợp pháp/i.test(COPYRIGHT_PLEDGE_LABEL + COPYRIGHT_NOTICE));
done();
