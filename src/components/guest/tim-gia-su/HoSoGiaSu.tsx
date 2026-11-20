// LOI-05 mục 4.3 — thân hồ sơ gia sư công khai, MỘT trang cuộn (bỏ tab Giới thiệu / Lớp đang mở / Chỉ số; ?tab= cũ được bỏ qua).
// 1600: khung 1200px; trái (giãn): đầu hồ sơ → Giới thiệu → Video → Lớp đang mở → dòng số đếm sổ lớp.
//       phải 360px dính: giá (nếu có) → Gửi yêu cầu / Nhắn Zalo → Nhắn Messenger → Lớp miễn phí → nhắc an toàn + Báo cáo.
// 390:  một cột: đầu hồ sơ → nút liên hệ → giá → giới thiệu → video → lớp đang mở → lớp miễn phí → nhắc an toàn.
// Một bản DOM cho cả hai cỡ (không nhân đôi nút/giá): hai cột là `contents` ở điện thoại, mỗi khối mang `order` toàn trang; ≥ lg hai cột thành flex riêng.
// Không ★/điểm, không "đã xác minh"; số đếm chỉ khi > 0, kèm "theo sổ lớp do gia sư ghi"; giá chỉ khi gia sư tự bật, luôn ghi "tự khai".
import Link from "next/link";
import { ArrowLeft } from "griddy-icons";
import ProfileTracker from "@/components/tutor/ProfileTracker";
import ReportProfileButton from "@/components/tutor/ReportProfileButton";
import KinLinkButton from "@/components/tutor/KinLinkButton";
import { hasPublicArea, priceText } from "@/lib/tutorArea";
import { VideoGioiThieu } from "@/components/tutor/tim-gia-su/VideoGioiThieu";
import { LopMoCard } from "@/components/tutor/tim-gia-su/LopMoCard";
import { LienHeHoSo } from "@/components/tutor/tim-gia-su/LienHeHoSo";
import { VaoLopMienPhi, duocVaoLop, type NguoiXem } from "@/components/tutor/tim-gia-su/VaoLopMienPhi";
import type { TutorDetailResponse } from "@/components/tutor/tim-gia-su/kieu";
import { DauHoSo, tenDayDu } from "./DauHoSo";

const H2 = "m-0 text-[length:var(--kin-co-h4)] font-semibold text-[var(--kin-chu-chinh)]";
const NHO = "m-0 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]";
const so = (n: number) => n.toLocaleString("vi-VN");

export function HoSoGiaSu({ data, viewer, san }: {
  data: TutorDetailResponse;
  viewer: NguoiXem;
  /** Cờ TIM_GIA_SU: sàn /giang-vien đang mở thì có "Quay lại danh sách"; tắt thì lối đi tiếp là "Xem lớp đang mở". */
  san: boolean;
}) {
  const { tutor, stats, classes } = data;
  const name = tenDayDu(tutor.name);
  const area = hasPublicArea(tutor.area) ? tutor.area : null;
  const price = area && area.price !== null ? area.price : null;
  const openClasses = classes.filter(c => c.classStatus === "open");
  const freeClasses = openClasses.filter(duocVaoLop).slice(0, 3);
  const counts = [
    stats.sessionsTaught > 0 ? `${so(stats.sessionsTaught)} buổi đã dạy` : "",
    stats.studentCount > 0 ? `${so(stats.studentCount)} học sinh đang học` : "",
  ].filter(Boolean);

  return (
    <div data-ho-so className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-5 py-6 sm:px-8 lg:py-10">
      {san && (
        <Link href="/giang-vien" className="inline-flex min-h-[var(--kin-cham-toi-thieu)] items-center gap-2 self-start text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-phu)] hover:underline">
          <ArrowLeft size={16} /> Quay lại danh sách
        </Link>
      )}

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
        {/* Cột trái */}
        <div className="contents lg:flex lg:min-w-0 lg:flex-1 lg:flex-col lg:gap-10">
          <div className="order-1"><DauHoSo tutor={tutor} /></div>

          <section aria-labelledby="ho-so-gioi-thieu" className="order-4 flex flex-col gap-3" data-gioi-thieu-ho-so>
            <h2 id="ho-so-gioi-thieu" className={H2}>Giới thiệu</h2>
            {tutor.bio?.trim()
              ? <p className="m-0 whitespace-pre-line break-words text-[length:var(--kin-co-body)] leading-relaxed text-[var(--kin-chu-phu)]">{tutor.bio}</p>
              : <p className={NHO}>Gia sư chưa viết phần giới thiệu.</p>}
          </section>

          {tutor.introVideo && <div className="order-5"><VideoGioiThieu name={name} video={tutor.introVideo} /></div>}

          <section aria-labelledby="ho-so-lop-mo" className="order-6 flex flex-col gap-2" data-lop-dang-mo>
            <h2 id="ho-so-lop-mo" className={H2}>Lớp đang mở</h2>
            {openClasses.length === 0 ? (
              <p className={NHO}>Gia sư chưa mở lớp nhận thêm học sinh. Bạn có thể gửi yêu cầu để hỏi lịch.</p>
            ) : (
              <>
                {viewer === "staff" && freeClasses.length > 0 && <p className={NHO}>Tài khoản gia sư không vào lớp bằng nút này.</p>}
                <ul className="m-0 list-none border-t border-[var(--kin-vien-nhat)] p-0">
                  {openClasses.map(c => <LopMoCard key={c.id} c={c} viewer={viewer} />)}
                </ul>
              </>
            )}
          </section>

          {counts.length > 0 && (
            <p className={`order-7 ${NHO}`} data-so-dem-so-lop>{counts.join(" · ")} — theo sổ lớp do gia sư ghi.</p>
          )}
        </div>

        {/* Cột phải (≥ lg), dính khi cuộn */}
        <div className="contents lg:sticky lg:top-6 lg:flex lg:w-[360px] lg:shrink-0 lg:flex-col lg:gap-5">
          <div className="contents lg:flex lg:flex-col lg:gap-5 lg:rounded-[var(--kin-bo-lg)] lg:p-6 lg:[background:var(--kin-nen-bang)]">
            {price !== null && (
              <div className="order-3 flex flex-col gap-1 rounded-[var(--kin-bo-lg)] p-4 [background:var(--kin-nen-bang)] lg:order-1 lg:rounded-none lg:p-0 lg:[background:transparent]" data-gia-tham-khao>
                <p className="m-0 text-[length:var(--kin-co-h4)] font-semibold text-[var(--kin-chu-chinh)]">{priceText(price)}</p>
                <p className={NHO}>Giá tham khảo do gia sư tự khai. Thỏa thuận trực tiếp; KiN không thu hộ.</p>
              </div>
            )}
            <LienHeHoSo tutorId={tutor.id} zalo={tutor.zalo} className="order-2 flex lg:order-2" />
            {tutor.messenger && (
              <div className="order-2 flex lg:order-3 [&>a]:w-full">
                <KinLinkButton external variant="ghost" href={`https://m.me/${encodeURIComponent(tutor.messenger)}?text=${encodeURIComponent(`Chào ${name}, mình xem hồ sơ trên KiN và muốn hỏi về lớp học.`)}`}>Nhắn Messenger</KinLinkButton>
              </div>
            )}
            {freeClasses.length > 0 && (
              <section aria-label="Vào lớp miễn phí" data-free-class-block
                className="order-8 flex flex-col gap-3 rounded-[var(--kin-bo-lg)] border border-[var(--kin-vien-thuong)] p-4 lg:order-4 lg:rounded-none lg:border-0 lg:border-t lg:p-0 lg:pt-5">
                <h2 className="m-0 text-[length:var(--kin-co-body)] font-semibold text-[var(--kin-chu-chinh)]">Lớp miễn phí đang mở</h2>
                {viewer === "staff" ? (
                  <p className={NHO}>Tài khoản gia sư không vào lớp bằng nút này.</p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {freeClasses.map(c => (
                      <li key={c.id} className="flex flex-col gap-2">
                        <Link href={`/khoa-hoc/${c.id}`} className="inline-flex min-h-[var(--kin-cham-toi-thieu)] items-center break-words text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)] hover:underline">{c.name}</Link>
                        <VaoLopMienPhi course={c} viewer={viewer} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>

          {/* PH-212: chống lừa đảo — nhìn thấy trên hồ sơ, kèm nút Báo cáo */}
          <div role="note" className="order-9 rounded-[var(--kin-bo-lg)] border border-[var(--kin-tt-cham-cho)] p-4" style={{ background: "var(--kin-tt-nen-cho)" }} data-nhac-an-toan>
            <p className="m-0 text-[length:var(--kin-co-goc)] font-semibold" style={{ color: "var(--kin-tt-chu-cho)" }}>Không chuyển khoản trước buổi học thử.</p>
            <p className="m-0 mt-1 text-[length:var(--kin-co-goc)]" style={{ color: "var(--kin-tt-chu-cho)" }}>Nếu ai đòi anh/chị chuyển khoản trước buổi học thử, đừng chuyển và bấm Báo cáo. KiN không thu phí nhận lớp.</p>
            <div className="mt-1"><ReportProfileButton tutorId={tutor.id} /></div>
          </div>
        </div>
      </div>

      {/* PH-207: lời mời tạo hồ sơ chỉ cho KHÁCH. Giữ khung #kin-profile-end cho ProfileTracker đo "xem hết hồ sơ" với mọi người. */}
      <div id="kin-profile-end" className="flex flex-col items-center gap-1 py-2 text-center text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
        {!san && <Link href="/khoa-hoc" className="inline-flex min-h-[var(--kin-cham-toi-thieu)] items-center font-semibold underline" style={{ color: "var(--kin-nhan-link)" }}>Xem lớp đang mở</Link>}
        {viewer === "guest" && (
          <p className="m-0">
            Hồ sơ tạo bằng KiN · sổ lớp miễn phí cho gia sư →{" "}
            <Link href="/dang-ky?vai=gia-su&n=ho-so" className="inline-flex min-h-[var(--kin-cham-toi-thieu)] items-center font-semibold underline" style={{ color: "var(--kin-nhan-link)" }}>Tạo hồ sơ của bạn</Link>
          </p>
        )}
      </div>

      <ProfileTracker tutorId={tutor.id} />
    </div>
  );
}
