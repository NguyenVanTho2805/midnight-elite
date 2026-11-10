// GS-LOP-GON — tách NGUYÊN VĂN từ giao-trinh/OTaiLen.tsx để ô tải của màn Giáo trình và ngăn "Thêm bài học" dùng chung một đường tải.
// Tải byte có thanh tiến trình, huỷ được (XHR vì fetch không có tiến trình tải lên).
export type SendResult = { ok: boolean; status: number; body: Record<string, unknown>; aborted?: boolean };

export function sendWithProgress(method: "PUT" | "POST", url: string, file: File, fields: Record<string, string> | undefined, onPct: (p: number) => void, setAbort: (f: () => void) => void): Promise<SendResult> {
  return new Promise(resolve => {
    const x = new XMLHttpRequest();
    x.open(method, url);
    if (method === "PUT") { x.withCredentials = true; x.setRequestHeader("Content-Type", file.type || "application/octet-stream"); }
    x.upload.onprogress = e => { if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100)); };
    x.onload = () => { let b: Record<string, unknown> = {}; try { b = JSON.parse(x.responseText); } catch { /* không phải JSON */ } resolve({ ok: x.status >= 200 && x.status < 300, status: x.status, body: b }); };
    x.onerror = () => resolve({ ok: false, status: 0, body: {} });
    x.onabort = () => resolve({ ok: false, status: 0, body: {}, aborted: true });
    setAbort(() => x.abort());
    if (method === "POST") { const fd = new FormData(); Object.entries(fields ?? {}).forEach(([k, v]) => fd.append(k, v)); fd.append("file", file); x.send(fd); }
    else x.send(file);
  });
}

export async function postJson(url: string, body: unknown): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  try {
    const r = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, json };
  } catch { return { ok: false, status: 0, json: {} }; }
}
