"use client";

import { useState, useMemo } from "react";
import { Search } from "griddy-icons";

const allData = [
  { school: "ĐH Bách Khoa Hà Nội", major: "Khoa học Máy tính", score2025: 28.5, score2024: 28.1, score2023: 27.8, method: "THPT Quốc gia" },
  { school: "ĐH Bách Khoa Hà Nội", major: "Kỹ thuật Điện tử", score2025: 27.9, score2024: 27.4, score2023: 26.9, method: "THPT Quốc gia" },
  { school: "ĐH Quốc gia HN", major: "Công nghệ Thông tin", score2025: 112, score2024: 108, score2023: 104, method: "ĐGNL HSA" },
  { school: "ĐH Quốc gia HN", major: "Kinh tế", score2025: 105, score2024: 102, score2023: 98, method: "ĐGNL HSA" },
  { school: "ĐH Quốc gia TP.HCM", major: "Y khoa", score2025: 900, score2024: 880, score2023: 860, method: "ĐGNL HCM" },
  { school: "ĐH Y Hà Nội", major: "Bác sĩ Đa khoa", score2025: 29.1, score2024: 28.9, score2023: 28.5, method: "THPT Quốc gia" },
  { school: "ĐH Ngoại thương HN", major: "Kinh doanh Quốc tế", score2025: 28.0, score2024: 27.6, score2023: 27.2, method: "THPT Quốc gia" },
  { school: "ĐH Kinh tế Quốc dân", major: "Kế toán", score2025: 26.8, score2024: 26.4, score2023: 25.9, method: "THPT Quốc gia" },
];

const methods = ["Tất cả", "THPT Quốc gia", "ĐGNL HSA", "ĐGNL HCM", "TSA Bách Khoa"];

export default function DiemChuanPage() {
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("Tất cả");

  const filtered = useMemo(() => {
    return allData.filter((row) => {
      const matchMethod = method === "Tất cả" || row.method === method;
      const q = query.toLowerCase();
      const matchQuery = !q || row.school.toLowerCase().includes(q) || row.major.toLowerCase().includes(q);
      return matchMethod && matchQuery;
    });
  }, [query, method]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4"
          style={{ background: "#dbeafe", color: "#0068FF", border: "1px solid #bfdbfe" }}>
          Dữ liệu tuyển sinh 2020 – 2025
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: "#1a1a1a", letterSpacing: "-0.5px" }}>
          Tra cứu <span style={{ color: "#0068FF" }}>Điểm chuẩn</span> Đại học
        </h1>
        <p className="text-sm max-w-xl mx-auto" style={{ color: "#787671" }}>
          Dữ liệu điểm chuẩn THPT, ĐGNL, HSA từ 2020–2025. Cập nhật sớm nhất sau khi Bộ GD&ĐT công bố.
        </p>
      </div>

      {/* Search & Filter */}
      <div className="rounded-xl p-5 mb-8" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#37352f" }}>Tìm kiếm trường / ngành</label>
            <input
              type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="VD: Bách Khoa, Y khoa, Kinh tế..."
              className="notion-input w-full text-sm"
              style={{ color: "#1a1a1a" }}
            />
          </div>
          <div className="sm:w-48">
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#37352f" }}>Phương thức xét</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}
              className="notion-input w-full text-sm appearance-none"
              style={{ color: "#1a1a1a" }}>
              {methods.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="sm:w-28 flex items-end">
            <button onClick={() => { setQuery(""); setMethod("Tất cả"); }}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white"
              style={{ background: "#0068FF", borderRadius: "8px" }}>
              Đặt lại
            </button>
          </div>
        </div>
        {(query || method !== "Tất cả") && (
          <p className="text-xs mt-3" style={{ color: "#a4a097" }}>
            Tìm thấy <strong style={{ color: "#0068FF" }}>{filtered.length}</strong> kết quả
            {query && <> cho &ldquo;<strong style={{ color: "#1a1a1a" }}>{query}</strong>&rdquo;</>}
            {method !== "Tất cả" && <> · Phương thức: <strong style={{ color: "#1a1a1a" }}>{method}</strong></>}
          </p>
        )}
      </div>

      {/* Table */}
      {filtered.length > 0 ? (
        <div className="rounded-xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
          <div className="grid grid-cols-12 px-6 py-3 text-xs font-semibold uppercase tracking-wider"
            style={{ color: "#787671", background: "#f6f5f4", borderBottom: "1px solid #e5e3df" }}>
            <div className="col-span-4">Trường &amp; Ngành</div>
            <div className="col-span-2 text-center hidden sm:block">Phương thức</div>
            <div className="col-span-2 text-center">2025</div>
            <div className="col-span-2 text-center hidden md:block">2024</div>
            <div className="col-span-2 text-center hidden md:block">2023</div>
          </div>
          {filtered.map((row, idx) => (
            <div key={`${row.school}-${row.major}`}
              className="grid grid-cols-12 items-center px-6 py-4"
              style={{ borderBottom: idx < filtered.length - 1 ? "1px solid #e5e3df" : "none" }}>
              <div className="col-span-4">
                <div className="font-semibold text-sm" style={{ color: "#1a1a1a" }}>{row.major}</div>
                <div className="text-xs mt-0.5" style={{ color: "#a4a097" }}>{row.school}</div>
              </div>
              <div className="col-span-2 text-center hidden sm:block">
                <span className="px-2 py-1 rounded-md text-xs font-medium"
                  style={{ background: "#f6f5f4", color: "#0068FF", border: "1px solid #e5e3df" }}>
                  {row.method}
                </span>
              </div>
              <div className="col-span-2 text-center">
                <span className="text-base font-bold" style={{ color: "#0068FF" }}>{row.score2025}</span>
                <span className="ml-1 text-xs" style={{ color: "#16a34a" }}>↑</span>
              </div>
              <div className="col-span-2 text-center hidden md:block text-sm font-medium" style={{ color: "#37352f" }}>{row.score2024}</div>
              <div className="col-span-2 text-center hidden md:block text-sm" style={{ color: "#a4a097" }}>{row.score2023}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl p-12 text-center" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
          <div className="flex justify-center mb-3" style={{ color: "#c8c4be" }}>
            <Search size={40} />
          </div>
          <p className="text-base font-semibold mb-1" style={{ color: "#1a1a1a" }}>Không tìm thấy kết quả</p>
          <p className="text-sm mb-4" style={{ color: "#787671" }}>Thử tìm với từ khóa khác hoặc chọn phương thức khác.</p>
          <button onClick={() => { setQuery(""); setMethod("Tất cả"); }}
            className="text-sm font-semibold" style={{ color: "#0068FF" }}>
            Xem tất cả điểm chuẩn →
          </button>
        </div>
      )}

      {/* CTA */}
      <div className="mt-10 notion-hero-band rounded-xl p-8 text-center">
        <p className="text-base font-semibold text-white mb-2">Bạn muốn đạt điểm chuẩn trường mơ ước?</p>
        <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.65)" }}>Thi thử ĐGNL miễn phí để biết vị trí hiện tại và lộ trình cần cải thiện.</p>
        <a href="/thi-thu"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "8px" }}>
          Thi thử ĐGNL miễn phí
        </a>
      </div>
    </div>
  );
}
