// SCL-D (P2-6) — phần thuần src/lib/docPrivatize.ts ("Chuyển sang riêng tư"): chỉ nhận tệp cũ Cloudinary công khai (PHÁ CỐ Ý: máy giả mạo, http, có tài khoản/cổng,
// đường lạ), tên + đuôi tệp chép, đổi link trong JSON documents giữ tên/thứ tự, JSON hỏng không đổi gì. Không cần máy chủ.
import { docNameFor, isLegacyPublicDoc, privatizeName, replaceDocUrl } from "@/lib/docPrivatize";
import { check, section, done } from "./h";

const CU = "https://res.cloudinary.com/kin/raw/upload/v1/tai-lieu/de-cuong.pdf";
section("Chỉ tệp cũ Cloudinary công khai");
check("https://res.cloudinary.com/... ⇒ nhận", isLegacyPublicDoc(CU));
for (const [why, u] of [["máy giả mạo đuôi", "https://res.cloudinary.com.evil.example/x.pdf"], ["máy con khác", "https://evil.res.cloudinary.com/x.pdf"],
  ["http", "http://res.cloudinary.com/x.pdf"], ["có tài khoản", "https://a:b@res.cloudinary.com/x.pdf"], ["có cổng", "https://res.cloudinary.com:8443/x.pdf"],
  ["link KiN", "/api/media/abc12345/file"], ["Drive", "https://drive.google.com/file/d/abc/view"], ["không phải chuỗi", 42]] as const) {
  check(`PHÁ: ${why} ⇒ không nhận`, !isLegacyPublicDoc(u), u);
}

section("Tên + đuôi tệp chép");
check("tên có đuôi hợp lệ giữ nguyên", JSON.stringify(privatizeName("Đề cương.pdf", CU)) === JSON.stringify({ name: "Đề cương.pdf", ext: "pdf" }));
check("tên không đuôi ⇒ lấy đuôi từ đường dẫn", JSON.stringify(privatizeName("Đề cương", CU)) === JSON.stringify({ name: "Đề cương.pdf", ext: "pdf" }));
check("PHÁ: đuôi .exe / không đuôi ở cả hai ⇒ null", privatizeName("x.exe", "https://res.cloudinary.com/a/b/x.exe") === null && privatizeName("x", "https://res.cloudinary.com/a/b/x") === null);
check("ký tự điều khiển trong tên bị thay", !/[\u0000-\u001f]/.test(privatizeName("a\u0007b.pdf", CU)?.name ?? "\u0007"));

section("Đổi link trong JSON documents");
const raw = JSON.stringify([{ name: "A.pdf", url: CU, type: "pdf" }, { name: "B", url: "https://docs.google.com/document/d/x/edit", type: "doc" }, { name: "A bản 2", url: CU }]);
const r = replaceDocUrl(raw, CU, "/api/media/abc12345/file");
const out = JSON.parse(r.json);
check("đổi đúng 2 mục trỏ link cũ, giữ tên / loại / thứ tự", r.changed === 2 && out[0].url === "/api/media/abc12345/file" && out[0].name === "A.pdf" && out[0].type === "pdf" && out[1].url.includes("docs.google") && out[2].name === "A bản 2" && out[2].url === "/api/media/abc12345/file");
check("không có mục nào khớp ⇒ JSON giữ nguyên", replaceDocUrl(raw, "https://res.cloudinary.com/khac.pdf", "x").json === raw && replaceDocUrl(raw, "https://res.cloudinary.com/khac.pdf", "x").changed === 0);
check("PHÁ: JSON hỏng / không phải mảng / null ⇒ không đổi", replaceDocUrl("{hỏng", CU, "x").changed === 0 && replaceDocUrl('{"url":"x"}', "x", "y").changed === 0 && replaceDocUrl(null, CU, "x").json === "");
check("chuỗi con KHÔNG tính (link dài hơn chứa link cũ)", replaceDocUrl(JSON.stringify([{ name: "x", url: CU + "?v=2" }]), CU, "y").changed === 0);
check("docNameFor lấy tên mục đầu tiên", docNameFor(raw, CU) === "A.pdf" && docNameFor("hỏng", CU) === null);

done();
