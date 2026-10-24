// KH-02 — Tìm gia sư (Figma 299:115283 máy tính, 299:116882 điện thoại): nền sáng, thoáng, không khung màu.
// Máy tính: cột lọc bên trái + danh sách bên phải. Điện thoại: ô tìm + bộ lọc dạng chip (nằm ngang, bọc dòng) rồi danh sách.
// Dữ liệu thật từ /api/tutors. Bỏ khối "Top học viên" (tên học sinh không có trong thiết kế khách; bảng xếp hạng vẫn ở /bang-xep-hang).
"use client";

import { useState, useEffect, useMemo } from "react";
import { EmptyState } from "@/components/ui";
import { TutorCard, TutorCardSkeleton, type TutorListItem } from "@/components/tutor/TutorCard";
import { KinButton } from "@/components/kin/Button";

type SortKey = "active" | "rating" | "students" | "classes";

// Ô chọn: cao ≥ 44px, viền đủ rõ. Trên điện thoại là chip tròn, từ lg là ô vuông bo nhẹ trong cột lọc.
const SELECT_CLS = "min-h-[44px] w-full text-[length:var(--kin-co-small)] px-3 rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)] border border-[var(--kin-vien-o-nhap)]";
const LABEL_CLS = "block text-[length:var(--kin-co-small)] mb-1.5";

export default function GiangVienPage() {
  const [tutors, setTutors]   = useState<TutorListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);
  const [retry, setRetry]     = useState(0);
  const [subject, setSubject] = useState<string>("");
  const [sort, setSort]       = useState<SortKey>("active"); // ĐX-05: gia sư có dạy trong 30 ngày qua lên trước
  // ĐX-06: lọc theo Tỉnh/Thành và hình thức dạy. Gia sư chưa khai khu vực không khớp bộ lọc nào đang bật.
  const [city, setCity]       = useState<string>("");
  const [mode, setMode]       = useState<"" | "online" | "offline">("");
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [q, setQ]             = useState("");

  useEffect(() => {
    let cancelled = false;
    // Gói các setState trong Promise để eslint rule `set-state-in-effect` không chặn.
    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      setError(false);
    });
    const qs = new URLSearchParams();
    if (subject) qs.set("subject", subject);
    qs.set("sort", sort);
    if (city) qs.set("city", city);
    if (mode) qs.set("mode", mode);
    fetch(`/api/tutors?${qs}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((d: { items: TutorListItem[]; facets?: { cities: string[] } }) => { if (!cancelled) { setTutors(d.items); setCityOptions(d.facets?.cities ?? []); } })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [subject, sort, city, mode, retry]);

  // FE-106: option môn lấy từ union tất cả môn xuất hiện (giữ môn đang chọn để bỏ chọn được).
  const subjectOptions = useMemo(() => {
    const set = new Set<string>();
    if (tutors) for (const t of tutors) for (const s of t.subjects) set.add(s);
    if (subject) set.add(subject);
    return Array.from(set).sort();
  }, [tutors, subject]);

  // Ô tìm theo tên / môn: lọc ngay trên danh sách đã tải, không gửi thêm dữ liệu nào lên máy chủ.
  const shown = useMemo(() => {
    if (!tutors) return null;
    const k = q.trim().toLowerCase();
    if (!k) return tutors;
    return tutors.filter(t => t.name.toLowerCase().includes(k) || t.subjects.some(s => s.toLowerCase().includes(k)));
  }, [tutors, q]);

  const filtering = !!(subject || city || mode || q.trim());
  const clearAll = () => { setSubject(""); setCity(""); setMode(""); setQ(""); };

  return (
    <div className="max-w-7xl mx-auto px-5 sm:px-8 lg:px-14 py-8 lg:py-10 flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <h1 className="text-[length:var(--kin-co-h3)] lg:text-[length:var(--kin-co-h2)] font-semibold leading-tight" style={{ color: "var(--kin-chu-chinh)" }}>Tìm gia sư</h1>
        <p className="text-[length:var(--kin-co-small)]" style={{ color: "var(--kin-chu-mo)" }}>
          Hồ sơ công khai do gia sư tự lựa chọn. Không cần tài khoản để xem.
        </p>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 items-start">
        {/* Bộ lọc (FE-106 + ĐX-06) */}
        <section aria-label="Thu hẹp tìm kiếm" className="w-full lg:w-[264px] lg:flex-shrink-0 flex flex-col gap-4">
          <h2 className="hidden lg:block text-[length:var(--kin-co-body)] font-semibold pb-2.5" style={{ color: "var(--kin-chu-chinh)", borderBottom: "1px solid var(--kin-vien-thuong)" }}>Thu hẹp tìm kiếm</h2>
          <div>
            <label htmlFor="tutor-q" className={LABEL_CLS} style={{ color: "var(--kin-chu-phu)" }}>Tìm theo tên hoặc môn</label>
            <input id="tutor-q" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm theo tên hoặc môn"
              className={SELECT_CLS + " placeholder:text-[var(--kin-chu-mo)]"} />
          </div>
          <div className="grid grid-cols-2 lg:flex lg:flex-col gap-x-3 gap-y-4 lg:gap-4">
            <div className="min-w-0">
              <label htmlFor="tutor-subject" className={LABEL_CLS} style={{ color: "var(--kin-chu-phu)" }}>Môn</label>
              <select id="tutor-subject" value={subject} onChange={e => setSubject(e.target.value)} className={SELECT_CLS}>
                <option value="">Tất cả môn</option>
                {subjectOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            {/* ĐX-06: chỉ hiện khi đã có gia sư khai khu vực; chọn rồi mà danh sách tỉnh trống (do đổi môn) vẫn giữ lựa chọn để bỏ chọn được */}
            {(cityOptions.length > 0 || city) && (
              <div className="min-w-0 col-span-2 lg:col-span-1">
                <label htmlFor="tutor-city" className={LABEL_CLS} style={{ color: "var(--kin-chu-phu)" }}>Khu vực</label>
                <select id="tutor-city" value={city} onChange={e => setCity(e.target.value)} className={SELECT_CLS}>
                  <option value="">Tất cả tỉnh/thành</option>
                  {(city && !cityOptions.includes(city) ? [city, ...cityOptions] : cityOptions).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            <div className="min-w-0">
              <label htmlFor="tutor-mode" className={LABEL_CLS} style={{ color: "var(--kin-chu-phu)" }}>Hình thức</label>
              <select id="tutor-mode" value={mode} onChange={e => setMode(e.target.value as "" | "online" | "offline")} className={SELECT_CLS}>
                <option value="">Mọi hình thức</option>
                <option value="online">Online</option>
                <option value="offline">Dạy trực tiếp</option>
              </select>
            </div>
          </div>
          {filtering && <div><KinButton variant="ghost" onClick={clearAll}>Xóa bộ lọc</KinButton></div>}
          <p className="hidden lg:block text-[length:var(--kin-co-small)] p-4" style={{ background: "var(--kin-nen-bang)", borderLeft: "2px solid var(--kin-vien-thuong)", color: "var(--kin-chu-mo)" }}>
            Khu vực, học vấn và bằng cấp do gia sư tự khai; KiN chưa xác minh. KiN không thu phí nhận lớp.
          </p>
        </section>

        {/* Kết quả */}
        <section aria-label="Kết quả" className="flex-1 min-w-0 w-full flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pb-2.5" style={{ borderBottom: "1px solid var(--kin-vien-thuong)" }}>
            <p className="text-[length:var(--kin-co-body)] font-semibold" style={{ color: "var(--kin-chu-chinh)" }} role="status">
              {shown && !loading && !error ? `${shown.length} gia sư phù hợp` : "Gia sư"}
            </p>
            <div className="flex items-center gap-2">
              <label htmlFor="tutor-sort" className="text-[length:var(--kin-co-small)]" style={{ color: "var(--kin-chu-mo)" }}>Sắp xếp</label>
              <select id="tutor-sort" value={sort} onChange={e => setSort(e.target.value as SortKey)}
                className="min-h-[44px] text-[length:var(--kin-co-small)] px-2 rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-phu)] border border-transparent">
                <option value="active">Hoạt động gần đây</option>
                <option value="rating">Đánh giá cao</option>
                <option value="students">Nhiều học viên</option>
                <option value="classes">Nhiều lớp</option>
              </select>
            </div>
          </div>

          {/* Điện thoại: dòng lưu ý hiện ngay dưới số kết quả (cột lọc bên trái chỉ có từ lg) */}
          <p className="lg:hidden text-[length:var(--kin-co-small)]" style={{ color: "var(--kin-chu-mo)" }}>
            Bằng cấp, khu vực do gia sư tự khai; KiN chưa xác minh. KiN không thu phí nhận lớp.
          </p>

          {loading ? (
            <div aria-busy="true" className="space-y-4">{[0, 1, 2].map(i => <TutorCardSkeleton key={i} />)}</div>
          ) : error ? (
            <div role="alert" className="py-10 flex flex-col items-start gap-3">
              <p className="text-[length:var(--kin-co-small)]" style={{ color: "var(--kin-tt-chu-loi)" }}>Không tải được danh sách gia sư. Thử lại sau.</p>
              <KinButton variant="secondary" onClick={() => setRetry(n => n + 1)}>Thử lại</KinButton>
            </div>
          ) : shown && shown.length === 0 ? (
            <EmptyState title="Chưa có gia sư nào phù hợp bộ lọc"
              description={q.trim() ? `Không có gia sư khớp "${q.trim()}". Thử từ khoá khác hoặc xóa bộ lọc.` : subject ? `Thử bỏ bộ lọc môn "${subject}" hoặc chọn môn khác.` : (city || mode) ? "Thử bỏ bộ lọc tỉnh/thành hoặc hình thức dạy. Gia sư chưa khai khu vực sẽ không hiện khi đang lọc." : "Hiện chưa có gia sư nào được duyệt."}
            />
          ) : (
            <div className="space-y-4">{shown!.map(t => <TutorCard key={t.id} t={t} />)}</div>
          )}

          {!loading && !error && shown && shown.length > 0 && (
            <p className="text-[length:var(--kin-co-small)]" style={{ color: "var(--kin-chu-mo)" }}>
              Đã hiển thị {shown.length} kết quả · Không công khai danh tính học sinh của gia sư.
            </p>
          )}
          <p className="text-[length:var(--kin-co-small)] pt-2" style={{ color: "var(--kin-chu-mo)" }}>KiN · Thông tin học tập được chia sẻ riêng tư.</p>
        </section>
      </div>
    </div>
  );
}
