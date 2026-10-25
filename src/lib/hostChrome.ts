// Tên miền admin (admin.midnightelite-edu.com) chỉ phục vụ quản trị — nó KHÔNG phải trang công khai (xem src/lib/hostRouting.ts, src/lib/signedInShell.ts).
// Nhưng trang đăng nhập dùng chung một mã với tên miền chính nên mang theo khung khách (thanh trên: Lớp học / Thi thử / Cộng đồng…, chân trang, "Tạo tài khoản KiN",
// "Tôi có mã mời vào lớp"): những nút ấy không có nghĩa ở cửa quản trị. 15/10/2026 (Thọ báo): ẩn chúng ở tên miền admin.
//
// HTML của trang được dựng sẵn và dùng chung cho cả hai tên miền nên máy chủ không biết đang ở tên miền nào lúc dựng. Cách làm giống thanh bên thu/mở và gợi ý vỏ
// (src/lib/railState.ts, src/lib/signedInShell.ts): một dòng chạy TRƯỚC khi trình duyệt vẽ trang đặt thuộc tính lên <html>, CSS (kin-site.css) lo phần ẩn/hiện.
// Không chờ React hydrate nên không nháy khung khách rồi mới biến mất, và không gây lệch hydration.
//   - [data-guest-chrome] và [data-chi-khach]: ẩn ở tên miền admin.
//   - [data-chi-admin]: chỉ hiện ở tên miền admin (vd lối sang cửa đăng nhập của học viên / gia sư).
import { ADMIN_HOST } from "@/lib/hostRouting";

export const HOST_HINT_ATTR = "data-kin-host";

/** Một dòng, không chứa "</script", không ném lỗi khi trình duyệt chặn. So khớp CHÍNH XÁC tên máy (không cổng), không phải tiền tố "admin.". */
export const HOST_INIT_SCRIPT = `try{if(location.hostname===${JSON.stringify(ADMIN_HOST)})document.documentElement.setAttribute(${JSON.stringify(HOST_HINT_ATTR)},"admin")}catch(e){}`;
