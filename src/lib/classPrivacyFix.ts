// SCL-A (Q7, Q10, P1-3, P1-4) — kế hoạch THUẦN cho script dữ liệu một lần scripts/scl-an-lop-cong-khai.ts. Không DB.
//   CHỈ lớp của gia sư (chủ lớp adminRole "teacher"); khoá học trung tâm giữ nguyên (cố ý công khai, tên "KiN").
//   joinPolicy null → "approve"; lớp không phải "open" mà đang công khai → status false; tên gia sư trống / giữ chỗ "KiN" → tên thật của chủ lớp.
export interface ClassRow { id: string; name: string; status: boolean; joinPolicy: string | null; instructor: string; ownerName: string | null; ownerAdminRole: string | null }
export interface ClassPatch { id: string; name: string; data: { joinPolicy?: string; status?: boolean; instructor?: string; teacherAvatar?: string } }

export function planClassFix(rows: ClassRow[]): ClassPatch[] {
  const out: ClassPatch[] = [];
  for (const r of rows) {
    if (r.ownerAdminRole !== "teacher") continue;
    const data: ClassPatch["data"] = {};
    const policy = r.joinPolicy ?? "approve";
    if (r.joinPolicy === null) data.joinPolicy = "approve";
    if (r.status && policy !== "open") data.status = false;
    const instr = r.instructor.trim();
    const owner = r.ownerName?.trim() ?? "";
    if ((!instr || instr.toLowerCase() === "kin") && owner) { data.instructor = owner; data.teacherAvatar = owner.charAt(0).toUpperCase(); }
    if (Object.keys(data).length) out.push({ id: r.id, name: r.name, data });
  }
  return out;
}
