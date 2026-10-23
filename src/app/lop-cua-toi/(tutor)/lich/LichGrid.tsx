// Lưới tuần của Lịch dạy (Figma "Gia sư · Desktop · Lịch" 299:112052): cột giờ + 7 cột ngày, buổi học là khối đặt theo giờ.
// Chỉ dùng trên màn rộng (≥ 1024px); điện thoại giữ danh sách theo ngày. Khối buổi là nút: bấm để mở chi tiết ở cột phải.
"use client";
import { dayOfWeekOfKey, hmOf, vnMinutesOfDay } from "@/lib/classSessions";
import { classAccent } from "@/lib/classColor";
import type { ScheduleOccurrence } from "@/lib/reminderServer";

const PX_PER_HOUR = 48;
const HEAD_H = 50;
const WEEKDAY = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const minutesOf = (iso: string) => vnMinutesOfDay(new Date(iso));
const vnHm = (iso: string) => hmOf(minutesOf(iso));

/** Chia làn cho các buổi trùng giờ trong một ngày để khối nằm cạnh nhau, không chồng lên. */
function layout(occs: ScheduleOccurrence[]) {
  const sorted = [...occs].sort((a, b) => minutesOf(a.startAt) - minutesOf(b.startAt));
  const laneEnd: number[] = [];
  const placed = sorted.map(o => {
    const s = minutesOf(o.startAt), e = Math.max(minutesOf(o.endAt), s + 30);
    let lane = laneEnd.findIndex(end => end <= s);
    if (lane < 0) { lane = laneEnd.length; laneEnd.push(e); } else laneEnd[lane] = e;
    return { o, lane, s, e };
  });
  return { placed, lanes: Math.max(1, laneEnd.length) };
}

export default function LichGrid({ days, occurrences, todayKey, openKey, onPick, dimmed }: {
  days: string[]; occurrences: ScheduleOccurrence[]; todayKey: string; openKey: string | null;
  onPick: (key: string) => void; dimmed?: boolean;
}) {
  const mins = occurrences.flatMap(o => [minutesOf(o.startAt), minutesOf(o.endAt)]);
  const startH = Math.min(8, mins.length ? Math.floor(Math.min(...mins) / 60) : 8);
  const endH = Math.min(24, Math.max(21, mins.length ? Math.ceil(Math.max(...mins) / 60) : 21));
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);
  const bodyH = (endH - startH) * PX_PER_HOUR;
  const cols = "56px repeat(7, minmax(0, 1fr))";

  return (
    <div role="group" aria-label="Lịch tuần theo giờ" className={`border border-[var(--kin-vien-thuong)] ${dimmed ? "opacity-70" : ""}`}>
      <div className="grid bg-[var(--kin-nen-bang)]" style={{ gridTemplateColumns: cols, height: HEAD_H }}>
        <div className="flex items-center px-2 text-[length:var(--kin-co-goc)] font-mono text-[var(--kin-chu-mo)]">GMT+7</div>
        {days.map(k => {
          const today = k === todayKey;
          return (
            <div key={k} className="flex items-center px-3 text-[length:var(--kin-co-goc)] tabular-nums"
              style={today ? { background: "var(--kin-nen-nhan)", color: "var(--kin-nhan-chu-tren-nhat)", fontWeight: 500 } : { color: "var(--kin-chu-phu)" }}
              aria-label={`${WEEKDAY[dayOfWeekOfKey(k)]} ${k.slice(8, 10)}${today ? ", hôm nay" : ""}`}>
              {WEEKDAY_SHORT[dayOfWeekOfKey(k)]} · {k.slice(8, 10)}
            </div>
          );
        })}
      </div>

      <div className="grid relative" style={{ gridTemplateColumns: cols, height: bodyH }}>
        <div className="relative" aria-hidden>
          {hours.slice(0, -1).map(h => (
            <span key={h} className="absolute left-2 -mt-0 text-[length:var(--kin-co-goc)] font-mono text-[var(--kin-chu-mo)]" style={{ top: (h - startH) * PX_PER_HOUR + 4 }}>
              {String(h).padStart(2, "0")}:00
            </span>
          ))}
        </div>
        {days.map(k => {
          const today = k === todayKey;
          const { placed, lanes } = layout(occurrences.filter(o => o.dateKey === k));
          return (
            <div key={k} className="relative border-l border-[var(--kin-vien-nhat)]" style={today ? { background: "var(--kin-nen-nhan)" } : undefined}>
              {hours.slice(0, -1).map(h => (
                <div key={h} aria-hidden className="absolute inset-x-0 border-t border-[var(--kin-vien-nhat)]" style={{ top: (h - startH) * PX_PER_HOUR }} />
              ))}
              {placed.map(({ o, lane, s, e }) => {
                const cancelled = o.status === "cancelled";
                const sel = openKey === o.key;
                const top = Math.max(0, (s - startH * 60) * PX_PER_HOUR / 60) + 3;
                const height = Math.max(64, (e - s) * PX_PER_HOUR / 60 - 6);
                const edge = sel ? "var(--kin-nhan-nen)" : "transparent";
                const hasNote = o.pendingAbsences > 0 || o.remindersDue > 0 || o.status !== "scheduled";
                return (
                  <button key={o.key} type="button" onClick={() => onPick(o.key)} aria-expanded={sel} aria-controls={`chi-tiet-${o.key}`}
                    title={`${o.courseName} ${vnHm(o.startAt)}–${vnHm(o.endAt)}`}
                    className={`absolute text-left py-1.5 overflow-hidden min-h-[44px] leading-5 focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)] ${lanes > 1 ? "px-1.5 text-[length:var(--kin-co-goc)]" : "px-2 text-[length:var(--kin-co-goc)]"}`}
                    style={{
                      top, height: hasNote ? Math.max(height, 92) : height,
                      left: `calc(${(lane / lanes) * 100}% + 4px)`, width: `calc(${100 / lanes}% - 8px)`,
                      background: sel ? "var(--kin-nen-dang-chon)" : "var(--kin-nen-nhan)",
                      color: "var(--kin-nhan-chu-tren-nhat)",
                      borderStyle: "solid", borderWidth: "1px 1px 1px 3px",
                      borderColor: `${edge} ${edge} ${edge} ${cancelled ? "var(--kin-tt-cham-trung-tinh)" : classAccent(o.courseId)}`,
                      boxShadow: today ? "0 0 0 1px var(--kin-nen-trang)" : undefined,
                    }}>
                    <span className="block break-words" style={{ textDecoration: cancelled ? "line-through" : undefined }}>{o.courseName}</span>
                    <span className="block tabular-nums" style={{ textDecoration: cancelled ? "line-through" : undefined }}>{vnHm(o.startAt)}–{vnHm(o.endAt)}</span>
                    {cancelled && <span className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo-tren-nen-nhan)]">Đã huỷ</span>}
                    {o.status === "moved" && <span className="block text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo-tren-nen-nhan)]">Đã dời</span>}
                    {o.pendingAbsences > 0 && <span className="block text-[length:var(--kin-co-goc)]" style={{ color: "var(--kin-tt-chu-loi)" }}>{o.pendingAbsences} báo nghỉ sát giờ</span>}
                    {o.remindersDue > 0 && <span className="block text-[length:var(--kin-co-goc)]" style={{ color: "var(--kin-tt-chu-cho)" }}>{o.remindersDue} tin nhắc chờ gửi</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
