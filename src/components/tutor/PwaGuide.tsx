// TK-05 — hướng dẫn cài KiN lên Màn hình chính từng bước cho iPhone (iOS 16.4 trở lên). iPhone chỉ nhận thông báo đẩy khi KiN chạy từ biểu tượng ở Màn hình chính.
// Chữ trung thực: chỉ nói cách làm và máy này đang ở trạng thái nào; không hứa "sẽ nhận được thông báo" (việc bật thông báo nằm ở khối Thông báo đẩy phía trên).
"use client";
import { useEffect, useState } from "react";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinStatus } from "@/components/kin/Status";
import { isIosDevice } from "@/lib/pushClient";

export const PWA_STEPS: { title: string; body: string }[] = [
  { title: "Mở KiN bằng Safari", body: "Mở địa chỉ KiN trong Safari. Nếu cô đang mở link từ Zalo hay ứng dụng khác, bấm “Mở bằng Safari” ở góc dưới hoặc góc trên rồi làm tiếp." },
  { title: "Bấm nút Chia sẻ", body: "Là hình ô vuông có mũi tên chỉ lên, nằm ở thanh dưới của Safari (trên iPad thì ở thanh trên)." },
  { title: "Chọn “Thêm vào Màn hình chính”", body: "Kéo danh sách lên và chọn dòng này. Nếu không thấy, bấm “Sửa tác vụ” ở cuối danh sách hoặc kiểm tra lại là đang dùng Safari." },
  { title: "Bấm “Thêm”", body: "Giữ tên “KiN” rồi bấm Thêm ở góc trên bên phải. Biểu tượng KiN sẽ xuất hiện ở Màn hình chính." },
  { title: "Mở KiN từ biểu tượng mới", body: "Đóng Safari, bấm biểu tượng KiN vừa thêm, đăng nhập lại nếu được hỏi. Sau đó vào Cài đặt, bật thông báo ở khối Thông báo đẩy phía trên." },
];

export default function PwaGuide() {
  const [env, setEnv] = useState<null | { ios: boolean; standalone: boolean }>(null);
  useEffect(() => {
    void Promise.resolve().then(() => setEnv({
      ios: isIosDevice(navigator.userAgent, navigator.maxTouchPoints ?? 0),
      standalone: window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true,
    }));
  }, []);

  return (
    <section id="cai-pwa" aria-labelledby="h-pwa" className="scroll-mt-4" data-pwa-guide>
      <KinSectionHead id="h-pwa" title="Cài KiN lên Màn hình chính" />
      <p className="text-[length:var(--kin-co-goc)] mt-4 mb-3" style={{ color: "var(--kin-chu-mo)" }}>
        Dành cho iPhone dùng iOS 16.4 trở lên. iPhone chỉ nhận được thông báo đẩy khi KiN được mở từ biểu tượng ở Màn hình chính. Xem phiên bản iOS ở Cài đặt › Cài đặt chung › Giới thiệu.
      </p>
      {env && (
        <p className="mb-3" data-pwa-state>
          {env.standalone
            ? <KinStatus tone="xong">Máy này đang mở KiN từ Màn hình chính</KinStatus>
            : <KinStatus tone="mo">{env.ios ? "Máy này đang mở KiN trong trình duyệt, chưa từ Màn hình chính" : "Máy này đang mở KiN trong trình duyệt"}</KinStatus>}
        </p>
      )}
      <ol className="space-y-3">
        {PWA_STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span aria-hidden className="flex-shrink-0 w-7 h-7 rounded-full border border-[var(--kin-vien-o-nhap)] text-[length:var(--kin-co-goc)] flex items-center justify-center tabular-nums text-[var(--kin-chu-chinh)]">{i + 1}</span>
            <div className="min-w-0">
              <p className="text-[length:var(--kin-co-body)] leading-6 text-[var(--kin-chu-chinh)]"><span className="sr-only">Bước {i + 1}: </span>{s.title}</p>
              <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
        Thiết bị Android và máy tính: dùng mục “Cài đặt ứng dụng” hoặc “Thêm vào Màn hình chính” trong menu của Chrome. Không cài cũng vẫn dùng KiN bình thường trong trình duyệt.
      </p>
    </section>
  );
}
