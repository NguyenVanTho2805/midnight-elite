// KiN lớp bước 3 (docs/kin/lop/README.md mục 2): chép dữ liệu web lớp cũ (bảng tên gốc) sang các bảng bca_* cùng cấu trúc trong DB KiN.
//   Xem trước:  LOP_NGUON_URL=… LOP_DICH_URL=… npx tsx scripts/lop-chuyen-du-lieu.ts
//   Ghi thật:   … npx tsx scripts/lop-chuyen-du-lieu.ts --apply            (đích đã có dòng bca_* thì thêm --ghi-de: TRUNCATE rồi chép lại)
// Mặc định XEM TRƯỚC: chép hết trong MỘT giao dịch ở đích, đối soát, rồi ROLLBACK. Chỉ --apply VÀ khớp hết mới COMMIT; lệch ⇒ luôn rollback.
// Nguồn chỉ đọc (một ảnh chụp REPEATABLE READ READ ONLY). Đích không phải localhost / socket ⇒ từ chối, trừ khi LOP_CHO_PHEP_DICH_THAT=1 (chủ quyết).
// Giữ nguyên id và mọi cột chung; cột chỉ có ở đích (userId) để mặc định. Cột chỉ có ở NGUỒN ⇒ LỆCH (không lặng lẽ bỏ dữ liệu).
// Đối soát từng bảng: số dòng + mã băm nội dung các cột chung (tính trong DB, không đưa nội dung ra ngoài).
// KHÔNG in chuỗi kết nối, tên, SĐT, Gmail hay nội dung ô — kể cả khi lỗi (chỉ in mã lỗi Postgres + tên bảng / ràng buộc).
// Mã thoát: 0 KHỚP · 1 thiếu biến / sai cờ · 2 bị từ chối · 3 LỆCH hoặc lỗi.
// Kho không có `pg`; dùng `postgres` (postgres.js) mà gói `prisma` kéo theo — nối được cả socket cục bộ lẫn Neon (TLS).
// shortcut: `postgres` là phụ thuộc gián tiếp, nâng prisma mà mất thì thêm nó vào devDependencies.
import postgres from "postgres";

// Thứ tự theo khoá ngoại: cha trước con.
const BANG = ["lua", "mon", "cai_dat", "nguoi_dung", "phan_cong", "hoc_sinh", "ghi_danh", "buoi_hoc", "diem_danh", "don_dang_ky", "bo_dem", "viec_xong", "nhat_ky"];
const CO = ["--apply", "--ghi-de"];
const q = (ten: string) => `"${ten.replace(/"/g, '""')}"`;

class TuChoi extends Error {}
const ROLLBACK = Symbol("rollback");

function noi(url: string) {
  const u = new URL(url);
  const host = u.searchParams.get("host") || decodeURIComponent(u.hostname) || "localhost"; // ?host=/tmp ⇒ socket
  const cucBo = host.startsWith("/") || ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
  const sql = postgres({
    host, port: u.port ? Number(u.port) : 5432, database: decodeURIComponent(u.pathname.slice(1)),
    username: decodeURIComponent(u.username), password: decodeURIComponent(u.password),
    ssl: cucBo ? false : "require", max: 1, onnotice: () => {}, connection: { TimeZone: "UTC" }, // cùng múi giờ để mã băm hai bên so được
  });
  return { sql, cucBo };
}

type Sql = postgres.Sql | postgres.TransactionSql;
const cotCua = async (sql: Sql, bang: string) =>
  (await sql`select column_name from information_schema.columns where table_schema = current_schema() and table_name = ${bang} order by ordinal_position`).map((r) => r.column_name as string);
/** Số dòng + mã băm nội dung (không phụ thuộc thứ tự dòng). */
async function doiSoat(sql: Sql, bang: string, cot: string[]) {
  const [r] = await sql.unsafe(
    `select count(*)::int n, md5(coalesce(string_agg(j, ',' order by j), '')) bam from (select to_jsonb(t)::text j from (select ${cot.map(q).join(", ")} from ${q(bang)}) t) s`,
  );
  return { n: r.n as number, bam: r.bam as string };
}

async function chay() {
  const co = process.argv.slice(2);
  const la = co.filter((c) => !CO.includes(c));
  if (la.length) throw new TuChoi(`Cờ không hiểu: ${la.join(" ")} (chỉ nhận ${CO.join(", ")})`);
  const apply = co.includes("--apply"), ghiDe = co.includes("--ghi-de");
  const { LOP_NGUON_URL, LOP_DICH_URL } = process.env;
  if (!LOP_NGUON_URL || !LOP_DICH_URL) { console.error("Thiếu LOP_NGUON_URL hoặc LOP_DICH_URL"); return 1; }

  const nguon = noi(LOP_NGUON_URL), dich = noi(LOP_DICH_URL);
  const bao: Record<string, unknown> = { che_do: apply ? "apply" : "xem_truoc", ghi_de: ghiDe };
  try {
    if (!dich.cucBo && process.env.LOP_CHO_PHEP_DICH_THAT !== "1") throw new TuChoi("Đích không phải localhost / socket: cần LOP_CHO_PHEP_DICH_THAT=1 (chủ quyết)");

    await nguon.sql.begin("isolation level repeatable read read only", async (src) => {
      await dich.sql.begin(async (dst) => {
        const thieu: string[] = [];
        for (const b of BANG) if (!(await dst`select to_regclass(${q("bca_" + b)}) r`)[0].r) thieu.push("bca_" + b);
        if (thieu.length) throw new TuChoi(`Đích thiếu bảng: ${thieu.join(", ")} (chạy prisma db push + prisma/sql/bca-rang-buoc.sql trước)`);

        const daCo: string[] = [];
        for (const b of BANG) if ((await dst.unsafe(`select 1 from ${q("bca_" + b)} limit 1`)).length) daCo.push("bca_" + b);
        if (daCo.length && !ghiDe) throw new TuChoi(`Đích đã có dữ liệu ở: ${daCo.join(", ")} (muốn xoá rồi chép lại thì thêm --ghi-de)`);
        // Không CASCADE: bảng ngoài nhóm bca_* mà trỏ vào thì Postgres chặn, không xoá lan.
        if (daCo.length) await dst.unsafe(`truncate ${BANG.map((b) => q("bca_" + b)).join(", ")}`);

        const dem: Record<string, { nguon: number; dich: number }> = {};
        const lech: string[] = [], cotChiNguon: string[] = [], cotChiDich: string[] = [];
        for (const b of BANG) {
          const d = "bca_" + b;
          const cn = await cotCua(src, b), cd = await cotCua(dst, d);
          if (!cn.length) throw new TuChoi(`Nguồn thiếu bảng: ${b}`);
          const cot = cn.filter((c) => cd.includes(c));
          cotChiNguon.push(...cn.filter((c) => !cd.includes(c)).map((c) => `${b}.${c}`));
          cotChiDich.push(...cd.filter((c) => !cn.includes(c)).map((c) => `${d}.${c}`));
          const ds = cot.map(q).join(", ");

          // shortcut: cả bảng đi trong một tham số jsonb (một câu INSERT ⇒ khoá ngoại tự trỏ của buoi_hoc kiểm cuối câu); bảng quá vài trăm nghìn dòng thì chia lô.
          const [{ j }] = await src.unsafe(`select coalesce(jsonb_agg(to_jsonb(t)), '[]')::text j from (select ${ds} from ${q(b)}) t`);
          // jsonb_populate_recordset ép từng cột về kiểu của bảng ĐÍCH: enum bca_* nhận từ dạng chữ, mảng, jsonb, timestamptz, uuid.
          await dst.unsafe(`insert into ${q(d)} (${ds}) select ${ds} from jsonb_populate_recordset(null::${q(d)}, $1::text::jsonb)`, [j]); // ::text trước: postgres.js tự JSON.stringify tham số kiểu jsonb (thành chuỗi lồng chuỗi)

          for (const c of cot) { // cột serial: đặt lại sequence theo max
            const [{ s }] = await dst`select pg_get_serial_sequence(${q(d)}, ${c}) s`;
            if (s) await dst.unsafe(`select setval($1::regclass, coalesce(max(${q(c)}), 1), max(${q(c)}) is not null) from ${q(d)}`, [s]);
          }

          const a = await doiSoat(src, b, cot), z = await doiSoat(dst, d, cot);
          dem[d] = { nguon: a.n, dich: z.n };
          if (a.n !== z.n || a.bam !== z.bam) lech.push(d);
        }
        if (cotChiNguon.length) lech.push(...new Set(cotChiNguon.map((c) => "bca_" + c.split(".")[0])));

        const khop = lech.length === 0;
        Object.assign(bao, { dem, lech: [...new Set(lech)], cot_chi_o_nguon: cotChiNguon, cot_chi_o_dich: cotChiDich, ket_qua: khop ? "KHỚP" : "LỆCH", da_ghi: apply && khop });
        if (!(apply && khop)) throw ROLLBACK;
      });
    });
  } catch (e) {
    if (e instanceof TuChoi) Object.assign(bao, { ket_qua: "TỪ CHỐI", ly_do: e.message, da_ghi: false });
    else if (e !== ROLLBACK) {
      // Thông báo lỗi của Postgres có thể chứa nội dung dòng ⇒ chỉ in mã và tên đối tượng.
      const x = e as { code?: string; table_name?: string; constraint_name?: string; column_name?: string };
      Object.assign(bao, { ket_qua: "LỖI", loi: { ma: x.code ?? "khong_ro", bang: x.table_name, rang_buoc: x.constraint_name, cot: x.column_name }, da_ghi: false });
    }
  } finally {
    await Promise.all([nguon.sql.end(), dich.sql.end()]);
  }
  console.log(JSON.stringify(bao, null, 2));
  return bao.ket_qua === "KHỚP" ? 0 : bao.ket_qua === "TỪ CHỐI" ? 2 : 3;
}

chay().then((ma) => process.exit(ma), (e) => {
  console.error(e instanceof TuChoi ? e.message : "Lỗi ngoài dự kiến (không in chi tiết để khỏi lộ dữ liệu)");
  process.exit(e instanceof TuChoi ? 1 : 3);
});
