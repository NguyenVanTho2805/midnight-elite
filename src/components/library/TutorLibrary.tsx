// Thư viện của gia sư (Figma "Gia sư · Thư viện" 299:113561): tiêu đề + "Tải tài liệu"; cột trái "Nhóm lớp" (Figma ghi "Môn học": KiN chưa có môn học, chỉ có danh mục của lớp — ĐGNL, Tốt nghiệp THPT… — nên gọi đúng tên) và "Truy cập nhanh";
// cột phải: ô tìm, tab theo lớp trong môn, bảng tài liệu (tên · loại · đã chia sẻ · thao tác). Điện thoại: một cột, mỗi tài liệu một khối.
// "Chia sẻ" trong KiN = tài liệu nằm trong bài học của lớp nào thì học sinh lớp đó xem được; nên cột "Đã chia sẻ" là tên lớp chứa bài.
// Figma có nhưng chưa có dữ liệu/tính năng thật (không bịa, không vẽ nút chết): dung lượng tệp (DB không lưu), "Tạo thư mục", "Chỉ mình tôi",
// "Đã chia sẻ" / "Thùng rác" (không có trạng thái riêng tư hay thùng rác), thanh "Chia sẻ tới lớp" (tài liệu gắn vào bài học, chưa có thao tác chia sẻ riêng).
// Bài tập không còn nằm ở đây — chúng ở module Bài tập (/lop-cua-toi/bai-tap).
"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { docKind, viewerHref } from "@/lib/library";
import type { LibClass } from "@/lib/libraryServer";
import { kinButtonClass } from "@/components/kin/Button";
import { KinTabs } from "@/components/kin/Tabs";
import { KinSectionHead } from "@/components/kin/SectionHead";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinPage, KinPageHeader, KIN_FIELD, KIN_TABLE_HEAD, KIN_TABLE_ROW } from "@/components/kin/PageLayout";

interface Row { key: string; classId: string; className: string; subject: string; name: string; lesson: string; kind: string; view: string | null; edit: string }

const FIELD = KIN_FIELD;
const ACT = "inline-flex items-center min-h-11 text-[length:var(--kin-co-goc)] text-[var(--kin-nhan-link)] hover:underline";
const COLS = "md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)] md:gap-4";

function rowsOf(classes: LibClass[]): Row[] {
  const out: Row[] = [];
  for (const c of classes) {
    const subject = (c.category ?? "").trim() || "Khác";
    for (const l of c.lessons) {
      const edit = `/lop-cua-toi/quan-lop/${c.id}?tab=chuong-bai`;
      if (l.hasVideo) out.push({ key: `${l.id}:v`, classId: c.id, className: c.name, subject, name: "Bản ghi bài học", lesson: l.title, kind: "Video", view: null, edit });
      for (const d of l.docs) out.push({ key: `${l.id}:${d.url}`, classId: c.id, className: c.name, subject, name: d.name, lesson: l.title, kind: docKind(d), view: viewerHref(d.name, d.url), edit });
    }
  }
  return out;
}

export default function TutorLibrary({ classes }: { classes: LibClass[] }) {
  const all = useMemo(() => rowsOf(classes), [classes]);
  const subjects = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of all) m.set(r.subject, (m.get(r.subject) ?? 0) + 1);
    return [...m.entries()];
  }, [all]);
  const [subject, setSubject] = useState<string | null>(null); // null = tất cả tài liệu
  const [classId, setClassId] = useState("all");
  const [q, setQ] = useState("");

  const inSubject = subject ? all.filter(r => r.subject === subject) : all;
  const tabClasses = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of inSubject) seen.set(r.classId, r.className);
    return [...seen.entries()];
  }, [inSubject]);
  const cid = classId !== "all" && tabClasses.some(([id]) => id === classId) ? classId : "all";
  const needle = q.trim().toLowerCase();
  const shown = inSubject.filter(r => (cid === "all" || r.classId === cid)
    && (!needle || `${r.name} ${r.lesson} ${r.className} ${r.kind}`.toLowerCase().includes(needle)));

  const uploadHref = classes.length === 1 ? `/lop-cua-toi/quan-lop/${classes[0].id}?tab=chuong-bai` : "/lop-cua-toi/lop";
  const pickSubject = (s: string | null) => { setSubject(s); setClassId("all"); };
  const subjectBtn = (active: boolean) => `w-full text-left min-h-11 flex items-center justify-between gap-2 text-[length:var(--kin-co-goc)] ${active ? "text-[var(--kin-nhan-link)] font-medium" : "text-[var(--kin-chu-mo)] hover:text-[var(--kin-chu-chinh)]"}`;

  return (
    <KinPage>
      <KinPageHeader title="Thư viện" sub="Tài liệu của cô, sắp xếp theo nhóm lớp và chia sẻ đúng lớp. Bản ghi và tài liệu của các lớp bạn dạy."
        actions={<Link href={uploadHref} className={kinButtonClass("primary")}>↑ Tải tài liệu</Link>} />

      {classes.length === 0 ? (
        <KinEmptyState title="Bạn chưa mở lớp nào" action={<Link href="/lop-cua-toi/quan-lop?tao=1" className={kinButtonClass("primary")}>Tạo lớp</Link>}>
          Tạo lớp rồi thêm bài giảng và tài liệu, chúng sẽ hiện ở đây.
        </KinEmptyState>
      ) : all.length === 0 ? (
        <KinEmptyState title="Lớp của cô chưa có bản ghi hay tài liệu nào" action={<Link href={uploadHref} className={kinButtonClass("primary")}>Thêm tài liệu vào bài học</Link>}>
          Tài liệu và bản ghi được thêm trong từng bài học của lớp, rồi hiện ở đây theo nhóm lớp và theo lớp.
        </KinEmptyState>
      ) : (
        <div className="grid lg:grid-cols-[220px_minmax(0,1fr)] gap-x-[var(--kin-cach-cot)] gap-y-[var(--kin-cach-muc)] items-start">
          <nav aria-label="Nhóm lớp" className="min-w-0">
            <KinSectionHead title="Nhóm lớp" as="h2" />
            <ul className="mt-2 mb-8">
              {subjects.map(([s, n]) => (
                <li key={s}><button type="button" aria-pressed={subject === s} onClick={() => pickSubject(s)} className={subjectBtn(subject === s)}><span className="truncate">{s}</span><span className="tabular-nums">{n}</span></button></li>
              ))}
            </ul>
            <KinSectionHead title="Truy cập nhanh" as="h2" />
            <ul className="mt-2">
              <li><button type="button" aria-pressed={subject === null} onClick={() => pickSubject(null)} className={subjectBtn(subject === null)}><span>Tất cả tài liệu</span><span className="tabular-nums">{all.length}</span></button></li>
            </ul>
          </nav>

          <div className="min-w-0">
            <label htmlFor="tv-q" className="block mb-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">Tìm tài liệu</label>
            <input id="tv-q" type="search" className={FIELD} value={q} onChange={e => setQ(e.target.value)} placeholder="Tìm theo tên, lớp hoặc loại tệp…" />

            <div className="mt-6 overflow-x-auto">
              <KinTabs label="Lớp trong nhóm" ruled tabs={[{ key: "all", label: subject ? `${subject} · Tất cả` : "Tất cả" }, ...tabClasses.map(([id, name]) => ({ key: id, label: name }))]}
                value={cid} onChange={setClassId} />
            </div>

            {shown.length === 0 ? (
              <KinEmptyState title="Không có tài liệu nào khớp" action={<button type="button" onClick={() => { setQ(""); setClassId("all"); }} className={kinButtonClass("secondary")}>Xoá bộ lọc</button>}>
                Thử bỏ ô tìm hoặc chọn lớp khác.
              </KinEmptyState>
            ) : (
              <>
                <div aria-hidden className={`hidden ${COLS} mt-5 ${KIN_TABLE_HEAD}`}>
                  <span>Tên tài liệu</span><span>Loại</span><span>Đã chia sẻ</span><span>Thao tác</span>
                </div>
                <ul aria-label="Tài liệu" className="mt-2 md:mt-0">
                  {shown.map(r => (
                    <li key={r.key} className={`${COLS} ${KIN_TABLE_ROW}`}>
                      <div className="min-w-0">
                        <p className="text-[var(--kin-chu-chinh)] break-words">{r.name}</p>
                        <p className="text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)] break-words">{r.lesson}</p>
                      </div>
                      <p className="mt-1 md:mt-0 text-[var(--kin-chu-mo)]"><span className="md:hidden">Loại: </span>{r.kind}</p>
                      <p className="text-[var(--kin-chu-mo)] break-words"><span className="md:hidden">Đã chia sẻ: </span>{r.className}</p>
                      <p className="flex flex-wrap gap-x-5">
                        {r.view && <Link href={r.view} target="_blank" rel="noopener noreferrer" className={ACT}>Xem</Link>}
                        <Link href={r.edit} className={ACT}>Sửa bài</Link>
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="mt-6 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-mo)]">
              {shown.length} tài liệu{subject ? ` trong ${subject}` : ""} · Video là đường dẫn tới nơi cô đăng (YouTube, Drive…), KiN không lưu file video.
            </p>
          </div>
        </div>
      )}
    </KinPage>
  );
}
