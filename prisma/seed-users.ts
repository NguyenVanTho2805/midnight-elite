import dotenv from "dotenv";
import path from "path";
import bcrypt from "bcryptjs";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), ".env") });

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set");

  neonConfig.webSocketConstructor = ws;
  const u = new URL(dbUrl);
  const adapter = new PrismaNeon({
    host: u.hostname, user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1).split("?")[0], ssl: true,
    port: u.port ? Number(u.port) : 5432,
  });
  const prisma = new PrismaClient({ adapter });

  // Xóa user/enrollment cũ (nếu có)
  await prisma.enrollment.deleteMany();
  await prisma.user.deleteMany();
  console.log("   ✓ Cleared users & enrollments");

  // Tạo admin
  const adminPass = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.create({
    data: {
      name:          "Admin Midnight Elite",
      email:         "admin@tsix.vn",
      password:      adminPass,
      role:          "admin",
      adminRole:     "admin_super",
      emailVerified: true,
    },
  });
  console.log("   ✓ Created admin:", admin.email);

  // Tạo content admin
  const contentPass = await bcrypt.hash("content123", 10);
  await prisma.user.create({
    data: {
      name:          "Biên tập viên",
      email:         "content@tsix.vn",
      password:      contentPass,
      role:          "admin",
      adminRole:     "admin_content",
      emailVerified: true,
    },
  });
  console.log("   ✓ Created content admin");

  // Tạo student demo
  const studentPass = await bcrypt.hash("123456", 10);
  const student = await prisma.user.create({
    data: {
      name:   "Nguyễn Văn A",
      email:  "student@tsix.vn",
      password: studentPass,
      phone:  "0901234567",
      school: "THPT Chu Văn An, Hà Nội",
      role:   "student",
    },
  });
  console.log("   ✓ Created student:", student.email);

  // Đăng ký student vào khoá test (nếu tồn tại)
  const testCourse = await prisma.course.findFirst({ where: { id: "khoa-hoc-thu-nghiem" } });
  if (testCourse) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: student.id, courseId: testCourse.id } },
      create: { userId: student.id, courseId: testCourse.id },
      update: {},
    });
    console.log(`   ✓ Enrolled student in test course`);
  }

  console.log("\n✅ Users seeded!");
  console.log("   student@tsix.vn / 123456");
  console.log("   admin@tsix.vn / admin123");
  console.log("   content@tsix.vn / content123");
}

main().catch(e => { console.error("❌", e); process.exit(1); });
