// GS-LOP-GON — mục "Thông tin" của tab Cài đặt lớp (vỏ gia sư). SCL-F2 (P2-25): chỉ còn tên lớp, môn · khối, cách vào lớp, hiện/ẩn.
// Bỏ khỏi giao diện: giá bán/giá gốc, slug, nhãn HOT + màu nhãn, ảnh nền (kèm cảnh báo Cloudinary), video giới thiệu, sức chứa… Dữ liệu cũ GIỮ NGUYÊN
// (form chỉ gửi đúng trường nó sửa qua PATCH /api/courses/<id>); quản trị vẫn sửa đủ ở trang /admin/khoa-hoc/<id>. Học phí ở mục Học phí, sau cờ HOC_PHI như cũ.
// Môn · khối: hai KinSelect danh sách cố định (src/lib/classSubject.ts) — chữ cũ không nhận ra vẫn hiện làm một lựa chọn, không tự đổi dữ liệu.
"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { isCenterAdmin } from "@/lib/tutorGate";
import { classBase } from "@/lib/tutorClassRoutes";
import { CLASS_GRADES, CLASS_SUBJECTS, joinCategory, optionsWith, splitCategory } from "@/lib/classSubject";
import { KinButton, kinButtonClass } from "@/components/kin/Button";
import { KinInput } from "@/components/kin/Input";
import { KinSelect } from "@/components/kin/KinSelect";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KIN_LABEL } from "@/components/kin/PageLayout";
import { Toggle } from "@/components/Toggle";
import type { CourseDB } from "./lessonForm";

const POLICY_TEXT: Record<string, string> = {
  approve: "Duyệt từng bạn: học sinh xin vào lớp, bạn duyệt ở tab Học sinh.",
  invite_only: "Chỉ mã mời: ai có mã mới vào được.",
  open: "Vào ngay: học sinh bấm Vào lớp là vào (chỉ lớp miễn phí).",
};

export function TabCaiDat({ courseSlug, course }: { courseSlug: string; course: CourseDB & { joinPolicy?: string | null } }) {
  const { user } = useAuth();
  const center = isCenterAdmin(user);
  const init = splitCategory(course.category);
  const [name, setName] = useState(course.name);
  const [subject, setSubject] = useState(init.subject);
  const [grade, setGrade] = useState(init.grade);
  const [shown, setShown] = useState(course.status);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const policy = course.joinPolicy ?? "approve";

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setMsg({ ok: false, text: "Bạn nhập tên lớp trước nhé." }); return; }
    setSaving(true); setMsg(null);
    try {
      // Chỉ gửi trường đã sửa được ở đây — giá, nhãn, ảnh nền… của lớp cũ không bị đụng. Gia sư: máy chủ tự suy hiện/ẩn từ cách vào lớp.
      // Môn/khối chỉ chuẩn hoá khi hiển thị: không đổi thì KHÔNG gửi category, để chữ cũ trong DB giữ nguyên.
      const catChanged = subject !== init.subject || grade !== init.grade;
      await api.courses.update(courseSlug, { name: name.trim(), ...(catChanged ? { category: joinCategory(subject, grade) } : {}), ...(center ? { status: shown } : {}) });
      setMsg({ ok: true, text: "Đã lưu thông tin lớp." });
    } catch (err) {
      setMsg({ ok: false, text: `Chưa lưu được: ${err instanceof Error ? err.message : "lỗi không rõ"}. Bạn thử lại nhé.` });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={e => void save(e)} noValidate data-cai-dat-thong-tin className="max-w-2xl space-y-[var(--kin-cach-muc)]">
      <section aria-labelledby="cd-tt">
        <KinSectionHead id="cd-tt" title="Thông tin lớp" />
        <div className="pt-5 grid sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <KinInput label="Tên lớp" value={name} onChange={e => { setName(e.target.value); setMsg(null); }} autoComplete="off" />
          </div>
          <div className={KIN_LABEL}>
            <span id="class-category-nhan">Môn</span>
            <KinSelect id="class-category" aria-labelledby="class-category-nhan" value={subject} onChange={v => { setSubject(v); setMsg(null); }} placeholder="Chọn môn" className="mt-2"
              options={optionsWith(CLASS_SUBJECTS, subject).map(s => ({ value: s, label: s }))} />
          </div>
          <div className={KIN_LABEL}>
            <span id="class-grade-nhan">Khối</span>
            <KinSelect id="class-grade" aria-labelledby="class-grade-nhan" value={grade} onChange={v => { setGrade(v); setMsg(null); }} className="mt-2"
              options={[{ value: "", label: "Không ghi khối" }, ...optionsWith(CLASS_GRADES, grade).map(g => ({ value: g, label: g }))]} />
          </div>
        </div>
      </section>

      <section aria-labelledby="cd-cvl">
        <KinSectionHead id="cd-cvl" title="Cách vào lớp" />
        <p className="pt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-chinh)]" data-cai-dat-policy={policy}>{POLICY_TEXT[policy] ?? POLICY_TEXT.approve}</p>
        <Link href={`${classBase(courseSlug)}/hoc-vien?muc=ma-moi`} className={`${kinButtonClass("secondary")} mt-3`}>Đổi cách vào lớp</Link>
      </section>

      <section aria-labelledby="cd-hien">
        <KinSectionHead id="cd-hien" title="Hiện hay ẩn" />
        {center ? (
          <div className="pt-4 flex items-center gap-3">
            <Toggle checked={shown} onChange={() => { setShown(s => !s); setMsg(null); }} labelledBy="cd-hien-nhan" />
            <span id="cd-hien-nhan" className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">{shown ? "Đang hiện ở trang Khoá học công khai" : "Đang ẩn khỏi trang công khai"}</span>
          </div>
        ) : (
          <p className="pt-4 text-[length:var(--kin-co-goc)] leading-5 text-[var(--kin-chu-mo)]" data-cai-dat-hien={course.status ? "hien" : "an"}>
            {course.status ? "Lớp đang hiện ở trang Khoá học công khai" : "Lớp đang ẩn, chỉ học sinh trong lớp thấy"}. Lớp chỉ hiện công khai khi cách vào lớp là Vào ngay.
          </p>
        )}
      </section>

      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-[length:var(--kin-co-goc)] ${msg.ok ? "text-[var(--kin-tt-chu-xong)]" : "text-[var(--kin-tt-chu-loi)]"}`}>{msg.text}</p>}
      <KinButton type="submit" loading={saving} loadingLabel="Đang lưu…">Lưu thay đổi</KinButton>
    </form>
  );
}
