// FE-110 → 116 — hồ sơ gia sư thật từ /api/tutors/[id].
// Thay DATA tĩnh `MENTORS` cũ. Server component — fetch 1 lần ở render.
// PH-207/210/212/214 — số buổi đã dạy từ sổ lớp, nhãn "Không thu phí nhận lớp", nút Báo cáo, đo lượt theo ?n=, thẻ xem trước.
import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { ArrowLeft, CheckCircle } from "griddy-icons";
import ProfileTracker from "@/components/tutor/ProfileTracker";
import TutorProfileHeader from "@/components/tutor/TutorProfileHeader";
import ReportProfileButton from "@/components/tutor/ReportProfileButton";
import { profileOg } from "@/lib/funnel";
import KinLinkButton from "@/components/tutor/KinLinkButton";
import { hasPublicArea, priceText } from "@/lib/tutorArea";
import type { PublicArea } from "@/lib/tutorArea";

type Rating = { avg: number | null; total: number };
type ClassRow = {
  id: string; name: string; shortTitle: string; category: string;
  bg: string; strip: string; classStatus: string;
  capacity: number | null; activeCount: number; seatsLeft: number | null;
  rating: Rating;
};
type ApiShape = {
  tutor: { id: string; name: string; avatarBase64: string | null; bio: string | null;
    subjects: string[]; tutorVerified: boolean; tutorVerifiedAt: string | null; zalo: string | null; messenger: string | null; area?: PublicArea | null };
  stats: { classCount: number; studentCount: number; sessionsTaught: number; recentlyActive?: boolean; rating: Rating };
  classes: ClassRow[];
};

// cache(): generateMetadata và trang cùng gọi mà chỉ tốn một lượt.
const fetchTutor = cache(async function fetchTutor(id: string): Promise<ApiShape | null> {
  // SSR → gọi lại route handler qua full URL. Giữ cookie trong trường hợp
  // route cần session (public API này không, nhưng forward sẽ không hại).
  const h  = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (!host) return null;
  const res = await fetch(`${proto}://${host}/api/tutors/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.json();
});

// PH-214: thẻ xem trước link. Hồ sơ là thông tin công khai của gia sư nên có tên gia sư; KHÔNG có điểm/tên học sinh.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchTutor(id);
  if (!data) return { title: "Không tìm thấy gia sư — KiN", robots: { index: false, follow: false } };
  // Ảnh xem trước phải là link tuyệt đối: lấy theo đúng tên miền người dùng đang mở (không phụ thuộc biến môi trường của nơi triển khai).
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const metadataBase = host ? new URL(`${h.get("x-forwarded-proto") ?? "https"}://${host}`) : undefined;
  const og = profileOg({ name: data.tutor.name, subjects: data.tutor.subjects, classCount: data.stats.classCount, sessionsTaught: data.stats.sessionsTaught, bio: data.tutor.bio });
  return {
    metadataBase,
    title: og.title,
    description: og.description,
    openGraph: { title: og.title, description: og.description, type: "profile", images: [{ url: "/og-kin.png", width: 1200, height: 630, alt: "KiN — sổ lớp cho gia sư" }] },
    twitter: { card: "summary_large_image", title: og.title, description: og.description, images: ["/og-kin.png"] },
  };
}

export default async function MentorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, session] = await Promise.all([fetchTutor(id), getSession()]);

  // FE-115: không tìm thấy
  if (!data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="text-5xl mb-4">🔍</p>
        <h1 className="text-2xl font-extrabold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Không tìm thấy gia sư</h1>
        <p className="text-sm mb-6" style={{ color: "var(--kin-chu-mo)" }}>Gia sư này không tồn tại hoặc chưa được duyệt công khai.</p>
        <Link href="/giang-vien" className="px-6 py-3 rounded-lg font-semibold text-white text-sm"
          style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
          Xem danh sách gia sư
        </Link>
      </div>
    );
  }

  const { tutor, stats, classes } = data;
  const firstName = tutor.name.split(" ").pop();
  const area = hasPublicArea(tutor.area) ? tutor.area : null;

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-14 py-8 lg:py-10 flex flex-col gap-7">
      <Link href="/giang-vien" className="inline-flex items-center gap-2 self-start min-h-[44px] text-[length:var(--kin-co-small)] font-medium"
        style={{ color: "var(--kin-chu-mo)" }}>
        <ArrowLeft size={16} /> Quay lại danh sách
      </Link>

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
        <div className="flex-1 min-w-0 w-full flex flex-col gap-8">
          {/* FE-110: đầu hồ sơ — dùng chung (FE-158) */}
          <TutorProfileHeader tutor={tutor} stats={stats} />

          {/* FE-113: lớp đang dạy */}
          <section className="flex flex-col gap-3">
            <h2 className="text-[length:var(--kin-co-body)] font-semibold pb-2.5" style={{ color: "var(--kin-chu-chinh)", borderBottom: "1px solid var(--kin-vien-thuong)" }}>Lớp đang dạy</h2>
            {classes.length === 0 ? (
              <p className="text-[length:var(--kin-co-small)] py-2" style={{ color: "var(--kin-chu-mo)" }}>Gia sư chưa có lớp công khai.</p>
            ) : (
              <ul className="m-0 p-0 list-none">
                {classes.map(c => (
                  <li key={c.id} style={{ borderBottom: "1px solid var(--kin-vien-nhat)" }}>
                    <Link href={`/khoa-hoc/${c.id}`} className="flex items-center justify-between gap-3 py-3 min-h-[44px]">
                      <span className="min-w-0">
                        <span className="block font-medium text-[length:var(--kin-co-small)]" style={{ color: "var(--kin-chu-chinh)" }}>{c.name}</span>
                        <span className="block text-[length:var(--kin-co-small)]" style={{ color: "var(--kin-chu-mo)" }}>
                          {c.rating.avg !== null && <>★ {c.rating.avg.toFixed(1)} · </>}
                          {c.activeCount.toLocaleString()} học viên
                          {c.seatsLeft !== null && <> · {c.seatsLeft > 0 ? `Còn ${c.seatsLeft} chỗ` : "Đã đủ chỗ"}</>}
                        </span>
                      </span>
                      {c.classStatus !== "open" && (
                        <span className="text-[length:var(--kin-co-caption)] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: "var(--kin-tt-nen-cho)", color: "var(--kin-tt-chu-cho)" }}>
                          {c.classStatus === "closed" ? "Đã đóng" : "Tạm ngừng"}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="text-[length:var(--kin-co-small)]" style={{ color: "var(--kin-chu-mo)" }}>
            Chỉ số do hệ thống tổng hợp từ sổ lớp, chỉ đọc. Không hiển thị thông tin học sinh.
          </p>
        </div>

        {/* Cột bên: MỘT nút chính (đăng ký học) + cách liên hệ + nhắc an toàn */}
        <aside aria-label="Liên hệ gia sư" className="w-full lg:w-[340px] lg:flex-shrink-0 flex flex-col gap-5 lg:sticky lg:top-6">
          <div className="flex flex-col gap-4 p-6" style={{ background: "var(--kin-nen-bang)" }}>
            {area && area.price !== null && (
              <div className="flex flex-col gap-1">
                <p className="text-[length:var(--kin-co-h4)] font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>{priceText(area.price)}</p>
                <p className="text-[length:var(--kin-co-small)]" style={{ color: "var(--kin-chu-mo)" }}>Giá tham khảo do gia sư cung cấp. Thỏa thuận trực tiếp trước khi học.</p>
              </div>
            )}
            {/* FE-114: CTA — trỏ sang lớp đầu tiên, hoặc danh sách lớp. */}
            <KinLinkButton href={classes[0] ? `/khoa-hoc/${classes[0].id}` : "/khoa-hoc"}>
              Đăng ký học với {firstName}
            </KinLinkButton>
            {/* PH-215: số Zalo chỉ hiện khi gia sư bật "Hiện số Zalo trên hồ sơ" (tắt sẵn); Messenger khi gia sư đã nhập tên trang. */}
            {tutor.zalo && (
              <p className="text-[length:var(--kin-co-small)]" style={{ color: "var(--kin-chu-phu)" }}>Liên hệ qua Zalo: <b style={{ color: "var(--kin-chu-chinh)" }}>{tutor.zalo}</b></p>
            )}
            {(tutor.zalo || tutor.messenger) && (
              <div className="flex gap-2 flex-wrap">
                {tutor.zalo && <KinLinkButton external variant="secondary" href={`https://zalo.me/${tutor.zalo}`}>Nhắn Zalo</KinLinkButton>}
                {tutor.messenger && (
                  <KinLinkButton external variant="secondary" href={`https://m.me/${tutor.messenger}?text=${encodeURIComponent(`Chào ${tutor.name}, mình xem hồ sơ trên KiN và muốn hỏi về lớp học.`)}`}>Nhắn Messenger</KinLinkButton>
                )}
              </div>
            )}
            <p className="text-[length:var(--kin-co-small)]" style={{ color: "var(--kin-chu-mo)" }}>Không cần tài khoản để xem hồ sơ. KiN không thu phí nhận lớp.</p>
          </div>

          {/* PH-212: chống lừa đảo làm lợi thế — nhìn thấy trên hồ sơ, kèm nút Báo cáo */}
          <div role="note" className="p-4" style={{ background: "var(--kin-tt-nen-cho)", border: "1px solid var(--kin-tt-vien-cho)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--kin-tt-chu-cho)" }}>Không chuyển khoản trước buổi học thử.</p>
            <p className="text-sm mt-1" style={{ color: "var(--kin-tt-chu-cho)" }}>Nếu ai đòi anh/chị chuyển khoản trước buổi học thử, đừng chuyển và bấm Báo cáo.</p>
            <div className="mt-1"><ReportProfileButton tutorId={tutor.id} /></div>
          </div>
        </aside>
      </div>

      {/* PH-207: vòng kéo gia sư mới — huy hiệu "tạo bằng KiN" bật sẵn */}
      {/* Lời mời chỉ dành cho KHÁCH. Người đã đăng nhập bấm vào thì /dang-ky đẩy ngược về dashboard (nút như không làm gì); học viên không cần, gia sư đã có hồ sơ.
          Giữ khung #kin-profile-end cho ProfileTracker đo "xem hết hồ sơ" với mọi người. */}
      <div id="kin-profile-end" className="text-center text-sm py-2" style={{ color: "var(--kin-chu-mo)" }}>
        {!session && (
          <>
            Hồ sơ tạo bằng KiN · sổ lớp miễn phí cho gia sư →{" "}
            <Link href="/dang-ky?vai=gia-su&n=ho-so" className="underline font-semibold" style={{ color: "var(--kin-nhan-link)" }}>Tạo hồ sơ của bạn</Link>
          </>
        )}
      </div>

      <ProfileTracker tutorId={tutor.id} />

      {/* Giữ 1 helper icon import khỏi bị tree-shake lint-fail */}
      <span className="hidden"><CheckCircle size={0} /></span>
    </div>
  );
}

export const dynamic = "force-dynamic";
void notFound; // tránh TS "unused" nếu không gọi
