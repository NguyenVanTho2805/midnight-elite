"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { planDocumentPreview, fileExtOf } from "@/lib/mediaLink";

// Trang xem trước tài liệu — mở ở tab riêng (target="_blank") thay vì link
// thẳng vào file, để học viên xem nội dung trước khi quyết định tải về, thay
// vì bị tự động tải ngay lúc bấm vào. Không đặt trong (student)/(guest) —
// đây là trang tiện ích độc lập, không cần Navbar/Footer/BottomNav.
//
// PDF trình duyệt tự render được qua <iframe>. Word/Excel/PowerPoint trình
// duyệt không có khả năng xem trực tiếp — nhúng qua Microsoft Office Viewer
// (view.officeapps.live.com, vẫn được Microsoft duy trì tích cực — Google
// Docs Viewer cũ hơn đã ngừng hỗ trợ nhúng công khai từ vài năm nay, hay trả
// về lỗi với file ngoài Google Drive). Chỉ hoạt động với file thật sự công
// khai (vd Cloudinary).
//
// Link Google Docs/Sheets/Slides/Drive dán tay (mục "paste link Google
// Drive" ở DocumentsEditor) có dạng ".../edit?..." hoặc ".../view?..." —
// Google tự chặn KHÔNG cho nhúng chính dạng link đó vào iframe (an ninh),
// nhưng có sẵn 1 dạng URL riêng ".../preview" chuyên để nhúng — tự nhận
// diện và đổi sang dạng đó thay vì báo "không xem trước được".

// MD-09: địa chỉ tài liệu đi qua planDocumentPreview (src/lib/mediaLink.ts). CHỈ nhúng nguồn tin cậy (Cloudinary của KiN, Google Docs/Drive,
// đường dẫn nội bộ /api/media); javascript:, data:, http: và máy chủ lạ KHÔNG bao giờ vào iframe, chỉ cho "mở ở tab mới".

function downloadFilename(name: string, url: string): string {
  const ext = fileExtOf(url);
  return ext && !name.toLowerCase().endsWith(`.${ext}`) ? `${name}.${ext}` : name;
}

function ViewerContent() {
  const params = useSearchParams();
  const url  = params.get("url") ?? "";
  const name = params.get("name") ?? "Tài liệu";

  if (!url) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--kin-nen-bang)" }}>
        <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>Thiếu đường dẫn tài liệu.</p>
      </div>
    );
  }

  const plan = planDocumentPreview(url);
  // Chỉ có địa chỉ đã qua kiểm mới được đặt vào href: plan.src là địa chỉ chuẩn hoá https hoặc đường dẫn /api/media.
  const openHref = plan.mode === "none" ? null : plan.src;
  const btn = "flex-shrink-0 inline-flex items-center justify-center px-4 rounded-lg text-xs font-bold";
  const btnStyle = { minHeight: 44, background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" } as const;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--kin-nen-bang)" }}>
      <header className="flex items-center justify-between gap-3 px-4 py-3 flex-shrink-0"
        style={{ background: "var(--kin-nen-trang)", borderBottom: "1px solid var(--kin-vien-thuong)" }}>
        <p className="text-sm font-semibold truncate" style={{ color: "var(--kin-chu-chinh)" }}>{name}</p>
        {plan.downloadHref ? (
          <a href={plan.downloadHref} download={downloadFilename(name, url)} rel="noopener noreferrer" className={btn} style={btnStyle}>Tải xuống</a>
        ) : openHref ? (
          <a href={openHref} target="_blank" rel="noopener noreferrer" className={btn} style={btnStyle}>Mở ở tab mới</a>
        ) : null}
      </header>

      <div className="flex-1 min-h-0 relative">
        {plan.mode === "iframe" && plan.src ? (
          <iframe src={plan.src} className="absolute inset-0 w-full h-full border-0" title={name} referrerPolicy="no-referrer"
            {...(plan.sandbox ? { sandbox: "allow-scripts allow-same-origin allow-popups" } : {})} />
        ) : plan.mode === "image" && plan.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <div className="absolute inset-0 overflow-auto flex items-start justify-center p-4"><img src={plan.src} alt={name} referrerPolicy="no-referrer" className="max-w-full h-auto rounded-lg" /></div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <div className="text-center max-w-sm" role="status">
              <p className="text-sm font-semibold mb-1.5" style={{ color: "var(--kin-chu-chinh)" }}>Không xem trước được tài liệu này</p>
              <p className="text-xs mb-4" style={{ color: "var(--kin-chu-mo)" }}>{plan.reason ?? "Bấm nút bên dưới để mở hoặc tải tệp."}</p>
              {openHref && (
                <a href={openHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center px-5 rounded-lg text-xs font-bold" style={btnStyle}>
                  Mở tài liệu
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ViewerPage() {
  return (
    <Suspense>
      <ViewerContent />
    </Suspense>
  );
}
