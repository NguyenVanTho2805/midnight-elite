// Hồ sơ gia sư (1.4.4) — validate dùng chung cho đăng ký gia sư và sửa hồ sơ.

export const TUTOR_BIO_MAX      = 2000;
export const TUTOR_SUBJECTS_MAX = 10;
export const TUTOR_SUBJECT_LEN  = 50;

// Trả { bio, subjects } đã chuẩn hoá, hoặc { error } nếu dữ liệu sai.
// Field không truyền → undefined (route PUT bỏ qua, không ghi đè).
export function parseTutorProfileInput(body: { bio?: unknown; subjects?: unknown }):
  { bio?: string | null; subjects?: string[]; error?: string } {
  const out: { bio?: string | null; subjects?: string[] } = {};

  if (body.bio !== undefined) {
    if (body.bio !== null && typeof body.bio !== "string") return { error: "bio phải là chuỗi" };
    const bio = (body.bio ?? "").trim();
    if (bio.length > TUTOR_BIO_MAX) return { error: `Giới thiệu tối đa ${TUTOR_BIO_MAX} ký tự` };
    out.bio = bio || null;
  }

  if (body.subjects !== undefined) {
    if (!Array.isArray(body.subjects) || body.subjects.some(s => typeof s !== "string")) {
      return { error: "subjects phải là danh sách môn (chuỗi)" };
    }
    // Bỏ trùng không phân biệt hoa thường, giữ thứ tự nhập.
    const seen = new Set<string>();
    const subjects: string[] = [];
    for (const raw of body.subjects as string[]) {
      const s = raw.trim();
      if (!s) continue;
      if (s.length > TUTOR_SUBJECT_LEN) return { error: `Tên môn tối đa ${TUTOR_SUBJECT_LEN} ký tự` };
      const key = s.toLocaleLowerCase("vi");
      if (seen.has(key)) continue;
      seen.add(key);
      subjects.push(s);
    }
    if (subjects.length > TUTOR_SUBJECTS_MAX) return { error: `Tối đa ${TUTOR_SUBJECTS_MAX} môn` };
    out.subjects = subjects;
  }

  return out;
}

// Trạng thái đơn gia sư suy ra từ các field — 1 chỗ để mọi route hiểu giống nhau.
export type TutorApplicationStatus = "none" | "pending" | "approved" | "rejected";
export function tutorApplicationStatus(u: {
  tutorAppliedAt: Date | null; tutorVerified: boolean; tutorRejectedAt: Date | null;
}): TutorApplicationStatus {
  if (u.tutorVerified) return "approved";
  if (!u.tutorAppliedAt) return "none";
  if (u.tutorRejectedAt) return "rejected";
  return "pending";
}
