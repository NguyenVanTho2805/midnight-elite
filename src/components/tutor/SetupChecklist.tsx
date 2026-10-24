// HV-10 — banner "Bắt đầu với KiN" + checklist 8 bước ở Hộp việc. Mỗi bước tự tick theo dữ liệu THẬT (buildSetupChecklist), không có ô tick tay.
// Đóng được (lưu ở trình duyệt này). Khi cả 8 bước xong thì không hiện nữa. Trạng thái luôn có chữ ("Đã xong" / "Chưa làm"), không chỉ màu.
"use client";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { SetupChecklist as Checklist } from "@/lib/tutorOverview";
import { KinPanel } from "@/components/kin/Panel";
import { KinStatus } from "@/components/kin/Status";
import { KinButton } from "@/components/kin/Button";

export const SETUP_DISMISSED_KEY = "kin:thiet-lap-da-dong";
const EVT = "kin-setup-dismissed";

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb); window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); };
}
const read = () => { try { return window.localStorage.getItem(SETUP_DISMISSED_KEY) === "1"; } catch { return false; } };

export default function SetupChecklist({ setup }: { setup: Checklist }) {
  // Máy chủ coi như đã đóng để không nháy rồi biến mất; sau khi nối vào trình duyệt mới đọc lựa chọn thật.
  const dismissed = useSyncExternalStore(subscribe, read, () => true);
  if (setup.allDone || dismissed) return null;
  const next = setup.steps.find(s => !s.done);
  const close = () => { try { window.localStorage.setItem(SETUP_DISMISSED_KEY, "1"); } catch { /* không lưu được thì chỉ đóng ở lần này */ } window.dispatchEvent(new Event(EVT)); };

  return (
    <KinPanel variant="nhan" as="section" aria-labelledby="hv-setup" data-setup-checklist className="mb-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="hv-setup" className="text-[length:var(--kin-co-tieu-de)] leading-6 font-medium text-[var(--kin-chu-chinh)]">Bắt đầu với KiN</h2>
          <p className="mt-1 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
            Đã xong {setup.doneCount}/{setup.total} bước. Mỗi bước tự đánh dấu khi dữ liệu của cô đã có trong KiN.
          </p>
        </div>
        <KinButton variant="ghost" onClick={close} aria-label="Đóng hướng dẫn bắt đầu" data-setup-close>Đóng</KinButton>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-[var(--kin-nen-bang)]" role="progressbar" aria-valuemin={0} aria-valuemax={setup.total} aria-valuenow={setup.doneCount} aria-label="Tiến độ thiết lập">
        <div className="h-1.5 rounded-full bg-[var(--kin-nhan-nen)]" style={{ width: `${Math.round(setup.doneCount / setup.total * 100)}%` }} />
      </div>
      <ol className="mt-2" aria-label="Các bước thiết lập">
        {setup.steps.map((s, i) => (
          <li key={s.key} data-setup-step={s.key} data-done={s.done ? "" : undefined}>
            <Link href={s.href} className="flex items-center gap-3 min-h-11 py-2 border-b border-[var(--kin-vien-nhat)] last:border-b-0 hover:bg-[var(--kin-nen-re-chuot)] transition-colors">
              <span className="w-6 text-[length:var(--kin-co-goc)] tabular-nums text-[var(--kin-chu-mo)]">{i + 1}.</span>
              <span className="flex-1 min-w-0">
                <span className={`block text-[length:var(--kin-co-body)] leading-5 text-[var(--kin-chu-chinh)] ${s.done ? "line-through decoration-[var(--kin-chu-mo)]" : ""}`}>{s.label}</span>
                {!s.done && <span className="block text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{s.hint}</span>}
              </span>
              <KinStatus tone={s.done ? "xong" : "mo"}>{s.done ? "Đã xong" : "Chưa làm"}</KinStatus>
            </Link>
          </li>
        ))}
      </ol>
      {next && <p className="mt-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Bước tiếp theo: {next.label.toLowerCase()}.</p>}
    </KinPanel>
  );
}
