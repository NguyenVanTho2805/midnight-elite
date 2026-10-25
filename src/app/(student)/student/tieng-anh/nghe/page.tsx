"use client";
import TextList from "@/components/english/TextList";
import { PageHead } from "@/components/english/ui";

export default function ListeningList() {
  return (
    <>
      <PageHead title="Nghe" sub="Chép chính tả từng câu: sửa đúng khâu người mới hay vấp — nhận ra từ mình đã biết trong dòng âm thanh." />
      <TextList basePath="/student/tieng-anh/nghe" mode="nghe" />
    </>
  );
}
