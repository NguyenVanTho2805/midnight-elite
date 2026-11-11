# Đợt "Lõi dạy học": gộp #157 (ẩn bằng cờ) + #153 (học phí bảng tháng); #158 và #159 chờ Cloudinary — 11/11/2026

Thọ: "Xử lý nhé" (kèm tệp *Việc của chủ — đợt Lõi dạy học*). Bốn PR: #153, #157, #158, #159. **Hai PR gộp lần này: #157 và #153.** **#158 và #159 CHƯA gộp** vì bước 1 trong tệp của chủ chưa được làm.

| PR | Nội dung | Kết quả |
|---|---|---|
| #157 | LOI-01: ẩn 9 phần chưa dùng bằng cờ | gộp |
| #153 | HP-LOP-TRUONG: học phí theo bảng tháng (TIỀN) | gộp |
| #158 | LOI-02: lớp và bài học của gia sư (ô thả tệp, bỏ dán link Drive) | **chờ** |
| #159 | LOI-03: lớp học sinh kiểu HSA — chứa sẵn #157 và #158 (50 commit) | **chờ** (gộp #159 là gộp cả #158) |

## Vì sao #158 / #159 chờ
Tệp của chủ ghi rõ: "Đặt Cloudinary TRƯỚC khi gộp #158 — không có Cloudinary thì gia sư không thêm được tài liệu mới, vì ô dán link Drive đã bỏ". Đã đối chiếu: danh sách biến Production trên Vercel **vẫn chỉ có** `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` / `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET`, **chưa có** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Trong mã #158: `resolveDocumentUploadConfig` ở production thiếu ba biến thì kho TẮT, ô thả hiện "Kho tệp chưa bật — chủ cần cấu hình", còn hộp "Hoặc dán link tài liệu" (`DocumentsEditor`) đã bị bỏ — gộp lúc này là cố ý làm gia sư mất khả năng thêm tài liệu mới. Khi chủ đặt đủ ba biến (hoặc nhắn tôi), #158 + #159 gộp một lần; #157 và #153 lúc đó đã ở `main`.

## #157 — ẩn bằng cờ (LOI-01)
Chín phần mặc định ẨN ở mọi vai và với khách: `TIM_GIA_SU`, `CONG_DONG`, `LICH`, `TIN_TUC`, `THU_VIEN`, `TIENG_ANH`, `XEP_HANG`, `COIN`, `DIEM_CHUAN`. Chỉ gỡ lối vào (menu, trang chủ, chân trang, sitemap) và chốt 307 + no-store ở `src/proxy.ts` cho route công khai; không xoá trang/route/bảng. Hồ sơ `/mentor/<id>` vẫn mở; câu hỏi trong lớp (`/cong-dong/<id>` của thành viên lớp) vẫn chạy. Mở lại: đặt `NEXT_PUBLIC_KIN_MO_<TÊN>=1` trên Vercel rồi **Redeploy** (biến `NEXT_PUBLIC_*` nhúng lúc dựng). Dấu hiệu sau khi gộp: `/tin-tuc`, `/cong-dong`… trả 307 về trang đầu.

## #153 — học phí bảng tháng (chạm TIỀN)
Theo tệp của chủ ("5. Gộp #153") và sau báo cáo ngày 10/11 đã nêu rõ: **gộp #153 = bật hình thức `monthly_sheet`** (nằm trong `NEW_FEE_MODES`): màn tạo lớp có thêm "Theo bảng học phí tháng (nhập từ Excel)" trong mục "Cách tính khác (ít dùng)", và trang Học phí của lớp có luồng bật bảng. Mặc định vẫn là Theo buổi; lớp nào chưa chọn thì giữ nguyên cách tính cũ. Muốn tắt lại: hoàn tác #153 hoặc bỏ `FEE_MODE_SHEET` khỏi `NEW_FEE_MODES` (một dòng ở `src/lib/tuitionFee.ts`). Hai mặc định cần chủ xem: nguồn "số môn" của mỗi em; kỳ tính = tháng dương lịch.

## Schema / cấu hình
Chỉ thêm 2 bảng (`course_fee_tables`, `course_fee_sheet_rows`) + quan hệ ngược ở `Course`; 0 dòng xoá trong diff schema; 130 bảng khi nạp vào DB trống. Không đổi `vercel.json`, phụ thuộc hay biến môi trường bắt buộc. Production tự đẩy schema ở bước build.

## Gộp
Hai nhánh gộp **sạch hoàn toàn** (không xung đột, kể cả tài liệu; `LopChiTiet.tsx` tự ghép).

## Kiểm (bản tích hợp #157 + #153; Postgres 16 + Next dev + Chromium)
- `tsc --noEmit` 0 lỗi (chạy riêng).
- Bài thuần/API, **0 đỏ** trừ ba ca nêu ở bảng đỏ: `t-features-lib` 117 · `t-admin-nav-lib` 32 · `t-admin-ops-lib` 70 · `t-admin-ops` 48 · `t-admin-queue-lib` 91 · `t-admin-queue` 24 · `t-home-layout-lib` 76 · `t-host-routing-lib` 89 · `t-sitemap` 19 · `t-hp-sheet-lib` 106 · **`t-hp-lop-truong` 278** · `t-course-access-lib` 311 · `t-no-hex` 16 · `t-db-push-guard` 28 · `t-community-api` 512 · `t-enrollments-pending-api` 20 · `t-student-todo` 36 · `t-tutor-inbox-lib` 49 · `t-course-teachers` 233 · `t-login-auto` 24 · `t-session-policy-lib` 20 · `t-lop-gon` 183 · `t-nop-tep` 143 · `t-schedule-api` 26.
- **Bài tiền có sẵn (hành vi cũ không đổi), đều xanh:** `t-hocphi-fee-lib` 47 · `t-hocphi-fee` 80 · `t-hocphi-extra-lib` 15 · `t-hocphi-extra` 36 · `t-hocphi-payment-lib` 35 · `t-hocphi-payment` 51 · `t-hocphi-dashboard-lib` 40 · `t-hocphi-dashboard` 41 · `t-hocphi-chuyen-lop` 34 · `t-hocphi-late-fee-hint` 18 · `t-fee-month-floor-lib` 18 · `t-fee-rule-audit-lib` 17 · `t-free-class-fee` 33 · `t-invoice-lib` 62 · `t-invoice-reminder-lib` 52 · `t-invoice-reminder` 57 · `t-invoice-zalo-lib` 12 · `t-invoice-zalo` 57 · `t-revenue-kpi-lib` 7 · `t-revenue-lib` 31.
- Trình duyệt, **0 đỏ**: **`ui-hp-lop-truong` 84** (giao diện bảng học phí của #153 chạy được trong cấu trúc lớp mới của #154) · `ui-coin-an` 125 · `ui-admin-hang-cho` 31 · `ui-admin-ops` 37 · `ui-tutor-shell` 92 · `ui-lop` 19 · `ui-gs-lop-gon` 137 · `ui-journey-new-tutor` 53 · `ui-tao-lop-wizard` 40 · `ui-hocphi-fee` 13 · `ui-login-password` 47 · `ui-auto-login` 37 · **`ui-links-everywhere` 7/0**. **`ui-role-everything` 43/0** (cờ tắt, như production sau khi gộp).
- Một vài bài đổ lần đầu vì máy chủ thử không tải được font Google lúc khởi động (mọi trang 500, kể cả `/`) — lỗi môi trường; đã sửa script chạy để mỗi bài xác nhận `/` trả 200 trước khi chạy, rồi chạy lại.

## Sửa bài kiểm (chỉ `tools/local-e2e`, không đổi mã sản phẩm)
1. `ui-hp-lop-truong` (của #153, viết trước khi #154 vào `main`): tab Học phí của CHỦ lớp nay ở `…/quan-lop/<id>?tab=cai-dat&muc=hoc-phi` (địa chỉ cũ `/lop-cua-toi/<id>?tab=hoc-phi` chỉ còn cho đồng giảng và là 307 với chủ lớp); cập nhật các địa chỉ và URL chờ sau "Tạo lớp". 84/0.
2. `ui-auto-login` (của #152): sau đăng xuất trang `/` điều hướng hai lần liên tiếp tới cùng địa chỉ làm bài mất ngữ cảnh khi đọc `localStorage`; bài chờ tải xong và thử lại. 37/0.
3. Năm bài của #155 khẳng định ĐỦ menu / khối của các phần mà #157 mặc định ẩn — `ui-sidebar-rong`, `ui-home-landing`, `ui-home-signed-in`, `ui-kin-site`, `ui-home-doors`: thêm chốt đầu bài, **cờ đang tắt thì BỎ QUA có thông báo rõ** (`0 pass / 0 fail`) thay vì đỏ vì thiếu mục đang ẩn có chủ đích. Khi **bật hết cờ** (`NEXT_PUBLIC_KIN_MO_*=1` cho cả máy chủ và bài): `ui-sidebar-rong` 28/0 · `ui-home-landing` 182/0 · `ui-home-signed-in` 56/0 · `ui-kin-site` 106/0 · `ui-home-doors` 217/8 (8 ca nợ `FeedCard` có sẵn) — tức cờ khôi phục nguyên trạng. Hành vi khi ẨN do bài của chính #157 phủ.

## Còn đỏ — đã đối chiếu với `main` sạch (`c5f6fb7`)
| Bài | Bản tích hợp | `main` sạch |
|---|---|---|
| `t-links` | 11/1 (4 địa chỉ báo giả: `robots.ts`, `AdminShell`, `LopChiTiet` ×2) | y hệt (có sẵn) |
| `t-hocphi-schema-additive` | 5/3 (so toàn bộ schema với một mốc cũ nên liệt kê hàng chục bảng không liên quan) | 5/3 y hệt (có sẵn) |
| `t-hocphi-theo-buoi` | 53/2 (hai ca `[D1]` dùng ngày cố định tháng 10) | 53/2 y hệt (có sẵn) |
| `ui-student-shell` | 75/2 (nhãn vai "HỌC SINH"; `aria-current`) | cùng hai ca ở các lần gộp trước (có sẵn) |
| `ui-tutor-everything` | 18/4: 404 `/lop-cua-toi/x`, trang `/` không có khung gia sư, `console.error` của React, HTTP ≥ 400 (gồm 2 lần 403 `POST /api/followed-courses`, đã báo) | 18/4 y hệt (có sẵn) |
| `ui-nop-tep` | 51/1 — khối danh sách tệp chưa gắn vào `BaiTap.tsx` (chờ PR nhỏ gắn lại `NopTepBox`); thêm hai ca chập chờn của #155 ("tên dài", "bàn phím") chỉ đỏ ở một số lượt | bài của #155; không đổi |
| `ui-loi-cong-dong-lop` | 27/1: một `console.error` "Rendered more hooks than during the previous render" nằm TRONG `Router` của Next.js (`node_modules/next/dist/client`), tái hiện khi trang `/cong-dong/<id>` chuyển hướng phía máy khách lặp lại trong chế độ dev (đo cả khi máy chủ đã nóng); nội dung trang và mọi ca khác đúng | bài MỚI của #157, chỉ có thể đo ở bản tích hợp; chưa kiểm được bản production (cookie `secure` không chạy trên http cục bộ) — nên xem một lần trên bản đã triển khai |
| `ui-home-doors` (bật hết cờ) | 217/8 — nợ `FeedCard` 18–21px | bài của #155; không đổi |

## Cần chủ biết
1. **Việc của chủ trước khi gộp #158 / #159:** đặt `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` ở Vercel → Settings → Environment Variables → Production (lấy ở cloudinary.com → Dashboard; nhập trực tiếp ở Vercel, đừng dán khoá vào chat), rồi nhắn tôi gộp #158 + #159.
2. **Sau khi gộp đợt này, web trông khác:** menu / trang chủ / chân trang không còn Tìm gia sư, Cộng đồng, Lịch, Tin tức, Thư viện, Tiếng Anh, Xếp hạng, Coin, Điểm chuẩn; các đường công khai tương ứng chuyển về trang đầu (307). Đây là ý của chủ (LOI-01). Mở lại từng phần bằng `NEXT_PUBLIC_KIN_MO_<TÊN>=1` + Redeploy.
3. Mục D của tệp (xác nhận mặc định) vẫn chờ chủ; #157 giữ "Bài đăng tìm học sinh" / "Yêu cầu tìm gia sư" của gia sư. #158/#159 giữ mặc định của PR khi gộp.
4. Chưa thử trên điện thoại thật (mục 7 của tệp) — chỉ có bộ kiểm trình duyệt ở 1600/1280/390px.
- Việc dọn ~119 nhánh cũ vẫn bị cơ chế an toàn của phiên chặn; chủ tự chạy `bash tools/xoa-nhanh-rac.sh --apply` hoặc cho phép trong cài đặt quyền.
