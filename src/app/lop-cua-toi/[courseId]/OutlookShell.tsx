// TK-179 (09/10/2026) — OutlookShell: 2 panel + mobile dropdown.
//
// Danh sách việc (trái) là nav list → mỗi mục mở 1 nội dung ở panel
// phải. Mục nào là 1 trang riêng (vd Điểm danh) thì content phải là
// khối "Mở trang" + Link. Mục nào ngắn gọn thì render inline.
//
// Panel phải lazy-render nội dung theo activeKey — không fetch gì
// nặng ở shell này; mỗi item quyết fetch khi chọn.
"use client";
import { useState } from "react";
import Link from "next/link";

type Role = "tutor" | "student";

interface Item {
  key:    string;
  label:  string;
  icon:   string;  // emoji đơn giản thay cho icon lib
  render: (ctx: { courseId: string; courseName: string }) => React.ReactNode;
}

function OpenPageBlock({ title, href, note }: { title: string; href: string; note?: string }) {
  return (
    <div className="rounded-xl p-5"
      style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
      <p className="font-semibold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>{title}</p>
      {note && (
        <p className="text-caption mb-3" style={{ color: "var(--kin-chu-phu)" }}>{note}</p>
      )}
      <Link href={href}
        className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg"
        style={{ background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" }}>
        Mở trang →
      </Link>
    </div>
  );
}

function OverviewBlock({ courseName }: { courseName: string }) {
  return (
    <div>
      <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>
        Chào mừng đến hộp việc của <strong style={{ color: "var(--kin-chu-chinh)" }}>{courseName}</strong>.
      </p>
      <p className="text-caption mt-2" style={{ color: "var(--kin-chu-mo)" }}>
        Danh sách việc bên trái. Chọn 1 mục để xem nội dung ở panel phải.
      </p>
    </div>
  );
}

function tutorItems(): Item[] {
  return [
    { key: "tong-quan", label: "Tổng quan", icon: "📋",
      render: ({ courseName }) => <OverviewBlock courseName={courseName} /> },
    { key: "diem-danh", label: "Điểm danh", icon: "✅",
      render: ({ courseId }) => <OpenPageBlock title="Điểm danh" href={`/admin/khoa-hoc/${courseId}/diem-danh`}
        note="Bấm các em có mặt / muộn / có phép / vắng (AS-191)." /> },
    { key: "roster", label: "Danh sách HS", icon: "👥",
      render: ({ courseId }) => <OpenPageBlock title="Danh sách học sinh" href={`/admin/khoa-hoc/${courseId}/hoc-vien`}
        note="Danh bạ lớp — gọi tên, mở Zalo PH (TK-171)." /> },
    { key: "quan-khoa", label: "Quản khoá", icon: "⚙️",
      render: ({ courseId }) => <OpenPageBlock title="Trang quản khoá" href={`/admin/khoa-hoc/${courseId}`}
        note="Chương - bài - học phí - lịch học - học viên." /> },
    { key: "hoc-phi", label: "Học phí", icon: "💰",
      render: ({ courseId }) => <OpenPageBlock title="Phiếu học phí tháng" href={`/student/hoc-phi`}
        note="Xem/sửa số buổi tháng + miễn (AS-192)." /> },
  ];
}

function studentItems(): Item[] {
  return [
    { key: "tong-quan", label: "Tổng quan", icon: "📋",
      render: ({ courseName }) => <OverviewBlock courseName={courseName} /> },
    { key: "lich-hoc", label: "Lịch học", icon: "📅",
      render: () => <OpenPageBlock title="Lịch học của tôi" href="/student/lich-hoc"
        note="Buổi học tuần này + sắp tới." /> },
    { key: "bai-tap", label: "Bài tập", icon: "📝",
      render: () => <OpenPageBlock title="Bài tập của tôi" href="/student/hoc-tap"
        note="Bài sắp hết hạn và tiến độ chương." /> },
    { key: "hoc-phi", label: "Học phí", icon: "💰",
      render: () => <OpenPageBlock title="Phiếu học phí" href="/student/hoc-phi"
        note="Breakdown theo môn + VietQR (TK-173)." /> },
  ];
}

export default function OutlookShell({ courseId, courseName, category, role }: {
  courseId:   string;
  courseName: string;
  category:   string;
  role:       Role;
}) {
  const items = role === "tutor" ? tutorItems() : studentItems();
  const [active, setActive] = useState(items[0].key);
  const activeItem = items.find(it => it.key === active) ?? items[0];

  return (
    <div style={{ background: "var(--kin-nen-trang)", minHeight: "100vh" }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <header className="mb-4">
          <Link href="/lop-cua-toi"
            className="text-sm hover:underline"
            style={{ color: "var(--kin-chu-phu)" }}>
            ← Lớp của tôi
          </Link>
          <h1 className="mt-2 text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>
            {courseName}
          </h1>
          <p className="text-caption mt-1" style={{ color: "var(--kin-chu-phu)" }}>
            {category} · {role === "tutor" ? "Bạn đang dạy lớp này" : "Bạn đang học lớp này"}
          </p>
        </header>

        {/* Mobile: dropdown */}
        <div className="sm:hidden mb-3">
          <select value={active} onChange={e => setActive(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              background: "var(--kin-nen-bang)",
              color:      "var(--kin-chu-chinh)",
              border:     "1px solid var(--kin-vien-thuong)",
            }}>
            {items.map(it => (
              <option key={it.key} value={it.key}>{it.icon} {it.label}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-4">
          {/* Trái: nav list — ẩn trên mobile vì có dropdown */}
          <nav className="hidden sm:block w-56 flex-shrink-0">
            <ul className="rounded-xl overflow-hidden"
              style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
              {items.map(it => {
                const isActive = it.key === active;
                return (
                  <li key={it.key}>
                    <button
                      type="button"
                      onClick={() => setActive(it.key)}
                      className="w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 transition-colors"
                      style={{
                        background: isActive ? "var(--kin-nen-nhan)" : "transparent",
                        color:      isActive ? "var(--kin-nhan-chu-tren-nhat)" : "var(--kin-chu-chinh)",
                        fontWeight: isActive ? 600 : 400,
                        borderLeft: `3px solid ${isActive ? "var(--kin-th-navy)" : "transparent"}`,
                      }}>
                      <span aria-hidden>{it.icon}</span>
                      {it.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Phải: content */}
          <section className="flex-1 min-w-0">
            {activeItem.render({ courseId, courseName })}
          </section>
        </div>
      </div>
    </div>
  );
}
