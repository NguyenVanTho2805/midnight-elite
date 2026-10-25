// F2 — vòng thu học phí (phần THUẦN): hạn đóng, "đến lúc nhắc bước kế", tin leo thang nhẹ nhàng, lịch sử, và TIN CŨ KHÔNG ĐỔI CHỮ NÀO khi chưa có hạn.
import {
  REMINDER_GAP_DAYS, daysBetweenKeys, daysOverdue, defaultDueDateKey, dueClause, dueDateLabel, reminderDue, reminderMessage, stepAllowed, validateDueDate, buildHistory, lastOpenedAt, HISTORY_LABEL,
} from "@/lib/invoiceReminder";
import { privateInvoiceMessage, groupInvoiceMessage } from "@/lib/invoiceZalo";
import { check, section, done } from "./h";

// 12/11/2026 10:00 giờ VN = 03:00Z
const NOW = new Date("2026-11-12T03:00:00Z");
const at = (key: string, hm = "09:00") => new Date(`${key}T${hm}:00+07:00`);

section("Tin CŨ giữ nguyên từng chữ khi chưa có hạn (số tiền/chữ cũ không đổi)");
const OLD_PRIVATE = "Dạ em gửi anh/chị phiếu học phí tháng 10 của con Minh Anh: 1.200.000đ, hạn trước ngày 20. Anh/chị bấm vào đây để xem phiếu và quét mã chuyển khoản: https://kin.vn/phieu/abc";
const OLD_GROUP = "Phiếu học phí tháng 10 đã gửi riêng cho từng anh/chị, hạn trước ngày 20. Anh/chị xem tin nhắn riêng giúp em nhé.";
const a = { studentName: "Minh Anh", yearMonth: "2026-10", amount: 1_200_000, url: "https://kin.vn/phieu/abc" };
check("riêng, không truyền hạn → đúng chữ cũ", privateInvoiceMessage(a) === OLD_PRIVATE);
check("riêng, hạn null → đúng chữ cũ", privateInvoiceMessage({ ...a, dueDate: null }) === OLD_PRIVATE);
check("nhóm, không hạn / null → đúng chữ cũ", groupInvoiceMessage({ yearMonth: "2026-10" }) === OLD_GROUP && groupInvoiceMessage({ yearMonth: "2026-10", dueDate: null }) === OLD_GROUP);
check("có hạn thật → thay đúng cụm hạn, phần còn lại giữ nguyên", privateInvoiceMessage({ ...a, dueDate: "2026-11-25" }) === OLD_PRIVATE.replace("hạn trước ngày 20", "hạn đóng 25/11/2026"));
check("nhóm có hạn → vẫn không số tiền/link/tên con", (() => { const g = groupInvoiceMessage({ yearMonth: "2026-10", dueDate: "2026-11-25" }); return g.includes("hạn đóng 25/11/2026") && !/đ\b|http|Minh/.test(g); })());
check("dueClause: null/rỗng/sai định dạng → chữ cũ", dueClause(null) === "hạn trước ngày 20" && dueClause("") === "hạn trước ngày 20" && dueClause("2026-02-31") === "hạn trước ngày 20");

section("Hạn đóng hợp lệ");
check("ngày thật trong khoảng", validateDueDate("2026-11-25", NOW).ok === true);
check("sai định dạng / ngày không tồn tại / không phải chuỗi", !validateDueDate("25/11/2026", NOW).ok && !validateDueDate("2026-02-30", NOW).ok && !validateDueDate(20261125, NOW).ok && !validateDueDate(null, NOW).ok);
check("lệch quá xa (gõ nhầm năm) bị chặn: 2062 và 2020", !validateDueDate("2062-11-25", NOW).ok && !validateDueDate("2020-11-25", NOW).ok);
check("nhãn dd/mm/yyyy", dueDateLabel("2026-11-05") === "05/11/2026");

section("Quá hạn tính theo ngày VN: hết hạn mới tính");
check("đúng ngày hạn → chưa quá hạn", daysOverdue("2026-11-12", NOW) === 0);
check("hôm sau hạn → quá 1 ngày", daysOverdue("2026-11-11", NOW) === 1);
check("5 ngày", daysOverdue("2026-11-07", NOW) === 5);
check("hạn tương lai / không hạn → 0", daysOverdue("2026-11-30", NOW) === 0 && daysOverdue(null, NOW) === 0);
check("23:30 giờ VN vẫn là ngày hôm nay (17:00Z), 00:30 giờ VN sang ngày mới", daysOverdue("2026-11-12", new Date("2026-11-12T16:30:00Z")) === 0 && daysOverdue("2026-11-12", new Date("2026-11-12T17:30:00Z")) === 1);
check("daysBetweenKeys qua tháng và năm nhuận", daysBetweenKeys("2028-02-28", "2028-03-01") === 2 && daysBetweenKeys("2026-12-31", "2027-01-01") === 1);

section("Gợi ý hạn: ngày 20 gần nhất (cấu hình)");
check("12/11 → 20/11", defaultDueDateKey(NOW) === "2026-11-20");
check("đúng ngày 20 → chính hôm nay", defaultDueDateKey(new Date("2026-11-20T03:00:00Z")) === "2026-11-20");
check("25/11 → 20/12", defaultDueDateKey(new Date("2026-11-25T03:00:00Z")) === "2026-12-20");
check("25/12 → 20/01 năm sau", defaultDueDateKey(new Date("2026-12-25T03:00:00Z")) === "2027-01-20");
check("cấu hình ngày 5; ngày 31 bị kẹp 28 để tháng ngắn không lệch", defaultDueDateKey(NOW, 5) === "2026-12-05" && defaultDueDateKey(NOW, 31) === "2026-11-28");

section("Đến lúc nhắc bước 2/3 (tính khi mở trang)");
const base = { status: "sent", amountDue: 1_200_000, paidAmount: 0, dueDate: null as string | null, zaloOpenedAt: null as Date | null, reminders: [] as Array<{ step: number; openedAt: Date }> };
check("chưa nhắc bước 1 → không có bước kế", reminderDue(base, NOW).step === null && reminderDue(base, NOW).lastStep === 0);
check("bước 1 vừa mở hôm nay → chưa tới lúc", reminderDue({ ...base, zaloOpenedAt: at("2026-11-12") }, NOW).step === null);
check(`bước 1 cách ${REMINDER_GAP_DAYS - 1} ngày → chưa`, reminderDue({ ...base, zaloOpenedAt: at("2026-11-10") }, NOW).step === null);
check(`bước 1 cách đúng ${REMINDER_GAP_DAYS} ngày → bước 2`, reminderDue({ ...base, zaloOpenedAt: at("2026-11-09") }, NOW).step === 2);
check("bước 1 chỉ có trong bảng lịch sử (không có zaloOpenedAt) → vẫn bước 2", reminderDue({ ...base, reminders: [{ step: 1, openedAt: at("2026-11-01") }] }, NOW).step === 2);
check("đã có bước 2 hôm qua → chưa bước 3", reminderDue({ ...base, zaloOpenedAt: at("2026-11-01"), reminders: [{ step: 2, openedAt: at("2026-11-11") }] }, NOW).step === null);
check("bước 2 cách 3 ngày → bước 3", reminderDue({ ...base, zaloOpenedAt: at("2026-11-01"), reminders: [{ step: 2, openedAt: at("2026-11-09") }] }, NOW).step === 3);
check("đã có bước 3 → KHÔNG có bước 4", reminderDue({ ...base, zaloOpenedAt: at("2026-10-01"), reminders: [{ step: 2, openedAt: at("2026-10-05") }, { step: 3, openedAt: at("2026-10-09") }] }, NOW).step === null);
check("quá hạn 5 ngày được báo kèm", reminderDue({ ...base, dueDate: "2026-11-07", zaloOpenedAt: at("2026-11-05") }, NOW).overdueDays === 5);
check("hạn không làm đến lúc nhắc sớm hơn (chưa quá hạn vẫn theo khoảng cách ngày)", reminderDue({ ...base, dueDate: "2026-11-01", zaloOpenedAt: at("2026-11-12") }, NOW).step === null);
for (const [st, why] of [["draft", "nháp"], ["paid", "đã đóng"], ["cancelled", "đã huỷ"], ["parent_reported", "phụ huynh đã báo chuyển"]] as const) {
  check(`${why} → không gợi nhắc`, reminderDue({ ...base, status: st, zaloOpenedAt: at("2026-11-01") }, NOW).step === null);
}
check("đóng một phần còn nợ → vẫn nhắc", reminderDue({ ...base, status: "partial", paidAmount: 500_000, zaloOpenedAt: at("2026-11-01") }, NOW).step === 2);
check("đóng đủ số tiền (còn 0) dù trạng thái chưa kịp đổi → không nhắc", reminderDue({ ...base, paidAmount: 1_200_000, zaloOpenedAt: at("2026-11-01") }, NOW).step === null);
check("lastOpenedAt lấy lần MỚI nhất của bước", lastOpenedAt({ zaloOpenedAt: null, reminders: [{ step: 2, openedAt: at("2026-11-01") }, { step: 2, openedAt: at("2026-11-05") }] }, 2)?.getTime() === at("2026-11-05").getTime());

section("Bước chỉ mở theo thứ tự");
check("bước 1 luôn được", stepAllowed(1, base));
check("bước 2 cần bước 1 (zaloOpenedAt hoặc lịch sử)", !stepAllowed(2, base) && stepAllowed(2, { ...base, zaloOpenedAt: at("2026-11-01") }) && stepAllowed(2, { ...base, reminders: [{ step: 1, openedAt: at("2026-11-01") }] }));
check("bước 3 cần bước 2, bước 1 không đủ", !stepAllowed(3, { ...base, zaloOpenedAt: at("2026-11-01") }) && stepAllowed(3, { ...base, reminders: [{ step: 2, openedAt: at("2026-11-01") }] }));

section("Tin leo thang: nhẹ nhàng, không doạ, không hứa, không nói 'đã gửi'");
const msgs = ([2, 3] as const).map(step => reminderMessage(step, { studentName: "Minh Anh", yearMonth: "2026-10", amount: 700_000, url: "https://kin.vn/phieu/abc", dueDate: "2026-11-07" }));
const BAD = /đã gửi|đã nhắc|sẽ (cắt|ngừng|báo|khoá|tính|phạt|kiện)|phí trễ|phạt|kiện|pháp|bắt buộc|buộc phải|cuối cùng|ngay lập tức|nghỉ học|cho nghỉ|hậu quả|chậm trễ|giảm giá|chia nhỏ|gia hạn|miễn/i;
check("bước 2 và 3 khác nhau, có tên con, số còn lại, hạn thật và link", msgs[0] !== msgs[1] && msgs.every(m => m.includes("Minh Anh") && m.includes("700.000đ") && m.includes("hạn đóng 07/11/2026") && m.includes("https://kin.vn/phieu/abc")), msgs);
check("không có từ doạ / hứa / 'đã gửi'", msgs.every(m => !BAD.test(m)), msgs.map(m => BAD.exec(m)?.[0]));
check("luôn chừa lối cho người đã chuyển (bước 2 mời bấm 'Tôi đã chuyển')", msgs[0].includes("đã chuyển") && msgs[0].includes("Tôi đã chuyển"));
check("chưa có hạn → giữ cụm cũ 'hạn trước ngày 20'", reminderMessage(2, { studentName: "A", yearMonth: "2026-10", amount: 1, url: "u" }).includes("hạn trước ngày 20"));
check("không nêu số điện thoại, không nêu mã phiếu", msgs.every(m => !/\b0\d{9}\b|KIN[A-Z0-9]{5}/.test(m)));

section("Lịch sử nhắc: dòng thời gian thật, cũ → mới");
const hist = buildHistory({
  reminders: [{ step: 2, openedAt: at("2026-11-09") }, { step: 1, openedAt: at("2026-11-05") }],
  zaloOpenedAt: at("2026-11-09"), parentReportedAt: at("2026-11-10", "20:00"), payments: [{ at: at("2026-11-11"), amount: 700_000 }],
});
check("đúng thứ tự thời gian: bước 1, bước 2, phụ huynh báo, tiền ghi vào", hist.map(h => `${h.kind}${h.step ?? ""}`).join() === "zalo_opened1,zalo_opened2,parent_reported,matched", hist);
check("bước 1 cũ chỉ có zaloOpenedAt được thêm khi bảng chưa có bước 1", buildHistory({ reminders: [], zaloOpenedAt: at("2026-11-05"), parentReportedAt: null, payments: [] }).map(h => h.step).join() === "1");
check("đã có dòng bước 2 mà thiếu bước 1: KHÔNG bịa bước 1 từ zaloOpenedAt (đó là giờ của bước 2)", buildHistory({ reminders: [{ step: 2, openedAt: at("2026-11-09") }], zaloOpenedAt: at("2026-11-09"), parentReportedAt: null, payments: [] }).map(h => h.step).join() === "2");
check("không thêm bước 1 hai lần", buildHistory({ reminders: [{ step: 1, openedAt: at("2026-11-05") }], zaloOpenedAt: at("2026-11-05"), parentReportedAt: null, payments: [] }).length === 1);
check("không có gì → rỗng", buildHistory({ reminders: [], zaloOpenedAt: null, parentReportedAt: null, payments: [] }).length === 0);
check("nhãn: 'Đã mở Zalo', không bao giờ 'đã gửi'", HISTORY_LABEL.zalo_opened === "Đã mở Zalo" && Object.values(HISTORY_LABEL).every(l => !/đã gửi/i.test(l)));
done();
