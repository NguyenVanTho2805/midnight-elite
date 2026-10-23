// Hộp việc của gia sư (Figma "Vỏ — Gia sư" 9:2): danh sách bên trái, khung đọc bên phải. MỖI LOẠI VIỆC là một dòng
// ("3 khoản tiền vào cần đối soát"); bấm vào thì khung đọc liệt kê từng việc cụ thể (tên em, lớp, số tiền, giờ) và có nút đưa
// tới đúng trang xử lý. Thuần (không Prisma) để test; truy vấn nằm ở tutorInboxServer.ts.
//
// Chỉ hiện việc có thật và cần gia sư ra tay (bo-cuc-outlook.md: số đỏ chỉ đếm việc cần ra tay). Không có dòng "đã xong"
// giả; không có loại việc nào không có nguồn dữ liệu thật.
export type InboxKind = "absence" | "check" | "bank" | "consent" | "reports" | "ungraded" | "unmarked" | "reminders" | "makeup" | "draft";
export type InboxTone = "xong" | "cho" | "loi" | "mo";

export interface InboxRow { title: string; sub: string; href?: string }
export interface InboxCommand { label: string; href: string; kind: "primary" | "secondary" }
export interface InboxSource {
  /** Số việc thật (đếm đủ). `rows` chỉ là vài việc đầu để hiện chi tiết. */
  count: number;
  rows: InboxRow[];
  /** Thời điểm của việc cũ nhất (ISO) — hiện ở góc dòng. */
  at: string | null;
}
export type InboxRaw = Record<InboxKind, InboxSource>;

export interface InboxItem {
  id: InboxKind;
  urgent: boolean;
  title: string;
  when: string;
  subtitle: string;
  status: { label: string; tone: InboxTone };
  /** Nhãn hành động màu cam ở dòng việc (Figma Hộp việc 299:111821) và trang xử lý nó dẫn tới. Chờ phụ huynh thì không có hành động của gia sư. */
  action: string;
  href: string;
  /** Việc đang chờ NGƯỜI KHÁC (phụ huynh): hiện ở mục "Chờ phụ huynh", không tính là việc gia sư cần làm. */
  waiting: boolean;
  detail: { heading: string; meta: string; rows: InboxRow[]; more: number; commands: InboxCommand[] };
}

/** Số dòng chi tiết tối đa trong khung đọc cho mỗi loại việc. */
export const INBOX_DETAIL_LIMIT = 10;

interface Meta {
  urgent: boolean;
  title: (n: number) => string;
  status: { label: string; tone: InboxTone };
  hint: string;
  commands: InboxCommand[];
  action: string;
  waiting?: boolean;
}

const META: Record<InboxKind, Meta> = {
  absence: {
    urgent: true, title: n => `${n} báo nghỉ sát giờ`, status: { label: "Cần xử lý", tone: "loi" },
    hint: "Phụ huynh hoặc học sinh báo nghỉ sát giờ học. Mở Lịch, chọn không tính phí (giữ một buổi bù) hoặc tính phí buổi này.",
    commands: [{ label: "Xử lý ở Lịch", href: "/lop-cua-toi/lich", kind: "primary" }],
    action: "Quyết định học phí và học bù",
  },
  check: {
    urgent: true, title: n => `${n} phiếu phụ huynh báo đã chuyển nhưng chưa thấy tiền`, status: { label: "Cần xử lý", tone: "loi" },
    hint: "Phụ huynh báo đã chuyển khoản hơn 24 giờ trước mà chưa có khoản tiền nào khớp. Kiểm sao kê ngân hàng rồi đối soát.",
    commands: [{ label: "Mở Học phí", href: "/lop-cua-toi/hoc-phi", kind: "primary" }, { label: "Đối soát", href: "/lop-cua-toi/hoc-phi?tab=doi-soat", kind: "secondary" }],
    action: "Kiểm sao kê rồi đối soát",
  },
  bank: {
    urgent: true, title: n => `${n} khoản tiền vào cần đối soát`, status: { label: "Chờ đối soát", tone: "loi" },
    hint: "Khoản tiền vào tài khoản của bạn chưa ghép được với phiếu nào. KiN không tự ghép khi chưa chắc.",
    commands: [{ label: "Đối soát", href: "/lop-cua-toi/hoc-phi?tab=doi-soat", kind: "primary" }],
    action: "Đối chiếu thủ công",
  },
  consent: {
    urgent: true, title: n => `${n} học sinh chờ phụ huynh xác nhận`, status: { label: "Chờ phụ huynh", tone: "cho" },
    hint: "Học sinh dưới 18 tuổi chưa được vào học cho tới khi phụ huynh xác nhận qua đường dẫn riêng.",
    commands: [],
    action: "Chờ phụ huynh xác nhận",
    waiting: true,
  },
  reminders: {
    urgent: false, title: n => `${n} tin nhắc lịch đã tới hạn`, status: { label: "Cần nhắc", tone: "cho" },
    hint: "Tin nhắc buổi học đã tới giờ gửi. Mở Lịch, bấm mở Zalo để gửi — KiN không gửi thay bạn.",
    commands: [{ label: "Gửi ở Lịch", href: "/lop-cua-toi/lich", kind: "primary" }],
    action: "Mở Lịch để gửi nhắc",
  },
  makeup: {
    urgent: false, title: n => `${n} buổi bù sắp hết hạn`, status: { label: "Sắp hết hạn", tone: "cho" },
    hint: "Buổi bù còn không quá 3 ngày là hết hạn. Xếp lịch cho em dùng, không thì buổi bù mất.",
    commands: [{ label: "Mở Lịch", href: "/lop-cua-toi/lich", kind: "primary" }],
    action: "Xếp lịch cho em dùng buổi bù",
  },
  reports: {
    urgent: false, title: n => `${n} báo cáo trong cộng đồng lớp`, status: { label: "Chờ xử lý", tone: "cho" },
    hint: "Học viên báo cáo bài viết trong cộng đồng của lớp bạn. Giữ bài lại hoặc xoá bài vi phạm.",
    commands: [{ label: "Mở Kiểm duyệt", href: "/lop-cua-toi/kiem-duyet", kind: "primary" }],
    action: "Giữ bài hoặc xoá bài vi phạm",
  },
  ungraded: {
    urgent: false, title: n => `${n} bài chưa chấm`, status: { label: "Chờ chấm", tone: "cho" },
    hint: "Bài nộp hoặc câu tự luận của học sinh chưa có điểm.",
    commands: [],
    action: "Mở bài nộp và phản hồi",
  },
  unmarked: {
    urgent: false, title: n => `${n} buổi đã qua giờ, chưa điểm danh xong`, status: { label: "Chưa điểm danh", tone: "cho" },
    hint: "Buổi học đã diễn ra nhưng còn em chưa có điểm danh, nên Sổ của con và báo cáo tháng còn thiếu. Mở trang điểm danh của lớp để ghi; buổi không diễn ra thì Huỷ buổi ở Lịch. Học phí không đổi.",
    commands: [],
    action: "Mở trang điểm danh",
  },
  draft: {
    urgent: false, title: n => `${n} phiếu học phí nháp chưa gửi`, status: { label: "Chưa gửi", tone: "mo" },
    hint: "Phiếu đã soạn nhưng chưa gửi cho phụ huynh. Mở Học phí để xem lại và gửi.",
    commands: [{ label: "Mở Học phí", href: "/lop-cua-toi/hoc-phi", kind: "primary" }],
    action: "Xem lại và gửi phiếu",
  },
};

export const INBOX_KINDS = Object.keys(META) as InboxKind[];

const VN_TZ = "Asia/Ho_Chi_Minh";
function vnParts(d: Date) {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: VN_TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const g = (t: string) => p.find(x => x.type === t)?.value ?? "";
  return { dd: g("day"), mm: g("month"), hh: g("hour") === "24" ? "00" : g("hour"), mi: g("minute") };
}
/** Góc dòng: hôm nay → giờ "18:40"; ngày khác → "24/09". */
export function inboxWhen(iso: string | null, now: Date): string {
  if (!iso) return "";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const a = vnParts(t), b = vnParts(now);
  return a.dd === b.dd && a.mm === b.mm ? `${a.hh}:${a.mi}` : `${a.dd}/${a.mm}`;
}
/** "24/09 18:40" — dùng trong chữ mô tả từng việc. */
export function inboxDateTime(d: Date): string {
  const a = vnParts(d);
  return `${a.dd}/${a.mm} ${a.hh}:${a.mi}`;
}
export const inboxVnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;

/** Dựng danh sách dòng của Hộp việc. Việc khẩn đứng trước; cùng nhóm thì nhiều việc trước; bằng nhau giữ thứ tự khai báo. */
export function buildInboxItems(raw: InboxRaw, now: Date): InboxItem[] {
  const items: InboxItem[] = [];
  for (const kind of INBOX_KINDS) {
    const src = raw[kind];
    if (!src || src.count <= 0) continue;
    const m = META[kind];
    const rows = src.rows.slice(0, INBOX_DETAIL_LIMIT);
    const first = rows[0];
    items.push({
      id: kind,
      urgent: m.urgent,
      title: m.title(src.count),
      when: inboxWhen(src.at, now),
      subtitle: first ? `${first.title} · ${first.sub}` : m.hint,
      status: m.status,
      action: m.action,
      href: m.commands.find(c => c.kind === "primary")?.href ?? first?.href ?? "/lop-cua-toi/lich",
      waiting: !!m.waiting,
      detail: {
        heading: m.title(src.count),
        meta: m.hint,
        rows,
        more: Math.max(0, src.count - rows.length),
        commands: m.commands,
      },
    });
  }
  const order = new Map(INBOX_KINDS.map((k, i) => [k, i]));
  return items.sort((a, b) =>
    Number(b.urgent) - Number(a.urgent)
    || (raw[b.id].count - raw[a.id].count)
    || (order.get(a.id)! - order.get(b.id)!));
}

/** Tổng số việc — số đỏ trên thanh module (khớp với tutorDashboard.loadTutorTodoTotal). */
export const inboxTotal = (raw: InboxRaw): number => INBOX_KINDS.reduce((n, k) => n + Math.max(0, raw[k]?.count ?? 0), 0);
