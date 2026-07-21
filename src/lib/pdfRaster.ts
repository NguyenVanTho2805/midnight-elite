// Render 1 trang PDF ra ảnh PNG raster — dùng để cắt vùng biểu đồ/hình ảnh mà
// Gemini xác định vị trí (bounding box) khi trích xuất câu hỏi từ file PDF gốc.
// pdfjs-dist tự vẽ (không cần binary Poppler/pdfium ngoài) + @napi-rs/canvas
// cung cấp Canvas 2D context tương thích, chạy được trên Vercel serverless
// (binary có sẵn theo platform, không cần compile native lúc build).
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";

export interface RasterPage {
  png: Buffer;
  width: number;
  height: number;
}

// scale 2.0 — đủ nét để đọc số liệu trong biểu đồ sau khi cắt vùng nhỏ, không
// quá nặng cho thời gian xử lý (đề PDF thường vài chục trang A4).
const RENDER_SCALE = 2.0;

export async function renderPdfPageToPng(pdfBuffer: Buffer, pageIndex: number): Promise<RasterPage> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
  try {
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageIndex + 1); // pdfjs dùng 1-based
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    const png = await canvas.encode("png");
    return { png: Buffer.from(png), width: canvas.width, height: canvas.height };
  } finally {
    await loadingTask.destroy();
  }
}

export async function getPdfPageCount(pdfBuffer: Buffer): Promise<number> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
  try {
    const pdf = await loadingTask.promise;
    return pdf.numPages;
  } finally {
    await loadingTask.destroy();
  }
}
