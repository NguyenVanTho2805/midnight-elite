// BU-03-MATHTYPE — đọc tối thiểu tệp CFB (OLE2 / "Compound File") để lấy MỘT luồng theo tên. THUẦN: không phụ thuộc, không DB, không mạng, KHÔNG BAO GIỜ ném ra ngoài.
// Chỉ ĐỌC BYTE: không mở/thực thi OLE. Chống tệp độc: mọi truy cập có kiểm biên; chuỗi sector có tập đã thăm (vòng → corrupt) và không dài hơn số sector thực của tệp;
// DIFAT/FAT/miniFAT/thư mục đều bị chặn theo kích thước tệp; luồng ra tối đa `maxStream` byte.

export type CfbResult =
  | { ok: true; data: Buffer }
  | { ok: false; reason: "not_cfb" | "corrupt" | "stream_missing" | "limit" };

const SIG = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const MAXREG = 0xfffffffa; // >= giá trị này là đặc biệt (ENDOFCHAIN=…FE, FREESECT=…FF, FAT=…FD, DIFAT=…FC)
const MAX_STREAM_DEFAULT = 32 * 1024;
const MAX_DIR_ENTRIES = 4096;

class Bad extends Error { constructor(public why: "corrupt" | "limit") { super(why); } }

export function readCfbStream(buf: Buffer, streamName: string, maxStream: number = MAX_STREAM_DEFAULT): CfbResult {
  try {
    return { ok: true, data: read(buf, streamName, maxStream) };
  } catch (e) {
    if (e instanceof Bad) return { ok: false, reason: e.why };
    if (e instanceof NotCfb) return { ok: false, reason: "not_cfb" };
    if (e instanceof Missing) return { ok: false, reason: "stream_missing" };
    return { ok: false, reason: "corrupt" };
  }
}
class NotCfb extends Error {}
class Missing extends Error {}

function read(buf: Buffer, streamName: string, maxStream: number): Buffer {
  if (!Buffer.isBuffer(buf) || buf.length < 512 || SIG.some((b, i) => buf[i] !== b)) throw new NotCfb();
  const ssShift = buf.readUInt16LE(30), mssShift = buf.readUInt16LE(32);
  if ((ssShift !== 9 && ssShift !== 12) || mssShift !== 6) throw new Bad("corrupt");
  const ss = 1 << ssShift, mss = 1 << mssShift;
  const nFat = buf.readUInt32LE(44), dirStart = buf.readUInt32LE(48), cutoff = buf.readUInt32LE(56);
  const miniStart = buf.readUInt32LE(60), nMini = buf.readUInt32LE(64), difStart = buf.readUInt32LE(68), nDif = buf.readUInt32LE(72);
  // Số sector thực có trong tệp (sector 0 bắt đầu sau 1 sector header = max(512, ss)).
  const hdrSize = ss === 4096 ? 4096 : 512;
  if (buf.length < hdrSize) throw new Bad("corrupt");
  const totalSectors = Math.floor((buf.length - hdrSize) / ss);
  const sec = (n: number): Buffer => {
    if (n >= totalSectors) throw new Bad("corrupt");
    const o = hdrSize + n * ss;
    return buf.subarray(o, o + ss);
  };
  if (nFat > totalSectors || nDif > totalSectors || nMini > totalSectors) throw new Bad("corrupt");

  // DIFAT: 109 mục trong header + chuỗi các sector DIFAT (có phát hiện vòng).
  const difat: number[] = [];
  for (let i = 0; i < 109; i++) { const v = buf.readUInt32LE(76 + 4 * i); if (v < MAXREG) difat.push(v); }
  const seenDif = new Set<number>();
  let d = difStart;
  for (let i = 0; i < nDif && d < MAXREG; i++) {
    if (seenDif.has(d)) throw new Bad("corrupt");
    seenDif.add(d);
    const s = sec(d);
    for (let j = 0; j < ss / 4 - 1; j++) { const v = s.readUInt32LE(4 * j); if (v < MAXREG) difat.push(v); }
    d = s.readUInt32LE(ss - 4);
  }
  if (difat.length > totalSectors + 109) throw new Bad("corrupt");

  const fat: number[] = [];
  for (const f of difat.slice(0, nFat)) { const s = sec(f); for (let j = 0; j < ss / 4; j++) fat.push(s.readUInt32LE(4 * j)); }

  /** Chuỗi sector trong FAT: không vòng, không dài hơn số sector tệp. */
  const chain = (start: number, table: number[], limitLen: number): number[] => {
    const out: number[] = []; const seen = new Set<number>();
    let c = start;
    while (c < MAXREG) {
      if (seen.has(c) || out.length >= limitLen) throw new Bad("corrupt");
      seen.add(c); out.push(c);
      const nx = table[c];
      if (nx === undefined) throw new Bad("corrupt");
      c = nx;
    }
    return out;
  };
  const readBig = (start: number, cap: number): Buffer => {
    const ch = chain(start, fat, totalSectors);
    if (ch.length * ss > cap) throw new Bad("limit");
    return Buffer.concat(ch.map(sec));
  };

  // Thư mục: tối đa MAX_DIR_ENTRIES * 128 byte.
  const dir = readBig(dirStart, MAX_DIR_ENTRIES * 128 + ss);
  type Ent = { name: string; type: number; start: number; size: number };
  const ents: Ent[] = [];
  for (let o = 0; o + 128 <= dir.length; o += 128) {
    const nl = dir.readUInt16LE(o + 64);
    if (!nl || nl > 64) continue;
    const size = dir.readBigUInt64LE(o + 120);
    ents.push({ name: dir.subarray(o, o + Math.max(0, nl - 2)).toString("utf16le"), type: dir[o + 66], start: dir.readUInt32LE(o + 116), size: size > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(size) });
  }
  const e = ents.find(x => x.type === 2 && x.name === streamName);
  if (!e) throw new Missing();
  if (e.size > maxStream) throw new Bad("limit");

  if (e.size < cutoff) {
    const root = ents.find(x => x.type === 5);
    if (!root || !nMini) throw new Bad("corrupt");
    const mini = readBig(root.start, totalSectors * ss).subarray(0, root.size);
    const mf = readBig(miniStart, totalSectors * ss);
    const miniFat: number[] = [];
    for (let j = 0; j + 4 <= mf.length; j += 4) miniFat.push(mf.readUInt32LE(j));
    const maxMini = Math.ceil(mini.length / mss) + 1;
    const ch = chain(e.start, miniFat, maxMini);
    if (ch.length * mss < e.size) throw new Bad("corrupt");
    const parts: Buffer[] = [];
    for (const n of ch) {
      if ((n + 1) * mss > mini.length) throw new Bad("corrupt");
      parts.push(mini.subarray(n * mss, (n + 1) * mss));
    }
    return Buffer.concat(parts).subarray(0, e.size);
  }
  const data = readBig(e.start, e.size + ss);
  if (data.length < e.size) throw new Bad("corrupt");
  return data.subarray(0, e.size);
}
