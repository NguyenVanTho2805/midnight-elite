// Trường tuỳ chỉnh cho hồ sơ học sinh (LO-18). Chỉ gia sư.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import TruongTuyChinh from "@/components/tutor/TruongTuyChinh";

export const dynamic = "force-dynamic";

export default async function TruongPage() {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/hoc-sinh/truong" });
  return <TruongTuyChinh />;
}
