"use client";

import { useState, useEffect, useMemo } from "react";
import PermissionGuard from "@/components/PermissionGuard";
import { PERMISSIONS } from "@/contexts/AuthContext";

// ─── TYPES ────────────────────────────────────────────────────────────────────
interface SalesLeadListItem {
  id: string;
  sessionId: string;
  leadScore: number;
  stage: string;
  conversationSummary: string;
  escalationFlag: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
}

interface SalesMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  createdAt: string;
}

interface SalesLeadDetail extends SalesLeadListItem {
  messages: SalesMessage[];
}

const STAGE_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  awareness:     { label: "Tìm hiểu", bg: "#F3F4F6", color: "#6B7280" },
  consideration: { label: "Xem xét",  bg: "#fef3c7", color: "#92400e" },
  decision:      { label: "Sẵn sàng", bg: "#d1fae5", color: "#065f46" },
};

const STAGE_FILTERS = [
  { key: "all" as const,           label: "Tất cả"  },
  { key: "awareness" as const,     label: "Tìm hiểu" },
  { key: "consideration" as const, label: "Xem xét"  },
  { key: "decision" as const,      label: "Sẵn sàng" },
];

function leadScoreColor(score: number): string {
  if (score >= 70) return "#0068FF";
  if (score >= 30) return "#FE9900";
  return "#9CA3AF";
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ─── DETAIL MODAL ─────────────────────────────────────────────────────────────
function DetailModal({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const [lead, setLead] = useState<SalesLeadDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/sales-leads/${leadId}`, { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : null)
      .then(setLead)
      .finally(() => setLoading(false));
  }, [leadId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4" style={{ background: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-lg max-h-[80vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "#F0F5FF", boxShadow: "16px 16px 32px #C5D0EA, -16px -16px 32px #ffffff" }}
        onClick={e => e.stopPropagation()}>

        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid #C5D0EA" }}>
          <div>
            <p className="text-sm font-extrabold" style={{ color: "#1E2938" }}>Chi tiết hội thoại</p>
            <p className="text-xs" style={{ color: "#9CA3AF" }}>{leadId.slice(0, 12)}...</p>
          </div>
          <button onClick={onClose} className="text-sm cursor-pointer" style={{ color: "#6B7280" }}>✕</button>
        </div>

        {loading && (
          <div className="px-5 py-10 text-center text-sm" style={{ color: "#9CA3AF" }}>Đang tải...</div>
        )}

        {!loading && !lead && (
          <div className="px-5 py-10 text-center text-sm" style={{ color: "#9CA3AF" }}>Không tìm thấy lead này.</div>
        )}

        {!loading && lead && (
          <>
            <div className="px-5 py-3 flex items-center gap-2 flex-wrap flex-shrink-0" style={{ borderBottom: "1px solid #C5D0EA" }}>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: "#F0F5FF", boxShadow: "inset 2px 2px 4px #C5D0EA, inset -2px -2px 4px #ffffff", color: leadScoreColor(lead.leadScore) }}>
                Lead score: {lead.leadScore}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: STAGE_CONFIG[lead.stage]?.bg, color: STAGE_CONFIG[lead.stage]?.color }}>
                {STAGE_CONFIG[lead.stage]?.label ?? lead.stage}
              </span>
              {lead.escalationFlag && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white" style={{ background: "#FF2157" }}>
                  🚨 Cần hỗ trợ
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {lead.messages.length === 0 && (
                <p className="text-sm text-center" style={{ color: "#9CA3AF" }}>Chưa có tin nhắn nào.</p>
              )}
              {lead.messages.map(m => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-line"
                    style={m.role === "user"
                      ? { background: "linear-gradient(145deg,#0055D4,#0042AA)", color: "white" }
                      : { background: "#F0F5FF", boxShadow: "inset 2px 2px 4px #C5D0EA, inset -2px -2px 4px #ffffff", color: "#1E2938" }}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── PAGE ──────────────────────────────────────────────────────────────────────
function SalesLeadsContent() {
  const [leads, setLeads]       = useState<SalesLeadListItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [stageFilter, setStageFilter] = useState<typeof STAGE_FILTERS[number]["key"]>("all");
  const [escalatedOnly, setEscalatedOnly] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/sales-leads", { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : [])
      .then(setLeads)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return leads.filter(l => {
      if (stageFilter !== "all" && l.stage !== stageFilter) return false;
      if (escalatedOnly && !l.escalationFlag) return false;
      return true;
    });
  }, [leads, stageFilter, escalatedOnly]);

  const escalatedCount = leads.filter(l => l.escalationFlag).length;

  return (
    <PermissionGuard required={PERMISSIONS.VIEW_SALES_LEADS}>
      {detailId && <DetailModal leadId={detailId} onClose={() => setDetailId(null)} />}

      <div className="space-y-6 max-w-7xl flex flex-col" style={{ height: "calc(100vh - 104px)" }}>
        {/* Header */}
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "#1E2938" }}>Lead tư vấn (TSIX Sales Bot)</h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>
            {leads.length} lead · {escalatedCount} cần hỗ trợ trực tiếp
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {STAGE_FILTERS.map(f => (
            <button key={f.key} onClick={() => setStageFilter(f.key)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              style={stageFilter === f.key
                ? { background: "linear-gradient(145deg,#0055D4,#0042AA)", color: "white" }
                : { background: "#F0F5FF", border: "1px solid rgba(197,208,234,0.8)", color: "#6B7280" }}>
              {f.label}
            </button>
          ))}
          <button onClick={() => setEscalatedOnly(p => !p)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            style={escalatedOnly
              ? { background: "#FF2157", color: "white" }
              : { background: "#F0F5FF", border: "1px solid rgba(197,208,234,0.8)", color: "#6B7280" }}>
            🚨 Cần hỗ trợ
          </button>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden flex flex-col flex-1"
          style={{ background: "#F0F5FF", boxShadow: "8px 8px 16px #C5D0EA, -8px -8px 16px #ffffff" }}>
          <div className="grid grid-cols-12 px-5 py-3 text-xs font-bold uppercase tracking-wider"
            style={{ color: "#6B7280", boxShadow: "0 2px 4px #C5D0EA" }}>
            <div className="col-span-3">Session</div>
            <div className="col-span-4 hidden md:block">Tóm tắt hội thoại</div>
            <div className="col-span-1 text-center">Score</div>
            <div className="col-span-1 hidden sm:block">Giai đoạn</div>
            <div className="col-span-1 text-center hidden sm:block">Tin nhắn</div>
            <div className="col-span-1 hidden md:block">Cập nhật</div>
            <div className="col-span-1 text-right">Chi tiết</div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="px-5 py-10 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "#E2E8F4" }} />
                ))}
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="px-5 py-10 text-center" style={{ color: "#9CA3AF" }}>
                <p className="font-semibold">Chưa có lead nào</p>
                <p className="text-xs mt-1">Học sinh chat với widget trên web sẽ xuất hiện ở đây.</p>
              </div>
            )}
            {!loading && filtered.map((lead, i) => (
              <div key={lead.id} className="grid grid-cols-12 items-center px-5 py-4"
                style={{ borderTop: i > 0 ? "1px solid #C5D0EA" : "none" }}>
                <div className="col-span-3">
                  <div className="font-mono text-xs truncate" style={{ color: "#1D4ED8" }}>{lead.sessionId}</div>
                  <div className="text-xs" style={{ color: "#9CA3AF" }}>{formatTime(lead.createdAt)}</div>
                </div>
                <div className="col-span-4 hidden md:block">
                  <p className="text-xs truncate" style={{ color: lead.conversationSummary ? "#4B5563" : "#9CA3AF" }}>
                    {lead.conversationSummary || "Chưa có tóm tắt"}
                  </p>
                </div>
                <div className="col-span-1 text-center">
                  <span className="text-sm font-extrabold" style={{ color: leadScoreColor(lead.leadScore) }}>
                    {lead.leadScore}
                  </span>
                </div>
                <div className="col-span-1 hidden sm:block">
                  <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
                    style={{ background: STAGE_CONFIG[lead.stage]?.bg, color: STAGE_CONFIG[lead.stage]?.color }}>
                    {STAGE_CONFIG[lead.stage]?.label ?? lead.stage}
                  </span>
                  {lead.escalationFlag && <span className="ml-1">🚨</span>}
                </div>
                <div className="col-span-1 text-center hidden sm:block">
                  <span className="text-xs" style={{ color: "#6B7280" }}>{lead._count.messages}</span>
                </div>
                <div className="col-span-1 hidden md:block">
                  <span className="text-xs" style={{ color: "#9CA3AF" }}>{formatTime(lead.updatedAt)}</span>
                </div>
                <div className="col-span-1 text-right">
                  <button onClick={() => setDetailId(lead.id)}
                    className="px-2 py-1 rounded-lg text-xs font-semibold transition-all hover:-translate-y-0.5 cursor-pointer"
                    style={{ background: "#F0F5FF", boxShadow: "2px 2px 4px #C5D0EA, -2px -2px 4px #ffffff", color: "#0068FF" }}>
                    Xem
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="px-5 py-3 text-xs text-right flex-shrink-0" style={{ borderTop: "1px solid #C5D0EA", color: "#9CA3AF" }}>
            Hiển thị {filtered.length}/{leads.length} lead
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}

export default function SalesLeadsPage() {
  return <SalesLeadsContent />;
}
