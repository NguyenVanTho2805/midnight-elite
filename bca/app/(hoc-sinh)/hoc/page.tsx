// Trang CHẨN ĐOÁN tạm cho khu học sinh (Đợt 2 dựng màn thật).
import { redirect } from "next/navigation";
import { nguoiHienTai } from "@/server/phien";
import { cuaToi } from "@/server/hs";
import { DangXuat } from "@/app/dang-nhap/dang-xuat";

export default async function Hoc() {
  const u = await nguoiHienTai();
  if (!u) redirect("/dang-nhap");
  if (u.vai !== "hoc_sinh") redirect("/quan-ly");
  const d = await cuaToi(u);
  return (
    <main className="mx-auto max-w-md p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Chào {d.hoc_sinh.ho_ten}</h1>
        <DangXuat />
      </header>
      <p className="mt-1 text-text-2">{d.hoc_sinh.ma_hs} · {d.tinh_trang}</p>
      <ul className="mt-4 grid gap-2">
        {d.mon.map((m) => <li key={m.ma} className="rounded-[14px] bg-surface p-3">{m.ten}: {m.o ?? "—"} {m.con_han ? "" : "(đã khoá)"}</li>)}
      </ul>
      <h2 className="mt-6 text-lg font-semibold">Buổi ({d.buoi.length})</h2>
      <ul className="mt-2 grid gap-1 text-sm so">
        {d.buoi.slice(-14).map((b) => <li key={b.id}>{b.ngay} {b.mon} {b.gio} · {b.trang_thai === "huy" ? "Lớp nghỉ" : (b.diem_danh ?? "chưa điểm")}{b.khoa ? " · khoá tài liệu" : ""}</li>)}
      </ul>
      <p className="mt-6"><a className="text-gold underline" href="/api/hs/toi">/api/hs/toi (JSON)</a></p>
    </main>
  );
}
