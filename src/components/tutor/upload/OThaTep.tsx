// LOI-02 (11/11/2026) — Ô THẢ TỆP rộng của khối "Tài liệu" trong panel Sửa bài học (đặc tả LOI-02 mục 2.C2, 2.C6, 4.3).
// Chỉ là VÙNG nhận tệp + chữ theo trạng thái; hàng đợi tải (init → gửi có % → complete) nằm ở upload/useTaiLenTep, danh sách tài liệu ở quan-lop/DocumentsEditor.
// Tự đếm dragenter / dragleave (mỗi phần tử con bắn enter/leave riêng) để biết "đang kéo vào"; KHÔNG dùng / sửa src/components/DropZone.tsx (dùng chung).
// Luôn chặn hành vi mặc định khi thả (kể cả lúc kho tắt) để trình duyệt không mở tệp thay trang.
// Thuộc tính data-o-tha theo trạng thái: dang-kiem · loi-kiem · tat · khong-chu · san-sang · keo-vao.
"use client";
import { useRef, useState, type DragEvent } from "react";
import { KinButton } from "@/components/kin/Button";
import { COPYRIGHT_PLEDGE_LABEL } from "@/lib/classRecordings";

export type OThaTrangThai = "dang-kiem" | "loi-kiem" | "tat" | "khong-chu" | "san-sang";

export interface OThaTepProps {
  state: OThaTrangThai;
  /** Tệp được thả hoặc chọn (chỉ gọi khi state = san-sang). */
  onFiles: (files: File[]) => void;
  /** Nút "Thử lại" khi kiểm kho lỗi. */
  onRetry?: () => void;
  /** Thuộc tính accept của <input type=file> (vd ".pdf,.docx"). */
  accept?: string;
  /** Dòng phụ: loại tệp · dung lượng · số tài liệu tối đa. */
  hint?: string;
  /** Ô cam kết bản quyền (bắt buộc trước khi tải). */
  pledge: boolean;
  onPledgeChange: (v: boolean) => void;
}

const FRAME = "flex min-h-[160px] w-full flex-col items-center justify-center gap-2 rounded-[var(--kin-bo-lg)] border-2 px-4 py-5 text-center text-[length:var(--kin-co-goc)] leading-5";

export function OThaTep({ state, onFiles, onRetry, accept, hint, pledge, onPledgeChange }: OThaTepProps) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const ready = state === "san-sang";

  const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
  function onEnter(e: DragEvent<HTMLDivElement>) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth.current += 1;
    if (ready) setOver(true);
  }
  function onLeave(e: DragEvent<HTMLDivElement>) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  }
  function onOver(e: DragEvent<HTMLDivElement>) {
    if (!hasFiles(e)) return;
    e.preventDefault(); // bắt buộc để onDrop chạy
    e.dataTransfer.dropEffect = ready ? "copy" : "none";
  }
  function onDrop(e: DragEvent<HTMLDivElement>) {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    if (!ready) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) onFiles(files);
  }

  const shown = over && ready ? "keo-vao" : state;
  const handlers = { onDragEnter: onEnter, onDragLeave: onLeave, onDragOver: onOver, onDrop };

  if (state === "dang-kiem") {
    return (
      <div {...handlers} data-o-tha="dang-kiem" role="status" aria-busy="true" className={`${FRAME} border-dashed border-[var(--kin-vien-o-nhap)] text-[var(--kin-chu-mo)]`}>
        Đang kiểm kho tệp…
      </div>
    );
  }
  if (state === "loi-kiem") {
    return (
      <div {...handlers} data-o-tha="loi-kiem" role="alert" className={`${FRAME} border-dashed border-[var(--kin-tt-vien-loi)] bg-[var(--kin-tt-nen-loi)] text-[var(--kin-tt-chu-loi)]`}>
        <p className="font-medium">Chưa kiểm được kho tệp.</p>
        {onRetry && <KinButton type="button" variant="secondary" onClick={onRetry}>Thử lại</KinButton>}
      </div>
    );
  }
  if (state === "tat") {
    return (
      <div {...handlers} data-o-tha="tat" className={`${FRAME} border-dashed border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-bang)] text-[var(--kin-chu-chinh)]`}>
        <p data-o-tha-ly-do className="font-medium">Kho tệp chưa bật — chủ cần cấu hình.</p>
        <p className="text-[var(--kin-chu-mo)]">Tài liệu cũ vẫn hiện cho học sinh.</p>
      </div>
    );
  }
  if (state === "khong-chu") {
    return (
      <div {...handlers} data-o-tha="khong-chu" className={`${FRAME} border-dashed border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-bang)] text-[var(--kin-chu-mo)]`}>
        Chỉ chủ lớp tải tệp lên KiN.
      </div>
    );
  }

  return (
    <div {...handlers} data-o-tha={shown}
      className={`${FRAME} ${over ? "border-solid border-[var(--kin-nhan-nen)] bg-[var(--kin-nhan-nen-nhat)]" : "border-dashed border-[var(--kin-vien-o-nhap)] bg-[var(--kin-nen-trang)]"} text-[var(--kin-chu-chinh)] transition-colors`}>
      {over ? (
        <p className="py-10 text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-nhan-link)]">Thả tệp để tải lên</p>
      ) : (
        <>
          <p className="font-medium">Kéo thả tệp Word, PDF, Excel, PowerPoint hoặc ảnh vào đây</p>
          {hint && <p data-o-tha-goi-y className="text-[var(--kin-chu-mo)] break-words">{hint}</p>}
          <input ref={input} type="file" multiple accept={accept} className="sr-only" tabIndex={-1} aria-hidden data-o-tha-input
            onChange={e => { const l = e.target.files; if (l && l.length) onFiles(Array.from(l)); e.target.value = ""; }} />
          <KinButton type="button" variant="secondary" className="mt-1" onClick={() => input.current?.click()}>Chọn tệp từ máy</KinButton>
          <label className="mt-1 flex min-h-[var(--kin-cham-toi-thieu)] w-full cursor-pointer items-start gap-3 py-2 text-left">
            <input type="checkbox" data-tai-lieu-cam-ket checked={pledge} onChange={e => onPledgeChange(e.target.checked)} className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <span className="leading-5">{COPYRIGHT_PLEDGE_LABEL}</span>
          </label>
          <p data-tai-lieu-nhac className="w-full text-left text-[var(--kin-chu-mo)]">Tệp sẽ hiện cho học sinh của lớp ngay khi bài được lưu.</p>
        </>
      )}
    </div>
  );
}

export default OThaTep;
