"use client";

import { useState, useMemo, useEffect } from "react";
import { Calendar, Alarm, Edit } from "griddy-icons";
import type { ScheduleEvent } from "@/app/api/schedule/route";

// ── Date helpers ──────────────────────────────────────────────────────────────

function getWeekBounds(offset: number): { monday: Date; sunday: Date; weekNumber: number } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const startOfYear = new Date(monday.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(
    ((monday.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
  );
  return { monday, sunday, weekNumber };
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function fmt(d: Date) {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function isoToDisplay(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function isoToWeekday(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d.getDay()];
}

const WEEK_DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_CFG = {
  exam:     { label: "Thi thử",  color: "#FF2157", bg: "#fee2e2", Icon: Edit },
  deadline: { label: "Deadline", color: "#FE9900", bg: "#fef3c7", Icon: Alarm },
} as const;

// ── Component ────────────────────────────────────────────────────────────────

export default function LichHocPage() {
  const [events, setEvents]       = useState<ScheduleEvent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeDay, setActiveDay] = useState<string>("all");
  const [activeType, setActiveType] = useState<"all" | "exam" | "deadline">("all");
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const { monday, sunday, weekNumber } = useMemo(() => getWeekBounds(weekOffset), [weekOffset]);

  const mondayISO = toISO(monday);
  const sundayISO = toISO(sunday);

  const weekDates = useMemo(() =>
    WEEK_DAYS.map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return fmt(d);
    }), [monday]);

  const weekEvents = useMemo(
    () => events.filter((e) => e.isoDate >= mondayISO && e.isoDate <= sundayISO),
    [events, mondayISO, sundayISO]
  );

  const todayISO = toISO(new Date());
  const todayCount    = weekEvents.filter((e) => e.isoDate === todayISO).length;
  const examCount     = weekEvents.filter((e) => e.type === "exam").length;
  const deadlineCount = weekEvents.filter((e) => e.type === "deadline").length;

  const filtered = useMemo(() => {
    return weekEvents.filter((e) => {
      const matchDay  = activeDay  === "all" || isoToWeekday(e.isoDate) === activeDay;
      const matchType = activeType === "all" || e.type === activeType;
      return matchDay && matchType;
    });
  }, [weekEvents, activeDay, activeType]);

  // Group by isoDate for display
  const grouped = useMemo(() => {
    const map: Record<string, ScheduleEvent[]> = {};
    for (const e of filtered) {
      if (!map[e.isoDate]) map[e.isoDate] = [];
      map[e.isoDate].push(e);
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: "#1a1a1a" }}>
          <Calendar size={26} style={{ color: "#0068FF" }} /> Lịch học cá nhân
        </h1>
        <p className="text-sm mt-1" style={{ color: "#787671" }}>
          Tuần {weekNumber} · {fmt(monday)} – {fmt(sunday)}/{sunday.getFullYear()}
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Hôm nay",           value: todayCount,    color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" },
          { label: "Thi thử tuần này",  value: examCount,     color: "#FF2157", bg: "#fee2e2", border: "#fca5a5" },
          { label: "Deadline tuần này", value: deadlineCount, color: "#b45309", bg: "#fef3c7", border: "#fde68a" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4 text-center"
            style={{ background: s.bg, border: `1px solid ${s.border}` }}>
            {loading
              ? <div className="h-8 w-8 mx-auto mb-1 rounded-md animate-pulse" style={{ background: s.border }} />
              : <div className="text-2xl font-bold mb-0.5" style={{ color: s.color }}>{s.value}</div>}
            <div className="text-xs" style={{ color: "#9CA3AF" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Day filter */}
      <div className="rounded-xl p-3" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
        <div className="grid grid-cols-8 gap-1">
          <button onClick={() => setActiveDay("all")}
            className="py-2 rounded-md text-xs font-medium"
            style={activeDay === "all"
              ? { background: "#0068FF", color: "white", borderRadius: "8px" }
              : { background: "#f6f5f4", border: "1px solid #e5e3df", color: "#787671", borderRadius: "8px" }}>
            Tất cả
          </button>
          {WEEK_DAYS.map((day, i) => {
            const dateForDay = new Date(monday);
            dateForDay.setDate(monday.getDate() + (day === "CN" ? 6 : i));
            const isoForDay = toISO(dateForDay);
            const hasEvent = weekEvents.some((e) => e.isoDate === isoForDay);
            return (
              <button key={day} onClick={() => setActiveDay(day)}
                className="py-2 rounded-md text-xs font-medium relative"
                style={activeDay === day
                  ? { background: "#0068FF", color: "white", borderRadius: "8px" }
                  : { background: "#f6f5f4", border: "1px solid #e5e3df", color: "#787671", borderRadius: "8px" }}>
                <div>{day}</div>
                {hasEvent && activeDay !== day && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: "#0068FF" }} />
                )}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-8 gap-1 mt-1 px-0.5">
          <div />
          {weekDates.map((d, i) => (
            <div key={i} className="text-center text-xs" style={{ color: "#a4a097" }}>{d}</div>
          ))}
        </div>
      </div>

      {/* Type filter */}
      <div className="flex flex-wrap gap-2">
        {(["all", "exam", "deadline"] as const).map((t) => {
          const cfg = t !== "all" ? TYPE_CFG[t] : null;
          return (
            <button key={t} onClick={() => setActiveType(t)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium"
              style={activeType === t
                ? { background: cfg?.color ?? "#37352f", color: "white", borderRadius: "8px" }
                : { background: "#ffffff", border: "1px solid #e5e3df", color: "#787671", borderRadius: "8px" }}>
              {cfg && <cfg.Icon size={12} />}
              {t === "all" ? "Tất cả" : TYPE_CFG[t].label}
            </button>
          );
        })}
      </div>

      {/* Events list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl p-4 animate-pulse"
              style={{ background: "#f6f5f4", border: "1px solid #e5e3df", height: 88 }} />
          ))}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="rounded-xl p-10 text-center"
          style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
          <Calendar size={40} style={{ color: "#c8c4be", margin: "0 auto 12px" }} />
          <p className="font-semibold" style={{ color: "#1a1a1a" }}>Không có lịch nào trong tuần này</p>
          <p className="text-sm mt-1" style={{ color: "#787671" }}>Thử chuyển sang tuần khác</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([iso, dayEvents]) => {
            const isToday = iso === todayISO;
            return (
              <div key={iso}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                    style={{ background: isToday ? "#dc2626" : "#0068FF" }}>
                    {iso.slice(8)}
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: "#1a1a1a" }}>
                      {isToday ? "Hôm nay" : isoToWeekday(iso)} {isoToDisplay(iso)}
                    </p>
                    <p className="text-xs" style={{ color: "#a4a097" }}>{dayEvents.length} hoạt động</p>
                  </div>
                </div>

                <div className="space-y-2 pl-3 border-l-2"
                  style={{ borderColor: isToday ? "#dc2626" : "#e5e3df" }}>
                  {dayEvents.map((event) => {
                    const cfg = TYPE_CFG[event.type];
                    return (
                      <div key={event.id} className="rounded-xl p-4"
                        style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: cfg.bg }}>
                            <cfg.Icon size={17} style={{ color: cfg.color }} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{ background: cfg.bg, color: cfg.color }}>
                                {cfg.label}
                              </span>
                              <span className="text-xs font-semibold" style={{ color: "#0068FF" }}>
                                {event.time}
                              </span>
                            </div>
                            <p className="font-semibold text-sm" style={{ color: "#1a1a1a" }}>
                              {event.topic}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: "#787671" }}>{event.subject}</p>
                          </div>

                          {event.link && (
                            <a href={event.link} target="_blank" rel="noopener noreferrer"
                              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                              style={{ background: cfg.color, borderRadius: "8px" }}>
                              {event.type === "exam" ? "Vào thi" : "Nộp bài"}
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Week navigation */}
      <div className="flex justify-between items-center pt-2">
        <button
          onClick={() => { setWeekOffset((w) => w - 1); setActiveDay("all"); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#787671", borderRadius: "8px" }}>
          Tuần trước
        </button>
        <div className="text-center">
          <span className="text-xs font-bold block" style={{ color: "#1a1a1a" }}>Tuần {weekNumber}</span>
          <span className="text-xs" style={{ color: "#787671" }}>{fmt(monday)} – {fmt(sunday)}</span>
        </div>
        <button
          onClick={() => { setWeekOffset((w) => w + 1); setActiveDay("all"); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#787671", borderRadius: "8px" }}>
          Tuần sau
        </button>
      </div>
    </div>
  );
}
