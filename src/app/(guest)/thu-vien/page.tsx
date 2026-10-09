// TK-176 (09/10/2026) — Thư viện công khai.
// Figma Thanh: 30:2. Khu "Ngoài lớp" — tài liệu dùng chung cho mọi
// người, không nằm trong khung lớp.
//
// Giai đoạn đầu: liệt kê tài liệu tĩnh gom từ các khoá công khai
// (Course.status=true + Lesson.isFree=true có documents URL). Khi
// Thanh có bảng "Resource" độc lập (NV-194 chờ) sẽ chuyển sang query
// theo đó.
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Doc = {
  courseName: string;
  lessonTitle: string;
  url: string;
  label: string;
};

function parseDocuments(raw: string | null): Array<{ url: string; label: string }> {
  // Lesson.documents là chuỗi "label|url\nlabel|url" theo convention cũ.
  if (!raw) return [];
  return raw.split("\n").map(line => {
    const [label, url] = line.split("|").map(s => s.trim());
    if (!url || !/^https?:\/\//.test(url)) return null;
    return { label: label || url, url };
  }).filter((x): x is { url: string; label: string } => x !== null);
}

export default async function ThuVienPage() {
  // Lấy course công khai + sections → chapters → lessons có documents.
  // Giữ query ở Course root cho Prisma client sinh type đủ dùng (deep
  // nested where ở Lesson sinh type phức tạp vì schema cũ không có
  // reverse relation hoàn chỉnh).
  const courses = await prisma.course.findMany({
    where: { status: true },
    select: {
      name: true,
      sections: {
        select: {
          chapters: {
            select: {
              lessons: {
                select: { title: true, documents: true, isFree: true, isLocked: true },
              },
            },
          },
        },
      },
    },
    take: 50,
  });

  const docs: Doc[] = [];
  for (const c of courses) {
    for (const s of c.sections) {
      for (const ch of s.chapters) {
        for (const l of ch.lessons) {
          if (!l.isFree && l.isLocked) continue;   // chỉ bài công khai
          const list = parseDocuments(l.documents);
          for (const d of list) {
            docs.push({ courseName: c.name, lessonTitle: l.title, url: d.url, label: d.label });
          }
        }
      }
    }
  }

  // Group theo courseName để trình bày.
  const byCourse = new Map<string, Doc[]>();
  for (const d of docs) {
    const arr = byCourse.get(d.courseName) ?? [];
    arr.push(d);
    byCourse.set(d.courseName, arr);
  }

  return (
    <div style={{ background: "var(--kin-nen-trang)", minHeight: "100vh" }}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <header className="mb-5">
          <h1 className="text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>
            Thư viện
          </h1>
          <p className="text-caption mt-1" style={{ color: "var(--kin-chu-phu)" }}>
            Tài liệu công khai từ các khoá đang mở. Mở miễn phí, không cần đăng nhập.
          </p>
        </header>

        {docs.length === 0 ? (
          <div className="rounded-xl p-6 text-center text-sm"
            style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-phu)" }}>
            Chưa có tài liệu công khai.
          </div>
        ) : (
          <div className="space-y-5">
            {Array.from(byCourse.entries()).map(([courseName, docs]) => (
              <section key={courseName}>
                <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>
                  {courseName}
                </h2>
                <ul className="rounded-xl overflow-hidden"
                  style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
                  {docs.map((d, i) => (
                    <li key={`${d.url}-${i}`}
                      style={{ borderTop: i > 0 ? "1px solid var(--kin-vien-nhat)" : "none" }}>
                      <a href={d.url} target="_blank" rel="noopener noreferrer"
                        className="block px-4 py-3 hover:underline"
                        style={{ color: "var(--kin-chu-chinh)" }}>
                        <p className="font-medium">{d.label}</p>
                        <p className="text-caption mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>
                          {d.lessonTitle}
                        </p>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <footer className="mt-8 pt-4 text-center"
          style={{ borderTop: "1px solid var(--kin-vien-nhat)" }}>
          <Link href="/ban-do" className="text-caption hover:underline"
            style={{ color: "var(--kin-chu-phu)" }}>
            Xem bản đồ điều hướng →
          </Link>
        </footer>
      </div>
    </div>
  );
}
