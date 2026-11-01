// Khung của /tin-tuc: GIỐNG (guest)/layout.tsx nhưng KHÔNG có Suspense và không có loading.tsx.
// Lý do: Suspense + loading.tsx của (guest) làm Next gửi 200 trước khi trang kịp gọi notFound() → bài nháp / lên lịch / slug lạ thành "soft 404" (200).
// Ở đây không có biên Suspense nên notFound() trả HTTP 404 thật (cùng cách (parent) làm với /phieu). Đổi khung (guest) thì đổi cả tệp này.
import GuestChrome from "@/components/shell/GuestChrome";

export default function TinLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-vung="sang" className="min-h-screen flex flex-col" style={{ background: "var(--kin-nen-trang)" }}>
      <GuestChrome>
        <div className="page-enter">{children}</div>
      </GuestChrome>
    </div>
  );
}
