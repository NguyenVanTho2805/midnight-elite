// Dữ liệu GIẢ cho NC2-010 (báo gia sư khi phụ huynh bấm "Tôi đã chuyển") và NC2-011 (tin 07:00 "Hôm qua có N buổi chưa điểm danh").
// Chạy lặp lại được: mỗi mục tìm-trước-tạo-sau. Chỉ dữ liệu giả rõ ràng (tên "(thử NC2-010/011)").
import webpush from "web-push";
import { BASE, mkCourse, mkUser } from "../h";
import { addDaysKey, dayOfWeekOfKey, vnDateKeyOf } from "@/lib/classSessions";
import { yesterdayKeyVn } from "@/lib/unmarkedDaily";
import { generateInvoiceCode } from "@/lib/tuitionInvoice";
import { parentReportedLink } from "@/lib/invoiceServer";
import type { MockCtx } from "../mock-seed";

const TAG = "(thử NC2-010/011)";

export default async function mock(ctx: MockCtx): Promise<string[]> {
  const { prisma, tutor, tw } = ctx;
  const now = new Date();
  const out: string[] = [];

  // (a) Phiếu học phí ở trạng thái "phụ huynh báo đã chuyển" + thông báo chưa đọc ở chuông
  const prevYm = addDaysKey(`${vnDateKeyOf(now).slice(0, 7)}-01`, -1).slice(0, 7);
  let inv = await prisma.tuitionInvoice.findFirst({ where: { tutorId: tutor.id, studentId: tw.s2.id, yearMonth: prevYm } });
  if (!inv) {
    inv = await prisma.tuitionInvoice.create({ data: {
      code: generateInvoiceCode(), tutorId: tutor.id, studentId: tw.s2.id, yearMonth: prevYm, amountDue: 1_600_000,
      status: "parent_reported", sentAt: new Date(now.getTime() - 3 * 86400_000), parentReportedAt: new Date(now.getTime() - 2 * 3600_000),
    } });
  }
  const link = parentReportedLink(inv.id);
  if (!(await prisma.notification.findFirst({ where: { userId: tutor.id, type: "parent_reported", link } }))) {
    await prisma.notification.create({ data: {
      userId: tutor.id, type: "parent_reported", title: "Phụ huynh báo đã chuyển khoản",
      message: "Có phụ huynh báo đã chuyển khoản, cần đối soát. Mở phiếu học phí để xem.", link,
    } });
  }
  out.push(`Chuông thông báo của giasu@kin.local có tin chưa đọc "Phụ huynh báo đã chuyển khoản" (bấm vào → /lop-cua-toi/hoc-phi); tab Phiếu có 1 phiếu tháng ${prevYm} trạng thái "Phụ huynh báo đã chuyển".`);

  // (b) Hai buổi HÔM QUA chưa điểm danh (hai lớp, mỗi lớp 2 em ghi danh từ lâu)
  const yday = yesterdayKeyVn(now), ydow = dayOfWeekOfKey(yday), long = new Date(Date.now() - 30 * 86400_000);
  for (const [i, [name, start, end]] of ([["Hoá 8", "09:00", "10:00"], ["Sinh 8", "14:00", "15:00"]] as const).entries()) {
    const title = `${name} ${TAG}`;
    let c = await prisma.course.findFirst({ where: { ownerId: tutor.id, name: title } });
    if (!c) {
      c = await mkCourse(tutor.id, { name: title });
      await prisma.classSchedule.create({ data: { courseId: c.id, dayOfWeek: ydow, startTime: start, endTime: end, createdAt: long } });
      for (const n of ["Em Lan thử", "Em Minh thử"]) {
        const s = await mkUser({ name: `${n} ${i + 1}` });
        await prisma.enrollment.create({ data: { userId: s.id, courseId: c.id, status: "active", createdAt: long } });
      }
    }
  }
  out.push(`Hộp việc (/lop-cua-toi): dòng "buổi chưa điểm danh" có số, gồm 2 buổi hôm qua (${yday}) của hai lớp "Hoá 8" và "Sinh 8" ${TAG}.`);

  // (d) Tạo tin 07:00 bằng chính cron (nếu máy chủ đang chạy) — làm TRƯỚC khi thêm thiết bị đẩy để cron không thử gọi ra mạng
  let viaCron = false;
  try {
    const r = await fetch(`${BASE}/api/cron/remind-class`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? ""}` }, signal: AbortSignal.timeout(60_000) });
    const j = await r.json().catch(() => null) as { unmarked?: { notified?: number } } | null;
    viaCron = r.ok && !!j?.unmarked;
  } catch { /* máy chủ chưa chạy → tạo thẳng bên dưới */ }
  if (!(await prisma.notification.findFirst({ where: { userId: tutor.id, type: "unmarked_daily" } }))) {
    await prisma.notification.create({ data: {
      userId: tutor.id, type: "unmarked_daily", title: "Buổi hôm qua chưa điểm danh",
      message: "Hôm qua có 2 buổi chưa điểm danh. Mở Hộp việc để điểm danh bù.", link: "/lop-cua-toi",
    } });
    viaCron = false;
  }
  out.push(`Chuông thông báo: tin "Buổi hôm qua chưa điểm danh — Hôm qua có N buổi chưa điểm danh" (đích /lop-cua-toi); ${viaCron ? "do cron remind-class tạo thật" : "tạo trực tiếp (máy chủ chưa chạy khi nạp)"}.`);

  // (c) Một thiết bị đẩy giả + bật đủ các loại tin
  const keys = webpush.generateVAPIDKeys();
  const endpoint = "https://fcm.googleapis.com/fcm/send/mock-nc2-010-011-giasu";
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: tutor.id, endpoint, p256dh: keys.publicKey, auth: keys.privateKey.slice(0, 22), userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36" },
    update: { userId: tutor.id, revokedAt: null },
  });
  const u = await prisma.user.findUnique({ where: { id: tutor.id }, select: { preferences: true } });
  const prefs = (u?.preferences && typeof u.preferences === "object" && !Array.isArray(u.preferences) ? u.preferences : {}) as Record<string, unknown>;
  await prisma.user.update({ where: { id: tutor.id }, data: { preferences: { ...prefs, push: { types: { absence_late: true, bank_tx_pending: true, invoice_paid: true, parent_reported: true, unmarked_daily: true } } } } });
  out.push(`Cài đặt → Thông báo đẩy (/lop-cua-toi/cai-dat#thong-bao-day): 1 thiết bị "Chrome · Android" (giả) và năm công tắc đều BẬT, gồm hai loại mới "Phụ huynh báo đã chuyển khoản" và "Nhắc điểm danh buổi hôm qua" (mặc định của tài khoản thật là TẮT). Thiết bị là địa chỉ giả nên tin thật không tới được.`);
  return out;
}
