// TK-177 (09/10/2026) — Bản đồ đường vào.
// Figma Thanh: 33:2. Sơ đồ điều hướng cho người mới.
//
// Mục đích: người lần đầu vào trang KiN có 1 chỗ nhìn thấy TOÀN BỘ
// các cổng vào — không phải lục menu. 4 nhóm theo vai:
//   - Người dùng mới (chưa đăng nhập)
//   - Học viên
//   - Gia sư
//   - Phụ huynh
import Link from "next/link";

type Section = {
  role: string;
  roleNote: string;
  color: string;      // --kin-ph-* indicator chip
  entries: Array<{ href: string; label: string; note: string; external?: boolean }>;
};

const SECTIONS: Section[] = [
  {
    role: "Mọi người (chưa cần đăng nhập)",
    roleNote: "Nhìn qua trước khi quyết",
    color: "var(--kin-ph-lms)",
    entries: [
      { href: "/khoa-hoc",  label: "Danh mục khoá",   note: "Xem lớp đang mở" },
      { href: "/thu-vien",  label: "Thư viện",         note: "Tài liệu công khai" },
      { href: "/cong-dong", label: "Cộng đồng",        note: "Hỏi đáp, bài viết" },
      { href: "/dang-ky",   label: "Đăng ký học viên", note: "Có mã lớp từ gia sư? Mở đây" },
    ],
  },
  {
    role: "Học viên",
    roleNote: "Đang học KiN",
    color: "var(--kin-ph-class)",
    entries: [
      { href: "/student/viec-cua-toi",   label: "Việc của tôi",  note: "Bài cần nộp, hạn sắp tới" },
      { href: "/lop-cua-toi",            label: "Lớp của tôi",   note: "Các lớp bạn đang học" },
      { href: "/student/hoc-tap",        label: "Học tập",        note: "Chương - bài - tiến độ" },
      { href: "/student/lich-hoc",       label: "Lịch học",       note: "Buổi tuần này + sắp tới" },
      { href: "/student/hoc-phi",        label: "Học phí",        note: "Phiếu + VietQR" },
      { href: "/cai-dat/chu-de",         label: "Đổi chủ đề",     note: "5 chủ đề × 3 chế độ" },
    ],
  },
  {
    role: "Gia sư",
    roleNote: "Dạy lớp trên KiN",
    color: "var(--kin-ph-hub)",
    entries: [
      { href: "/lop-cua-toi",            label: "Hộp việc",        note: "Việc cần xử lý: đối soát, báo nghỉ, bài chưa chấm" },
      { href: "/lop-cua-toi/lich",       label: "Lịch",            note: "Buổi dạy, nhắc lịch, báo nghỉ sát giờ" },
      { href: "/lop-cua-toi/lop",        label: "Lớp",             note: "Danh sách lớp, học viên, mã mời" },
      { href: "/lop-cua-toi/hoc-phi",    label: "Học phí",         note: "Phiếu học phí và đối soát chuyển khoản" },
      // Qua cửa đăng nhập của tên miền chính: khách bấm thẳng /admin/khoa-hoc sẽ bị đẩy sang cửa đăng nhập QUẢN TRỊ (tên miền admin) — nơi gia sư không đăng nhập được.
      // Gia sư đã đăng nhập thì /dang-nhap?redirect= đưa thẳng tới /admin/khoa-hoc (xem src/lib/hostRouting.ts), nên không thêm bước nào.
      { href: "/dang-nhap?redirect=%2Fadmin%2Fkhoa-hoc", label: "Quản khoá", note: "Tạo lớp + chương bài + điểm danh" },
    ],
  },
  {
    role: "Phụ huynh",
    roleNote: "Theo dõi con",
    color: "var(--kin-ph-exam)",
    entries: [
      { href: "#so-cua-con",   label: "Sổ của con",     note: "Mở link gia sư gửi qua Zalo (không cần đăng nhập)" },
      { href: "/phu-huynh",    label: "Phụ huynh vào thế nào?", note: "Không tài khoản, không mật khẩu" },
    ],
  },
];

export default function BanDoPage() {
  return (
    <div style={{ background: "var(--kin-nen-trang)", minHeight: "100vh" }}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <header className="mb-5">
          <h1 className="text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>
            Bản đồ đường vào
          </h1>
          <p className="text-caption mt-1" style={{ color: "var(--kin-chu-phu)" }}>
            Chọn vai của bạn — bên dưới là các cổng vào tương ứng. Không cần
            lục menu.
          </p>
        </header>

        <div className="space-y-5">
          {SECTIONS.map(sec => (
            <section key={sec.role} className="rounded-xl p-4"
              style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
              <header className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full" style={{ background: sec.color }} aria-hidden />
                <h2 className="text-sm font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>
                  {sec.role}
                </h2>
                <span className="text-caption" style={{ color: "var(--kin-chu-mo)" }}>
                  · {sec.roleNote}
                </span>
              </header>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sec.entries.map(e => {
                  const content = (
                    <div className="h-full rounded-lg p-3 flex flex-col gap-1 transition-colors"
                      style={{
                        background: "var(--kin-nen-trang)",
                        border:     "1px solid var(--kin-vien-nhat)",
                      }}>
                      <p className="text-sm font-medium" style={{ color: "var(--kin-chu-chinh)" }}>
                        {e.label}
                      </p>
                      <p className="text-caption" style={{ color: "var(--kin-chu-phu)" }}>
                        {e.note}
                      </p>
                    </div>
                  );
                  return (
                    <li key={e.href + e.label}>
                      {e.href.startsWith("#") ? (
                        <div className="opacity-60">{content}</div>
                      ) : (
                        <Link href={e.href} className="block h-full">{content}</Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <footer className="mt-8 pt-4 text-center text-caption"
          style={{ borderTop: "1px solid var(--kin-vien-nhat)", color: "var(--kin-chu-mo)" }}>
          KiN · Sổ lớp cho gia sư
        </footer>
      </div>
    </div>
  );
}
