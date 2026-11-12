// LOI-04 — hàm thuần của "Nhắc học" (src/lib/nhacHoc.ts). Thuần, không DB, không máy chủ.
// Chạy HAI lần, kết quả phải giống hệt (ngày giờ VN không được phụ thuộc TZ máy):
//   source tools/local-e2e/env.sh && TZ=UTC npx tsx tools/local-e2e/t-nhac-hoc-lib.ts
//   source tools/local-e2e/env.sh && TZ=America/Los_Angeles npx tsx tools/local-e2e/t-nhac-hoc-lib.ts
// (`NHAC_LIB=<đường dẫn tuyệt đối tới bản sao nhacHoc.ts>` để chạy bài trên một bản sao đã bẻ — dùng cho ca phá, src/ không bị sửa.)
//
// CA PHÁ CỐ Ý (người viết đã thử từng ca trên một BẢN SAO của nhacHoc.ts, mỗi ca làm bài ĐỎ, rồi bỏ bản sao):
//   (1) nhacItemOf tính dueDate/dueTime bằng getFullYear/getMonth/getDate/getHours (giờ máy) thay cho cộng 7 giờ ⇒ ca "00:15 VN 12/11" đỏ dưới TZ=UTC.
//   (2) isOverdue của mục CHỈ NGÀY tính `dueAt < now`                                                       ⇒ ca "23:30 VN, mục chỉ ngày 11/11 không quá hạn" đỏ.
//   (3) cleanTags bỏ khử trùng sau chuẩn hoá                                                                  ⇒ ca "#Toán + toán (NFD) ⇒ một thẻ" đỏ.
//   (4) giới hạn tiêu đề `>` thành `>=` (tức `<` thành `<=` ở 200)                                            ⇒ ca "200 ký tự được" đỏ.
//   (5) noteSegments cho `javascript:` thành link                                                             ⇒ ca "javascript:alert(1) là chữ" đỏ.
//   (6) cleanNhacPatch chấp nhận done: "true"                                                                 ⇒ ca 'done: "true" bị từ chối' đỏ.
import { pathToFileURL } from "node:url";
import { check, section, done } from "./h";
import type * as NhacLib from "@/lib/nhacHoc";
import type { NhacItem } from "@/lib/nhacHoc";
import { addDaysKey, instantOf } from "@/lib/classSessions";

(async () => {
const L: typeof NhacLib = process.env.NHAC_LIB ? await import(pathToFileURL(process.env.NHAC_LIB).href) : await import("@/lib/nhacHoc");
const {
  normalizeTag, cleanTags, splitQuickTitle, cleanNhacCreate, cleanNhacPatch, dueOf, mergeDue, isOverdue, chiaNhom, locTheoThe, demThe, dueLabel,
  noteSegments, studyTodayText, reminderDueText, nhacItemOf, NHAC_NHOM_KEYS, NHAC_NHOM_LABEL, NHAC_HREF,
  NHAC_TITLE_MAX, NHAC_NOTE_MAX, NHAC_TAGS_MAX, NHAC_TAG_LEN_MAX, NHAC_PAST_DAYS, NHAC_FUTURE_DAYS,
} = L;

console.log(`TZ=${process.env.TZ ?? "(máy)"} · getTimezoneOffset=${new Date("2026-11-11T12:00:00Z").getTimezoneOffset()}`);
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const ids = (xs: NhacItem[]) => xs.map(x => x.id);

// Mục dựng qua nhacItemOf (như máy chủ) ⇒ dueDate/dueTime do THƯ VIỆN tính — bắt được lỗi múi giờ.
const CREATED = new Date("2026-11-01T00:00:00Z");
const mk = (id: string, o: { dueAt?: string | null; hasTime?: boolean; doneAt?: string | null; createdAt?: string; tags?: string[] } = {}): NhacItem =>
  nhacItemOf({
    id, title: `Mục ${id}`, note: null, tags: o.tags ?? [],
    dueAt: o.dueAt ? new Date(o.dueAt) : null, dueHasTime: o.hasTime ?? false,
    doneAt: o.doneAt ? new Date(o.doneAt) : null, createdAt: o.createdAt ? new Date(o.createdAt) : CREATED,
  }, null);

// ── Nhóm / quá hạn theo giờ VN ─────────────────────────────────────────────────
const N2330 = new Date("2026-11-11T16:30:00Z"); // 23:30 VN 11/11
const N0030 = new Date("2026-11-11T17:30:00Z"); // 00:30 VN 12/11 (vẫn 11/11 theo UTC)
const dOnly11 = mk("b-chi-ngay-11", { dueAt: "2026-11-10T17:00:00Z" });               // 11/11, không giờ (00:00 VN)
const t2300 = mk("c-2300", { dueAt: "2026-11-11T16:00:00Z", hasTime: true });          // 23:00 VN 11/11
const t0015 = mk("a-0015", { dueAt: "2026-11-11T17:15:00Z", hasTime: true });          // 00:15 VN 12/11 (cùng ngày UTC với now)

section("nhacItemOf — ngày/giờ VN, không lộ trường thừa");
check("mục chỉ ngày 11/11: dueDate 2026-11-11, dueTime null, dueHasTime false", dOnly11.dueDate === "2026-11-11" && dOnly11.dueTime === null && dOnly11.dueHasTime === false, dOnly11);
check("mục 17:15Z: dueDate 2026-11-12 (ngày VN), dueTime 00:15", t0015.dueDate === "2026-11-12" && t0015.dueTime === "00:15", t0015);
check("mục 16:00Z: dueDate 2026-11-11, dueTime 23:00", t2300.dueDate === "2026-11-11" && t2300.dueTime === "23:00", t2300);
check("khoá đúng NhacItem (không userId/notifiedAt/courseId/lessonId)",
  eq(Object.keys(t0015).sort(), ["createdAt", "doneAt", "dueAt", "dueDate", "dueHasTime", "dueTime", "id", "lop", "note", "tags", "title"]), Object.keys(t0015));
check("không hẹn ⇒ dueAt/dueDate/dueTime null, dueHasTime false", (() => { const x = mk("z", { dueAt: null, hasTime: true }); return x.dueAt === null && x.dueDate === null && x.dueTime === null && x.dueHasTime === false; })());

section("23:30 VN ngày 11/11");
{
  const g = chiaNhom([t0015, dOnly11, t2300], N2330);
  check("mục chỉ ngày 11/11 ⇒ hom-nay", ids(g["hom-nay"]).includes(dOnly11.id), ids(g["hom-nay"]));
  check("mục chỉ ngày 11/11 KHÔNG quá hạn trong chính ngày đó", isOverdue(dOnly11, N2330) === false);
  check("mục 23:00 có giờ ⇒ hom-nay + quá hạn", ids(g["hom-nay"]).includes(t2300.id) && isOverdue(t2300, N2330) === true);
  check("mục 00:15 VN 12/11 ⇒ da-hen (không phải hom-nay)", ids(g["da-hen"]).includes(t0015.id) && !ids(g["hom-nay"]).includes(t0015.id), g);
  check('dueLabel mục 00:15 = "Ngày mai · 00:15"', dueLabel(t0015, N2330) === "Ngày mai · 00:15", dueLabel(t0015, N2330));
  check('dueLabel mục chỉ ngày = "Hôm nay"', dueLabel(dOnly11, N2330) === "Hôm nay", dueLabel(dOnly11, N2330));
  check('dueLabel mục 23:00 = "Quá hạn · Hôm nay · 23:00"', dueLabel(t2300, N2330) === "Quá hạn · Hôm nay · 23:00", dueLabel(t2300, N2330));
  check("thứ tự hom-nay: quá hạn lên đầu (23:00) rồi mục chỉ ngày", eq(ids(g["hom-nay"]), [t2300.id, dOnly11.id]), ids(g["hom-nay"]));
}

section("00:30 VN ngày 12/11 (vẫn 11/11 theo UTC)");
{
  const g = chiaNhom([t0015, dOnly11, t2300], N0030);
  check("mục chỉ ngày 11/11 ⇒ hom-nay + quá hạn", ids(g["hom-nay"]).includes(dOnly11.id) && isOverdue(dOnly11, N0030) === true);
  check('dueLabel = "Quá hạn · T4, 11/11"', dueLabel(dOnly11, N0030) === "Quá hạn · T4, 11/11", dueLabel(dOnly11, N0030));
  check("mục 00:15 ⇒ hom-nay + quá hạn", ids(g["hom-nay"]).includes(t0015.id) && isOverdue(t0015, N0030) === true, g);
  check('dueLabel mục 00:15 = "Quá hạn · Hôm nay · 00:15"', dueLabel(t0015, N0030) === "Quá hạn · Hôm nay · 00:15", dueLabel(t0015, N0030));
  check("da-hen rỗng", g["da-hen"].length === 0, ids(g["da-hen"]));
  check("hom-nay theo dueAt khi cùng quá hạn: chỉ-ngày 11/11 → 23:00 → 00:15", eq(ids(g["hom-nay"]), [dOnly11.id, t2300.id, t0015.id]), ids(g["hom-nay"]));
}

section("Đã xong, hoà, mảng gốc, tat-ca / da-xong");
{
  const doneOld = mk("d-xong", { dueAt: "2026-11-01T01:00:00Z", hasTime: true, doneAt: "2026-11-10T03:00:00Z" });
  const doneNew = mk("e-xong", { dueAt: null, doneAt: "2026-11-11T03:00:00Z" });
  check("đã xong (hạn đã qua) KHÔNG BAO GIỜ quá hạn", isOverdue(doneOld, N0030) === false && isOverdue(doneOld, new Date("2030-01-01T00:00:00Z")) === false);
  check('dueLabel mục đã xong không có "Quá hạn"', !dueLabel(doneOld, N0030).startsWith("Quá hạn"), dueLabel(doneOld, N0030));
  const s1 = mk("tie-b", { dueAt: "2026-11-13T12:00:00Z", hasTime: true });
  const s2 = mk("tie-a", { dueAt: "2026-11-13T12:00:00Z", hasTime: true });
  const u1 = mk("u-cu", { dueAt: null, createdAt: "2026-11-02T00:00:00Z" });
  const u2 = mk("u-moi", { dueAt: null, createdAt: "2026-11-05T00:00:00Z" });
  const input = [s1, doneOld, u1, dOnly11, s2, doneNew, u2, t0015];
  const before = JSON.stringify(input);
  const g = chiaNhom(input, N2330);
  check("mảng gốc không đổi (thứ tự + nội dung)", JSON.stringify(input) === before);
  check("đã xong chỉ ở da-xong", !ids(g["hom-nay"]).includes("d-xong") && !ids(g["da-hen"]).includes("d-xong") && !ids(g["tat-ca"]).includes("d-xong"));
  check("da-hen: theo dueAt, hoà theo id (tie-a trước tie-b)", eq(ids(g["da-hen"]), [t0015.id, "tie-a", "tie-b"]), ids(g["da-hen"]));
  check("tat-ca: có ngày theo dueAt, rồi không ngày mới → cũ", eq(ids(g["tat-ca"]), [dOnly11.id, t0015.id, "tie-a", "tie-b", "u-moi", "u-cu"]), ids(g["tat-ca"]));
  check("da-xong: doneAt mới → cũ", eq(ids(g["da-xong"]), ["e-xong", "d-xong"]), ids(g["da-xong"]));
  check("NHAC_NHOM_KEYS + nhãn", eq(NHAC_NHOM_KEYS, ["hom-nay", "da-hen", "tat-ca", "da-xong"]) && NHAC_NHOM_KEYS.map(k => NHAC_NHOM_LABEL[k]).join(" · ") === "Hôm nay · Đã hẹn · Tất cả · Đã xong");
  check("NHAC_HREF", NHAC_HREF === "/student/nhac-hoc");
}

section("Thẻ");
{
  const NFD = "toán";
  check('normalizeTag("#Toán") = "toán"', normalizeTag("#Toán") === "toán", normalizeTag("#Toán"));
  check("normalizeTag(toán NFD) = toán NFC (cùng chuỗi)", normalizeTag(NFD) === "toán" && normalizeTag(NFD) === normalizeTag("#Toán"));
  const ct = cleanTags(["#Toán", NFD]);
  check('cleanTags(["#Toán", toán NFD]) ⇒ MỘT thẻ "toán"', ct.ok && eq(ct.value, ["toán"]), ct);
  check('"#" trơn ⇒ null; cleanTags(["#"]) lỗi', normalizeTag("#") === null && !cleanTags(["#"]).ok);
  for (const bad of ["<b>", "😀", "a b", "toán!", "", "   "]) check(`thẻ ${JSON.stringify(bad)} ⇒ null + cleanTags lỗi`, normalizeTag(bad) === null && !cleanTags([bad]).ok);
  const loiThe = cleanTags(["<b>x</b>"]);
  check("chữ lỗi không nhắc lại mã HTML thô", !loiThe.ok && !loiThe.error.includes("<b>"), loiThe);
  check(`${NHAC_TAG_LEN_MAX} ký tự được, ${NHAC_TAG_LEN_MAX + 1} lỗi`, normalizeTag("a".repeat(30)) === "a".repeat(30) && normalizeTag("a".repeat(31)) === null && !cleanTags(["a".repeat(31)]).ok);
  const ten = Array.from({ length: 10 }, (_, i) => `the${i}`);
  check(`${NHAC_TAGS_MAX} thẻ được, 11 lỗi`, cleanTags(ten).ok && !cleanTags([...ten, "the10"]).ok);
  check("thẻ trùng không tính vào giới hạn (11 phần tử, 10 thẻ khác nhau)", cleanTags([...ten, "THE0"]).ok);
  check("cleanTags(undefined|null) ⇒ []; không phải mảng ⇒ lỗi; phần tử số ⇒ lỗi", eq(cleanTags(undefined), { ok: true, value: [] }) && eq(cleanTags(null), { ok: true, value: [] }) && !cleanTags("toan").ok && !cleanTags([1]).ok);
  check('gạch nối, gạch dưới, số: "#on-thi", "lop_9", "#3"', normalizeTag("#on-thi") === "on-thi" && normalizeTag("lop_9") === "lop_9" && normalizeTag("#3") === "3");

  check('splitQuickTitle("Ôn chương 2 #toan #on-thi")', eq(splitQuickTitle("Ôn chương 2 #toan #on-thi"), { title: "Ôn chương 2", tags: ["toan", "on-thi"] }), splitQuickTitle("Ôn chương 2 #toan #on-thi"));
  check('splitQuickTitle("#toan") ⇒ title rỗng', eq(splitQuickTitle("#toan"), { title: "", tags: ["toan"] }));
  const c0 = cleanNhacCreate({ title: "#toan" }, "2026-11-11");
  check('cleanNhacCreate({title:"#toan"}) ⇒ lỗi "Chưa có tiêu đề."', !c0.ok && c0.error === "Chưa có tiêu đề.", c0);
  check('Q7: "Bài #3" ⇒ thẻ "3"; "#" giữa từ không là thẻ', eq(splitQuickTitle("Bài #3"), { title: "Bài", tags: ["3"] }) && eq(splitQuickTitle("C#ngon"), { title: "C#ngon", tags: [] }));
  check('cụm "#" hỏng giữ lại trong tiêu đề: "Hỏi # gì #<b>"', eq(splitQuickTitle("Hỏi # gì #<b>"), { title: "Hỏi # gì #<b>", tags: [] }));
  const c1 = cleanNhacCreate({ title: "Ôn #toan", tags: ["TOAN", "van"] }, "2026-11-11");
  check("cleanNhacCreate gộp thẻ trong tiêu đề với body.tags, khử trùng", c1.ok && c1.value.title === "Ôn" && eq(c1.value.tags, ["toan", "van"]), c1);

  const items = [mk("t1", { tags: ["toán", "on-thi"] }), mk("t2", { tags: ["toán"] }), mk("t3", { tags: ["văn"] }), mk("t4", { tags: ["anh"] })];
  check("locTheoThe chuẩn hoá thẻ lọc (#Toán)", eq(ids(locTheoThe(items, "#Toán")), ["t1", "t2"]));
  check("locTheoThe(null) ⇒ bản sao đủ mục", locTheoThe(items, null).length === 4 && locTheoThe(items, null) !== items);
  check("demThe: nhiều → ít, hoà theo chữ (vi)", eq(demThe(items), [{ tag: "toán", count: 2 }, { tag: "anh", count: 1 }, { tag: "on-thi", count: 1 }, { tag: "văn", count: 1 }]), demThe(items));
}

section("Giới hạn biên (tạo / sửa)");
{
  const TODAY = "2026-11-11";
  check(`tiêu đề ${NHAC_TITLE_MAX} ký tự được`, cleanNhacCreate({ title: "a".repeat(200) }, TODAY).ok && cleanNhacPatch({ title: "a".repeat(200) }, TODAY).ok);
  check(`tiêu đề ${NHAC_TITLE_MAX + 1} ký tự lỗi`, !cleanNhacCreate({ title: "a".repeat(201) }, TODAY).ok && !cleanNhacPatch({ title: "a".repeat(201) }, TODAY).ok);
  check("tiêu đề tiếng Việt 200 ký tự (NFD đầu vào) vẫn được", cleanNhacCreate({ title: "ố".normalize("NFD").repeat(200) }, TODAY).ok);
  check(`ghi chú ${NHAC_NOTE_MAX} được, ${NHAC_NOTE_MAX + 1} lỗi`, cleanNhacCreate({ title: "x", note: "n".repeat(4000) }, TODAY).ok && !cleanNhacCreate({ title: "x", note: "n".repeat(4001) }, TODAY).ok && !cleanNhacPatch({ note: "n".repeat(4001) }, TODAY).ok);
  const nn = cleanNhacCreate({ title: "x", note: "dòng 1\r\n\r\n\r\n\r\ndòng 2\u0007" }, TODAY);
  check("ghi chú giữ đổi dòng, gộp ≥3 dòng trống, bỏ ký tự điều khiển", nn.ok && nn.value.note === "dòng 1\n\ndòng 2", nn);
  const tt = cleanNhacCreate({ title: "  Ôn\nbài\u0000 cũ  " }, TODAY);
  check("tiêu đề một dòng", tt.ok && tt.value.title === "Ôn bài cũ", tt);
  check("dueTime không dueDate ⇒ lỗi (tạo)", !cleanNhacCreate({ title: "x", dueTime: "19:30" }, TODAY).ok);
  check("dueDate null + dueTime ⇒ lỗi (sửa)", !cleanNhacPatch({ dueDate: null, dueTime: "19:30" }, TODAY).ok);
  check("31/02 lỗi", !cleanNhacCreate({ title: "x", dueDate: "2026-02-31" }, TODAY).ok && !cleanNhacPatch({ dueDate: "2026-02-31" }, TODAY).ok);
  check("giờ 25:00 lỗi; ngày sai dạng lỗi", !cleanNhacCreate({ title: "x", dueDate: TODAY, dueTime: "25:00" }, TODAY).ok && !cleanNhacCreate({ title: "x", dueDate: "11/11/2026" }, TODAY).ok);
  check(`lùi ${NHAC_PAST_DAYS} ngày được, ${NHAC_PAST_DAYS + 1} lỗi`, cleanNhacCreate({ title: "x", dueDate: addDaysKey(TODAY, -366) }, TODAY).ok && !cleanNhacCreate({ title: "x", dueDate: addDaysKey(TODAY, -367) }, TODAY).ok);
  check(`tới ${NHAC_FUTURE_DAYS} ngày được, ${NHAC_FUTURE_DAYS + 1} lỗi`, cleanNhacCreate({ title: "x", dueDate: addDaysKey(TODAY, 731) }, TODAY).ok && !cleanNhacCreate({ title: "x", dueDate: addDaysKey(TODAY, 732) }, TODAY).ok && !cleanNhacPatch({ dueDate: addDaysKey(TODAY, 732) }, TODAY).ok);
  const dt = cleanNhacPatch({ done: "true" }, TODAY);
  check('done: "true" bị từ chối', !dt.ok, dt);
  check("done: 1 bị từ chối; done: true / false được", !cleanNhacPatch({ done: 1 }, TODAY).ok && eq(cleanNhacPatch({ done: true }, TODAY), { ok: true, value: { done: true } }) && eq(cleanNhacPatch({ done: false }, TODAY), { ok: true, value: { done: false } }));
  check("patch rỗng lỗi; patch chỉ có khoá lạ lỗi", !cleanNhacPatch({}, TODAY).ok && !cleanNhacPatch({ doneAt: "2026-11-11T00:00:00Z" }, TODAY).ok);
  check("thân không phải object ⇒ lỗi", !cleanNhacCreate(null, TODAY).ok && !cleanNhacCreate([], TODAY).ok && !cleanNhacCreate("x", TODAY).ok && !cleanNhacPatch([], TODAY).ok);
  const sneaky = { title: "x", doneAt: "2026-01-01T00:00:00Z", notifiedAt: "2026-01-01T00:00:00Z", userId: "u-khac", id: "id-khac" };
  const cs = cleanNhacCreate(sneaky, TODAY), ps = cleanNhacPatch(sneaky, TODAY);
  check("doneAt/notifiedAt/userId/id trong thân bị bỏ (tạo)", cs.ok && !("doneAt" in cs.value) && !("notifiedAt" in cs.value) && !("userId" in cs.value) && !("id" in cs.value), cs);
  check("doneAt/notifiedAt/userId/id trong thân bị bỏ (sửa)", ps.ok && eq(Object.keys(ps.value), ["title"]), ps);
  check("id gắn lớp sai dạng ⇒ cùng chữ lỗi gắn lớp", (() => { const r = cleanNhacCreate({ title: "x", lessonId: "../../x" }, TODAY); return !r.ok && r.error === "Bài hoặc lớp này không thuộc lớp bạn đang học."; })());
  const cd = cleanNhacCreate({ title: "x", dueDate: TODAY, dueTime: "9:05" }, TODAY);
  check("tạo có ngày+giờ ⇒ dueAt đúng mốc VN, dueHasTime", cd.ok && cd.value.dueAt?.toISOString() === "2026-11-11T02:05:00.000Z" && cd.value.dueHasTime === true, cd);
  const cn = cleanNhacCreate({ title: "x", dueDate: TODAY }, TODAY);
  check("tạo chỉ ngày ⇒ 00:00 VN, dueHasTime false", cn.ok && cn.value.dueAt?.toISOString() === "2026-11-10T17:00:00.000Z" && cn.value.dueHasTime === false, cn);
  check("patch title KHÔNG tách #", eq(cleanNhacPatch({ title: "Bài #3" }, TODAY), { ok: true, value: { title: "Bài #3" } }));
}

section("dueOf / mergeDue");
{
  check("dueOf(11/11, null) = 00:00 VN, không giờ", eq(dueOf("2026-11-11", null), { dueAt: instantOf("2026-11-11", 0), dueHasTime: false }));
  check("dueOf(11/11, 19:30) = 12:30Z", dueOf("2026-11-11", "19:30").dueAt.toISOString() === "2026-11-11T12:30:00.000Z" && dueOf("2026-11-11", "19:30").dueHasTime);
  const cur = { dueAt: new Date("2026-11-11T08:00:00Z"), dueHasTime: true }; // 15:00 VN 11/11
  check("mergeDue không khoá ngày/giờ ⇒ không đổi", eq(mergeDue(cur, {}), { ok: true, dueAt: cur.dueAt, dueHasTime: true, changed: false }));
  const m1 = mergeDue(cur, { dueDate: "2026-11-12" });
  check("đổi ngày, giữ giờ 15:00 ⇒ changed", m1.ok && m1.dueAt?.toISOString() === "2026-11-12T08:00:00.000Z" && m1.dueHasTime && m1.changed, m1);
  const m2 = mergeDue(cur, { dueTime: null });
  check("bỏ giờ, giữ ngày ⇒ 00:00 VN, changed", m2.ok && m2.dueAt?.toISOString() === "2026-11-10T17:00:00.000Z" && !m2.dueHasTime && m2.changed, m2);
  const m3 = mergeDue(cur, { dueDate: null });
  check("xoá ngày ⇒ bỏ cả giờ", m3.ok && m3.dueAt === null && !m3.dueHasTime && m3.changed, m3);
  const m4 = mergeDue(cur, { dueDate: "2026-11-11", dueTime: "15:00" });
  check("gửi lại đúng ngày giờ cũ ⇒ changed false", m4.ok && !m4.changed, m4);
  check("không ngày cũ + chỉ gửi giờ ⇒ lỗi", !mergeDue({ dueAt: null, dueHasTime: false }, { dueTime: "10:00" }).ok);
}

section("noteSegments");
{
  const s1 = noteSegments("Xem https://azota.vn/x). nhé");
  check("link không dính `).`", eq(s1, [{ kind: "text", text: "Xem " }, { kind: "link", href: "https://azota.vn/x", text: "https://azota.vn/x" }, { kind: "text", text: "). nhé" }]), s1);
  check("javascript:alert(1) là chữ", eq(noteSegments("javascript:alert(1)"), [{ kind: "text", text: "javascript:alert(1)" }]), noteSegments("javascript:alert(1)"));
  check("data:/mailto: là chữ", noteSegments("data:text/html,<b>x</b> mailto:a@b.vn").every(s => s.kind === "text"));
  check('"xhttps://..." (dính chữ trước) là chữ', noteSegments("xhttps://evil.vn").every(s => s.kind === "text"));
  const w = noteSegments("Đọc https://vi.wikipedia.org/wiki/Làng_(truyện_ngắn).");
  const wl = w.find(s => s.kind === "link");
  check('link wiki giữ ")" của chính nó, bỏ "." cuối', !!wl && wl.text === "https://vi.wikipedia.org/wiki/Làng_(truyện_ngắn)" && (w[w.length - 1] as { text: string }).text === ".", w);
  check("http:// cũng là link; nhiều đổi dòng giữ nguyên", eq(noteSegments("a\nhttp://x.vn\nb"), [{ kind: "text", text: "a\n" }, { kind: "link", href: "http://x.vn/", text: "http://x.vn" }, { kind: "text", text: "\nb" }]), noteSegments("a\nhttp://x.vn\nb"));
  check("null / rỗng ⇒ []", eq(noteSegments(null), []) && eq(noteSegments(""), []));
}

section("Chữ thông báo — chỉ số đếm");
{
  check("studyTodayText(2)", eq(studyTodayText(2), { title: "Hôm nay có lớp", message: "Hôm nay bạn có 2 buổi học. Mở Nhắc học để xem phiếu bài." }));
  check("reminderDueText(1)", eq(reminderDueText(1), { title: "Nhắc việc hôm nay", message: "Bạn có 1 nhắc việc đến hạn hôm nay." }));
  for (const n of [0, 100, -1, 2.5, NaN]) {
    check(`studyTodayText(${n}) / reminderDueText(${n}) ⇒ "nhiều", không chữ số`, /nhiều/.test(studyTodayText(n).message) && !/\d/.test(studyTodayText(n).message) && /nhiều/.test(reminderDueText(n).message) && !/\d/.test(reminderDueText(n).message));
  }
  check("99 vẫn là số", studyTodayText(99).message.includes(" 99 "));
  check("cả hai hàm nhận đúng MỘT tham số", studyTodayText.length === 1 && reminderDueText.length === 1);
  const evil = "Nguyễn Văn A <b>";
  const s = studyTodayText(evil as unknown as number), r = reminderDueText(evil as unknown as number);
  check("đưa chuỗi vào (vượt kiểu) ⇒ chữ không chứa chuỗi đó", !s.message.includes("Nguyễn") && !r.message.includes("Nguyễn") && !s.message.includes("<b>"), [s, r]);
}

await done();
})();
