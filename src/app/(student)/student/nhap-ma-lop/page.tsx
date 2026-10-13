// Vào lớp bằng mã mời (Figma 32:54, FE-125/126). Học sinh PHẢI thấy tên gia sư + mức học phí trước khi bấm "Vào lớp này":
// gõ nhầm một ký tự là vào nhầm lớp người khác, và lúc đó mới cãi nhau tiền.
//
// Flow:
//   1. Gõ mã (8 ký tự, ép in hoa) hoặc mở link /student/nhap-ma-lop?code=ABCD2345 (điền sẵn).
//   2. Sau 400ms debounce gọi GET /api/invites/by-code/<code> → xem trước: lớp, gia sư, lịch, học phí/buổi, số buổi đã học.
//   3. "Vào lớp này" → POST /api/invites/<code>/redeem → /student/hoc-tap?course=<id>.
//      "Không phải lớp của tôi" → xoá mã, quay lại ô nhập (không gọi máy chủ).
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui";
import { KinButton } from "@/components/kin";
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

function ClassPreview({ p }: { p: InvitePreviewOk }) {
  const closed = p.course.classStatus !== "open";
  return (
    <section aria-label="Xem trước lớp" className="rounded-[var(--kin-bo-the)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-bang)] p-[15px] flex flex-col gap-3">
      <p className="text-[length:var(--kin-co-caption)] text-[var(--kin-chu-mo)]">Bạn sắp vào lớp</p>
      <h2 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-body)] text-[var(--kin-chu-chinh)] leading-tight">{p.course.name}</h2>
      <dl className="flex flex-col gap-2.5">
        {p.course.owner && <Row label="Gia sư">{p.course.owner.name}</Row>}
        <Row label="Lịch">{scheduleLabel(p.schedule ?? [])}</Row>
        {p.tuition && <Row label="Học phí">{tuitionLabel(p.tuition)}</Row>}
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

export default function NhapMaLopPage() {
  const router = useRouter();
  const toast  = useToast();
  const [input, setInput]         = useState("");
  const [preview, setPreview]     = useState<InvitePreview | null>(null);
  const [checking, setChecking]   = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  // Đọc ?code= ở effect (không ở useState) để HTML server và lần render đầu của client khớp nhau.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("code");
    if (c) Promise.resolve().then(() => setInput(normalizeInviteCode(c)));
  }, []);

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

  const ok = !!preview && preview.status === "ok";
  const okPreview = ok ? (preview as InvitePreviewOk) : null;

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

          {!checking && okPreview && <ClassPreview p={okPreview} />}

          {!checking && okPreview && !okPreview.alreadyEnrolled && (
            <div className="rounded-[var(--kin-bo-lg)] bg-[var(--kin-nen-nhan)] px-3.5 py-3">
              <p className="text-[length:var(--kin-co-small)] font-semibold text-[var(--kin-chu-chinh)]">Vào lớp là đồng ý ba điều</p>
              <p className="mt-1 text-[length:var(--kin-co-caption)] leading-[1.45] text-[var(--kin-chu-mo-tren-nen-nhan)]">
                Gia sư thấy điểm danh và điểm bài của bạn · phụ huynh gắn với bạn cũng thấy · học phí tính theo tháng, đơn giá giảm khi học nhiều môn.
                KiN không giữ tiền, gia sư thu trực tiếp.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <KinButton block size="lg" onClick={redeem} disabled={!ok || redeeming || (ok && okPreview!.alreadyEnrolled)}>
              {redeeming ? "Đang vào lớp…" : ok && okPreview!.alreadyEnrolled ? "Bạn đã trong lớp" : "Vào lớp này"}
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
            Đừng cho bấm “vào lớp” khi chưa thấy tên gia sư và mức học phí. Học sinh gõ nhầm một ký tự là vào nhầm lớp người khác, và lúc đó mới cãi nhau tiền.
          </p>
        </footer>
      </div>
    </div>
  );
}
