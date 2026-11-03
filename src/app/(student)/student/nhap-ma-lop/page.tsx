// Vào lớp bằng mã mời (Figma 32:54, FE-125/126). Học sinh PHẢI thấy tên gia sư + mức học phí trước khi bấm "Vào lớp này":
// gõ nhầm một ký tự là vào nhầm lớp người khác, và lúc đó mới cãi nhau tiền.
//
// Flow:
//   1. Gõ mã (8 ký tự, ép in hoa) hoặc mở link /student/nhap-ma-lop?code=ABCD2345 (điền sẵn).
//   2. Sau 400ms debounce gọi GET /api/invites/by-code/<code> → xem trước: lớp, gia sư, lịch, học phí/buổi, số buổi đã học.
//   3. "Vào lớp này" → POST /api/invites/<code>/redeem → /student/hoc-tap?course=<id>.
//      "Không phải lớp của tôi" → xoá mã, quay lại ô nhập (không gọi máy chủ).
// BU-01: lớp "Cô duyệt" (joinPolicy approve) → nút thành "Gửi yêu cầu vào lớp"; gửi xong là màn "chờ gia sư duyệt" (mã riêng gắn tài khoản + Huỷ yêu cầu, biểu mẫu POST 303);
// bị từ chối thì hiện lời nhắn + "Gửi lại" (sau 24 giờ); lớp miễn phí thì ẩn dòng học phí. Mã gắn tài khoản khác: máy chủ trả "invalid", InviteCodeInput đã hiện đúng câu đó.
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui";
import { KinButton, KinCallout } from "@/components/kin";
import { KinCopyButton } from "@/components/kin/CopyButton";
import { REAPPLY_COOLDOWN_HOURS } from "@/lib/joinRequest";
import InviteCodeInput, { normalizeInviteCode, type InvitePreview, type InvitePreviewOk } from "@/components/student/InviteCodeInput";
import { scheduleLabel, taughtLabel, tuitionLabel } from "@/lib/invitePreview";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[70px_1fr] gap-x-2.5 text-[length:var(--kin-co-small)] leading-[1.4]">
      <dt className="text-[var(--kin-chu-mo)]">{label}</dt>
      <dd className="font-medium text-[var(--kin-chu-chinh)]">{children}</dd>
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const dm = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
const dmHm = (d: Date) => `${dm(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

function ClassPreview({ p }: { p: InvitePreviewOk }) {
  const closed = p.course.classStatus !== "open";
  const free = p.course.isFree === true;
  return (
    <section aria-label="Xem trước lớp" className="rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] p-[15px] flex flex-col gap-3">
      <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">{p.joinPolicy === "approve" ? "Bạn sắp xin vào lớp" : "Bạn sắp vào lớp"}</p>
      <h2 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)] leading-tight">{p.course.name}</h2>
      <dl className="flex flex-col gap-2.5">
        {p.course.owner && <Row label="Gia sư">{p.course.owner.name}</Row>}
        <Row label="Lịch">{scheduleLabel(p.schedule ?? [])}</Row>
        {free ? <Row label="Học phí">Miễn phí</Row> : p.tuition && <Row label="Học phí">{tuitionLabel(p.tuition)}</Row>}
        <Row label="Đã học">{taughtLabel(p.taught ?? 0)}</Row>
      </dl>
      {(closed || p.maxUses !== null || p.expiresAt) && (
        <p className="text-[length:var(--kin-co-caption)] leading-[1.4]" style={{ color: closed ? "var(--kin-tt-chu-cho)" : "var(--kin-chu-mo)" }}>
          {closed && "Lớp đang đóng — không nhận thêm. "}
          {p.maxUses !== null && <>Còn {Math.max(0, p.maxUses - p.usedCount)} / {p.maxUses} lượt dùng. </>}
          {p.expiresAt && <>Mã hết hạn: {new Date(p.expiresAt).toLocaleDateString("vi-VN")}.</>}
        </p>
      )}
      {p.alreadyEnrolled && <p className="text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-tt-chu-xong)]">Bạn đã trong lớp này rồi.</p>}
    </section>
  );
}

/** Màn "đã gửi yêu cầu": nội dung lớp chưa mở cho tới khi gia sư duyệt. Huỷ = biểu mẫu POST (máy chủ 303 về ?huy=). */
function WaitingCard({ p, requestId, sentOn, personalCode }: { p: InvitePreviewOk; requestId: string; sentOn: string; personalCode: string | null | "loi" }) {
  return (
    <section aria-label="Đã gửi yêu cầu vào lớp" data-join-waiting className="rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] p-[15px] flex flex-col gap-3">
      <p role="status" className="font-semibold text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)]">Đã gửi yêu cầu — chờ gia sư duyệt</p>
      <dl className="flex flex-col gap-2.5">
        <Row label="Lớp">{p.course.name}</Row>
        {p.course.owner && <Row label="Gia sư">{p.course.owner.name}</Row>}
        <Row label="Gửi ngày">{sentOn}</Row>
      </dl>
      <p className="text-[length:var(--kin-co-small)] leading-[1.4] text-[var(--kin-chu-mo)]">Bạn chưa xem được nội dung lớp cho tới khi gia sư duyệt. Khi được duyệt, lớp sẽ hiện ở Lớp của tôi.</p>
      {personalCode && personalCode !== "loi" ? (
        <div className="rounded-[var(--kin-bo-lg)] bg-[var(--kin-nen-nhan)] px-3.5 py-3">
          <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo-tren-nen-nhan)]">Mã riêng của bạn</p>
          <p className="mt-1 flex items-center gap-2 flex-wrap">
            <b data-personal-code className="font-mono text-[length:var(--kin-co-body)] tracking-[0.12em] text-[var(--kin-chu-chinh)]">{personalCode}</b>
            <KinCopyButton text={personalCode} label="Chép mã riêng" appearance="icon" />
          </p>
          <p className="mt-1 text-[length:var(--kin-co-caption)] leading-[1.45] text-[var(--kin-chu-mo-tren-nen-nhan)]">Mã này chỉ dùng được ở tài khoản của bạn.</p>
        </div>
      ) : personalCode === "loi" ? (
        <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">Chưa tải được mã riêng của bạn. Yêu cầu vẫn đã được gửi.</p>
      ) : null}
      <form method="post" action={`/api/invites/my-requests/${encodeURIComponent(requestId)}/cancel`}>
        <KinButton type="submit" variant="secondary" block size="lg">Huỷ yêu cầu</KinButton>
      </form>
    </section>
  );
}

export default function NhapMaLopPage() {
  const router = useRouter();
  const toast  = useToast();
  const [input, setInput]         = useState("");
  const [preview, setPreview]     = useState<InvitePreview | null>(null);
  const [checking, setChecking]   = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  // BU-01: yêu cầu vừa gửi trong phiên này, kết quả huỷ (?huy=) và mã riêng (lấy từ /api/invites/my-requests).
  const [sent, setSent]           = useState<{ requestId: string; courseId: string; at: Date } | null>(null);
  const [personal, setPersonal]   = useState<string | null | "loi">(null);
  const [cancelMsg, setCancelMsg] = useState<string | null>(null);
  const [now]                     = useState(() => Date.now());

  // Đọc ?code= ở effect (không ở useState) để HTML server và lần render đầu của client khớp nhau.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("code");
    if (c) Promise.resolve().then(() => setInput(normalizeInviteCode(c)));
    const h = new URLSearchParams(window.location.search).get("huy");
    if (h === "ok") Promise.resolve().then(() => setCancelMsg("Đã huỷ yêu cầu vào lớp."));
    else if (h === "da-xu-ly") Promise.resolve().then(() => setCancelMsg("Yêu cầu này đã được xử lý rồi, không huỷ được nữa."));
  }, []);

  const ok = !!preview && preview.status === "ok";
  const okPreview = ok ? (preview as InvitePreviewOk) : null;
  const waiting = sent && okPreview && sent.courseId === okPreview.course.id
    ? { requestId: sent.requestId, at: sent.at }
    : okPreview?.pendingRequest ? { requestId: okPreview.pendingRequest.id, at: new Date(okPreview.pendingRequest.createdAt) } : null;
  const waitingId = waiting?.requestId ?? null;

  // Mã riêng của em cho yêu cầu đang chờ (gắn tài khoản; người khác dùng không được).
  useEffect(() => {
    if (!waitingId) return;
    let live = true;
    fetch("/api/invites/my-requests", { credentials: "same-origin", cache: "no-store" })
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { items?: { id: string; personalCode?: string | null }[] }) => { if (live) setPersonal(d.items?.find(i => i.id === waitingId)?.personalCode ?? null); })
      .catch(() => { if (live) setPersonal("loi"); });
    return () => { live = false; };
  }, [waitingId]);

  async function redeem() {
    if (!preview || preview.status !== "ok" || preview.alreadyEnrolled) return;
    setRedeeming(true);
    try {
      const r = await fetch(`/api/invites/${encodeURIComponent(preview.code)}/redeem`, {
        method: "POST", credentials: "same-origin",
      });
      const d = await r.json();
      if (!r.ok) {
        toast.err(d.error ?? "Không tham gia được lớp");
        return;
      }
      if (d.pending) {   // BU-01: lớp "Cô duyệt" — chưa vào lớp, chờ gia sư
        setSent({ requestId: String(d.requestId), courseId: preview.course.id, at: new Date() });
        toast.ok("Đã gửi yêu cầu vào lớp.");
        return;
      }
      toast.ok("Đã vào lớp!");
      router.push(`/student/hoc-tap?course=${encodeURIComponent(preview.course.id)}`);
    } catch {
      toast.err("Mạng lỗi, thử lại sau.");
    } finally {
      setRedeeming(false);
    }
  }

  function notMine() {
    setInput("");
    setPreview(null);
    document.getElementById("ma-moi-lop")?.focus();
  }

  const approve = okPreview?.joinPolicy === "approve";
  const free = okPreview?.course.isFree === true;
  const decidedAt = okPreview?.rejection ? new Date(okPreview.rejection.decidedAt) : null;
  const retryAt = decidedAt ? new Date(decidedAt.getTime() + REAPPLY_COOLDOWN_HOURS * 3_600_000) : null;
  const cooling = !!retryAt && retryAt.getTime() > now;
  const showRejected = !!okPreview?.rejection && !waiting && !okPreview.alreadyEnrolled;
  const ctaLabel = redeeming ? (approve ? "Đang gửi…" : "Đang vào lớp…")
    : ok && okPreview!.alreadyEnrolled ? "Bạn đã trong lớp"
    : approve ? (showRejected ? "Gửi lại yêu cầu" : "Gửi yêu cầu vào lớp") : "Vào lớp này";

  return (
    <div className="mx-auto max-w-[420px] py-4 md:py-10">
      <div className="kin-chu-than rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] overflow-hidden">
        <header className="px-5 pt-7 pb-4">
          <h1 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h4)] tracking-[-0.015em] text-[var(--kin-chu-chinh)]">Vào lớp</h1>
          <p className="mt-1.5 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Nhập mã gia sư đưa cho bạn</p>
        </header>

        <div className="px-5 pb-5 flex flex-col gap-4">
          <InviteCodeInput
            autoFocus
            value={input}
            onChange={setInput}
            onResult={(p, c) => { setPreview(p); setChecking(c); }}
          />

          {cancelMsg && !okPreview && <div role="status" data-huy-msg><KinCallout title={cancelMsg} /></div>}

          {!checking && okPreview && !waiting && <ClassPreview p={okPreview} />}

          {!checking && okPreview && waiting && (
            <WaitingCard p={okPreview} requestId={waiting.requestId} sentOn={dm(waiting.at)} personalCode={personal} />
          )}

          {!checking && showRejected && okPreview?.rejection && (
            <div role="status" data-join-rejected className="flex flex-col gap-2">
              <KinCallout title="Gia sư chưa duyệt yêu cầu">
                {okPreview.rejection.note ? <>Lời nhắn của gia sư: “{okPreview.rejection.note}”</> : "Gia sư không để lại lời nhắn."}
              </KinCallout>
              {cooling && retryAt && <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Có thể gửi lại sau {dmHm(retryAt)}.</p>}
            </div>
          )}

          {!checking && okPreview && !okPreview.alreadyEnrolled && !waiting && (
            <div className="rounded-[var(--kin-bo-lg)] bg-[var(--kin-nen-nhan)] px-3.5 py-3">
              <p className="text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)]">{approve ? "Gửi yêu cầu" : "Vào lớp"} là đồng ý {free ? "hai" : "ba"} điều</p>
              <p className="mt-1 text-[length:var(--kin-co-caption)] leading-[1.45] text-[var(--kin-chu-mo-tren-nen-nhan)]">
                Gia sư thấy điểm danh và điểm bài của bạn · phụ huynh gắn với bạn cũng thấy
                {free ? "." : <> · học phí tính theo tháng, đơn giá giảm khi học nhiều môn. KiN không giữ tiền, gia sư thu trực tiếp.</>}
              </p>
            </div>
          )}

          <div className={waiting ? "hidden" : "flex flex-col gap-3"}>
            <KinButton block size="lg" onClick={redeem} disabled={!ok || redeeming || (ok && okPreview!.alreadyEnrolled) || (showRejected && cooling)}>
              {ctaLabel}
            </KinButton>
            {ok && okPreview!.alreadyEnrolled ? (
              <Link href={`/student/hoc-tap?course=${encodeURIComponent(okPreview!.course.id)}`}
                className="block text-center text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-nhan-link)] min-h-11 leading-[44px]">
                Vào lớp ngay →
              </Link>
            ) : ok ? (
              <KinButton variant="secondary" block size="lg" onClick={notMine}>Không phải lớp của tôi</KinButton>
            ) : null}
          </div>
        </div>

        <footer className="border-t border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] px-5 py-4">
          <p className="text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)]">Xem trước rồi mới vào</p>
          <p className="mt-1 text-[length:var(--kin-co-caption)] leading-[1.45] text-[var(--kin-chu-mo)]">
            {free
              ? "Đừng bấm khi chưa thấy tên gia sư và tên lớp. Gõ nhầm một ký tự là vào nhầm lớp người khác."
              : "Đừng cho bấm “vào lớp” khi chưa thấy tên gia sư và mức học phí. Học sinh gõ nhầm một ký tự là vào nhầm lớp người khác, và lúc đó mới cãi nhau tiền."}
          </p>
        </footer>
      </div>
    </div>
  );
}
