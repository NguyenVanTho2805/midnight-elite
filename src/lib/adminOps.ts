// Quản trị: phần THUẦN (không DB, không React) cho ba trang QT-02 Nhật ký, QT-03 Triển khai và hạn mức, QT-04 Hôm nay cần làm gì.
// Nguyên tắc cứng:
//  • Cờ triển khai chỉ HIỂN THỊ (bật/tắt + chữ giải thích), KHÔNG bao giờ trả GIÁ TRỊ biến môi trường (CRON_SECRET chỉ hiện "đã đặt / chưa đặt").
//  • Nhật ký kiểm toán KHÔNG hiện tên, SĐT, ngày sinh của trẻ: người thực hiện chỉ hiện TÊN khi là nhân sự (role admin), còn lại chỉ hiện vai.
//    Phần `metadata` của AuditLog không bao giờ được đưa ra giao diện (có thể chứa tên học sinh).
//  • Không bịa số liệu: mục chưa có dữ liệu thật thì ghi "chưa có".
import { isTrialMode } from "@/lib/trialMode";
import { isPlanEnforced } from "@/lib/planLimits";
import { ROLE_PERMISSIONS, type AdminRole, type Permission } from "@/lib/permissions";
import { addDaysKey, hmOf, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";

type Env = Record<string, string | undefined>;

// ── QT-03: cờ triển khai ──────────────────────────────────────────────────────────────────────────
export interface FlagView { key: string; label: string; on: boolean; state: string; note: string }

/** Các cờ đang đọc từ môi trường chạy. Chỉ để XEM: không có nút đổi (đổi ở Vercel, rồi triển khai lại). */
export function deployFlags(env: Env = process.env): FlagView[] {
  const preview = env.VERCEL_ENV === "preview";
  const trial = isTrialMode(env);
  const enforce = isPlanEnforced(env);
  const push = env.PUSH_ENABLED === "1" && !preview;
  const cron = !!env.CRON_SECRET;
  return [
    { key: "KIN_TRIAL_MODE", label: "Miễn phí toàn bộ (chạy thử)", on: trial, state: trial ? "Đang bật" : "Đang tắt",
      note: trial ? "Chưa ai cần mua gói hay nạp Coin; các đường tính tiền hiện thông báo miễn phí." : "Các đường mua gói và nạp Coin hoạt động như thiết kế." },
    { key: "KIN_PLAN_ENFORCE", label: "Áp hạn mức gói", on: enforce, state: enforce ? "Đang bật" : "Đang tắt",
      note: enforce ? "Chỉ chặn TẠO MỚI khi chạm trần; lớp, điểm danh, phiếu và xuất dữ liệu luôn giữ nguyên." : preview && env.KIN_PLAN_ENFORCE === "1" ? "Bản xem trước luôn tắt, dù biến đã đặt." : "Không ai bị chặn; hệ thống chỉ ghi số đo để chọn thời điểm bật." },
    { key: "PUSH_ENABLED", label: "Thông báo đẩy", on: push, state: push ? "Đang bật" : "Đang tắt",
      note: push ? "Gửi thật tới thiết bị gia sư đã bật; giờ yên lặng 22:00–07:00 giờ Việt Nam." : "Không gửi tin đẩy nào." },
    { key: "CRON_SECRET", label: "Khoá gọi tác vụ định kỳ", on: cron, state: cron ? "Đã đặt" : "Chưa đặt",
      note: cron ? "Tác vụ định kỳ chỉ chạy khi gọi kèm khoá đúng." : cronSecretMissingIsFatal(env) ? "Chưa đặt: tác vụ định kỳ đang bị từ chối (503) cho tới khi đặt khoá." : "Chưa đặt: chỉ được phép khi chạy máy thử, bản chạy thật sẽ từ chối." },
  ];
}

export interface DeployEnvView { label: string; text: string }
export function deployEnv(env: Env = process.env): DeployEnvView {
  const v = env.VERCEL_ENV;
  if (v === "production") return { label: "Bản chạy thật", text: "Production" };
  if (v === "preview") return { label: "Bản xem trước", text: "Preview: mọi đường ghi liên quan tiền bị chặn, tin đẩy tắt" };
  if (v === "development") return { label: "Môi trường phát triển Vercel", text: "Development" };
  return { label: "Máy thử cục bộ", text: env.NODE_ENV === "production" ? "Chạy bản dựng, ngoài Vercel" : "Chế độ phát triển" };
}

/** Bản chạy thật mà thiếu CRON_SECRET thì tác vụ định kỳ phải ĐÓNG (trước đây thiếu khoá là mở công khai). Máy thử vẫn chạy được. */
export function cronSecretMissingIsFatal(env: Env = process.env): boolean {
  return env.VERCEL_ENV === "production" || env.NODE_ENV === "production";
}

// ── QT-03: lần gọi tác vụ định kỳ gần nhất ───────────────────────────────────────────────────────
export interface CronJobDef { key: string; label: string; path: string; schedule: string; maxGapHours: number }
/** Khớp vercel.json: cả năm chạy mỗi ngày (23:30, 0:00, 0:30 và 1:00 UTC). Quá `maxGapHours` mà chưa thấy gọi thì báo "chậm". */
export const CRON_JOBS: readonly CronJobDef[] = [
  { key: "remind-exam", label: "Nhắc kỳ thi ngày mai", path: "/api/cron/remind-exam", schedule: "Mỗi ngày 07:00 giờ VN", maxGapHours: 36 },
  { key: "remind-class", label: "Nhắc lịch học và tin buổi chưa điểm danh", path: "/api/cron/remind-class", schedule: "Mỗi ngày 07:00 giờ VN", maxGapHours: 36 },
  { key: "expire-tutor-subscriptions", label: "Hết hạn gói VIP gia sư", path: "/api/cron/expire-tutor-subscriptions", schedule: "Mỗi ngày 08:00 giờ VN", maxGapHours: 36 },
  { key: "pro-renewal-reminders", label: "Nhắc gia hạn gói KiN Pro", path: "/api/cron/pro-renewal-reminders", schedule: "Mỗi ngày 07:30 giờ VN", maxGapHours: 36 },
  { key: "english-voa", label: "Lấy bài VOA Learning English", path: "/api/cron/english-voa", schedule: "Mỗi ngày 06:30 giờ VN", maxGapHours: 36 },
];
export const cronSettingKey = (job: string) => `cron.${job}.lastCall`;

export type CronTone = "xong" | "cho" | "mo";
export interface CronView { key: string; label: string; schedule: string; lastText: string; status: string; tone: CronTone }

const dm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
export function whenText(at: Date, now: Date): string {
  const k = vnDateKeyOf(at), today = vnDateKeyOf(now);
  const hm = hmOf(vnMinutesOfDay(at));
  return k === today ? `hôm nay ${hm}` : k === addDaysKey(today, -1) ? `hôm qua ${hm}` : `${dm(k)} ${hm}`;
}

/** `raw` = giá trị đã lưu (ISO) hoặc null/rác. Chưa có lần nào hoặc giá trị hỏng đều nói là "chưa ghi nhận", không đoán. */
export function cronView(job: CronJobDef, raw: string | null | undefined, now: Date): CronView {
  const base = { key: job.key, label: job.label, schedule: job.schedule };
  const t = raw ? new Date(raw) : null;
  if (!t || Number.isNaN(t.getTime())) return { ...base, lastText: "Chưa ghi nhận lần nào", status: "Chưa ghi nhận", tone: "mo" };
  const ageH = (now.getTime() - t.getTime()) / 3_600_000;
  const late = ageH > job.maxGapHours;
  return { ...base, lastText: `Gọi gần nhất ${whenText(t, now)}`, status: late ? "Chậm so với lịch" : "Đúng lịch", tone: late ? "cho" : "xong" };
}

// ── QT-02: nhật ký kiểm toán ─────────────────────────────────────────────────────────────────────
const ACTION_LABEL: Record<string, string> = {
  "user.role_change": "Đổi vai người dùng",
  "tutor.approve": "Duyệt hồ sơ gia sư", "tutor.reject": "Từ chối hồ sơ gia sư",
  "profile_report.lock": "Khoá hồ sơ công khai sau báo cáo", "profile_report.dismiss": "Bỏ qua báo cáo hồ sơ", "profile_lock.remove": "Mở khoá hồ sơ công khai",
  "coin_topup.request": "Yêu cầu nạp Coin", "coin_topup.approve": "Duyệt nạp Coin", "coin_topup.reject": "Từ chối nạp Coin",
  "pro_order.create": "Tạo yêu cầu gói Pro", "pro_order.activate": "Kích hoạt gói Pro", "pro_order.cancel": "Huỷ yêu cầu gói Pro", "pro_order.grant_legacy": "Tặng Pro cho gia sư hiện có", "pro_config.update": "Sửa cấu hình gói Pro",
  "tutor_subscription.expire": "Hết hạn gói VIP gia sư",
  "student_profile.create": "Tạo hồ sơ học sinh", "student_profile.update": "Sửa hồ sơ học sinh", "student_profile.delete": "Xoá hồ sơ học sinh", "student_profile.import": "Nhập danh sách học sinh",
  "student_profile.consent": "Ghi đồng ý hồ sơ học sinh", "student_profile.revoke": "Rút đồng ý hồ sơ học sinh",
  "parent_link.verify": "Xác nhận liên kết phụ huynh", "parent_link.revoke": "Gỡ liên kết phụ huynh",
  "parent_consent.approved": "Phụ huynh đồng ý", "parent_consent.rejected": "Phụ huynh từ chối", "parent_consent.expired": "Yêu cầu đồng ý hết hạn",
  "self_consent.grant": "Học sinh tự đồng ý", "self_consent.revoke": "Học sinh rút đồng ý",
  "invoice.issue": "Chốt phiếu học phí", "invoice.cancel": "Huỷ phiếu học phí", "invoice.restore": "Khôi phục phiếu học phí", "invoice.record_payment": "Ghi nhận thanh toán phiếu",
  "enrollment.create": "Thêm học viên vào lớp", "class_invite.create": "Tạo mã mời lớp", "class_invite.redeem": "Dùng mã mời lớp", "class_invite.revoke": "Thu hồi mã mời lớp",
  "class_session.cancel": "Báo nghỉ buổi học", "class_session.move": "Dời buổi học", "class_session.restore": "Khôi phục buổi học",
  "attendance_session.create": "Tạo phiên điểm danh", "attendance_session.update": "Sửa phiên điểm danh", "attendance_session.delete": "Xoá phiên điểm danh",
  "bank_tx.resolve": "Đối soát giao dịch ngân hàng", "bank_tx.reverse": "Hoàn tác đối soát ngân hàng",
  "site_content.update": "Sửa nội dung trang chủ",
  "payout_account.update": "Sửa tài khoản nhận tiền", "payout_account.webhook_key_rotate": "Đổi khoá webhook nhận tiền",
  // ADM-001 (01/11/2026) — Tin tức và ẩn / khôi phục học sinh (mục 7.1 đặc tả).
  "article.create": "Tạo bài viết", "article.update": "Sửa bài viết", "article.publish": "Đăng bài viết", "article.unpublish": "Gỡ đăng bài viết (về nháp)", "article.delete": "Xoá bài viết",
  "student.hide": "Ẩn học sinh", "student.restore": "Khôi phục học sinh đã ẩn",
  // ADM-001 — mã đang được logAction trong api/admin/** nhưng chưa có nhãn (mục 7.2, bắt buộc). Bài t-adm-001-lib quét nguồn để nhãn không thiếu lại.
  "admission_score.create": "Thêm dòng điểm chuẩn", "admission_score.update": "Sửa dòng điểm chuẩn", "admission_score.delete": "Xoá dòng điểm chuẩn",
  "admission_score.import": "Nhập điểm chuẩn hàng loạt", "admission_score.seed": "Nạp điểm chuẩn khởi đầu",
  "admission_formula.create": "Tạo công thức điểm xét tuyển", "admission_formula.update": "Sửa công thức điểm xét tuyển", "admission_formula.delete": "Xoá công thức điểm xét tuyển",
  "library_video.create": "Thêm video thư viện", "library_video.update": "Sửa video thư viện", "library_video.delete": "Xoá video thư viện",
  "pro_payment.resolve": "Đối soát thanh toán gói Pro",
  // ADM-001 — mã của phòng Gia sư / Học sinh / hệ thống (mục 7.2, chỉ nhãn, không đổi hành vi).
  "pro_order.activate_sepay": "Kích hoạt gói Pro qua SePay (tự động)", "coin_transaction.tutor_vip_purchase": "Mua gói VIP gia sư bằng Coin", "push.test": "Gửi tin đẩy thử",
  "assignment_submission.grade": "Chấm bài nộp", "assignment_answer.grade": "Chấm câu trả lời bài tập", "exam_answer.grade": "Chấm câu tự luận đề thi", "exam_attempt.publish": "Công bố điểm lượt thi",
  "exam_history.export": "Xuất lịch sử làm đề (CSV)", "quiz_deadline.set": "Đặt hạn nộp đề", "quiz_deadline.clear": "Bỏ hạn nộp đề",
  "attendance_session.close": "Chốt buổi học", "attendance_session.reopen": "Mở lại buổi đã chốt", "attendance_session.create_extra": "Thêm buổi lẻ / dạy bù", "attendance_session.notes": "Ghi chú buổi học",
  "session_score.update": "Sửa điểm theo buổi", "session_package.create": "Tạo gói buổi học", "session_package.cancel": "Huỷ gói buổi học",
  "course.calendar": "Sửa lịch lớp", "course.add_students": "Thêm học viên vào lớp (gia sư)", "class.zalo_group": "Đặt nhóm Zalo của lớp", "class_schedule.import": "Nhập lịch lớp từ tệp",
  "course_fee.set_rate": "Đặt mức phí lớp", "course_fee.set_student_rate": "Đặt mức phí riêng cho học viên", "course_fee.extra_add": "Thêm khoản thu phát sinh", "course_fee.extra_remove": "Gỡ khoản thu phát sinh",
  "monthly_course_fee.upsert": "Ghi học phí tháng của lớp", "student_discount.set": "Đặt mức giảm cho học viên",
  "invoice.send": "Gửi phiếu học phí", "invoice.set_amount": "Sửa số tiền phiếu", "invoice.set_due_date": "Đổi hạn phiếu", "invoice.attach_charges": "Gắn khoản thu vào phiếu",
  "invoice.zalo_opened": "Mở gửi phiếu qua Zalo", "invoice.view_link_issue": "Cấp liên kết xem phiếu", "invoice.late_fee_hint": "Bật/tắt nhắc phí trễ",
  "enrollment.mark_left": "Đánh dấu học viên nghỉ lớp", "enrollment.mark_back": "Đánh dấu học viên học lại",
  "student_field.create": "Tạo trường hồ sơ tuỳ chỉnh", "student_field.delete": "Xoá trường hồ sơ tuỳ chỉnh",
  "family_group.create": "Tạo nhóm gia đình", "family_group.update": "Sửa nhóm gia đình", "family_group.delete": "Xoá nhóm gia đình",
  "tutor_request.create": "Gửi yêu cầu tới gia sư", "tutor_request.accept": "Gia sư tiếp nhận yêu cầu", "tutor_request.decline": "Gia sư từ chối yêu cầu", "tutor_request.withdraw": "Rút yêu cầu tới gia sư",
  "parent_link.portal_token.enable": "Bật liên kết sổ phụ huynh", "parent_link.portal_token.rotate": "Đổi liên kết sổ phụ huynh", "parent_link.portal_token.revoke": "Thu hồi liên kết sổ phụ huynh",
};
const RESOURCE_LABEL: Record<string, string> = {
  User: "Người dùng", Course: "Lớp", TutorSubscription: "Gói VIP gia sư", PlanConfig: "Cấu hình gói", ProOrder: "Yêu cầu gói Pro", CoinTopupRequest: "Yêu cầu nạp Coin",
  StudentProfile: "Hồ sơ học sinh", ParentLink: "Liên kết phụ huynh", Invoice: "Phiếu học phí", Enrollment: "Ghi danh", ClassInvite: "Mã mời lớp", ClassSessionChange: "Đổi buổi học",
  TutorProfileReport: "Báo cáo hồ sơ gia sư", SiteContent: "Nội dung trang công khai", AttendanceSession: "Phiên điểm danh", BankTransaction: "Giao dịch ngân hàng",
  // ADM-001 (mục 7.3): resourceType đang được ghi nhưng chưa có nhãn. Giữ `Invoice` cũ; các route thật ghi `TuitionInvoice`.
  Article: "Bài viết", AdmissionScore: "Điểm chuẩn", AdmissionFormula: "Công thức xét tuyển", LibraryVideo: "Video thư viện", ProPayment: "Thanh toán gói Pro",
  ParentConsent: "Đồng ý của phụ huynh", AssignmentSubmission: "Bài nộp", AssignmentAnswer: "Câu trả lời bài tập", Exam: "Đề thi", ExamAttempt: "Lượt thi", ExamAnswer: "Câu trả lời đề thi",
  ClassSchedule: "Lịch lớp", FamilyGroup: "Nhóm gia đình", MonthlyCourseFee: "Học phí tháng", SessionPackage: "Gói buổi học", StudentDiscount: "Mức giảm học viên",
  StudentFieldDef: "Trường hồ sơ tuỳ chỉnh", TuitionInvoice: "Phiếu học phí", TutorPayoutAccount: "Tài khoản nhận tiền", TutorRequest: "Yêu cầu tới gia sư",
};
export function auditActionLabel(action: string): string {
  if (ACTION_LABEL[action]) return ACTION_LABEL[action];
  const [res, ev] = action.split(".");
  return ev ? `${res.replace(/_/g, " ")} · ${ev.replace(/[._]/g, " ")}` : action;
}
export function auditResourceLabel(type: string): string { return RESOURCE_LABEL[type] ?? type; }
export const AUDIT_ACTION_OPTIONS: { value: string; label: string }[] = Object.entries(ACTION_LABEL).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "vi"));

export interface AuditActorIn { role: string | null; adminRole: string | null; name: string | null }
const ADMIN_ROLE_LABEL: Record<string, string> = { admin_super: "Quản trị cấp 1", admin_content: "Quản trị nội dung", teacher: "Gia sư" };
/**
 * Người thực hiện. Nhân sự (role admin: quản trị, gia sư) hiện kèm tên; học sinh / phụ huynh / khách chỉ hiện VAI, không tên
 * (học sinh có thể là trẻ dưới 16 tuổi). actor null = hệ thống tự làm.
 */
export function auditActor(a: AuditActorIn | null): string {
  if (!a) return "Hệ thống";
  if (a.role === "admin") {
    const r = ADMIN_ROLE_LABEL[a.adminRole ?? ""] ?? "Quản trị";
    return a.name ? `${r} · ${a.name}` : r;
  }
  return a.role === "student" ? "Học sinh hoặc phụ huynh" : "Người dùng";
}
/** Mã tài nguyên rút gọn để đối chiếu (6 ký tự cuối). Không bao giờ in nguyên mã dài hay tên. */
export const shortId = (id: string) => (id.length > 8 ? `…${id.slice(-6)}` : id);

export interface AuditRowIn { id: string; action: string; resourceType: string; resourceId: string; createdAt: Date; actor: AuditActorIn | null }
export interface AuditRowView { id: string; at: string; when: string; action: string; actionLabel: string; resource: string; resourceId: string; actor: string }
export function auditRowView(r: AuditRowIn, now: Date): AuditRowView {
  return { id: r.id, at: r.createdAt.toISOString(), when: whenText(r.createdAt, now), action: r.action, actionLabel: auditActionLabel(r.action), resource: auditResourceLabel(r.resourceType), resourceId: shortId(r.resourceId), actor: auditActor(r.actor) };
}

export const AUDIT_PAGE_SIZE = 50;
export interface AuditFilter { action: string | null; from: string | null; to: string | null; page: number }
/** Đọc bộ lọc từ chuỗi truy vấn; giá trị lạ bị bỏ. Ngày dạng yyyy-mm-dd theo giờ VN. */
export function parseAuditFilter(sp: URLSearchParams): AuditFilter {
  const date = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00+07:00`).getTime()) ? s : null);
  const action = sp.get("action");
  const page = Math.floor(Number(sp.get("page") ?? "1"));
  return { action: action && /^[a-z_]+(\.[a-z_]+)+$/.test(action) ? action : null, from: date(sp.get("from")), to: date(sp.get("to")), page: Number.isFinite(page) && page >= 1 && page <= 1000 ? page : 1 };
}

// ── QT-04: hôm nay cần làm gì ────────────────────────────────────────────────────────────────────
export interface TodayCounts {
  tutorsPending: number; threadReports: number; profileReports: number; answerReports: number;
  topupsPending: number | null; proOrdersPending: number | null; supportOpen: number | null;
}
export interface TodayItem { key: string; label: string; count: number; href: string; hint: string }
/** Chỉ giữ việc có số > 0. `null` = người này không có quyền xem loại đó nên không đếm, không hiện. Việc nặng (chờ lâu) đứng trước nhờ thứ tự cố định. */
export function buildTodayList(c: TodayCounts): TodayItem[] {
  const rows: (TodayItem | null)[] = [
    { key: "gia-su", label: "Hồ sơ gia sư chờ duyệt", count: c.tutorsPending, href: "/admin/kiem-duyet", hint: "Mở hàng chờ để duyệt hoặc từ chối" },
    { key: "bai-viet", label: "Bài viết bị báo cáo", count: c.threadReports, href: "/admin/kiem-duyet", hint: "Gỡ bài hoặc giữ lại" },
    { key: "ho-so", label: "Hồ sơ gia sư bị báo cáo", count: c.profileReports, href: "/admin/kiem-duyet", hint: "Khoá hồ sơ công khai hoặc bỏ qua" },
    { key: "tra-loi", label: "Câu trả lời bị báo cáo", count: c.answerReports, href: "/admin/cong-dong/bao-cao", hint: "Xử lý ở trang riêng vì có thể trừ lại thưởng" },
    c.topupsPending === null ? null : { key: "nap-coin", label: "Yêu cầu nạp Coin chờ duyệt", count: c.topupsPending, href: "/admin/topups", hint: "Đối chiếu sao kê rồi duyệt" },
    c.proOrdersPending === null ? null : { key: "goi-pro", label: "Yêu cầu gói Pro chờ kích hoạt", count: c.proOrdersPending, href: "/admin/goi-pro", hint: "Đối chiếu sao kê rồi kích hoạt" },
    c.supportOpen === null ? null : { key: "ho-tro", label: "Yêu cầu hỗ trợ gia sư đang chờ", count: c.supportOpen, href: "/admin/ho-tro", hint: "Trả lời trong giờ hành chính" },
  ];
  return rows.filter((r): r is TodayItem => !!r && r.count > 0);
}

// ── QT-01: bảng vai ──────────────────────────────────────────────────────────────────────────────
const PERMISSION_LABEL: Record<Permission, string> = {
  VIEW_REVENUE: "Xem doanh thu", MANAGE_REVENUE: "Quản lý gói, nạp Coin và tiền", VIEW_STUDENTS: "Xem học sinh", MANAGE_STUDENTS: "Quản lý hồ sơ học sinh",
  MANAGE_COURSES: "Quản lý khoá học", MANAGE_CURRICULUM: "Quản lý đề thi và ngân hàng câu hỏi", MANAGE_HONOR: "Quản lý bảng vinh danh",
  MANAGE_ADMINS: "Đổi vai và xem nhật ký", MANAGE_NEWS: "Quản lý tin tức, blog, điểm chuẩn", MANAGE_COMMUNITY: "Kiểm duyệt cộng đồng", MANAGE_TUTORS: "Duyệt hồ sơ gia sư và hỗ trợ gia sư",
};
export interface RoleSummary { role: AdminRole; label: string; who: string; can: string[] }
/** Bảng vai đọc THẲNG từ ROLE_PERMISSIONS (một nguồn): thêm quyền ở permissions.ts là bảng đổi theo. Không tự bịa quyền. */
export function roleSummaries(): RoleSummary[] {
  const who: Record<AdminRole, string> = {
    admin_super: "Quản lý cao nhất của KiN: đổi vai, xem nhật ký, duyệt tiền và gói.",
    admin_content: "Quản lý nội dung và hồ sơ: duyệt gia sư, kiểm duyệt, khoá học, đề thi, tin tức.",
    teacher: "Gia sư: chỉ quản lý lớp và đề thi do chính mình tạo; vào vỏ Sổ gia sư, không thấy giao diện quản trị.",
  };
  return (["admin_super", "admin_content", "teacher"] as AdminRole[]).map(role => ({
    role, label: ADMIN_ROLE_LABEL[role], who: who[role], can: ROLE_PERMISSIONS[role].map(p => PERMISSION_LABEL[p]),
  }));
}
