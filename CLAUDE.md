@AGENTS.md

## Bối cảnh sản phẩm KiN

Từ 23/09/2026 sản phẩm đổi tên thành KiN, không dùng Midnight Elite nữa.
Tài liệu bàn giao ở `docs/kin/`:

- `docs/kin/CLAUDE-cho-kho-trien-khai.md` — đọc trước. Bối cảnh sản phẩm,
  92 việc làm được ngay, 5 quy tắc nghiệp vụ, 2 chỗ tài liệu mâu thuẫn.
- `docs/kin/thiet-ke/` — đặc tả bố cục Outlook, khu cộng đồng, token màu.
- `docs/kin/backlog/` — 151 việc, cột "Sẵn sàng làm ngay".
- `docs/kin/nguyen-mau/` — 5 trang HTML mở bằng trình duyệt.
- `docs/kin/bao-cao/research-so-gia-su-2026-10-19.md` — bản chữ báo cáo research "Sổ Gia Sư + 14 nền tảng" (19/10/2026); căn cứ của các việc ĐX-xx và NC2-xxx.
- `docs/kin/ke-hoach-nang-cap-2.md` — kế hoạch Nâng cấp lần 2 (đối chiếu sheet · repo · research); việc ở `docs/kin/backlog/nang-cap-lan-2.csv`.
- `docs/kin/rd/BAN-GIAO-CHO-CHU-KHO.md` — **đọc đầu tiên khi mở kho sau PR 75** (25/10/2026): thứ tự đưa lên production, việc còn lại, quyết định mới nhất của chủ (không gói trả trước; người học từ 17 tuổi), quy tắc cứng, bẫy đã gặp.

Bản sổ lớp đang chạy thật: github.com/aodtsix-cmd/kin-app

## Người dùng + cách đọc backlog (chốt 06/10/2026)

- **User là Thọ** (email `tho7k7k123a@gmail.com`). "Thanh" là một người
  cộng sự khác cùng làm trên backlog — không phải Claude.

- Backlog Google Sheet: `1_B2Jz-SKjnWctN73Wl1UJLLf16gITjrP55GkbrAcdDo`,
  tab "Trang tính1". Cột:
  - **A** `tk` (ID việc, vd BE-083)
  - **B–G** meta (Phần, Nhóm lớn, Nhóm nhỏ, Việc, Cấp con, Ưu tiên)
  - **H** `Thọ` (tiến độ của Thọ)
  - **I** `Thọ Note` (ghi chú của Thọ)
  - **J** `Thanh` (tiến độ của Thanh)
  - **K** `Thanh Note` (ghi chú của Thanh)

- **Quy tắc BẮT BUỘC trước khi bắt tay vào bất kỳ task nào:** đọc 4 cột
  H / I / J / K của dòng tương ứng. Tiến độ + note của 2 người là nguồn
  tin cậy chính — có thể Thọ đã chốt khác với roadmap mặc định, hoặc
  Thanh đã làm trước phần nào. Không được bỏ qua, không được giả định
  theo trí nhớ phiên trước.

- Khi đánh dấu/ghi note vào sheet: **chỉ sửa cột H và I** (của Thọ);
  tuyệt đối KHÔNG chạm cột J, K của Thanh.
