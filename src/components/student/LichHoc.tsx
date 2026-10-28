// Lịch học của học sinh (Figma "Học sinh · Lịch học" 299:114537, điện thoại 299:116644): tiêu đề + "Hôm nay", dải chuyển tuần,
// lưới tuần T2–CN (máy tính ≥ 1024px: nền nhấn = buổi học, viền = hạn nộp) + danh sách theo ngày bên phải; điện thoại: dải 7 ngày + danh sách.
// NC2-043 (góp ý 28/10): thêm / sửa / xoá VIỆC RIÊNG của em (học thêm ngoài KiN, tự ôn) ngoài lịch cố định của các lớp — nét đứt trên lưới, chỉ mình em thấy
// (bảng student_personal_events, API /api/student/lich-rieng, form ở components/student/LichRieng); không đổi lịch lớp.
// Dữ liệu: /api/schedule (buổi học, thi thử, hạn nộp ngoài KiN) + /api/student/viec-cua-toi (hạn nộp bài tập). Lịch chỉ có từ HÔM NAY trở đi
// (nguồn không trả quá khứ) nên tuần đã qua ghi rõ điều đó. KHÔNG có dữ liệu thật nên bỏ: bộ lọc "Toán 9 ▾ · Tuần ▾", chữ "Trực tuyến".
"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { addDaysKey, hmOf, vnDateKeyOf } from "@/lib/classSessions";
import { buildWeekItems, gridHours, KIND_LABEL, mergeWeekItems, mondayOf, personalWeekItems, weekKeys, type WeekItem } from "@/lib/studentWeek";
import { PersonalForm, usePersonalEvents, type PersonalFormInitial } from "@/components/student/LichRieng";
import { useKinConfirm } from "@/components/kin/useConfirm";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { kinButtonClass } from "@/components/kin/Button";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinCallout } from "@/components/kin/Callout";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinStatus } from "@/components/kin/Status";
import { dayTitle, dmOfKey, useStudentWork, WorkSkeleton } from "@/components/student/shared";

const DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const ROW = 44; // px mỗi giờ trên lưới

function lanes(items: WeekItem[]): Map<string, { lane: number; of: number }> {
  const res = new Map<string, { lane: number; of: number }>();
  const ends: number[] = [];
  let group: WeekItem[] = [];
  const flush = () => { const n = Math.max(1, ends.length); group.forEach(g => { res.get(g.id)!.of = n; }); group = []; ends.length = 0; };
  for (const it of items) {
    const end = it.end ?? it.start + 60;
    if (group.length && ends.every(e => e <= it.start)) flush();
    let lane = ends.findIndex(e => e <= it.start);
    if (lane < 0) { lane = ends.length; ends.push(end); } else ends[lane] = end;
    res.set(it.id, { lane, of: 1 });
    group.push(it);
  }
  flush();
  return res;
}

function ItemLink({ it, className, style, children }: { it: WeekItem; className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return it.external
    ? <a href={it.href} target="_blank" rel="noopener noreferrer" className={className} style={style}>{children}</a>
    : <Link href={it.href} className={className} style={style}>{children}</Link>;
}

function DayRow({ it, onEdit, onDelete }: { it: WeekItem; onEdit: (it: WeekItem) => void; onDelete: (it: WeekItem) => void }) {
  const time = it.end ? `${hmOf(it.start)}–${hmOf(it.end)}` : hmOf(it.start);
  if (it.kind === "personal") {
    return (
      <li data-week-item="personal" className="py-[var(--kin-kc-7)] border-t border-[var(--kin-vien-nhat)] first:border-t-0">
        <p className="text-[length:var(--kin-co-goc)]"><KinStatus tone="mo">Việc riêng</KinStatus></p>
        <p className="mt-2 text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)] break-words">{it.title}</p>
        <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] tabular-nums">{time}</p>
        {it.note && <p className="mt-1 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)] whitespace-pre-line break-words">{it.note}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => onEdit(it)} aria-label={`Sửa việc riêng ${it.title}`} className={kinButtonClass("secondary")}>Sửa</button>
          <button type="button" onClick={() => onDelete(it)} aria-label={`Xoá việc riêng ${it.title}`} className={kinButtonClass("secondary")}>Xoá</button>
        </div>
      </li>
    );
  }
  if (it.kind === "class") {
    return (
      <li data-week-item="class" className="py-[var(--kin-kc-7)]">
        <p className="text-[length:var(--kin-co-goc)]">{it.cancelled ? <KinStatus tone="loi">Buổi học đã huỷ</KinStatus> : <KinStatus tone="mo">Buổi học</KinStatus>}</p>
        <p className="mt-2 text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)]">{it.title}</p>
        <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] tabular-nums">{time}{it.sub ? ` · ${it.sub}` : ""}</p>
        {!it.cancelled && <ItemLink it={it} className={`${kinButtonClass("primary")} mt-4`}>Vào lớp học</ItemLink>}
      </li>
    );
  }
  const action = it.kind === "exam" ? "Xem thông tin đề" : it.kind === "task" ? (it.interactive ? "Làm bài" : "Nộp bài") : "Mở bài";
  return (
    <li data-week-item={it.kind} className="py-[var(--kin-kc-7)] border-t border-[var(--kin-vien-nhat)] first:border-t-0">
      <p className="text-[length:var(--kin-co-body)] leading-6 text-[var(--kin-chu-chinh)]">{it.title}</p>
      <p className="mt-2 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
        {it.kind === "exam" ? "Mở" : "Hạn nộp"} · <span className="tabular-nums">{time}</span>{it.sub ? ` · ${it.sub}` : ""}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div>{it.kind === "task" ? <KinStatus tone="cho">Bài tập chưa nộp</KinStatus> : it.kind === "exam" ? <KinStatus tone="mo">Chưa mở</KinStatus> : null}</div>
        <ItemLink it={it} className={`${kinButtonClass("secondary")} flex-shrink-0`}>{action}</ItemLink>
      </div>
    </li>
  );
}

export default function LichHoc() {
  const { items: todo, events, error, eventsError, load } = useStudentWork();
  const { ask, dialog } = useKinConfirm();
  const [form, setForm] = useState<PersonalFormInitial | null>(null);
  const [actionError, setActionError] = useState("");
  const [today, setToday] = useState("");
  const [monday, setMonday] = useState("");
  const [pick, setPick] = useState<string | null>(null);
  useEffect(() => { void Promise.resolve().then(() => { const t = vnDateKeyOf(new Date()); setToday(t); setMonday(mondayOf(t)); }); }, []);

  const thisMonday = today ? mondayOf(today) : "";
  const keys = useMemo(() => (monday ? weekKeys(monday) : []), [monday]);
  const personal = usePersonalEvents(keys[0] ?? "", keys[6] ?? "");
  const all = useMemo(() => mergeWeekItems(buildWeekItems(events ?? [], todo ?? []), personalWeekItems(personal.list ?? [])), [events, todo, personal.list]);
  const week = useMemo(() => all.filter(i => keys.includes(i.dateKey)), [all, keys]);
  const shownKeys = keys.filter(k => (pick ? k === pick : week.some(i => i.dateKey === k)));
  const { from, to } = gridHours(week);
  const loading = (todo === null && !error) || (events === null && !eventsError) || !monday;
  const failed = error || eventsError;
  const range = monday ? `${dmOfKey(keys[0])}–${dmOfKey(keys[6])}/${keys[6].slice(0, 4)}` : "";
  const monthLabel = keys.length ? (keys[0].slice(5, 7) === keys[6].slice(5, 7) ? `${Number(keys[0].slice(8))} – ${Number(keys[6].slice(8))} tháng ${Number(keys[6].slice(5, 7))}` : `${dmOfKey(keys[0])} – ${dmOfKey(keys[6])}`) : "";
  const go = (n: number) => { setMonday(m => addDaysKey(m, 7 * n)); setPick(null); };

  // NC2-043: việc riêng. Mở form thêm (mặc định ngày đang chọn, hoặc hôm nay nếu tuần này, hoặc thứ Hai của tuần đang xem) / sửa / xoá có hộp xác nhận KiN.
  const openNew = () => { setActionError(""); setForm({ title: "", dateKey: pick ?? (keys.includes(today) ? today : keys[0] ?? today), startTime: "19:00", endTime: "", note: "" }); };
  const openEdit = (it: WeekItem) => {
    const p = (personal.list ?? []).find(x => x.id === it.personalId);
    if (!p) return;
    setActionError("");
    setForm({ id: p.id, title: p.title, dateKey: p.dateKey, startTime: p.startTime, endTime: p.endTime ?? "", note: p.note ?? "" });
  };
  const removePersonal = async (it: WeekItem) => {
    if (!it.personalId) return;
    if (!(await ask({ title: "Xoá việc riêng này?", message: `"${it.title}" sẽ bị xoá khỏi lịch của bạn. Không hoàn tác được.`, confirmLabel: "Xoá", tone: "nguy-hiem" }))) return;
    try {
      const res = await fetch(`/api/student/lich-rieng/${it.personalId}`, { method: "DELETE", credentials: "same-origin" });
      if (!res.ok && res.status !== 404) throw new Error(String(res.status));
      setActionError("");
      personal.reload();
    } catch { setActionError("Chưa xoá được, thử lại nhé."); }
  };
  return (
    <div className="px-4 md:px-10 pt-6 md:pt-8 pb-10 bg-[var(--kin-nen-trang)]">
      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6">
        <div className="min-w-0">
          <h1 className="text-[length:var(--kin-co-h2)] leading-9 font-medium tracking-[-0.01em] text-[var(--kin-chu-chinh)]">Lịch học</h1>
          <p className="mt-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
            {range}{range ? " · " : ""}<span className="md:hidden">Giờ Việt Nam</span><span className="hidden md:inline">Buổi học và hạn nộp bài tập được phân biệt rõ.</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 self-start flex-shrink-0">
          <button type="button" onClick={openNew} data-add-personal className={kinButtonClass("primary")}>+ Thêm việc riêng</button>
          <button type="button" onClick={() => { setMonday(thisMonday); setPick(null); }} className={`${kinButtonClass("secondary")} max-md:hidden`}>Hôm nay</button>
        </div>
      </header>

      {form && today && (
        <PersonalForm key={form.id ?? "moi"} initial={form} todayKey={today} onCancel={() => setForm(null)}
          onSaved={e => { setForm(null); setActionError(""); setMonday(mondayOf(e.dateKey)); setPick(null); personal.reload(); }} />
      )}
      {actionError && <p role="alert" className="mb-4 text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{actionError}</p>}
      {personal.error && <ErrorStrip message="Không tải được việc riêng của bạn." onRetry={personal.reload} />}

      {failed && <ErrorStrip message="Không tải được lịch." onRetry={load} />}
      <nav aria-label="Chuyển tuần" className="flex items-center justify-between md:justify-start md:gap-8 py-2">
        <button type="button" onClick={() => go(-1)} className="inline-flex items-center min-h-11 px-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] hover:text-[var(--kin-chu-chinh)]">‹ <span className="ml-1">Tuần trước</span></button>
        <button type="button" onClick={() => { setMonday(thisMonday); setPick(null); }} aria-label="Về tuần này"
          className="md:min-w-[164px] min-h-11 md:px-[var(--kin-kc-8)] md:border md:border-[var(--kin-vien-o-nhap)] md:rounded-[var(--kin-bo-md)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] md:hover:bg-[var(--kin-nen-re-chuot)]">
          <span className="md:hidden">{monday === thisMonday ? "Tuần này" : monthLabel}</span><span className="hidden md:inline">{monthLabel}</span>
        </button>
        <button type="button" onClick={() => go(1)} className="inline-flex items-center min-h-11 px-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] hover:text-[var(--kin-chu-chinh)]"><span className="mr-1">Tuần sau</span> ›</button>
      </nav>

      {loading ? (!failed ? <WorkSkeleton label="Đang tải Lịch học" /> : null) : (
        <>
          {/* Điện thoại / máy nhỏ: dải 7 ngày, bấm một ngày để chỉ xem ngày đó (bấm lại để xem cả tuần). */}
          <div role="group" aria-label="Chọn ngày trong tuần" className="lg:hidden mt-4 grid grid-cols-7 gap-2">
            {keys.map((k, i) => {
              const on = pick === k, isToday = k === today;
              return (
                <button key={k} type="button" aria-pressed={on} aria-label={`${DAYS[i]} ${dmOfKey(k)}${isToday ? ", hôm nay" : ""}`} onClick={() => setPick(on ? null : k)}
                  className={`min-h-14 rounded-[var(--kin-bo-sm)] text-[length:var(--kin-co-goc)] leading-5 ${on || isToday ? "bg-[var(--kin-nen-nhan)] text-[var(--kin-nhan-link)] font-medium" : "bg-[var(--kin-nen-bang)] text-[var(--kin-chu-mo)]"} ${on ? "outline outline-2 outline-[var(--kin-nhan-nen)]" : ""}`}>
                  <span className="block">{DAYS[i]}</span><span className="block tabular-nums">{Number(k.slice(8))}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 grid lg:grid-cols-[minmax(0,1fr)_354px] gap-x-8 gap-y-8 items-start">
            <div className="max-lg:hidden min-w-0">
              <div role="group" aria-label="Lưới tuần" data-week-grid className="border border-[var(--kin-vien-nhat)] overflow-hidden">
                <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] bg-[var(--kin-nen-bang)] h-11 items-center text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
                  <span className="px-2 text-[length:var(--kin-co-small)]">GMT+7</span>
                  {keys.map((k, i) => <span key={k} className={`px-3 ${k === today ? "text-[var(--kin-nhan-link)] font-medium" : ""}`}>{DAYS[i]} · {Number(k.slice(8))}</span>)}
                </div>
                <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))]" style={{ height: (to - from) * ROW }}>
                  <div aria-hidden className="relative border-r border-[var(--kin-vien-nhat)]">
                    {Array.from({ length: to - from }, (_, h) => (
                      <span key={h} className="absolute left-2 text-[length:var(--kin-co-small)] tabular-nums text-[var(--kin-chu-mo)]" style={{ top: h * ROW + 4 }}>{hmOf((from + h) * 60)}</span>
                    ))}
                  </div>
                  {keys.map(k => {
                    const dayItems = week.filter(i => i.dateKey === k);
                    const ln = lanes(dayItems);
                    return (
                      <div key={k} className={`relative border-r border-[var(--kin-vien-nhat)] last:border-r-0 ${k === today ? "bg-[var(--kin-nen-nhan)]" : ""}`}
                        style={{ backgroundImage: "linear-gradient(to bottom, var(--kin-vien-nhat) 1px, transparent 1px)", backgroundSize: `100% ${ROW}px` }}>
                        {dayItems.map(it => {
                          const l = ln.get(it.id)!;
                          const top = ((it.start - from * 60) / 60) * ROW;
                          const h = Math.max(it.kind === "class" ? 44 : 80, it.end ? ((it.end - it.start) / 60) * ROW : 0);
                          const time = it.end ? `${hmOf(it.start)}–${hmOf(it.end)}` : hmOf(it.start);
                          if (it.kind === "personal") {
                            return (
                              <button key={it.id} type="button" onClick={() => openEdit(it)} aria-label={`Sửa việc riêng ${it.title}`} style={{ top, height: h - 2, left: `${(l.lane / l.of) * 100}%`, width: `${100 / l.of}%` }}
                                className="absolute block overflow-hidden px-2 py-1.5 text-left text-[length:var(--kin-co-small)] leading-4 bg-[var(--kin-nen-trang)] border border-dashed border-[var(--kin-nhan-nen)] text-[var(--kin-chu-chinh)] hover:bg-[var(--kin-nen-re-chuot)]">
                                <span className="block">
                                  <span className="block uppercase text-[var(--kin-chu-mo)]">{KIND_LABEL.personal}</span>
                                  <span className="block font-medium break-words">{it.title}</span>
                                  <span className="block tabular-nums">{time}</span>
                                </span>
                              </button>
                            );
                          }
                          return (
                            <ItemLink key={it.id} it={it} style={{ top, height: h - 2, left: `${(l.lane / l.of) * 100}%`, width: `${100 / l.of}%` }} className={`absolute block overflow-hidden px-2 py-1.5 text-[length:var(--kin-co-small)] leading-4 ${it.kind === "class" ? "bg-[var(--kin-nen-nhan)] border-l-2 border-[var(--kin-nhan-nen)] text-[var(--kin-nhan-link)]" : "bg-[var(--kin-nen-trang)] border border-[var(--kin-vien-o-nhap)] text-[var(--kin-chu-chinh)]"}`}>
                              <span className="block">
                                {it.kind !== "class" && <span className="block uppercase text-[var(--kin-chu-mo)]">{KIND_LABEL[it.kind]}</span>}
                                <span className="block font-medium break-words">{it.title}</span>
                                <span className="block tabular-nums">{time}{it.cancelled ? " · đã huỷ" : ""}</span>
                              </span>
                            </ItemLink>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
              <p className="mt-4 flex flex-wrap gap-x-10 gap-y-1 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
                <span><span aria-hidden className="inline-block w-3 h-1.5 mr-2 align-middle bg-[var(--kin-nhan-nen)]" />Nền nhấn: buổi học</span>
                <span><span aria-hidden className="inline-block w-3 h-3 mr-2 align-middle border border-[var(--kin-vien-o-nhap)]" />Viền: hạn nộp bài</span>
                <span><span aria-hidden className="inline-block w-3 h-3 mr-2 align-middle border border-dashed border-[var(--kin-nhan-nen)]" />Nét đứt: việc riêng của bạn (chỉ mình bạn thấy)</span>
              </p>
              <KinCallout className="mt-4">Hạn nộp được ghi bằng ngày và giờ cụ thể, không phải một buổi học. Múi giờ Việt Nam (GMT+7).</KinCallout>
            </div>

            <div className="min-w-0 lg:col-start-2 lg:row-start-1">
              {week.length === 0 || shownKeys.length === 0 ? (
                <KinEmptyState title={pick ? "Ngày này chưa có lịch" : "Tuần này chưa có lịch"}
                  action={<Link href="/student/viec-cua-toi" className={kinButtonClass("secondary")}>Mở Việc của tôi</Link>}>
                  {monday < thisMonday ? "Lịch chỉ hiện từ hôm nay trở đi, nên tuần đã qua để trống." : "Khi lớp có khung giờ học hoặc có bài đến hạn, chúng sẽ hiện ở đây."}
                </KinEmptyState>
              ) : shownKeys.map(k => (
                <section key={k} aria-label={dayTitle(k)} className="mb-6">
                  <KinSectionHead title={dayTitle(k)} aside={k === today ? "Hôm nay" : undefined} />
                  <ul>{week.filter(i => i.dateKey === k).map(it => <DayRow key={it.id} it={it} onEdit={openEdit} onDelete={removePersonal} />)}</ul>
                </section>
              ))}
              <KinCallout className="lg:hidden mt-2">Buổi học có nền nhấn; bài tập ghi hạn nộp riêng. Lịch dùng múi giờ Việt Nam (GMT+7).</KinCallout>
            </div>
          </div>
        </>
      )}
      {dialog}
    </div>
  );
}
