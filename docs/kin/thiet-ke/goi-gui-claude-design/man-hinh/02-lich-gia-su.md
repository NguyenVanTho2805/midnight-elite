# Lịch của gia sư

Route: `/lop-cua-toi/lich` · Tệp mã chính: `src/app/lop-cua-toi/(tutor)/lich/LichClient.tsx` (trang bọc `page.tsx` chỉ kiểm quyền) · Vai: **gia sư** (`role = admin` và `adminRole = teacher`). Học viên mở thì bị chuyển về `/lop-cua-toi`; khách chưa đăng nhập bị chuyển sang `/dang-nhap?redirect=/lop-cua-toi/lich`.

> Cách đọc tệp này: bạn không đọc được mã, nên mọi chữ trong dấu nháy kép "…" là **chuỗi thật trong mã hoặc trong bài test**, chép đúng từng ký tự (kể cả dấu, dấu gạch dài "—", mũi tên "←" "→"). Chỗ nào tôi suy đoán thì ghi rõ "(suy ra từ mã, chưa chạy thử)". Việc chưa quyết được nằm ở mục 12. Bản này đã được người kiểm chứng độc lập đối chiếu lại từng khẳng định với mã (`LichClient.tsx`, `src/lib/*`, `src/app/api/tutor/*`, `Modal`/`KinButton`/`KinStatus`, `kin-tokens.css`) và với các tệp test trong `tools/local-e2e/` ngày 22/10/2026 (đọc mã và test, không chạy trình duyệt thật); chỗ nào sai đã sửa tại chỗ.

Phạm vi màn: **chỉ phần nội dung bên phải** của vỏ Outlook (thanh module trái 79px trên máy tính, thanh dưới 60px trên điện thoại, dải trên 48px). Không thiết kế lại vỏ. Màn này mở ra: gửi lịch tuần cho một lớp, nhắc lịch từng buổi qua Zalo, xử lý "báo nghỉ sát giờ", dời / huỷ buổi, soạn kế hoạch buổi. **Không có số tiền nào trên màn này** và không được thêm.

---

## 1. Mục đích và người dùng

- **Người dùng:** Cô Lan (gia sư tự do, 7 lớp, 8 học viên), mở trên **điện thoại** là chính, thường 1 tay, thường giữa hai buổi dạy. Khi Hộp việc đang tắt (chế độ gọn mặc định), **Lịch là màn đầu tiên sau đăng nhập** (`/lop-cua-toi` tự chuyển sang `/lop-cua-toi/lich`; test `ui-tutor-shell.ts`, `ui-journey-new-tutor.ts`). Vì vậy đây là màn dùng nhiều nhất trong ngày.
- **Màn trả lời bốn câu hỏi, đúng thứ tự:** (1) hôm nay / tuần này tôi dạy gì, giờ nào; (2) có buổi nào đang cần tôi ra tay (báo nghỉ sát giờ, tin nhắc tới hạn chưa gửi); (3) tôi cần đổi lịch một buổi (dời, huỷ) và báo lớp thế nào; (4) tôi muốn gửi cả tuần cho một lớp.
- **Nguyên tắc sản phẩm quyết định cả màn:** KiN **không gửi tin giúp**. KiN soạn sẵn tin, gia sư sửa được, rồi KiN chỉ *mở Zalo* (hoặc bảng chia sẻ của điện thoại); gia sư tự bấm gửi. KiN chỉ biết "đã mở Zalo lúc …", không bao giờ biết tin có đi thật. Vì thế giao diện **không bao giờ được viết "đã gửi"** (bài test cấm chữ đó trên cả trang, xem mục 7).
- **Một buổi học không có bản ghi riêng.** Buổi = (khung giờ hằng tuần của lớp, một ngày cụ thể). Gia sư không "tạo buổi" ở màn này; buổi sinh ra từ khung giờ đặt ở tab "Lịch học" của trang quản khoá. Màn này chỉ *xem* và *đổi* từng buổi.

## 2. Việc người dùng làm ở màn này (theo thứ tự quan trọng)

1. **Nhìn nhanh buổi của hôm nay và tuần này** (giờ, lớp, còn bao lâu nữa / đã xong chưa).
2. **Xử lý báo nghỉ sát giờ** bằng một nút: "Không tính phí, giữ 1 buổi bù" hoặc "Tính phí buổi này", rồi nhắn phụ huynh qua Zalo.
3. **Gửi tin nhắc lịch** đã tới hạn (24 giờ, 1 giờ trước giờ học) cho từng phụ huynh / học sinh, hoặc **nhắc cả lớp vào nhóm Zalo** một lần.
4. **Dời hoặc huỷ một buổi chưa bắt đầu**, rồi báo lớp qua Zalo; hoặc **khôi phục** buổi về lịch tuần.
5. **Gửi lịch tuần của một lớp** vào nhóm Zalo của lớp đó.
6. **Chuyển tuần** (tuần trước, tuần này, tuần sau) và nhảy tới một ngày trong tuần.
7. Phụ: mở **link vào lớp**, mở **"Soạn kế hoạch buổi này"** (sang màn Kế hoạch buổi), chép tin.

---

## 3. Dữ liệu hiển thị

Nguồn chung: `GET /api/tutor/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD` (`src/app/api/tutor/schedule/route.ts`) trả `{ from, to, now, occurrences[], channels, counters }`. `occurrences` do `loadTutorSchedule` (`src/lib/reminderServer.ts`) dựng; quy tắc thuần ở `src/lib/classSessions.ts` và `src/lib/sessionChange.ts`. Giờ luôn là **giờ Việt Nam (UTC+7), 24 giờ**; tuần **bắt đầu Thứ Hai**.

### 3.1 Phần đầu trang và điều khiển tuần

| Tên hiển thị | Nguồn trong mã (tệp + trường/hàm) | Định dạng | Ví dụ |
|---|---|---|---|
| Tiêu đề trang | `LichClient.tsx` (chữ cố định) | "Lịch" (h1) | Lịch |
| Khoảng tuần đang xem | state `from` + `addDaysKey(from, 6)` (`classSessions.ts`) | "Tuần dd/mm – dd/mm" (gạch ngang giữa có khoảng trắng hai bên), `aria-live="polite"` | Tuần 19/10 – 25/10 |
| Ba nút chuyển tuần | chữ cố định | "← Tuần trước", "Tuần này", "Tuần sau →"; "Tuần này" **bị khoá** khi đang xem tuần hiện tại | ← Tuần trước · Tuần này · Tuần sau → |
| Dải 7 ngày: nhãn thứ | `WEEKDAY_SHORT` | T2 T3 T4 T5 T6 T7 CN | T6 |
| Dải 7 ngày: số ngày | `k.slice(8,10)` của `dateKey` | 2 chữ số | 23 |
| Dải 7 ngày: có buổi | `occByDay(k)` lọc `status !== "cancelled"`, đếm | chấm nhỏ nếu số buổi > 0 (buổi đã huỷ **không** được đếm) | chấm |
| Dải 7 ngày: nhãn đọc cho người khiếm thị | `aria-label` | "{Thứ} dd/mm, {n} buổi" (+ ", hôm nay" nếu đúng hôm nay); ngày không có buổi: "{Thứ} dd/mm, không có buổi". Không có test nào kiểm nhãn này | Thứ Năm 22/10, 2 buổi, hôm nay |
| Dấu "hôm nay" | `todayKey = vnDateKeyOf(new Date())` (đồng hồ máy người dùng quy ra ngày VN) | Ở dải 7 ngày: ô hôm nay **tô đặc, không có chữ "Hôm nay"** (chữ chỉ nằm trong `aria-label`). Chip chữ **"Hôm nay"** chỉ có cạnh tiêu đề ngày (nằm trong chính h2); test tìm chip này | Hôm nay |

### 3.2 Thanh "Gửi lịch tuần qua Zalo" (NC2-024)

| Tên hiển thị | Nguồn | Định dạng | Ví dụ |
|---|---|---|---|
| Ô chọn "Lớp" | `coursesInWeek(data.occurrences)` (`weeklyScheduleMessage.ts`): mỗi lớp **có buổi trong tuần đang xem** một lần, theo thứ tự xuất hiện đầu tiên. Chỉ hiện khi có **từ 2 lớp trở lên** | `<select>` tên lớp | Toán 9 |
| Câu mặc định | chữ cố định + `from` | "Tin lịch tuần dd/mm – dd/mm của một lớp, không tên em. KiN không gửi giúp." | Tin lịch tuần 19/10 – 25/10 của một lớp, không tên em. KiN không gửi giúp. |
| Câu khi tuần rỗng | chữ cố định | "Tuần này chưa có buổi nào để gửi lịch. Chuyển sang tuần có buổi học để gửi." | — |
| Câu sau khi mở Zalo | state `weekOpened["mã lớp" + "đầu tuần"]`, giờ lấy từ đồng hồ máy | "Đã mở Zalo lúc HH:mm". **Chỉ nhớ trong phiên**, tải lại trang là mất (mã ghi rõ: chưa có chỗ lưu riêng cho lịch tuần) | Đã mở Zalo lúc 14:05 |
| Nội dung tin lịch tuần (trong hộp) | `buildWeeklyScheduleMessage` (`weeklyScheduleMessage.ts`) | nhiều dòng, xem mẫu ở mục 11 | — |

### 3.3 Danh sách buổi, nhóm theo ngày

| Tên hiển thị | Nguồn | Định dạng | Ví dụ |
|---|---|---|---|
| Tiêu đề ngày (h2) | `WEEKDAY[dayOfWeekOfKey(k)]` + `ddmm(k)`; chỉ hiện ngày **có buổi** (kể cả buổi huỷ) | "Thứ Hai dd/mm" (thứ viết hoa: "Chủ nhật", "Thứ Hai"…) | Thứ Sáu 23/10 |
| Giờ buổi | `occ.startAt`, `occ.endAt` (ISO → giờ VN) | "HH:mm–HH:mm" (gạch ngang ngắn "–"), số đậm, `tabular-nums` | 19:00–20:30 |
| Tên lớp | `occ.courseName` (từ `Course.name`) | chữ, tự xuống dòng (`break-words`) | Toán 9 |
| Vạch màu lớp bên trái | `classAccent(occ.courseId)` (`src/lib/classColor.ts`): một trong 5 token `--kin-th-xanh-troi`, `--kin-th-bac-ha`, `--kin-th-vang-nang`, `--kin-th-xanh-link`, `--kin-ph-hub`; buổi huỷ dùng `--kin-tt-cham-trung-tinh` | vạch 3px | — |
| Số học viên | `occ.students.length` (học viên **đang học** lớp; không trừ em đã báo nghỉ) | "{n} học viên" | 2 học viên |
| Trạng thái buổi (chữ + chấm) | suy ra ở `OccurrenceCard`: `status === "cancelled"` → "buổi đã huỷ"; `endAt < data.now` → "đã kết thúc"; `occ.started` → "đang diễn ra"; còn lại "sắp tới" | chữ nhỏ + chấm 8px: huỷ = `--kin-tt-cham-trung-tinh`, đã kết thúc = `--kin-tt-cham-xong`, đang diễn ra = `--kin-tt-cham-cho`, sắp tới = `--kin-th-xanh-link` | 2 học viên · sắp tới |
| "dời từ …" | `occ.movedFrom` (`dateKey`, `startAt`) | " · dời từ Thứ Sáu 23/10 19:00" nối sau trạng thái | · dời từ Thứ Sáu 23/10 19:00 |
| Huy hiệu "Đã huỷ" | `occ.status === "cancelled"` | huy hiệu trung tính | Đã huỷ |
| Huy hiệu "Đã dời" | `occ.status === "moved"` | huy hiệu trung tính | Đã dời |
| Huy hiệu báo nghỉ chờ xử lý | `occ.pendingAbsences` (số em có báo nghỉ trạng thái `pending`; = 0 nếu buổi huỷ) | "{n} báo nghỉ sát giờ", tông **đỏ** (`bad`) | 1 báo nghỉ sát giờ |
| Huy hiệu tin nhắc chờ gửi | `occ.remindersDue` (số tin `due` và chưa `openedAt`) | "{n} tin nhắc chờ gửi", tông **cam** (`wait`) | 2 tin nhắc chờ gửi |
| Mũi tên mở/đóng | `expanded` | "▸" đóng, "▾" mở (`aria-hidden`) | ▸ |

Mọi "huy hiệu" ở màn này là `Badge` → `KinStatus` (`src/components/kin/Status.tsx`): **chấm tròn 7px + chữ**, cao 16px, **một huy hiệu không xuống dòng** (`whitespace-nowrap`). Chữ dùng bộ mã `--kin-tt-chu-*` (4,5:1), chấm dùng `--kin-tt-cham-*` (3:1); riêng tông đỏ dùng `--kin-tt-chu-loi` cho cả chấm lẫn chữ. Khi xếp nhiều huy hiệu trên một dòng, được phép xuống dòng **giữa** các huy hiệu, không được cắt trong một huy hiệu.

### 3.4 Chi tiết một buổi (khi mở thẻ)

| Tên hiển thị | Nguồn | Định dạng | Ví dụ |
|---|---|---|---|
| Link vào lớp | `occ.joinUrl` (`ClassSchedule.joinUrl`) | "Link vào lớp: {link}" (mở tab mới, `rel="noopener noreferrer"`); trống thì: "Chưa có link vào lớp. Thêm ở tab Lịch học để tin nhắc có link." ("Lịch học" là liên kết tới `/admin/khoa-hoc/{courseId}?tab=lich-hoc`) | https://meet.google.com/abc-defg-hij |
| Liên kết kế hoạch buổi | `occ.courseId`, `occ.dateKey` (ngày **hiệu lực**) | "Soạn kế hoạch buổi này" + chú thích "4 hoạt động, ra bản gia sư và phiếu học sinh." → `/lop-cua-toi/ke-hoach-buoi?courseId={id}&date={YYYY-MM-DD}` | — |
| Tên em có báo nghỉ | `occ.students[].name`, `.absence` | tên đậm | Đỗ Hà |
| Nhãn trạng thái báo nghỉ | `ABSENCE_LABEL[absence.status]` (hoặc `resolved[id].status` nếu vừa xử lý trong phiên) | huy hiệu; bảng chữ ở mục 6.4 | Báo nghỉ sát giờ — chờ bạn xử lý |
| Báo trước bao lâu + lý do | `absence.leadMinutes` qua `describeLead`; `absence.reason` | "báo trước 40 phút" hoặc "báo trước 1 giờ 5 phút"; nếu có lý do nối " · Lý do: …" | báo trước 40 phút · Lý do: Con bị sốt |
| Tin nhắn gửi phụ huynh sau khi xử lý báo nghỉ | `resolved[id].message` ← API `PATCH /api/tutor/absences/{id}` (`buildAbsenceFreeMessage` / `buildAbsenceChargedMessage`, `classSessions.ts`) | đoạn chữ nhiều dòng trong khung nhạt | xem mục 11. **Chỉ có trong phiên**: tải lại trang là mất tin và nút "Nhắn phụ huynh qua Zalo" |
| Kế hoạch nhắc | `occ.plan` (`h24DueAt`, `h24Shifted`, `h1DueAt`, `h1SkipReason`, `absenceDeadlineAt`) | một đoạn gồm 3 mốc; xem mục 5 và 6.3 | Nhắc 24 giờ: 19:00 ngày 22/10 · Nhắc 1 giờ: 18:00 ngày 23/10 · Hạn báo nghỉ giữ buổi bù: 17:00 ngày 23/10 |
| Mỗi em: tin nhắc | `occ.students[].reminders[]` (`recipient` parent/student, `kind` h24/h1, `due`, `openedAt`, `phone`, `message`). Chỉ có dòng khi tin **đã tới hạn** hoặc **đã từng mở Zalo**; em đã báo nghỉ thì **không có** tin; buổi huỷ không có tin; bên nào bị tắt kênh nhắc (cài đặt cá nhân `reminderChannels`) thì không có tin cho bên đó | "Nhắc 24 giờ · phụ huynh" / "Nhắc 1 giờ · học sinh" + (nếu đã mở) "Đã mở Zalo lúc HH:mm" | Nhắc 24 giờ · phụ huynh |
| Thông tin đã đổi lịch | `occ.change` (`id`, `kind`, `reason`, `zaloOpenedAt`) | "Buổi này đã huỷ" hoặc "Buổi này đã dời" + " — lý do: …" + "Đã mở Zalo báo lớp lúc HH:mm" hoặc "Chưa mở Zalo để báo lớp." | Buổi này đã huỷ — lý do: Cô ốm. Chưa mở Zalo để báo lớp. |
| Nhóm Zalo của lớp | `occ.zaloGroupUrl` (`Course.zaloGroupUrl`) | có: "Đã gắn nhóm Zalo của lớp."; chưa: "Chưa gắn nhóm Zalo — thêm ở Cài đặt → Kết nối." | Chỉ hiện cạnh nút "Nhắc cả lớp trong nhóm Zalo" (buổi chưa bắt đầu, chưa huỷ), nối thêm " Tin chung, không tên em." |

### 3.5 Có trong dữ liệu nhưng giao diện hiện tại KHÔNG hiện (xem mục 12)

- `occ.note` (ghi chú của khung giờ, `ClassSchedule.note`): đã có trong API, `LichClient` không dùng.
- `data.counters` (`pendingAbsences`, `remindersDue`, `makeupExpiring`): màn Lịch không vẽ; **số đỏ trên mục "Lịch" của thanh module** do vỏ gia sư tính từ cùng nguồn (`LopCuaToiFrame.tsx`: `pendingAbsences + remindersDue`, **không** cộng `makeupExpiring`; test `ui-schedule.ts`: bằng số báo nghỉ chờ + số tin nhắc tới hạn). Số này đếm **mọi** báo nghỉ chờ của gia sư và chỉ các tin nhắc của hôm nay + 2 ngày kế, **không phụ thuộc tuần đang xem**, và chỉ hiện trên mục "Lịch" khi Hộp việc đang tắt.
- `data.channels` (`{parent, student}`, bật/tắt kênh nhắc): có trong API, không hiện.

---

## 4. Bố cục đề xuất

Tinh thần: **thoáng, ít dòng, ít khung, ít màu.** Bỏ khung thẻ viền bao quanh từng buổi; dùng **đường kẻ mảnh** (`--kin-vien-nhat`) giữa các buổi và giữ **vạch màu lớp 3px** bên trái làm dấu nhận diện duy nhất. Số liệu = giờ (to nhất), tên lớp (thứ hai); mọi thứ khác nhỏ và nhạt. Chỉ **một** thứ có màu nghĩa trên một dòng buổi: huy hiệu "cần xử lý". Trạng thái "sắp tới / đã kết thúc" chỉ là chữ xám, không chấm.

### 4.1 Điện thoại 390px (một cột, gutter 16px)

Từ trên xuống:

1. **Dòng tiêu đề (cao ~56px).** Trái: "Lịch" (h1) và dưới nó một dòng nhỏ "Tuần 19/10 – 25/10" (tối đa 1 dòng, không cắt). Không có gì ở bên phải (để nhường chỗ cho thanh tuần).
2. **Thanh chuyển tuần, một hàng, 3 nút bằng nhau, cao 44px:** "← Tuần trước" · "Tuần này" · "Tuần sau →". Cả ba là nút viền (secondary); "Tuần này" mờ (khoá) khi đã ở tuần này. Giữ nguyên chữ (test bấm theo tên). Ba nút chiếm trọn chiều ngang, không xuống dòng.
3. **Dải 7 ngày (cao 56px, 7 ô chia đều, khoảng cách 4px).** Mỗi ô: thứ (T2…CN, 11px), số ngày (đậm), một chấm nhỏ dưới nếu có buổi. Hôm nay tô đặc (`--kin-nhan-nen`, chữ `--kin-nhan-chu-tren-nen`). Bấm ô có buổi: cuộn tới đúng ngày. Ô không có buổi: nhạt, không bấm được. **Không** chữ "Hôm nay" ở đây (tô đặc đã đủ nói).
4. **Thanh gửi lịch tuần, một hàng gọn (cao 44px), nền trong, không viền:** nếu có ≥ 2 lớp: ô chọn lớp chiếm ~55% chiều ngang; nút "Gửi lịch tuần qua Zalo" (viền, secondary) chiếm phần còn lại. Nếu chỉ 1 lớp: chỉ có nút, rộng đủ chữ. **Câu giải thích rút còn một dòng xám nhỏ** bên dưới ("Tin chung cho cả lớp, không tên em. KiN không gửi giúp."); câu dài hiện tại để dành trong hộp tin. Đây là nút phụ, **không** dùng màu đặc.
5. **Danh sách theo ngày.** Mỗi ngày: tiêu đề h2 "Thứ Sáu 23/10" (12–13px, đậm, màu chữ chính) + chip "Hôm nay" nếu đúng hôm nay; cách phần trên 24px. Dưới là các buổi, **mỗi buổi tối đa 3 dòng khi đóng:**
   - Dòng 1: giờ đậm "19:00–20:30" + tên lớp (tự xuống dòng nếu dài, **không cắt "…"**) + mũi tên mở/đóng bên phải.
   - Dòng 2 (chữ xám nhỏ): "2 học viên · sắp tới" (+ " · dời từ Thứ Sáu 23/10 19:00" nếu đã dời; buổi huỷ: "buổi đã huỷ" và tên lớp, giờ gạch ngang).
   - Dòng 3 (chỉ khi có): các huy hiệu cần xử lý **xếp ngang dưới tên**, không xếp cột bên phải (để tên lớp không bị ép): "1 báo nghỉ sát giờ" (đỏ), "2 tin nhắc chờ gửi" (cam), "Đã huỷ" / "Đã dời" (trung tính).
   - Cả dòng bấm được, cao tối thiểu 44px (thực tế ≥ 56px vì có 2 dòng chữ).
6. **Khi mở một buổi** (mở tại chỗ, đẩy các buổi dưới xuống; chỉ một buổi mở một lúc, như hiện tại), thứ tự đề xuất **theo độ gấp** (khác thứ tự hiện tại, xem mục 9):
   1. Nếu có báo nghỉ chờ: khối "Báo nghỉ" với tên em, "báo trước 40 phút · Lý do: …", **một nút chính** "Không tính phí, giữ 1 buổi bù" (đặc, rộng hết chiều ngang) và một nút phụ "Tính phí buổi này" (viền) bên dưới. Hai nút xếp dọc trên điện thoại.
   2. Khối "Nhắc lịch": dòng mốc gọn (xem 6.3); nút "Nhắc cả lớp trong nhóm Zalo" (viền); rồi từng em, mỗi em **một dòng** (xem bên dưới).
   3. Khối "Đổi lịch buổi này": "Dời buổi" (viền) · "Huỷ buổi" (kiểu `danger` của `KinButton`: chữ đỏ, viền; chữ "Huỷ buổi" vẫn là nhãn nên màu không nói một mình), hai nút cạnh nhau cách ≥ 8px. Vì cả hai chỉ **mở hộp xác nhận** (lệnh ghi thật là "Huỷ buổi này" / "Dời buổi" trong hộp) nên không cần tách xa như mẫu 7 ở mục 10 (mẫu đó dành cho nút ghi ngay). Nếu đã đổi: chữ trạng thái + "Báo lớp qua Zalo" (chính) + các nút phụ.
   4. Hàng tiện ích cuối: "Link vào lớp: …" (một dòng; link dài thì cho **cuộn ngang trong dòng**, không cắt "…") và "Soạn kế hoạch buổi này". **Tên truy cập được của chính liên kết phải chứa đủ địa chỉ** — test tìm `getByRole("link", {name: "https://meet.google.com/abc-defg-hij"})`; hiện chữ "Mở link vào lớp" rồi để địa chỉ ở chỗ khác trong DOM là **không đủ** (xem mục 7).
   - Các em: mỗi em một dòng "Trần Gia Bảo" + nút nhỏ-cao-44 "Soạn & mở Zalo"; nếu em có cả tin cho phụ huynh và cho học sinh thì chia hai dòng con có nhãn "phụ huynh" / "học sinh". Em đã báo nghỉ **không có dòng nhắc nào** (mã không tạo tin cho em đó), nên "Đỗ Hà" không xuất hiện ở đây. Không bọc mỗi em trong khung viền riêng; dùng đường kẻ mảnh. **Giữ thứ tự tin trong mỗi em: phụ huynh trước học sinh (trong mỗi bên, 24 giờ trước 1 giờ)** — nút "Soạn & mở Zalo" đầu tiên trên trang phải là một tin gửi **phụ huynh** (`ui-schedule.ts` bấm nút đầu tiên rồi kiểm tin bắt đầu bằng "KiN nhắc lịch: con Em An…" hoặc "Còn 1 giờ nữa là buổi Toán 9 của Em An", và địa chỉ mở ra là `https://zalo.me/0901234567`, số phụ huynh).
7. **Cuối trang:** 24px đệm + vùng an toàn trên thanh module dưới (60px). Không có chân trang.
8. **Hộp thoại (`Modal`, dùng chung nhiều màn):** dưới 640px là tấm **bám đáy màn hình** (bo góc trên, không có hoạt ảnh trượt trong mã); từ 640px là hộp giữa màn hình. Luôn cao tối đa 90% màn hình và cuộn bên trong; nền mờ phía sau; khi mở, ô nhập/nút đầu tiên trong hộp tự được focus; tiêu đề là h2.

**Ngân sách chiều cao phía trên danh sách (để giữ "thoáng"):** theo các số ở mục 1–4 trên 390×844 thì từ đỉnh màn đến tiêu đề ngày đầu tiên khoảng 48 (dải trên của vỏ) + 56 + 44 + 56 + 44 + dòng chú thích ~16 + các khoảng cách ≈ 320px, còn lại ≈ 460px (khoảng 8 dòng buổi đóng, mỗi dòng ≥ 56px) trước thanh module dưới 60px. Đề xuất lấy mức này làm **trần** (số cộng từ các kích thước đã đề xuất ở trên, chưa đo trên bản dựng). Nếu bản vẽ vượt mức này, **cắt theo thứ tự**: bỏ dòng chú thích dưới thanh gửi lịch tuần (câu "KiN không gửi giúp" vẫn còn trong hộp tin), rồi dời thanh gửi lịch tuần xuống **cuối danh sách**; không bỏ dải 7 ngày. (Lưu ý: hiện mã **không tự cuộn tới hôm nay**, xem mục 9 điểm 19, nên giữa tuần các buổi đầu tuần đã qua nằm ngay dưới phần này.)

### 4.2 Máy tính 1280px

- Vỏ giữ nguyên: thanh module trái 79px, dải trên 48px. Nội dung **một cột, rộng tối đa 720px (hiện tại `max-w-3xl` = 768px), căn giữa vùng nội dung**; không kéo giãn hết 1200px vì dòng giờ + tên lớp sẽ trôi xa nhau.
- Hàng đầu: bên trái "Lịch" + dòng tuần; **bên phải cùng hàng**: ba nút chuyển tuần (không phải xuống hàng như bản điện thoại).
- Dải 7 ngày rộng hơn (mỗi ô ~96px), có thể thêm số buổi dưới số ngày ("2 buổi") vì còn chỗ.
- Thanh gửi lịch tuần một hàng: ô chọn lớp, nút, câu giải thích ở bên phải nút.
- Buổi: giờ cố định cột trái rộng ~120px (căn thẳng hàng giữa các buổi), tên lớp và dòng trạng thái ở giữa, huy hiệu cần xử lý **bên phải cùng hàng** (còn đủ chỗ). Khi mở: nội dung chi tiết thụt vào theo cột tên lớp; hai nút xử lý báo nghỉ nằm cạnh nhau.
- Hộp thoại (Modal) hiện ra giữa màn hình, rộng tối đa 448px (hiện tại `sm:max-w-md`), nền mờ phía sau.
- **Không** đề xuất bố cục hai cột (danh sách + khung đọc) cho màn này: test hiện kiểm thẻ buổi là một nút mở tại chỗ có `aria-expanded` (`aria-controls` có trong mã nhưng không test nào của màn này kiểm). Nếu muốn đổi, xem mục 12.

### 4.3 Điều nên nhìn thấy khi chỉ liếc 2 giây

Giờ buổi kế tiếp, tên lớp, và có hay không dấu "cần xử lý" (đỏ/cam). Mọi thứ khác phải lùi xuống xám nhạt.

---

## 5. Hành động

Mọi nút hành động dùng `KinButton` (cao tối thiểu 44px, `--kin-cham-toi-thieu`; ngoại lệ: nút mở/đóng thẻ buổi và hai nút radio của hộp đổi lịch là `<button>` thường, vẫn cao ≥ 44px); **không có vòng xoay chờ** — khi đang xử lý nút bị khoá (`aria-busy`), đổi chữ nếu có `loadingLabel` (màn này không đặt `loadingLabel`, giữ nguyên chữ nút). Phản hồi nhanh dùng toast (`useNotify`: `ok`, `err`, `info`).

| Nhãn nút CHÍNH XÁC | Làm gì | Đi đâu / gọi API nào | Ghi chú quyền hoặc rủi ro |
|---|---|---|---|
| "← Tuần trước" | Lùi 7 ngày, tải lại lịch | `GET /api/tutor/schedule?from={thứ Hai}&to={Chủ nhật}` | Không giới hạn số tuần lùi; API cho tối đa 62 ngày một lần |
| "Tuần này" | Về tuần chứa hôm nay | như trên | Khoá khi đang ở tuần này |
| "Tuần sau →" | Tiến 7 ngày | như trên | — |
| Ô ngày trong dải 7 ngày (liên kết `#d-YYYY-MM-DD`) | Cuộn tới tiêu đề ngày đó | không gọi API; neo trong trang | Chỉ là liên kết khi ngày có buổi chưa huỷ |
| Ô chọn "Lớp" | Chọn lớp để gửi lịch tuần | không gọi API | Chỉ hiện khi ≥ 2 lớp có buổi trong tuần; nếu lớp đang chọn rời khỏi tuần thì tự về lớp đầu tiên |
| "Gửi lịch tuần qua Zalo" | Mở hộp "Lịch tuần dd/mm – dd/mm — {tên lớp}" với tin soạn sẵn | không gọi API; tin dựng ở máy bằng `buildWeeklyScheduleMessage` từ chính các buổi đã tải | Khoá khi tuần rỗng hoặc đang tải. Tin gồm cả buổi huỷ "(nghỉ)" và buổi dời. **Tin chung, không tên em, không tiền, không link** |
| (trong hộp lịch tuần) ô "Tin lịch tuần (sửa được trước khi gửi)" | Sửa tin | không gọi API | — |
| (trong hộp lịch tuần) "Chép tin" | Chép tin vào bộ nhớ tạm | không gọi API; toast "Đã sao chép tin." hoặc "Không sao chép được." | — |
| (trong hộp lịch tuần) "Mở nhóm Zalo lớp" (lớp đã gắn nhóm) / "Mở Zalo" (chưa gắn) | Mở Zalo: điện thoại có bảng chia sẻ thì mở bảng chia sẻ; máy tính thì chép tin rồi mở nhóm Zalo (`https://zalo.me/g/…`) hoặc `https://chat.zalo.me/` | `openZalo()` (`src/lib/zaloShare.ts`); **không ghi gì vào cơ sở dữ liệu** (test xác nhận `ClassReminderLog` không đổi); chỉ ghi nhớ giờ mở trong phiên | Rủi ro: gia sư tưởng KiN đã gửi → luôn kèm "KiN không gửi giúp: bạn tự bấm gửi trong Zalo." |
| (trong hộp lịch tuần) liên kết "Cài đặt → Kết nối" | Sang nơi gắn nhóm Zalo | `/lop-cua-toi/cai-dat#ket-noi` | Chỉ hiện khi lớp chưa gắn nhóm |
| Cả dòng buổi (nút mở/đóng thẻ) | Mở/đóng chi tiết, `aria-expanded`, `aria-controls="chi-tiet-{key}"` | không gọi API | Chỉ một thẻ mở một lúc |
| Link vào lớp | Mở link họp ở tab mới | liên kết ngoài | — |
| "Lịch học" (trong câu chưa có link) | Sang tab Lịch học của trang quản khoá | `/admin/khoa-hoc/{courseId}?tab=lich-hoc` | — |
| "Soạn kế hoạch buổi này" | Sang màn Kế hoạch buổi, điền sẵn lớp và ngày | `/lop-cua-toi/ke-hoach-buoi?courseId={id}&date={ngày hiệu lực}` | Test `ui-plan.ts` kiểm đường dẫn |
| "Không tính phí, giữ 1 buổi bù" | Xử lý báo nghỉ sát giờ: không tính phí, **tạo 1 buổi bù hạn 30 ngày**, ghi điểm danh "Có phép" ở đúng ngày buổi thật sự diễn ra (không đè bản ghi điểm danh có sẵn); hiện sẵn tin cho phụ huynh (câu "con còn N buổi bù": N là **tổng** buổi bù còn hạn của em ở lớp đó, tối thiểu 1, không nhất thiết là 1) | `PATCH /api/tutor/absences/{absenceId}` body `{"action":"free_makeup"}` → `{status:"excused_free", message, makeupCount, parentPhone}` (+ `parentName`); toast "Đã ghi nhận nghỉ có báo và giữ 1 buổi bù." | **Liên quan tiền về mặt lời nói, chưa đổi số liệu tiền:** mã hiện **chưa nối** "không tính phí" vào phiếu học phí (việc GD-25 chưa làm — `sessionChange.ts`, `docs/kin/tien-do-dang-do.md`) và điểm danh "Có phép" không trừ tiền (`attendance.ts`: hệ số chuyên cần, "vắng không trừ tiền"); nhưng nhãn và tin gửi phụ huynh đã nói "không tính phí". Không hoàn tác được từ màn này; nút biến mất sau khi bấm. Lỗi 409 "Báo nghỉ này đã được xử lý rồi" → toast lỗi + tự tải lại lịch |
| "Tính phí buổi này" | Xử lý báo nghỉ: tính phí, không buổi bù | `PATCH …/absences/{id}` body `{"action":"charge"}`; toast "Đã ghi nhận tính phí buổi này." | **Quyết định liên quan học phí** nhưng màn này **không hiện số tiền**, và (như nút trên) mã chưa nối vào phiếu học phí. Điểm danh để nguyên "chưa điểm danh". Không đổi gì khác ở màn này |
| "Nhắn phụ huynh qua Zalo" (sau khi xử lý báo nghỉ) | Mở Zalo với tin xử lý báo nghỉ, đúng số phụ huynh nếu có | `openZalo({text, phone: parentPhone})`; không gọi API ghi | Chỉ có trong phiên; tải lại trang thì mất (xem mục 9) |
| "Nhắc cả lớp trong nhóm Zalo" | Mở hộp "Nhắc cả lớp — {tên lớp}" với tin chung | dựng ở máy bằng `buildGroupReminderMessage` (`classSessions.ts`); không gọi API | Chỉ hiện khi buổi **chưa bắt đầu**. Tin chung, **không tên em, không điểm** |
| (hộp nhắc cả lớp) "Sao chép" | Chép tin | toast "Đã sao chép tin." / "Không sao chép được." | — |
| (hộp nhắc cả lớp) "Mở Zalo" | Mở nhóm Zalo của lớp (nếu có) hoặc Zalo chung | `openZalo({groupUrl})`; không ghi DB | Khoá khi ô tin trống |
| "Soạn & mở Zalo" (một tin chưa mở) / "Mở lại Zalo" (đã mở) | Mở hộp "Nhắc 24 giờ — phụ huynh của {tên em}" hoặc "Nhắc 1 giờ — {tên em}" (tiền tố "phụ huynh của " chỉ khi người nhận là phụ huynh) | không gọi API tới khi bấm "Mở Zalo" | Nút "Soạn & mở Zalo" là nút **chính** (đặc), "Mở lại Zalo" là phụ |
| (hộp nhắc từng em) "Sao chép" | Chép tin | như trên | — |
| (hộp nhắc từng em) "Mở Zalo" | Mở Zalo đúng số điện thoại người nhận (nếu có), rồi **ghi "đã mở Zalo"** | `openZalo({text, phone})` rồi `POST /api/tutor/reminders` body `{scheduleId, dateKey (ngày GỐC), studentId, recipient, kind}`; lỗi → toast "Đã mở Zalo nhưng chưa ghi lại được." (hoặc lỗi của API) | Chỉ ghi được khi: lớp của chính gia sư, em đang học, buổi chưa bắt đầu, tin đã tới hạn, em chưa báo nghỉ; ghi lần hai giữ lần đầu (idempotent). **Không bao giờ ghi "đã gửi".** Điện thoại: bảng chia sẻ không nhận số điện thoại, gia sư tự chọn người nhận |
| "Dời buổi" (trong khối "Đổi lịch buổi này") | Mở hộp "Dời buổi — {tên lớp}" | không gọi API | Chỉ có khi buổi **chưa bắt đầu**, trạng thái "scheduled" |
| "Huỷ buổi" (cùng khối) | Mở hộp "Huỷ buổi — {tên lớp}" | không gọi API | như trên |
| (hộp đổi lịch) hai lựa chọn radio "Dời sang lúc khác" / "Huỷ buổi" | Đổi kiểu trong cùng hộp | không gọi API | `role="radiogroup"` tên "Cách đổi lịch" |
| (hộp đổi lịch) "Ngày mới", "Giờ bắt đầu mới", "Giờ kết thúc mới" | Nhập ngày/giờ mới (chỉ khi chọn Dời). Ngày không được trước hôm nay (`min`) | không gọi API | Giờ kết thúc để trống thì giữ độ dài buổi cũ |
| (hộp đổi lịch) "Lý do (không bắt buộc, sẽ có trong tin báo lớp)" | Lý do, tối đa 300 ký tự (`CHANGE_REASON_MAX`) | không gọi API | — |
| (hộp đổi lịch) "Không đổi nữa" | Đóng hộp | — | Khoá khi đang lưu |
| (hộp đổi lịch) "Dời buổi" (nút gửi, khi chọn Dời) / "Huỷ buổi này" (khi chọn Huỷ) | Lưu thay đổi | `POST /api/tutor/session-changes` body `{scheduleId, dateKey (GỐC), kind, reason?, newDateKey?, newStartTime?, newEndTime?}` → `{change, message, zaloGroupUrl, absencesVoided, absencesKept, notified}` | **Học viên nhận thông báo trong ứng dụng ngay lập tức** (không thu hồi được; khôi phục cũng gửi thông báo mới). Huỷ: báo nghỉ chờ tự thành "voided" (không tính phí, không buổi bù); báo nghỉ đã xử lý **giữ nguyên**, KiN không thu hồi buổi bù/tiền. Không đụng học phí. Lỗi hiện ngay trong hộp, hộp ở lại |
| (hộp "Đã huỷ buổi" / "Đã dời buổi" / "Đã khôi phục buổi về lịch tuần" / "Báo lớp: buổi đã huỷ" / "Báo lớp: buổi đã dời") "Để sau" | Đóng hộp, chưa báo lớp | — | Buổi vẫn ghi "Chưa mở Zalo để báo lớp." |
| (cùng hộp) "Sao chép" | Chép tin | như trên | — |
| (cùng hộp) "Mở Zalo" | Mở nhóm Zalo của lớp (nếu có), rồi nếu hộp có `changeId` thì ghi "đã mở Zalo báo lớp" | `openZalo({text, groupUrl})` rồi `POST /api/tutor/session-changes/{changeId}/zalo` | Idempotent (giữ lần đầu). Hộp của "khôi phục" không có `changeId` nên không ghi |
| "Báo lớp qua Zalo" (buổi đã đổi, chưa mở Zalo) / "Mở lại tin báo lớp" (đã mở) | Mở hộp "Báo lớp: buổi đã huỷ" hoặc "Báo lớp: buổi đã dời" với tin **dựng lại ở máy** (không có chữ ký gia sư) | `sessionChangeMessage` (`sessionChange.ts`); không gọi API tới khi bấm "Mở Zalo" | Nút chính của khối đã đổi |
| "Sửa lý do huỷ" (buổi huỷ) / "Đổi lịch dời" (buổi dời) | Mở lại hộp đổi lịch, điền sẵn | không gọi API | Gọi lại POST cho cùng buổi = **đổi sang lựa chọn mới**, không nhân đôi dòng, và **xoá mốc "Đã mở Zalo báo lớp"** (tin cũ không còn đúng; đổi sang dời còn xoá cả mốc "Đã mở Zalo" của các tin nhắc buổi đó để tin theo giờ mới hiện lại) |
| "Đổi thành dời buổi" (chỉ buổi huỷ) | Mở hộp Dời | như trên | Huỷ → Dời: báo nghỉ "voided" **mở lại** thành chờ xử lý |
| "Huỷ buổi" (trong khối buổi đã dời) | Mở hộp Huỷ | như trên | — |
| "Khôi phục lịch cũ" | Bỏ thay đổi, buổi về lịch tuần; hiện hộp "Đã khôi phục buổi về lịch tuần" | `DELETE /api/tutor/session-changes?scheduleId=…&dateKey=…` | Chỉ khi **giờ gốc còn ở tương lai** (không thì 409 "Giờ gốc của buổi này đã qua, không khôi phục được"). Khôi phục buổi huỷ: các báo nghỉ "voided" mở lại. Học viên nhận thông báo "Buổi học giữ nguyên lịch" |
| "Thử lại" (khi tải lỗi) | Tải lại tuần đang xem | `GET /api/tutor/schedule…` | — |
| "Xem các lớp của tôi" (khi tuần rỗng) | Sang danh sách lớp | `/lop-cua-toi/lop` | Là liên kết, trông như nút |
| Đóng hộp thoại | Phím Esc hoặc bấm nền mờ | — | Hộp đổi lịch **không đóng được khi đang lưu** |

**Toast báo "đã mở Zalo" (loại `info`)** hiện sau mỗi lần "Mở Zalo" thành công, theo đường mở: bảng chia sẻ của điện thoại hay chép + mở cửa sổ Zalo. Chữ chính xác: tin nhắc từng em, tin báo lớp (dời/huỷ/khôi phục) và "Nhắn phụ huynh qua Zalo" — bảng chia sẻ: "Chọn Zalo trong bảng chia sẻ rồi bấm gửi." · chép + mở: "Đã chép tin và mở Zalo — dán vào cuộc trò chuyện rồi bấm gửi."; nhắc cả lớp và lịch tuần — bảng chia sẻ: "Chọn nhóm Zalo trong bảng chia sẻ rồi bấm gửi." · chép + mở: "Đã chép tin và mở Zalo — dán vào nhóm rồi bấm gửi." Các câu này chứa "bấm gửi" nhưng **không** chứa "đã gửi" (test cấm chuỗi sau).

Ràng buộc nghiệp vụ mà thiết kế phải **cho người dùng thấy lý do** (lỗi từ máy chủ hiển thị nguyên văn trong hộp, mục 6.5): chỉ đổi được buổi chưa bắt đầu; dời tối đa 60 ngày tới; dời phải sang tương lai; không dời sang ngày mà khung giờ đó vốn đã có buổi theo lịch tuần (trừ chính ngày gốc: được đổi giờ trong ngày, miễn không trùng hệt lịch cũ); không dời trùng đúng giờ hiện tại; mỗi ngày chỉ nhận một buổi dời của cùng một khung giờ.

---

## 6. Trạng thái

### 6.1 Đang tải

- **Lần tải đầu (chưa có dữ liệu):** thay danh sách bằng 3 khối chờ cao 68px (`aria-busy="true"`, `aria-label="Đang tải lịch"`, mờ 60%). Thanh gửi lịch tuần **ẩn** cho tới khi có dữ liệu. Không có vòng xoay, không có chữ "Đang tải…" hiển thị (chỉ nhãn đọc cho trình đọc màn hình).
- **Tải lại nền** (sau mỗi thao tác ghi, `load(from, true)`): **không có dấu hiệu chờ nào** — không mờ, không khung chờ, không khoá giao diện (cờ `loading` không bật); dữ liệu mới thay vào khi về. Chỉ khi tải thành công mới gọi `router.refresh()` để số đỏ trên thanh module đọc lại. Danh sách **mờ còn 70%** chỉ xảy ra khi **đổi tuần** (tải không-nền lúc đã có dữ liệu cũ), xem mục 9 điểm 9.
- **Đổi tuần:** xem mục 9 (đây là chỗ hiện tại chưa tốt).

### 6.2 Rỗng

Khung nét đứt, căn giữa, cao dư: dòng đậm **"Tuần này chưa có buổi học nào"**, dòng nhỏ: "Buổi học lấy từ khung giờ hằng tuần của lớp. Thêm giờ học ở tab **Lịch học** của trang quản khoá (mở lớp → Quản khoá)." (chữ "Lịch học" in đậm) và nút-liên kết **"Xem các lớp của tôi"** (→ `/lop-cua-toi/lop`, cao ≥ 44px). Ở tuần rỗng thanh gửi lịch tuần vẫn hiện, nút khoá, kèm câu "Tuần này chưa có buổi nào để gửi lịch. Chuyển sang tuần có buổi học để gửi."

### 6.3 Bình thường — các trạng thái của một buổi

Thẻ đóng, theo `status` và thời điểm:

| Trạng thái | Chữ trên thẻ | Dấu khác |
|---|---|---|
| Sắp tới | "{n} học viên · sắp tới" | chấm xanh dương (`--kin-th-xanh-link`) |
| Đang diễn ra | "{n} học viên · đang diễn ra" | chấm cam (`--kin-tt-cham-cho`) |
| Đã kết thúc | "{n} học viên · đã kết thúc" | chấm xanh lá (`--kin-tt-cham-xong`) |
| Đã huỷ | "{n} học viên · buổi đã huỷ"; **tên lớp và giờ bị gạch ngang** (gạch ở chính phần tử chứa tên, test kiểm); huy hiệu "Đã huỷ"; vạch trái màu trung tính | chấm xám |
| Đã dời | trạng thái thường (sắp tới/…) + " · dời từ Thứ … dd/mm HH:mm"; huy hiệu "Đã dời"; hiện ở **ngày mới** | — |
| Có báo nghỉ chờ | thêm huy hiệu đỏ "{n} báo nghỉ sát giờ" | — |
| Có tin nhắc chờ | thêm huy hiệu cam "{n} tin nhắc chờ gửi" | — |

Dòng kế hoạch nhắc trong chi tiết (mỗi buổi chưa huỷ): "Nhắc 24 giờ: {HH:mm} ngày {dd/mm}" + (nếu dời) " (dời về tối trước giờ yên lặng)" · "Nhắc 1 giờ: {HH:mm} ngày {dd/mm}" **hoặc** "Nhắc 1 giờ: bỏ (buổi trước 08:00)" / "Nhắc 1 giờ: bỏ (rơi vào giờ yên lặng)" · "Hạn báo nghỉ giữ buổi bù: {HH:mm} ngày {dd/mm}". Quy tắc: giờ yên lặng 22:00–07:00; tin 24 giờ rơi vào đó thì dời về 21:30; tin 1 giờ rơi vào đó hoặc buổi bắt đầu trước 08:00 thì bỏ; hạn báo nghỉ giữ buổi bù = giờ học trừ 2 giờ.

Phần "Nhắc lịch" của một buổi: nếu không em nào có tin: "Buổi đã bắt đầu — không nhắc nữa." (khi đã bắt đầu) hoặc "Chưa có tin nào tới hạn gửi." (khi chưa).

Khối "Đổi lịch buổi này" **không hiện** khi buổi đã bắt đầu. Khối "Nhắc lịch" **không hiện** khi buổi đã huỷ. Nút "Nhắc cả lớp trong nhóm Zalo" **không hiện** khi buổi đã bắt đầu.

### 6.4 Nhãn trạng thái báo nghỉ (`ABSENCE_LABEL`)

| Mã trạng thái | Chữ chính xác | Tông |
|---|---|---|
| `pending` | "Báo nghỉ sát giờ — chờ bạn xử lý" | cam (chờ) |
| `excused_auto` | "Nghỉ có báo — đã giữ 1 buổi bù" | xanh lá (xong) |
| `excused_free` | "Không tính phí — đã giữ 1 buổi bù" | xanh lá (xong) |
| `charged` | "Tính phí buổi này" | trung tính |
| `voided` | "Buổi đã huỷ — không tính phí, không buổi bù" | trung tính |
| (mã lạ) | hiện đúng mã thô | trung tính |

Quy tắc đã chốt: báo nghỉ trước giờ học **từ 2 giờ trở lên** thì tự ghi "Nghỉ có báo" và giữ buổi bù; **dưới 2 giờ** thì thành "chờ" để gia sư bấm một nút; đã tới giờ thì không nhận báo nghỉ nữa. Buổi bù có hạn 30 ngày.

### 6.5 Lỗi (có "Thử lại")

- **Không tải được lịch:** khung `role="alert"`, viền `--kin-tt-chu-loi`, chữ lỗi **"Không tải được lịch. Kiểm tra mạng rồi thử lại."** + nút **"Thử lại"** (secondary). Màu đỏ **luôn có chữ**.
- **Làm mới nền thất bại:** toast lỗi "Không làm mới được lịch" (hoặc câu lỗi của máy chủ). Không chặn màn hình.
- **Xử lý báo nghỉ thất bại:** toast lỗi "Không xử lý được" (hoặc câu của máy chủ). Riêng 409 ("Báo nghỉ này đã được xử lý rồi") thì tải lại lịch.
- **Mở Zalo thất bại:** toast lỗi "Không mở được Zalo. Hãy chép tin và gửi tay." (khi cả mở cửa sổ lẫn chép đều hỏng). Người dùng huỷ bảng chia sẻ thì **không** có thông báo, hộp tin ở lại.
- **Ghi "đã mở Zalo" thất bại:** toast lỗi "Đã mở Zalo nhưng chưa ghi lại được." (hoặc câu của máy chủ).
- **Chép thất bại:** toast lỗi "Không sao chép được."
- **Khôi phục thất bại:** toast lỗi "Không khôi phục được" (hoặc câu máy chủ) và tải lại lịch.
- **Lưu đổi lịch thất bại:** `role="alert"` ngay trong hộp, đỏ đậm: câu máy chủ hoặc "Không lưu được, thử lại sau". Các câu máy chủ chính xác (từ `sessionChange.ts`, `sessionChangeServer.ts`): "Buổi này đã bắt đầu hoặc đã qua, không đổi được nữa" · "Ngày mới không hợp lệ (YYYY-MM-DD)" · "Giờ bắt đầu mới không hợp lệ (HH:mm)" · "Giờ kết thúc mới không hợp lệ (HH:mm)" · "Giờ kết thúc phải sau giờ bắt đầu" · "Buổi dời kết thúc sau 24:00 — hãy chọn giờ bắt đầu sớm hơn hoặc nhập giờ kết thúc" · "Thời điểm mới phải ở tương lai" · "Chỉ dời tới tối đa 60 ngày nữa" · "Ngày dd/mm đã là ngày học theo lịch tuần của khung giờ này — hãy chọn ngày khác" · "Ngày và giờ mới trùng với lịch hiện tại — chưa có gì để đổi" · "Lý do tối đa 300 ký tự" · "Đã có một buổi khác của khung giờ này được dời tới ngày đó" · "Không tìm thấy buổi học của bạn". Còn vài câu hiếm gặp từ giao diện này (chỉ khi dữ liệu khung giờ hỏng): "Ngày này không có buổi học theo lịch của lớp" · "Giờ học của khung này chưa đặt đúng, hãy sửa ở tab Lịch học trước". Lỗi mạng chung của `callApi`: "Lỗi kết nối, thử lại sau".

### 6.6 Trạng thái đặc biệt của màn này

- **Đã đổi lịch, chưa báo lớp:** dòng "Chưa mở Zalo để báo lớp." + nút chính "Báo lớp qua Zalo".
- **Đã đổi lịch, đã mở Zalo:** dòng "Đã mở Zalo báo lớp lúc HH:mm" (xanh lá, **chữ** "Đã mở Zalo", không "đã gửi") + nút "Mở lại tin báo lớp".
- **Hộp "Đã huỷ buổi" / "Đã dời buổi":** danh sách gạch đầu dòng tóm tắt hậu quả, mỗi dòng là một câu thật: "Đã báo {n} học viên trong ứng dụng." hoặc "Lớp chưa có học viên nào đang học để báo trong ứng dụng." · "{n} báo nghỉ sát giờ đang chờ đã tự đóng vì buổi huỷ (không tính phí, không buổi bù)." · "{n} em đã báo nghỉ buổi này trước đó và đã được xử lý (giữ buổi bù hoặc tính phí) — KiN không tự thu hồi, bạn xem lại nếu cần" (khi huỷ) / "… — báo nghỉ giữ nguyên" (khi dời) · luôn có "KiN không gửi giúp: bạn tự mở Zalo và bấm gửi để báo phụ huynh." Sau đó nhãn "Tin báo lớp (sửa được trước khi gửi)" và đoạn "Tin chung cho cả lớp: không tên em, không điểm, không tiền. " + ("Sẽ mở nhóm Zalo của lớp." hoặc "Chưa gắn nhóm Zalo — KiN sẽ chép tin và mở Zalo, bạn chọn đúng người nhận.").
- **Hộp "Đã khôi phục buổi về lịch tuần":** các dòng "Đã báo {n} học viên trong ứng dụng." / "{n} báo nghỉ sát giờ đã mở lại để bạn xử lý." / "Nếu bạn đã báo lớp là buổi này đổi lịch, hãy báo lại bằng tin bên dưới."
- **Kênh nhắc bị tắt** (cài đặt cá nhân): không có dòng nhắc cho bên đó; có thể ra "Chưa có tin nào tới hạn gửi." dù buổi sắp tới. (suy ra từ mã `reminderChannels`, chưa chạy thử)
- **Lớp chưa gắn nhóm Zalo:** các nút mở Zalo vẫn dùng được (chép tin + mở Zalo chung), có liên kết "Cài đặt → Kết nối".
- **Em chưa khai số điện thoại:** hộp nhắc từng em nói "Chưa có số điện thoại — KiN sẽ chép tin và mở Zalo, bạn chọn đúng người nhận." Có số: "Sẽ mở Zalo của {số}." Cả hai câu cộng thêm " KiN không gửi giúp: bạn tự bấm gửi trong Zalo."
- **Chưa đăng nhập / sai vai:** chuyển trang (không có màn lỗi riêng).

---

## 7. Chữ bắt buộc giữ nguyên

Các bài test giao diện chạy trình duyệt thật (Playwright) tìm theo **tên truy cập được** (`getByRole`, `getByText`, `getByLabel`). Đổi chữ là làm test đỏ. Liệt kê theo từng tệp (tất cả ở `tools/local-e2e/`).

**Cảnh báo tìm kiếm trùng (rất quan trọng cho thiết kế):** nhiều câu test dùng `getByText(...)` **không** có `.first()`, nên chuỗi đó phải xuất hiện **đúng một lần** trong phạm vi tìm. Nếu thiết kế lặp lại cùng chuỗi ở chỗ khác (ví dụ một dòng tổng kết "1 báo nghỉ sát giờ" đặt phía trên danh sách) thì test báo lỗi "strict mode violation". `getByText` mặc định khớp **chuỗi con, không phân biệt hoa/thường**, nên một chuỗi nằm trong câu dài hơn cũng tính là lặp. Các chuỗi phải duy nhất khi hiển thị cùng lúc (đã kiểm từng câu test: không có `.first()`): "1 báo nghỉ sát giờ" (và dạng `{n} báo nghỉ sát giờ`), `{n} tin nhắc chờ gửi`, "Báo nghỉ sát giờ — chờ bạn xử lý", "Không tính phí — đã giữ 1 buổi bù", "Buổi đã huỷ — không tính phí, không buổi bù", "báo trước 40 phút", "Hạn báo nghỉ giữ buổi bù", "Con bị sốt" (lý do), "Đã ghi nhận con nghỉ buổi", "Không đụng tới học phí", "Học viên được báo trong ứng dụng", "Buổi này đã huỷ — lý do: …", "Đã mở Zalo báo lớp lúc HH:mm", "Đã gắn nhóm Zalo của lớp.", "Tin chung, không tên em", "Tuần này chưa có buổi học nào". Riêng "Tính phí buổi này": chỉ là **nút** khi báo nghỉ còn chờ; sau khi xử lý bằng "Không tính phí…" nút phải biến mất (test đếm = 0). "Đã huỷ" (huy hiệu) test chỉ đếm ≥ 1 nên không bắt buộc duy nhất, nhưng nên giữ một cho gọn. Và **không được có chữ "đã gửi"** (không phân biệt hoa/thường) ở bất kỳ đâu trên trang. Hai ràng buộc cấu trúc khác: nhiều test gọi `getByRole("dialog")` **không kèm tên**, nên chỉ được mở **một** hộp thoại tại một thời điểm; và test tin xử lý báo nghỉ lấy `p.whitespace-pre-line` đầu tiên trên trang (tin phải nằm trong thẻ `<p>` mang lớp đó, chưa có `<p>` khác cùng lớp đứng trước).

### 7.1 `ui-schedule.ts` (trang Lịch + nhắc + báo nghỉ + lịch tuần)

- Thanh module: vùng điều hướng tên "Module của gia sư"; nút "Khác"; hộp "Các mục khác" có liên kết "Thêm module" (href `/lop-cua-toi/cai-dat#module`); mục "Lịch" có `aria-current="page"`; số đỏ `.kin-badge-dem` có `aria-label` "{n} việc cần xử lý". (Thuộc vỏ, không thiết kế lại.)
- Tiêu đề h1 đúng tên **"Lịch"** (`getByRole("heading", {name:"Lịch", exact:true})`; trên trang không được có heading nào khác tên đúng "Lịch").
- "Toán 9" (tên lớp) hiện trong thẻ; "Hôm nay" (chip, chữ đúng, `exact`).
- Huy hiệu: "1 báo nghỉ sát giờ" và "{n} tin nhắc chờ gửi" (cùng nhìn thấy trên thẻ **đang đóng**).
- Thẻ buổi là **một nút** có tên chứa tên lớp (`getByRole("button", {name:/Toán 9/})`), `aria-expanded` "false"/"true".
- Trong chi tiết: liên kết (`role=link`) có **tên truy cập được chứa đúng địa chỉ link** ("https://meet.google.com/abc-defg-hij"); "Hạn báo nghỉ giữ buổi bù".
- Báo nghỉ: tên em ("Em Bình"), "báo trước 40 phút", lý do ("Con bị sốt"); đúng **2 nút**: "Không tính phí, giữ 1 buổi bù" và "Tính phí buổi này" (nút chính là cái đầu).
- Toast: "Đã ghi nhận nghỉ có báo và giữ 1 buổi bù." Tin hiện sẵn bắt đầu "Đã ghi nhận con nghỉ buổi" (phần tử `p.whitespace-pre-line` đầu tiên trên trang) và chứa "Buổi này không tính phí và con còn 1 buổi bù" và "Cô Lan sẽ hẹn giờ bù". Nhãn "Không tính phí — đã giữ 1 buổi bù". Nút "Tính phí buổi này" biến mất sau khi xử lý.
- Nhắc từng em: nút "Soạn & mở Zalo"; hộp thoại (role `dialog`) có ô nhập nhãn **"Tin nhắn (sửa được trước khi gửi)"**; tin bắt đầu "KiN nhắc lịch: con Em An có buổi Toán 9" **hoặc** "Còn 1 giờ nữa là buổi Toán 9 của Em An"; có câu chứa "KiN không gửi giúp"; nút "Mở Zalo"; sau khi mở: chữ khớp `/Đã mở Zalo lúc \d\d:\d\d/` (giờ hai chữ số) và nút đổi thành **"Mở lại Zalo"** (đúng 1 nút sau khi mở đúng 1 tin; nếu gộp tin theo người nhận thì phải giữ được phép đếm này, xem mục 12 điểm 2). Nút "Soạn & mở Zalo" được bấm là nút **đầu tiên** trên trang (xem mục 4.1, bước 6, dòng "Các em").
- Mở Zalo: địa chỉ bắt đầu `https://zalo.me/0901234567` (số phụ huynh); `navigator.clipboard` chứa **đúng tin đã sửa**.
- Lịch tuần: nhóm `role="group"` tên **"Gửi lịch tuần qua Zalo"**; trong nhóm: ô chọn có nhãn **"Lớp"** (đúng 1 phần tử khớp nhãn "Lớp", chỉ khi ≥ 2 lớp), nút **"Gửi lịch tuần qua Zalo"**; hộp có nhãn **"Tin lịch tuần (sửa được trước khi gửi)"**; tin bắt đầu "Lịch học tuần dd/mm – dd/mm của lớp Toán 9:"; dòng huỷ có "dd/mm, 18:00–19:00 (nghỉ)"; dòng dời có "dd/mm, 15:00–16:00 (dời từ"; nút "Mở nhóm Zalo lớp" (lớp có nhóm), "Mở Zalo" (đúng tên, `exact`) khi chưa có nhóm, "Chép tin"; liên kết **"Cài đặt → Kết nối"**; sau khi mở: "Đã mở Zalo lúc HH:mm" trong nhóm đó (đúng 1); đổi lớp thì dòng đó biến mất; đổi tuần: văn bản "Tuần dd/mm – dd/mm" của tuần mới; nút "Tuần sau →".
- Tuần rỗng: nút "Gửi lịch tuần qua Zalo" **khoá**; chữ khớp `/chưa có buổi nào để gửi lịch/`; không có ô "Lớp".
- Điện thoại 390px: nút và ô chọn lớp cao ≥ 44px; **không tràn ngang**; hộp tin vừa 390px; nút đầu khớp `/Mở/` cao ≥ 44px; thanh module dưới cao 60px, sát đáy.
- Quyền: học viên → chuyển khỏi trang; khách → `/dang-nhap`.
- Không lỗi trang / lỗi console.

### 7.2 `ui-session-change.ts` (dời / huỷ / khôi phục)

- Khối: heading **"Đổi lịch buổi này"** (heading, không phải nút); nút **"Dời buổi"** và **"Huỷ buổi"** (`exact`, mỗi nút đúng 1 lần trên trang khi một thẻ mở); câu có "Không đụng tới học phí" và "Học viên được báo trong ứng dụng"; nhãn "Báo nghỉ sát giờ — chờ bạn xử lý".
- Hộp thoại tên **"Huỷ buổi — Toán 9"** / **"Dời buổi — Toán 9"** (gạch dài "—" có khoảng trắng hai bên). Hộp Huỷ: **không** có `input type="date"`; câu "Báo nghỉ sát giờ đang chờ của buổi này sẽ tự đóng"; hai lựa chọn `role="radio"` với `aria-checked` (test chỉ kiểm radio tên "Huỷ buổi"; "Dời sang lúc khác" là chữ hiện có trong mã, không bị test kiểm); ô có nhãn khớp `/Lý do/`; nút gửi **"Huỷ buổi này"**. Nút "Không đổi nữa" có trong mã nhưng **không có test nào kiểm chữ này** (grep toàn `tools/local-e2e/`), nên đổi được nếu chủ dự án đồng ý.
- Hộp Dời: nhãn **"Ngày mới"**, **"Giờ bắt đầu mới"**, **"Giờ kết thúc mới"**; lý do cũ được điền sẵn; nút gửi **"Dời buổi"** (trong hộp, `exact`); lỗi hiện **trong hộp** khớp `/đã là ngày học theo lịch tuần/` và hộp ở lại.
- Hộp kết quả tên **"Đã huỷ buổi"** / **"Đã dời buổi"** / **"Đã khôi phục buổi về lịch tuần"** (`getByRole("dialog", {name})`). Test kiểm **riêng từng hộp**, đừng gộp:
  - **"Đã huỷ buổi"**: câu "Đã báo 2 học viên trong ứng dụng." (đúng chữ, số thật), khớp `/1 báo nghỉ sát giờ đang chờ đã tự đóng/`, `/KiN không gửi giúp/`, `/Tin chung cho cả lớp/`, `/Sẽ mở nhóm Zalo của lớp/`; nhãn **"Tin báo lớp (sửa được trước khi gửi)"**; nút **"Mở Zalo"**. Tin chứa "HUỶ", "Toán 9", "Lý do: Cô ốm"; **không** có tên em / link (`Em An|Em Bình|https?:`).
  - **"Đã dời buổi"**: nhãn "Tin báo lớp (sửa được trước khi gửi)"; tin chứa "DỜI sang 20:30" và lý do "Trùng lịch thi"; hộp **không** được có chữ "đã tự đóng" (đang đếm = 0); nút **"Để sau"**.
  - **"Đã khôi phục buổi về lịch tuần"**: tin chứa "GIỮ NGUYÊN"; nút **"Để sau"**. (Hộp này hiện **không** có câu "KiN không gửi giúp", xem mục 9 điểm 18.)
  - Các test thuần kiểm thêm: tin báo lớp **không** có link, `đ` (số tiền) hay "điểm" (`t-session-change-lib.ts`, `t-session-change.ts`).
- Thẻ buổi huỷ: huy hiệu "Đã huỷ" (chữ đúng), văn bản thẻ chứa "buổi đã huỷ", phần tử có chữ đúng "Toán 9" **tự nó** gạch ngang; thẻ nằm trong một `li`. Thẻ dời: văn bản thẻ **đang đóng** chứa "Đã dời", "dời từ", "20:30"; nằm dưới heading h2 chứa "dd/mm" của ngày mới. Sau khôi phục: thẻ **không** còn "Đã dời", "Đã huỷ", "dời từ".
- Chi tiết thẻ huỷ: khớp `/Buổi này đã huỷ — lý do: Cô ốm/`, `/Đã mở Zalo báo lớp lúc \d{2}:\d{2}/`; **không** heading "Nhắc lịch"; nhãn "Buổi đã huỷ — không tính phí, không buổi bù"; nút "Mở lại tin báo lớp", "Sửa lý do huỷ", "Đổi thành dời buổi", "Khôi phục lịch cũ".
- Buổi đã bắt đầu: **không** có heading "Đổi lịch buổi này".
- Điện thoại 390px: hộp Dời không tràn ngang; mọi `input`, `textarea`, `button` trong hộp cao ≥ 44px. Tên bước trong test ghi "trừ ô lý do nhiều dòng" nhưng **phép kiểm thật không loại trừ ô lý do** (đo mọi phần tử có chiều cao > 0), nên ô lý do cũng phải cao ≥ 44px (hiện 2 dòng, đạt).
- (Màn khác nhưng cùng dữ liệu: Sổ của con hiển thị "Gia sư đã huỷ buổi này — lý do: …", không thuộc màn này.)

### 7.3 `ui-connections.ts`, `ui-plan.ts`, `ui-journey-new-tutor.ts`

- `ui-connections.ts`: nút **"Nhắc cả lớp trong nhóm Zalo"**; khớp `/Đã gắn nhóm Zalo của lớp\./` và `/Tin chung, không tên em/`; hộp có nhãn "Tin nhắn (sửa được trước khi gửi)"; tin bắt đầu "KiN nhắc lịch: cả lớp có buổi Toán 9 lúc 19:00 tối mai, " và có "Link vào lớp: https://…"; không có "Em " / "con "; nút "Mở Zalo" → mở đúng `https://zalo.me/g/…`.
- `ui-plan.ts`: liên kết tên **"Soạn kế hoạch buổi này"**, href khớp `/lop-cua-toi/ke-hoach-buoi?courseId=…&date=YYYY-MM-DD` (regex có neo cuối chuỗi: `courseId` đứng trước, `date` đứng cuối, không thêm tham số sau).
- `ui-journey-new-tutor.ts`: màn đầu của gia sư mới là `/lop-cua-toi/lich`; có chữ **"Tuần này chưa có buổi học nào"**; văn bản trang chứa **"trang quản khoá"** và **không** chứa "trong trang lớp"; liên kết **"Xem các lớp của tôi"**.

### 7.4 Bài không mở trình duyệt (hàm thuần, hoặc gọi API + cơ sở dữ liệu thử; chuỗi chữ do mã sinh ra)

- `t-schedule-zalo-lib.ts` (tin lịch tuần): dòng đầu đúng "Lịch học tuần dd/mm – dd/mm của lớp {tên}:"; mỗi buổi "- {Thứ} dd/mm, HH:mm–HH:mm"; buổi huỷ thêm " (nghỉ)"; buổi dời thêm " (dời từ {Thứ} dd/mm HH:mm)"; dòng cuối "Cần nghỉ thì báo riêng với thầy/cô trước giờ học nhé."; tin **không** có tên em, số tiền (đ, đồng, vnd, k, học phí, phiếu), link, và không có các từ "em", "con", "phụ huynh", "anh/chị" ngoài câu cuối. Tuần rỗng → tin rỗng (nút khoá).
- `t-class-sessions.ts` (hàm thuần): mẫu tin nhắc **khớp nguyên văn** ("KiN nhắc lịch: con Minh Anh có buổi Toán 9 lúc 20:00 tối mai, thứ Năm 01/10, với Thầy/Cô Thanh." + dòng "Link vào lớp: …" + "Con cần nghỉ thì anh/chị báo ở sổ học trước 18:00 để con được giữ buổi bù."; "Còn 1 giờ nữa là buổi Toán 9 của Minh Anh (20:00)."), mẫu tin "Đã ghi nhận con nghỉ buổi 30/09. Buổi này không tính phí và con còn 1 buổi bù. Thầy/Cô sẽ hẹn giờ bù với anh/chị.", hạn báo nghỉ = giờ học trừ 2 giờ, giờ yên lặng 22:00–07:00, dời tin 24 giờ về 21:30, bỏ tin 1 giờ nếu buổi trước 08:00.
- `t-session-change-lib.ts` (hàm thuần): tin báo huỷ/dời/khôi phục — test kiểm các mẩu "HUỶ", "Lý do: Cô ốm.", "DỜI sang 20:00 thứ Tư 14/10", "GIỮ NGUYÊN", chữ ký "Thầy/Cô Lan" / "Cô Lan", dạng "19:00 thứ Ba 13/10"; tiền tố "KiN báo lịch:" là chữ hiện có của mã nhưng **không** bị test kiểm.
- `t-reminders.ts`, `t-session-change.ts` (gọi **API + cơ sở dữ liệu thử**, không phải hàm thuần): quyền, danh sách em xếp theo tên, ghi "đã mở Zalo" idempotent (cả tin nhắc lẫn tin báo lớp), mốc "đã mở Zalo báo lớp" bị xoá khi đổi lại thay đổi, kênh nhắc bật/tắt từng bên; riêng `t-reminders.ts` kiểm **JSON lịch không bao giờ có "sent"/"daGui"**.
- `t-no-hex.ts`: không được có mã màu hex viết cứng trong mã giao diện (quét `src/**/*.ts|tsx|css`, trừ vài ngoại lệ có lý do); mọi màu qua token `--kin-*`. Cũng kiểm: mọi lớp màu Tailwind kiểu `text-gray-500` đang dùng phải đã được khai trong `globals.css` và trỏ về token.

---

## 8. Quy tắc cùng phải giữ

Chỉ liệt kê điều liên quan màn này. Nguồn viết tắt: **CLAUDE** = `CLAUDE.md` gốc; **KHO** = `docs/kin/CLAUDE-cho-kho-trien-khai.md`; **BRIEF** = `docs/kin/thiet-ke/goi-gui-claude-design/BRIEF.md`; **MÃ** = chú thích trong tệp mã được dẫn.

1. **Tên sản phẩm là "KiN"**, không dùng "Midnight Elite" ở bất cứ chữ nào (CLAUDE; KHO mục 7). Nhiều tin soạn sẵn mở đầu "KiN nhắc lịch:" / "KiN báo lịch:".
2. **KiN không gửi giúp, chỉ mở Zalo; chỉ ghi "đã mở", không bao giờ "đã gửi"** (MÃ `zaloShare.ts`, `reminderServer.ts`; test mục 7). Mọi hộp soạn tin phải còn câu "KiN không gửi giúp: bạn tự bấm gửi trong Zalo." hoặc tương đương. (Hộp "Đã khôi phục buổi về lịch tuần" hiện **thiếu** câu này — mục 9 điểm 18; bản thiết kế vẫn phải vẽ có câu đó.)
3. **Tin gửi cả lớp/nhóm: không tên em, không điểm, không tiền, không link phiếu** (MÃ `weeklyScheduleMessage.ts`, `sessionChange.ts`, `classSessions.ts` hàm `buildGroupReminderMessage`). Riêng tin nhắc cả lớp được kèm dòng "Link vào lớp: …" của buổi; tin lịch tuần và tin báo đổi lịch **không** có link nào. Tin gửi riêng từng em/phụ huynh **có** tên em (theo mẫu), nhưng vẫn không có số tiền.
4. **Tiền: màn này không hiện số tiền và không tính tiền.** KiN không giữ học phí (KHO mục 1). Câu "Không đụng tới học phí" phải giữ ở khối đổi lịch (MÃ `sessionChange.ts`: huỷ/dời không sửa phiếu học phí, không sửa buổi bù). Nút "Tính phí buổi này" là quyết định liên quan tiền nhưng **không kèm số**; **hỏi người** trước khi thêm bất kỳ con số tiền nào (KHO mục 9, câu 3). Hai nút xử lý báo nghỉ hiện **chưa nối** vào phiếu học phí (GD-25 chưa làm): thiết kế **không được** vẽ như thể bấm xong thì số tiền nào đó đổi.
5. **Học viên có thể dưới 16 tuổi** (BRIEF; KHO mục 8–9): màn này chỉ hiện **tên** học viên cho gia sư; **không thêm** ảnh, ngày sinh, tuổi, trường, nơi ở hay ô thu thập dữ liệu cá nhân mới. Số điện thoại (của phụ huynh hoặc học sinh) hiện **ở đúng một chỗ**: câu "Sẽ mở Zalo của {số}." trong hộp nhắc từng em (mục 9 điểm 13; mục 12 điểm 8 đề nghị bỏ số khỏi câu). **Không** thêm số điện thoại ra thẻ buổi, danh sách em hay chỗ nào khác; số phụ huynh trong luồng "Nhắn phụ huynh qua Zalo" chỉ được truyền cho Zalo, không hiện ra.
6. **Màu chỉ qua token `--kin-*`** (`src/app/kin-tokens.css`, sáng + tối, đã đo WCAG AA; test `t-no-hex.ts`). **Không thêm màu ngoài bộ** (BRIEF); cần màu mới thì nêu để thêm vào bộ. **Màu không bao giờ nói một mình**: mọi trạng thái có chữ đi kèm (KHO mục 6). **Hai bộ mã**: chấm/viền dùng bộ `--kin-tt-cham-*` (cần 3:1), **chữ** dùng `--kin-tt-chu-*` (cần 4,5:1); không dùng một mã cho cả hai (KHO mục 6).
7. **Nút ≥ 44px** (`--kin-cham-toi-thieu`), kể cả ô chọn lớp, ô ngày/giờ, nút radio của hộp đổi lịch, ô trong dải 7 ngày (hiện 48px). Một cột trên điện thoại; **không tràn ngang ở 390px**; không chữ cắt "…" (BRIEF; MÃ).
8. **Giờ Việt Nam (UTC+7), 24 giờ, tuần bắt đầu Thứ Hai, ngày "dd/mm"** (MÃ `classSessions.ts`). Không dùng 12 giờ AM/PM (ảnh form Teachworks `8a3fc5b1…` và ảnh form TutorBird `189297bf…` đều hiện giờ kiểu "12:00 PM").
9. **Nút = `KinButton`** (primary / secondary / ghost / danger / danger-solid); **không vòng xoay chờ** (MÃ `Button.tsx`, ghi chú Figma). Trạng thái chờ là khoá nút + `aria-busy`.
10. **Màu theo lớp**: "Cùng lớp luôn cùng màu" (MÃ `classColor.ts`). Màu nghĩa của BRIEF: xanh lá = xong/đã thu, cam = chờ/còn nợ, đỏ = quá hạn/nghỉ, xanh dương = đã lên lịch.
11. **Thao tác ghi là gọi API qua `fetch` (không dùng server action)** — cùng tinh thần quy tắc 5 trong KHO mục 5 (server action bị huỷ giữa chừng gây "Đang lưu…" giả; màn này không dùng server action, và cũng không dùng form POST + 303 như `kin-app` mà gọi API route bằng `fetch`). Thiết kế không cần bận tâm, nhưng **không** thiết kế kiểu "lạc quan": phải chờ phản hồi mới báo thành công.
12. **Giữ vỏ Outlook** (thanh module trái / dưới, dải trên 48px); chỉ thiết kế phần nội dung bên phải (BRIEF: "Giữ nguyên thanh này, chỉ thiết kế phần nội dung bên phải"; chi tiết ở `tai-lieu/bo-cuc-outlook.md`, `tai-lieu/thanh-ben-trai.md`). Thanh trái hiện **thu được** về 0px và có chế độ rộng 220px; 79px là bề rộng mặc định.
13. **Giọng**: tiếng Việt, xưng hô tự nhiên; gia sư đọc "bạn" ("chờ bạn xử lý", "bạn tự mở Zalo"); tin gửi phụ huynh xưng "anh/chị" và "con", tin gửi học sinh xưng "bạn" (KHO mục 7; MÃ `classSessions.ts`).
14. **Trạng thái rỗng có một câu giải thích và một nút** (BRIEF).
15. **Khoảng trắng và ít khung** (BRIEF): chủ dự án chê bản hiện tại "quá to, tràn mắt, dày, dư thừa".

---

## 9. Điều đang chưa tốt ở bản hiện tại

Dựa trên mã và ảnh `anh-hien-trang/2-lich-truoc-khi-sua.jpg`. **Lưu ý:** ảnh đó chụp **trước khi** có dải 7 ngày (ảnh không có dải này); mã hiện tại đã có dải (chú thích trong `LichClient.tsx`: "thay cho lưới 7 cột khó đọc trên điện thoại"). Hãy bám mã, dùng ảnh để thấy nhịp chữ và độ dày.

**Về độ dày và thị giác**
1. **Khung trong khung.** Mỗi buổi là một thẻ viền; mở ra thì từng em (ở khối "Báo nghỉ" và ở khối "Nhắc lịch") lại là một khung viền con bên trong thẻ, tức 2 tầng viền lồng nhau; tin xử lý báo nghỉ còn là một ô nền thứ ba bên trong khung của em; thanh gửi lịch tuần cũng là một thẻ viền riêng nằm trên danh sách.
2. **Ba huy hiệu xếp cột bên phải** (ví dụ "Đã dời" + "1 báo nghỉ sát giờ" + "2 tin nhắc chờ gửi") làm thẻ cao hơn hẳn các thẻ khác (ba huy hiệu cao 16px cách nhau 4px = 56px chỉ riêng cột huy hiệu, so với khoảng 36px của hai dòng chữ bên cạnh) và ép tên lớp; ảnh chụp cho thấy hai huy hiệu đã chiếm hết bên phải ở 560px, trên 390px còn chật hơn.
3. **Mọi chữ phụ cùng cỡ và cùng độ xám** (`text-xs`): dòng trạng thái, câu hướng dẫn, ghi chú đều mờ như nhau, nên không có thứ bậc; câu "Dời sang ngày/giờ khác hoặc huỷ hẳn. Học viên được báo trong ứng dụng; bạn tự mở Zalo báo phụ huynh. Không đụng tới học phí." dài 3 mệnh đề trước hai nút.
4. **Dòng kế hoạch nhắc là một đoạn chữ dày** chứa 3 mốc giờ-ngày nối nhau bằng "·", khó quét. Mốc quan trọng nhất ("Hạn báo nghỉ giữ buổi bù") nằm cuối.
5. **Một em có tới 4 dòng nhắc** (phụ huynh/học sinh × 24 giờ/1 giờ), mỗi dòng một nút "Soạn & mở Zalo" cùng nhãn → 3 em là 12 nút giống hệt nhau, nặng và dễ bấm nhầm.
6. **Chi tiết một buổi là chồng 5 khối** (link vào lớp, kế hoạch buổi, báo nghỉ, đổi lịch, nhắc lịch) với 3 tiêu đề h3; **việc gấp (báo nghỉ chờ) nằm sau hai dòng tiện ích** (link lớp, kế hoạch buổi).
7. **Dải 7 ngày: ô ngày chỉ có buổi huỷ** cho `aria-label` "không có buổi", mờ và không bấm được, trong khi bên dưới vẫn có tiêu đề ngày và thẻ buổi huỷ (dải đếm bỏ buổi huỷ, danh sách thì không). (suy ra từ mã, chưa chạy thử)
8. **Màu vạch lớp trùng màu nghĩa.** `CLASS_ACCENTS` gồm xanh lá (`--kin-th-bac-ha`) và cam (`--kin-th-vang-nang`, `--kin-ph-hub`); xanh lá và cam lại là màu nghĩa "xong" và "chờ" (BRIEF). Hai token `--kin-th-vang-nang` và `--kin-ph-hub` còn **cùng mã màu** (#f59e0b ở chế độ sáng), nên hai lớp có thể trùng màu. Đã đo trong `kin-tokens.css`.

**Về hành vi (suy ra từ mã, chưa chạy thử; nên kiểm trước khi thiết kế dựa vào)**
9. **Đổi tuần không có khung chờ.** Khi bấm "Tuần sau →", dữ liệu cũ vẫn nằm trong state tới khi tuần mới về: dải ngày đã đổi nhưng danh sách ở trạng thái mờ 70% và **trống** (các ngày mới không khớp dữ liệu cũ). Nếu tuần trước đó rỗng, khung "Tuần này chưa có buổi học nào" **nháy lên giả** trong lúc tải tuần mới. Dải 7 ngày cũng đọc "không có buổi" trong lúc tải lần đầu.
10. **Tiêu đề rỗng nói "Tuần này"** kể cả khi đang xem tuần khác (chữ cố định); test yêu cầu đúng chữ này ở tuần hiện tại của gia sư mới.
11. **Mất dữ liệu khi tải lại:** tin xử lý báo nghỉ ("Nhắn phụ huynh qua Zalo") và dòng "Đã mở Zalo lúc …" của **lịch tuần** chỉ sống trong phiên. Gia sư bấm "Không tính phí…" rồi tải lại trang là không còn cách nhắn phụ huynh từ màn này.
12. **"Mở lại Zalo" sau khi buổi đã bắt đầu** vẫn hiện nút cho tin đã mở trước đó; bấm thì Zalo mở rồi API ghi từ chối 409 và toast lỗi hiện **nguyên câu của máy chủ**: "Tin nhắc này chưa tới hạn hoặc buổi học đã bắt đầu" (câu "Đã mở Zalo nhưng chưa ghi lại được." chỉ là câu dự phòng khi máy chủ không trả câu nào) — lỗi giả với người dùng, vì tin vừa được mở thật. (suy ra từ mã `LichClient.tsx` + `api/tutor/reminders/route.ts`)
13. **Câu "Sẽ mở Zalo của {số}."** hiện trong hộp nhắc từng em, nhưng trên điện thoại có bảng chia sẻ (đường mặc định) số điện thoại **không** được dùng — gia sư tự chọn người nhận; câu chữ thành sai trên điện thoại, là thiết bị chính.
14. **Hộp thoại không có nút đóng ✕**: chỉ đóng bằng Esc hoặc bấm nền mờ; trên điện thoại (tấm bám đáy màn hình) nhiều người không biết bấm nền. Nút "Để sau"/"Không đổi nữa" có ở một số hộp, không phải tất cả (hộp tin nhắc từng em, hộp nhắc cả lớp, hộp lịch tuần chỉ có "Sao chép" và "Mở …").
15. **Chữ không nhất quán:** "Sao chép" ở ba hộp, "Chép tin" ở hộp lịch tuần. Chỉ "Chép tin" bị test cố định (`ui-schedule.ts` kiểm nút này); chữ "Sao chép" ở ba hộp kia **không có test nào kiểm**, nên thống nhất về một chữ chỉ cần sửa hộp lịch tuần và một dòng test. "Nhắc lịch" (khối) vs "Gửi lịch tuần" (thanh) vs "Nhắc cả lớp" (nút) là ba cách nói gần nhau.
16. **Không dùng `note` của khung giờ** (`occ.note`) dù API có; gia sư ghi chú ở tab Lịch học (phòng, bài…) thì Lịch không hiện.
17. **Ghi nhận ngày "hôm nay" theo đồng hồ máy** (`vnDateKeyOf(new Date())`) còn "đã kết thúc" theo giờ máy chủ lúc tải (`data.now`): lệch vài giây là chuyện bình thường, nhưng một thẻ "đang diễn ra" sẽ không tự chuyển "đã kết thúc" nếu không tải lại. (suy ra từ mã)
18. **Hộp "Đã khôi phục buổi về lịch tuần" thiếu câu "KiN không gửi giúp".** Hộp "Đã huỷ buổi"/"Đã dời buổi" và hộp mở lại tin báo lớp đều có câu "KiN không gửi giúp: bạn tự mở Zalo và bấm gửi để báo phụ huynh."; hộp khôi phục chỉ có ba dòng "Đã báo {n} học viên…" / "{n} báo nghỉ sát giờ đã mở lại…" / "Nếu bạn đã báo lớp là buổi này đổi lịch, hãy báo lại bằng tin bên dưới." và đoạn "Tin chung cho cả lớp…" — trái quy tắc 8.2. (đọc từ `restore()` trong `LichClient.tsx`)
19. **Không tự cuộn tới hôm nay.** Danh sách luôn bắt đầu từ Thứ Hai; chỉ ô trong dải 7 ngày mới nhảy tới ngày. Vào giữa tuần, các buổi đầu tuần đã qua nằm trên cùng và buổi của hôm nay ở xa dưới, trong khi mục 1 nói đây là màn trả lời "hôm nay tôi dạy gì". (không có `scrollIntoView` hay neo tự động nào trong `LichClient.tsx`; chưa chạy thử)

---

## 10. Mẫu học từ đối thủ

Mỗi mẫu: **mẫu - sản phẩm - tệp ảnh.** Tệp trong `anh-tham-khao-so-gia-su/` là ảnh đã có trong gói; tệp có đường dẫn `/tmp/rs/x/word/media/…` là ảnh gốc trong báo cáo, **nằm ngoài gói gửi** (thư mục tạm, chỉ có tên băm; muốn đưa cho designer thì phải chép vào gói). Ban đầu ghi theo mô tả của agent đã mở ảnh; người kiểm chứng đã mở lại và đối chiếu ảnh của mẫu 1–13 (mẫu 14: chi tiết "toast che lên hộp hướng dẫn (Sổ Gia Sư)" chưa xác nhận được). **Không chép bố cục desktop cứng** (lưới giờ 7 cột × 16 giờ, lưới tháng 7 cột).

1. **Nút "Hôm nay"**: nằm **giữa hai mũi tên** ở Sổ Gia Sư (lịch dạy, `anh-tham-khao-so-gia-su/02-lich-tuan.jpg`; trong ảnh này nút vẫn đậm dù đang xem tuần có hôm nay) và ở TutorBird (`/tmp/rs/x/word/media/190a8682fab03bdafb01deeecedca00f8884048a.jpg`); **mờ khi đã ở hôm nay** là ở Teachworks (`/tmp/rs/x/word/media/313a202fb15a9b3fbeaae5fa21c53d13e26c9fbe.jpg`: nút "Hôm nay" xám nhạt trong cụm Tháng/Tuần/Ngày, hai mũi tên nằm riêng bên trái). KiN đã có ("Tuần này" khoá khi ở tuần này); giữ.
2. **Cột/ô hôm nay tô nền khác, ngày hôm nay khoanh tròn đặc** - TutorBird (lưới tháng) và Sổ Gia Sư - `/tmp/rs/x/word/media/d9a48bb81ed1088b1d3fbf33203016a338ed751a.jpg`; `anh-tham-khao-so-gia-su/02-lich-tuan.jpg`. KiN đã có ở dải 7 ngày; giữ.
3. **Khối buổi tô màu theo lớp, dấu trạng thái nhỏ ở góc (✓ xong, đồng hồ sắp tới)** - Sổ Gia Sư - `anh-tham-khao-so-gia-su/02-lich-tuan.jpg`. Học: dấu trạng thái là **biểu tượng + chữ** gắn ngay thẻ; tránh: khối đặc màu xám nhìn như bị vô hiệu, chữ tên lớp bị cắt "Lớp TEST …".
4. **Danh sách "hôm nay": giờ đậm to nhất, vạch màu bên trái, tên dưới giờ** - TutorBird (trang chủ) - `/tmp/rs/x/word/media/2b42778202338e054738963f94987070146fba2c.jpg`. Đúng dạng dòng buổi đề xuất ở mục 4.1.
5. **Cửa sổ buổi: hàng biểu tượng nhỏ phía trên, một nút đặc rộng ở đáy là hành động chính duy nhất ("Điểm danh")** - TutorBird - `/tmp/rs/x/word/media/190a8682fab03bdafb01deeecedca00f8884048a.jpg`. Học: một nút chính rộng cho khối. Tránh: biểu tượng không nhãn chữ (KiN luôn có chữ).
6. **Banner trạng thái buổi một dòng + một nút kèm theo ("Buổi học đã chốt … [Mở lại buổi học]"); nhãn trạng thái bằng chữ cạnh tiêu đề buổi** - Sổ Gia Sư - `anh-tham-khao-so-gia-su/07-chi-tiet-buoi-hoc.jpg`. Học cho khối "đã huỷ/đã dời": một câu trạng thái + một nút chính ("Báo lớp qua Zalo") + "Khôi phục lịch cũ" là nút phụ.
7. **Hành động phá huỷ gom vào vùng riêng cuối trang** - Sổ Gia Sư (chi tiết lớp) - `/tmp/rs/x/word/media/486587a87c9cf408f22b3a976fe6c4637aca565b.jpg`. Học: "Huỷ buổi" tách xa "Dời buổi", hoặc đặt cuối khối, viền cảnh báo, không đặt cạnh nút chính. (Với KiN, "Huỷ buổi" ở khối chỉ **mở hộp xác nhận**, nên mục 4.1 bước 6.3 để hai nút cạnh nhau và cho "Huỷ buổi" kiểu `danger`; mẫu này áp dụng đầy đủ cho nút ghi ngay.)
8. **Ngày + giờ đặt cạnh nhau hai cột trong form lịch; form trong ngăn trượt, giữ ngữ cảnh lịch phía sau** - TutorBird - `/tmp/rs/x/word/media/189297bffa14f541a2abcf5a416c73ea4bb0821c.jpg`. Học cho hộp "Dời buổi": ngày mới / giờ bắt đầu / giờ kết thúc cùng hàng khi đủ chỗ (từ 640px trở lên đã là `sm:grid-cols-3`; trên 390px xếp dọc).
9. **Nút "Kiểm tra xung đột" trước khi lưu lịch; nhãn trên ô nhập; ba nút chân form khác màu có thứ tự rõ** - Teachworks - `/tmp/rs/x/word/media/8a3fc5b1bfb8dcf4cc6e90a346046923efa2aa1c.jpg`. Học nhẹ: cảnh báo xung đột **trước khi bấm lưu** (ví dụ khi chọn "Ngày mới" trùng thứ của khung giờ thì hiện câu nhắc ngay dưới ô, không đợi máy chủ từ chối). Tránh: giờ 12 giờ AM/PM, ba nút đồng đều không có nút chính nổi bật.
10. **Chọn ngày bằng chip ngang, ngày chọn viền đậm; giờ khả dụng viền đen, hết chỗ nền xám + chữ nhạt** - sàn gia sư (ảnh `66e5…` có logo Preply: hộp "Đặt lịch học thử"; ảnh `a3c4…` là phần giờ cùng hộp đó) - `/tmp/rs/x/word/media/66e5b5d690ce454dee7cf760ce6b63ec07929518.jpg`, `/tmp/rs/x/word/media/a3c40ef1ec29b8c407648d1f9d8e7973b622b948.jpg`. Trong ảnh: ngày đang chọn có viền đậm (màu hồng) và ô giờ còn chỗ có chữ đen trên nền trắng viền xám nhạt, còn hết chỗ nền xám + chữ nhạt. Học: ô "đang chọn" của dải 7 ngày cần trạng thái riêng khác "hôm nay"; tránh: chỉ phân biệt bằng sắc độ (mục 8, "màu không nói một mình").
11. **Lịch rảnh dạng chuỗi giờ dài theo thứ** - Wyzant - `/tmp/rs/x/word/media/c4ad5abc1daea3625ef2dbab9e3dd2cfdeb78f4b.jpg`. **Tránh** (đã có ở nhận xét: "chỉ nên lấy ý tưởng, trên điện thoại dùng lưới tuần").
12. **Lịch sắp tới: mỗi dòng có mũi tên ">" bấm vào buổi; trạng thái rỗng có biểu tượng + một câu ngắn** - Sổ Gia Sư (trang chủ) - `/tmp/rs/x/word/media/9eca714966e340fa1bb9890eddd213f8ede28a91.jpg`. Học cho dòng buổi gọn và trạng thái rỗng.
13. **Nút "Chia sẻ lịch" một chỗ ở góc phải tiêu đề, là nút viền, không phải nút đặc** - Sổ Gia Sư - `anh-tham-khao-so-gia-su/02-lich-tuan.jpg`. KiN có "Gửi lịch tuần qua Zalo" tương ứng: nút phụ gọn, không chiếm hàng riêng cả khối.
14. **Tránh**: khung hướng dẫn dài đầu trang đẩy lịch xuống (TutorBird, Teachworks); popover bị cắt ở gần đáy màn hình (TutorBird `190a8682…`); toast che lên hộp hướng dẫn (Sổ Gia Sư).

---

## 11. Dữ liệu mẫu để điền vào thiết kế

Gia sư **Cô Lan** (`giasu@kin.local`), 7 lớp (Toán 9, Toán 8 đang tạm ngừng, Toán 7, Văn 8, Sinh 8, Hoá 8, Lý 9; Toán 8 và Toán 7 không có buổi trong tuần mẫu — danh sách lớp theo `03-lop-gia-su.md` mục 11), 8 học viên đang học. Hôm nay **Thứ Năm 22/10/2026**; đang xem **Tuần 19/10 – 25/10**. Màn Lịch **không có số tiền** (dù đã thu tháng 10 là 480.000đ, số này thuộc màn Học phí; **không** điền vào Lịch).

Danh sách buổi (đúng cách hiển thị):

1. **Thứ Hai 19/10** · 18:00–19:30 · Văn 8 · 0 học viên · đã kết thúc
2. **Thứ Tư 21/10** · 09:00–10:00 · Hoá 8 · 2 học viên · đã kết thúc
3. **Thứ Tư 21/10** · 18:00–19:30 · ~~Văn 8~~ · 0 học viên · buổi đã huỷ · huy hiệu "Đã huỷ" (lý do "Cô ốm")
4. **Thứ Năm 22/10 · Hôm nay** · 14:00–15:00 · Sinh 8 · 2 học viên · đã kết thúc
5. **Thứ Năm 22/10 · Hôm nay** · 19:00–20:00 · Lý 9 · 2 học viên · sắp tới
6. **Thứ Sáu 23/10** · 19:00–20:30 · **Toán 9** · 2 học viên (Đỗ Hà, Trần Gia Bảo) · sắp tới · huy hiệu đỏ "1 báo nghỉ sát giờ" · huy hiệu cam "2 tin nhắc chờ gửi"
7. **Thứ Bảy 24/10** · 16:00–17:30 · Văn 8 · 0 học viên · sắp tới · huy hiệu "Đã dời" · "dời từ Thứ Sáu 23/10 19:00"
8. **Chủ nhật 25/10**: không có buổi (ô ngày mờ trong dải).

**Lưu ý nhất quán của bộ dữ liệu mẫu (đọc trước khi vẽ):** đây là dữ liệu minh hoạ ghép nhiều trạng thái, **không phải một ảnh chụp thật ở một thời điểm**; vẽ theo từng trạng thái, đừng cố làm khớp đồng hồ. Cụ thể: (a) Văn 8 có **0 học viên** (khớp dữ liệu thử và `03-lop-gia-su.md`), nên hộp huỷ/dời của Văn 8 sẽ đọc "Lớp chưa có học viên nào đang học để báo trong ứng dụng." thay cho "Đã báo 2 học viên trong ứng dụng." (câu có số 2 là của Toán 9); (b) "báo trước 40 phút" của Đỗ Hà chỉ có thể tồn tại sau 18:20 Thứ Sáu 23/10 (báo nghỉ sát giờ chỉ được ghi lúc phụ huynh báo, không báo trước được cho tương lai), trong khi "hôm nay" là Thứ Năm 22/10; tương tự "2 tin nhắc chờ gửi" của Toán 9 cần từ 19:00 Thứ Năm (khi tin 24 giờ tới hạn), lúc đó Lý 9 19:00 đã không còn "sắp tới". Trong dữ liệu thử thật các số này được ghi thẳng vào cơ sở dữ liệu nên cùng tồn tại; (c) hai buổi của hôm nay (Sinh 8 14:00, Lý 9 19:00) là dữ liệu thêm để thấy chip "Hôm nay"; trong dữ liệu thử thật Sinh 8 nằm ở Thứ Tư 21/10 và Thứ Năm không có buổi; (d) khung gốc Thứ Sáu 19:00 của Văn 8 trùng giờ với Toán 9 của cùng một gia sư; màn Lịch không cảnh báo trùng giờ giữa các lớp.

Chi tiết thẻ **Toán 9, Thứ Sáu 23/10** khi mở:

- Báo nghỉ: **Đỗ Hà** · nhãn "Báo nghỉ sát giờ — chờ bạn xử lý" · "báo trước 40 phút · Lý do: Con bị sốt"; nút "Không tính phí, giữ 1 buổi bù" (chính), "Tính phí buổi này".
- Nhắc lịch: "Nhắc 24 giờ: 19:00 ngày 22/10 · Nhắc 1 giờ: 18:00 ngày 23/10 · Hạn báo nghỉ giữ buổi bù: 17:00 ngày 23/10". **Trần Gia Bảo**: "Nhắc 24 giờ · phụ huynh" (nút "Soạn & mở Zalo"), "Nhắc 24 giờ · học sinh" (nút "Soạn & mở Zalo").
- Link vào lớp: `https://meet.google.com/abc-defg-hij`; nhóm Zalo: "Đã gắn nhóm Zalo của lớp."

Tin mẫu (giữ đúng khuôn):

- **Lịch tuần (Văn 8):**
  "Lịch học tuần 19/10 – 25/10 của lớp Văn 8:" / "- Thứ Hai 19/10, 18:00–19:30" / "- Thứ Tư 21/10, 18:00–19:30 (nghỉ)" / "- Thứ Bảy 24/10, 16:00–17:30 (dời từ Thứ Sáu 23/10 19:00)" / "Cần nghỉ thì báo riêng với thầy/cô trước giờ học nhé."
- **Nhắc 24 giờ gửi phụ huynh (Trần Gia Bảo, Toán 9):**
  "KiN nhắc lịch: con Trần Gia Bảo có buổi Toán 9 lúc 19:00 tối mai, thứ Sáu 23/10, với Cô Lan." (nếu có link: dòng "Link vào lớp: …") / "Con cần nghỉ thì anh/chị báo ở sổ học trước 17:00 để con được giữ buổi bù."
- **Tin sau khi chọn "Không tính phí, giữ 1 buổi bù" (Đỗ Hà):**
  "Đã ghi nhận con nghỉ buổi 23/10. Buổi này không tính phí và con còn 1 buổi bù. Cô Lan sẽ hẹn giờ bù với anh/chị."
- **Tin báo huỷ cả lớp (Văn 8):**
  "KiN báo lịch: buổi Văn 8 lúc 18:00 thứ tư 21/10 được HUỶ. Lý do: Cô ốm." / "Nếu có lịch học bù, gia sư sẽ báo thêm." / "Cô Lan" (chữ ký: tên gia sư, thêm "Thầy/Cô" chỉ khi tên chưa có)

Hộp thoại mẫu: tiêu đề "Dời buổi — Văn 8"; dòng "Buổi gốc: Thứ Sáu 23/10 lúc 19:00."; ngày mới 24/10, giờ 16:00–17:30; lý do "Trùng lịch thi".

---

## 12. Câu hỏi còn mở

Mỗi điểm có nhãn đầu dòng: **[Chủ dự án]** = cần chủ dự án chốt (đổi hành vi quen tay, đổi chữ bị test chốt, đụng tiền, đụng cơ sở dữ liệu, lan sang màn khác, hoặc thêm màu ngoài bộ); **[Không cần chủ dự án]** = designer hoặc người viết mã tự quyết được, ghi ở đây để biết; **[Chỉ để biết]** = ghi chú nguồn, không phải câu hỏi. Điểm 1–4, 6, 7, 9–11 và 14 là việc chủ dự án phải quyết trước khi bản thiết kế tương ứng được dựng thật. Không điểm nào đòi đổi cách tính tiền hay thêm dữ liệu về trẻ em; điểm 8 còn **bớt** một chỗ đang hiện số điện thoại.

1. **[Chủ dự án] Có cho phép đổi thứ tự khối trong chi tiết buổi** (báo nghỉ chờ → nhắc lịch → đổi lịch → tiện ích) như mục 4.1 không? Hiện tại thứ tự là link lớp → kế hoạch buổi → báo nghỉ → đổi lịch → nhắc lịch. Test không phụ thuộc thứ tự, nhưng đây là thay đổi hành vi quen tay của Cô Lan; cần chủ dự án chốt.
2. **[Chủ dự án] Gộp tin nhắc từng em thế nào?** Hiện mỗi em có tới 4 dòng nhắc (phụ huynh/học sinh × 24 giờ/1 giờ). Có muốn gộp theo "người nhận" (một nút "Nhắc phụ huynh" mở tin 24 giờ hoặc 1 giờ tới hạn) hay giữ từng tin riêng? Gộp **đổi nhãn nút** và có thể đụng test `ui-schedule.ts` ("Soạn & mở Zalo", "Mở lại Zalo" đếm đúng 1, nút "Soạn & mở Zalo" đầu tiên phải là tin gửi phụ huynh); cần quyết trước khi thiết kế.
3. **[Chủ dự án — đề xuất: không] Có thêm bố cục hai cột trên máy tính** (danh sách buổi trái, chi tiết phải, giống khung đọc Outlook) không? Đề xuất của tôi là **không** (giữ mở tại chỗ để khỏi viết lại test kiểm thẻ buổi là nút có `aria-expanded`), nhưng nếu muốn đồng bộ với "khung đọc" của Hộp việc thì phải sửa test.
4. **[Chủ dự án] Màu vạch theo lớp:** `CLASS_ACCENTS` có xanh lá và cam trùng màu nghĩa, và hai token cùng mã #f59e0b. Chủ dự án có chấp nhận thêm token màu lớp riêng (ví dụ một bảng 6–8 màu không trùng màu nghĩa) vào bộ `--kin-*` không? Không có token thì thiết kế không được tự thêm màu.
5. **[Không cần chủ dự án] Dải 7 ngày có cần trạng thái "đang chọn"** (ngoài "hôm nay")? Hiện chỉ cuộn tới ngày; không có ngày đang chọn. Designer có thể vẽ thêm trạng thái này trong bộ token hiện có (viền đậm + `aria-current`, không thêm màu), vì không đổi dữ liệu hay chữ bị test chốt; người viết mã chỉ cần thêm một trạng thái hiển thị.
6. **[Chủ dự án — nhỏ] Hiển thị `note` của khung giờ** (ghi chú, ví dụ phòng học) trên thẻ buổi? API đã có; cần quyết có đưa vào không và ở đâu (dòng phụ hay chỉ khi mở).
7. **[Chủ dự án — lan sang nhiều màn] Nút đóng ✕ cho hộp thoại**: thêm không? Thêm nút "Đóng" không đụng test hiện có (test dùng Esc), nhưng nằm trong `Modal` dùng chung cho cả các màn khác (`src/components/tutor/shared.tsx`), nên thay đổi lan sang màn khác.
8. **[Không cần chủ dự án] Câu "Sẽ mở Zalo của {số}."** trên điện thoại (xem 9.13): sửa câu theo thiết bị (cần mã) hay đổi lời thành chung chung ("KiN sẽ mở Zalo; chọn đúng người nhận nếu chưa tự mở đúng cuộc trò chuyện")? Chữ này không nằm trong test; đổi là việc của người viết mã chứ không chỉ thiết kế. Nên chọn lời chung chung: nó cũng **bỏ chỗ duy nhất đang hiện số điện thoại** (quy tắc 8.5).
9. **[Chủ dự án — đụng cơ sở dữ liệu] Lưu "đã mở Zalo" cho lịch tuần** (hiện chỉ trong phiên): có muốn lưu bền (cần bảng/cột mới, đụng cơ sở dữ liệu) hay giữ như hiện tại và thiết kế đừng ngụ ý nó nhớ lâu?
10. **[Chủ dự án — có lời nói về tiền] Sau khi xử lý báo nghỉ rồi tải lại trang:** muốn có chỗ mở lại tin phụ huynh (như "Mở lại tin báo lớp" của buổi đổi lịch) không? Cần dữ liệu từ máy chủ: dựng lại tin phải có `absence.status`, ngày buổi và số buổi bù còn hạn (`makeupCount`, hiện **không** có trong dữ liệu lịch), và tin "không tính phí"/"vẫn tính phí" là lời nói về tiền; thiết kế phải biết trước.
11. **[Chủ dự án — tiền] Ngôn ngữ nút "Tính phí buổi này" (và "Không tính phí…"):** ở trạng thái chờ, "tính phí" nghe như đã chốt tiền. Có đổi nhãn không? (Test chốt chữ này; đổi phải sửa test và hỏi chủ dự án vì liên quan tiền, KHO mục 9.) Kèm một sự thật chủ dự án cần biết khi quyết: cả hai nút hiện **chưa nối** vào phiếu học phí (GD-25 chưa làm; `sessionChange.ts`, `docs/kin/tien-do-dang-do.md`) và điểm danh "Có phép" không trừ tiền, trong khi nhãn và tin gửi phụ huynh đã nói "không tính phí"/"vẫn tính phí theo quy định đã báo trước"; nên quyết cả việc đó có phải chờ GD-25 rồi mới đổi chữ hay không. Thiết kế **không** được tự đổi cách tính.
12. **[Không cần chủ dự án] Hiển thị khi tải đổi tuần** (mục 9, điểm 9): ưu tiên giữ danh sách tuần cũ mờ đi, hay thay bằng khung chờ tuần mới? Đây là sửa hành vi, cần người viết mã; thiết kế vẽ cả hai trạng thái được không?
13. **[Chỉ để biết] Nguồn ảnh mục 10:** tên tệp ảnh gốc trong báo cáo chỉ là mã băm; ảnh nào thuộc sản phẩm nào là suy từ nội dung ảnh (TutorBird, Teachworks, Sổ Gia Sư, Preply, Wyzant). Người kiểm chứng đã mở lại đối chiếu ảnh của mẫu 1–13 (xem lời dẫn mục 10); các ảnh `/tmp/rs/…` nằm ngoài gói gửi.
14. **[Chủ dự án] Mở Lịch có nên tự cuộn tới hôm nay không?** (mục 9, điểm 19) Hiện danh sách luôn bắt đầu từ Thứ Hai; tự cuộn tới ngày hôm nay (hoặc buổi kế tiếp) là đổi hành vi của màn dùng nhiều nhất, nên cần chốt; designer vẽ được cả hai.
