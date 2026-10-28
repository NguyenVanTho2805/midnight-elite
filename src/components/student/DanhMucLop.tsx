// Danh mục lớp của học sinh (NC2-041): hiện khi em học từ 2 lớp trở lên và mở "Lớp của tôi" mà chưa chọn lớp nào.
// Mỗi dòng là một lớp: tên lớp, gia sư, môn, số bài đã hoàn thành. Bấm vào dòng để vào lớp (/student/hoc-tap?course=<lớp>).
// Chỉ dữ liệu của chính các lớp em đã vào; không hiện bạn học (KiN không đưa dữ liệu bạn học cho học sinh).
"use client";
import type { MyClass } from "@/hooks/useMyClasses";
import { KinPanel } from "@/components/kin/Panel";
import { KinListRow } from "@/components/kin/ListRow";

export default function DanhMucLop({ classes, doneByCourse }: { classes: MyClass[]; doneByCourse: Record<string, number> }) {
  return (
    <KinPanel flush>
      <ul aria-label="Các lớp của tôi" data-class-catalog>
        {classes.map(c => {
          const done = Math.min(doneByCourse[c.id] ?? 0, c.lessonCount);
          return (
            <li key={c.id} data-class-card={c.id}>
              <KinListRow
                href={`/student/hoc-tap?course=${c.id}`}
                title={c.name}
                sub={[`Gia sư: ${c.instructor}`, c.category ? `Môn: ${c.category}` : ""].filter(Boolean).join(" · ")}
                status={<span className="text-[var(--kin-chu-mo)]">{c.lessonCount > 0 ? `${done}/${c.lessonCount} bài đã hoàn thành` : "Lớp chưa có bài học"}</span>}
                trailing={<span className="text-[length:var(--kin-co-goc)] text-[var(--kin-nhan-link)]">Vào lớp →</span>}
              />
            </li>
          );
        })}
      </ul>
    </KinPanel>
  );
}
