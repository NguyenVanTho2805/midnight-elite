"use client";
import { useState } from "react";
import { KinButton, KinConfirm, KinStatus, KinTabs, KinToast, type KinButtonVariant, type StatusTone, type ToastTone } from "@/components/kin";
import { useToast } from "@/components/ui";

const VARIANTS: { v: KinButtonVariant; label: string }[] = [
  { v: "primary", label: "Chính" }, { v: "secondary", label: "Thường" }, { v: "ghost", label: "Ghost" },
  { v: "danger", label: "Nguy hiểm" }, { v: "danger-solid", label: "Nguy hiểm (đặc)" },
];
const STATUSES: { tone: StatusTone; label: string }[] = [
  { tone: "xong", label: "Đã chấm" }, { tone: "cho", label: "Cần nhắc" }, { tone: "loi", label: "Cần xử lý" }, { tone: "mo", label: "Chờ 1 ngày" },
];
const TOASTS: { tone: ToastTone; title: string; detail: string }[] = [
  { tone: "xong", title: "Đã lưu điểm danh buổi 24/09.", detail: "4 buổi được tính tiền · 600.000đ" },
  { tone: "cho", title: "Đã gửi cho 5 phụ huynh.", detail: "Buổi tự chốt sau 72 giờ nếu không ai phản hồi." },
  { tone: "loi", title: "Mất kết nối mạng.", detail: "Bài làm đang được lưu tạm trên máy. Vui lòng tiếp tục làm bài." },
  { tone: "tin", title: "Gia sư đã đổi mức học phí.", detail: "Chỉ áp dụng cho buổi từ nay về sau." },
];

export default function MauClient() {
  const toast = useToast();
  const [tab, setTab] = useState<"hs" | "ph" | "gs">("hs");
  const [ask, setAsk] = useState<null | "thuong" | "nguy-hiem">(null);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const note = (s: string) => setLog(l => [...l, s]);

  return (
    <div data-vung="sang" className="min-h-screen bg-[var(--kin-nen-bang)] text-[var(--kin-chu-chinh)] px-4 py-8">
      <div className="mx-auto max-w-3xl flex flex-col gap-10">
        <header>
          <h1 className="kin-chu-tieu-de font-semibold text-[length:var(--kin-co-h2)]">Bộ component KiN</h1>
          <p className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Đối chiếu với Figma: Nút, Thẻ trạng thái, Tab, Toast, Hộp xác nhận. Chỉ có ở bản dev.</p>
        </header>

        <section aria-labelledby="m-nut" className="flex flex-col gap-3">
          <h2 id="m-nut" className="font-semibold">Nút</h2>
          <div className="flex flex-wrap gap-3" data-mau="nut">
            {VARIANTS.map(({ v, label }) => <KinButton key={v} variant={v}>{label}</KinButton>)}
          </div>
          <div className="flex flex-wrap gap-3" data-mau="nut-tat">
            {VARIANTS.map(({ v, label }) => <KinButton key={v} variant={v} disabled>{label} (tắt)</KinButton>)}
          </div>
          <div className="flex flex-wrap gap-3" data-mau="nut-cho">
            <KinButton loading loadingLabel="Đang lưu…">Lưu</KinButton>
            <KinButton variant="secondary" loading>Không nhãn chờ</KinButton>
          </div>
        </section>

        <section aria-labelledby="m-tt" className="flex flex-col gap-3">
          <h2 id="m-tt" className="font-semibold">Thẻ trạng thái</h2>
          <div className="flex flex-wrap gap-6" data-mau="tt">
            {STATUSES.map(s => <KinStatus key={s.tone} tone={s.tone}>{s.label}</KinStatus>)}
          </div>
        </section>

        <section aria-labelledby="m-tab" className="flex flex-col gap-3">
          <h2 id="m-tab" className="font-semibold">Tab</h2>
          <div data-mau="tab">
            <KinTabs label="Mẫu tab" value={tab} onChange={setTab}
              tabs={[{ key: "hs", label: "Học sinh" }, { key: "ph", label: "Phụ huynh" }, { key: "gs", label: "Gia sư" }]} />
            <p data-mau="tab-dang-mo" className="pt-3 text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">Đang mở: {tab}</p>
          </div>
        </section>

        <section aria-labelledby="m-toast" className="flex flex-col gap-3">
          <h2 id="m-toast" className="font-semibold">Toast</h2>
          <div className="flex flex-col gap-3" data-mau="toast">
            {TOASTS.map(t => <KinToast key={t.tone} tone={t.tone} title={t.title} detail={t.detail} />)}
          </div>
          <div className="flex flex-wrap gap-3" data-mau="toast-bam">
            <KinButton variant="secondary" onClick={() => toast.ok("Đã lưu điểm danh.", { detail: "4 buổi được tính tiền" })}>Bật toast xong</KinButton>
            <KinButton variant="secondary" onClick={() => toast.warn("Cần nhắc phụ huynh.")}>Bật toast chờ</KinButton>
            <KinButton variant="secondary" onClick={() => toast.err("Mất kết nối mạng.")}>Bật toast lỗi</KinButton>
            <KinButton variant="secondary" onClick={() => toast.info("Gia sư đã đổi mức học phí.", { timeout: 60000 })}>Bật toast tin</KinButton>
          </div>
        </section>

        <section aria-labelledby="m-hop" className="flex flex-col gap-3">
          <h2 id="m-hop" className="font-semibold">Hộp xác nhận</h2>
          <div className="flex flex-wrap gap-3" data-mau="hop">
            <KinButton variant="secondary" onClick={() => setAsk("thuong")}>Mở hộp thường</KinButton>
            <KinButton variant="danger" onClick={() => setAsk("nguy-hiem")}>Mở hộp nguy hiểm</KinButton>
          </div>
          <ul data-mau="nhat-ky" aria-label="Nhật ký" className="text-[length:var(--kin-co-small)] text-[var(--kin-chu-mo)]">
            {log.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </section>
      </div>

      <KinConfirm
        open={ask === "thuong"} title="Gửi xác nhận cho 5 phụ huynh?"
        message="Mỗi phụ huynh nhận một đường dẫn riêng để xem buổi học của con. Buổi sẽ tự chốt sau 72 giờ nếu không ai phản hồi."
        cancelLabel="Để sau" confirmLabel="Gửi xác nhận"
        onCancel={() => { note("huỷ thường"); setAsk(null); }} onConfirm={() => { note("xác nhận thường"); setAsk(null); }}
      />
      <KinConfirm
        open={ask === "nguy-hiem"} tone="nguy-hiem" title="Thu hồi quyền vào lớp của Lê Hải Đăng?"
        message="Bạn ấy sẽ không xem được bài và bản ghi của lớp này nữa. 5 buổi đã điểm danh vẫn giữ nguyên, học phí đã tính không thay đổi."
        cancelLabel="Huỷ" confirmLabel="Thu hồi quyền" loading={loading} loadingLabel="Đang thu hồi…"
        onCancel={() => { note("huỷ nguy hiểm"); setAsk(null); }}
        onConfirm={() => { note("xác nhận nguy hiểm"); setLoading(true); setTimeout(() => { setLoading(false); setAsk(null); }, 600); }}
      />
    </div>
  );
}
