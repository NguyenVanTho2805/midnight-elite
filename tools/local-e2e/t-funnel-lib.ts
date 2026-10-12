import { normalizeChannel, channelGroup, slugifyVi, facebookChannel, profileLink, clipText, profileOg, funnelRows, isReportReason, REPORT_REASONS, OG_TITLE_MAX, OG_DESC_MAX, CHANNEL_MAX } from "@/lib/funnel";
import { readPreferences, applyPreferencesPatch, normalizeMessengerHandle } from "@/lib/userPreferences";
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
done();
