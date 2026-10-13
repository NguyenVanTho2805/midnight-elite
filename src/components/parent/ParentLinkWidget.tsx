// FE-162 — ParentLinkWidget: liên kết phụ huynh ↔ học viên có xác minh 2 chiều
// (ParentLink: pending | verified | revoked). Tách từ trang student/ho-so để dùng
// lại; API: GET/POST /api/parent-links, PATCH /api/parent-links/[id].
//
// variant="full"    — đầy đủ: yêu cầu gửi tới bạn (học viên xác nhận/từ chối),
//                     danh sách con (phụ huynh) và ô gửi yêu cầu theo email.
// variant="compact" — chỉ đọc, rút gọn: mỗi liên kết một dòng kèm trạng thái
//                     bằng chữ; không có ô nhập, không có nút thao tác. Dùng ở
//                     nơi chỉ cần xem trạng thái xác nhận.
"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export interface ParentLinkItem {
  id: string;
  status: string; // "pending" | "verified" | "revoked"
  createdAt: string;
  parent?: { id: string; name: string; email: string };
  student?: { id: string; name: string; email: string };
}

export type ParentLinkNotify = (message: string, type: "success" | "error") => void;

const STATUS: Record<string, { text: string; bg: string; color: string }> = {
  verified: { text: "Đã xác nhận", bg: "var(--kin-tt-nen-xong)", color: "var(--kin-tt-chu-xong)" },
  pending:  { text: "Chờ xác nhận", bg: "var(--kin-tt-nen-cho)", color: "var(--kin-tt-chu-cho)" },
  revoked:  { text: "Đã thu hồi",  bg: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)" },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.revoked;
  return (
    <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: s.bg, color: s.color }}>
      {s.text}
    </span>
  );
}

function PersonRow({ name, email, children }: { name?: string; email?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--kin-nen-bang)", border: "1px solid var(--kin-vien-thuong)" }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: "var(--kin-chu-phu)" }}>{name}</p>
        <p className="text-xs truncate" style={{ color: "var(--kin-chu-mo)" }}>{email}</p>
      </div>
      {children}
    </div>
  );
}

export default function ParentLinkWidget({
  variant = "full",
  onNotify,
}: {
  variant?: "full" | "compact";
  onNotify?: ParentLinkNotify;
}) {
  const [asStudent, setAsStudent] = useState<ParentLinkItem[]>([]);
  const [asParent, setAsParent] = useState<ParentLinkItem[]>([]);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  // Giữ callback mới nhất mà không buộc effect/handler phải phụ thuộc vào nó
  // (cha thường truyền hàm mới ở mỗi lần render).
  const notifyRef = useRef(onNotify);
  useEffect(() => { notifyRef.current = onNotify; }, [onNotify]);
  const notify = useCallback<ParentLinkNotify>((m, t) => notifyRef.current?.(m, t), []);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/parent-links");
      const d: { asParent?: ParentLinkItem[]; asStudent?: ParentLinkItem[] } = r.ok ? await r.json() : {};
      setAsParent(d.asParent ?? []);
      setAsStudent(d.asStudent ?? []);
    } catch { /* giữ danh sách cũ khi mất mạng */ }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await Promise.resolve(); // tách khỏi thân effect (react-hooks/set-state-in-effect)
      if (alive) await load();
    })();
    return () => { alive = false; };
  }, [load]);

  async function request() {
    if (!email.trim()) { notify("Nhập email học viên cần liên kết", "error"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/parent-links", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentEmail: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error ?? "Gửi yêu cầu thất bại", "error"); return; }
      notify("Đã gửi yêu cầu liên kết, chờ học viên xác nhận", "success");
      setEmail("");
      await load();
    } catch {
      notify("Lỗi kết nối", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function respond(id: string, action: "verify" | "revoke") {
    setActingId(id);
    try {
      const res = await fetch(`/api/parent-links/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) { notify(data.error ?? "Thao tác thất bại", "error"); return; }
      notify(action === "verify" ? "Đã xác nhận liên kết phụ huynh" : "Đã thu hồi liên kết", "success");
      await load();
    } catch {
      notify("Lỗi kết nối", "error");
    } finally {
      setActingId(null);
    }
  }

  if (variant === "compact") {
    const rows = [
      ...asStudent.map(l => ({ id: l.id, name: l.parent?.name, email: l.parent?.email, status: l.status, role: "Phụ huynh" })),
      ...asParent.map(l => ({ id: l.id, name: l.student?.name, email: l.student?.email, status: l.status, role: "Con" })),
    ];
    return (
      <div aria-label="Liên kết phụ huynh">
        {rows.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>Chưa có liên kết phụ huynh nào.</p>
        ) : (
          <div className="space-y-2">
            {rows.map(r => (
              <PersonRow key={r.id} name={r.name} email={r.email}>
                <span className="text-xs flex-shrink-0" style={{ color: "var(--kin-chu-mo)" }}>{r.role}</span>
                <StatusPill status={r.status} />
              </PersonRow>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl p-5" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
      <h2 className="text-sm font-bold mb-1" style={{ color: "var(--kin-chu-phu)" }}>Liên kết phụ huynh</h2>
      <p className="text-xs mb-4" style={{ color: "var(--kin-chu-mo)" }}>
        Khác với thông tin phụ huynh ở trên (chỉ là dữ liệu tự khai), mục này xác minh 2 chiều giữa 2 tài khoản thật.
      </p>

      {asStudent.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--kin-chu-mo)" }}>Yêu cầu gửi tới bạn (với vai trò học viên)</p>
          <div className="space-y-2">
            {asStudent.map(link => (
              <PersonRow key={link.id} name={link.parent?.name} email={link.parent?.email}>
                {link.status === "pending" ? (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => respond(link.id, "verify")} disabled={actingId === link.id}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white disabled:opacity-50"
                      style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
                      Xác nhận
                    </button>
                    <button onClick={() => respond(link.id, "revoke")} disabled={actingId === link.id}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
                      style={{ background: "var(--kin-tt-nen-loi)", color: "var(--kin-tt-chu-loi)", border: "1px solid var(--kin-tt-vien-loi)", borderRadius: "8px" }}>
                      Từ chối
                    </button>
                  </div>
                ) : (
                  <StatusPill status={link.status} />
                )}
              </PersonRow>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4">
        <p className="text-xs font-semibold mb-2" style={{ color: "var(--kin-chu-mo)" }}>Con của bạn (với vai trò phụ huynh)</p>
        {asParent.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--kin-vien-o-nhap)" }}>Chưa gửi yêu cầu liên kết nào.</p>
        ) : (
          <div className="space-y-2">
            {asParent.map(link => (
              <PersonRow key={link.id} name={link.student?.name} email={link.student?.email}>
                <StatusPill status={link.status} />
              </PersonRow>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <input type="email" value={email} onChange={e => setEmail(e.target.value)}
          aria-label="Email tài khoản của con" placeholder="Email tài khoản của con"
          className="notion-input flex-1 text-sm" style={{ color: "var(--kin-chu-chinh)" }} />
        <button onClick={request} disabled={submitting}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 flex-shrink-0"
          style={{ background: "var(--kin-nhan-nen)", borderRadius: "8px" }}>
          {submitting ? "Đang gửi..." : "Gửi yêu cầu"}
        </button>
      </div>
    </div>
  );
}
