// Hết giờ · đang xác nhận bài nộp (QZ-11/QZ-12, Figma 521:5528 — ảnh docs/kin/rd/figma-quiz/q7-hs-het-gio-nop-bai.png).
// Bố cục theo Figma: tiêu đề + đồng hồ 00:00; cột trái = khối trạng thái, bảng "Mốc lưu", "Em cần làm gì bây giờ?", nút; cột phải = "Bản lưu không phải biên nhận", "Liên hệ cô".
// Chỉ hiện DỮ LIỆU THẬT: mốc lưu lấy từ giờ máy chủ trả về cho lần lưu nháp gần nhất và giờ lúc hết giờ; lớp và gia sư từ cổng vào đề. KHÔNG làm các phần Figma sau vì chưa có dữ liệu/tính năng:
//   (Mốc lưu của máy chủ chỉ biết các lần lưu trong CHÍNH lần mở trang này; mở lại trang giữa chừng thì ghi "Chưa rõ", không khẳng định chưa có bản nháp.)
//   khối "Ví dụ sau khi đã có biên nhận" (số liệu mẫu bịa), dòng "Trên thiết bị · giờ" (bản nháp trên máy chưa ghi giờ), "1 ảnh" trong biên nhận (quiz không nhận ảnh bài làm của trẻ), nút "Xem cách liên hệ" (chưa có trang đích).
//
// Hết giờ · đang xác nhận bài nộp (QZ-11). Hiện ngay khi đồng hồ MÁY CHỦ về 0. Trung thực:
//   - đang gửi: "KiN đang gửi bài…" (chưa nói đã nhận);
//   - gửi lỗi/mất mạng: "Chưa nhận được xác nhận từ máy chủ", giữ trang mở, nút thử lại (gọi lại nộp — nộp lặp là an toàn), mã lượt để đối chiếu với gia sư;
//   - chỉ khi máy chủ trả biên nhận thì trang cha chuyển sang màn "đã nộp".
// Bản nháp trên máy chủ chưa phải bài nộp; câu này nói rõ để em không tưởng đã xong.
"use client";
import { KinButton, KinCallout, KinCopyButton } from "@/components/kin";
import { receiptCode } from "@/lib/quizRoom";

export interface QuizTimeUpProps {
  examTitle: string;
  attemptId: string;
  state: "sending" | "unconfirmed";
  retrying: boolean;
  onRetry: () => void;
  /** Lớp và gia sư của đề (từ cổng vào đề); thiếu thì không hiện khối "Liên hệ". */
  klass?: { name: string; tutorName: string | null } | null;
  /** Giờ máy chủ của lần lưu bản nháp gần nhất ("19:08:12"); null = chưa có bản nháp nào lưu được. */
  lastServerSaveAt?: string | null;
  /** Giờ máy chủ lúc hết giờ và bắt đầu gửi bài; null = không rõ. */
  sentAt?: string | null;
}

const TH = "px-3 py-3 font-normal text-left";
const TD = "px-3 py-3 align-top";

export default function QuizTimeUp(p: QuizTimeUpProps) {
  const code = receiptCode(p.attemptId);
  const tutor = p.klass?.tutorName ?? null;
  const tutorShort = tutor ? tutor.trim().split(/\s+/).slice(-2).join(" ") : null; // "Cô Lan" nếu tên có chữ đệm thì lấy 2 chữ cuối
  const unconfirmed = p.state === "unconfirmed";
  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6 pb-10" data-het-gio>
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>Hết giờ · đang xác nhận bài nộp</h1>
          <p className="text-sm mt-1 break-words" style={{ color: "var(--kin-chu-mo)" }}>{p.examTitle}{p.klass ? ` · ${p.klass.name}` : ""}</p>
        </div>
        <p role="timer" aria-label="Còn 0 giây" className="font-mono font-semibold text-2xl tabular-nums" style={{ color: "var(--kin-tt-chu-cho)" }}>00:00</p>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-x-8 gap-y-6 items-start">
        <div className="min-w-0 flex flex-col gap-6">
          {!unconfirmed ? (
            <KinCallout title="KiN đang gửi bài của em…">
              <p role="status">Thời gian làm bài đã hết nên em không sửa thêm đáp án được. Giữ trang này mở cho tới khi có xác nhận từ máy chủ.</p>
            </KinCallout>
          ) : (
            <KinCallout title="Chưa nhận được xác nhận từ máy chủ">
              <p role="alert">Thời gian làm bài đã hết nên em không sửa thêm đáp án được. Kết nối bị gián đoạn khi gửi bài; KiN chưa xác nhận bài đã nộp. Giữ trang này mở trên thiết bị này.</p>
            </KinCallout>
          )}

          <section aria-labelledby="moc-luu">
            <h2 id="moc-luu" className="sr-only">Mốc lưu</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-moc-luu>
                <caption className="sr-only">Các mốc lưu bài của em</caption>
                <thead><tr style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)" }}><th scope="col" className={TH}>Mốc lưu</th><th scope="col" className={TH}>Nội dung</th><th scope="col" className={TH}>Trạng thái</th></tr></thead>
                <tbody style={{ color: "var(--kin-chu-chinh)" }}>
                  <tr style={{ borderBottom: "1px solid var(--kin-vien-nhat)" }}>
                    <th scope="row" className={`${TD} font-normal text-left`}>Máy chủ{p.lastServerSaveAt ? ` · ${p.lastServerSaveAt}` : ""}</th>
                    <td className={TD}>{p.lastServerSaveAt ? "Bản nháp tự luận lưu lần gần nhất" : "Chưa ghi nhận lần lưu nào trong lần mở trang này"}</td>
                    <td className={TD} style={{ color: p.lastServerSaveAt ? "var(--kin-nhan-link)" : "var(--kin-chu-mo)" }}>{p.lastServerSaveAt ? "Đã lưu bản nháp" : "Chưa rõ"}</td>
                  </tr>
                  <tr style={{ borderBottom: "1px solid var(--kin-vien-nhat)" }}>
                    <th scope="row" className={`${TD} font-normal text-left`}>Gửi bài{p.sentAt ? ` · ${p.sentAt}` : ""}</th>
                    <td className={TD}>{unconfirmed ? "Chưa nhận được biên nhận" : "Đang chờ biên nhận"}</td>
                    <td className={TD} style={{ color: "var(--kin-tt-chu-cho)" }}>Chưa xác nhận đã nộp</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {unconfirmed && (
            <section aria-labelledby="lam-gi" className="rounded-[var(--kin-bo-the)] p-5 flex flex-col gap-3" style={{ border: "1px solid var(--kin-vien-thuong)" }}>
              <h2 id="lam-gi" className="font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Em cần làm gì bây giờ?</h2>
              <ol className="text-sm flex flex-col gap-2 list-decimal pl-5" style={{ color: "var(--kin-chu-phu)" }}>
                <li>Kiểm tra Wi-Fi hoặc dữ liệu di động. Không đóng trang, không xoá dữ liệu trình duyệt.</li>
                <li>Bấm “Kiểm tra kết nối và thử lại”. Khi có mạng, KiN đối chiếu với máy chủ trước.</li>
                <li>Nếu vẫn chưa có xác nhận, gửi mã lượt cho {tutorShort ?? "gia sư"}. Việc xử lý bài sau hạn do gia sư quyết định; KiN không đảm bảo khôi phục hay chấp nhận bài quá hạn.</li>
              </ol>
            </section>
          )}

          {unconfirmed && (
            <div className="flex flex-wrap gap-3">
              <KinButton variant="primary" onClick={p.onRetry} loading={p.retrying} loadingLabel="Đang kiểm tra…">Kiểm tra kết nối và thử lại</KinButton>
              {code && <KinCopyButton text={code} label="Sao chép mã lượt" appearance="button" buttonVariant="secondary">Sao chép mã lượt</KinCopyButton>}
            </div>
          )}
          {unconfirmed && code && <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Mã lượt: {code} · Không có điểm hoặc đáp án ở bước này.</p>}
        </div>

        <aside className="min-w-0 flex flex-col gap-6" aria-label="Ghi chú">
          <div className="px-5 py-4 text-sm leading-5" style={{ background: "var(--kin-nen-bang)", borderLeft: "2px solid var(--kin-tt-chu-cho)" }}>
            <p className="font-medium" style={{ color: "var(--kin-tt-chu-cho)" }}>Bản lưu không phải biên nhận</p>
            <p className="mt-2" style={{ color: "var(--kin-chu-mo)" }}>Bản nháp trên máy chủ chưa phải bài nộp. Trang chỉ chuyển sang “Đã nhận bài” khi máy chủ xác nhận. Điểm tổng, đáp án và lời giải chưa hiển thị.</p>
          </div>
          {(p.klass || code) && (
            <div className="rounded-[var(--kin-bo-the)] p-5 text-sm" style={{ background: "var(--kin-nen-bang)" }} data-lien-he>
              <h2 className="font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Liên hệ {tutorShort ?? "gia sư"}</h2>
              {p.klass && <p className="mt-2" style={{ color: "var(--kin-chu-phu)" }}>{tutorShort ? `${tutorShort} · ` : ""}Lớp {p.klass.name}</p>}
              <p className="mt-3 leading-5" style={{ color: "var(--kin-chu-mo)" }}>
                Nếu cần nhờ gia sư xem bài, hãy nói mã lượt{code ? ` ${code}` : ""}, thời điểm mất mạng và mốc lưu gần nhất ở bảng bên. Không chia sẻ bài làm của người khác.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
