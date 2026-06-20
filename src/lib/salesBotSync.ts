// Báo cho TSIX Sales Bot (FastAPI service riêng, repo tsix-sales-bot) đồng bộ
// lại danh sách khóa học ngay sau khi admin tạo/sửa/xóa — tránh phải chạy tay
// scripts/sync_from_midnight_db.py bên đó.
//
// Cố ý nuốt mọi lỗi, không throw: bot service là hệ thống phụ trợ (sales
// chatbot), có thể chưa deploy hoặc đang offline — KHÔNG được để việc đó làm
// hỏng action lưu khóa học chính của admin.
export async function triggerSalesBotSync(): Promise<void> {
  const url = process.env.SALES_BOT_URL;
  if (!url) return; // Chưa cấu hình bot service (vd local chưa chạy, hoặc chưa deploy) — bỏ qua êm

  try {
    await fetch(`${url}/admin/sync-courses`, {
      method: "POST",
      headers: process.env.SALES_BOT_ADMIN_SECRET
        ? { Authorization: `Bearer ${process.env.SALES_BOT_ADMIN_SECRET}` }
        : {},
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error("[triggerSalesBotSync] Không gọi được sales bot:", e);
  }
}
