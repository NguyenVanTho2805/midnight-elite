// NC2-046 — src/lib/libraryKho.ts (kho công khai) + src/lib/libraryOwn.ts (tài liệu lớp mình): tìm không dấu, xếp hạng, giới hạn, KHÔNG rò dữ liệu ngoài những gì được đưa vào.
import { searchKho, KHO_MAX_DOCS, KHO_MAX_VIDEOS, type KhoDoc, type KhoVideo } from "@/lib/libraryKho";
import { ownItemsOf, searchOwn, OWN_MAX } from "@/lib/libraryOwn";
import type { LibClass } from "@/lib/libraryServer";
import { check, section, done } from "./h";

const docs: KhoDoc[] = [
  { name: "Chiến tranh lạnh - tóm tắt.pdf", url: "https://files.example/ctl.pdf", type: "pdf", courseName: "Sử 12", lessonTitle: "Bài 5 Thế giới sau 1945" },
  { name: "Đề cương Địa lí.pdf", url: "https://files.example/dia.pdf", type: "pdf", courseName: "Địa 12", lessonTitle: "Bài 1" },
  { name: "Sơ đồ", url: "https://docs.google.com/document/d/abc/edit", type: "", courseName: "Sử 12", lessonTitle: "Chiến tranh lạnh và trật tự hai cực" },
];
const videos: KhoVideo[] = [
  { id: "v1", title: "Chiến tranh lạnh 1947–1991", videoId: "dQw4w9WgXcQ", topics: ["Lịch sử 12", "Thế giới"], channel: "Thầy A", note: "" },
  { id: "v2", title: "Tổng ôn Sử 12", videoId: "abcdefghijk", topics: ["Chiến tranh lạnh", "Ôn thi"], channel: "", note: "Phút 3" },
  { id: "v3", title: "Địa lí khí hậu", videoId: "lmnopqrstuv", topics: ["Địa 12"], channel: "", note: "" },
];

section("Kho công khai");
let r = searchKho(docs, videos, "chien tranh lanh");
check("gõ KHÔNG dấu 'chien tranh lanh' → 2 tài liệu (tên tệp, và tên bài) + 2 video (tiêu đề, và chủ đề)", r.docs.length === 2 && r.videos.length === 2, r);
check("video có cụm trong TIÊU ĐỀ (v1) xếp trước video chỉ có ở chủ đề (v2)", r.videos[0].id === "v1" && r.videos[1].id === "v2", r.videos.map(v => v.id));
check("tài liệu có cụm trong TÊN TỆP xếp trước tài liệu chỉ có ở tên bài", r.docs[0].name.startsWith("Chiến tranh lạnh") && r.docs[1].name === "Sơ đồ", r.docs.map(d => d.name));
check("không có kết quả cho tài liệu / video không liên quan (Địa lí)", !r.docs.some(d => /Địa/.test(d.name)) && !r.videos.some(v => v.id === "v3"));
r = searchKho(docs, videos, "CHIẾN TRANH LẠNH");
check("gõ HOA có dấu cho cùng kết quả", r.docs.length === 2 && r.videos.length === 2);
r = searchKho(docs, videos, "địa");
check("'địa' → 'Địa 12' (khoá), 'Địa lí' (tên tệp / tiêu đề video)", r.docs.some(d => /Địa/.test(d.name)) && r.videos.some(v => v.id === "v3"), r);
check("mọi từ khoá phải có (VÀ): 'chien tranh nong' → không có gì", (() => { const x = searchKho(docs, videos, "chien tranh nong"); return x.docs.length === 0 && x.videos.length === 0; })());
check("truy vấn rỗng / 1 ký tự / không phải chữ → không trả cả kho", [ "", "a", "  ", null, 5, undefined ].every(q => { const x = searchKho(docs, videos, q); return x.docs.length === 0 && x.videos.length === 0; }));

section("Dạng trả về (DTO)");
r = searchKho(docs, videos, "chien tranh lanh");
check("tài liệu: có tên, loại (PDF / DOC), liên kết trang xem trước, tên khoá + bài; KHÔNG có đường dẫn gốc của tệp ở trường riêng", r.docs[0].kind === "PDF" && r.docs[1].kind === "DOC" && r.docs[0].href.startsWith("/xem-tai-lieu?url=") && !("url" in r.docs[0]), r.docs[0]);
check("video: link xem youtube.com dựng từ MÃ, ảnh nhỏ i.ytimg.com; KHÔNG lộ mã nội bộ nào ngoài id dòng", r.videos[0].url === "https://www.youtube.com/watch?v=dQw4w9WgXcQ" && r.videos[0].thumb === "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg" && !("videoId" in r.videos[0]), r.videos[0]);

section("Giới hạn số kết quả");
const many: KhoDoc[] = Array.from({ length: 80 }, (_, i) => ({ name: `Chiến tranh lạnh ${i}.pdf`, url: `https://files.example/${i}.pdf`, type: "pdf", courseName: "Sử", lessonTitle: "B" }));
const manyV: KhoVideo[] = Array.from({ length: 60 }, (_, i) => ({ id: `v${i}`, title: `Chiến tranh lạnh ${i}`, videoId: "dQw4w9WgXcQ", topics: [], channel: "", note: "" }));
r = searchKho(many, manyV, "chien tranh");
check(`tối đa ${KHO_MAX_DOCS} tài liệu và ${KHO_MAX_VIDEOS} video`, r.docs.length === KHO_MAX_DOCS && r.videos.length === KHO_MAX_VIDEOS, [r.docs.length, r.videos.length]);
check("không có dữ liệu → rỗng, không lỗi", (() => { const x = searchKho([], [], "chien tranh"); return x.docs.length === 0 && x.videos.length === 0; })());

section("Tài liệu lớp mình (học sinh)");
const classes: LibClass[] = [
  { id: "c1", name: "Sử 12 nâng cao", category: "su", emptyLessons: 0, lessons: [
    { id: "l1", title: "Bài 5 Chiến tranh lạnh", type: "record", where: "Phần 2 · Chương Thế giới", duration: null, hasVideo: true, watch: null, docs: [{ name: "Đề cương nội bộ.pdf", url: "https://files.example/noi-bo.pdf", type: "pdf" }], assignments: [] },
    { id: "l2", title: "Bài 6 Việt Nam sau 1975", type: "document", where: "Phần 2 · Chương Việt Nam", duration: null, hasVideo: false, watch: null, docs: [], assignments: [] },
  ] },
  { id: "c2", name: "Địa 12", category: "dia", emptyLessons: 0, lessons: [
    { id: "l3", title: "Bài 1 Khí hậu", type: "record", where: "Phần 1", duration: null, hasVideo: false, watch: null, docs: [{ name: "Chiến tranh lạnh và khí hậu.pdf", url: "https://files.example/x.pdf", type: "pdf" }], assignments: [] },
  ] },
];
const items = ownItemsOf(classes);
check("làm phẳng: 3 bài + 2 tài liệu = 5 mục; mục bài có chip VIDEO khi có bản ghi, BÀI khi không", items.length === 5 && items.find(i => i.key === "l1")?.chip === "VIDEO" && items.find(i => i.key === "l2")?.chip === "BÀI", items.map(i => `${i.key}:${i.chip}`));
check("bài mở ở /student/bai-giang/<id>; tài liệu mở ở trang xem trước", items.find(i => i.key === "l1")?.href === "/student/bai-giang/l1" && items.find(i => i.chip === "PDF")?.href.startsWith("/xem-tai-lieu?url="));
const mine = searchOwn(items, "chien tranh lanh");
check("'chien tranh lanh' → 3 mục: bài 5 (tiêu đề), tài liệu NẰM TRONG bài 5 (khớp theo tên bài), tài liệu 'Chiến tranh lạnh và khí hậu' (tên tệp); không ra bài 6 / bài 1", mine.length === 3 && mine.some(i => i.key === "l1") && mine.some(i => i.title === "Đề cương nội bộ.pdf") && mine.some(i => /khí hậu/.test(i.title)) && !mine.some(i => i.key === "l2" || i.key === "l3"), mine.map(i => i.title));
check("khớp ở TÊN (trọng số 3) xếp trước khớp chỉ theo tên bài chứa nó (2): 'Đề cương nội bộ' đứng cuối", mine[mine.length - 1].title === "Đề cương nội bộ.pdf", mine.map(i => i.title));
check("tìm theo TÊN LỚP: 'dia 12' ra các mục của lớp Địa 12", searchOwn(items, "dia 12").every(i => i.className === "Địa 12") && searchOwn(items, "dia 12").length >= 2);
check("không có lớp (học sinh chưa vào lớp) → không có kết quả, không lỗi", searchOwn(ownItemsOf([]), "chien tranh").length === 0);
check(`giới hạn ${OWN_MAX} mục`, (() => { const big: LibClass[] = [{ id: "c", name: "Lớp", category: null, emptyLessons: 0, lessons: Array.from({ length: 100 }, (_, i) => ({ id: `b${i}`, title: `Chiến tranh lạnh ${i}`, type: "record", where: "", duration: null, hasVideo: false, watch: null, docs: [], assignments: [] })) }]; return searchOwn(ownItemsOf(big), "chien tranh").length === OWN_MAX; })());
check("mục KHÔNG chứa trường nào ngoài ranh giới dữ liệu đã tải (không mã người dùng, không bài nộp)", items.every(i => Object.keys(i).sort().join() === "chip,className,href,key,lessonTitle,sub,title,where"), Object.keys(items[0]));

done();
