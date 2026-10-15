// Lộ trình 26 tuần đếm ngược tới ngày thi (bản research "Web app tự học tiếng Anh IELTS 3.0 → 6.5"). Thuần.
// 4 chặng, mỗi chặng chốt bằng một bài thi thử; lịch tuần xoay vòng kỹ năng để người học không phải tự quyết hôm nay học gì.

import { addDays } from "./day";

export const PLAN_WEEKS = 26;

export interface Phase {
  key: "nen-mong" | "tang-toc" | "ky-nang" | "nuoc-rut";
  name: string;
  from: number;
  to: number;
  /** Mức band của chặng, tính lùi từ band mục tiêu (T = 6.5 → 3.0→4.5, 4.5→5.5, 5.5→6.0, 6.0→6.5). */
  bandFrom: (t: number) => number;
  bandTo: (t: number) => number;
  focus: string[];
  /** Tỉ trọng thời gian (%): từ vựng + ngữ pháp / đọc + nghe / viết / đề bấm giờ. */
  split: { tuVungNguPhap: number; docNghe: number; viet: number; deBamGio: number };
}

export const PHASES: Phase[] = [
  { key: "nen-mong", name: "Nền móng", from: 1, to: 6, bandFrom: t => t - 3.5, bandTo: t => t - 2,
    focus: ["Làm bài kiểm tra từ vựng, học NGSL nhóm 1–2", "Lớp học: Essential Grammar in Use (thì, câu đơn, câu ghép)", "Đọc bài VOA \"Đọc nhẹ\"", "Chép chính tả câu ngắn", "Viết câu, đoạn 80 từ"],
    split: { tuVungNguPhap: 50, docNghe: 35, viet: 15, deBamGio: 0 } },
  { key: "tang-toc", name: "Tăng tốc", from: 7, to: 14, bandFrom: t => t - 2, bandTo: t => t - 1,
    focus: ["Hết NGSL, bắt đầu NAWL", "English Grammar in Use: mệnh đề, bị động (unit Study Guide báo yếu)", "VOA cấp 3, bài báo dễ", "Dạng câu hỏi IELTS cơ bản", "Task 2 bố cục 4 đoạn"],
    split: { tuVungNguPhap: 35, docNghe: 40, viet: 20, deBamGio: 5 } },
  { key: "ky-nang", name: "Kỹ năng IELTS", from: 15, to: 22, bandFrom: t => t - 1, bandTo: t => t - 0.5,
    focus: ["NAWL + từ theo chủ đề", "Bài báo nguyên bản", "Đề Cambridge bấm giờ", "2 bài Writing mỗi tuần", "Listening Section 3–4"],
    split: { tuVungNguPhap: 20, docNghe: 35, viet: 25, deBamGio: 20 } },
  { key: "nuoc-rut", name: "Nước rút", from: 23, to: 26, bandFrom: t => t - 0.5, bandTo: t => t,
    focus: ["Thi thử trọn đề mỗi tuần", "Ôn Sổ lỗi theo dạng câu", "Chỉ ôn, ngừng từ mới", "Nói thử với người thật", "Ngủ đủ tuần cuối"],
    split: { tuVungNguPhap: 10, docNghe: 10, viet: 20, deBamGio: 60 } },
];

export interface Gate { week: number; label: string; /** band L/R tối thiểu, tính theo band mục tiêu */ min: (t: number) => number; rule: string; ifFail: string }
export const GATES: Gate[] = [
  { week: 6, label: "Thi thử tuần 6", min: t => t - 2, rule: "Trung bình Listening + Reading", ifFail: "Ở lại chặng Nền móng thêm 1–2 tuần." },
  { week: 14, label: "Thi thử tuần 14", min: t => t - 1.5, rule: "Trung bình Listening + Reading", ifFail: "Mục tiêu trong 6 tháng không còn thực tế — lùi ngày thi 2–3 tháng thay vì ép tăng giờ." },
  { week: 22, label: "Thi thử tuần 22", min: t => t - 0.5, rule: "Cả Listening và Reading", ifFail: "Dồn 2 tuần vào dạng câu sai nhiều nhất trong Sổ lỗi." },
];

export interface PlanPosition {
  hasExam: boolean;
  daysLeft: number | null;
  /** 1–26. Trước khi vào cửa sổ 26 tuần (thi còn xa) vẫn coi là tuần 1. */
  week: number;
  phase: Phase;
  beforeWindow: boolean;
  afterExam: boolean;
  nextGate: (Gate & { weeksAway: number }) | null;
}

export function planPosition(examDate: string | null, today: string): PlanPosition {
  if (!examDate) return { hasExam: false, daysLeft: null, week: 1, phase: PHASES[0], beforeWindow: false, afterExam: false, nextGate: { ...GATES[0], weeksAway: GATES[0].week - 1 } };
  const daysLeft = Math.round((Date.parse(examDate + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400_000);
  const weeksLeft = Math.ceil(Math.max(daysLeft, 0) / 7);
  const raw = PLAN_WEEKS - weeksLeft + 1;
  const week = Math.min(PLAN_WEEKS, Math.max(1, raw));
  const phase = PHASES.find(p => week >= p.from && week <= p.to) ?? PHASES[PHASES.length - 1];
  const gate = GATES.find(g => g.week >= week);
  return {
    hasExam: true, daysLeft, week, phase, beforeWindow: raw < 1, afterExam: daysLeft < 0,
    nextGate: gate ? { ...gate, weeksAway: gate.week - week } : null,
  };
}

export interface DayBlock { skill: "doc" | "nghe" | "viet" | "thi-thu" | "nghi"; label: string; href: string; minutes: number; why: string }

/**
 * Khối kỹ năng chính của ngày (50 phút trong buổi 120 phút; 20 phút ôn thẻ + 20 phút ngữ pháp + 20 phút nghe nhẹ là cố định).
 * T2 Đọc · T3 Nghe · T4 Viết · T5 Đọc · T6 Nghe · T7 Viết (hoặc thi thử khi tới tuần mốc / chặng Nước rút) · CN nghỉ.
 */
export function dayBlock(today: string, pos: Pick<PlanPosition, "week" | "phase" | "nextGate">): DayBlock {
  const dow = new Date(today + "T00:00:00Z").getUTCDay(); // 0 = CN
  const mockDay = pos.phase.key === "nuoc-rut" || pos.nextGate?.weeksAway === 0;
  switch (dow) {
    case 1: case 4: return { skill: "doc", label: "Đọc", href: "/student/tieng-anh/doc", minutes: 50, why: "Một bài \"Vừa sức để học\" + câu hỏi đọc hiểu." };
    case 2: case 5: return { skill: "nghe", label: "Nghe", href: "/student/tieng-anh/nghe", minutes: 50, why: "Chép chính tả từng câu, rồi nói theo 3 lần." };
    case 3: return { skill: "viet", label: "Viết", href: "/student/tieng-anh/viet", minutes: 50, why: pos.phase.key === "nen-mong" ? "Viết câu và đoạn ngắn, sửa theo góp ý." : "Một bài Writing, đọc góp ý rồi viết lại." };
    case 6: return mockDay
      ? { skill: "thi-thu", label: "Thi thử", href: "/student/tieng-anh/thi-thu", minutes: 90, why: "Làm trọn một đề Listening hoặc Reading bấm giờ." }
      : { skill: "viet", label: "Viết", href: "/student/tieng-anh/viet", minutes: 50, why: "Bài Writing thứ hai trong tuần." };
    default: return { skill: "nghi", label: "Nghỉ", href: "/student/tieng-anh/tu-vung/on", minutes: 0, why: "Ngày nghỉ của tuần. Muốn thì chỉ ôn thẻ 10 phút." };
  }
}

/** Mốc thi thử đã qua mà chưa có bài thi thử nào sau thời điểm đó — để nhắc. */
export function gateDueDate(examDate: string, gate: Gate): string {
  return addDays(examDate, -(PLAN_WEEKS - gate.week + 1) * 7 + 7);
}

/** Tổng giờ học kế hoạch: 26 tuần × 6 ngày × số phút mỗi ngày. */
export function plannedHours(dailyMinutes: number): number {
  return Math.round((PLAN_WEEKS * 6 * dailyMinutes) / 60);
}
