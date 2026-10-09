// TK-171 (06/10/2026) — Danh sách HS (roster) cho gia sư.
// Figma 34:2 (desktop), 108:2 (mobile).
//
// Trang này tách khỏi tab "hoc-vien" cũ trong /admin/khoa-hoc/[id]
// vì gia sư mở nó NHIỀU LẦN mỗi buổi (gọi tên, kiểm roster, mở Zalo PH).
// Trang riêng → load thẳng, không mount cả tree edit khoá học.
//
// Áp dụng token KiN (--kin-*) + đổi sang card trên mobile để không bị
// cuộn ngang như bảng cũ.
"use client";
import { useEffect, useState, useCallback, use as usePromise } from "react";
import Link from "next/link";

type Student = {
  userId:       string;
  name:         string;
  email:        string;
  phone:        string | null;
  school:       string | null;
  enrolledAt:   string;
  completed:    number;
  totalLessons: number;
  progress:     number;
};

export default function RosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: courseId } = usePromise(params);
  const [students, setStudents] = useState<Student[]>([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/courses/${courseId}/students`, { credentials: "same-origin" });
      if (!r.ok) { setLoading(false); return; }
      const d = await r.json();
      setStudents(d.students ?? []);
      setTotal(d.total ?? 0);
    } finally { setLoading(false); }
  }, [courseId]);

  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? students.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.phone ?? "").includes(q))
    : students;

  return (
    <div style={{ background: "var(--kin-nen-trang)", minHeight: "100vh" }}>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <header className="mb-5">
          <Link href={`/admin/khoa-hoc/${courseId}`}
            className="text-sm hover:underline"
            style={{ color: "var(--kin-chu-phu)" }}>
            ← Về trang lớp
          </Link>
          <h1 className="mt-2 text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>
            Danh sách học sinh
          </h1>
          <p className="text-caption mt-1" style={{ color: "var(--kin-chu-phu)" }}>
            {total === 0 ? "Chưa có em nào ghi danh." : `${total} em trong lớp`}
          </p>
        </header>

        <div className="mb-4">
          <input
            type="text"
            placeholder="Tìm tên, email, SĐT…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2.5 text-sm rounded-lg outline-none focus:ring-2"
            style={{
              background:  "var(--kin-nen-bang)",
              color:       "var(--kin-chu-chinh)",
              border:      "1px solid var(--kin-vien-thuong)",
            }}
          />
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm" style={{ color: "var(--kin-chu-phu)" }}>
            Đang tải danh sách…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: "var(--kin-chu-phu)" }}>
            {total === 0 ? "Chưa có em nào ghi danh." : "Không tìm thấy em nào khớp."}
          </div>
        ) : (
          <>
            {/* Desktop: bảng */}
            <div className="hidden sm:block overflow-x-auto rounded-xl"
              style={{ border: "1px solid var(--kin-vien-thuong)", background: "var(--kin-nen-bang)" }}>
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr style={{ background: "var(--kin-nen-nhan)", borderBottom: "1px solid var(--kin-vien-thuong)" }}>
                    {["Học sinh", "Email", "SĐT", "Trường", "Tiến độ", "Ghi danh"].map(h => (
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
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ background: "var(--kin-th-navy)" }}>
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
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                      style={{ background: "var(--kin-th-navy)" }}>
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
                </div>
              ))}
            </div>
          </>
        )}
      </div>
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
