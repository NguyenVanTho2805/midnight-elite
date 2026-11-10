// GS-LOP-GON (09/11/2026) — DANH BẠ LỚP tách NGUYÊN VĂN từ admin/khoa-hoc/[id]/hoc-vien/page.tsx (TK-171, Figma 34:2 desktop, 108:2 mobile) để dùng ở hai nơi:
//  - trang quản trị /admin/khoa-hoc/[id]/hoc-vien (không `embedded`: giữ nguyên khung, "← Về trang lớp", h1 "Danh bạ lớp");
//  - tab "Học sinh" của lớp gia sư (`embedded`: không h1 / không khung riêng vì đầu lớp và dải tab đã có; thêm liên kết "Hồ sơ" tới /lop-cua-toi/hoc-sinh/em/<id>).
// Gia sư mở nó NHIỀU LẦN mỗi buổi (gọi tên, kiểm roster, mở Zalo PH) nên tải thẳng, không mount cả cây sửa khoá học. Token KiN (--kin-*); thẻ dọc trên điện thoại để không cuộn ngang.
// Trường hiển thị KHÔNG đổi so với bản cũ (tên, email, SĐT, trường, tiến độ, ngày ghi danh) — không thu thêm dữ liệu học sinh.
"use client";
import { useEffect, useState, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useContentHref } from "@/components/tutor/useContentHref";
import RemindClass from "@/components/admin/RemindClass";

type Student = {
  userId:       string;
  /** Trạng thái ghi danh (API /api/courses/[id]/students luôn trả). Chỉ em đang học / tạm dừng mới có hồ sơ: /api/tutor/hoc-sinh/<id> trả 403 cho em chờ đồng ý. */
  status?:      string;
  name:         string;
  email:        string;
  phone:        string | null;
  school:       string | null;
  enrolledAt:   string;
  completed:    number;
  totalLessons: number;
  progress:     number;
};

/** Em có hồ sơ riêng khi đang học hoặc tạm dừng (cùng luật với tutorHasStudent ở máy chủ). Thiếu status → coi là có (bản API cũ). */
const coHoSo = (s: Student) => s.status === undefined || s.status === "active" || s.status === "suspended";

export default function DanhBaLop({ courseId, embedded = false, emptyAction }: {
  courseId: string;
  /** true: nằm trong tab Học sinh của lớp gia sư (không h1, không khung trang, có liên kết "Hồ sơ"). */
  embedded?: boolean;
  /** Việc đi tiếp khi lớp chưa có em nào (vd. "Mời học sinh"). */
  emptyAction?: ReactNode;
}) {
  const href = useContentHref(); // BU-00 bước 3: gia sư ở bí danh /lop-cua-toi/quan-lop/…
  const [students, setStudents] = useState<Student[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [failed,   setFailed]   = useState(false);
  const [search,   setSearch]   = useState("");

  const load = useCallback(async () => {
    setLoading(true); setFailed(false);
    try {
      const r = await fetch(`/api/courses/${courseId}/students`, { credentials: "same-origin" });
      if (!r.ok) { setFailed(true); return; }
      const d = await r.json();
      setStudents(d.students ?? []);
      setTotal(d.total ?? 0);
    } catch { setFailed(true); } finally { setLoading(false); }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? students.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.phone ?? "").includes(q))
    : students;

  const inner = (
    <>
        {embedded ? (
          <p data-danh-ba-dem className="mb-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
            {loading ? "Đang tải danh bạ…" : failed ? "" : total === 0 ? "Chưa có em nào ghi danh." : `${total} em trong lớp`}
          </p>
        ) : (
        <header className="mb-5">
          <Link href={href(`/admin/khoa-hoc/${courseId}`)}
            className="text-sm hover:underline"
            style={{ color: "var(--kin-chu-phu)" }}>
            ← Về trang lớp
          </Link>
          <h1 className="mt-2 text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>
            Danh bạ lớp
          </h1>
          <p className="text-caption mt-1" style={{ color: "var(--kin-chu-phu)" }}>
            {total === 0 ? "Chưa có em nào ghi danh." : `${total} em trong lớp`}
          </p>
        </header>
        )}

        <RemindClass courseId={courseId} recipients={total} />

        <div className="mb-4">
          <input
            type="text"
            placeholder="Tìm tên, email, SĐT…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Tìm học sinh trong lớp"
            className="w-full px-3 min-h-11 text-sm rounded-lg outline-none focus:ring-2"
            style={{
              background:  "var(--kin-nen-bang)",
              color:       "var(--kin-chu-chinh)",
              border:      "1px solid var(--kin-vien-thuong)",
            }}
          />
        </div>

        {loading ? (
          <div role="status" aria-busy="true" className="py-16 text-center text-sm" style={{ color: "var(--kin-chu-phu)" }}>
            Đang tải danh sách…
          </div>
        ) : failed ? (
          <div role="alert" data-danh-ba-loi className="py-10 text-center text-sm" style={{ color: "var(--kin-tt-chu-loi)" }}>
            <p>Chưa tải được danh bạ lớp.</p>
            <button type="button" onClick={() => void load()} className="mt-3 inline-flex items-center min-h-11 px-4 rounded-lg border" style={{ borderColor: "var(--kin-vien-thuong)", color: "var(--kin-chu-chinh)" }}>Thử lại</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: "var(--kin-chu-phu)" }}>
            {total === 0 ? "Chưa có em nào ghi danh." : "Không tìm thấy em nào khớp."}
            {total === 0 && emptyAction && <div className="mt-4">{emptyAction}</div>}
          </div>
        ) : (
          <>
            {/* Desktop: bảng */}
            <div className="hidden sm:block overflow-x-auto rounded-xl"
              style={{ border: "1px solid var(--kin-vien-thuong)", background: "var(--kin-nen-bang)" }}>
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr style={{ background: "var(--kin-nen-nhan)", borderBottom: "1px solid var(--kin-vien-thuong)" }}>
                    {["Học sinh", "Email", "SĐT", "Trường", "Tiến độ", "Ghi danh", ...(embedded ? ["Hồ sơ"] : [])].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase whitespace-nowrap"
                        style={{ color: "var(--kin-chu-phu)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.userId}
                      style={{ borderTop: "1px solid var(--kin-vien-nhat)" }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-[var(--kin-nhan-chu-tren-nen)] flex-shrink-0"
                            style={{ background: "var(--kin-nhan-nen)" }}>
                            {s.name[0]?.toUpperCase() ?? "?"}
                          </div>
                          <span className="font-medium" style={{ color: "var(--kin-chu-chinh)" }}>{s.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--kin-chu-phu)" }}>{s.email}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--kin-chu-phu)" }}>{s.phone || "—"}</td>
                      <td className="px-4 py-3 text-xs max-w-[160px] truncate" style={{ color: "var(--kin-chu-phu)" }}>{s.school || "—"}</td>
                      <td className="px-4 py-3">
                        <ProgressBar progress={s.progress} completed={s.completed} total={s.totalLessons} />
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "var(--kin-chu-phu)" }}>
                        {new Date(s.enrolledAt).toLocaleDateString("vi-VN")}
                      </td>
                      {embedded && (
                        <td className="px-4 py-1">
                          {coHoSo(s)
                            ? <Link href={`/lop-cua-toi/hoc-sinh/em/${encodeURIComponent(s.userId)}`} aria-label={`Hồ sơ của ${s.name}`} className="inline-flex items-center min-h-11 text-xs underline" style={{ color: "var(--kin-nhan-link)" }}>Hồ sơ</Link>
                            : <span className="inline-flex items-center min-h-11 text-xs" data-cho-dong-y style={{ color: "var(--kin-chu-phu)" }}>Chờ đồng ý</span>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: card dọc */}
            <div className="sm:hidden space-y-3">
              {filtered.map(s => (
                <div key={s.userId}
                  className="rounded-xl p-4"
                  style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-[var(--kin-nhan-chu-tren-nen)] flex-shrink-0"
                      style={{ background: "var(--kin-nhan-nen)" }}>
                      {s.name[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate" style={{ color: "var(--kin-chu-chinh)" }}>{s.name}</p>
                      <p className="text-xs truncate mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>{s.email}</p>
                      {s.phone && (
                        <p className="text-xs mt-0.5" style={{ color: "var(--kin-chu-phu)" }}>
                          <a href={`tel:${s.phone}`} className="hover:underline">{s.phone}</a>
                        </p>
                      )}
                      {s.school && (
                        <p className="text-xs mt-0.5 truncate" style={{ color: "var(--kin-chu-phu)" }}>{s.school}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <ProgressBar progress={s.progress} completed={s.completed} total={s.totalLessons} />
                  </div>
                  <p className="text-caption mt-2" style={{ color: "var(--kin-chu-phu)" }}>
                    Ghi danh {new Date(s.enrolledAt).toLocaleDateString("vi-VN")}
                  </p>
                  {embedded && (
                    coHoSo(s)
                      ? <Link href={`/lop-cua-toi/hoc-sinh/em/${encodeURIComponent(s.userId)}`} aria-label={`Hồ sơ của ${s.name}`} className="mt-1 inline-flex items-center min-h-11 text-sm underline" style={{ color: "var(--kin-nhan-link)" }}>Hồ sơ của em</Link>
                      : <span className="mt-1 inline-flex items-center min-h-11 text-sm" data-cho-dong-y style={{ color: "var(--kin-chu-phu)" }}>Chờ đồng ý</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
    </>
  );
  if (embedded) return <div data-danh-ba className="min-w-0">{inner}</div>;
  return (
    <div style={{ background: "var(--kin-nen-trang)", minHeight: "100vh" }}>
      <div className="max-w-5xl mx-auto px-4 py-6">{inner}</div>
    </div>
  );
}

function ProgressBar({ progress, completed, total }: { progress: number; completed: number; total: number }) {
  // Dùng 3 màu nghĩa không đổi theo chủ đề (TK-169):
  //   ≥ 80%: xong → kin-tt-chu-xong
  //   40–79%: đang chạy → kin-tt-chu-cho
  //   < 40% : chậm → kin-tt-chu-loi
  const color =
    progress >= 80 ? "var(--kin-tt-chu-xong)" :
    progress >= 40 ? "var(--kin-tt-chu-cho)"  :
                     "var(--kin-tt-chu-loi)";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full min-w-[60px]"
        style={{ background: "var(--kin-nen-nhan)" }}>
        <div className="h-1.5 rounded-full transition-all"
          style={{ width: `${progress}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold whitespace-nowrap"
        style={{ color: "var(--kin-chu-chinh)" }}>
        {completed}/{total} ({progress}%)
      </span>
    </div>
  );
}
