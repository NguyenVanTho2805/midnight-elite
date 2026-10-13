// FE-157 — thẻ gia sư dùng chung (lưới /giang-vien và các nơi liệt kê gia sư). Tách nguyên văn từ trang danh sách, không đổi giao diện.
import Link from "next/link";

export interface TutorListItem {
  id: string;
  name: string;
  avatarBase64: string | null;
  bio: string | null;
  subjects: string[];
  tutorVerified: boolean;
  classCount: number;
  studentCount: number;
  rating: { avg: number | null; total: number };
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function TutorCard({ t }: { t: TutorListItem }) {
  // FE-107: card gia sư với avatar, tên, badge xác minh, bio line-clamp,
  // subject badges, stat (students + classes + rating), CTA xem hồ sơ.
  return (
    <div className="rounded-xl overflow-hidden flex flex-col"
      style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
      <div className="px-6 py-5 flex items-center gap-4"
        style={{ background: "var(--kin-nhan-nen)" }}>
        <div className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-black text-white flex-shrink-0 overflow-hidden"
          style={{ background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.4)" }}>
          {t.avatarBase64
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={t.avatarBase64} alt={t.name} className="w-full h-full object-cover" />
            : initials(t.name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-white leading-tight truncate">{t.name}</h3>
            {t.tutorVerified && (
              <span className="text-[length:var(--kin-co-caption)] font-bold px-1.5 py-0.5 rounded-md"
                style={{ background: "rgba(255,255,255,0.25)", color: "var(--kin-chu-tren-nut-chinh)" }}>Đã xác minh</span>
            )}
          </div>
          {t.subjects.length > 0 && (
            <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.75)" }}>
              {t.subjects.join(" · ")}
            </p>
          )}
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1 gap-4">
        {t.bio ? (
          <p className="text-sm leading-relaxed line-clamp-3" style={{ color: "var(--kin-chu-phu)" }}>{t.bio}</p>
        ) : (
          <p className="text-sm italic" style={{ color: "var(--kin-chu-mo)" }}>Chưa có giới thiệu</p>
        )}

        {t.subjects.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {t.subjects.map(s => (
              <span key={s} className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: "var(--kin-nhan-nen-nhat)", color: "var(--kin-nhan-link)" }}>{s}</span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <p className="font-bold text-base" style={{ color: "var(--kin-chu-chinh)" }}>{t.classCount}</p>
            <p style={{ color: "var(--kin-chu-mo)" }}>lớp đang dạy</p>
          </div>
          <div>
            <p className="font-bold text-base" style={{ color: "var(--kin-chu-chinh)" }}>{t.studentCount}</p>
            <p style={{ color: "var(--kin-chu-mo)" }}>học viên</p>
          </div>
          <div>
            <p className="font-bold text-base" style={{ color: "var(--kin-chu-chinh)" }}>
              {t.rating.avg !== null ? t.rating.avg.toFixed(1) : "—"}
            </p>
            <p style={{ color: "var(--kin-chu-mo)" }}>
              {t.rating.total > 0 ? `${t.rating.total} đánh giá` : "chưa có"}
            </p>
          </div>
        </div>

        <Link href={`/mentor/${t.id}`}
          className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-nhan-link)" }}>
          Xem hồ sơ
        </Link>
      </div>
    </div>
  );
}

export function TutorCardSkeleton() {
  // FE-108: skeleton khi loading
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
      <div className="px-6 py-5 flex items-center gap-4" style={{ background: "var(--kin-vien-thuong)" }}>
        <div className="w-16 h-16 rounded-xl bg-slate-300 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-slate-300 rounded animate-pulse w-2/3" />
          <div className="h-3 bg-slate-300 rounded animate-pulse w-1/2" />
        </div>
      </div>
      <div className="p-5 space-y-3">
        <div className="h-4 bg-slate-200 rounded animate-pulse" />
        <div className="h-4 bg-slate-200 rounded animate-pulse w-4/5" />
        <div className="h-9 bg-slate-200 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

