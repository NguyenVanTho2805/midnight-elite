// "Chờ kiểm duyệt" của vỏ quản trị (Figma "Vỏ — Quản trị" 11:287). PHẦN THUẦN: nhận các hàng đã đọc từ cơ sở dữ liệu, trả danh sách
// một hàng chờ gộp (hồ sơ gia sư xin duyệt + báo cáo bài viết + báo cáo hồ sơ gia sư + báo cáo câu trả lời) kèm chi tiết cho khung đọc.
// Quy tắc: mỗi dòng là MỘT hàng dữ liệu đang chờ người có quyền ra tay; badge = số dòng đó. Người chờ lâu nhất xếp trước.
import { addDaysKey, hmOf, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";

export const MAX_QUEUE_ITEMS = 100;
export const SNIPPET = 70;
const H = 3_600_000;

export type QueueKind = "gia-su" | "bai-viet" | "ho-so" | "tra-loi";
export type QueueTone = "cho" | "loi" | "mo" | "xong";

/** Một việc người duyệt có thể làm trên dòng này. Gọi đúng API xử lý đã có, không có đường xử lý mới. */
export interface QueueAction {
  key: "approve" | "reject" | "remove" | "keep" | "lock" | "dismiss";
  label: string;
  kind: "primary" | "secondary" | "danger";
  method: "POST" | "PATCH";
  url: string;
  body?: Record<string, unknown>;
  /** Phải nhập lý do trước khi gửi (API từ chối nếu thiếu). */
  reason?: { label: string; max: number };
  /** Hỏi lại một câu trước khi gửi (việc không hoàn tác được). */
  confirm?: string;
  /** Không bấm được, kèm lý do hiển thị cho người duyệt. */
  disabled?: string;
}
export interface QueueLink { label: string; href: string }
export interface QueueSection { title: string; text: string }

export interface QueueItem {
  id: string;
  kind: QueueKind;
  title: string;
  subtitle: string;
  at: string;
  /** Nhãn ngắn bên phải dòng: giờ nếu hôm nay, "Hôm qua", hoặc "22/09". */
  when: string;
  status: { label: string; tone: QueueTone };
  detail: { heading: string; meta: string; sections: QueueSection[]; actions: QueueAction[]; links: QueueLink[] };
}

export interface TutorApp { id: string; name: string; email: string; phone: string | null; city: string | null; emailVerified: boolean; bio: string | null; subjects: string[]; appliedAt: Date }
export interface ThreadRep { id: string; reason: string; createdAt: Date; reporter: string; author: string; content: string; course: string | null }
export interface ProfileRep { id: string; tutorId: string; tutorName: string; reason: string; detail: string | null; channel: string | null; createdAt: Date }
export interface AnswerRep { id: string; reason: string; createdAt: Date; reporter: string; author: string; content: string; questionTitle: string; rewardPaid: number }

const dm = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}`;
const clip = (s: string, n: number) => { const t = s.replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t; };

/** "23:02" nếu hôm nay, "Hôm qua", còn lại "22/09". */
export function agoLabel(at: Date, now: Date): string {
  const k = vnDateKeyOf(at), today = vnDateKeyOf(now);
  if (k === today) return hmOf(vnMinutesOfDay(at));
  if (k === addDaysKey(today, -1)) return "Hôm qua";
  return dm(k);
}

/** "đã chờ 3 ngày" / "đã chờ 5 giờ" / "vừa gửi". */
export function waitedText(at: Date, now: Date): string {
  const ms = Math.max(0, now.getTime() - at.getTime());
  const d = Math.floor(ms / (24 * H)), h = Math.floor(ms / H), m = Math.floor(ms / 60_000);
  return d >= 1 ? `đã chờ ${d} ngày` : h >= 1 ? `đã chờ ${h} giờ` : m >= 1 ? `đã chờ ${m} phút` : "vừa gửi";
}

const sentMeta = (at: Date, now: Date) => `gửi lúc ${hmOf(vnMinutesOfDay(at))} ${dm(vnDateKeyOf(at))} · ${waitedText(at, now)}`;

function tutorItem(t: TutorApp, now: Date): QueueItem {
  const subj = t.subjects.length ? t.subjects.join(", ") : "Chưa ghi môn dạy";
  const verified = t.emailVerified;
  return {
    id: `gia-su:${t.id}`, kind: "gia-su",
    title: `Hồ sơ gia sư: ${t.name}`, subtitle: `${subj}${t.city ? ` · ${t.city}` : ""}`,
    at: t.appliedAt.toISOString(), when: agoLabel(t.appliedAt, now),
    status: verified ? { label: "Chờ duyệt", tone: "cho" } : { label: "Chưa xác thực email", tone: "loi" },
    detail: {
      heading: `Hồ sơ gia sư: ${t.name}`, meta: `Nộp đơn lúc ${hmOf(vnMinutesOfDay(t.appliedAt))} ${dm(vnDateKeyOf(t.appliedAt))} · ${waitedText(t.appliedAt, now)}`,
      sections: [
        { title: "Giới thiệu", text: t.bio?.trim() || "Người nộp đơn chưa viết giới thiệu." },
        { title: "Môn dạy", text: subj },
        { title: "Liên hệ", text: `${t.email}${t.phone ? ` · ${t.phone}` : ""}${t.city ? ` · ${t.city}` : ""}` },
        ...(verified ? [] : [{ title: "Chưa duyệt được", text: "Người nộp đơn chưa xác thực email. Chờ họ xác thực rồi mới duyệt, để quyền gia sư không cấp nhầm cho email của người khác." }]),
      ],
      actions: [
        { key: "approve", label: "Duyệt gia sư", kind: "primary", method: "POST", url: `/api/admin/tutor-applications/${t.id}/approve`,
          ...(verified ? {} : { disabled: "Người nộp đơn chưa xác thực email." }) },
        { key: "reject", label: "Từ chối", kind: "secondary", method: "POST", url: `/api/admin/tutor-applications/${t.id}/reject`, reason: { label: "Lý do từ chối (người nộp sẽ đọc được)", max: 500 } },
      ],
      links: [{ label: "Mở trang duyệt gia sư", href: "/admin/ho-so-gia-su" }],
    },
  };
}

function threadItem(r: ThreadRep, now: Date): QueueItem {
  return {
    id: `bai-viet:${r.id}`, kind: "bai-viet",
    title: `Bài viết bị báo cáo`, subtitle: clip(r.content, SNIPPET),
    at: r.createdAt.toISOString(), when: agoLabel(r.createdAt, now),
    status: { label: "Chờ xử lý", tone: "cho" },
    detail: {
      heading: `Bài viết của ${r.author} bị báo cáo`, meta: sentMeta(r.createdAt, now),
      sections: [
        { title: "Nội dung bài viết", text: r.content.trim() || "(bài không có chữ)" },
        { title: "Lý do báo cáo", text: r.reason.trim() || "Người báo cáo không ghi lý do." },
        { title: "Người báo cáo", text: `${r.reporter} · bài của ${r.author} · ${r.course ?? "cộng đồng chung"}` },
      ],
      actions: [
        { key: "remove", label: "Gỡ bài viết", kind: "primary", method: "POST", url: `/api/admin/thread-reports/${r.id}/resolve`, body: { decision: "approved" },
          confirm: "Bài viết sẽ bị gỡ khỏi cộng đồng (hệ thống vẫn lưu lại để đối chiếu)." },
        { key: "keep", label: "Giữ bài lại", kind: "secondary", method: "POST", url: `/api/admin/thread-reports/${r.id}/resolve`, body: { decision: "rejected" } },
      ],
      links: [{ label: "Mở trang cộng đồng", href: "/admin/cong-dong" }],
    },
  };
}

function profileItem(r: ProfileRep, now: Date): QueueItem {
  return {
    id: `ho-so:${r.id}`, kind: "ho-so",
    title: `Hồ sơ gia sư bị báo cáo: ${r.tutorName}`, subtitle: clip(r.reason, SNIPPET),
    at: r.createdAt.toISOString(), when: agoLabel(r.createdAt, now),
    status: { label: "Chờ xử lý", tone: "cho" },
    detail: {
      heading: `Hồ sơ của ${r.tutorName} bị báo cáo`, meta: sentMeta(r.createdAt, now),
      sections: [
        { title: "Lý do báo cáo", text: r.reason.trim() },
        ...(r.detail?.trim() ? [{ title: "Chi tiết", text: r.detail.trim() }] : []),
        ...(r.channel ? [{ title: "Báo cáo từ", text: r.channel }] : []),
        { title: "Khoá hồ sơ làm gì", text: "Khoá chỉ ẩn hồ sơ công khai của gia sư (người xem thấy trang không tồn tại). Gia sư vẫn dùng sổ lớp bình thường và có thể được mở khoá sau." },
      ],
      actions: [
        { key: "lock", label: "Khoá hồ sơ công khai", kind: "primary", method: "PATCH", url: `/api/admin/profile-reports/${r.id}`, body: { action: "lock" }, reason: { label: "Lý do khoá hồ sơ", max: 500 } },
        { key: "dismiss", label: "Bỏ qua báo cáo", kind: "secondary", method: "PATCH", url: `/api/admin/profile-reports/${r.id}`, body: { action: "dismiss" } },
      ],
      links: [{ label: "Mở bảng phễu gia sư", href: "/admin/pheu" }],
    },
  };
}

/** Báo cáo câu trả lời: xử lý "xác nhận vi phạm" có thể trừ xu của người trả lời, nên KHÔNG xử lý ngay trong khung đọc — mở trang riêng, nơi có đủ cảnh báo. */
function answerItem(r: AnswerRep, now: Date): QueueItem {
  return {
    id: `tra-loi:${r.id}`, kind: "tra-loi",
    title: `Câu trả lời bị báo cáo`, subtitle: clip(r.questionTitle, SNIPPET),
    at: r.createdAt.toISOString(), when: agoLabel(r.createdAt, now),
    status: { label: "Chờ xử lý", tone: "cho" },
    detail: {
      heading: `Câu trả lời của ${r.author} bị báo cáo`, meta: sentMeta(r.createdAt, now),
      sections: [
        { title: "Câu hỏi", text: r.questionTitle },
        { title: "Câu trả lời", text: r.content.trim() || "(không có chữ)" },
        { title: "Lý do báo cáo", text: r.reason.trim() || "Người báo cáo không ghi lý do." },
        { title: "Người báo cáo", text: `${r.reporter} · câu trả lời của ${r.author}` },
        ...(r.rewardPaid > 0 ? [{ title: "Lưu ý", text: "Câu trả lời này đã được trả thưởng. Xác nhận vi phạm sẽ trừ lại phần thưởng — xử lý ở trang riêng để thấy rõ trước khi bấm." }] : []),
      ],
      actions: [],
      links: [{ label: "Xử lý ở trang báo cáo trả lời", href: "/admin/cong-dong/bao-cao" }],
    },
  };
}

/** Gộp, xếp người chờ lâu nhất lên trước (FIFO), cắt MAX_QUEUE_ITEMS. Mọi dòng đều cần ra tay nên badge = số dòng. */
export function buildAdminQueue(input: { tutors: TutorApp[]; threads: ThreadRep[]; profiles: ProfileRep[]; answers: AnswerRep[]; now: Date }): { items: QueueItem[]; badge: number } {
  const { now } = input;
  const all = [
    ...input.tutors.map(t => tutorItem(t, now)),
    ...input.threads.map(r => threadItem(r, now)),
    ...input.profiles.map(r => profileItem(r, now)),
    ...input.answers.map(r => answerItem(r, now)),
  ];
  all.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const items = all.slice(0, MAX_QUEUE_ITEMS);
  return { items, badge: items.length };
}
