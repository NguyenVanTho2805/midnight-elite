import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "#f6f5f4" }}>
      <div className="text-center max-w-md">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-48 h-48 rounded-2xl text-7xl font-black"
            style={{ background: "#ffffff", border: "1px solid #e5e3df", color: "#0068FF" }}>
            404
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-3" style={{ color: "#37352f" }}>
          Trang không tồn tại
        </h1>
        <p className="text-sm mb-8" style={{ color: "#787671" }}>
          Đường dẫn bạn truy cập không tồn tại hoặc đã bị xóa. Hãy quay lại trang chủ.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/"
            className="px-8 py-3.5 rounded-lg text-sm font-bold text-white"
            style={{ background: "#0068FF", borderRadius: "8px" }}>
            Về trang chủ
          </Link>
          <Link href="/khoa-hoc"
            className="px-8 py-3.5 rounded-lg text-sm font-bold"
            style={{ background: "#ffffff", border: "1px solid #e5e3df", color: "#0068FF", borderRadius: "8px" }}>
            Xem khóa học
          </Link>
        </div>

        <p className="text-xs mt-8" style={{ color: "#a4a097" }}>
          Nếu bạn cho rằng đây là lỗi, hãy liên hệ{" "}
          <a href="mailto:support@tsix.vn" className="font-semibold" style={{ color: "#0068FF" }}>
            support@tsix.vn
          </a>
        </p>
      </div>
    </div>
  );
}
