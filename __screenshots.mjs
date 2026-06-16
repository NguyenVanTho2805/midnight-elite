import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = "http://localhost:3000";
const OUT  = "d:/Midnight-Website/__screenshots";

fs.mkdirSync(OUT, { recursive: true });

// Pages accessible without login
const GUEST_PAGES = [
  { url: "/",                   name: "00_home" },
  { url: "/dang-nhap",          name: "01_dang-nhap" },
  { url: "/dang-ky",            name: "02_dang-ky" },
  { url: "/quen-mat-khau",      name: "03_quen-mat-khau" },
  { url: "/khoa-hoc",           name: "04_khoa-hoc" },
  { url: "/bang-xep-hang",      name: "05_bang-xep-hang" },
  { url: "/vinh-danh",          name: "06_vinh-danh" },
  { url: "/thi-thu",            name: "07_thi-thu" },
  { url: "/diem-chuan",         name: "08_diem-chuan" },
  { url: "/tin-tuc",            name: "09_tin-tuc" },
  { url: "/gioi-thieu",         name: "10_gioi-thieu" },
  { url: "/chinh-sach",         name: "11_chinh-sach" },
];

// Admin pages (need auth)
const ADMIN_PAGES = [
  { url: "/admin",                    name: "A00_admin-dashboard" },
  { url: "/admin/khoa-hoc",           name: "A01_admin-khoa-hoc" },
  { url: "/admin/khoa-hoc/danh-muc",  name: "A02_admin-danh-muc" },
  { url: "/admin/thi-thu",            name: "A03_admin-thi-thu" },
  { url: "/admin/vinh-danh",          name: "A04_admin-vinh-danh" },
  { url: "/admin/hoc-sinh",           name: "A05_admin-hoc-sinh" },
  { url: "/admin/doanh-thu",          name: "A06_admin-doanh-thu" },
  { url: "/admin/quan-tri-vien",      name: "A07_admin-quan-tri-vien" },
];

// Student pages (need auth)
const STUDENT_PAGES = [
  { url: "/student",             name: "S00_student-dashboard" },
  { url: "/student/hoc-tap",     name: "S01_student-hoc-tap" },
  { url: "/student/thi-thu",     name: "S02_student-thi-thu" },
  { url: "/student/bang-xep-hang", name: "S03_student-bxh" },
  { url: "/student/lich-hoc",    name: "S04_student-lich-hoc" },
  { url: "/student/tin-tuc",     name: "S05_student-tin-tuc" },
  { url: "/student/ho-so",       name: "S06_student-ho-so" },
];

async function shot(page, url, name) {
  try {
    await page.goto(BASE + url, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(800);
    const file = path.join(OUT, name + ".png");
    await page.screenshot({ path: file, fullPage: true });
    console.log(`✓ ${name}`);
  } catch (e) {
    console.log(`✗ ${name} — ${e.message.split("\n")[0]}`);
  }
}

const browser = await chromium.launch({ headless: true });
const ctx     = browser.newContext({ viewport: { width: 1440, height: 900 } });
const page    = await (await ctx).newPage();

console.log("\n=== GUEST PAGES ===");
for (const p of GUEST_PAGES) await shot(page, p.url, p.name);

// Login as admin
console.log("\n=== LOGGING IN AS ADMIN ===");
try {
  const res = await (await ctx).request.post(BASE + "/api/auth/login", {
    data: { email: "admin@tsix.vn", password: "admin123" },
  });
  console.log("Login status:", res.status());
} catch (e) {
  console.log("Login error:", e.message);
}
await page.goto(BASE + "/admin", { waitUntil: "networkidle", timeout: 15000 });
await page.waitForTimeout(1000);

console.log("\n=== ADMIN PAGES ===");
for (const p of ADMIN_PAGES) await shot(page, p.url, p.name);

console.log("\n=== STUDENT PAGES ===");
for (const p of STUDENT_PAGES) await shot(page, p.url, p.name);

await browser.close();
console.log(`\nDone! Screenshots saved to ${OUT}`);
