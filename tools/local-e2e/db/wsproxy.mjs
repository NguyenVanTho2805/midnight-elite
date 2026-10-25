// Proxy WebSocket → Postgres cho adapter Neon khi chạy DB thử cục bộ: wss://localhost/v2 → 127.0.0.1:5432.
// Chỉ dùng ở máy test (chứng chỉ tự ký). Dùng: node wsproxy.mjs <node_modules của repo> <thư mục chứa key.pem/cert.pem>
import { readFileSync } from "node:fs";
import { createServer } from "node:https";
import net from "node:net";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(path.join(process.argv[2], "noop.js"));
const { WebSocketServer } = require("ws");
// Chứng chỉ tự ký: openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 7 -subj "/CN=localhost" (để ngoài repo)
const certDir = process.argv[3] ?? path.dirname(new URL(import.meta.url).pathname);
const server = createServer({ key: readFileSync(path.join(certDir, "key.pem")), cert: readFileSync(path.join(certDir, "cert.pem")) });
const wss = new WebSocketServer({ server });
wss.on("connection", ws => {
  const sock = net.connect(5432, "127.0.0.1");
  const pending = [];
  sock.on("connect", () => { for (const b of pending) sock.write(b); pending.length = 0; });
  ws.on("message", data => (sock.readyState === "open" ? sock.write(data) : pending.push(data)));
  sock.on("data", d => ws.readyState === 1 && ws.send(d));
  const close = () => { try { ws.close(); } catch {} try { sock.destroy(); } catch {} };
  ws.on("close", close); ws.on("error", close); sock.on("close", close); sock.on("error", close);
});
server.listen(443, "0.0.0.0", () => console.log("wsproxy on :443"));
