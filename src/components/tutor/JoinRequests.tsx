// BU-01 — khối "Chờ duyệt" trong tab Học sinh của lớp (gia sư). Toàn bộ là biểu mẫu HTML thuần (POST + 303 về đúng tab, kèm ?duyet=): không cần JS,
// nên bấm xong trang tải lại với thông báo, nút dùng trạng thái đang gửi gốc của trình duyệt.
// Tên em chỉ hiện ở đây (chủ lớp); lời nhắn từ chối do gia sư gõ, có nhắc đừng ghi thông tin cá nhân của học sinh.
// Ba trạng thái: có hàng chờ (danh sách), rỗng (câu hướng dẫn), lỗi tải (callout + Tải lại, phần danh sách em vẫn hiện).
import Link from "next/link";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinPanel } from "@/components/kin/Panel";
import { KinCallout } from "@/components/kin/Callout";
import { KinStatus } from "@/components/kin/Status";
import { kinButtonClass } from "@/components/kin/buttonClass";

export interface PendingJoinRequest { id: string; studentName: string; /** "dd/mm" đã định dạng ở máy chủ */ sentOn: string }

const NOTE_MAX = 200;
// Dáng hàng giống KIN_TABLE_ROW nhưng không có items-center (hàng này xếp dọc ở 390px).
const ROW = "px-[var(--kin-kc-6)] py-[var(--kin-kc-4)] border-b border-[var(--kin-vien-nhat)] text-[length:var(--kin-co-goc)] leading-5";

export default function JoinRequests({ courseId, items, failed, retryHref, show }: {
  courseId: string;
  items: PendingJoinRequest[];
  failed: boolean;
  /** Đường tải lại trang (giữ tab Học sinh). */
  retryHref: string;
  /** false = lớp không dùng chế độ duyệt và không có yêu cầu nào: ẩn cả khối. */
  show: boolean;
}) {
  if (!show) return null;
  const base = `/api/tutor/lop/${courseId}/yeu-cau`;
  return (
    <section aria-labelledby="jr-title" data-join-requests className="mb-8">
      <KinSectionHead id="jr-title" title={`Chờ duyệt · ${items.length}`} />
      {failed ? (
        <KinCallout title="Chưa tải được danh sách chờ duyệt" className="mt-4">
          <Link href={retryHref} className={`${kinButtonClass("secondary")} mt-3`}>Tải lại</Link>
        </KinCallout>
      ) : items.length === 0 ? (
        <p className="pt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">Chưa có yêu cầu nào. Khi học sinh xin vào lớp, yêu cầu hiện ở đây.</p>
      ) : (
        <>
          <form id="jr-bulk" method="post" action={`${base}/hang-loat`} className="pt-4">
            <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Tick các em rồi duyệt hoặc từ chối cùng lúc.</p>
            <label className="mt-3 flex items-center gap-2 min-h-11 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">
              <span className="sr-only">Lời nhắn chung khi từ chối (không bắt buộc)</span>
              <input name="note" maxLength={NOTE_MAX} placeholder="Lời nhắn chung khi từ chối (không bắt buộc)" autoComplete="off"
                className="w-full min-h-11 px-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)]" />
            </label>
            <div className="mt-3 flex flex-wrap gap-3">
              <button type="submit" name="action" value="duyet" className={kinButtonClass("primary")}>Duyệt đã chọn</button>
              <button type="submit" name="action" value="tu-choi" className={kinButtonClass("danger")}>Từ chối đã chọn</button>
            </div>
          </form>
          <KinPanel flush className="mt-4">
            <ul aria-label="Học sinh xin vào lớp">
              {items.map(r => (
                <li key={r.id} data-join-request className={`${ROW} flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`}>
                  <div className="flex items-start gap-3 min-w-0">
                    <input type="checkbox" form="jr-bulk" name="id" value={r.id} aria-label={`Chọn ${r.studentName}`} className="mt-1 size-5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="break-words text-[var(--kin-chu-chinh)]">{r.studentName}</p>
                      <p className="mt-0.5 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]"><KinStatus tone="cho">Chờ duyệt</KinStatus> · Gửi ngày {r.sentOn}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-shrink-0">
                    <form method="post" action={`${base}/${r.id}/duyet`} className="contents">
                      <button type="submit" aria-label={`Duyệt ${r.studentName}`} className={kinButtonClass("primary")}>Duyệt</button>
                    </form>
                    <details className="group col-span-2 sm:col-span-1 sm:relative">
                      <summary aria-label={`Từ chối ${r.studentName}`} className={`${kinButtonClass("danger")} cursor-pointer list-none w-full`}>Từ chối</summary>
                      <form method="post" action={`${base}/${r.id}/tu-choi`} className="mt-3 flex flex-col gap-2 sm:absolute sm:right-0 sm:z-10 sm:w-72 sm:p-3 sm:border sm:border-[var(--kin-vien-thuong)] sm:bg-[var(--kin-nen-trang)] sm:rounded-[var(--kin-bo-the)]">
                        <label className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Lời nhắn cho bạn (không bắt buộc, tối đa {NOTE_MAX} ký tự)
                          <textarea name="note" rows={2} maxLength={NOTE_MAX}
                            className="mt-1 block w-full px-3 py-2 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)] text-[var(--kin-chu-chinh)]" />
                        </label>
                        <p className="text-[length:var(--kin-co-phu)] text-[var(--kin-chu-mo)]">Đừng ghi thông tin cá nhân của học sinh.</p>
                        <button type="submit" className={kinButtonClass("danger")}>Xác nhận từ chối</button>
                      </form>
                    </details>
                  </div>
                </li>
              ))}
            </ul>
          </KinPanel>
        </>
      )}
    </section>
  );
}
