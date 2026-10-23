"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { checkViewerUrl } from "@/lib/viewerUrl";
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

function googlePreviewUrl(url: string): string | null {
  const docs = url.match(/^https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([^/?#]+)/);
  if (docs) return `https://docs.google.com/${docs[1]}/d/${docs[2]}/preview`;
  const drive = url.match(/^https:\/\/drive\.google\.com\/file\/d\/([^/?#]+)/);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  return null;
}

function downloadFilename(name: string, url: string): string {
  const ext = fileExtOf(url);
  return ext && !name.toLowerCase().endsWith(`.${ext}`) ? `${name}.${ext}` : name;
}

function ViewerContent() {
  const params = useSearchParams();
  const url  = params.get("url") ?? "";
  const name = params.get("name") ?? "Tài liệu";

  // MD-09: chỉ nhận đường dẫn nội bộ, Cloudinary của KiN và link Google Docs/Drive. Địa chỉ lạ, `javascript:`, `data:` bị từ chối
  // TRƯỚC khi nhúng vào iframe, Office Viewer hay nút "Tải xuống".
  const check = checkViewerUrl(url, { cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME });
  if (!check.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--kin-nen-bang)" }}>
        <div className="text-center max-w-sm" role="alert">
          <p className="text-sm font-semibold mb-1.5" style={{ color: "var(--kin-chu-chinh)" }}>Địa chỉ tài liệu không hợp lệ</p>
          <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>{check.error}</p>
        </div>
      </div>
    );
  }
  // Lớp 1 (bảo mật, ở trên): checkViewerUrl loại mọi địa chỉ ngoài allowlist; từ đây trở xuống chỉ có địa chỉ đã qua kiểm (check.url).
  // Lớp 2: quyết định cách xem trước. Google Docs/Drive đổi sang bản /preview; PDF đường dẫn nội bộ nhúng thẳng; Cloudinary của KiN dùng
  // planDocumentPreview (PDF, ảnh, txt, Office qua Microsoft Office Viewer). Còn lại chỉ cho "mở ở tab mới", không bao giờ nhúng.
  const safeUrl = check.url;
  const googleSrc = googlePreviewUrl(safeUrl);
  const planned = planDocumentPreview(safeUrl);
  const internalPdf = check.kind === "internal" && fileExtOf(safeUrl) === "pdf";
  const plan = googleSrc
    ? { mode: "iframe" as const, src: googleSrc, downloadHref: null, sandbox: true, reason: null }
    : internalPdf
      ? { mode: "iframe" as const, src: safeUrl, downloadHref: safeUrl, sandbox: false, reason: null }
      : planned.mode === "none" && check.kind === "internal"
        ? { mode: "external" as const, src: safeUrl, downloadHref: safeUrl, sandbox: true, reason: "Loại tệp này không xem trước được. Bạn có thể tải về." }
        : planned;
  const openHref = plan.mode === "none" ? null : plan.src;
  const btn = "flex-shrink-0 inline-flex items-center justify-center px-4 rounded-lg text-xs font-bold";
  const btnStyle = { minHeight: 44, background: "var(--kin-nhan-nen)", color: "var(--kin-nhan-chu-tren-nen)" } as const;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--kin-nen-bang)" }}>
      <header className="flex items-center justify-between gap-3 px-4 py-3 flex-shrink-0"
        style={{ background: "var(--kin-nen-trang)", borderBottom: "1px solid var(--kin-vien-thuong)" }}>
        <p className="text-sm font-semibold truncate" style={{ color: "var(--kin-chu-chinh)" }}>{name}</p>
        {googleSrc ? (
          <a href={safeUrl} target="_blank" rel="noopener noreferrer" className={btn} style={btnStyle}>Mở trong Google Docs</a>
        ) : plan.downloadHref ? (
          <a href={plan.downloadHref} download={downloadFilename(name, safeUrl)} rel="noopener noreferrer" className={btn} style={btnStyle}>Tải xuống</a>
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
