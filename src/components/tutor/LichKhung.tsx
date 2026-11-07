// TUT-lich-keo-tha — vỏ "có courseId" của lưới khung giờ kéo-thả: tải khung của lớp + khung các lớp khác của cô (để cảnh báo trùng giờ),
// ghi LẠC QUAN từng thao tác (mỗi khung một hàng đợi nên PUT không đảo thứ tự), hoàn lại khi lỗi, và chuyển 409 "trùng lịch" thành câu hỏi "Vẫn lưu".
// Dùng ở /lop-cua-toi/quan-lop/[id]/lich-hoc (một lớp) và /lop-cua-toi/lich/khung (có ô chọn lớp, nhớ ?lop= trong URL).
// Khung của lớp lấy từ GET /api/courses/[id]/class-schedules (chính nó kiểm quyền: 403 lớp người khác, 404 không có); khung lớp khác từ GET /api/tutor/khung-gio
// (chỉ giờ + tên lớp, không có danh sách học sinh). Lỗi tải khung lớp khác KHÔNG chặn việc sửa, chỉ mất cảnh báo trùng và được nói rõ.
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { kinButtonClass } from "@/components/kin/Button";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinPage, KinPageHeader, KIN_FIELD, KIN_LABEL, KIN_TWO_COL } from "@/components/kin/PageLayout";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinPanel } from "@/components/kin/Panel";
import { KinStatus } from "@/components/kin/Status";
import { jfetch } from "@/components/tutor/studentUi";
import WeekScheduleEditor from "@/components/tutor/WeekScheduleEditor";
import { classAccentFor } from "@/lib/classColor";
import {
  WEEKDAY_NAMES, WEEK_ORDER, applyOp, formatDuration, fromApiRow, invertOp, toApiSlot, weeklyMinutes,
  type Conflict, type OpResult, type ScheduleBlock, type ScheduleOp,
} from "@/lib/scheduleDrag";
import { hmOf } from "@/lib/classSessions";

interface CourseInfo { id: string; name: string; color: string | null; scheduleCount: number }
type Phase = "loading" | "error" | "ready" | "forbidden" | "notfound" | "nocourse";
const hm = (m: number) => (m >= 1440 ? "24:00" : hmOf(m));

export default function LichKhung({ courseId, selectable = false }: { courseId?: string | null; selectable?: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState<string | null>(courseId ?? null);
  const [courses, setCourses] = useState<CourseInfo[] | null>(null);
  const [coursesFailed, setCoursesFailed] = useState(false);
  const [ghostRules, setGhostRules] = useState<ScheduleBlock[]>([]);
  const [phase, setPhase] = useState<Phase>("loading");
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const blocksRef = useRef<ScheduleBlock[]>([]);
  useEffect(() => { blocksRef.current = blocks; });
  const alias = useRef(new Map<string, string>());           // id tạm (khung mới) -> id máy chủ (sau khi POST xong khối đổi sang id thật)
  const queues = useRef(new Map<string, Promise<unknown>>()); // hàng đợi ghi theo từng khung
  const seq = useRef(0);                                       // chống lời giải đến muộn khi đổi lớp

  const courseName = courses?.find(c => c.id === current)?.name ?? "Lớp này";
  const accent = classAccentFor(current ?? "", courses?.find(c => c.id === current)?.color);

  // Danh sách lớp + khung lớp khác (không chặn).
  const loadOthers = useCallback(async () => {
    const r = await jfetch("/api/tutor/khung-gio", { method: "GET" });
    if (!r.ok) { setCoursesFailed(true); return; }
    setCoursesFailed(false);
    setCourses(Array.isArray(r.json?.courses) ? (r.json.courses as { id: string; name: string; scheduleCount?: number }[]).map(c => ({ id: c.id, name: c.name, color: null, scheduleCount: c.scheduleCount ?? 0 })) : []);
    const rules = Array.isArray(r.json?.rules) ? r.json.rules as Record<string, unknown>[] : [];
    setGhostRules(rules.map(x => fromApiRow(x)).filter((b): b is ScheduleBlock => !!b));
    const colors = new Map<string, string | null>(rules.map(x => [String(x.courseId), (x.color as string | null) ?? null]));
    setCourses(cs => (cs ? cs.map(c => ({ ...c, color: colors.get(c.id) ?? null })) : cs));
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- tải dữ liệu lúc vào trang; setState chỉ chạy sau await
  useEffect(() => { void loadOthers(); }, [loadOthers]);

  // Khi trang chưa biết lớp nào (trang /lich/khung không có ?lop=): chọn lớp đầu tiên.
  useEffect(() => {
    if (current || !selectable || courses === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chọn lớp mặc định khi danh sách lớp vừa tải xong
    if (courses.length === 0) { setPhase("nocourse"); return; }
    setCurrent(courses[0].id);
  }, [current, selectable, courses]);

  const load = useCallback(async (cid: string) => {
    const mine = ++seq.current;
    await Promise.resolve();   // không setState đồng bộ trong thân effect gọi hàm này
    setPhase("loading"); setMsg(null);
    const r = await jfetch(`/api/courses/${encodeURIComponent(cid)}/class-schedules`);
    if (mine !== seq.current) return;
    if (r.status === 403) { setPhase("forbidden"); return; }
    if (r.status === 404) { setPhase("notfound"); return; }
    if (!r.ok || !Array.isArray(r.json)) { setPhase("error"); return; }
    alias.current.clear();
    setBlocks((r.json as Record<string, unknown>[]).map(x => fromApiRow({ ...x, courseId: cid })).filter((b): b is ScheduleBlock => !!b));
    setPhase("ready");
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- tải khung của lớp đang chọn; setState chỉ chạy sau await
  useEffect(() => { if (current) void load(current); }, [current, load]);

  // Gắn tên lớp vào mọi khung của lớp này (tên đến sau khi danh sách lớp tải xong).
  const shown = useMemo(() => blocks.map(b => ({ ...b, courseName })), [blocks, courseName]);
  const ghosts = useMemo(() => ghostRules.filter(g => g.courseId !== current), [ghostRules, current]);


  const onOp = useCallback((opIn: ScheduleOp, o?: { force?: boolean }): Promise<OpResult> => {
    const cid = current as string;
    const key = opIn.type === "create" ? opIn.block.id : opIn.id;
    const run = async (): Promise<OpResult> => {
      const op: ScheduleOp = opIn.type === "create" ? opIn : { ...opIn, id: alias.current.get(opIn.id) ?? opIn.id };   // id tạm của khung vừa tạo (nằm trong hàng đợi của chính nó) -> id thật
      const before = blocksRef.current;
      const inverse = invertOp(op, before);
      // Lạc quan: áp ngay; lỗi thì đảo lại đúng khung này.
      setBlocks(applyOp(before, op.type === "create" ? { ...op, block: { ...op.block, draft: false } } : op));
      const revert = () => { if (inverse) setBlocks(cur => applyOp(cur, inverse)); };
      const merged = op.type === "update" ? { ...(before.find(b => b.id === op.id) as ScheduleBlock), ...op.patch } : null;
      let res: Awaited<ReturnType<typeof jfetch>>;
      if (op.type === "create") {
        res = await jfetch(`/api/courses/${encodeURIComponent(cid)}/class-schedules`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...toApiSlot(op.block), checkConflicts: true, ...(o?.force ? { force: true } : {}) }) });
        if (res.ok && typeof res.json?.id === "string") {
          const tmp = op.block.id, real = res.json.id as string;
          alias.current.set(tmp, real);
          setBlocks(cur => cur.map(b => (b.id === tmp ? { ...b, id: real } : b)));
        }
      } else if (op.type === "update" && merged) {
        const body: Record<string, unknown> = {};
        const slot = toApiSlot(merged);
        if ("dayOfWeek" in op.patch) body.dayOfWeek = slot.dayOfWeek;
        if ("startMin" in op.patch || "endMin" in op.patch) { body.startTime = slot.startTime; body.endTime = slot.endTime; }
        for (const k of ["note", "mode", "location", "joinUrl", "active"] as const) if (k in op.patch) body[k] = op.patch[k] ?? null;
        if (typeof body.active !== "boolean") delete body.active;
        const timeChanged = "dayOfWeek" in body || "startTime" in body || body.active === true;
        if (timeChanged) { body.checkConflicts = true; if (o?.force) body.force = true; }
        res = await jfetch(`/api/class-schedules/${encodeURIComponent(op.id)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      } else if (op.type === "remove") {
        res = await jfetch(`/api/class-schedules/${encodeURIComponent(op.id)}`, { method: "DELETE" });
      } else return { ok: true };
      if (res.ok) return { ok: true };
      revert();
      if (res.status === 409 && res.json?.needsConfirm && Array.isArray(res.json.conflicts)) {
        const conflicts: Conflict[] = (res.json.conflicts as { text?: string; sharedStudents?: number }[]).map((c, i) => ({
          otherId: `srv-${i}`, kind: "lop-khac", courseName: "",
          text: `${c.text ?? "Trùng lịch"}${c.sharedStudents ? ` (có ${c.sharedStudents} học sinh học cả hai lớp)` : ""}`,
        }));
        return { ok: false, conflicts };
      }
      const error = res.status === 0 ? "Lỗi kết nối, kiểm tra mạng rồi thử lại." : res.status === 403 ? "Cô không có quyền sửa lớp này." : res.status === 404 ? "Khung giờ này không còn nữa, hãy tải lại trang." : (typeof res.json?.error === "string" ? res.json.error : "Máy chủ chưa lưu được.");
      return { ok: false, error };
    };
    const prev = queues.current.get(key) ?? Promise.resolve();
    const next = prev.then(run, run);
    queues.current.set(key, next.catch(() => undefined));
    return next;
  }, [current]);

  async function toggle(b: ScheduleBlock) {
    const on = b.active === false;
    setMsg(null);
    const r = await onOp({ type: "update", id: b.id, patch: { active: on } });
    if (r.ok) { setMsg(`Đã ${on ? "bật lại" : "tắt"} khung ${WEEKDAY_NAMES[b.dayOfWeek]} ${hm(b.startMin)}–${hm(b.endMin)}.`); return; }
    setMsg("conflicts" in r ? `Không bật lại được: ${r.conflicts.map(c => c.text).join("; ")}` : `Không lưu được: ${r.error}`);
  }

  function pick(id: string) {
    setCurrent(id);
    if (selectable) router.replace(`/lop-cua-toi/lich/khung?lop=${encodeURIComponent(id)}`);
  }

  const sortedList = [...shown].sort((a, b) => WEEK_ORDER.indexOf(a.dayOfWeek as typeof WEEK_ORDER[number]) - WEEK_ORDER.indexOf(b.dayOfWeek as typeof WEEK_ORDER[number]) || a.startMin - b.startMin);

  const header = (
    <KinPageHeader title="Khung giờ học của lớp"
      sub={phase === "ready" ? `${courseName} · lặp mọi tuần` : "Khung giờ hằng tuần: học sinh thấy buổi học và KiN nhắc lịch từ đây."}
      back={{ href: current && !selectable ? `/lop-cua-toi/${encodeURIComponent(current)}` : "/lop-cua-toi/lich", label: current && !selectable ? "← Về trang lớp" : "← Lịch dạy" }} />
  );

  if (phase === "forbidden") return (
    <KinPage>{header}
      <KinEmptyState title="Bạn không có quyền với lớp này" action={<Link href="/lop-cua-toi/lop" className={kinButtonClass("primary")}>Về danh sách lớp</Link>}>
        Lớp này thuộc người khác nên KiN không hiện khung giờ của lớp. Cô mở lớp của mình ở danh sách lớp.
      </KinEmptyState>
    </KinPage>
  );
  if (phase === "notfound") return (
    <KinPage>{header}
      <KinEmptyState title="Không tìm thấy lớp" action={<Link href="/lop-cua-toi/lop" className={kinButtonClass("primary")}>Về danh sách lớp</Link>}>
        Lớp này không còn hoặc đường dẫn bị sai. Cô chọn lại lớp ở danh sách lớp.
      </KinEmptyState>
    </KinPage>
  );
  if (phase === "nocourse") return (
    <KinPage>{header}
      <KinEmptyState title="Cô chưa có lớp nào" action={<Link href="/lop-cua-toi/lop/tao" className={kinButtonClass("primary")}>Tạo lớp đầu tiên</Link>}>
        Khung giờ gắn với từng lớp. Tạo lớp trước, rồi đặt lịch học cho lớp ngay trong bước Lịch học.
      </KinEmptyState>
    </KinPage>
  );

  const editor = (
    <WeekScheduleEditor blocks={shown} ghosts={ghosts} accent={accent} remote courseLabel={courseName}
      state={phase === "ready" ? "ready" : phase === "error" ? "error" : "loading"}
      onRetry={() => current && void load(current)} onOp={onOp}
      emptyNote={<>Học sinh sẽ không thấy buổi nào trong lịch cho tới khi lớp có khung giờ.</>} />
  );

  return (
    <KinPage>
      {header}
      {(selectable || coursesFailed) && (
        <div className="mb-5 max-w-md">
          {selectable && courses && courses.length > 0 && (
            <label className={KIN_LABEL}>Lớp
              <select value={current ?? ""} onChange={e => pick(e.target.value)} className={`${KIN_FIELD} mt-2`} data-course-picker>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}{c.scheduleCount === 0 ? " (chưa có lịch)" : ""}</option>)}
              </select>
            </label>
          )}
          {coursesFailed && (
            <p role="status" data-ghost-error className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
              Chưa kiểm được trùng giờ với lớp khác của cô, vẫn sửa và lưu được.{" "}
              <button type="button" onClick={() => void loadOthers()} className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Thử lại</button>
            </p>
          )}
        </div>
      )}
      <div className={KIN_TWO_COL}>
        <div className="min-w-0">{editor}</div>
        {phase === "ready" && (
          <aside className="min-w-0" aria-label="Khung của lớp">
            <KinSectionHead title="Khung của lớp" aside={<span className="tabular-nums">{formatDuration(weeklyMinutes(shown))} / tuần</span>} />
            {sortedList.length === 0 ? (
              <p className="pt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Chưa có khung nào. Kéo trên lưới để thêm.</p>
            ) : (
              <KinPanel flush className="mt-4">
                <ul data-rule-list>
                  {sortedList.map(b => (
                    <li key={b.id} className="flex items-center justify-between gap-3 px-[var(--kin-kc-6)] py-[var(--kin-kc-4)] border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)]">
                      <span className="min-w-0">
                        <span className="block font-medium text-[var(--kin-chu-chinh)] tabular-nums">{WEEKDAY_NAMES[b.dayOfWeek]} {hm(b.startMin)}–{hm(b.endMin)}</span>
                        <span className="block text-[var(--kin-chu-mo)]">{formatDuration(b.endMin - b.startMin)}{b.note ? ` · ${b.note}` : ""}</span>
                        {b.active === false && <KinStatus tone="mo">Đã tắt</KinStatus>}
                      </span>
                      <button type="button" onClick={() => void toggle(b)} className={kinButtonClass("secondary")} aria-label={`${b.active === false ? "Bật lại" : "Tắt"} khung ${WEEKDAY_NAMES[b.dayOfWeek]} ${hm(b.startMin)}`}>{b.active === false ? "Bật lại" : "Tắt"}</button>
                    </li>
                  ))}
                </ul>
              </KinPanel>
            )}
            {msg && <p role="status" data-rule-msg className="mt-3 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">{msg}</p>}
            <p className="mt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Đổi khung áp cho mọi tuần, kể cả buổi sắp tới của học sinh. KiN không tự báo học sinh, cô nhắn lớp qua Zalo khi đổi giờ.</p>
          </aside>
        )}
      </div>
    </KinPage>
  );
}
