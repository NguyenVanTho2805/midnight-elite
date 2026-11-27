"use client";
// Màn Tài khoản (T55): thêm GV, sửa tên/môn, khoá/mở khoá, đăng xuất mọi máy. Cần mạng (không xếp hàng đợi); máy chủ kiểm quyền.
// Danh sách giữ ở trạng thái máy khách, cập nhật thẳng từ kết quả API (không chờ router.refresh — tránh hiện chậm/thiếu).
import { useId, useState } from "react";
import { DauTrang, NoiDung } from "../khung/dau-trang";
import { Chip } from "../ui/chip";
import { nhan, nutChinh, nutNguy, nutPhu, oNhap } from "../ui/nut";

type Mon = { ma: string; ten_ngan: string };
type Tk = { id: string; gmail: string; ten: string; vai: "chu" | "giao_vien"; khoa: boolean; mon: string[] };

async function goi(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => null);
  if (!r) throw new Error("Mất mạng — kiểm tra kết nối rồi thử lại.");
  const kq = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(kq.loi ?? `Không làm được (mã ${r.status}).`);
  return kq;
}

function ChonMon({ mon, chon, doi, ten }: { mon: Mon[]; chon: string[]; doi: (m: string[]) => void; ten: string }) {
  if (!mon.length) return <p className="mt-1 text-[13px] text-warn">Chưa có môn trong hệ thống (có sau khi chuyển dữ liệu từ sheet). Vẫn thêm được, gán môn sau.</p>;
  return (
    <fieldset className="mt-1">
      <legend className="sr-only">{ten}</legend>
      <div className="flex flex-wrap gap-2">
        {mon.map((m) => {
          const bat = chon.includes(m.ma);
          return (
            <label key={m.ma} className={`nhan inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 font-semibold ${bat ? "border-gold bg-nav-active text-gold" : "border-border-input text-text-2 hover:bg-row-hover"}`}>
              <input type="checkbox" className="sr-only" checked={bat} onChange={() => doi(bat ? chon.filter((x) => x !== m.ma) : [...chon, m.ma])} />
              {m.ten_ngan}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Cả màn (đầu trang, danh sách, form thêm) — một nguồn trạng thái. */
export function ManTaiKhoan({ toi, mon, taiKhoan }: { toi: string; mon: Mon[]; taiKhoan: Tk[] }) {
  const [ds, setDs] = useState(taiKhoan);
  const sua = (id: string, v: Partial<Tk>) => setDs((x) => x.map((t) => (t.id === id ? { ...t, ...v } : t)));
  return (
    <>
      <DauTrang tieuDe="Tài khoản" phu={`${ds.length} tài khoản`} />
      <NoiDung className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <h1 className="sr-only">Tài khoản</h1>
        <section aria-labelledby="ds-tk" className="grid gap-3 lg:order-1">
          <h2 id="ds-tk" className="text-[15px] font-semibold text-text-2">Chủ lớp và giáo viên</h2>
          <DanhSachTaiKhoan toi={toi} mon={mon} taiKhoan={ds} sua={sua} />
        </section>
        <section aria-labelledby="them-gv" className="rounded-[14px] border border-border bg-surface p-4 lg:order-2">
          <h2 id="them-gv" className="font-semibold">Thêm giáo viên</h2>
          <p className="mt-1 text-[13px] text-text-2">Giáo viên đăng nhập bằng Google với đúng Gmail này. Chỉ thấy môn được giao.</p>
          <ThemGiaoVien mon={mon} them={(t) => setDs((x) => [...x, t])} />
        </section>
      </NoiDung>
    </>
  );
}

function ThemGiaoVien({ mon, them }: { mon: Mon[]; them: (t: Tk) => void }) {
  const id = useId();
  const [gmail, setGmail] = useState("");
  const [ten, setTen] = useState("");
  const [chon, setChon] = useState<string[]>([]);
  const [dang, setDang] = useState(false);
  const [bao, setBao] = useState<{ loai: "ok" | "loi"; chu: string } | null>(null);
  return (
    <form
      className="mt-4 grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setDang(true);
        setBao(null);
        try {
          const kq = await goi("/api/nguoi-dung", "POST", { gmail, ten, mon: chon });
          const canh = kq.trung_ho_so_hs?.length ? ` Lưu ý: Gmail này cũng ghi trên hồ sơ học sinh ${kq.trung_ho_so_hs.join(", ")} — đăng nhập sẽ vào vai giáo viên.` : "";
          setBao({ loai: "ok", chu: `Đã thêm ${kq.ten}. Nhắn họ mở web và bấm "Đăng nhập bằng Google" với Gmail này.${canh}` });
          them({ id: kq.id, gmail: kq.gmail, ten: kq.ten, vai: "giao_vien", khoa: false, mon: kq.mon });
          setGmail(""); setTen(""); setChon([]);
        } catch (err) {
          setBao({ loai: "loi", chu: (err as Error).message });
        } finally {
          setDang(false);
        }
      }}
    >
      <div>
        <label htmlFor={`${id}-g`} className={nhan}>Gmail</label>
        <input id={`${id}-g`} type="email" inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false} required value={gmail} onChange={(e) => setGmail(e.target.value)} placeholder="ten@gmail.com" className={`${oNhap} mt-1`} />
      </div>
      <div>
        <label htmlFor={`${id}-t`} className={nhan}>Tên hiển thị</label>
        <input id={`${id}-t`} required maxLength={80} value={ten} onChange={(e) => setTen(e.target.value)} placeholder="Ví dụ: Chị Hoa" className={`${oNhap} mt-1`} />
      </div>
      <div>
        <span className={nhan}>Môn phụ trách</span>
        <ChonMon mon={mon} chon={chon} doi={setChon} ten="Môn phụ trách" />
      </div>
      <button type="submit" disabled={dang} className={nutChinh}>{dang ? "Đang thêm…" : "Thêm giáo viên"}</button>
      {bao ? <p role={bao.loai === "loi" ? "alert" : "status"} className={`text-[14px] ${bao.loai === "loi" ? "text-danger" : "text-ok"}`}>{bao.chu}</p> : null}
    </form>
  );
}

function DanhSachTaiKhoan({ toi, mon, taiKhoan, sua }: { toi: string; mon: Mon[]; taiKhoan: Tk[]; sua: (id: string, v: Partial<Tk>) => void }) {
  const chuConHoatDong = taiKhoan.filter((t) => t.vai === "chu" && !t.khoa).length;
  return (
    <ul className="grid gap-3">
      {taiKhoan.map((t) => <DongTk key={t.id} t={t} laToi={t.id === toi} mon={mon} chuCuoi={t.vai === "chu" && !t.khoa && chuConHoatDong <= 1} sua={(v) => sua(t.id, v)} />)}
    </ul>
  );
}

function DongTk({ t, laToi, mon, chuCuoi, sua }: { t: Tk; laToi: boolean; mon: Mon[]; chuCuoi: boolean; sua: (v: Partial<Tk>) => void }) {
  const id = useId();
  const [mo, setMo] = useState<null | "sua" | "khoa" | "dang-xuat">(null);
  const [ten, setTen] = useState(t.ten);
  const [chon, setChon] = useState(t.mon);
  const [dang, setDang] = useState(false);
  const [bao, setBao] = useState<{ loai: "ok" | "loi"; chu: string } | null>(null);
  const tenMon = (m: string) => mon.find((x) => x.ma === m)?.ten_ngan ?? m;
  async function lam(fn: () => Promise<Partial<Tk> & { ok?: boolean }>, xong: string) {
    setDang(true);
    setBao(null);
    try {
      const kq = await fn();
      const { ten: tenMoi, mon: monMoi, khoa } = kq;
      sua({ ...(tenMoi !== undefined ? { ten: tenMoi } : {}), ...(monMoi !== undefined ? { mon: monMoi } : {}), ...(khoa !== undefined ? { khoa } : {}) });
      if (tenMoi !== undefined) setTen(tenMoi);
      if (monMoi !== undefined) setChon(monMoi);
      setMo(null);
      setBao({ loai: "ok", chu: xong });
    } catch (err) {
      setBao({ loai: "loi", chu: (err as Error).message });
    } finally {
      setDang(false);
    }
  }
  return (
    <li className={`rounded-[14px] border bg-surface p-4 ${t.khoa ? "border-danger/50" : "border-border"}`}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="font-semibold" translate="no">{t.ten}{laToi ? <span className="font-normal text-text-3"> (bạn)</span> : null}</p>
          <p className="text-[14px] text-text-2 [overflow-wrap:anywhere]" translate="no">{t.gmail}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip mau={t.vai === "chu" ? "thu" : "trung"}>{t.vai === "chu" ? "Chủ lớp" : "Giáo viên"}</Chip>
          {t.khoa ? <Chip mau="danger">Đã khoá</Chip> : null}
        </div>
      </div>
      {t.vai === "giao_vien" ? (
        <p className="mt-2 text-[14px]">
          <span className="text-text-3">Môn: </span>
          {t.mon.length ? t.mon.map(tenMon).join(", ") : <span className="text-warn">chưa giao môn nào</span>}
        </p>
      ) : null}

      {mo === "sua" ? (
        <form className="mt-3 grid gap-3 border-t border-border pt-3" onSubmit={(e) => { e.preventDefault(); void lam(() => goi(`/api/nguoi-dung/${t.id}`, "PATCH", t.vai === "giao_vien" ? { ten, mon: chon } : { ten }), "Đã lưu."); }}>
          <div>
            <label htmlFor={`${id}-t`} className={nhan}>Tên hiển thị</label>
            <input id={`${id}-t`} required maxLength={80} value={ten} onChange={(e) => setTen(e.target.value)} className={`${oNhap} mt-1`} />
          </div>
          {t.vai === "giao_vien" ? (
            <div>
              <span className={nhan}>Môn phụ trách</span>
              <ChonMon mon={mon} chon={chon} doi={setChon} ten={`Môn phụ trách của ${t.ten}`} />
            </div>
          ) : null}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className={nutPhu} onClick={() => { setMo(null); setTen(t.ten); setChon(t.mon); }}>Huỷ</button>
            <button type="submit" disabled={dang} className={nutChinh}>{dang ? "Đang lưu…" : "Lưu"}</button>
          </div>
        </form>
      ) : mo === "khoa" || mo === "dang-xuat" ? (
        <div className="mt-3 grid gap-3 border-t border-border pt-3">
          <p className="text-[14px]">
            {mo === "khoa"
              ? `Khoá ${t.ten}? Mọi phiên đang mở bị đăng xuất ngay, không đăng nhập lại được tới khi mở khoá.`
              : `Đăng xuất ${t.ten} khỏi mọi máy? Họ vẫn đăng nhập lại bằng Google được.`}
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className={nutPhu} onClick={() => setMo(null)}>Huỷ</button>
            <button
              type="button"
              disabled={dang}
              className={nutNguy}
              onClick={() => void (mo === "khoa"
                ? lam(() => goi(`/api/nguoi-dung/${t.id}/khoa`, "POST", { khoa: true }), `Đã khoá ${t.ten}.`)
                : lam(() => goi(`/api/nguoi-dung/${t.id}/thu-hoi-phien`, "POST", {}), laToi ? "Đã đăng xuất mọi máy — đang chuyển về trang đăng nhập…" : `Đã đăng xuất ${t.ten} khỏi mọi máy.`).then(() => { if (laToi) location.href = "/dang-nhap"; }))}
            >
              {dang ? "Đang làm…" : mo === "khoa" ? "Khoá tài khoản" : "Đăng xuất mọi máy"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={`${nutPhu} px-3 text-[14px]`} onClick={() => setMo("sua")}>{t.vai === "giao_vien" ? "Sửa tên / môn" : "Sửa tên"}</button>
          {!t.khoa ? <button type="button" className={`${nutPhu} px-3 text-[14px]`} onClick={() => setMo("dang-xuat")}>Đăng xuất mọi máy</button> : null}
          {t.khoa ? (
            <button type="button" disabled={dang} className={`${nutPhu} px-3 text-[14px]`} onClick={() => void lam(() => goi(`/api/nguoi-dung/${t.id}/khoa`, "POST", { khoa: false }), `Đã mở khoá ${t.ten}.`)}>Mở khoá</button>
          ) : chuCuoi ? (
            <span className="inline-flex min-h-11 items-center text-[13px] text-text-3">Chủ lớp duy nhất — không khoá được</span>
          ) : (
            <button type="button" className={`${nutPhu} px-3 text-[14px] text-danger`} onClick={() => setMo("khoa")}>Khoá…</button>
          )}
        </div>
      )}
      {bao ? <p role={bao.loai === "loi" ? "alert" : "status"} className={`mt-2 text-[14px] ${bao.loai === "loi" ? "text-danger" : "text-ok"}`}>{bao.chu}</p> : null}
    </li>
  );
}
