// DG-HOC-ONLINE (14/11/2026) — mục "Học online" trong Cài đặt của lớp gia sư (/lop-cua-toi/quan-lop/[id]?tab=cai-dat&muc=hoc-online).
// Form POST + 303 tới /api/tutor/lop/[id]/hoc-online: link Meet chung của lớp (Course.classJoinUrl) + gửi email nhắc học sinh trước giờ học (Course.reminderLeadMinutes).
// Giá trị đọc từ máy chủ (defaultValue) nên F5 sau khi lưu vẫn thấy đúng. Thứ tự link khi học sinh bấm "Mở link học online": riêng buổi > khung giờ > chung lớp.
"use client";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinSelect } from "@/components/kin/KinSelect";
import { kinButtonClass } from "@/components/kin/buttonClass";
import { KinStatus } from "@/components/kin/Status";
import { LEAD_LABEL, LEAD_OPTIONS, leadOf } from "@/lib/lessonReminder";

const FLASH = {
  ok: { tone: "xong", text: "Đã lưu link học online và cách nhắc học sinh." },
  link: { tone: "loi", text: "Link chưa đúng: dán địa chỉ đầy đủ bắt đầu bằng https:// (vd https://meet.google.com/abc-defg-hij). Chưa lưu gì." },
  lead: { tone: "loi", text: "Thời gian nhắc chưa đúng. Chọn Tắt, 15 phút, 1 giờ hoặc 1 ngày. Chưa lưu gì." },
} as const;

export default function HocOnlineMuc({ courseId, joinUrl, leadMinutes, flash }: { courseId: string; joinUrl: string | null; leadMinutes: number | null; flash: "ok" | "link" | "lead" | null }) {
  const lead = leadOf(leadMinutes);
  const f = flash ? FLASH[flash] : null;
  const isMeet = !!joinUrl && /^https:\/\/meet\.google\.com\//i.test(joinUrl);
  return (
    <section data-hoc-online className="max-w-xl">
      <KinSectionHead title="Học online" />
      {f && <p role="status" data-hoc-online-flash={flash} className="pt-4 text-[length:var(--kin-co-goc)]"><KinStatus tone={f.tone}>{f.text}</KinStatus></p>}
      <form method="post" action={`/api/tutor/lop/${encodeURIComponent(courseId)}/hoc-online`} className="pt-4 space-y-5">
        <div>
          <label htmlFor="hoc-online-link" className="block text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)] mb-1">Link Google Meet</label>
          <input id="hoc-online-link" name="joinUrl" type="url" inputMode="url" autoComplete="off" autoCapitalize="none" spellCheck={false}
            defaultValue={joinUrl ?? ""} placeholder="https://meet.google.com/abc-defg-hij" maxLength={500}
            className="w-full min-h-11 px-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] bg-[var(--kin-nen-trang)] text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)] outline-none focus-visible:outline-2 focus-visible:outline-[var(--kin-nhan-link)]" />
          <p className="mt-1 text-[length:var(--kin-co-caption)] leading-4 text-[var(--kin-chu-mo)]">
            Nên dùng link Google Meet cố định của lớp. Link Zoom, Teams cũng được. Để trống rồi lưu là gỡ link.
            Buổi nào có link riêng (đặt ở buổi học hoặc khung giờ) thì học sinh thấy link riêng đó.
          </p>
          {joinUrl && !isMeet && <p data-hoc-online-khong-meet className="mt-1 text-[length:var(--kin-co-caption)] leading-4 text-[var(--kin-chu-mo)]">Link này không phải Google Meet. Học sinh vẫn mở được bình thường.</p>}
        </div>
        <div>
          <label id="hoc-online-nhac-label" htmlFor="hoc-online-nhac" className="block text-[length:var(--kin-co-goc)] font-medium text-[var(--kin-chu-chinh)] mb-1">Gửi email nhắc học sinh trước buổi học</label>
          <KinSelect id="hoc-online-nhac" name="lead" defaultValue={lead === null ? "" : String(lead)} data-hoc-online-nhac
            options={[{ value: "", label: "Tắt" }, ...LEAD_OPTIONS.map(m => ({ value: String(m), label: `Trước ${LEAD_LABEL[m]}` }))]} />
          <p className="mt-1 text-[length:var(--kin-co-caption)] leading-4 text-[var(--kin-chu-mo)]">
            KiN gửi email tới học sinh đang học của lớp (không gửi em đã báo nghỉ buổi đó), kèm giờ học và link vào học. Thư không có học phí hay số tiền.
          </p>
        </div>
        <button type="submit" className={kinButtonClass("primary")} data-hoc-online-luu>Lưu</button>
      </form>
    </section>
  );
}
