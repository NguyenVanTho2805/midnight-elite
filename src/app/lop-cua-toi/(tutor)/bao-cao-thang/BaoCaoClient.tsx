// Báo cáo tháng của gia sư: chọn tháng → chọn học sinh → đọc số liệu thật (chuyên cần, nỗ lực, năng lực) → đọc và sửa
// các dòng "Điều chưa đạt tháng này" KiN gợi ý sẵn → Duyệt (phụ huynh thấy trên Sổ của con) → mở Zalo gửi tin soạn sẵn.
// KiN chỉ gợi ý; gia sư là người quyết định từng dòng. Không bao giờ ghi "đã gửi" (KiN không biết tin có đi thật hay không).
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KinButton, kinButtonClass } from "@/components/kin";
import BrandCard from "./BrandCard";
import { Badge, CARD_STYLE, FIELD_STYLE, Modal, callApi, useNotify } from "@/components/tutor/shared";
import { EMPTY_UNMET_TEXT, MAX_UNMET_ITEMS, UNMET_TEXT_MAX, fmtScore, renderReportText, type SubjectMonthMetrics, type UnmetItem } from "@/lib/monthlyReport";
import { addDaysKey, hmOf, vnDateKeyOf, vnMinutesOfDay } from "@/lib/classSessions";
import { openZalo } from "@/lib/zaloShare";
import { monthlyReportGroupMessage } from "@/lib/invoiceZalo";

interface Row { studentId: string; name: string; courses: string[]; status: "none" | "draft" | "approved"; approvedAt: string | null; zaloOpenedAt: string | null; changedSinceApproval: boolean }
interface List { yearMonth: string; items: Row[]; summary: { total: number; approved: number; draft: number; none: number } }
interface Detail {
  yearMonth: string;
  student: { id: string; name: string; parentName: string | null; parentPhone: string | null };
  subjects: SubjectMonthMetrics[]; suggested: UnmetItem[]; items: UnmetItem[]; hasDraft: boolean;
  report: { approved: boolean; approvedAt: string | null; zaloOpenedAt: string | null; approvedItems: UnmetItem[] | null; brandedAt: string | null };
  canBrand: boolean; hasBrand: boolean;
  text: string;
}

const vnHm = (iso: string) => hmOf(vnMinutesOfDay(new Date(iso)));
const vnDm = (iso: string) => { const k = vnDateKeyOf(new Date(iso)); return `${k.slice(8, 10)}/${k.slice(5, 7)}`; };
const monthLabel = (ym: string) => `Tháng ${Number(ym.slice(5, 7))}/${ym.slice(0, 4)}`;
const shiftMonth = (ym: string, n: number) => { const k = addDaysKey(`${ym}-15`, n * 30); return k.slice(0, 7); };
const TONE: Record<string, "ok" | "wait" | "neutral"> = { xong: "ok", cho: "wait", "trung-tinh": "neutral" };

export default function BaoCaoClient() {
  const notify = useNotify();
  const router = useRouter();
  const [ym, setYm] = useState(() => vnDateKeyOf(new Date()).slice(0, 7));
  const [list, setList] = useState<List | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [items, setItems] = useState<UnmetItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [brandSaved, setBrandSaved] = useState(false); // vừa cài thương hiệu: báo cáo đang mở không cần tải lại (giữ phần gia sư đang sửa dở)
  const [zalo, setZalo] = useState<string | null>(null);
  // PH-213/216: gửi vào chat riêng (có điểm, có điều chưa đạt) hoặc nhóm Zalo lớp (chỉ báo "đã gửi riêng", không điểm, không tên em).
  const [zaloTarget, setZaloTarget] = useState<"private" | "group">("private");
  const [privateText, setPrivateText] = useState("");
  const listSeq = useRef(0), detSeq = useRef(0);
  const currentYm = vnDateKeyOf(new Date()).slice(0, 7);

  const loadList = useCallback(async (m: string) => {
    await Promise.resolve();
    const my = ++listSeq.current;
    setLoading(true); setFailed(false);
    const r = await callApi<List>(`/api/tutor/monthly-reports?yearMonth=${m}`);
    if (my !== listSeq.current) return;
    if (!r.ok) setFailed(true); else setList(r.data);
    setLoading(false);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadList(ym);
  }, [loadList, ym]);

  const loadDetail = useCallback(async (studentId: string, m: string) => {
    await Promise.resolve();
    const my = ++detSeq.current;
    setDetail(null);
    const r = await callApi<Detail>(`/api/tutor/monthly-reports/${studentId}?yearMonth=${m}`);
    if (my !== detSeq.current) return;
    if (!r.ok) { notify.err(r.data.error ?? "Không tải được báo cáo"); return; }
    setDetail(r.data); setItems(r.data.items); setDirty(false);
  }, [notify]);

  function openStudent(id: string) {
    if (openId === id) { setOpenId(null); setDetail(null); return; }
    setOpenId(id); void loadDetail(id, ym);
  }
  function changeMonth(m: string) { setYm(m); setOpenId(null); setDetail(null); }

  const edit = (next: UnmetItem[]) => { setItems(next); setDirty(true); };

  async function saveDraft(): Promise<boolean> {
    if (!detail) return false;
    setBusy("save");
    const r = await callApi<{ items: UnmetItem[] }>(`/api/tutor/monthly-reports/${detail.student.id}?yearMonth=${ym}`, { method: "PUT", body: JSON.stringify({ items }) });
    setBusy(null);
    if (!r.ok) { notify.err(r.data.error ?? "Không lưu được"); return false; }
    setItems(r.data.items); setDirty(false); notify.ok("Đã lưu bản nháp."); void loadList(ym);
    return true;
  }
  async function approve() {
    if (!detail) return;
    setBusy("approve");
    const r = await callApi<{ approvedAt: string }>(`/api/tutor/monthly-reports/${detail.student.id}/approve?yearMonth=${ym}`, { method: "POST", body: JSON.stringify({ items }) });
    setBusy(null);
    if (!r.ok) { notify.err(r.data.error ?? "Không duyệt được"); return; }
    notify.ok("Đã duyệt — phụ huynh thấy báo cáo này trên Sổ của con.");
    void loadDetail(detail.student.id, ym); void loadList(ym);
  }
  async function unapprove() {
    if (!detail) return;
    setBusy("unapprove");
    const r = await callApi(`/api/tutor/monthly-reports/${detail.student.id}/approve?yearMonth=${ym}`, { method: "DELETE" });
    setBusy(null);
    if (!r.ok) { notify.err(r.data.error ?? "Không gỡ được"); return; }
    notify.ok("Đã gỡ khỏi Sổ của con.");
    void loadDetail(detail.student.id, ym); void loadList(ym);
  }
  // KiN Pro F3: tạo bản in có thương hiệu (đóng băng thương hiệu vào báo cáo) rồi mở trang in. Free khi cổng bật không thấy nút này.
  async function makeBranded() {
    if (!detail) return;
    setBusy("branded");
    const r = await callApi(`/api/tutor/monthly-reports/${detail.student.id}/branded?yearMonth=${ym}`, { method: "POST" });
    setBusy(null);
    if (!r.ok) { notify.err(r.data.error ?? "Không tạo được bản in có thương hiệu"); return; }
    router.push(`/lop-cua-toi/bao-cao-thang/in/${detail.student.id}?yearMonth=${ym}`);
  }
  async function openZaloNow() {
    if (!detail || zalo === null) return;
    const res = await openZalo({ text: zalo, phone: zaloTarget === "private" ? detail.student.parentPhone : null });
    if (!res.opened) { if (res.reason === "failed") notify.err("Không mở được Zalo. Hãy chép tin và gửi tay."); return; }
    if (zaloTarget === "group") {
      // Tin nhóm không phải là gửi báo cáo cho phụ huynh nên KHÔNG ghi "đã mở Zalo" của báo cáo.
      notify.info(res.method === "share" ? "Chọn nhóm Zalo trong bảng chia sẻ rồi bấm gửi." : "Đã chép tin và mở Zalo — dán vào nhóm rồi bấm gửi.");
      setZalo(null);
      return;
    }
    const log = await callApi(`/api/tutor/monthly-reports/${detail.student.id}/zalo?yearMonth=${ym}`, { method: "POST" });
    if (!log.ok) notify.err(log.data.error ?? "Đã mở Zalo nhưng chưa ghi lại được.");
    else notify.info(res.method === "share" ? "Chọn Zalo trong bảng chia sẻ rồi bấm gửi." : "Đã chép tin và mở Zalo — dán vào cuộc trò chuyện rồi bấm gửi.");
    setZalo(null);
    void loadDetail(detail.student.id, ym); void loadList(ym);
  }

  const approved = !!detail?.report.approved;
  const stale = approved && (dirty || JSON.stringify(items) !== JSON.stringify(detail?.report.approvedItems ?? []));

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <header className="mb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-h3 font-bold" style={{ color: "var(--kin-chu-chinh)" }}>Báo cáo tháng</h1>
          <p className="text-caption mt-1" style={{ color: "var(--kin-chu-phu)" }} aria-live="polite">
            {monthLabel(ym)}{list ? ` · ${list.summary.approved}/${list.summary.total} đã duyệt` : ""}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Chuyển tháng">
          <KinButton variant="secondary" onClick={() => changeMonth(shiftMonth(ym, -1))}>← Tháng trước</KinButton>
          <KinButton variant="secondary" disabled={ym >= currentYm} onClick={() => changeMonth(shiftMonth(ym, 1))}>Tháng sau →</KinButton>
        </div>
      </header>

      <BrandCard onSaved={() => setBrandSaved(true)} />

      <p className="text-sm mb-4 rounded-xl p-3" style={{ ...CARD_STYLE, color: "var(--kin-chu-phu)" }}>
        Nỗ lực và Năng lực luôn là <b>hai con số riêng</b>, không gộp, không xếp hạng. Mục <b>Điều chưa đạt tháng này</b> luôn có trong báo cáo gửi phụ huynh — KiN gợi ý sẵn, bạn đọc và sửa trước khi duyệt.
      </p>

      {failed && (
        <div role="alert" className="rounded-xl p-3 mb-4 flex items-center justify-between gap-3" style={{ ...CARD_STYLE, borderColor: "var(--kin-tt-chu-loi)" }}>
          <span className="text-sm" style={{ color: "var(--kin-tt-chu-loi)" }}>Không tải được danh sách. Kiểm tra mạng rồi thử lại.</span>
          <KinButton variant="secondary" onClick={() => void loadList(ym)}>Thử lại</KinButton>
        </div>
      )}

      {loading && !list ? (
        <div aria-busy="true" aria-label="Đang tải" className="space-y-2">{[0, 1, 2].map(i => <div key={i} className="rounded-xl h-[60px]" style={{ ...CARD_STYLE, opacity: 0.6 }} />)}</div>
      ) : list && list.items.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ ...CARD_STYLE, borderStyle: "dashed" }}>
          <p className="font-semibold" style={{ color: "var(--kin-chu-chinh)" }}>Chưa có học sinh nào</p>
          <p className="text-sm mt-1" style={{ color: "var(--kin-chu-phu)" }}>Báo cáo lập cho học sinh đang học lớp của bạn. Gửi mã mời để học sinh vào lớp.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {list?.items.map(row => {
            const isOpen = openId === row.studentId;
            return (
              <li key={row.studentId} className="rounded-xl" style={CARD_STYLE}>
                <button type="button" onClick={() => openStudent(row.studentId)} aria-expanded={isOpen} aria-controls={`bc-${row.studentId}`}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 min-h-[44px]">
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold truncate" style={{ color: "var(--kin-chu-chinh)" }}>{row.name}</span>
                    <span className="block text-xs truncate" style={{ color: "var(--kin-chu-phu)" }}>{row.courses.join(" · ")}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1 flex-shrink-0">
                    <Badge tone={row.status === "approved" ? "ok" : row.status === "draft" ? "wait" : "neutral"}>
                      {row.status === "approved" ? "Đã duyệt" : row.status === "draft" ? "Bản nháp" : "Chưa soạn"}
                    </Badge>
                    {row.changedSinceApproval && <Badge tone="wait">Đã sửa sau khi duyệt</Badge>}
                    {row.zaloOpenedAt && <span className="text-xs" style={{ color: "var(--kin-tt-chu-xong)" }}>Đã mở Zalo lúc {vnHm(row.zaloOpenedAt)} {vnDm(row.zaloOpenedAt)}</span>}
                  </span>
                  <span aria-hidden style={{ color: "var(--kin-chu-phu)" }}>{isOpen ? "▾" : "▸"}</span>
                </button>

                {isOpen && (
                  <div id={`bc-${row.studentId}`} className="px-4 pb-4 pt-3 space-y-4" style={{ borderTop: "1px solid var(--kin-vien-thuong)" }}>
                    {!detail ? <p className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>Đang tính số liệu…</p> : (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm min-w-[520px]">
                            <thead>
                              <tr style={{ color: "var(--kin-chu-phu)" }}>
                                {["Môn", "Chuyên cần", "Bài về nhà đúng hạn", "Nỗ lực", "Năng lực (3 bài gần nhất)"].map(h => <th key={h} scope="col" className="text-left font-medium text-xs py-1 pr-3">{h}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {detail.subjects.map(s => (
                                <tr key={s.courseId} style={{ borderTop: "1px solid var(--kin-vien-nhat)", color: "var(--kin-chu-chinh)" }}>
                                  <th scope="row" className="text-left font-semibold py-2 pr-3">{s.courseName}</th>
                                  <td className="py-2 pr-3">{s.attendance.ratio === null ? "chưa có buổi điểm danh" : `${Math.round(s.attendance.ratio * 100)}% (${s.attendance.sessions} buổi)`}</td>
                                  <td className="py-2 pr-3">{s.homework.assigned === 0 ? "không giao bài" : `${s.homework.onTime}/${s.homework.assigned}`}</td>
                                  <td className="py-2 pr-3">{s.effort === null ? "chưa đo được" : `${s.effort}/10`}</td>
                                  <td className="py-2">
                                    {s.mastery.value === null ? "chưa có bài kiểm tra" : `${fmtScore(s.mastery.value)}/10${s.mastery.scores.length ? ` (${s.mastery.scores.map(fmtScore).join(" · ")})` : ""}`}
                                    <div className="mt-0.5"><Badge tone={TONE[s.mastery.tone]}>{s.mastery.text}</Badge></div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div>
                          <h3 className="text-sm font-bold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Điều chưa đạt tháng này</h3>
                          <p className="text-xs mb-2" style={{ color: "var(--kin-chu-phu)" }}>
                            {detail.hasDraft ? "Bản nháp của bạn." : "KiN gợi ý sẵn các dòng dưới đây từ số liệu thật — bạn đọc, sửa, xoá hoặc thêm dòng."} Để trống thì phụ huynh vẫn thấy mục này với câu “{EMPTY_UNMET_TEXT}”.
                          </p>
                          {items.length === 0 ? (
                            <p className="text-sm rounded-lg p-3" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)", color: "var(--kin-chu-phu)" }}>{EMPTY_UNMET_TEXT}</p>
                          ) : (
                            <ul className="space-y-2">
                              {items.map((it, i) => (
                                <li key={i} className="rounded-lg p-2" style={{ background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" }}>
                                  {it.kind !== "tu-viet" && <span className="text-xs font-semibold" style={{ color: "var(--kin-chu-phu)" }}>Gợi ý của KiN</span>}
                                  <div className="flex gap-2 items-start mt-1">
                                    <textarea aria-label={`Dòng chưa đạt ${i + 1}`} rows={2} maxLength={UNMET_TEXT_MAX} value={it.text}
                                      onChange={e => edit(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                                      className="flex-1 px-3 py-2 rounded-lg text-sm" style={FIELD_STYLE} />
                                    <KinButton variant="secondary" aria-label={`Xoá dòng ${i + 1}`} onClick={() => edit(items.filter((_, j) => j !== i))}>Xoá</KinButton>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="flex gap-2 flex-wrap mt-2">
                            <KinButton variant="secondary" disabled={items.length >= MAX_UNMET_ITEMS} onClick={() => edit([...items, { text: "", kind: "tu-viet" }])}>+ Thêm dòng</KinButton>
                            <KinButton variant="secondary" onClick={() => edit(detail.suggested)}>Dùng lại gợi ý của KiN</KinButton>
                          </div>
                        </div>

                        <div className="flex gap-2 flex-wrap items-center">
                          <KinButton variant="secondary" loading={busy === "save"} disabled={!dirty} onClick={() => void saveDraft()}>Lưu bản nháp</KinButton>
                          <KinButton loading={busy === "approve"} onClick={() => void approve()}>{approved ? "Duyệt lại" : "Duyệt — hiện cho phụ huynh"}</KinButton>
                          {approved && (
                            <KinButton variant="secondary" disabled={stale} onClick={() => { const t = renderReportText({ studentName: detail.student.name, parentName: detail.student.parentName, yearMonth: ym, subjects: detail.subjects, unmet: detail.report.approvedItems ?? items }); setPrivateText(t); setZaloTarget("private"); setZalo(t); }}>
                              Gửi phụ huynh qua Zalo
                            </KinButton>
                          )}
                          {approved && <KinButton variant="secondary" loading={busy === "unapprove"} onClick={() => void unapprove()}>Gỡ khỏi Sổ của con</KinButton>}
                        </div>
                        {approved && (
                          <div className="flex gap-2 flex-wrap items-center" role="group" aria-label="Bản in">
                            <Link href={`/lop-cua-toi/bao-cao-thang/in/${detail.student.id}?yearMonth=${ym}&mau=kin`} className={kinButtonClass("secondary")}>In / PDF (mẫu KiN)</Link>
                            {detail.report.brandedAt ? (
                              <Link href={`/lop-cua-toi/bao-cao-thang/in/${detail.student.id}?yearMonth=${ym}`} className={kinButtonClass("secondary")}>In bản có thương hiệu</Link>
                            ) : detail.canBrand && !detail.hasBrand && !brandSaved ? (
                              <span className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>Cài tên và màu ở thẻ “Thương hiệu giấy tờ” phía trên để tạo bản in có thương hiệu.</span>
                            ) : detail.canBrand ? (
                              <KinButton variant="secondary" loading={busy === "branded"} onClick={() => void makeBranded()}>Tạo bản in có thương hiệu</KinButton>
                            ) : (
                              <span className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>Bản in có thương hiệu: có trong <Link href="/lop-cua-toi/goi" className="underline" style={{ color: "var(--kin-nhan-link)" }}>KiN Pro</Link>. Mẫu KiN vẫn in miễn phí.</span>
                            )}
                          </div>
                        )}
                        {approved && (
                          <p className="text-xs" style={{ color: "var(--kin-chu-phu)" }}>
                            Đã duyệt lúc {vnHm(detail.report.approvedAt!)} {vnDm(detail.report.approvedAt!)}.
                            {stale ? " Bạn vừa sửa sau khi duyệt — phụ huynh vẫn thấy bản cũ cho tới khi bạn bấm Duyệt lại." : " Phụ huynh xem trên Sổ của con."}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {zalo !== null && detail && (
        <Modal title={`Báo cáo tháng — ${detail.student.name}`} onClose={() => setZalo(null)}>
          <fieldset className="mb-2 text-sm">
            <legend className="font-semibold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Gửi vào đâu?</legend>
            {([["private", "Chat riêng với phụ huynh"], ["group", "Nhóm Zalo lớp (chỉ báo đã gửi riêng)"]] as const).map(([v, l]) => (
              <label key={v} className="flex items-center gap-2 py-1 min-h-[44px]">
                <input type="radio" name="bc-target" checked={zaloTarget === v}
                  onChange={() => { if (zaloTarget === "private") setPrivateText(zalo); setZaloTarget(v); setZalo(v === "group" ? monthlyReportGroupMessage({ yearMonth: ym }) : privateText || zalo); }} /> {l}
              </label>
            ))}
          </fieldset>
          <label className="block text-sm" htmlFor="tin-bao-cao">Tin nhắn (sửa được trước khi gửi)</label>
          <textarea id="tin-bao-cao" rows={12} value={zalo} onChange={e => setZalo(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg text-sm" style={FIELD_STYLE} />
          <p className="text-xs mt-2" style={{ color: "var(--kin-chu-phu)" }}>
            {zaloTarget === "group"
              ? "Tin nhóm không có điểm, điều chưa đạt hay tên con, vì ai trong nhóm cũng đọc được. Báo cáo của từng em luôn gửi riêng."
              : detail.student.parentPhone ? `Sẽ mở Zalo của ${detail.student.parentPhone}.` : "Chưa có số điện thoại phụ huynh — KiN sẽ chép tin và mở Zalo, bạn chọn đúng người nhận."} KiN không gửi giúp: bạn tự bấm gửi trong Zalo.
          </p>
          <div className="flex gap-2 flex-wrap mt-4 justify-end">
            <KinButton variant="secondary" onClick={() => setZalo(null)}>Đóng</KinButton>
            <KinButton onClick={() => void openZaloNow()} disabled={!zalo.trim()}>Mở Zalo</KinButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
