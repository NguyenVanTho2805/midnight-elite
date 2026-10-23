// Học sinh của gia sư (Figma "Gia sư · Học sinh" 299:113083): tiêu đề + "Thêm học sinh"; ô tìm và lọc theo lớp; tab Đang học / Đã nghỉ;
// danh sách (máy tính: các cột Học sinh · Lớp · Liên hệ · Ghi danh; điện thoại: mỗi em một dòng xếp dọc, không cuộn ngang).
// Chỉ học sinh trong lớp của chính gia sư, chỉ các trường trang lớp đã hiện. Cột "Phụ huynh · Zalo" và "Báo cáo gần nhất" của Figma
// CHƯA có nguồn dữ liệu ở trang lớp nên không dựng (không bịa số liệu, không thu thêm dữ liệu trẻ em).
// Lỗi tải: dải lỗi có "Thử lại". Đang tải: khung xương. Rỗng: có lời giải thích + nút đi tiếp.
"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TutorStudentRow } from "@/lib/tutorStudentsServer";
import { ErrorStrip } from "@/components/kin/shell/Outlook";
import { kinButtonClass } from "@/components/kin/Button";
import { KinTabs } from "@/components/kin/Tabs";
import { KinEmptyState } from "@/components/kin/EmptyState";
import { KinCallout } from "@/components/kin/Callout";
import { KinStatus } from "@/components/kin/Status";
import { STATUS_LABEL, type ProfileStatus } from "@/lib/studentProfile";
import { payerLabel } from "@/lib/consentPolicy";
import { KinPage, KinPageHeader, KinTableSkeleton, KIN_TABLE_HEAD, KIN_TABLE_ROW, KIN_FIELD } from "@/components/kin/PageLayout";

type TabKey = "active" | "suspended" | "profiles" | "waitlist";
/** Hồ sơ riêng của gia sư (đã che theo đồng ý): chỉ các trường dùng ở danh sách. */
interface ProfileRowUi {
  id: string; name: string; userId: string | null; courseId: string | null; status: ProfileStatus; guardianName?: string | null; consentLevel: "full" | "basic_only" | "locked";
  consent: { kind: "child" | "adult" };
}
const COLS = "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,0.8fr)_auto]";
const PCOLS = "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_auto]";
const FIELD = KIN_FIELD;

function Skeleton() {
  return <KinTableSkeleton label="Đang tải danh sách học sinh" tabs />;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

export default function HocSinh() {
  const [rows, setRows] = useState<TutorStudentRow[] | null>(null);
  const [profiles, setProfiles] = useState<ProfileRowUi[]>([]);
  const [courseNames, setCourseNames] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState(false);
  const [q, setQ] = useState("");
  const [courseId, setCourseId] = useState("");
  const [tab, setTab] = useState<TabKey>("active");

  const load = useCallback(() => {
    fetch("/api/tutor/hoc-sinh", { credentials: "same-origin", cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(d => { setRows(Array.isArray(d.students) ? d.students : []); setError(false); })
      .catch(() => setError(true));
    // Hồ sơ riêng (không tài khoản, hoặc ghi chú riêng về em có tài khoản). Lỗi ở đây không chặn danh sách học sinh cũ.
    fetch("/api/tutor/ho-so", { credentials: "same-origin", cache: "no-store" })
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(d => { setProfiles(Array.isArray(d.profiles) ? d.profiles : []); setCourseNames(new Map<string, string>((d.courses ?? []).map((c: { id: string; name: string }) => [c.id, c.name]))); })
      .catch(() => setProfiles([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const all = useMemo(() => rows ?? [], [rows]);
  const needle = q.trim().toLowerCase();
  const courses = useMemo(() => [...new Map(all.map(r => [r.courseId, r.courseName])).entries()], [all]);
  const countOf = (s: "active" | "suspended") => new Set(all.filter(r => r.status === s).map(r => r.userId)).size;
  const profileByUser = useMemo(() => new Map(profiles.filter(p => p.userId).map(p => [p.userId as string, p.id])), [profiles]);
  const standalone = useMemo(() => profiles.filter(p => !p.userId), [profiles]);
  const nProfiles = standalone.filter(p => p.status !== "waitlist").length;
  const nWait = standalone.filter(p => p.status === "waitlist").length;
  const shownProfiles = standalone.filter(p => (tab === "waitlist" ? p.status === "waitlist" : p.status !== "waitlist")
    && (!courseId || p.courseId === courseId) && (!needle || p.name.toLowerCase().includes(needle)));
  const shown = all.filter(r => r.status === tab && (!courseId || r.courseId === courseId)
    && (!needle || [r.name, r.email, r.phone ?? "", r.school ?? ""].some(v => v.toLowerCase().includes(needle))));
  const nActive = countOf("active");

  return (
    <KinPage>
      <KinPageHeader title="Học sinh"
        sub={<>{rows ? `${nActive} học sinh đang học · ` : <span aria-hidden className="invisible">00 học sinh đang học · </span>}Chỉ gồm học sinh trong các lớp của bạn.</>}
        actions={<>
          <Link href="/lop-cua-toi/hoc-sinh/nhap" className={kinButtonClass("secondary")}>Nhập danh sách</Link>
          <Link href="/lop-cua-toi/hoc-sinh/them" className={kinButtonClass("primary")}>Thêm học sinh</Link>
        </>} />

      {error && <ErrorStrip message="Không tải được danh sách học sinh." onRetry={load} />}
      {rows === null ? (!error ? <Skeleton /> : null) : rows.length === 0 && standalone.length === 0 ? (
        <KinEmptyState title="Chưa có học sinh nào trong lớp của bạn"
          action={<Link href="/lop-cua-toi/lop" className={kinButtonClass("secondary")}>Mở danh sách lớp</Link>}>
          Khi học sinh vào lớp bằng mã mời (hoặc bạn thêm em vào lớp), em sẽ hiện ở đây. Mã mời nằm trong từng lớp.
        </KinEmptyState>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,440px)_230px]">
            <label className="block min-w-0">
              <span className="block mb-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Tìm học sinh</span>
              <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Nhập tên, email, số liên hệ…" className={FIELD} />
            </label>
            <label className="block min-w-0">
              <span className="block mb-2 text-[length:var(--kin-co-goc)] text-[var(--kin-chu-chinh)]">Lớp</span>
              <select value={courseId} onChange={e => setCourseId(e.target.value)} className={FIELD}>
                <option value="">Tất cả lớp</option>
                {courses.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
          </div>

          <KinTabs className="mt-6" label="Trạng thái học" value={tab} onChange={setTab}
            tabs={[{ key: "active", label: `Đang học · ${nActive}` }, { key: "suspended", label: `Đã nghỉ · ${countOf("suspended")}` },
              { key: "profiles", label: `Hồ sơ · ${nProfiles}` }, { key: "waitlist", label: `Chờ xếp lớp · ${nWait}` }]} />

          {tab === "profiles" || tab === "waitlist" ? (
            shownProfiles.length === 0 ? (
              <KinEmptyState title={needle || courseId ? "Không có em nào khớp" : tab === "waitlist" ? "Chưa có em nào chờ xếp lớp" : "Chưa có hồ sơ riêng nào"}
                action={<Link href="/lop-cua-toi/hoc-sinh/them" className={kinButtonClass("secondary")}>Thêm học sinh</Link>}>
                {tab === "waitlist" ? "Em đặt trạng thái “Đang chờ xếp lớp” sẽ hiện ở đây. Khi có chỗ, đổi trạng thái sang Hoạt động trong hồ sơ của em." : "Hồ sơ dành cho em chưa có tài khoản. Mỗi hồ sơ chỉ được lưu sau khi có xác nhận đồng ý."}
              </KinEmptyState>
            ) : (
              <div className="mt-4">
                <div aria-hidden className={`hidden md:grid ${PCOLS} gap-x-4 ${KIN_TABLE_HEAD}`}><span>Học sinh</span><span>Lớp</span><span>Loại · Người thanh toán</span><span>Đồng ý</span><span className="w-20" /></div>
                <ul aria-label={tab === "waitlist" ? "Danh sách chờ xếp lớp" : "Hồ sơ không tài khoản"}>
                  {shownProfiles.map(p => (
                    <li key={p.id} data-ho-so className={`grid ${PCOLS} gap-x-4 gap-y-1 ${KIN_TABLE_ROW}`}>
                      <div className="min-w-0"><p className="text-[var(--kin-chu-chinh)] break-words">{p.name}</p><p className="text-[var(--kin-chu-mo)]">{STATUS_LABEL[p.status]}</p></div>
                      <p className="text-[var(--kin-chu-chinh)] break-words">{p.courseId ? courseNames.get(p.courseId) ?? "" : "Chưa xếp lớp"}</p>
                      <p className="text-[var(--kin-chu-mo)] break-words">{p.consentLevel === "locked" ? "Đã ẩn" : `${p.consent.kind === "adult" ? "Người lớn" : "Con"} · ${payerLabel(p.consent.kind, p.guardianName)}`}</p>
                      <p><KinStatus tone={p.consentLevel === "locked" ? "loi" : p.consentLevel === "full" ? "xong" : "cho"}>{p.consentLevel === "locked" ? "Thiếu đồng ý, đã ẩn" : p.consentLevel === "full" ? "Đủ đồng ý" : "Đủ cho thông tin cơ bản"}</KinStatus></p>
                      <Link href={`/lop-cua-toi/hoc-sinh/${p.id}`} aria-label={`Mở hồ sơ của ${p.name}`} className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline md:w-20">Mở hồ sơ</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          ) : shown.length === 0 ? (
            <KinEmptyState title={needle || courseId ? "Không có em nào khớp" : tab === "active" ? "Chưa có em nào đang học" : "Chưa có em nào đã nghỉ"}
              action={needle || courseId ? <button type="button" className={kinButtonClass("secondary")} onClick={() => { setQ(""); setCourseId(""); }}>Bỏ lọc</button> : undefined}>
              {needle || courseId ? "Thử đổi từ khoá hoặc chọn lại lớp." : tab === "active" ? "Học sinh đang học trong lớp của bạn sẽ hiện ở đây." : "Em tạm dừng hoặc hết hạn gói sẽ chuyển sang mục này."}
            </KinEmptyState>
          ) : (
            <div className="mt-4">
              <div aria-hidden className={`hidden md:grid ${COLS} gap-x-4 ${KIN_TABLE_HEAD}`}>
                <span>Học sinh</span><span>Lớp</span><span>Liên hệ</span><span>Ghi danh</span><span className="w-20" />
              </div>
              <ul aria-label="Danh sách học sinh">
                {shown.map(r => (
                  <li key={r.key} data-hoc-sinh className={`grid ${COLS} gap-x-4 gap-y-1 ${KIN_TABLE_ROW}`}>
                    <div className="min-w-0">
                      <p className="text-[var(--kin-chu-chinh)] break-words">{r.name}</p>
                      {r.school && <p className="text-[var(--kin-chu-mo)] break-words">{r.school}</p>}
                    </div>
                    <p className="text-[var(--kin-chu-chinh)] break-words">{r.courseName}</p>
                    <div className="min-w-0 text-[var(--kin-chu-mo)] break-words">
                      {r.phone && <a href={`tel:${r.phone}`} className="block min-h-6 text-[var(--kin-nhan-link)] underline">{r.phone}</a>}
                      <p className="break-all">{r.email}</p>
                    </div>
                    <p className="text-[var(--kin-chu-mo)] tabular-nums">Ghi danh {fmtDate(r.enrolledAt)}<span className="block">{r.status === "active" ? "Hoạt động" : "Không hoạt động"}</span></p>
                    <div className="flex md:flex-col gap-x-4 md:w-24">
                      <Link href={`/lop-cua-toi/${r.courseId}`} aria-label={`Mở lớp ${r.courseName} của ${r.name}`}
                        className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Mở lớp</Link>
                      <Link href={profileByUser.has(r.userId) ? `/lop-cua-toi/hoc-sinh/${profileByUser.get(r.userId)}` : `/lop-cua-toi/hoc-sinh/them?userId=${r.userId}`} aria-label={`Hồ sơ riêng của ${r.name}`}
                        className="inline-flex items-center min-h-11 text-[var(--kin-nhan-link)] underline">Hồ sơ riêng</Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <KinCallout className="mt-8" title="Thông tin chỉ mình bạn thấy">
            Tên và liên hệ học sinh chỉ hiện với gia sư của lớp, không đưa lên hồ sơ công khai. Hồ sơ riêng chỉ lưu khi có xác nhận đồng ý, và thu hồi được bất cứ lúc nào.
            <span className="block mt-1"><Link href="/lop-cua-toi/hoc-sinh/truong" className="inline-flex items-center min-h-11 underline text-[var(--kin-nhan-link)]">Trường tuỳ chỉnh</Link></span>
          </KinCallout>
        </>
      )}
    </KinPage>
  );
}
