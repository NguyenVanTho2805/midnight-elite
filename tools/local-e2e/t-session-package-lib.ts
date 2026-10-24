// HP-31 — gói buổi trả trước + sổ sử dụng (phần THUẦN): kiểm đầu vào, số dư, trạng thái, chọn gói để trừ, không trừ hai lần, chữ trung thực.
import {
  PACKAGE_MAX_SESSIONS, PACKAGE_NOTE_MAX, PACKAGE_NOTICE, PACKAGE_PARENT_NOTICE, PACKAGE_STATUS_LABEL, balanceOf, chargeLinkOf, consumesPackage, isPackageStatus,
  parsePackageInput, planUse, snapshotTotal, statusAfter, type PackageLite,
} from "@/lib/sessionPackage";
import { check, section, done } from "./h";

section("Đầu vào lập gói");
const ok = parsePackageInput({ studentId: " u1 ", sessions: 10, note: "  gói tháng 11  " });
check("hợp lệ: cắt khoảng trắng, giữ số buổi", ok.ok && ok.value.studentId === "u1" && ok.value.sessions === 10 && ok.value.note === "gói tháng 11");
check("ghi chú trống → null", parsePackageInput({ studentId: "u1", sessions: 1, note: "   " }).ok === true && (parsePackageInput({ studentId: "u1", sessions: 1, note: "   " }) as any).value.note === null);
check("ghi chú quá dài bị cắt đúng giới hạn", ((parsePackageInput({ studentId: "u1", sessions: 1, note: "x".repeat(900) }) as any).value.note as string).length === PACKAGE_NOTE_MAX);
check("[phá] thiếu em / em rỗng → lỗi", !parsePackageInput({ sessions: 5 }).ok && !parsePackageInput({ studentId: "  ", sessions: 5 }).ok && !parsePackageInput(null).ok);
check("[phá] số buổi 0, âm, lẻ, chữ, vượt trần → lỗi", [0, -1, 2.5, "10", PACKAGE_MAX_SESSIONS + 1, NaN, Infinity].every(n => !parsePackageInput({ studentId: "u1", sessions: n }).ok));
check("biên: 1 và trần đều được", parsePackageInput({ studentId: "u1", sessions: 1 }).ok && parsePackageInput({ studentId: "u1", sessions: PACKAGE_MAX_SESSIONS }).ok);
check("[phá] ghi chú không phải chữ → lỗi", !parsePackageInput({ studentId: "u1", sessions: 1, note: 5 }).ok);

section("Giá ghi lúc lập (chỉ để ghi, số nguyên đồng)");
check("150.000 × 10 = 1.500.000", snapshotTotal(150_000, 10) === 1_500_000);
check("theo giờ đã làm tròn từng buổi: 300.000 × 4 = 1.200.000", snapshotTotal(300_000, 4) === 1_200_000);
check("[phá] 0, âm, lẻ → null", snapshotTotal(0, 5) === null && snapshotTotal(-1, 5) === null && snapshotTotal(1000.5, 5) === null && snapshotTotal(1000, 0) === null);
check("[phá] quá lớn (vượt trần 2 tỷ) → null, không tràn số", snapshotTotal(900_000_000, 3) === null && snapshotTotal(Number.MAX_SAFE_INTEGER, 2) === null);

section("Số dư và trạng thái");
check("còn = số buổi − đã trừ", balanceOf({ sessions: 10, activeUses: 3 }) === 7);
check("[phá] dữ liệu hỏng (trừ quá) kẹp về 0, không âm", balanceOf({ sessions: 2, activeUses: 5 }) === 0 && balanceOf({ sessions: 2, activeUses: -4 }) === 2);
check("hết buổi → used_up; còn buổi → active", statusAfter({ status: "active", sessions: 3, activeUses: 3 }) === "used_up" && statusAfter({ status: "used_up", sessions: 3, activeUses: 2 }) === "active");
check("trả buổi làm gói hết buổi quay lại 'còn buổi' (lịch sử không mất)", statusAfter({ status: "used_up", sessions: 3, activeUses: 2 }) === "active");
check("gói đã huỷ KHÔNG tự sống lại dù còn buổi", statusAfter({ status: "cancelled", sessions: 10, activeUses: 0 }) === "cancelled");
check("nhãn trạng thái bằng chữ và nhận diện đúng", isPackageStatus("active") && isPackageStatus("cancelled") && !isPackageStatus("paid") && PACKAGE_STATUS_LABEL.used_up === "Đã dùng hết");

section("Buổi nào trừ buổi của gói (cùng định nghĩa buổi tính phí)");
check("có mặt / muộn trừ", consumesPackage({ status: "present", makeupUsed: false }) && consumesPackage({ status: "late", makeupUsed: false }));
check("có phép / vắng không trừ", !consumesPackage({ status: "excused", makeupUsed: false }) && !consumesPackage({ status: "absent", makeupUsed: false }));
check("buổi dùng buổi bù không trừ", !consumesPackage({ status: "present", makeupUsed: true }));

section("Chọn gói để trừ (planUse)");
const t = (m: number) => new Date(Date.UTC(2026, 9, 1 + m));
const pk = (id: string, m: number, o: Partial<PackageLite> = {}): PackageLite => ({ id, status: "active", sessions: 5, activeUses: 0, createdAt: t(m), ...o });
check("trừ gói CŨ NHẤT còn buổi", JSON.stringify(planUse({ consumes: true, existing: null, packages: [pk("b", 5), pk("a", 1), pk("c", 9)] })) === JSON.stringify({ type: "create", packageId: "a" }));
check("gói cũ nhất hết buổi → sang gói kế", JSON.stringify(planUse({ consumes: true, existing: null, packages: [pk("a", 1, { activeUses: 5 }), pk("b", 2)] })) === JSON.stringify({ type: "create", packageId: "b" }));
check("[phá] gói đã huỷ / đã hết không bao giờ được chọn", planUse({ consumes: true, existing: null, packages: [pk("a", 1, { status: "cancelled" }), pk("b", 2, { status: "used_up", activeUses: 5 })] }).type === "none");
check("không có gói → không làm gì (không tạo dòng ma)", planUse({ consumes: true, existing: null, packages: [] }).type === "none");
check("đã trừ rồi mà vẫn tính → giữ nguyên, KHÔNG trừ lần hai, không đổi gói", planUse({ consumes: true, existing: { packageId: "z", reversedAt: null }, packages: [pk("a", 1)] }).type === "none");
check("dòng đã trả trước đó mà tính lại → trừ lại (revive) vào gói cũ nhất còn buổi", JSON.stringify(planUse({ consumes: true, existing: { packageId: "z", reversedAt: t(3) }, packages: [pk("a", 1)] })) === JSON.stringify({ type: "revive", packageId: "a" }));
check("đang trừ mà không còn tính (đổi vắng / mở lại) → trả buổi", planUse({ consumes: false, existing: { packageId: "a", reversedAt: null }, packages: [pk("a", 1)] }).type === "reverse");
check("không tính và chưa trừ, hoặc đã trả rồi → không làm gì", planUse({ consumes: false, existing: null, packages: [pk("a", 1)] }).type === "none" && planUse({ consumes: false, existing: { packageId: "a", reversedAt: t(2) }, packages: [pk("a", 1)] }).type === "none");
check("hai gói cùng ngày: ổn định theo id", (planUse({ consumes: true, existing: null, packages: [pk("b", 1), pk("a", 1)] }) as any).packageId === "a");
// Mô phỏng 7 buổi lần lượt trên 2 gói (3 + 2 buổi): tổng trừ không bao giờ vượt tổng buổi, không âm.
const sim = [pk("g1", 1, { sessions: 3 }), pk("g2", 2, { sessions: 2 })];
const picked: string[] = [];
for (let i = 0; i < 7; i++) {
  const a = planUse({ consumes: true, existing: null, packages: sim });
  if (a.type === "create") { picked.push(a.packageId); sim.find(p => p.id === a.packageId)!.activeUses++; }
}
check("7 buổi trên gói 3 + 2: trừ đúng 5 (g1 ×3 rồi g2 ×2), hai buổi còn lại không trừ ai", picked.join() === "g1,g1,g1,g2,g2" && sim.every(p => balanceOf(p) === 0));

section("Dòng học phí cùng buổi (để gia sư thấy nguy cơ tính hai lần)");
check("không có / chưa vào phiếu / đã vào phiếu", chargeLinkOf(null) === "none" && chargeLinkOf({ exists: true, invoiceId: null }) === "pending" && chargeLinkOf({ exists: true, invoiceId: "inv1" }) === "invoiced" && chargeLinkOf({ exists: false, invoiceId: "x" }) === "none");

section("Chữ trung thực");
check("chữ cho gia sư nói rõ không thu tiền, chưa bớt phiếu, cần kế toán duyệt", /không thu hay chuyển tiền/.test(PACKAGE_NOTICE) && /chưa tự bớt/.test(PACKAGE_NOTICE) && /kế toán duyệt/.test(PACKAGE_NOTICE));
check("chữ cho phụ huynh: chỉ trình bày, không số tiền, không 'đã thanh toán/xác minh'", /chỉ trình bày/.test(PACKAGE_PARENT_NOTICE) && !/\d/.test(PACKAGE_PARENT_NOTICE) && !/đã thanh toán|đã xác minh|đã thu/i.test(PACKAGE_PARENT_NOTICE + PACKAGE_NOTICE));
done();
