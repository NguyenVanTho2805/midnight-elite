// NC2-046 — src/lib/librarySearch.ts: tìm trong kho. PHÁ CỐ Ý: gõ không dấu / sai hoa thường / có dấu câu, từ khoá thiếu (VÀ), 1 chữ cái, truy vấn quá ngắn,
// xếp hạng (tiêu đề > chủ đề phụ, đầu từ > giữa từ, cả cụm liền nhau), đ/Đ, chữ tổ hợp, giới hạn số từ khoá, kiểu dữ liệu sai.
import { fold, queryTokens, scoreFields, searchRank, MAX_TOKENS, QUERY_MAX } from "@/lib/librarySearch";
import { check, section, done } from "./h";

section("fold");
check("bỏ dấu + hạ chữ thường: 'Chiến Tranh Lạnh' → 'chien tranh lanh'", fold("Chiến Tranh Lạnh") === "chien tranh lanh");
check("đ / Đ → d: 'Đại học Đông Á' → 'dai hoc dong a'", fold("Đại học Đông Á") === "dai hoc dong a");
check("dấu câu / ký tự lạ thành dấu cách và gộp: 'Sử-12 (nâng cao)!' → 'su 12 nang cao'", fold("Sử-12 (nâng cao)!") === "su 12 nang cao");
check("chữ dạng tổ hợp (NFD) cho cùng kết quả với dạng dựng sẵn", fold("Chiến tranh lạnh".normalize("NFD")) === fold("Chiến tranh lạnh".normalize("NFC")));
check("không phải chữ → rỗng", fold(5) === "" && fold(null) === "" && fold(undefined) === "" && fold({}) === "");
check("toàn ký tự lạ → rỗng", fold("!!! ???") === "" && fold("\u200b") === "");

section("Từ khoá");
check("'chiến tranh lạnh' → 3 từ khoá không dấu", JSON.stringify(queryTokens("chiến tranh lạnh")) === '["chien","tranh","lanh"]');
check("bỏ trùng: 'sử sử 12 sử' → ['su','12']", JSON.stringify(queryTokens("sử sử 12 sử")) === '["su","12"]');
check("bỏ từ 1 chữ cái ('a b chiến') nhưng giữ chữ số ('9 điểm')", JSON.stringify(queryTokens("a b chiến")) === '["chien"]' && JSON.stringify(queryTokens("9 điểm")) === '["9","diem"]');
check("truy vấn quá ngắn / rỗng / toàn dấu câu / không phải chữ → []", queryTokens("").length === 0 && queryTokens("a").length === 0 && queryTokens("  ").length === 0 && queryTokens("!!").length === 0 && queryTokens(5).length === 0 && queryTokens(null).length === 0);
check("đúng 2 ký tự ('Sử') → nhận", JSON.stringify(queryTokens("Sử")) === '["su"]');
check(`tối đa ${MAX_TOKENS} từ khoá`, queryTokens(Array.from({ length: 30 }, (_, i) => `tu${i}`).join(" ")).length === MAX_TOKENS);
check(`truy vấn rất dài (> ${QUERY_MAX} ký tự) không làm treo / nổ`, queryTokens("chiến ".repeat(5000)).length >= 1);

section("Chấm điểm");
const F = (t: string, w = 1) => ({ text: t, weight: w });
check("không phải mọi từ khoá đều có → 0 (VÀ)", scoreFields(["chien", "tranh", "nong"], [F("Chiến tranh lạnh")]) === 0);
check("mọi từ khoá nằm ở các trường KHÁC nhau → vẫn khớp", scoreFields(["chien", "tranh", "su"], [F("Chiến tranh lạnh"), F("Sử 12")]) > 0);
check("không có từ khoá → 0", scoreFields([], [F("abc")]) === 0);
check("trùng đầu từ điểm cao hơn trùng giữa từ", scoreFields(["tranh"], [F("chiến tranh")]) > scoreFields(["anh"], [F("chiến tranh")]));
check("trùng ở trường trọng số cao (tiêu đề) cao hơn trường thấp", scoreFields(["lanh"], [F("lạnh", 3)]) > scoreFields(["lanh"], [F("lạnh", 1)]));
check("cả cụm liền nhau được cộng thêm so với từ khoá rải rác", scoreFields(["chien", "tranh"], [F("chiến tranh lạnh")]) > scoreFields(["chien", "tranh"], [F("chiến sự và tranh chấp")]));
check("khớp không phân biệt dấu: 'chien tranh' khớp 'Chiến tranh'", scoreFields(["chien", "tranh"], [F("Chiến tranh Việt Nam")]) > 0);
check("trường rỗng / không có chữ không gây lỗi", scoreFields(["abc"], [F(""), F("   ")]) === 0);

section("Xếp hạng");
type Item = { id: number; title: string; topic: string };
const items: Item[] = [
  { id: 1, title: "Tổng quan Lịch sử thế giới", topic: "chiến tranh lạnh" },
  { id: 2, title: "Chiến tranh lạnh 1947–1991", topic: "" },
  { id: 3, title: "Chiến tranh Việt Nam", topic: "" },
  { id: 4, title: "Địa lí 12", topic: "" },
  { id: 5, title: "Hậu quả chiến tranh lạnh", topic: "" },
];
const fieldsOf = (i: Item) => [F(i.title, 3), F(i.topic, 2)];
let res = searchRank(items, "chien tranh lanh", fieldsOf);
check("gõ không dấu 'chien tranh lanh': ra 3 mục (2, 5, 1), không ra 'Chiến tranh Việt Nam' (thiếu 'lạnh') và 'Địa lí'", JSON.stringify(res.map(r => r.item.id).sort()) === "[1,2,5]", res.map(r => r.item.id));
check("mục có cụm trong TIÊU ĐỀ đứng trước mục chỉ có ở chủ đề", res.findIndex(r => r.item.id === 2) < res.findIndex(r => r.item.id === 1), res.map(r => r.item.id));
check("cùng điểm giữ thứ tự gốc (ổn định): 2 trước 5 hay 5 trước 2 theo vị trí ban đầu khi điểm bằng nhau", (() => { const a = searchRank([{ id: 1, title: "abc", topic: "" }, { id: 2, title: "abc", topic: "" }], "abc", fieldsOf); return a[0].item.id === 1 && a[1].item.id === 2; })());
check("giới hạn số kết quả", searchRank(items, "chien", fieldsOf, 2).length === 2);
check("truy vấn rỗng / quá ngắn → không có kết quả (không trả cả kho)", searchRank(items, "", fieldsOf).length === 0 && searchRank(items, "a", fieldsOf).length === 0 && searchRank(items, 5, fieldsOf).length === 0);
check("không khớp gì → []", searchRank(items, "xyzabc", fieldsOf).length === 0);
check("không sửa mảng gốc", items[0].id === 1 && items.length === 5);

done();
