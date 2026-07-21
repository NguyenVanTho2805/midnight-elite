// Cắt 1 vùng ảnh theo bounding box chuẩn hoá kiểu Gemini: [yMin, xMin, yMax,
// xMax], mỗi giá trị trong khoảng 0-1000 so với kích thước ảnh gốc.
import sharp from "sharp";

export interface NormalizedBox {
  yMin: number;
  xMin: number;
  yMax: number;
  xMax: number;
}

// Nới biên nhẹ — Gemini xác định bbox không phải lúc nào cũng khít sát, thà
// dư một chút viền còn hơn cắt mất nhãn trục/chú thích của biểu đồ.
const PADDING_RATIO = 0.02;

export async function cropImageBox(imageBuffer: Buffer, box: NormalizedBox, imgWidth: number, imgHeight: number): Promise<Buffer> {
  const padY = (box.yMax - box.yMin) * PADDING_RATIO * (imgHeight / 1000);
  const padX = (box.xMax - box.xMin) * PADDING_RATIO * (imgWidth / 1000);

  const left = Math.max(0, Math.round((box.xMin / 1000) * imgWidth - padX));
  const top = Math.max(0, Math.round((box.yMin / 1000) * imgHeight - padY));
  const right = Math.min(imgWidth, Math.round((box.xMax / 1000) * imgWidth + padX));
  const bottom = Math.min(imgHeight, Math.round((box.yMax / 1000) * imgHeight + padY));

  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) throw new Error("Vùng cắt không hợp lệ");

  return sharp(imageBuffer).extract({ left, top, width, height }).png().toBuffer();
}
