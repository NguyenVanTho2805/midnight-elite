-- Cột "Đồng ý" trên sheet là chữ (phiên bản điều khoản + thời điểm, hoặc "Form cũ"), không phải đúng/sai.
-- Chưa có DB thật nào có dữ liệu ở cột này (chỉ DB thử); giữ dấu vết nếu có: true → 'Có'.
ALTER TABLE "don_dang_ky" ALTER COLUMN "dong_y" DROP NOT NULL,
ALTER COLUMN "dong_y" DROP DEFAULT,
ALTER COLUMN "dong_y" SET DATA TYPE TEXT USING (CASE WHEN "dong_y" THEN 'Có' END);
