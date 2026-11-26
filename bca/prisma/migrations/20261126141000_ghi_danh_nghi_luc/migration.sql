-- T34: "chủ cho nghỉ môn" ghi bằng cột riêng, không dựa vào chữ trong ghi chú. Chỉ THÊM cột.
ALTER TABLE "ghi_danh" ADD COLUMN "nghi_luc" TIMESTAMPTZ, ADD COLUMN "nghi_boi" UUID;
-- Giữ nghĩa cũ: dòng web đã ghi chú "Cho nghỉ…" (cách nhận cũ) → nghi_luc = lần sửa cuối. Ghi chú giữ nguyên.
UPDATE "ghi_danh" SET "nghi_luc" = "cap_nhat_luc" WHERE "nghi_luc" IS NULL AND "ghi_chu" LIKE 'Cho nghỉ%';
