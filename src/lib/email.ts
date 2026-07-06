import { Resend } from "resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const FROM    = "Midnight Elite <noreply@midnightelite-edu.com>";

let resendClient: Resend | null = null;
function getResend() {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY chưa được cấu hình");
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// ─── VERIFICATION ─────────────────────────────────────────────────────────────

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const link = `${APP_URL}/xac-thuc-email?token=${token}`;

  await getResend().emails.send({
    from: FROM,
    to,
    subject: "Xác thực email — Midnight Elite",
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:40px auto;padding:0 16px">
    <div style="text-align:center;padding:32px 0 24px">
      <div style="display:inline-block;background:#0068FF;color:#fff;font-weight:900;font-size:20px;padding:10px 22px;border-radius:10px;letter-spacing:-0.3px">
        Midnight Elite
      </div>
      <p style="color:#a4a097;font-size:13px;margin:8px 0 0">Education Platform</p>
    </div>
    <div style="background:#ffffff;border-radius:16px;padding:36px 32px;border:1px solid #e5e3df">
      <h1 style="color:#1a1a1a;font-size:20px;font-weight:800;margin:0 0 8px;letter-spacing:-0.3px">Xin chào, ${name}!</h1>
      <p style="color:#787671;font-size:14px;line-height:1.6;margin:0 0 28px">
        Cảm ơn bạn đã đăng ký tài khoản tại <strong style="color:#0068FF">Midnight Elite</strong>.
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
        <p style="color:#0068FF;font-size:12px;margin:0;word-break:break-all">${link}</p>
      </div>
      <p style="color:#a4a097;font-size:12px;margin:0">
        Link có hiệu lực trong <strong>24 giờ</strong>. Nếu bạn không đăng ký tài khoản này, hãy bỏ qua email này.
      </p>
    </div>
    <p style="text-align:center;color:#c8c4be;font-size:12px;margin:24px 0">© 2026 Midnight Elite</p>
  </div>
</body>
</html>`,
  });
}

// ─── PASSWORD RESET ────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const link = `${APP_URL}/dat-lai-mat-khau?token=${token}`;

  await getResend().emails.send({
    from: FROM,
    to,
    subject: "Đặt lại mật khẩu — Midnight Elite",
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:40px auto;padding:0 16px">
    <div style="text-align:center;padding:32px 0 24px">
      <div style="display:inline-block;background:#0068FF;color:#fff;font-weight:900;font-size:20px;padding:10px 22px;border-radius:10px;letter-spacing:-0.3px">Midnight Elite</div>
      <p style="color:#a4a097;font-size:13px;margin:8px 0 0">Education Platform</p>
    </div>
    <div style="background:#ffffff;border-radius:16px;padding:36px 32px;border:1px solid #e5e3df">
      <h1 style="color:#1a1a1a;font-size:20px;font-weight:800;margin:0 0 8px;letter-spacing:-0.3px">Đặt lại mật khẩu</h1>
      <p style="color:#787671;font-size:14px;line-height:1.6;margin:0 0 8px">Xin chào <strong>${name}</strong>,</p>
      <p style="color:#787671;font-size:14px;line-height:1.6;margin:0 0 28px">
        Chúng tôi nhận được yêu cầu đặt lại mật khẩu. Bấm nút bên dưới để tạo mật khẩu mới.
        Link chỉ có hiệu lực trong <strong>1 giờ</strong>.
      </p>
      <div style="text-align:center;margin:0 0 28px">
        <a href="${link}" style="display:inline-block;background:#dc2626;color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:10px">
          Đặt lại mật khẩu →
        </a>
      </div>
      <div style="background:#f6f5f4;border-radius:10px;padding:14px 16px;margin:0 0 20px;border:1px solid #e5e3df">
        <p style="color:#787671;font-size:12px;margin:0 0 6px">Nếu nút trên không hoạt động, copy link này:</p>
        <p style="color:#0068FF;font-size:12px;margin:0;word-break:break-all">${link}</p>
      </div>
      <p style="color:#a4a097;font-size:12px;margin:0">Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
    </div>
    <p style="text-align:center;color:#c8c4be;font-size:12px;margin:24px 0">© 2026 Midnight Elite</p>
  </div>
</body>
</html>`,
  });
}

// ─── REMINDER ─────────────────────────────────────────────────────────────────

export async function sendReminderEmail(to: string, name: string, message: string) {

  await getResend().emails.send({
    from: FROM,
    to,
    subject: "Nhắc nhở học tập — Midnight Elite",
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:40px auto;padding:0 16px">
    <div style="text-align:center;padding:32px 0 24px">
      <div style="display:inline-block;background:#0068FF;color:#fff;font-weight:900;font-size:20px;padding:10px 22px;border-radius:10px;letter-spacing:-0.3px">Midnight Elite</div>
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
    <p style="text-align:center;color:#c8c4be;font-size:12px;margin:24px 0">© 2026 Midnight Elite</p>
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

  await getResend().emails.send({
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
        Midnight Elite
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
    <p style="text-align:center;color:#c8c4be;font-size:12px;margin:24px 0">© 2026 Midnight Elite</p>
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

  await getResend().emails.send({
    from: FROM,
    to,
    subject: `Khóa học "${courseName}" đã được kích hoạt — Midnight Elite`,
    html: `
<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:520px;margin:40px auto;padding:0 16px">
    <div style="text-align:center;padding:32px 0 24px">
      <div style="display:inline-block;background:#0068FF;color:#fff;font-weight:900;font-size:20px;padding:10px 22px;border-radius:10px;letter-spacing:-0.3px">
        Midnight Elite
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
    <p style="text-align:center;color:#c8c4be;font-size:12px;margin:24px 0">© 2026 Midnight Elite</p>
  </div>
</body>
</html>`,
  });
}
