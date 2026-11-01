// BU-02 — trạng thái và thao tác của màn Giáo trình (cây Phần › Chương › Bài + mục của bài đang mở).
// Dựng SONG SONG logic sắp xếp / nhân bản / xoá / khoá của TabChuongBai (admin/khoa-hoc/[id]/page.tsx:1364-1700), không import từ tệp đó; gọi cùng API cũ
// (PATCH /api/courses/[id]/reorder, POST /api/chapters/[id]/lessons, PUT|DELETE /api/lessons/[id]). Thêm/gỡ MỤC đi qua G2/G3 (hợp đồng BU-02 mục 4.2).
// Dữ liệu lấy bằng G1 (GET .../giao-trinh); sau mỗi thao tác ghi, tải lại G1 ở nền để cây luôn khớp máy chủ.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GiaoTrinhSnapshot, GtLesson } from "@/lib/giaoTrinh";
import { jfetch } from "@/components/tutor/studentUi";

export type GtLoad =
  | { phase: "loading" }
  | { phase: "error"; status: number; message: string }
  | { phase: "ready"; snap: GiaoTrinhSnapshot };

/** Đích của mục mới: bài đang có, hoặc bài mới trong một chương (chương null = lớp trống, máy chủ tự tạo Phần 1 › Chương 1). */
export type GtTarget = { kind: "lesson"; lessonId: string } | { kind: "new"; chapterId: string | null; title: string };

export interface AddResult { ok: boolean; duplicate?: boolean; error?: string; moveTo?: string | null; lessonId?: string; key?: string; warning?: string | null; createdLesson?: boolean; lessonTitle?: string }

const base = (courseId: string) => `/api/tutor/lop/${courseId}/giao-trinh`;

export function errorFor(status: number): string {
  if (status === 401) return "Phiên đăng nhập đã hết. Hãy đăng nhập lại.";
  if (status === 403) return "Bạn không có quyền với lớp này.";
  if (status === 404) return "Không tìm thấy lớp này.";
  if (status === 0) return "Mất kết nối. Kiểm tra mạng rồi thử lại.";
  return "Chưa tải được giáo trình. Thử lại sau ít phút.";
}

export function useGiaoTrinh(courseId: string) {
  const [load, setLoad] = useState<GtLoad>({ phase: "loading" });
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const fetchSnap = useCallback(async (): Promise<{ snap: GiaoTrinhSnapshot } | { status: number }> => {
    const r = await jfetch(base(courseId));
    if (r.ok && r.json && Array.isArray(r.json.sections)) return { snap: r.json as GiaoTrinhSnapshot };
    return { status: r.ok ? 500 : r.status };
  }, [courseId]);

  const reload = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoad({ phase: "loading" });
    const r = await fetchSnap();
    if (!alive.current) return;
    if ("snap" in r) {
      setLoad({ phase: "ready", snap: r.snap });
      setLessonId(cur => {
        const all = r.snap.sections.flatMap(s => s.chapters.flatMap(c => c.lessons));
        if (cur && all.some(l => l.id === cur)) return cur;
        return all[0]?.id ?? null;
      });
    } else if (!opts.silent) setLoad({ phase: "error", status: r.status, message: errorFor(r.status) });
  }, [fetchSnap]);

  // Tải lần đầu: đúng ý "đồng bộ với hệ thống ngoài" (API); setState trong run() là trạng thái đang tải.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void reload(); }, [reload]);

  const snap = load.phase === "ready" ? load.snap : null;
  const lessons: { lesson: GtLesson; sectionId: string; chapterId: string }[] = snap
    ? snap.sections.flatMap(s => s.chapters.flatMap(c => c.lessons.map(l => ({ lesson: l, sectionId: s.id, chapterId: c.id })))) : [];
  const current = lessons.find(x => x.lesson.id === lessonId) ?? null;

  /** Chạy một thao tác ghi: khoá nút theo `key`, báo kết quả bằng chữ, rồi tải lại ở nền. */
  async function run(key: string, fn: () => Promise<{ ok: boolean; message?: string }>, okText?: string) {
    if (busy) return false;
    setBusy(key); setNotice(null);
    const r = await fn();
    if (!alive.current) return r.ok;
    setBusy(null);
    if (r.ok) { if (okText) setNotice({ tone: "ok", text: okText }); await reload({ silent: true }); }
    else setNotice({ tone: "err", text: r.message ?? "Chưa lưu được. Thử lại sau." });
    return r.ok;
  }

  const apiMsg = (r: { ok: boolean; status: number; json: { error?: string } | null }) =>
    ({ ok: r.ok, message: r.json?.error ?? (r.status === 0 ? "Mất kết nối. Thử lại." : undefined) });

  // ── Mục (G2 / G3) ───────────────────────────────────────────────────────────
  async function addItem(target: GtTarget, url: string, name?: string, extra: Record<string, unknown> = {}): Promise<AddResult> {
    const body: Record<string, unknown> = { url, ...(name ? { name } : {}), ...extra };
    if (target.kind === "lesson") body.lessonId = target.lessonId;
    else { if (target.chapterId) body.chapterId = target.chapterId; body.newLessonTitle = target.title; }
    const r = await jfetch(`${base(courseId)}/muc`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) return { ok: false, error: r.json?.error ?? (r.status === 0 ? "Mất kết nối. Thử lại." : r.status === 403 ? "Bạn không có quyền với lớp hoặc tệp này." : "Chưa thêm được."), moveTo: r.json?.moveTo ?? null };
    const j = r.json ?? {};
    if (alive.current) void reload({ silent: true });
    if (j.created?.lesson && j.lessonId && alive.current) setLessonId(j.lessonId);
    return { ok: true, duplicate: !!j.duplicate, lessonId: j.lessonId ?? (target.kind === "lesson" ? target.lessonId : undefined), key: j.item?.key, warning: j.warning ?? null, createdLesson: !!j.created?.lesson, lessonTitle: target.kind === "new" ? target.title : undefined };
  }

  async function removeItem(lid: string, key: string) {
    return run(`xoa:${key}`, async () => {
      const r = await jfetch(`${base(courseId)}/muc`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ lessonId: lid, key }) });
      return apiMsg(r);
    }, "Đã gỡ mục khỏi bài.");
  }

  // ── Sắp xếp ▲▼ (API cũ, đã vá V6 phía máy chủ) ─────────────────────────────
  function move(type: "section" | "chapter" | "lesson", id: string, dir: -1 | 1) {
    if (!snap) return;
    let ids: string[] = [];
    if (type === "section") ids = snap.sections.map(s => s.id);
    else if (type === "chapter") ids = snap.sections.find(s => s.chapters.some(c => c.id === id))?.chapters.map(c => c.id) ?? [];
    else ids = snap.sections.flatMap(s => s.chapters).find(c => c.lessons.some(l => l.id === id))?.lessons.map(l => l.id) ?? [];
    const i = ids.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void run(`xep:${id}`, async () => {
      const r = await jfetch(`/api/courses/${courseId}/reorder`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ type, items: ids.map((x, k) => ({ id: x, order: k + 1 })) }) });
      return apiMsg(r);
    });
  }

  // ── Bài ─────────────────────────────────────────────────────────────────────
  async function addLesson(chapterId: string, title: string) {
    const t = title.trim();
    if (!t) { setNotice({ tone: "err", text: "Hãy đặt tên cho bài mới." }); return false; }
    return run(`bai:${chapterId}`, async () => {
      const r = await jfetch(`/api/chapters/${chapterId}/lessons`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: t, type: "record" }) });
      if (r.ok && r.json?.id && alive.current) setLessonId(r.json.id);
      return apiMsg(r);
    }, `Đã thêm bài “${t}”.`);
  }

  function patchLesson(id: string, patch: Record<string, unknown>, okText?: string) {
    return run(`sua:${id}`, async () => apiMsg(await jfetch(`/api/lessons/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) })), okText);
  }

  /** Nhân bản bài: đọc đủ các cột của bài gốc (chủ lớp thấy đủ link) rồi tạo bài mới ở cùng chương, như TabChuongBai. */
  async function duplicateLesson(chapterId: string, l: GtLesson) {
    return run(`nhan:${l.id}`, async () => {
      const src = await jfetch(`/api/lessons/${l.id}`);
      if (!src.ok || !src.json) return { ok: false, message: src.json?.error ?? "Chưa đọc được bài gốc để nhân bản." };
      const o = src.json;
      const r = await jfetch(`/api/chapters/${chapterId}/lessons`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        title: `${l.title} (bản sao)`, type: o.type ?? l.type, duration: o.duration ?? null, azotaDeadline: o.azotaDeadline ?? null, isLocked: !!o.isLocked, isFree: !!o.isFree,
        videoUrl: o.videoUrl ?? null, zoomUrl: o.zoomUrl ?? null, azotaUrl: o.azotaUrl ?? null, documents: typeof o.documents === "string" ? o.documents : "[]", adminNote: o.adminNote ?? null,
      }) });
      return apiMsg(r);
    }, `Đã nhân bản bài “${l.title}”.`);
  }

  function deleteLesson(id: string) {
    return run(`xoa-bai:${id}`, async () => apiMsg(await jfetch(`/api/lessons/${id}`, { method: "DELETE" })), "Đã xoá bài.");
  }

  return { load, snap, lessons, current, lessonId, setLessonId, busy, notice, setNotice, reload, addItem, removeItem, move, addLesson, patchLesson, duplicateLesson, deleteLesson };
}
