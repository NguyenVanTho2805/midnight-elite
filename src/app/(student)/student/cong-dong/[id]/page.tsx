import { redirect } from "next/navigation";

export default async function ThreadDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/cong-dong/${id}`);
}
