# Xem trước sitemap.xml và robots.txt của Tin tức (BU-07) — chờ chủ duyệt, 05/11/2026

**Chưa đổi gì.** Mã sinh hai tệp này là `src/app/sitemap.ts` và `src/app/robots.ts` (có từ trước, không sửa trong đợt này). Dưới đây là nội dung THẬT do máy chủ dev (cổng 3194, DB riêng `kin_wt_hs0511`) trả về khi gọi `GET /sitemap.xml` và `GET /robots.txt`, trên dữ liệu mẫu gồm:

- 5 bài: `diem-chuan-dh-2026` (đã đăng), `meo-on-thi` (đã đăng, mục Học tập), `tieng-viet co dau & ký tự` (đã đăng, slug có dấu cách và ký tự đặc biệt), `ban-nhap-chua-dang` (nháp), `hen-gio-tuan-sau` (hẹn giờ 7 ngày nữa).
- 2 khoá học: `toan-9-co-lan` (`status=true`, đang mở) và `khoa-an` (`status=false`, ẩn).

Địa chỉ gốc `https://midnightelite-edu.com` lấy từ `siteUrl()` (không phụ thuộc cổng/tên miền đang chạy).

## 1. sitemap.xml (tên miền chính, HTTP 200, application/xml)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url>
<loc>https://midnightelite-edu.com</loc>
</url>
<url>
<loc>https://midnightelite-edu.com/tin-tuc</loc>
</url>
<url>
<loc>https://midnightelite-edu.com/khoa-hoc</loc>
</url>
<url>
<loc>https://midnightelite-edu.com/giang-vien</loc>
</url>
<url>
<loc>https://midnightelite-edu.com/diem-chuan</loc>
</url>
<url>
<loc>https://midnightelite-edu.com/chinh-sach</loc>
</url>
<url>
<loc>https://midnightelite-edu.com/tin-tuc/tieng-viet%20co%20dau%20%26%20k%C3%BD%20t%E1%BB%B1</loc>
<lastmod>2026-11-05T13:43:36.667Z</lastmod>
</url>
<url>
<loc>https://midnightelite-edu.com/tin-tuc/meo-on-thi</loc>
<lastmod>2026-11-05T13:43:36.660Z</lastmod>
</url>
<url>
<loc>https://midnightelite-edu.com/tin-tuc/diem-chuan-dh-2026</loc>
<lastmod>2026-11-05T13:43:36.657Z</lastmod>
</url>
<url>
<loc>https://midnightelite-edu.com/khoa-hoc/toan-9-co-lan</loc>
</url>
</urlset>
```

| Dòng | Ý nghĩa |
|---|---|
| `<urlset xmlns=…sitemaps.org/schemas/sitemap/0.9>` | Khai báo chuẩn sơ đồ trang. |
| 6 mục đầu (`/`, `/tin-tuc`, `/khoa-hoc`, `/giang-vien`, `/diem-chuan`, `/chinh-sach`) | Trang tĩnh công khai (`SITEMAP_STATIC`). Không có `lastmod`: nội dung đổi theo dữ liệu, chưa có mốc đáng tin. Gốc `/` in không có dấu `/` cuối. |
| 3 mục `/tin-tuc/<slug>` | Chỉ bài ĐANG hiển thị (`published=true` và giờ đăng đã tới hoặc trống). **Bài nháp và bài hẹn giờ chưa tới không có trong tệp** (`ban-nhap-chua-dang`, `hen-gio-tuan-sau` vắng). Slug được mã hoá URL (`%20`, `%26`, `%C3%BD`…). |
| `<lastmod>` của bài | Lấy `updatedAt` của bài, giờ UTC dạng ISO; báo công cụ tìm kiếm bài vừa sửa. Bài mới xếp trước. |
| `/khoa-hoc/toan-9-co-lan` | Chỉ khoá `status=true`; `khoa-an` bị ẩn nên vắng. Không có `lastmod`. |
| (không có) | `/admin`, `/api`, `/student`, `/lop-cua-toi`, `/phu-huynh`, `/thi-thu`, `/cong-dong` và mọi trang cần đăng nhập đều KHÔNG có. Tối đa 5000 mục (`SITEMAP_MAX`). |

## 2. robots.txt — tên miền chính (HTTP 200, text/plain)

```
User-Agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /student
Disallow: /lop-cua-toi
Disallow: /phu-huynh
Disallow: /xem-tai-lieu
Disallow: /xac-
Disallow: /dat-lai-mat-khau

Sitemap: https://midnightelite-edu.com/sitemap.xml
```

| Dòng | Ý nghĩa |
|---|---|
| `User-Agent: *` | Áp cho mọi bộ thu thập. |
| `Allow: /` | Mặc định cho phép thu thập công khai. |
| `Disallow: /admin`, `/api/` | Khu quản trị và mọi API. `/admin` chặn theo tiền tố. |
| `Disallow: /student`, `/lop-cua-toi`, `/phu-huynh` | Ba vỏ riêng tư của học sinh, gia sư, phụ huynh (có dữ liệu trẻ em). |
| `Disallow: /xem-tai-lieu` | Trang xem tài liệu lớp (có thể là tệp riêng của lớp). |
| `Disallow: /xac-` | Tiền tố các trang xác nhận (`/xac-nhan-...`): có mã dùng một lần trong địa chỉ. Chặn theo tiền tố nên cũng chặn mọi đường mới bắt đầu bằng `/xac-`. |
| `Disallow: /dat-lai-mat-khau` | Trang đặt lại mật khẩu (có mã trong địa chỉ). |
| `Sitemap: https://midnightelite-edu.com/sitemap.xml` | Chỉ nơi lấy sơ đồ trang. |

`robots.txt` chỉ là lời nhờ các bộ thu thập tử tế, KHÔNG bảo vệ dữ liệu; các trang riêng tư vẫn phải khoá bằng đăng nhập (đang khoá).

## 3. robots.txt — tên miền quản trị `admin.midnightelite-edu.com` (HTTP 200, text/plain)

```
User-Agent: *
Disallow: /
```

Chặn TOÀN BỘ: tên miền quản trị không bao giờ được lập chỉ mục; không có dòng `Sitemap`.

## 4. Điều cần chủ duyệt

1. Giữ nguyên như trên (khuyến nghị): khớp đặc tả BU-07 mục 5.5, không lộ nháp, hẹn giờ, khoá ẩn.
2. Thêm `/cong-dong` vào sitemap? Hiện KHÔNG (bài do người dùng viết, có thể chưa kiểm duyệt). Khuyến nghị: không.
3. Thêm `lastmod` cho 6 trang tĩnh? Hiện không; đặt mốc giả sẽ sai sự thật. Khuyến nghị: không.
4. `Disallow: /xac-` theo tiền tố có đủ hẹp? Các đường dùng mã một lần đều bắt đầu bằng `/xac-`; chấp nhận được.
