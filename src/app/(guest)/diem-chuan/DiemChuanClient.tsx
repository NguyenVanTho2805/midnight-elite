"use client";

import { useMemo, useState } from "react";
import { Search } from "griddy-icons";
import { SCORE_METHODS, filterGroups, formatScore, groupScores, methodLabel, scoreDelta, type PublicScore } from "@/lib/admissionScore";

export default function DiemChuanClient({ rows }: { rows: PublicScore[] }) {
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("");

  const groups = useMemo(() => groupScores(rows), [rows]);
  const methods = useMemo(() => SCORE_METHODS.filter(m => rows.some(r => r.method === m.key)), [rows]);
  const filtered = useMemo(() => filterGroups(groups, query, method), [groups, query, method]);
  const reset = () => { setQuery(""); setMethod(""); };
  const unverifiedCount = rows.filter(r => !r.verified).length;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-12 max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4"
          style={{ background: "var(--kin-nhan-nen-nhat)", color: "var(--kin-nhan-link)", border: "1px solid var(--kin-nhan-vien)" }}>
          {rows.length} dòng điểm chuẩn · có dẫn nguồn
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ color: "var(--kin-chu-chinh)", letterSpacing: "-0.5px" }}>
          Tra cứu <span style={{ color: "var(--kin-nhan-link)" }}>điểm chuẩn</span> đại học
        </h1>
        <p className="text-sm max-w-xl mx-auto" style={{ color: "var(--kin-chu-mo)" }}>
          Mỗi điểm đều có đường dẫn tới nguồn để bạn tự kiểm tra. Đây chưa phải toàn bộ các trường — KiN bổ sung dần.
        </p>
      </div>

      <div role="note" className="rounded-xl p-4 mb-6 text-sm" style={{ background: "var(--kin-tt-nen-cho)", border: "1px solid var(--kin-tt-vien-cho)", color: "var(--kin-tt-chu-cho)" }}>
        <strong>Đọc trước khi dùng.</strong> Mỗi trường dùng thang điểm và phương thức xét khác nhau, nên chỉ so sánh các năm có <em>cùng thang</em> (KiN chỉ hiện mức tăng/giảm khi đó).
        Dòng ghi <em>“Chưa đối chiếu”</em> là điểm lấy từ báo/nguồn công khai, chưa được KiN so với thông báo chính thức của trường — hãy mở nguồn và kiểm tra trên trang tuyển sinh của trường trước khi đăng ký nguyện vọng.
      </div>

      <div className="rounded-xl p-5 mb-6" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label htmlFor="dc-q" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>Tìm kiếm trường / ngành</label>
            <input id="dc-q" type="text" value={query} onChange={e => setQuery(e.target.value)}
              placeholder="VD: Bách khoa, Y khoa, Kinh tế..." className="notion-input w-full text-sm" style={{ color: "var(--kin-chu-chinh)", minHeight: 44 }} />
          </div>
          <div className="sm:w-64">
            <label htmlFor="dc-m" className="block text-xs font-semibold mb-1.5" style={{ color: "var(--kin-chu-phu)" }}>Phương thức xét</label>
            <select id="dc-m" value={method} onChange={e => setMethod(e.target.value)} className="notion-input w-full text-sm" style={{ color: "var(--kin-chu-chinh)", minHeight: 44 }}>
              <option value="">Tất cả</option>
              {methods.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          <div className="sm:w-28 flex items-end">
            <button type="button" onClick={reset} className="w-full rounded-lg text-sm font-semibold text-white" style={{ background: "var(--kin-nhan-nen)", borderRadius: 8, minHeight: 44 }}>
              Đặt lại
            </button>
          </div>
        </div>
        <p className="text-xs mt-3" style={{ color: "var(--kin-chu-mo)" }} aria-live="polite">
          {filtered.length} / {groups.length} ngành
          {query.trim() && <> · từ khoá “<strong style={{ color: "var(--kin-chu-chinh)" }}>{query.trim()}</strong>”</>}
          {method && <> · {methodLabel(method)}</>}
          {unverifiedCount > 0 && <> · {unverifiedCount} dòng chưa đối chiếu</>}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
          <p className="text-base font-semibold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Chưa có dữ liệu điểm chuẩn</p>
          <p className="text-sm" style={{ color: "var(--kin-chu-mo)" }}>KiN đang bổ sung. Bạn có thể xem điểm chuẩn trên trang tuyển sinh của trường.</p>
        </div>
      ) : filtered.length > 0 ? (
        <ul className="rounded-xl overflow-hidden" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }} aria-label="Danh sách điểm chuẩn">
          {filtered.map((g, idx) => (
            <li key={g.key} className="px-4 sm:px-6 py-5" style={{ borderBottom: idx < filtered.length - 1 ? "1px solid var(--kin-vien-thuong)" : "none" }}>
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                <div className="md:w-2/5">
                  <div className="font-semibold text-sm" style={{ color: "var(--kin-chu-chinh)" }}>{g.major}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--kin-chu-mo)" }}>{g.school}{g.variant && <> · {g.variant}</>}</div>
                  <span className="inline-block mt-2 px-2 py-1 rounded-md text-xs font-medium" style={{ background: "var(--kin-nen-bang)", color: "var(--kin-nhan-link)", border: "1px solid var(--kin-vien-thuong)" }}>
                    {methodLabel(g.method)}
                  </span>
                </div>
                <div className="flex-1 flex flex-wrap gap-3">
                  {g.entries.map((e, i) => {
                    const delta = scoreDelta(e, g.entries[i + 1]);
                    return (
                      <div key={e.id} className="rounded-lg px-3 py-2 min-w-[11rem]" style={{ border: "1px solid var(--kin-vien-thuong)", background: "var(--kin-nen-bang)" }}>
                        <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer"
                          aria-label={`Năm ${e.year}: ${formatScore(e.score)} trên thang ${e.scale}. Nguồn: ${e.sourceName} (mở trang mới)`}
                          className="block" style={{ minHeight: 44 }}>
                          <span className="flex items-baseline gap-2 font-bold" style={{ color: "var(--kin-nhan-link)" }}>
                            <span className="text-xs font-semibold" style={{ color: "var(--kin-chu-mo)" }}>{e.year}</span>
                            <span className="text-lg">{formatScore(e.score)}</span>
                            <span className="text-xs font-normal" style={{ color: "var(--kin-chu-mo)" }}>/{e.scale}</span>
                            {delta !== null && delta !== 0 && (
                              <span className="text-xs font-semibold" style={{ color: delta > 0 ? "var(--kin-tt-chu-xong)" : "var(--kin-tt-chu-loi)" }}>
                                {delta > 0 ? "▲" : "▼"} {formatScore(Math.abs(delta))}
                              </span>
                            )}
                          </span>
                          <span className="block text-xs mt-1 underline" style={{ color: "var(--kin-chu-phu)" }}>Nguồn: {e.sourceName}<span aria-hidden> ↗</span></span>
                        </a>
                        {!e.verified && <div className="text-xs mt-1 font-medium" style={{ color: "var(--kin-tt-chu-cho)" }}>Chưa đối chiếu với thông báo của trường</div>}
                        {e.note && <div className="text-xs mt-1" style={{ color: "var(--kin-chu-mo)" }}>{e.note}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl p-12 text-center" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
          <div className="flex justify-center mb-3" style={{ color: "var(--kin-vien-o-nhap)" }}><Search size={40} /></div>
          <p className="text-base font-semibold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Không tìm thấy kết quả</p>
          <p className="text-sm mb-4" style={{ color: "var(--kin-chu-mo)" }}>Thử từ khoá khác hoặc chọn phương thức khác.</p>
          <button type="button" onClick={reset} className="text-sm font-semibold" style={{ color: "var(--kin-nhan-link)", minHeight: 44 }}>Xem tất cả điểm chuẩn →</button>
        </div>
      )}

      <div className="mt-10 notion-hero-band rounded-xl p-8 text-center">
        <p className="text-base font-semibold text-white mb-2">Bạn muốn đạt điểm chuẩn trường mơ ước?</p>
        <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.65)" }}>Thi thử ĐGNL miễn phí để biết vị trí hiện tại và lộ trình cần cải thiện.</p>
        <a href="/thi-thu" className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 8, minHeight: 44 }}>
          Thi thử ĐGNL miễn phí
        </a>
      </div>
    </div>
  );
}
