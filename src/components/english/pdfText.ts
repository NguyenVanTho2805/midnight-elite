// Trích chữ từng trang PDF NGAY TRONG TRÌNH DUYỆT (pdf.js) — file sách không bao giờ rời máy người học,
// và không vướng giới hạn ~4,5 MB mỗi request của máy chủ (sách Grammar in Use thường 30–100 MB).
"use client";

export interface ExtractedPage { pageNo: number; text: string }

export async function extractPdfText(file: File, onProgress?: (done: number, total: number) => void): Promise<{ pageCount: number; pages: ExtractedPage[] }> {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const doc = await task.promise;
  const pages: ExtractedPage[] = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      let text = "";
      for (const item of content.items) {
        if (!("str" in item)) continue;
        text += item.str;
        text += item.hasEOL ? "\n" : item.str.endsWith(" ") ? "" : " ";
      }
      pages.push({ pageNo: n, text: text.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim() });
      page.cleanup();
      onProgress?.(n, doc.numPages);
    }
  } finally {
    await task.destroy();
  }
  return { pageCount: pages.length, pages };
}
