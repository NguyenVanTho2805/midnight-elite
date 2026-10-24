// HV-05 — dữ liệu GIẢ cho thẻ "Yêu cầu tìm gia sư" ở Hộp việc (/lop-cua-toi) và trang /lop-cua-toi/yeu-cau:
// hai yêu cầu MỚI gửi tới giasu@kin.local (kèm dòng đồng ý như khi gửi thật). Số điện thoại là số giả 0900000xxx.
// Chạy lặp lại được: khoá theo trackToken cố định, nạp lần hai không tạo thêm dòng.
import { phoneKeyOf } from "@/lib/tutorRequestServer";
import type { MockFn } from "../mock-seed";

const REQS = [
  { trackToken: "hv05000000000000hv05000000000001", level: "thcs", subject: "Toán 8", mode: "online", slots: "Tối thứ 3 và thứ 5", contactName: "PH thử Một", contactPhone: "0900000001", note: "Con cần ôn lại phần đại số (dữ liệu giả)." },
  { trackToken: "hv05000000000000hv05000000000002", level: "thpt", subject: "Vật lí 11", mode: "offline", slots: "Cuối tuần", contactName: "PH thử Hai", contactPhone: "0900000002", note: "Học tại nhà, khu vực Cầu Giấy (dữ liệu giả)." },
];

const mock: MockFn = async ({ prisma, tutor }) => {
  for (const r of REQS) {
    const row = await prisma.tutorRequest.upsert({
      where: { trackToken: r.trackToken },
      update: { status: "new", decidedAt: null, createdAt: new Date() },
      create: { ...r, targetTutorId: tutor.id, phoneKey: phoneKeyOf(r.contactPhone), status: "new" },
      select: { id: true },
    });
    const has = await prisma.consentRecord.count({ where: { subjectType: "tutor_request", subjectId: row.id } });
    if (!has) await prisma.consentRecord.create({ data: { subjectType: "tutor_request", subjectId: row.id, party: "guardian", scopes: ["basic"], method: "guest_form", textVersion: "mock", givenById: null, givenByRole: "guest" } });
  }
  return [`HV-05 · giasu@kin.local → /lop-cua-toi (Hộp việc), khối "Yêu cầu tìm gia sư": "${REQS.length} yêu cầu mới đang chờ cô"; bấm vào để thấy danh sách ở /lop-cua-toi/yeu-cau.`];
};
export default mock;
