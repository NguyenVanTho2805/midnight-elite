CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "vai_tro" AS ENUM ('chu', 'giao_vien');

-- CreateEnum
CREATE TYPE "loai_ghi_danh" AS ENUM ('thu', 'chinh_thuc');

-- CreateEnum
CREATE TYPE "loai_buoi" AS ENUM ('theo_lich', 'hoc_bu');

-- CreateEnum
CREATE TYPE "trang_thai_buoi" AS ENUM ('binh_thuong', 'huy');

-- CreateEnum
CREATE TYPE "trang_thai_dd" AS ENUM ('co', 'phep', 'vang');

-- CreateEnum
CREATE TYPE "nguon_dd" AS ENUM ('sheet', 'web');

-- CreateEnum
CREATE TYPE "trang_thai_don" AS ENUM ('moi', 'cho_duyet', 'da_nhan', 'trung', 'bo_qua', 'lead_cu');

-- CreateTable
CREATE TABLE "lua" (
    "id" SERIAL NOT NULL,
    "ma" TEXT NOT NULL,
    "ten" TEXT NOT NULL,
    "tu_ngay" DATE NOT NULL,
    "den_ngay" DATE,
    "ghi_chu" TEXT,
    "tao_luc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cap_nhat_luc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lua_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mon" (
    "id" SMALLINT NOT NULL,
    "ma" TEXT NOT NULL,
    "ten_ngan" TEXT NOT NULL,
    "ten_day_du" TEXT NOT NULL,
    "thu" SMALLINT[],
    "gio_bat_dau" TEXT NOT NULL DEFAULT '22:15',
    "so_phut" SMALLINT NOT NULL DEFAULT 90,
    "thu_tu" SMALLINT NOT NULL,
    "link_zalo" TEXT,
    "ten_lop_azota" TEXT,
    "link_meet" TEXT,
    "si_so_toi_da" INTEGER NOT NULL DEFAULT 0,
    "tao_luc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cap_nhat_luc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cai_dat" (
    "khoa" TEXT NOT NULL,
    "gia_tri" JSONB NOT NULL,
    "ghi_chu" TEXT,
    "tao_luc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cap_nhat_luc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cai_dat_pkey" PRIMARY KEY ("khoa")
);

-- CreateTable
CREATE TABLE "nguoi_dung" (
    "id" UUID NOT NULL,
    "gmail" TEXT NOT NULL,
    "ten_hien_thi" TEXT NOT NULL,
    "vai_tro" "vai_tro" NOT NULL,
    "khoa_luc" TIMESTAMPTZ,
    "phien_huy_luc" TIMESTAMPTZ,
    "tao_luc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cap_nhat_luc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nguoi_dung_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "phan_cong" (
    "nguoi_dung_id" UUID NOT NULL,
    "mon_id" SMALLINT NOT NULL,
    "tao_luc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phan_cong_pkey" PRIMARY KEY ("nguoi_dung_id","mon_id")
);

-- CreateTable
CREATE TABLE "hoc_sinh" (
    "id" SERIAL NOT NULL,
    "ma_hs" TEXT NOT NULL,
    "ho_ten" TEXT NOT NULL,
    "lua_id" INTEGER,
    "sdt_hs" TEXT,
    "sdt_ph" TEXT,
    "gmail" TEXT,
    "truong" TEXT,
    "khoi" TEXT,
    "ho_ten_ph" TEXT,
    "muc_tieu" TEXT,
    "nguon" TEXT,
    "username_azota" TEXT,
    "dong_y_vinh_danh" BOOLEAN NOT NULL DEFAULT false,
    "da_nhan_chao" BOOLEAN NOT NULL DEFAULT false,
    "ghi_chu" TEXT,
    "ghi_chu_rieng" TEXT,
    "ngay_tao" DATE NOT NULL,
    "so_du_dau_ky" INTEGER NOT NULL DEFAULT 0,
    "an_luc" TIMESTAMPTZ,
    "tao_luc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cap_nhat_luc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hoc_sinh_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ghi_danh" (
    "id" SERIAL NOT NULL,
    "ma_gd" TEXT NOT NULL,
    "hoc_sinh_id" INTEGER NOT NULL,
    "mon_id" SMALLINT NOT NULL,
    "loai" "loai_ghi_danh" NOT NULL,
    "tu_ngay" DATE NOT NULL,
    "den_ngay" DATE,
    "huy_luc" TIMESTAMPTZ,
    "mien_phi" BOOLEAN NOT NULL DEFAULT false,
    "don_gia_rieng" INTEGER,
    "ghi_chu" TEXT,
    "tao_boi" UUID,
    "tao_luc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cap_nhat_luc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ghi_danh_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buoi_hoc" (
    "id" SERIAL NOT NULL,
    "mon_id" SMALLINT NOT NULL,
    "ngay" DATE NOT NULL,
    "bat_dau_luc" TIMESTAMPTZ NOT NULL,
    "so_phut" SMALLINT NOT NULL,
    "loai" "loai_buoi" NOT NULL DEFAULT 'theo_lich',
    "trang_thai" "trang_thai_buoi" NOT NULL DEFAULT 'binh_thuong',
    "ly_do_huy" TEXT,
    "bu_cho_buoi_id" INTEGER,
    "noi_dung" TEXT,
    "link_record" TEXT,
    "ghi_chu" TEXT,
    "da_diem_danh_luc" TIMESTAMPTZ,
    "tao_luc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cap_nhat_luc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buoi_hoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diem_danh" (
    "buoi_id" INTEGER NOT NULL,
    "hoc_sinh_id" INTEGER NOT NULL,
    "trang_thai" "trang_thai_dd" NOT NULL,
    "ghi_chu" TEXT,
    "ghi_luc" TIMESTAMPTZ NOT NULL,
    "ghi_boi" UUID,
    "nguon" "nguon_dd" NOT NULL DEFAULT 'web',

    CONSTRAINT "diem_danh_pkey" PRIMARY KEY ("buoi_id","hoc_sinh_id")
);

-- CreateTable
CREATE TABLE "don_dang_ky" (
    "id" SERIAL NOT NULL,
    "thoi_gian" TIMESTAMPTZ NOT NULL,
    "nguon" TEXT,
    "loai" TEXT,
    "ho_ten" TEXT NOT NULL,
    "sdt_hs" TEXT,
    "gmail" TEXT,
    "truong" TEXT,
    "khoi" TEXT,
    "ho_ten_ph" TEXT,
    "sdt_ph" TEXT,
    "mon_ids" SMALLINT[],
    "muc_tieu" TEXT,
    "biet_qua" TEXT,
    "da_hoc_thu" TEXT,
    "dong_y" BOOLEAN NOT NULL DEFAULT false,
    "dong_y_vinh_danh" BOOLEAN NOT NULL DEFAULT false,
    "ma_yeu_cau" TEXT NOT NULL,
    "trang_thai" "trang_thai_don" NOT NULL,
    "hoc_sinh_id" INTEGER,
    "ma_hs_cu" TEXT,
    "ghi_chu_xu_ly" TEXT,
    "loi_du_lieu" TEXT[],
    "tao_luc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cap_nhat_luc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "don_dang_ky_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bo_dem" (
    "khoa" TEXT NOT NULL,
    "gia_tri" INTEGER NOT NULL,

    CONSTRAINT "bo_dem_pkey" PRIMARY KEY ("khoa")
);

-- CreateTable
CREATE TABLE "nhat_ky" (
    "id" SERIAL NOT NULL,
    "luc" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nguoi_dung_id" UUID,
    "vai_tro" TEXT,
    "hanh_dong" TEXT NOT NULL,
    "doi_tuong" TEXT NOT NULL,
    "doi_tuong_id" TEXT,
    "truoc" JSONB,
    "sau" JSONB,

    CONSTRAINT "nhat_ky_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lua_ma_key" ON "lua"("ma");

-- CreateIndex
CREATE UNIQUE INDEX "mon_ma_key" ON "mon"("ma");

-- CreateIndex
CREATE UNIQUE INDEX "nguoi_dung_gmail_key" ON "nguoi_dung"("gmail");

-- CreateIndex
CREATE UNIQUE INDEX "hoc_sinh_ma_hs_key" ON "hoc_sinh"("ma_hs");

-- CreateIndex
CREATE UNIQUE INDEX "hoc_sinh_gmail_key" ON "hoc_sinh"("gmail");

-- CreateIndex
CREATE UNIQUE INDEX "hoc_sinh_username_azota_key" ON "hoc_sinh"("username_azota");

-- CreateIndex
CREATE UNIQUE INDEX "ghi_danh_ma_gd_key" ON "ghi_danh"("ma_gd");

-- CreateIndex
CREATE INDEX "ghi_danh_hoc_sinh_id_mon_id_idx" ON "ghi_danh"("hoc_sinh_id", "mon_id");

-- CreateIndex
CREATE INDEX "buoi_hoc_ngay_idx" ON "buoi_hoc"("ngay");

-- CreateIndex
CREATE UNIQUE INDEX "buoi_hoc_mon_id_bat_dau_luc_key" ON "buoi_hoc"("mon_id", "bat_dau_luc");

-- CreateIndex
CREATE INDEX "diem_danh_hoc_sinh_id_idx" ON "diem_danh"("hoc_sinh_id");

-- CreateIndex
CREATE UNIQUE INDEX "don_dang_ky_ma_yeu_cau_key" ON "don_dang_ky"("ma_yeu_cau");

-- CreateIndex
CREATE INDEX "nhat_ky_doi_tuong_doi_tuong_id_idx" ON "nhat_ky"("doi_tuong", "doi_tuong_id");

-- CreateIndex
CREATE INDEX "nhat_ky_nguoi_dung_id_idx" ON "nhat_ky"("nguoi_dung_id");

-- AddForeignKey
ALTER TABLE "phan_cong" ADD CONSTRAINT "phan_cong_nguoi_dung_id_fkey" FOREIGN KEY ("nguoi_dung_id") REFERENCES "nguoi_dung"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "phan_cong" ADD CONSTRAINT "phan_cong_mon_id_fkey" FOREIGN KEY ("mon_id") REFERENCES "mon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hoc_sinh" ADD CONSTRAINT "hoc_sinh_lua_id_fkey" FOREIGN KEY ("lua_id") REFERENCES "lua"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ghi_danh" ADD CONSTRAINT "ghi_danh_hoc_sinh_id_fkey" FOREIGN KEY ("hoc_sinh_id") REFERENCES "hoc_sinh"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ghi_danh" ADD CONSTRAINT "ghi_danh_mon_id_fkey" FOREIGN KEY ("mon_id") REFERENCES "mon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buoi_hoc" ADD CONSTRAINT "buoi_hoc_mon_id_fkey" FOREIGN KEY ("mon_id") REFERENCES "mon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buoi_hoc" ADD CONSTRAINT "buoi_hoc_bu_cho_buoi_id_fkey" FOREIGN KEY ("bu_cho_buoi_id") REFERENCES "buoi_hoc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diem_danh" ADD CONSTRAINT "diem_danh_buoi_id_fkey" FOREIGN KEY ("buoi_id") REFERENCES "buoi_hoc"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diem_danh" ADD CONSTRAINT "diem_danh_hoc_sinh_id_fkey" FOREIGN KEY ("hoc_sinh_id") REFERENCES "hoc_sinh"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "don_dang_ky" ADD CONSTRAINT "don_dang_ky_hoc_sinh_id_fkey" FOREIGN KEY ("hoc_sinh_id") REFERENCES "hoc_sinh"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Ràng buộc nghiệp vụ (chuyen-du-lieu.md mục 3; Prisma không tả được) ──
ALTER TABLE "lua" ADD CONSTRAINT "lua_den_ngay_check" CHECK ("den_ngay" IS NULL OR "den_ngay" >= "tu_ngay");
ALTER TABLE "mon" ADD CONSTRAINT "mon_thu_check" CHECK (cardinality("thu") > 0 AND "thu" <@ ARRAY[1,2,3,4,5,6,7]::smallint[]);
ALTER TABLE "mon" ADD CONSTRAINT "mon_gio_check" CHECK ("gio_bat_dau" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "mon" ADD CONSTRAINT "mon_so_phut_check" CHECK ("so_phut" > 0);
ALTER TABLE "hoc_sinh" ADD CONSTRAINT "hoc_sinh_ma_check" CHECK ("ma_hs" ~ '^HS[0-9]{4,}$');
ALTER TABLE "ghi_danh" ADD CONSTRAINT "ghi_danh_thu_co_den_ngay" CHECK ("loai" <> 'thu' OR "den_ngay" IS NOT NULL);
ALTER TABLE "ghi_danh" ADD CONSTRAINT "ghi_danh_don_gia_check" CHECK ("don_gia_rieng" IS NULL OR "don_gia_rieng" > 0);
-- Huỷ trước khi bắt đầu giữ den_ngay = tu_ngay - 1 (ghi-danh.md 3.4) nên chỉ kiểm khi chưa huỷ.
ALTER TABLE "ghi_danh" ADD CONSTRAINT "ghi_danh_ngay_check" CHECK ("huy_luc" IS NOT NULL OR "den_ngay" IS NULL OR "den_ngay" >= "tu_ngay");
-- Không chồng ngày: cùng em, cùng môn (ghi-danh.md 3.3).
ALTER TABLE "ghi_danh" ADD CONSTRAINT "ghi_danh_khong_chong_ngay" EXCLUDE USING gist (
  "hoc_sinh_id" WITH =, "mon_id" WITH =, daterange("tu_ngay", "den_ngay", '[]') WITH &&
) WHERE ("huy_luc" IS NULL);
ALTER TABLE "buoi_hoc" ADD CONSTRAINT "buoi_hoc_ngay_check" CHECK ("ngay" = ("bat_dau_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date);
ALTER TABLE "buoi_hoc" ADD CONSTRAINT "buoi_hoc_huy_co_ly_do" CHECK ("trang_thai" <> 'huy' OR coalesce(btrim("ly_do_huy"), '') <> '');
ALTER TABLE "buoi_hoc" ADD CONSTRAINT "buoi_hoc_noi_dung_check" CHECK ("noi_dung" IS NULL OR char_length("noi_dung") <= 2000);
ALTER TABLE "buoi_hoc" ADD CONSTRAINT "buoi_hoc_record_check" CHECK ("link_record" IS NULL OR "link_record" LIKE 'https://%');
ALTER TABLE "buoi_hoc" ADD CONSTRAINT "buoi_hoc_so_phut_check" CHECK ("so_phut" > 0);
ALTER TABLE "diem_danh" ADD CONSTRAINT "diem_danh_ghi_chu_check" CHECK ("ghi_chu" IS NULL OR char_length("ghi_chu") <= 500);
