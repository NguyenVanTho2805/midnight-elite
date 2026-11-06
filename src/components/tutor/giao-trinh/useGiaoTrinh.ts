// BU-02-PHẲNG — trạng thái và thao tác của màn Giáo trình: danh sách PHẲNG, mỗi mục = một Lesson có kiểu + trạng thái (Nháp · Đã đăng · Ẩn).
// Dữ liệu lấy bằng G1 (GET .../giao-trinh → GiaoTrinhSnapshot mới); sau mỗi thao tác ghi tải lại G1 ở nền để danh sách luôn khớp máy chủ.
// Ghi trạng thái: G4 (một mục) / G5 (hàng loạt) — KHÔNG đi qua PUT /api/lessons/[id] (máy chủ bỏ qua khoá status ở đó). Nhóm: G6. Thêm/gỡ nội dung: G2/G3.
// Sắp xếp ▲▼ = moveEntry (lib thuần) → PATCH /api/courses/[id]/reorder (đã vá V6). Nhân bản = bản NHÁP (POST /api/chapters/[id]/lessons với status:"draft").
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { moveEntry, type GiaoTrinhSnapshot, type GtEntry } from "@/lib/giaoTrinh";
import type { LessonStatus } from "@/lib/lessonStatus";
import { jfetch } from "@/components/tutor/studentUi";

export type GtLoad =
  | { phase: "loading" }
  | { phase: "error"; status: number; message: string }
  | { phase: "ready"; snap: GiaoTrinhSnapshot };

/** Đích của nội dung mới: MỤC MỚI (không cần chương; chapterId chỉ khi muốn đặt vào một nhóm) hoặc gắn thêm vào mục có sẵn. */
export type GtTarget = { kind: "new"; chapterId?: string | null } | { kind: "entry"; lessonId: string };

export interface AddResult { ok: boolean; duplicate?: boolean; error?: string; moveTo?: string | null; lessonId?: string; key?: string; warning?: string | null; createdLesson?: boolean; status?: LessonStatus }

/** Bộ lọc danh sách: "all" hoặc đúng một trạng thái. */
export type GtFilter = "all" | LessonStatus;

/** Thông báo cấp trang; `forId` có giá trị = lỗi/thông tin thuộc một hàng, hiện ngay cạnh hàng đó (không chỉ ở đầu trang). */
export interface GtNotice { tone: "ok" | "err"; text: string; forId?: string }

const base = (courseId: string) => `/api/tutor/lop/${courseId}/giao-trinh`;
const JSON_HEADERS = { "content-type": "application/json" };

export function errorFor(status: number): string {
  if (status === 401) return "Phiên đăng nhập đã hết. Hãy đăng nhập lại.";
  if (status === 403 || status === 404) return "Bạn không có quyền với lớp này.";
  if (status === 0) return "Mất kết nối. Kiểm tra mạng rồi thử lại.";
  return "Chưa tải được giáo trình. Thử lại sau ít phút.";
}

export function useGiaoTrinh(courseId: string) {
  const [load, setLoad] = useState<GtLoad>({ phase: "loading" });
  const [filter, setFilter] = useState<GtFilter>("all");
  const [editId, setEditId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<GtNotice | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const fetchSnap = useCallback(async (): Promise<{ snap: GiaoTrinhSnapshot } | { status: number }> => {
    const r = await jfetch(base(courseId));
    if (r.ok && r.json && Array.isArray(r.json.entries)) return { snap: r.json as GiaoTrinhSnapshot };
    return { status: r.ok ? 500 : r.status };
  }, [courseId]);

  const reload = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoad({ phase: "loading" });
    const r = await fetchSnap();
    if (!alive.current) return;
    if ("snap" in r) {
      setLoad({ phase: "ready", snap: r.snap });
      // Mục đang sửa đã biến mất (xoá, hoặc đổi từ máy khác) ⇒ đóng ngăn kéo.
      setEditId(cur => (cur && r.snap.entries.some(e => e.id === cur) ? cur : null));
    } else if (!opts.silent) setLoad({ phase: "error", status: r.status, message: errorFor(r.status) });
  }, [fetchSnap]);

  // Tải lần đầu: đúng ý "đồng bộ với hệ thống ngoài" (API); setState trong reload() là trạng thái đang tải.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void reload(); }, [reload]);

  const snap = load.phase === "ready" ? load.snap : null;
  const entries: GtEntry[] = snap?.entries ?? [];
  const editing = entries.find(e => e.id === editId) ?? null;

  /** Chạy một thao tác ghi: khoá nút theo `key`, báo kết quả bằng chữ (lỗi ghi tại hàng nếu có `forId`), rồi tải lại ở nền. */
  async function run(key: string, fn: () => Promise<{ ok: boolean; message?: string }>, okText?: string, forId?: string) {
    if (busy) return false;
    setBusy(key); setNotice(null);
    const r = await fn();
    if (!alive.current) return r.ok;
    setBusy(null);
    if (r.ok) { if (okText) setNotice({ tone: "ok", text: okText, forId }); await reload({ silent: true }); }
    else setNotice({ tone: "err", text: r.message ?? "Chưa lưu được. Thử lại sau.", forId });
    return r.ok;
  }

  const apiMsg = (r: { ok: boolean; status: number; json: { error?: string } | null }) =>
    ({ ok: r.ok, message: r.json?.error ?? (r.status === 0 ? "Mất kết nối. Thử lại." : r.status === 403 ? "Bạn không có quyền với lớp này." : undefined) });

  // ── Nội dung của mục (G2 / G3) ─────────────────────────────────────────────
  async function addItem(target: GtTarget, url: string, name?: string, extra: { publish?: boolean } = {}): Promise<AddResult> {
    const body: Record<string, unknown> = { url, ...(name ? { name } : {}), ...(extra.publish ? { publish: true } : {}) };
    if (target.kind === "entry") body.lessonId = target.lessonId;
    else if (target.chapterId) body.chapterId = target.chapterId;
    const r = await jfetch(`${base(courseId)}/muc`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(body) });
    if (!r.ok) return { ok: false, error: r.json?.error ?? (r.status === 0 ? "Mất kết nối. Thử lại." : r.status === 403 ? "Bạn không có quyền với lớp hoặc tệp này." : "Chưa thêm được."), moveTo: r.json?.moveTo ?? null };
    const j = r.json ?? {};
    if (alive.current) void reload({ silent: true });
    return { ok: true, duplicate: !!j.duplicate, lessonId: j.lessonId ?? (target.kind === "entry" ? target.lessonId : undefined), key: j.item?.key, warning: j.warning ?? null, createdLesson: !!j.created?.lesson, status: j.status };
  }

  function removeItem(lessonId: string, key: string) {
    return run(`xoa:${key}`, async () => apiMsg(await jfetch(`${base(courseId)}/muc`, { method: "DELETE", headers: JSON_HEADERS, body: JSON.stringify({ lessonId, key }) })), "Đã gỡ nội dung khỏi mục.", lessonId);
  }

  // ── Trạng thái (G4 / G5) ───────────────────────────────────────────────────
  function setStatus(id: string, status: LessonStatus, okText: string) {
    return run(`tt:${id}`, async () => apiMsg(await jfetch(`${base(courseId)}/bai/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ status }) })), okText, id);
  }

  /** Đăng một lượt các mục Nháp đăng được (G5). Mục không đổi được máy chủ trả vào `skipped` ⇒ báo số mục bỏ qua, không làm hỏng cả lô. */
  async function publishMany(lessonIds: string[]) {
    if (!lessonIds.length || busy) return false;
    setBusy("tt:lo"); setNotice(null);
    const r = await jfetch(`${base(courseId)}/trang-thai`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ lessonIds, status: "published" }) });
    if (!alive.current) return r.ok;
    setBusy(null);
    if (!r.ok) { setNotice({ tone: "err", text: r.json?.error ?? (r.status === 0 ? "Mất kết nối. Thử lại." : "Chưa đăng được. Thử lại sau.") }); return false; }
    const changed = Array.isArray(r.json?.changed) ? r.json.changed.length : 0;
    const skipped = Array.isArray(r.json?.skipped) ? r.json.skipped.length : 0;
    setNotice({ tone: "ok", text: `Đã đăng ${changed} mục.${skipped ? ` ${skipped} mục chưa đăng được, bạn xem lại từng mục.` : ""}` });
    await reload({ silent: true });
    return true;
  }

  // ── Sắp xếp ▲▼ ─────────────────────────────────────────────────────────────
  function move(id: string, dir: -1 | 1) {
    const m = moveEntry(entries, id, dir);
    if (!m.ok) return Promise.resolve(false);
    return run(`xep:${id}`, async () => apiMsg(await jfetch(`/api/courses/${courseId}/reorder`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ type: m.type, items: m.items }) })), undefined, id);
  }

  // ── Nhóm (G6) ──────────────────────────────────────────────────────────────
  function createGroup(title: string) {
    const t = title.trim();
    if (!t) { setNotice({ tone: "err", text: "Hãy đặt tên cho chương." }); return Promise.resolve(false); }
    return run("nhom:moi", async () => apiMsg(await jfetch(`${base(courseId)}/chuong`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ title: t }) })), `Đã thêm chương “${t}”.`);
  }
  function renameGroup(id: string, title: string) {
    const t = title.trim();
    if (!t) { setNotice({ tone: "err", text: "Tên chương không được để trống." }); return Promise.resolve(false); }
    return run(`nhom:${id}`, async () => apiMsg(await jfetch(`${base(courseId)}/chuong/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ title: t }) })), "Đã đổi tên chương.");
  }
  /** "Bỏ nhóm": mục về "Chưa nhóm", chương trống bị xoá; không bao giờ xoá mục. */
  function ungroup(id: string) {
    return run(`nhom:${id}`, async () => apiMsg(await jfetch(`${base(courseId)}/chuong/${id}`, { method: "DELETE" })), "Đã bỏ nhóm. Các mục vẫn còn, nằm ở “Chưa nhóm”.");
  }
  function moveToGroup(id: string, groupId: string | null) {
    return run(`nhom-bai:${id}`, async () => apiMsg(await jfetch(`${base(courseId)}/bai/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ groupId }) })), groupId ? "Đã chuyển mục sang nhóm khác." : "Đã đưa mục về “Chưa nhóm”.", id);
  }

  // ── Mục: sửa / nhân bản / xoá (API cũ) ─────────────────────────────────────
  function patchLesson(id: string, patch: Record<string, unknown>, okText?: string) {
    return run(`sua:${id}`, async () => apiMsg(await jfetch(`/api/lessons/${id}`, { method: "PUT", headers: JSON_HEADERS, body: JSON.stringify(patch) })), okText, id);
  }

  /** Nhân bản: đọc đủ các cột của mục gốc (chủ lớp thấy đủ link) rồi tạo mục mới ở cùng chương với status:"draft" — bản sao KHÔNG tự đăng. */
  function duplicateEntry(e: GtEntry) {
    return run(`nhan:${e.id}`, async () => {
      const src = await jfetch(`/api/lessons/${e.id}`);
      if (!src.ok || !src.json) return { ok: false, message: src.json?.error ?? "Chưa đọc được mục gốc để nhân bản." };
      const o = src.json;
      const r = await jfetch(`/api/chapters/${e.chapterId}/lessons`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({
        title: `${e.title} (bản sao)`, type: o.type ?? "document", duration: o.duration ?? null, azotaDeadline: o.azotaDeadline ?? null, isLocked: !!o.isLocked, isFree: !!o.isFree,
        videoUrl: o.videoUrl ?? null, zoomUrl: o.zoomUrl ?? null, azotaUrl: o.azotaUrl ?? null, documents: typeof o.documents === "string" ? o.documents : "[]", adminNote: o.adminNote ?? null,
        status: "draft",
      }) });
      return apiMsg(r);
    }, `Đã nhân bản “${e.title}”. Bản sao ở dạng Nháp.`, e.id);
  }

  function deleteEntry(id: string) {
    return run(`xoa-muc:${id}`, async () => apiMsg(await jfetch(`/api/lessons/${id}`, { method: "DELETE" })), "Đã xoá mục.");
  }

  return {
    load, snap, entries, filter, setFilter, editId, setEditId, editing, busy, notice, setNotice, reload,
    addItem, removeItem, setStatus, publishMany, move, createGroup, renameGroup, ungroup, moveToGroup, patchLesson, duplicateEntry, deleteEntry,
  };
}
