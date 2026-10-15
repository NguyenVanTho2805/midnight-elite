import Link from "next/link";
import { KinMark } from "@/components/kin/KinLogo";

// Figma KiN 152:36 "Footer": thương hiệu + hai cột "Công cụ học tập" và "Vai trò".
// Thêm cột "Hỗ trợ" (hotline, Zalo) vì đó là thông tin liên hệ thật đang dùng.
const tools = [
  { label: "Thi thử ĐGNL miễn phí", href: "/thi-thu"       },
  { label: "Bảng xếp hạng",         href: "/bang-xep-hang" },
  { label: "Tra cứu điểm chuẩn",    href: "/diem-chuan"    },
  { label: "Tin tức tuyển sinh",    href: "/tin-tuc"       },
  // Figma chỉ có 4 mục ở cột này; thêm "Gia sư" vì thanh trên không còn mục này và /giang-vien không có lối vào nào khác.
  { label: "Danh sách gia sư",      href: "/giang-vien"    },
];

const roles = [
  { label: "Dành cho học sinh",  href: "/dang-ky"    },
  { label: "Dành cho gia sư",    href: "/dang-ky?vai=gia-su" },
  { label: "Dành cho phụ huynh", href: "/phu-huynh"  },
];

const colTitle = "mb-[14px] text-[length:var(--kin-co-caption)] font-semibold uppercase tracking-[0.09em] text-[var(--kin-chu-chinh)]";
const link = "inline-flex items-center min-h-6 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)] transition-colors hover:text-[var(--kin-chu-chinh)]";

export default function Footer() {
  return (
    <footer
      data-vung="sang"
      className="kin-chu-than bg-[var(--kin-nen-trang)] border-t border-[var(--kin-vien-thuong)]"
    >
      <div className="mx-auto max-w-[1440px] px-4 sm:px-8 py-14">
        <div className="flex flex-col md:flex-row md:flex-wrap gap-10 lg:gap-[60px]">

          {/* Thương hiệu */}
          <div className="md:flex-1 md:min-w-[260px] md:max-w-[320px]">
            <Link href="/" aria-label="KiN — trang chủ" className="inline-flex items-center gap-[9px] mb-[14px]">
              <KinMark size={26} />
              <span className="kin-chu-logo leading-none text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)]">KiN</span>
            </Link>
            <p className="text-[length:var(--kin-co-small)] leading-[1.55] text-[var(--kin-chu-mo)]">
              Nền tảng học cùng gia sư thật cho luyện thi ĐGNL &amp; Tốt nghiệp THPT.
            </p>
          </div>

          <nav aria-label="Công cụ học tập">
            <p className={colTitle}>Công cụ học tập</p>
            <ul className="list-none p-0 m-0 flex flex-col gap-[5px]">
              {tools.map((item) => (
                <li key={item.href}><Link href={item.href} className={link}>{item.label}</Link></li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Vai trò">
            <p className={colTitle}>Vai trò</p>
            <ul className="list-none p-0 m-0 flex flex-col gap-[5px]">
              {roles.map((item) => (
                <li key={item.href}><Link href={item.href} className={link}>{item.label}</Link></li>
              ))}
            </ul>
          </nav>

          <div>
            <p className={colTitle}>Hỗ trợ</p>
            <ul className="list-none p-0 m-0 flex flex-col gap-[5px]">
              <li><a href="tel:0384409051" className={link}>Hotline: 0384 409 051</a></li>
              <li>
                <a href="https://zalo.me/0384409051" target="_blank" rel="noopener noreferrer" className={link}>
                  Zalo tư vấn
                </a>
              </li>
              <li className="inline-flex items-center min-h-6 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">
                Hỗ trợ: 09:00 – 21:30 hằng ngày
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--kin-vien-thuong)]">
          <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">© 2026 KiN. Bảo lưu mọi quyền.</p>
          <Link href="/chinh-sach" className={link}>Chính sách bảo mật</Link>
        </div>
      </div>
    </footer>
  );
}
