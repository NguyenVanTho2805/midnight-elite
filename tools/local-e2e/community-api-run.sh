#!/bin/bash
# Chạy t-community-api.ts với hai cấu hình máy chủ (cờ KIN_GUEST_QUESTIONS là biến môi trường của MÁY CHỦ, nên phải khởi động lại giữa hai lần). Chạy ở GỐC worktree.
#   bash tools/local-e2e/community-api-run.sh [1|0 ...]   (mặc định cả hai: 1 trước rồi 0)
#   1: KIN_GUEST_QUESTIONS=1 → chạy đủ, kể cả khách đặt câu hỏi + hàng chờ duyệt
#   0: không đặt cờ          → chỉ kiểm 503 guest_questions_closed (JSON và form) + các nhóm không cần khách
# Xong thì máy chủ được bật lại ở cấu hình mặc định (cờ tắt).
ME="$HOME/Documents/Code/midnight-elite"
up() { ( source tools/local-e2e/env.sh; env "$@" bash "$ME/.local-dev/wt-up.sh" >/dev/null 2>&1 ) || { echo "máy chủ không lên"; return 1; }; }
t() { ( source tools/local-e2e/env.sh; env "$@" npx tsx tools/local-e2e/t-community-api.ts 2>&1 | grep -v "^  ✓"; exit "${PIPESTATUS[0]}" ); }
rc=0
for w in ${*:-1 0}; do
  echo "=== EXPECT_GUEST_QUESTIONS=$w ==="
  case $w in
    1) up KIN_GUEST_QUESTIONS=1 && t EXPECT_GUEST_QUESTIONS=1 ;;
    0) up KIN_GUEST_QUESTIONS= && t EXPECT_GUEST_QUESTIONS=0 ;;
  esac
  [ $? -eq 0 ] || rc=1
done
up KIN_GUEST_QUESTIONS=
exit $rc
