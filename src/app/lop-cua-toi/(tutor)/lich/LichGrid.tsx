// Lưới tuần của Lịch dạy (Figma "Gia sư · Desktop · Lịch" 299:112052): cột giờ + 7 cột ngày, buổi học là khối đặt theo giờ.
// Chỉ dùng trên màn rộng (≥ 1024px); điện thoại giữ danh sách theo ngày. Khối buổi là nút: bấm để mở chi tiết ở cột phải.
"use client";
import { useState } from "react";
import { dayOfWeekOfKey, hmOf, vnMinutesOfDay } from "@/lib/classSessions";
import { classAccent } from "@/lib/classColor";
import type { ScheduleOccurrence } from "@/lib/reminderServer";

const PX_PER_HOUR = 64;
const HEAD_H = 50;
const HOUR_COL = 64;
/** Bề rộng tối thiểu của một làn: chữ tên lớp không bao giờ bị ép hẹp hơn. */
const LANE_MIN = 120;
/** Từ 5 buổi trùng giờ trở lên: hiện 3 làn đầy đủ + 1 chip "+N buổi"; 4 buổi trở xuống hiện hết. */
const MAX_LANES = 4;
const LINE_H = 20;
const BLOCK_PAD = 14;
const WEEKDAY = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
const WEEKDAY_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const minutesOf = (iso: string) => vnMinutesOfDay(new Date(iso));
const vnHm = (iso: string) => hmOf(minutesOf(iso));

/** Ước số dòng khi xuống dòng theo từ ở bề rộng làn tối thiểu (ước thừa, không ước thiếu). */
function wrapLines(text: string, laneW: number) {
  const per = Math.max(6, Math.floor((laneW - 26) / 7));
  let lines = 1, cur = 0;
  for (const w of text.split(/\s+/)) {
    const len = w.length;
    if (cur === 0) { cur = len; while (cur > per) { lines++; cur -= per; } }
    else if (cur + 1 + len <= per) cur += 1 + len;
    else { lines++; cur = len; while (cur > per) { lines++; cur -= per; } }
  }
  return lines;
}

/** Chiều cao cần để đủ chữ: tên lớp (nhiều dòng) + giờ + dòng ghi chú; tối thiểu 3 dòng. */
function neededHeight(o: ScheduleOccurrence) {
  const notes = (o.status === "cancelled" || o.status === "moved" ? 1 : 0) + (o.pendingAbsences > 0 ? 1 : 0) + (o.remindersDue > 0 ? 1 : 0);
  const lines = Math.max(3, wrapLines(o.courseName, LANE_MIN) + 1 + notes);
  return BLOCK_PAD + lines * LINE_H;
}

/** Chia làn cho các buổi trùng giờ; độ dài làn tính theo chiều cao thật của khối để khối không chồng nhau. */
function layout(occs: ScheduleOccurrence[]) {
  const sorted = [...occs].sort((a, b) => minutesOf(a.startAt) - minutesOf(b.startAt));
  const laneEnd: number[] = [];
  const placed = sorted.map(o => {
    const s = minutesOf(o.startAt);
    const dur = Math.max(minutesOf(o.endAt), s + 30) - s;
    const h = Math.max(dur * PX_PER_HOUR / 60 - 6, neededHeight(o));
    const e = s + Math.ceil(((h + 6) * 60) / PX_PER_HOUR);
    let lane = laneEnd.findIndex(end => end <= s);
    if (lane < 0) { lane = laneEnd.length; laneEnd.push(e); } else laneEnd[lane] = e;
    return { o, lane, s, e, h };
  });
  const lanes = Math.max(1, laneEnd.length);
  const collapsed = lanes > MAX_LANES;
  const shown = collapsed ? MAX_LANES : lanes; // làn cuối là chip khi gộp
  const visible = collapsed ? placed.filter(p => p.lane < MAX_LANES - 1) : placed;
  const hidden = collapsed ? placed.filter(p => p.lane >= MAX_LANES - 1) : [];
  return { visible, hidden, shown };
}

export default function LichGrid({ days, occurrences, todayKey, openKey, onPick, dimmed }: {
  days: string[]; occurrences: ScheduleOccurrence[]; todayKey: string; openKey: string | null;
  onPick: (key: string) => void; dimmed?: boolean;
}) {
  const [more, setMore] = useState<string | null>(null);
  const mins = occurrences.flatMap(o => [minutesOf(o.startAt), minutesOf(o.endAt)]);
  const startH = Math.min(8, mins.length ? Math.floor(Math.min(...mins) / 60) : 8);
  const endH = Math.min(24, Math.max(21, mins.length ? Math.ceil(Math.max(...mins) / 60) : 21));
  const hours = Array.from({ length: endH - startH + 1 }, (_, i) => startH + i);
  const perDay = days.map(k => ({ k, ...layout(occurrences.filter(o => o.dateKey === k)) }));
  const topOf = (s: number) => Math.max(0, (s - startH * 60) * PX_PER_HOUR / 60) + 3;
  let bodyH = (endH - startH) * PX_PER_HOUR;
  for (const d of perDay) for (const p of d.visible) bodyH = Math.max(bodyH, topOf(p.s) + p.h + 6);
  const cols = `${HOUR_COL}px ` + perDay.map(d => `minmax(${d.shown * LANE_MIN}px, ${d.shown}fr)`).join(" ");
  const minW = HOUR_COL + perDay.reduce((n, d) => n + d.shown * LANE_MIN, 0);
  const sticky = { position: "sticky", left: 0, zIndex: 5 } as const;

  const blockStyle = (o: ScheduleOccurrence, sel: boolean, today: boolean) => {
    const cancelled = o.status === "cancelled";
    const edge = sel ? "var(--kin-nhan-nen)" : "transparent";
    return {
      background: sel ? "var(--kin-nen-dang-chon)" : "var(--kin-nen-nhan)",
      color: "var(--kin-nhan-chu-tren-nhat)",
      borderStyle: "solid", borderWidth: "1px 1px 1px 3px",
      borderColor: `${edge} ${edge} ${edge} ${cancelled ? "var(--kin-tt-cham-trung-tinh)" : classAccent(o.courseId)}`,
      boxShadow: today ? "0 0 0 1px var(--kin-nen-trang)" : undefined,
    } as const;
  };
  const blockBody = (o: ScheduleOccurrence) => {
    const cancelled = o.status === "cancelled";
    const strike = { textDecoration: cancelled ? "line-through" : undefined };
    return (
      <>
        <span className="block break-words" style={strike}>{o.courseName}</span>
        <span className="block tabular-nums" style={strike}>{vnHm(o.startAt)}–{vnHm(o.endAt)}</span>
        {cancelled && <span className="block text-[var(--kin-chu-mo-tren-nen-nhan)]">Đã huỷ</span>}
        {o.status === "moved" && <span className="block text-[var(--kin-chu-mo-tren-nen-nhan)]">Đã dời</span>}
        {o.pendingAbsences > 0 && <span className="block" style={{ color: "var(--kin-tt-chu-loi)" }}>{o.pendingAbsences} báo nghỉ sát giờ</span>}
        {o.remindersDue > 0 && <span className="block" style={{ color: "var(--kin-tt-chu-cho)" }}>{o.remindersDue} tin nhắc chờ gửi</span>}
      </>
    );
  };
  const label = (o: ScheduleOccurrence) => `${o.courseName} ${vnHm(o.startAt)}–${vnHm(o.endAt)}${o.status === "cancelled" ? ", đã huỷ" : o.status === "moved" ? ", đã dời" : ""}`;

  return (
    <div role="group" aria-label="Lịch tuần theo giờ" data-lich-scroll className={`border border-[var(--kin-vien-thuong)] overflow-x-auto ${dimmed ? "opacity-70" : ""}`}>
      <div style={{ minWidth: minW }}>
        <div className="grid bg-[var(--kin-nen-bang)]" style={{ gridTemplateColumns: cols, height: HEAD_H }}>
          <div className="flex items-center px-2 text-[length:var(--kin-co-goc)] font-mono text-[var(--kin-chu-mo)] bg-[var(--kin-nen-bang)]" style={sticky}>GMT+7</div>
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
          <div className="relative bg-[var(--kin-nen-trang)]" style={sticky} aria-hidden>
            {hours.slice(0, -1).map(h => (
              <span key={h} className="absolute left-2 text-[length:var(--kin-co-goc)] font-mono text-[var(--kin-chu-mo)]" style={{ top: (h - startH) * PX_PER_HOUR + 4 }}>
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
          {perDay.map(({ k, visible, hidden, shown }) => {
            const today = k === todayKey;
            const chipTop = hidden.length ? topOf(Math.min(...hidden.map(p => p.s))) : 0;
            const laneStyle = (lane: number) => ({ left: `calc(${(lane / shown) * 100}% + 4px)`, width: `calc(${100 / shown}% - 8px)` });
            return (
              <div key={k} className="relative border-l border-[var(--kin-vien-nhat)]" style={today ? { background: "var(--kin-nen-nhan)" } : undefined}>
                {hours.slice(0, -1).map(h => (
                  <div key={h} aria-hidden className="absolute inset-x-0 border-t border-[var(--kin-vien-nhat)]" style={{ top: (h - startH) * PX_PER_HOUR }} />
                ))}
                {visible.map(({ o, lane, s, h }) => {
                  const sel = openKey === o.key;
                  return (
                    <button key={o.key} type="button" onClick={() => onPick(o.key)} aria-expanded={sel} aria-controls={`chi-tiet-${o.key}`}
                      title={label(o)} aria-label={label(o)} data-lich-block
                      className="absolute text-left px-2 py-1.5 min-h-[44px] leading-5 text-[length:var(--kin-co-goc)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]"
                      style={{ top: topOf(s), height: h, ...laneStyle(lane), ...blockStyle(o, sel, today) }}>
                      {blockBody(o)}
                    </button>
                  );
                })}
                {hidden.length > 0 && (
                  <>
                    <button type="button" onClick={() => setMore(more === k ? null : k)} aria-expanded={more === k}
                      aria-label={`Thêm ${hidden.length} buổi trùng giờ, bấm để xem đủ`} data-lich-more
                      className="absolute min-h-[44px] px-2 text-left text-[length:var(--kin-co-goc)] font-medium leading-5 border border-[var(--kin-vien-o-nhap)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]"
                      style={{ top: chipTop, ...laneStyle(MAX_LANES - 1), background: "var(--kin-nen-trang)", color: "var(--kin-chu-chinh)" }}>
                      +{hidden.length} buổi
                    </button>
                    {more === k && (
                      <div role="group" aria-label="Các buổi còn lại trong ngày" data-lich-popover
                        className="absolute z-20 flex flex-col gap-1 p-2 border border-[var(--kin-vien-thuong)] shadow-lg"
                        style={{ top: chipTop + 48, right: 4, width: 220, background: "var(--kin-nen-trang)" }}>
                        {hidden.map(({ o }) => (
                          <button key={o.key} type="button" onClick={() => { setMore(null); onPick(o.key); }} title={label(o)} aria-label={label(o)} data-lich-block
                            className="text-left px-2 py-1.5 min-h-[44px] leading-5 text-[length:var(--kin-co-goc)] focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]"
                            style={blockStyle(o, openKey === o.key, false)}>
                            {blockBody(o)}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
