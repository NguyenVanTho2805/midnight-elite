// NV-189 — Báo cáo tháng gửi phụ huynh: Nỗ lực và Năng lực tách riêng + mục cố định "Điều chưa đạt tháng này".
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import BaoCaoClient from "./BaoCaoClient";

export const dynamic = "force-dynamic";

export default async function BaoCaoThangPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/bao-cao-thang" });
  return <BaoCaoClient />;
}
