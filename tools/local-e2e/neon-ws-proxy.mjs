// Proxy WebSocket → TCP cho bộ test cục bộ: src/lib/prisma.ts nối Postgres bằng driver @neondatabase/serverless (WebSocket), mà Postgres cục bộ chỉ nói TCP.
// Driver mặc định mở `wss://<host>/v2` (cổng 443, bỏ qua cổng trong DATABASE_URL), mỗi khung nhị phân là byte thô của giao thức Postgres.
// Chạy (cần quyền mở cổng 443): node tools/local-e2e/neon-ws-proxy.mjs &   — rồi đặt NODE_TLS_REJECT_UNAUTHORIZED=0 (chứng chỉ tự ký, chỉ ở máy test).
// Driver Neon "chạy trước" khi bắt tay (pipelineConnect = "password"): gửi luôn một thông điệp mật khẩu 'p' NGAY SAU gói khởi động, trước khi máy chủ đòi. Neon thật hiểu, nhưng
// Postgres cục bộ thì từ chối ("invalid frontend message type 112"). Proxy này bỏ thông điệp 'p' đó; vì vậy Postgres cục bộ phải để `trust` cho 127.0.0.1 trong pg_hba.conf
// (máy test, không phải DB thật): host all all 127.0.0.1/32 trust.
// Biến tuỳ chọn: PG_HOST (127.0.0.1), PG_PORT (5432), WSP_PORT (443).
import https from "node:https";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const { WebSocketServer } = createRequire(import.meta.url)("ws");

const PG_HOST = process.env.PG_HOST ?? "127.0.0.1", PG_PORT = Number(process.env.PG_PORT ?? 5432), PORT = Number(process.env.WSP_PORT ?? 443);
const dir = path.join(os.tmpdir(), "kin-wsp");
fs.mkdirSync(dir, { recursive: true });
const keyFile = path.join(dir, "key.pem"), certFile = path.join(dir, "cert.pem");
if (!fs.existsSync(keyFile) || !fs.existsSync(certFile)) {
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", keyFile, "-out", certFile, "-days", "30", "-subj", "/CN=localhost"], { stdio: "ignore" });
}
const server = https.createServer({ key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) });
const wss = new WebSocketServer({ server, path: "/v2" });
/** Bộ lọc luồng khách → máy chủ: chuyển nguyên gói khởi động, bỏ ĐÚNG MỘT thông điệp 'p' đứng ngay sau nó, rồi chuyển nguyên phần còn lại. */
function makeFilter(forward) {
  let buf = Buffer.alloc(0), phase = 0; // 0: chờ gói khởi động · 1: chờ thông điệp 'p' (nếu có) · 2: chuyển thẳng
  return (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (phase === 2) { if (buf.length) forward(buf); buf = Buffer.alloc(0); return; }
      if (phase === 0) {
        if (buf.length < 4) return;
        const len = buf.readInt32BE(0);
        if (buf.length < len) return;
        const code = buf.length >= 8 ? buf.readInt32BE(4) : 0;
        forward(buf.subarray(0, len)); buf = buf.subarray(len);
        phase = code === 80877103 ? 0 : 1; // SSLRequest thì còn một gói khởi động nữa
        continue;
      }
      if (buf.length < 1) return;
      if (buf[0] !== 0x70) { phase = 2; continue; }
      if (buf.length < 5) return;
      const len = buf.readInt32BE(1);
      if (buf.length < 1 + len) return;
      buf = buf.subarray(1 + len); phase = 2; // bỏ thông điệp mật khẩu chạy trước
    }
  };
}

wss.on("connection", (ws) => {
  const tcp = net.connect(PG_PORT, PG_HOST);
  const queue = [];
  let ready = false;
  const write = (b) => (ready ? tcp.write(b) : queue.push(Buffer.from(b)));
  const filter = makeFilter(write);
  tcp.on("connect", () => { ready = true; for (const b of queue) tcp.write(b); queue.length = 0; });
  ws.on("message", (data) => filter(Buffer.isBuffer(data) ? data : Buffer.concat(Array.isArray(data) ? data : [Buffer.from(data)])));
  tcp.on("data", (d) => { if (ws.readyState === 1) ws.send(d); });
  const end = () => { try { tcp.destroy(); } catch { /* đã đóng */ } try { ws.close(); } catch { /* đã đóng */ } };
  tcp.on("close", end); tcp.on("error", end); ws.on("close", end); ws.on("error", end);
});
server.listen(PORT, () => console.log(`neon-ws-proxy: wss://localhost:${PORT}/v2 → ${PG_HOST}:${PG_PORT}`));
