import nodemailer, { type Transporter } from "nodemailer";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const FROM    = `KiN <${process.env.GMAIL_USER}>`;

// Gmail SMTP qua nodemailer — thay Resend (xem ghi chú trong .env). Gmail
// bắt buộc "From" phải trùng địa chỉ đã xác thực (GMAIL_USER), không dùng
// được domain tuỳ ý như noreply@midnightelite-edu.com nữa.
let transporter: Transporter | null = null;
// Chỉ để test cục bộ: đặt EMAIL_SINK_DIR thì thư KHÔNG gửi đi mà ghi thành tệp JSON {from,to,subject,text,html} vào thư mục đó.
// Môi trường thật không đặt biến này.
function sinkTransport(dir: string): Transporter {
  return {
    async sendMail(m: { from?: string; to?: string; subject?: string; text?: string; html?: string }) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${Date.now()}-${randomBytes(4).toString("hex")}.json`), JSON.stringify(m));
      return { messageId: "sink" };
    },
  } as unknown as Transporter;
}

function getTransport(): Transporter {
  if (process.env.EMAIL_SINK_DIR) return sinkTransport(process.env.EMAIL_SINK_DIR);
  if (!transporter) {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD chưa được cấu hình");
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }
  return transporter;
}

// ─── VERIFICATION ─────────────────────────────────────────────────────────────

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const link = `${APP_URL}/xac-thuc-email?token=${token}`;

  await getTransport().sendMail({
    from: FROM,
    to,
    subject: "Xác thực email — KiN",
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:40px auto;padding:0 16px">
    <div style="text-align:center;padding:32px 0 24px">
      <div style="display:inline-block;background:#0068FF;color:#fff;font-weight:900;font-size:20px;padding:10px 22px;border-radius:10px;letter-spacing:-0.3px">
        KiN
      </div>
      <p style="color:#a4a097;font-size:13px;margin:8px 0 0">Education Platform</p>
    </div>
    <div style="background:#ffffff;border-radius:16px;padding:36px 32px;border:1px solid #e5e3df">
      <h1 style="color:#1a1a1a;font-size:20px;font-weight:800;margin:0 0 8px;letter-spacing:-0.3px">Xin chào, ${name}!</h1>
      <p style="color:#787671;font-size:14px;line-height:1.6;margin:0 0 28px">
        Cảm ơn bạn đã đăng ký tài khoản tại <strong style="color:#0068FF">KiN</strong>.
        Bấm nút bên dưới để xác thực email và kích hoạt tài khoản.
      </p>
      <div style="text-align:center;margin:0 0 28px">
        <a href="${link}"
          style="display:inline-block;background:#0068FF;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px">
          Xác thực email ngay →
        </a>
      </div>
      <div style="background:#f6f5f4;border-radius:10px;padding:14px 16px;margin:0 0 20px;border:1px solid #e5e3df">
        <p style="color:#787671;font-size:12px;margin:0 0 6px">Nếu nút trên không hoạt động, copy link này:</p>
        <p style="margin:0;word-break:break-all"><a href="${link}" style="color:#0068FF;font-size:12px">${link}</a></p>
      </div>
      <p style="color:#a4a097;font-size:12px;margin:0">
        Link có hiệu lực trong <strong>24 giờ</strong>. Nếu bạn không đăng ký tài khoản này, hãy bỏ qua email này.
      </p>
    </div>
    <p style="text-align:center;color:#c8c4be;font-size:12px;margin:24px 0">© 2026 KiN</p>
  </div>
</body>
</html>`,
  });
}

// ─── PASSWORD RESET ────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const link = `${APP_URL}/dat-lai-mat-khau?token=${token}`;
  const safeName = escapeHtml(name);
  await getTransport().sendMail({
    from: FROM,
    to,
    subject: "Đặt lại mật khẩu KiN",
    text: `Xin chào ${name.replace(/[<>&"]/g, "")},\n\nBạn (hoặc ai đó) vừa xin đặt lại mật khẩu KiN. Mở link này để tạo mật khẩu mới:\n${link}\n\nLink sống 30 phút và chỉ dùng được một lần. Nếu không phải bạn, cứ bỏ qua email này: mật khẩu hiện tại vẫn nguyên và không ai vào được tài khoản của bạn.\n\nKiN`,
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:40px auto;padding:0 16px">
    <div style="padding:0 0 20px;text-align:center">
      <span style="font-size:24px;font-weight:800;color:#1e3a8a;letter-spacing:-0.3px">KiN</span>
      <p style="color:#6b7280;font-size:13px;margin:6px 0 0">Lớp học của bạn, gọn trong một chỗ</p>
    </div>
    <div style="background:#ffffff;border-radius:14px;padding:32px;border:1px solid #e6e9ef">
      <h1 style="color:#111827;font-size:18px;font-weight:700;margin:0 0 8px">Đặt lại mật khẩu</h1>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px">Xin chào ${safeName}, bạn vừa xin đặt lại mật khẩu KiN. Bấm nút dưới đây để tạo mật khẩu mới:</p>
      <div style="text-align:center;margin:0 0 24px">
        <a href="${link}" style="display:inline-block;background:#1e3a8a;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:13px 32px;border-radius:8px">Tạo mật khẩu mới</a>
      </div>
      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0 0 16px">
        Link sống <strong>30 phút</strong> và chỉ dùng được một lần. Nếu nút không mở được, dán đường dẫn này vào trình duyệt:
      </p>
      <p style="margin:0 0 20px;word-break:break-all"><a href="${link}" style="color:#2563eb;font-size:12px">${link}</a></p>
      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0">
        Nếu không phải bạn xin, cứ bỏ qua email này: mật khẩu hiện tại vẫn nguyên và không ai vào được tài khoản của bạn.
      </p>
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin:24px 0">© 2026 KiN</p>
  </div>
</body>
</html>`,
  });
}

/** Thư báo SAU khi mật khẩu đã đổi (đặt lại hoặc đổi trong hồ sơ): nếu không phải mình làm thì biết ngay để xử lý. */
export async function sendPasswordChangedEmail(to: string, name: string) {
  const safeName = escapeHtml(name);
  await getTransport().sendMail({
    from: FROM,
    to,
    subject: "Mật khẩu KiN của bạn vừa được đổi",
    text: `Xin chào ${name.replace(/[<>&"]/g, "")},\n\nMật khẩu tài khoản KiN của bạn vừa được đổi. Nếu là bạn thì không cần làm gì thêm.\n\nNếu KHÔNG phải bạn, hãy vào ${APP_URL}/quen-mat-khau để đặt lại mật khẩu ngay, rồi báo cho KiN qua hotline trên trang chủ.\n\nKiN`,
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:40px auto;padding:0 16px">
    <div style="padding:0 0 20px;text-align:center">
      <span style="font-size:24px;font-weight:800;color:#1e3a8a;letter-spacing:-0.3px">KiN</span>
    </div>
    <div style="background:#ffffff;border-radius:14px;padding:32px;border:1px solid #e6e9ef">
      <h1 style="color:#111827;font-size:18px;font-weight:700;margin:0 0 8px">Mật khẩu của bạn vừa được đổi</h1>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px">Xin chào ${safeName}, mật khẩu tài khoản KiN của bạn vừa được đổi. Nếu là bạn thì không cần làm gì thêm.</p>
      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0">
        Nếu <strong>không phải bạn</strong>, hãy <a href="${APP_URL}/quen-mat-khau" style="color:#2563eb">đặt lại mật khẩu ngay</a>, rồi báo cho KiN qua hotline ở chân trang chủ.
      </p>
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin:24px 0">© 2026 KiN</p>
  </div>
</body>
</html>`,
  });
}

// ─── MÃ ĐĂNG NHẬP 6 SỐ (TK-170) ───────────────────────────────────────────────

export async function sendLoginCodeEmail(to: string, name: string, code: string) {
  const safeName = name.replace(/[<>&"]/g, "");
  await getTransport().sendMail({
    from: FROM,
    to,
    subject: `${code} là mã đăng nhập KiN của bạn`,
    text: `Xin chào ${safeName},\n\nMã đăng nhập KiN của bạn: ${code}\n\nMã sống 10 phút và chỉ dùng được một lần. Nếu không phải bạn vừa xin mã, cứ bỏ qua email này: không ai vào được tài khoản nếu thiếu mã.\n\nKiN`,
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f8fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:480px;margin:40px auto;padding:0 16px">
    <div style="padding:0 0 20px;text-align:center">
      <span style="font-size:24px;font-weight:800;color:#1e3a8a;letter-spacing:-0.3px">KiN</span>
      <p style="color:#6b7280;font-size:13px;margin:6px 0 0">Lớp học của bạn, gọn trong một chỗ</p>
    </div>
    <div style="background:#ffffff;border-radius:14px;padding:32px;border:1px solid #e6e9ef">
      <h1 style="color:#111827;font-size:18px;font-weight:700;margin:0 0 8px">Mã đăng nhập của bạn</h1>
      <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 20px">Xin chào ${safeName}, nhập mã này vào trang đăng nhập KiN:</p>
      <div style="text-align:center;background:#eff4ff;border-radius:10px;padding:18px 0;margin:0 0 20px">
        <span style="font-family:'SFMono-Regular',Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#1e3a8a">${code}</span>
      </div>
      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0">
        Mã sống <strong>10 phút</strong> và chỉ dùng được một lần. Nếu không phải bạn vừa xin mã, cứ bỏ qua email này: không ai vào được tài khoản nếu thiếu mã.
      </p>
    </div>
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin:24px 0">© 2026 KiN</p>
  </div>
</body>
</html>`,
  });
}

// ─── REMINDER ─────────────────────────────────────────────────────────────────

export async function sendReminderEmail(to: string, name: string, message: string) {

  await getTransport().sendMail({
    from: FROM,
    to,
    subject: "Nhắc nhở học tập — KiN",
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:40px auto;padding:0 16px">
    <div style="text-align:center;padding:32px 0 24px">
      <div style="display:inline-block;background:#0068FF;color:#fff;font-weight:900;font-size:20px;padding:10px 22px;border-radius:10px;letter-spacing:-0.3px">KiN</div>
      <p style="color:#a4a097;font-size:13px;margin:8px 0 0">Education Platform</p>
    </div>
    <div style="background:#ffffff;border-radius:16px;padding:36px 32px;border:1px solid #e5e3df">
      <h1 style="color:#1a1a1a;font-size:20px;font-weight:800;margin:0 0 6px;text-align:center;letter-spacing:-0.3px">Nhắc nhở từ thầy/cô</h1>
      <p style="color:#787671;font-size:14px;text-align:center;margin:0 0 24px">Xin chào <strong style="color:#1a1a1a">${name}</strong></p>
      <div style="background:#f6f5f4;border-radius:10px;padding:20px 24px;margin-bottom:24px;border:1px solid #e5e3df">
        <p style="color:#1a1a1a;font-size:14px;line-height:1.75;margin:0;white-space:pre-wrap">${message}</p>
      </div>
      <div style="text-align:center">
        <a href="${APP_URL}/student/hoc-tap" style="display:inline-block;background:#0068FF;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px">
          Vào học ngay →
        </a>
      </div>
    </div>
    <p style="text-align:center;color:#c8c4be;font-size:12px;margin:24px 0">© 2026 KiN</p>
  </div>
</body>
</html>`,
  });
}

// ─── EXAM REMINDER ────────────────────────────────────────────────────────────

export async function sendExamReminderEmail(
  to: string,
  name: string,
  examTitle: string,
  examDate: string,
  examTime: string,
  azotaUrl: string | null,
) {
  const [y, m, d]   = examDate.split("-");
  const dateVi       = `${d}/${m}/${y}`;

  await getTransport().sendMail({
    from: FROM,
    to,
    subject: `Nhắc lịch thi ngày mai — ${examTitle}`,
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:40px auto;padding:0 16px">
    <div style="text-align:center;padding:32px 0 24px">
      <div style="display:inline-block;background:#0068FF;color:#fff;font-weight:900;font-size:20px;padding:10px 22px;border-radius:10px;letter-spacing:-0.3px">
        KiN
      </div>
      <p style="color:#a4a097;font-size:13px;margin:8px 0 0">Education Platform</p>
    </div>
    <div style="background:#ffffff;border-radius:16px;padding:36px 32px;border:1px solid #e5e3df">
      <div style="text-align:center;margin-bottom:20px">
        <div style="width:56px;height:56px;background:#dbeafe;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:26px;border:1px solid #bfdbfe">📋</div>
      </div>
      <h1 style="color:#1a1a1a;font-size:20px;font-weight:800;margin:0 0 6px;text-align:center;letter-spacing:-0.3px">
        Nhắc lịch thi ngày mai
      </h1>
      <p style="color:#787671;font-size:14px;text-align:center;margin:0 0 24px">
        Xin chào <strong style="color:#1a1a1a">${name}</strong>, bạn có kỳ thi vào ngày mai!
      </p>
      <div style="background:#f6f5f4;border-radius:12px;padding:20px 24px;margin-bottom:24px;border:1px solid #e5e3df">
        <p style="color:#a4a097;font-size:11px;font-weight:700;margin:0 0 12px;letter-spacing:0.5px">THÔNG TIN KỲ THI</p>
        <p style="color:#1a1a1a;font-size:16px;font-weight:800;margin:0 0 14px;letter-spacing:-0.2px">${examTitle}</p>
        <div style="display:flex;gap:24px">
          <div>
            <p style="color:#a4a097;font-size:11px;margin:0 0 2px">Ngày thi</p>
            <p style="color:#0068FF;font-size:14px;font-weight:700;margin:0">${dateVi}</p>
          </div>
          <div>
            <p style="color:#a4a097;font-size:11px;margin:0 0 2px">Giờ thi</p>
            <p style="color:#0068FF;font-size:14px;font-weight:700;margin:0">${examTime}</p>
          </div>
        </div>
      </div>
      <div style="background:#fff7ed;border-radius:10px;padding:14px 16px;margin-bottom:24px;border:1px solid #fed7aa">
        <p style="color:#9a3412;font-size:13px;margin:0">
          ⚠️ Hãy chuẩn bị đầy đủ: bút, giấy nháp, máy tính (nếu được phép), và đăng nhập đúng giờ.
        </p>
      </div>
      <div style="text-align:center">
        ${azotaUrl
          ? `<a href="${azotaUrl}" style="display:inline-block;background:#0068FF;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px">
              Vào phòng thi →
            </a>`
          : `<a href="${APP_URL}/thi-thu" style="display:inline-block;background:#0068FF;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px">
              Xem lịch thi →
            </a>`
        }
      </div>
    </div>
    <p style="text-align:center;color:#c8c4be;font-size:12px;margin:24px 0">© 2026 KiN</p>
  </div>
</body>
</html>`,
  });
}

// ─── CLASS REMINDER (buổi học ngày mai, xem /api/cron/remind-class) ──────────

export async function sendClassReminderEmail(
  to: string,
  name: string,
  courseName: string,
  dayLabel: string,
  startTime: string,
  endTime: string,
  note: string | null,
  courseId: string,
) {
  await getTransport().sendMail({
    from: FROM,
    to,
    subject: `Nhắc lịch học ngày mai — ${courseName}`,
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:40px auto;padding:0 16px">
    <div style="text-align:center;padding:32px 0 24px">
      <div style="display:inline-block;background:#0068FF;color:#fff;font-weight:900;font-size:20px;padding:10px 22px;border-radius:10px;letter-spacing:-0.3px">
        KiN
      </div>
      <p style="color:#a4a097;font-size:13px;margin:8px 0 0">Education Platform</p>
    </div>
    <div style="background:#ffffff;border-radius:16px;padding:36px 32px;border:1px solid #e5e3df">
      <div style="text-align:center;margin-bottom:20px">
        <div style="width:56px;height:56px;background:#dbeafe;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:26px;border:1px solid #bfdbfe">🎥</div>
      </div>
      <h1 style="color:#1a1a1a;font-size:20px;font-weight:800;margin:0 0 6px;text-align:center;letter-spacing:-0.3px">
        Nhắc lịch học ngày mai
      </h1>
      <p style="color:#787671;font-size:14px;text-align:center;margin:0 0 24px">
        Xin chào <strong style="color:#1a1a1a">${name}</strong>, bạn có buổi học vào ngày mai!
      </p>
      <div style="background:#f6f5f4;border-radius:12px;padding:20px 24px;margin-bottom:24px;border:1px solid #e5e3df">
        <p style="color:#a4a097;font-size:11px;font-weight:700;margin:0 0 12px;letter-spacing:0.5px">THÔNG TIN BUỔI HỌC</p>
        <p style="color:#1a1a1a;font-size:16px;font-weight:800;margin:0 0 14px;letter-spacing:-0.2px">${courseName}</p>
        <div style="display:flex;gap:24px">
          <div>
            <p style="color:#a4a097;font-size:11px;margin:0 0 2px">Ngày học</p>
            <p style="color:#0068FF;font-size:14px;font-weight:700;margin:0">${dayLabel}</p>
          </div>
          <div>
            <p style="color:#a4a097;font-size:11px;margin:0 0 2px">Giờ học</p>
            <p style="color:#0068FF;font-size:14px;font-weight:700;margin:0">${startTime} – ${endTime}</p>
          </div>
        </div>
        ${note ? `<p style="color:#787671;font-size:13px;margin:14px 0 0">${note}</p>` : ""}
      </div>
      <div style="text-align:center">
        <a href="${APP_URL}/student/hoc-tap?course=${courseId}" style="display:inline-block;background:#0068FF;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px">
          Vào học ngay →
        </a>
      </div>
    </div>
    <p style="text-align:center;color:#c8c4be;font-size:12px;margin:24px 0">© 2026 KiN</p>
  </div>
</body>
</html>`,
  });
}

// ─── ENROLLMENT (kích hoạt khoá học) ──────────────────────────────────────────

export async function sendEnrollmentEmail(
  to: string,
  name: string,
  studentId: number | null,
  courseName: string,
  courseId: string,
  instructor: string,
  openDate: string,
  zaloGroupLink: string | null,
) {
  const studentCode  = studentId ? `HS-${studentId}` : null;

  await getTransport().sendMail({
    from: FROM,
    to,
    subject: `Khóa học "${courseName}" đã được kích hoạt — KiN`,
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:40px auto;padding:0 16px">
    <div style="text-align:center;padding:32px 0 24px">
      <div style="display:inline-block;background:#0068FF;color:#fff;font-weight:900;font-size:20px;padding:10px 22px;border-radius:10px;letter-spacing:-0.3px">
        KiN
      </div>
      <p style="color:#a4a097;font-size:13px;margin:8px 0 0">Education Platform</p>
    </div>
    <div style="background:#ffffff;border-radius:16px;padding:36px 32px;border:1px solid #e5e3df">
      <div style="text-align:center;margin-bottom:20px">
        <div style="width:56px;height:56px;background:#dcfce7;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:26px;border:1px solid #bbf7d0">🎓</div>
      </div>
      <h1 style="color:#1a1a1a;font-size:20px;font-weight:800;margin:0 0 6px;text-align:center;letter-spacing:-0.3px">
        Khóa học đã được kích hoạt
      </h1>
      <p style="color:#787671;font-size:14px;text-align:center;margin:0 0 24px">
        Xin chào <strong style="color:#1a1a1a">${name}</strong>, chào mừng bạn đến với khóa học
      </p>

      <div style="background:#f6f5f4;border-radius:12px;padding:20px 24px;margin-bottom:20px;border:1px solid #e5e3df">
        <p style="color:#a4a097;font-size:11px;font-weight:700;margin:0 0 8px;letter-spacing:0.5px">KHÓA HỌC</p>
        <p style="color:#1a1a1a;font-size:16px;font-weight:800;margin:0 0 14px;letter-spacing:-0.2px">${courseName}</p>
        <div style="display:flex;gap:24px">
          <div>
            <p style="color:#a4a097;font-size:11px;margin:0 0 2px">Gia sư</p>
            <p style="color:#1a1a1a;font-size:14px;font-weight:700;margin:0">${instructor}</p>
          </div>
          <div>
            <p style="color:#a4a097;font-size:11px;margin:0 0 2px">Khai giảng</p>
            <p style="color:#1a1a1a;font-size:14px;font-weight:700;margin:0">${openDate}</p>
          </div>
        </div>
      </div>

      ${studentCode ? `
      <div style="background:#0068FF;border-radius:12px;padding:18px 24px;margin-bottom:20px;text-align:center">
        <p style="color:#bfdbfe;font-size:11px;font-weight:700;margin:0 0 6px;letter-spacing:0.5px">🏆 MÃ HỌC VIÊN CỦA BẠN</p>
        <p style="color:#fff;font-size:22px;font-weight:900;margin:0;letter-spacing:1px">${studentCode}</p>
      </div>` : ""}

      ${zaloGroupLink ? `
      <div style="background:#ecfdf5;border-radius:10px;padding:16px 20px;margin-bottom:16px;border:1px solid #a7f3d0">
        <p style="color:#065f46;font-size:13px;font-weight:700;margin:0 0 10px">📱 Bước 1 — Tham gia nhóm Zalo lớp học</p>
        <p style="color:#047857;font-size:12px;margin:0 0 12px">Vào nhóm để nhận tài liệu, lịch học và thông báo từ gia sư.</p>
        <a href="${zaloGroupLink}" style="display:inline-block;background:#16a34a;color:#fff;font-size:13px;font-weight:700;text-decoration:none;padding:10px 20px;border-radius:8px">
          Vào nhóm Zalo lớp →
        </a>
      </div>` : ""}

      <div style="text-align:center;margin-top:24px">
        <a href="${APP_URL}/student/hoc-tap?course=${courseId}" style="display:inline-block;background:#0068FF;color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px">
          Vào học ngay →
        </a>
      </div>
    </div>
    <p style="text-align:center;color:#c8c4be;font-size:12px;margin:24px 0">© 2026 KiN</p>
  </div>
</body>
</html>`,
  });
}

// ─── PARENT CONSENT ───────────────────────────────────────────────────────────

// Tên do người dùng tự đặt → phải escape trước khi chèn vào HTML email, nếu
// không học viên đặt tên là thẻ <a> giả mạo sẽ hiện trong email thật.
function escapeHtml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function sendParentConsentEmail(
  to: string,
  parentName: string,
  studentName: string,
  courseName: string,
  token: string,
) {
  const link = `${APP_URL}/xac-nhan-phu-huynh?token=${encodeURIComponent(token)}`;
  const subject = `Yêu cầu xác nhận cho con bạn tham gia lớp "${courseName}" — KiN`;
  parentName  = escapeHtml(parentName);
  studentName = escapeHtml(studentName);
  courseName  = escapeHtml(courseName);

  await getTransport().sendMail({
    from: FROM,
    to,
    subject,
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:40px auto;padding:0 16px">
    <div style="text-align:center;padding:32px 0 24px">
      <div style="display:inline-block;background:#0068FF;color:#fff;font-weight:900;font-size:20px;padding:10px 22px;border-radius:10px;letter-spacing:-0.3px">KiN</div>
      <p style="color:#a4a097;font-size:13px;margin:8px 0 0">Education Platform</p>
    </div>
    <div style="background:#ffffff;border-radius:16px;padding:36px 32px;border:1px solid #e5e3df">
      <h1 style="color:#1a1a1a;font-size:20px;font-weight:800;margin:0 0 8px;letter-spacing:-0.3px">Yêu cầu xác nhận từ phụ huynh</h1>
      <p style="color:#787671;font-size:14px;line-height:1.6;margin:0 0 8px">Xin chào <strong>${parentName}</strong>,</p>
      <p style="color:#787671;font-size:14px;line-height:1.6;margin:0 0 28px">
        Con của bạn — <strong>${studentName}</strong> — đang đăng ký tham gia lớp <strong>"${courseName}"</strong> trên KiN.
        Vì hệ thống đang ghi nhận học viên dưới ngưỡng tuổi cần phụ huynh đồng ý, vui lòng xác nhận bên dưới.
        Link chỉ có hiệu lực trong <strong>7 ngày</strong> và chỉ dùng được 1 lần.
      </p>
      <div style="text-align:center;margin:0 0 28px">
        <a href="${link}" style="display:inline-block;background:#0068FF;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px">
          Xem yêu cầu và xác nhận →
        </a>
      </div>
      <div style="background:#f6f5f4;border-radius:10px;padding:14px 16px;margin:0 0 20px;border:1px solid #e5e3df">
        <p style="color:#787671;font-size:12px;margin:0 0 6px">Nếu nút trên không hoạt động, copy link này:</p>
        <p style="margin:0;word-break:break-all"><a href="${link}" style="color:#0068FF;font-size:12px">${link}</a></p>
      </div>
      <p style="color:#a4a097;font-size:12px;margin:0">Nếu bạn không nhận ra yêu cầu này, hãy bỏ qua email hoặc từ chối trong trang xác nhận.</p>
    </div>
    <p style="text-align:center;color:#c8c4be;font-size:12px;margin:24px 0">© 2026 KiN</p>
  </div>
</body>
</html>`,
  });
}
