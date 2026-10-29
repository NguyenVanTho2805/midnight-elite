// Danh mục lớp của học sinh (NC2-041): hiện khi em học từ 2 lớp trở lên và mở "Lớp của tôi" mà chưa chọn lớp nào.
// Mỗi dòng là một lớp: tên lớp, gia sư, nhóm lớp, số bài đã hoàn thành. Lớp gia sư tạo bằng wizard có `instructor` = "KiN" (cố ý không ghi tên thật lên thẻ lớp công khai),
// nên dòng "Gia sư" chỉ hiện khi có tên thật. `category` có thể là môn HOẶC nhóm kỳ thi (lớp do quản trị tạo) nên không gắn nhãn "Môn:". Bấm vào dòng để vào lớp (/student/hoc-tap?course=<lớp>).
// Chỉ dữ liệu của chính các lớp em đã vào; không hiện bạn học (KiN không đưa dữ liệu bạn học cho học sinh).
"use client";
import type { MyClass } from "@/hooks/useMyClasses";
import { KinPanel } from "@/components/kin/Panel";
import { KinListRow } from "@/components/kin/ListRow";

/** "Gia sư: Cô Hạnh"; rỗng hoặc "KiN" (tên giữ chỗ của lớp tạo bằng wizard) thì không hiện dòng này. */
export function teacherLabel(instructor: string | null | undefined): string {
  const t = (instructor ?? "").trim();
  return t && t.toLowerCase() !== "kin" ? `Gia sư: ${t}` : "";
}

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
                sub={[teacherLabel(c.instructor), c.category.trim()].filter(Boolean).join(" · ") || undefined}
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
