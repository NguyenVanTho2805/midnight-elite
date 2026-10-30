// TT-201/202/203 — Lịch tuần của gia sư: buổi học, tin nhắc lịch chờ gửi, báo nghỉ sát giờ.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import LichClient from "./LichClient";

export const dynamic = "force-dynamic";

export default async function LichPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/lich" });
  return <LichClient />;
}
