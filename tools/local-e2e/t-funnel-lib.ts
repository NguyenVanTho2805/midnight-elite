import { normalizeZaloGroupUrl, isZaloGroupUrl, guessPronoun, noPrepaySafetyLine, composeRecruitPost, ensureSafetyLine, facebookShareUrl, normalizeChannel, channelGroup, slugifyVi, facebookChannel, profileLink, clipText, profileOg, funnelRows, isReportReason, REPORT_REASONS, OG_TITLE_MAX, OG_DESC_MAX, CHANNEL_MAX } from "@/lib/funnel";
import { readPreferences, applyPreferencesPatch, normalizeMessengerHandle, normalizeGroupNames } from "@/lib/userPreferences";
import { check, section, done } from "./h";
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

section("Chuẩn hoá đuôi ?n=");
check("chữ thường, bỏ ký tự lạ", normalizeChannel("FB-HN9") === "fb-hn9" && normalizeChannel(" zl_rieng ") === "zlrieng" && normalizeChannel("fb--hn  9") === "fb-hn9");
check("rỗng / không phải chuỗi / toàn ký tự lạ → truc-tiep", normalizeChannel("") === "truc-tiep" && normalizeChannel(undefined) === "truc-tiep" && normalizeChannel(42) === "truc-tiep" && normalizeChannel("###") === "truc-tiep" && normalizeChannel("-") === "truc-tiep");
check("tối đa 40 ký tự", normalizeChannel("a".repeat(100)).length === CHANNEL_MAX);
check("chống chèn: ../ <script> ?x=1 bị loại sạch", normalizeChannel("../../etc?x=1<script>") === "etcx1script");
check("dấu tiếng Việt bị loại (không đoán ký tự)", normalizeChannel("nhóm-hà-nội") === "nhm-h-ni");

section("Nhóm kênh");
check("fb / fb-xxx → Facebook; zl-rieng; zl-nhom; bc / bc-xxx → báo cáo; truc-tiep; còn lại khác",
  channelGroup("fb") === "facebook" && channelGroup("fb-hn9") === "facebook" && channelGroup("zl-rieng") === "zalo-rieng" && channelGroup("zl-nhom") === "zalo-nhom"
  && channelGroup("bc") === "bao-cao" && channelGroup("bc-t10") === "bao-cao" && channelGroup("truc-tiep") === "truc-tiep" && channelGroup("fbx") === "khac" && channelGroup("abc") === "khac");

section("Tên nhóm Facebook → đuôi");
check("bỏ dấu, gạch ngang", slugifyVi("Gia sư Toán Hà Nội 9") === "gia-su-toan-ha-noi-9" && slugifyVi("Đồng Đẳng ƯỚC Mơ") === "dong-dang-uoc-mo");
check("cắt 24 ký tự, không để gạch cuối", slugifyVi("Gia sư Toán Hà Nội lớp chín mười").length <= 24 && !slugifyVi("Gia sư Toán Hà Nội lớp chín mười").endsWith("-"));
check("facebookChannel: fb-<slug>, không tên → fb", facebookChannel("Gia sư HN") === "fb-gia-su-hn" && facebookChannel("   ") === "fb" && facebookChannel("🙂🙂") === "fb");
check("facebookChannel khớp normalizeChannel (không bị đổi khi đo)", ["Gia sư Toán Hà Nội 9", "Lớp 9 — Ôn thi", "ABC"].every(n => normalizeChannel(facebookChannel(n)) === facebookChannel(n)));

section("Link hồ sơ");
check("có kênh → ?n=", profileLink("https://kin.vn", "u1", "fb-hn9") === "https://kin.vn/mentor/u1?n=fb-hn9");
check("không kênh / trực tiếp → không đuôi; bỏ / thừa ở origin", profileLink("https://kin.vn/", "u1") === "https://kin.vn/mentor/u1" && profileLink("https://kin.vn", "u1", "truc-tiep") === "https://kin.vn/mentor/u1");
check("kênh bẩn được chuẩn hoá trong link", profileLink("https://kin.vn", "u1", "FB HN#9") === "https://kin.vn/mentor/u1?n=fbhn9");

section("Thẻ xem trước: og:title ≤ 60, og:description ≤ 110");
check("clipText giữ nguyên chuỗi ngắn, cắt ở ranh giới từ và thêm …", clipText("ngắn gọn", 20) === "ngắn gọn" && clipText("một hai ba bốn năm sáu bảy tám chín mười", 20).endsWith("…") && clipText("một hai ba bốn năm sáu bảy tám chín mười", 20).length <= 20);
const og = profileOg({ name: "Nguyễn Thị Minh Phương Anh Thư", subjects: ["Toán 9", "Vật lý 10", "Hoá"], classCount: 3, sessionsTaught: 120, bio: "Gia sư Toán nhiều năm kinh nghiệm, dạy lớp nhỏ và theo sát từng em, luôn báo cáo phụ huynh mỗi tuần." });
check("tiêu đề ≤ 60, mô tả ≤ 110", og.title.length <= OG_TITLE_MAX && og.description.length <= OG_DESC_MAX, [og.title.length, og.description.length]);
check("tiêu đề có tên + môn + KiN; mô tả có số liệu thật và 'Không thu phí nhận lớp'", og.title.startsWith("Nguyễn Thị") && /KiN|…/.test(og.title) && /3 lớp đang dạy/.test(og.description) && /120 buổi đã dạy/.test(og.description));
const og2 = profileOg({ name: "Cô Lan", subjects: [], classCount: 0, sessionsTaught: 0 });
check("gia sư mới (chưa có số liệu): vẫn có mô tả, không ghi '0 lớp'", og2.title === "Cô Lan — gia sư | KiN" && og2.description === "Không thu phí nhận lớp" && !/0 /.test(og2.description));
check("thẻ xem trước KHÔNG có điểm/tên học sinh/số tiền (chỉ nhận trường công khai)", !/\d+đ|điểm|học sinh/i.test(og.description));

section("Bảng phễu: gộp theo kênh");
const rows = funnelRows([
  { channel: "fb-hn9", kind: "open", count: 40 }, { channel: "fb-hn9", kind: "full", count: 4 },
  { channel: "bc", kind: "open", count: 5 }, { channel: "bc", kind: "full", count: 3 },
  { channel: "zl-rieng", kind: "open", count: 5 }, { channel: "truc-tiep", kind: "full", count: 2 },
]);
check("xếp theo lượt mở giảm dần, rồi tên kênh", eq(rows.map(r => r.channel), ["fb-hn9", "bc", "zl-rieng", "truc-tiep"]));
check("tỉ lệ xem hết: 10% (40→4), 60% (5→3), 0% (5→0), null khi chưa có lượt mở", rows[0].fullRate === 0.1 && rows[1].fullRate === 0.6 && rows[2].fullRate === 0 && rows[3].fullRate === null && rows[3].fulls === 2);
check("tỉ lệ không vượt 100% dù dữ liệu lệch", funnelRows([{ channel: "x", kind: "open", count: 1 }, { channel: "x", kind: "full", count: 5 }])[0].fullRate === 1);
check("rỗng → rỗng; kind lạ bị bỏ qua", eq(funnelRows([]), []) && funnelRows([{ channel: "x", kind: "zzz", count: 9 }])[0].opens === 0);

section("Lý do báo cáo");
check("3 lý do hợp lệ, lạ bị từ chối", REPORT_REASONS.length === 3 && isReportReason("thu-phi-truoc") && isReportReason("gia-mao") && isReportReason("khac") && !isReportReason("spam") && !isReportReason(undefined));

section("Kết nối (preferences.connections)");
check("tên trang Messenger: nhận handle và dán link m.me", normalizeMessengerHandle("gia.su.lan") === "gia.su.lan" && normalizeMessengerHandle("https://m.me/gia.su.lan?ref=x") === "gia.su.lan" && normalizeMessengerHandle("https://www.messenger.com/t/lan_99") === "lan_99");
check("handle sai bị từ chối", normalizeMessengerHandle("") === null && normalizeMessengerHandle("a b") === null && normalizeMessengerHandle("a/b") === null && normalizeMessengerHandle("x".repeat(65)) === null && normalizeMessengerHandle(5) === null && normalizeMessengerHandle("javascript:alert(1)") === null);
let r = applyPreferencesPatch({}, { connections: { showZalo: true, messenger: "https://m.me/lan.gia.su" } });
check("bật showZalo + messenger", r.ok && eq(r.value.connections, { showZalo: true, messenger: "lan.gia.su" }));
r = applyPreferencesPatch({ connections: { showZalo: true, messenger: "a" } }, { connections: { messenger: null } });
check("xoá messenger giữ showZalo", r.ok && eq(r.value.connections, { showZalo: true }));
r = applyPreferencesPatch({ connections: { showZalo: true } }, { connections: { showZalo: null } });
check("xoá hết → bỏ cả khoá", r.ok && r.value.connections === undefined);
r = applyPreferencesPatch({}, { connections: null });
check("connections: null hợp lệ", r.ok && r.value.connections === undefined);
check("sai kiểu / khoá lạ bị từ chối cả bản vá", !applyPreferencesPatch({}, { connections: { showZalo: "yes" } }).ok && !applyPreferencesPatch({}, { connections: { oa: true } }).ok && !applyPreferencesPatch({}, { connections: { messenger: "a b" } }).ok && !applyPreferencesPatch({}, { connections: [] }).ok);
check("đọc khoan dung: showZalo hỏng bị bỏ, messenger hỏng bị bỏ", eq(readPreferences({ connections: { showZalo: "x", messenger: "a b" } }).connections, undefined) && eq(readPreferences({ connections: { showZalo: false } }).connections, { showZalo: false }));
check("mặc định: không có connections = showZalo tắt", readPreferences({}).connections?.showZalo !== true);
section("Xưng hô gợi ý");
check("Thầy / Cô theo tên; còn lại 'Mình'", guessPronoun("Thầy Khang") === "Thầy" && guessPronoun("cô Lan") === "Cô" && guessPronoun("  Cô   Mai") === "Cô" && guessPronoun("Nguyễn Văn A") === "Mình" && guessPronoun("Cô") === "Cô" && guessPronoun("") === "Mình" && guessPronoun("Côngthành") === "Mình");

section("Soạn bài đăng tìm học sinh (PH-209)");
const post = composeRecruitPost({ pronoun: "Cô", name: "Cô Lan", subjects: ["Toán 9", "Toán 10"], classes: [{ name: "Toán 9", seatsLeft: 3 }, { name: "Toán 10", seatsLeft: 0 }, { name: "Lý 9", seatsLeft: null }], slots: "T3, T5 19h–20h30", fee: "200.000đ/buổi", sessionsTaught: 1234, link: "https://kin.vn/mentor/u1?n=fb-hn9" });
check("đủ các dòng theo thứ tự, link có ?n=, dòng an toàn cuối cùng", eq(post.split("\n"), [
  "TÌM HỌC SINH — Toán 9, Toán 10",
  "Cô Lan đang nhận thêm học sinh.",
  "• Lớp: Toán 9 (còn 3 chỗ); Toán 10; Lý 9",
  "• Giờ còn trống: T3, T5 19h–20h30",
  "• Học phí: 200.000đ/buổi",
  "• Đã dạy 1.234 buổi (theo sổ lớp trên KiN, không tự sửa được)",
  "",
  "Xem hồ sơ và đăng ký học thử: https://kin.vn/mentor/u1?n=fb-hn9",
  "Cô không nhận chuyển khoản trước buổi học thử.",
]), post);
check("lớp đã đủ chỗ không ghi 'còn 0 chỗ'", !post.includes("còn 0"));
const minimal = composeRecruitPost({ pronoun: "Mình", name: "Nguyễn Văn A", subjects: [], classes: [], sessionsTaught: 0, link: "https://kin.vn/mentor/u2" });
check("gia sư mới: bỏ dòng Lớp/Giờ/Học phí/Số buổi (không khoe số 0), vẫn có link + dòng an toàn", eq(minimal.split("\n"), ["TÌM HỌC SINH", "Mình là Nguyễn Văn A đang nhận thêm học sinh.", "", "Xem hồ sơ và đăng ký học thử: https://kin.vn/mentor/u2", "Mình không nhận chuyển khoản trước buổi học thử."]), minimal);
const thay = composeRecruitPost({ pronoun: "Thầy", name: "Thầy Khang", subjects: ["Lý"], classes: [], sessionsTaught: 5, link: "L" });
check("Thầy + tên có sẵn 'Thầy' → không lặp 'Thầy Thầy'", thay.split("\n")[1] === "Thầy Khang đang nhận thêm học sinh." && composeRecruitPost({ pronoun: "Thầy", name: "Nguyễn Khang", subjects: [], classes: [], sessionsTaught: 0, link: "L" }).split("\n")[1] === "Thầy Nguyễn Khang đang nhận thêm học sinh.");
check("ô gõ tay bị gọn khoảng trắng, cắt 200 ký tự; xuống dòng không phá bố cục", composeRecruitPost({ pronoun: "Cô", name: "Lan", subjects: [], classes: [], sessionsTaught: 0, slots: "a\n\n  b", fee: "x".repeat(300), link: "L" }).split("\n").filter(l => l.startsWith("• ")).every(l => l.length <= 215) && composeRecruitPost({ pronoun: "Cô", name: "Lan", subjects: [], classes: [], sessionsTaught: 0, slots: "a\n\n  b", link: "L" }).includes("• Giờ còn trống: a b"));
check("tối đa 5 môn, 6 lớp", composeRecruitPost({ pronoun: "Cô", name: "L", subjects: ["a", "b", "c", "d", "e", "f", "g"], classes: [], sessionsTaught: 0, link: "L" }).split("\n")[0] === "TÌM HỌC SINH — a, b, c, d, e" && composeRecruitPost({ pronoun: "Cô", name: "L", subjects: [], classes: Array.from({ length: 9 }, (_, i) => ({ name: "C" + i, seatsLeft: null })), sessionsTaught: 0, link: "L" }).split("\n").find(l => l.startsWith("• Lớp"))!.split(";").length === 6);

section("Dòng an toàn luôn được giữ");
check("có sẵn thì giữ nguyên (mọi xưng hô)", ensureSafetyLine(post, "Cô") === post && ensureSafetyLine(post, "Thầy") === post);
check("gia sư lỡ xoá → tự thêm lại ở cuối đúng xưng hô", ensureSafetyLine("Tìm học sinh Toán\nLink: x\n\n", "Thầy") === "Tìm học sinh Toán\nLink: x\nThầy không nhận chuyển khoản trước buổi học thử." && noPrepaySafetyLine("Mình") === "Mình không nhận chuyển khoản trước buổi học thử.");
check("bài rỗng cũng có dòng an toàn", ensureSafetyLine("", "Cô") === "\nCô không nhận chuyển khoản trước buổi học thử.");
check("link chia sẻ Facebook được mã hoá, giữ ?n=", facebookShareUrl("https://kin.vn/mentor/u1?n=fb-hn9") === "https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fkin.vn%2Fmentor%2Fu1%3Fn%3Dfb-hn9");

section("Danh sách nhóm đã lưu");
check("bỏ rỗng/trùng (không phân biệt hoa thường), gọn khoảng trắng, giữ thứ tự", eq(normalizeGroupNames(["Gia sư HN", " gia  sư hn ", "", "Toán 9"]), ["Gia sư HN", "Toán 9"]));
check("sai kiểu / tên > 60 / > 20 nhóm → từ chối", normalizeGroupNames("x") === null && normalizeGroupNames([1]) === null && normalizeGroupNames(["x".repeat(61)]) === null && normalizeGroupNames(Array.from({ length: 21 }, (_, i) => "g" + i)) === null && normalizeGroupNames(Array.from({ length: 20 }, (_, i) => "g" + i))!.length === 20);
r = applyPreferencesPatch({ connections: { showZalo: true } }, { connections: { groups: ["A", "B", "a"] } });
check("lưu nhóm: gộp với khoá cũ, bỏ trùng", r.ok && eq(r.value.connections, { showZalo: true, groups: ["A", "B"] }));
r = applyPreferencesPatch({ connections: { groups: ["A"] } }, { connections: { groups: [] } });
check("danh sách rỗng → bỏ khoá", r.ok && r.value.connections === undefined);
check("danh sách hỏng bị từ chối cả bản vá", !applyPreferencesPatch({}, { connections: { groups: "A" } }).ok && !applyPreferencesPatch({}, { connections: { groups: ["x".repeat(61)] } }).ok);
check("đọc khoan dung: groups hỏng bị bỏ", readPreferences({ connections: { groups: "bad" } }).connections === undefined && eq(readPreferences({ connections: { groups: ["A", "a", ""] } }).connections, { groups: ["A"] }));
import { attendanceGroupMessage, monthlyReportGroupMessage } from "@/lib/invoiceZalo";
import { buildGroupReminderMessage } from "@/lib/classSessions";
section("Link nhóm Zalo của lớp (PH-215)");
const okU = (r: ReturnType<typeof normalizeZaloGroupUrl>) => (r.ok ? r.value : "LOI");
check("link hợp lệ giữ nguyên; bỏ / cuối, tham số, www", okU(normalizeZaloGroupUrl("https://zalo.me/g/abcxyz")) === "https://zalo.me/g/abcxyz" && okU(normalizeZaloGroupUrl(" https://zalo.me/g/abcxyz/?ref=1#x ")) === "https://zalo.me/g/abcxyz" && okU(normalizeZaloGroupUrl("https://www.zalo.me/g/Ab_c-9")) === "https://zalo.me/g/Ab_c-9");
check("rỗng / null / undefined → xoá (null)", okU(normalizeZaloGroupUrl("")) === null && okU(normalizeZaloGroupUrl("   ")) === null && okU(normalizeZaloGroupUrl(null)) === null && okU(normalizeZaloGroupUrl(undefined)) === null);
check("sai dạng bị từ chối: http, host lạ, không có /g/, mã quá ngắn/dài, chèn ký tự", ["http://zalo.me/g/abcxyz", "https://zalo.me.evil.com/g/abcxyz", "https://evil.com/zalo.me/g/abcxyz", "https://zalo.me/abcxyz", "https://zalo.me/g/ab", "https://zalo.me/g/" + "a".repeat(41), "https://zalo.me/g/abc xyz", "javascript:alert(1)", "https://zalo.me/g/abcxyz@evil.com", 123].every(x => !normalizeZaloGroupUrl(x).ok));
check("isZaloGroupUrl chỉ nhận dạng đã chuẩn hoá", isZaloGroupUrl("https://zalo.me/g/abcxyz") && !isZaloGroupUrl("https://zalo.me/g/abcxyz/") && !isZaloGroupUrl("https://zalo.me/g/ab") && !isZaloGroupUrl(null) && !isZaloGroupUrl(5));

section("Tin điểm danh vào nhóm: không nêu em nào (PH-216)");
check("cả lớp có mặt → 'đủ 5/5 bạn'", attendanceGroupMessage({ subject: "Toán 9", dateLabel: "17/9", present: 5, total: 5 }) === "Buổi Toán 9 17/9: đủ 5/5 bạn.");
check("thiếu → 'có mặt 4/5 bạn' (không nói ai vắng, không từ 'vắng')", attendanceGroupMessage({ subject: "Toán 9", dateLabel: "17/9", present: 4, total: 5 }) === "Buổi Toán 9 17/9: có mặt 4/5 bạn." && !/vắng|muộn|có phép/i.test(attendanceGroupMessage({ subject: "Toán 9", dateLabel: "17/9", present: 4, total: 5 })));
check("số lệch được kẹp (present > total → đủ; âm → 0)", attendanceGroupMessage({ subject: "A", dateLabel: "1/1", present: 9, total: 5 }) === "Buổi A 1/1: đủ 5/5 bạn." && attendanceGroupMessage({ subject: "A", dateLabel: "1/1", present: -2, total: 3 }) === "Buổi A 1/1: có mặt 0/3 bạn.");
check("tin báo cáo tháng vào nhóm: chỉ nói 'đã gửi riêng', không điểm/tên", monthlyReportGroupMessage({ yearMonth: "2026-09" }) === "Báo cáo tháng 9 đã gửi riêng cho từng anh/chị. Anh/chị xem tin nhắn riêng giúp em nhé." && !/\d+\/10|điểm/i.test(monthlyReportGroupMessage({ yearMonth: "2026-09" })));

section("Nhắc lịch chung vào nhóm");
const start = new Date("2026-10-15T12:00:00Z"); // 19:00 giờ VN, thứ Năm 15/10
const now = new Date("2026-10-14T05:00:00Z");   // 12:00 ngày 14/10
const gm = buildGroupReminderMessage({ subject: "Toán 9", startAt: start, joinUrl: "https://meet.example/abc", now });
check("đúng mẫu: cả lớp, giờ, 'tối mai', thứ + ngày, link vào lớp, nhắc báo nghỉ riêng", gm === "KiN nhắc lịch: cả lớp có buổi Toán 9 lúc 19:00 tối mai, thứ Năm 15/10.\nLink vào lớp: https://meet.example/abc\nCần nghỉ thì báo riêng với thầy/cô trước giờ học nhé.", gm);
check("không link → bỏ dòng link; không có tên em", !buildGroupReminderMessage({ subject: "Toán 9", startAt: start, now }).includes("Link vào lớp") && !/con |của /i.test(gm));
check("cùng ngày → 'hôm nay'", buildGroupReminderMessage({ subject: "Lý", startAt: start, now: new Date("2026-10-15T01:00:00Z") }).includes("19:00 tối hôm nay"));
done();
