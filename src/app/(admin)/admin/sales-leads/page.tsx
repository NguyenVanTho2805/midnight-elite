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
  const [lead, setLead]     = useState<SalesLeadDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/sales-leads/${leadId}`, { credentials: "same-origin" })
      .then(r => r.ok ? r.json() : null)
      .then(setLead)
      .finally(() => setLoading(false));
  }, [leadId]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      style={{ background: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-lg max-h-[80vh] rounded-2xl overflow-hidden flex flex-col bg-white"
        style={{ border: "1px solid #e5e3df", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
        onClick={e => e.stopPropagation()}>

        <div className="px-5 py-4 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: "1px solid #e5e3df" }}>
          <div>
            <p className="text-sm font-bold" style={{ color: "#1E2938" }}>Chi tiết hội thoại</p>
            <p className="text-xs font-mono mt-0.5" style={{ color: "#9CA3AF" }}>
              {lead?.sessionId?.slice(0, 20) ?? leadId.slice(0, 20)}…
            </p>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            ✕
          </button>
        </div>

        {loading && (
          <div className="px-5 py-10 text-center text-sm" style={{ color: "#9CA3AF" }}>Đang tải...</div>
        )}
        {!loading && !lead && (
          <div className="px-5 py-10 text-center text-sm" style={{ color: "#9CA3AF" }}>Không tìm thấy lead này.</div>
        )}
        {!loading && lead && (
          <>
            <div className="px-5 py-3 flex items-center gap-2 flex-wrap flex-shrink-0"
              style={{ borderBottom: "1px solid #e5e3df", background: "#f6f5f4" }}>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold"
                style={{ background: "#fff", border: "1px solid #e5e3df", color: leadScoreColor(lead.leadScore) }}>
                Score: {lead.leadScore > 0 ? lead.leadScore : "—"}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: STAGE_CONFIG[lead.stage]?.bg ?? "#F3F4F6", color: STAGE_CONFIG[lead.stage]?.color ?? "#6B7280" }}>
                {STAGE_CONFIG[lead.stage]?.label ?? lead.stage}
              </span>
              {lead.escalationFlag && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold text-white"
                  style={{ background: "#FF2157" }}>
                  Cần hỗ trợ
                </span>
              )}
              <span className="ml-auto text-xs" style={{ color: "#9CA3AF" }}>
                {lead._count.messages} tin nhắn
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {lead.messages.length === 0 && (
                <p className="text-sm text-center" style={{ color: "#9CA3AF" }}>Chưa có tin nhắn nào.</p>
              )}
              {lead.messages.map(m => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-line"
                    style={m.role === "user"
                      ? { background: "#0068FF", color: "white" }
                      : { background: "#f6f5f4", border: "1px solid #e5e3df", color: "#1E2938" }}>
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
  const [leads, setLeads]               = useState<SalesLeadListItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [stageFilter, setStageFilter]   = useState<"all" | "awareness" | "consideration" | "decision">("all");
  const [escalatedOnly, setEscalatedOnly] = useState(false);
  const [detailId, setDetailId]         = useState<string | null>(null);

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

  const stageCounts = useMemo(() => ({
    awareness:     leads.filter(l => l.stage === "awareness").length,
    consideration: leads.filter(l => l.stage === "consideration").length,
    decision:      leads.filter(l => l.stage === "decision").length,
    escalated:     leads.filter(l => l.escalationFlag).length,
  }), [leads]);

  const STAGE_FILTERS = [
    { key: "all"           as const, label: "Tất cả",   count: leads.length },
    { key: "awareness"     as const, label: "Tìm hiểu", count: stageCounts.awareness },
    { key: "consideration" as const, label: "Xem xét",  count: stageCounts.consideration },
    { key: "decision"      as const, label: "Sẵn sàng", count: stageCounts.decision },
  ];

  return (
    <PermissionGuard required={PERMISSIONS.VIEW_SALES_LEADS}>
      {detailId && <DetailModal leadId={detailId} onClose={() => setDetailId(null)} />}

      <div className="space-y-5 max-w-7xl flex flex-col" style={{ height: "calc(100vh - 104px)" }}>

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#1E2938" }}>Lead tư vấn</h1>
            <p className="text-sm mt-0.5" style={{ color: "#9CA3AF" }}>
              {leads.length} cuộc hội thoại từ Sales Bot
              {stageCounts.escalated > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold"
                  style={{ background: "#fee2e2", color: "#991b1b" }}>
                  {stageCounts.escalated} cần hỗ trợ
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
            {STAGE_FILTERS.map(f => (
              <button key={f.key} onClick={() => setStageFilter(f.key)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5"
                style={stageFilter === f.key
                  ? { background: "#fff", color: "#1E2938", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", border: "1px solid #e5e3df" }
                  : { background: "transparent", color: "#6B7280", border: "1px solid transparent" }}>
                {f.label}
                {f.count > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                    style={{ background: stageFilter === f.key ? "#f6f5f4" : "#e5e3df", color: "#6B7280" }}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <button onClick={() => setEscalatedOnly(p => !p)}
            className="px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
            style={escalatedOnly
              ? { background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" }
              : { background: "#fff", color: "#6B7280", border: "1px solid #e5e3df" }}>
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: escalatedOnly ? "#ef4444" : "#9CA3AF" }} />
            Cần hỗ trợ
            {stageCounts.escalated > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                style={{ background: "#fee2e2", color: "#991b1b" }}>
                {stageCounts.escalated}
              </span>
            )}
          </button>
        </div>

        {/* Table */}
        <div className="rounded-xl overflow-hidden flex flex-col flex-1 bg-white min-w-0"
          style={{ border: "1px solid #e5e3df" }}>
          <div className="grid grid-cols-12 px-5 py-3 text-xs font-semibold uppercase tracking-wider"
            style={{ color: "#9CA3AF", background: "#f6f5f4", borderBottom: "1px solid #e5e3df" }}>
            <div className="col-span-1">#</div>
            <div className="col-span-1 hidden sm:block">Score</div>
            <div className="col-span-5 hidden md:block">Tóm tắt hội thoại</div>
            <div className="col-span-6 md:col-span-2">Giai đoạn</div>
            <div className="col-span-2 text-center hidden sm:block">Tin nhắn</div>
            <div className="col-span-1 hidden md:block">Cập nhật</div>
            <div className="col-span-1 text-right"></div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="px-5 py-8 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-11 rounded-lg animate-pulse" style={{ background: "#f6f5f4" }} />
                ))}
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="px-5 py-16 text-center">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "#f6f5f4", border: "1px solid #e5e3df" }}>
                  <span className="text-2xl">💬</span>
                </div>
                <p className="font-semibold text-sm" style={{ color: "#6B7280" }}>Chưa có lead nào</p>
                <p className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
                  Học sinh chat với widget trên web sẽ xuất hiện ở đây.
                </p>
              </div>
            )}
            {!loading && filtered.map((lead, i) => {
              const stageCfg = STAGE_CONFIG[lead.stage];
              return (
                <div key={lead.id} className="grid grid-cols-12 items-center px-5 py-3.5 hover:bg-gray-50 transition-colors"
                  style={{ borderTop: i > 0 ? "1px solid #f0eeeb" : "none" }}>

                  {/* # thứ tự */}
                  <div className="col-span-1">
                    <div className="flex items-center gap-1.5">
                      {lead.escalationFlag && (
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#ef4444" }} />
                      )}
                      <div>
                        <div className="text-xs font-semibold" style={{ color: "#1E2938" }}>
                          #{leads.indexOf(lead) + 1}
                        </div>
                        <div className="text-[10px]" style={{ color: "#9CA3AF" }}>{formatTime(lead.createdAt)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="col-span-1 hidden sm:block">
                    <span className="text-sm font-bold"
                      style={{ color: lead.leadScore > 0 ? leadScoreColor(lead.leadScore) : "#d1d5db" }}>
                      {lead.leadScore > 0 ? lead.leadScore : "—"}
                    </span>
                  </div>

                  {/* Tóm tắt */}
                  <div className="col-span-5 hidden md:block">
                    <p className="text-xs leading-relaxed line-clamp-2"
                      style={{ color: lead.conversationSummary ? "#4B5563" : "#9CA3AF" }}>
                      {lead.conversationSummary || "Chưa có tóm tắt hội thoại"}
                    </p>
                  </div>

                  {/* Giai đoạn */}
                  <div className="col-span-6 md:col-span-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
                      style={{ background: stageCfg?.bg ?? "#F3F4F6", color: stageCfg?.color ?? "#6B7280" }}>
                      {stageCfg?.label ?? lead.stage}
                    </span>
                  </div>

                  {/* Tin nhắn */}
                  <div className="col-span-2 text-center hidden sm:block">
                    <span className="text-xs" style={{ color: "#6B7280" }}>{lead._count.messages}</span>
                  </div>

                  {/* Cập nhật */}
                  <div className="col-span-1 hidden md:block">
                    <span className="text-xs" style={{ color: "#9CA3AF" }}>{formatTime(lead.updatedAt)}</span>
                  </div>

                  {/* Action */}
                  <div className="col-span-1 text-right">
                    <button onClick={() => setDetailId(lead.id)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors hover:bg-blue-50 cursor-pointer"
                      style={{ color: "#0068FF", border: "1px solid #e5e3df" }}>
                      Xem
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-5 py-3 text-xs text-right flex-shrink-0"
            style={{ borderTop: "1px solid #e5e3df", color: "#9CA3AF" }}>
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
