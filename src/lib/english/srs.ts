// Lịch ôn FSRS (thư viện ts-fsrs, FSRS v6). Chuyển qua lại giữa hàng eng_cards và Card của ts-fsrs. Thuần.
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from "ts-fsrs";

/** Retention mục tiêu 0,88: thấp hơn 0,9 mặc định một chút để số thẻ ôn không phình quá sức người dễ nản. */
export const REQUEST_RETENTION = 0.88;
const scheduler = fsrs(generatorParameters({ request_retention: REQUEST_RETENTION, enable_fuzz: true, maximum_interval: 365 }));

export interface CardRow {
  due: Date; stability: number; difficulty: number; elapsedDays: number; scheduledDays: number;
  learningSteps: number; reps: number; lapses: number; state: number; lastReview: Date | null;
}

export function toFsrs(r: CardRow): Card {
  return {
    due: r.due, stability: r.stability, difficulty: r.difficulty, elapsed_days: r.elapsedDays,
    scheduled_days: r.scheduledDays, learning_steps: r.learningSteps, reps: r.reps, lapses: r.lapses,
    state: r.state as State, last_review: r.lastReview ?? undefined,
  };
}

export function fromFsrs(c: Card): CardRow {
  return {
    due: c.due, stability: c.stability, difficulty: c.difficulty, elapsedDays: c.elapsed_days,
    scheduledDays: c.scheduled_days, learningSteps: c.learning_steps, reps: c.reps, lapses: c.lapses,
    state: c.state, lastReview: c.last_review ?? null,
  };
}

export function newCardRow(now: Date = new Date()): CardRow { return fromFsrs(createEmptyCard(now)); }

export type RatingValue = 1 | 2 | 3 | 4;
export const RATING_LABEL: Record<RatingValue, string> = { 1: "Quên", 2: "Khó", 3: "Nhớ", 4: "Dễ" };

export function review(row: CardRow, rating: RatingValue, now: Date = new Date()) {
  const { card, log } = scheduler.next(toFsrs(row), now, rating as Grade);
  return { row: fromFsrs(card), log: { rating: log.rating as number, state: log.state as number, elapsedDays: log.elapsed_days, scheduledDays: log.scheduled_days } };
}

/** Lần ôn kế tiếp nếu chọn từng mức — để hiện "10 phút / 1 ngày / 4 ngày" trên nút. */
export function previewIntervals(row: CardRow, now: Date = new Date()): Record<RatingValue, string> {
  const out = {} as Record<RatingValue, string>;
  for (const r of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[]) {
    const { card } = scheduler.next(toFsrs(row), now, r);
    out[r as RatingValue] = formatInterval(card.due.getTime() - now.getTime());
  }
  return out;
}

export function formatInterval(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} phút`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} giờ`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d} ngày`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `${mo} tháng` : `${Math.round(d / 365)} năm`;
}

/** Thẻ được coi là "đã nhớ chắc" (dùng cho thống kê và mở thẻ nhớ chủ động). */
export const isMature = (row: Pick<CardRow, "state" | "scheduledDays">) => row.state === State.Review && row.scheduledDays >= 21;
export const isGraduated = (row: Pick<CardRow, "state">) => row.state === State.Review;

/**
 * Số từ mới được mở hôm nay: dừng hẳn khi hàng ôn đã vượt trần (người dễ nản bỏ cuộc khi thấy 300 thẻ chờ).
 * Từ mới giảm dần khi hàng ôn tiến gần trần.
 */
export function newWordsAllowed(opts: { dailyNew: number; reviewCap: number; dueCount: number; newDoneToday: number }): number {
  const { dailyNew, reviewCap, dueCount, newDoneToday } = opts;
  if (dueCount >= reviewCap) return 0;
  const room = reviewCap - dueCount;
  const scaled = room < reviewCap / 3 ? Math.ceil(dailyNew / 2) : dailyNew;
  return Math.max(0, scaled - newDoneToday);
}
