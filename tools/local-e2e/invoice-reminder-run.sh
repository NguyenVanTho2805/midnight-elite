#!/bin/bash
# Chạy t-invoice-reminder.ts với ba cấu hình máy chủ (cờ là biến môi trường của MÁY CHỦ nên phải khởi động lại giữa các lần). Chạy ở GỐC worktree.
#   bash tools/local-e2e/invoice-reminder-run.sh [A|B|C ...]   (mặc định cả ba)
#   A: cổng gói TẮT (mặc định) · B: KIN_PLAN_ENFORCE=1 · C: VERCEL_ENV=preview
# (Bài chạy trong tiến trình riêng nên cũng nhận cùng cờ, vì loadTutorTodoTotal chạy ngay trong bài.)
# Xong thì máy chủ được bật lại ở cấu hình mặc định (A).
ME="$HOME/Documents/Code/midnight-elite"
up() { ( source tools/local-e2e/env.sh; env "$@" bash "$ME/.local-dev/wt-up.sh" >/dev/null 2>&1 ) || { echo "máy chủ không lên"; return 1; }; }
t() { ( source tools/local-e2e/env.sh; env "$@" npx tsx tools/local-e2e/t-invoice-reminder.ts 2>&1 | grep -v "^  ✓"; exit "${PIPESTATUS[0]}" ); }
rc=0
for w in ${*:-A B C}; do
  echo "=== Cấu hình $w ==="
  case $w in
    A) up KIN_PLAN_ENFORCE= VERCEL_ENV= && t EXPECT_ENFORCE=0 ;;
    B) up KIN_PLAN_ENFORCE=1 VERCEL_ENV= && t EXPECT_ENFORCE=1 KIN_PLAN_ENFORCE=1 ;;
    C) up KIN_PLAN_ENFORCE= VERCEL_ENV=preview && t EXPECT_ENFORCE=0 EXPECT_PREVIEW=1 VERCEL_ENV=preview ;;
  esac
  [ $? -eq 0 ] || rc=1
done
up KIN_PLAN_ENFORCE= VERCEL_ENV=
exit $rc
