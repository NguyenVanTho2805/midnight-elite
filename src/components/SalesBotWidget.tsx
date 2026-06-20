"use client";

import { useState, useRef, useEffect } from "react";

type Message = { id: string; role: "user" | "bot"; text: string };

const SESSION_KEY = "tsix_sales_session_id";
const GREETING =
  "Chào em! Mình là tư vấn viên TSIX Education 👋\nEm đang quan tâm khóa luyện thi nào, để mình hỗ trợ em nhé.";
const FALLBACK_ERROR =
  "Xin lỗi em, hệ thống tư vấn đang tạm gián đoạn. Em thử lại sau hoặc gọi hotline 0384 409 051 giúp mình nhé.";

// Tên tool kỹ thuật -> câu trạng thái thân thiện hiện cho học sinh khi bot đang gọi tool
const TOOL_STATUS_LABEL: Record<string, string> = {
  check_course_availability: "Đang kiểm tra khóa học...",
  apply_discount_code: "Đang kiểm tra mã giảm giá...",
  create_payment_link: "Đang tạo link thanh toán...",
  escalate_to_human: "Đang chuyển cho tư vấn viên...",
};

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export default function SalesBotWidget() {
  const botUrl = process.env.NEXT_PUBLIC_SALES_BOT_URL;

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false); // đã nhận delta đầu tiên — ẩn dấu "..." chờ
  const [toolStatus, setToolStatus] = useState<string | null>(null); // "Đang kiểm tra..." khi bot gọi tool
  const [messages, setMessages] = useState<Message[]>([
    { id: "greeting", role: "bot", text: GREETING },
  ]);

  const sessionIdRef = useRef<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    sessionIdRef.current = getOrCreateSessionId();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  // Chưa cấu hình backend (vd local dev chưa chạy bot, hoặc production chưa
  // deploy bot) — không hiện widget thay vì hiện ra rồi lỗi khi bấm gửi.
  if (!botUrl) return null;

  /** Tách event SSE từ buffer — mỗi event là 1 dòng "data: {...}" kết thúc bằng "\n\n". */
  function parseSSEEvents(buffer: string): { events: string[]; rest: string } {
    const parts = buffer.split("\n\n");
    const rest = parts.pop() ?? "";
    const events = parts
      .map(p => p.trim())
      .filter(p => p.startsWith("data:"))
      .map(p => p.slice("data:".length).trim());
    return { events, rest };
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setMessages(p => [...p, { id: crypto.randomUUID(), role: "user", text }]);
    setInput("");
    setLoading(true);
    setStreaming(false);
    setToolStatus(null);

    const botMessageId = crypto.randomUUID();
    let hasStreamedText = false;

    function appendDelta(delta: string) {
      hasStreamedText = true;
      setStreaming(true);
      setToolStatus(null); // đã có text trả lời thật — ẩn chỉ báo "đang kiểm tra..."
      setMessages(p => {
        if (!p.some(m => m.id === botMessageId)) {
          return [...p, { id: botMessageId, role: "bot", text: delta }];
        }
        return p.map(m => (m.id === botMessageId ? { ...m, text: m.text + delta } : m));
      });
    }

    function showFinalReplyIfNoDelta(reply: string) {
      // Round chỉ có tool_call hoặc bị chặn max-rounds — không có delta nào
      // để stream, vẫn phải đảm bảo câu trả lời cuối hiện ra cho học sinh.
      if (hasStreamedText) return;
      setMessages(p => [...p, { id: botMessageId, role: "bot", text: reply }]);
    }

    try {
      const res = await fetch(`${botUrl}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionIdRef.current, message: text }),
        signal: AbortSignal.timeout(60000),
      });

      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        const reply: string = body?.detail ?? FALLBACK_ERROR;
        setMessages(p => [...p, { id: crypto.randomUUID(), role: "bot", text: reply }]);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const { events, rest } = parseSSEEvents(buffer);
        buffer = rest;

        for (const raw of events) {
          let event: { type: string; text?: string; reply?: string; name?: string };
          try {
            event = JSON.parse(raw);
          } catch {
            continue;
          }

          if (event.type === "delta" && event.text) {
            appendDelta(event.text);
          } else if (event.type === "tool_call" && event.name) {
            setToolStatus(TOOL_STATUS_LABEL[event.name] ?? "Đang xử lý...");
          } else if (event.type === "done") {
            showFinalReplyIfNoDelta(event.reply ?? FALLBACK_ERROR);
          }
        }
      }
    } catch {
      setMessages(p => [...p, { id: crypto.randomUUID(), role: "bot", text: FALLBACK_ERROR }]);
    } finally {
      setLoading(false);
      setStreaming(false);
      setToolStatus(null);
    }
  }

  return (
    <>
      {/* Panel */}
      {open && (
        <div
          className="fixed z-50 bottom-24 right-5 flex flex-col overflow-hidden rounded-xl"
          style={{
            width: 360,
            height: 500,
            background: "#ffffff",
            border: "1px solid #e5e3df",
            boxShadow: "rgba(15,15,15,0.12) 0px 8px 32px 0px",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0" style={{ background: "#0068FF" }}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-white flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              ME
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white leading-tight">Tư vấn TSIX Education</p>
              <p className="text-xs text-white opacity-75">Thường trả lời trong vài giây</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white transition-colors flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ background: "#f6f5f4" }}>
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-line"
                  style={
                    msg.role === "user"
                      ? { background: "#0068FF", color: "#ffffff" }
                      : { background: "#ffffff", border: "1px solid #e5e3df", color: "#1E2938" }
                  }
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && !streaming && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-xl flex gap-2 items-center" style={{ background: "#ffffff", border: "1px solid #e5e3df" }}>
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#0068FF", animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  {toolStatus && <span className="text-xs" style={{ color: "#787671" }}>{toolStatus}</span>}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2 px-3 py-3 flex-shrink-0" style={{ background: "#ffffff", borderTop: "1px solid #e5e3df" }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={loading}
              placeholder="Nhập câu hỏi của em..."
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: "#f6f5f4", border: "1px solid #e5e3df", color: "#1E2938" }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-opacity"
              style={{ background: input.trim() && !loading ? "#0068FF" : "#e5e3df" }}
            >
              <svg className="w-4 h-4" fill="none" stroke={input.trim() && !loading ? "white" : "#9CA3AF"} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setOpen(p => !p)}
        className="fixed z-50 bottom-5 right-5 w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-105"
        style={{ background: "#0068FF", boxShadow: "rgba(0,104,255,0.4) 0px 6px 20px 0px" }}
      >
        {open ? (
          <svg className="w-6 h-6" fill="none" stroke="white" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="white" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        )}
      </button>
    </>
  );
}
