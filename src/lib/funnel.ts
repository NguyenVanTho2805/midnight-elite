// PH-209/210/212/214 — phễu gia sư (đặc tả pheu-gia-su.md). Hàm thuần, dùng cả ở máy chủ lẫn trình duyệt.
//  • Đuôi `?n=` đánh dấu KÊNH của mỗi link công khai: fb-<nhóm> (nhóm Facebook), zl-rieng, zl-nhom, bc (báo cáo), truc-tiep.
//  • Không đếm được bài đăng trong nhóm Facebook — chỉ đếm lượt bấm link (phải ghi rõ trên bảng).

export const DIRECT_CHANNEL = "truc-tiep";
export const CHANNEL_MAX = 40;

/** Chuẩn hoá đuôi ?n=: chữ thường, chỉ a-z 0-9 và gạch ngang, tối đa 40 ký tự. Rỗng/hỏng → "truc-tiep". */
export function normalizeChannel(raw: unknown): string {
  if (typeof raw !== "string") return DIRECT_CHANNEL;
  const s = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "").slice(0, CHANNEL_MAX);
  return s || DIRECT_CHANNEL;
}

export type ChannelGroup = "facebook" | "zalo-rieng" | "zalo-nhom" | "bao-cao" | "truc-tiep" | "khac";
export const CHANNEL_GROUP_LABEL: Record<ChannelGroup, string> = {
  facebook: "Nhóm Facebook", "zalo-rieng": "Zalo chat riêng", "zalo-nhom": "Nhóm Zalo", "bao-cao": "Báo cáo chuyển tiếp", "truc-tiep": "Trực tiếp / không rõ", khac: "Khác",
};
export function channelGroup(channel: string): ChannelGroup {
  if (channel === DIRECT_CHANNEL) return "truc-tiep";
  if (channel === "fb" || channel.startsWith("fb-")) return "facebook";
  if (channel === "zl-rieng") return "zalo-rieng";
  if (channel === "zl-nhom") return "zalo-nhom";
  if (channel === "bc" || channel.startsWith("bc-")) return "bao-cao";
  return "khac";
}

const VI_FROM = "àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ";
const VI_TO   = "aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd";
/** Tên nhóm → đuôi gọn không dấu. "Gia sư Toán Hà Nội 9" → "gia-su-toan-ha-noi-9" (tối đa 24 ký tự). */
export function slugifyVi(label: string, max = 24): string {
  let out = "";
  for (const ch of label.toLowerCase()) { const i = VI_FROM.indexOf(ch); out += i >= 0 ? VI_TO[i] : ch; }
  return out.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max).replace(/-+$/g, "");
}
/** Kênh của một nhóm Facebook, vd "Gia sư Hà Nội" → "fb-gia-su-ha-noi". Không tên → "fb". */
export function facebookChannel(groupLabel: string): string {
  const slug = slugifyVi(groupLabel);
  return slug ? `fb-${slug}` : "fb";
}

export const profilePath = (tutorId: string) => `/mentor/${tutorId}`;
export function profileLink(origin: string, tutorId: string, channel?: string | null): string {
  const base = `${origin.replace(/\/+$/, "")}${profilePath(tutorId)}`;
  const n = channel ? normalizeChannel(channel) : null;
  return n && n !== DIRECT_CHANNEL ? `${base}?n=${n}` : base;
}

// ─── Thẻ xem trước link (Open Graph): og:title ≤ 60, og:description ≤ 110 ký tự ─────────────────────────────
export const OG_TITLE_MAX = 60;
export const OG_DESC_MAX = 110;
/** Cắt ở ranh giới từ, thêm "…" nếu bị cắt. Độ dài kết quả không vượt max. */
export function clipText(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > max * 0.5 ? cut.slice(0, sp) : cut).replace(/[\s,.;:–—-]+$/, "")}…`;
}
export function profileOg(o: { name: string; subjects: string[]; classCount: number; sessionsTaught: number; bio?: string | null }): { title: string; description: string } {
  const subj = o.subjects.slice(0, 2).join(", ");
  const title = clipText(subj ? `${o.name} — gia sư ${subj} | KiN` : `${o.name} — gia sư | KiN`, OG_TITLE_MAX);
  const facts = [o.classCount > 0 ? `${o.classCount} lớp đang dạy` : "", o.sessionsTaught > 0 ? `${o.sessionsTaught} buổi đã dạy` : "", "Không thu phí nhận lớp"].filter(Boolean).join(" · ");
  const bio = (o.bio ?? "").replace(/\s+/g, " ").trim();
  return { title, description: clipText(bio ? `${facts}. ${bio}` : facts, OG_DESC_MAX) };
}

// ─── Báo cáo hồ sơ (chống lừa đảo) ───────────────────────────────────────────────────────────────────────────
export const REPORT_REASONS = [
  { key: "thu-phi-truoc", label: "Đòi chuyển khoản trước buổi học thử" },
  { key: "gia-mao", label: "Hồ sơ giả hoặc lớp không có thật" },
  { key: "khac", label: "Lý do khác" },
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number]["key"];
export const REPORT_DETAIL_MAX = 500;
export const isReportReason = (v: unknown): v is ReportReason => typeof v === "string" && REPORT_REASONS.some(r => r.key === v);

// ─── Bảng phễu của quản trị ──────────────────────────────────────────────────────────────────────────────────
export interface FunnelRow { channel: string; group: ChannelGroup; opens: number; fulls: number; fullRate: number | null }
export interface FunnelRowInput { channel: string; kind: string; count: number }
/**
 * Gộp số lượt theo kênh. `fullRate` = lượt xem hết hồ sơ / lượt mở (null khi chưa có lượt mở).
 * Xếp theo lượt mở giảm dần, rồi tên kênh để thứ tự ổn định.
 */
export function funnelRows(input: FunnelRowInput[]): FunnelRow[] {
  const by = new Map<string, { opens: number; fulls: number }>();
  for (const r of input) {
    const cur = by.get(r.channel) ?? { opens: 0, fulls: 0 };
    if (r.kind === "open") cur.opens += r.count; else if (r.kind === "full") cur.fulls += r.count;
    by.set(r.channel, cur);
  }
  return [...by.entries()]
    .map(([channel, v]) => ({ channel, group: channelGroup(channel), opens: v.opens, fulls: v.fulls, fullRate: v.opens > 0 ? Math.min(1, v.fulls / v.opens) : null }))
    .sort((a, b) => b.opens - a.opens || a.channel.localeCompare(b.channel));
}
