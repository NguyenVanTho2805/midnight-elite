# Chuyển động lấy từ "Lucian UX/UI Prompt"

Nguồn: <https://lucianlabs.dev/uxui-prompt/> · mã: <https://github.com/Seokwoooo/lucian-uxui-prompt> (kho phát hành thư viện) và
<https://github.com/Seokwoooo/lucian-uxui> (kỹ năng cho trợ lý lập trình). Tác giả: Seokwoooo. **Giấy phép MIT** — nguyên văn ở cuối tệp này.

## Cách KiN dùng (và vì sao khác bản gốc)

- Chỉ lấy **phần chuyển động** (thời lượng, đường cong, độ trễ giữ nguyên); không lấy phần trình diễn (màu riêng, chữ mẫu, khung cố định).
- Dựng lại bằng token `--kin-*` (**không có mã hex**; test `t-no-hex` và `ui-motion-light` đều kiểm), lớp `.kin-m*` trong `src/app/kin-motion.css`.
- Hai đường cong chung: `--kin-ease: cubic-bezier(.2,.8,.2,1)` và `--kin-spring: cubic-bezier(.34,1.45,.64,1)` (lấy từ token `--ux-ease` / `--ux-spring` của bản gốc).
- **Giảm chuyển động**: người đặt `prefers-reduced-motion: reduce` thì mọi chuyển động tắt (khối cuối `kin-motion.css`), nội dung đứng ở trạng thái cuối.
- Không dùng `animation-fill-mode: forwards` với `transform` (giữ transform tạo khối chứa mới, làm hỏng `position: sticky` — xem `.page-enter` ở `globals.css`).
- Phát hiệu ứng bằng cách gắn lớp thẳng lên DOM (`src/lib/replayClass.ts`) khi có thể, để không dựng lại thành phần chỉ vì một hiệu ứng.
- Chỗ KiN **khác** bản gốc có chủ ý: (1) nút co thành vòng tròn dùng logo K thay vì vòng xoay (Figma KiN: "dùng chữ, không dùng spinner"); (2) #093 không confetti (rAF) mà dùng chấm CSS;
  (3) #039 áp vào gạch chân 2px của Figma "Tab" (một gạch chân chung trượt) chứ không dùng viên thuốc đen; (4) #040 đổi bề rộng cột bằng ease 0,45 giây (lò xo làm nội dung bên cạnh dội bố cục), lò xo dùng cho vạch nổi bật và chữ.
- **Giữ dòng bản quyền**: mỗi tệp có phần chuyển động lấy từ Lucian ghi `Lucian UX/UI Prompt #NNN · MIT License (c) 2026 Seokwoooo` ở đầu tệp (điều kiện của giấy phép MIT).

## Element đã lấy

| # | Element gốc | Nơi dùng trong KiN | Tệp |
|---|---|---|---|
| 008 | Nút sao chép biến thành dấu tích | phiếu học phí (số tài khoản, nội dung chuyển khoản), mã/link mời lớp của gia sư, chia sẻ bài cộng đồng | `src/components/kin/CopyButton.tsx`, `src/lib/clipboard.ts` |
| 039 | Tab có viên trượt (áp vào gạch chân 2px của Figma "Tab") | mọi `KinTabs` | `src/components/kin/Tabs.tsx` |
| 074 | Chuông thông báo | chuông ở dải trên (học viên + trang khách) | `src/components/NotificationBell.tsx` |
| 079 | Khung xám quét sáng → nội dung nở vào | `loading.tsx` của học viên / quản trị / khách / gia sư, `Skeleton` | `src/app/kin-motion.css` |
| 012 | Dải đánh dấu (bỏ confetti) | Lưu bài ở cộng đồng (danh sách, chi tiết, cửa sổ bài) | `src/components/kin/Bookmark.tsx` |
| 200 / 044 | Biên lai gấp / FAQ (chỉ lấy cách gập mở) | khối "cách chuyển khoản" ở phiếu học phí | `src/components/kin/Fold.tsx` |
| 026 | Ô nhập mã 6 số | ô mã đăng nhập (chữ số nảy, sóng khi kiểm tra, lắc khi sai, đổi màu xong khi đúng) | `src/components/kin/CodeBoxes.tsx` |
| 062 | Phản hồi đăng nhập | nút gửi co thành vòng tròn (logo K bên trong, không dùng spinner chung chung vì Figma cấm) + dấu tích; thẻ lắc khi sai; thông báo trượt vào | `src/components/kin/SubmitButton.tsx`, `src/app/(guest)/dang-nhap/page.tsx` |
| 067 | Đếm ngược khi bị khoá | thông báo "tạm khoá" ở trang đăng nhập: vòng + ổ khoá + số giây từ máy chủ (`retryAfterSec`), hết giờ quai khoá bật mở | `src/components/kin/LockCountdown.tsx` |
| 014 | Danh sách việc (vòng tiến độ, gạch ngang, đổi dòng chữ) | "Việc của tôi": vòng "x/y việc đã xong", việc vừa xong bị gạch từ trái sang, dòng phụ đổi chữ. Học viên không tự tích (việc do hệ thống sinh) nên chỉ lấy phần hiển thị | `src/components/kin/ProgressRing.tsx`, `SwapText.tsx`, `shell/Outlook.tsx`, `student/ViecCuaToi.tsx` |
| 093 | Ăn mừng khi xong hết | xong hết việc cần làm: vòng đổi màu xong + sóng lan + mười chấm toả ra (thay cho confetti vẽ bằng rAF của bản gốc) | `src/components/kin/ProgressRing.tsx` |
| 028 | Ô trả lời tự dãn + vòng đếm ký tự | ô trả lời bài cộng đồng (tối đa 1000 ký tự) | `src/components/kin/AutoGrow.tsx`, `community/ThreadDetailShared.tsx` |
| 040 | Thanh bên mở rộng có nhãn + vạch nổi bật trượt | thanh module của vỏ học viên / gia sư / quản trị: trạng thái thứ ba "rong" 220px, vạch nổi bật trượt tới mục đang chọn | `src/components/kin/shell/ModuleRail.tsx`, `src/lib/railState.ts` |

## Giấy phép gốc (MIT)

```
MIT License

Copyright (c) 2026 Seokwoooo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
