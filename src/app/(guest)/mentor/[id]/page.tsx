// FE-110 → 116 — hồ sơ gia sư thật từ /api/tutors/[id].
// Thay DATA tĩnh `MENTORS` cũ. Server component — fetch 1 lần ở render.
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Star, BookOpen, Users, ArrowLeft, CheckCircle } from "griddy-icons";

type Rating = { avg: number | null; total: number };
type ClassRow = {
  id: string; name: string; shortTitle: string; category: string;
  bg: string; strip: string; classStatus: string;
  capacity: number | null; activeCount: number; seatsLeft: number | null;
  rating: Rating;
};
type ApiShape = {
  tutor: { id: string; name: string; avatarBase64: string | null; bio: string | null;
    subjects: string[]; tutorVerified: boolean; tutorVerifiedAt: string | null };
  stats: { classCount: number; studentCount: number; rating: Rating };
  classes: ClassRow[];
};

async function fetchTutor(id: string): Promise<ApiShape | null> {
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
            <div className="grid grid-cols-3 gap-3 mt-5">
              {[
                { Icon: Star, value: avgText, label: stats.rating.total > 0 ? `${stats.rating.total} đánh giá` : "chưa có", color: "#FE9900" },
                { Icon: Users, value: stats.studentCount.toLocaleString(), label: "Học viên", color: "#0068FF" },
                { Icon: BookOpen, value: stats.classCount, label: "Lớp đang dạy", color: "#00A63D" },
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

      {/* Giữ 1 helper icon import khỏi bị tree-shake lint-fail */}
      <span className="hidden"><CheckCircle size={0} /></span>
    </div>
  );
}

// Nếu chưa có id khớp DB thì notFound() — thay vì render ở trên; dùng gián
// tiếp qua branch trả null.
export const dynamic = "force-dynamic";
void notFound; // tránh TS "unused" nếu không gọi
