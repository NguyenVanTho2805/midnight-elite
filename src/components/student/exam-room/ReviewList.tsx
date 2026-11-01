// Danh sách chữa bài: câu của em đánh dấu →, đáp án đúng ✓ CHỈ khi máy chủ gửi (isCorrect/correctAnswer/explanation có hay không do /review quyết;
// giao diện không tự suy ra từ dữ liệu khác). Câu chưa chữa dẫn sang luồng "Chữa lại các câu sai" (NV-188, CorrectionPanel).
"use client";
import { Fragment } from "react";
import { MathText } from "@/components/MathText";
import type { RoomReview } from "./roomApi";

const CARD = { background: "var(--kin-nen-trang)", border: "1px solid var(--kin-vien-thuong)" } as const;
const NOTE = { background: "var(--kin-nen-bang)", color: "var(--kin-chu-mo)" } as const;
const PENDING = { background: "var(--kin-tt-nen-cho)", color: "var(--kin-tt-chu-cho)" } as const;

function Explain({ text }: { text?: string | null }) {
  return text ? <p className="text-xs mt-1.5 p-2 rounded-lg" style={NOTE}><strong>Giải thích:</strong> <MathText text={text} /></p> : null;
}
function Unfixed({ hint }: { hint: string }) {
  return <p className="text-xs mt-1.5 p-2 rounded-lg" style={PENDING}>Câu này chưa chữa. Bấm <strong>Chữa lại các câu sai</strong> {hint}</p>;
}

export default function ReviewList({ data }: { data: RoomReview }) {
  return (
    <div className="space-y-3">
      {data.questions.map((q, idx) => {
        const prev = idx > 0 ? data.questions[idx - 1].sectionLabel : undefined;
        return (
          <Fragment key={q.id}>
            {q.sectionLabel && q.sectionLabel !== prev && <p className="text-xs font-bold uppercase tracking-wide pt-2" style={{ color: "var(--kin-nhan-link)" }}>{q.sectionLabel}</p>}
            <div className="rounded-xl p-4" style={CARD}>
              <p className="text-sm font-semibold mb-2" style={{ color: "var(--kin-chu-chinh)" }}>Câu {idx + 1}: <MathText text={q.text} /></p>

              {q.type === "MC" && (
                <div className="space-y-1.5">
                  {q.options.map(o => {
                    const mine = o.id === q.studentOptionId;
                    const color = o.isCorrect === true ? "var(--kin-tt-chu-xong)" : o.isCorrect === false && mine ? "var(--kin-tt-chu-loi)" : "var(--kin-chu-mo)";
                    return <div key={o.id} className="text-xs flex items-center gap-1.5" style={{ color }}>{mine && <strong>→</strong>} <MathText text={o.text} />{o.isCorrect === true && " ✓"}</div>;
                  })}
                  <Explain text={q.explanation} />
                  {q.correctionPending && <Unfixed hint="để thử trước — gợi ý sẽ hiện nếu chưa đúng, đáp án hiện sau khi bạn thử." />}
                </div>
              )}

              {q.type === "MC_MULTI" && (
                <div className="space-y-1.5">
                  {q.options.map(o => (
                    <div key={o.id} className="text-xs flex items-center gap-1.5" style={{ color: o.isCorrect === true ? "var(--kin-tt-chu-xong)" : o.picked && o.isCorrect === false ? "var(--kin-tt-chu-loi)" : "var(--kin-chu-mo)" }}>
                      <strong>{o.picked ? "☑" : "☐"}</strong> <MathText text={o.text} />{o.picked && " — bạn chọn"}{o.isCorrect === true && " ✓ đáp án đúng"}
                    </div>
                  ))}
                  <Explain text={q.explanation} />
                  {q.correctionPending && <Unfixed hint="để thử trước — gợi ý sẽ hiện nếu chưa đúng, đáp án hiện sau khi bạn thử." />}
                </div>
              )}

              {q.type === "TRUE_FALSE_CLUSTER" && (
                <div className="space-y-1.5">
                  {q.options.map(o => (
                    <div key={o.id} className="text-xs flex flex-wrap items-center gap-1.5" style={{ color: "var(--kin-chu-phu)" }}>
                      <strong>{o.subLabel})</strong> <MathText text={o.text} />
                      <span style={{ color: "var(--kin-chu-mo)" }}>— bạn chọn: {o.studentAnswerTrue === null ? "chưa trả lời" : o.studentAnswerTrue ? "Đúng" : "Sai"}</span>
                      {o.isCorrect !== null && <span style={{ color: o.isCorrect === o.studentAnswerTrue ? "var(--kin-tt-chu-xong)" : "var(--kin-tt-chu-loi)" }}>(đáp án đúng: {o.isCorrect ? "Đúng" : "Sai"})</span>}
                    </div>
                  ))}
                </div>
              )}

              {q.type === "ESSAY" && (
                <div>
                  <div className="text-sm p-3 rounded-lg mb-2" style={{ background: "var(--kin-nen-bang)", color: "var(--kin-chu-phu)" }}>
                    {q.textAnswer?.trim() ? q.textAnswer : <em style={{ color: "var(--kin-chu-mo)" }}>Bạn chưa trả lời</em>}
                  </div>
                  {q.pointsAwarded != null ? (
                    <div>
                      <p className="text-xs font-semibold" style={{ color: "var(--kin-tt-chu-xong)" }}>Điểm: {q.pointsAwarded}/{q.points}</p>
                      {q.teacherComment && <p className="text-xs mt-1" style={{ color: "var(--kin-chu-mo)" }}>Nhận xét: {q.teacherComment}</p>}
                    </div>
                  ) : <p className="text-xs" style={{ color: "var(--kin-chu-mo)" }}>{data.pendingManual ? "Chờ gia sư chấm và công bố" : "Chưa chấm"}</p>}
                </div>
              )}

              {q.type === "SHORT_ANSWER" && (
                <div className="text-xs space-y-1">
                  <p style={{ color: q.isCorrect ? "var(--kin-tt-chu-xong)" : "var(--kin-tt-chu-loi)" }}>Bạn trả lời: <strong>{q.studentAnswer?.trim() || "chưa trả lời"}</strong>{q.isCorrect === true && " ✓"}</p>
                  {q.correctAnswer !== null && <p style={{ color: "var(--kin-chu-mo)" }}>Đáp án đúng: {q.correctAnswer}</p>}
                  {q.correctionPending && <Unfixed hint="để thử trước — đáp án hiện sau khi bạn thử." />}
                </div>
              )}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
