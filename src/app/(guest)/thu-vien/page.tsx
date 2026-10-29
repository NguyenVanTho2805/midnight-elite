// Thư viện (TK-176; Figma 30:2 "Bản ghi và tài liệu").
//   Học viên đã đăng nhập: thư viện của các LỚP MÌNH ĐANG HỌC — gom theo bài, kèm tiến độ xem và trạng thái bài nộp của chính mình.
//   Gia sư đã đăng nhập  : thư viện của các lớp mình dạy (kèm số bài nộp / chờ chấm), có lối sang sửa bài.
//   Khách / quản trị     : danh sách tài liệu CÔNG KHAI (chỉ bài miễn phí) từ các khoá đang mở.
// NC2-046: học sinh và khách đều có ô tìm (KhoTimKiem): tài liệu công khai + video YouTube do quản trị chọn; học sinh còn tìm được trong tài liệu của lớp mình.
// 14/10/2026: trước đây mọi người đều thấy danh sách công khai; và nó đọc tài liệu theo dạng "nhãn|url" trong khi dữ liệu thật là mảng JSON nên gần như luôn trống.
import Link from "next/link";
import { getSession } from "@/lib/session";
import LibraryView from "@/components/library/LibraryView";
import TutorLibrary from "@/components/library/TutorLibrary";
import { loadStudentLibrary, loadTutorLibrary } from "@/lib/libraryServer";
import { viewerHref } from "@/lib/library";
import { loadPublicDocs } from "@/lib/libraryKhoServer";
import { ownItemsOf } from "@/lib/libraryOwn";
import type { KhoDoc } from "@/lib/libraryKho";
import KhoTimKiem from "@/components/library/KhoTimKiem";

export const dynamic = "force-dynamic";

type Doc = KhoDoc;

async function PublicLibrary() {
  // Cùng một nguồn với ô tìm (src/lib/libraryKhoServer.ts): chỉ bài MIỄN PHÍ của các khoá đang mở mới công khai.
  const docs: Doc[] = await loadPublicDocs();

  const byCourse = new Map<string, Doc[]>();
  for (const d of docs) byCourse.set(d.courseName, [...(byCourse.get(d.courseName) ?? []), d]);

  return (
    <div style={{ background: "var(--kin-nen-trang)" }}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <header className="mb-5">
          <h1 className="text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Thư viện</h1>
          <p className="text-caption mt-1" style={{ color: "var(--kin-chu-phu)" }}>
            Tài liệu công khai từ các khoá đang mở. Mở miễn phí, không cần đăng nhập. Đăng nhập để xem bản ghi và tài liệu của lớp bạn đang học.
          </p>
        </header>

        {/* NC2-046: ô tìm tài liệu công khai + video do quản trị chọn */}
        <KhoTimKiem />

        {docs.length === 0 ? (
          <div className="rounded-xl p-6 text-center text-sm" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-phu)" }}>
            Chưa có tài liệu công khai.
          </div>
        ) : (
          <div className="space-y-5">
            {Array.from(byCourse.entries()).map(([courseName, list]) => (
              <section key={courseName}>
                <h2 className="text-sm font-semibold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>{courseName}</h2>
                <ul className="rounded-xl overflow-hidden" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
                  {list.map((d, i) => (
                    <li key={`${d.url}-${i}`} style={{ borderTop: i > 0 ? "1px solid var(--kin-vien-nhat)" : "none" }}>
                      <a href={viewerHref(d.name, d.url)} target="_blank" rel="noopener noreferrer" className="block px-4 py-3 hover:underline" style={{ color: "var(--kin-chu-chinh)" }}>
                        <p className="font-medium">{d.name}</p>
                        <p className="text-caption mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>{d.lessonTitle}</p>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <footer className="mt-8 pt-4 text-center" style={{ borderTop: "1px solid var(--kin-vien-nhat)" }}>
          <Link href="/ban-do" className="text-caption hover:underline" style={{ color: "var(--kin-chu-phu)" }}>Xem bản đồ điều hướng →</Link>
        </footer>
      </div>
    </div>
  );
}

export default async function ThuVienPage() {
  const session = await getSession();
  if (session?.role === "student") {
    const classes = await loadStudentLibrary(session.userId, new Date());
    // NC2-046: ô tìm gồm cả tài liệu của các lớp MÌNH đang học — làm phẳng từ chính dữ liệu đã tải theo phiên này (không có đường truy cập mới).
    return <LibraryView role="student" classes={classes} search={<KhoTimKiem own={ownItemsOf(classes)} />} />;
  }
  if (session?.role === "admin" && session.adminRole === "teacher") {
    // Thư viện của gia sư chỉ là bảng tài liệu; bài tập nằm ở module Bài tập nên không đẩy chúng sang trình duyệt.
    const classes = (await loadTutorLibrary(session.userId)).map(c => ({ ...c, lessons: c.lessons.map(l => ({ ...l, assignments: [] })) }));
    return <TutorLibrary classes={classes} />;
  }
  return <PublicLibrary />;
}
