// LOI-05 (làm lại BU-06) — hồ sơ gia sư công khai, MỘT trang cuộn (bỏ tab; ?tab= cũ được chấp nhận và bỏ qua). Trang MÁY CHỦ.
// Dữ liệu: gọi THẲNG loadPublicTutorProfile (src/lib/tutorPublicProfile.ts) — cùng hàm với GET /api/tutors/[id], không còn tự gọi lại API theo
// tên miền (bản cũ ghép `${proto}://${host}` nên ở next dev thiếu x-forwarded-proto thành https://localhost ⇒ lỗi mạng ⇒ "Chưa mở được hồ sơ" kể cả id sai).
// Không preview: hồ sơ ẩn luôn "không tìm thấy" ở trang này, kể cả với chính chủ (xem trước đi qua route ?preview=1).
// Bố cục: src/components/guest/tim-gia-su/HoSoGiaSu.tsx. Đặc tả: docs/kin/phong-ban/dac-ta/LOI-05.md mục 4.3.
// Không nhắn riêng/đặt lịch/thanh toán qua sàn; không ★/điểm; giá chỉ là "giá tham khảo" tự khai. Vào lớp miễn phí = form POST tới luồng BU-01.
import { cache } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { featureOn } from "@/lib/features";
import { profileOg } from "@/lib/funnel";
import { loadPublicTutorProfile } from "@/lib/tutorPublicProfile";
import KinLinkButton from "@/components/tutor/KinLinkButton";
import type { NguoiXem } from "@/components/tutor/tim-gia-su/VaoLopMienPhi";
import type { TutorDetailResponse } from "@/components/tutor/tim-gia-su/kieu";
import { HoSoGiaSu } from "@/components/guest/tim-gia-su/HoSoGiaSu";
import { HoSoKhongThay } from "@/components/guest/tim-gia-su/HoSoKhongThay";

type Fetched = { kind: "ok"; data: TutorDetailResponse } | { kind: "notfound" } | { kind: "error" };

// cache(): generateMetadata và trang cùng gọi mà chỉ tốn một lượt. null ⇒ không tìm thấy; ném (lỗi DB) ⇒ lỗi tạm thời (khác nhau để hiện "Thử lại").
const layHoSo = cache(async function layHoSo(id: string): Promise<Fetched> {
  try {
    const data = await loadPublicTutorProfile(prisma, id);
    return data ? { kind: "ok", data } : { kind: "notfound" };
  } catch (e) {
    console.error("[mentor/[id]] loadPublicTutorProfile", e);
    return { kind: "error" };
  }
});

// PH-214: thẻ xem trước link. Hồ sơ là thông tin công khai của gia sư nên có tên gia sư; KHÔNG có điểm/tên học sinh. Ảnh bìa (data URL) KHÔNG vào OG.
// headers() ở đây CHỈ để dựng metadataBase (đường dẫn tuyệt đối cho ảnh OG), không dùng để lấy dữ liệu.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = await layHoSo(id);
  if (r.kind !== "ok") return { title: r.kind === "error" ? "Hồ sơ gia sư — KiN" : "Không tìm thấy gia sư — KiN", robots: { index: false, follow: false } };
  const data = r.data;
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
  const [r, session] = await Promise.all([layHoSo(id), getSession()]);
  // LOI-01: hồ sơ từng gia sư vẫn mở, nhưng SÀN /giang-vien đang ẩn (src/lib/features.ts) thì lối đi tiếp là danh sách lớp đang mở, không có "Quay lại danh sách".
  const san = featureOn("TIM_GIA_SU");

  if (r.kind === "notfound") return <HoSoKhongThay san={san} />;
  if (r.kind === "error") {
    return (
      <div role="alert" className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-5 py-20 text-center sm:py-24" data-ho-so-loi>
        <h1 className="m-0 text-[length:var(--kin-co-h2)] font-semibold text-[var(--kin-chu-chinh)]">Chưa mở được hồ sơ</h1>
        <p className="m-0 text-[length:var(--kin-co-body)] text-[var(--kin-chu-phu)]">Hệ thống đang bận. Hồ sơ vẫn còn, bạn thử lại sau ít phút.</p>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <KinLinkButton href={`/mentor/${encodeURIComponent(id)}`}>Thử lại</KinLinkButton>
          {san
            ? <KinLinkButton href="/giang-vien" variant="secondary">Xem danh sách gia sư</KinLinkButton>
            : <KinLinkButton href="/khoa-hoc" variant="secondary">Xem lớp đang mở</KinLinkButton>}
        </div>
      </div>
    );
  }

  const viewer: NguoiXem = !session ? "guest" : session.role === "student" ? "student" : "staff";
  return <HoSoGiaSu data={r.data} viewer={viewer} san={san} />;
}

export const dynamic = "force-dynamic";
