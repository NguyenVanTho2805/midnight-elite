import dotenv from "dotenv";
import path from "path";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import { COURSES } from "../src/lib/courseData";
import { CURRICULUM } from "../src/lib/curriculum";
import { EXAMS } from "../src/lib/examData";

async function main() {
  // Load env trước tiên
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set in .env");
  console.log("🔌 Connecting to:", dbUrl.split("@")[1]?.split("/")[0]);

  neonConfig.webSocketConstructor = ws;
  const u = new URL(dbUrl);
  const poolConfig = {
    host:     u.hostname,
    user:     decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1).split("?")[0],
    ssl:      true,
    port:     u.port ? Number(u.port) : 5432,
  };
  const adapter = new PrismaNeon(poolConfig);
  const prisma  = new PrismaClient({ adapter });

  console.log("🌱 Seeding database...");

  await prisma.order.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.chapter.deleteMany();
  await prisma.section.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.course.deleteMany();
  console.log("   ✓ Cleared existing data");

  for (const c of COURSES) {
    await prisma.course.create({
      data: {
        id: c.id, adminId: c.adminId,
        name: c.name, adminName: c.adminName, shortTitle: c.shortTitle,
        category: c.category, instructor: c.instructor, teacherAvatar: c.teacherAvatar,
        openDate: c.openDate, types: c.types,
        tag: c.tag ?? null, tagColor: c.tagColor ?? null,
        bg: c.bg, strip: c.strip,
        price: c.price, originalPrice: c.originalPrice ?? null,
        lessons: c.lessons, hours: c.hours,
        status: c.status, createdAt: c.createdAt,
      },
    });
  }
  console.log(`   ✓ Seeded ${COURSES.length} courses`);

  let sCount = 0, cCount = 0, lCount = 0;
  for (const [courseId, sections] of Object.entries(CURRICULUM)) {
    for (let si = 0; si < sections.length; si++) {
      const s = sections[si];
      await prisma.section.create({ data: { id: s.id, title: s.title, order: si, courseId } });
      sCount++;
      for (let ci = 0; ci < s.chapters.length; ci++) {
        const ch = s.chapters[ci];
        await prisma.chapter.create({ data: { id: ch.id, title: ch.title, order: ci, sectionId: s.id } });
        cCount++;
        for (let li = 0; li < ch.lessons.length; li++) {
          const l = ch.lessons[li];
          await prisma.lesson.create({
            data: {
              id: l.id, code: l.code, title: l.title, type: l.type,
              duration: l.duration ?? null, isLocked: l.isLocked, isFree: l.isFree,
              statsVideos: l.stats.videos, statsMaterials: l.stats.materials, statsViews: l.stats.views,
              order: li, chapterId: ch.id,
            },
          });
          lCount++;
        }
      }
    }
  }
  console.log(`   ✓ Seeded ${sCount} sections, ${cCount} chapters, ${lCount} lessons`);

  for (const e of EXAMS) {
    await prisma.exam.create({
      data: {
        id: e.id, code: e.code, title: e.title, category: e.category,
        date: e.date, time: e.time, duration: e.duration, questions: e.questions,
        status: e.status, azotaUrl: e.azotaUrl ?? "", participants: e.participants,
        active: e.active, createdAt: e.createdAt,
      },
    });
  }
  console.log(`   ✓ Seeded ${EXAMS.length} exams`);

  const orders = [
    { buyerName: "Nguyễn Văn A", phone: "0901234567", courseId: "combo-8-mon",  amount: 3490000, status: "SUCCESS", method: "VietQR" },
    { buyerName: "Trần Thị B",   phone: "0912345678", courseId: "hsa-tron-goi", amount: 2990000, status: "SUCCESS", method: "MoMo"   },
    { buyerName: "Lê Văn C",     phone: "0923456789", courseId: "toan-12",      amount: 990000,  status: "PENDING", method: "VietQR" },
    { buyerName: "Phạm Thị D",   phone: "0934567890", courseId: "hcm-tron-goi", amount: 2490000, status: "SUCCESS", method: "VNPay"  },
    { buyerName: "Vũ Thị F",     phone: "0956789012", courseId: "combo-8-mon",  amount: 3490000, status: "SUCCESS", method: "MoMo"   },
  ];
  for (const o of orders) await prisma.order.create({ data: o });
  console.log(`   ✓ Seeded ${orders.length} orders`);

  console.log("\n✅ Database seeded successfully!");
}

main()
  .catch(e => { console.error("❌ Seed failed:", e); process.exit(1); });
