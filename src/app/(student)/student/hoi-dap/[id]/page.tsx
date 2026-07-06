import { redirect } from "next/navigation";

export default async function HoiDapDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/cong-dong/hoi-dap/${id}`);
}
