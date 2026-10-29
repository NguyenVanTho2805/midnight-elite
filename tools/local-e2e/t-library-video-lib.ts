// NC2-046 — src/lib/youtubeLink.ts + src/lib/libraryVideo.ts: video YouTube trong kho do quản trị chọn.
// PHÁ CỐ Ý: tên miền giả (youtube.com.xau.vn, xauyoutube.com), giao thức lạ (javascript:, data:, ftp:), tên đăng nhập trong URL, mã sai độ dài / ký tự lạ,
// link danh sách phát không có video, tiêu đề tàng hình, chủ đề trùng / quá dài / quá nhiều, kiểu dữ liệu sai.
import { parseYoutubeId, watchUrl, thumbUrl, isVideoId } from "@/lib/youtubeLink";
import { parseLibraryVideoInput, parseTopics, VIDEO_TITLE_MAX, VIDEO_TOPIC_MAX, VIDEO_TOPICS_MAX, VIDEO_CHANNEL_MAX, VIDEO_NOTE_MAX } from "@/lib/libraryVideo";
import { check, section, done } from "./h";

const ID = "dQw4w9WgXcQ";

section("Tách mã video");
for (const [name, url] of [
  ["watch?v=", `https://www.youtube.com/watch?v=${ID}`],
  ["watch kèm tham số khác", `https://www.youtube.com/watch?list=PL123&v=${ID}&t=42s`],
  ["không www", `https://youtube.com/watch?v=${ID}`],
  ["m.youtube.com", `https://m.youtube.com/watch?v=${ID}`],
  ["music.youtube.com", `https://music.youtube.com/watch?v=${ID}`],
  ["youtu.be", `https://youtu.be/${ID}`],
  ["youtu.be kèm ?t=", `https://youtu.be/${ID}?t=10`],
  ["/embed/", `https://www.youtube.com/embed/${ID}`],
  ["/shorts/", `https://www.youtube.com/shorts/${ID}`],
  ["/live/", `https://www.youtube.com/live/${ID}`],
  ["youtube-nocookie /embed/", `https://www.youtube-nocookie.com/embed/${ID}`],
  ["http (không s)", `http://www.youtube.com/watch?v=${ID}`],
  ["thiếu https://", `youtube.com/watch?v=${ID}`],
  ["thiếu https:// với youtu.be", `youtu.be/${ID}`],
  ["có khoảng trắng hai đầu", `  https://youtu.be/${ID}  `],
  ["tên miền viết hoa", `https://WWW.YouTube.COM/watch?v=${ID}`],
] as const) check(`${name} → ${ID}`, parseYoutubeId(url) === ID, parseYoutubeId(url));
check("mã có gạch dưới và gạch nối (ab_cd-efGH1) vẫn nhận", parseYoutubeId("https://youtu.be/ab_cd-efGH1") === "ab_cd-efGH1");

section("Link bị từ chối");
for (const [name, url] of [
  ["tên miền giả: youtube.com.xau.vn", `https://youtube.com.xau.vn/watch?v=${ID}`],
  ["tên miền giả: xauyoutube.com", `https://xauyoutube.com/watch?v=${ID}`],
  ["tên miền giả: youtu.be.xau.vn", `https://youtu.be.xau.vn/${ID}`],
  ["tên miền khác (vimeo)", `https://vimeo.com/watch?v=${ID}`],
  ["tên đăng nhập trong URL", `https://youtube.com@xau.example.com/watch?v=${ID}`],
  ["có mật khẩu trong URL", `https://u:p@www.youtube.com/watch?v=${ID}`],
  ["javascript:", "javascript:alert(1)"],
  ["data:", `data:text/html,<script>alert(1)</script>`],
  ["ftp://", `ftp://www.youtube.com/watch?v=${ID}`],
  ["mã quá ngắn", "https://youtu.be/abc"],
  ["mã quá dài", `https://youtu.be/${ID}X`],
  ["mã có ký tự lạ", "https://youtu.be/dQw4w9WgXc!"],
  ["watch không có v", "https://www.youtube.com/watch"],
  ["chỉ có danh sách phát", "https://www.youtube.com/playlist?list=PLabcdefghijk"],
  ["trang chủ kênh", "https://www.youtube.com/@kenh"],
  ["trang chủ YouTube", "https://www.youtube.com/"],
  ["chỉ là mã trần (không link)", ID],
  ["rỗng", ""], ["toàn khoảng trắng", "   "],
  ["quá 300 ký tự", `https://www.youtube.com/watch?v=${ID}&x=${"a".repeat(300)}`],
] as const) check(`${name} → từ chối`, parseYoutubeId(url) === null, parseYoutubeId(url));
check("không phải chữ (số, null, mảng, đối tượng) → null", [123, null, undefined, [`https://youtu.be/${ID}`], { u: 1 }].every(v => parseYoutubeId(v) === null));

section("Dựng link từ mã");
check("watchUrl / thumbUrl chỉ dựng từ mã", watchUrl(ID) === `https://www.youtube.com/watch?v=${ID}` && thumbUrl(ID) === `https://i.ytimg.com/vi/${ID}/mqdefault.jpg`);
check("isVideoId: 11 ký tự hợp lệ", isVideoId(ID) && !isVideoId("abc") && !isVideoId(`${ID}x`) && !isVideoId("dQw4w9WgXc ") && !isVideoId(5));

section("Chủ đề");
let t = parseTopics("Chiến tranh lạnh, Lịch sử 12;  Thế giới\nChiến TRANH lạnh");
check("tách theo , ; xuống dòng; bỏ trùng không phân biệt hoa thường", t.ok && JSON.stringify(t.topics) === JSON.stringify(["Chiến tranh lạnh", "Lịch sử 12", "Thế giới"]), t);
t = parseTopics("Chien tranh lanh, Chiến tranh lạnh");
check("bỏ trùng cả khi khác dấu (Chien tranh lanh = Chiến tranh lạnh)", t.ok && t.topics.length === 1, t);
t = parseTopics(["a1", " ", "", "b2"]);
check("mảng: bỏ phần tử trống", t.ok && JSON.stringify(t.topics) === '["a1","b2"]', t);
check("undefined / null → danh sách rỗng", (() => { const a = parseTopics(undefined), b = parseTopics(null); return a.ok && a.topics.length === 0 && b.ok && b.topics.length === 0; })());
check("số / đối tượng / mảng có số → lỗi", !parseTopics(5).ok && !parseTopics({}).ok && !parseTopics(["a", 3]).ok);
check(`chủ đề đúng ${VIDEO_TOPIC_MAX} ký tự → nhận; ${VIDEO_TOPIC_MAX + 1} → lỗi`, parseTopics("x".repeat(VIDEO_TOPIC_MAX)).ok && !parseTopics("x".repeat(VIDEO_TOPIC_MAX + 1)).ok);
check(`đúng ${VIDEO_TOPICS_MAX} chủ đề → nhận; ${VIDEO_TOPICS_MAX + 1} → lỗi`, parseTopics(Array.from({ length: VIDEO_TOPICS_MAX }, (_, i) => `c${i}`)).ok && !parseTopics(Array.from({ length: VIDEO_TOPICS_MAX + 1 }, (_, i) => `c${i}`)).ok);
check("chủ đề toàn ký tự tàng hình bị bỏ (không thành chủ đề vô hình)", (() => { const r = parseTopics("\u200b\u200d, \ufeff"); return r.ok && r.topics.length === 0; })());

section("Video đầy đủ");
const base = { title: "Chiến tranh lạnh — Lịch sử 12", url: `https://youtu.be/${ID}`, topics: "Chiến tranh lạnh, Lịch sử 12", channel: "Thầy A", note: "Xem từ phút 3", published: true };
let r = parseLibraryVideoInput(base);
check("đủ ô → nhận; mã video tách đúng; chủ đề thành mảng", r.ok && r.value.videoId === ID && r.value.topics.length === 2 && r.value.published === true && r.value.channel === "Thầy A", r);
r = parseLibraryVideoInput({ title: "T", url: `https://youtu.be/${ID}` });
check("chỉ cần tiêu đề + link: mặc định chưa công khai, chủ đề / kênh / ghi chú rỗng", r.ok && r.value.published === false && r.value.topics.length === 0 && r.value.channel === "" && r.value.note === "", r);
r = parseLibraryVideoInput({ ...base, title: "  Chiến \t tranh\n lạnh  " });
check("tiêu đề: gộp khoảng trắng / dòng", r.ok && r.value.title === "Chiến tranh lạnh", r);
const bad = (name: string, o: unknown, field: string) => { const x = parseLibraryVideoInput(o); check(name, !x.ok && x.field === field && x.error.length > 5, x); };
bad("thiếu tiêu đề", { ...base, title: "" }, "title");
bad("tiêu đề toàn ký tự tàng hình", { ...base, title: "\u200b\u200d\ufeff" }, "title");
bad(`tiêu đề quá ${VIDEO_TITLE_MAX} ký tự`, { ...base, title: "x".repeat(VIDEO_TITLE_MAX + 1) }, "title");
bad("link không phải YouTube", { ...base, url: "https://vimeo.com/123" }, "url");
bad("link javascript:", { ...base, url: "javascript:alert(1)" }, "url");
bad("thiếu link", { title: "T" }, "url");
bad("chủ đề sai kiểu", { ...base, topics: 5 }, "topics");
bad(`tên kênh quá ${VIDEO_CHANNEL_MAX} ký tự`, { ...base, channel: "x".repeat(VIDEO_CHANNEL_MAX + 1) }, "channel");
bad(`ghi chú quá ${VIDEO_NOTE_MAX} ký tự`, { ...base, note: "x".repeat(VIDEO_NOTE_MAX + 1) }, "note");
bad("published là chữ 'true' (không phải boolean)", { ...base, published: "true" }, "published");
bad("published là số 1", { ...base, published: 1 }, "published");
bad("thân là mảng", [base], "title");
bad("thân là null", null, "title");
bad("thân là chuỗi", "x", "title");
check("tiêu đề / ghi chú giữ nguyên ký tự HTML như chữ (React tự thoát khi hiển thị)", (() => { const x = parseLibraryVideoInput({ ...base, title: "<b>x</b> & y", note: "<img src=x onerror=alert(1)>" }); return x.ok && x.value.title === "<b>x</b> & y" && x.value.note === "<img src=x onerror=alert(1)>"; })());

done();
