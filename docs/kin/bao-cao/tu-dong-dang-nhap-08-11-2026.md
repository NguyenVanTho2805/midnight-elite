# Tự động đăng nhập (lưu tài khoản kiểu trình quản lý mật khẩu) — 08/11/2026

Thọ: "thêm tính năng tự động login (kiểu lưu tài khoản đăng nhập ấy, kiểu keeper vậy)". Trên trang đăng nhập có sẵn dòng chú thích "Chưa làm: ô 'Ghi nhớ trên thiết bị này' (chờ Thọ quyết)" — đây là câu trả lời cho nó.

## Làm gì
Khi mở `/dang-nhap` mà chưa có phiên, KiN hỏi **trình duyệt** xem có tài khoản + mật khẩu đã lưu cho trang này không (Credential Management API, `mediation: "silent"` — không hiện hộp chọn). Có thì tự gọi `/api/auth/login` rồi vào thẳng trang của vai, người dùng không phải bấm gì. Chỉ hiện dòng "Đang đăng nhập bằng tài khoản đã lưu…" trong lúc chờ.

**KiN không giữ mật khẩu ở đâu cả** (không localStorage, không cookie, không DB): trình duyệt / Trình quản lý mật khẩu của máy cất. Mã nguồn: `src/lib/savedLogin.ts` (thuần, có test), `AuthContext.login(…, { auto })`, `src/app/(guest)/dang-nhap/page.tsx`, cờ `auto` ở `src/app/api/auth/login/route.ts`.

| Tình huống | Hành vi |
|---|---|
| Học sinh / gia sư, có mật khẩu đã lưu | Tự vào (phiên 30 ngày như thường) |
| Đăng nhập tay thành công | KiN nhờ trình duyệt lưu (`credentials.store`); trình duyệt tự hỏi người dùng có lưu không |
| Bấm **Đăng xuất** | `preventSilentAccess()` — lần mở trang đăng nhập sau KHÔNG tự vào lại, tới khi người dùng đăng nhập tay |
| Mật khẩu đã lưu không còn đúng / bị khoá | Thử **đúng một lần**, báo lỗi của máy chủ + "đây là thông tin trình duyệt đã lưu", gọi `preventSilentAccess()` để không thử lại ở các lần mở trang sau; form để trống |
| Máy chủ báo chặn tạm (429) | Hiện thông báo chờ như thường, không gọi `preventSilentAccess` |
| `/dang-nhap?cach=ma`, hoặc vừa bị đưa về từ lỗi Google/Facebook | Không tự thử |
| Firefox / Safari (không có `PasswordCredential`) | Không làm gì; đăng nhập tay và gợi ý tự điền của trình duyệt như cũ |
| **Quản trị** (admin_super, admin_content) | **KHÔNG tự vào** — xem dưới |

## Vì sao quản trị bị loại (cần chủ biết, có thể đổi)
`sessionPolicy.ts` quy định quản trị chỉ sống **12 giờ, không tự gia hạn**: "máy bỏ quên 12 giờ thì hết đường; muốn tiếp phải đăng nhập lại có chủ ý". Nếu trình duyệt tự đưa mật khẩu đã lưu để vào lại thì mốc đó mất tác dụng. Nên máy chủ, khi nhận `auto: true` với tài khoản quản trị, **kiểm mật khẩu rồi trả 403 `auto_not_allowed` TRƯỚC khi cấp phiên** (không cookie); trang đăng nhập điền sẵn tài khoản + mật khẩu và nói "Bấm Đăng nhập để vào" — người dùng chỉ còn một cú bấm. Gia sư (`adminRole: teacher`) không bị loại. Muốn quản trị cũng tự vào: bỏ một nhánh `if` ở route, nhưng khi đó mốc 12 giờ chỉ còn là hình thức — cần chủ quyết.
Đây không phải ranh giới bảo mật chống kẻ có mật khẩu (kẻ đó vào tay được như hôm nay); nó chỉ ngăn trình duyệt **tự** vào lại, khớp ý của mốc 12 giờ. Cờ chỉ có nghĩa khi là boolean `true`.

## Giới hạn của trình duyệt (không phải của KiN)
- Chỉ Chrome / Edge / Opera / Samsung Internet có `PasswordCredential`. Firefox và Safari vẫn nhận gợi ý tự điền (ô đã có `autocomplete="username"` / `"current-password"`) nhưng phải bấm "Đăng nhập".
- Chrome chỉ tự đăng nhập khi người dùng bật "Tự động đăng nhập" trong cài đặt mật khẩu (mặc định bật) **và** trang đó chỉ có **một** tài khoản được lưu. Nhiều tài khoản → `get` trả rỗng và người dùng chọn bằng gợi ý của ô tài khoản như thường.
- Học sinh / gia sư vốn đã có phiên 30 ngày tự gia hạn, nên tính năng này phát huy khi hết phiên, xoá cookie, đổi máy/trình duyệt đã đồng bộ mật khẩu, hoặc sau khi bị đá phiên.

## Cần chủ biết thêm
- **Kẻ chiếm tên trước + phiên bị thu hồi (#150):** nếu kẻ đó đã lưu mật khẩu vào trình duyệt của mình, sau khi người thật xác minh email, phiên cũ của kẻ đó bị thu hồi nhưng mật khẩu cũ vẫn đúng (việc chờ chủ quyết ở báo cáo #148–#150), nên tính năng này sẽ **tự đăng nhập lại cho kẻ đó**. Việc cần quyết (buộc đặt lại mật khẩu khi xác minh email của tài khoản đăng ký bằng mật khẩu) giờ quan trọng hơn.
- Lần tự đăng nhập tính vào giới hạn 10 lần/phút theo IP và độ trễ theo tài khoản như đăng nhập thường (`limitOrBlock`, `loginThrottle`); mật khẩu lưu sai chỉ thử một lần mỗi lần mở trang rồi `preventSilentAccess`.
- Chưa làm: bộ chọn tài khoản kiểu Facebook ("Tiếp tục với <tên>"), ô "Ghi nhớ trên thiết bị này". Không cần vì phiên 30 ngày + lưu của trình duyệt đã đủ; làm sau nếu muốn.

## Kiểm
- `tsc` 0 lỗi, eslint các tệp sửa sạch.
- Bài mới: `t-saved-login-lib` 21/0 (thuần, trình duyệt giả: chỉ xin âm thầm, nuốt mọi lỗi, không treo) · `t-login-auto` 24/0 (API: học sinh + gia sư vào; admin_super + admin_content 403 `auto_not_allowed` không cookie; sai mật khẩu + auto cùng một câu 401, không lộ vai; cờ không phải boolean `true` coi như thủ công) · `ui-auto-login` 37/0 (trình duyệt thật + kho mật khẩu giả: học sinh/gia sư tự vào; quản trị điền sẵn không vào; mật khẩu cũ một lần rồi dừng; không có gì lưu → không gọi API; đăng nhập tay → `store`; đăng xuất → không tự vào lại, đăng nhập tay lại thì bật lại; `?cach=ma` / lỗi Google / lỗi Facebook không tự thử; trình duyệt không hỗ trợ vẫn dùng bình thường).
- Hồi quy đường đăng nhập/phiên đã sửa, 0 đỏ: `t-login-password` 41 · `t-login-code` 61 · `t-login-phone` 56 · `t-session` 35 · `t-session-revoke` 33 · `t-session-verify` 25 · `t-session-role-sync` 37 · `t-session-policy-lib` 20 · `t-session-verify-lib` 26 · `t-password-reset` 59 · `t-signup-code` 75 · `t-resend-verification` 4 · `t-register-atomic` 32 · `t-auth-input-attrs` 15 · `t-no-hex` 16 · `ui-login-password` 47 · `ui-login-code` 60 · `ui-password-reset` 38 · `ui-signup-code` 43.
- Thử với Chrome thật + kho mật khẩu thật: **chưa** (Chromium headless không có kho mật khẩu; đã giả lập đúng hợp đồng API). Nên thử một lần trên Chrome: đăng nhập tay → chấp nhận "Lưu mật khẩu" → đóng tab → mở lại `/dang-nhap` xem có tự vào không.
