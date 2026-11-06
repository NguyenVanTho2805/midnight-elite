// BU-03-MATHTYPE — bộ DỰNG byte cho test: CFB nhỏ + MTEF v5 tự dựng. Không chứa tệp Word/.bin thật của gia sư.
// CFB: header 512/4096, thư mục, FAT, miniFAT + mini-stream (luồng < 4096 B) — đủ để cfb.ts đọc như tệp thật.

const END = 0xfffffffe, FREE = 0xffffffff, FATSEC = 0xfffffffd;

export interface CfbOpts { sector4096?: boolean }
/** Dựng CFB chứa các luồng (tên → dữ liệu). Luồng < 4096 B vào mini-stream, còn lại theo FAT. */
export function buildCfb(streams: { name: string; data: Buffer }[], o: CfbOpts = {}): Buffer {
  const ss = o.sector4096 ? 4096 : 512, mss = 64, cutoff = 4096;
  const small = streams.filter(s => s.data.length < cutoff), big = streams.filter(s => s.data.length >= cutoff);
  const nsec = (n: number, size: number) => Math.max(1, Math.ceil(n / size));
  // mini-stream
  const miniParts: Buffer[] = []; const miniStart: number[] = []; const miniFat: number[] = [];
  let mcur = 0;
  for (const s of small) {
    const n = Math.max(1, Math.ceil(s.data.length / mss));
    miniStart.push(mcur);
    for (let i = 0; i < n; i++) miniFat.push(i === n - 1 ? END : mcur + i + 1);
    const padded = Buffer.alloc(n * mss); s.data.copy(padded); miniParts.push(padded);
    mcur += n;
  }
  const mini = Buffer.concat(miniParts);
  const nDir = nsec((streams.length + 1) * 128, ss);
  const nMiniFat = small.length ? nsec(miniFat.length * 4, ss) : 0;
  const nMini = small.length ? nsec(mini.length, ss) : 0;
  const bigN = big.map(s => nsec(s.data.length, ss));
  const body = nDir + nMiniFat + nMini + bigN.reduce((a, b) => a + b, 0);
  let nFat = 1; while (nFat * (ss / 4) < body + nFat) nFat++;
  // bố trí sector: [FAT][DIR][MINIFAT][MINI][BIG...]
  let at = 0; const fatStart = at; at += nFat; const dirStart = at; at += nDir; const mfStart = at; at += nMiniFat; const miniSecStart = at; at += nMini;
  const bigStart: number[] = []; for (const n of bigN) { bigStart.push(at); at += n; }
  const total = at;
  const fat = new Array<number>(nFat * (ss / 4)).fill(FREE);
  const chain = (start: number, n: number) => { for (let i = 0; i < n; i++) fat[start + i] = i === n - 1 ? END : start + i + 1; };
  for (let i = 0; i < nFat; i++) fat[fatStart + i] = FATSEC;
  chain(dirStart, nDir); if (nMiniFat) chain(mfStart, nMiniFat); if (nMini) chain(miniSecStart, nMini);
  big.forEach((_, i) => chain(bigStart[i], bigN[i]));
  const hdrSize = o.sector4096 ? 4096 : 512;
  const out = Buffer.alloc(hdrSize + total * ss);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(out, 0);
  out.writeUInt16LE(0x3e, 24); out.writeUInt16LE(o.sector4096 ? 4 : 3, 26); out.writeUInt16LE(0xfffe, 28);
  out.writeUInt16LE(o.sector4096 ? 12 : 9, 30); out.writeUInt16LE(6, 32);
  out.writeUInt32LE(nFat, 44); out.writeUInt32LE(dirStart, 48); out.writeUInt32LE(cutoff, 56);
  out.writeUInt32LE(nMiniFat ? mfStart : END, 60); out.writeUInt32LE(nMiniFat, 64); out.writeUInt32LE(END, 68); out.writeUInt32LE(0, 72);
  for (let i = 0; i < 109; i++) out.writeUInt32LE(i < nFat ? fatStart + i : FREE, 76 + 4 * i);
  const secOff = (n: number) => hdrSize + n * ss;
  fat.forEach((v, i) => out.writeUInt32LE(v >>> 0, secOff(fatStart) + 4 * i));
  // thư mục
  const ent = (idx: number, name: string, type: number, start: number, size: number, right = FREE, child = FREE) => {
    const o2 = secOff(dirStart) + idx * 128;
    out.write(name, o2, "utf16le"); out.writeUInt16LE((name.length + 1) * 2, o2 + 64);
    out[o2 + 66] = type; out[o2 + 67] = 1;
    out.writeUInt32LE(FREE, o2 + 68); out.writeUInt32LE(right >>> 0, o2 + 72); out.writeUInt32LE(child >>> 0, o2 + 76);
    out.writeUInt32LE(start >>> 0, o2 + 116); out.writeBigUInt64LE(BigInt(size), o2 + 120);
  };
  ent(0, "Root Entry", 5, nMini ? miniSecStart : END, mini.length, FREE, streams.length ? 1 : FREE);
  streams.forEach((s, i) => {
    const sm = small.indexOf(s), bg = big.indexOf(s);
    ent(i + 1, s.name, 2, sm >= 0 ? miniStart[sm] : bigStart[bg], s.data.length, i + 1 < streams.length ? i + 2 : FREE);
  });
  if (nMiniFat) miniFat.forEach((v, i) => out.writeUInt32LE(v >>> 0, secOff(mfStart) + 4 * i));
  if (nMini) mini.copy(out, secOff(miniSecStart));
  big.forEach((s, i) => s.data.copy(out, secOff(bigStart[i])));
  return out;
}

// ── MTEF v5 ────────────────────────────────────────────────────────────────────────────────────
export type Bytes = number[];
const b = (...x: unknown[]): Bytes => x.flat(Infinity) as Bytes;
/** typeface+mtcode → CHAR. */
export const chr = (tf: number, mt: number, o: { func?: boolean; emb?: number[] } = {}): Bytes =>
  b(2, (o.func ? 2 : 0) | (o.emb ? 1 : 0), tf + 128, mt & 255, mt >> 8, o.emb ? [...o.emb.flatMap(e => [6, 0, e]), 0] : []);
/** CHAR không mtcode (opt 0x20) với mã 8 bit (opt 4). */
export const chr8 = (tf: number, c8: number): Bytes => b(2, 0x20 | 4, tf + 128, c8);
export const text = (tf: number, s: string, funcStart = true): Bytes => b([...s].map((c, i) => chr(tf, c.charCodeAt(0), { func: funcStart && i === 0 })));
export const num = (s: string): Bytes => b([...s].map(c => chr(8, c.charCodeAt(0))));
export const vars = (s: string): Bytes => b([...s].map(c => chr(3, c.charCodeAt(0))));
export const sym = (mt: number): Bytes => chr(6, mt);
export const greek = (mt: number): Bytes => chr(4, mt);
export const line = (...c: (number | Bytes)[]): Bytes => b(1, 0, c, 0);
export const emptyLine = (): Bytes => b(1, 1);
export const tmpl = (sel: number, v: number, ...slots: (number | Bytes)[]): Bytes => b(3, 0, sel, v, 0, slots, 0);
export const pile = (ha: number, ...lines: Bytes[]): Bytes => b(4, 0, ha, 0, lines, 0);
export const matrix = (rows: number, cols: number, hj: number, cells: Bytes[], parts = 0): Bytes =>
  b(5, 0, 0, hj, 0, rows, cols, Array(Math.ceil((rows + 1) * 2 / 8)).fill(parts), Array(Math.ceil((cols + 1) * 2 / 8)).fill(parts), cells, 0);
export const frac = (n: Bytes, d: Bytes) => tmpl(11, 0, line(n), line(d));
export const sup = (x: Bytes) => tmpl(28, 0, emptyLine(), line(x));
export const sub = (x: Bytes) => tmpl(27, 0, line(x), emptyLine());
export const paren = (x: Bytes, sel = 1, v = 3) => tmpl(sel, v, line(x), ...(v & 1 ? [chr(22, 0x28)] : []), ...(v & 2 ? [chr(22, 0x29)] : []));
export const sqrt = (x: Bytes) => tmpl(10, 0, line(x), emptyLine());
/** Phần đầu MTEF: version 5, platform 1, product 0, 6.9, appKey DSMT6, equationOptions 0. */
const mtefHead = (): Bytes => b(5, 1, 0, 6, 9, [...Buffer.from("DSMT6"), 0], 0);
/** Bộ đệm MTEF: đầu + SIZE/FULL rải + 1 LINE gốc chứa `content`. Có thể kèm record trang trí hợp lệ. */
export function mtef(content: Bytes, extra: Bytes = []): Buffer {
  return Buffer.from(b(mtefHead(), extra, line(content)));
}
/** Bọc EQNOLEFILEHDR 28 byte quanh MTEF. */
export function equationStream(m: Buffer): Buffer {
  const h = Buffer.alloc(28); h.writeUInt16LE(28, 0); h.writeUInt32LE(0x00020000, 2); h.writeUInt16LE(0xc1e1, 6); h.writeUInt32LE(m.length, 8);
  return Buffer.concat([h, m]);
}
export const oleOf = (content: Bytes, extra: Bytes = []): Buffer => buildCfb([{ name: "Equation Native", data: equationStream(mtef(content, extra)) }]);
/** MTEF thô (không bọc LINE) — để dựng ca phá cấu trúc. */
export const oleRaw = (mtefBytes: Bytes): Buffer => buildCfb([{ name: "Equation Native", data: equationStream(Buffer.from(mtefBytes)) }]);
export const headRaw = mtefHead;
