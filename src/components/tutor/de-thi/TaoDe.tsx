// BU-03 P2 · S4 — Tạo đề (/lop-cua-toi/de-thi/tao-moi): MỘT cửa vào cho cả hai luồng soạn đề từng tách đôi (luồng quản trị + luồng quiz).
// Bốn lối: Từ ma trận · Từ Word (Azota, không AI) · Từ PDF/ảnh (AI, tốn lượt AI — ghi rõ) · Soạn trắng. 1600px: lưới 2×2; 390px: bốn thẻ dọc.
// PDF/ảnh và Soạn trắng dùng lại trình có sẵn (QuizImport, QuizNew) ngay trong trang này (?cach=pdf | ?cach=trang) để đường cũ bai-tap/nhap-de, quiz/moi chuyển hướng về một nơi.
"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KinPage, KinPageHeader } from "@/components/kin/PageLayout";
import { kinButtonClass } from "@/components/kin/Button";
import { KinCallout } from "@/components/kin/Callout";
import QuizImport from "@/components/tutor/quiz/QuizImport";
import QuizNew from "@/components/tutor/quiz/QuizNew";
import { deThiListHref, maTranMoiHref, nhapWordDeHref, taoDeHref, tepGocHref } from "./deThiClient";

interface Lane { id: string; title: string; text: string; note: string; cta: string; href: string }
const LANES: Lane[] = [
  { id: "ma-tran", title: "Từ ma trận", text: "Chọn yêu cầu cần đạt, số câu theo mức NB / TH / VD / VDC; KiN bốc câu từ ngân hàng, cô đổi từng câu được.", note: "Không tốn lượt AI", cta: "Bắt đầu từ ma trận", href: maTranMoiHref() },
  { id: "word", title: "Từ tệp Word", text: "Đề Word theo mẫu Azota: KiN đọc đáp án gạch chân hoặc bảng đáp án, cô xem lại rồi tạo đề nháp.", note: "Không tốn lượt AI", cta: "Nhập từ Word", href: nhapWordDeHref() },
  { id: "pdf", title: "Từ PDF hoặc ảnh", text: "Đề đã in hoặc chụp: AI đọc câu hỏi, cô đối chiếu từng câu với tệp gốc trước khi lưu.", note: "Tốn lượt AI mỗi lần đọc tệp", cta: "Nhập từ PDF/ảnh", href: taoDeHref("pdf") },
  { id: "trang", title: "Soạn trắng", text: "Đặt tên đề rồi soạn từng câu bằng tay, hoặc thêm câu từ ngân hàng sau.", note: "Không tốn lượt AI", cta: "Soạn đề trắng", href: taoDeHref("trang") },
];

export default function TaoDe() {
  const cach = useSearchParams().get("cach");
  if (cach === "pdf") return <QuizImport />;
  if (cach === "trang") return <QuizNew />;
  return (
    <KinPage>
      <KinPageHeader title="Tạo đề" back={{ href: deThiListHref(), label: "Đề thi" }} sub="Chọn cách cô muốn bắt đầu · đề mới luôn là bản nháp" />
      <ul aria-label="Các cách tạo đề" className="grid md:grid-cols-2 gap-x-8 gap-y-6">
        {LANES.map(l => (
          <li key={l.id} data-tao-de={l.id} className="min-w-0 flex flex-col gap-3 rounded-[var(--kin-bo-md)] border border-[var(--kin-vien-thuong)] p-6">
            <h2 className="text-[length:var(--kin-co-tieu-de)] font-medium text-[var(--kin-chu-chinh)]">{l.title}</h2>
            <p className="text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-phu)]">{l.text}</p>
            <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">{l.note}</p>
            <div className="mt-auto pt-2"><Link href={l.href} className={kinButtonClass(l.id === "ma-tran" ? "primary" : "secondary")}>{l.cta}</Link></div>
          </li>
        ))}
      </ul>
      <KinCallout className="mt-8" title="Đã có sẵn tệp đề gốc?">
        Cô lưu tệp Word/PDF ở <Link href={tepGocHref()} className="underline">Tệp đề gốc</Link>, rồi bấm “Tách thành đề” để KiN đọc và tạo đề nháp.
      </KinCallout>
    </KinPage>
  );
}
