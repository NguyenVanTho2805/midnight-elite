# Đội phát triển BCA Midnight (bản xây lại)

Đội này xây lại web quản lý lớp **BCA Midnight Class** thay cho Google Sheet + Apps Script. Đội cũ của KiN (`kin-*`, `pb-*`, `adm-*`, `tut-*`, `stu-*`) vẫn giữ để bảo trì bản KiN đang chạy, không dùng cho bản mới.

Quyết định của chủ: [`../QUYET-DINH.md`](../QUYET-DINH.md). Mọi agent đọc tệp đó trước.

## 5 phòng, 8 agent

| Phòng | Agent | Việc |
|---|---|---|
| Điều hành | `bca-dieu-hanh` | Nhận mục tiêu, chia việc, chạy vòng lặp, gom câu hỏi cho chủ. Không viết mã. |
| Nghiệp vụ | `bca-nghiep-vu` | Đọc script Apps Script và dữ liệu sheet, viết quy tắc nghiệp vụ, bảng chuyển dữ liệu. |
| Thiết kế | `bca-thiet-ke` | Tham khảo (React Bits, 21st.dev, GSAP, Lenis…), viết token và đặc tả màn. |
| Thiết kế | `bca-giam-khao` | Chấm điểm thiết kế và bản dựng theo các skill tiêu chí, bắt buộc chọn phương án. |
| Kỹ thuật | `bca-may-chu` | Cơ sở dữ liệu, API, đăng nhập, cron, email, Meet. |
| Kỹ thuật | `bca-giao-dien` | Trang và linh kiện Next.js, chuyển động GSAP/Lenis/React Bits. |
| Chất lượng | `bca-kiem-thu` | Viết và chạy test trình duyệt bằng Playwright CLI, trả bảng số thật. |
| Chất lượng | `bca-ra-soat` | Rà mã độc lập: quyền, dữ liệu học sinh, tiền, khớp quy tắc nghiệp vụ. |

## Vòng lặp hoàn thiện

```
Chủ ──mục tiêu──▶ Điều hành
                     │
        ┌────────────┴─────────────┐
        ▼                          ▼
   Nghiệp vụ (quy tắc)       Thiết kế (đặc tả màn) ◀──┐
        │                          │                   │
        └──────────┬───────────────┘                   │
                   ▼                                   │
     Kỹ thuật: Máy chủ ∥ Giao diện                      │
                   │                                   │
                   ▼                                   │
     Chất lượng: Kiểm thử ─▶ Rà soát ─▶ Giám khảo ─────┘
                   │   (đỏ / P1-P2 / điểm < 8 ⇒ quay lại, tối đa 3 vòng)
                   ▼
     Điều hành gom kết quả + CÂU HỎI CHO CHỦ ─▶ Chủ quyết ─▶ vòng sau
```

Quy tắc vòng lặp:
1. Mỗi bước trả về một **phiếu** theo mẫu dưới. Bước sau chỉ chạy khi phiếu trước "đạt".
2. Không đạt thì quay lại đúng phòng gây lỗi, kèm danh sách lỗi cụ thể (tệp:dòng). Tối đa 3 vòng cho một việc; quá 3 vòng thì Điều hành dừng và hỏi chủ.
3. Gặp điều chưa có trong `QUYET-DINH.md` mà ảnh hưởng hành vi người dùng, tiền, dữ liệu học sinh hay chi phí: **không tự đoán**, ghi vào mục "Câu hỏi cho chủ" với 2–4 lựa chọn và một lựa chọn khuyên dùng.
4. Chủ trả lời thì Điều hành ghi thêm vào `QUYET-DINH.md` (có ngày), rồi mới chạy tiếp.

## Mẫu phiếu

```
PHIẾU <phòng> — <mã việc> — <ngày>
Kết quả: ĐẠT | KHÔNG ĐẠT
Đã làm: …
Tệp đã sửa: …
Số liệu thật (test, điểm chấm): …
Lỗi còn lại (nếu không đạt): tệp:dòng — mô tả
Câu hỏi cho chủ: (câu hỏi · lựa chọn A/B/C · khuyên dùng)
```

## Skill dùng chung

- Thiết kế: `web-design-guidelines`, `design-taste-frontend`, `high-end-visual-design`, `ui-ux-pro-max`, `minimalist-ui`, `vercel-react-view-transitions`.
- Mã: `vercel-react-best-practices`, `vercel-composition-patterns`, `karpathy-guidelines`, Ponytail (giữ mã ngắn nhất chạy được).
- Kiểm thử: `playwright-cli`.
- Hiểu kho: `graphify` (khi đã có `graphify-out/`).
- Triển khai: `deploy-to-vercel`, `vercel-optimize`.
