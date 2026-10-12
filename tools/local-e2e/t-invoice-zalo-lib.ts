import { INVOICE_LINK_DAYS, ZALO_SENDABLE_STATUSES, invoiceLinkExpiry, invoiceLinkState, invoiceLinkPath, invoiceLinkDaysLeft, privateInvoiceMessage, groupInvoiceMessage, attendanceMessage } from "@/lib/invoiceZalo";
import { check, section, done } from "./h";

section("Hạn link (30 ngày, Thọ chốt 12/10)");
const now = new Date("2026-10-12T05:00:00Z");
check("hạn = 60 ngày sau", INVOICE_LINK_DAYS === 30 && invoiceLinkExpiry(now).getTime() - now.getTime() === 30 * 24 * 3600_000);
const exp = invoiceLinkExpiry(now);
check("trạng thái: chưa có / còn hạn / hết hạn", invoiceLinkState({ viewToken: null, viewTokenExpiresAt: null }, now) === "none"
  && invoiceLinkState({ viewToken: "x", viewTokenExpiresAt: exp }, now) === "live"
  && invoiceLinkState({ viewToken: "x", viewTokenExpiresAt: new Date(now.getTime() - 1) }, now) === "expired"
  && invoiceLinkState({ viewToken: "x", viewTokenExpiresAt: now }, now) === "expired"
  && invoiceLinkState({ viewToken: "x", viewTokenExpiresAt: null }, now) === "none");
check("số ngày còn lại làm tròn lên, không âm", invoiceLinkDaysLeft(exp, now) === 30 && invoiceLinkDaysLeft(new Date(now.getTime() + 3600_000), now) === 1 && invoiceLinkDaysLeft(new Date(now.getTime() - 1e9), now) === 0);
check("đường dẫn", invoiceLinkPath("ab12") === "/phieu/ab12");
check("chỉ gửi được phiếu đã gửi / báo chuyển / đóng một phần", eq(ZALO_SENDABLE_STATUSES, ["sent", "parent_reported", "partial"]));
function eq(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b); }

section("Tin vào chat riêng (mẫu của spec)");
const priv = privateInvoiceMessage({ studentName: "Minh Anh", yearMonth: "2026-10", amount: 1_200_000, url: "https://kin.vn/phieu/abc" });
check("đúng mẫu: tháng 10, tên con, số tiền, hạn trước ngày 20, link", priv === "Dạ em gửi anh/chị phiếu học phí tháng 10 của con Minh Anh: 1.200.000đ, hạn trước ngày 20. Anh/chị bấm vào đây để xem phiếu và quét mã chuyển khoản: https://kin.vn/phieu/abc", priv);
check("tháng 01 không còn số 0 đầu", privateInvoiceMessage({ studentName: "A", yearMonth: "2027-01", amount: 500000, url: "u" }).includes("tháng 1 của con"));

section("Tin vào nhóm lớp: không tiền, không link, không tên con");
const grp = groupInvoiceMessage({ yearMonth: "2026-10" });
check("tin chung đúng mẫu", grp === "Phiếu học phí tháng 10 đã gửi riêng cho từng anh/chị, hạn trước ngày 20. Anh/chị xem tin nhắn riêng giúp em nhé.", grp);
check("không chứa số tiền, http, tên", !/\d{1,3}(\.\d{3})+đ|http|\/phieu\//.test(grp));

section("Tin điểm danh");
const base = { subject: "Toán 9", dateLabel: "17/9", studentName: "Minh Anh" };
check("Có mặt / Muộn / Có phép: một câu, không link", attendanceMessage({ ...base, status: "present", url: "https://x" }) === "Buổi Toán 9 17/9 của con Minh Anh: Có mặt."
  && attendanceMessage({ ...base, status: "late" }) === "Buổi Toán 9 17/9 của con Minh Anh: Muộn."
  && attendanceMessage({ ...base, status: "excused", url: "https://x" }) === "Buổi Toán 9 17/9 của con Minh Anh: Có phép.");
check("Vắng + có link: mời xem lại bản ghi buổi học", attendanceMessage({ ...base, status: "absent", url: "https://x/y" }) === "Buổi Toán 9 17/9 của con Minh Anh: Vắng. Nếu con vắng, anh/chị xem lại bản ghi buổi học ở đây: https://x/y");
check("Vắng + không có link: chỉ một câu (không hứa link)", attendanceMessage({ ...base, status: "absent" }) === "Buổi Toán 9 17/9 của con Minh Anh: Vắng." && attendanceMessage({ ...base, status: "absent", url: null }).indexOf("http") < 0);
done();
