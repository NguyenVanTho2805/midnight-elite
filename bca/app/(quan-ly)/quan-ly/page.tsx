// Trang CHẨN ĐOÁN tạm (phòng Giao diện sẽ dựng màn thật theo docs/bca/thiet-ke).
import { redirect } from "next/navigation";
import { nguoiHienTai } from "@/server/phien";
import { homNay } from "@/server/hom-nay";
import { DangXuat } from "@/app/dang-nhap/dang-xuat";

const API = ["/api/toi", "/api/hom-nay", "/api/hoc-sinh", "/api/buoi-hoc", "/api/diem-danh/thang?mon=toan", "/api/don", "/api/nhat-ky"];

export default async function QuanLy() {
  const u = await nguoiHienTai();
  if (!u) redirect("/dang-nhap");
  if (u.vai === "hoc_sinh") redirect("/hoc");
  const d = await homNay(u);
  return (
    <main className="mx-auto max-w-[1120px] p-4 sm:p-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Chẩn đoán · Hôm nay {d.hom_nay}</h1>
          <p className="text-text-2">{u.ten} · {u.vai === "chu" ? "Chủ lớp" : "Giáo viên"}</p>
        </div>
        <DangXuat />
      </header>
      <section className="mt-6">
        <h2 className="text-lg font-semibold">Lớp tối nay</h2>
        <ul className="mt-2 grid gap-2">
          {d.lop_toi_nay.map((b) => (
            <li key={b.id} className="rounded-[14px] border border-border bg-surface p-3 so">
              {b.toi_qua ? "Buổi tối qua · " : ""}{b.mon?.ten} {b.ngay} {b.gio} · {b.chinh_thuc} chính thức · {b.thu} thử · đã điểm {b.da_diem}/{b.si_so}
              {b.trang_thai === "huy" ? ` · Lớp nghỉ (${b.ly_do_huy})` : ""} · <a className="text-gold underline" href={`/api/diem-danh/${b.id}`}>điểm danh (JSON)</a>
            </li>
          ))}
          {!d.lop_toi_nay.length && <li className="text-text-3">Không có buổi.</li>}
        </ul>
      </section>
      <section className="mt-6">
        <h2 className="text-lg font-semibold">Việc cần làm ({d.viec.length})</h2>
        <ul className="mt-2 grid gap-1 text-sm">
          {d.viec.slice(0, 40).map((v, i) => (
            <li key={i} className="text-text-2">Mức {v.muc} · {v.loai} · {String(v.ho_ten ?? (v.mon as { ten?: string } | undefined)?.ten ?? "")} {v.ngay ?? ""}</li>
          ))}
        </ul>
      </section>
      <section className="mt-6">
        <h2 className="text-lg font-semibold">API (JSON)</h2>
        <ul className="mt-2 flex flex-wrap gap-3">{API.map((a) => <li key={a}><a className="text-gold underline" href={a}>{a}</a></li>)}</ul>
        <pre className="mt-4 overflow-x-auto rounded-[14px] bg-surface p-3 text-xs">{JSON.stringify(d.the_so, null, 2)}</pre>
      </section>
    </main>
  );
}
