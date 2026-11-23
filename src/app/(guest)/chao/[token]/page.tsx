// SCL đợt 5 (D2/D3) — trang chào sau khi gửi phiếu BCA Midnight Class: /chao/<mã một lần, 7 ngày>. Công khai (không cần đăng nhập), noindex.
// Chỉ ở đây (mã hợp lệ) mới có link nhóm Zalo học thử. Chào theo TÊN (không họ đầy đủ, không SĐT/Gmail) — CHỈ khi tài khoản do chính phiếu này tạo, chưa dùng
// (hiện form); tài khoản có sẵn ⇒ "Chào bạn" + câu chung, để ai gõ Gmail người khác vào phiếu cũng không đọc được tên thật trong DB. Lịch học đọc từ ClassSchedule của lớp (D10).
// Đặt mật khẩu: form POST + 303 tới /api/chao/dat-mat-khau (mã đi trong thân form). Tài khoản đã có mật khẩu ⇒ nút "Đăng nhập".
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { KinCallout, KinPanel, kinButtonClass } from "@/components/kin";
import { formatScheduleRules } from "@/lib/tutorClassTable";
import { hashWelcomeToken, intakeCourseMap, welcomeNeedsPassword } from "@/lib/intakeServer";
import { MIN_PASSWORD_LEN } from "@/lib/passwordPolicy";
import { TRIAL_DAYS } from "@/lib/trial";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Chào bạn — BCA Midnight Class · KiN", robots: { index: false, follow: false }, referrer: "no-referrer" };

const ZALO_THANH = "https://zalo.me/0384409051";
const zaloHocThu = () => process.env.KIN_ZALO_HOC_THU || "https://zalo.me/g/ruroagad4wqf3xianfoc";
const H2 = "text-[length:var(--kin-co-tieu-de)] leading-6 font-semibold text-[var(--kin-chu-chinh)]";
const P = "text-[length:var(--kin-co-goc)] leading-6 text-[var(--kin-chu-phu)]";
const field = "mt-1.5 w-full min-h-12 px-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)]";
const LOI: Record<string, string> = { ngan: `Mật khẩu cần ít nhất ${MIN_PASSWORD_LEN} ký tự.`, khop: "Hai ô mật khẩu chưa giống nhau.", "da-dat": "Tài khoản đã có mật khẩu. Bạn bấm Đăng nhập nhé." };

const firstName = (full: string) => full.trim().split(/\s+/).pop() || "bạn";
const wrap = (children: React.ReactNode) => <div data-chao-trang className="px-4 md:px-10 py-8 md:py-12"><div className="mx-auto max-w-[720px] min-w-0 space-y-6">{children}</div></div>;

function Expired() {
  return wrap(
    <KinPanel data-chao-het-han className="space-y-4">
      <h1 className="text-[length:var(--kin-co-h2)] leading-9 font-bold text-[var(--kin-chu-chinh)]">Link đã hết hạn</h1>
      <p className={P}>Link chào chỉ dùng được 7 ngày. Tài khoản của bạn vẫn còn: bạn đăng nhập bằng Gmail đã ghi trong phiếu. Chưa có mật khẩu thì bấm <b>Quên mật khẩu</b> và nhập Gmail đó, KiN gửi link đặt mật khẩu vào hộp thư.</p>
      <div className="flex flex-wrap gap-3">
        <Link href="/quen-mat-khau" className={kinButtonClass("primary")}>Quên mật khẩu</Link>
        <Link href="/dang-nhap" className={kinButtonClass("secondary")}>Đăng nhập</Link>
        <a href={ZALO_THANH} target="_blank" rel="noopener noreferrer" className={kinButtonClass("ghost")}>Nhắn Zalo anh Thanh</a>
      </div>
    </KinPanel>,
  );
}

export default async function ChaoPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ loi?: string }> }) {
  const { token } = await params;
  const { loi } = await searchParams;
  if (!/^[\w-]{20,100}$/.test(token)) return <Expired />;
  const w = await prisma.intakeWelcome.findUnique({ where: { tokenHash: hashWelcomeToken(token) }, select: { userId: true, expiresAt: true, passwordSetAt: true, user: { select: { name: true, emailVerified: true, banned: true } } } });
  if (!w || w.expiresAt <= new Date() || w.user.banned) return <Expired />;

  const courseIds = Object.values(intakeCourseMap(process.env.KIN_INTAKE_COURSES));
  const enrolls = await prisma.enrollment.findMany({
    where: { userId: w.userId, courseId: { in: courseIds } }, orderBy: { createdAt: "asc" },
    select: { course: { select: { id: true, name: true, classSchedules: { where: { active: true }, select: { dayOfWeek: true, startTime: true, endTime: true } } } } },
  });
  const showForm = w.passwordSetAt === null && (await welcomeNeedsPassword(w.userId, w.user.emailVerified));
  const err = loi ? LOI[loi] : null;

  return wrap(<>
    <header data-chao>
      <p className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-nhan-link)]">BCA Midnight Class</p>
      <h1 className="mt-1 text-[length:var(--kin-co-h2)] leading-9 font-bold tracking-[-0.01em] text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{`Chào ${showForm ? firstName(w.user.name) : "bạn"}, bạn đã vào lớp học thử`}</h1>
      <p className={`mt-2 ${P}`}>Phiếu của bạn đã tới. Dưới đây là lớp, lịch học và cách vào học. Giữ trang này tới khi bạn đặt xong mật khẩu.</p>
    </header>

    <KinPanel variant="nhan" data-chao-hoc-thu>
      <p className={H2}>Học thử {TRIAL_DAYS} ngày tính từ lần đầu bạn vào lớp</p>
      <p className={`mt-1 ${P}`}>Chưa vào lớp thì chưa tính ngày. Trong {TRIAL_DAYS} ngày bạn xem được toàn bộ tài liệu, bài tập, video như học sinh chính thức.</p>
    </KinPanel>

    <section aria-labelledby="chao-lop" data-chao-lop>
      <h2 id="chao-lop" className={`${H2} pb-2`}>Lớp và lịch học</h2>
      {enrolls.length === 0 ? <p className={P}>Môn bạn chọn chưa có lớp trên KiN. Anh Thanh gửi lịch qua Zalo.</p> : (
        <ul className="border-t border-[var(--kin-vien-nhat)]">
          {enrolls.map(({ course: c }) => (
            <li key={c.id} data-chao-mon={c.id} className="py-3 border-b border-[var(--kin-vien-nhat)] min-w-0">
              <p className="text-[length:var(--kin-co-body)] font-medium text-[var(--kin-chu-chinh)] [overflow-wrap:anywhere]">{c.name}</p>
              <p className={`${P} [overflow-wrap:anywhere]`}>{formatScheduleRules(c.classSchedules) ?? "Lịch học anh Thanh gửi qua Zalo"}</p>
            </li>
          ))}
        </ul>
      )}
      <p className={`mt-2 ${P}`}>Môn nào chưa có ở đây, anh Thanh gửi lịch qua Zalo.</p>
    </section>

    <section aria-labelledby="chao-zalo">
      <h2 id="chao-zalo" className={`${H2} pb-2`}>Nhóm Zalo học thử</h2>
      <p className={`${P} pb-3`}>Nhóm để nhận tin lớp và hỏi nhanh. Link này chỉ hiện ở trang chào của bạn.</p>
      <a href={zaloHocThu()} target="_blank" rel="noopener noreferrer" data-chao-zalo className={kinButtonClass("primary")}>Vào nhóm Zalo học thử</a>
    </section>

    <section aria-labelledby="chao-mat-khau" data-chao-mat-khau>
      <h2 id="chao-mat-khau" className={`${H2} pb-2`}>{showForm ? "Đặt mật khẩu và vào lớp" : "Vào lớp trên web"}</h2>
      {showForm ? (
        <form method="post" action="/api/chao/dat-mat-khau" className="space-y-4 max-w-[420px]">
          <input type="hidden" name="token" value={token} />
          {err && <p role="alert" className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-tt-chu-loi-dam)]">{err}</p>}
          <label className="block">
            <span className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">Mật khẩu (ít nhất {MIN_PASSWORD_LEN} ký tự)</span>
            <input type="password" name="password" required minLength={MIN_PASSWORD_LEN} autoComplete="new-password" className={field} />
          </label>
          <label className="block">
            <span className="text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)]">Nhập lại mật khẩu</span>
            <input type="password" name="confirm" required minLength={MIN_PASSWORD_LEN} autoComplete="new-password" className={field} />
          </label>
          <button type="submit" data-chao-dat className={kinButtonClass("primary")}>Đặt mật khẩu và vào lớp</button>
        </form>
      ) : (
        <>
          {err && <p role="status" className={`${P} pb-3`}>{err}</p>}
          <p className={`${P} pb-3`}>Đăng nhập bằng Gmail đã ghi trong phiếu (hoặc Tiếp tục với Google). Chưa có hay quên mật khẩu thì dùng Quên mật khẩu với Gmail đó.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/dang-nhap?redirect=/student/viec-cua-toi" data-chao-dang-nhap className={kinButtonClass("primary")}>Đăng nhập</Link>
            <Link href="/quen-mat-khau" className={kinButtonClass("secondary")}>Quên mật khẩu</Link>
          </div>
        </>
      )}
    </section>

    <section aria-labelledby="chao-huong-dan" data-chao-huong-dan>
      <h2 id="chao-huong-dan" className={`${H2} pb-2`}>Cách vào học</h2>
      <ol className={`list-decimal pl-5 space-y-2 ${P}`}>
        <li>Anh Thanh gửi lời mời Lịch qua Gmail bạn đã ghi trong phiếu. Mở thư, bấm <b>Có</b> để lưu buổi học vào lịch.</li>
        <li>Tới giờ học, mở sự kiện trong Lịch Google và bấm <b>Tham gia bằng Google Meet</b>.</li>
        <li>Vào lớp trên web KiN: mục <b>Lớp của tôi</b> có bài học, tài liệu và video của từng buổi.</li>
        <li>Bài tập nộp ngay trong trang bài học. Gia sư chấm xong, điểm hiện ở mục <b>Điểm</b>.</li>
      </ol>
    </section>

    <KinCallout title="Cần hỏi gì?">
      Nhắn Zalo anh Thanh: <a href={ZALO_THANH} target="_blank" rel="noopener noreferrer" className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">zalo.me/0384409051</a>
    </KinCallout>
  </>);
}
