"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, CheckCircle, CloseCircle, BookOpen } from "griddy-icons";
import { LOOKUP_PHONE_RE, type LookupResult } from "@/lib/lookupPrivacy";

// NC2-053: người lạ chỉ nhận bản che (tên đã che + số khoá); chỉ chính học sinh đăng nhập mới nhận bản đủ (`detail: true`). Kiểu dùng chung với máy chủ.
type StudentResult = LookupResult;

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "HSA":  { bg: "var(--kin-nhan-nen-nhat)", text: "var(--kin-nhan-chu-tren-nhat)" },
  "THPT": { bg: "var(--kin-tt-nen-xong)", text: "var(--kin-tt-chu-xong)" },
  "V-ACT": { bg: "var(--kin-tt-nen-cho)", text: "var(--kin-tt-chu-cho)" },
};

function getCategoryStyle(category: string) {
  for (const key of Object.keys(CATEGORY_COLORS)) {
    if (category.toUpperCase().includes(key)) return CATEGORY_COLORS[key];
  }
  return { bg: "var(--kin-nen-re-chuot)", text: "var(--kin-chu-phu)" };
}

function getInitial(name: string) {
  const parts = name.trim().split(" ");
  return parts[parts.length - 1]?.[0]?.toUpperCase() ?? "?";
}

export default function TraCuuPage() {
  const [phone,    setPhone]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [results,  setResults]  = useState<StudentResult[] | null>(null);
  const [error,    setError]    = useState("");
  const [searched, setSearched] = useState(false);

  const isValidPhone = LOOKUP_PHONE_RE.test(phone.replace(/\s/g, ""));

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
      if (!res.ok) { setError(data.error ?? "Không tìm thấy"); }
      else         { setResults(data.results); }
    } catch {
      setError("Lỗi kết nối, vui lòng thử lại");
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-2xl mx-auto">

      {/* Header */}
      <div className="text-center mb-10">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4"
          style={{ background: "var(--kin-nhan-nen-nhat)", color: "var(--kin-nhan-link)", border: "1px solid var(--kin-nhan-vien)" }}>
          Dành cho học viên &amp; phụ huynh
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold mb-3"
          style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.5px" }}>
          Tra cứu <span style={{ color: "var(--kin-nhan-link)" }}>học viên</span>
        </h1>
        <p className="text-sm max-w-md mx-auto" style={{ color: "var(--kin-chu-mo)" }}>
          Nhập số điện thoại học sinh đã đăng ký để kiểm tra học viên. Mã học viên và danh sách khóa học chỉ hiện cho chính học sinh sau khi đăng nhập.
        </p>
      </div>

      {/* Search card */}
      <div className="rounded-xl p-6 mb-6"
        style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", boxShadow: "rgba(15,15,15,0.05) 0px 2px 8px 0px" }}>

        <form onSubmit={handleSearch} className="space-y-5">

          {/* Phone input */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>
              Số điện thoại đăng ký của học sinh
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phone}
                onChange={e => { setPhone(e.target.value); setSearched(false); }}
                placeholder="0901 234 567"
                className="notion-input w-full text-sm pr-10"
                style={{ color: "var(--kin-chu-chinh)" }}
              />
              <span className="absolute right-3 top-3">
                {phone && (isValidPhone
                  ? <CheckCircle size={14} style={{ color: "var(--kin-tt-chu-xong)" }} />
                  : <CloseCircle size={14} style={{ color: "var(--kin-tt-chu-loi)" }} />
                )}
              </span>
            </div>
            {phone && !isValidPhone ? (
              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--kin-tt-chu-loi)" }}>
                <CloseCircle size={11} /> Số điện thoại không hợp lệ (VD: 0901 234 567)
              </p>
            ) : (
              <p className="text-xs mt-1" style={{ color: "var(--kin-chu-mo)" }}>
                Chỉ tìm theo số học sinh dùng khi đăng ký; số của phụ huynh không dùng để tra cứu
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!isValidPhone || loading}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all"
            style={{
              background:    isValidPhone && !loading ? "var(--kin-nhan-nen)" : "var(--kin-vien-o-nhap)",
              borderRadius:  "8px",
              cursor:        isValidPhone && !loading ? "pointer" : "not-allowed",
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
        <div className="rounded-xl p-5 flex items-start gap-3"
          style={{ background: "var(--kin-tt-nen-cho)", border: "1px solid var(--kin-tt-vien-cho)" }}>
          <CloseCircle size={18} style={{ color: "var(--kin-tt-chu-cho)", flexShrink: 0, marginTop: "1px" }} />
          <div>
            <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--kin-tt-chu-cho)" }}>Không tìm thấy</p>
            <p className="text-xs" style={{ color: "var(--kin-tt-chu-cho)" }}>{error}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {results && results.length > 0 && (
        <div className="space-y-4">
          {results.map((student, i) => (
            <div key={i} className="rounded-xl overflow-hidden"
              style={{ border: "1px solid var(--kin-vien-thuong)", boxShadow: "rgba(15,15,15,0.05) 0px 2px 8px 0px" }}>

              {/* Student header */}
              <div className="px-5 py-4 flex items-center gap-4" style={{ background: "var(--kin-nen-trang)", borderBottom: "1px solid var(--kin-vien-nhat)" }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-lg font-bold text-white"
                  style={{ background: "var(--kin-nhan-nen)" }}>
                  {getInitial(student.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold truncate" style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.2px" }}>
                    {student.name}
                  </p>
                  {!student.detail ? (
                    <span className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Mã học viên chỉ hiện sau khi đăng nhập</span>
                  ) : student.studentId ? (
                    <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-md text-xs font-mono font-semibold"
                      style={{ background: "var(--kin-nhan-nen-nhat)", color: "var(--kin-nhan-chu-tren-nhat)", border: "1px solid var(--kin-nhan-vien)" }}>
                      HS-{student.studentId}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Chưa có mã học viên</span>
                  )}
                </div>
              </div>

              {/* Bản che (người chưa đăng nhập, hoặc không phải chính học sinh này) */}
              {!student.detail && (
                <div data-lookup-masked className="px-5 py-4" style={{ background: "var(--kin-nen-bang)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>
                    {student.courseCount === 0 ? "Chưa đăng ký khóa học nào" : `Đã đăng ký ${student.courseCount} khóa học`}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--kin-chu-mo)" }}>
                    Tên được che để bảo vệ học sinh. Học sinh đăng nhập bằng tài khoản của mình để xem mã học viên và danh sách khóa học;
                    phụ huynh đăng nhập và liên kết với con ở trang dành cho phụ huynh.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-5">
                    <Link href="/dang-nhap" className="inline-flex items-center min-h-11 text-sm font-semibold underline" style={{ color: "var(--kin-nhan-link)" }}>Đăng nhập</Link>
                    <Link href="/phu-huynh" className="inline-flex items-center min-h-11 text-sm font-semibold underline" style={{ color: "var(--kin-nhan-link)" }}>Dành cho phụ huynh</Link>
                  </div>
                </div>
              )}

              {/* Courses (bản đủ, chỉ cho chính học sinh) */}
              {student.detail && (
              <div className="px-5 py-4" style={{ background: "var(--kin-nen-bang)" }}>
                {student.courses.length === 0 ? (
                  <div className="flex items-center gap-2 py-2">
                    <BookOpen size={16} style={{ color: "var(--kin-vien-o-nhap)" }} />
                    <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>Chưa đăng ký khóa học nào</p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs font-semibold mb-3" style={{ color: "var(--kin-chu-mo)" }}>
                      KHÓA HỌC ĐÃ ĐĂNG KÝ ({student.courses.length})
                    </p>
                    <div className="space-y-2">
                      {student.courses.map(course => {
                        const catStyle = getCategoryStyle(course.category);
                        return (
                          <div key={course.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
                            style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ background: catStyle.bg }}>
                              <BookOpen size={13} style={{ color: catStyle.text }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate" style={{ color: "var(--kin-chu-chinh)" }}>
                                {course.name}
                              </p>
                              <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{course.shortTitle}</p>
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
              )}
            </div>
          ))}

          {/* Privacy note */}
          <p className="text-xs text-center mt-2" style={{ color: "var(--kin-vien-o-nhap)" }}>
            Người chưa đăng nhập chỉ thấy tên đã che và số khóa học; mã học viên và danh sách khóa chỉ hiện cho chính học sinh.
          </p>
        </div>
      )}
    </div>
  );
}
