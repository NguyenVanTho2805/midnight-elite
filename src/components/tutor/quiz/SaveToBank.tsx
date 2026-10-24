// QZ — "Lưu vào ngân hàng câu hỏi" ngay từ trình soạn quiz của gia sư: COPY một câu (kể cả câu NHIỀU ĐÁP ÁN) thành bản ghi mới trong Ngân hàng câu hỏi
// (POST /api/exams/[id]/questions/[qid]/save-to-bank — route có sẵn; ngân hàng và quiz độc lập, sửa bên này không đổi bên kia).
// Nói thật: câu vào ngân hàng ở trạng thái NHÁP của cô (cần gửi duyệt ở trang Ngân hàng câu hỏi mới dùng chung được); tiêu chí chấm và hướng dẫn của câu tự luận KHÔNG được lưu.
"use client";
import { useEffect, useMemo, useState } from "react";
import { KIN_FIELD, KIN_LABEL } from "@/components/kin/PageLayout";
import { KinButton } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import { BANK_DIFFICULTIES, categoryPath, type BankCategory as Cat } from "@/lib/quizBank";
import { qfetch } from "./quizClient";

export default function SaveToBank({ examId, questionId, type, onDone, onCancel }: {
  examId: string; questionId: string; type: string; onDone: (msg: string) => void; onCancel: () => void;
}) {
  const [cats, setCats] = useState<Cat[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [difficulty, setDifficulty] = useState("TH");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    qfetch<Cat[]>("GET", "/api/question-categories").then(r => { if (!alive) return; if (r.ok && r.data) setCats(r.data); else setLoadErr(r.error); });
    return () => { alive = false; };
  }, []);
  const options = useMemo(() => (cats ?? []).map(c => ({ id: c.id, path: categoryPath(cats ?? [], c.id) })).sort((a, b) => a.path.localeCompare(b.path, "vi")), [cats]);

  async function save() {
    if (!categoryId) { setErr("Chọn đầu mục của ngân hàng."); return; }
    setBusy(true); setErr(null);
    const r = await qfetch<{ id: string }>("POST", `/api/exams/${examId}/questions/${questionId}/save-to-bank`, { categoryId, difficulty });
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? "Chưa lưu được."); return; }
    onDone("Đã lưu vào Ngân hàng câu hỏi (bản nháp của cô).");
  }

  return (
    <div className="mt-3 sm:col-span-2 rounded-[var(--kin-bo-md)] bg-[var(--kin-nen-bang)] p-4 space-y-3" data-luu-ngan-hang>
      {loadErr ? <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{loadErr}</p>
        : cats === null ? <p aria-busy="true" className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Đang tải các đầu mục…</p>
        : options.length === 0 ? <KinCallout title="Ngân hàng chưa có đầu mục nào">Cô tạo đầu mục ở trang Ngân hàng câu hỏi trước, rồi quay lại lưu câu này.</KinCallout>
        : (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label htmlFor={`sb-cat-${questionId}`} className={`${KIN_LABEL} mb-2`}>Đầu mục</label>
                <select id={`sb-cat-${questionId}`} className={KIN_FIELD} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                  <option value="">Chọn đầu mục</option>{options.map(o => <option key={o.id} value={o.id}>{o.path}</option>)}
                </select></div>
              <div><label htmlFor={`sb-dif-${questionId}`} className={`${KIN_LABEL} mb-2`}>Độ khó</label>
                <select id={`sb-dif-${questionId}`} className={KIN_FIELD} value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                  {BANK_DIFFICULTIES.map(d => <option key={d.v} value={d.v}>{d.label}</option>)}
                </select></div>
            </div>
            <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]">
              KiN sao chép nội dung câu này sang ngân hàng; hai bên độc lập, sửa bên nào không đổi bên kia. Câu vào ngân hàng ở trạng thái nháp của cô, gửi duyệt ở trang Ngân hàng câu hỏi thì mới dùng chung được.
              {type === "ESSAY" ? " Tiêu chí chấm và hướng dẫn chấm của câu tự luận không được lưu sang ngân hàng." : ""}
              {type === "MC_MULTI" ? " Mọi đáp án đúng của câu nhiều đáp án được giữ nguyên." : ""}
            </p>
          </>
        )}
      {err && <p role="alert" className="text-[length:var(--kin-co-goc)] text-[var(--kin-tt-chu-loi)]">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <KinButton onClick={() => void save()} loading={busy} loadingLabel="Đang lưu…" disabled={!cats || options.length === 0}>Lưu vào ngân hàng</KinButton>
        <KinButton variant="ghost" onClick={onCancel}>Đóng</KinButton>
      </div>
    </div>
  );
}
