"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

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
// khai (vd Cloudinary) — không phải link Google Drive dạng "chỉnh sửa" vì
// Drive tự chặn nhúng iframe của chính nó.

function detectExt(url: string): string | null {
  const clean = url.split(/[?#]/)[0];
  const ext = clean.split(".").pop()?.toLowerCase();
  return ext && ext.length <= 5 ? ext : null;
}

function downloadFilename(name: string, url: string): string {
  const ext = detectExt(url);
  return ext && !name.toLowerCase().endsWith(`.${ext}`) ? `${name}.${ext}` : name;
}

const OFFICE_EXTS = new Set(["doc", "docx", "xls", "xlsx", "ppt", "pptx"]);

function ViewerContent() {
  const params = useSearchParams();
  const url  = params.get("url") ?? "";
  const name = params.get("name") ?? "Tài liệu";

  if (!url) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f6f5f4" }}>
        <p className="text-sm" style={{ color: "#787671" }}>Thiếu đường dẫn tài liệu.</p>
      </div>
    );
  }

  const ext = detectExt(url);
  const isPdf    = ext === "pdf";
  const isOffice = ext !== null && OFFICE_EXTS.has(ext);
  const canEmbed = isPdf || isOffice;
  const embedSrc = isPdf ? url : `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#f6f5f4" }}>
      <header className="flex items-center justify-between gap-3 px-4 py-3 flex-shrink-0"
        style={{ background: "#ffffff", borderBottom: "1px solid #e5e3df" }}>
        <p className="text-sm font-semibold truncate" style={{ color: "#1a1a1a" }}>{name}</p>
        <a href={url} download={downloadFilename(name, url)}
          className="flex-shrink-0 px-4 py-2 rounded-lg text-xs font-bold text-white"
          style={{ background: "#0068FF" }}>
          Tải xuống
        </a>
      </header>

      <div className="flex-1 min-h-0 relative">
        {canEmbed ? (
          <iframe src={embedSrc} className="absolute inset-0 w-full h-full border-0" title={name} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-4">
            <div className="text-center max-w-sm">
              <p className="text-sm font-semibold mb-1.5" style={{ color: "#1a1a1a" }}>Không xem trước được loại file này</p>
              <p className="text-xs mb-4" style={{ color: "#787671" }}>Bấm nút bên dưới để mở hoặc tải file.</p>
              <a href={url} target="_blank" rel="noopener noreferrer"
                className="inline-block px-4 py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: "#0068FF" }}>
                Mở tài liệu
              </a>
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
