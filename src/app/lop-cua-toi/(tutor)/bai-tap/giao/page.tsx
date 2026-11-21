// SCL-C (P2-2) — "+ Giao bài" mở thẳng form ngắn (lớp, tiêu đề, tệp đề kéo-thả hoặc quiz có sẵn, hạn nộp). Không bắt gắn vào bài học.
import { getSession } from "@/lib/session";
import { redirectIfNotTutor } from "@/lib/tutorGateServer";
import { KinPage, KinPageHeader } from "@/components/kin/PageLayout";
import GiaoBaiForm from "./GiaoBaiForm";

export const dynamic = "force-dynamic";

export default async function GiaoBaiPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await redirectIfNotTutor(await getSession(), { path: "/lop-cua-toi/bai-tap/giao", allowAdmin: true });
  const lop = (await searchParams).lop;
  return (
    <KinPage>
      <KinPageHeader back={{ href: "/lop-cua-toi/so-diem", label: "← Sổ điểm" }} title="Giao bài" sub="Chọn lớp, đặt tên bài, thả tệp đề (hoặc chọn quiz có sẵn) và hạn nộp. Học sinh thấy bài ngay trong lớp." />
      <GiaoBaiForm initialCourseId={typeof lop === "string" ? lop : ""} />
    </KinPage>
  );
}
