"use client";

import { useState } from "react";
import { Search, CheckCircle, CloseCircle } from "griddy-icons";
import { normalizeVnPhone } from "@/lib/phone";

interface StudentResult {
  maskedName: string;
  studentId:  number | null;
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
  const [errorTitle, setErrorTitle] = useState("Không tìm thấy");
  const [searched, setSearched] = useState(false);

  const isValidPhone = normalizeVnPhone(phone) !== null;

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPhone) return;

    setLoading(true);
    setError("");
    setErrorTitle("Không tìm thấy");
    setResults(null);
    setSearched(false);

    try {
      const res  = await fetch("/api/tra-cuu", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503) setErrorTitle("Chưa mở");
        else if (res.status === 429) setErrorTitle("Thử lại sau");
        setError(data.error ?? "Không tìm thấy");
      } else {
        setResults(data.results);
      }
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
          Dành cho học viên
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold mb-3"
          style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.5px" }}>
          Tra cứu <span style={{ color: "var(--kin-nhan-link)" }}>học viên</span>
        </h1>
        <p className="text-sm max-w-md mx-auto" style={{ color: "var(--kin-chu-mo)" }}>
          Nhập số điện thoại đã xác minh bằng mã SMS trong tài khoản để xem mã học viên. Danh sách lớp xem sau khi đăng nhập.
        </p>
      </div>

      {/* Search card */}
      <div className="rounded-xl p-6 mb-6"
        style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", boxShadow: "rgba(15,15,15,0.05) 0px 2px 8px 0px" }}>

        <form onSubmit={handleSearch} className="space-y-5">

          {/* Phone input */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>
              Số điện thoại đã xác minh của học viên
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
                Chỉ khớp số đã xác minh bằng mã SMS, không khớp số tự khai
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
            <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--kin-tt-chu-cho)" }}>{errorTitle}</p>
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
                  {getInitial(student.maskedName)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold truncate" style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.2px" }}>
                    {student.maskedName}
                  </p>
                  {student.studentId ? (
                    <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-md text-xs font-mono font-semibold"
                      style={{ background: "var(--kin-nhan-nen-nhat)", color: "var(--kin-nhan-chu-tren-nhat)", border: "1px solid var(--kin-nhan-vien)" }}>
                      HS-{student.studentId}
                    </span>
                  ) : (
                    <span className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Chưa có mã học viên</span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Privacy note */}
          <p className="text-xs text-center mt-2" style={{ color: "var(--kin-vien-o-nhap)" }}>
            Chỉ hiện chữ cái đầu của tên và mã học viên. Tên đầy đủ và các lớp đang học xem sau khi đăng nhập.
          </p>
        </div>
      )}
    </div>
  );
}
