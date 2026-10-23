#!/bin/bash
# Chạy t-pro-plan.ts với ba cấu hình máy chủ (cờ là biến môi trường của MÁY CHỦ, nên phải khởi động lại máy chủ giữa các lần). Chạy ở GỐC worktree.
#   bash tools/local-e2e/pro-plan-run.sh [A|B|C ...]   (mặc định cả ba)
#   A: mặc định (cổng TẮT) · B: KIN_PLAN_ENFORCE=1 + KIN_TRIAL_MODE=1 · C: KIN_PLAN_ENFORCE=1 + KINPRO_* + KIN_TOPUP_*
# Xong thì máy chủ được bật lại ở cấu hình mặc định (A).
ME="$HOME/Documents/Code/midnight-elite"
up() { ( source tools/local-e2e/env.sh; env "$@" bash "$ME/.local-dev/wt-up.sh" >/dev/null 2>&1 ) || { echo "máy chủ không lên"; return 1; }; }
t() { ( source tools/local-e2e/env.sh; env "$@" npx tsx tools/local-e2e/t-pro-plan.ts 2>&1 | grep -v "^  ✓"; exit "${PIPESTATUS[0]}" ); }
rc=0
for w in ${*:-A B C}; do
  echo "=== Cấu hình $w ==="
  case $w in
    A) up KIN_PLAN_ENFORCE= KIN_TRIAL_MODE= && t EXPECT_ENFORCE=0 EXPECT_TRIAL=0 EXPECT_PAY=0 ;;
    B) up KIN_PLAN_ENFORCE=1 KIN_TRIAL_MODE=1 && t EXPECT_ENFORCE=1 EXPECT_TRIAL=1 EXPECT_PAY=0 ;;
    C) up KIN_PLAN_ENFORCE=1 KINPRO_BANK_BIN=970436 KINPRO_ACCOUNT_NO=9704360012345 "KINPRO_ACCOUNT_NAME=Kin Pro Thu" "KIN_TOPUP_BANK_NAME=Ngan hang thu" KIN_TOPUP_ACCOUNT_NO=9704360099887 "KIN_TOPUP_ACCOUNT_NAME=KIN TOPUP THU" \
         && t EXPECT_ENFORCE=1 EXPECT_TRIAL=0 EXPECT_PAY=1 ;;
  esac
  [ $? -eq 0 ] || rc=1
done
up KIN_PLAN_ENFORCE= KIN_TRIAL_MODE=
exit $rc
