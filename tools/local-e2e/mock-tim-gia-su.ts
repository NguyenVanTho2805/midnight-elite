// LOI-05 (mục 3.4 docs/kin/phong-ban/dac-ta/LOI-05.md) — dữ liệu THỬ cho /giang-vien và /mentor/<id>: 8 gia sư đã duyệt, đủ ca khó cho thẻ mới.
// KHÔNG wipe, KHÔNG đụng seed*/h.ts. Chạy lại không nhân đôi (khoá theo email mock-tgs-<n>@kin.test, chạy lại thì đặt lại đúng giá trị dưới đây).
//
//   source tools/local-e2e/env.sh
//   npx tsx tools/local-e2e/mock-tim-gia-su.ts          thêm / đặt lại 8 gia sư
//   npx tsx tools/local-e2e/mock-tim-gia-su.ts --xoa    gỡ ĐÚNG 8 người này (lượt xem / báo cáo hồ sơ của họ xoá theo, cascade)
//
// Chỉ chạy với DB trên máy (DATABASE_URL chứa "@localhost:"). Mật khẩu chung "Passw0rd!" (như h.ts).
// Có: 1 tên rất dài, 2 người không ảnh, 2 người không khai giá, đủ Online / Dạy trực tiếp / cả hai, 6 tỉnh/thành, môn có số lớp,
// bio dài và bio trống. Ảnh là PNG tự sinh bằng mã (không tải mạng), mỗi người một màu.
// Không sao, không điểm, không "đã xác minh"; không số điện thoại (Zalo tắt). Khu vực/giá ghi đúng như lưu thật: users.city + preferences.teaching qua parseAreaInput.
import { deflateSync } from "node:zlib";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { parseAreaInput, type TeachingMode } from "@/lib/tutorArea";

const EMAIL = (n: number) => `mock-tgs-${n}@kin.test`;
const COUNT = 8;

// ── PNG tự sinh: nền một màu, chuyển nhẹ sang sáng ở góc dưới (đủ để thấy ảnh thật khác khối chữ cái đầu) ──────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function pngDataUrl([r, g, b]: [number, number, number], size = 160): string {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8 bit, RGB
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0; // bộ lọc None
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (2 * size) * 0.45; // pha trắng tới 45% ở góc dưới phải
      const i = row + 1 + x * 3;
      raw[i] = Math.round(r + (255 - r) * t); raw[i + 1] = Math.round(g + (255 - g) * t); raw[i + 2] = Math.round(b + (255 - b) * t);
    }
  }
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString("base64")}`;
}

// ── 8 gia sư ─────────────────────────────────────────────────────────────────────────────────────────────────
interface MockTutor {
  name: string;
  color: [number, number, number] | null; // null = không ảnh
  subjects: string[];
  bio: string | null;
  city: string;
  teaching: { district?: string; mode: TeachingMode; credential?: string; price?: number; showPrice?: boolean };
}
const LONG_BIO = [
  "Mình dạy Toán và Vật lý cho học sinh THCS, THPT hơn 6 năm, chủ yếu ôn thi vào lớp 10 và thi tốt nghiệp.",
  "Cách dạy: học chắc bản chất trước, sau đó luyện đề theo dạng, mỗi buổi có phiếu bài tập và chữa lỗi sai ngay trong buổi.",
  "",
  "Sau mỗi tuần mình gửi phụ huynh nhận xét ngắn về bài đã học, phần còn yếu và bài tập về nhà.",
  "Có lớp nhóm nhỏ 3–5 bạn và lớp kèm 1–1, học online qua Google Meet hoặc trực tiếp tại nhà ở Cầu Giấy.",
  "Thông tin trên đây do mình tự khai (dữ liệu thử của KiN).",
].join("\n");
const TUTORS: MockTutor[] = [
  {
    name: "Tôn Nữ Nguyễn Trần Hoàng Bảo Ngọc Phương Thảo Uyên Nhi", color: [214, 92, 140],
    subjects: ["Toán 9", "Vật lý 12", "Tiếng Anh lớp 5", "Hóa học 10", "Ngữ văn 8"], bio: LONG_BIO,
    city: "Hà Nội", teaching: { district: "Cầu Giấy", mode: "both", credential: "ĐH Sư phạm Hà Nội, cử nhân Sư phạm Toán", price: 250000, showPrice: true },
  },
  {
    name: "Trần Minh Khoa", color: [52, 110, 200],
    subjects: ["Toán 12", "Vật lý 12"], bio: "Ôn thi tốt nghiệp THPT môn Toán, Lý. Dữ liệu thử.",
    city: "TP.HCM", teaching: { district: "Quận 3", mode: "online", credential: "ĐH Bách khoa TP.HCM", price: 180000, showPrice: true },
  },
  {
    name: "Lê Thu Hà", color: null,
    subjects: ["Tiếng Anh lớp 5", "Tiếng Anh lớp 6"], bio: null,
    city: "Đà Nẵng", teaching: { district: "Hải Châu", mode: "offline" },
  },
  {
    name: "Phạm Quốc Bảo", color: [46, 150, 96],
    subjects: ["Hóa học 11", "Sinh học 11"],
    bio: "Dạy Hóa, Sinh lớp 11 theo chương trình mới. Mỗi chương có bài kiểm tra ngắn để biết em đang hổng chỗ nào, rồi mới học tiếp. Dữ liệu thử.",
    city: "Hà Nội", teaching: { district: "Đống Đa", mode: "offline", credential: "ĐH Khoa học Tự nhiên", price: 300000, showPrice: true },
  },
  {
    name: "Đỗ Ngọc Ánh", color: [232, 140, 48],
    subjects: ["Ngữ văn 9", "Lịch sử THCS"], bio: "Luyện viết văn nghị luận, ôn thi vào 10. Dữ liệu thử.",
    city: "Cần Thơ", teaching: { district: "Ninh Kiều", mode: "both", credential: "ĐH Cần Thơ" },
  },
  {
    name: "Vũ Hải Đăng", color: null,
    subjects: ["IELTS 6.5", "Tiếng Anh THPT"], bio: "Luyện IELTS kỹ năng Nói và Viết, học online buổi tối. Dữ liệu thử.",
    city: "TP. Hồ Chí Minh", teaching: { district: "Bình Thạnh", mode: "online", price: 150000, showPrice: true },
  },
  {
    name: "Hoàng Gia Linh", color: [128, 84, 196],
    subjects: ["Tin học 10", "Toán 7"], bio: "Lập trình Python cơ bản cho học sinh lớp 10. Dữ liệu thử.",
    city: "Huế", teaching: { mode: "online", price: 120000, showPrice: true },
  },
  {
    name: "Bùi Thanh Tâm", color: [32, 150, 160],
    subjects: ["Toán 6", "Toán 7", "Toán 8", "Toán 9"], bio: "Kèm Toán THCS, lấy lại gốc cho em mất căn bản. Dữ liệu thử.",
    city: "Hải Phòng", teaching: { mode: "offline", price: 200000, showPrice: true },
  },
];

async function main() {
  if (!/@localhost:/.test(process.env.DATABASE_URL ?? "")) throw new Error("DỪNG: DATABASE_URL không phải DB trên máy (cần chứa @localhost:).");
  if (TUTORS.length !== COUNT) throw new Error(`cần đúng ${COUNT} gia sư`);
  const emails = TUTORS.map((_, i) => EMAIL(i + 1));

  if (process.argv.includes("--xoa")) {
    const r = await prisma.user.deleteMany({ where: { email: { in: emails } } });
    console.log(`Đã gỡ ${r.count} gia sư thử (mock-tgs-1..${COUNT}@kin.test).`);
    return;
  }

  const password = await bcrypt.hash("Passw0rd!", 4);
  const now = Date.now();
  const lines: string[] = [];
  for (const [i, t] of TUTORS.entries()) {
    const parsed = parseAreaInput({ city: t.city, teaching: t.teaching });
    if (parsed.error || parsed.teaching == null) throw new Error(`khu vực của ${t.name} không hợp lệ: ${parsed.error ?? "teaching rỗng"}`);
    const data = {
      name: t.name,
      role: "admin", adminRole: "teacher", emailVerified: true,
      tutorVerified: true, tutorVerifiedAt: new Date(now - (i + 1) * 3_600_000), tutorAppliedAt: new Date(now - (i + 2) * 86_400_000),
      banned: false, profileLockedAt: null, profileLockReason: null, tutorRejectedAt: null, tutorRejectReason: null,
      avatarBase64: t.color ? pngDataUrl(t.color) : null,
      subjects: t.subjects, bio: t.bio,
      city: parsed.city ?? null,
      // Như PUT /api/users/me/tutor-profile lưu: chỉ khối teaching (Zalo tắt — không có connections.showZalo).
      preferences: { teaching: parsed.teaching } as object,
      phone: null, coverUrl: null, introVideoUrl: null,
    };
    const u = await prisma.user.upsert({
      where: { email: emails[i] },
      create: { email: emails[i], password, ...data },
      update: data,
      select: { id: true },
    });
    const notes = [t.color ? "có ảnh" : "KHÔNG ảnh", t.teaching.showPrice ? `giá ${t.teaching.price}` : "KHÔNG giá", t.teaching.mode, parsed.city, t.bio ? (t.bio.length > 200 ? "bio dài" : "bio ngắn") : "bio trống"];
    lines.push(`  ${emails[i]}  /mentor/${u.id}  ${t.name} (${t.name.length} ký tự) — ${notes.join(" · ")}`);
  }
  const total = await prisma.user.count({ where: { email: { in: emails } } });
  console.log(`Đã thêm / đặt lại ${total} gia sư thử (chạy lại không nhân đôi):`);
  for (const l of lines) console.log(l);
  console.log("Xem: /giang-vien (cần NEXT_PUBLIC_KIN_MO_TIM_GIA_SU bật) và từng /mentor/<id>. Gỡ: npx tsx tools/local-e2e/mock-tim-gia-su.ts --xoa");
}

main()
  .catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect?.());
