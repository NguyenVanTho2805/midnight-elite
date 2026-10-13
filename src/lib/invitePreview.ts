// Xem trước lớp khi học sinh nhập mã mời (Figma 32:54): chữ lịch / học phí / số buổi đã học. PHẦN THUẦN — không đụng cơ sở dữ liệu.
// Nguyên tắc của màn này: học sinh phải thấy TÊN GIA SƯ và MỨC HỌC PHÍ trước khi bấm "Vào lớp này" (gõ nhầm một ký tự là vào nhầm lớp người khác).
import { DAY_LABELS_VI } from "@/lib/types";
import { pricePerSessionVnd, TUITION_TIER_VND } from "@/lib/tuition";

export interface SlotLite { dayOfWeek: number; startTime: string; endTime: string }

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Thứ 2 … Thứ 7, Chủ nhật cuối

function dayList(days: number[]): string {
  const names = days.map(d => DAY_LABELS_VI[d]);
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

/** "Thứ 3 & Thứ 5 · 19:30–21:30"; khác giờ thì tách nhóm: "Thứ 3 19:00–21:00 · Thứ 7 15:00–17:00". Rỗng → câu nói rõ chưa có lịch. */
export function scheduleLabel(slots: SlotLite[]): string {
  if (slots.length === 0) return "Gia sư chưa đặt lịch cố định";
  const byTime = new Map<string, number[]>();
  for (const s of [...slots].sort((a, b) => ORDER.indexOf(a.dayOfWeek) - ORDER.indexOf(b.dayOfWeek) || a.startTime.localeCompare(b.startTime))) {
    const k = `${s.startTime}–${s.endTime}`;
    const arr = byTime.get(k) ?? [];
    if (!arr.includes(s.dayOfWeek)) arr.push(s.dayOfWeek);
    byTime.set(k, arr);
  }
  const groups = [...byTime].map(([time, days]) => ({ time, days }));
  if (groups.length === 1) return `${dayList(groups[0].days)} · ${groups[0].time}`;
  return groups.map(g => `${dayList(g.days)} ${g.time}`).join(" · ");
}

const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;

export interface TuitionPreview { subjectCount: number; pricePerSession: number; override: boolean }

/** Số môn SAU KHI vào lớp này (các môn đang học của CÙNG gia sư + môn này) và đơn giá theo bậc thang (hoặc mức riêng của em). */
export function tuitionPreview(otherActiveSubjectsOfTutor: number, override: number | null): TuitionPreview {
  const subjectCount = Math.max(0, otherActiveSubjectsOfTutor) + 1;
  return { subjectCount, pricePerSession: pricePerSessionVnd(subjectCount, override), override: override != null && override >= 0 };
}

/** "55.000đ một buổi khi học 3 môn · tính theo tháng" / "… khi học 4 môn trở lên …" / "… (mức riêng của em) …". */
export function tuitionLabel(t: TuitionPreview): string {
  const tail = " · tính theo tháng";
  if (t.override) return `${vnd(t.pricePerSession)} một buổi (mức riêng của em)${tail}`;
  const top = Math.max(...Object.keys(TUITION_TIER_VND).map(Number));
  return `${vnd(t.pricePerSession)} một buổi khi học ${t.subjectCount >= top ? `${top} môn trở lên` : `${t.subjectCount} môn`}${tail}`;
}

export const taughtLabel = (n: number) => (n <= 0 ? "Chưa học buổi nào" : `${n} buổi`);
