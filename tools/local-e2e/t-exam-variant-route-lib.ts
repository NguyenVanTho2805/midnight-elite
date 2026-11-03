// BU-04 — định tuyến mã đề (src/lib/examVariantRoute.ts). Chạy: DATABASE_URL=postgresql://x:y@localhost:5432/z npx tsx tools/local-e2e/t-exam-variant-route-lib.ts
import { rootIdOf, normalizeMembers, memberIds, pickMember, variantCodeOf, isListedToStudent } from "@/lib/examVariantRoute";
import { pickVariantNo } from "@/lib/deThiVariantPick";
import { check, section, done } from "./h";

const group = (n: number) => [{ id: "root", variantNo: null as number | null }, ...Array.from({ length: n - 1 }, (_, i) => ({ id: `v${i + 2}`, variantNo: i + 2 as number | null }))];

section("rootIdOf");
check("mã con → id gốc; gốc / đề thường → chính nó", rootIdOf({ id: "v2", variantOfId: "root" }) === "root" && rootIdOf({ id: "root", variantOfId: null }) === "root");

section("normalizeMembers / memberIds");
const norm = normalizeMembers("root", [{ id: "v3", variantNo: 3 }, { id: "root", variantNo: null }, { id: "v2", variantNo: 2 }, { id: "v2", variantNo: 2 }]);
check("sắp theo variantNo, gốc = 1 dù cột còn null, bỏ trùng", norm.map(m => `${m.id}:${m.variantNo}`).join() === "root:1,v2:2,v3:3", norm);
check("thiếu cả gốc trong danh sách vẫn có gốc", memberIds("root", [{ id: "v2", variantNo: 2 }]).join() === "root,v2");
check("ca phá: mã con variantNo null không làm sập (xếp đầu, không mất)", memberIds("root", [{ id: "x", variantNo: null }]).length === 2);

section("pickMember — ổn định và phân tán");
const g3 = group(3);
const first = pickMember("root", "hs-1", g3);
check("cùng (gốc, học sinh, nhóm) → luôn cùng mã (100 lần)", Array.from({ length: 100 }, () => pickMember("root", "hs-1", g3).id).every(id => id === first.id));
check("mã chọn khớp pickVariantNo của BU-03", first.variantNo === pickVariantNo("root", "hs-1", 3));
const counts = new Map<number, number>();
for (let i = 0; i < 300; i++) { const m = pickMember("root", `hs-${i}`, g3); counts.set(m.variantNo, (counts.get(m.variantNo) ?? 0) + 1); }
check("300 học sinh phân tán cả 3 mã, mỗi mã ≥ 60", [1, 2, 3].every(n => (counts.get(n) ?? 0) >= 60), [...counts]);
check("n=1 (đề không chia mã) → chính đề gốc", pickMember("root", "hs-1", [{ id: "root", variantNo: null }]).id === "root" && pickMember("root", "hs-1", []).id === "root");
check("thứ tự danh sách đầu vào không đổi kết quả", pickMember("root", "hs-7", [...g3].reverse()).id === pickMember("root", "hs-7", g3).id);
check("khác gốc → có thể khác mã nhưng vẫn ổn định", pickMember("root2", "hs-1", [{ id: "root2", variantNo: 1 }, { id: "w2", variantNo: 2 }]).id === pickMember("root2", "hs-1", [{ id: "w2", variantNo: 2 }, { id: "root2", variantNo: 1 }]).id);
check("lượt sau cùng học sinh vẫn cùng mã (không có chuyện làm lại để gặp đề khác)", [1, 2, 3].map(() => pickMember("root", "hs-9", g3).id).every((x, _, a) => x === a[0]));

section("variantCodeOf");
check("nhóm >1: 101/102/103; nhóm 1 → null; số lạ → null", variantCodeOf(3, 1) === 101 && variantCodeOf(3, 3) === 103 && variantCodeOf(1, 1) === null && variantCodeOf(3, 0) === null && variantCodeOf(3, 1.5) === null);

section("isListedToStudent");
check("mã con không bao giờ được liệt kê", !isListedToStudent({ variantOfId: "root", courseId: "c1" }, null) && !isListedToStudent({ variantOfId: "root", courseId: null }, "admin_super"));
check("giao theo link (không lớp + chủ là gia sư) bị ẩn", !isListedToStudent({ variantOfId: null, courseId: null }, "teacher"));
check("thư viện chung của quản trị (không lớp, chủ không phải gia sư) hiện", isListedToStudent({ variantOfId: null, courseId: null }, "admin_super") && isListedToStudent({ variantOfId: null, courseId: null }, null));
check("đề gắn lớp: không có tập ghi danh → hiện; có tập → chỉ lớp đang học", isListedToStudent({ variantOfId: null, courseId: "c1" }, "teacher") && isListedToStudent({ variantOfId: null, courseId: "c1" }, "teacher", new Set(["c1"])) && !isListedToStudent({ variantOfId: null, courseId: "c2" }, "teacher", new Set(["c1"])));
check("tập ghi danh rỗng: đề lớp bị ẩn, đề thư viện vẫn hiện", !isListedToStudent({ variantOfId: null, courseId: "c1" }, "teacher", new Set()) && isListedToStudent({ variantOfId: null, courseId: null }, "admin_super", new Set()));
done();
