# Môi trường test cục bộ — sao chép thành env.sh (không commit) rồi chỉnh. Dùng: source tools/local-e2e/env.sh
export NODE_TLS_REJECT_UNAUTHORIZED=0   # chỉ vì proxy WS tự ký ở máy test; KHÔNG dùng ngoài máy test
export DATABASE_URL="postgresql://postgres:<mat-khau>@localhost/kin_test"   # Postgres 16 cục bộ, KHÔNG phải DB thật
export SESSION_SECRET="test-secret-test-secret-test-secret-123456"
export NEXT_TELEMETRY_DISABLED=1
export BASE=http://localhost:3100
export EMAIL_SINK_DIR=/tmp/kin-mail   # test đăng nhập bằng mã email đọc mã từ các tệp JSON ở đây; server dev cũng phải có biến này
export SMS_SINK_DIR=/tmp/kin-sms   # test đăng nhập bằng SMS đọc mã từ các tệp JSON ở đây; server dev cũng phải có biến này. Bản production BỎ QUA biến này.
# ĐX-02 (thông báo đẩy): t-push.ts và ui-push-settings.ts cần PUSH_ENABLED=1 + ba biến VAPID_* ở CẢ máy chủ dev LẪN bài test (khởi động dev SAU khi source).
# Sinh khoá thử: npx web-push generate-vapid-keys --json   (KHÔNG dùng khoá Production). Không đặt PUSH_ENABLED thì thông báo đẩy luôn tắt và các bài khác không bị ảnh hưởng.
# export PUSH_ENABLED=1
# export VAPID_PUBLIC_KEY=<publicKey>
# export VAPID_PRIVATE_KEY=<privateKey>
# export VAPID_SUBJECT=mailto:test@example.com
# Máy Mac (không có /opt/pw-browsers): dùng Chrome cài sẵn cho các bài ui-*.ts.
# export CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
