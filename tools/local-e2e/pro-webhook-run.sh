#!/bin/bash
# Chạy t-pro-webhook.ts với bốn cấu hình máy chủ (cờ là biến môi trường của MÁY CHỦ, nên phải khởi động lại giữa các lần). Chạy ở GỐC worktree.
#   bash tools/local-e2e/pro-webhook-run.sh [on|nokey|noconfig|preview ...]   (mặc định cả bốn)
# Xong thì máy chủ được bật lại ở cấu hình mặc định.
ME="$HOME/Documents/Code/midnight-elite"
PAY=(KINPRO_BANK_BIN=970436 KINPRO_ACCOUNT_NO=9704360012345 "KINPRO_ACCOUNT_NAME=Kin Pro Thu")
KEY=KINPRO_SEPAY_API_KEY=khoa-sepay-thu-nghiem-0123456789
up() { ( source tools/local-e2e/env.sh; env "$@" bash "$ME/.local-dev/wt-up.sh" >/dev/null 2>&1 ) || { echo "máy chủ không lên"; return 1; }; }
t() { ( source tools/local-e2e/env.sh; env "$@" npx tsx tools/local-e2e/t-pro-webhook.ts 2>&1 | grep -v "^  ✓"; exit "${PIPESTATUS[0]}" ); }
rc=0
for w in ${*:-on nokey noconfig preview}; do
  echo "=== Cấu hình $w ==="
  case $w in
    on)       up "${PAY[@]}" "$KEY" && t EXPECT_MODE=on "${PAY[@]}" "$KEY" ;;
    nokey)    up "${PAY[@]}" && t EXPECT_MODE=nokey "${PAY[@]}" ;;
    noconfig) up "$KEY" && t EXPECT_MODE=noconfig "$KEY" ;;
    preview)  up "${PAY[@]}" "$KEY" VERCEL_ENV=preview && t EXPECT_MODE=preview "${PAY[@]}" "$KEY" VERCEL_ENV=preview ;;
  esac
  [ $? -eq 0 ] || rc=1
done
up
exit $rc
