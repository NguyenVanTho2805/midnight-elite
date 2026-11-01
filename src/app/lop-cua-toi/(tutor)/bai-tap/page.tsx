// Module "Bài tập" của gia sư (Figma 299:113312): bài tập, bài nộp chờ chấm và đề thi của các lớp mình dạy. Không phải gia sư → về /lop-cua-toi.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import BaiTap from "@/components/tutor/BaiTap";

export const dynamic = "force-dynamic";

export default async function BaiTapPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/bai-tap" });
  return <BaiTap />;
}
