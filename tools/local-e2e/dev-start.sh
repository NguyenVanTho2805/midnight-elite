#!/bin/bash
# Khởi động lại Next dev server (cổng 3100) trên DB test. Chạy: bash tools/local-e2e/dev-start.sh
cd "$(dirname "$0")/../.."
source tools/local-e2e/env.sh
for pid in $(ps -eo pid,args | awk '/next-server|next dev -p 3100|node_modules\/.bin\/next/ && !/awk/ {print $1}'); do kill "$pid" 2>/dev/null; done
sleep 1
rm -rf .next/dev/lock 2>/dev/null
# NEXT_DEV_FLAGS=--webpack khi máy không tải được Google Fonts: Turbopack dev không dùng được NEXT_FONT_GOOGLE_MOCKED_RESPONSES (trang trả 500), webpack thì dùng được.
nohup npx next dev ${NEXT_DEV_FLAGS:-} -p 3100 > /tmp/kin-dev.log 2>&1 &
for i in $(seq 1 40); do
  if curl -s -o /dev/null --max-time 2 http://localhost:3100/api/tutors; then echo "dev up after ${i}s"; exit 0; fi
  sleep 1
done
echo "dev NOT up"; tail -20 /tmp/kin-dev.log; exit 1
