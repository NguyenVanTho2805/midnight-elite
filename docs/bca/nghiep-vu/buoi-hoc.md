# Nghiệp vụ — Buổi học (Đợt 1)

Nguồn: `kinSinhBuoi`, `K.genSessions`, `kin_buoiGhi`, `kin_sessions`, `kin_mons`, `kinBatDauLai`, `kinTuDongToi`, `kin_isoLocal` trong script v8.12, cùng bản xuất sheet ngày 26/11/2026. Quy ước chung (ngày, múi giờ, "đến hết ngày") xem đầu tệp `ghi-danh.md`.

## Điều 1. Môn và lịch

1.1. Mỗi môn có các trường sau. Số liệu ngày 26/11 lấy từ khối Môn của ⚙️ Cài đặt.

| Mã | Tên đầy đủ | Thứ (sheet, 8 = CN) | Thứ (ISO, lưu mới) | Giờ | Số phút |
|---|---|---|---|---|---|
| Toán | Toán | 3,7 | 2,6 | 22:15 | 90 |
| Sử | Lịch sử | 4,8 | 3,7 | 22:15 | 90 |
| Địa | Địa lí | 6 | 5 | 22:15 | 90 |
| Anh | Tiếng Anh | 2,5 | 1,4 | 22:15 | 90 |

Ngoài ra mỗi môn còn có: giáo viên (xem `phan-quyen.md`), link Meet (Đợt 4), link Zalo nhóm môn, tên lớp Azota và sĩ số tối đa.

1.2. **Cách đánh số thứ trong tuần:** web mới lưu theo ISO (1 = T2 … 7 = CN). Khi chuyển từ sheet: `iso = sheet − 1`. Sheet ghi 1 hoặc 8 đều là CN, nên đều đổi thành 7.

## Điều 2. Thời điểm của buổi

2.1. Giờ bắt đầu = ngày của buổi + giờ của môn, tính theo giờ Việt Nam, lưu kiểu `timestamptz`. Giờ kết thúc = giờ bắt đầu + số phút.
- Ví dụ: buổi Toán ngày 01/12/2026 bắt đầu `2026-12-01 22:15 +07` (tức `2026-12-01T15:15Z`), kết thúc 23:45 cùng ngày.

2.2. **Buổi thuộc ngày nào?** Thuộc ngày (giờ Việt Nam) của **giờ bắt đầu**, kể cả khi buổi kéo qua nửa đêm.
- Ví dụ: chủ đổi Sử thành 120 phút, nên buổi CN 13/12 chạy 22:15 → **00:15 ngày 14/12**. Buổi vẫn là "Sử 13/12":
  - em ghi danh "đến hết 13/12" vẫn có tên trong buổi này;
  - điểm danh ghi lúc 00:05 ngày 14/12 vẫn gắn vào buổi 13/12, vì điểm danh gắn theo mã buổi chứ không theo "hôm nay";
  - học phí (Đợt 3) tính buổi này vào tháng của ngày 13/12.
- Ca biên đổi tháng: buổi Anh Thứ Hai 30/11 kéo tới 00:15 ngày 01/12 vẫn tính vào **tháng 11**.

## Điều 3. Sinh buổi theo lịch

3.1. Sinh buổi cho một tháng: duyệt từng ngày trong tháng; môn nào có thứ đó trong lịch thì tạo một buổi "Có học" theo lịch, giờ và số phút hiện tại của môn.
Không sinh:
- buổi trước `NGAY_BAT_DAU_TINH_PHI` (hiện là 16/11/2026);
- buổi đã có, tức trùng khoá (môn, giờ bắt đầu).

3.2. Sinh buổi phải **lặp lại được an toàn**: chạy hai lần cho cùng một tháng thì không có buổi trùng và không đổi buổi đã có.

3.3. Lịch tự động: vào lúc 20:30 giờ Việt Nam các ngày từ 25 đến cuối tháng, sinh buổi cho tháng sau. Cron cấu hình theo UTC thì là 13:30Z. Chủ cũng bấm tay được, chọn tháng bất kỳ.
- Ví dụ số thật:
  - tháng 11 từ 16/11: Toán 4, Sử 4, Địa 2, Anh 5, cộng **15 buổi**;
  - tháng 12: Toán 9, Sử 9, Địa 4, Anh 9, cộng **31 buổi**;
  - tổng 46 buổi, đúng bằng số dòng 📅 Buổi học trên sheet ngày 26/11.
- Ca biên: tháng 11 tính từ ngày 01 sẽ có Toán 8, Sử 9, Địa 4, Anh 9. Những buổi trước 16/11 không sinh vì nằm trước ngày bắt đầu.

## Điều 4. Đổi lịch môn

4.1. Đổi thứ, giờ hoặc số phút của môn chỉ ảnh hưởng **các buổi từ ngày hiệu lực trở đi**. Cách xử lý các buổi tương lai đã sinh xem Câu hỏi 1. Buổi đã qua giữ nguyên.
- Ví dụ: từ 01/12, Địa chuyển từ T6 sang T5.
  - Theo phương án A của Câu hỏi 1: 4 buổi Địa T6 của tháng 12 (04, 11, 18, 25), nếu chưa có điểm danh hay nội dung, sẽ bị xoá và sinh lại thành **5** buổi T5 (03, 10, 17, 24, 31). Số buổi tính phí của Địa tháng 12 vì vậy tăng từ 4 lên 5.
  - Hôm nay hiện cảnh báo: T5 trùng giờ 22:15 với Anh, và cho biết có bao nhiêu em học cả hai môn.

## Điều 5. Trạng thái buổi

5.1. Mỗi buổi có:
- **loại:** `theo_lich` hoặc `hoc_bu`;
- **trạng thái:** `binh_thuong` hoặc `huy`.

Cách hiển thị và chuyển từ sheet:

| Sheet | Loại | Trạng thái | Hiển thị | Điểm danh | Tính phí (Đợt 3) |
|---|---|---|---|---|---|
| Có học | theo_lich | binh_thuong | Có học | Có | Có |
| Nghỉ | theo_lich | huy | Huỷ (lớp nghỉ) | Không | Không |
| Học bù | hoc_bu | binh_thuong | Học bù | Có | Có |

Ngày 26/11: 46 buổi, đều là "Có học". Có 5 buổi đã tick "Đã điểm danh".

5.2. Buổi tương lai vẫn là "Có học" (đã lên lịch). Web **không** tự đổi trạng thái khi buổi trôi qua. "Đã dạy hay chưa" được suy ra từ việc buổi đã điểm danh chưa (xem `diem-danh.md`).

## Điều 6. Huỷ buổi

6.1. Huỷ một buổi phải có lý do, ví dụ "GV ốm" hoặc "nghỉ lễ". Người được huỷ: xem Câu hỏi 2. Hệ thống làm như sau:
- buổi chuyển sang `huy`;
- buổi biến khỏi danh sách cần điểm danh;
- học sinh thấy dòng "Lớp nghỉ" kèm lý do (Đợt 2).
- Ví dụ: huỷ Sử T4 09/12. Tháng 12, Sử còn **8 buổi tính phí** thay vì 9.

6.2. Huỷ một buổi **đã có điểm danh** phải xác nhận lần nữa. Điểm danh vẫn giữ nhưng không tính vào chuyên cần. Bỏ huỷ thì điểm danh hiện lại.
Sheet làm tương tự: tick "Lớp nghỉ" thì các ô hiện "—", còn dấu đã lưu không bị xoá.

6.3. **Không xoá** buổi đã có điểm danh, nội dung hoặc link record; chỉ được huỷ. Buổi chưa có dữ liệu gì thì được xoá, ví dụ buổi sinh nhầm.

## Điều 7. Học bù

7.1. Học bù là một buổi thêm ngoài lịch. Các trường:
- môn, ngày, giờ bắt đầu (mặc định 22:15), số phút (mặc định 90);
- tuỳ chọn "bù cho buổi" (mã của một buổi đã huỷ);
- ghi chú.

7.2. **Danh sách em của buổi học bù** = các em có ghi danh môn đó còn hiệu lực **vào ngày học bù**, giống sheet. Danh sách này không phụ thuộc buổi gốc bị huỷ.
- Ví dụ: huỷ Sử 09/12, bù vào CN 13/12 lúc 20:00, 90 phút (trước buổi Sử 22:15 cùng ngày). Ngày 13/12 có 2 buổi Sử, cả hai đều tính phí.
- Ca biên: em thử Sử có hạn 11/12. Buổi bị huỷ 09/12 nằm trong hạn thử của em, nhưng buổi bù 13/12 thì không, nên em **không** có tên trong buổi bù.
- Ca biên đổi tháng: huỷ Anh 30/11, bù Thứ Tư 02/12 lúc 20:00. Buổi bù tính vào **tháng 12**, vì học phí đếm theo ngày của buổi (quyết định 13). Tháng 11, Anh ít đi 1 buổi.

7.3. Tối nào cũng có một môn học lúc 22:15. Vì vậy, nếu buổi bù chồng giờ với buổi khác (tính cả số phút), web phải **cảnh báo** và nêu số em học cả hai môn, nhưng **không chặn**.
- Ví dụ: bù Sử vào T2 07/12 lúc 22:15 thì chồng với Anh. Cảnh báo "trùng giờ Anh, N em học cả hai môn".

7.4. Khoá duy nhất của buổi là (môn, giờ bắt đầu). Vì vậy một môn có thể có 2 buổi trong cùng một ngày, như ví dụ 13/12 ở trên. Sheet dùng khoá (ngày, môn) nên không ghi được trường hợp này.

## Điều 8. Nội dung buổi và link record

8.1. Mỗi buổi có ô "Nội dung buổi" (chữ, tối đa 2.000 ký tự) và "Link record" (URL, phải bắt đầu bằng `https://`). GV dạy môn đó và chủ được sửa, kể cả sau khi buổi đã qua.
- Ví dụ: GV Toán (giả) dán `https://drive.google.com/…` vào buổi 05/12 lúc 00:30 ngày 06/12. Link vẫn gắn vào buổi 05/12.

8.2. Link không phải `https` (ví dụ `drive.google.com/abc` thiếu giao thức) thì tự thêm `https://`. Chuỗi không phải URL thì từ chối và báo lỗi ngay ô đó.

8.3. Ai được xem record: xem `phan-quyen.md`. Học sinh thấy record của những buổi mà em có ghi danh còn hiệu lực vào ngày buổi đó, cả em thử còn trong hạn (quyết định 8).

8.4. Sheet ngày 26/11: cả 46 buổi đều chưa có nội dung lẫn link record.

## Điều 9. Màn danh sách buổi

9.1. Lọc theo tháng và môn. Mỗi dòng gồm: ngày, thứ, môn, giờ, trạng thái, tình trạng điểm danh (x/y em, xem `diem-danh.md`), nội dung, record. Có nút "Sinh buổi tháng…" (chỉ chủ).

## Điểm nối

- **Đợt 3:** buổi tính phí = loại bất kỳ, trạng thái `binh_thuong`, trong tháng, từ ngày em lên chính thức và từ `NGAY_BAT_DAU_TINH_PHI`. Em vắng vẫn tính tiền (giống sheet, `K.bill`).
- **Đợt 4:** sự kiện Google Calendar/Meet lấy lịch của môn. Huỷ hoặc thêm học bù sẽ báo Meet ở lần đồng bộ sau.

## Khác sheet

| # | Sheet | Web mới |
|---|---|---|
| K1 | Khoá buổi là (ngày, môn), nên học bù cùng ngày với buổi lịch bị coi là "đã có". | Khoá là (môn, giờ bắt đầu), được có 2 buổi cùng ngày. |
| K2 | Trạng thái "Nghỉ". | Gọi là "Huỷ", bắt buộc có lý do. |
| K3 | Học bù là một dòng tự do. | Có thể gắn với buổi bị huỷ, và cảnh báo trùng giờ. |
| K4 | "Bắt đầu lại" xoá hết buổi và dấu điểm danh trước một ngày. | Không có chức năng này. Ngày bắt đầu 16/11/2026 được giữ khi chuyển dữ liệu. |
| K5 | Thứ đánh số 2–8 (8 = CN). | Thứ theo ISO 1–7. |
| K6 | Đổi lịch chỉ sinh thêm buổi; buổi thừa phải tự đổi "Nghỉ". | Chờ chủ trả lời Câu hỏi 1. |

## Câu hỏi cho chủ

1. **Đổi lịch một môn thì các buổi đã sinh sẵn ở tương lai xử lý thế nào?**
   - A. Xoá và sinh lại những buổi tương lai chưa có dữ liệu. Buổi đã có điểm danh, nội dung hoặc record thì giữ và báo cho chủ. **(khuyên dùng: tránh tính tiền buổi không có thật)**
   - B. Như sheet: chỉ sinh thêm, chủ tự huỷ buổi thừa.
2. **Ai được huỷ buổi và thêm buổi học bù?** Việc này ảnh hưởng số buổi tính tiền.
   - A. Chỉ chủ. **(khuyên dùng)**
   - B. GV của môn đó cũng được, có nhật ký, và chủ thấy ở màn Hôm nay.
   - C. GV gửi đề nghị, chủ bấm duyệt.
