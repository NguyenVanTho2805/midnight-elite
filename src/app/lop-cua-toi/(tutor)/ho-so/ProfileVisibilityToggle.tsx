// NC2-022 — công tắc Hiện / Ẩn hồ sơ công khai. Lưu NGAY khi bấm (không cần nút Lưu hồ sơ): PUT /api/users/me/tutor-profile { profile: { hidden } }.
// Mặc định HIỆN. Trường/bằng cấp tuỳ chọn (Q11) nên không có điều kiện nào để bật Hiện.
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { KinButton } from "@/components/kin";
import { CARD_STYLE, callApi } from "@/components/tutor/shared";

export const VISIBLE_HINT = "Phụ huynh có thể tìm thấy và xem hồ sơ của bạn.";
export const HIDDEN_HINT = "Hồ sơ không hiện trên trang Gia sư và link cũ báo không tìm thấy; lớp và học sinh của bạn không bị ảnh hưởng.";

export default function ProfileVisibilityToggle({ initialHidden }: { initialHidden: boolean }) {
  const router = useRouter();
  const [hidden, setHidden] = useState(initialHidden);
  const [saving, setSaving] = useState(false);
  // Lần lưu thất bại: nhớ giá trị muốn đặt để "Thử lại" lưu đúng nó.
  const [failed, setFailed] = useState<{ want: boolean; message: string } | null>(null);

  async function apply(wantHidden: boolean) {
    setSaving(true); setFailed(null);
    const r = await callApi<{ error?: string }>("/api/users/me/tutor-profile", { method: "PUT", body: JSON.stringify({ profile: { hidden: wantHidden } }) });
    setSaving(false);
    if (r.ok) { setHidden(wantHidden); router.refresh(); } // làm mới để bản xem trước bên dưới đổi theo
    else setFailed({ want: wantHidden, message: r.data.error ?? "Không lưu được. Kiểm tra mạng rồi thử lại." });
  }

  const shown = !hidden;
  return (
    <section className="rounded-xl p-5 mb-6" style={CARD_STYLE} aria-labelledby="h-hien-an" data-testid="hien-an">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="h-hien-an" className="font-bold mb-1" style={{ color: "var(--kin-chu-chinh)" }}>Hồ sơ công khai: <span data-testid="hien-an-trang-thai">{shown ? "Hiện" : "Ẩn"}</span></h2>
          <p id="hien-an-mo-ta" className="text-sm" style={{ color: "var(--kin-chu-phu)" }}>{shown ? VISIBLE_HINT : HIDDEN_HINT}</p>
        </div>
        <button type="button" role="switch" aria-checked={shown} aria-label="Hiện hồ sơ công khai" aria-describedby="hien-an-mo-ta" disabled={saving}
          onClick={() => void apply(shown)}
          className="relative w-14 h-11 flex-shrink-0 flex items-center justify-center" data-testid="hien-an-cong-tac">
          <span aria-hidden className="relative block w-12 h-7 rounded-full" style={{ background: shown ? "var(--kin-nhan-nen)" : "var(--kin-vien-thuong)" }}>
            <span className="absolute top-1 w-5 h-5 rounded-full" style={{ left: shown ? "26px" : "4px", background: "var(--kin-nen-trang)" }} />
          </span>
        </button>
      </div>
      {saving && <p role="status" className="text-xs mt-2" style={{ color: "var(--kin-chu-phu)" }}>Đang lưu…</p>}
      {failed && (
        <div role="alert" className="mt-3 text-sm flex items-center gap-3 flex-wrap" style={{ color: "var(--kin-tt-chu-loi)" }}>
          <span>{failed.message}</span>
          <KinButton variant="secondary" onClick={() => void apply(failed.want)}>Thử lại</KinButton>
        </div>
      )}
    </section>
  );
}
