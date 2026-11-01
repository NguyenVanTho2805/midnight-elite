// BU-06 — hồ sơ gia sư kiểu sàn (trước đó FE-110 → 116, PH-207/210/212/214). Trang MÁY CHỦ, dữ liệu thật từ /api/tutors/[id].
// 1600px: trái ~60% (bìa → đầu hồ sơ → video → tab → nội dung), phải 340px dính (giá tham khảo, hai nút liên hệ, Vào lớp miễn phí, nhắc an toàn).
// 390px: một cột — bìa → tên → video → hai nút → tab → nội dung → giá/Vào lớp miễn phí → nhắc an toàn.
// Không nhắn riêng/đặt lịch/thanh toán qua sàn; không ★/điểm; giá chỉ là "giá tham khảo" tự khai. Vào lớp miễn phí = form POST tới luồng BU-01.
import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getSession } from "@/lib/session";
import { ArrowLeft } from "griddy-icons";
import ProfileTracker from "@/components/tutor/ProfileTracker";
import ReportProfileButton from "@/components/tutor/ReportProfileButton";
import KinLinkButton from "@/components/tutor/KinLinkButton";
import { profileOg } from "@/lib/funnel";
import { MODE_LABEL, hasPublicArea, priceText } from "@/lib/tutorArea";
import { DauHoSo } from "@/components/tutor/tim-gia-su/DauHoSo";
import { VideoGioiThieu } from "@/components/tutor/tim-gia-su/VideoGioiThieu";
import { TabHoSo } from "@/components/tutor/tim-gia-su/TabHoSo";
import { parseTab } from "@/components/tutor/tim-gia-su/tab";
import { ChiSoHoSo } from "@/components/tutor/tim-gia-su/ChiSoHoSo";
import { LopMoCard } from "@/components/tutor/tim-gia-su/LopMoCard";
import { LienHeHoSo } from "@/components/tutor/tim-gia-su/LienHeHoSo";
import { VaoLopMienPhi, duocVaoLop, type NguoiXem } from "@/components/tutor/tim-gia-su/VaoLopMienPhi";
import type { TutorDetailResponse } from "@/components/tutor/tim-gia-su/kieu";

type Fetched = { kind: "ok"; data: TutorDetailResponse } | { kind: "notfound" } | { kind: "error" };

// cache(): generateMetadata và trang cùng gọi mà chỉ tốn một lượt. 404 ⇒ không tìm thấy; 5xx/mạng ⇒ lỗi tạm thời (khác nhau để hiện "Thử lại").
const fetchTutor = cache(async function fetchTutor(id: string): Promise<Fetched> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (!host) return { kind: "error" };
  try {
    const res = await fetch(`${proto}://${host}/api/tutors/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (res.status === 404) return { kind: "notfound" };
    if (!res.ok) return { kind: "error" };
    return { kind: "ok", data: (await res.json()) as TutorDetailResponse };
  } catch {
    return { kind: "error" };
  }
});

// PH-214: thẻ xem trước link. Hồ sơ là thông tin công khai của gia sư nên có tên gia sư; KHÔNG có điểm/tên học sinh. Ảnh bìa (data URL) KHÔNG vào OG.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const r = await fetchTutor(id);
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

const H2 = "text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-chu-chinh)]";

export default async function MentorProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string | string[] }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const [r, session] = await Promise.all([fetchTutor(id), getSession()]);
  const tab = parseTab(Array.isArray(sp.tab) ? sp.tab[0] : sp.tab);

  // Không tìm thấy / chưa duyệt / bị ẩn / bị khoá: CÙNG một khối, không lộ lý do.
  if (r.kind === "notfound") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center" data-ho-so-khong-thay>
        <h1 className="mb-2 text-[length:var(--kin-co-h2)] font-semibold text-[var(--kin-chu-chinh)]">Không tìm thấy gia sư</h1>
        <p className="mb-6 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Gia sư này không tồn tại hoặc chưa được duyệt công khai.</p>
        <KinLinkButton href="/giang-vien">Xem danh sách gia sư</KinLinkButton>
      </div>
    );
  }
  if (r.kind === "error") {
    return (
      <div role="alert" className="mx-auto max-w-2xl px-4 py-24 text-center" data-ho-so-loi>
        <h1 className="mb-2 text-[length:var(--kin-co-h2)] font-semibold text-[var(--kin-chu-chinh)]">Chưa mở được hồ sơ</h1>
        <p className="mb-6 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Hệ thống đang bận. Hồ sơ vẫn còn, bạn thử lại sau ít phút.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <KinLinkButton href={`/mentor/${encodeURIComponent(id)}${tab === "gioi-thieu" ? "" : `?tab=${tab}`}`}>Thử lại</KinLinkButton>
          <KinLinkButton href="/giang-vien" variant="secondary">Xem danh sách gia sư</KinLinkButton>
        </div>
      </div>
    );
  }

  const { tutor, stats, classes } = r.data;
  const viewer: NguoiXem = !session ? "guest" : session.role === "student" ? "student" : "staff";
  const area = hasPublicArea(tutor.area) ? tutor.area : null;
  const price = area && area.price !== null ? area.price : null;
  const openClasses = classes.filter(c => c.classStatus === "open");
  const freeClasses = openClasses.filter(duocVaoLop).slice(0, 3);

  return (
    <div data-ho-so className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-5 py-6 sm:px-8 lg:px-14 lg:py-10">
      <Link href="/giang-vien" className="inline-flex min-h-[var(--kin-cham-toi-thieu)] items-center gap-2 self-start text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-mo)]">
        <ArrowLeft size={16} /> Quay lại danh sách
      </Link>

      <div className="flex flex-col items-start gap-8 lg:flex-row lg:gap-12">
        <div className="flex w-full min-w-0 flex-1 flex-col gap-6 lg:basis-[60%]">
          <DauHoSo tutor={tutor} />
          {tutor.introVideo && <VideoGioiThieu name={tutor.name} video={tutor.introVideo} />}

          {/* Điện thoại: hai nút liên hệ nằm ngay dưới video, trước tab. Máy tính: hai nút này ở cột phải. */}
          <LienHeHoSo tutorId={tutor.id} zalo={tutor.zalo} className="flex lg:hidden" />

          <TabHoSo tutorId={tutor.id} active={tab} />

          <div id="khung-tab-ho-so" role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex flex-col gap-6">
            {tab === "gioi-thieu" && (
              <div className="flex flex-col gap-5" data-tab-gioi-thieu>
                {tutor.bio ? <p className="whitespace-pre-line text-[length:var(--kin-co-body)] leading-relaxed text-[var(--kin-chu-phu)]">{tutor.bio}</p>
                  : <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Gia sư chưa viết phần giới thiệu.</p>}
                {tutor.subjects.length > 0 && (
                  <section className="flex flex-col gap-2">
                    <h2 className={H2}>Môn dạy</h2>
                    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                      {tutor.subjects.map(s => <li key={s} className="rounded-full border border-[var(--kin-vien-thuong)] px-3 py-1 text-[length:var(--kin-co-small)] text-[var(--kin-chu-chinh)]">{s}</li>)}
                    </ul>
                  </section>
                )}
                {area && (area.credential || area.mode || area.city || area.district || price !== null) && (
                  <dl className="m-0 flex flex-col gap-3 text-[length:var(--kin-co-small)]" data-tutor-area-detail>
                    {area.credential && <div><dt className="text-[var(--kin-chu-mo)]">Trường / bằng cấp (tự khai)</dt><dd className="m-0 text-[var(--kin-chu-chinh)]">{area.credential}</dd></div>}
                    {(area.city || area.district) && <div><dt className="text-[var(--kin-chu-mo)]">Khu vực</dt><dd className="m-0 text-[var(--kin-chu-chinh)]">{[area.district, area.city].filter(Boolean).join(", ")}</dd></div>}
                    {area.mode && <div><dt className="text-[var(--kin-chu-mo)]">Hình thức dạy</dt><dd className="m-0 text-[var(--kin-chu-chinh)]">{MODE_LABEL[area.mode]}</dd></div>}
                    {price !== null && <div><dt className="text-[var(--kin-chu-mo)]">Giá tham khảo</dt><dd className="m-0 text-[var(--kin-chu-chinh)]">{priceText(price)}</dd></div>}
                  </dl>
                )}
                <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Khu vực, học vấn, bằng cấp do gia sư tự khai; KiN chưa xác minh.</p>
              </div>
            )}

            {tab === "lop" && (
              <div data-tab-lop>
                {openClasses.length === 0 ? (
                  <p className="py-2 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Gia sư chưa mở lớp nhận thêm học sinh. Hãy gửi yêu cầu để hỏi lịch.</p>
                ) : (
                  <>
                    {viewer === "staff" && freeClasses.length > 0 && (
                      <p className="mb-2 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Tài khoản gia sư không vào lớp bằng nút này.</p>
                    )}
                    <ul className="m-0 list-none border-t border-[var(--kin-vien-nhat)] p-0">
                      {openClasses.map(c => <LopMoCard key={c.id} c={c} viewer={viewer} />)}
                    </ul>
                  </>
                )}
              </div>
            )}

            {tab === "chi-so" && <ChiSoHoSo stats={stats} verifiedAt={tutor.tutorVerifiedAt} />}
          </div>
        </div>

        <aside aria-label="Liên hệ gia sư" className="flex w-full flex-col gap-5 lg:sticky lg:top-6 lg:w-[340px] lg:shrink-0">
          <div className="flex flex-col gap-4 rounded-[var(--kin-bo-lg)] p-5 lg:p-6" style={{ background: "var(--kin-nen-bang)" }}>
            {price !== null && (
              <div className="flex flex-col gap-1" data-gia-tham-khao>
                <p className="text-[length:var(--kin-co-h4)] font-semibold text-[var(--kin-chu-chinh)]">{priceText(price)}</p>
                <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Giá tham khảo do gia sư cung cấp. Thỏa thuận trực tiếp; KiN không thu hộ.</p>
              </div>
            )}
            <LienHeHoSo tutorId={tutor.id} zalo={tutor.zalo} className="hidden lg:flex" />

            {freeClasses.length > 0 && (
              <section aria-label="Vào lớp miễn phí" className="flex flex-col gap-3 border-t border-[var(--kin-vien-thuong)] pt-4" data-free-class-block>
                <h2 className={H2}>Lớp miễn phí đang mở</h2>
                {viewer === "staff" ? (
                  <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Tài khoản gia sư không vào lớp bằng nút này.</p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {freeClasses.map(c => (
                      <li key={c.id} className="flex flex-col gap-2">
                        <Link href={`/khoa-hoc/${c.id}`} className="inline-flex min-h-[var(--kin-cham-toi-thieu)] items-center text-[length:var(--kin-co-small)] font-medium text-[var(--kin-chu-chinh)] hover:underline">{c.name}</Link>
                        <VaoLopMienPhi course={c} viewer={viewer} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {tutor.messenger && (
              <KinLinkButton external variant="ghost" href={`https://m.me/${tutor.messenger}?text=${encodeURIComponent(`Chào ${tutor.name}, mình xem hồ sơ trên KiN và muốn hỏi về lớp học.`)}`}>Nhắn Messenger</KinLinkButton>
            )}
            <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Không cần tài khoản để xem hồ sơ. KiN không thu phí nhận lớp.</p>
          </div>

          {/* PH-212: chống lừa đảo làm lợi thế — nhìn thấy trên hồ sơ, kèm nút Báo cáo */}
          <div role="note" className="rounded-[var(--kin-bo-lg)] border border-[var(--kin-tt-cham-cho)] p-4" style={{ background: "var(--kin-tt-nen-cho)" }}>
            <p className="text-sm font-semibold" style={{ color: "var(--kin-tt-chu-cho)" }}>Không chuyển khoản trước buổi học thử.</p>
            <p className="mt-1 text-sm" style={{ color: "var(--kin-tt-chu-cho)" }}>Nếu ai đòi anh/chị chuyển khoản trước buổi học thử, đừng chuyển và bấm Báo cáo.</p>
            <div className="mt-1"><ReportProfileButton tutorId={tutor.id} /></div>
          </div>
        </aside>
      </div>

      {/* PH-207: lời mời tạo hồ sơ chỉ cho KHÁCH. Giữ khung #kin-profile-end cho ProfileTracker đo "xem hết hồ sơ" với mọi người. */}
      <div id="kin-profile-end" className="py-2 text-center text-sm text-[var(--kin-chu-mo)]">
        {!session && (
          <>
            Hồ sơ tạo bằng KiN · sổ lớp miễn phí cho gia sư →{" "}
            <Link href="/dang-ky?vai=gia-su&n=ho-so" className="font-semibold underline" style={{ color: "var(--kin-nhan-link)" }}>Tạo hồ sơ của bạn</Link>
          </>
        )}
      </div>

      <ProfileTracker tutorId={tutor.id} />
    </div>
  );
}

export const dynamic = "force-dynamic";
