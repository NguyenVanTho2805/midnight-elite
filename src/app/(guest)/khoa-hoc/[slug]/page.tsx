// BU-07 — vỏ SERVER mỏng cho /khoa-hoc/[slug]: chỉ thêm generateMetadata (SEO/OG). Toàn bộ giao diện và hành vi nằm nguyên văn trong KhoaHocChiTiet ("use client").
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { courseMetadata } from "@/lib/seoPublic";
import KhoaHocChiTiet from "@/components/student/KhoaHocChiTiet";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  let id = slug;
  try { id = decodeURIComponent(slug); } catch { return courseMetadata(null); }
  if (id.length === 0 || id.length > 200 || id.includes("\u0000")) return courseMetadata(null);
  const c = await prisma.course.findUnique({ where: { id }, select: { id: true, name: true, instructor: true, status: true } });
  return courseMetadata(c);
}

export default function KhoaHocSlugPage() {
  return <KhoaHocChiTiet />;
}
