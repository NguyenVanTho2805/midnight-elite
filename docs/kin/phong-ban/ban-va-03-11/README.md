# Bản vá phiên kiểm thử 02/11/2026

Xuất bằng `git format-patch`. Mỗi thư mục áp lên **đúng nền** ghi dưới đây (đã thử `git am` sạch). Không có gì trong này được đẩy lên nhánh BU nào.

| Thư mục | Nền (áp lên) | Số bản vá | Nội dung |
|---|---|---|---|
| `bu-04/` | `claude/bu-04-phong-thi` tại `6ca3e9f` | 5 | 0001 = commit lệch của #107 (bỏ qua nếu đã gộp #107) · 0002 lịch thi không lộ mã đề con/đề link · 0003 "Làm lại" không dùng số lượt cũ + lịch thi theo lớp ghi danh · 0004 cỡ chữ ô cờ · 0005 `ui-exam-room` hết đỏ ngẫu nhiên |
| `bu-06b/` | `claude/bu-06-tim-gia-su` tại `839f42f` | 1 | Gia sư ghi ảnh bìa + video giới thiệu (API, form, 3 bài test) |
| `bu-08/` | `claude/bu-08-quan-tri` tại `6ec40be` | 2 | `next.config.ts` nối 308 (D1), `AdminShell` lọc tab theo nhóm + logo 44px (D3a), sửa 2 bài |

```bash
git switch claude/bu-04-phong-thi && git am docs/kin/phong-ban/ban-va-03-11/bu-04/*.patch
```

```bash
git switch -c claude/bu-06b-anh-bia-video origin/claude/bu-06-tim-gia-su && git am docs/kin/phong-ban/ban-va-03-11/bu-06b/*.patch
```

```bash
git switch claude/bu-08-quan-tri && git am docs/kin/phong-ban/ban-va-03-11/bu-08/*.patch
```

Nếu `git am` dừng giữa chừng: `git am --abort` rồi áp lại từng bản bằng `git am --3way <tệp>`.
Chi tiết kết quả test, xung đột và việc cần chủ quyết: `../PROMPT-TIEP-NOI-03-11.md`.
