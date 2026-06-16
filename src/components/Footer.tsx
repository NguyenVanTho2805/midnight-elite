import Link from "next/link";

const tools = [
  { label: "Thi thử ĐGNL miễn phí", href: "/thi-thu"       },
  { label: "Bảng xếp hạng",         href: "/bang-xep-hang" },
  { label: "Tra cứu điểm chuẩn",    href: "/diem-chuan"    },
  { label: "Tin tức tuyển sinh",     href: "/tin-tuc"       },
];

const socials = [
  { label: "Facebook", initial: "F", href: "https://facebook.com" },
  { label: "TikTok",   initial: "T", href: "https://tiktok.com"   },
  { label: "YouTube",  initial: "Y", href: "https://youtube.com"  },
  { label: "Zalo",     initial: "Z", href: "https://zalo.me"      },
];

export default function Footer() {
  return (
    <footer style={{ backgroundColor: "#ffffff", borderTop: "1px solid #e5e3df" }}>
      <div className="max-w-7xl mx-auto px-8 py-16">
        <div className="flex flex-col lg:flex-row justify-between gap-12">

          {/* Brand */}
          <div className="max-w-xs">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-5 no-underline">
              <div
                className="w-9 h-9 flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                style={{ backgroundColor: "#0068FF", borderRadius: "8px" }}
              >
                ME
              </div>
              <span className="text-base font-semibold" style={{ color: "#1a1a1a", letterSpacing: "-0.3px" }}>
                Midnight Elite
              </span>
            </Link>

            <p className="text-sm leading-relaxed mb-6" style={{ color: "#787671" }}>
              Nền tảng luyện thi ĐGNL & Tốt nghiệp THPT hàng đầu Việt Nam.
            </p>

            <div className="flex items-center gap-2">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={s.label}
                  className="w-8 h-8 flex items-center justify-center text-[11px] font-semibold
                             no-underline transition-colors duration-150
                             hover:border-[#0068FF] hover:text-[#0068FF]"
                  style={{
                    borderRadius: "8px",
                    border: "1px solid #e5e3df",
                    backgroundColor: "#f6f5f4",
                    color: "#787671",
                  }}
                >
                  {s.initial}
                </a>
              ))}
            </div>
          </div>

          {/* Công cụ */}
          <div>
            <p
              className="mb-4"
              style={{
                fontSize: "11px",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "#37352f",
              }}
            >
              Công cụ học tập
            </p>
            <ul className="space-y-3 list-none p-0 m-0">
              {tools.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm no-underline transition-colors duration-150 hover:text-[#1a1a1a]"
                    style={{ color: "#787671" }}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3"
          style={{ borderTop: "1px solid #e5e3df" }}
        >
          <p className="text-xs" style={{ color: "#a4a097" }}>
            © 2026 Midnight Elite. Bảo lưu mọi quyền.
          </p>
          <Link
            href="/chinh-sach"
            className="text-xs no-underline transition-colors duration-150 hover:text-[#1a1a1a]"
            style={{ color: "#787671" }}
          >
            Chính sách bảo mật
          </Link>
        </div>
      </div>
    </footer>
  );
}
