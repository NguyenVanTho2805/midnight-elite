-- T33: bảng "đánh dấu xong" cho việc ở màn Hôm nay. Chỉ THÊM bảng, không đụng dữ liệu cũ.
CREATE TABLE "viec_xong" (
    "loai" TEXT NOT NULL,
    "khoa" TEXT NOT NULL,
    "nguoi_dung_id" UUID NOT NULL,
    "luc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "viec_xong_pkey" PRIMARY KEY ("loai","khoa")
);
ALTER TABLE "viec_xong" ADD CONSTRAINT "viec_xong_nguoi_dung_id_fkey" FOREIGN KEY ("nguoi_dung_id") REFERENCES "nguoi_dung"("id") ON DELETE CASCADE ON UPDATE CASCADE;
