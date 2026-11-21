// SCL-D (Q3) — phần TRÌNH DUYỆT của nộp bài bằng ảnh: đọc ảnh, nén bằng canvas (JPEG, cạnh dài ≤ 2000px), gộp thành một File PDF (buildJpegPdf).
// Ảnh gốc không rời máy; chỉ tệp PDF đi tiếp đường nộp PDF sẵn có. Quá cỡ thì nén thêm một nấc (1600px, chất lượng thấp hơn) trước khi báo lỗi.
"use client";
import { buildJpegPdf, fitWithin, IMAGE_MAX_EDGE, type JpegPage } from "./imagePdf";

async function decode(file: File): Promise<{ src: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const b = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { src: b, width: b.width, height: b.height, close: () => b.close() };
    } catch { /* trình duyệt cũ / định dạng lạ: thử thẻ <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { src: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(`Không đọc được ảnh “${file.name}”. Hãy chụp lại hoặc chọn ảnh khác.`);
  }
}

async function toJpeg(file: File, maxEdge: number, quality: number): Promise<JpegPage> {
  const img = await decode(file);
  try {
    const { width, height } = fitWithin(img.width, img.height, maxEdge);
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Trình duyệt không nén được ảnh.");
    ctx.fillStyle = "white"; // ảnh PNG trong suốt ⇒ nền trắng thay vì đen
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img.src, 0, 0, width, height);
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/jpeg", quality));
    if (!blob) throw new Error("Trình duyệt không nén được ảnh.");
    return { jpeg: new Uint8Array(await blob.arrayBuffer()), width, height };
  } finally { img.close(); }
}

/** Ảnh → một File PDF ≤ maxBytes (null nếu vẫn quá cỡ sau khi nén thêm). Ném lỗi có câu tiếng Việt khi không đọc được ảnh. */
export async function imagesToPdfFile(files: File[], maxBytes: number, name = "bai-lam-anh.pdf"): Promise<File | null> {
  for (const [edge, q] of [[IMAGE_MAX_EDGE, 0.8], [1600, 0.6]] as const) {
    const pages: JpegPage[] = [];
    for (const f of files) pages.push(await toJpeg(f, edge, q));
    const pdf = buildJpegPdf(pages);
    if (pdf.length <= maxBytes) return new File([pdf as BlobPart], name, { type: "application/pdf" });
  }
  return null;
}
