// Lịch sử nạp Coin đang ẩn (COIN_VISIBLE = false): gõ thẳng địa chỉ thì về Hôm nay.
import { redirect } from "next/navigation";
import { COIN_VISIBLE } from "@/lib/features";

export default function TopupsLayout({ children }: { children: React.ReactNode }) {
  if (!COIN_VISIBLE) redirect("/admin");
  return children;
}
