#!/bin/bash
# Chạy t-pro-stats.ts với hai cấu hình máy chủ (cờ là biến môi trường của MÁY CHỦ). Chạy ở GỐC worktree.
#   bash tools/local-e2e/pro-stats-run.sh [A|B ...]   (mặc định cả hai)
#   A: mặc định (cổng TẮT) · B: KIN_PLAN_ENFORCE=1
# Xong thì máy chủ được bật lại ở cấu hình mặc định (A).
ME="$HOME/Documents/Code/midnight-elite"
up() { ( source tools/local-e2e/env.sh; env "$@" bash "$ME/.local-dev/wt-up.sh" >/dev/null 2>&1 ) || { echo "máy chủ không lên"; return 1; }; }
t() { ( source tools/local-e2e/env.sh; env "$@" npx tsx tools/local-e2e/t-pro-stats.ts 2>&1 | grep -v "^  ✓"; exit "${PIPESTATUS[0]}" ); }
u() { ( source tools/local-e2e/env.sh; env "$@" npx tsx tools/local-e2e/ui-pro-stats.ts 2>&1 | grep -v "^  ✓"; exit "${PIPESTATUS[0]}" ); }
rc=0
for w in ${*:-A B}; do
  echo "=== Cấu hình $w ==="
  case $w in
    A) up KIN_PLAN_ENFORCE= KIN_TRIAL_MODE= && t EXPECT_ENFORCE=0 && u EXPECT_ENFORCE=0 ;;
    B) up KIN_PLAN_ENFORCE=1 KIN_TRIAL_MODE= && t EXPECT_ENFORCE=1 && u EXPECT_ENFORCE=1 ;;
  esac
  [ $? -eq 0 ] || rc=1
done
up KIN_PLAN_ENFORCE= KIN_TRIAL_MODE=
exit $rc
