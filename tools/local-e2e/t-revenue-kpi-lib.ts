import { invoiceKpi } from "@/lib/revenueKpi";
import { check, section, done } from "./h";

section("PT-01 invoiceKpi (thuần)");
const k = invoiceKpi([
  { status: "draft", amountDue: 500_000, paidAmount: 0 },
  { status: "sent", amountDue: 1_000_000, paidAmount: 0 },
  { status: "partial", amountDue: 1_000_000, paidAmount: 400_000 },
  { status: "paid", amountDue: 600_000, paidAmount: 600_000 },
  { status: "cancelled", amountDue: 9_999_999, paidAmount: 0 },
]);
check("tiềm năng = chỉ phiếu nháp (500.000, 1 phiếu); huỷ không tính", k.draftAmount === 500_000 && k.draftCount === 1, k);
check("phải thu đã gửi = 2.600.000 trên 3 phiếu; đã đóng = 1.000.000", k.sentDue === 2_600_000 && k.sentPaid === 1_000_000 && k.sentCount === 3, k);
check("tỷ lệ = 38% (1.000.000 / 2.600.000)", k.collectionRatePct === 38, k);
check("không có phiếu đã gửi → null (không bịa 0%)", invoiceKpi([{ status: "draft", amountDue: 5, paidAmount: 0 }]).collectionRatePct === null && invoiceKpi([]).collectionRatePct === null);
check("đóng dư trên phiếu không vượt 100%", invoiceKpi([{ status: "paid", amountDue: 100, paidAmount: 150 }]).collectionRatePct === 100);
check("paidAmount âm bị chặn về 0", invoiceKpi([{ status: "sent", amountDue: 100, paidAmount: -50 }]).sentPaid === 0);
check("trạng thái lạ bị bỏ qua", invoiceKpi([{ status: "weird", amountDue: 100, paidAmount: 0 }]).sentCount === 0);
done();
