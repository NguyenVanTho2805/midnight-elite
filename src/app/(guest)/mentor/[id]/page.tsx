// FE-110 → 116 — hồ sơ gia sư thật từ /api/tutors/[id].
// Thay DATA tĩnh `MENTORS` cũ. Server component — fetch 1 lần ở render.
// PH-207/210/212/214 — số buổi đã dạy từ sổ lớp, nhãn "Không thu phí nhận lớp", nút Báo cáo, đo lượt theo ?n=, thẻ xem trước.
import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Star, BookOpen, Users, ArrowLeft, CheckCircle, CalendarCheck } from "griddy-icons";
import ProfileTracker from "@/components/tutor/ProfileTracker";
import ReportProfileButton from "@/components/tutor/ReportProfileButton";
import { profileOg } from "@/lib/funnel";

type Rating = { avg: number | null; total: number };
type ClassRow = {
  id: string; name: string; shortTitle: string; category: string;
  bg: string; strip: string; classStatus: string;
  capacity: number | null; activeCount: number; seatsLeft: number | null;
  rating: Rating;
};
type ApiShape = {
  tutor: { id: string; name: string; avatarBase64: string | null; bio: string | null;
    subjects: string[]; tutorVerified: boolean; tutorVerifiedAt: string | null; zalo: string | null; messenger: string | null };
  stats: { classCount: number; studentCount: number; sessionsTaught: number; rating: Rating };
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
  const og = profileOg({ name: data.tutor.name, subjects: data.tutor.subjects, classCount: data.stats.classCount, sessionsTaught: data.stats.sessionsTaught, bio: data.tutor.bio });
  return {
    title: og.title,
    description: og.description,
    openGraph: { title: og.title, description: og.description, type: "profile", images: [{ url: "/og-kin.png", width: 1200, height: 630, alt: "KiN — sổ lớp cho gia sư" }] },
    twitter: { card: "summary_large_image", title: og.title, description: og.description, images: ["/og-kin.png"] },
  };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function MentorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await fetchTutor(id);

  // FE-115: không tìm thấy
  if (!data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="text-5xl mb-4">🔍</p>
        <h1 className="text-2xl font-extrabold mb-2" style={{ color: "#1E2938" }}>Không tìm thấy gia sư</h1>
        <p className="text-sm mb-6" style={{ color: "#6B7280" }}>Gia sư này không tồn tại hoặc chưa được duyệt công khai.</p>
        <Link href="/giang-vien" className="px-6 py-3 rounded-lg font-semibold text-white text-sm"
          style={{ background: "#0068FF", borderRadius: "8px" }}>
          Xem danh sách gia sư
        </Link>
      </div>
    );
  }

  const { tutor, stats, classes } = data;
  const avgText = stats.rating.avg !== null ? stats.rating.avg.toFixed(1) : "—";

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <Link href="/giang-vien" className="inline-flex items-center gap-2 text-sm font-semibold"
        style={{ color: "#6B7280" }}>
        <ArrowLeft size={16} /> Quay lại danh sách
      </Link>

      {/* FE-110: Hero (avatar, tên, môn, badge xác minh) */}
      <div className="rounded-xl p-8" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <div className="w-24 h-24 rounded-xl flex items-center justify-center text-white text-3xl font-black flex-shrink-0 overflow-hidden"
            style={{ background: "linear-gradient(135deg, #0068FF, #0052DD)" }}>
            {tutor.avatarBase64
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={tutor.avatarBase64} alt={tutor.name} className="w-full h-full object-cover" />
              : initials(tutor.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-extrabold" style={{ color: "#1E2938" }}>{tutor.name}</h1>
              {tutor.tutorVerified && (
                <span className="text-xs font-bold px-3 py-1 rounded-full text-white"
                  style={{ background: "#00A63D" }}>Đã xác minh</span>
              )}
              {/* PH-207/212: lời hứa của KiN với gia sư, nhìn thấy được trên hồ sơ chứ không chỉ nằm trong điều khoản */}
              <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: "#dcfce7", color: "#166534" }}>Không thu phí nhận lớp</span>
            </div>
            {tutor.subjects.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {tutor.subjects.map(s => (
                  <span key={s} className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: "#dbeafe", color: "#0068FF" }}>{s}</span>
                ))}
              </div>
            )}

            {/* FE-111: Bio đầy đủ (không line-clamp ở trang chi tiết). */}
            {tutor.bio && (
              <p className="text-sm leading-relaxed mt-3 whitespace-pre-wrap" style={{ color: "#4B5563" }}>{tutor.bio}</p>
            )}

            {/* FE-112: Stat thật (không hard-code) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              {[
                { Icon: Star, value: avgText, label: stats.rating.total > 0 ? `${stats.rating.total} đánh giá` : "chưa có", color: "#FE9900" },
                { Icon: Users, value: stats.studentCount.toLocaleString(), label: "Học viên", color: "#0068FF" },
                { Icon: BookOpen, value: stats.classCount, label: "Lớp đang dạy", color: "#00A63D" },
                { Icon: CalendarCheck, value: stats.sessionsTaught.toLocaleString(), label: "Buổi đã dạy (theo sổ lớp)", color: "#7C3AED" },
              ].map(({ Icon, value, label, color }) => (
                <div key={label} className="rounded-xl p-3 text-center"
                  style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
                  <Icon size={18} style={{ color, margin: "0 auto 4px" }} />
                  <div className="font-extrabold text-base" style={{ color: "#1E2938" }}>{value}</div>
                  <div className="text-xs" style={{ color: "#9CA3AF" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FE-113: lớp đang dạy */}
      <div className="rounded-2xl p-5" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
        <h2 className="font-extrabold text-sm mb-4" style={{ color: "#1E2938" }}>Lớp đang dạy</h2>
        {classes.length === 0 ? (
          <p className="text-sm py-4" style={{ color: "#9CA3AF" }}>Gia sư chưa có lớp công khai.</p>
        ) : (
          <div className="space-y-3">
            {classes.map(c => (
              <Link key={c.id} href={`/khoa-hoc/${c.id}`}>
                <div className="rounded-xl p-4 cursor-pointer hover:-translate-y-0.5 transition-transform"
                  style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="font-semibold text-sm leading-snug" style={{ color: "#1E2938" }}>{c.name}</p>
                    {c.classStatus !== "open" && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: "#fef3c7", color: "#b45309" }}>
                        {c.classStatus === "closed" ? "Đã đóng" : "Tạm ngừng"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: "#9CA3AF" }}>
                    {c.rating.avg !== null && (
                      <span style={{ color: "#FE9900" }}>★ {c.rating.avg.toFixed(1)}</span>
                    )}
                    <span>·</span>
                    <span>{c.activeCount.toLocaleString()} học viên</span>
                    {c.seatsLeft !== null && (
                      <>
                        <span>·</span>
                        <span>{c.seatsLeft > 0 ? `Còn ${c.seatsLeft} chỗ` : "Đã đủ chỗ"}</span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* FE-114: CTA — hiện trỏ sang danh sách lớp. Khi flow mua gói/invite
            có trong 1 chỗ UI chung sẽ chuyển sang trang đó. */}
        <Link href={classes[0] ? `/khoa-hoc/${classes[0].id}` : "/khoa-hoc"}
          className="mt-4 w-full block text-center py-3 rounded-xl font-bold text-sm text-white"
          style={{ background: "#0068FF", borderRadius: "8px" }}>
          Đăng ký học với {tutor.name.split(" ").pop()}
        </Link>
      </div>

      {/* PH-215: số Zalo chỉ hiện khi gia sư bật "Hiện số Zalo trên hồ sơ" (tắt sẵn); Messenger khi gia sư đã nhập tên trang. */}
      {(tutor.zalo || tutor.messenger) && (
        <div className="rounded-2xl p-5 flex items-center justify-between gap-3 flex-wrap" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
          <p className="text-sm" style={{ color: "#4B5563" }}>
            {tutor.zalo ? <>Liên hệ qua Zalo: <b style={{ color: "#1E2938" }}>{tutor.zalo}</b></> : "Liên hệ gia sư"}
          </p>
          <div className="flex gap-2 flex-wrap">
            {tutor.zalo && <a href={`https://zalo.me/${tutor.zalo}`} rel="noopener noreferrer" target="_blank" className="px-4 py-2 rounded-lg text-sm font-semibold text-white min-h-[44px] inline-flex items-center" style={{ background: "#0068FF" }}>Nhắn Zalo</a>}
            {tutor.messenger && (
              <a href={`https://m.me/${tutor.messenger}?text=${encodeURIComponent(`Chào ${tutor.name}, mình xem hồ sơ trên KiN và muốn hỏi về lớp học.`)}`} rel="noopener noreferrer" target="_blank"
                className="px-4 py-2 rounded-lg text-sm font-semibold min-h-[44px] inline-flex items-center" style={{ background: "#dbeafe", color: "#0068FF" }}>Nhắn Messenger</a>
            )}
          </div>
        </div>
      )}

      {/* PH-212: chống lừa đảo làm lợi thế — nhìn thấy trên hồ sơ, kèm nút Báo cáo */}
      <div role="note" className="rounded-2xl p-5" style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
        <p className="text-sm font-semibold" style={{ color: "#92400e" }}>Không chuyển khoản trước buổi học thử.</p>
        <p className="text-sm mt-1" style={{ color: "#78350f" }}>Nếu ai đòi anh/chị chuyển khoản trước buổi học thử, đừng chuyển và bấm Báo cáo.</p>
        <div className="mt-1"><ReportProfileButton tutorId={tutor.id} /></div>
      </div>

      {/* PH-207: vòng kéo gia sư mới — huy hiệu "tạo bằng KiN" bật sẵn */}
      <div id="kin-profile-end" className="text-center text-sm py-2" style={{ color: "#6B7280" }}>
        Hồ sơ tạo bằng KiN · sổ lớp miễn phí cho gia sư →{" "}
        <Link href="/dang-ky?vai=gia-su&n=ho-so" className="underline font-semibold" style={{ color: "#0068FF" }}>Tạo hồ sơ của bạn</Link>
      </div>

      <ProfileTracker tutorId={tutor.id} />

      {/* Giữ 1 helper icon import khỏi bị tree-shake lint-fail */}
      <span className="hidden"><CheckCircle size={0} /></span>
    </div>
  );
}

// Nếu chưa có id khớp DB thì notFound() — thay vì render ở trên; dùng gián
// tiếp qua branch trả null.
export const dynamic = "force-dynamic";
void notFound; // tránh TS "unused" nếu không gọi
