// "Tạo lớp" của gia sư (Figma "Gia sư · Tạo lớp đầu tiên" 299:112849): MỘT trang, không ngăn kéo. Cột trái: Thông tin lớp, Lịch học;
// cột phải: việc nên làm sau khi tạo + ghi chú giai đoạn ra mắt. Gọi đúng API của ngăn kéo "Tạo khoá học mới" (POST /api/courses, giá/bài học mặc định 0,
// ngày khai giảng = ngày buổi đầu hoặc hôm nay giờ VN) rồi POST khung giờ; xong đi thẳng tới trang lớp, mở tab "Mã mời".
// HP-15: "Cách tính học phí" chọn LÚC TẠO LỚP — mặc định giữ cách hiện tại (gia sư nhập số buổi từng tháng); theo buổi / giờ / khoá là lựa chọn của lớp mới.
// Không đổi được hình thức của lớp đã tạo; đơn giá đổi sau ở tab Học phí của lớp (có ngày hiệu lực, có xem trước). Số tiền do máy chủ tính, ở đây chỉ nhắc lại.
// KHÔNG có (chưa có tính năng, không bịa): kỳ tổng hợp và "Thêm học sinh" dán danh sách/Excel
// (đụng dữ liệu học sinh và phụ huynh, nên dừng: học sinh vào lớp bằng mã mời).
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { toSlug } from "@/lib/slug";
import { ADMIN_CATEGORIES, CATEGORY_GRADIENT } from "@/lib/courseData";
import { vnDateKeyOf } from "@/lib/classSessions";
import { FEE_MODES, FEE_MODE_HINT, FEE_MODE_LABEL, FEE_MODE_LEGACY, FEE_RATE_UNIT, hourlyAmount, isNewFeeMode, validateFeeSetup, type FeeMode } from "@/lib/tuitionFee";
import { KinButton, kinButtonClass } from "@/components/kin";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinCallout } from "@/components/kin/Callout";
import { KinPageHeader, KIN_PAGE, KIN_TWO_COL, KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";

const FIELD = KIN_FIELD;
const LABEL = KIN_LABEL;
const WEEKDAYS = [["1", "Thứ Hai"], ["2", "Thứ Ba"], ["3", "Thứ Tư"], ["4", "Thứ Năm"], ["5", "Thứ Sáu"], ["6", "Thứ Bảy"], ["0", "Chủ nhật"]] as const;

export default function TaoLop() {
  const router = useRouter();
  const todayKey = vnDateKeyOf(new Date());
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [options, setOptions] = useState<string[]>([...ADMIN_CATEGORIES]);
  const [day, setDay] = useState("");               // "" = chưa xếp lịch
  const [start, setStart] = useState("19:00");
  const [end, setEnd] = useState("20:30");
  const [firstDate, setFirstDate] = useState(todayKey);
  const [feeMode, setFeeMode] = useState<FeeMode>(FEE_MODE_LEGACY); // HP-15: mặc định = cách hiện tại
  const [feeRate, setFeeRate] = useState("");
  const [feeMinutes, setFeeMinutes] = useState("90");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/categories").then(r => (r.ok ? r.json() : { categories: [] }))
      .then(d => { const cats = (d.categories as { name: string }[]).map(c => c.name); if (cats.length) setOptions([...new Set([...ADMIN_CATEGORIES, ...cats])]); })
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const clean = name.trim();
    if (!clean) { setError("Cô nhập tên lớp trước nhé."); return; }
    if (day !== "" && (!start || !end || end <= start)) { setError("Giờ kết thúc phải sau giờ bắt đầu."); return; }
    let fee: Record<string, unknown> = {};
    if (isNewFeeMode(feeMode)) {
      const v = validateFeeSetup({ mode: feeMode, rate: Number(feeRate), sessionMinutes: Number(feeMinutes) });
      if (!v.ok) { setError(v.error); return; }
      fee = { feeMode, feeRate: v.value.rate, ...(v.value.sessionMinutes != null ? { feeSessionMinutes: v.value.sessionMinutes } : {}) };
    }
    setBusy(true); setError(null);
    const slug = toSlug(clean);
    const cat = category.trim() || "Khác";
    const openKey = firstDate || todayKey;
    try {
      const payload = {
        ...fee,
        id: slug, name: clean, adminName: clean, shortTitle: clean.toUpperCase().split(" ").slice(0, 2).join("\n"),
        category: cat, instructor: "KiN", teacherAvatar: "K", openDate: openKey.split("-").reverse().join("/"),
        types: ["Video"], tag: null, tagColor: null,
        bg: CATEGORY_GRADIENT[cat] ?? "var(--kin-chu-phu)", strip: "var(--kin-tt-chu-cho)",
        price: 0, originalPrice: null, lessons: 0, hours: 0, status: true,
      };
      await api.courses.create(payload);
    } catch (err) {
      setError(`Chưa tạo được lớp: ${err instanceof Error ? err.message : "lỗi không rõ"}. Cô kiểm tra tên lớp rồi bấm lại.`);
      setBusy(false);
      return;
    }
    if (day !== "") {
      try { await api.classSchedules.create(slug, { dayOfWeek: Number(day), startTime: start, endTime: end }); }
      catch {
        // Lớp đã tạo: đừng bắt tạo lại, đưa tới trang lớp và nói rõ phần lịch chưa lưu.
        router.push(`/lop-cua-toi/${slug}?tab=ma-moi&lich=loi`);
        return;
      }
    }
    router.push(`/lop-cua-toi/${slug}?tab=ma-moi&moi=1`);
  }

  return (
    <form onSubmit={e => void submit(e)} className={KIN_PAGE} aria-label="Tạo lớp">
      <KinPageHeader title="Tạo lớp học" sub="Thiết lập trong một trang. Cô có thể xếp lịch và mời học sinh sau."
        actions={<Link href="/lop-cua-toi/lop" className={kinButtonClass("ghost")}>Thoát</Link>} />

      <div className={KIN_TWO_COL}>
        <div className="min-w-0 space-y-[var(--kin-cach-muc)]">
          <section aria-labelledby="tl-info">
            <KinSectionHead id="tl-info" title="Thông tin lớp" aside="Bắt buộc" />
            <div className="pt-5 grid sm:grid-cols-2 gap-5">
              <label className={LABEL}>Tên lớp *
                <input value={name} onChange={e => { setName(e.target.value); setError(null); }} required placeholder="Ví dụ: Toán 9" className={`${FIELD} mt-2`} />
              </label>
              <label className={LABEL}>Môn · khối
                <input list="tl-mon" value={category} onChange={e => setCategory(e.target.value)} placeholder="Ví dụ: Toán · Lớp 9" className={`${FIELD} mt-2`} />
                <datalist id="tl-mon">{options.map(o => <option key={o} value={o} />)}</datalist>
              </label>
            </div>
          </section>

          <section aria-labelledby="tl-phi">
            <KinSectionHead id="tl-phi" title="Cách tính học phí" aside="Chọn một lần" />
            <fieldset className="pt-5">
              <legend className="sr-only">Cách tính học phí của lớp</legend>
              <div className="space-y-2">
                {FEE_MODES.map(m => (
                  <label key={m} className="flex items-start gap-3 min-h-[var(--kin-cham-toi-thieu)] py-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
                    <input type="radio" name="tl-fee-mode" className="mt-1" checked={feeMode === m} onChange={() => { setFeeMode(m); setError(null); }} />
                    <span><span className="font-medium">{FEE_MODE_LABEL[m]}</span>{m === FEE_MODE_LEGACY ? " · mặc định" : ""}
                      <span className="block text-[var(--kin-chu-mo)]">{FEE_MODE_HINT[m]}</span></span>
                  </label>
                ))}
              </div>
            </fieldset>
            {isNewFeeMode(feeMode) && (
              <div className="pt-4 grid sm:grid-cols-2 gap-5">
                <label className={LABEL}>Đơn giá ({FEE_RATE_UNIT[feeMode]}) *
                  <input inputMode="numeric" value={feeRate} onChange={e => { setFeeRate(e.target.value.replace(/[^\d]/g, "")); setError(null); }}
                    placeholder="Ví dụ: 150000" className={`${FIELD} mt-2`} />
                </label>
                {feeMode === "per_hour" && (
                  <label className={LABEL}>Một buổi dài (phút) *
                    <input inputMode="numeric" value={feeMinutes} onChange={e => { setFeeMinutes(e.target.value.replace(/[^\d]/g, "")); setError(null); }} className={`${FIELD} mt-2`} />
                  </label>
                )}
                <p className="sm:col-span-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
                  {feeMode === "per_hour" && Number(feeRate) > 0 && Number(feeMinutes) > 0
                    ? `Mỗi buổi ${Number(feeMinutes)} phút tính ${hourlyAmount(Number(feeRate), Number(feeMinutes)).toLocaleString("vi-VN")}đ (làm tròn từng buổi). `
                    : ""}
                  Học phí chỉ tính khi cô điểm danh em có mặt hoặc đi muộn. Phiếu đã chốt không bao giờ đổi khi cô đổi đơn giá sau này.
                </p>
              </div>
            )}
          </section>

          <section aria-labelledby="tl-lich">
            <KinSectionHead id="tl-lich" title="Lịch học" aside="Có thể để sau" />
            <div className="pt-5 grid sm:grid-cols-3 gap-5">
              <label className={LABEL}>Ngày trong tuần
                <select value={day} onChange={e => setDay(e.target.value)} className={`${FIELD} mt-2`}>
                  <option value="">Chưa xếp lịch</option>
                  {WEEKDAYS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <div className={LABEL}>
                <span id="tl-gio">Bắt đầu – kết thúc</span>
                <div role="group" aria-labelledby="tl-gio" className="mt-2 flex items-center gap-2">
                  <input type="time" aria-label="Giờ bắt đầu" value={start} onChange={e => setStart(e.target.value)} disabled={day === ""} className={FIELD} />
                  <span aria-hidden className="text-[var(--kin-chu-mo)]">–</span>
                  <input type="time" aria-label="Giờ kết thúc" value={end} onChange={e => setEnd(e.target.value)} disabled={day === ""} className={FIELD} />
                </div>
              </div>
              <label className={LABEL}>Buổi đầu
                <input type="date" value={firstDate} onChange={e => setFirstDate(e.target.value)} className={`${FIELD} mt-2`} />
              </label>
            </div>
            <p className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
              {day === "" ? "Chưa chọn ngày học: lớp vẫn được tạo, lịch thêm sau ở trang lớp." : `Lớp học vào ${WEEKDAYS.find(([v]) => v === day)?.[1]} hằng tuần, ${start}–${end}.`}
            </p>
          </section>

          {error && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{error}</p>}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <KinButton type="submit" loading={busy} loadingLabel="Đang tạo lớp…">Tạo lớp học</KinButton>
            <Link href="/lop-cua-toi/lop" className={kinButtonClass("ghost")}>Hủy</Link>
            <span className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">KiN không gửi tin nhắn tự động.</span>
          </div>
        </div>

        <aside className="min-w-0 space-y-[var(--kin-cach-muc)]">
          <KinCallout title="Sổ dạy học, theo nhịp của cô">
            Tạo lớp, lên buổi, điểm danh, rồi mời học sinh vào lớp bằng mã.
          </KinCallout>
          <section aria-labelledby="tl-sau">
            <KinSectionHead id="tl-sau" title="Sau khi tạo lớp" />
            <ul className="pt-4 space-y-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
              <li>Mời học sinh bằng mã lớp (KiN mở sẵn tab Mã mời)</li>
              <li>Thêm khung giờ nếu chưa xếp lịch</li>
              <li>Điểm danh từng buổi ngay trong trang lớp</li>
            </ul>
            <p className="mt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Tất cả đều tùy chọn và có thể làm sau.</p>
          </section>
          <section aria-labelledby="tl-ra-mat">
            <KinSectionHead id="tl-ra-mat" title="Giai đoạn ra mắt" />
            <p className="pt-4 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Miễn phí toàn bộ tính năng.</p>
            <p className="mt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Không cần thẻ, không giới hạn lớp và học sinh đang áp dụng.</p>
          </section>
        </aside>
      </div>
    </form>
  );
}
