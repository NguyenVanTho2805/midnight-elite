import { redirect } from "next/navigation";
import { nguoiHienTai } from "@/server/phien";

export default async function Goc() {
  const u = await nguoiHienTai();
  redirect(!u ? "/dang-nhap" : u.vai === "hoc_sinh" ? "/hoc" : "/quan-ly");
}
