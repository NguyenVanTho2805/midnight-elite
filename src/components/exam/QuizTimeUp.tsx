// Hết giờ · đang xác nhận bài nộp (QZ-11, Figma 504:5528). Hiện ngay khi đồng hồ MÁY CHỦ về 0. Trung thực:
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
}

export default function QuizTimeUp(p: QuizTimeUpProps) {
  const code = receiptCode(p.attemptId);
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5 pb-10">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--kin-chu-chinh)" }}>Hết giờ · đang xác nhận bài nộp</h1>
          <p className="text-sm mt-1" style={{ color: "var(--kin-chu-mo)" }}>{p.examTitle}</p>
        </div>
        <p role="timer" aria-label="Còn 0 giây" className="font-mono font-semibold text-2xl tabular-nums" style={{ color: "var(--kin-tt-chu-cho)" }}>00:00</p>
      </header>

      {p.state === "sending" ? (
        <KinCallout title="KiN đang gửi bài của em…">
          <p role="status">Thời gian làm bài đã hết nên em không sửa thêm đáp án được. Giữ trang này mở cho tới khi có xác nhận từ máy chủ.</p>
        </KinCallout>
      ) : (
        <>
          <KinCallout title="Chưa nhận được xác nhận từ máy chủ">
            <p role="alert">Thời gian làm bài đã hết nên em không sửa thêm đáp án được. Kết nối bị gián đoạn khi gửi bài; KiN chưa xác nhận bài đã nộp. Giữ trang này mở trên thiết bị này.</p>
          </KinCallout>
          <section aria-labelledby="lam-gi" className="rounded-[var(--kin-bo-the)] p-5 flex flex-col gap-3" style={{ border: "1px solid var(--kin-vien-thuong)" }}>
            <h2 id="lam-gi" className="font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Em cần làm gì bây giờ?</h2>
            <ol className="text-sm flex flex-col gap-2 list-decimal pl-5" style={{ color: "var(--kin-chu-phu)" }}>
              <li>Kiểm tra Wi-Fi hoặc dữ liệu di động. Không đóng trang, không xoá dữ liệu trình duyệt.</li>
              <li>Bấm “Kiểm tra kết nối và thử lại”. Khi có mạng, KiN đối chiếu với máy chủ trước.</li>
              <li>Nếu vẫn chưa có xác nhận, gửi mã lượt cho gia sư. Việc xử lý bài sau hạn do gia sư quyết định; KiN không đảm bảo khôi phục hay chấp nhận bài quá hạn.</li>
            </ol>
          </section>
          <div className="flex flex-wrap gap-3">
            <KinButton variant="primary" onClick={p.onRetry} loading={p.retrying} loadingLabel="Đang kiểm tra…">Kiểm tra kết nối và thử lại</KinButton>
            {code && <KinCopyButton text={code} label="Sao chép mã lượt" appearance="button" buttonVariant="secondary">Sao chép mã lượt</KinCopyButton>}
          </div>
          {code && <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>Mã lượt: {code} · Không có điểm hoặc đáp án ở bước này.</p>}
        </>
      )}
    </div>
  );
}
