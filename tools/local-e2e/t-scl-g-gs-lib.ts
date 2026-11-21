// SCL-G-GS — phần thuần của Hộp việc gia sư và thanh "Lớp của bạn" (src/lib/lopViec.ts) + đường quay về của form duyệt / nhận (enrollServer.joinDecideBack). Không cần máy chủ.
import { emptyTodo, todoTotal, hasAnyTodo, inboxSummary, videoText, nopText, showClassFilter, filterClasses, groupByOwner } from "@/lib/lopViec";
import { joinDecideBack } from "@/lib/enrollServer";
import { contentTabsFor } from "@/lib/tutorRoutes";
import { check, section, done } from "./h";

section("Đếm việc");
const t = { ...emptyTodo("c1"), choCham: 4, choDuyet: 2, xinVao: 1 };
check("tổng = chờ chấm + chờ duyệt + xin vào (7)", todoTotal(t) === 7);
check("chỉ có lời nhắc video ⇒ vẫn hiện ở Hộp việc nhưng không đếm", hasAnyTodo({ ...emptyTodo("c2"), nextNoVideo: { lessonId: "l", title: "Buổi 6", dateKey: "2026-11-24" } }) && todoTotal({ ...emptyTodo("c2") }) === 0);
check("tóm tắt: '9 việc ở 2 lớp'", inboxSummary([t, { ...emptyTodo("c3"), choCham: 2 }, emptyTodo("c4")]) === "9 việc ở 2 lớp");
check("không việc ⇒ nói thẳng", inboxSummary([emptyTodo("c1")]) === "Không có việc nào cần bạn xử lý");

section("Cột Video / Nộp của hàng bài (ghi đủ chữ)");
check("không link ⇒ 'Chưa có video'", videoText(null, "42") === "Chưa có video" && videoText("  ", null) === "Chưa có video");
check("'42' ⇒ 'Video 42 phút'", videoText("https://youtu.be/x", "42") === "Video 42 phút");
check("'42:10' ⇒ 'Video 42 phút'; '1:02:30' ⇒ 'Video 63 phút'", videoText("u", "42:10") === "Video 42 phút" && videoText("u", "1:02:30") === "Video 63 phút");
check("'42′' ⇒ không giữ dấu phẩy trên", !videoText("u", "42′").includes("′") && videoText("u", "42′").includes("phút"));
check("có link chưa ghi thời lượng ⇒ 'Có video'", videoText("u", "") === "Có video");
check("Nộp 4/12; bài không có bài tập ⇒ không vẽ cột", nopText({ submitted: 4, total: 12, hasAssignment: true }) === "Nộp 4/12" && nopText(undefined) === null && nopText({ submitted: 0, total: 3, hasAssignment: false }) === null);

section("Thanh 'Lớp của bạn'");
check("ô lọc chỉ khi > 8 lớp", !showClassFilter(8) && showClassFilter(9));
const cls = [{ name: "Toán 9 · Lớp A", ownerName: "Nguyễn Hoa" }, { name: "Vật lý 9", ownerName: "Trần Lan" }, { name: "Toán 8", ownerName: null }];
const txt = (c: { name: string; ownerName: string | null }) => `${c.name} ${c.ownerName ?? ""}`;
check("lọc không dấu, không hoa thường: 'toan' ⇒ 2 lớp", filterClasses(cls, "toan", txt).length === 2);
check("lọc theo tên gia sư: 'hoa' ⇒ Toán 9", filterClasses(cls, "HOA", txt).map(c => c.name).join() === "Toán 9 · Lớp A");
check("ô trống ⇒ nguyên danh sách", filterClasses(cls, "  ", txt).length === 3);
const g = groupByOwner(cls);
check("Chủ nhiệm: nhóm theo gia sư, lớp chưa có chủ vào 'Lớp của trung tâm'", g.map(x => x.title).join("|") === "Lớp của Nguyễn Hoa|Lớp của Trần Lan|Lớp của trung tâm", g);

section("Form duyệt / nhận gửi ve=hop-viec ⇒ về Hộp việc (chỉ đúng một giá trị)");
const fd = (v: string | null) => { const f = new FormData(); if (v) f.set("ve", v); return f; };
check("ve=hop-viec ⇒ /lop-cua-toi/hop-viec", joinDecideBack("c1", fd("hop-viec"), "duyet=ok").startsWith("/lop-cua-toi/hop-viec?"));
check("ve=hang-cho giữ như cũ; không ve ⇒ tab Học sinh của lớp", joinDecideBack("c1", fd("hang-cho"), "x=1").startsWith("/lop-cua-toi/xin-vao-lop?") && joinDecideBack("c1", fd(null), "x=1").startsWith("/lop-cua-toi/c1?tab=hoc-sinh"));
check("ve lạ (đường tuỳ ý) ⇒ KHÔNG đi theo", !joinDecideBack("c1", fd("https://xau.vn"), "x=1").includes("xau"));

section("Tab trong lớp: Bài học / Học sinh / Điểm là ba tab đầu (liên kết)");
const tabs = contentTabsFor("/lop-cua-toi/quan-lop/c1", null, null)?.tabs.map(x => x.label) ?? [];
check("ba tab đầu đúng thứ tự", tabs.slice(0, 3).join("|") === "Bài học|Học sinh|Điểm", tabs);

done();
