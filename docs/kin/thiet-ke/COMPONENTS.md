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

## Trạng thái — `KinStatus` (Status.tsx)
Chấm 7px + CHỮ (màu không nói một mình). Props: `tone` = `xong` (xanh lá) | `cho` (cam) | `loi` (đỏ) | `mo` (xám trung tính), `children` là chữ.
```tsx
<KinStatus tone="cho">Chưa nộp</KinStatus>
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
Không khung, kẻ mảnh đáy. Props: `title`, `sub?` (dòng phụ xám), `status?` (thường `<KinStatus>`), `trailing?` (mốc giờ hoặc nút), `href?` (cả dòng là liên kết).
```tsx
<KinListRow title="Đỗ Hà xin nghỉ buổi Toán 9 tối nay" sub="Báo lúc 18:15 · trước buổi học 45 phút"
  status={<KinStatus tone="cho">Quyết định học phí và học bù</KinStatus>} trailing="18:15" href="/lop-cua-toi/..." />
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

## Đã có từ trước (cùng thư mục)
`KinInput`, `KinTabs`, `KinToast`, `KinConfirm` + `useKinConfirm` (thay `window.confirm`), `KinLoader`, `KinFold`, `KinLogo`, `KinCopyButton`, `KinSubmitButton`, `CodeBoxes`, `ProgressRing`.

## Vỏ (`src/components/kin/shell/`)
- `ModuleRail`: thanh bên RỘNG 272px theo nhóm (mặc định từ 25/10/2026, Figma "Điều hướng"; chi tiết ở `thanh-ben-trai.md` mục 9) hoặc hẹp 79px (logo KiN đầu thanh, nhãn "Miễn phí ra mắt" chân thanh) + thanh dưới 60px trên điện thoại (các tab xám bo góc, mục đang chọn nền xanh nhạt, số đỏ có nhãn chữ). Cờ `desktopOnly` / `mobileOnly` trên `ModuleItem` chọn mục nào hiện ở đâu.
- `AccountMenu`: "Tên ⌄" ở dải trên; prop `onOpenMore` thêm mục "Tất cả mục" (chỉ điện thoại) mở bảng "Khác" vì thanh dưới chỉ có 4 tab.
- `TopDate`: "Thứ Sáu, 23/10/2026" theo giờ VN (`vnDateKeyOf`), chỉ máy tính.
- Dải trên cao 68px máy tính / 48px điện thoại (`--kin-top` đặt ở vỏ).
