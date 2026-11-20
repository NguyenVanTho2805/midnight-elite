"use client";
// Q3 chủ chốt (14/11/2026): ô cam kết bản quyền NHỚ THEO TÀI KHOẢN. Tích một lần ⇒ máy chủ ghi `preferences.copyrightPledgedAt`;
// lần sau, ở máy nào, ô tải tệp (DocumentsEditor, OTaiLen) đều tích sẵn. sessionStorage giữ lại làm lớp nhanh trong phiên (tránh nháy ô trống khi chờ GET).
// Bỏ tích ⇒ xoá khoá ở máy chủ. Lỗi mạng khi ghi không chặn việc tải tệp trong phiên này — chỉ là lần sau phải tích lại.
import { useEffect, useState } from "react";

const PLEDGE_KEY = "kin.gt.cam-ket";

export function useCamKetBanQuyen(): [boolean, (v: boolean) => void] {
  const [pledge, setPledge] = useState(false);
  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { if (sessionStorage.getItem(PLEDGE_KEY) === "1") setPledge(true); } catch { /* không có sessionStorage */ }
    fetch("/api/users/me/preferences", { credentials: "same-origin", cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then((d: { preferences?: { copyrightPledgedAt?: string } } | null) => {
        if (live && d?.preferences?.copyrightPledgedAt) { setPledge(true); try { sessionStorage.setItem(PLEDGE_KEY, "1"); } catch { /* bỏ qua */ } }
      })
      .catch(() => { /* giữ giá trị phiên */ });
    return () => { live = false; };
  }, []);
  const save = (v: boolean) => {
    setPledge(v);
    try { sessionStorage.setItem(PLEDGE_KEY, v ? "1" : "0"); } catch { /* bỏ qua */ }
    void fetch("/api/users/me/preferences", {
      method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copyrightPledge: v ? true : null }),
    }).catch(() => { /* lần sau tích lại */ });
  };
  return [pledge, save];
}
