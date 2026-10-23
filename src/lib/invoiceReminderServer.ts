// F2 — phần có DB của vòng thu học phí. Quy tắc thuần ở invoiceReminder.ts.
//  • Mọi truy vấn khoá theo gia sư (tutorId).
//  • Bước 2–3 là KiN Pro: canUse(tutorId, 'reminder_steps'). Cổng TẮT thì ai cũng dùng được (mặc định).
//  • Chỉ GHI "đã mở Zalo lúc …"; không bao giờ "đã gửi", không đổi tiền, không đổi trạng thái phiếu.
import { prisma } from "@/lib/prisma";
import { canUse } from "@/lib/planServer";
import { moneyPathsBlocked } from "@/lib/feeChargeServer";
import { DEFAULT_DUE_DAY, DEFAULT_DUE_DAY_KEY, REMINDABLE_STATUSES, reminderDue, type ReminderStep } from "@/lib/invoiceReminder";

/** Hai lần ghi cùng bước của cùng một phiếu trong khoảng này coi là một lần bấm (bấm đúp). */
export const REMINDER_DEBOUNCE_MS = 60_000;

export async function loadDefaultDueDay(): Promise<number> {
  try {
    const row = await prisma.settingKV.findUnique({ where: { key: DEFAULT_DUE_DAY_KEY } });
    const n = row ? Number(row.value) : NaN;
    return Number.isInteger(n) && n >= 1 && n <= 28 ? n : DEFAULT_DUE_DAY;
  } catch {
    return DEFAULT_DUE_DAY;
  }
}

/** Ghi một lần mở Zalo (chống bấm đúp). Ở bản xem trước (VERCEL_ENV=preview) thì không ghi mới. Trả true nếu đã tạo dòng. */
export async function recordReminderOpened(o: { invoiceId: string; tutorId: string; step: ReminderStep; now: Date }): Promise<boolean> {
  if (moneyPathsBlocked()) return false;
  const recent = await prisma.invoiceReminder.findFirst({
    where: { invoiceId: o.invoiceId, step: o.step, openedAt: { gt: new Date(o.now.getTime() - REMINDER_DEBOUNCE_MS) } }, select: { id: true },
  });
  if (recent) return false;
  await prisma.invoiceReminder.create({ data: { invoiceId: o.invoiceId, tutorId: o.tutorId, step: o.step, openedAt: o.now } });
  return true;
}

export interface ReminderDueRow {
  invoiceId: string; studentName: string; yearMonth: string; remaining: number; step: 2 | 3; overdueDays: number; sinceDays: number | null;
}

/**
 * Phiếu của gia sư đã "đến lúc nhắc bước 2/3" — tính khi mở trang, không cần cron theo giờ.
 * Free (cổng bật, không Pro) thì trả rỗng: bước 2–3 là Pro. Hết hạn Pro → không gợi bước mới, nhưng lịch sử cũ vẫn đọc được ở nơi khác.
 * Truy vấn đầu chỉ lấy phiếu ĐÃ nhắc bước 1 và còn mở; nếu không có thì không phải đọc gói (shell gọi hàm này ở mọi trang).
 */
export async function loadReminderDue(tutorId: string, now: Date = new Date()): Promise<ReminderDueRow[]> {
  const rows = await prisma.tuitionInvoice.findMany({
    where: {
      tutorId, status: { in: [...REMINDABLE_STATUSES] },
      OR: [{ zaloOpenedAt: { not: null } }, { reminders: { some: {} } }],
    },
    select: {
      id: true, yearMonth: true, amountDue: true, paidAmount: true, status: true, dueDate: true, zaloOpenedAt: true,
      student: { select: { name: true } }, reminders: { select: { step: true, openedAt: true } },
    },
    take: 500,
  });
  const due = rows
    .map(r => ({ r, d: reminderDue(r, now) }))
    .filter((x): x is { r: typeof x.r; d: typeof x.d & { step: 2 | 3 } } => x.d.step !== null);
  if (due.length === 0) return [];
  if (!(await canUse(tutorId, "reminder_steps"))) return [];
  return due
    .map(({ r, d }) => ({
      invoiceId: r.id, studentName: r.student.name, yearMonth: r.yearMonth, remaining: r.amountDue - r.paidAmount,
      step: d.step, overdueDays: d.overdueDays, sinceDays: d.sinceDays,
    }))
    .sort((a, b) => b.overdueDays - a.overdueDays || (b.sinceDays ?? 0) - (a.sinceDays ?? 0));
}
