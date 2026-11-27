import Link from "next/link";
import { connection } from "next/server";
import { nutChinhTo } from "@/components/ui/nut";
import { dangNhapThuBat, VAI_THU } from "@/server/dang-nhap-thu";
import { cauHinhGoogle, type MaLoi } from "@/server/google";
import { nguoiHienTai } from "@/server/phien";
import { DangXuat } from "./dang-xuat";
import { NutDoiGiaoDien } from "@/components/khung/doi-giao-dien";
import { NutVai } from "./nut-vai";

const LOI: Record<MaLoi, string> = {
  chua_cau_hinh: "Đăng nhập Google chưa được bật trên bản này. Báo chủ lớp.",
  huy: "Bạn đã huỷ đăng nhập Google. Bấm lại nút bên dưới khi sẵn sàng.",
  het_han: "Lượt đăng nhập đã hết hạn hoặc không hợp lệ. Bấm lại nút bên dưới.",
  google_loi: "Chưa xác nhận được với Google. Thử lại sau ít phút.",
  chua_xac_minh: "Tài khoản Google này chưa xác minh email. Hãy dùng Gmail khác.",
  khong_co_tai_khoan:
    "Gmail vừa chọn chưa có trong lớp. Kiểm tra lại đã chọn đúng tài khoản Google. Học sinh: dùng Gmail đã ghi trong phiếu đăng ký, hoặc nhắn chủ lớp sửa Gmail trong hồ sơ. Giáo viên: nhờ chủ lớp thêm Gmail của bạn.",
  tai_khoan_khoa: "Tài khoản này đã bị khoá. Liên hệ chủ lớp.",
  ho_so_an: "Hồ sơ của em đang tạm ẩn. Nhắn chủ lớp nếu muốn học lại.",
  trung_gmail: "Gmail này khớp với nhiều hồ sơ. Nhắn chủ lớp để gộp lại.",
};

function BieuTuongGoogle() {
  return (
    <span aria-hidden="true" className="inline-flex size-7 items-center justify-center rounded-full bg-white">
      <svg viewBox="0 0 48 48" className="size-[18px]">
        <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z" />
        <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.2C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.8l7.9-6.2z" />
        <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.2C6.6 42.6 14.6 48 24 48z" />
      </svg>
    </span>
  );
}

export default async function DangNhap({ searchParams }: { searchParams: Promise<{ loi?: string | string[] }> }) {
  await connection(); // đọc biến môi trường lúc chạy, không lúc build
  const [{ loi }, u, dev] = await Promise.all([searchParams, nguoiHienTai(), dangNhapThuBat()]);
  const google = !!cauHinhGoogle();
  const ma = typeof loi === "string" ? loi : undefined;
  const thongBao = ma ? (Object.hasOwn(LOI, ma) ? LOI[ma as MaLoi] : "Đăng nhập chưa thành công. Thử lại.") : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
      <div className="flex items-start justify-between gap-2"><h1 className="text-[28px] font-extrabold leading-tight">BCA Midnight</h1><NutDoiGiaoDien className="-mr-3 -mt-1" /></div>
      <p className="mt-1 text-text-2">Lớp ôn BCA · ĐGNL — học Google Meet lúc 22:15.</p>

      {u ? (
        <section className="mt-8 rounded-[14px] border border-border bg-surface p-4">
          <p>
            Bạn đang đăng nhập là <b>{u.ten}</b>.
          </p>
          <div className="mt-4 flex gap-3">
            <Link href="/" className={`${nutChinhTo} flex-1`}>
              Vào lớp
            </Link>
            <DangXuat />
          </div>
        </section>
      ) : (
        <section className="mt-8">
          {thongBao && (
            <p role="alert" className="mb-4 rounded-[14px] border border-danger bg-danger-bg p-3 text-sm">
              {thongBao}
            </p>
          )}
          {google ? (
            <>
              {/* Thẻ <a> thường (không Link): điều hướng cả trang sang route bắt đầu → Google. */}
              <a href="/api/dang-nhap/google" className={`${nutChinhTo} w-full`}>
                <BieuTuongGoogle />
                Đăng nhập bằng Google
              </a>
              <p className="mt-3 text-sm text-text-2">
                Học sinh dùng Gmail đã ghi trong phiếu đăng ký. Giáo viên dùng Gmail chủ lớp đã thêm. Gmail khác sẽ không vào được.
              </p>
            </>
          ) : (
            <p className="rounded-[14px] border border-border bg-surface p-3 text-sm text-text-2">
              Đăng nhập Google chưa được bật trên bản này (thiếu <code>BCA_GOOGLE_CLIENT_ID</code> / <code>BCA_GOOGLE_CLIENT_SECRET</code>). Báo chủ lớp.
            </p>
          )}
        </section>
      )}

      {dev && (
        <section className="mt-10 border-t border-border pt-6">
          <h2 className="font-semibold">Đăng nhập thử theo vai</h2>
          <p className="mt-1 text-sm text-text-2">Chỉ có trên dữ liệu giả (BCA_DEV_LOGIN=1), không bao giờ ở bản chính thức.</p>
          <div className="mt-4 grid gap-3">
            {Object.entries(VAI_THU).map(([vai, ten]) => (
              <NutVai key={vai} vai={vai} ten={ten} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
