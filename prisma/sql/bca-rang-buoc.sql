-- KiN lớp bước 1 (27/11/2026): ràng buộc của các bảng bca_* mà `prisma db push` KHÔNG tạo được (CHECK, EXCLUDE gist, extension btree_gist).
-- Nguồn: bca-midnight/bca/prisma/migrations/20261126130604_khoi_tao/migration.sql (phần "Ràng buộc nghiệp vụ"), đổi tên bảng sang bca_*.
-- Chạy SAU khi `db push` đã tạo bảng bca_*. Chạy lại an toàn: ràng buộc đã có thì bỏ qua. Chỉ đụng bảng bca_*, không đụng bảng nào của KiN.
-- Tên ràng buộc có tiền tố bca_ (tên ràng buộc EXCLUDE là tên chỉ mục, phải duy nhất trong cả schema).
-- CHƯA kiểm trên DB nào: phải thử trên nhánh Neon trước, kể cả việc `db push` lần sau có xoá ràng buộc tay này không (docs/kin/lop/README.md mục 2, bước 1).

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('bca_lua',       'bca_lua_den_ngay_check',        $c$CHECK ("den_ngay" IS NULL OR "den_ngay" >= "tu_ngay")$c$),
      ('bca_mon',       'bca_mon_thu_check',             $c$CHECK (cardinality("thu") > 0 AND "thu" <@ ARRAY[1,2,3,4,5,6,7]::smallint[])$c$),
      ('bca_mon',       'bca_mon_gio_check',             $c$CHECK ("gio_bat_dau" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')$c$),
      ('bca_mon',       'bca_mon_so_phut_check',         $c$CHECK ("so_phut" > 0)$c$),
      ('bca_hoc_sinh',  'bca_hoc_sinh_ma_check',         $c$CHECK ("ma_hs" ~ '^HS[0-9]{4,}$')$c$),
      ('bca_ghi_danh',  'bca_ghi_danh_thu_co_den_ngay',  $c$CHECK ("loai" <> 'thu' OR "den_ngay" IS NOT NULL)$c$),
      ('bca_ghi_danh',  'bca_ghi_danh_don_gia_check',    $c$CHECK ("don_gia_rieng" IS NULL OR "don_gia_rieng" > 0)$c$),
      -- Huỷ trước khi bắt đầu giữ den_ngay = tu_ngay - 1 (ghi-danh.md 3.4) nên chỉ kiểm khi chưa huỷ.
      ('bca_ghi_danh',  'bca_ghi_danh_ngay_check',       $c$CHECK ("huy_luc" IS NOT NULL OR "den_ngay" IS NULL OR "den_ngay" >= "tu_ngay")$c$),
      -- Không chồng ngày: cùng em, cùng môn (ghi-danh.md 3.3).
      ('bca_ghi_danh',  'bca_ghi_danh_khong_chong_ngay', $c$EXCLUDE USING gist ("hoc_sinh_id" WITH =, "mon_id" WITH =, daterange("tu_ngay", "den_ngay", '[]') WITH &&) WHERE ("huy_luc" IS NULL)$c$),
      ('bca_buoi_hoc',  'bca_buoi_hoc_ngay_check',       $c$CHECK ("ngay" = ("bat_dau_luc" AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)$c$),
      ('bca_buoi_hoc',  'bca_buoi_hoc_huy_co_ly_do',     $c$CHECK ("trang_thai" <> 'huy' OR coalesce(btrim("ly_do_huy"), '') <> '')$c$),
      ('bca_buoi_hoc',  'bca_buoi_hoc_noi_dung_check',   $c$CHECK ("noi_dung" IS NULL OR char_length("noi_dung") <= 2000)$c$),
      ('bca_buoi_hoc',  'bca_buoi_hoc_record_check',     $c$CHECK ("link_record" IS NULL OR "link_record" LIKE 'https://%')$c$),
      ('bca_buoi_hoc',  'bca_buoi_hoc_so_phut_check',    $c$CHECK ("so_phut" > 0)$c$),
      ('bca_diem_danh', 'bca_diem_danh_ghi_chu_check',   $c$CHECK ("ghi_chu" IS NULL OR char_length("ghi_chu") <= 500)$c$)
    ) AS t(bang, ten, dinh_nghia)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = r.ten AND conrelid = format('%I.%I', current_schema(), r.bang)::regclass
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I %s', r.bang, r.ten, r.dinh_nghia);
    END IF;
  END LOOP;
END $$;
