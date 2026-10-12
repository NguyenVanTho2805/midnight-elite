# Môi trường test cục bộ — sao chép thành env.sh (không commit) rồi chỉnh. Dùng: source tools/local-e2e/env.sh
export NODE_TLS_REJECT_UNAUTHORIZED=0   # chỉ vì proxy WS tự ký ở máy test; KHÔNG dùng ngoài máy test
export DATABASE_URL="postgresql://postgres:<mat-khau>@localhost/kin_test"   # Postgres 16 cục bộ, KHÔNG phải DB thật
export SESSION_SECRET="test-secret-test-secret-test-secret-123456"
export NEXT_TELEMETRY_DISABLED=1
export BASE=http://localhost:3100
