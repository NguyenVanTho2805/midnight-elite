// Quản trị: phần THUẦN (không DB, không React) cho ba trang QT-02 Nhật ký, QT-03 Triển khai và hạn mức, QT-04 Hôm nay cần làm gì.
// Nguyên tắc cứng:
//  • Cờ triển khai chỉ HIỂN THỊ (bật/tắt + chữ giải thích), KHÔNG bao giờ trả GIÁ TRỊ biến môi trường (CRON_SECRET chỉ hiện "đã đặt / chưa đặt").
//  • Nhật ký kiểm toán KHÔNG hiện tên, SĐT, ngày sinh của trẻ: người thực hiện chỉ hiện TÊN khi là nhân sự (role admin), còn lại chỉ hiện vai.
//    Phần `metadata` của AuditLog không bao giờ được đưa ra giao diện (có thể chứa tên học sinh).
//  • Không bịa số liệu: mục chưa có dữ liệu thật thì ghi "chưa có".
import { COIN_VISIBLE, hideCoin } from "@/lib/features";
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
  const guest = env.KIN_GUEST_QUESTIONS === "1";
  return [
    { key: "KIN_TRIAL_MODE", label: "Miễn phí toàn bộ (chạy thử)", on: trial, state: trial ? "Đang bật" : "Đang tắt",
      note: trial ? (COIN_VISIBLE ? "Chưa ai cần mua gói hay nạp Coin; các đường tính tiền hiện thông báo miễn phí." : "Chưa ai cần mua gói; các đường tính tiền hiện thông báo miễn phí.") : (COIN_VISIBLE ? "Các đường mua gói và nạp Coin hoạt động như thiết kế." : "Các đường mua gói hoạt động như thiết kế.") },
    { key: "KIN_PLAN_ENFORCE", label: "Áp hạn mức gói", on: enforce, state: enforce ? "Đang bật" : "Đang tắt",
      note: enforce ? "Chỉ chặn TẠO MỚI khi chạm trần; lớp, điểm danh, phiếu và xuất dữ liệu luôn giữ nguyên." : preview && env.KIN_PLAN_ENFORCE === "1" ? "Bản xem trước luôn tắt, dù biến đã đặt." : "Không ai bị chặn; hệ thống chỉ ghi số đo để chọn thời điểm bật." },
    { key: "PUSH_ENABLED", label: "Thông báo đẩy", on: push, state: push ? "Đang bật" : "Đang tắt",
      note: push ? "Gửi thật tới thiết bị gia sư đã bật; giờ yên lặng 22:00–07:00 giờ Việt Nam." : "Không gửi tin đẩy nào." },
    { key: "CRON_SECRET", label: "Khoá gọi tác vụ định kỳ", on: cron, state: cron ? "Đã đặt" : "Chưa đặt",
      note: cron ? "Tác vụ định kỳ chỉ chạy khi gọi kèm khoá đúng." : cronSecretMissingIsFatal(env) ? "Chưa đặt: tác vụ định kỳ đang bị từ chối (503) cho tới khi đặt khoá." : "Chưa đặt: chỉ được phép khi chạy máy thử, bản chạy thật sẽ từ chối." },
    // BU-05 / BU-08: chỉ HIỂN THỊ. Câu hỏi của khách chỉ nên mở khi Hàng chờ đã có người xử lý.
    { key: "KIN_GUEST_QUESTIONS", label: "Cho khách đặt câu hỏi", on: guest, state: guest ? "Đang bật" : "Đang tắt",
      note: "Chỉ bật khi hàng chờ có người xử lý." },
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
/** Khớp vercel.json: sáu tác vụ, MỖI NGÀY MỘT LẦN (quy ước của kho, t-adm-003-lib chỉ chấp nhận lịch dạng "phút giờ * * *"; gói Vercel Hobby cũng chỉ cho cron hằng ngày). Quá `maxGapHours` mà chưa thấy gọi thì báo "chậm". */
export const CRON_JOBS: readonly CronJobDef[] = [
  { key: "remind-exam", label: "Nhắc kỳ thi ngày mai", path: "/api/cron/remind-exam", schedule: "Mỗi ngày 07:00 giờ VN", maxGapHours: 36 },
  { key: "remind-class", label: "Nhắc lịch học và tin buổi chưa điểm danh", path: "/api/cron/remind-class", schedule: "Mỗi ngày 07:00 giờ VN", maxGapHours: 36 },
  { key: "expire-tutor-subscriptions", label: "Hết hạn gói VIP gia sư", path: "/api/cron/expire-tutor-subscriptions", schedule: "Mỗi ngày 08:00 giờ VN", maxGapHours: 36 },
  { key: "pro-renewal-reminders", label: "Nhắc gia hạn gói KiN Pro", path: "/api/cron/pro-renewal-reminders", schedule: "Mỗi ngày 07:30 giờ VN", maxGapHours: 36 },
  { key: "english-voa", label: "Lấy bài VOA Learning English", path: "/api/cron/english-voa", schedule: "Mỗi ngày 06:30 giờ VN", maxGapHours: 36 },
  // BU-08 (ADM-002): báo học sinh khi bài hẹn giờ đã lên. Bài hẹn giờ vẫn HIỆN đúng giờ nhờ lọc publishedAt; cron chỉ lo THÔNG BÁO.
  // Lịch hằng ngày 07:15 giờ VN (00:15 UTC): thông báo chậm tối đa một ngày. Muốn sát giờ hơn (vd */15) cần gói Vercel Pro — đổi cả vercel.json lẫn dòng này (và nới t-adm-003-lib).
  { key: "article-publish", label: "Báo bài hẹn giờ đã lên", path: "/api/cron/article-publish", schedule: "Mỗi ngày 07:15 giờ VN", maxGapHours: 36 },
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
  // BU-01 (PR 103): cách vào lớp, mã mời cá nhân, yêu cầu vào lớp (ghi trong enrollServer.ts và route redeem). Bài t-adm-001-lib quét nguồn nên phải có nhãn.
  "class_invite.personal_issue": "Cấp mã mời cá nhân", "class_join_request.create": "Gửi yêu cầu vào lớp", "class_join_request.approve": "Duyệt yêu cầu vào lớp",
  "class_join_request.reject": "Từ chối yêu cầu vào lớp", "class_join_request.cancel": "Học sinh huỷ yêu cầu vào lớp",
  "class_session.cancel": "Báo nghỉ buổi học", "class_session.move": "Dời buổi học", "class_session.restore": "Khôi phục buổi học",
  "attendance_session.create": "Tạo phiên điểm danh", "attendance_session.update": "Sửa phiên điểm danh", "attendance_session.delete": "Xoá phiên điểm danh",
  "bank_tx.resolve": "Đối soát giao dịch ngân hàng", "bank_tx.reverse": "Hoàn tác đối soát ngân hàng",
  "site_content.update": "Sửa nội dung trang chủ",
  "course.bulk_update": "Đổi hàng loạt khoá học", "course_category.create": "Tạo danh mục", "course_category.rename": "Đổi tên danh mục", "course_category.delete": "Xoá danh mục", "course_category.reorder": "Đổi thứ tự danh mục",
  "payout_account.update": "Sửa tài khoản nhận tiền", "payout_account.webhook_key_rotate": "Đổi khoá webhook nhận tiền",
  // ADM-001 (01/11/2026) — Tin tức và ẩn / khôi phục học sinh (mục 7.1 đặc tả).
  "article.create": "Tạo bài viết", "article.update": "Sửa bài viết", "article.publish": "Đăng bài viết", "article.unpublish": "Gỡ đăng bài viết (về nháp)", "article.delete": "Xoá bài viết",
  "student.hide": "Ẩn học sinh", "student.restore": "Khôi phục học sinh đã ẩn",
  "account.delete": "Xoá tài khoản (ẩn danh hoá)", "student.promote_tutor": "Chuyển học sinh thành gia sư",
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
  // BU-08: hàng chờ
  "thread_report.approve": "Gỡ bài viết bị báo cáo", "thread_report.reject": "Giữ lại bài viết bị báo cáo",
  "answer_report.approve": "Xác nhận câu trả lời vi phạm", "answer_report.reject": "Bỏ qua báo cáo câu trả lời",
  "review.approve": "Duyệt đánh giá khoá học", "review.reject": "Từ chối đánh giá khoá học", "review.delete": "Xoá đánh giá khoá học",
  "community.guest_question.approve": "Duyệt câu hỏi của khách", "community.guest_question.reject": "Từ chối câu hỏi của khách",
  "article.scheduled_notify": "Báo bài hẹn giờ đã lên",
};
const RESOURCE_LABEL: Record<string, string> = {
  User: "Người dùng", Course: "Lớp", TutorSubscription: "Gói VIP gia sư", PlanConfig: "Cấu hình gói", ProOrder: "Yêu cầu gói Pro", CoinTopupRequest: "Yêu cầu nạp Coin",
  StudentProfile: "Hồ sơ học sinh", ParentLink: "Liên kết phụ huynh", Invoice: "Phiếu học phí", Enrollment: "Ghi danh", ClassInvite: "Mã mời lớp", ClassJoinRequest: "Yêu cầu vào lớp", ClassSessionChange: "Đổi buổi học",
  TutorProfileReport: "Báo cáo hồ sơ gia sư", SiteContent: "Nội dung trang công khai", AttendanceSession: "Phiên điểm danh", BankTransaction: "Giao dịch ngân hàng", CourseCategory: "Danh mục khoá học",
  // ADM-001 (mục 7.3): resourceType đang được ghi nhưng chưa có nhãn. Giữ `Invoice` cũ; các route thật ghi `TuitionInvoice`.
  Article: "Bài viết", AdmissionScore: "Điểm chuẩn", AdmissionFormula: "Công thức xét tuyển", LibraryVideo: "Video thư viện", ProPayment: "Thanh toán gói Pro",
  ParentConsent: "Đồng ý của phụ huynh", AssignmentSubmission: "Bài nộp", AssignmentAnswer: "Câu trả lời bài tập", Exam: "Đề thi", ExamAttempt: "Lượt thi", ExamAnswer: "Câu trả lời đề thi",
  ClassSchedule: "Lịch lớp", FamilyGroup: "Nhóm gia đình", MonthlyCourseFee: "Học phí tháng", SessionPackage: "Gói buổi học", StudentDiscount: "Mức giảm học viên",
  StudentFieldDef: "Trường hồ sơ tuỳ chỉnh", TuitionInvoice: "Phiếu học phí", TutorPayoutAccount: "Tài khoản nhận tiền", TutorRequest: "Yêu cầu tới gia sư",
  ThreadReport: "Báo cáo bài viết", AnswerReport: "Báo cáo câu trả lời", CourseReview: "Đánh giá khoá học", thread: "Bài cộng đồng",
};
export function auditActionLabel(action: string): string {
  if (ACTION_LABEL[action]) return hideCoin(ACTION_LABEL[action]);
  const [res, ev] = action.split(".");
  return ev ? `${res.replace(/_/g, " ")} · ${ev.replace(/[._]/g, " ")}` : action;
}
export function auditResourceLabel(type: string): string { return hideCoin(RESOURCE_LABEL[type] ?? type); }
export const AUDIT_ACTION_OPTIONS: { value: string; label: string }[] = Object.entries(ACTION_LABEL).map(([value, label]) => ({ value, label: hideCoin(label) })).sort((a, b) => a.label.localeCompare(b.label, "vi"));

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
export type AuditGroup = "duyet" | "tien" | "nguoi" | "noi-dung" | "he-thong";
export const AUDIT_GROUP_LABEL: Record<AuditGroup, string> = { duyet: "Duyệt và kiểm duyệt", tien: "Tiền", nguoi: "Con người", "noi-dung": "Nội dung", "he-thong": "Hệ thống" };
/** Ánh xạ nhóm → TIỀN TỐ / đoạn của mã hành động. Nằm ở máy chủ: client chỉ gửi tên nhóm, không gửi chuỗi tự do. */
export const AUDIT_GROUP_MATCH: Record<AuditGroup, ({ startsWith: string } | { contains: string })[]> = {
  duyet: [{ startsWith: "tutor." }, { startsWith: "thread_report." }, { startsWith: "answer_report." }, { startsWith: "review." }, { startsWith: "profile_report." }, { startsWith: "community." }],
  tien: [{ startsWith: "coin_" }, { startsWith: "pro_" }, { startsWith: "invoice." }, { startsWith: "bank_tx." }, { startsWith: "payout_" }],
  nguoi: [{ startsWith: "user." }, { startsWith: "student" }, { startsWith: "parent_" }, { startsWith: "self_consent." }, { startsWith: "enrollment." }],
  "noi-dung": [{ startsWith: "article." }, { startsWith: "admission_" }, { startsWith: "library_video." }, { startsWith: "site_content." }, { startsWith: "course" }],
  "he-thong": [{ startsWith: "tutor_subscription." }, { startsWith: "push." }, { contains: ".scheduled_" }],
};
const AUDIT_GROUPS = Object.keys(AUDIT_GROUP_MATCH) as AuditGroup[];
/** Mã hành động có thuộc nhóm không (dùng để test; truy vấn thật dựng cùng bảng qua `auditGroupWhere`). */
export function actionInGroup(action: string, g: AuditGroup): boolean {
  return AUDIT_GROUP_MATCH[g].some(m => ("startsWith" in m ? action.startsWith(m.startsWith) : action.includes(m.contains)));
}
/** Điều kiện Prisma cho một nhóm (OR các tiền tố). */
export function auditGroupWhere(g: AuditGroup): { OR: { action: { startsWith: string } | { contains: string } }[] } {
  return { OR: AUDIT_GROUP_MATCH[g].map(m => ({ action: m })) };
}
export interface AuditFilter { action: string | null; nhom: AuditGroup | null; from: string | null; to: string | null; page: number }
/** Đọc bộ lọc từ chuỗi truy vấn; giá trị lạ bị bỏ. Ngày dạng yyyy-mm-dd theo giờ VN. */
export function parseAuditFilter(sp: URLSearchParams): AuditFilter {
  // Ngày phải CÓ THẬT: V8 cho "2026-02-31T00:00:00+07:00" cuộn sang 03/03 chứ không báo sai → so lại năm/tháng/ngày sau khi dựng (31/02, 30/02, 29/02 năm thường bị bỏ).
  const date = (s: string | null) => {
    if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split("-").map(Number);
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d && !Number.isNaN(new Date(`${s}T00:00:00+07:00`).getTime()) ? s : null;
  };
  const action = sp.get("action");
  const nhomRaw = sp.get("nhom");
  const nhom = nhomRaw && (AUDIT_GROUPS as string[]).includes(nhomRaw) ? (nhomRaw as AuditGroup) : null;
  const page = Math.floor(Number(sp.get("page") ?? "1"));
  return { action: action && /^[a-z_]+(\.[a-z_]+)+$/.test(action) ? action : null, nhom, from: date(sp.get("from")), to: date(sp.get("to")), page: Number.isFinite(page) && page >= 1 && page <= 1000 ? page : 1 };
}

// ── QT-04 / BU-08: hôm nay cần làm gì ────────────────────────────────────────────────────────────
export type TodayGroupKey = "duyet" | "theo-doi" | "he-thong";
export const TODAY_GROUP_LABEL: Record<TodayGroupKey, string> = { duyet: "Việc chờ", "theo-doi": "Theo dõi", "he-thong": "Hệ thống" };
/** `null`/vắng = người xem không có quyền xem loại đó (hoặc loại chưa có ở bản này) nên không đếm, không hiện. */
export interface TodayCounts {
  tutorsPending: number; threadReports: number; profileReports: number; answerReports: number;
  topupsPending: number | null; proOrdersPending: number | null; supportOpen: number | null;
  reviewsPending?: number | null; guestQuestions?: number | null;
  /** Số LỚP có yêu cầu vào lớp chờ quá JOIN_SLOW_DAYS ngày (BU-01). */
  joinSlowCourses?: number | null;
  /** Số bài hẹn giờ (đã đặt xuất bản, chưa tới giờ). */
  scheduledArticles?: number | null;
  /** Số tác vụ định kỳ "Chậm so với lịch". */
  cronSlow?: number | null;
}
export interface TodayItem { key: string; group: TodayGroupKey; label: string; count: number; href: string; hint: string }
const queueHref = (kind: string) => `/admin/kiem-duyet?loai=${kind}`;
/**
 * Chỉ giữ việc có số > 0, kèm NHÓM. Việc nặng (chờ lâu) đứng trước nhờ thứ tự cố định. Mọi loại hàng chờ dẫn tới `/admin/kiem-duyet?loai=<kind>`.
 * Chỉ SỐ LƯỢNG yêu cầu: không tổng tiền, không số dư.
 */
export function buildTodayList(c: TodayCounts): TodayItem[] {
  const rows: (TodayItem | null)[] = [
    { key: "gia-su", group: "duyet", label: "Hồ sơ gia sư chờ duyệt", count: c.tutorsPending, href: queueHref("gia-su"), hint: "Mở hàng chờ để duyệt hoặc từ chối" },
    { key: "bai-viet", group: "duyet", label: "Bài viết bị báo cáo", count: c.threadReports, href: queueHref("bai-viet"), hint: "Gỡ bài hoặc giữ lại" },
    { key: "ho-so", group: "duyet", label: "Hồ sơ gia sư bị báo cáo", count: c.profileReports, href: queueHref("ho-so"), hint: "Khoá hồ sơ công khai hoặc bỏ qua" },
    { key: "tra-loi", group: "duyet", label: "Câu trả lời bị báo cáo", count: c.answerReports, href: queueHref("tra-loi"), hint: "Xác nhận vi phạm có thể trừ lại thưởng; đọc kỹ trước khi bấm" },
    c.reviewsPending == null ? null : { key: "danh-gia", group: "duyet", label: "Đánh giá khoá học chờ duyệt", count: c.reviewsPending, href: queueHref("danh-gia"), hint: "Duyệt hoặc từ chối" },
    c.guestQuestions == null ? null : { key: "khach-hoi", group: "duyet", label: "Câu hỏi của khách chờ duyệt", count: c.guestQuestions, href: queueHref("khach-hoi"), hint: "Đọc kỹ trước khi cho hiện công khai" },
    c.topupsPending === null || !COIN_VISIBLE ? null : { key: "nap-coin", group: "duyet", label: "Yêu cầu nạp Coin chờ duyệt", count: c.topupsPending, href: queueHref("nap-coin"), hint: "Đối chiếu sao kê rồi duyệt" },
    c.proOrdersPending === null ? null : { key: "goi-pro", group: "duyet", label: "Yêu cầu gói Pro chờ kích hoạt", count: c.proOrdersPending, href: "/admin/goi-pro", hint: "Xử lý ở trang Gói KiN Pro (không qua Hàng chờ): đối chiếu sao kê rồi kích hoạt" },
    c.supportOpen === null ? null : { key: "ho-tro", group: "duyet", label: "Yêu cầu hỗ trợ gia sư đang chờ", count: c.supportOpen, href: "/admin/ho-tro", hint: "Trả lời ở trang Hỗ trợ gia sư (không qua Hàng chờ), trong giờ hành chính" },
    c.joinSlowCourses == null ? null : { key: "vao-lop-cham", group: "theo-doi", label: "Lớp để học sinh chờ vào quá lâu", count: c.joinSlowCourses, href: queueHref("vao-lop"), hint: "Gia sư của lớp chưa duyệt yêu cầu vào lớp" },
    c.scheduledArticles == null ? null : { key: "bai-hen-gio", group: "theo-doi", label: "Bài viết hẹn giờ sắp lên", count: c.scheduledArticles, href: "/admin/tin-tuc", hint: "Học sinh được báo khi bài lên" },
    c.cronSlow == null ? null : { key: "cron-cham", group: "he-thong", label: "Tác vụ định kỳ chạy chậm", count: c.cronSlow, href: "/admin/trien-khai", hint: "Xem lần gọi gần nhất ở màn Triển khai" },
  ];
  return rows.filter((r): r is TodayItem => !!r && r.count > 0);
}
const QUEUE_SHORT: Record<string, string> = {
  "gia-su": "hồ sơ gia sư chờ duyệt", "bai-viet": "bài viết bị báo cáo", "ho-so": "hồ sơ gia sư bị báo cáo", "tra-loi": "câu trả lời bị báo cáo",
  "danh-gia": "đánh giá khoá học", "khach-hoi": "câu hỏi của khách", "nap-coin": "yêu cầu nạp Coin",
};
const isQueueRow = (i: TodayItem) => i.group === "duyet" && i.href.startsWith("/admin/kiem-duyet");
/**
 * Màn Hôm nay (điều hướng B1): các dòng loại DUYỆT nằm trong Hàng chờ gộp thành MỘT dòng tổng "N việc đang chờ" dẫn tới Hàng chờ
 * (mô tả liệt kê số theo loại, không tên người). Gói Pro chờ kích hoạt và Hỗ trợ gia sư không qua Hàng chờ nên giữ dòng riêng (trang xử lý riêng),
 * và vẫn được tính vào tổng việc chờ của Hôm nay. Nhóm theo-doi / he-thong giữ nguyên. Không có dòng duyệt nào → không thêm dòng tổng.
 */
export function foldQueueItems(items: TodayItem[]): TodayItem[] {
  const queue = items.filter(isQueueRow);
  if (queue.length === 0) return items;
  const n = queue.reduce((s, i) => s + i.count, 0);
  const folded: TodayItem = {
    key: "hang-cho", group: "duyet", label: `${n} việc đang chờ trong Hàng chờ`, count: n, href: "/admin/kiem-duyet",
    hint: queue.map(i => `${i.count} ${QUEUE_SHORT[i.key] ?? i.label.toLocaleLowerCase("vi")}`).join(" · "),
  };
  const at = items.findIndex(isQueueRow);
  return [...items.slice(0, at), folded, ...items.slice(at).filter(i => !isQueueRow(i))];
}
/** Chia theo nhóm theo thứ tự cố định; nhóm rỗng bị bỏ. */
export function groupTodayItems(items: TodayItem[]): { key: TodayGroupKey; label: string; items: TodayItem[] }[] {
  return (["duyet", "theo-doi", "he-thong"] as TodayGroupKey[])
    .map(key => ({ key, label: TODAY_GROUP_LABEL[key], items: items.filter(i => i.group === key) }))
    .filter(g => g.items.length > 0);
}

// ── QT-01: bảng vai ──────────────────────────────────────────────────────────────────────────────
const PERMISSION_LABEL: Record<Permission, string> = {
  VIEW_REVENUE: "Xem doanh thu", MANAGE_REVENUE: COIN_VISIBLE ? "Quản lý gói, nạp Coin và tiền" : "Quản lý gói và tiền", VIEW_STUDENTS: "Xem học sinh", MANAGE_STUDENTS: "Quản lý hồ sơ học sinh",
  MANAGE_COURSES: "Quản lý khoá học", MANAGE_CURRICULUM: "Quản lý đề thi và ngân hàng câu hỏi", MANAGE_HONOR: "Quản lý bảng vinh danh",
  MANAGE_ADMINS: "Đổi vai và xem nhật ký", MANAGE_NEWS: "Quản lý tin tức, blog, điểm chuẩn", MANAGE_COMMUNITY: "Kiểm duyệt cộng đồng", MANAGE_TUTORS: "Duyệt hồ sơ gia sư và hỗ trợ gia sư", DELETE_ACCOUNTS: "Xoá tài khoản học sinh và gia sư",
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
