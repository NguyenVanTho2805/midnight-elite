"use client";
import TextList from "@/components/english/TextList";
import { PageHead } from "@/components/english/ui";

export default function ReadingList() {
  return (
    <>
      <PageHead title="Đọc" sub="Bài 95–98% từ quen là vừa sức để học (đọc nhiều bài vừa sức hiệu quả hơn đọc ít bài khó)." />
      <TextList basePath="/student/tieng-anh/doc" mode="doc" />
    </>
  );
}
