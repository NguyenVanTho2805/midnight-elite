import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--surface)" }}>
      <div className="text-center max-w-md">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-48 h-48 rounded-2xl text-7xl font-black"
            style={{ background: "var(--canvas)", border: "1px solid var(--hairline)", color: "#5645d4" }}>
            404
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-3" style={{ color: "var(--charcoal)" }}>
          Trang không tồn tại
        </h1>
        <p className="text-sm mb-8" style={{ color: "var(--steel)" }}>
          Đường dẫn bạn truy cập không tồn tại hoặc đã bị xóa. Hãy quay lại trang chủ.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/"
            className="px-8 py-3.5 rounded-lg text-sm font-bold text-white"
            style={{ background: "#5645d4", borderRadius: "8px" }}>
            Về trang chủ
          </Link>
          <Link href="/khoa-hoc"
            className="px-8 py-3.5 rounded-lg text-sm font-bold"
            style={{ background: "var(--canvas)", border: "1px solid var(--hairline)", color: "#5645d4", borderRadius: "8px" }}>
            Xem khóa học
          </Link>
        </div>

        <p className="text-xs mt-8" style={{ color: "var(--stone)" }}>
          Nếu bạn cho rằng đây là lỗi, hãy liên hệ{" "}
          <a href="mailto:support@tsix.vn" className="font-semibold" style={{ color: "#5645d4" }}>
            support@tsix.vn
          </a>
        </p>
      </div>
    </div>
  );
}
