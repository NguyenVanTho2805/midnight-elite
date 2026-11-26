# Chuyển dữ liệu từ Google Sheet sang CSDL mới (Đợt 1)

Nguồn: bản xuất `.xlsx` của sheet ngày 26/11/2026 (41 tab), đọc bằng script chỉ in số đếm; `COLS`, `CFG_DEF`, `MON_DEF` và các hàm đọc bảng (`kin_students`, `kin_enrollments`, `kin_sessions`, `kin_ddMarks`, `kin_luuDiemDanh`, `kin_mons`, `kin_cfg`) trong script v8.12. Luật gốc: quyết định 1, 18 và 23.

**Tài liệu này không chứa dữ liệu cá nhân.** Mọi số ở đây là số đếm. Bản xuất sheet và mọi tệp trung gian **không được đưa vào kho mã**.

## 1. Nguyên tắc

1.1. Chuyển **một lần** (quyết định 1). Trước lần chuyển thật thì được chạy thử bao nhiêu lần cũng được, trên một DB thử, xoá làm lại thoải mái. Sau lần chuyển thật, sheet chỉ còn để lưu trữ.

1.2. Script chuyển phải đáp ứng:
- **Lặp lại an toàn:** dùng upsert theo khoá tự nhiên (mã HS, mã GD, (môn, giờ bắt đầu), (buổi, em), mã yêu cầu).
- **Có chế độ chạy khô:** chạy trong một transaction rồi rollback, chỉ in báo cáo đối soát.
- Chỉ in **số đếm và mã dòng** (số dòng trên sheet). Không in tên, SĐT hay Gmail.

1.3. Ô ngày trong sheet được script ghi kèm giờ **12:00** để khỏi lệch múi giờ. Trong bản xuất, cả 192 ô "Từ ngày", 46 ô ngày buổi, 55 ô ngày điểm danh và 70 ô ngày tạo đều mang giờ 12:00.
- **Chỉ lấy phần ngày**, không đổi múi giờ.
- Riêng cột "Thời gian" của 📥 Đăng ký là thời điểm thật: hiểu theo giờ `Asia/Ho_Chi_Minh` rồi mới lưu thành `timestamptz`.
- Nếu đọc qua Sheets API thay vì `.xlsx`, phải kiểm tra múi giờ của spreadsheet là `Asia/Ho_Chi_Minh` trước khi chạy.

1.4. Dữ liệu nhạy cảm trong ⚙️ Cài đặt (`STK`, `SDT_GS`) **không đi qua script chuyển**. Chủ tự nhập ở màn Cài đặt (Đợt 3).

## 2. Số dòng từng tab (bản xuất 26/11/2026, không tính dòng tiêu đề)

| Tab | Hiện/ẩn | Số dòng | Đợt | Xử lý |
|---|---|---|---|---|
| 👥 Học sinh | hiện | **70** | 1 | → `hoc_sinh` |
| 📝 Ghi danh | ẩn | **192** (152 Thử, 40 Chính thức) | 1 | → `ghi_danh` |
| 📅 Buổi học | ẩn | **46** (15 buổi tháng 11, 31 buổi tháng 12) | 1 | → `buoi_hoc` |
| __DiemDanh | ẩn | **55** (51 V, 4 P) | 1 | → `diem_danh` |
| ✅ Điểm danh (ma trận tháng 11) | hiện | 212 dòng có chữ; 4 khối môn (Toán 63 em, Sử 54, Địa 20, Anh 51) | 1 | chỉ đọc các dấu chưa lưu, gộp vào `diem_danh` |
| 📥 Đăng ký | ẩn | **154** | 1 (lưu lịch sử), dùng ở Đợt 4 | → `don_dang_ky` |
| 📚 Lứa | ẩn | **2** | 1 | → `lua` |
| ⚙️ Cài đặt | hiện | **31** khoá, cùng khối Môn **4** dòng | 1 | → `cai_dat`, `mon` |
| __DaXoa | ẩn | 34 dòng của 12 em đã xoá ngày 16/11 | — | Câu hỏi 2 |
| __Log | ẩn | 99 | — | không chuyển; giữ trên sheet |
| 🧾 Sổ điểm | ẩn | 40 | 3 | để Đợt 3 |
| 🧾 Phiếu học phí | ẩn | 20 | 3 | để Đợt 3 |
| 💳 Thu tiền | ẩn | 16 | 3 | để Đợt 3 |
| 🏆 Học bổng | ẩn | 0 | sau (quyết định 11) | — |
| __DieuChinhHP | ẩn | 4 | 3 | để Đợt 3 |
| 🌐 Lộ trình web | ẩn | 163 | 4 | để Đợt 4 |
| __EmailLog | ẩn | 81 | 4 | để Đợt 4 (cờ "Đã nhắn chào" đã có ở 👥) |
| 📋 Khảo Sát · 📥 KQ Khảo Sát Học Phí | ẩn | 1 · 6 | 4 | để Đợt 4 |
| Học Sinh Đã Điền Mẫu (Google Form cũ) | ẩn | 100 | — | không chuyển; đã có trong 📥 dưới dạng 100 đơn "Form cũ" |
| 🏠 Tổng quan · 📊 Điểm số · 📈 Dashboard học phí · 💰 Học phí | hiện | (tab xem) | — | không chuyển; web tự tính |
| __GiaoDien · __Public | ẩn | 8 · 3 | — | không chuyển (định dạng, bộ đệm web) |
| `__bk_*` (bản sao lưu tự động) | ẩn | 15 tab | — | không chuyển |

## 3. Bảng mới đề xuất (PostgreSQL trên Neon)

Tên bảng và cột viết tiếng Việt không dấu, kiểu `snake_case`. Khoá chính dùng `bigint generated always as identity`, trừ khi ghi khác. Mọi bảng đều có `tao_luc timestamptz default now()` và `cap_nhat_luc`.

### 3.1. `lua`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| ma | text | unique, not null (`L1`, `L2`) |
| ten | text | not null |
| tu_ngay | date | not null |
| den_ngay | date | null = còn mở; check `den_ngay >= tu_ngay` |
| ghi_chu | text | |

### 3.2. `mon`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | smallint | PK |
| ma | text | unique (`toan`, `su`, `dia`, `anh`) |
| ten_ngan | text | `Toán`, `Sử`, `Địa`, `Anh` (đúng chữ trên sheet) |
| ten_day_du | text | |
| thu | smallint[] | ISO 1–7, not null, không rỗng |
| gio_bat_dau | time | mặc định 22:15 |
| so_phut | smallint | mặc định 90, check > 0 |
| thu_tu | smallint | thứ tự hiển thị Toán → Sử → Địa → Anh |
| link_zalo, ten_lop_azota, link_meet | text | link_meet dùng ở Đợt 4 |
| si_so_toi_da | int | default 0 (0 = không giới hạn) |

### 3.3. `cai_dat`
`khoa text PK`, `gia_tri jsonb not null`, `ghi_chu text`. Danh sách khoá ở mục 4.6.

### 3.4. `nguoi_dung` và `phan_cong`
Không lấy từ sheet. Chủ tự tạo sau khi chuyển (xem `phan-quyen.md`).
- `nguoi_dung`: `id uuid PK`, `gmail citext unique not null`, `ten_hien_thi`, `vai_tro` (`chu` | `giao_vien`), `khoa_luc timestamptz null`.
- `phan_cong`: `(nguoi_dung_id, mon_id) PK`.

### 3.5. `hoc_sinh`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | bigint | PK |
| ma_hs | text | unique, not null, check `~ '^HS[0-9]{4,}$'` |
| ho_ten | text | not null |
| lua_id | FK `lua` | null được (báo "Sửa dữ liệu") |
| sdt_hs, sdt_ph | text | đã chuẩn hoá, null được |
| gmail | citext | unique khi khác null |
| truong, khoi, ho_ten_ph, muc_tieu, nguon | text | |
| username_azota | text | unique khi khác null |
| dong_y_vinh_danh, da_nhan_chao | boolean | default false |
| ghi_chu | text | hiện cho chủ |
| ghi_chu_rieng | text | lấy từ cột "Note"; chỉ chủ xem |
| ngay_tao | date | not null |
| so_du_dau_ky | bigint | đồng; default 0 (dùng ở Đợt 3) |
| an_luc | timestamptz | null = đang hiện |

### 3.6. `ghi_danh`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | bigint | PK |
| ma_gd | text | unique, not null (`GD00001`) |
| hoc_sinh_id | FK `hoc_sinh` | not null, `on delete restrict` |
| mon_id | FK `mon` | not null |
| loai | enum `thu` \| `chinh_thuc` | not null |
| tu_ngay | date | not null |
| den_ngay | date | null được; check `loai <> 'thu' or den_ngay is not null` |
| huy_luc | timestamptz | khác null = huỷ trước khi bắt đầu |
| mien_phi | boolean | default false |
| don_gia_rieng | int | null, check > 0 |
| ghi_chu | text | |
| tao_boi | FK `nguoi_dung` | null = nhập từ sheet |

Ràng buộc chống chồng ngày (cần extension `btree_gist`, Neon có hỗ trợ):
```sql
EXCLUDE USING gist (hoc_sinh_id WITH =, mon_id WITH =,
  daterange(tu_ngay, den_ngay, '[]') WITH &&) WHERE (huy_luc IS NULL)
```

### 3.7. `buoi_hoc`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| id | bigint | PK |
| mon_id | FK `mon` | not null |
| ngay | date | not null; check `ngay = (bat_dau_luc AT TIME ZONE 'Asia/Ho_Chi_Minh')::date` |
| bat_dau_luc | timestamptz | not null; **unique (mon_id, bat_dau_luc)** |
| so_phut | smallint | not null |
| loai | enum `theo_lich` \| `hoc_bu` | |
| trang_thai | enum `binh_thuong` \| `huy` | |
| ly_do_huy | text | bắt buộc khi `huy` |
| bu_cho_buoi_id | FK `buoi_hoc` | null |
| noi_dung | text | ≤ 2.000 ký tự |
| link_record | text | check bắt đầu bằng `https://` |
| ghi_chu | text | |
| da_diem_danh_luc | timestamptz | null = chưa điểm danh xong |

### 3.8. `diem_danh`
| Cột | Kiểu | Ràng buộc |
|---|---|---|
| buoi_id | FK `buoi_hoc` | PK (buoi_id, hoc_sinh_id) |
| hoc_sinh_id | FK `hoc_sinh` | |
| trang_thai | enum `co` \| `phep` \| `vang` | not null |
| ghi_luc | timestamptz | not null |
| ghi_boi | FK `nguoi_dung` | null = nhập từ sheet |
| nguon | enum `sheet` \| `web` | |

### 3.9. `don_dang_ky`
Các cột: `thoi_gian timestamptz`, `nguon`, `loai`, `ho_ten`, `sdt_hs`, `gmail`, `truong`, `khoi`, `ho_ten_ph`, `sdt_ph`, `mon_ids smallint[]`, `muc_tieu`, `biet_qua`, `da_hoc_thu`, `dong_y`, `dong_y_vinh_danh`, `ma_yeu_cau text unique`, `trang_thai` (enum `moi`, `cho_duyet`, `da_nhan`, `trung`, `bo_qua`, `lead_cu`), `hoc_sinh_id FK null`, `ma_hs_cu text`, `ghi_chu_xu_ly`, `loi_du_lieu text[]`.

### 3.10. `bo_dem` và `nhat_ky`
- `bo_dem(khoa text PK, gia_tri int)`: lưu số cuối của mã HS (`hs`) và mã GD (`gd`). Cấp mã mới bằng `UPDATE … RETURNING` trong cùng transaction, để mã **không bao giờ cấp lại** (`ghi-danh.md` Điều 1.1).
- `nhat_ky`: `id`, `luc timestamptz`, `nguoi_dung_id null`, `vai_tro`, `hanh_dong`, `doi_tuong`, `doi_tuong_id`, `truoc jsonb`, `sau jsonb`.

## 4. Ánh xạ từng tab

### 4.1. 👥 Học sinh (30 cột) → `hoc_sinh`
| Cột sheet | Cột mới | Biến đổi / ghi chú (số đếm 26/11) |
|---|---|---|
| Mã HS | ma_hs | Giữ nguyên. 70 mã, dạng `HS9999`, không trùng, lớn nhất HS0083. |
| Họ tên | ho_ten | Cắt khoảng trắng; không tự viết hoa (có 2 tên bắt đầu bằng chữ thường, báo cho chủ). |
| Lứa | lua_id | Tra theo mã lứa: L1 có 20 em, L2 có 50 em. |
| Toán / Sử / Địa / Anh | — | Không lưu; chỉ dùng để **đối soát** (mục 6). |
| Tình trạng, Chuyên cần, ĐTB, Còn nợ, Email, Zalo HS, Zalo PH | — | Cột tính, không lưu. "Còn nợ" dùng đối soát ở Đợt 3 (68 em 0đ, 2 em có nợ). |
| Đã nhắn chào | da_nhan_chao | 69 có, 1 chưa. |
| SĐT HS | sdt_hs | Chuẩn hoá (`ghi-danh.md` Điều 1.3). 70/70 hợp lệ, không trùng. |
| Note | ghi_chu_rieng | 49 ô có chữ. Chỉ chủ xem. |
| Gmail | gmail | Đổi chữ thường. 70/70 hợp lệ, đều đuôi gmail.com, không trùng. |
| Họ tên PH / SĐT PH | ho_ten_ph / sdt_ph | 17 và 20 ô có giá trị; SĐT PH 20/20 hợp lệ. |
| Trường, Mục tiêu, Nguồn | như tên | Giữ nguyên chữ. |
| Khối | khoi | Giữ nguyên chữ: "Khối 12 (2K9)" 46, "Khối 12" 19, "Thí sinh tự do" 5. |
| Username Azota | username_azota | 70 ô, dạng chữ thường kèm 4 số. |
| Đồng ý vinh danh | dong_y_vinh_danh | 37 có. |
| Ghi chú | ghi_chu | Cả 70 ô trống. |
| Ngày tạo | ngay_tao | Lấy phần ngày. Trùng với ngày ghi danh sớm nhất ở cả 70/70 em. |
| Số dư đầu kỳ | so_du_dau_ky | Cả 70 ô = 0. |
| Nghỉ/ẩn | an_luc | `true` thì đặt bằng thời điểm chuyển. Hiện cả 70 ô đều `false`. |

### 4.2. 📝 Ghi danh (11 cột) → `ghi_danh`
| Cột sheet | Cột mới | Biến đổi |
|---|---|---|
| Mã GD | ma_gd | Giữ. 192 mã, không trùng, lớn nhất GD00211. |
| Mã HS | hoc_sinh_id | Tra theo `ma_hs`. **4 dòng (của 1 em) không có hồ sơ:** Câu hỏi 1. |
| Họ tên | — | Bỏ, vì đã có ở hồ sơ (0 dòng lệch tên). |
| Môn | mon_id | Nhận dạng tên môn giống `K.tachMon`. Toán 64, Sử 55, Anh 52, Địa 21. |
| Loại | loai | Khớp regex `/th[uử]/i` thì là `thu`, còn lại là `chinh_thuc`. |
| Từ ngày / Học đến hết ngày | tu_ngay / den_ngay | Lấy phần ngày. Có 40 ô `den_ngay` trống, đều là ghi danh Chính thức. |
| (đến < từ) | huy_luc | Đặt bằng thời điểm chuyển, giữ nguyên hai ngày. Hiện có 0 dòng như vậy. |
| Miễn phí | mien_phi | Cả 192 dòng `false`. |
| Đơn giá riêng | don_gia_rieng | Cả 192 ô trống. |
| Ghi chú | ghi_chu | Cả 192 ô trống. |
| Trạng thái hôm nay* | — | Cột tính; chỉ đối soát. |

Số liệu kiểm tra ngày 26/11: 0 cặp chồng ngày; mỗi cặp (em, môn) chỉ có 1 dòng; tất cả 152 dòng Thử dài đúng 14 ngày; mỗi em thử chỉ có 1 cửa sổ thử.
Có 34 ghi danh Chính thức bắt đầu ngày 30/06/2026 (ngoài ra 23/07, 24/08, 27/09 và 30/09). Các ngày này **giữ nguyên**; học phí vẫn chỉ tính từ `NGAY_BAT_DAU_TINH_PHI` = 16/11/2026.

### 4.3. 📅 Buổi học (8 cột) → `buoi_hoc`
| Cột sheet | Cột mới | Biến đổi |
|---|---|---|
| Ngày | ngay | Phần ngày. Có 46 buổi, từ 16/11 đến 31/12. |
| Thứ | — | Chỉ để kiểm tra (0 dòng lệch so với ngày). |
| Môn | mon_id | |
| (tính) | bat_dau_luc | `ngay` + `mon.gio_bat_dau` (22:15) theo giờ `Asia/Ho_Chi_Minh`. Buổi "Học bù" không có cột giờ: dùng 22:15 và **báo chủ kiểm tra lại** (hiện có 0 buổi học bù). |
| (tính) | so_phut | `mon.so_phut` (90). |
| Trạng thái | loai, trang_thai | Có học → `theo_lich`/`binh_thuong`; Nghỉ → `theo_lich`/`huy` với lý do "chuyển từ sheet"; Học bù → `hoc_bu`/`binh_thuong`. Hiện cả 46 buổi là "Có học". |
| Đã điểm danh | da_diem_danh_luc | Tick (5 buổi) thì đặt `ngay 23:45 +07`, vì sheet không lưu giờ điểm danh thật. |
| Nội dung buổi / Link record / Ghi chú | noi_dung / link_record / ghi_chu | Cả 46 dòng đều trống. Link thiếu `https://` thì thêm vào. |

Kiểm tra: không có (môn, ngày) nào trùng; 0 buổi nằm ngoài lịch của môn; số buổi khớp đúng kết quả sinh theo lịch từ 16/11 (`buoi-hoc.md` Điều 3).

### 4.4. __DiemDanh và ✅ Điểm danh → `diem_danh`

Thuật toán:
1. Đọc `__DiemDanh` thành tập dấu theo khoá (ngày, môn, mã HS).
2. Đọc ma trận ✅ Điểm danh. Ô của tháng đang hiện (B2 = `11/2026`) có `V`/`v`/`P`/`p` thì gộp vào tập dấu: ma trận thắng nếu khác. Ô có ký tự lạ thì đưa vào danh sách lỗi.
3. Với mỗi buổi: lấy danh sách em theo `diem-danh.md` Điều 2, chỉ gồm em có hồ sơ.
   - Buổi **đã tick**: em có dấu V thì `vang`, dấu P thì `phep`, không có dấu thì **`co`**.
   - Buổi **chưa tick**: chỉ tạo bản ghi cho em có dấu, và chỉ khi chủ chọn A ở Câu hỏi 3. Khi đó em không có dấu cũng thành `co`.
4. Dấu thuộc em hoặc buổi không còn tồn tại thì báo lỗi, không nhập. Hiện có 0 trường hợp.
5. Đặt `da_diem_danh_luc` khi mọi em trong danh sách đều có bản ghi.

Số bản ghi dự kiến từ bản xuất 26/11:

| Buổi | Danh sách | Có | Phép | Vắng |
|---|---|---|---|---|
| Anh 16/11 (đã tick) | 37 | 37 | 0 | 0 |
| Toán 17/11 (đã tick) | 59 | 59 | 0 | 0 |
| Sử 18/11 (đã tick) | 51 | 51 | 0 | 0 |
| Anh 19/11 (đã tick) | 49 | 31 | 3 | 15 |
| Sử 22/11 (đã tick) | 53 | 16 | 1 | 36 |
| **Cộng (5 buổi đã tick)** | **249** | **194** | **4** | **51** |
| Sử 25/11 (chưa tick, 39 dấu chưa lưu) — nếu Câu hỏi 3 chọn A | 54 | 15 | 4 | 35 |
| **Cộng nếu nhận buổi 25/11** | **303** | **209** | **8** | **86** |

Các buổi đã qua nhưng chưa tick và không có dấu (20/11 Địa, 21/11 Toán, 23/11 Anh, 24/11 Toán) thì không tạo bản ghi. Sau khi chuyển, các buổi này hiện ở việc "Buổi chưa điểm danh".

### 4.5. 📥 Đăng ký (21 cột) → `don_dang_ky`
| Cột sheet | Cột mới | Biến đổi / số đếm |
|---|---|---|
| Thời gian | thoi_gian | Giờ Việt Nam → `timestamptz`. Từ 30/06 đến 25/11/2026. |
| Nguồn | nguon | Form cũ 100, Web 54. |
| Loại | loai | Học thử 121, Chính thức 33. |
| SĐT HS / SĐT PH | sdt_hs / sdt_ph | Chuẩn hoá. Có 1 SĐT HS chỉ 9 số, sẽ thêm số 0. |
| Gmail | gmail | Chữ thường. 67 ô trống, đều là đơn Form cũ: để null. |
| Khối | khoi | Có 1 ô là số `12`, đổi thành "Khối 12". |
| Họ tên PH | ho_ten_ph | Có 3 ô là **số** (nghi điền nhầm SĐT vào ô tên): giữ nguyên dạng chữ, thêm `loi_du_lieu`, không chép sang hồ sơ. |
| Môn | mon_ids | Tách theo dấu phẩy. Cả 154 ô đều khớp 4 môn chuẩn. |
| Mã yêu cầu | ma_yeu_cau | Unique; 0 trùng. |
| Trạng thái | trang_thai | Đã nhận 91 → `da_nhan`; Lead cũ 59 → `lead_cu`; Trùng 2 → `trung`; Bỏ qua 1 → `bo_qua`; Chờ duyệt 1 → `cho_duyet`. |
| Mã HS | hoc_sinh_id, ma_hs_cu | 91 ô có mã. Có **12 mã** không còn hồ sơ (11 em ở `__DaXoa`, 1 em là hồ sơ mồ côi): `hoc_sinh_id` = null, giữ mã cũ trong `ma_hs_cu`. |
| Ghi chú xử lý, Đồng ý, Đồng ý vinh danh, Mục tiêu, Biết qua, Đã học thử, Trường, Họ tên | như tên | Giữ nguyên. "Đã học thử" trống ở cả 154 đơn. |
| Chọn | — | Bỏ (ô tick tạm của sheet). |

Có 10 SĐT xuất hiện ở nhiều đơn (cùng em gửi nhiều lần). Đây là chuyện bình thường; **không gộp đơn**.

### 4.6. ⚙️ Cài đặt → `cai_dat` và `mon`
| Khoá | Xử lý |
|---|---|
| TEN_LOP, TEN_KHOA_MOI, GIA_SU, LINK_CAM_KET, ZALO_CHUNG, ZALO_HOC_THU, EMAIL_TEN_NGUOI_GUI | Chép sang `cai_dat`. |
| GIA_1_MON = 65000, GIA_TU_2_MON = 55000, HAN_DONG_NGAY = 20, HAN_DONG_THANG = "Cùng tháng" | Chép sang (dùng ở Đợt 3). |
| NGAY_BAT_DAU_TINH_PHI = 16/11/2026 | Chép sang dạng `date`. Dùng cho cả sinh buổi lẫn học phí. |
| SO_NGAY_HOC_THU = 14, SI_SO_TOI_DA = 0 | Chép sang. |
| TANG_HOC_THU_CHO_CT_MOI = Có | Chép sang, nhưng cách dùng chờ chủ trả lời `ghi-danh.md` Câu hỏi 3. |
| TU_XOA_HS_NGHI | **Không có trong sheet**, nên lấy mặc định "Không". Chờ `ghi-danh.md` Câu hỏi 7. |
| GIO_MEET = 22:15, SO_PHUT = 90 | Thành giá trị mặc định của `mon.gio_bat_dau` và `mon.so_phut`. |
| TI_LE_BUOI_XET_HB, AZOTA_TIEN_TO, KHOA_AZOTA | Chép sang (dùng ở Đợt 3 hoặc sau). |
| MEET_GUI_EMAIL, EMAIL_TU_DONG_CHAO, EMAIL_MOI_MEET, PHIEN_BAN_DIEU_KHOAN | Chép sang (dùng ở Đợt 4). |
| EMAIL_GIAO_VIEN | Bỏ (đang trống). Thay bằng bảng `nguoi_dung`. |
| TU_NHAN_HOC_THU, TU_NHAN_TOI_DA_NGAY, ID_FILE_V7, LINK_LANDING | Bỏ: script ghi "không còn dùng"; GitHub Pages cũng bỏ theo quyết định 9. |
| STK, SDT_GS | **Không chuyển bằng script.** Chủ tự nhập. |

Khối Môn (4 dòng) → `mon`. Ánh xạ thứ: `iso = sheet − 1`. Cột "Giáo viên" chỉ là tên, nên không tạo tài khoản; chủ tạo GV rồi phân công.
Tiêu đề cột "Sĩ số tối đa" **không có** trong bản xuất (đã bị xoá khi bỏ giới hạn sĩ số), nên `si_so_toi_da` = 0. Cột "Link Zalo nhóm môn" và "Tên lớp Azota" đều trống.

### 4.7. 📚 Lứa → `lua`
2 dòng: L1 01/06–31/10/2026; L2 từ 01/11/2026, chưa có ngày kết thúc.

### 4.8. Bộ đếm mã
- `bo_dem.hs` = max(số trong Mã HS ở 👥, 📝, 📥, __DaXoa) = **83**. Em mới sẽ nhận HS0084.
- `bo_dem.gd` = max(Mã GD ở 📝 và trong JSON của __DaXoa) = **211**.
- Thuộc tính ẩn `KIN_MAX_HS`/`KIN_MAX_GD` của script không có trong bản xuất. Script chỉ ghi các thuộc tính này lúc xoá em (ngày 16/11), khi mã lớn nhất còn nhỏ hơn hiện tại, nên lấy max như trên là an toàn.

## 5. Quy tắc xử lý dòng thiếu, trùng, sai định dạng

| Tình huống | Cách xử lý |
|---|---|
| Dòng trống hoàn toàn | Bỏ qua, không báo. |
| Thiếu Mã HS ở 👥 | Không nhập; báo lỗi kèm số dòng trên sheet. |
| Trùng Mã HS hoặc Mã GD | Dừng cả lần chuyển (cần chủ xem). Hiện có 0 trường hợp. |
| Ghi danh trỏ Mã HS không có hồ sơ | Không nhập; đưa vào danh sách chờ (Câu hỏi 1). Hiện có 4 dòng. |
| Ghi danh chồng ngày | Dừng cả lần chuyển, vì CSDL sẽ chặn. Hiện có 0 trường hợp. |
| Ngày không đọc được (không phải Date, không theo `dd/MM/yyyy` hay `yyyy-MM-dd`) | Không nhập dòng đó; báo lỗi. Hiện có 0 trường hợp. |
| SĐT không hợp lệ sau chuẩn hoá | Vẫn nhập; báo "Sửa dữ liệu" ở màn Hôm nay. Hiện có 0 trường hợp ở 👥. |
| Gmail sai hoặc nghi gõ nhầm | Vẫn nhập, không tự sửa; báo "Sửa dữ liệu". Hiện có 0 trường hợp. |
| Hai hồ sơ trùng Gmail (khi cùng khác null) | Dừng cả lần chuyển. Hiện có 0 trường hợp. |
| Tên môn lạ (không nhận dạng được) | Không nhập dòng đó; báo lỗi. Hiện có 0 trường hợp. |
| Ký hiệu điểm danh lạ | Không nhập; báo lỗi (`diem-danh.md` Điều 7). Hiện có 0 trường hợp. |
| Ô chữ bắt đầu bằng `=`, `+`, `-` hoặc `@` (`K.safe` của script đã thêm dấu nháy để chặn công thức) | Nhập dạng chữ. Nếu giá trị đọc ra còn dấu nháy `'` ở đầu thì bỏ dấu đó. Khi xuất ngược ra CSV hay sheet thì phải chặn công thức lại. |

## 6. Thứ tự chạy và đối soát

### 6.1. Trước khi chạy thật
1. Báo GV ngừng sửa sheet.
2. Chủ bấm ♻️ Làm mới (để lưu điểm danh). Dù không bấm thì script chuyển vẫn đọc ma trận.
3. Xuất `.xlsx`, hoặc dùng Sheets API đọc chỉ-đọc.
4. Ghi lại **thời điểm chốt**.

### 6.2. Thứ tự nhập (trong một transaction)
1. `lua`, `mon`, `cai_dat`;
2. `hoc_sinh` và `bo_dem.hs`;
3. `ghi_danh` và `bo_dem.gd`;
4. `buoi_hoc`;
5. `diem_danh`;
6. `don_dang_ky`.

### 6.3. Đối soát bắt buộc
Lệch bất kỳ số nào thì rollback. Các số dưới đây tính cho bản xuất ngày 26/11; lần chạy thật phải tính lại trên bản xuất mới.

| Kiểm tra | Kỳ vọng (26/11) |
|---|---|
| Số dòng `lua` / `mon` / `hoc_sinh` | 2 / 4 / 70 (thành 71 nếu Câu hỏi 1 chọn A) |
| Số dòng `ghi_danh` | 188, hoặc 192 nếu Câu hỏi 1 chọn A |
| Số dòng `buoi_hoc` | 46; theo môn: Toán 13, Sử 13, Địa 6, Anh 14 |
| Số dòng `diem_danh` | 249 (194 Có, 4 Phép, 51 Vắng), hoặc 303 nếu Câu hỏi 3 chọn A |
| Số dòng `don_dang_ky` | 154 |
| Tính lại ô môn Học/Thử/Nghỉ cho 70 em × 4 môn theo **ngày của thời điểm chốt** rồi so với sheet | 0 ô lệch (đã thử: 0/280) |
| Phân bố tình trạng | 20 "Đang học"; thử đến 28/11: 16, 29/11: 17, 30/11: 13, 01/12: 1, 05/12: 2, 08/12: 1 |
| Sĩ số từng buổi tháng 11 so với số dòng của khối môn trên ma trận | Toán 63, Sử 54, Địa 20, Anh 51 em trong tháng |

### 6.4. Sau khi chuyển thật
- Tắt các trigger tự động của Apps Script (menu "Tắt tự động" / `kinTatTuDong`), để sheet không còn tự nhận đơn, sinh buổi, gửi email hay đồng bộ Meet song song với web.
- Đặt sheet ở chế độ chỉ xem.
- Đơn mới đến trong giai đoạn trước Đợt 4: xem Câu hỏi 4.

## Khác sheet
- Web lưu lịch sử bằng nhật ký và các cờ (`huy_luc`, `an_luc`) thay cho các tab sao lưu `__bk_*`.
- "Chưa điểm danh" và "có mặt" là hai trạng thái tách biệt (`diem-danh.md` K1). Chỉ những buổi sheet đã tick mới được suy ra "Có".
- Mã HS và mã GD giữ nguyên để tra chéo với sheet lưu trữ.

## Câu hỏi cho chủ

1. **1 em có 4 ghi danh thử còn mở (đến sau 26/11) nhưng mất dòng ở 👥 Học sinh.** Em không có trong `__DaXoa`; có 1 đơn web "Đã nhận" ngày 17/11.
   - A. Dựng lại hồ sơ từ đơn đăng ký (họ tên, SĐT, Gmail), giữ nguyên mã cũ, nhập cả 4 ghi danh. Các buổi đã điểm danh trước đó để "thiếu 1 em", chủ tự quyết. **(khuyên dùng: em vẫn đang trong hạn thử)**
   - B. Bỏ 4 ghi danh đó, coi như em đã bị xoá.
   - C. Chủ xem lại sheet, tự thêm lại dòng hồ sơ, rồi mới chạy chuyển dữ liệu.
2. **12 em đã xoá ngày 16/11 (34 dòng trong `__DaXoa`):**
   - A. Không chuyển; dữ liệu vẫn nằm trên sheet lưu trữ. **(khuyên dùng: ít dữ liệu cá nhân hơn trên hệ thống mới)**
   - B. Chuyển vào một bảng lưu trữ riêng, chỉ chủ xem được.
3. **Buổi Sử 25/11: GV đã gõ 39 dấu (35 vắng, 4 phép) nhưng chưa tick "Đã điểm danh" và dấu chưa được lưu.**
   - A. Coi buổi này đã điểm danh: nhận 39 dấu, 15 em còn lại là Có. **(khuyên dùng: rõ ràng GV đã điểm danh buổi này)**
   - B. Chỉ nhận 39 dấu Vắng/Phép; 15 em còn lại để "chưa điểm danh", GV bổ sung trên web.
   - C. Bỏ hết; GV điểm danh lại trên web.
4. **Khi nào chuyển dữ liệu thật?** Từ Đợt 1 đến Đợt 3, web chưa có form đăng ký (Đợt 4), nên đơn mới vẫn vào sheet.
   - A. Chạy thử nhiều lần trên DB thử trong suốt Đợt 1–3; chuyển thật **một lần** khi web đã nhận được đơn (cuối Đợt 4) hoặc khi chủ quyết định. **(khuyên dùng: đúng "chuyển một lần" của quyết định 1)**
   - B. Chuyển thật ngay cuối Đợt 1; đơn mới ở sheet được nhập bổ sung theo mã yêu cầu cho tới Đợt 4.
   - C. Chuyển thật cuối Đợt 1, và làm ngay một form đơn giản trên web để thay sheet.
