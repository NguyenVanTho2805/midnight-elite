// Trang chủ KiN — dựng theo Figma "Trang chủ KiN" (node 145:8, file KiN Design System).
// Khung: Header (Navbar) → Hero → "Học ở đây thì được gì?" → CTA → Footer.
//
// So với bản cũ (đã bỏ, đều có chỗ khác hoặc không còn đúng):
//  - Danh sách khoá học + tìm kiếm + theo dõi lớp: nằm ở /khoa-hoc (đã có đủ).
//  - Dòng "Mua 1 lần, học trọn đời": sai cách bán thật (KiN thu học phí theo tháng).
//  - Đếm ngược kỳ thi (ngày viết cứng) và dòng thời gian "Hành trình phát triển".
//
// Chữ nhỏ trên nền navy dùng độ đục cao hơn bản Figma (0,65–0,78 thay vì 0,45–0,68):
// bản Figma đo được 3,4–4,3:1, trượt ngưỡng 4,5:1 mà docs/kin/thiet-ke/tuong-phan.md đặt ra.
import Link from "next/link";
import { BookOpen, ChartBar, CheckCircle, Flash } from "griddy-icons";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { prisma } from "@/lib/prisma";
import { readPreferences } from "@/lib/userPreferences";
import { isProfileHidden } from "@/lib/tutorVisibility";

const HERO_CATEGORIES = [
  { label: "ĐGNL HSA",        desc: "ĐH Quốc gia Hà Nội" },
  { label: "ĐGNL HCM",        desc: "ĐH Quốc gia TP.HCM" },
  { label: "Tốt nghiệp THPT", desc: "8 môn thi quốc gia" },
  { label: "TSA Bách Khoa",   desc: "ĐH Bách Khoa HN" },
];

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

const WHY_ITEMS = [
  { Icon: Flash,       title: "Học trực tiếp LIVE",        desc: "Buổi học live mỗi tối với gia sư thực, không phải video cũ. Đặt câu hỏi và nhận phản hồi ngay lập tức." },
  { Icon: ChartBar,    title: "Theo dõi tiến độ realtime", desc: "Dashboard cá nhân hiển thị tiến độ từng môn, GPA, streak và thứ hạng toàn hệ thống." },
  { Icon: BookOpen,    title: "Trợ giảng riêng 1-1",       desc: "Mỗi học sinh được phân công trợ giảng người thật để hỏi bài và định hướng lộ trình." },
  { Icon: CheckCircle, title: "Hỏi bài không giới hạn",    desc: "Hỏi trong cộng đồng, trợ giảng phản hồi trong ngày." },
];

const btnOnNavy = "inline-flex items-center justify-center h-12 px-6 rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-trang)] text-[var(--kin-nhan-nen)] font-semibold transition-opacity hover:opacity-90";
const btnGhostOnNavy = "inline-flex items-center justify-center h-12 px-6 rounded-[var(--kin-bo-md)] border border-white/30 text-white font-semibold transition-colors hover:bg-white/10";

export default async function HomePage() {
  const stats = await loadStats();
  return (
    <div data-vung="sang" className="kin-chu-than min-h-screen flex flex-col bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)]">
      <Navbar />

      <main className="flex-1">
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className="bg-[var(--kin-nhan-nen)] pt-12 pb-14 sm:pt-[72px] sm:pb-[88px]">
          <div className="mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-20 flex flex-col lg:flex-row lg:items-center gap-10 lg:gap-14">

            <div className="flex-1 min-w-0 flex flex-col items-start gap-5">
              <p className="rounded-full border border-white/[0.18] bg-white/[0.12] px-[14px] py-[6px] text-[length:var(--kin-co-small)] font-semibold text-white/85">
                KiN · Luyện thi ĐGNL, THPT &amp; BCA cùng gia sư thật
              </p>
              <h1 className="kin-chu-tieu-de max-w-[620px] font-semibold leading-[1.14] tracking-[-0.02em] text-white text-[length:clamp(28px,7.5vw,var(--kin-co-display))]">
                Học live mỗi tối,<br />cùng gia sư thật
              </h1>
              <p className="max-w-[480px] text-[length:var(--kin-co-body)] leading-[1.6] text-white/[0.78]">
                Không phải video quay sẵn — mỗi buổi học đều live, hỏi đáp trực tiếp, và tiến độ của con được cập nhật theo từng ngày.
              </p>
              <div className="flex flex-wrap gap-3 pt-3">
                <Link href="/khoa-hoc" className={`${btnOnNavy} text-[length:var(--kin-co-body)]`}>Xem lớp học</Link>
                <Link href="/thi-thu" className={`${btnGhostOnNavy} text-[length:var(--kin-co-body)]`}>Thi thử miễn phí</Link>
              </div>
            </div>

            <div className="w-full lg:w-[480px] lg:flex-shrink-0 flex flex-col gap-4">
              <p className="text-[length:var(--kin-co-caption)] font-semibold tracking-[0.09em] text-white/65">ĐANG MỞ LUYỆN THI</p>
              <div className="grid grid-cols-2 gap-[10px]">
                {HERO_CATEGORIES.map((c) => (
                  <Link
                    key={c.label}
                    // Mỗi ô là một kỳ thi: mở danh sách lớp đã lọc đúng kỳ thi đó (trang /khoa-hoc đọc ?category= với đúng các tên này). Trước đây cả bốn ô đều mở danh sách chưa lọc.
                    href={`/khoa-hoc?category=${encodeURIComponent(c.label)}`}
                    className="flex flex-col gap-[3px] rounded-[var(--kin-bo-xl)] border border-white/10 bg-white/[0.08] p-[14px] transition-colors hover:bg-white/[0.14]"
                  >
                    <span className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-small)] text-white">{c.label}</span>
                    <span className="text-[length:var(--kin-co-caption)] text-white/70">{c.desc}</span>
                  </Link>
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
                Học ở đây thì được gì?
              </h2>
              <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Những thứ học sinh thực tế dùng mỗi ngày</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px]">
              {WHY_ITEMS.map(({ Icon, title, desc }) => (
                <article key={title} className="flex flex-col gap-[14px] rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] p-[22px]">
                  <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[var(--kin-bo-lg)] bg-[var(--kin-nen-nhan)] text-[var(--kin-nhan-link)]" aria-hidden="true">
                    <Icon size={20} />
                  </span>
                  <h3 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-small)] text-[var(--kin-chu-chinh)]">{title}</h3>
                  <p className="text-[length:var(--kin-co-small)] leading-[1.55] text-[var(--kin-chu-phu)]">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────────────────── */}
        <section className="py-14 sm:py-[72px] px-4 sm:px-8">
          <div className="mx-auto max-w-[760px] rounded-[20px] bg-[var(--kin-nhan-nen)] px-6 py-12 sm:px-10 sm:py-14 flex flex-col items-center text-center gap-3">
            <h2 className="kin-chu-tieu-de max-w-[480px] text-balance font-semibold text-[length:var(--kin-co-h2)] leading-tight text-white">
              Gia nhập cộng đồng KiN ngay hôm nay
            </h2>
            <p className="max-w-[420px] text-[length:var(--kin-co-small)] leading-[1.6] text-white/[0.78]">
              Thi thử miễn phí. Kết quả thật sau 30 ngày học nghiêm túc cùng gia sư thực.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-3">
              <Link href="/dang-ky" className={`${btnOnNavy} text-[length:var(--kin-co-small)]`}>Tạo tài khoản miễn phí →</Link>
              <Link href="/thi-thu" className={`${btnGhostOnNavy} text-[length:var(--kin-co-small)]`}>Thi thử ĐGNL ngay</Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
