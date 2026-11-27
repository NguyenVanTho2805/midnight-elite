# Màn khu học sinh `/hoc` — Đợt 2 (BCA-D2-HS, 27/11/2026)

Nguồn: `huong-chon.md` (nền Midnight A + phần đầu dạng câu, nút to của C), `phan-quyen.md` 4.3, QĐ 8, T16, T32, T41, `viec-con-lai.md` "Đợt 2 — ghi chú đầu vào". Điện thoại trước (390px), một cột, tối đa 560px trên máy tính. Dữ liệu: `server/hs.cuaToi` (cùng `/api/hs/toi`).

## Thứ tự trên màn
1. **Đầu trang** (56px): "BCA Midnight" + nút "Đăng xuất" (44px).
2. **Câu chào + thẻ tối nay** (mẫu C): "Chào {tên gọi}," rồi một câu lớn 24–28px:
   - Có buổi hôm nay chưa kết thúc: "Tối nay học **Toán** lúc **22:15**". Nút vàng cao 56px rộng hết hàng, đổi theo giờ (máy khách tự đổi mỗi 30 giây):
     - trước giờ học hơn 15 phút: "Vào lớp Meet · còn N phút" (vẫn bấm được);
     - từ 15 phút trước tới hết buổi: "Vào lớp ngay";
     - hết buổi: "Xem record" nếu có link, nếu chưa có: chữ "Record sẽ có sau buổi học".
     - Môn chưa có link Meet: nút phụ "Mở nhóm Zalo môn" (nếu có), kèm câu "Link Meet gửi trong nhóm Zalo".
   - Buổi hôm nay bị huỷ: "Tối nay lớp **Toán** nghỉ" + lý do.
   - Không có buổi hôm nay: "Tối nay em không có lớp." + dòng "Buổi tới: Sử · Thứ Tư 03/12 · 22:15".
3. **Học thử** (khi đang thử): "Học thử ngày 13/14 · còn 1 ngày · hết 28/11", thanh tiến độ (≤ 3 ngày đổi cam `warn`), nút phụ "Nhóm Zalo học thử" (`ZALO_HOC_THU`).
4. **Màn khoá** (hết thử / đã nghỉ, T16): thẻ viền `danger`: "Thời gian học thử đã hết từ 28/11" (hoặc "Em đã nghỉ các môn") + "Em vẫn xem được điểm danh của mình. Tài liệu và record đã khoá." + nút vàng "Liên hệ gia hạn" (`ZALO_CHUNG`, không có thì `ZALO_HOC_THU`, không có cả hai thì câu "Nhắn chủ lớp qua Zalo để gia hạn").
5. **Chuỗi đi học**: số to `tabular-nums` "5 buổi liên tiếp" (Phép và buổi chưa điểm danh không làm đứt; Vắng làm đứt). 0 ⇒ "Bắt đầu chuỗi mới từ buổi tới".
6. **Môn của em**: mỗi môn một dòng: tên đầy đủ, lịch "Thứ Ba, Thứ Bảy · 22:15", chip trạng thái chữ có dấu (Chính thức · Học thử còn N ngày · Đã nghỉ · Hết thử), link "Nhóm Zalo" nếu có.
7. **Buổi học**: 7 ngày tới (sắp tới) rồi các buổi đã qua mới nhất trước (14 buổi, nút "Xem thêm"). Mỗi buổi: "T7 22/11 · Toán · 22:15", trạng thái chữ: **Có mặt** (`ok`), **Có phép** (`excused`), **Vắng** (`danger`), **Lớp nghỉ**, buổi đã qua chưa có dấu: "—" màu `text-3` (không ghi "chưa điểm"), buổi sắp tới: "Sắp học". Có "Nội dung buổi" (T32) thì hiện 2 dòng, có record thì link "Xem record". Môn đã hết hạn: "Tài liệu đã khoá" thay cho nội dung/record.

## Không có
- Không hiện mã máy (`thu`, `nghi`, `co`…), không hiện câu "hỏi em", không hiện ghi chú điểm danh, SĐT, học phí.
- Không Lenis; chuyển động chỉ hiện dần phần đầu (tắt khi `prefers-reduced-motion`).

## Tiêu chí đạt
- 390px không tràn ngang; nút chính 56px; vùng bấm ≥ 44px; chữ thường ≥ 16px.
- Ba vai thử (chính thức, thử còn hạn, hết hạn) mỗi vai thấy đúng khối của mình; học sinh không mở được buổi lớp khác.
