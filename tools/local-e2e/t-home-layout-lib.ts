// Trang chủ "/" — khối nào hiện cho ai, thanh trên có mục nào (BU-HS-TRANG-CHU mục 4.1). THUẦN: src/lib/homeLayout.ts. Không cần máy chủ.
//
// Ca phá (đổi gì trong mã thì ca nào phải đỏ):
//  - homeBlocksFor: đổi `kind === "student"` thành `kind === "student" || kind === "tutor-pending"` → "gia sư chờ duyệt không thấy Lớp của tôi" đỏ.
//  - toHomeViewer: bỏ nhánh `tutorPending` → "học sinh + tutorPending" đỏ. Cho adminRole lạ thành "admin" → "adminRole lạ → guest" đỏ.
//  - homeBlocksFor: cho `loading` hiện myClass hoặc ctaFinal → hai ca "loading" đỏ.
//  - homeNavFor: thêm mục lạ (Thư viện, Bảng xếp hạng, Ví) hoặc đưa "Lớp của tôi" lên đầu → ca danh sách đúng + "cuối cùng" đỏ.
import { toHomeViewer, homeBlocksFor, homeNavFor, type HomeViewer, type HomeFlags } from "@/lib/homeLayout";
import { FEATURES, type FeatureEnv } from "@/lib/features";
import { check, section, done } from "./h";

// LOI-01 (11/11/2026): bảng tin, tính điểm, mục Cộng đồng / Tin tức giờ phụ thuộc cờ src/lib/features.ts (mặc định ẨN). Các ca dưới đây kiểm hành vi KHI CÁC PHẦN ĐANG MỞ
// (truyền FE = cả 9 cờ =1) — giữ nguyên kỳ vọng cũ; khi tắt: phần "LOI-01" cuối tệp và t-features-lib.ts.
const FE: FeatureEnv = Object.fromEntries(FEATURES.map(k => [k, "1"])) as FeatureEnv;

const ON: HomeFlags = { quiz: true };
const OFF: HomeFlags = { quiz: false };
const KINDS: HomeViewer["kind"][] = ["loading", "guest", "student", "tutor-pending", "tutor", "admin"];
const V = (kind: HomeViewer["kind"]) => ({ kind }) as HomeViewer;

section("toHomeViewer — từ AuthContext ra người xem");
check("chưa có user + đang hỏi → loading", toHomeViewer(null, true).kind === "loading");
check("chưa có user + hỏi xong → guest", toHomeViewer(null, false).kind === "guest");
check("học sinh thường → student", toHomeViewer({ role: "student" }, false).kind === "student");
check("học sinh + tutorPending → tutor-pending", toHomeViewer({ role: "student", tutorPending: true }, false).kind === "tutor-pending");
check("tutorPending=false rõ ràng → vẫn student", toHomeViewer({ role: "student", tutorPending: false }, false).kind === "student");
check("admin teacher → tutor", toHomeViewer({ role: "admin", adminRole: "teacher" }, false).kind === "tutor");
check("admin_super → admin", toHomeViewer({ role: "admin", adminRole: "admin_super" }, false).kind === "admin");
check("admin_content → admin", toHomeViewer({ role: "admin", adminRole: "admin_content" }, false).kind === "admin");
check("đã có user thì không chờ nữa dù isLoading còn true (học sinh)", toHomeViewer({ role: "student" }, true).kind === "student");
check("role null → guest (đóng khi lạ)", toHomeViewer({ role: null }, false).kind === "guest");
check("admin + adminRole lạ → guest", toHomeViewer({ role: "admin", adminRole: "root" }, false).kind === "guest");
check("admin không có adminRole → guest", toHomeViewer({ role: "admin" }, false).kind === "guest" && toHomeViewer({ role: "admin", adminRole: null }, false).kind === "guest");
check("role lạ → guest", toHomeViewer({ role: "parent" }, false).kind === "guest");
check("role 'Student' viết hoa → guest (không đoán)", toHomeViewer({ role: "Student" }, false).kind === "guest");
check("tutorPending ở vai admin không đổi gì (chỉ học sinh mới có gia sư chờ duyệt)", toHomeViewer({ role: "admin", adminRole: "teacher", tutorPending: true }, false).kind === "tutor");
check("tutorPending dạng chuỗi 'true' không tính (chỉ true thật)", toHomeViewer({ role: "student", tutorPending: "true" as unknown as boolean }, false).kind === "student");

section("homeBlocksFor — khối theo vai");
for (const k of KINDS) check(`${k}: bảng tin và tính điểm luôn có`, homeBlocksFor(V(k), ON, FE).community === true && homeBlocksFor(V(k), ON, FE).score === true);
check("loading → không Lớp của tôi, không CTA cuối", homeBlocksFor(V("loading"), ON, FE).myClass === false && homeBlocksFor(V("loading"), ON, FE).ctaFinal === false);
check("guest → không Lớp của tôi, có CTA cuối", homeBlocksFor(V("guest"), ON, FE).myClass === false && homeBlocksFor(V("guest"), ON, FE).ctaFinal === true);
check("student → có Lớp của tôi, không CTA cuối", homeBlocksFor(V("student"), ON, FE).myClass === true && homeBlocksFor(V("student"), ON, FE).ctaFinal === false);
for (const k of ["tutor-pending", "tutor", "admin"] as const) check(`${k} → không Lớp của tôi, không CTA cuối`, homeBlocksFor(V(k), ON, FE).myClass === false && homeBlocksFor(V(k), ON, FE).ctaFinal === false);
check("gia sư chờ duyệt không thấy Lớp của tôi (ca khoá nhánh myClass)", homeBlocksFor(toHomeViewer({ role: "student", tutorPending: true }, false), ON, FE).myClass === false);
check("chỉ MỘT vai có Lớp của tôi: student", KINDS.filter(k => homeBlocksFor(V(k), ON, FE).myClass).join() === "student");
check("chỉ guest có CTA cuối", KINDS.filter(k => homeBlocksFor(V(k), ON, FE).ctaFinal).join() === "guest");
for (const k of KINDS) check(`${k}: quiz = cờ (bật → true, tắt → false, cùng giá trị mọi vai)`, homeBlocksFor(V(k), ON, FE).quiz === true && homeBlocksFor(V(k), OFF, FE).quiz === false);
check("mặc định của trang: KIN_HOME_QUIZ chưa đặt → khối quiz HIỆN (khung rỗng); chỉ '0' mới ẩn", ((e: string | undefined) => e !== "0")(undefined) === true && ((e: string | undefined) => e !== "0")("0") === false && ((e: string | undefined) => e !== "0")("1") === true);

section("homeNavFor — thanh trên");
const labels = (v: HomeViewer) => homeNavFor(v, FE).map(i => i.label).join("|");
const hrefs = (v: HomeViewer) => homeNavFor(v, FE).map(i => i.href).join("|");
for (const k of ["loading", "guest", "tutor-pending", "tutor", "admin"] as const) {
  check(`${k}: đúng 4 mục Lớp học|Thi thử|Cộng đồng|Tin tức`, labels(V(k)) === "Lớp học|Thi thử|Cộng đồng|Tin tức", labels(V(k)));
  check(`${k}: đích /khoa-hoc|/thi-thu|/cong-dong|/tin-tuc`, hrefs(V(k)) === "/khoa-hoc|/thi-thu|/cong-dong|/tin-tuc", hrefs(V(k)));
}
const sn = homeNavFor(V("student"), FE);
check("student: 5 mục, 'Lớp của tôi' ở cuối cùng, đích /student/hoc-tap", sn.length === 5 && sn[4].label === "Lớp của tôi" && sn[4].href === "/student/hoc-tap", sn);
check("student: 4 mục đầu giống người khác", sn.slice(0, 4).map(i => i.label).join("|") === "Lớp học|Thi thử|Cộng đồng|Tin tức");
check("không mục nào ngoài danh sách (không Thư viện, Bảng xếp hạng, Ví, Hỏi đáp)", KINDS.every(k => homeNavFor(V(k), FE).every(i => !/thư viện|xếp hạng|ví|coin|hỏi đáp|điểm chuẩn/i.test(i.label) && !/thu-vien|bang-xep-hang|\/vi\b|hoi-dap|diem-chuan/.test(i.href))));
check("mọi đích bắt đầu bằng '/' và không có nhãn rỗng", KINDS.every(k => homeNavFor(V(k), FE).every(i => i.href.startsWith("/") && i.label.trim().length > 0)));
check("mỗi lần gọi trả mảng mới (sửa kết quả không làm hỏng lần sau)", ((): boolean => { const a = homeNavFor(V("guest"), FE); a.push({ label: "x", href: "/x" }); return homeNavFor(V("guest"), FE).length === 4; })());

section("Ca phá — đầu vào rác không ném lỗi, không mở khối dành riêng");
const junk = [undefined, null, {}, { kind: "" }, { kind: "STUDENT" }, { kind: "student " }, { kind: 1 }, "student"] as unknown as HomeViewer[];
for (const j of junk) {
  let threw = false, b = null as ReturnType<typeof homeBlocksFor> | null, n = 0;
  try { b = homeBlocksFor(j, ON, FE); n = homeNavFor(j, FE).length; } catch { threw = true; }
  check(`homeBlocksFor/homeNavFor(${JSON.stringify(j) ?? "undefined"}, FE) không ném lỗi, không Lớp của tôi, nav 4 mục`, !threw && b?.myClass === false && n === 4, { threw, b, n });
}
let threw = false, fb = null as ReturnType<typeof homeBlocksFor> | null;
try { fb = homeBlocksFor(V("student"), undefined as unknown as HomeFlags, FE); } catch { threw = true; }
check("cờ thiếu (undefined) → không ném lỗi, quiz=false (đóng khi thiếu)", !threw && fb?.quiz === false);
check("toHomeViewer(undefined) không ném lỗi", toHomeViewer(undefined, false).kind === "guest" && toHomeViewer(undefined, true).kind === "loading");
check("toHomeViewer với giá trị không phải object → guest", toHomeViewer("student" as unknown as null, false).kind === "guest");

void section("LOI-01 — các phần đang ẩn (không cờ nào)");
for (const k of KINDS) check(`${k}: ẩn bảng tin, quiz và tính điểm khi Cộng đồng / Điểm chuẩn tắt`, !homeBlocksFor(V(k), ON, {}).community && !homeBlocksFor(V(k), ON, {}).quiz && !homeBlocksFor(V(k), ON, {}).score);
for (const k of KINDS) check(`${k}: thanh trên không có Cộng đồng, Tin tức`, homeNavFor(V(k), {}).every(i => i.href !== "/cong-dong" && i.href !== "/tin-tuc") && homeNavFor(V(k), {}).slice(0, 2).map(i => i.label).join("|") === "Lớp học|Thi thử");

done();
