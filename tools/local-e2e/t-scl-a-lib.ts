// SCL-A — bài THUẦN (không máy chủ): canSeeClassExam, selfScoreError, boardRowFor (src/lib/examResultRules.ts), planClassFix (src/lib/classPrivacyFix.ts).
// Chạy: source tools/local-e2e/env.sh && npx tsx tools/local-e2e/t-scl-a-lib.ts
// CA PHÁ CỐ Ý (đã thử, mỗi lần một chỗ rồi trả lại):
//   - canSeeClassExam: đổi nhánh teacher thành `return true` → ca "gia sư lớp khác" đỏ.
//   - selfScoreError: bỏ `exam.isDraft` → ca "nháp" đỏ; so với 150 thay vì exam.totalPoints → ca "vượt tổng điểm đề" đỏ.
//   - boardRowFor: trả nguyên `row` → ca "không userId" đỏ.
//   - planClassFix: bỏ `policy !== "open"` → ca "lớp open giữ công khai" đỏ.
import { check, section, done } from "./h";
import { canSeeClassExam, selfScoreError, boardRowFor, type ClassExamFacts } from "@/lib/examResultRules";
import { planClassFix } from "@/lib/classPrivacyFix";

const F = (o: Partial<ClassExamFacts> = {}): ClassExamFacts => ({ courseId: "c1", examOwnerId: "T1", courseOwnerId: "T2", price: null, isHelper: false, enrollment: null, hasGuestAccess: false, ...o });
const S = (userId = "S1") => ({ userId, role: "student" as const });
const T = (userId: string) => ({ userId, role: "admin" as const, adminRole: "teacher" });

section("canSeeClassExam");
check("đề không lớp: học sinh bất kỳ xem được", canSeeClassExam(S(), F({ courseId: null })));
check("học sinh đang học (active) → được", canSeeClassExam(S(), F({ enrollment: { status: "active" } })));
check("học sinh lớp khác (không ghi danh) → không", !canSeeClassExam(S(), F()));
check("học sinh đã nghỉ (suspended) / chờ đồng ý → không", !canSeeClassExam(S(), F({ enrollment: { status: "suspended" } })) && !canSeeClassExam(S(), F({ enrollment: { status: "pending_consent" } })));
check("đề thu phí + khách đã được duyệt → được; đề miễn phí + guest access → không", canSeeClassExam(S(), F({ price: 50000, hasGuestAccess: true })) && !canSeeClassExam(S(), F({ hasGuestAccess: true })));
check("quản trị trung tâm → được", canSeeClassExam({ userId: "A", role: "admin", adminRole: "admin_super" }, F()) && canSeeClassExam({ userId: "A", role: "admin", adminRole: "admin_content" }, F()));
check("chủ lớp, chủ đề, đồng giảng → được", canSeeClassExam(T("T2"), F()) && canSeeClassExam(T("T1"), F()) && canSeeClassExam(T("T9"), F({ isHelper: true })));
check("gia sư lớp khác → không", !canSeeClassExam(T("T9"), F()));
check("học sinh trùng id chủ lớp vẫn không (vai học sinh)", !canSeeClassExam(S("T2"), F()));

section("selfScoreError");
const ex = { active: true, isDraft: false, totalPoints: 10 };
check("0 và đúng tổng điểm → nhận", selfScoreError(ex, 0) === null && selfScoreError(ex, 10) === null && selfScoreError(ex, 8.5) === null);
check("vượt tổng điểm CỦA ĐỀ (11/10, 150/10) → lỗi", !!selfScoreError(ex, 11) && !!selfScoreError(ex, 150));
check("âm, NaN, Infinity, chuỗi → lỗi", [-1, NaN, Infinity, "9", null].every(v => !!selfScoreError(ex, v)));
check("đề tắt (active false) → lỗi", !!selfScoreError({ ...ex, active: false }, 5));
check("đề nháp → lỗi", !!selfScoreError({ ...ex, isDraft: true }, 5));
check("lời lỗi ghi đúng thang của đề", selfScoreError(ex, 11)?.includes("0–10") === true, selfScoreError(ex, 11));

section("boardRowFor");
const mask = (n: string) => n.split(" ")[0] + " ***";
const row = { id: "r1", userId: "S1", score: 9, user: { name: "Nguyễn Văn An" } };
const mine = boardRowFor(row, "S1", false, mask), other = boardRowFor(row, "S2", false, mask), staff = boardRowFor(row, "T2", true, mask);
check("học sinh: không userId, tên che, dòng của mình isMe=true", !("userId" in mine) && mine.user.name === "Nguyễn ***" && mine.isMe === true, mine);
check("học sinh khác: isMe=false, không userId", !("userId" in other) && other.isMe === false, other);
check("người được xem tên đầy đủ: giữ userId và tên thật", (staff as { userId?: string }).userId === "S1" && staff.user.name === "Nguyễn Văn An", staff);

section("planClassFix");
const plan = planClassFix([
  { id: "a", name: "A", status: true, joinPolicy: null, instructor: "KiN", ownerName: "Cô Lan" },
  { id: "b", name: "B", status: true, joinPolicy: "open", instructor: "Cô Hà", ownerName: "Cô Hà" },
  { id: "c", name: "C", status: true, joinPolicy: "invite", instructor: "Thầy Nam", ownerName: "Thầy Nam" },
  { id: "d", name: "D", status: false, joinPolicy: "approve", instructor: "Thầy Nam", ownerName: "Thầy Nam" },
  { id: "e", name: "E", status: false, joinPolicy: "approve", instructor: " ", ownerName: null },
]);
const of = (id: string) => plan.find(p => p.id === id)?.data;
check("joinPolicy null → approve + ẩn + tên chủ lớp thay 'KiN'", JSON.stringify(of("a")) === JSON.stringify({ joinPolicy: "approve", status: false, instructor: "Cô Lan", teacherAvatar: "C" }), of("a"));
check("lớp open giữ công khai, không đổi gì", of("b") === undefined, of("b"));
check("lớp invite đang công khai → ẩn", JSON.stringify(of("c")) === JSON.stringify({ status: false }), of("c"));
check("lớp đã riêng, có tên → không đổi; không có chủ → không bịa tên", of("d") === undefined && of("e") === undefined, [of("d"), of("e")]);

void done();
