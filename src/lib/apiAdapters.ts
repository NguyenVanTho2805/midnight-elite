// Chuyển đổi data từ API sang các type frontend đang dùng

import type { CourseFull, CourseWithCurriculum, LessonFull, ExamFull } from "./api";
import type { EnrolledCourse, Section, Chapter, Lesson } from "./types";
import { parseLessonType } from "./types";

// CourseFull (API) → CatalogCourse (hoc-tap catalog tab)
export function toCatalogCourse(c: CourseFull) {
  return {
    id:           c.id,
    name:         c.name,
    title:        c.name,
    shortTitle:   c.shortTitle,
    category:     c.category,
    instructor:   c.instructor,
    teacher:      c.instructor,
    teacherAvatar:c.teacherAvatar,
    openDate:     c.openDate,
    types:        c.types,
    tag:          c.tag ?? undefined,
    tagColor:     c.tagColor ?? undefined,
    bg:           c.bg,
    strip:        c.strip,
    price:        c.price,
    originalPrice:c.originalPrice ?? undefined,
    lessons:      c.lessons,
    hours:        c.hours,
    status:       c.status,
  };
}

// LessonFull (API) → Lesson (frontend)
function toLesson(l: LessonFull, completedIds: Set<string>): Lesson {
  return {
    id:          l.id,
    code:        l.code,
    title:       l.title,
    type:        parseLessonType(l.type),
    duration:    l.duration ?? undefined,
    isCompleted: completedIds.has(l.id),
    isLocked:    l.isLocked && !completedIds.has(l.id),
    isFree:      l.isFree,
    stats: {
      videos:    l.statsVideos,
      materials: l.statsMaterials,
      views:     l.statsViews,
    },
  };
}

// CourseWithCurriculum (API) → EnrolledCourse (frontend)
export function toEnrolledCourse(
  c: CourseWithCurriculum,
  completedIds: Set<string> = new Set()
): EnrolledCourse {
  const sections: Section[] = (c.sections ?? [])
    .sort((a, b) => a.order - b.order)
    .map(s => ({
      id:    s.id,
      title: s.title,
      chapters: (s.chapters ?? [])
        .sort((a, b) => a.order - b.order)
        .map(ch => ({
          id:      ch.id,
          title:   ch.title,
          lessons: (ch.lessons ?? [])
            .sort((a, b) => a.order - b.order)
            .map(l => toLesson(l, completedIds)),
        } as Chapter)),
    }));

  return {
    id:           c.id,
    title:        c.name,
    shortTitle:   c.shortTitle,
    category:     c.category,
    bg:           c.bg,
    instructor:   c.instructor,
    teacherAvatar:c.teacherAvatar,
    openDate:     c.openDate,
    types:        c.types,
    sections,
  };
}

// ExamFull (API) → student exam display type
export function toStudentExam(e: ExamFull) {
  return {
    id:          e.id,
    code:        e.code,
    title:       e.title,
    category:    e.category,
    date:        e.date,
    time:        e.time,
    duration:    e.duration,
    questions:   e.questions,
    status:      e.status as "available" | "upcoming" | "completed",
    azotaUrl:    e.azotaUrl ?? undefined,
    participants:e.participants,
    active:      e.active,
    score:       undefined as number | undefined,
    rank:        undefined as number | undefined,
  };
}
