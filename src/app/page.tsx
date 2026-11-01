// Trang chủ KiN — dựng theo Figma "Trang chủ KiN" (node 145:8, file KiN Design System).
// Khung: Header (Navbar) → Hero → "Học ở đây thì được gì?" → "Tìm gia sư" → CTA → Footer.
// HOME-01: chữ lấy từ loadHomeContent() (bảng site_content, sửa được ở màn quản trị; không có hàng/lỗi DB thì dùng mặc định). Khối gia sư dạy thêm đã bỏ.
// Chữ hero + 4 thẻ cố ý khác Figma 145:8 (STU-002): Figma hứa live/trợ giảng/realtime mà KiN không có.
//
// So với bản cũ (đã bỏ, đều có chỗ khác hoặc không còn đúng):
//  - Danh sách khoá học + tìm kiếm + theo dõi lớp: nằm ở /khoa-hoc (đã có đủ).
//  - Dòng "Mua 1 lần, học trọn đời": sai cách bán thật (KiN thu học phí theo tháng).
//  - Đếm ngược kỳ thi (ngày viết cứng) và dòng thời gian "Hành trình phát triển".
//
// Chữ nhỏ trên nền navy dùng độ đục cao hơn bản Figma (0,65–0,78 thay vì 0,45–0,68):
// bản Figma đo được 3,4–4,3:1, trượt ngưỡng 4,5:1 mà docs/kin/thiet-ke/tuong-phan.md đặt ra.
import Link from "next/link";
import { BookOpen, Calendar, ChatCircleDots, ClipboardList, GraduationCap, Key, Shield, Star, Trophy, Users } from "griddy-icons";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { prisma } from "@/lib/prisma";
import { readPreferences } from "@/lib/userPreferences";
import { isProfileHidden } from "@/lib/tutorVisibility";
import { loadHomeContent } from "@/lib/siteContentServer";
import { isExternalHref, type HomeIconKey } from "@/lib/siteContent";

// Số liệu ở khung "Đang mở luyện thi" là SỐ ĐẾM THẬT từ cơ sở dữ liệu (làm mới mỗi giờ). Bản Figma ghi 1.200+ / 10.000+ / 6 nhưng đó là
// số minh hoạ chưa có nguồn nên không dùng. Số nào bằng 0 thì ẩn; truy vấn lỗi thì ẩn cả khối (không bao giờ hiện số bịa).
export const revalidate = 3600;

async function loadStats(): Promise<{ value: string; label: string }[]> {
  try {
    const [learners, exams, tutors] = await Promise.all([
      prisma.enrollment.groupBy({ by: ["userId"], where: { status: "active" } }).then(r => r.length),
      prisma.exam.count({ where: { active: true } }),
      // NC2-022: gia sư đã chọn ẨN hồ sơ không tính vào số "Gia sư" công khai.
      prisma.user.findMany({ where: { role: "admin", adminRole: "teacher", tutorVerified: true, banned: false }, select: { preferences: true } }).then(r => r.filter(t => !isProfileHidden(readPreferences(t.preferences))).length),
    ]);
    return [
      { value: learners, label: "Học sinh đang học" },
      { value: exams, label: "Đề thi thử" },
      { value: tutors, label: "Gia sư" },
    ].filter(s => s.value > 0).map(s => ({ value: s.value.toLocaleString("vi-VN"), label: s.label }));
  } catch {
    return [];
  }
}

// Khoá icon (HOME_ICON_KEYS) → component. Bảng này ở đây vì siteContent.ts thuần, không import griddy-icons.
const ICONS: Record<HomeIconKey, typeof Key> = {
  key: Key, calendar: Calendar, clipboard: ClipboardList, chat: ChatCircleDots, book: BookOpen,
  users: Users, graduation: GraduationCap, trophy: Trophy, shield: Shield, star: Star,
};

/** Liên kết nội dung sửa được: https:// ngoài → thẻ <a> mở tab mới; đường nội bộ → Link. */
function ContentLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return isExternalHref(href)
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
    : <Link href={href} className={className}>{children}</Link>;
}

const btnOnNavy = "inline-flex items-center justify-center h-12 px-6 rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-trang)] text-[var(--kin-nhan-nen)] font-semibold transition-opacity hover:opacity-90";
const btnGhostOnNavy = "inline-flex items-center justify-center h-12 px-6 rounded-[var(--kin-bo-md)] border border-white/30 text-white font-semibold transition-colors hover:bg-white/10";

export default async function HomePage() {
  const [stats, c] = await Promise.all([loadStats(), loadHomeContent()]);
  const titleLines = c.title.split("\n");
  return (
    <div data-vung="sang" className="kin-chu-than min-h-screen flex flex-col bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)]">
      <Navbar />

      <main className="flex-1">
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className="bg-[var(--kin-nhan-nen)] pt-12 pb-14 sm:pt-[72px] sm:pb-[88px]">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-20 flex flex-col lg:flex-row lg:items-center gap-10 lg:gap-14">

            <div className="flex-1 min-w-0 flex flex-col items-start gap-5">
              <p className="rounded-full border border-white/[0.18] bg-white/[0.12] px-[14px] py-[6px] text-[length:var(--kin-co-small)] font-semibold text-white/85">
                {c.badge}
              </p>
              <h1 className="kin-chu-tieu-de max-w-[620px] font-semibold leading-[1.14] tracking-[-0.02em] text-white text-[length:clamp(28px,7.5vw,var(--kin-co-display))]">
                {titleLines.map((line, i) => (
                  <span key={i}>{i > 0 && <br />}{line}</span>
                ))}
              </h1>
              <p className="max-w-[480px] text-[length:var(--kin-co-body)] leading-[1.6] text-white/[0.78]">
                {c.lead}
              </p>
              <div className="flex flex-wrap gap-3 pt-3">
                <Link href="/khoa-hoc" className={`${btnOnNavy} text-[length:var(--kin-co-body)]`}>Xem lớp học</Link>
                <Link href="/thi-thu" className={`${btnGhostOnNavy} text-[length:var(--kin-co-body)]`}>Thi thử miễn phí</Link>
              </div>
            </div>

            <div className="w-full lg:w-[480px] lg:flex-shrink-0 flex flex-col gap-4">
              <p className="text-[length:var(--kin-co-caption)] font-semibold tracking-[0.09em] text-white/65">ĐANG MỞ LUYỆN THI</p>
              <div className="grid grid-cols-2 gap-[10px]">
                {c.exams.map((e) => (
                  <ContentLink
                    key={e.label}
                    href={e.href}
                    className="flex flex-col gap-[3px] rounded-[var(--kin-bo-xl)] border border-white/10 bg-white/[0.08] p-[14px] transition-colors hover:bg-white/[0.14]"
                  >
                    <span className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-small)] text-white">{e.label}</span>
                    <span className="text-[length:var(--kin-co-caption)] text-white/70">{e.desc}</span>
                  </ContentLink>
                ))}
              </div>
              {stats.length > 0 && (
              <dl className="grid gap-3 rounded-2xl border border-white/[0.12] bg-white/[0.06] p-5 m-0" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
                {stats.map((s) => (
                  <div key={s.label} className="flex flex-col-reverse gap-1">
                    <dt className="text-[length:var(--kin-co-caption)] text-white/70">{s.label}</dt>
                    <dd className="kin-chu-tieu-de m-0 font-semibold text-[length:var(--kin-co-h4)] leading-tight text-white">{s.value}</dd>
                  </div>
                ))}
              </dl>
              )}
            </div>
          </div>
        </section>

        {/* ── Học ở đây thì được gì? ─────────────────────────────────────── */}
        <section className="bg-[var(--kin-nen-bang)] py-14 sm:py-[72px]">
          <div className="mx-auto max-w-[984px] px-4 sm:px-8">
            <div className="text-center mb-10 flex flex-col gap-2">
              <h2 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h2)] leading-tight text-[var(--kin-chu-chinh)]">
                {c.why.title}
              </h2>
              <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">{c.why.subtitle}</p>
            </div>
            {/* 4 thẻ trở xuống: 4 cột ở lg; 5-6 thẻ: 3 cột để hàng cuối không mồ côi. */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-[14px] ${c.why.cards.length > 4 ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
              {c.why.cards.map(({ icon, title, desc }) => {
                const Icon = ICONS[icon];
                return (
                <article key={title} className="flex flex-col gap-[14px] rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] p-[22px]">
                  <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[var(--kin-bo-lg)] bg-[var(--kin-nen-nhan)] text-[var(--kin-nhan-link)]" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <h3 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-small)] text-[var(--kin-chu-chinh)]">{title}</h3>
                  <p className="text-[length:var(--kin-co-small)] leading-[1.55] text-[var(--kin-chu-phu)]">{desc}</p>
                </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Tìm gia sư (HOME-01): không dùng article / h3 trong khối; lối đăng ký gia sư là liên kết cố định, không sửa được từ quản trị ── */}
        <section aria-labelledby="h-tim-gia-su" className="bg-[var(--kin-nen-trang)] py-14 sm:py-[72px]">
          <div className="mx-auto max-w-[760px] px-4 sm:px-8 flex flex-col items-center text-center gap-3">
            <h2 id="h-tim-gia-su" className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h2)] leading-tight text-[var(--kin-chu-chinh)]">{c.findTutor.title}</h2>
            <p className="max-w-[560px] text-[length:var(--kin-co-small)] leading-[1.6] text-[var(--kin-chu-phu)]">{c.findTutor.desc}</p>
            <ContentLink
              href={c.findTutor.buttonHref}
              className="mt-3 inline-flex w-full sm:w-auto items-center justify-center min-h-12 px-8 rounded-[var(--kin-bo-md)] bg-[var(--kin-nhan-nen)] text-[var(--kin-nhan-chu-tren-nen)] font-semibold text-[length:var(--kin-co-body)] transition-opacity hover:opacity-90"
            >
              {c.findTutor.buttonLabel}
            </ContentLink>
            <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">{c.findTutor.parentNote}</p>
            <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-phu)]">
              Bạn là gia sư?{" "}
              <Link href="/dang-ky?vai=gia-su" className="inline-flex items-center min-h-11 font-semibold text-[var(--kin-nhan-link)] underline">Đăng ký gia sư</Link>
            </p>
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────────────────── */}
        <section className="bg-[var(--kin-nen-bang)] py-14 sm:py-[72px] px-4 sm:px-8">
          <div className="mx-auto max-w-[760px] rounded-[20px] bg-[var(--kin-nhan-nen)] px-6 py-12 sm:px-10 sm:py-14 flex flex-col items-center text-center gap-3">
            <h2 className="kin-chu-tieu-de max-w-[480px] text-balance font-semibold text-[length:var(--kin-co-h2)] leading-tight text-white">
              {c.cta.title}
            </h2>
            <p className="max-w-[420px] text-[length:var(--kin-co-small)] leading-[1.6] text-white/[0.78]">
              {c.cta.desc}
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-3">
              <ContentLink href={c.cta.primary.href} className={`${btnOnNavy} text-[length:var(--kin-co-small)]`}>{c.cta.primary.label}</ContentLink>
              <ContentLink href={c.cta.secondary.href} className={`${btnGhostOnNavy} text-[length:var(--kin-co-small)]`}>{c.cta.secondary.label}</ContentLink>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
