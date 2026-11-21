# Thành phần chung KiN (`src/components/kin/`)

Đợt dựng nền 23/10/2026. Mọi màn sau này dựng bằng các thành phần này, không tự viết lại. Màu chỉ qua token `--kin-*` (không mã hex). Cỡ chữ theo Figma: **chữ gốc 14px** (`--kin-co-goc`), **chữ phụ 12px** (`--kin-co-phu`), **tiêu đề mục 18px** (`--kin-co-tieu-de`), số lớn nhất 22px. Vùng chạm tối thiểu 44px (`--kin-cham-toi-thieu`). Đường kẻ mảnh `--kin-vien-nhat`.

Nhập: `import { KinButton, KinStatus, KinStat, KinStatRow, KinSectionHead, KinListRow, KinCallout, KinEmptyState } from "@/components/kin";`

## Nút — `KinButton`, `kinButtonClass` (Button.tsx)
Cao ≥ 44px, chữ 14px. Ba kiểu theo Figma:
| `variant` | Hình | Dùng cho |
|---|---|---|
| `primary` | xanh đậm đặc, chữ trắng | MỘT nút chính mỗi màn ("Mở buổi học", "Vào lớp học") |
| `secondary` | viền 1px, nền trắng | nút phụ ("Tạo lớp", "Làm bài", "Mở sổ học phí") |
| `ghost` | chỉ chữ xám | hành động nhẹ ("Xem 7 lớp", "Tất cả") |
Ngoài ra `danger` (viền, chữ đỏ), `danger-solid` (hộp xác nhận). Props: `variant`, `size` (`md`|`lg`), `leading`, `trailing`, `loading` + `loadingLabel` (không vòng xoay, đổi chữ), `block`. Với liên kết: `<Link className={kinButtonClass("secondary")}>`.
```tsx
<KinButton>Mở buổi học</KinButton>
<KinButton variant="secondary" loading loadingLabel="Đang lưu…">Lưu</KinButton>
```

## Trạng thái — `KinStatus`, `KinGradeStatus` (Status.tsx)
HÌNH 16px + CHỮ (màu không nói một mình; SCL-G-0 21/11/2026 thay chấm 7px bằng hình theo QUYET-DINH-GIAO-DIEN §3.6). Props: `tone` = `xong` (xanh lá) | `cho` (cam) | `loi` (đỏ, lỗi) | `qua-han` (đỏ đậm `--kin-tt-chu-loi-dam`, chữ đậm) | `mo` (trung tính, chữ `--kin-chu-phu`), `shape?` đổi hình khi cùng tone hai nghĩa, `children` là chữ.
| Hình (`shape`) | Nghĩa | Tone mặc định dùng |
|---|---|---|
| `chua` vòng nét đứt | chưa có gì | `mo` |
| `qua-han` vòng đứt + "!" | quá hạn | `qua-han` |
| `nua` nửa tô | đã nộp, chờ chấm | `cho` |
| `ba-phan-tu` tô 3/4 | có điểm, chờ duyệt | — (truyền `shape`) |
| `kin` tô kín + ✓ | xong | `xong` |
| `loi` tô kín + "!" | lỗi | `loi` |
**Đỏ chỉ cho lỗi và quá hạn.** Nhãn bài/điểm dùng chung — đừng tự viết chữ: `<KinGradeStatus state="chua-nop|qua-han|cho-cham|cho-duyet|da-nop|da-cham">` (chữ "Chưa nộp / Quá hạn / Chờ chấm / Chờ duyệt / Đã nộp / Đã chấm", `children` thay chữ khi cần thêm điểm). Bảng `GRADE_STATUS` cho chỗ cần chữ/tone mà không cần thẻ. `KinStatusIcon` là riêng hình (ô sổ điểm).
```tsx
<KinStatus tone="cho">Cần nhắc</KinStatus>
<KinGradeStatus state="qua-han" />
<KinGradeStatus state="cho-duyet">Chờ duyệt · 7,5</KinGradeStatus>
```

## Số liệu — `KinStat`, `KinStatRow` (Stat.tsx)
Nhãn nhỏ xám, số 22px, dòng phụ. `KinStatRow` xếp ô: 4 cột máy tính, 2 cột điện thoại, kẻ mảnh trên/dưới.
```tsx
<KinStatRow>
  <KinStat label="Lớp đang quản lý" value="7 lớp" hint="8 học sinh đang học" />
  <KinStat label="Lịch hôm nay" value="19:00" hint="Toán 9 · 2 học sinh" />
</KinStatRow>
```

## Đầu mục — `KinSectionHead` (SectionHead.tsx)
Tiêu đề 18px trái, `aside` phải (phụ đề hoặc liên kết), kẻ mảnh dưới. Props: `title`, `aside?`, `as?` (`h1`|`h2`|`h3`, mặc định `h2`), `id?`.
```tsx
<KinSectionHead title="Cần cô xử lý" aside="3 việc" />
```

## Dòng danh sách — `KinListRow` (ListRow.tsx)
Không khung, kẻ mảnh đáy. Props: `title`, `sub?` (dòng phụ), `status?` (thường `<KinStatus>`), `aside?` (cột phải căn giữa: "Nộp 4/12", KinStatus, điểm), `trailing?` (mốc giờ hoặc nút, sát trên), `href?` (cả dòng là liên kết), `current?` (hàng đang chọn: nền nhạt + `aria-current`), `size?` (`md` mặc định | `lg` = hàng 56px của trang lớp: tiêu đề 16px, dòng phụ 14px `--kin-chu-phu`).
**Tiêu đề xuống dòng, không bao giờ cắt "…"** (từ quá dài bẻ giữa từ). Đừng thêm `truncate` vào `title`.
```tsx
<KinListRow title="Đỗ Hà xin nghỉ buổi Toán 9 tối nay" sub="Báo lúc 18:15 · trước buổi học 45 phút"
  status={<KinStatus tone="cho">Quyết định học phí và học bù</KinStatus>} trailing="18:15" href="/lop-cua-toi/..." />
<KinListRow size="lg" title="05 · Hệ phương trình bậc nhất" sub="Video 42 phút · 2 tài liệu" aside={<><span>Nộp 4/12</span><KinGradeStatus state="cho-cham" /></>} href="…" />
```

## Hộp thoại — `KinDialog` (Dialog.tsx)
SCL-G-0. Mọi hộp không phải câu hỏi Có/Không (câu đó dùng `KinConfirm`). Escape đóng, Tab xoay vòng trong hộp, khoá cuộn, trả tiêu điểm khi đóng (`useModalDialog`); nút "Đóng" có chữ; điện thoại là tờ dưới, máy tính là hộp giữa. Props: `open`, `title`, `onClose`, `children`, `footer?` (tối đa một nút chính), `size?` (`md` 480px | `lg` 640px). Hiện ra mờ dần + trượt 8px 180ms, tắt dưới `prefers-reduced-motion`.
```tsx
<KinDialog open={o} title="Gắn link YouTube" onClose={close} footer={<KinButton onClick={save}>Lưu</KinButton>}>…</KinDialog>
```

## Khối nhắc — `KinCallout` (Callout.tsx)
Nền nhạt, vạch trái mảnh, không bóng. Props: `title?`, `children`, `tone` (`nhat` mặc định | `nhan` = nền xanh nhạt, dùng cho "Buổi học hôm nay" trên điện thoại).
```tsx
<KinCallout title="Báo cáo Gia Bảo được chia sẻ">Phụ huynh chưa mở báo cáo tuần này.</KinCallout>
```

## Trạng thái rỗng — `KinEmptyState` (EmptyState.tsx)
Luôn có câu giải thích vì sao trống; `action?` là một nút/liên kết làm tiếp. Props: `title`, `children`, `action?`. Không viết "đang phát triển".
```tsx
<KinEmptyState title="Chưa có lớp nào" action={<Link className={kinButtonClass()} href="/lop-cua-toi/lop">Tạo lớp</Link>}>
  Tạo lớp đầu tiên để mời học sinh vào.
</KinEmptyState>
```

## Khung dùng chung — `KinPanel` (Panel.tsx, kiểu dáng `.kin-khung` trong `src/app/kin-site.css`)
Thêm 24/10/2026 theo yêu cầu "một số cái quan trọng đóng thêm khung cho dễ nhìn": màn dựng phẳng (chỉ đường kẻ) khiến khối quan trọng khó tách khỏi nền. MỘT kiểu khung cho cả KiN, dùng CHỌN LỌC.
Kiểu: nền mặt `--kin-khung-nen` (= `--kin-nen-bang`) + viền 1px `--kin-khung-vien` (chữ mờ pha 24% vào nền trang: đủ thấy ở sáng lẫn tối, nhạt hơn viền ô nhập) + bo `--kin-bo-the` (14px) + đệm 18px (điện thoại) / 20px (từ md). Token khai ở `kin-site.css`, không mã hex; đổi chủ đề / sáng-tối tự theo.
| `variant` | Hình | Dùng cho |
|---|---|---|
| `mac-dinh` | viền nhạt, nền mặt | ô tóm tắt, thẻ đề thi, lưu ý pháp lý, thẻ gia sư |
| `nhan` | viền + nền màu nhấn nhạt của chủ đề | khối CHÍNH của màn: "Buổi học sắp tới", khối chấm đang chọn, ô cách tính học phí, cổng QR |
| `canh-bao` | nền + viền cam nhạt | việc đang chờ (vd. hồ sơ gia sư chờ duyệt); luôn kèm chữ |
| `loi` | nền + viền đỏ nhạt | lỗi cần chú ý (kèm chữ) |
| `khoa-pro` | viền nét đứt, nền trong | tính năng Pro chưa mở ("Chưa mở bán"); chữ KHÔNG bị làm mờ |
Props: `variant`, `flush` (không đệm, cắt góc bo: dùng khi bọc CẢ danh sách/bảng — hàng cuối tự bỏ kẻ đáy), `as` (`div` mặc định, `section`/`aside`/`article`), `className` (chỉ margin/layout; đệm đặt bằng `flush` hay `!p-4`), mọi thuộc tính khác (aria-*, data-*) chuyển xuống thẻ.
Dải số: `<KinStatRow boxed>` = mỗi số một ô khung (không kẻ trên/dưới); không `boxed` vẫn là dải phẳng cũ.
Quy tắc dùng:
- Mỗi màn vài khối: dải số, khối chính, ô tóm tắt, thẻ trạng thái quan trọng, lưu ý pháp lý. KHÔNG bọc từng hàng.
- Danh sách dài (hàng việc, bảng, lịch) giữ đường kẻ mảnh; chỉ bọc cả danh sách bằng `flush` khi hợp lý. Đầu mục (`KinSectionHead`) để ngoài khung, cách khung 16px (`mt-4`).
- Không khung lồng khung; khoảng cách giữa các khung dùng nhịp của trang (gap 12–16px trong dải, 32px giữa các mục).
- Không làm thu hẹp chữ/độ rộng nội dung: hàng bên trong `flush` giữ đệm ngang riêng của chúng.
```tsx
<KinStatRow boxed><KinStat label="Số phiếu" value="9" /> … </KinStatRow>
<KinSectionHead title="Cần cô xử lý" aside="13 việc" />
<KinPanel flush className="mt-4"><ul>{rows.map(r => <li key={r.id}><KinListRow … /></li>)}</ul></KinPanel>
<KinPanel variant="nhan"><p>16:00 – 17:30</p> … <Link className={kinButtonClass("primary")}>Mở buổi học</Link></KinPanel>
```
Đã áp: Hộp việc (dải 4 số, hàng việc, buổi sắp tới, ô học phí điện thoại, lưu ý), Gói của tôi (dải số, thanh x/N, bảng so sánh, thẻ kỳ, "Chưa mở bán", khối hết hạn), Học phí (dải số), Lớp (cả bảng), Chi tiết lớp (Học sinh, Lịch sử buổi, ô cách tính học phí), Bài tập (từng nhóm lớp, khối đang chọn), Chấm quiz (dải số, hộp giữ/công bố điểm, khối điểm đang chọn), học sinh (Cần làm, Đã nộp, Kết quả, Buổi học tiếp theo, đề thi sắp mở, danh sách đề), phụ huynh (4 ô tóm tắt Sổ của con, thẻ phiếu học phí, trang phiếu), khách (thẻ gia sư), quản trị (dải số của Số đo). Thẻ cũ dùng `CARD_STYLE` (tutor/shared.tsx) cũng đổi viền sang `--kin-khung-vien` cho cùng một độ đậm.

## Quy tắc chung (SCL-G-0, QUYET-DINH-GIAO-DIEN §3.1–3.3 và phần I)
- **Mọi nút và liên kết dạng nút đi qua `KinButton` / `kinButtonClass(variant)`**; mỗi màn ĐÚNG MỘT `primary` (nút chính điện thoại ≥ 48px: `size="lg"`). Không tự tô `bg-[var(--kin-nhan-nen)]` lên `<button>`.
- Màu chỉ token `--kin-*`. Token mới của đợt: `--kin-tt-chu-loi-dam` (chữ "Quá hạn": 6,47:1 trên trắng, 5,61:1 trên `--kin-tt-nen-loi`; tối `#fca5a5` 10,18:1 / 9,21:1), `--kin-cao-thanh-duoi` (64px: thanh dưới, dock, đệm đáy thân trang). Vạch màu lớp dùng `--kin-lop-NN` có sẵn (trang trí, không mang chữ — không cần 4,5:1); thẻ "Cần làm" nền `--kin-nen-trang` + viền trái 4px màu trạng thái: không cần token mới.
- Ô nhập trên điện thoại (< 768px) tự lên 16px (`kin-site.css`, chống Safari phóng to); ô cố ý to hơn (CodeBoxes, cỡ tiêu đề/số) giữ cỡ.
- Mỗi vỏ (học sinh, gia sư, quản trị) có liên kết "Bỏ qua tới nội dung" là phần tử Tab đầu tiên (`shell/SkipLink.tsx`: `KinSkipLink` đầu vỏ, `KinSkipTarget` ngay trước nội dung trang). Thanh bên giữ vị trí trước nội dung trong DOM (khớp thứ tự nhìn — WCAG 2.4.3); liên kết bỏ qua là lối tắt qua nó.
- Chữ thông tin ≥ 14px; 12px chỉ cho nhãn phụ không mang thông tin chính. Tiêu đề xuống dòng, không cắt "…" (tên tệp được cắt giữa, giữ đuôi).
- Chuyển động: chỉ CSS `transition`/`animation` trên `transform`/`opacity` 150–200ms, tắt dưới `prefers-reduced-motion`; không gsap/lenis, không animate `height`.

## Đã có từ trước (cùng thư mục)
`KinInput`, `KinTabs`, `KinToast`, `KinConfirm` + `useKinConfirm` (thay `window.confirm`), `KinLoader`, `KinFold`, `KinLogo`, `KinCopyButton`, `KinSubmitButton`, `CodeBoxes`, `ProgressRing`.

## Vỏ (`src/components/kin/shell/`)
- `ModuleRail`: thanh bên RỘNG 272px theo nhóm (mặc định từ 25/10/2026, Figma "Điều hướng"; chi tiết ở `thanh-ben-trai.md` mục 9) hoặc hẹp 79px (logo KiN đầu thanh, nhãn "Miễn phí ra mắt" chân thanh) + thanh dưới 60px trên điện thoại (các tab xám bo góc, mục đang chọn nền xanh nhạt, số đỏ có nhãn chữ). Cờ `desktopOnly` / `mobileOnly` trên `ModuleItem` chọn mục nào hiện ở đâu.
- `AccountMenu`: "Tên ⌄" ở dải trên; prop `onOpenMore` thêm mục "Tất cả mục" (chỉ điện thoại) mở bảng "Khác" vì thanh dưới chỉ có 4 tab.
- `TopDate`: "Thứ Sáu, 23/10/2026" theo giờ VN (`vnDateKeyOf`), chỉ máy tính.
- Dải trên cao 68px máy tính / 48px điện thoại (`--kin-top` đặt ở vỏ).
