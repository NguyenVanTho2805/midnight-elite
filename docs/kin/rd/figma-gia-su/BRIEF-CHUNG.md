# Brief chung — dựng màn gia sư theo Figma (Nền móng)

Figma: file 2orXvoHL2upkiGoMjlq8aX, trang "Nền móng". Ảnh chụp từng khung đã tải sẵn trong thư mục này (đọc bằng Read). Agent KHÔNG có Figma MCP, chỉ dựa vào ảnh. Mẫu đã làm xong và được chủ duyệt: Hộp việc (src/components/tutor/HopViec.tsx, ảnh hop-viec.png) — bám cùng ngôn ngữ: H1 + dòng phụ + nút hành động ở góc phải, dải số (KinStatRow/KinStat), mục có SectionHead và đường kẻ, ListRow, bảng dạng danh sách liên kết, hai cột 1fr + ~354px trên desktop, một cột ở 390px.

Vấn đề chủ nêu: giao diện "mơ hồ, khó nhìn". Mục tiêu: chữ rõ, thứ bậc rõ, khoảng cách rộng, đúng Figma.

Quy tắc cứng: chỉ token --kin-* (không mã hex, bài t-no-hex); không bịa số liệu (t-no-fabricated) — số nào chưa có nguồn thật thì bỏ ô hoặc để trạng thái rỗng trung thực và GHI vào báo cáo; không đụng schema, không đổi cách tính tiền, không đụng dữ liệu trẻ em; không tạo đường chết (mọi nút/dòng phải dẫn tới trang có thật, bài t-links); dùng thành phần có sẵn trong src/components/kin, bổ sung khi thiếu; mọi màn dùng được ở 390px không tràn ngang; dùng "cô"/"thầy" theo Figma chỉ khi đã có sẵn trong mã, nếu không dùng giọng trung tính.
Không xoá ca test nào; test sửa cho khớp bố cục mới thì ghi lý do.

Cách làm: đọc .local-dev/AGENT-UI.md và AGENT-COMMON.md; tạo worktree `bash ~/Documents/Code/midnight-elite/.local-dev/mk-wt.sh <tên> <cổng> claude/giao-dien-moi`; bật máy chủ bằng wt-up.sh; nạp dữ liệu giả bằng mock-seed; đăng nhập giasu@kin.local / Passw0rd!. Chụp 1440 và 390, ĐỐI CHIẾU từng vùng với ảnh Figma và sửa tới khi khớp. Chạy tsc --noEmit, eslint tệp đổi, t-no-hex, t-no-fabricated, t-links, các bài ui-* của màn mình làm và ui-tutor-shell. Xoá .next của worktree khi xong (ổ đĩa hạn chế). Commit trên nhánh worktree, không push, không PR. Báo cáo cuối ngắn bằng tiếng Việt: nhánh, tệp đổi, kết quả test thật, điểm CHƯA khớp Figma và vì sao, tệp dễ xung đột khi gộp.
