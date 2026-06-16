"use client";

import { useState } from "react";
import { Search, CheckCircle, CloseCircle, BookOpen } from "griddy-icons";

interface CourseResult {
  id:         string;
  name:       string;
  shortTitle: string;
  category:   string;
  status:     boolean;
}

interface StudentResult {
  name:      string;
  studentId: number | null;
  courses:   CourseResult[];
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "HSA":   { bg: "#dbeafe", text: "#1d4ed8" },
  "THPT":  { bg: "#dcfce7", text: "#15803d" },
  "V-ACT": { bg: "#fef9c3", text: "#854d0e" },
};

function getCategoryStyle(category: string) {
  for (const key of Object.keys(CATEGORY_COLORS)) {
    if (category.toUpperCase().includes(key)) return CATEGORY_COLORS[key];
  }
  return { bg: "#f1f0ef", text: "#57534e" };
}

function getInitial(name: string) {
  const parts = name.trim().split(" ");
  return parts[parts.length - 1]?.[0]?.toUpperCase() ?? "?";
}

export default function StudentTraCuuPage() {
  const [phone,    setPhone]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [results,  setResults]  = useState<StudentResult[] | null>(null);
  const [error,    setError]    = useState("");
  const [searched, setSearched] = useState(false);

  const isValidPhone = /^(0[3|5|7|8|9])[0-9]{8}$/.test(phone.replace(/\s/g, ""));

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPhone) return;

    setLoading(true);
    setError("");
    setResults(null);
    setSearched(false);

    try {
      const res  = await fetch("/api/tra-cuu", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone: phone.replace(/\s/g, "") }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Không tìm thấy");
      else         setResults(data.results);
    } catch {
      setError("Lỗi kết nối, vui lòng thử lại");
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold mb-1" style={{ color: "#1E2938", letterSpacing: "-0.4px" }}>
          Tra cứu học viên
        </h1>
        <p className="text-sm" style={{ color: "#787671" }}>
          Nhập số điện thoại để kiểm tra mã học viên và các khoá học đã đăng ký.
        </p>
      </div>

      {/* Search card */}
      <div className="rounded-xl p-6 mb-6"
        style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
        <form onSubmit={handleSearch} className="space-y-5">

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#37352f" }}>
              Số điện thoại học sinh hoặc phụ huynh
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phone}
                onChange={e => { setPhone(e.target.value); setSearched(false); }}
                placeholder="0901 234 567"
                className="notion-input w-full text-sm pr-10"
                style={{ color: "#1a1a1a" }}
              />
              <span className="absolute right-3 top-3">
                {phone && (isValidPhone
                  ? <CheckCircle size={14} style={{ color: "#16a34a" }} />
                  : <CloseCircle size={14} style={{ color: "#ef4444" }} />
                )}
              </span>
            </div>
            {phone && !isValidPhone ? (
              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "#dc2626" }}>
                <CloseCircle size={11} /> Số điện thoại không hợp lệ (VD: 0901 234 567)
              </p>
            ) : (
              <p className="text-xs mt-1" style={{ color: "#a4a097" }}>
                Hệ thống tự động tìm theo SĐT học sinh và SĐT phụ huynh
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!isValidPhone || loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{
              background: isValidPhone && !loading ? "#0068FF" : "#c8c4be",
              cursor:     isValidPhone && !loading ? "pointer" : "not-allowed",
            }}>
            {loading
              ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Search size={15} />
            }
            {loading ? "Đang tìm kiếm..." : "Tra cứu"}
          </button>
        </form>
      </div>

      {/* Error */}
      {searched && error && (
        <div className="rounded-xl p-5 flex items-start gap-3 mb-4"
          style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
          <CloseCircle size={18} style={{ color: "#c2410c", flexShrink: 0, marginTop: "1px" }} />
          <div>
            <p className="text-sm font-semibold mb-0.5" style={{ color: "#c2410c" }}>Không tìm thấy</p>
            <p className="text-xs" style={{ color: "#9a3412" }}>{error}</p>
          </div>
        </div>
      )}

      {/* No results */}
      {searched && !error && results && results.length === 0 && (
        <div className="rounded-xl p-8 text-center" style={{ border: "1px solid #e5e3df" }}>
          <Search size={32} style={{ color: "#c8c4be", margin: "0 auto 12px" }} />
          <p className="text-sm font-semibold mb-1" style={{ color: "#37352f" }}>
            Không tìm thấy học viên
          </p>
          <p className="text-xs" style={{ color: "#a4a097" }}>
            Không có học viên nào đăng ký với số điện thoại này
          </p>
        </div>
      )}

      {/* Results */}
      {results && results.length > 0 && (
        <div className="space-y-4">
          {results.map((student, i) => (
            <div key={i} className="rounded-xl overflow-hidden"
              style={{ border: "1px solid #e5e3df" }}>

              {/* Student header */}
              <div className="px-5 py-4 flex items-center gap-4"
                style={{ background: "#ffffff", borderBottom: "1px solid #f1f0ef" }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-lg font-bold text-white"
                  style={{ background: "#0068FF" }}>
                  {getInitial(student.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold truncate" style={{ color: "#1a1a1a", letterSpacing: "-0.2px" }}>
                    {student.name}
                  </p>
                  {student.studentId ? (
                    <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-md text-xs font-mono font-semibold"
                      style={{ background: "#dbeafe", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
                      HS-{student.studentId}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: "#a4a097" }}>Chưa có mã học viên</span>
                  )}
                </div>
              </div>

              {/* Courses */}
              <div className="px-5 py-4" style={{ background: "#fafaf9" }}>
                {student.courses.length === 0 ? (
                  <div className="flex items-center gap-2 py-2">
                    <BookOpen size={16} style={{ color: "#c8c4be" }} />
                    <p className="text-sm" style={{ color: "#a4a097" }}>Chưa đăng ký khoá học nào</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-semibold mb-3" style={{ color: "#787671" }}>
                      KHOÁ HỌC ĐÃ ĐĂNG KÝ ({student.courses.length})
                    </p>
                    <div className="space-y-2">
                      {student.courses.map(course => {
                        const catStyle = getCategoryStyle(course.category);
                        return (
                          <div key={course.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                            style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: catStyle.bg }}>
                              <BookOpen size={13} style={{ color: catStyle.text }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: "#1a1a1a" }}>
                                {course.name}
                              </p>
                              <p className="text-xs" style={{ color: "#787671" }}>{course.shortTitle}</p>
                            </div>
                            <span className="px-2 py-0.5 rounded-md text-xs font-semibold flex-shrink-0"
                              style={{ background: catStyle.bg, color: catStyle.text }}>
                              {course.category}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}

          <p className="text-xs text-center" style={{ color: "#c8c4be" }}>
            Chỉ hiển thị mã học viên và khoá học đã đăng ký.
          </p>
        </div>
      )}
    </div>
  );
}
