import Link from "next/link";

const topStudents = [
  { rank: 1, name: "Nguyễn Minh Khoa", school: "THPT Chu Văn An, HN", score: 118.5, badge: "", trend: "+2.5" },
  { rank: 2, name: "Trần Thị Hoa", school: "THPT Gia Định, TP.HCM", score: 116.0, badge: "", trend: "+1.0" },
  { rank: 3, name: "Lê Quang Vinh", school: "THPT Lê Hồng Phong, HN", score: 114.75, badge: "", trend: "+3.25" },
  { rank: 4, name: "Phạm Thu Hiền", school: "THPT Nguyễn Huệ, Huế", score: 112.5, badge: null, trend: "+0.5" },
  { rank: 5, name: "Đỗ Văn Nam", school: "THPT Phan Đình Phùng, HN", score: 110.0, badge: null, trend: "+1.75" },
];

export default function Leaderboard() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8" style={{ background: "#F0F5FF" }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div
            className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold mb-4"
            style={{ background: "#F0F5FF", boxShadow: "inset 3px 3px 6px #C5D0EA, inset -3px -3px 6px #ffffff", color: "#FE9900" }}
          >
            Bảng xếp hạng công khai
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4" style={{ color: "#1E2938" }}>
            Top thí sinh <span style={{ color: "#FE9900" }}>điểm cao nhất</span> tuần này
          </h2>
          <p className="text-sm" style={{ color: "#6B7280" }}>
            Cập nhật mỗi tuần · Thi thử ĐGNL HSA · Kỳ thi tháng 5/2026
          </p>
        </div>

        {/* Table */}
        <div
          className="rounded-3xl overflow-hidden"
          style={{ background: "#F0F5FF", boxShadow: "12px 12px 24px #C5D0EA, -12px -12px 24px #ffffff" }}
        >
          {/* Table header */}
          <div
            className="grid grid-cols-12 px-6 py-4 text-xs font-semibold uppercase tracking-wider"
            style={{ color: "#6B7280", boxShadow: "0 2px 4px #C5D0EA", background: "#F0F5FF" }}
          >
            <div className="col-span-1">#</div>
            <div className="col-span-5">Học sinh</div>
            <div className="col-span-3 hidden sm:block">Trường</div>
            <div className="col-span-2 text-right">Điểm</div>
            <div className="col-span-1 text-right">+/-</div>
          </div>

          {/* Rows */}
          {topStudents.map((student, idx) => (
            <div
              key={student.rank}
              className="grid grid-cols-12 items-center px-6 py-4 transition-all duration-200"
              style={{
                borderTop: idx > 0 ? "1px solid #C5D0EA" : "none",
                background: student.rank <= 3 ? "rgba(0,104,255,0.03)" : "transparent",
              }}
            >
              {/* Rank */}
              <div className="col-span-1">
                {student.badge ? (
                  <span className="text-xl">{student.badge}</span>
                ) : (
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold"
                    style={{ background: "#F0F5FF", boxShadow: "2px 2px 4px #C5D0EA, -2px -2px 4px #ffffff", color: "#6B7280" }}
                  >
                    {student.rank}
                  </span>
                )}
              </div>

              {/* Name */}
              <div className="col-span-5">
                <div className="font-semibold text-sm" style={{ color: "#1E2938" }}>{student.name}</div>
                <div className="text-xs sm:hidden mt-0.5" style={{ color: "#9CA3AF" }}>{student.school}</div>
              </div>

              {/* School (hidden on mobile) */}
              <div className="col-span-3 hidden sm:block text-xs" style={{ color: "#9CA3AF" }}>
                {student.school}
              </div>

              {/* Score */}
              <div className="col-span-2 text-right">
                <span className="text-base font-extrabold" style={{ color: "#0068FF" }}>{student.score}</span>
                <span className="text-xs ml-0.5" style={{ color: "#9CA3AF" }}>/150</span>
              </div>

              {/* Trend */}
              <div className="col-span-1 text-right">
                <span className="text-xs font-semibold" style={{ color: "#00A63D" }}>{student.trend}</span>
              </div>
            </div>
          ))}

          {/* Footer */}
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderTop: "1px solid #C5D0EA" }}
          >
            <p className="text-xs" style={{ color: "#9CA3AF" }}>
              Hiển thị 5 / 2,847 thí sinh
            </p>
            <Link
              href="/bang-xep-hang"
              className="text-xs font-semibold transition-all"
              style={{ color: "#0068FF" }}
            >
              Xem toàn bộ bảng xếp hạng →
            </Link>
          </div>
        </div>

        {/* Join CTA */}
        <div
          className="mt-8 rounded-3xl p-6 text-center"
          style={{ background: "#F0F5FF", boxShadow: "inset 6px 6px 12px #C5D0EA, inset -6px -6px 12px #ffffff" }}
        >
          <p className="text-sm font-medium mb-4" style={{ color: "#1E2938" }}>
             Bạn muốn tên mình xuất hiện trên bảng xếp hạng? Thi thử miễn phí ngay!
          </p>
          <Link
            href="/thi-thu"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
            style={{ background: "linear-gradient(145deg, #0055D4, #0042AA)", boxShadow: "6px 6px 12px #C5D0EA, -6px -6px 12px #ffffff" }}
          >
            Tham gia thi thử ĐGNL miễn phí
          </Link>
        </div>
      </div>
    </section>
  );
}
