"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Message = { id: string; role: "user" | "ai"; text: string };

const SUBJECTS = ["Toán", "Vật lý", "Hóa", "Tiếng Anh", "ĐGNL HSA"];

const AI_REPLIES: Record<string, string> = {
  "Toán":       "Midnight Elite AI (Toán): Tôi đã phân tích câu hỏi của bạn dựa trên ngữ liệu chương trình lớp 12 và đề ĐGNL HSA. Hãy cung cấp thêm ngữ cảnh (chương, dạng bài) để tôi trả lời chính xác hơn nhé!",
  "Vật lý":     "Midnight Elite AI (Vật lý): Câu hỏi liên quan đến kiến thức Vật lý 12. Tôi đề xuất ôn lại lý thuyết nền tảng trước khi làm dạng bài nâng cao. Bạn đang học chương nào?",
  "Hóa":        "Midnight Elite AI (Hóa học): Đây là dạng bài thường gặp trong đề thi THPT. Tôi gợi ý các bước giải tiêu chuẩn và công thức cần nhớ. Bạn cần mình giải thích chi tiết bước nào không?",
  "Tiếng Anh":  "Midnight Elite AI (Tiếng Anh): Câu hỏi được phân loại vào kỹ năng Reading/Grammar. Tôi đề xuất luyện thêm dạng bài này tại mục Tài liệu → Tiếng Anh. Bạn cần giải thích cụ thể điểm ngữ pháp nào không?",
  "ĐGNL HSA":   "Midnight Elite AI (ĐGNL HSA): Đây là kiến thức thuộc phần Tư duy Định lượng / Định tính trong đề HSA. Tôi đã đối chiếu với 47 đề thi thử gần nhất. Bạn muốn mình giải thích thêm phần nào?",
};

function getReply(subject: string): string {
  return AI_REPLIES[subject] ?? AI_REPLIES["Toán"];
}

const BTN_SIZE = 56;
const PANEL_W  = 320;
const PANEL_H  = 480;
const PADDING  = 12;

export default function AIChatWidget() {
  const [open, setOpen]       = useState(false);
  const [input, setInput]     = useState("");
  const [subject, setSubject] = useState("Toán");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: "0", role: "ai", text: "Xin chào! Tôi là Midnight Elite AI 👋\nBạn đang học môn gì? Hãy chọn môn bên dưới và đặt câu hỏi nhé!" },
  ]);

  // Drag state
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const dragStartPos = useRef({ x: 0, y: 0 });

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const x = window.innerWidth  - BTN_SIZE - PADDING;
    const y = window.innerHeight - BTN_SIZE - PADDING - 64; // above bottom nav
    setPos({ x, y });
    setMounted(true);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  function clamp(x: number, y: number) {
    const maxX = window.innerWidth  - BTN_SIZE - PADDING;
    const maxY = window.innerHeight - BTN_SIZE - PADDING;
    return {
      x: Math.max(PADDING, Math.min(maxX, x)),
      y: Math.max(PADDING, Math.min(maxY, y)),
    };
  }

  function startDrag(clientX: number, clientY: number) {
    dragOffset.current  = { x: clientX - pos.x, y: clientY - pos.y };
    dragStartPos.current = { x: clientX, y: clientY };
  }

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    startDrag(e.clientX, e.clientY);

    function onMove(e: MouseEvent) {
      setPos(clamp(e.clientX - dragOffset.current.x, e.clientY - dragOffset.current.y));
    }
    function onUp(e: MouseEvent) {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) < 5) setOpen(p => !p);
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup",   onUp);
  }

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    startDrag(t.clientX, t.clientY);

    function onMove(e: TouchEvent) {
      const t = e.touches[0];
      setPos(clamp(t.clientX - dragOffset.current.x, t.clientY - dragOffset.current.y));
    }
    function onEnd(e: TouchEvent) {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend",  onEnd);
      const t = e.changedTouches[0];
      const dx = t.clientX - dragStartPos.current.x;
      const dy = t.clientY - dragStartPos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) < 8) setOpen(p => !p);
    }
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend",  onEnd);
  }

  function send() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", text: input.trim() };
    setMessages(p => [...p, userMsg]);
    setInput("");
    setLoading(true);
    setTimeout(() => {
      setMessages(p => [...p, { id: (Date.now() + 1).toString(), role: "ai", text: getReply(subject) }]);
      setLoading(false);
    }, 2000);
  }

  if (!mounted) return null;

  // Panel position: above button, clamped to viewport
  const panelLeft = Math.max(PADDING, Math.min(
    window.innerWidth - PANEL_W - PADDING,
    pos.x + BTN_SIZE / 2 - PANEL_W / 2,
  ));
  const panelTop = pos.y - PANEL_H - 10 < PADDING
    ? pos.y + BTN_SIZE + 10   // show below if not enough space above
    : pos.y - PANEL_H - 10;

  return (
    <>
      {/* ── Chat panel ── */}
      <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 12 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed z-50 w-80 rounded-2xl overflow-hidden flex flex-col"
          style={{
            top:    panelTop,
            left:   panelLeft,
            width:  PANEL_W,
            height: PANEL_H,
            background: "#F0F5FF",
            boxShadow: "16px 16px 32px #C5D0EA,-8px -8px 24px #ffffff",
          }}>

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0 cursor-default"
            style={{ background: "linear-gradient(135deg,#0055D4,#0042AA)" }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm text-white"
              style={{ background: "rgba(255,255,255,0.2)", border: "2px solid rgba(255,255,255,0.4)" }}>
              AI
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white leading-tight">Midnight Elite AI</p>
              <p className="text-xs text-blue-200">RAG · Ngữ liệu ĐGNL + THPT</p>
            </div>
            <button onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Subject pills */}
          <div className="flex gap-1.5 px-3 py-2 flex-shrink-0 flex-wrap"
            style={{ borderBottom: "1px solid #E5ECF8" }}>
            {SUBJECTS.map(s => (
              <button key={s} onClick={() => setSubject(s)}
                className="px-2.5 py-0.5 rounded-full text-xs font-bold transition-all"
                style={subject === s
                  ? { background: "#0068FF", color: "white" }
                  : { background: "#E5ECF8", color: "#6B7280" }}>
                {s}
              </button>
            ))}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className={`flex items-end gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "ai" && (
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                    style={{ background: "#0068FF" }}>AI</div>
                )}
                <div className={`max-w-[78%] px-3 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-line
                  ${msg.role === "user" ? "rounded-br-sm" : "rounded-bl-sm"}`}
                  style={msg.role === "user"
                    ? { background: "linear-gradient(145deg,#0055D4,#0042AA)", color: "white" }
                    : { background: "#F0F5FF", boxShadow: "inset 2px 2px 4px #C5D0EA,inset -2px -2px 4px #ffffff", color: "#1E2938" }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-end gap-2 justify-start">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                  style={{ background: "#0068FF" }}>AI</div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1.5 items-center"
                  style={{ background: "#F0F5FF", boxShadow: "inset 2px 2px 4px #C5D0EA,inset -2px -2px 4px #ffffff" }}>
                  {[0,1,2].map(i => (
                    <div key={i} className="w-2 h-2 rounded-full animate-bounce"
                      style={{ background: "#0068FF", animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex gap-2 px-3 py-3 flex-shrink-0" style={{ borderTop: "1px solid #E5ECF8" }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Hỏi bất cứ điều gì..."
              className="flex-1 px-3 py-2 rounded-xl text-xs outline-none"
              style={{ background: "#F0F5FF", boxShadow: "inset 2px 2px 4px #C5D0EA,inset -2px -2px 4px #ffffff", color: "#1E2938" }}
            />
            <button onClick={send} disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
              style={{ background: input.trim() && !loading ? "linear-gradient(145deg,#0055D4,#0042AA)" : "#E5ECF8" }}>
              <svg className="w-4 h-4" fill="none" stroke={input.trim() && !loading ? "white" : "#9CA3AF"} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
            </button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* ── Floating button (draggable) ── */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className="fixed z-50 w-14 h-14 rounded-full flex items-center justify-center text-white select-none"
        style={{
          top:    pos.y,
          left:   pos.x,
          width:  BTN_SIZE,
          height: BTN_SIZE,
          cursor: "grab",
          background: open
            ? "linear-gradient(145deg,#FF2157,#cc0033)"
            : "linear-gradient(145deg,#0055D4,#0042AA)",
          boxShadow: open
            ? "0 8px 24px rgba(255,33,87,0.4)"
            : "0 8px 24px rgba(0,85,212,0.4)",
          touchAction: "none",
        }}>
        {open ? (
          <svg className="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
          </svg>
        ) : (
          <svg className="w-6 h-6 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
        )}
        {!open && (
          <span className="absolute top-1 right-1 w-3 h-3 rounded-full border-2 border-white pointer-events-none"
            style={{ background: "#00A63D" }} />
        )}
      </motion.button>
    </>
  );
}
