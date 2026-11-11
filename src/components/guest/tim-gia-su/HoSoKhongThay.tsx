// LOI-05 mục 4.3 — hồ sơ không tìm thấy / chưa duyệt / bị ẩn / bị khoá: CÙNG một khối, không lộ lý do.
// Lối đi tiếp theo cờ TIM_GIA_SU: sàn mở ⇒ "Xem danh sách gia sư" (/giang-vien); sàn ẩn ⇒ "Xem lớp đang mở" (/khoa-hoc). Luôn có "Về trang chủ".
import KinLinkButton from "@/components/tutor/KinLinkButton";

export function HoSoKhongThay({ san }: { san: boolean }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-3 px-5 py-20 text-center sm:py-24" data-ho-so-khong-thay>
      <h1 className="m-0 text-[length:var(--kin-co-h2)] font-semibold leading-tight text-[var(--kin-chu-chinh)]">Không tìm thấy gia sư này</h1>
      <p className="m-0 text-[length:var(--kin-co-body)] text-[var(--kin-chu-phu)]">Đường dẫn có thể sai, hoặc gia sư đã ẩn hồ sơ.</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {san
          ? <KinLinkButton href="/giang-vien">Xem danh sách gia sư</KinLinkButton>
          : <KinLinkButton href="/khoa-hoc">Xem lớp đang mở</KinLinkButton>}
        <KinLinkButton href="/" variant="secondary">Về trang chủ</KinLinkButton>
      </div>
    </div>
  );
}
