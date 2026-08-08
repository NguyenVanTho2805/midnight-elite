"use client";

import { useState, useRef } from "react";
import { api, type ExamFileFull } from "@/lib/api";
import { ExtractReviewModal } from "@/components/ExtractReviewModal";

// Nút "Tải file lên & tách câu hỏi" dùng ngay trong Ngân hàng câu hỏi (gallery
// hoặc trang 1 ngân hàng cụ thể) — gộp 2 bước vốn tách rời (tải file vào
// Ngân hàng đề thi, rồi sang đó bấm "Tách câu hỏi") thành 1 luồng liền mạch,
// không phải rời trang. File vẫn được lưu vào Ngân hàng đề thi như bình
// thường (api.examFiles.upload — cùng API, cùng chỗ lưu trữ) để xem lại sau,
// chỉ thêm lối tắt vào thẳng đây.
export function UploadAndExtractButton({ fixedBankId, onSaved, showToast, className, style, label }: {
  fixedBankId?: string;
  onSaved: () => void;
  showToast: (msg: string, ok?: boolean) => void;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<ExamFileFull | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await api.examFiles.upload(file, null);
      setUploadedFile(uploaded);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload thất bại", false);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <>
      <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
        className={className ?? "px-4 py-2.5 text-sm font-semibold rounded-lg border disabled:opacity-50"}
        style={style ?? { borderColor: "#e5e3df", color: "#787671" }}>
        {uploading ? "Đang tải lên..." : (label ?? "+ Tải file lên & tách câu hỏi")}
      </button>
      <input ref={fileInputRef} type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleUpload} />
      <ExtractReviewModal
        examFile={uploadedFile}
        fixedBankId={fixedBankId}
        onClose={() => setUploadedFile(null)}
        onSaved={onSaved}
        showToast={showToast}
      />
    </>
  );
}
