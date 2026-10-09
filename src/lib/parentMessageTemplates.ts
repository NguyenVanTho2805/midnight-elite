// AS-197 (06/10/2026) — mẫu tin nhắn phụ huynh soạn từ dữ liệu đã có.
//
// Spec Thanh (dua-bang-tinh-len-web.md mục 5): "Giữ các mẫu tin của v7
// (chào, nhắc học phí 4 trường hợp, báo cáo môn, học thử, 6 tình huống)
// cộng TT-201, TT-202; hạn đóng một mốc trước ngày 20 (GD-04)".
//
// Mẫu tin trả về STRING thuần — gia sư copy sang Zalo gửi, hoặc hệ thống
// gửi tự động qua API Zalo sau. Dùng \n để xuống dòng.
//
// Giới hạn: không dùng ký tự đặc biệt gây lỗi hiển thị trên Zalo (quotes
// cong, emoji phức tạp). Giữ dấu Việt đầy đủ.

export interface StudentContext {
  studentName:  string;
  parentName?:  string;
}

export interface TuitionContext extends StudentContext {
  yearMonth:    string; // "2026-10"
  finalAmount:  number; // VND
  dueDate?:     Date;   // hạn đóng, mặc định 20 của tháng kế
  bankMemo:     string;
}

export interface AttendanceContext extends StudentContext {
  subjectName:  string;
  present:      number;
  total:        number;
}

function money(n: number): string { return n.toLocaleString("vi-VN") + "đ"; }
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  return `tháng ${Number(m)}/${y}`;
}
function dateLabel(d: Date): string {
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`;
}

// Phụ huynh xưng hô — nếu biết tên dùng "anh/chị <tên>", không thì
// "anh/chị" chung chung.
function salute(name?: string): string {
  if (!name?.trim()) return "Kính gửi anh/chị";
  return `Kính gửi anh/chị ${name.trim()}`;
}

// Nhắc đóng học phí — 4 trường hợp theo spec v7:
//   "tru-xa"    = còn > 7 ngày
//   "sap-han"   = ≤ 7 ngày
//   "qua-han"   = quá hạn
//   "da-dong"   = đã đóng → cảm ơn
export function tuitionReminderMessage(
  ctx: TuitionContext,
  kind: "tru-xa" | "sap-han" | "qua-han" | "da-dong",
): string {
  const head = salute(ctx.parentName);
  const sub  = monthLabel(ctx.yearMonth);
  const amt  = money(ctx.finalAmount);
  const due  = ctx.dueDate ? dateLabel(ctx.dueDate) : "trước ngày 20";

  if (kind === "da-dong") {
    return `${head},\nTrung tâm KiN đã nhận học phí ${sub} của em ${ctx.studentName}. Cảm ơn anh/chị đã ủng hộ.`;
  }
  if (kind === "qua-han") {
    return `${head},\nHọc phí ${sub} của em ${ctx.studentName} đã quá hạn ngày ${due}. Số tiền còn lại: ${amt}. Nội dung chuyển khoản: ${ctx.bankMemo}. Nhờ anh/chị thu xếp giúp em.`;
  }
  if (kind === "sap-han") {
    return `${head},\nHọc phí ${sub} của em ${ctx.studentName} là ${amt}, hạn đóng ngày ${due}. Nội dung chuyển khoản: ${ctx.bankMemo}.`;
  }
  // tru-xa
  return `${head},\nKiN gửi phiếu học phí ${sub} của em ${ctx.studentName}: ${amt}. Hạn đóng: ${due}. Nội dung chuyển khoản: ${ctx.bankMemo}.`;
}

// Báo cáo môn — tỉ lệ có mặt + thái độ (NV-186: tách Nỗ lực + Năng lực).
export function subjectReportMessage(ctx: AttendanceContext & {
  effort?: number;  // Nỗ lực /10
  mastery?: number; // Năng lực /10
}): string {
  const head = salute(ctx.parentName);
  const ratio = ctx.total > 0 ? Math.round((ctx.present / ctx.total) * 100) : 0;
  let msg = `${head},\nBáo cáo môn ${ctx.subjectName} của em ${ctx.studentName}:\n- Chuyên cần: ${ctx.present}/${ctx.total} buổi (${ratio}%).`;
  if (ctx.effort !== undefined)  msg += `\n- Nỗ lực: ${ctx.effort.toFixed(1)}/10 (chuyên cần + bài về nhà).`;
  if (ctx.mastery !== undefined) msg += `\n- Năng lực: ${ctx.mastery.toFixed(1)}/10 (3 bài kiểm tra gần nhất).`;
  return msg;
}

export function trialInvitationMessage(ctx: StudentContext & { subjectName: string; scheduleHint: string }): string {
  const head = salute(ctx.parentName);
  return `${head},\nKiN mời em ${ctx.studentName} học thử buổi đầu môn ${ctx.subjectName}: ${ctx.scheduleHint}. Buổi học thử miễn phí, không cần đăng ký trước. Chi tiết nhắn lại cho gia sư.`;
}
