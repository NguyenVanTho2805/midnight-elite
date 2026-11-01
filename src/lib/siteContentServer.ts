// Đọc nội dung trang chủ từ DB (bảng site_content). Chỉ chạy ở máy chủ. Phần thuần (kiểu, mặc định, kiểm tra) nằm ở siteContent.ts.
import "server-only";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { HOME_CONTENT_KEY, parseHomeContent, type HomeContent } from "@/lib/siteContent";

/** Không có hàng / bảng chưa tồn tại / lỗi DB / dữ liệu hỏng → mặc định (từng trường). Không bao giờ ném lỗi, để trang chủ không hỏng và `next build` không đòi DB.
 *  Không dùng unstable_cache: trang đã tĩnh theo `revalidate = 3600`, thêm một tầng đệm chỉ làm "lưu xong vẫn thấy bản cũ" khó lý giải. */
export async function loadHomeContent(): Promise<HomeContent> {
  try {
    const row = await prisma.siteContent.findUnique({ where: { key: HOME_CONTENT_KEY }, select: { data: true } });
    return parseHomeContent(row?.data ?? null);
  } catch (e) {
    console.error("[siteContent] không đọc được nội dung trang chủ, dùng mặc định:", e instanceof Error ? e.message.split("\n").pop() : "lỗi không rõ");
    return parseHomeContent(null);
  }
}

/** Đánh dấu trang chủ dựng lại ở lần mở kế tiếp. Dùng đường dẫn (không tag): trang đọc bằng Prisma, không gắn tag nên revalidateTag không có tác dụng. */
export function revalidateHome(): void {
  revalidatePath("/");
}
