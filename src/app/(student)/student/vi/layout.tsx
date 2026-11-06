// Ví Coin đang ẩn (COIN_VISIBLE = false): không còn lối vào từ giao diện, gõ thẳng địa chỉ thì về Việc của tôi.
import { redirect } from "next/navigation";
import { COIN_VISIBLE } from "@/lib/features";

export default function ViLayout({ children }: { children: React.ReactNode }) {
  if (!COIN_VISIBLE) redirect("/student/viec-cua-toi");
  return children;
}
